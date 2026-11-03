use sqlx::{Row, SqlitePool};
use serde_json::Value;
use crate::credentials::CredentialStore;
use crate::errors::AppError;
use crate::providers::factory::ProviderFactory;
use crate::providers::models::{ChatMessage, ChatRequest};
use crate::services::provider_service::ProviderService;
use super::models::PlanningPromptHistory;
use super::prompt_history::PromptHistoryService;
use super::narrative_state::NarrativeStateService;

pub struct PlanningAgentService;

impl PlanningAgentService {
    /// Generate the next conversation prompt using the Planning Agent
    pub async fn generate_next_prompt(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        feedback: Option<&str>,
        override_provider_id: Option<&str>,
        override_model: Option<&str>,
    ) -> Result<PlanningPromptHistory, AppError> {
        // 1. Fetch Session
        let session_row = sqlx::query(
            "SELECT project_id, title, interaction_type, primary_language,
                    planning_provider_id, planning_model,
                    temperature, top_p, max_tokens
             FROM story_architect_sessions
             WHERE id = ?"
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Story session '{}' not found", session_id)))?;

        let session_title: String = session_row.get("title");
        let interaction_type: String = session_row.get("interaction_type");
        let primary_language: String = session_row.get("primary_language");
        let planning_provider_id: Option<String> = session_row.get("planning_provider_id");
        let planning_model: Option<String> = session_row.get("planning_model");
        let temperature: Option<f64> = session_row.get("temperature");
        let max_tokens: Option<i64> = session_row.get("max_tokens");

        // Authoritative resolution: Explicit Override > Session Stored > Fallback
        let provider_id = override_provider_id
            .filter(|p| !p.trim().is_empty())
            .or_else(|| planning_provider_id.as_deref())
            .unwrap_or("mock");

        let selected_model = override_model
            .filter(|m| !m.trim().is_empty())
            .or_else(|| planning_model.as_deref());

        if let Some(p) = override_provider_id.filter(|s| !s.trim().is_empty()) {
            let _ = sqlx::query("UPDATE story_architect_sessions SET planning_provider_id = ?, planning_model = COALESCE(?, planning_model), updated_at = ? WHERE id = ?")
                .bind(p)
                .bind(selected_model)
                .bind(chrono::Utc::now().to_rfc3339())
                .bind(session_id)
                .execute(pool)
                .await;
        }

        // 2. Fetch Planning Spec
        let spec_row = sqlx::query(
            "SELECT premise, world_environment, character_profiles_json,
                    main_conflict, secondary_conflicts, important_events_json,
                    narrative_progression, desired_ending, constraints_forbidden_developments,
                    learning_objectives_json, reasoning_objectives_json,
                    communication_objectives_json, expected_assistant_behavior,
                    quality_requirements, completion_criteria
             FROM planning_specifications
             WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?;

        // 3. Fetch Milestones
        let milestones_rows = sqlx::query(
            "SELECT id, title, objective, status, order_index
             FROM planning_milestones
             WHERE session_id = ?
             ORDER BY order_index ASC"
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        // 4. Fetch Conversation History
        let messages_rows = sqlx::query(
            "SELECT turn_index, role, content
             FROM story_architect_messages
             WHERE session_id = ?
             ORDER BY turn_index ASC"
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        let current_turn = messages_rows.len();

        // 5. Fetch Latest Narrative State
        let narrative_state = NarrativeStateService::get_latest(pool, session_id).await?;

        // Determine active milestone
        let active_milestone = milestones_rows.iter().find(|m| {
            let s: String = m.get("status");
            s == "active"
        })
        .or_else(|| milestones_rows.iter().find(|m| {
            let s: String = m.get("status");
            s == "pending"
        }));

        let active_milestone_id: Option<String> = active_milestone.map(|m| m.get("id"));
        let active_milestone_title: String = active_milestone.map(|m| m.get("title")).unwrap_or_else(|| "General Interaction Progression".to_string());
        let active_milestone_obj: String = active_milestone.map(|m| m.get("objective")).unwrap_or_else(|| "Advance dialogue meaningfully".to_string());

        // 6. Build Prompt for Planning Agent
        let mut system_prompt = String::from(
            "You are the Mechon Story Architect Planning Agent. Your role is to formulate the NEXT USER PROMPT that guides the conversation according to the structured plan.\n\n"
        );
        system_prompt.push_str("You must output valid JSON ONLY with no commentary outside JSON, formatted as:\n");
        system_prompt.push_str("```json\n{\n");
        system_prompt.push_str(r#"  "prompt_content": "The exact user prompt to be spoken/typed next","#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "current_objective": "Specific goal for this immediate turn","#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "expected_outcome": "Expected reaction/response behavior from the assistant","#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "contextual_rationale": "Why this prompt is appropriate now according to the plan""#);
        system_prompt.push_str("\n}\n```\n");

        let mut user_input = format!(
            "Session Title: {}\nInteraction Type: {}\nPrimary Language: {}\nCurrent Turn Index: {}\n\n",
            session_title, interaction_type, primary_language, current_turn
        );

        if let Some(spec) = &spec_row {
            let premise: String = spec.get("premise");
            let world: Option<String> = spec.get("world_environment");
            let chars_json: String = spec.get("character_profiles_json");
            let main_conflict: Option<String> = spec.get("main_conflict");
            let narrative_progression: Option<String> = spec.get("narrative_progression");
            let expected_beh: Option<String> = spec.get("expected_assistant_behavior");
            let constraints: Option<String> = spec.get("constraints_forbidden_developments");

            user_input.push_str("=== PLANNING SPECIFICATION ===\n");
            user_input.push_str(&format!("Premise: {}\n", premise));
            if let Some(w) = world {
                if !w.is_empty() { user_input.push_str(&format!("World/Environment: {}\n", w)); }
            }
            if !chars_json.is_empty() && chars_json != "[]" {
                user_input.push_str(&format!("Characters: {}\n", chars_json));
            }
            if let Some(conflict) = main_conflict {
                if !conflict.is_empty() { user_input.push_str(&format!("Main Conflict: {}\n", conflict)); }
            }
            if let Some(prog) = narrative_progression {
                if !prog.is_empty() { user_input.push_str(&format!("Progression Plan: {}\n", prog)); }
            }
            if let Some(beh) = expected_beh {
                if !beh.is_empty() { user_input.push_str(&format!("Expected Assistant Behavior: {}\n", beh)); }
            }
            if let Some(c) = constraints {
                if !c.is_empty() { user_input.push_str(&format!("Forbidden Developments / Constraints: {}\n", c)); }
            }
            user_input.push('\n');
        }

        user_input.push_str(&format!("Active Milestone: {} (Objective: {})\n\n", active_milestone_title, active_milestone_obj));

        if let Some(state) = &narrative_state {
            user_input.push_str("=== CURRENT NARRATIVE STATE ===\n");
            if let Some(arc) = &state.current_arc { user_input.push_str(&format!("Current Arc: {}\n", arc)); }
            if let Some(scene) = &state.current_scene { user_input.push_str(&format!("Current Scene: {}\n", scene)); }
            if !state.established_facts.is_empty() {
                user_input.push_str(&format!("Established Facts: {}\n", state.established_facts.join("; ")));
            }
            if !state.unresolved_conflicts.is_empty() {
                user_input.push_str(&format!("Active Conflicts: {}\n", state.unresolved_conflicts.join("; ")));
            }
            user_input.push('\n');
        }

        if !messages_rows.is_empty() {
            user_input.push_str("=== RECENT CONVERSATION HISTORY ===\n");
            let start = if messages_rows.len() > 6 { messages_rows.len() - 6 } else { 0 };
            for msg in &messages_rows[start..] {
                let role: String = msg.get("role");
                let content: String = msg.get("content");
                user_input.push_str(&format!("{}: {}\n", role.to_uppercase(), content));
            }
            user_input.push('\n');
        }

        if let Some(fb) = feedback {
            user_input.push_str(&format!("Engineer Directive / Feedback on Previous Proposal: {}\n\n", fb));
        }

        user_input.push_str("Formulate the next optimal user prompt in the specified primary language that moves the scenario forward while respecting all constraints.");

        // 7. Invoke Provider or Default Generator
        let generated_json = Self::call_llm_or_fallback(
            pool, vault, provider_id, selected_model,
            &system_prompt, &user_input, &primary_language, current_turn, &active_milestone_obj
        ).await;

        let prompt_content = generated_json.get("prompt_content")
            .and_then(|v| v.as_str())
            .unwrap_or("Hello, can we continue our discussion?");

        let current_obj = generated_json.get("current_objective")
            .and_then(|v| v.as_str())
            .unwrap_or(&active_milestone_obj);

        let expected_outcome = generated_json.get("expected_outcome")
            .and_then(|v| v.as_str())
            .unwrap_or("Response advancing the active objective");

        let rationale = generated_json.get("contextual_rationale")
            .and_then(|v| v.as_str())
            .unwrap_or("Aligns with current milestone and interaction objectives");

        let suggested_params = serde_json::json!({
            "temperature": temperature.unwrap_or(0.7),
            "max_tokens": max_tokens.unwrap_or(2048) as usize
        });

        // 8. Record in Prompt History
        let record = PromptHistoryService::record_prompt(
            pool,
            session_id,
            current_turn,
            prompt_content,
            current_obj,
            active_milestone_id.as_deref(),
            Some(expected_outcome),
            Some(rationale),
            &suggested_params,
        ).await?;

        Ok(record)
    }

    async fn call_llm_or_fallback(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        provider_id: &str,
        model: Option<&str>,
        system_prompt: &str,
        user_input: &str,
        language: &str,
        turn_index: usize,
        milestone_obj: &str,
    ) -> Value {
        if let Ok(provider) = ProviderService::get(pool, provider_id, vault).await {
            let api_key = ProviderService::get_raw_key(pool, provider_id, vault).await.ok().flatten();
            let selected_model = model
                .filter(|m| !m.trim().is_empty())
                .or_else(|| provider.default_model.as_deref())
                .unwrap_or("default");

            let adapter = ProviderFactory::create(
                &provider.provider_type,
                &provider.base_url,
                api_key,
                provider.timeout_seconds,
            );

            let req = ChatRequest {
                model: selected_model.to_string(),
                messages: vec![
                    ChatMessage { role: "system".to_string(), content: system_prompt.to_string() },
                    ChatMessage { role: "user".to_string(), content: user_input.to_string() },
                ],
                temperature: Some(0.6),
                top_p: Some(0.9),
                max_tokens: Some(1024),
                stream: false,
            };

            if let Ok(Ok(resp)) = tokio::time::timeout(std::time::Duration::from_secs(30), adapter.chat(req)).await {
                if let Some(parsed) = Self::extract_json(&resp.content) {
                    return parsed;
                }
            }
        }

        // Deterministic Fallback if offline or mock
        Self::generate_deterministic_proposal(language, turn_index, milestone_obj)
    }

    fn extract_json(raw: &str) -> Option<Value> {
        let trimmed = raw.trim();
        // Check for ```json ... ``` blocks
        if let Some(start) = trimmed.find("```json") {
            let after = &trimmed[start + 7..];
            if let Some(end) = after.find("```") {
                let candidate = after[..end].trim();
                if let Ok(val) = serde_json::from_str(candidate) {
                    return Some(val);
                }
            }
        }

        // Direct parse
        if let Ok(val) = serde_json::from_str(trimmed) {
            return Some(val);
        }

        // Find first '{' and last '}'
        if let (Some(open), Some(close)) = (trimmed.find('{'), trimmed.rfind('}')) {
            if close > open {
                if let Ok(val) = serde_json::from_str(&trimmed[open..=close]) {
                    return Some(val);
                }
            }
        }

        None
    }

    fn generate_deterministic_proposal(language: &str, turn_index: usize, milestone_obj: &str) -> Value {
        let is_id = language.starts_with("id");
        let prompt_content = match (is_id, turn_index) {
            (true, 0) => "Halo! Mari kita mulai skenario ini sesuai dengan latar belakang yang telah disepakati.".to_string(),
            (true, 1) => format!("Terkait dengan hal tersebut, bagaimana pandanganmu mengenai situasi ini? Khususnya terkait {}.", milestone_obj),
            (true, _) => format!("Langkah selanjutnya yang perlu kita bahas adalah mengenai {}. Bagaimana responmu?", milestone_obj),
            (false, 0) => "Greetings. Let us begin our interaction according to the established narrative premise.".to_string(),
            (false, 1) => format!("Considering the initial context, what are your thoughts regarding {}?", milestone_obj),
            (false, _) => format!("Moving forward with our objective, how do you address {}?", milestone_obj),
        };

        serde_json::json!({
            "prompt_content": prompt_content,
            "current_objective": milestone_obj,
            "expected_outcome": "Detailed in-character or professional response addressing the prompt",
            "contextual_rationale": "Advances dialogue toward milestone completion while respecting narrative constraints"
        })
    }
}
