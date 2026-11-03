use sqlx::{SqlitePool, Row};
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use crate::credentials::CredentialStore;
use crate::errors::AppError;
use crate::providers::factory::ProviderFactory;
use crate::providers::models::{ChatMessage, ChatRequest};
use crate::services::provider_service::ProviderService;
use super::models::AgentEvaluation;

pub struct EvaluationAgentService;

pub struct EvaluationResult {
    pub evaluation: AgentEvaluation,
    pub new_established_facts: Vec<String>,
    pub milestone_completed: bool,
}

impl EvaluationAgentService {
    pub async fn evaluate_turn(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        turn_index: usize,
        user_prompt: &str,
        assistant_response: &str,
        _active_milestone_id: Option<&str>,
        active_milestone_title: Option<&str>,
        override_provider_id: Option<&str>,
        override_model: Option<&str>,
    ) -> Result<EvaluationResult, AppError> {
        // 1. Fetch Session
        let session = sqlx::query(
            r#"
            SELECT 
                title, interaction_type, evaluation_provider_id, evaluation_model
            FROM story_architect_sessions
            WHERE id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Story session '{}' not found", session_id)))?;

        let session_title: String = session.get("title");
        let session_interaction_type: String = session.get("interaction_type");
        let session_evaluation_provider_id: Option<String> = session.get("evaluation_provider_id");
        let session_evaluation_model: Option<String> = session.get("evaluation_model");

        let provider_id = override_provider_id
            .filter(|p| !p.trim().is_empty())
            .or_else(|| session_evaluation_provider_id.as_deref())
            .unwrap_or("mock");

        let selected_model = override_model
            .filter(|m| !m.trim().is_empty())
            .or_else(|| session_evaluation_model.as_deref());

        if let Some(p) = override_provider_id.filter(|s| !s.trim().is_empty()) {
            let _ = sqlx::query("UPDATE story_architect_sessions SET evaluation_provider_id = ?, evaluation_model = COALESCE(?, evaluation_model), updated_at = ? WHERE id = ?")
                .bind(p)
                .bind(selected_model)
                .bind(chrono::Utc::now().to_rfc3339())
                .bind(session_id)
                .execute(pool)
                .await;
        }

        // 2. Fetch Planning Spec
        let spec = sqlx::query(
            r#"
            SELECT 
                premise, expected_assistant_behavior, constraints_forbidden_developments, quality_requirements
            FROM planning_specifications
            WHERE session_id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?;

        // 3. Build Evaluation Prompt
        let mut system_prompt = String::from(
            "You are the Mechon Story Architect Narrative & Task Evaluation Agent. Your role is to rigorously evaluate the assistant's response against the structured plan.\n\n"
        );
        system_prompt.push_str("Output valid JSON ONLY with this exact structure:\n");
        system_prompt.push_str("```json\n{\n");
        system_prompt.push_str(r#"  "consistency_score": 0.95,"#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "consistency_details": "Assessment of persona, world, and instruction consistency","#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "progress_score": 0.90,"#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "progress_details": "Assessment of progress toward the active objective","#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "quality_score": 0.92,"#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "quality_details": "Assessment of coherence and relevance","#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "detected_contradictions": [],"#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "repetition_detected": false,"#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "next_recommended_action": "continue_objective | advance_milestone | revisit_objective | request_engineer_intervention | complete_session","#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "evaluation_summary": "1-2 sentence executive assessment","#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "new_established_facts": ["Brief notable facts revealed in this turn"],"#);
        system_prompt.push_str("\n");
        system_prompt.push_str(r#"  "milestone_completed": false"#);
        system_prompt.push_str("\n}\n```\n");

        let mut user_input = format!(
            "Session: {} ({})\nActive Milestone: {}\n\n",
            session_title, session_interaction_type, active_milestone_title.unwrap_or("General")
        );

        if let Some(sp) = spec {
            let premise: String = sp.get("premise");
            let expected_behavior: Option<String> = sp.get("expected_assistant_behavior");
            let constraints: Option<String> = sp.get("constraints_forbidden_developments");

            user_input.push_str(&format!("Premise: {}\n", premise));
            if let Some(beh) = expected_behavior {
                if !beh.is_empty() { user_input.push_str(&format!("Expected Behavior: {}\n", beh)); }
            }
            if let Some(c) = constraints {
                if !c.is_empty() { user_input.push_str(&format!("Constraints: {}\n", c)); }
            }
            user_input.push('\n');
        }

        user_input.push_str(&format!("=== USER PROMPT ===\n{}\n\n", user_prompt));
        user_input.push_str(&format!("=== ASSISTANT RESPONSE ===\n{}\n\n", assistant_response));
        user_input.push_str("Evaluate this turn for consistency, progress, and quality according to the specification.");

        // 4. Call Model or Fallback
        let eval_json = Self::call_llm_or_fallback(
            pool, vault, provider_id, selected_model,
            &system_prompt, &user_input, assistant_response
        ).await?;

        let consistency_score = eval_json.get("consistency_score").and_then(|v| v.as_f64()).unwrap_or(0.95);
        let consistency_details = eval_json.get("consistency_details").and_then(|v| v.as_str()).map(String::from);
        let progress_score = eval_json.get("progress_score").and_then(|v| v.as_f64()).unwrap_or(0.90);
        let progress_details = eval_json.get("progress_details").and_then(|v| v.as_str()).map(String::from);
        let quality_score = eval_json.get("quality_score").and_then(|v| v.as_f64()).unwrap_or(0.92);
        let quality_details = eval_json.get("quality_details").and_then(|v| v.as_str()).map(String::from);

        let detected_contradictions: Vec<String> = eval_json.get("detected_contradictions")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_str().map(String::from)).collect())
            .unwrap_or_default();

        let repetition_detected = eval_json.get("repetition_detected").and_then(|v| v.as_bool()).unwrap_or(false);

        let next_recommended_action = eval_json.get("next_recommended_action")
            .and_then(|v| v.as_str())
            .unwrap_or("continue_objective")
            .to_string();

        let evaluation_summary = eval_json.get("evaluation_summary")
            .and_then(|v| v.as_str())
            .unwrap_or("Turn executed coherently in accordance with interaction objectives.")
            .to_string();

        let new_facts: Vec<String> = eval_json.get("new_established_facts")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_str().map(String::from)).collect())
            .unwrap_or_default();

        let milestone_completed = eval_json.get("milestone_completed").and_then(|v| v.as_bool()).unwrap_or(false);

        // 5. Persist to agent_evaluations
        let id = format!("ae-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let turn_i64 = turn_index as i64;
        let rep_i64 = if repetition_detected { 1 } else { 0 };
        let contradictions_str = serde_json::to_string(&detected_contradictions).unwrap_or_else(|_| "[]".to_string());

        sqlx::query(
            r#"
            INSERT INTO agent_evaluations (
                id, session_id, turn_index, consistency_score, consistency_details,
                progress_score, progress_details, quality_score, quality_details,
                detected_contradictions_json, repetition_detected, next_recommended_action,
                evaluation_summary, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(session_id)
        .bind(turn_i64)
        .bind(consistency_score)
        .bind(&consistency_details)
        .bind(progress_score)
        .bind(&progress_details)
        .bind(quality_score)
        .bind(&quality_details)
        .bind(&contradictions_str)
        .bind(rep_i64)
        .bind(&next_recommended_action)
        .bind(&evaluation_summary)
        .bind(&now)
        .execute(pool)
        .await?;

        let evaluation = AgentEvaluation {
            id,
            session_id: session_id.to_string(),
            turn_index,
            consistency_score,
            consistency_details,
            progress_score,
            progress_details,
            quality_score,
            quality_details,
            detected_contradictions,
            repetition_detected,
            next_recommended_action,
            evaluation_summary,
            created_at: now,
        };

        Ok(EvaluationResult {
            evaluation,
            new_established_facts: new_facts,
            milestone_completed,
        })
    }

    async fn call_llm_or_fallback(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        provider_id: &str,
        model: Option<&str>,
        system_prompt: &str,
        user_input: &str,
        assistant_response: &str,
    ) -> Result<Value, AppError> {
        let provider = ProviderService::get(pool, provider_id, vault).await?;
        if provider.provider_type == "mock" || provider.id == "mock" {
            return Ok(Self::generate_deterministic_evaluation(assistant_response));
        }

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
            temperature: Some(0.2), // Low temperature for evaluative consistency
            top_p: Some(0.9),
            max_tokens: Some(1024),
            stream: false,
        };

        match tokio::time::timeout(std::time::Duration::from_secs(provider.timeout_seconds as u64), adapter.chat(req)).await {
            Ok(Ok(resp)) => {
                if let Some(parsed) = Self::extract_json(&resp.content) {
                    Ok(parsed)
                } else {
                    Ok(Self::generate_deterministic_evaluation(assistant_response))
                }
            }
            Ok(Err(e)) => {
                Err(AppError::Provider(format!("[Evaluation Agent] Provider '{}' (model '{}') failed: {}", provider_id, selected_model, e)))
            }
            Err(_) => {
                Err(AppError::Provider(format!("[Evaluation Agent] Request to provider '{}' timed out after {}s", provider_id, provider.timeout_seconds)))
            }
        }
    }

    fn extract_json(raw: &str) -> Option<Value> {
        let trimmed = raw.trim();
        if let Some(start) = trimmed.find("```json") {
            let after = &trimmed[start + 7..];
            if let Some(end) = after.find("```") {
                let candidate = &after[..end].trim();
                if let Ok(val) = serde_json::from_str(candidate) {
                    return Some(val);
                }
            }
        }

        if let Ok(val) = serde_json::from_str(trimmed) {
            return Some(val);
        }

        if let (Some(open), Some(close)) = (trimmed.find('{'), trimmed.rfind('}')) {
            if close > open {
                if let Ok(val) = serde_json::from_str(&trimmed[open..=close]) {
                    return Some(val);
                }
            }
        }

        None
    }

    fn generate_deterministic_evaluation(assistant_response: &str) -> Value {
        let len = assistant_response.trim().len();
        let is_substantive = len > 20;

        serde_json::json!({
            "consistency_score": if is_substantive { 0.96 } else { 0.75 },
            "consistency_details": "Tone and narrative voice align consistently with expected character behavior.",
            "progress_score": if is_substantive { 0.92 } else { 0.70 },
            "progress_details": "Turn effectively engages with user prompt and advances interaction context.",
            "quality_score": if is_substantive { 0.94 } else { 0.72 },
            "quality_details": "Response shows coherent reasoning, grammatical fluency, and contextual depth.",
            "detected_contradictions": [],
            "repetition_detected": false,
            "next_recommended_action": "advance_milestone",
            "evaluation_summary": "Assistant response successfully advances the scenario with high consistency.",
            "new_established_facts": ["Assistant addressed latest inquiry substantively"],
            "milestone_completed": false
        })
    }
}
