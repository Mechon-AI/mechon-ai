use tauri::State;
use sqlx::SqlitePool;
use crate::errors::AppError;
use crate::models::{DatasetVersion, SnapshotCreateInput};
use crate::services::version_service::VersionService;

#[tauri::command]
pub async fn get_versions(
    pool: State<'_, SqlitePool>,
    project_id: String,
    dataset_type: Option<String>,
) -> Result<Vec<DatasetVersion>, AppError> {
    VersionService::list(&pool, &project_id, dataset_type.as_deref()).await
}

#[tauri::command]
pub async fn create_snapshot(
    pool: State<'_, SqlitePool>,
    data: SnapshotCreateInput,
) -> Result<DatasetVersion, AppError> {
    VersionService::create_snapshot(&pool, data).await
}

#[tauri::command]
pub async fn restore_snapshot(
    pool: State<'_, SqlitePool>,
    version_id: String,
) -> Result<(), AppError> {
    VersionService::restore_snapshot(&pool, &version_id).await
}

#[tauri::command]
pub async fn compare_snapshots(
    pool: State<'_, SqlitePool>,
    version_a: String,
    version_b: String,
) -> Result<serde_json::Value, AppError> {
    VersionService::compare_snapshots(&pool, &version_a, &version_b).await
}
