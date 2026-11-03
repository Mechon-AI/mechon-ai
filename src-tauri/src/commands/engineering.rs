use sqlx::SqlitePool;
use tauri::State;

use crate::engineering::template_engine::{ModelTemplateDef, TemplateCompatibilitySummary};
use crate::engineering::sequence_analytics::SequenceAnalyticsReport;
use crate::engineering::deduplication::DeduplicationReport;
use crate::engineering::persona_audit::PersonaAuditReport;
use crate::engineering::split_engine::SplitSummary;
use crate::engineering::readiness_engine::TrainingReadinessReport;
use crate::services::engineering_service::EngineeringService;
use crate::errors::AppError;

#[tauri::command]
pub async fn get_supported_template_models() -> Result<Vec<ModelTemplateDef>, AppError> {
    Ok(EngineeringService::get_supported_template_models())
}

#[tauri::command]
pub async fn validate_chat_templates(
    pool: State<'_, SqlitePool>,
    project_id: String,
    model_id: String,
    add_generation_prompt: Option<bool>,
) -> Result<TemplateCompatibilitySummary, AppError> {
    EngineeringService::validate_chat_templates(
        &pool,
        &project_id,
        &model_id,
        add_generation_prompt.unwrap_or(false),
    )
    .await
}

#[tauri::command]
pub async fn run_sequence_analytics(
    pool: State<'_, SqlitePool>,
    project_id: String,
    model_family: String,
    max_seq_len: Option<usize>,
    truncation_strategy: Option<String>,
    include_special_tokens: Option<bool>,
) -> Result<SequenceAnalyticsReport, AppError> {
    EngineeringService::run_sequence_analytics(
        &pool,
        &project_id,
        &model_family,
        max_seq_len.unwrap_or(4096),
        &truncation_strategy.unwrap_or_else(|| "tail".to_string()),
        include_special_tokens.unwrap_or(true),
    )
    .await
}

#[tauri::command]
pub async fn run_deduplication(
    pool: State<'_, SqlitePool>,
    project_id: String,
    near_threshold: Option<f64>,
) -> Result<DeduplicationReport, AppError> {
    EngineeringService::run_deduplication(
        &pool,
        &project_id,
        near_threshold.unwrap_or(0.85),
    )
    .await
}

#[tauri::command]
pub async fn save_duplicate_decision(
    pool: State<'_, SqlitePool>,
    project_id: String,
    group_id: String,
    record_id: String,
    decision: String,
    note: Option<String>,
) -> Result<(), AppError> {
    EngineeringService::save_duplicate_decision(
        &pool,
        &project_id,
        &group_id,
        &record_id,
        &decision,
        note.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn run_persona_audit(
    pool: State<'_, SqlitePool>,
    project_id: String,
    policy: Option<String>,
) -> Result<PersonaAuditReport, AppError> {
    EngineeringService::run_persona_audit(
        &pool,
        &project_id,
        &policy.unwrap_or_else(|| "multiple_intentional_personas".to_string()),
    )
    .await
}

#[tauri::command]
pub async fn create_dataset_split(
    pool: State<'_, SqlitePool>,
    project_id: String,
    name: String,
    seed: Option<u64>,
    train_pct: Option<f64>,
    val_pct: Option<f64>,
    eval_pct: Option<f64>,
) -> Result<SplitSummary, AppError> {
    EngineeringService::create_dataset_split(
        &pool,
        &project_id,
        &name,
        seed.unwrap_or(42),
        train_pct.unwrap_or(0.80),
        val_pct.unwrap_or(0.10),
        eval_pct.unwrap_or(0.10),
    )
    .await
}

#[tauri::command]
pub async fn list_dataset_splits(
    pool: State<'_, SqlitePool>,
    project_id: String,
) -> Result<Vec<SplitSummary>, AppError> {
    EngineeringService::list_dataset_splits(&pool, &project_id).await
}

#[tauri::command]
pub async fn generate_training_readiness_report(
    pool: State<'_, SqlitePool>,
    project_id: String,
    title: String,
    model_family: Option<String>,
    max_seq_len: Option<usize>,
) -> Result<TrainingReadinessReport, AppError> {
    EngineeringService::generate_training_readiness_report(
        &pool,
        &project_id,
        &title,
        &model_family.unwrap_or_else(|| "llama".to_string()),
        max_seq_len.unwrap_or(4096),
    )
    .await
}

#[tauri::command]
pub async fn list_readiness_reports(
    pool: State<'_, SqlitePool>,
    project_id: String,
) -> Result<Vec<TrainingReadinessReport>, AppError> {
    EngineeringService::list_readiness_reports(&pool, &project_id).await
}

#[tauri::command]
pub async fn export_conversational_dpo(
    pool: State<'_, SqlitePool>,
    project_id: String,
    format_type: Option<String>,
    only_completed: Option<bool>,
) -> Result<String, AppError> {
    EngineeringService::export_conversational_dpo(
        &pool,
        &project_id,
        &format_type.unwrap_or_else(|| "jsonl".to_string()),
        only_completed.unwrap_or(true),
    )
    .await
}
