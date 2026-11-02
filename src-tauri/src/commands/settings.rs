use std::collections::HashMap;
use std::process::Command;
use tauri::State;
use sqlx::SqlitePool;
use serde_json::json;
use crate::errors::AppError;
use crate::services::settings_service::SettingsService;

#[tauri::command]
pub async fn get_settings(
    pool: State<'_, SqlitePool>,
) -> Result<HashMap<String, String>, AppError> {
    SettingsService::get_all(&pool).await
}

#[tauri::command]
pub async fn update_settings(
    pool: State<'_, SqlitePool>,
    data: HashMap<String, String>,
) -> Result<(), AppError> {
    SettingsService::update_batch(&pool, data).await
}

#[tauri::command]
pub async fn check_database_integrity(
    pool: State<'_, SqlitePool>,
) -> Result<serde_json::Value, AppError> {
    SettingsService::check_integrity(&pool).await
}

#[tauri::command]
pub async fn create_database_backup(
    pool: State<'_, SqlitePool>,
) -> Result<serde_json::Value, AppError> {
    SettingsService::create_backup(&pool).await
}

#[tauri::command]
pub async fn restore_database_backup(
    pool: State<'_, SqlitePool>,
) -> Result<serde_json::Value, AppError> {
    SettingsService::restore_backup(&pool).await
}

#[tauri::command]
pub fn open_data_folder() -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let xdg_data = std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| format!("{home}/.local/share"));
    let target = format!("{xdg_data}/mechon-ai");
    let _ = std::fs::create_dir_all(&target);
    Command::new("xdg-open").arg(&target).spawn()
        .map_err(|e| format!("Could not open the data folder: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_backend_status() -> serde_json::Value {
    json!({
        "healthy": true,
        "is_embedded_rust": true,
        "port": 0,
        "startup_error": null
    })
}
