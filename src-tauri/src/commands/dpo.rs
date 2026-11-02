use tauri::State;
use sqlx::SqlitePool;
use serde_json::json;
use crate::errors::AppError;
use crate::models::{
    DPOAnnotationInput, DPOTask, DPOTaskCreateInput, DPOTaskUpdateInput,
};
use crate::services::dpo_service::DPOService;

#[tauri::command]
pub async fn get_dpo_tasks(
    pool: State<'_, SqlitePool>,
    project_id: String,
    status: Option<String>,
    search: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<serde_json::Value, AppError> {
    let lim = limit.unwrap_or(50);
    let off = offset.unwrap_or(0);
    let (tasks, total) = DPOService::list(&pool, &project_id, status.as_deref(), search.as_deref(), lim, off).await?;
    Ok(json!({
        "tasks": tasks,
        "total": total
    }))
}

#[tauri::command]
pub async fn get_dpo_task(
    pool: State<'_, SqlitePool>,
    task_id: String,
) -> Result<DPOTask, AppError> {
    DPOService::get(&pool, &task_id).await
}

#[tauri::command]
pub async fn create_dpo_task(
    pool: State<'_, SqlitePool>,
    data: DPOTaskCreateInput,
) -> Result<DPOTask, AppError> {
    DPOService::create(&pool, data).await
}

#[tauri::command]
pub async fn annotate_dpo_task(
    pool: State<'_, SqlitePool>,
    task_id: String,
    data: DPOAnnotationInput,
) -> Result<DPOTask, AppError> {
    DPOService::annotate(&pool, &task_id, data).await
}

#[tauri::command]
pub async fn undo_last_dpo_annotation(
    pool: State<'_, SqlitePool>,
    project_id: String,
) -> Result<Option<DPOTask>, AppError> {
    DPOService::undo_last_annotation(&pool, &project_id).await
}

#[tauri::command]
pub async fn update_dpo_task(
    pool: State<'_, SqlitePool>,
    task_id: String,
    data: DPOTaskUpdateInput,
) -> Result<DPOTask, AppError> {
    DPOService::update(&pool, &task_id, data).await
}

#[tauri::command]
pub async fn delete_dpo_task(
    pool: State<'_, SqlitePool>,
    task_id: String,
) -> Result<(), AppError> {
    DPOService::delete(&pool, &task_id).await
}

#[tauri::command]
pub async fn duplicate_dpo_task(
    pool: State<'_, SqlitePool>,
    task_id: String,
) -> Result<DPOTask, AppError> {
    DPOService::duplicate(&pool, &task_id).await
}
