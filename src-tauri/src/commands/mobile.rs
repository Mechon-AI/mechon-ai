use std::sync::Arc;
use sqlx::SqlitePool;
use tauri::State;

use crate::credentials::CredentialStore;
use crate::errors::AppError;
use crate::models::{MobileGatewayStatus, MobileImportedConversation, PairedDevice};
use crate::services::mobile_gateway_service::MobileGatewayService;

#[tauri::command]
pub async fn get_mobile_gateway_status(
    pool: State<'_, SqlitePool>,
) -> Result<MobileGatewayStatus, AppError> {
    MobileGatewayService::get_status(&pool).await
}

#[tauri::command]
pub async fn start_mobile_gateway(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    port: Option<u16>,
) -> Result<MobileGatewayStatus, AppError> {
    MobileGatewayService::start_gateway(
        pool.inner().clone(),
        vault.inner().clone(),
        port,
    )
    .await
}

#[tauri::command]
pub async fn stop_mobile_gateway(
    pool: State<'_, SqlitePool>,
) -> Result<MobileGatewayStatus, AppError> {
    MobileGatewayService::stop_gateway(&pool).await
}

#[tauri::command]
pub async fn generate_pairing_code() -> Result<serde_json::Value, AppError> {
    let (code, uri) = MobileGatewayService::generate_pairing_code().await?;
    Ok(serde_json::json!({
        "code": code,
        "uri": uri
    }))
}

#[tauri::command]
pub async fn list_paired_devices(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<PairedDevice>, AppError> {
    MobileGatewayService::list_paired_devices(&pool).await
}

#[tauri::command]
pub async fn approve_paired_device(
    pool: State<'_, SqlitePool>,
    device_id: String,
) -> Result<(), AppError> {
    MobileGatewayService::approve_paired_device(&pool, &device_id).await
}

#[tauri::command]
pub async fn revoke_paired_device(
    pool: State<'_, SqlitePool>,
    device_id: String,
) -> Result<(), AppError> {
    MobileGatewayService::revoke_paired_device(&pool, &device_id).await
}

#[tauri::command]
pub async fn list_mobile_imports(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<MobileImportedConversation>, AppError> {
    MobileGatewayService::list_mobile_imports(&pool).await
}

#[tauri::command]
pub async fn convert_mobile_import_to_sft_draft(
    pool: State<'_, SqlitePool>,
    import_id: String,
    target_project_id: Option<String>,
) -> Result<String, AppError> {
    MobileGatewayService::convert_mobile_import_to_sft_draft(&pool, &import_id, target_project_id).await
}

#[tauri::command]
pub async fn commit_mobile_import_to_corpus(
    pool: State<'_, SqlitePool>,
    import_id: String,
    target_project_id: Option<String>,
) -> Result<String, AppError> {
    MobileGatewayService::commit_mobile_import_to_corpus(&pool, &import_id, target_project_id).await
}

#[tauri::command]
pub async fn delete_mobile_import(
    pool: State<'_, SqlitePool>,
    import_id: String,
) -> Result<(), AppError> {
    MobileGatewayService::delete_mobile_import(&pool, &import_id).await
}
