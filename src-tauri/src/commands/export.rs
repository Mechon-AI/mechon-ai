use tauri::State;
use sqlx::SqlitePool;
use crate::errors::AppError;
use crate::services::export_service::ExportService;

#[tauri::command]
pub async fn export_sft_dataset(
    pool: State<'_, SqlitePool>,
    project_id: String,
    format_type: Option<String>,
    include_metadata: Option<bool>,
) -> Result<String, AppError> {
    ExportService::export_sft(
        &pool,
        &project_id,
        format_type.as_deref().unwrap_or("jsonl"),
        include_metadata.unwrap_or(true),
    ).await
}

#[tauri::command]
pub async fn export_dpo_dataset(
    pool: State<'_, SqlitePool>,
    project_id: String,
    format_type: Option<String>,
    include_metadata: Option<bool>,
    only_completed: Option<bool>,
) -> Result<String, AppError> {
    ExportService::export_dpo(
        &pool,
        &project_id,
        format_type.as_deref().unwrap_or("jsonl"),
        include_metadata.unwrap_or(true),
        only_completed.unwrap_or(true),
    ).await
}

#[tauri::command]
pub async fn import_dataset_file(
    pool: State<'_, SqlitePool>,
    project_id: String,
    content: String,
) -> Result<serde_json::Value, AppError> {
    ExportService::import_content(&pool, &project_id, &content).await
}
