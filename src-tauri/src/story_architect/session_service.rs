use sqlx::{SqlitePool, Row};
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use tauri::AppHandle;
use crate::credentials::CredentialStore;
use crate::errors::AppError;
use super::models::{
    StorySession, CreateStorySessionInput, UpdateStorySessionInput,
    PlanningSpecification, SavePlanningSpecInput, PlanningMilestone, SaveMilestoneInput,
    StoryMessage, StoryMessageRevision, EditStoryMessageInput, RegenerateAssistantTurnInput,
    RestoreRevisionInput, CommitToSFTInput, CommitToSFTResult,
    AutoStepResult, ExecutionTurnResult
};
use super::narrative_state::NarrativeStateService;
use super::planning_service::PlanningAgentService;
use super::execution_service::ExecutionService;
use super::prompt_history::PromptHistoryService;

pub struct StorySessionService;

impl StorySessionService {
    pub async fn create_session(
        pool: &SqlitePool,
        input: CreateStorySessionInput,
    ) -> Result<StorySession, AppError> {
        let session_id = format!("sas-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        let interaction_type = input.interaction_type.unwrap_or_else(|| "storytelling".to_string());
        let primary_lang = input.primary_language.unwrap_or_else(|| "en".to_string());
        let target_turns = input.target_turns.unwrap_or(10) as i64;
        let exec_mode = input.execution_mode.unwrap_or_else(|| "manual".to_string());

        let pause_conditions = input.auto_pause_conditions.unwrap_or_else(|| vec![
            "major_milestone".to_string(),
            "contradiction_detected".to_string(),
            "quality_below_threshold".to_string(),
            "target_turns_reached".to_string(),
        ]);
        let pause_cond_json = serde_json::to_string(&pause_conditions).unwrap_or_else(|_| "[]".to_string());

        // 1. Insert Session
        sqlx::query(
            r#"
            INSERT INTO story_architect_sessions (
                id, project_id, title, description, interaction_type, primary_language,
                secondary_language, target_turns, status, execution_mode,
                auto_pause_conditions_json, planning_provider_id, planning_model,
                inference_provider_id, inference_model, evaluation_provider_id,
                evaluation_model, temperature, top_p, max_tokens, max_turns,
                max_agent_iterations, token_budget, tokens_used, sft_session_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, 0.7, 0.9, 2048, 20, 50, 100000, 0, NULL, ?, ?)
            "#,
        )
        .bind(&session_id)
        .bind(&input.project_id)
        .bind(&input.title)
        .bind(&input.description)
        .bind(&interaction_type)
        .bind(&primary_lang)
        .bind(&input.secondary_language)
        .bind(target_turns)
        .bind(&exec_mode)
        .bind(&pause_cond_json)
        .bind(&input.planning_provider_id)
        .bind(&input.planning_model)
        .bind(&input.inference_provider_id)
        .bind(&input.inference_model)
        .bind(&input.evaluation_provider_id)
        .bind(&input.evaluation_model)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        // 2. Create Initial Planning Spec
        let spec_id = format!("ps-{}", Uuid::new_v4());
        let default_premise = format!("Interactive scenario for {}", input.title);
        sqlx::query(
            r#"
            INSERT INTO planning_specifications (
                id, session_id, premise, world_environment, character_profiles_json,
                main_conflict, secondary_conflicts, important_events_json,
                narrative_progression, desired_ending, constraints_forbidden_developments,
                learning_objectives_json, reasoning_objectives_json,
                communication_objectives_json, expected_assistant_behavior,
                quality_requirements, completion_criteria, custom_fields_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, '', '[]', '', '', '[]', '', '', '', '[]', '[]', '[]', '', '', '', '{}', ?, ?)
            "#,
        )
        .bind(&spec_id)
        .bind(&session_id)
        .bind(&default_premise)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        // 3. Populate default milestones from template or general structure
        let default_milestones = Self::get_default_milestones_for_type(&interaction_type);
        for (idx, (m_title, m_desc, m_obj)) in default_milestones.into_iter().enumerate() {
            let m_id = format!("pm-{}", Uuid::new_v4());
            let status = if idx == 0 { "active" } else { "pending" };
            sqlx::query(
                r#"
                INSERT INTO planning_milestones (
                    id, session_id, order_index, title, description, objective,
                    status, completion_criteria, associated_turn_ids_json,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, '[]', ?, ?)
                "#,
            )
            .bind(&m_id)
            .bind(&session_id)
            .bind(idx as i64)
            .bind(m_title)
            .bind(m_desc)
            .bind(m_obj)
            .bind(status)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await?;
        }

        // 4. Initialize Narrative State
        let _ = NarrativeStateService::create_initial_state(
            pool,
            &session_id,
            &default_premise,
            "Establish context and introduction",
            None,
        ).await;

        Self::get_session(pool, &session_id).await
    }

    pub async fn get_session(pool: &SqlitePool, session_id: &str) -> Result<StorySession, AppError> {
        let r = sqlx::query(
            r#"
            SELECT 
                id, project_id, title, description, interaction_type, primary_language,
                secondary_language, target_turns, status, execution_mode,
                auto_pause_conditions_json, planning_provider_id, planning_model,
                inference_provider_id, inference_model, evaluation_provider_id,
                evaluation_model, temperature, top_p, max_tokens, max_turns,
                max_agent_iterations, token_budget, tokens_used, sft_session_id,
                created_at, updated_at
            FROM story_architect_sessions
            WHERE id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Story session '{}' not found", session_id)))?;

        let pause_conditions: Vec<String> = serde_json::from_str(&r.get::<String, _>("auto_pause_conditions_json")).unwrap_or_default();

        Ok(StorySession {
            id: r.get("id"),
            project_id: r.get("project_id"),
            title: r.get("title"),
            description: r.get("description"),
            interaction_type: r.get("interaction_type"),
            primary_language: r.get("primary_language"),
            secondary_language: r.get("secondary_language"),
            target_turns: r.get::<i64, _>("target_turns") as usize,
            status: r.get("status"),
            execution_mode: r.get("execution_mode"),
            auto_pause_conditions: pause_conditions,
            planning_provider_id: r.get("planning_provider_id"),
            planning_model: r.get("planning_model"),
            inference_provider_id: r.get("inference_provider_id"),
            inference_model: r.get("inference_model"),
            evaluation_provider_id: r.get("evaluation_provider_id"),
            evaluation_model: r.get("evaluation_model"),
            temperature: r.get::<Option<f64>, _>("temperature").unwrap_or(0.7),
            top_p: r.get::<Option<f64>, _>("top_p").unwrap_or(0.9),
            max_tokens: r.get::<Option<i64>, _>("max_tokens").unwrap_or(2048) as usize,
            max_turns: r.get::<Option<i64>, _>("max_turns").unwrap_or(20) as usize,
            max_agent_iterations: r.get::<Option<i64>, _>("max_agent_iterations").unwrap_or(50) as usize,
            token_budget: r.get::<Option<i64>, _>("token_budget").unwrap_or(100000) as usize,
            tokens_used: r.get::<Option<i64>, _>("tokens_used").unwrap_or(0) as usize,
            sft_session_id: r.get("sft_session_id"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
    }

    pub async fn list_sessions(pool: &SqlitePool, project_id: &str) -> Result<Vec<StorySession>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                id, project_id, title, description, interaction_type, primary_language,
                secondary_language, target_turns, status, execution_mode,
                auto_pause_conditions_json, planning_provider_id, planning_model,
                inference_provider_id, inference_model, evaluation_provider_id,
                evaluation_model, temperature, top_p, max_tokens, max_turns,
                max_agent_iterations, token_budget, tokens_used, sft_session_id,
                created_at, updated_at
            FROM story_architect_sessions
            WHERE project_id = ?
            ORDER BY updated_at DESC
            "#,
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let list = rows.into_iter().map(|r| {
            let pause_conditions: Vec<String> = serde_json::from_str(&r.get::<String, _>("auto_pause_conditions_json")).unwrap_or_default();
            StorySession {
                id: r.get("id"),
                project_id: r.get("project_id"),
                title: r.get("title"),
                description: r.get("description"),
                interaction_type: r.get("interaction_type"),
                primary_language: r.get("primary_language"),
                secondary_language: r.get("secondary_language"),
                target_turns: r.get::<i64, _>("target_turns") as usize,
                status: r.get("status"),
                execution_mode: r.get("execution_mode"),
                auto_pause_conditions: pause_conditions,
                planning_provider_id: r.get("planning_provider_id"),
                planning_model: r.get("planning_model"),
                inference_provider_id: r.get("inference_provider_id"),
                inference_model: r.get("inference_model"),
                evaluation_provider_id: r.get("evaluation_provider_id"),
                evaluation_model: r.get("evaluation_model"),
                temperature: r.get::<Option<f64>, _>("temperature").unwrap_or(0.7),
                top_p: r.get::<Option<f64>, _>("top_p").unwrap_or(0.9),
                max_tokens: r.get::<Option<i64>, _>("max_tokens").unwrap_or(2048) as usize,
                max_turns: r.get::<Option<i64>, _>("max_turns").unwrap_or(20) as usize,
                max_agent_iterations: r.get::<Option<i64>, _>("max_agent_iterations").unwrap_or(50) as usize,
                token_budget: r.get::<Option<i64>, _>("token_budget").unwrap_or(100000) as usize,
                tokens_used: r.get::<Option<i64>, _>("tokens_used").unwrap_or(0) as usize,
                sft_session_id: r.get("sft_session_id"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            }
        }).collect();

        Ok(list)
    }

    pub async fn update_session(pool: &SqlitePool, input: UpdateStorySessionInput) -> Result<StorySession, AppError> {
        let now = Utc::now().to_rfc3339();

        let pause_cond_str = input.auto_pause_conditions.map(|c| serde_json::to_string(&c).unwrap_or_else(|_| "[]".to_string()));

        sqlx::query(
            r#"
            UPDATE story_architect_sessions
            SET 
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                interaction_type = COALESCE(?, interaction_type),
                primary_language = COALESCE(?, primary_language),
                secondary_language = COALESCE(?, secondary_language),
                target_turns = COALESCE(?, target_turns),
                status = COALESCE(?, status),
                execution_mode = COALESCE(?, execution_mode),
                auto_pause_conditions_json = COALESCE(?, auto_pause_conditions_json),
                planning_provider_id = COALESCE(?, planning_provider_id),
                planning_model = COALESCE(?, planning_model),
                inference_provider_id = COALESCE(?, inference_provider_id),
                inference_model = COALESCE(?, inference_model),
                evaluation_provider_id = COALESCE(?, evaluation_provider_id),
                evaluation_model = COALESCE(?, evaluation_model),
                temperature = COALESCE(?, temperature),
                top_p = COALESCE(?, top_p),
                max_tokens = COALESCE(?, max_tokens),
                max_turns = COALESCE(?, max_turns),
                token_budget = COALESCE(?, token_budget),
                updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&input.title)
        .bind(&input.description)
        .bind(&input.interaction_type)
        .bind(&input.primary_language)
        .bind(&input.secondary_language)
        .bind(input.target_turns.map(|t| t as i64))
        .bind(&input.status)
        .bind(&input.execution_mode)
        .bind(&pause_cond_str)
        .bind(&input.planning_provider_id)
        .bind(&input.planning_model)
        .bind(&input.inference_provider_id)
        .bind(&input.inference_model)
        .bind(&input.evaluation_provider_id)
        .bind(&input.evaluation_model)
        .bind(input.temperature)
        .bind(input.top_p)
        .bind(input.max_tokens.map(|t| t as i64))
        .bind(input.max_turns.map(|t| t as i64))
        .bind(input.token_budget.map(|b| b as i64))
        .bind(&now)
        .bind(&input.id)
        .execute(pool)
        .await?;

        Self::get_session(pool, &input.id).await
    }

    pub async fn delete_session(pool: &SqlitePool, session_id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM story_architect_sessions WHERE id = ?")
            .bind(session_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn get_planning_spec(pool: &SqlitePool, session_id: &str) -> Result<PlanningSpecification, AppError> {
        let r = sqlx::query(
            r#"
            SELECT 
                id, session_id, premise, world_environment, character_profiles_json,
                main_conflict, secondary_conflicts, important_events_json,
                narrative_progression, desired_ending, constraints_forbidden_developments,
                learning_objectives_json, reasoning_objectives_json,
                communication_objectives_json, expected_assistant_behavior,
                quality_requirements, completion_criteria, custom_fields_json,
                created_at, updated_at
            FROM planning_specifications
            WHERE session_id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Planning spec for session '{}' not found", session_id)))?;

        let character_profiles = serde_json::from_str(&r.get::<String, _>("character_profiles_json")).unwrap_or_default();
        let important_events = serde_json::from_str(&r.get::<String, _>("important_events_json")).unwrap_or_default();
        let learning_objectives = serde_json::from_str(&r.get::<String, _>("learning_objectives_json")).unwrap_or_default();
        let reasoning_objectives = serde_json::from_str(&r.get::<String, _>("reasoning_objectives_json")).unwrap_or_default();
        let communication_objectives = serde_json::from_str(&r.get::<String, _>("communication_objectives_json")).unwrap_or_default();
        let custom_fields = serde_json::from_str(&r.get::<String, _>("custom_fields_json")).unwrap_or_else(|_| serde_json::json!({}));

        Ok(PlanningSpecification {
            id: r.get("id"),
            session_id: r.get("session_id"),
            premise: r.get("premise"),
            world_environment: r.get::<Option<String>, _>("world_environment").unwrap_or_default(),
            character_profiles,
            main_conflict: r.get::<Option<String>, _>("main_conflict").unwrap_or_default(),
            secondary_conflicts: r.get::<Option<String>, _>("secondary_conflicts").unwrap_or_default(),
            important_events,
            narrative_progression: r.get::<Option<String>, _>("narrative_progression").unwrap_or_default(),
            desired_ending: r.get::<Option<String>, _>("desired_ending").unwrap_or_default(),
            constraints_forbidden_developments: r.get::<Option<String>, _>("constraints_forbidden_developments").unwrap_or_default(),
            learning_objectives,
            reasoning_objectives,
            communication_objectives,
            expected_assistant_behavior: r.get::<Option<String>, _>("expected_assistant_behavior").unwrap_or_default(),
            quality_requirements: r.get::<Option<String>, _>("quality_requirements").unwrap_or_default(),
            completion_criteria: r.get::<Option<String>, _>("completion_criteria").unwrap_or_default(),
            custom_fields,
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        })
    }

    pub async fn save_planning_spec(pool: &SqlitePool, input: SavePlanningSpecInput) -> Result<PlanningSpecification, AppError> {
        let now = Utc::now().to_rfc3339();

        let chars_json = input.character_profiles.as_ref()
            .map(|c| serde_json::to_string(c).unwrap_or_else(|_| "[]".to_string()))
            .unwrap_or_else(|| "[]".to_string());

        let events_json = input.important_events.as_ref()
            .map(|e| serde_json::to_string(e).unwrap_or_else(|_| "[]".to_string()))
            .unwrap_or_else(|| "[]".to_string());

        let learn_json = input.learning_objectives.as_ref()
            .map(|l| serde_json::to_string(l).unwrap_or_else(|_| "[]".to_string()))
            .unwrap_or_else(|| "[]".to_string());

        let reason_json = input.reasoning_objectives.as_ref()
            .map(|r| serde_json::to_string(r).unwrap_or_else(|_| "[]".to_string()))
            .unwrap_or_else(|| "[]".to_string());

        let comm_json = input.communication_objectives.as_ref()
            .map(|c| serde_json::to_string(c).unwrap_or_else(|_| "[]".to_string()))
            .unwrap_or_else(|| "[]".to_string());

        let custom_json = input.custom_fields.as_ref()
            .map(|c| serde_json::to_string(c).unwrap_or_else(|_| "{}".to_string()))
            .unwrap_or_else(|| "{}".to_string());

        sqlx::query(
            r#"
            INSERT INTO planning_specifications (
                id, session_id, premise, world_environment, character_profiles_json,
                main_conflict, secondary_conflicts, important_events_json,
                narrative_progression, desired_ending, constraints_forbidden_developments,
                learning_objectives_json, reasoning_objectives_json,
                communication_objectives_json, expected_assistant_behavior,
                quality_requirements, completion_criteria, custom_fields_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                premise = excluded.premise,
                world_environment = excluded.world_environment,
                character_profiles_json = excluded.character_profiles_json,
                main_conflict = excluded.main_conflict,
                secondary_conflicts = excluded.secondary_conflicts,
                important_events_json = excluded.important_events_json,
                narrative_progression = excluded.narrative_progression,
                desired_ending = excluded.desired_ending,
                constraints_forbidden_developments = excluded.constraints_forbidden_developments,
                learning_objectives_json = excluded.learning_objectives_json,
                reasoning_objectives_json = excluded.reasoning_objectives_json,
                communication_objectives_json = excluded.communication_objectives_json,
                expected_assistant_behavior = excluded.expected_assistant_behavior,
                quality_requirements = excluded.quality_requirements,
                completion_criteria = excluded.completion_criteria,
                custom_fields_json = excluded.custom_fields_json,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(format!("ps-{}", Uuid::new_v4()))
        .bind(&input.session_id)
        .bind(&input.premise)
        .bind(input.world_environment.unwrap_or_default())
        .bind(&chars_json)
        .bind(input.main_conflict.unwrap_or_default())
        .bind(input.secondary_conflicts.unwrap_or_default())
        .bind(&events_json)
        .bind(input.narrative_progression.unwrap_or_default())
        .bind(input.desired_ending.unwrap_or_default())
        .bind(input.constraints_forbidden_developments.unwrap_or_default())
        .bind(&learn_json)
        .bind(&reason_json)
        .bind(&comm_json)
        .bind(input.expected_assistant_behavior.unwrap_or_default())
        .bind(input.quality_requirements.unwrap_or_default())
        .bind(input.completion_criteria.unwrap_or_default())
        .bind(&custom_json)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::get_planning_spec(pool, &input.session_id).await
    }

    pub async fn list_milestones(pool: &SqlitePool, session_id: &str) -> Result<Vec<PlanningMilestone>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                id, session_id, order_index, title, description, objective,
                status, completion_criteria, associated_turn_ids_json,
                created_at, updated_at
            FROM planning_milestones
            WHERE session_id = ?
            ORDER BY order_index ASC
            "#,
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        let list = rows.into_iter().map(|r| {
            let associated_turns: Vec<String> = serde_json::from_str(&r.get::<String, _>("associated_turn_ids_json")).unwrap_or_default();
            PlanningMilestone {
                id: r.get("id"),
                session_id: r.get("session_id"),
                order_index: r.get::<i64, _>("order_index") as usize,
                title: r.get("title"),
                description: r.get("description"),
                objective: r.get("objective"),
                status: r.get("status"),
                completion_criteria: r.get("completion_criteria"),
                associated_turn_ids: associated_turns,
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            }
        }).collect();

        Ok(list)
    }

    pub async fn save_milestones(
        pool: &SqlitePool,
        session_id: &str,
        milestones: Vec<SaveMilestoneInput>,
    ) -> Result<Vec<PlanningMilestone>, AppError> {
        let mut tx = pool.begin().await?;
        let now = Utc::now().to_rfc3339();

        // Delete existing milestones and replace
        sqlx::query("DELETE FROM planning_milestones WHERE session_id = ?")
            .bind(session_id)
            .execute(&mut *tx)
            .await?;

        for m in milestones {
            let id = m.id.unwrap_or_else(|| format!("pm-{}", Uuid::new_v4()));
            let status = m.status.unwrap_or_else(|| if m.order_index == 0 { "active".to_string() } else { "pending".to_string() });
            let order_i64 = m.order_index as i64;

            sqlx::query(
                r#"
                INSERT INTO planning_milestones (
                    id, session_id, order_index, title, description, objective,
                    status, completion_criteria, associated_turn_ids_json,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
                "#,
            )
            .bind(&id)
            .bind(session_id)
            .bind(order_i64)
            .bind(&m.title)
            .bind(&m.description)
            .bind(&m.objective)
            .bind(&status)
            .bind(&m.completion_criteria)
            .bind(&now)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        Self::list_milestones(pool, session_id).await
    }

    pub async fn list_messages(pool: &SqlitePool, session_id: &str) -> Result<Vec<StoryMessage>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                id, session_id, turn_index, role, content, prompt_history_id,
                milestone_id, provider_id, model, token_count, latency_ms,
                translations_json, COALESCE(is_outdated, 0) as is_outdated,
                COALESCE(revision_count, 0) as revision_count, updated_at, created_at
            FROM story_architect_messages
            WHERE session_id = ?
            ORDER BY turn_index ASC
            "#,
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        let list = rows.into_iter().map(|r| {
            let translations = serde_json::from_str(&r.get::<String, _>("translations_json")).unwrap_or_else(|_| serde_json::json!({}));
            StoryMessage {
                id: r.get("id"),
                session_id: r.get("session_id"),
                turn_index: r.get::<i64, _>("turn_index") as usize,
                role: r.get("role"),
                content: r.get("content"),
                prompt_history_id: r.get("prompt_history_id"),
                milestone_id: r.get("milestone_id"),
                provider_id: r.get("provider_id"),
                model: r.get("model"),
                token_count: r.get::<Option<i64>, _>("token_count").unwrap_or(0) as usize,
                latency_ms: r.get::<Option<i64>, _>("latency_ms").unwrap_or(0) as usize,
                translations,
                is_outdated: r.get::<Option<i64>, _>("is_outdated").unwrap_or(0) != 0,
                revision_count: r.get::<Option<i64>, _>("revision_count").unwrap_or(0) as usize,
                updated_at: r.get("updated_at"),
                created_at: r.get("created_at"),
            }
        }).collect();

        Ok(list)
    }

    pub async fn approve_and_execute_step(
        app: Option<&AppHandle>,
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        prompt_content: &str,
        prompt_history_id: Option<&str>,
        engineer_edited: bool,
        override_provider_id: Option<&str>,
        override_model: Option<&str>,
    ) -> Result<AutoStepResult, AppError> {
        let mut logs = Vec::new();
        logs.push(format!("[ENGINEER] Approved prompt: \"{}\"", prompt_content));

        // 1. Execute Turn with authoritative provider/model resolution
        logs.push("[GENERATING] Submitting approved prompt to inference model...".to_string());
        let turn_result = ExecutionService::execute_turn(
            app,
            pool,
            vault,
            session_id,
            prompt_content,
            prompt_history_id,
            engineer_edited,
            override_provider_id,
            override_model,
        ).await?;
        logs.push(format!("[GENERATED] Received assistant turn ({} tokens, {}ms). Provider: {}, Model: {}",
            turn_result.assistant_message.token_count,
            turn_result.assistant_message.latency_ms,
            turn_result.assistant_message.provider_id.as_deref().unwrap_or("default"),
            turn_result.assistant_message.model.as_deref().unwrap_or("default")
        ));

        // 2. Evaluation
        logs.push(format!("[EVALUATING] Turn quality score: {:.2}, consistency: {:.2}, action: {}",
            turn_result.evaluation.quality_score, turn_result.evaluation.consistency_score, turn_result.evaluation.next_recommended_action));

        // 3. Update Context & Milestones
        logs.push("[UPDATING_CONTEXT] Narrative facts and milestone states updated.".to_string());

        let session = Self::get_session(pool, session_id).await?;
        let messages = Self::list_messages(pool, session_id).await?;
        let current_turns = messages.len() / 2;

        let is_completed = current_turns >= session.target_turns
            || turn_result.evaluation.next_recommended_action == "complete_session";

        if is_completed {
            let _ = sqlx::query(
                "UPDATE story_architect_sessions SET status = 'completed', updated_at = ? WHERE id = ?"
            )
            .bind(Utc::now().to_rfc3339())
            .bind(session_id)
            .execute(pool)
            .await;
            logs.push("[COMPLETED] Story interaction objectives fulfilled.".to_string());

            return Ok(AutoStepResult {
                action_taken: "completed".to_string(),
                session_status: "completed".to_string(),
                engine_state: "completed".to_string(),
                pause_reason: Some("Target interaction turns fulfilled".to_string()),
                prompt: None,
                message: Some(turn_result.assistant_message),
                evaluation: Some(turn_result.evaluation),
                narrative_state: Some(turn_result.updated_narrative_state),
                logs,
            });
        }

        // 4. Automatically plan next prompt for upcoming turn so engineer or auto-loop has it ready
        logs.push("[PLANNING] Planning agent evaluating narrative state to propose next prompt...".to_string());
        let next_prompt = PlanningAgentService::generate_next_prompt(pool, vault, session_id, None, override_provider_id, override_model).await?;
        logs.push(format!("[NEXT_PROMPT] Next prompt proposed for turn {}: \"{}\"", next_prompt.turn_index, next_prompt.prompt_content));

        Ok(AutoStepResult {
            action_taken: "cycle_completed".to_string(),
            session_status: "in_progress".to_string(),
            engine_state: "cycle_completed".to_string(),
            pause_reason: None,
            prompt: Some(next_prompt),
            message: Some(turn_result.assistant_message),
            evaluation: Some(turn_result.evaluation),
            narrative_state: Some(turn_result.updated_narrative_state),
            logs,
        })
    }

    pub async fn execute_autonomous_step(
        app: Option<&AppHandle>,
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        override_provider_id: Option<&str>,
        override_model: Option<&str>,
    ) -> Result<AutoStepResult, AppError> {
        let mut logs = Vec::new();
        let session = Self::get_session(pool, session_id).await?;

        if session.status == "completed" {
            logs.push("[STATUS] Interaction session is already marked completed.".to_string());
            return Ok(AutoStepResult {
                action_taken: "completed".to_string(),
                session_status: "completed".to_string(),
                engine_state: "completed".to_string(),
                pause_reason: Some("Target conversation turns reached and interaction completed".to_string()),
                prompt: None,
                message: None,
                evaluation: None,
                narrative_state: None,
                logs,
            });
        }

        let messages = Self::list_messages(pool, session_id).await?;
        let current_turns = messages.len() / 2; // user-assistant pairs

        // Check Hard Safety Budgets
        if current_turns >= session.max_turns {
            let reason = "Max conversation turns limit reached".to_string();
            let _ = Self::pause_session(pool, session_id, &reason).await;
            logs.push(format!("[PAUSED] Hard limit: {}", reason));
            return Ok(AutoStepResult {
                action_taken: "paused".to_string(),
                session_status: "paused".to_string(),
                engine_state: "paused".to_string(),
                pause_reason: Some(reason),
                prompt: None,
                message: None,
                evaluation: None,
                narrative_state: None,
                logs,
            });
        }

        if session.tokens_used >= session.token_budget {
            let reason = "Token execution budget exceeded".to_string();
            let _ = Self::pause_session(pool, session_id, &reason).await;
            logs.push(format!("[PAUSED] Hard limit: {}", reason));
            return Ok(AutoStepResult {
                action_taken: "paused".to_string(),
                session_status: "paused".to_string(),
                engine_state: "paused".to_string(),
                pause_reason: Some(reason),
                prompt: None,
                message: None,
                evaluation: None,
                narrative_state: None,
                logs,
            });
        }

        // Check Hybrid Pause Conditions
        if session.execution_mode == "hybrid" {
            // Check if last evaluation detected contradictions
            let last_eval = sqlx::query(
                "SELECT detected_contradictions_json, quality_score FROM agent_evaluations WHERE session_id = ? ORDER BY turn_index DESC LIMIT 1"
            )
            .bind(session_id)
            .fetch_optional(pool)
            .await?;

            if let Some(ev) = last_eval {
                let contra_str: String = ev.get("detected_contradictions_json");
                let contradictions: Vec<String> = serde_json::from_str(&contra_str).unwrap_or_default();
                let qual_score: Option<f64> = ev.get("quality_score");
                if !contradictions.is_empty() && session.auto_pause_conditions.contains(&"contradiction_detected".to_string()) {
                    let reason = format!("Agent detected contradiction: {}", contradictions.join(", "));
                    let _ = Self::pause_session(pool, session_id, &reason).await;
                    logs.push(format!("[HYBRID_PAUSE] {}", reason));
                    return Ok(AutoStepResult {
                        action_taken: "paused".to_string(),
                        session_status: "paused".to_string(),
                        engine_state: "paused".to_string(),
                        pause_reason: Some(reason),
                        prompt: None,
                        message: None,
                        evaluation: None,
                        narrative_state: None,
                        logs,
                    });
                }

                if qual_score.unwrap_or(1.0) < 0.70 && session.auto_pause_conditions.contains(&"quality_below_threshold".to_string()) {
                    let reason = "Response quality score below acceptance threshold (0.70)".to_string();
                    let _ = Self::pause_session(pool, session_id, &reason).await;
                    logs.push(format!("[HYBRID_PAUSE] {}", reason));
                    return Ok(AutoStepResult {
                        action_taken: "paused".to_string(),
                        session_status: "paused".to_string(),
                        engine_state: "paused".to_string(),
                        pause_reason: Some(reason),
                        prompt: None,
                        message: None,
                        evaluation: None,
                        narrative_state: None,
                        logs,
                    });
                }
            }
        }

        // 1. Get or generate proposed prompt
        let prompt_history = match PromptHistoryService::get_latest_proposed(pool, session_id).await? {
            Some(p) => {
                logs.push(format!("[PLANNING] Using proposed prompt (turn {}): \"{}\"", p.turn_index, p.prompt_content));
                p
            },
            None => {
                logs.push("[PLANNING] Planning agent generating prompt for upcoming turn...".to_string());
                let p = PlanningAgentService::generate_next_prompt(pool, vault, session_id, None, override_provider_id, override_model).await?;
                logs.push(format!("[PLANNING] Generated new prompt (turn {}): \"{}\"", p.turn_index, p.prompt_content));
                p
            }
        };

        // In Manual Review mode, pause and wait for approval
        if session.execution_mode == "manual" {
            logs.push("[MANUAL_REVIEW] Waiting for engineer approval before executing turn.".to_string());
            return Ok(AutoStepResult {
                action_taken: "prompt_generated".to_string(),
                session_status: session.status,
                engine_state: "awaiting_approval".to_string(),
                pause_reason: None,
                prompt: Some(prompt_history),
                message: None,
                evaluation: None,
                narrative_state: None,
                logs,
            });
        }

        // In Auto-Allow or permitted Hybrid, execute the FULL turn!
        logs.push(format!("[GENERATING] Submitting prompt to model: \"{}\"", prompt_history.prompt_content));
        let turn_result = ExecutionService::execute_turn(
            app,
            pool,
            vault,
            session_id,
            &prompt_history.prompt_content,
            Some(&prompt_history.id),
            false,
            override_provider_id,
            override_model,
        ).await?;
        logs.push(format!("[GENERATED] Assistant turn generated ({} tokens, {}ms). Provider: {}, Model: {}",
            turn_result.assistant_message.token_count,
            turn_result.assistant_message.latency_ms,
            turn_result.assistant_message.provider_id.as_deref().unwrap_or("default"),
            turn_result.assistant_message.model.as_deref().unwrap_or("default")
        ));

        // Evaluate Turn
        logs.push(format!("[EVALUATING] Quality score: {:.2}, Action: {}", turn_result.evaluation.quality_score, turn_result.evaluation.next_recommended_action));

        // Context updated
        logs.push("[UPDATING_CONTEXT] Narrative state and active milestones updated.".to_string());

        // Check completion condition
        let new_turn_count = (messages.len() + 2) / 2;
        let is_completed = new_turn_count >= session.target_turns
            || turn_result.evaluation.next_recommended_action == "complete_session";

        if is_completed {
            let _ = sqlx::query(
                "UPDATE story_architect_sessions SET status = 'completed', updated_at = ? WHERE id = ?"
            )
            .bind(Utc::now().to_rfc3339())
            .bind(session_id)
            .execute(pool)
            .await;
            logs.push("[COMPLETED] All interaction targets satisfied.".to_string());

            return Ok(AutoStepResult {
                action_taken: "turn_executed".to_string(),
                session_status: "completed".to_string(),
                engine_state: "completed".to_string(),
                pause_reason: Some("Target turns reached successfully".to_string()),
                prompt: Some(prompt_history),
                message: Some(turn_result.assistant_message),
                evaluation: Some(turn_result.evaluation),
                narrative_state: Some(turn_result.updated_narrative_state),
                logs,
            });
        }

        // Autonomous cycle continues: generate the next prompt immediately!
        logs.push("[NEXT_PROMPT] Planning agent generating next prompt for subsequent turn...".to_string());
        let next_prompt = PlanningAgentService::generate_next_prompt(pool, vault, session_id, None, override_provider_id, override_model).await?;
        logs.push(format!("[NEXT_PROMPT] Next prompt prepared: \"{}\"", next_prompt.prompt_content));

        Ok(AutoStepResult {
            action_taken: "turn_executed".to_string(),
            session_status: "in_progress".to_string(),
            engine_state: "cycle_completed".to_string(),
            pause_reason: None,
            prompt: Some(next_prompt),
            message: Some(turn_result.assistant_message),
            evaluation: Some(turn_result.evaluation),
            narrative_state: Some(turn_result.updated_narrative_state),
            logs,
        })
    }

    pub async fn pause_session(pool: &SqlitePool, session_id: &str, _reason: &str) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE story_architect_sessions SET status = 'paused', updated_at = ? WHERE id = ?"
        )
        .bind(&now)
        .bind(session_id)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn resume_session(pool: &SqlitePool, session_id: &str) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE story_architect_sessions SET status = 'in_progress', updated_at = ? WHERE id = ?"
        )
        .bind(&now)
        .bind(session_id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Commit the completed Story Architect conversation to Mechon SFT Corpus!
    pub async fn commit_to_sft(
        pool: &SqlitePool,
        input: CommitToSFTInput,
    ) -> Result<CommitToSFTResult, AppError> {
        let mut tx = pool.begin().await?;
        let now = Utc::now().to_rfc3339();

        let session = sqlx::query(
            "SELECT s.project_id, s.title, s.primary_language, s.secondary_language, s.interaction_type, s.sft_session_id, s.inference_provider_id, s.inference_model, p.premise FROM story_architect_sessions s LEFT JOIN planning_specifications p ON s.id = p.session_id WHERE s.id = ?"
        )
        .bind(&input.session_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Story session '{}' not found", input.session_id)))?;

        // Prevent duplicate commit
        let existing_sft_id: Option<String> = session.get("sft_session_id");
        if let Some(ref sft_id) = existing_sft_id {
            if !sft_id.trim().is_empty() {
                return Err(AppError::Validation(format!(
                    "Session '{}' has already been committed to SFT Corpus (linked SFT session ID: {})",
                    input.session_id, sft_id
                )));
            }
        }

        let session_project_id: String = session.get("project_id");
        let session_title: String = session.get("title");
        let session_primary_language: String = session.get("primary_language");
        let session_secondary_language: Option<String> = session.get("secondary_language");
        let session_interaction_type: String = session.get("interaction_type");
        let session_provider_id: Option<String> = session.get("inference_provider_id");
        let session_model: Option<String> = session.get("inference_model");
        let session_premise: Option<String> = session.get("premise");

        let messages = sqlx::query(
            "SELECT role, content, token_count, translations_json FROM story_architect_messages WHERE session_id = ? ORDER BY turn_index ASC"
        )
        .bind(&input.session_id)
        .fetch_all(&mut *tx)
        .await?;

        if messages.is_empty() {
            return Err(AppError::Validation("Cannot commit empty conversation to SFT Corpus".to_string()));
        }

        // Determine language mode
        let lang_mode = if session_secondary_language.is_some() { "bilingual" } else { "monolingual" };
        let s_lang = session_secondary_language.as_deref().unwrap_or("en");

        // 1. Generate IDs first so we can cross-reference
        let sft_session_id = format!("sft-{}", Uuid::new_v4());
        let sft_record_id = format!("rec-{}", Uuid::new_v4());
        let sft_title = input.title.unwrap_or(session_title);
        let system_prompt = session_premise.unwrap_or_default();

        // 2. Insert into sft_sessions with ALL NOT NULL fields satisfied!
        sqlx::query(
            r#"
            INSERT INTO sft_sessions (
                id, project_id, title, system_prompt, status, provider_id, model,
                temperature, top_p, max_tokens, committed_record_id,
                language_mode, primary_language, secondary_language, language_metadata_json,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'completed', ?, ?, 0.7, 0.9, 2048, ?, ?, ?, ?, '{}', ?, ?)
            "#,
        )
        .bind(&sft_session_id)
        .bind(&session_project_id)
        .bind(&sft_title)
        .bind(&system_prompt)
        .bind(&session_provider_id)
        .bind(&session_model)
        .bind(&sft_record_id)
        .bind(lang_mode)
        .bind(&session_primary_language)
        .bind(s_lang)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx)
        .await?;

        // 3. Insert SFT Messages
        let mut sft_messages_json = Vec::new();

        for (idx, m) in messages.iter().enumerate() {
            let msg_id = format!("msg-{}", Uuid::new_v4());
            let turn_i64 = idx as i64;
            let role: String = m.get("role");
            let content: String = m.get("content");
            let tok_i64: i64 = m.get::<Option<i64>, _>("token_count").unwrap_or(0);
            let trans_str: String = m.get("translations_json");

            sqlx::query(
                r#"
                INSERT INTO sft_messages (
                    id, session_id, sequence_order, role, content, token_count,
                    translations_json, translation_status_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?)
                "#,
            )
            .bind(&msg_id)
            .bind(&sft_session_id)
            .bind(turn_i64)
            .bind(&role)
            .bind(&content)
            .bind(tok_i64)
            .bind(&trans_str)
            .bind(&now)
            .execute(&mut *tx)
            .await?;

            sft_messages_json.push(serde_json::json!({
                "role": role,
                "content": content
            }));
        }

        // 4. Insert into SFT Records (Corpus)
        let msgs_str = serde_json::to_string(&sft_messages_json).unwrap_or_else(|_| "[]".to_string());
        let turn_count = sft_messages_json.len() as i64;
        let char_count = msgs_str.len() as i64;

        let provenance_meta = if input.include_planning_metadata {
            serde_json::json!({
                "source": "story_architect",
                "story_session_id": input.session_id,
                "interaction_type": session_interaction_type,
                "title": sft_title,
                "description": input.description,
                "committed_at": now
            })
        } else {
            serde_json::json!({
                "source": "story_architect",
                "title": sft_title,
                "description": input.description
            })
        };
        let prov_str = serde_json::to_string(&provenance_meta).unwrap_or_else(|_| "{}".to_string());

        sqlx::query(
            r#"
            INSERT INTO sft_records (
                id, project_id, session_id, messages_json, turn_count,
                character_count, language_mode, primary_language, secondary_language,
                language_metadata_json, metadata_json, revision, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, 1, ?, ?)
            "#,
        )
        .bind(&sft_record_id)
        .bind(&session_project_id)
        .bind(&sft_session_id)
        .bind(&msgs_str)
        .bind(turn_count)
        .bind(char_count)
        .bind(lang_mode)
        .bind(&session_primary_language)
        .bind(s_lang)
        .bind(&prov_str)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx)
        .await?;

        // 5. Update Story Session with linked SFT session id and completed status
        sqlx::query(
            "UPDATE story_architect_sessions SET sft_session_id = ?, status = 'completed', updated_at = ? WHERE id = ?"
        )
        .bind(&sft_session_id)
        .bind(&now)
        .bind(&input.session_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(CommitToSFTResult {
            sft_session_id,
            sft_record_id,
            message_count: messages.len(),
        })
    }

    pub async fn edit_message(
        pool: &SqlitePool,
        input: EditStoryMessageInput,
    ) -> Result<StoryMessage, AppError> {
        let now = Utc::now().to_rfc3339();

        // 1. Fetch current message
        let msg = sqlx::query(
            "SELECT id, session_id, turn_index, role, content, prompt_history_id, milestone_id, provider_id, model, token_count, latency_ms, translations_json, is_outdated, revision_count, updated_at, created_at FROM story_architect_messages WHERE id = ? AND session_id = ?"
        )
        .bind(&input.message_id)
        .bind(&input.session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Message '{}' not found in session '{}'", input.message_id, input.session_id)))?;

        let msg_id: String = msg.get("id");
        let turn_index: i64 = msg.get("turn_index");
        let role: String = msg.get("role");
        let old_content: String = msg.get("content");
        let prompt_history_id: Option<String> = msg.get("prompt_history_id");
        let milestone_id: Option<String> = msg.get("milestone_id");
        let provider_id: Option<String> = msg.get("provider_id");
        let model: Option<String> = msg.get("model");
        let latency_ms: i64 = msg.get::<Option<i64>, _>("latency_ms").unwrap_or(0);
        let trans_str: String = msg.get("translations_json");
        let translations: Value = serde_json::from_str(&trans_str).unwrap_or(serde_json::json!({}));
        let revision_count: i64 = msg.get::<Option<i64>, _>("revision_count").unwrap_or(0);
        let created_at: String = msg.get("created_at");

        // 2. Record revision
        let rev_id = format!("rev-{}", Uuid::new_v4());
        let reason = input.reason.unwrap_or_else(|| "User edited prompt/message".to_string());
        let meta = serde_json::json!({
            "edited_at": now,
            "turn_index": turn_index,
            "role": role,
        }).to_string();

        sqlx::query(
            r#"
            INSERT INTO story_architect_message_revisions (
                id, message_id, session_id, turn_index, role,
                original_content, modified_content, provider_id, model,
                revision_reason, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&rev_id)
        .bind(&msg_id)
        .bind(&input.session_id)
        .bind(turn_index)
        .bind(&role)
        .bind(&old_content)
        .bind(&input.content)
        .bind(&provider_id)
        .bind(&model)
        .bind(&reason)
        .bind(&meta)
        .bind(&now)
        .execute(pool)
        .await?;

        // 3. Update current message
        let new_token_count = (input.content.len() / 4).max(1) as i64;
        let new_rev_count = revision_count + 1;
        sqlx::query(
            "UPDATE story_architect_messages SET content = ?, token_count = ?, revision_count = ?, is_outdated = 0, updated_at = ? WHERE id = ?"
        )
        .bind(&input.content)
        .bind(new_token_count)
        .bind(new_rev_count)
        .bind(&now)
        .bind(&msg_id)
        .execute(pool)
        .await?;

        // 4. Invalidate downstream messages: any message with turn_index > this message's turn_index becomes outdated
        sqlx::query(
            "UPDATE story_architect_messages SET is_outdated = 1, updated_at = ? WHERE session_id = ? AND turn_index > ?"
        )
        .bind(&now)
        .bind(&input.session_id)
        .bind(turn_index)
        .execute(pool)
        .await?;

        // Also if this message had a prompt_history_id, update prompt history if needed
        if let Some(ref ph_id) = prompt_history_id {
            let _ = sqlx::query(
                "UPDATE planning_prompt_histories SET prompt_content = ?, status = 'edited' WHERE id = ?"
            )
            .bind(&input.content)
            .bind(ph_id)
            .execute(pool)
            .await;
        }

        Ok(StoryMessage {
            id: msg_id,
            session_id: input.session_id,
            turn_index: turn_index as usize,
            role,
            content: input.content,
            prompt_history_id,
            milestone_id,
            provider_id,
            model,
            token_count: new_token_count as usize,
            latency_ms: latency_ms as usize,
            translations,
            is_outdated: false,
            revision_count: new_rev_count as usize,
            updated_at: Some(now),
            created_at,
        })
    }

    pub async fn list_message_revisions(
        pool: &SqlitePool,
        message_id: &str,
    ) -> Result<Vec<StoryMessageRevision>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                id, message_id, session_id, turn_index, role,
                original_content, modified_content, provider_id, model,
                revision_reason, metadata_json, created_at
            FROM story_architect_message_revisions
            WHERE message_id = ?
            ORDER BY created_at DESC
            "#
        )
        .bind(message_id)
        .fetch_all(pool)
        .await?;

        let mut revisions = Vec::new();
        for r in rows {
            let meta_str: String = r.get("metadata_json");
            let metadata: Value = serde_json::from_str(&meta_str).unwrap_or(serde_json::json!({}));
            let turn_idx: i64 = r.get("turn_index");
            revisions.push(StoryMessageRevision {
                id: r.get("id"),
                message_id: r.get("message_id"),
                session_id: r.get("session_id"),
                turn_index: turn_idx as usize,
                role: r.get("role"),
                original_content: r.get("original_content"),
                modified_content: r.get("modified_content"),
                provider_id: r.get("provider_id"),
                model: r.get("model"),
                revision_reason: r.get("revision_reason"),
                metadata,
                created_at: r.get("created_at"),
            });
        }

        Ok(revisions)
    }

    pub async fn restore_message_revision(
        pool: &SqlitePool,
        input: RestoreRevisionInput,
    ) -> Result<StoryMessage, AppError> {
        let now = Utc::now().to_rfc3339();

        // 1. Fetch target revision
        let rev_row = sqlx::query(
            "SELECT id, message_id, session_id, turn_index, role, original_content, modified_content, provider_id, model FROM story_architect_message_revisions WHERE id = ? AND session_id = ?"
        )
        .bind(&input.revision_id)
        .bind(&input.session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Revision '{}' not found in session '{}'", input.revision_id, input.session_id)))?;

        let message_id: String = rev_row.get("message_id");
        let content_to_restore: String = rev_row.get("original_content");

        // 2. Fetch current message state
        let msg_row = sqlx::query(
            "SELECT content, turn_index, role, prompt_history_id, milestone_id, provider_id, model, latency_ms, translations_json, revision_count, created_at FROM story_architect_messages WHERE id = ?"
        )
        .bind(&message_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Message '{}' not found", message_id)))?;

        let current_content: String = msg_row.get("content");
        let turn_index: i64 = msg_row.get("turn_index");
        let role: String = msg_row.get("role");
        let prompt_history_id: Option<String> = msg_row.get("prompt_history_id");
        let milestone_id: Option<String> = msg_row.get("milestone_id");
        let provider_id: Option<String> = msg_row.get("provider_id");
        let model: Option<String> = msg_row.get("model");
        let latency_ms: i64 = msg_row.get::<Option<i64>, _>("latency_ms").unwrap_or(0);
        let trans_str: String = msg_row.get("translations_json");
        let translations: Value = serde_json::from_str(&trans_str).unwrap_or(serde_json::json!({}));
        let revision_count: i64 = msg_row.get::<Option<i64>, _>("revision_count").unwrap_or(0);
        let created_at: String = msg_row.get("created_at");

        // 3. Save snapshot before restoring
        let new_rev_id = format!("rev-{}", Uuid::new_v4());
        let meta = serde_json::json!({
            "restored_from_revision_id": input.revision_id,
            "restored_at": now,
        }).to_string();

        sqlx::query(
            r#"
            INSERT INTO story_architect_message_revisions (
                id, message_id, session_id, turn_index, role,
                original_content, modified_content, provider_id, model,
                revision_reason, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'restore_previous_revision', ?, ?)
            "#,
        )
        .bind(&new_rev_id)
        .bind(&message_id)
        .bind(&input.session_id)
        .bind(turn_index)
        .bind(&role)
        .bind(&current_content)
        .bind(&content_to_restore)
        .bind(&provider_id)
        .bind(&model)
        .bind(&meta)
        .bind(&now)
        .execute(pool)
        .await?;

        // 4. Restore message
        let new_token_count = (content_to_restore.len() / 4).max(1) as i64;
        let new_rev_count = revision_count + 1;
        sqlx::query(
            "UPDATE story_architect_messages SET content = ?, token_count = ?, revision_count = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&content_to_restore)
        .bind(new_token_count)
        .bind(new_rev_count)
        .bind(&now)
        .bind(&message_id)
        .execute(pool)
        .await?;

        // 5. Invalidate downstream messages
        sqlx::query(
            "UPDATE story_architect_messages SET is_outdated = 1, updated_at = ? WHERE session_id = ? AND turn_index > ?"
        )
        .bind(&now)
        .bind(&input.session_id)
        .bind(turn_index)
        .execute(pool)
        .await?;

        Ok(StoryMessage {
            id: message_id,
            session_id: input.session_id,
            turn_index: turn_index as usize,
            role,
            content: content_to_restore,
            prompt_history_id,
            milestone_id,
            provider_id,
            model,
            token_count: new_token_count as usize,
            latency_ms: latency_ms as usize,
            translations,
            is_outdated: false,
            revision_count: new_rev_count as usize,
            updated_at: Some(now),
            created_at,
        })
    }

    pub async fn regenerate_assistant_turn(
        app: Option<&AppHandle>,
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        input: RegenerateAssistantTurnInput,
    ) -> Result<ExecutionTurnResult, AppError> {
        ExecutionService::regenerate_turn(
            app,
            pool,
            vault,
            &input.session_id,
            input.turn_index,
            input.provider_id.as_deref(),
            input.model.as_deref(),
        ).await
    }

    pub fn get_default_milestones_for_type(interaction_type: &str) -> Vec<(&'static str, &'static str, &'static str)> {
        match interaction_type {
            "storytelling" => vec![
                ("Introduction & Setting the Scene", "Introduce the protagonist, world premise, and initial circumstances.", "Establish the narrative foundation and character voice"),
                ("Inciting Incident", "Introduce the catalyst that disrupts the status quo.", "Introduce the initial challenge or mystery"),
                ("Rising Action & Complication", "Escalate tensions and reveal secondary obstacles.", "Develop conflict and deepen character motivation"),
                ("Climax & Confrontation", "Direct confrontation with the central conflict.", "Reach the highest point of dramatic tension"),
                ("Resolution & Aftermath", "Resolve the conflict and establish the new status quo.", "Conclude the arc and synthesize outcomes"),
            ],
            "interactive_roleplay" => vec![
                ("Character Greeting & Baseline", "Establish character persona, context, and immediate environment.", "Demonstrate distinctive persona and tone"),
                ("Scenario Unfolding", "Engage with character dilemmas and choices.", "Explore character backstory and motivations"),
                ("Climactic Decision", "Make a pivotal interaction choice with consequences.", "Handle moral or emotional ambiguity"),
                ("Reflective Denouement", "Debrief the encounter and establish relationship state.", "Conclude roleplay interaction"),
            ],
            "technical_discussion" => vec![
                ("Problem Definition & Scope", "Outline architectural constraints and technical problem statement.", "Clarify system requirements and invariants"),
                ("Trade-Off Analysis", "Compare architectural approaches and bottlenecks.", "Evaluate latency, throughput, and complexity"),
                ("Concrete Implementation", "Provide code examples or detailed system specs.", "Demonstrate rigorous, verified technical reasoning"),
                ("Edge Cases & Failure Modes", "Audit corner cases, reliability, and security.", "Address resilience and recovery strategies"),
            ],
            "educational_tutoring" => vec![
                ("Diagnostic Assessment", "Assess current understanding and foundational knowledge.", "Identify conceptual gaps and prior intuition"),
                ("Core Principle Exploration", "Explain fundamental mechanics with intuitive analogies.", "Break down complex mechanisms step by step"),
                ("Guided Practice & Inquiry", "Test application with probing questions.", "Guide student through active problem solving"),
                ("Synthesis & Mastery Check", "Encourage self-explanation and verify mastery.", "Synthesize key learnings into mental models"),
            ],
            "interview_simulation" => vec![
                ("Opening & Introduction", "Welcome candidate, set expectations, review background.", "Assess communication baseline"),
                ("Competency Deep-Dive", "Probe technical or behavioral competence with STAR method.", "Evaluate depth of experience and problem solving"),
                ("Stress / Pressure Scenario", "Present an unexpected constraint or ambiguous crisis.", "Assess composure and prioritization"),
                ("Candidate Q&A & Wrap-up", "Answer candidate questions and summarize feedback.", "Provide constructive concluding evaluation"),
            ],
            "debate" => vec![
                ("Opening Statements", "State opening thesis and define scope of motion.", "Establish core propositions"),
                ("Rebuttal & Cross-Examination", "Challenge opponent premises and expose contradictions.", "Counter evidence and address weak assumptions"),
                ("Defensive Clarification", "Reinforce original arguments under scrutiny.", "Refine nuanced positions"),
                ("Closing Arguments", "Deliver persuasive closing appeal comparing frameworks.", "Summarize comparative advantage"),
            ],
            "customer_support_simulation" => vec![
                ("Issue Triage & Empathy", "Acknowledge frustration, extract symptom details.", "Demonstrate empathetic active listening"),
                ("Root Cause Investigation", "Guide diagnostic steps systematically.", "Isolate user error vs service defect"),
                ("Actionable Remediation", "Deliver clear, step-by-step resolution instructions.", "Verify resolution and guide user through fix"),
                ("Delight & Preventive Guidance", "Offer follow-up resources and confirm satisfaction.", "Close ticket with exceptional professionalism"),
            ],
            _ => vec![
                ("Phase 1: Initiation", "Establish context, objectives, and initial positions.", "Initiate interaction cleanly"),
                ("Phase 2: Deep Dive", "Explore core subject matter and complications.", "Develop substantive exchange"),
                ("Phase 3: Conclusion", "Synthesize outcomes and reach conclusion criteria.", "Finalize interaction objectives"),
            ],
        }
    }
}
