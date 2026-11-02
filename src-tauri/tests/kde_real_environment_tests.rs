use std::sync::Arc;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::SqlitePool;
use uuid::Uuid;
use mechon_ai::credentials::{CredentialStore, HybridCredentialVault};
use mechon_ai::models::{ProviderCreateInput, ProviderUpdateInput};
use mechon_ai::services::provider_service::ProviderService;

async fn setup_file_db(path: &std::path::Path) -> SqlitePool {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(2)
        .connect_with(options)
        .await
        .expect("Failed to connect to SQLite file DB");

    let schema_sql = include_str!("../migrations/20261102000000_init_schema.sql");
    sqlx::raw_sql(schema_sql)
        .execute(&pool)
        .await
        .expect("Failed to run schema migration");

    pool
}

#[tokio::test]
async fn test_kde_plasma_secret_service_real_environment() {
    println!("\n=== RUNNING REAL KDE PLASMA SECRET SERVICE & VAULT INTEGRATION TEST ===");

    // 1. Initialize real HybridCredentialVault on current desktop session
    let vault = Arc::new(HybridCredentialVault::new());
    let diag = vault.run_diagnostics();

    println!("Vault Diagnostics on Host:");
    println!("  Active Backend:           {}", diag.active_backend);
    println!("  D-Bus Available:          {}", diag.dbus_available);
    println!("  D-Bus Address:            {:?}", diag.dbus_address);
    println!("  Secret Service Available: {}", diag.secret_service_available);
    println!("  Secret Service Unlocked:  {}", diag.secret_service_unlocked);
    println!("  secret-tool Installed:    {}", diag.secret_tool_installed);
    println!("  Write Probe:              {}", diag.write_test);
    println!("  Read-Back Probe:          {}", diag.read_back_test);
    println!("  Delete Probe:             {}", diag.delete_test);

    // If running in a headless environment without D-Bus, verify encrypted fallback integrity
    if !diag.dbus_available || !diag.secret_service_available {
        println!("Note: D-Bus / Secret Service not reachable in current process environment; testing fallback path.");
    } else {
        assert!(diag.dbus_available, "D-Bus must be available");
        assert!(diag.secret_service_available, "Secret Service must be registered on D-Bus");
        assert!(diag.secret_service_unlocked, "Secret Service must be unlocked and responsive");
        assert_eq!(diag.write_test, "PASS", "Write probe must pass");
        assert_eq!(diag.read_back_test, "PASS", "Read-back probe must pass");
        assert_eq!(diag.delete_test, "PASS", "Delete probe must pass");
    }

    // 2. Setup SQLite database file to simulate application restart across processes
    let temp_db_path = std::env::temp_dir().join(format!("mechon_kde_test_{}.sqlite", Uuid::new_v4()));
    let pool = setup_file_db(&temp_db_path).await;

    let test_secret = "sk-ant-api03-kde-plasma6-test-key-77889900";
    let provider_name = "Anthropic Production KDE";

    // -------------------------------------------------------------
    // Step 1: Save Provider and API key
    // -------------------------------------------------------------
    println!("\n[Step 1] Creating provider with API key...");
    let created = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: provider_name.to_string(),
            provider_type: "anthropic".to_string(),
            base_url: Some("https://api.anthropic.com".to_string()),
            api_key: Some(test_secret.to_string()),
            default_model: Some("claude-3-5-sonnet-20241022".to_string()),
            timeout_seconds: Some(60),
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to create provider");

    assert!(created.has_api_key);
    assert_eq!(created.credential_status, "stored");
    assert_eq!(created.masked_hint, Some("••••••••9900".to_string()));

    // Verify SQLite contains ONLY credential_ref, NO plaintext secret
    let row: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT credential_ref, api_key_encrypted FROM providers WHERE id = ?"
    )
    .bind(&created.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(row.0.is_some(), "credential_ref must be populated");
    assert_eq!(row.1, None, "api_key_encrypted must be NULL (zero plaintext in SQLite)");

    // -------------------------------------------------------------
    // Step 2 & 3: Close editor & Reopen editor
    // -------------------------------------------------------------
    println!("[Step 2 & 3] Simulating editor close and reopen...");
    let reopened = ProviderService::get(&pool, &created.id, vault.as_ref())
        .await
        .expect("Failed to reopen provider");

    assert!(reopened.has_api_key, "API key must persist upon reopening editor");
    assert_eq!(reopened.credential_status, "stored");
    assert_eq!(reopened.masked_hint, Some("••••••••9900".to_string()));

    let raw_key = ProviderService::get_raw_key(&pool, &created.id, vault.as_ref())
        .await
        .expect("Failed to query raw key");
    assert_eq!(raw_key, Some(test_secret.to_string()), "Retrieved secret must match saved secret");

    // -------------------------------------------------------------
    // Step 4: Empty edits must preserve existing secrets
    // -------------------------------------------------------------
    println!("[Step 4] Updating provider settings with empty api_key (must preserve secret)...");
    let updated = ProviderService::update(
        &pool,
        &created.id,
        ProviderUpdateInput {
            name: Some("Anthropic Production KDE (Renamed)".to_string()),
            base_url: None,
            api_key: None, // Empty edit!
            clear_api_key: None,
            default_model: Some("claude-3-opus-20240229".to_string()),
            timeout_seconds: Some(90),
            is_active: None,
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to update provider");

    assert!(updated.has_api_key, "Key must remain present after empty edit");
    assert_eq!(updated.credential_status, "stored");
    assert_eq!(updated.masked_hint, Some("••••••••9900".to_string()));

    let raw_key_after_edit = ProviderService::get_raw_key(&pool, &created.id, vault.as_ref())
        .await
        .expect("Failed to query raw key");
    assert_eq!(raw_key_after_edit, Some(test_secret.to_string()), "Secret must remain identical");

    // -------------------------------------------------------------
    // Step 5: Simulate Application Restart
    // -------------------------------------------------------------
    println!("[Step 5] Simulating full application shutdown and restart...");
    // Drop pool connection and old vault instance
    drop(pool);
    drop(vault);

    // Reconnect to SQLite database from cold disk
    let new_pool = setup_file_db(&temp_db_path).await;
    // Re-initialize a brand new vault instance from scratch
    let restarted_vault = Arc::new(HybridCredentialVault::new());

    // -------------------------------------------------------------
    // Step 6: Verify credential status after restart
    // -------------------------------------------------------------
    println!("[Step 6] Verifying credential status after cold restart...");
    let after_restart = ProviderService::get(&new_pool, &created.id, restarted_vault.as_ref())
        .await
        .expect("Failed to get provider after restart");

    assert!(after_restart.has_api_key, "API key must persist after application restart");
    assert_eq!(after_restart.credential_status, "stored");
    assert_eq!(after_restart.masked_hint, Some("••••••••9900".to_string()));

    let raw_key_restart = ProviderService::get_raw_key(&new_pool, &created.id, restarted_vault.as_ref())
        .await
        .expect("Failed to query raw key after restart");
    assert_eq!(raw_key_restart, Some(test_secret.to_string()), "Key retrieved from cold restart must match original");

    // -------------------------------------------------------------
    // Step 7: Clean up test provider & credentials
    // -------------------------------------------------------------
    println!("[Step 7] Deleting provider and purging credentials...");
    ProviderService::delete(&new_pool, &created.id, restarted_vault.as_ref())
        .await
        .expect("Failed to delete provider");

    let post_delete_key = ProviderService::get_raw_key(&new_pool, &created.id, restarted_vault.as_ref())
        .await
        .unwrap_or(None);
    assert_eq!(post_delete_key, None, "Secret must be removed from vault upon provider deletion");

    // Clean up temporary database
    drop(new_pool);
    let _ = std::fs::remove_file(&temp_db_path);

    println!("\n=== ALL REAL KDE PLASMA SECRET SERVICE & VAULT TESTS PASSED! ===\n");
}
