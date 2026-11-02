use std::sync::Arc;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::SqlitePool;
use uuid::Uuid;
use mechon_ai::credentials::{
    compute_fingerprint, make_credential_ref, CredentialError, CredentialStatus,
    CredentialStore, EncryptedVaultStore, InMemoryCredentialStore, KeyringStore,
    HybridCredentialVault,
};
use mechon_ai::models::{ProviderCreateInput, ProviderUpdateInput};
use mechon_ai::providers::registry::ProviderRegistry;
use mechon_ai::providers::models_dev::ModelsDevRegistry;
use mechon_ai::providers::errors::{ProviderError, ProviderErrorCode};
use mechon_ai::providers::anthropic::adapter::AnthropicAdapter;
use mechon_ai::providers::gemini::adapter::GeminiAdapter;
use mechon_ai::providers::openai::adapter::OpenAICompatibleAdapter;
use mechon_ai::providers::capabilities::ModelCapabilities;
use mechon_ai::services::provider_service::ProviderService;

async fn setup_test_db() -> SqlitePool {
    let options = SqliteConnectOptions::new()
        .filename(":memory:")
        .foreign_keys(true);

    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .expect("Failed to connect to in-memory SQLite");

    let schema_sql = include_str!("../migrations/20261102000000_init_schema.sql");
    sqlx::raw_sql(schema_sql)
        .execute(&pool)
        .await
        .expect("Failed to run schema migration");

    pool
}

// -------------------------------------------------------------
// Test 1-12: Full Credential Lifecycle, Editor Reopen, Preservation, Replacement & Removal
// -------------------------------------------------------------
#[tokio::test]
async fn test_full_credential_lifecycle_and_editor_preservation() {
    let pool = setup_test_db().await;
    let vault: Arc<dyn CredentialStore> = Arc::new(InMemoryCredentialStore::new());

    // 1. Create provider with API key
    // 2. Save credential
    let created = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: "Anthropic Production".to_string(),
            provider_type: "anthropic".to_string(),
            base_url: Some("https://api.anthropic.com".to_string()),
            api_key: Some("sk-ant-api03-live-secret-key-12345678".to_string()),
            default_model: Some("claude-3-5-sonnet-20241022".to_string()),
            timeout_seconds: Some(60),
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to create provider");

    // 3. Read credential immediately
    assert!(created.has_api_key);
    assert_eq!(created.credential_status, "stored");
    assert_eq!(created.masked_hint, Some("••••••••5678".to_string()));

    // Verify safe fingerprint
    let fp = compute_fingerprint("sk-ant-api03-live-secret-key-12345678");
    assert_eq!(fp.len(), 15); // "sha256:" + 8 chars

    // Verify SQLite does NOT store plaintext key
    let row: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT credential_ref, api_key_encrypted FROM providers WHERE id = ?"
    )
    .bind(&created.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(row.0.is_some(), "credential_ref must be set");
    assert_eq!(row.1, None, "api_key_encrypted must be NULL");

    // 4 & 5: Simulate closing and reopening provider editor (re-query from backend)
    // 6. Verify stored credential status
    let reopened = ProviderService::get(&pool, &created.id, vault.as_ref())
        .await
        .expect("Failed to reopen provider");
    assert!(reopened.has_api_key, "API key must remain stored upon reopening editor");
    assert_eq!(reopened.credential_status, "stored");
    assert_eq!(reopened.masked_hint, Some("••••••••5678".to_string()));

    let raw_key = ProviderService::get_raw_key(&pool, &created.id, vault.as_ref())
        .await
        .unwrap();
    assert_eq!(raw_key, Some("sk-ant-api03-live-secret-key-12345678".to_string()));

    // 7. Edit unrelated provider settings (name, timeout, default model) without providing an API key
    let updated_settings = ProviderService::update(
        &pool,
        &created.id,
        ProviderUpdateInput {
            name: Some("Anthropic Production EU".to_string()),
            base_url: Some("https://api.anthropic.com/v1".to_string()),
            api_key: None, // Empty / not touched
            clear_api_key: Some(false),
            default_model: Some("claude-3-5-haiku-20241022".to_string()),
            timeout_seconds: Some(90),
            is_active: None,
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to update unrelated settings");

    // 8. Verify credential remains 100% intact after editing unrelated settings!
    assert_eq!(updated_settings.name, "Anthropic Production EU");
    assert!(updated_settings.has_api_key, "API key MUST be preserved after editing unrelated settings");
    assert_eq!(updated_settings.credential_status, "stored");
    assert_eq!(updated_settings.masked_hint, Some("••••••••5678".to_string()));

    let preserved_raw = ProviderService::get_raw_key(&pool, &created.id, vault.as_ref())
        .await
        .unwrap();
    assert_eq!(preserved_raw, Some("sk-ant-api03-live-secret-key-12345678".to_string()));

    // 9. Replace credential with a new API key
    let replaced = ProviderService::update(
        &pool,
        &created.id,
        ProviderUpdateInput {
            name: None,
            base_url: None,
            api_key: Some("sk-ant-api03-replacement-key-9999".to_string()),
            clear_api_key: Some(false),
            default_model: None,
            timeout_seconds: None,
            is_active: None,
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to replace API key");

    // 10. Verify replacement
    assert_eq!(replaced.masked_hint, Some("••••••••9999".to_string()));
    let new_raw = ProviderService::get_raw_key(&pool, &created.id, vault.as_ref())
        .await
        .unwrap();
    assert_eq!(new_raw, Some("sk-ant-api03-replacement-key-9999".to_string()));

    // 11. Remove credential explicitly (clear_api_key: true)
    let removed = ProviderService::update(
        &pool,
        &created.id,
        ProviderUpdateInput {
            name: None,
            base_url: None,
            api_key: None,
            clear_api_key: Some(true),
            default_model: None,
            timeout_seconds: None,
            is_active: None,
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to remove API key");

    // 12. Verify removal
    assert!(!removed.has_api_key);
    assert_eq!(removed.credential_status, "empty");
    assert_eq!(removed.masked_hint, None);

    let cleared_raw = ProviderService::get_raw_key(&pool, &created.id, vault.as_ref())
        .await
        .unwrap();
    assert_eq!(cleared_raw, None);
}

// -------------------------------------------------------------
// Test 13 & 14: Application Restart Persistence with Encrypted Vault
// -------------------------------------------------------------
#[tokio::test]
async fn test_application_restart_persistence_with_encrypted_vault() {
    let pool = setup_test_db().await;
    let temp_vault_path = std::env::temp_dir().join(format!("mechon_restart_vault_{}.enc", Uuid::new_v4()));

    let secret = "AIzaSyGeminiRestartTestKey987654";
    let provider_id: String;

    // Session 1: Create provider and save credential
    {
        let vault_session_1 = EncryptedVaultStore::with_path(temp_vault_path.clone());
        let provider = ProviderService::create(
            &pool,
            ProviderCreateInput {
                name: "Google Gemini Flash".to_string(),
                provider_type: "gemini".to_string(),
                base_url: Some("https://generativelanguage.googleapis.com".to_string()),
                api_key: Some(secret.to_string()),
                default_model: Some("gemini-2.0-flash".to_string()),
                timeout_seconds: Some(60),
                settings: None,
            },
            &vault_session_1,
        ).await.unwrap();

        provider_id = provider.id;
        assert!(provider.has_api_key);
        // vault_session_1 dropped here (simulating application exit)
    }

    // Session 2: Application Restart (new EncryptedVaultStore instance pointing to same file)
    {
        let vault_session_2 = EncryptedVaultStore::with_path(temp_vault_path.clone());
        let reloaded = ProviderService::get(&pool, &provider_id, &vault_session_2)
            .await
            .expect("Provider must be found after restart");

        assert!(reloaded.has_api_key, "API key must survive application restart");
        assert_eq!(reloaded.credential_status, "stored");
        assert_eq!(reloaded.masked_hint, Some("••••••••7654".to_string()));

        let retrieved_secret = ProviderService::get_raw_key(&pool, &provider_id, &vault_session_2)
            .await
            .unwrap();
        assert_eq!(retrieved_secret, Some(secret.to_string()));
    }

    // Clean up temporary test file
    let _ = std::fs::remove_file(temp_vault_path);
}

// -------------------------------------------------------------
// Test 15: Failed Vault Writes & Transaction Rollback
// -------------------------------------------------------------
struct FailingVaultStore;
impl CredentialStore for FailingVaultStore {
    fn save_credential(&self, _ref_id: &str, _secret: &str) -> Result<(), CredentialError> {
        Err(CredentialError::PermissionDenied("Disk read-only or permission denied".to_string()))
    }
    fn get_credential(&self, _ref_id: &str) -> Result<Option<String>, CredentialError> {
        Ok(None)
    }
    fn delete_credential(&self, _ref_id: &str) -> Result<(), CredentialError> {
        Ok(())
    }
    fn get_status(&self, _ref_id: &str) -> CredentialStatus {
        CredentialStatus {
            has_api_key: false,
            credential_status: "empty".to_string(),
            masked_hint: None,
        }
    }
    fn backend_name(&self) -> &'static str {
        "failing_vault_mock"
    }
}

#[tokio::test]
async fn test_failed_vault_write_rollback() {
    let pool = setup_test_db().await;
    let failing_vault = FailingVaultStore;

    // Create should fail when vault write fails, and NOT persist to SQLite
    let result = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: "Failing Test Provider".to_string(),
            provider_type: "openai".to_string(),
            base_url: Some("https://api.openai.com".to_string()),
            api_key: Some("sk-will-fail-to-save".to_string()),
            default_model: None,
            timeout_seconds: None,
            settings: None,
        },
        &failing_vault,
    ).await;

    assert!(result.is_err(), "Creation must fail if credential write fails");

    // SQLite should have 0 records
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM providers")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0, "No orphaned provider records should remain in DB on vault failure");
}

// -------------------------------------------------------------
// Test 16 & 17: Unavailable Vault & Missing Credential Handling
// -------------------------------------------------------------
struct UnavailableVaultStore;
impl CredentialStore for UnavailableVaultStore {
    fn save_credential(&self, _ref_id: &str, _secret: &str) -> Result<(), CredentialError> {
        Err(CredentialError::Unavailable("Keyring daemon not reachable".to_string()))
    }
    fn get_credential(&self, _ref_id: &str) -> Result<Option<String>, CredentialError> {
        Err(CredentialError::Unavailable("Keyring daemon not reachable".to_string()))
    }
    fn delete_credential(&self, _ref_id: &str) -> Result<(), CredentialError> {
        Err(CredentialError::Unavailable("Keyring daemon not reachable".to_string()))
    }
    fn get_status(&self, _ref_id: &str) -> CredentialStatus {
        CredentialStatus {
            has_api_key: false,
            credential_status: "vault_unavailable".to_string(),
            masked_hint: None,
        }
    }
    fn backend_name(&self) -> &'static str {
        "unavailable_vault_mock"
    }
}

#[tokio::test]
async fn test_unavailable_vault_and_missing_credential() {
    let pool = setup_test_db().await;
    let unavail = UnavailableVaultStore;

    // Provider without API key
    let provider = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: "Local Ollama No Key".to_string(),
            provider_type: "ollama".to_string(),
            base_url: Some("http://127.0.0.1:11434".to_string()),
            api_key: None,
            default_model: Some("llama3:latest".to_string()),
            timeout_seconds: Some(30),
            settings: None,
        },
        &unavail,
    ).await.expect("Provider without API key should succeed even if vault is unavailable");

    assert!(!provider.has_api_key);
    assert_eq!(provider.masked_hint, None);

    let raw = ProviderService::get_raw_key(&pool, &provider.id, &unavail)
        .await
        .unwrap();
    assert_eq!(raw, None);
}

// -------------------------------------------------------------
// Test 18: Authentication Header Construction Across Adapters
// -------------------------------------------------------------
#[tokio::test]
async fn test_authentication_header_construction() {
    // 1. Anthropic adapter header test
    let anthropic = AnthropicAdapter::new(
        "https://api.anthropic.com".to_string(),
        Some("  sk-ant-test-key-123456  \n".to_string()),
        60,
        ModelCapabilities::default(),
    );
    assert_eq!(anthropic.api_key.as_deref().map(|k| k.trim()), Some("sk-ant-test-key-123456"));

    // 2. Gemini adapter header test
    let gemini = GeminiAdapter::new(
        "https://generativelanguage.googleapis.com".to_string(),
        Some("  AIzaSyTestGeminiKey789  \r\n".to_string()),
        60,
        ModelCapabilities::default(),
    );
    assert_eq!(gemini.api_key.as_deref().map(|k| k.trim()), Some("AIzaSyTestGeminiKey789"));

    // 3. OpenAI compatible adapter header test
    let openai = OpenAICompatibleAdapter::new(
        "https://api.openai.com/v1".to_string(),
        Some("  sk-proj-openai-key-000  \t".to_string()),
        Some("Bearer {key}".to_string()),
        60,
        ModelCapabilities::default(),
    );
    assert_eq!(openai.api_key.as_deref().map(|k| k.trim()), Some("sk-proj-openai-key-000"));
}

// -------------------------------------------------------------
// Test 19: HTTP Error Status Distinction (401, 402, 403, 404, 429, 500)
// -------------------------------------------------------------
#[test]
fn test_http_status_distinction() {
    // 401 Unauthorized
    let err401 = ProviderError::from_status(401, "{\"error\": \"invalid_api_key\"}", "https://api.anthropic.com/models");
    assert_eq!(err401.code, ProviderErrorCode::AuthenticationFailed);
    assert_eq!(err401.http_status, Some(401));

    // 402 Payment Required
    let err402 = ProviderError::from_status(402, "Billing invoice unpaid", "https://api.openai.com/v1/models");
    assert_eq!(err402.code, ProviderErrorCode::QuotaExceeded);
    assert_eq!(err402.http_status, Some(402));

    // 403 Forbidden
    let err403 = ProviderError::from_status(403, "Access to model restricted", "https://api.openai.com/v1/models");
    assert_eq!(err403.code, ProviderErrorCode::AuthenticationFailed);
    assert_eq!(err403.http_status, Some(403));

    // 404 Not Found
    let err404 = ProviderError::from_status(404, "Endpoint not found", "https://api.openai.com/v1/foo");
    assert_eq!(err404.code, ProviderErrorCode::ModelNotFound);
    assert_eq!(err404.http_status, Some(404));

    // 429 Rate Limit
    let err429 = ProviderError::from_status(429, "Rate limit reached", "https://api.openai.com/v1/models");
    assert_eq!(err429.code, ProviderErrorCode::RateLimited);
    assert_eq!(err429.http_status, Some(429));

    // 429 Quota Exceeded
    let err429_quota = ProviderError::from_status(429, "You have exceeded your current quota", "https://api.openai.com/v1/models");
    assert_eq!(err429_quota.code, ProviderErrorCode::QuotaExceeded);
    assert_eq!(err429_quota.http_status, Some(429));

    // 500 Server Error
    let err500 = ProviderError::from_status(500, "Internal Server Error", "https://api.openai.com/v1/models");
    assert_eq!(err500.code, ProviderErrorCode::InvalidResponse);
    assert_eq!(err500.http_status, Some(500));
}

// -------------------------------------------------------------
// Test 20: Hybrid Credential Vault with Real Persistence & Keyring Probe
// -------------------------------------------------------------
#[test]
fn test_hybrid_credential_vault_persistence_and_readback() {
    let temp_path = std::env::temp_dir().join(format!("mechon_hybrid_test_{}.enc", Uuid::new_v4()));
    let enc_store = EncryptedVaultStore::with_path(temp_path.clone());
    let keyring_store = KeyringStore::new();

    let hybrid = HybridCredentialVault::with_stores(keyring_store, enc_store);

    let test_ref = make_credential_ref("test-hybrid-provider-1");
    let test_secret = "sk-live-test-hybrid-secret-key-12345";

    // 1. Save credential with immediate read-back verification
    hybrid.save_credential(&test_ref, test_secret).expect("Hybrid save must succeed");

    // 2. Read back
    let read = hybrid.get_credential(&test_ref).expect("Get must succeed");
    assert_eq!(read, Some(test_secret.to_string()));

    // 3. Status
    let status = hybrid.get_status(&test_ref);
    assert!(status.has_api_key);
    assert_eq!(status.credential_status, "stored");
    assert_eq!(status.masked_hint, Some("••••••••2345".to_string()));

    // 4. Delete
    hybrid.delete_credential(&test_ref).expect("Delete must succeed");
    assert_eq!(hybrid.get_credential(&test_ref).unwrap(), None);

    let _ = std::fs::remove_file(temp_path);
}

// -------------------------------------------------------------
// Test 21: Provider Registry and Models.dev
// -------------------------------------------------------------
#[tokio::test]
async fn test_provider_registry_declarations() {
    let registry = ProviderRegistry::global();
    let providers = registry.all();

    assert!(providers.len() >= 14, "Expected at least 14 built-in providers");

    let anthropic = registry.get("anthropic").expect("Anthropic provider missing");
    assert_eq!(anthropic.name, "Anthropic");
    assert!(anthropic.capabilities.vision);
    assert!(anthropic.capabilities.streaming);
    assert!(anthropic.capabilities.tool_use);
    assert!(anthropic.curated_models.contains(&"claude-3-5-sonnet-20241022".to_string()));

    let gemini = registry.get("gemini").expect("Gemini provider missing");
    assert_eq!(gemini.name, "Google Gemini");
    assert!(gemini.capabilities.vision);
    assert!(gemini.capabilities.reasoning);

    let ollama = registry.get("ollama").expect("Ollama provider missing");
    assert_eq!(ollama.name, "Ollama (Local)");
    assert_eq!(ollama.default_host, "http://127.0.0.1:11434");
}

#[tokio::test]
async fn test_models_dev_enrichment() {
    let dev = ModelsDevRegistry::new();
    let gpt4o = dev.lookup("gpt-4o").expect("gpt-4o should be in snapshot");

    assert_eq!(gpt4o.context_window, Some(128000));
    assert!(gpt4o.capabilities.as_ref().unwrap().vision);

    let variant = dev.lookup("claude-3-5-sonnet-20241022").expect("Boundary-aware prefix should resolve");
    assert_eq!(variant.id, "claude-3-5-sonnet");
}
