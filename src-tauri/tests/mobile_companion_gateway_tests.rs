use std::sync::Arc;
use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use serde_json::{json, Value};
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt; // for oneshot()

use tokio::sync::RwLock;

use mechon_ai::credentials::{CredentialStore, InMemoryCredentialStore};
use mechon_ai::models::ProjectCreateInput;
use mechon_ai::services::mobile_gateway_service::{
    create_gateway_router, GatewayAppState, GatewayInternalState, MobileGatewayService,
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

    let code = "MCH-TEST-AUTH".to_string();
    let internal = Arc::new(RwLock::new(GatewayInternalState {
        pairing_code: Some(code.clone()),
        pairing_expires_at: Some(chrono::Utc::now().timestamp() + 900),
        ..Default::default()
    }));

    let state = GatewayAppState {
        pool: pool.clone(),
        vault: vault.clone(),
        internal,
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
    assert!(prov_json["models"].as_array().unwrap().len() >= 1);
    assert!(prov_json["default_provider"].is_string());
    assert!(prov_json["default_model"].is_string());

    // 4. Test authenticated chat inference with canonical provider
    let chat_req = Request::builder()
        .method("POST")
        .uri("/api/v1/inference/chat")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(Body::from(json!({
            "provider_id": "mock",
            "model_id": "mock-llama-3-8b",
            "messages": [
                { "role": "user", "content": "Hello from companion test" }
            ]
        }).to_string()))
        .unwrap();

    let chat_resp = app.clone().oneshot(chat_req).await.unwrap();
    assert_eq!(chat_resp.status(), StatusCode::OK);
    let chat_bytes = axum::body::to_bytes(chat_resp.into_body(), 1024 * 64).await.unwrap();
    let chat_json: Value = serde_json::from_slice(&chat_bytes).unwrap();
    assert_eq!(chat_json["role"], "assistant");
    assert!(!chat_json["content"].as_str().unwrap().is_empty());

    // 5. Test authenticated chat inference with provider alias resolution (e.g. "mock-provider")
    let alias_req = Request::builder()
        .method("POST")
        .uri("/api/v1/inference/chat")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(Body::from(json!({
            "provider_id": "mock-provider",
            "model": "mock-llama-3-8b",
            "messages": [
                { "role": "user", "content": "Hello via alias" }
            ]
        }).to_string()))
        .unwrap();

    let alias_resp = app.clone().oneshot(alias_req).await.unwrap();
    assert_eq!(alias_resp.status(), StatusCode::OK);

    // 6. Test authenticated endpoint with invalid token
    let unauth_req = Request::builder()
        .method("GET")
        .uri("/api/v1/providers/models")
        .header("Authorization", "Bearer invalid-dummy-token")
        .body(Body::empty())
        .unwrap();

    let unauth_resp = app.clone().oneshot(unauth_req).await.unwrap();
    assert_eq!(unauth_resp.status(), StatusCode::UNAUTHORIZED);

    // 5. Revocation test: revoked device must return 403 Forbidden
    MobileGatewayService::revoke_paired_device(&pool, &device_id).await.unwrap();

    let revoked_req = Request::builder()
        .method("GET")
        .uri("/api/v1/providers/models")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let revoked_resp = app.clone().oneshot(revoked_req).await.unwrap();
    assert_eq!(revoked_resp.status(), StatusCode::FORBIDDEN);

    // 6. Invalid token must return 401 Unauthorized
    let invalid_token_req = Request::builder()
        .method("GET")
        .uri("/api/mobile/v1/health")
        .header("Authorization", "Bearer invalid_nonexistent_token")
        .body(Body::empty())
        .unwrap();
    let invalid_resp = app.clone().oneshot(invalid_token_req).await.unwrap();
    assert_eq!(invalid_resp.status(), StatusCode::UNAUTHORIZED);
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

    let code = "MCH-TEST-SYNC".to_string();
    let internal = Arc::new(RwLock::new(GatewayInternalState {
        pairing_code: Some(code.clone()),
        pairing_expires_at: Some(chrono::Utc::now().timestamp() + 900),
        ..Default::default()
    }));
    let state = GatewayAppState {
        pool: pool.clone(),
        vault: vault.clone(),
        internal,
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

#[tokio::test]
async fn test_approval_based_pairing_workflow() {
    let pool = setup_test_db().await;
    let vault = Arc::new(InMemoryCredentialStore::new());

    let internal_state = MobileGatewayService::get_state();

    let app_state = GatewayAppState {
        pool: pool.clone(),
        vault: vault.clone(),
        internal: internal_state.clone(),
    };

    let app = create_gateway_router(app_state);

    // 1. Android requests pairing
    let req_body = json!({
        "device_id": "pixel-9-pro",
        "device_name": "Google Pixel 9 Pro",
        "device_platform": "android",
        "client_nonce": "nonce_12345"
    });

    let pair_req = Request::builder()
        .method("POST")
        .uri("/api/v1/pairing/request")
        .header("Content-Type", "application/json")
        .body(Body::from(req_body.to_string()))
        .unwrap();

    let pair_resp = app.clone().oneshot(pair_req).await.unwrap();
    assert_eq!(pair_resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(pair_resp.into_body(), 1024 * 16).await.unwrap();
    let res: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(res["status"], "pending");
    let request_id = res["request_id"].as_str().unwrap().to_string();

    // 2. Mobile checks status before desktop approval
    let status_req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/pairing/status/{}", request_id))
        .body(Body::empty())
        .unwrap();

    let status_resp = app.clone().oneshot(status_req).await.unwrap();
    assert_eq!(status_resp.status(), StatusCode::OK);
    let s_bytes = axum::body::to_bytes(status_resp.into_body(), 1024 * 16).await.unwrap();
    let s_res: Value = serde_json::from_slice(&s_bytes).unwrap();
    assert_eq!(s_res["status"], "pending");

    // 3. Desktop user approves pairing request
    let pending = MobileGatewayService::list_pending_pairing_requests().await;
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].device_id, "pixel-9-pro");

    let token = MobileGatewayService::approve_pairing_request(&pool, &request_id).await.unwrap();
    assert!(token.starts_with("mch_live_"));

    // 4. Mobile checks status after approval -> receives token!
    let status_req2 = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/pairing/status/{}", request_id))
        .body(Body::empty())
        .unwrap();

    let status_resp2 = app.clone().oneshot(status_req2).await.unwrap();
    assert_eq!(status_resp2.status(), StatusCode::OK);
    let s_bytes2 = axum::body::to_bytes(status_resp2.into_body(), 1024 * 16).await.unwrap();
    let s_res2: Value = serde_json::from_slice(&s_bytes2).unwrap();
    assert_eq!(s_res2["status"], "approved");
    assert_eq!(s_res2["token"].as_str().unwrap(), token);

    // 5. Test authenticated model discovery with approved token
    let models_req = Request::builder()
        .method("GET")
        .uri("/api/v1/providers/models")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let models_resp = app.clone().oneshot(models_req).await.unwrap();
    assert_eq!(models_resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_gateway_tailscale_ip_detection() {
    let pool = setup_test_db().await;
    let vault: Arc<dyn CredentialStore> = Arc::new(InMemoryCredentialStore::new());
    let internal = Arc::new(RwLock::new(GatewayInternalState {
        is_running: true,
        port: 38475,
        local_ip: "192.168.1.50".to_string(),
        tailscale_ip: Some("100.127.109.78".to_string()),
        pairing_code: Some("MCH-TEST-TS01".to_string()),
        pairing_expires_at: Some(chrono::Utc::now().timestamp() + 900),
        ..Default::default()
    }));

    let state = GatewayAppState {
        pool: pool.clone(),
        vault: vault.clone(),
        internal,
    };
    let app = create_gateway_router(state);

    // Call /api/v1/status
    let status_req = Request::builder()
        .uri("/api/v1/status")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let resp = app.clone().oneshot(status_req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap();
    let body_json: Value = serde_json::from_slice(&bytes).unwrap();

    assert_eq!(body_json["tailscale_ip"], "100.127.109.78");
    assert_eq!(body_json["network"]["is_tailscale_active"], true);
    assert_eq!(body_json["network"]["tailscale_ip"], "100.127.109.78");
}

#[tokio::test]
async fn test_unified_mobile_v1_api_and_inference() {
    let pool = setup_test_db().await;
    let vault: Arc<dyn CredentialStore> = Arc::new(InMemoryCredentialStore::new());

    let code = "MCH-TEST-V128".to_string();
    let internal = Arc::new(RwLock::new(GatewayInternalState {
        pairing_code: Some(code.clone()),
        pairing_expires_at: Some(chrono::Utc::now().timestamp() + 900),
        ..Default::default()
    }));

    let state = GatewayAppState {
        pool: pool.clone(),
        vault: vault.clone(),
        internal,
    };
    let app = create_gateway_router(state);

    // 1. Pair
    let pair_body = json!({
        "pairing_code": code,
        "device_name": "Test Mobile Client",
        "device_platform": "android"
    });
    let req = Request::builder()
        .method("POST")
        .uri("/api/mobile/v1/pair")
        .header("Content-Type", "application/json")
        .body(Body::from(pair_body.to_string()))
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(resp.into_body(), 1024 * 64).await.unwrap();
    let pair_json: Value = serde_json::from_slice(&bytes).unwrap();
    let token = pair_json["token"].as_str().unwrap().to_string();

    // 2. Health Check (/api/mobile/v1/health)
    let health_req = Request::builder()
        .method("GET")
        .uri("/api/mobile/v1/health")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();
    let health_resp = app.clone().oneshot(health_req).await.unwrap();
    assert_eq!(health_resp.status(), StatusCode::OK);
    let h_bytes = axum::body::to_bytes(health_resp.into_body(), 1024 * 64).await.unwrap();
    let h_json: Value = serde_json::from_slice(&h_bytes).unwrap();
    assert_eq!(h_json["status"], "ok");
    assert_eq!(h_json["authenticated"], true);
    assert_eq!(h_json["version"], "1.2.8");

    // 3. Capabilities (/api/mobile/v1/capabilities)
    let caps_req = Request::builder()
        .method("GET")
        .uri("/api/mobile/v1/capabilities")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();
    let caps_resp = app.clone().oneshot(caps_req).await.unwrap();
    assert_eq!(caps_resp.status(), StatusCode::OK);
    let c_bytes = axum::body::to_bytes(caps_resp.into_body(), 1024 * 64).await.unwrap();
    let c_json: Value = serde_json::from_slice(&c_bytes).unwrap();
    assert_eq!(c_json["streaming"], true);
    assert_eq!(c_json["tailscale_supported"], true);

    // 4. Remote Models Registry (/api/mobile/v1/models)
    let models_req = Request::builder()
        .method("GET")
        .uri("/api/mobile/v1/models")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();
    let models_resp = app.clone().oneshot(models_req).await.unwrap();
    assert_eq!(models_resp.status(), StatusCode::OK);

    // 5. Remote Chat Inference - Non-Streaming
    let chat_body = json!({
        "provider_id": "mock",
        "model": "mock-llama-3-8b",
        "messages": [
            { "role": "user", "content": "Hello from Mechon Mobile v1.2.8" }
        ],
        "stream": false
    });
    let chat_req = Request::builder()
        .method("POST")
        .uri("/api/mobile/v1/inference")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(Body::from(chat_body.to_string()))
        .unwrap();
    let chat_resp = app.clone().oneshot(chat_req).await.unwrap();
    assert_eq!(chat_resp.status(), StatusCode::OK);
    let ch_bytes = axum::body::to_bytes(chat_resp.into_body(), 1024 * 64).await.unwrap();
    let ch_json: Value = serde_json::from_slice(&ch_bytes).unwrap();
    assert_eq!(ch_json["role"], "assistant");
    assert!(!ch_json["content"].as_str().unwrap().is_empty());

    // 6. Remote Chat Inference - Streaming SSE
    let stream_body = json!({
        "provider_id": "mock",
        "model": "mock-llama-3-8b",
        "messages": [
            { "role": "user", "content": "Stream tokens to Mechon Mobile" }
        ],
        "stream": true
    });
    let stream_req = Request::builder()
        .method("POST")
        .uri("/api/mobile/v1/inference")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(Body::from(stream_body.to_string()))
        .unwrap();
    let stream_resp = app.clone().oneshot(stream_req).await.unwrap();
    assert_eq!(stream_resp.status(), StatusCode::OK);
    assert_eq!(stream_resp.headers().get("Content-Type").unwrap(), "text/event-stream");
    let stream_bytes = axum::body::to_bytes(stream_resp.into_body(), 1024 * 64).await.unwrap();
    let stream_text = String::from_utf8_lossy(&stream_bytes);
    assert!(stream_text.contains("data: "));
    assert!(stream_text.contains("[DONE]"));
}
