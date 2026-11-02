use tauri::State;
use sqlx::SqlitePool;
use crate::errors::AppError;
use crate::models::ValidationReport;
use crate::services::validation_service::ValidationService;

#[tauri::command]
pub async fn validate_dataset(
    pool: State<'_, SqlitePool>,
    project_id: String,
    dataset_type: String,
) -> Result<ValidationReport, AppError> {
    ValidationService::validate_dataset(&pool, &project_id, &dataset_type).await
}
