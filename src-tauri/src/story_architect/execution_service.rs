use sqlx::{SqlitePool, Row};
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;
use chrono::Utc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use crate::credentials::CredentialStore;
use crate::errors::AppError;
use crate::providers::factory::ProviderFactory;
use crate::providers::models::{ChatMessage, ChatRequest};
use crate::services::provider_service::ProviderService;
use super::models::{StoryMessage, ExecutionTurnResult};
use super::prompt_history::PromptHistoryService;
use super::evaluation_service::EvaluationAgentService;
use super::narrative_state::NarrativeStateService;

pub struct ExecutionService;

impl ExecutionService {
    pub async fn execute_turn(
        app: Option<&AppHandle>,
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        approved_prompt: &str,
        prompt_history_id: Option<&str>,
        engineer_edited: bool,
        override_provider_id: Option<&str>,
        override_model: Option<&str>,
    ) -> Result<ExecutionTurnResult, AppError> {
        let start_time = Instant::now();

        // 1. Fetch Session
        let session = sqlx::query(
            r#"
            SELECT 
                project_id, title, interaction_type, primary_language,
                inference_provider_id, inference_model,
                temperature, top_p, max_tokens, tokens_used
            FROM story_architect_sessions
            WHERE id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Story session '{}' not found", session_id)))?;

        let inference_provider_id: Option<String> = session.get("inference_provider_id");
        let inference_model: Option<String> = session.get("inference_model");
        let temperature: Option<f64> = session.get("temperature");
        let top_p: Option<f64> = session.get("top_p");
        let max_tokens: Option<i64> = session.get("max_tokens");

        // Authoritative Provider & Model Resolution:
        // Precedence: Explicit Request Override > Session Stored Provider > Fallback to "mock"
        let provider_id = override_provider_id
            .filter(|p| !p.trim().is_empty())
            .or_else(|| inference_provider_id.as_deref())
            .unwrap_or("mock");

        let requested_model = override_model
            .filter(|m| !m.trim().is_empty())
            .or_else(|| inference_model.as_deref());

        // Update session's stored provider if override provided
        if let Some(p) = override_provider_id.filter(|s| !s.trim().is_empty()) {
            let _ = sqlx::query("UPDATE story_architect_sessions SET inference_provider_id = ?, inference_model = COALESCE(?, inference_model), updated_at = ? WHERE id = ?")
                .bind(p)
                .bind(requested_model)
                .bind(Utc::now().to_rfc3339())
                .bind(session_id)
                .execute(pool)
                .await;
        }

        // 2. Fetch Planning Spec
        let spec_row = sqlx::query(
            r#"
            SELECT 
                premise, world_environment, character_profiles_json,
                expected_assistant_behavior, constraints_forbidden_developments
            FROM planning_specifications
            WHERE session_id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?;

        // 3. Fetch Active Milestone
        let active_milestone = sqlx::query(
            r#"
            SELECT id, title, objective
            FROM planning_milestones
            WHERE session_id = ? AND status IN ('active', 'pending')
            ORDER BY order_index ASC
            LIMIT 1
            "#,
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?;

        let active_milestone_id: Option<String> = active_milestone.as_ref().map(|m| m.get("id"));
        let active_milestone_title: Option<String> = active_milestone.as_ref().map(|m| m.get("title"));

        // 4. Determine current turn indices
        let current_msg_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM story_architect_messages WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_one(pool)
        .await?;

        let user_turn_index = current_msg_count.0 as usize;
        let assistant_turn_index = user_turn_index + 1;

        // 5. Update prompt history status
        if let Some(ph_id) = prompt_history_id {
            let status = if engineer_edited { "edited" } else { "approved" };
            let _ = PromptHistoryService::update_status(pool, ph_id, status, Some(approved_prompt), None).await;
        }

        // 6. Save User Message
        let user_msg_id = format!("sm-{}", Uuid::new_v4());
        let now_user = Utc::now().to_rfc3339();
        let user_token_est = (approved_prompt.len() / 4).max(1);

        sqlx::query(
            r#"
            INSERT INTO story_architect_messages (
                id, session_id, turn_index, role, content, prompt_history_id,
                milestone_id, provider_id, model, token_count, latency_ms,
                translations_json, created_at
            ) VALUES (?, ?, ?, 'user', ?, ?, ?, NULL, NULL, ?, 0, '{}', ?)
            "#,
        )
        .bind(&user_msg_id)
        .bind(session_id)
        .bind(user_turn_index as i64)
        .bind(approved_prompt)
        .bind(prompt_history_id)
        .bind(&active_milestone_id)
        .bind(user_token_est as i64)
        .bind(&now_user)
        .execute(pool)
        .await?;

        let user_message = StoryMessage {
            id: user_msg_id,
            session_id: session_id.to_string(),
            turn_index: user_turn_index,
            role: "user".to_string(),
            content: approved_prompt.to_string(),
            prompt_history_id: prompt_history_id.map(String::from),
            milestone_id: active_milestone_id.clone(),
            provider_id: None,
            model: None,
            token_count: user_token_est,
            latency_ms: 0,
            translations: serde_json::json!({}),
            is_outdated: false,
            revision_count: 0,
            updated_at: None,
            created_at: now_user,
        };

        // 7. Prepare Assistant Context & System Prompt
        let mut system_prompt = String::new();
        if let Some(spec) = spec_row {
            let expected_behavior: Option<String> = spec.get("expected_assistant_behavior");
            let premise: String = spec.get("premise");
            let world_environment: Option<String> = spec.get("world_environment");
            let constraints: Option<String> = spec.get("constraints_forbidden_developments");

            if let Some(beh) = expected_behavior {
                if !beh.is_empty() {
                    system_prompt.push_str(&beh);
                    system_prompt.push_str("\n\n");
                }
            }
            if !premise.is_empty() {
                system_prompt.push_str(&format!("Narrative Setting / Premise: {}\n", premise));
            }
            if let Some(world) = world_environment {
                if !world.is_empty() {
                    system_prompt.push_str(&format!("World Context: {}\n", world));
                }
            }
            if let Some(c) = constraints {
                if !c.is_empty() {
                    system_prompt.push_str(&format!("Strict Constraints: {}\n", c));
                }
            }
        }

        if system_prompt.is_empty() {
            system_prompt = "You are a thoughtful, intelligent conversational assistant participating in a structured interaction. Maintain consistent depth and tone.".to_string();
        }

        // 8. Fetch full dialogue for model
        let history_rows = sqlx::query(
            "SELECT role, content FROM story_architect_messages WHERE session_id = ? ORDER BY turn_index ASC"
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        let mut chat_messages = Vec::new();
        chat_messages.push(ChatMessage {
            role: "system".to_string(),
            content: system_prompt,
        });

        for row in history_rows {
            let role: String = row.get("role");
            let content: String = row.get("content");
            chat_messages.push(ChatMessage { role, content });
        }

        // 9. Execute Inference via Provider
        let req_id = format!("req-{}", &Uuid::new_v4().to_string()[..8]);
        tracing::info!(
            target: "mechon::inference",
            request_id = %req_id,
            session_id = %session_id,
            provider_id = %provider_id,
            model = ?requested_model,
            "Executing story architect turn"
        );

        let (assistant_content, model_used) = Self::call_inference(
            app, pool, vault, provider_id, requested_model,
            chat_messages, temperature.unwrap_or(0.7), top_p.unwrap_or(0.9),
            max_tokens.unwrap_or(2048), session_id
        ).await?;

        let latency_ms = start_time.elapsed().as_millis() as usize;
        let assistant_token_est = (assistant_content.len() / 4).max(1);

        // 10. Save Assistant Message
        let asst_msg_id = format!("sm-{}", Uuid::new_v4());
        let now_asst = Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO story_architect_messages (
                id, session_id, turn_index, role, content, prompt_history_id,
                milestone_id, provider_id, model, token_count, latency_ms,
                translations_json, is_outdated, revision_count, created_at
            ) VALUES (?, ?, ?, 'assistant', ?, NULL, ?, ?, ?, ?, ?, '{}', 0, 0, ?)
            "#,
        )
        .bind(&asst_msg_id)
        .bind(session_id)
        .bind(assistant_turn_index as i64)
        .bind(&assistant_content)
        .bind(&active_milestone_id)
        .bind(provider_id)
        .bind(&model_used)
        .bind(assistant_token_est as i64)
        .bind(latency_ms as i64)
        .bind(&now_asst)
        .execute(pool)
        .await?;

        let assistant_message = StoryMessage {
            id: asst_msg_id,
            session_id: session_id.to_string(),
            turn_index: assistant_turn_index,
            role: "assistant".to_string(),
            content: assistant_content.clone(),
            prompt_history_id: None,
            milestone_id: active_milestone_id.clone(),
            provider_id: Some(provider_id.to_string()),
            model: Some(model_used.clone()),
            token_count: assistant_token_est,
            latency_ms,
            translations: serde_json::json!({}),
            is_outdated: false,
            revision_count: 0,
            updated_at: None,
            created_at: now_asst.clone(),
        };

        // 11. Evaluate Turn via Evaluation Agent (strictly isolated: uses Evaluation Agent's own configured provider & model)
        let eval_result = EvaluationAgentService::evaluate_turn(
            pool, vault, session_id, assistant_turn_index,
            approved_prompt, &assistant_content,
            active_milestone_id.as_deref(), active_milestone_title.as_deref(),
            None, None
        ).await?;

        // 12. Update Narrative State
        let previous_state = NarrativeStateService::get_latest(pool, session_id).await?;
        let mut established_facts = previous_state.as_ref()
            .map(|s| s.established_facts.clone())
            .unwrap_or_default();

        for new_f in eval_result.new_established_facts {
            if !established_facts.contains(&new_f) {
                established_facts.push(new_f);
            }
        }

        let mut completed_milestones = previous_state.as_ref()
            .map(|s| s.completed_milestones.clone())
            .unwrap_or_default();

        // Advance milestone if evaluator recommends it or marks completed
        if (eval_result.milestone_completed || eval_result.evaluation.next_recommended_action == "advance_milestone") && active_milestone_id.is_some() {
            let m_id = active_milestone_id.as_ref().unwrap();
            if !completed_milestones.contains(m_id) {
                completed_milestones.push(m_id.clone());
                // Update milestone in DB
                let _ = sqlx::query(
                    "UPDATE planning_milestones SET status = 'completed', updated_at = ? WHERE id = ?"
                )
                .bind(&now_asst)
                .bind(m_id)
                .execute(pool)
                .await;

                // Activate next pending milestone
                let _ = sqlx::query(
                    "UPDATE planning_milestones SET status = 'active', updated_at = ? WHERE session_id = ? AND status = 'pending' ORDER BY order_index ASC LIMIT 1"
                )
                .bind(&now_asst)
                .bind(session_id)
                .execute(pool)
                .await;
            }
        }

        let updated_narrative_state = NarrativeStateService::append_state(
            pool,
            session_id,
            assistant_turn_index,
            previous_state.as_ref().and_then(|s| s.current_arc.as_deref()),
            previous_state.as_ref().and_then(|s| s.current_scene.as_deref()),
            Some(&eval_result.evaluation.evaluation_summary),
            previous_state.as_ref().map(|s| &s.character_states).unwrap_or(&serde_json::json!({})),
            previous_state.as_ref().map(|s| &s.relationship_states).unwrap_or(&serde_json::json!({})),
            &established_facts,
            previous_state.as_ref().map(|s| s.unresolved_conflicts.as_slice()).unwrap_or(&[]),
            &completed_milestones,
            &[],
            Some(&eval_result.evaluation.next_recommended_action),
            "in_progress",
        ).await?;

        // 13. Update Session tokens used
        let total_new_tokens = (user_token_est + assistant_token_est) as i64;
        let _ = sqlx::query(
            "UPDATE story_architect_sessions SET tokens_used = tokens_used + ?, status = 'in_progress', updated_at = ? WHERE id = ?"
        )
        .bind(total_new_tokens)
        .bind(&now_asst)
        .bind(session_id)
        .execute(pool)
        .await;

        if let Some(app_handle) = app {
            let _ = app_handle.emit(&format!("story-turn-completed-{}", session_id), serde_json::json!({
                "session_id": session_id,
                "turn_index": assistant_turn_index
            }));
        }

        Ok(ExecutionTurnResult {
            user_message,
            assistant_message,
            evaluation: eval_result.evaluation,
            updated_narrative_state,
        })
    }

    pub async fn regenerate_turn(
        app: Option<&AppHandle>,
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        turn_index: usize,
        override_provider_id: Option<&str>,
        override_model: Option<&str>,
    ) -> Result<ExecutionTurnResult, AppError> {
        let start_time = Instant::now();
        let now = Utc::now().to_rfc3339();

        // 1. Fetch Session
        let session = sqlx::query(
            r#"
            SELECT 
                project_id, title, interaction_type, primary_language,
                inference_provider_id, inference_model,
                temperature, top_p, max_tokens, tokens_used
            FROM story_architect_sessions
            WHERE id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Story session '{}' not found", session_id)))?;

        let session_inference_provider: Option<String> = session.get("inference_provider_id");
        let session_inference_model: Option<String> = session.get("inference_model");
        let temperature: Option<f64> = session.get("temperature");
        let top_p: Option<f64> = session.get("top_p");
        let max_tokens: Option<i64> = session.get("max_tokens");

        // Authoritative resolution: Explicit Override > Session Stored > Fallback
        let provider_id = override_provider_id
            .filter(|p| !p.trim().is_empty())
            .or_else(|| session_inference_provider.as_deref())
            .unwrap_or("mock");

        let requested_model = override_model
            .filter(|m| !m.trim().is_empty())
            .or_else(|| session_inference_model.as_deref());

        // Update session's stored provider if override provided
        if let Some(p) = override_provider_id.filter(|s| !s.trim().is_empty()) {
            let _ = sqlx::query("UPDATE story_architect_sessions SET inference_provider_id = ?, inference_model = COALESCE(?, inference_model), updated_at = ? WHERE id = ?")
                .bind(p)
                .bind(requested_model)
                .bind(&now)
                .bind(session_id)
                .execute(pool)
                .await;
        }

        // 2. Fetch target assistant message
        let asst_msg_row = sqlx::query(
            "SELECT id, content, provider_id, model, token_count, latency_ms, milestone_id FROM story_architect_messages WHERE session_id = ? AND turn_index = ? AND role = 'assistant'"
        )
        .bind(session_id)
        .bind(turn_index as i64)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Assistant message at turn {} not found", turn_index)))?;

        let asst_msg_id: String = asst_msg_row.get("id");
        let old_content: String = asst_msg_row.get("content");
        let old_provider: Option<String> = asst_msg_row.get("provider_id");
        let old_model: Option<String> = asst_msg_row.get("model");
        let milestone_id: Option<String> = asst_msg_row.get("milestone_id");

        // 3. Fetch preceding user message (turn_index - 1)
        let user_msg_row = sqlx::query(
            "SELECT id, content, prompt_history_id, token_count, created_at FROM story_architect_messages WHERE session_id = ? AND turn_index = ? AND role = 'user'"
        )
        .bind(session_id)
        .bind((turn_index.saturating_sub(1)) as i64)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User message preceding turn {} not found", turn_index)))?;

        let user_content: String = user_msg_row.get("content");
        let user_msg_id: String = user_msg_row.get("id");
        let user_prompt_history_id: Option<String> = user_msg_row.get("prompt_history_id");
        let user_token_count: i64 = user_msg_row.get::<Option<i64>, _>("token_count").unwrap_or(0);
        let user_created_at: String = user_msg_row.get("created_at");

        // 4. Record old response in revision history
        let rev_id = format!("rev-{}", Uuid::new_v4());
        let meta = serde_json::json!({
            "turn_index": turn_index,
            "regenerated_with_provider": provider_id,
            "regenerated_with_model": requested_model,
            "timestamp": now
        }).to_string();

        sqlx::query(
            r#"
            INSERT INTO story_architect_message_revisions (
                id, message_id, session_id, turn_index, role,
                original_content, modified_content, provider_id, model,
                revision_reason, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, 'assistant', ?, '', ?, ?, 'regenerate', ?, ?)
            "#,
        )
        .bind(&rev_id)
        .bind(&asst_msg_id)
        .bind(session_id)
        .bind(turn_index as i64)
        .bind(&old_content)
        .bind(&old_provider)
        .bind(&old_model)
        .bind(&meta)
        .bind(&now)
        .execute(pool)
        .await?;

        // 5. Fetch spec for system prompt
        let spec_row = sqlx::query(
            "SELECT premise, world_environment, expected_assistant_behavior, constraints_forbidden_developments FROM planning_specifications WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?;

        let mut system_prompt = String::new();
        if let Some(spec) = spec_row {
            let expected_behavior: Option<String> = spec.get("expected_assistant_behavior");
            let premise: String = spec.get("premise");
            let world_environment: Option<String> = spec.get("world_environment");
            let constraints: Option<String> = spec.get("constraints_forbidden_developments");

            if let Some(beh) = expected_behavior {
                if !beh.is_empty() {
                    system_prompt.push_str(&beh);
                    system_prompt.push_str("\n\n");
                }
            }
            if !premise.is_empty() {
                system_prompt.push_str(&format!("Narrative Setting / Premise: {}\n", premise));
            }
            if let Some(world) = world_environment {
                if !world.is_empty() {
                    system_prompt.push_str(&format!("World Context: {}\n", world));
                }
            }
            if let Some(c) = constraints {
                if !c.is_empty() {
                    system_prompt.push_str(&format!("Strict Constraints: {}\n", c));
                }
            }
        }
        if system_prompt.is_empty() {
            system_prompt = "You are a thoughtful conversational assistant. Maintain consistent depth and tone.".to_string();
        }

        // 6. Fetch dialogue context strictly PRIOR to this assistant turn
        let history_rows = sqlx::query(
            "SELECT role, content FROM story_architect_messages WHERE session_id = ? AND turn_index < ? ORDER BY turn_index ASC"
        )
        .bind(session_id)
        .bind(turn_index as i64)
        .fetch_all(pool)
        .await?;

        let mut chat_messages = Vec::new();
        chat_messages.push(ChatMessage {
            role: "system".to_string(),
            content: system_prompt,
        });

        for row in history_rows {
            let role: String = row.get("role");
            let content: String = row.get("content");
            chat_messages.push(ChatMessage { role, content });
        }

        // 7. Execute Inference
        let req_id = format!("req-{}", &Uuid::new_v4().to_string()[..8]);
        tracing::info!(
            target: "mechon::inference",
            request_id = %req_id,
            session_id = %session_id,
            turn_index = turn_index,
            provider_id = %provider_id,
            model = ?requested_model,
            "Regenerating assistant turn"
        );

        let (new_assistant_content, model_used) = Self::call_inference(
            app, pool, vault, provider_id, requested_model,
            chat_messages, temperature.unwrap_or(0.7), top_p.unwrap_or(0.9),
            max_tokens.unwrap_or(2048), session_id
        ).await?;

        let latency_ms = start_time.elapsed().as_millis() as usize;
        let assistant_token_est = (new_assistant_content.len() / 4).max(1);

        // 8. Update Assistant Message in Database
        sqlx::query(
            r#"
            UPDATE story_architect_messages
            SET content = ?, provider_id = ?, model = ?, token_count = ?,
                latency_ms = ?, is_outdated = 0, revision_count = revision_count + 1, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(&new_assistant_content)
        .bind(provider_id)
        .bind(&model_used)
        .bind(assistant_token_est as i64)
        .bind(latency_ms as i64)
        .bind(&now)
        .bind(&asst_msg_id)
        .execute(pool)
        .await?;

        // Update the revision record with modified_content
        let _ = sqlx::query(
            "UPDATE story_architect_message_revisions SET modified_content = ? WHERE id = ?"
        )
        .bind(&new_assistant_content)
        .bind(&rev_id)
        .execute(pool)
        .await;

        let assistant_message = StoryMessage {
            id: asst_msg_id,
            session_id: session_id.to_string(),
            turn_index,
            role: "assistant".to_string(),
            content: new_assistant_content.clone(),
            prompt_history_id: None,
            milestone_id: milestone_id.clone(),
            provider_id: Some(provider_id.to_string()),
            model: Some(model_used.clone()),
            token_count: assistant_token_est,
            latency_ms,
            translations: serde_json::json!({}),
            is_outdated: false,
            revision_count: 1,
            updated_at: Some(now.clone()),
            created_at: now.clone(),
        };

        let user_message = StoryMessage {
            id: user_msg_id,
            session_id: session_id.to_string(),
            turn_index: turn_index.saturating_sub(1),
            role: "user".to_string(),
            content: user_content.clone(),
            prompt_history_id: user_prompt_history_id,
            milestone_id: milestone_id.clone(),
            provider_id: None,
            model: None,
            token_count: user_token_count as usize,
            latency_ms: 0,
            translations: serde_json::json!({}),
            is_outdated: false,
            revision_count: 0,
            updated_at: None,
            created_at: user_created_at,
        };

        // 9. Re-Evaluate Turn (strictly isolated: uses Evaluation Agent's own configured provider & model)
        let eval_result = EvaluationAgentService::evaluate_turn(
            pool, vault, session_id, turn_index,
            &user_content, &new_assistant_content,
            milestone_id.as_deref(), None,
            None, None
        ).await?;

        // 10. Update Narrative State
        let previous_state = NarrativeStateService::get_latest(pool, session_id).await?;
        let updated_narrative_state = NarrativeStateService::append_state(
            pool,
            session_id,
            turn_index,
            previous_state.as_ref().and_then(|s| s.current_arc.as_deref()),
            previous_state.as_ref().and_then(|s| s.current_scene.as_deref()),
            Some(&eval_result.evaluation.evaluation_summary),
            previous_state.as_ref().map(|s| &s.character_states).unwrap_or(&serde_json::json!({})),
            previous_state.as_ref().map(|s| &s.relationship_states).unwrap_or(&serde_json::json!({})),
            &eval_result.new_established_facts,
            previous_state.as_ref().map(|s| s.unresolved_conflicts.as_slice()).unwrap_or(&[]),
            previous_state.as_ref().map(|s| s.completed_milestones.as_slice()).unwrap_or(&[]),
            &[],
            Some(&eval_result.evaluation.next_recommended_action),
            "in_progress",
        ).await?;

        if let Some(app_handle) = app {
            let _ = app_handle.emit(&format!("story-turn-completed-{}", session_id), serde_json::json!({
                "session_id": session_id,
                "turn_index": turn_index
            }));
        }

        Ok(ExecutionTurnResult {
            user_message,
            assistant_message,
            evaluation: eval_result.evaluation,
            updated_narrative_state,
        })
    }

    async fn call_inference(
        app: Option<&AppHandle>,
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        provider_id: &str,
        model: Option<&str>,
        messages: Vec<ChatMessage>,
        temperature: f64,
        top_p: f64,
        max_tokens: i64,
        session_id: &str,
    ) -> Result<(String, String), AppError> {
        let provider = ProviderService::get(pool, provider_id, vault).await?;
        let api_key = ProviderService::get_raw_key(pool, provider_id, vault).await.ok().flatten();
        let selected_model = model
            .filter(|m| !m.trim().is_empty())
            .or_else(|| provider.default_model.as_deref())
            .or_else(|| provider.models_cache.first().map(|s| s.as_str()))
            .unwrap_or("default")
            .to_string();

        let adapter = ProviderFactory::create(
            &provider.provider_type,
            &provider.base_url,
            api_key,
            provider.timeout_seconds,
        );

        // If streaming is supported and app handle provided
        if let Some(app_handle) = app {
            let (tx, mut rx) = mpsc::unbounded_channel::<String>();
            let req = ChatRequest {
                model: selected_model.clone(),
                messages: messages.clone(),
                temperature: Some(temperature),
                top_p: Some(top_p),
                max_tokens: Some(max_tokens),
                stream: true,
            };

            let app_clone = app_handle.clone();
            let session_clone = session_id.to_string();
            let stream_adapter = Arc::clone(&adapter);

            tokio::spawn(async move {
                if let Err(e) = stream_adapter.chat_stream(req, tx).await {
                    let err_event = format!("story-stream-error-{}", session_clone);
                    let _ = app_clone.emit(&err_event, serde_json::json!({ "error": e.message }));
                }
            });

            let mut full_accumulated = String::new();
            let token_event = format!("story-stream-token-{}", session_id);

            let stream_loop = async {
                while let Some(token) = rx.recv().await {
                    full_accumulated.push_str(&token);
                    let _ = app_handle.emit(&token_event, serde_json::json!({
                        "token": token,
                        "accumulated": full_accumulated
                    }));
                }
                full_accumulated
            };

            match tokio::time::timeout(std::time::Duration::from_secs(45), stream_loop).await {
                Ok(accumulated) => {
                    let done_event = format!("story-stream-done-{}", session_id);
                    let _ = app_handle.emit(&done_event, serde_json::json!({ "content": accumulated }));

                    if !accumulated.trim().is_empty() {
                        return Ok((accumulated, selected_model));
                    }
                }
                Err(_) => {
                    let err_event = format!("story-stream-error-{}", session_id);
                    let _ = app_handle.emit(&err_event, serde_json::json!({ "error": "Inference stream timed out after 45 seconds" }));
                    return Err(AppError::Provider(format!(
                        "Inference stream timed out after 45 seconds for provider '{}' and model '{}'",
                        provider_id, selected_model
                    )));
                }
            }
        }

        // Direct non-streaming execution with resilient 45-second timeout
        let req = ChatRequest {
            model: selected_model.clone(),
            messages,
            temperature: Some(temperature),
            top_p: Some(top_p),
            max_tokens: Some(max_tokens),
            stream: false,
        };

        let resp = tokio::time::timeout(std::time::Duration::from_secs(45), adapter.chat(req))
            .await
            .map_err(|_| AppError::Provider(format!(
                "Inference request timed out after 45 seconds for provider '{}' and model '{}'",
                provider_id, selected_model
            )))?
            .map_err(AppError::ProviderStructured)?;

        Ok((resp.content, selected_model))
    }
}
