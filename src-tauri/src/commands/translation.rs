use std::sync::Arc;
use tauri::State;
use sqlx::SqlitePool;
use crate::credentials::CredentialStore;
use crate::errors::AppError;
use crate::models::{SFTMessage, SFTSession};
use crate::services::translation_service::TranslationService;

#[derive(serde::Deserialize)]
pub struct TranslateSessionInput {
    pub session_id: String,
    pub target_language: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct TranslateMessageInput {
    pub session_id: String,
    pub message_id: String,
    pub target_language: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct UpdateMessageTranslationInput {
    pub message_id: String,
    pub target_language: String,
    pub content: String,
    pub status: String,
}

#[derive(serde::Deserialize)]
pub struct BatchUpdateStatusInput {
    pub session_id: String,
    pub target_language: String,
    pub status: String,
}

#[tauri::command]
pub async fn translate_sft_session(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    data: TranslateSessionInput,
) -> Result<SFTSession, AppError> {
    TranslationService::translate_session(
        &pool,
        vault.inner().as_ref(),
        &data.session_id,
        &data.target_language,
        data.provider_id.as_deref(),
        data.model.as_deref(),
    ).await
}

#[tauri::command]
pub async fn translate_sft_message(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    data: TranslateMessageInput,
) -> Result<SFTMessage, AppError> {
    TranslationService::translate_single_message(
        &pool,
        vault.inner().as_ref(),
        &data.session_id,
        &data.message_id,
        &data.target_language,
        data.provider_id.as_deref(),
        data.model.as_deref(),
    ).await
}

#[tauri::command]
pub async fn update_sft_message_translation(
    pool: State<'_, SqlitePool>,
    data: UpdateMessageTranslationInput,
) -> Result<(), AppError> {
    TranslationService::update_message_translation(
        &pool,
        &data.message_id,
        &data.target_language,
        &data.content,
        &data.status,
    ).await
}

#[tauri::command]
pub async fn batch_update_translation_status(
    pool: State<'_, SqlitePool>,
    data: BatchUpdateStatusInput,
) -> Result<SFTSession, AppError> {
    TranslationService::batch_update_translation_status(
        &pool,
        &data.session_id,
        &data.target_language,
        &data.status,
    ).await
}

#[tauri::command]
pub async fn get_supported_languages() -> Result<Vec<crate::languages::LanguageInfo>, AppError> {
    Ok(crate::languages::LanguageRegistry::all_languages())
}

#[tauri::command]
pub async fn lookup_language_info(code: String) -> Result<crate::languages::LanguageInfo, AppError> {
    Ok(crate::languages::LanguageRegistry::lookup(&code))
}
