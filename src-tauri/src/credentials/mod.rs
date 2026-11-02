use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use tracing::{info, warn};

pub const CREDENTIAL_SERVICE_NAME: &str = "com.mechon-ai.desktop";

pub fn make_credential_ref(provider_id: &str) -> String {
    format!("provider:{}:api_key", provider_id)
}

pub fn legacy_credential_ref(provider_id: &str) -> String {
    format!("provider_{}", provider_id)
}

pub fn compute_fingerprint(secret: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(secret.as_bytes());
    let hash = hasher.finalize();
    format!("sha256:{:.8}", hex::encode(hash))
}

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
    #[error("Verification failed: {0}")]
    VerificationFailed(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
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
            service_name: CREDENTIAL_SERVICE_NAME,
        }
    }

    /// Verifies that the OS keyring backend is genuinely persistent and functional.
    /// Returns false if keyring defaults to an in-memory mock or if Secret Service is unavailable.
    pub fn is_available(&self) -> bool {
        let test_account = "__mechon_vault_probe__";
        let test_value = "probe_ok_2026";

        let entry1 = match keyring::Entry::new(self.service_name, test_account) {
            Ok(e) => e,
            Err(_) => return false,
        };

        if entry1.set_password(test_value).is_err() {
            return false;
        }

        // Test read-back with an independent Entry instance
        let entry2 = match keyring::Entry::new(self.service_name, test_account) {
            Ok(e) => e,
            Err(_) => return false,
        };

        let success = match entry2.get_password() {
            Ok(val) => val == test_value,
            Err(_) => false,
        };

        let _ = entry2.delete_credential();
        success
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
// Encrypted Local Vault Store (File permission 0600, SHA-256 stream cipher)
// -------------------------------------------------------------
pub struct EncryptedVaultStore {
    vault_path: PathBuf,
    key_material: [u8; 32],
    lock: RwLock<()>,
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
            lock: RwLock::new(()),
        }
    }

    fn encrypt_bytes(&self, data: &[u8]) -> Vec<u8> {
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
        let _guard = self.lock.write().unwrap();
        let mut map = self.load_map();
        map.insert(ref_id.to_string(), secret.to_string());
        self.save_map(&map)
    }

    fn get_credential(&self, ref_id: &str) -> Result<Option<String>, CredentialError> {
        let _guard = self.lock.read().unwrap();
        let map = self.load_map();
        if let Some(val) = map.get(ref_id) {
            return Ok(Some(val.clone()));
        }

        // Backward-compatibility check for alternate identifier formats
        if ref_id.starts_with("provider:") && ref_id.ends_with(":api_key") {
            let inner_id = &ref_id["provider:".len()..ref_id.len() - ":api_key".len()];
            let leg = format!("provider_{}", inner_id);
            if let Some(val) = map.get(&leg) {
                return Ok(Some(val.clone()));
            }
        } else if ref_id.starts_with("provider_") {
            let inner_id = &ref_id["provider_".len()..];
            let modern = format!("provider:{}:api_key", inner_id);
            if let Some(val) = map.get(&modern) {
                return Ok(Some(val.clone()));
            }
        }

        Ok(None)
    }

    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError> {
        let _guard = self.lock.write().unwrap();
        let mut map = self.load_map();
        map.remove(ref_id);

        if ref_id.starts_with("provider:") && ref_id.ends_with(":api_key") {
            let inner_id = &ref_id["provider:".len()..ref_id.len() - ":api_key".len()];
            map.remove(&format!("provider_{}", inner_id));
        } else if ref_id.starts_with("provider_") {
            let inner_id = &ref_id["provider_".len()..];
            map.remove(&format!("provider:{}:api_key", inner_id));
        }

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
        if let Some(val) = lock.get(ref_id) {
            return Ok(Some(val.clone()));
        }
        if ref_id.starts_with("provider:") && ref_id.ends_with(":api_key") {
            let inner_id = &ref_id["provider:".len()..ref_id.len() - ":api_key".len()];
            let leg = format!("provider_{}", inner_id);
            if let Some(val) = lock.get(&leg) {
                return Ok(Some(val.clone()));
            }
        } else if ref_id.starts_with("provider_") {
            let inner_id = &ref_id["provider_".len()..];
            let modern = format!("provider:{}:api_key", inner_id);
            if let Some(val) = lock.get(&modern) {
                return Ok(Some(val.clone()));
            }
        }
        Ok(None)
    }

    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError> {
        let mut lock = self.store.write().unwrap();
        lock.remove(ref_id);
        if ref_id.starts_with("provider:") && ref_id.ends_with(":api_key") {
            let inner_id = &ref_id["provider:".len()..ref_id.len() - ":api_key".len()];
            lock.remove(&format!("provider_{}", inner_id));
        } else if ref_id.starts_with("provider_") {
            let inner_id = &ref_id["provider_".len()..];
            lock.remove(&format!("provider:{}:api_key", inner_id));
        }
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
// Hybrid Vault (Keyring with Encrypted File Fallback and Verification)
// -------------------------------------------------------------
pub struct HybridCredentialVault {
    keyring: KeyringStore,
    encrypted: EncryptedVaultStore,
    keyring_available: AtomicBool,
}

impl HybridCredentialVault {
    pub fn new() -> Self {
        let keyring = KeyringStore::new();
        let avail = keyring.is_available();
        if avail {
            info!("[Credential] OS Keyring / Secret Service verified and AVAILABLE");
        } else {
            info!("[Credential] OS Keyring unavailable (or transient mock); local machine-isolated encrypted vault (.vault.enc) is PRIMARY");
        }
        Self {
            keyring,
            encrypted: EncryptedVaultStore::new(),
            keyring_available: AtomicBool::new(avail),
        }
    }

    pub fn with_stores(keyring: KeyringStore, encrypted: EncryptedVaultStore) -> Self {
        let avail = keyring.is_available();
        Self {
            keyring,
            encrypted,
            keyring_available: AtomicBool::new(avail),
        }
    }

    pub fn is_keyring_active(&self) -> bool {
        self.keyring_available.load(Ordering::Relaxed)
    }
}

impl CredentialStore for HybridCredentialVault {
    fn save_credential(&self, ref_id: &str, secret: &str) -> Result<(), CredentialError> {
        let trimmed = secret.trim();
        if trimmed.is_empty() {
            return Err(CredentialError::Unavailable("Cannot save empty credential".to_string()));
        }

        let fp = compute_fingerprint(trimmed);
        info!("[Credential] Saving credential for ref '{}' (len={}, fp={})", ref_id, trimmed.len(), fp);

        // 1. Always save to local encrypted vault first as guaranteed persistent storage
        self.encrypted.save_credential(ref_id, trimmed)?;

        // 2. If OS Keyring is available, also sync there
        if self.keyring_available.load(Ordering::Relaxed) {
            match self.keyring.save_credential(ref_id, trimmed) {
                Ok(_) => {
                    info!("[Credential] Synced ref '{}' to OS Keyring", ref_id);
                }
                Err(e) => {
                    warn!("[Credential] OS Keyring write failed ({}); local encrypted vault remains active", e);
                    self.keyring_available.store(false, Ordering::Relaxed);
                }
            }
        }

        // 3. Mandatory Read-Back Verification: Confirm byte-for-byte fidelity immediately!
        let read_back = self.get_credential(ref_id)?;
        match read_back {
            Some(ref retrieved) if retrieved == trimmed => {
                info!("[Credential] Save operation: SUCCESS");
                info!("[Credential] Read-back verification: SUCCESS (ref='{}', fp={})", ref_id, fp);
                Ok(())
            }
            Some(_) => {
                Err(CredentialError::VerificationFailed(format!(
                    "Read-back content mismatch for ref '{}'", ref_id
                )))
            }
            None => {
                Err(CredentialError::VerificationFailed(format!(
                    "Read-back returned None for ref '{}' immediately after write", ref_id
                )))
            }
        }
    }

    fn get_credential(&self, ref_id: &str) -> Result<Option<String>, CredentialError> {
        // 1. Try OS Keyring if active
        if self.keyring_available.load(Ordering::Relaxed) {
            if let Ok(Some(secret)) = self.keyring.get_credential(ref_id) {
                let trimmed = secret.trim();
                if !trimmed.is_empty() {
                    return Ok(Some(trimmed.to_string()));
                }
            }
        }

        // 2. Authoritative local encrypted vault
        self.encrypted.get_credential(ref_id)
    }

    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError> {
        let res_enc = self.encrypted.delete_credential(ref_id);
        if self.keyring_available.load(Ordering::Relaxed) {
            let _ = self.keyring.delete_credential(ref_id);
        }
        res_enc
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
        if self.keyring_available.load(Ordering::Relaxed) {
            "hybrid_vault(os_keyring+encrypted)"
        } else {
            "hybrid_vault(encrypted_authoritative)"
        }
    }
}
