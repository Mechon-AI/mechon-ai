use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use chrono::Utc;
use crate::errors::AppError;
use super::models::PlanningPromptHistory;

pub struct PromptHistoryService;

impl PromptHistoryService {
    pub async fn list_for_session(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<Vec<PlanningPromptHistory>, AppError> {
        let rows = sqlx::query(
            "SELECT id, session_id, turn_index, prompt_content, current_objective,
                    related_milestone_id, expected_outcome, contextual_rationale,
                    suggested_parameters_json, status, engineer_notes, created_at
             FROM planning_prompt_history
             WHERE session_id = ?
             ORDER BY turn_index ASC, created_at ASC"
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        let list = rows.into_iter().map(|r| {
            let params_str: String = r.get("suggested_parameters_json");
            let suggested_parameters = serde_json::from_str(&params_str)
                .unwrap_or_else(|_| serde_json::json!({}));

            let turn_i64: i64 = r.get("turn_index");

            PlanningPromptHistory {
                id: r.get("id"),
                session_id: r.get("session_id"),
                turn_index: turn_i64 as usize,
                prompt_content: r.get("prompt_content"),
                current_objective: r.get("current_objective"),
                related_milestone_id: r.get("related_milestone_id"),
                expected_outcome: r.get("expected_outcome"),
                contextual_rationale: r.get("contextual_rationale"),
                suggested_parameters,
                status: r.get("status"),
                engineer_notes: r.get("engineer_notes"),
                created_at: r.get("created_at"),
            }
        }).collect();

        Ok(list)
    }

    pub async fn get_latest_proposed(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<Option<PlanningPromptHistory>, AppError> {
        let r = sqlx::query(
            "SELECT id, session_id, turn_index, prompt_content, current_objective,
                    related_milestone_id, expected_outcome, contextual_rationale,
                    suggested_parameters_json, status, engineer_notes, created_at
             FROM planning_prompt_history
             WHERE session_id = ? AND status IN ('proposed', 'edited')
             ORDER BY created_at DESC
             LIMIT 1"
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?;

        Ok(r.map(|r| {
            let params_str: String = r.get("suggested_parameters_json");
            let suggested_parameters = serde_json::from_str(&params_str)
                .unwrap_or_else(|_| serde_json::json!({}));

            let turn_i64: i64 = r.get("turn_index");

            PlanningPromptHistory {
                id: r.get("id"),
                session_id: r.get("session_id"),
                turn_index: turn_i64 as usize,
                prompt_content: r.get("prompt_content"),
                current_objective: r.get("current_objective"),
                related_milestone_id: r.get("related_milestone_id"),
                expected_outcome: r.get("expected_outcome"),
                contextual_rationale: r.get("contextual_rationale"),
                suggested_parameters,
                status: r.get("status"),
                engineer_notes: r.get("engineer_notes"),
                created_at: r.get("created_at"),
            }
        }))
    }

    pub async fn record_prompt(
        pool: &SqlitePool,
        session_id: &str,
        turn_index: usize,
        prompt_content: &str,
        current_objective: &str,
        related_milestone_id: Option<&str>,
        expected_outcome: Option<&str>,
        contextual_rationale: Option<&str>,
        suggested_params: &serde_json::Value,
    ) -> Result<PlanningPromptHistory, AppError> {
        let id = format!("ph-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let turn_i64 = turn_index as i64;
        let params_str = serde_json::to_string(suggested_params).unwrap_or_else(|_| "{}".to_string());

        sqlx::query(
            "INSERT INTO planning_prompt_history (
                id, session_id, turn_index, prompt_content, current_objective,
                related_milestone_id, expected_outcome, contextual_rationale,
                suggested_parameters_json, status, engineer_notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', NULL, ?)"
        )
        .bind(&id)
        .bind(session_id)
        .bind(turn_i64)
        .bind(prompt_content)
        .bind(current_objective)
        .bind(related_milestone_id)
        .bind(expected_outcome)
        .bind(contextual_rationale)
        .bind(&params_str)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(PlanningPromptHistory {
            id,
            session_id: session_id.to_string(),
            turn_index,
            prompt_content: prompt_content.to_string(),
            current_objective: current_objective.to_string(),
            related_milestone_id: related_milestone_id.map(|s| s.to_string()),
            expected_outcome: expected_outcome.map(|s| s.to_string()),
            contextual_rationale: contextual_rationale.map(|s| s.to_string()),
            suggested_parameters: suggested_params.clone(),
            status: "proposed".to_string(),
            engineer_notes: None,
            created_at: now,
        })
    }

    pub async fn update_status(
        pool: &SqlitePool,
        prompt_id: &str,
        status: &str,
        edited_content: Option<&str>,
        engineer_notes: Option<&str>,
    ) -> Result<(), AppError> {
        if let Some(content) = edited_content {
            sqlx::query(
                "UPDATE planning_prompt_history
                 SET status = ?, prompt_content = ?, engineer_notes = COALESCE(?, engineer_notes)
                 WHERE id = ?"
            )
            .bind(status)
            .bind(content)
            .bind(engineer_notes)
            .bind(prompt_id)
            .execute(pool)
            .await?;
        } else {
            sqlx::query(
                "UPDATE planning_prompt_history
                 SET status = ?, engineer_notes = COALESCE(?, engineer_notes)
                 WHERE id = ?"
            )
            .bind(status)
            .bind(engineer_notes)
            .bind(prompt_id)
            .execute(pool)
            .await?;
        }
        Ok(())
    }
}
