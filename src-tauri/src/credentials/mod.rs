use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::sync::RwLock;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use tracing::{info, warn};

#[derive(Error, Debug)]
pub enum CredentialError {
    #[error("Keyring error: {0}")]
    Keyring(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Vault unavailable: {0}")]
    Unavailable(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CredentialStatus {
    pub has_api_key: bool,
    pub credential_status: String, // "stored", "empty", "vault_unavailable"
    pub masked_hint: Option<String>,
}

pub trait CredentialStore: Send + Sync {
    fn save_credential(&self, ref_id: &str, secret: &str) -> Result<(), CredentialError>;
    fn get_credential(&self, ref_id: &str) -> Result<Option<String>, CredentialError>;
    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError>;
    fn get_status(&self, ref_id: &str) -> CredentialStatus;
    fn backend_name(&self) -> &'static str;
}

pub fn generate_masked_hint(secret: &str) -> String {
    let trimmed = secret.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.len() <= 6 {
        return "••••••••".to_string();
    }
    let suffix = &trimmed[trimmed.len().saturating_sub(4)..];
    format!("••••••••{}", suffix)
}

// -------------------------------------------------------------
// OS Keyring Store (Secret Service / GNOME Keyring / KWallet)
// -------------------------------------------------------------
pub struct KeyringStore {
    service_name: &'static str,
}

impl KeyringStore {
    pub fn new() -> Self {
        Self {
            service_name: "ai.mechon.studio",
        }
    }
}

impl CredentialStore for KeyringStore {
    fn save_credential(&self, ref_id: &str, secret: &str) -> Result<(), CredentialError> {
        let entry = keyring::Entry::new(self.service_name, ref_id)
            .map_err(|e| CredentialError::Keyring(e.to_string()))?;
        entry.set_password(secret)
            .map_err(|e| CredentialError::Keyring(e.to_string()))
    }

    fn get_credential(&self, ref_id: &str) -> Result<Option<String>, CredentialError> {
        let entry = keyring::Entry::new(self.service_name, ref_id)
            .map_err(|e| CredentialError::Keyring(e.to_string()))?;
        match entry.get_password() {
            Ok(pass) => Ok(Some(pass)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(CredentialError::Keyring(e.to_string())),
        }
    }

    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError> {
        let entry = keyring::Entry::new(self.service_name, ref_id)
            .map_err(|e| CredentialError::Keyring(e.to_string()))?;
        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(CredentialError::Keyring(e.to_string())),
        }
    }

    fn get_status(&self, ref_id: &str) -> CredentialStatus {
        match self.get_credential(ref_id) {
            Ok(Some(secret)) if !secret.trim().is_empty() => CredentialStatus {
                has_api_key: true,
                credential_status: "stored".to_string(),
                masked_hint: Some(generate_masked_hint(&secret)),
            },
            Ok(_) => CredentialStatus {
                has_api_key: false,
                credential_status: "empty".to_string(),
                masked_hint: None,
            },
            Err(_) => CredentialStatus {
                has_api_key: false,
                credential_status: "vault_unavailable".to_string(),
                masked_hint: None,
            },
        }
    }

    fn backend_name(&self) -> &'static str {
        "os_keyring"
    }
}

// -------------------------------------------------------------
// Encrypted Local Vault Store (Fallback for headless / no D-Bus)
// -------------------------------------------------------------
pub struct EncryptedVaultStore {
    vault_path: PathBuf,
    key_material: [u8; 32],
}

impl EncryptedVaultStore {
    pub fn new() -> Self {
        let data_dir = if let Ok(xdg_data) = std::env::var("XDG_DATA_HOME") {
            PathBuf::from(xdg_data)
        } else if let Some(home) = dirs::data_dir() {
            home
        } else {
            PathBuf::from(".").join(".local").join("share")
        };
        let app_dir = data_dir.join("mechon-ai");
        let _ = fs::create_dir_all(&app_dir);
        let vault_path = app_dir.join(".vault.enc");
        Self::with_path(vault_path)
    }

    pub fn with_path(vault_path: PathBuf) -> Self {
        // Derive stable machine/user isolated key
        let mut hasher = Sha256::new();
        hasher.update(b"mechon-ai-vault-salt-v1");
        if let Ok(machine_id) = fs::read_to_string("/etc/machine-id") {
            hasher.update(machine_id.trim().as_bytes());
        }
        if let Ok(user) = std::env::var("USER") {
            hasher.update(user.as_bytes());
        }
        let key_material: [u8; 32] = hasher.finalize().into();

        Self {
            vault_path,
            key_material,
        }
    }

    fn encrypt_bytes(&self, data: &[u8]) -> Vec<u8> {
        // Stream cipher keystream via repeated SHA-256 hashing
        let mut encrypted = Vec::with_capacity(data.len());
        for (i, &byte) in data.iter().enumerate() {
            let chunk_idx = (i / 32) as u64;
            let mut h = Sha256::new();
            h.update(&self.key_material);
            h.update(&chunk_idx.to_le_bytes());
            let stream_block = h.finalize();
            let pad = stream_block[i % 32];
            encrypted.push(byte ^ pad);
        }
        encrypted
    }

    fn decrypt_bytes(&self, data: &[u8]) -> Vec<u8> {
        self.encrypt_bytes(data) // XOR symmetric
    }

    fn load_map(&self) -> HashMap<String, String> {
        if !self.vault_path.exists() {
            return HashMap::new();
        }
        let mut f = match File::open(&self.vault_path) {
            Ok(f) => f,
            Err(_) => return HashMap::new(),
        };
        let mut raw = Vec::new();
        if f.read_to_end(&mut raw).is_err() {
            return HashMap::new();
        }
        let decrypted = self.decrypt_bytes(&raw);
        serde_json::from_slice(&decrypted).unwrap_or_default()
    }

    fn save_map(&self, map: &HashMap<String, String>) -> Result<(), CredentialError> {
        let serialized = serde_json::to_vec(map)?;
        let encrypted = self.encrypt_bytes(&serialized);

        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&self.vault_path)?;

        #[cfg(unix)]
        {
            let mut perms = file.metadata()?.permissions();
            perms.set_mode(0o600); // User read/write only
            let _ = fs::set_permissions(&self.vault_path, perms);
        }

        file.write_all(&encrypted)?;
        file.flush()?;
        Ok(())
    }
}

impl CredentialStore for EncryptedVaultStore {
    fn save_credential(&self, ref_id: &str, secret: &str) -> Result<(), CredentialError> {
        let mut map = self.load_map();
        map.insert(ref_id.to_string(), secret.to_string());
        self.save_map(&map)
    }

    fn get_credential(&self, ref_id: &str) -> Result<Option<String>, CredentialError> {
        let map = self.load_map();
        Ok(map.get(ref_id).cloned())
    }

    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError> {
        let mut map = self.load_map();
        map.remove(ref_id);
        self.save_map(&map)
    }

    fn get_status(&self, ref_id: &str) -> CredentialStatus {
        match self.get_credential(ref_id) {
            Ok(Some(secret)) if !secret.trim().is_empty() => CredentialStatus {
                has_api_key: true,
                credential_status: "stored".to_string(),
                masked_hint: Some(generate_masked_hint(&secret)),
            },
            Ok(_) => CredentialStatus {
                has_api_key: false,
                credential_status: "empty".to_string(),
                masked_hint: None,
            },
            Err(_e) => CredentialStatus {
                has_api_key: false,
                credential_status: "vault_unavailable".to_string(),
                masked_hint: None,
            },
        }
    }

    fn backend_name(&self) -> &'static str {
        "encrypted_vault"
    }
}

// -------------------------------------------------------------
// In-Memory Credential Store (for testing)
// -------------------------------------------------------------
#[derive(Default)]
pub struct InMemoryCredentialStore {
    store: RwLock<HashMap<String, String>>,
}

impl InMemoryCredentialStore {
    pub fn new() -> Self {
        Self {
            store: RwLock::new(HashMap::new()),
        }
    }
}

impl CredentialStore for InMemoryCredentialStore {
    fn save_credential(&self, ref_id: &str, secret: &str) -> Result<(), CredentialError> {
        let mut lock = self.store.write().unwrap();
        lock.insert(ref_id.to_string(), secret.to_string());
        Ok(())
    }

    fn get_credential(&self, ref_id: &str) -> Result<Option<String>, CredentialError> {
        let lock = self.store.read().unwrap();
        Ok(lock.get(ref_id).cloned())
    }

    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError> {
        let mut lock = self.store.write().unwrap();
        lock.remove(ref_id);
        Ok(())
    }

    fn get_status(&self, ref_id: &str) -> CredentialStatus {
        let lock = self.store.read().unwrap();
        match lock.get(ref_id) {
            Some(secret) if !secret.trim().is_empty() => CredentialStatus {
                has_api_key: true,
                credential_status: "stored".to_string(),
                masked_hint: Some(generate_masked_hint(secret)),
            },
            _ => CredentialStatus {
                has_api_key: false,
                credential_status: "empty".to_string(),
                masked_hint: None,
            },
        }
    }

    fn backend_name(&self) -> &'static str {
        "in_memory"
    }
}

// -------------------------------------------------------------
// Hybrid Vault (Keyring with Encrypted File Fallback)
// -------------------------------------------------------------
pub struct HybridCredentialVault {
    keyring: KeyringStore,
    encrypted: EncryptedVaultStore,
}

impl HybridCredentialVault {
    pub fn new() -> Self {
        Self {
            keyring: KeyringStore::new(),
            encrypted: EncryptedVaultStore::new(),
        }
    }
}

impl CredentialStore for HybridCredentialVault {
    fn save_credential(&self, ref_id: &str, secret: &str) -> Result<(), CredentialError> {
        // Try OS keyring first
        match self.keyring.save_credential(ref_id, secret) {
            Ok(_) => {
                info!("Saved credential for '{}' into OS Keyring.", ref_id);
                // Also clean up any fallback copy
                let _ = self.encrypted.delete_credential(ref_id);
                Ok(())
            }
            Err(e) => {
                warn!("OS Keyring unavailable ({}); falling back to local encrypted vault for '{}'", e, ref_id);
                self.encrypted.save_credential(ref_id, secret)
            }
        }
    }

    fn get_credential(&self, ref_id: &str) -> Result<Option<String>, CredentialError> {
        // Check OS keyring first
        if let Ok(Some(secret)) = self.keyring.get_credential(ref_id) {
            return Ok(Some(secret));
        }
        // Fallback to encrypted vault
        self.encrypted.get_credential(ref_id)
    }

    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError> {
        let res1 = self.keyring.delete_credential(ref_id);
        let res2 = self.encrypted.delete_credential(ref_id);
        res1.and(res2)
    }

    fn get_status(&self, ref_id: &str) -> CredentialStatus {
        let status = self.keyring.get_status(ref_id);
        if status.has_api_key {
            return status;
        }
        self.encrypted.get_status(ref_id)
    }

    fn backend_name(&self) -> &'static str {
        "hybrid_vault"
    }
}
