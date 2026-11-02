use std::sync::Arc;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::SqlitePool;
use uuid::Uuid;
use mechon_ai::credentials::{CredentialStore, InMemoryCredentialStore, EncryptedVaultStore};
use mechon_ai::models::{ProviderCreateInput, ProviderUpdateInput};
use mechon_ai::providers::registry::ProviderRegistry;
use mechon_ai::providers::models_dev::ModelsDevRegistry;
use mechon_ai::providers::errors::ProviderErrorCode;
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

#[tokio::test]
async fn test_in_memory_credential_store() {
    let store = InMemoryCredentialStore::new();
    let ref_id = "test-provider-ref-1";
    let secret = "sk-ant-api03-abcdef1234567890";

    assert!(!store.get_status(ref_id).has_api_key);
    assert_eq!(store.get_credential(ref_id).unwrap(), None);

    // Save
    store.save_credential(ref_id, secret).unwrap();
    assert!(store.get_status(ref_id).has_api_key);
    assert_eq!(store.get_credential(ref_id).unwrap(), Some(secret.to_string()));

    // Status
    let status = store.get_status(ref_id);
    assert!(status.has_api_key);
    assert_eq!(status.credential_status, "stored");
    assert_eq!(status.masked_hint, Some("••••••••7890".to_string()));

    // Delete
    store.delete_credential(ref_id).unwrap();
    assert!(!store.get_status(ref_id).has_api_key);
    assert_eq!(store.get_credential(ref_id).unwrap(), None);
}

#[tokio::test]
async fn test_encrypted_vault_store_roundtrip() {
    let vault_path = std::env::temp_dir().join(format!("mechon_test_vault_{}.enc", Uuid::new_v4()));
    let store = EncryptedVaultStore::with_path(vault_path.clone());

    let ref_id = "gemini-ref-42";
    let secret = "AIzaSyTestGeminiKey123456789";

    // Save and retrieve
    store.save_credential(ref_id, secret).expect("Save failed");
    assert!(vault_path.exists());

    let loaded = store.get_credential(ref_id).expect("Get failed");
    assert_eq!(loaded, Some(secret.to_string()));

    let status = store.get_status(ref_id);
    assert!(status.has_api_key);
    assert_eq!(status.credential_status, "stored");
    assert_eq!(status.masked_hint, Some("••••••••6789".to_string()));

    // Delete
    store.delete_credential(ref_id).expect("Delete failed");
    assert_eq!(store.get_credential(ref_id).expect("Get after delete failed"), None);

    // Clean up temporary file
    let _ = std::fs::remove_file(vault_path);
}

#[tokio::test]
async fn test_provider_registry_declarations() {
    let registry = ProviderRegistry::global();
    let providers = registry.all();

    assert!(providers.len() >= 14, "Expected at least 14 built-in providers");

    // Check Anthropic definition
    let anthropic = registry.get("anthropic").expect("Anthropic provider missing");
    assert_eq!(anthropic.name, "Anthropic");
    assert!(anthropic.capabilities.vision);
    assert!(anthropic.capabilities.streaming);
    assert!(anthropic.capabilities.tool_use);
    assert!(anthropic.curated_models.contains(&"claude-3-5-sonnet-20241022".to_string()));

    // Check Gemini definition
    let gemini = registry.get("gemini").expect("Gemini provider missing");
    assert_eq!(gemini.name, "Google Gemini");
    assert!(gemini.capabilities.vision);
    assert!(gemini.capabilities.reasoning);

    // Check Ollama definition
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

    // Prefix matching on versioned / variant model IDs
    let variant = dev.lookup("claude-3-5-sonnet-20241022").expect("Boundary-aware prefix should resolve");
    assert_eq!(variant.id, "claude-3-5-sonnet");
}

#[tokio::test]
async fn test_provider_service_credential_lifecycle() {
    let pool = setup_test_db().await;
    let vault: Arc<dyn CredentialStore> = Arc::new(InMemoryCredentialStore::new());

    // 1. Create provider with an API key
    let created = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: "Anthropic Production".to_string(),
            provider_type: "anthropic".to_string(),
            base_url: Some("https://api.anthropic.com".to_string()),
            api_key: Some("sk-ant-secret-key-9999".to_string()),
            default_model: Some("claude-3-5-sonnet-20241022".to_string()),
            timeout_seconds: Some(60),
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to create provider");

    assert!(created.has_api_key);
    assert_eq!(created.credential_status, "stored");
    assert_eq!(created.masked_hint, Some("••••••••9999".to_string()));

    // Check DB row directly: plaintext/legacy key must NOT be stored in DB
    let row: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT credential_ref, api_key_encrypted FROM providers WHERE id = ?"
    )
    .bind(&created.id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert!(row.0.is_some(), "credential_ref must be set");
    assert_eq!(row.1, None, "api_key_encrypted must be NULL");

    // 2. Update without providing an API key (empty/None) -> credential MUST be preserved
    let updated_info = ProviderService::update(
        &pool,
        &created.id,
        ProviderUpdateInput {
            name: Some("Anthropic Main Updated".to_string()),
            base_url: None,
            api_key: None,
            clear_api_key: Some(false),
            default_model: None,
            timeout_seconds: Some(90),
            is_active: None,
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to update provider");

    assert_eq!(updated_info.name, "Anthropic Main Updated");
    assert!(updated_info.has_api_key, "API key must be preserved on empty edit");
    assert_eq!(updated_info.credential_status, "stored");
    assert_eq!(updated_info.masked_hint, Some("••••••••9999".to_string()));

    // Verify raw secret in vault is still the original secret
    let raw = ProviderService::get_raw_key(&pool, &created.id, vault.as_ref())
        .await
        .unwrap();
    assert_eq!(raw, Some("sk-ant-secret-key-9999".to_string()));

    // 3. Update with a new API key -> credential is replaced
    let updated_key = ProviderService::update(
        &pool,
        &created.id,
        ProviderUpdateInput {
            name: None,
            base_url: None,
            api_key: Some("sk-ant-new-key-0001".to_string()),
            clear_api_key: Some(false),
            default_model: None,
            timeout_seconds: None,
            is_active: None,
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to update provider key");

    assert_eq!(updated_key.masked_hint, Some("••••••••0001".to_string()));
    let new_raw = ProviderService::get_raw_key(&pool, &created.id, vault.as_ref())
        .await
        .unwrap();
    assert_eq!(new_raw, Some("sk-ant-new-key-0001".to_string()));

    // 4. Update with clear_api_key = true -> credential is erased
    let cleared = ProviderService::update(
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
    ).await.expect("Failed to clear key");

    assert!(!cleared.has_api_key);
    assert_eq!(cleared.credential_status, "empty");
    assert_eq!(cleared.masked_hint, None);

    let cleared_raw = ProviderService::get_raw_key(&pool, &created.id, vault.as_ref())
        .await
        .unwrap();
    assert_eq!(cleared_raw, None);

    // 5. Delete provider -> clean up
    ProviderService::delete(&pool, &created.id, vault.as_ref())
        .await
        .expect("Failed to delete provider");

    let list = ProviderService::list(&pool, vault.as_ref()).await.unwrap();
    assert!(list.is_empty());
}

#[tokio::test]
async fn test_connection_tester_diagnostics() {
    let pool = setup_test_db().await;
    let vault: Arc<dyn CredentialStore> = Arc::new(InMemoryCredentialStore::new());

    // Test 1: Mock Provider succeeds
    let mock = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: "Local Mock".to_string(),
            provider_type: "mock".to_string(),
            base_url: Some("http://127.0.0.1:0".to_string()),
            api_key: None,
            default_model: Some("mock-llama-3-8b".to_string()),
            timeout_seconds: Some(5),
            settings: None,
        },
        vault.as_ref(),
    ).await.unwrap();

    let result = ProviderService::test_provider(&pool, &mock.id, vault.as_ref())
        .await
        .expect("Connection test should run without internal error");

    assert!(result.success);
    assert_eq!(result.code, ProviderErrorCode::Success);
    assert!(!result.models.is_empty());

    // Test 2: Invalid URL returns structured error
    let invalid = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: "Bad URL Provider".to_string(),
            provider_type: "openai".to_string(),
            base_url: Some("not-a-valid-url".to_string()),
            api_key: Some("dummy".to_string()),
            default_model: None,
            timeout_seconds: Some(5),
            settings: None,
        },
        vault.as_ref(),
    ).await.unwrap();

    let invalid_result = ProviderService::test_provider(&pool, &invalid.id, vault.as_ref())
        .await
        .expect("Connection test should return structured failure");

    assert!(!invalid_result.success);
    assert_eq!(invalid_result.code, ProviderErrorCode::InvalidUrl);

    // Test 3: Dead localhost port returns connection refused / error, not panic or generic internal error
    let dead_port = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: "Dead Ollama".to_string(),
            provider_type: "ollama".to_string(),
            base_url: Some("http://127.0.0.1:54321".to_string()),
            api_key: None,
            default_model: None,
            timeout_seconds: Some(1),
            settings: None,
        },
        vault.as_ref(),
    ).await.unwrap();

    let dead_result = ProviderService::test_provider(&pool, &dead_port.id, vault.as_ref())
        .await
        .expect("Dead port test should return structured result");

    assert!(!dead_result.success);
    assert!(
        dead_result.code == ProviderErrorCode::ConnectionRefused
            || dead_result.code == ProviderErrorCode::Timeout
            || dead_result.code == ProviderErrorCode::DnsFailure,
        "Expected network error code, got {:?}",
        dead_result.code
    );
}
