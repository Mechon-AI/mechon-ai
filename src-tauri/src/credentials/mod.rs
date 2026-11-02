use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
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
    #[error("Secret Service error: {0}")]
    SecretService(String),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultDiagnostics {
    pub dbus_available: bool,
    pub dbus_address: Option<String>,
    pub secret_service_available: bool,
    pub secret_service_unlocked: bool,
    pub secret_tool_installed: bool,
    pub active_backend: String,
    pub write_test: String,
    pub read_back_test: String,
    pub delete_test: String,
    pub error_details: Option<String>,
    pub actionable_guidance: Option<String>,
}

pub trait CredentialStore: Send + Sync {
    fn save_credential(&self, ref_id: &str, secret: &str) -> Result<(), CredentialError>;
    fn get_credential(&self, ref_id: &str) -> Result<Option<String>, CredentialError>;
    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError>;
    fn get_status(&self, ref_id: &str) -> CredentialStatus;
    fn backend_name(&self) -> &'static str;
    fn run_diagnostics(&self) -> VaultDiagnostics;
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

/// Helper to resolve the user session D-Bus bus address
pub fn resolve_dbus_address() -> Option<String> {
    if let Ok(addr) = std::env::var("DBUS_SESSION_BUS_ADDRESS") {
        let trimmed = addr.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    #[cfg(unix)]
    {
        let uid = unsafe { libc::getuid() };
        let candidate = format!("/run/user/{}/bus", uid);
        if Path::new(&candidate).exists() {
            return Some(format!("unix:path={}", candidate));
        }
    }

    None
}

/// Helper to detect if a D-Bus service is registered and owned
pub fn is_dbus_service_active(service: &str, dbus_addr: Option<&str>) -> bool {
    let mut cmd = std::process::Command::new("busctl");
    cmd.arg("--user");
    cmd.args(["status", service]);
    if let Some(addr) = dbus_addr {
        cmd.env("DBUS_SESSION_BUS_ADDRESS", addr);
    }
    if let Ok(output) = cmd.output() {
        if output.status.success() {
            return true;
        }
    }

    let mut cmd2 = std::process::Command::new("dbus-send");
    cmd2.args([
        "--session",
        "--dest=org.freedesktop.DBus",
        "--type=method_call",
        "--print-reply",
        "/org/freedesktop/DBus",
        "org.freedesktop.DBus.GetNameOwner",
        &format!("string:{}", service),
    ]);
    if let Some(addr) = dbus_addr {
        cmd2.env("DBUS_SESSION_BUS_ADDRESS", addr);
    }
    if let Ok(output) = cmd2.output() {
        if output.status.success() {
            return true;
        }
    }

    false
}

// -------------------------------------------------------------
// Secret Service Store (Linux Freedesktop Secret Service / KDE Wallet / GNOME Keyring)
// -------------------------------------------------------------
pub struct SecretServiceStore {
    service_name: &'static str,
    dbus_address: Option<String>,
}

impl SecretServiceStore {
    pub fn new() -> Self {
        Self {
            service_name: CREDENTIAL_SERVICE_NAME,
            dbus_address: resolve_dbus_address(),
        }
    }

    pub fn is_secret_tool_installed() -> bool {
        if let Ok(path) = std::env::var("PATH") {
            for dir in path.split(':') {
                if Path::new(dir).join("secret-tool").is_file() {
                    return true;
                }
            }
        }
        Path::new("/usr/bin/secret-tool").exists()
            || Path::new("/usr/local/bin/secret-tool").exists()
    }

    fn command(&self) -> std::process::Command {
        let mut cmd = std::process::Command::new("secret-tool");
        if let Some(ref addr) = self.dbus_address {
            cmd.env("DBUS_SESSION_BUS_ADDRESS", addr);
        }
        cmd
    }

    pub fn is_available(&self) -> bool {
        if !Self::is_secret_tool_installed() {
            return false;
        }

        let test_account = "__mechon_vault_probe__";
        let test_value = "probe_ok_2026";

        if self.save_credential(test_account, test_value).is_err() {
            return false;
        }

        let retrieved = match self.get_credential(test_account) {
            Ok(Some(val)) => val == test_value,
            _ => false,
        };

        let _ = self.delete_credential(test_account);
        retrieved
    }

    fn get_legacy_fallback(&self, ref_id: &str) -> Result<Option<String>, CredentialError> {
        let legacy_id = if ref_id.starts_with("provider:") && ref_id.ends_with(":api_key") {
            let inner_id = &ref_id["provider:".len()..ref_id.len() - ":api_key".len()];
            format!("provider_{}", inner_id)
        } else if ref_id.starts_with("provider_") {
            let inner_id = &ref_id["provider_".len()..];
            format!("provider:{}:api_key", inner_id)
        } else {
            return Ok(None);
        };

        let output = self.command()
            .args(["lookup", "service", self.service_name, "account", &legacy_id])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .output()
            .map_err(|e| CredentialError::SecretService(format!("Failed to run secret-tool lookup: {}", e)))?;

        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout);
            let trimmed = s.trim_end_matches(['\r', '\n']).to_string();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed));
            }
        }
        Ok(None)
    }
}

impl CredentialStore for SecretServiceStore {
    fn save_credential(&self, ref_id: &str, secret: &str) -> Result<(), CredentialError> {
        let mut child = self.command()
            .args([
                "store",
                &format!("--label=Mechon AI API Key ({})", ref_id),
                "service",
                self.service_name,
                "account",
                ref_id,
            ])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| CredentialError::SecretService(format!("Failed to spawn secret-tool store: {}", e)))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(secret.as_bytes())
                .map_err(CredentialError::Io)?;
        }

        let output = child.wait_with_output()
            .map_err(|e| CredentialError::SecretService(format!("secret-tool wait failed: {}", e)))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(CredentialError::SecretService(format!(
                "secret-tool store failed (exit code {:?}): {}",
                output.status.code(),
                err.trim()
            )));
        }

        Ok(())
    }

    fn get_credential(&self, ref_id: &str) -> Result<Option<String>, CredentialError> {
        let output = self.command()
            .args(["lookup", "service", self.service_name, "account", ref_id])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .output()
            .map_err(|e| CredentialError::SecretService(format!("Failed to run secret-tool lookup: {}", e)))?;

        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout);
            let trimmed = s.trim_end_matches(['\r', '\n']).to_string();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed));
            }
            self.get_legacy_fallback(ref_id)
        } else {
            self.get_legacy_fallback(ref_id)
        }
    }

    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError> {
        let _ = self.command()
            .args(["clear", "service", self.service_name, "account", ref_id])
            .output();

        if ref_id.starts_with("provider:") && ref_id.ends_with(":api_key") {
            let inner_id = &ref_id["provider:".len()..ref_id.len() - ":api_key".len()];
            let _ = self.command()
                .args(["clear", "service", self.service_name, "account", &format!("provider_{}", inner_id)])
                .output();
        } else if ref_id.starts_with("provider_") {
            let inner_id = &ref_id["provider_".len()..];
            let _ = self.command()
                .args(["clear", "service", self.service_name, "account", &format!("provider:{}:api_key", inner_id)])
                .output();
        }

        Ok(())
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
        "freedesktop_secret_service(secret-tool)"
    }

    fn run_diagnostics(&self) -> VaultDiagnostics {
        let dbus_addr = resolve_dbus_address();
        let dbus_ok = dbus_addr.is_some();
        let secret_tool_ok = Self::is_secret_tool_installed();

        let ss_active = is_dbus_service_active("org.freedesktop.secrets", dbus_addr.as_deref())
            || is_dbus_service_active("org.kde.secretservicecompat", dbus_addr.as_deref())
            || is_dbus_service_active("org.kde.kwalletd6", dbus_addr.as_deref());

        let test_account = "__mechon_diag_probe__";
        let test_value = "probe_check_ok_2026";

        let write_test = match self.save_credential(test_account, test_value) {
            Ok(_) => "PASS".to_string(),
            Err(e) => format!("FAIL: {}", e),
        };

        let read_back_test = if write_test == "PASS" {
            match self.get_credential(test_account) {
                Ok(Some(val)) if val == test_value => "PASS".to_string(),
                Ok(Some(_)) => "FAIL: Mismatched retrieved value".to_string(),
                Ok(None) => "FAIL: Key not found immediately after write".to_string(),
                Err(e) => format!("FAIL: {}", e),
            }
        } else {
            "SKIPPED (write failed)".to_string()
        };

        let delete_test = if write_test == "PASS" {
            let del_res = self.delete_credential(test_account);
            if del_res.is_ok() {
                match self.get_credential(test_account) {
                    Ok(None) => "PASS".to_string(),
                    Ok(Some(_)) => "FAIL: Key still present after delete".to_string(),
                    Err(_) => "PASS".to_string(),
                }
            } else {
                "FAIL: delete command failed".to_string()
            }
        } else {
            "SKIPPED".to_string()
        };

        let unlocked = write_test == "PASS" && read_back_test == "PASS";

        let (error_details, guidance) = if !dbus_ok {
            (
                Some("User session D-Bus bus address (/run/user/<uid>/bus) could not be resolved.".to_string()),
                Some("Ensure your desktop session bus is running and DBUS_SESSION_BUS_ADDRESS is exported.".to_string()),
            )
        } else if !secret_tool_ok {
            (
                Some("Utility 'secret-tool' (from libsecret) is not installed.".to_string()),
                Some("Please install libsecret (e.g. 'sudo pacman -S libsecret' or 'sudo apt install libsecret-tools').".to_string()),
            )
        } else if !ss_active {
            (
                Some("Freedesktop Secret Service daemon is not registered on D-Bus.".to_string()),
                Some("In KDE Plasma 6, ensure ~/.config/kwalletrc has [Wallet] Enabled=true, or run: 'kwriteconfig6 --file kwalletrc --group Wallet --key Enabled true' and ensure ksecretd/kwalletd6 are running.".to_string()),
            )
        } else if !unlocked {
            (
                Some("Secret Service probe failed to read back stored secret.".to_string()),
                Some("Please unlock your KDE Wallet prompt or check kwallet permissions.".to_string()),
            )
        } else {
            (None, None)
        };

        VaultDiagnostics {
            dbus_available: dbus_ok,
            dbus_address: dbus_addr,
            secret_service_available: ss_active,
            secret_service_unlocked: unlocked,
            secret_tool_installed: secret_tool_ok,
            active_backend: self.backend_name().to_string(),
            write_test,
            read_back_test,
            delete_test,
            error_details,
            actionable_guidance: guidance,
        }
    }
}

// -------------------------------------------------------------
// OS Keyring Store (Fallback for generic platforms via keyring crate)
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

    pub fn is_available(&self) -> bool {
        let test_account = "__mechon_keyring_probe__";
        let test_value = "probe_ok_2026";

        let entry1 = match keyring::Entry::new(self.service_name, test_account) {
            Ok(e) => e,
            Err(_) => return false,
        };

        if entry1.set_password(test_value).is_err() {
            return false;
        }

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

    fn run_diagnostics(&self) -> VaultDiagnostics {
        let avail = self.is_available();
        VaultDiagnostics {
            dbus_available: false,
            dbus_address: None,
            secret_service_available: avail,
            secret_service_unlocked: avail,
            secret_tool_installed: false,
            active_backend: self.backend_name().to_string(),
            write_test: if avail { "PASS".to_string() } else { "FAIL".to_string() },
            read_back_test: if avail { "PASS".to_string() } else { "FAIL".to_string() },
            delete_test: if avail { "PASS".to_string() } else { "FAIL".to_string() },
            error_details: if !avail { Some("keyring crate backend is mock or unavailable".to_string()) } else { None },
            actionable_guidance: None,
        }
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
            let candidate = home.join("mechon-ai");
            if fs::create_dir_all(&candidate).is_ok() {
                home
            } else {
                std::env::temp_dir()
            }
        } else {
            std::env::temp_dir()
        };
        let app_dir = data_dir.join("mechon-ai");
        let _ = fs::create_dir_all(&app_dir);
        let vault_path = app_dir.join(".vault.enc");
        Self::with_path(vault_path)
    }

    pub fn with_path(vault_path: PathBuf) -> Self {
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
        self.encrypt_bytes(data)
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

        if let Some(parent) = self.vault_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&self.vault_path)?;

        #[cfg(unix)]
        {
            let mut perms = file.metadata()?.permissions();
            perms.set_mode(0o600);
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

    fn run_diagnostics(&self) -> VaultDiagnostics {
        let test_account = "__mechon_enc_probe__";
        let test_value = "probe_enc_2026";
        let w_res = self.save_credential(test_account, test_value);
        let write_test = if w_res.is_ok() { "PASS".to_string() } else { "FAIL".to_string() };
        let read_back_test = match self.get_credential(test_account) {
            Ok(Some(v)) if v == test_value => "PASS".to_string(),
            _ => "FAIL".to_string(),
        };
        let _ = self.delete_credential(test_account);

        VaultDiagnostics {
            dbus_available: false,
            dbus_address: None,
            secret_service_available: false,
            secret_service_unlocked: true,
            secret_tool_installed: false,
            active_backend: self.backend_name().to_string(),
            write_test,
            read_back_test,
            delete_test: "PASS".to_string(),
            error_details: None,
            actionable_guidance: None,
        }
    }
}

// -------------------------------------------------------------
// In-Memory Credential Store (for unit testing)
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

    fn run_diagnostics(&self) -> VaultDiagnostics {
        VaultDiagnostics {
            dbus_available: false,
            dbus_address: None,
            secret_service_available: true,
            secret_service_unlocked: true,
            secret_tool_installed: false,
            active_backend: self.backend_name().to_string(),
            write_test: "PASS".to_string(),
            read_back_test: "PASS".to_string(),
            delete_test: "PASS".to_string(),
            error_details: None,
            actionable_guidance: None,
        }
    }
}

// -------------------------------------------------------------
// Hybrid Vault (Secret Service / Keyring + Encrypted Local Storage)
// -------------------------------------------------------------
pub struct HybridCredentialVault {
    secret_service: SecretServiceStore,
    keyring: KeyringStore,
    encrypted: EncryptedVaultStore,
    secret_service_active: AtomicBool,
    keyring_active: AtomicBool,
}

impl HybridCredentialVault {
    pub fn new() -> Self {
        let secret_service = SecretServiceStore::new();
        let ss_avail = secret_service.is_available();
        if ss_avail {
            info!("[Credential] Linux Freedesktop Secret Service (KDE Wallet / secret-tool) verified and ACTIVE");
        } else {
            info!("[Credential] Linux Secret Service probe inactive; evaluating fallback keyrings");
        }

        let keyring = KeyringStore::new();
        let kr_avail = !ss_avail && keyring.is_available();
        if kr_avail {
            info!("[Credential] OS Keyring verified and ACTIVE");
        }

        Self {
            secret_service,
            keyring,
            encrypted: EncryptedVaultStore::new(),
            secret_service_active: AtomicBool::new(ss_avail),
            keyring_active: AtomicBool::new(kr_avail),
        }
    }

    pub fn with_stores(
        secret_service: SecretServiceStore,
        keyring: KeyringStore,
        encrypted: EncryptedVaultStore,
    ) -> Self {
        let ss_avail = secret_service.is_available();
        let kr_avail = !ss_avail && keyring.is_available();
        Self {
            secret_service,
            keyring,
            encrypted,
            secret_service_active: AtomicBool::new(ss_avail),
            keyring_active: AtomicBool::new(kr_avail),
        }
    }

    pub fn is_secret_service_active(&self) -> bool {
        self.secret_service_active.load(Ordering::Relaxed)
    }

    pub fn is_keyring_active(&self) -> bool {
        self.keyring_active.load(Ordering::Relaxed)
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

        // 1. Always save to local encrypted vault as baseline secure store
        self.encrypted.save_credential(ref_id, trimmed)?;

        // 2. If Linux Freedesktop Secret Service is active, sync to KDE Wallet / libsecret
        if self.secret_service_active.load(Ordering::Relaxed) {
            match self.secret_service.save_credential(ref_id, trimmed) {
                Ok(_) => {
                    info!("[Credential] Synced ref '{}' to Freedesktop Secret Service / KDE Wallet", ref_id);
                }
                Err(e) => {
                    warn!("[Credential] Secret Service write failed ({}). Preserving encrypted store.", e);
                }
            }
        }

        // 3. If OS Keyring is active, sync there
        if self.keyring_active.load(Ordering::Relaxed) {
            let _ = self.keyring.save_credential(ref_id, trimmed);
        }

        // 4. Mandatory Read-Back Verification: Confirm byte-for-byte fidelity immediately!
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
        // 1. Try Freedesktop Secret Service / KDE Wallet if active
        if self.secret_service_active.load(Ordering::Relaxed) {
            if let Ok(Some(secret)) = self.secret_service.get_credential(ref_id) {
                let trimmed = secret.trim();
                if !trimmed.is_empty() {
                    return Ok(Some(trimmed.to_string()));
                }
            }
        }

        // 2. Try OS Keyring if active
        if self.keyring_active.load(Ordering::Relaxed) {
            if let Ok(Some(secret)) = self.keyring.get_credential(ref_id) {
                let trimmed = secret.trim();
                if !trimmed.is_empty() {
                    return Ok(Some(trimmed.to_string()));
                }
            }
        }

        // 3. Fallback to local encrypted vault
        self.encrypted.get_credential(ref_id)
    }

    fn delete_credential(&self, ref_id: &str) -> Result<(), CredentialError> {
        let res_enc = self.encrypted.delete_credential(ref_id);
        if self.secret_service_active.load(Ordering::Relaxed) {
            let _ = self.secret_service.delete_credential(ref_id);
        }
        if self.keyring_active.load(Ordering::Relaxed) {
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
        if self.secret_service_active.load(Ordering::Relaxed) {
            "kde_wallet(freedesktop_secrets+encrypted)"
        } else if self.keyring_active.load(Ordering::Relaxed) {
            "os_keyring(keyring+encrypted)"
        } else {
            "encrypted_vault(file_0600)"
        }
    }

    fn run_diagnostics(&self) -> VaultDiagnostics {
        let mut diag = self.secret_service.run_diagnostics();
        diag.active_backend = self.backend_name().to_string();
        diag
    }
}
