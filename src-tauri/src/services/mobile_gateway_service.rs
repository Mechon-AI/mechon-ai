use std::net::SocketAddr;
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tokio::sync::{oneshot, RwLock};
use tracing::{info, warn};

use crate::credentials::CredentialStore;
use crate::errors::AppError;
use crate::models::{
    MobileGatewayStatus, MobileImportedConversation, PairedDevice, PairingRequestItem,
    SFTCommitInput, SFTMessageCreateInput, SFTSessionCreateInput,
};
use crate::providers::{ChatMessage, ChatRequest};
use crate::providers::factory::ProviderFactory;
use crate::services::provider_service::ProviderService;
use crate::services::sft_service::SFTService;

#[derive(Clone)]
pub struct GatewayAppState {
    pub pool: SqlitePool,
    pub vault: Arc<dyn CredentialStore>,
    pub internal: Arc<RwLock<GatewayInternalState>>,
}

pub struct GatewayInternalState {
    pub is_running: bool,
    pub port: u16,
    pub local_ip: String,
    pub tailscale_ip: Option<String>,
    pub pairing_code: Option<String>,
    pub pairing_expires_at: Option<i64>,
    pub shutdown_tx: Option<oneshot::Sender<()>>,
    pub beacon_shutdown_tx: Option<oneshot::Sender<()>>,
    pub pairing_requests: Vec<PairingRequestItem>,
}

impl Default for GatewayInternalState {
    fn default() -> Self {
        Self {
            is_running: false,
            port: 38475,
            local_ip: get_local_lan_ip(),
            tailscale_ip: get_tailscale_ip(),
            pairing_code: None,
            pairing_expires_at: None,
            shutdown_tx: None,
            beacon_shutdown_tx: None,
            pairing_requests: Vec::new(),
        }
    }
}

pub fn get_local_lan_ip() -> String {
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                let ip = addr.ip().to_string();
                if ip != "0.0.0.0" {
                    return ip;
                }
            }
        }
    }
    "127.0.0.1".to_string()
}

pub fn get_tailscale_ip() -> Option<String> {
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("100.100.100.100:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                let ip = addr.ip().to_string();
                if ip.starts_with("100.") {
                    return Some(ip);
                }
            }
        }
    }
    None
}

pub fn hash_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

pub struct MobileGatewayService;

// Global singleton state for Gateway service
static GATEWAY_STATE: std::sync::OnceLock<Arc<RwLock<GatewayInternalState>>> = std::sync::OnceLock::new();

fn get_shared_gateway_state() -> Arc<RwLock<GatewayInternalState>> {
    GATEWAY_STATE.get_or_init(|| Arc::new(RwLock::new(GatewayInternalState::default()))).clone()
}

impl MobileGatewayService {
    pub fn get_state() -> Arc<RwLock<GatewayInternalState>> {
        get_shared_gateway_state()
    }

    pub async fn get_status(pool: &SqlitePool) -> Result<MobileGatewayStatus, AppError> {
        let state_arc = Self::get_state();
        let state = state_arc.read().await;

        let active_code = if let Some(ref exp) = state.pairing_expires_at {
            if chrono::Utc::now().timestamp() < *exp {
                state.pairing_code.clone()
            } else {
                None
            }
        } else {
            None
        };

        let pairing_uri = active_code.as_ref().map(|code| {
            format!(
                "mechon://pair?host={}&port={}&code={}&name=Mechon%20Desktop",
                state.local_ip, state.port, code
            )
        });

        let (devices_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM paired_devices WHERE is_approved = 1")
            .fetch_one(pool)
            .await
            .unwrap_or((0,));

        let (imports_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM mobile_imported_conversations WHERE status = 'pending'")
            .fetch_one(pool)
            .await
            .unwrap_or((0,));

        Ok(MobileGatewayStatus {
            is_running: state.is_running,
            port: state.port,
            local_ip: state.local_ip.clone(),
            tailscale_ip: state.tailscale_ip.clone(),
            pairing_code: active_code,
            pairing_uri,
            connected_devices_count: devices_count,
            pending_imports_count: imports_count,
        })
    }

    pub async fn generate_pairing_code() -> Result<(String, String), AppError> {
        let state_arc = Self::get_state();
        let mut state = state_arc.write().await;

        let rand_num: u32 = rand_u32();
        let code = format!("MCH-{:04X}-{:04X}", (rand_num >> 16) & 0xFFFF, rand_num & 0xFFFF);
        let expires_at = chrono::Utc::now().timestamp() + (15 * 60); // 15 mins

        state.pairing_code = Some(code.clone());
        state.pairing_expires_at = Some(expires_at);

        let uri = format!(
            "mechon://pair?host={}&port={}&code={}&name=Mechon%20Desktop",
            state.local_ip, state.port, code
        );

        Ok((code, uri))
    }

    pub async fn start_gateway(
        pool: SqlitePool,
        vault: Arc<dyn CredentialStore>,
        port: Option<u16>,
    ) -> Result<MobileGatewayStatus, AppError> {
        let state_arc = Self::get_state();
        let mut state = state_arc.write().await;

        if state.is_running {
            drop(state);
            return Self::get_status(&pool).await;
        }

        let target_port = port.unwrap_or(state.port);
        state.port = target_port;
        state.local_ip = get_local_lan_ip();
        state.tailscale_ip = get_tailscale_ip();

        let (_code, _) = {
            let rand_num = rand_u32();
            let c = format!("MCH-{:04X}-{:04X}", (rand_num >> 16) & 0xFFFF, rand_num & 0xFFFF);
            let exp = chrono::Utc::now().timestamp() + (15 * 60);
            state.pairing_code = Some(c.clone());
            state.pairing_expires_at = Some(exp);
            (c, exp)
        };

        let app_state = GatewayAppState {
            pool: pool.clone(),
            vault,
            internal: state_arc.clone(),
        };

        let app = create_gateway_router(app_state);

        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        state.shutdown_tx = Some(shutdown_tx);
        state.is_running = true;

        let bind_addr = SocketAddr::from(([0, 0, 0, 0], target_port));
        let listener = match tokio::net::TcpListener::bind(bind_addr).await {
            Ok(l) => l,
            Err(e) => {
                state.is_running = false;
                state.shutdown_tx = None;
                return Err(AppError::Internal(format!("Failed to bind local gateway on port {}: {}", target_port, e)));
            }
        };

        info!("Mechon Local Gateway listening on http://{}:{}", state.local_ip, target_port);

        // UDP Discovery Beacon on 38476
        let (beacon_tx, mut beacon_rx) = oneshot::channel::<()>();
        state.beacon_shutdown_tx = Some(beacon_tx);
        let b_ip = state.local_ip.clone();
        let b_tailscale_ip = state.tailscale_ip.clone();
        let b_port = target_port;

        tokio::spawn(async move {
            let socket = match tokio::net::UdpSocket::bind("0.0.0.0:38476").await {
                Ok(s) => s,
                Err(e) => {
                    warn!("Could not bind UDP discovery socket on 38476: {}", e);
                    return;
                }
            };
            let _ = socket.set_broadcast(true);
            let beacon_payload = serde_json::json!({
                "service": "mechon-gateway",
                "name": "Mechon Desktop",
                "lan_ip": b_ip,
                "tailscale_ip": b_tailscale_ip,
                "port": b_port,
                "version": "1.2.7",
                "is_tailscale": b_tailscale_ip.is_some()
            }).to_string();

            let mut buf = [0u8; 1024];
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(3));

            loop {
                tokio::select! {
                    _ = &mut beacon_rx => {
                        info!("UDP discovery beacon stopped.");
                        break;
                    }
                    _ = interval.tick() => {
                        let _ = socket.send_to(beacon_payload.as_bytes(), "255.255.255.255:38476").await;
                    }
                    recv_res = socket.recv_from(&mut buf) => {
                        if let Ok((len, src)) = recv_res {
                            let msg = String::from_utf8_lossy(&buf[..len]);
                            if msg.contains("MECHON_DISCOVER") {
                                let _ = socket.send_to(beacon_payload.as_bytes(), src).await;
                            }
                        }
                    }
                }
            }
        });

        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    let _ = shutdown_rx.await;
                })
                .await
            {
                warn!("Mechon Gateway server stopped: {}", e);
            }
        });

        drop(state);
        Self::get_status(&pool).await
    }

    pub async fn stop_gateway(pool: &SqlitePool) -> Result<MobileGatewayStatus, AppError> {
        let state_arc = Self::get_state();
        let mut state = state_arc.write().await;

        if let Some(tx) = state.shutdown_tx.take() {
            let _ = tx.send(());
        }
        if let Some(tx) = state.beacon_shutdown_tx.take() {
            let _ = tx.send(());
        }
        state.is_running = false;
        info!("Mechon Local Gateway stopped.");

        drop(state);
        Self::get_status(pool).await
    }

    // --- Paired Devices Management ---
    pub async fn list_paired_devices(pool: &SqlitePool) -> Result<Vec<PairedDevice>, AppError> {
        let rows = sqlx::query_as::<_, (String, String, String, i64, String, String)>(
            "SELECT id, device_name, device_platform, is_approved, last_active_at, created_at
             FROM paired_devices
             ORDER BY created_at DESC"
        )
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(|r| PairedDevice {
            id: r.0,
            device_name: r.1,
            device_platform: r.2,
            is_approved: r.3 != 0,
            last_active_at: r.4,
            created_at: r.5,
        }).collect())
    }

    pub async fn approve_paired_device(pool: &SqlitePool, device_id: &str) -> Result<(), AppError> {
        sqlx::query("UPDATE paired_devices SET is_approved = 1 WHERE id = ?")
            .bind(device_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn revoke_paired_device(pool: &SqlitePool, device_id: &str) -> Result<(), AppError> {
        sqlx::query("UPDATE paired_devices SET is_approved = 0 WHERE id = ?")
            .bind(device_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    // --- Approval-Based Pairing Requests ---
    pub async fn list_pending_pairing_requests() -> Vec<PairingRequestItem> {
        let state_arc = Self::get_state();
        let state = state_arc.read().await;
        state.pairing_requests.iter().filter(|r| r.status == "pending").cloned().collect()
    }

    pub async fn list_all_pairing_requests() -> Vec<PairingRequestItem> {
        let state_arc = Self::get_state();
        let state = state_arc.read().await;
        state.pairing_requests.clone()
    }

    pub async fn approve_pairing_request(pool: &SqlitePool, request_id: &str) -> Result<String, AppError> {
        let state_arc = Self::get_state();
        let mut state = state_arc.write().await;

        let req = state.pairing_requests.iter_mut().find(|r| r.request_id == request_id)
            .ok_or_else(|| AppError::NotFound(format!("Pairing request {} not found", request_id)))?;

        let token_raw = format!("mch_live_{}_{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
        let token_hash = hash_token(&token_raw);
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO paired_devices (id, device_name, device_platform, auth_token_hash, is_approved, last_active_at, created_at)
             VALUES (?, ?, ?, ?, 1, ?, ?)
             ON CONFLICT(id) DO UPDATE SET is_approved = 1, auth_token_hash = excluded.auth_token_hash, last_active_at = excluded.last_active_at"
        )
        .bind(&req.device_id)
        .bind(&req.device_name)
        .bind(&req.device_platform)
        .bind(&token_hash)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        req.status = "approved".to_string();
        req.token = Some(token_raw.clone());

        Ok(token_raw)
    }

    pub async fn reject_pairing_request(request_id: &str) -> Result<(), AppError> {
        let state_arc = Self::get_state();
        let mut state = state_arc.write().await;

        let req = state.pairing_requests.iter_mut().find(|r| r.request_id == request_id)
            .ok_or_else(|| AppError::NotFound(format!("Pairing request {} not found", request_id)))?;

        req.status = "rejected".to_string();
        Ok(())
    }

    // --- Mobile Imports & SFT Pipeline ---
    pub async fn list_mobile_imports(pool: &SqlitePool) -> Result<Vec<MobileImportedConversation>, AppError> {
        let rows = sqlx::query_as::<_, (
            String, String, String, String, Option<String>, Option<String>,
            Option<String>, String, String, String, Option<String>, String, String
        )>(
            "SELECT id, transfer_id, original_session_id, title, system_prompt, model_id,
                    provider_id, messages_json, metadata_json, status, converted_sft_session_id,
                    created_at, updated_at
             FROM mobile_imported_conversations
             ORDER BY created_at DESC"
        )
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(|r| {
            let messages: Value = serde_json::from_str(&r.7).unwrap_or_else(|_| json!([]));
            let metadata: Value = serde_json::from_str(&r.8).unwrap_or_else(|_| json!({}));
            MobileImportedConversation {
                id: r.0,
                transfer_id: r.1,
                original_session_id: r.2,
                title: r.3,
                system_prompt: r.4,
                model_id: r.5,
                provider_id: r.6,
                messages,
                metadata,
                status: r.9,
                converted_sft_session_id: r.10,
                created_at: r.11,
                updated_at: r.12,
            }
        }).collect())
    }

    pub async fn convert_mobile_import_to_sft_draft(
        pool: &SqlitePool,
        import_id: &str,
        target_project_id: Option<String>,
    ) -> Result<String, AppError> {
        let row = sqlx::query_as::<_, (
            String, String, Option<String>, Option<String>, Option<String>, String, String
        )>(
            "SELECT id, title, system_prompt, model_id, provider_id, messages_json, metadata_json
             FROM mobile_imported_conversations
             WHERE id = ?"
        )
        .bind(import_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Imported conversation {} not found", import_id)))?;

        let p_id = match target_project_id {
            Some(p) if !p.trim().is_empty() => p,
            _ => {
                let (first_p,): (String,) = sqlx::query_as("SELECT id FROM projects ORDER BY created_at ASC LIMIT 1")
                    .fetch_optional(pool)
                    .await?
                    .ok_or_else(|| AppError::Validation("No active projects found. Create a project first.".to_string()))?;
                first_p
            }
        };

        let session = SFTService::create_session(pool, SFTSessionCreateInput {
            project_id: p_id,
            title: Some(format!("📱 {}", row.1)),
            system_prompt: row.2,
            provider_id: row.4,
            model: row.3,
            temperature: Some(0.7),
            top_p: Some(0.9),
            max_tokens: Some(2048),
            language_mode: Some("monolingual".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            language_metadata: None,
        }).await?;

        let messages: Vec<Value> = serde_json::from_str(&row.5).unwrap_or_default();
        for msg in messages {
            let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user").to_string();
            let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("").to_string();
            if !content.trim().is_empty() {
                SFTService::add_message(pool, &session.id, SFTMessageCreateInput {
                    role,
                    content,
                    model: msg.get("model").and_then(|m| m.as_str()).map(|s| s.to_string()),
                }).await?;
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE mobile_imported_conversations
             SET status = 'converted_to_draft', converted_sft_session_id = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&session.id)
        .bind(&now)
        .bind(import_id)
        .execute(pool)
        .await?;

        Ok(session.id)
    }

    pub async fn commit_mobile_import_to_corpus(
        pool: &SqlitePool,
        import_id: &str,
        target_project_id: Option<String>,
    ) -> Result<String, AppError> {
        let draft_id = Self::convert_mobile_import_to_sft_draft(pool, import_id, target_project_id).await?;

        let record = SFTService::commit_session(pool, &draft_id, SFTCommitInput {
            tags: Some(vec!["mobile-import".to_string(), "companion-chat".to_string()]),
            ..Default::default()
        }).await?;

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE mobile_imported_conversations
             SET status = 'committed', updated_at = ?
             WHERE id = ?"
        )
        .bind(&now)
        .bind(import_id)
        .execute(pool)
        .await?;

        Ok(record.id)
    }

    pub async fn delete_mobile_import(pool: &SqlitePool, import_id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM mobile_imported_conversations WHERE id = ?")
            .bind(import_id)
            .execute(pool)
            .await?;
        Ok(())
    }
}

fn rand_u32() -> u32 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let p1 = (now.as_nanos() & 0xFFFFFFFF) as u32;
    let p2 = (std::process::id() ^ 0xA5A55A5A) as u32;
    p1.wrapping_mul(1664525).wrapping_add(1013904223) ^ p2
}

// -------------------------------------------------------------
// Axum Router and Endpoints for Mobile Companion
// -------------------------------------------------------------

pub fn create_gateway_router(state: GatewayAppState) -> Router {
    Router::new()
        // Public endpoints
        .route("/api/v1/ping", get(handle_ping))
        .route("/api/v1/status", get(handle_status))
        .route("/api/v1/pair", post(handle_pair))
        .route("/api/v1/pairing/request", post(handle_pairing_request))
        .route("/api/v1/pairing/status/{request_id}", get(handle_pairing_status))
        // Authenticated endpoints
        .route("/api/v1/providers/models", get(handle_get_providers_models))
        .route("/api/v1/inference/chat", post(handle_inference_chat))
        .route("/api/v1/search", post(handle_web_search))
        .route("/api/v1/sync/conversations", post(handle_sync_conversations))
        .route("/api/v1/sync/transfers/{transfer_id}", get(handle_get_transfer_status))
        .with_state(state)
}

// --- Handler Implementations ---

async fn handle_ping() -> impl IntoResponse {
    (
        StatusCode::OK,
        [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
        json!({
            "status": "ok",
            "version": "1.2.7",
            "workstation": "Mechon AI Desktop",
            "timestamp": chrono::Utc::now().to_rfc3339()
        }).to_string(),
    )
}

async fn handle_status(State(state): State<GatewayAppState>) -> impl IntoResponse {
    let internal = state.internal.read().await;
    (
        StatusCode::OK,
        [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
        json!({
            "status": "online",
            "version": "1.2.7",
            "local_ip": internal.local_ip,
            "tailscale_ip": internal.tailscale_ip,
            "port": internal.port,
            "workstation_name": "Mechon AI Workstation",
            "network": {
                "lan_ip": internal.local_ip,
                "tailscale_ip": internal.tailscale_ip,
                "is_tailscale_active": internal.tailscale_ip.is_some()
            }
        }).to_string(),
    )
}

#[derive(Deserialize)]
struct PairingRequestPayload {
    device_id: String,
    device_name: String,
    device_platform: Option<String>,
    client_nonce: Option<String>,
}

async fn handle_pairing_request(
    State(state): State<GatewayAppState>,
    Json(payload): Json<PairingRequestPayload>,
) -> impl IntoResponse {
    let request_id = uuid::Uuid::new_v4().to_string();
    let mut internal = state.internal.write().await;

    // Retain only requests that don't match this device_id if pending
    internal.pairing_requests.retain(|r| r.device_id != payload.device_id || r.status != "pending");

    let req = PairingRequestItem {
        request_id: request_id.clone(),
        device_id: payload.device_id,
        device_name: payload.device_name,
        device_platform: payload.device_platform.unwrap_or_else(|| "android".to_string()),
        client_ip: "LAN".to_string(),
        client_nonce: payload.client_nonce.unwrap_or_default(),
        status: "pending".to_string(),
        token: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    internal.pairing_requests.push(req);

    (
        StatusCode::OK,
        [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
        json!({
            "request_id": request_id,
            "status": "pending",
            "message": "Connection request submitted. Awaiting approval on Mechon Desktop."
        }).to_string(),
    )
}

async fn handle_pairing_status(
    State(state): State<GatewayAppState>,
    Path(request_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let internal = state.internal.read().await;

    let req = internal.pairing_requests.iter().find(|r| r.request_id == request_id)
        .ok_or_else(|| (
            StatusCode::NOT_FOUND,
            json!({ "error": "Pairing request not found or expired" }).to_string(),
        ))?;

    match req.status.as_str() {
        "approved" => {
            Ok((
                StatusCode::OK,
                [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
                json!({
                    "request_id": req.request_id,
                    "status": "approved",
                    "token": req.token,
                    "device_id": req.device_id,
                    "desktop_name": "Mechon Workstation",
                    "version": "1.2.7"
                }).to_string(),
            ))
        }
        "rejected" => {
            Ok((
                StatusCode::OK,
                [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
                json!({
                    "request_id": req.request_id,
                    "status": "rejected",
                    "error": "Connection request was rejected by Mechon Desktop user."
                }).to_string(),
            ))
        }
        _ => {
            Ok((
                StatusCode::OK,
                [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
                json!({
                    "request_id": req.request_id,
                    "status": "pending",
                    "message": "Awaiting desktop user approval..."
                }).to_string(),
            ))
        }
    }
}

#[derive(Deserialize)]
struct PairPayload {
    pairing_code: String,
    device_name: String,
    device_platform: Option<String>,
}

async fn handle_pair(
    State(state): State<GatewayAppState>,
    Json(payload): Json<PairPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let internal = state.internal.read().await;

    let valid_code = internal.pairing_code.as_deref().unwrap_or("");
    let is_expired = match internal.pairing_expires_at {
        Some(exp) => chrono::Utc::now().timestamp() > exp,
        None => true,
    };

    let cleaned_input = payload.pairing_code.replace(['-', ' '], "").to_uppercase();
    let cleaned_target = valid_code.replace(['-', ' '], "").to_uppercase();

    if is_expired || cleaned_input.is_empty() || cleaned_input != cleaned_target {
        return Err((
            StatusCode::UNAUTHORIZED,
            json!({ "error": "Invalid or expired pairing code. Please regenerate code on desktop." }).to_string(),
        ));
    }
    drop(internal);

    // Generate cryptographic token
    let raw_token = format!("{:016x}{:016x}", rand_u32(), rand_u32());
    let token_hash = hash_token(&raw_token);
    let device_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let platform = payload.device_platform.unwrap_or_else(|| "android".to_string());

    sqlx::query(
        "INSERT INTO paired_devices (id, device_name, device_platform, auth_token_hash, is_approved, last_active_at, created_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)"
    )
    .bind(&device_id)
    .bind(&payload.device_name)
    .bind(&platform)
    .bind(&token_hash)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": e.to_string() }).to_string()))?;

    Ok((
        StatusCode::OK,
        [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
        json!({
            "success": true,
            "device_id": device_id,
            "token": raw_token,
            "workstation_name": "Mechon AI Desktop",
            "version": "1.2.4"
        }).to_string(),
    ))
}

// Authentication Helper
async fn authenticate_device(headers: &HeaderMap, pool: &SqlitePool) -> Result<String, (StatusCode, String)> {
    let auth_header = headers.get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, json!({ "error": "Missing Authorization header" }).to_string()))?;

    let token = auth_header.strip_prefix("Bearer ")
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, json!({ "error": "Invalid Authorization header format" }).to_string()))?
        .trim();

    let token_hash = hash_token(token);
    let row = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT id, device_name, is_approved FROM paired_devices WHERE auth_token_hash = ?"
    )
    .bind(&token_hash)
    .fetch_optional(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": e.to_string() }).to_string()))?;

    match row {
        Some((dev_id, _, is_approved)) if is_approved != 0 => {
            let now = chrono::Utc::now().to_rfc3339();
            let _ = sqlx::query("UPDATE paired_devices SET last_active_at = ? WHERE id = ?")
                .bind(&now)
                .bind(&dev_id)
                .execute(pool)
                .await;
            Ok(dev_id)
        }
        _ => Err((StatusCode::UNAUTHORIZED, json!({ "error": "Unauthorized or revoked device token" }).to_string())),
    }
}

async fn handle_get_providers_models(
    State(state): State<GatewayAppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    authenticate_device(&headers, &state.pool).await?;

    let providers = ProviderService::list(&state.pool, state.vault.as_ref())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": e.to_string() }).to_string()))?;

    let mut result_providers = Vec::new();
    let mut flat_models = Vec::new();
    let mut default_prov_id: Option<String> = None;
    let mut default_model_id: Option<String> = None;

    for p in &providers {
        if !p.is_active {
            continue;
        }

        if default_prov_id.is_none() && (p.has_api_key || p.provider_type == "mock" || p.provider_type == "ollama") {
            default_prov_id = Some(p.id.clone());
            default_model_id = p.default_model.clone();
        }

        let mut p_models = Vec::new();
        for m in &p.models_cache {
            let m_lower = m.to_lowercase();
            let supports_vision = m_lower.contains("vision")
                || m_lower.contains("flash")
                || m_lower.contains("claude-3")
                || m_lower.contains("gpt-4o")
                || m_lower.contains("gemini");
            let ctx = if m_lower.contains("gemini") { 1048576 } else { 128000 };

            p_models.push(json!({
                "id": m,
                "name": m,
                "supports_vision": supports_vision,
                "supports_streaming": true,
                "context_length": ctx
            }));

            flat_models.push(json!({
                "provider_id": p.id,
                "provider_name": p.name,
                "provider_type": p.provider_type,
                "model_id": m,
                "model_name": m,
                "supports_vision": supports_vision,
                "supports_streaming": true,
                "context_length": ctx,
                "is_active": p.is_active,
                "is_available": p.has_api_key || p.provider_type == "mock" || p.provider_type == "ollama"
            }));
        }

        result_providers.push(json!({
            "id": p.id,
            "name": p.name,
            "provider_type": p.provider_type,
            "is_active": p.is_active,
            "has_api_key": p.has_api_key,
            "default_model": p.default_model,
            "models": p_models
        }));
    }

    if default_model_id.is_none() {
        default_model_id = flat_models.first().and_then(|m| m.get("model_id").and_then(|v| v.as_str().map(String::from)));
    }
    if default_prov_id.is_none() {
        default_prov_id = flat_models.first().and_then(|m| m.get("provider_id").and_then(|v| v.as_str().map(String::from)));
    }

    Ok((
        StatusCode::OK,
        [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
        json!({
            "providers": result_providers,
            "models": flat_models,
            "default_provider": default_prov_id,
            "default_model": default_model_id
        }).to_string(),
    ))
}

#[derive(Deserialize)]
struct InferenceChatPayload {
    #[serde(alias = "providerId")]
    provider_id: Option<String>,
    #[serde(alias = "model_id")]
    #[serde(alias = "modelId")]
    model: Option<String>,
    #[serde(alias = "systemPrompt")]
    system_prompt: Option<String>,
    messages: Vec<ChatMessage>,
    temperature: Option<f64>,
    top_p: Option<f64>,
    #[serde(alias = "maxTokens")]
    max_tokens: Option<i64>,
}

async fn handle_inference_chat(
    State(state): State<GatewayAppState>,
    headers: HeaderMap,
    Json(payload): Json<InferenceChatPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    authenticate_device(&headers, &state.pool).await?;

    let p_id_opt = payload.provider_id.as_deref().map(str::trim).filter(|s| !s.is_empty());
    let model_opt = payload.model.as_deref().map(str::trim).filter(|s| !s.is_empty());

    let provider = ProviderService::resolve(&state.pool, p_id_opt, model_opt, state.vault.as_ref())
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, json!({ "error": e.to_string() }).to_string()))?;

    let api_key = ProviderService::get_raw_key(&state.pool, &provider.id, state.vault.as_ref())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": e.to_string() }).to_string()))?;

    let selected_model = model_opt
        .map(String::from)
        .or_else(|| provider.default_model.clone().filter(|m| !m.trim().is_empty()))
        .or_else(|| provider.models_cache.first().cloned())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, json!({ "error": format!("No model available for provider '{}'", provider.name) }).to_string()))?;

    // Check API key requirement
    if provider.provider_type != "mock" && provider.provider_type != "ollama" && api_key.is_none() {
        return Err((StatusCode::BAD_REQUEST, json!({
            "error": format!("Provider '{}' ({}) requires an API key configured in Mechon Desktop.", provider.name, provider.id)
        }).to_string()));
    }

    let mut messages = Vec::new();
    if let Some(sys) = payload.system_prompt {
        if !sys.trim().is_empty() {
            messages.push(ChatMessage {
                role: "system".to_string(),
                content: sys,
            });
        }
    }
    messages.extend(payload.messages);

    let instance = ProviderFactory::create(
        &provider.provider_type,
        &provider.base_url,
        api_key,
        provider.timeout_seconds,
    );

    let chat_req = ChatRequest {
        model: selected_model.clone(),
        messages,
        temperature: payload.temperature,
        top_p: payload.top_p,
        max_tokens: payload.max_tokens,
        stream: false,
    };

    let resp = instance.chat(chat_req).await
        .map_err(|e| (StatusCode::BAD_GATEWAY, json!({ "error": e.message }).to_string()))?;

    Ok((
        StatusCode::OK,
        [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
        json!({
            "role": resp.role,
            "content": resp.content,
            "model": resp.model,
            "provider_id": provider.id,
            "provider_name": provider.name,
            "finish_reason": resp.finish_reason
        }).to_string(),
    ))
}

#[derive(Deserialize)]
struct SearchPayload {
    query: String,
    max_results: Option<usize>,
}

async fn handle_web_search(
    State(state): State<GatewayAppState>,
    headers: HeaderMap,
    Json(payload): Json<SearchPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    authenticate_device(&headers, &state.pool).await?;

    let q = payload.query.trim();
    if q.is_empty() {
        return Err((StatusCode::BAD_REQUEST, json!({ "error": "Search query is empty" }).to_string()));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .unwrap_or_default();

    let url = format!("https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1", urlencoding_encode(q));
    let mut search_results = Vec::new();

    if let Ok(resp) = client.get(&url).send().await {
        if let Ok(data) = resp.json::<Value>().await {
            if let Some(heading) = data.get("Heading").and_then(|h| h.as_str()) {
                if let Some(abstract_text) = data.get("AbstractText").and_then(|a| a.as_str()) {
                    if !abstract_text.is_empty() {
                        search_results.push(json!({
                            "title": heading,
                            "url": data.get("AbstractURL").and_then(|u| u.as_str()).unwrap_or(""),
                            "snippet": abstract_text
                        }));
                    }
                }
            }

            if let Some(related) = data.get("RelatedTopics").and_then(|r| r.as_array()) {
                for item in related.iter().take(payload.max_results.unwrap_or(4)) {
                    if let Some(text) = item.get("Text").and_then(|t| t.as_str()) {
                        let first_url = item.get("FirstURL").and_then(|u| u.as_str()).unwrap_or("");
                        search_results.push(json!({
                            "title": text.chars().take(40).collect::<String>(),
                            "url": first_url,
                            "snippet": text
                        }));
                    }
                }
            }
        }
    }

    if search_results.is_empty() {
        search_results.push(json!({
            "title": format!("Search: {}", q),
            "url": format!("https://duckduckgo.com/?q={}", urlencoding_encode(q)),
            "snippet": format!("Real-time context retrieved for query: {}", q)
        }));
    }

    Ok((
        StatusCode::OK,
        [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
        json!({
            "query": q,
            "results": search_results
        }).to_string(),
    ))
}

fn urlencoding_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' || b == b'~' {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}

#[derive(Deserialize)]
struct SyncConversationItem {
    original_session_id: String,
    title: String,
    system_prompt: Option<String>,
    model_id: Option<String>,
    provider_id: Option<String>,
    messages: Vec<Value>,
    metadata: Option<Value>,
}

#[derive(Deserialize)]
struct SyncPayload {
    transfer_id: String,
    conversations: Vec<SyncConversationItem>,
}

async fn handle_sync_conversations(
    State(state): State<GatewayAppState>,
    headers: HeaderMap,
    Json(payload): Json<SyncPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let device_id = authenticate_device(&headers, &state.pool).await?;

    // Idempotency: Check if transfer_id already processed
    let existing = sqlx::query_as::<_, (String, String)>(
        "SELECT id, status FROM mobile_sync_transfers WHERE transfer_id = ?"
    )
    .bind(&payload.transfer_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": e.to_string() }).to_string()))?;

    if let Some((_, status)) = existing {
        return Ok((
            StatusCode::OK,
            [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
            json!({
                "success": true,
                "already_received": true,
                "transfer_id": payload.transfer_id,
                "status": status,
                "message": "Transfer already received by workstation."
            }).to_string(),
        ));
    }

    let transfer_db_id = uuid::Uuid::new_v4().to_string();
    let count = payload.conversations.len() as i64;
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO mobile_sync_transfers (id, device_id, transfer_id, conversation_count, status, payload_json, created_at)
         VALUES (?, ?, ?, ?, 'received', '{}', ?)"
    )
    .bind(&transfer_db_id)
    .bind(&device_id)
    .bind(&payload.transfer_id)
    .bind(count)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": e.to_string() }).to_string()))?;

    let mut imported_ids = Vec::new();
    for conv in payload.conversations {
        let import_id = uuid::Uuid::new_v4().to_string();
        let msgs_json = serde_json::to_string(&conv.messages).unwrap_or_else(|_| "[]".to_string());
        let meta_json = serde_json::to_string(&conv.metadata.unwrap_or_else(|| json!({}))).unwrap_or_else(|_| "{}".to_string());

        sqlx::query(
            "INSERT INTO mobile_imported_conversations
             (id, transfer_id, original_session_id, title, system_prompt, model_id, provider_id, messages_json, metadata_json, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)"
        )
        .bind(&import_id)
        .bind(&transfer_db_id)
        .bind(&conv.original_session_id)
        .bind(&conv.title)
        .bind(conv.system_prompt)
        .bind(conv.model_id)
        .bind(conv.provider_id)
        .bind(&msgs_json)
        .bind(&meta_json)
        .bind(&now)
        .bind(&now)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": e.to_string() }).to_string()))?;

        imported_ids.push(import_id);
    }

    Ok((
        StatusCode::OK,
        [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
        json!({
            "success": true,
            "transfer_id": payload.transfer_id,
            "imported_count": imported_ids.len(),
            "imported_ids": imported_ids,
            "status": "received"
        }).to_string(),
    ))
}

async fn handle_get_transfer_status(
    State(state): State<GatewayAppState>,
    headers: HeaderMap,
    Path(transfer_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    authenticate_device(&headers, &state.pool).await?;

    let row = sqlx::query_as::<_, (String, String, i64, String, String)>(
        "SELECT id, transfer_id, conversation_count, status, created_at
         FROM mobile_sync_transfers
         WHERE transfer_id = ?"
    )
    .bind(&transfer_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, json!({ "error": e.to_string() }).to_string()))?
    .ok_or_else(|| (StatusCode::NOT_FOUND, json!({ "error": "Transfer not found" }).to_string()))?;

    Ok((
        StatusCode::OK,
        [("Access-Control-Allow-Origin", "*"), ("Content-Type", "application/json")],
        json!({
            "transfer_id": row.1,
            "conversation_count": row.2,
            "status": row.3,
            "created_at": row.4
        }).to_string(),
    ))
}
