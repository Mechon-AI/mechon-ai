use tauri::State;
use sqlx::SqlitePool;
use crate::errors::AppError;
use crate::models::{Project, ProjectCreateInput, ProjectUpdateInput};
use crate::services::project_service::ProjectService;

#[tauri::command]
pub async fn get_projects(
    pool: State<'_, SqlitePool>,
    include_archived: Option<bool>,
) -> Result<Vec<Project>, AppError> {
    ProjectService::list(&pool, include_archived.unwrap_or(false)).await
}

#[tauri::command]
pub async fn get_project(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Project, AppError> {
    ProjectService::get(&pool, &id).await
}

#[tauri::command]
pub async fn create_project(
    pool: State<'_, SqlitePool>,
    data: ProjectCreateInput,
) -> Result<Project, AppError> {
    ProjectService::create(&pool, data).await
}

#[tauri::command]
pub async fn update_project(
    pool: State<'_, SqlitePool>,
    id: String,
    data: ProjectUpdateInput,
) -> Result<Project, AppError> {
    ProjectService::update(&pool, &id, data).await
}

#[tauri::command]
pub async fn delete_project(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), AppError> {
    ProjectService::delete(&pool, &id).await
}

#[tauri::command]
pub async fn duplicate_project(
    pool: State<'_, SqlitePool>,
    id: String,
    name: Option<String>,
) -> Result<Project, AppError> {
    ProjectService::duplicate(&pool, &id, name).await
}
