use std::sync::Arc;
use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use serde_json::{json, Value};
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt; // for oneshot()

use mechon_ai::credentials::{CredentialStore, InMemoryCredentialStore};
use mechon_ai::models::ProjectCreateInput;
use mechon_ai::services::mobile_gateway_service::{
    create_gateway_router, GatewayAppState, MobileGatewayService,
};
use mechon_ai::services::project_service::ProjectService;

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
    sqlx::raw_sql(schema_sql).execute(&pool).await.unwrap();

    let eng_sql = include_str!("../migrations/20261103000000_engineering_expansion.sql");
    sqlx::raw_sql(eng_sql).execute(&pool).await.unwrap();

    let story_sql = include_str!("../migrations/20261103100000_story_architect.sql");
    sqlx::raw_sql(story_sql).execute(&pool).await.unwrap();

    let mobile_sql = include_str!("../migrations/20261104000000_mobile_companion.sql");
    sqlx::raw_sql(mobile_sql).execute(&pool).await.unwrap();

    // Ensure mock provider exists for testing
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
         VALUES ('mock', 'Mock Provider', 'mock', 'http://127.0.0.1:0', NULL, 'mock-llama-3-8b', '[\"mock-llama-3-8b\", \"mock-vision-model\"]', 30, 1, '{}', ?, ?)"
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    pool
}

#[tokio::test]
async fn test_gateway_pairing_and_token_authentication() {
    let pool = setup_test_db().await;
    let vault: Arc<dyn CredentialStore> = Arc::new(InMemoryCredentialStore::new());

    let (code, _uri) = MobileGatewayService::generate_pairing_code().await.unwrap();
    assert!(!code.is_empty());

    let state = GatewayAppState {
        pool: pool.clone(),
        vault: vault.clone(),
        internal: MobileGatewayService::get_state(),
    };
    let app = create_gateway_router(state);

    // 1. Pair with valid code
    let pair_body = json!({
        "pairing_code": code,
        "device_name": "Pixel 8 Pro Tester",
        "device_platform": "android"
    });

    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/pair")
        .header("Content-Type", "application/json")
        .body(Body::from(pair_body.to_string()))
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let bytes = axum::body::to_bytes(resp.into_body(), 1024 * 64).await.unwrap();
    let body_json: Value = serde_json::from_slice(&bytes).unwrap();
    let token = body_json["token"].as_str().unwrap().to_string();
    let device_id = body_json["device_id"].as_str().unwrap().to_string();
    assert!(!token.is_empty());
    assert!(!device_id.is_empty());

    // 2. Pair with invalid code should fail
    let bad_req = Request::builder()
        .method("POST")
        .uri("/api/v1/pair")
        .header("Content-Type", "application/json")
        .body(Body::from(json!({
            "pairing_code": "INVALID-CODE",
            "device_name": "Rogue Device"
        }).to_string()))
        .unwrap();

    let bad_resp = app.clone().oneshot(bad_req).await.unwrap();
    assert_eq!(bad_resp.status(), StatusCode::UNAUTHORIZED);

    // 3. Test authenticated endpoint with valid token
    let auth_req = Request::builder()
        .method("GET")
        .uri("/api/v1/providers/models")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let auth_resp = app.clone().oneshot(auth_req).await.unwrap();
    assert_eq!(auth_resp.status(), StatusCode::OK);

    let prov_bytes = axum::body::to_bytes(auth_resp.into_body(), 1024 * 64).await.unwrap();
    let prov_json: Value = serde_json::from_slice(&prov_bytes).unwrap();
    assert!(prov_json["providers"].as_array().unwrap().len() >= 1);

    // 4. Test authenticated endpoint with invalid token
    let unauth_req = Request::builder()
        .method("GET")
        .uri("/api/v1/providers/models")
        .header("Authorization", "Bearer invalid-dummy-token")
        .body(Body::empty())
        .unwrap();

    let unauth_resp = app.clone().oneshot(unauth_req).await.unwrap();
    assert_eq!(unauth_resp.status(), StatusCode::UNAUTHORIZED);

    // 5. Revocation test
    MobileGatewayService::revoke_paired_device(&pool, &device_id).await.unwrap();

    let revoked_req = Request::builder()
        .method("GET")
        .uri("/api/v1/providers/models")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let revoked_resp = app.clone().oneshot(revoked_req).await.unwrap();
    assert_eq!(revoked_resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_gateway_conversation_sync_and_sft_pipeline() {
    let pool = setup_test_db().await;
    let vault: Arc<dyn CredentialStore> = Arc::new(InMemoryCredentialStore::new());

    let _project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Mobile Sync Studio".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    let (code, _) = MobileGatewayService::generate_pairing_code().await.unwrap();
    let state = GatewayAppState {
        pool: pool.clone(),
        vault: vault.clone(),
        internal: MobileGatewayService::get_state(),
    };
    let app = create_gateway_router(state);

    // Pair to get token
    let pair_resp = app.clone().oneshot(
        Request::builder()
            .method("POST")
            .uri("/api/v1/pair")
            .header("Content-Type", "application/json")
            .body(Body::from(json!({
                "pairing_code": code,
                "device_name": "Galaxy S24 Ultra",
                "device_platform": "android"
            }).to_string()))
            .unwrap()
    ).await.unwrap();
    let pair_bytes = axum::body::to_bytes(pair_resp.into_body(), 1024 * 64).await.unwrap();
    let pair_json: Value = serde_json::from_slice(&pair_bytes).unwrap();
    let token = pair_json["token"].as_str().unwrap().to_string();

    // 1. Sync conversation from phone
    let transfer_id = format!("sync-{}", uuid::Uuid::new_v4());
    let sync_body = json!({
        "transfer_id": transfer_id,
        "conversations": [
            {
                "original_session_id": "mobile-sess-101",
                "title": "Quantum Physics Exploration",
                "system_prompt": "You are a quantum physicist roleplaying assistant.",
                "model_id": "mock-llama-3-8b",
                "provider_id": "mock",
                "messages": [
                    { "role": "user", "content": "Explain entanglement simply." },
                    { "role": "assistant", "content": "Entanglement is when two particles become interconnected." }
                ],
                "metadata": { "environment": "mobile-companion" }
            }
        ]
    });

    let sync_req = Request::builder()
        .method("POST")
        .uri("/api/v1/sync/conversations")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(Body::from(sync_body.to_string()))
        .unwrap();

    let sync_resp = app.clone().oneshot(sync_req).await.unwrap();
    assert_eq!(sync_resp.status(), StatusCode::OK);

    let sync_bytes = axum::body::to_bytes(sync_resp.into_body(), 1024 * 64).await.unwrap();
    let sync_res: Value = serde_json::from_slice(&sync_bytes).unwrap();
    assert_eq!(sync_res["success"], true);
    assert_eq!(sync_res["imported_count"], 1);

    // 2. Idempotency test: duplicate sync payload must not create duplicates
    let dup_req = Request::builder()
        .method("POST")
        .uri("/api/v1/sync/conversations")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(Body::from(sync_body.to_string()))
        .unwrap();

    let dup_resp = app.clone().oneshot(dup_req).await.unwrap();
    assert_eq!(dup_resp.status(), StatusCode::OK);
    let dup_bytes = axum::body::to_bytes(dup_resp.into_body(), 1024 * 64).await.unwrap();
    let dup_res: Value = serde_json::from_slice(&dup_bytes).unwrap();
    assert_eq!(dup_res["already_received"], true);

    // 3. Verify mobile imports queue
    let imports = MobileGatewayService::list_mobile_imports(&pool).await.unwrap();
    assert_eq!(imports.len(), 1);
    assert_eq!(imports[0].title, "Quantum Physics Exploration");
    assert_eq!(imports[0].status, "pending");

    // 4. Convert mobile import to active SFT draft
    let draft_session_id = MobileGatewayService::convert_mobile_import_to_sft_draft(&pool, &imports[0].id, None).await.unwrap();
    assert!(!draft_session_id.is_empty());

    let updated_imports = MobileGatewayService::list_mobile_imports(&pool).await.unwrap();
    assert_eq!(updated_imports[0].status, "converted_to_draft");

    // 5. Commit mobile import directly to corpus
    let record_id = MobileGatewayService::commit_mobile_import_to_corpus(&pool, &imports[0].id, None).await.unwrap();
    assert!(!record_id.is_empty());

    let final_imports = MobileGatewayService::list_mobile_imports(&pool).await.unwrap();
    assert_eq!(final_imports[0].status, "committed");
}
