use tauri::State;
use sqlx::SqlitePool;
use serde_json::json;
use crate::errors::AppError;
use crate::models::{
    SFTCommitInput, SFTMessage, SFTMessageCreateInput, SFTRecord, SFTRecordUpdateInput,
    SFTSession, SFTSessionCreateInput, SFTSessionUpdateInput,
};
use crate::services::sft_service::SFTService;
use crate::services::dataset_service::DatasetService;

#[tauri::command]
pub async fn get_sft_sessions(
    pool: State<'_, SqlitePool>,
    project_id: String,
    status: Option<String>,
) -> Result<Vec<SFTSession>, AppError> {
    SFTService::list_sessions(&pool, &project_id, status.as_deref()).await
}

#[tauri::command]
pub async fn get_sft_session(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<SFTSession, AppError> {
    SFTService::get_session(&pool, &session_id).await
}

#[tauri::command]
pub async fn create_sft_session(
    pool: State<'_, SqlitePool>,
    data: SFTSessionCreateInput,
) -> Result<SFTSession, AppError> {
    SFTService::create_session(&pool, data).await
}

#[tauri::command]
pub async fn update_sft_session(
    pool: State<'_, SqlitePool>,
    session_id: String,
    data: SFTSessionUpdateInput,
) -> Result<SFTSession, AppError> {
    SFTService::update_session(&pool, &session_id, data).await
}

#[tauri::command]
pub async fn delete_sft_session(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<(), AppError> {
    SFTService::delete_session(&pool, &session_id).await
}

#[tauri::command]
pub async fn duplicate_sft_session(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<SFTSession, AppError> {
    SFTService::duplicate_session(&pool, &session_id).await
}

#[tauri::command]
pub async fn add_sft_message(
    pool: State<'_, SqlitePool>,
    session_id: String,
    data: SFTMessageCreateInput,
) -> Result<SFTMessage, AppError> {
    SFTService::add_message(&pool, &session_id, data).await
}

#[tauri::command]
pub async fn update_sft_message(
    pool: State<'_, SqlitePool>,
    message_id: String,
    content: String,
) -> Result<(), AppError> {
    SFTService::update_message(&pool, &message_id, &content).await
}

#[tauri::command]
pub async fn delete_sft_message(
    pool: State<'_, SqlitePool>,
    message_id: String,
) -> Result<(), AppError> {
    SFTService::delete_message(&pool, &message_id).await
}

#[tauri::command]
pub async fn truncate_sft_downstream(
    pool: State<'_, SqlitePool>,
    session_id: String,
    from_sequence: i64,
) -> Result<(), AppError> {
    SFTService::truncate_downstream(&pool, &session_id, from_sequence).await
}

#[tauri::command]
pub async fn commit_sft_session(
    pool: State<'_, SqlitePool>,
    session_id: String,
    data: SFTCommitInput,
) -> Result<SFTRecord, AppError> {
    SFTService::commit_session(&pool, &session_id, data).await
}

#[tauri::command]
pub async fn get_sft_records(
    pool: State<'_, SqlitePool>,
    project_id: String,
    search: Option<String>,
    tag: Option<String>,
    language_mode: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<serde_json::Value, AppError> {
    let lim = limit.unwrap_or(50);
    let off = offset.unwrap_or(0);
    let (records, total) = DatasetService::list_sft_records_with_filter(
        &pool,
        &project_id,
        search.as_deref(),
        tag.as_deref(),
        language_mode.as_deref(),
        lim,
        off,
    ).await?;
    Ok(json!({
        "records": records,
        "total": total
    }))
}

#[tauri::command]
pub async fn get_sft_record(
    pool: State<'_, SqlitePool>,
    record_id: String,
) -> Result<SFTRecord, AppError> {
    DatasetService::get_sft_record(&pool, &record_id).await
}

#[tauri::command]
pub async fn update_sft_record(
    pool: State<'_, SqlitePool>,
    record_id: String,
    data: SFTRecordUpdateInput,
) -> Result<SFTRecord, AppError> {
    DatasetService::update_sft_record(&pool, &record_id, data).await
}

#[tauri::command]
pub async fn delete_sft_record(
    pool: State<'_, SqlitePool>,
    record_id: String,
) -> Result<(), AppError> {
    DatasetService::delete_sft_record(&pool, &record_id).await
}

#[tauri::command]
pub async fn duplicate_sft_record(
    pool: State<'_, SqlitePool>,
    record_id: String,
) -> Result<SFTRecord, AppError> {
    DatasetService::duplicate_sft_record(&pool, &record_id).await
}

#[tauri::command]
pub async fn get_corpus_languages(
    pool: State<'_, SqlitePool>,
    project_id: String,
) -> Result<serde_json::Value, AppError> {
    DatasetService::get_corpus_languages(&pool, &project_id).await
}
