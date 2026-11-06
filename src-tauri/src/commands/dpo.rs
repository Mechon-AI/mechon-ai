use tauri::{AppHandle, State};
use sqlx::SqlitePool;
use serde_json::json;
use crate::errors::AppError;
use crate::events::emit_dataset_change;
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
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    data: DPOTaskCreateInput,
) -> Result<DPOTask, AppError> {
    let task = DPOService::create(&pool, data).await?;
    emit_dataset_change(&app, "dpo", "commit", Some(&task.project_id), Some(&task.id));
    Ok(task)
}

#[tauri::command]
pub async fn annotate_dpo_task(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    task_id: String,
    data: DPOAnnotationInput,
) -> Result<DPOTask, AppError> {
    let task = DPOService::annotate(&pool, &task_id, data).await?;
    emit_dataset_change(&app, "dpo", "update", Some(&task.project_id), Some(&task.id));
    Ok(task)
}

#[tauri::command]
pub async fn undo_last_dpo_annotation(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    project_id: String,
) -> Result<Option<DPOTask>, AppError> {
    let task_opt = DPOService::undo_last_annotation(&pool, &project_id).await?;
    if let Some(ref task) = task_opt {
        emit_dataset_change(&app, "dpo", "update", Some(&task.project_id), Some(&task.id));
    }
    Ok(task_opt)
}

#[tauri::command]
pub async fn update_dpo_task(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    task_id: String,
    data: DPOTaskUpdateInput,
) -> Result<DPOTask, AppError> {
    let task = DPOService::update(&pool, &task_id, data).await?;
    emit_dataset_change(&app, "dpo", "update", Some(&task.project_id), Some(&task.id));
    Ok(task)
}

#[tauri::command]
pub async fn delete_dpo_task(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    task_id: String,
) -> Result<(), AppError> {
    let task_opt = DPOService::get(&pool, &task_id).await.ok();
    let project_id = task_opt.as_ref().map(|t| t.project_id.clone());
    DPOService::delete(&pool, &task_id).await?;
    emit_dataset_change(&app, "dpo", "delete", project_id.as_deref(), Some(&task_id));
    Ok(())
}

#[tauri::command]
pub async fn duplicate_dpo_task(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    task_id: String,
) -> Result<DPOTask, AppError> {
    let task = DPOService::duplicate(&pool, &task_id).await?;
    emit_dataset_change(&app, "dpo", "duplicate", Some(&task.project_id), Some(&task.id));
    Ok(task)
}
