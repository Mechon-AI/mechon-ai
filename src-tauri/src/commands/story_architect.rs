use std::sync::Arc;
use sqlx::SqlitePool;
use tauri::{AppHandle, State};
use crate::credentials::CredentialStore;
use crate::errors::AppError;
use crate::story_architect::models::*;
use crate::story_architect::session_service::StorySessionService;
use crate::story_architect::planning_service::PlanningAgentService;
use crate::story_architect::narrative_state::NarrativeStateService;
use crate::story_architect::prompt_history::PromptHistoryService;

#[tauri::command]
pub async fn list_story_sessions(
    pool: State<'_, SqlitePool>,
    project_id: String,
) -> Result<Vec<StorySession>, AppError> {
    StorySessionService::list_sessions(&pool, &project_id).await
}

#[tauri::command]
pub async fn get_story_session(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<StorySession, AppError> {
    StorySessionService::get_session(&pool, &session_id).await
}

#[tauri::command]
pub async fn create_story_session(
    pool: State<'_, SqlitePool>,
    data: CreateStorySessionInput,
) -> Result<StorySession, AppError> {
    StorySessionService::create_session(&pool, data).await
}

#[tauri::command]
pub async fn update_story_session(
    pool: State<'_, SqlitePool>,
    data: UpdateStorySessionInput,
) -> Result<StorySession, AppError> {
    StorySessionService::update_session(&pool, data).await
}

#[tauri::command]
pub async fn delete_story_session(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<(), AppError> {
    StorySessionService::delete_session(&pool, &session_id).await
}

#[tauri::command]
pub async fn get_planning_spec(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<PlanningSpecification, AppError> {
    StorySessionService::get_planning_spec(&pool, &session_id).await
}

#[tauri::command]
pub async fn save_planning_spec(
    pool: State<'_, SqlitePool>,
    data: SavePlanningSpecInput,
) -> Result<PlanningSpecification, AppError> {
    StorySessionService::save_planning_spec(&pool, data).await
}

#[tauri::command]
pub async fn list_milestones(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<Vec<PlanningMilestone>, AppError> {
    StorySessionService::list_milestones(&pool, &session_id).await
}

#[tauri::command]
pub async fn save_milestones(
    pool: State<'_, SqlitePool>,
    session_id: String,
    milestones: Vec<SaveMilestoneInput>,
) -> Result<Vec<PlanningMilestone>, AppError> {
    StorySessionService::save_milestones(&pool, &session_id, milestones).await
}

#[tauri::command]
pub async fn list_story_messages(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<Vec<StoryMessage>, AppError> {
    StorySessionService::list_messages(&pool, &session_id).await
}

#[tauri::command]
pub async fn generate_next_prompt(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    session_id: String,
    feedback: Option<String>,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<PlanningPromptHistory, AppError> {
    PlanningAgentService::generate_next_prompt(
        &pool,
        vault.inner().as_ref(),
        &session_id,
        feedback.as_deref(),
        provider_id.as_deref(),
        model.as_deref(),
    ).await
}

#[tauri::command]
pub async fn approve_and_execute_turn(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    session_id: String,
    prompt_content: String,
    prompt_history_id: Option<String>,
    engineer_edited: Option<bool>,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<AutoStepResult, AppError> {
    StorySessionService::approve_and_execute_step(
        Some(&app),
        &pool,
        vault.inner().as_ref(),
        &session_id,
        &prompt_content,
        prompt_history_id.as_deref(),
        engineer_edited.unwrap_or(false),
        provider_id.as_deref(),
        model.as_deref(),
    ).await
}

#[tauri::command]
pub async fn execute_autonomous_step(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    session_id: String,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<AutoStepResult, AppError> {
    StorySessionService::execute_autonomous_step(
        Some(&app),
        &pool,
        vault.inner().as_ref(),
        &session_id,
        provider_id.as_deref(),
        model.as_deref(),
    ).await
}

#[tauri::command]
pub async fn pause_story_session(
    pool: State<'_, SqlitePool>,
    session_id: String,
    reason: Option<String>,
) -> Result<(), AppError> {
    StorySessionService::pause_session(&pool, &session_id, reason.as_deref().unwrap_or("Manual engineer pause")).await
}

#[tauri::command]
pub async fn resume_story_session(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<(), AppError> {
    StorySessionService::resume_session(&pool, &session_id).await
}

#[tauri::command]
pub async fn list_prompt_history(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<Vec<PlanningPromptHistory>, AppError> {
    PromptHistoryService::list_for_session(&pool, &session_id).await
}

#[tauri::command]
pub async fn get_narrative_state(
    pool: State<'_, SqlitePool>,
    session_id: String,
) -> Result<Option<NarrativeState>, AppError> {
    NarrativeStateService::get_latest(&pool, &session_id).await
}

#[tauri::command]
pub async fn commit_story_to_sft(
    pool: State<'_, SqlitePool>,
    data: CommitToSFTInput,
) -> Result<CommitToSFTResult, AppError> {
    StorySessionService::commit_to_sft(&pool, data).await
}

#[tauri::command]
pub async fn edit_story_message(
    pool: State<'_, SqlitePool>,
    data: EditStoryMessageInput,
) -> Result<StoryMessage, AppError> {
    StorySessionService::edit_message(&pool, data).await
}

#[tauri::command]
pub async fn list_message_revisions(
    pool: State<'_, SqlitePool>,
    message_id: String,
) -> Result<Vec<StoryMessageRevision>, AppError> {
    StorySessionService::list_message_revisions(&pool, &message_id).await
}

#[tauri::command]
pub async fn restore_message_revision(
    pool: State<'_, SqlitePool>,
    data: RestoreRevisionInput,
) -> Result<StoryMessage, AppError> {
    StorySessionService::restore_message_revision(&pool, data).await
}

#[tauri::command]
pub async fn regenerate_story_turn(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    data: RegenerateAssistantTurnInput,
) -> Result<ExecutionTurnResult, AppError> {
    StorySessionService::regenerate_assistant_turn(Some(&app), &pool, vault.inner().as_ref(), data).await
}
