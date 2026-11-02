use tauri::State;
use sqlx::SqlitePool;
use crate::errors::AppError;
use crate::models::AnalyticsResponse;
use crate::services::analytics_service::AnalyticsService;

#[tauri::command]
pub async fn get_dashboard_analytics(
    pool: State<'_, SqlitePool>,
    project_id: Option<String>,
) -> Result<AnalyticsResponse, AppError> {
    AnalyticsService::get_dashboard_analytics(&pool, project_id.as_deref()).await
}
