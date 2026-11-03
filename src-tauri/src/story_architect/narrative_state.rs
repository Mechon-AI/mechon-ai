use sqlx::{Row, SqlitePool};
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use crate::errors::AppError;
use super::models::NarrativeState;

pub struct NarrativeStateService;

impl NarrativeStateService {
    pub async fn get_latest(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<Option<NarrativeState>, AppError> {
        let r = sqlx::query(
            "SELECT id, session_id, turn_index, current_arc, current_scene,
                    current_objective, character_states_json, relationship_states_json,
                    established_facts_json, unresolved_conflicts_json,
                    completed_milestones_json, active_milestones_json,
                    next_objective, completion_status, created_at
             FROM narrative_states
             WHERE session_id = ?
             ORDER BY turn_index DESC, created_at DESC
             LIMIT 1"
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?;

        Ok(r.map(|r| {
            let char_str: String = r.get("character_states_json");
            let rel_str: String = r.get("relationship_states_json");
            let facts_str: String = r.get("established_facts_json");
            let conflicts_str: String = r.get("unresolved_conflicts_json");
            let completed_str: String = r.get("completed_milestones_json");
            let active_str: String = r.get("active_milestones_json");
            let turn_i64: i64 = r.get("turn_index");

            let character_states = serde_json::from_str(&char_str).unwrap_or_else(|_| serde_json::json!({}));
            let relationship_states = serde_json::from_str(&rel_str).unwrap_or_else(|_| serde_json::json!({}));
            let established_facts = serde_json::from_str(&facts_str).unwrap_or_default();
            let unresolved_conflicts = serde_json::from_str(&conflicts_str).unwrap_or_default();
            let completed_milestones = serde_json::from_str(&completed_str).unwrap_or_default();
            let active_milestones = serde_json::from_str(&active_str).unwrap_or_default();

            NarrativeState {
                id: r.get("id"),
                session_id: r.get("session_id"),
                turn_index: turn_i64 as usize,
                current_arc: r.get("current_arc"),
                current_scene: r.get("current_scene"),
                current_objective: r.get("current_objective"),
                character_states,
                relationship_states,
                established_facts,
                unresolved_conflicts,
                completed_milestones,
                active_milestones,
                next_objective: r.get("next_objective"),
                completion_status: r.get("completion_status"),
                created_at: r.get("created_at"),
            }
        }))
    }

    pub async fn create_initial_state(
        pool: &SqlitePool,
        session_id: &str,
        premise: &str,
        initial_objective: &str,
        first_milestone_id: Option<&str>,
    ) -> Result<NarrativeState, AppError> {
        let id = format!("ns-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let established_facts = if premise.trim().is_empty() {
            vec![]
        } else {
            vec![format!("Premise established: {}", premise.trim())]
        };
        let active_milestones = first_milestone_id.map(|m| vec![m.to_string()]).unwrap_or_default();

        let facts_json = serde_json::to_string(&established_facts).unwrap_or_else(|_| "[]".to_string());
        let active_milestones_json = serde_json::to_string(&active_milestones).unwrap_or_else(|_| "[]".to_string());

        sqlx::query(
            "INSERT INTO narrative_states (
                id, session_id, turn_index, current_arc, current_scene,
                current_objective, character_states_json, relationship_states_json,
                established_facts_json, unresolved_conflicts_json,
                completed_milestones_json, active_milestones_json,
                next_objective, completion_status, created_at
            ) VALUES (?, ?, 0, 'Beginning', 'Scene 1: Introduction', ?, '{}', '{}', ?, '[]', '[]', ?, ?, 'in_progress', ?)"
        )
        .bind(&id)
        .bind(session_id)
        .bind(initial_objective)
        .bind(&facts_json)
        .bind(&active_milestones_json)
        .bind(initial_objective)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(NarrativeState {
            id,
            session_id: session_id.to_string(),
            turn_index: 0,
            current_arc: Some("Beginning".to_string()),
            current_scene: Some("Scene 1: Introduction".to_string()),
            current_objective: Some(initial_objective.to_string()),
            character_states: serde_json::json!({}),
            relationship_states: serde_json::json!({}),
            established_facts,
            unresolved_conflicts: vec![],
            completed_milestones: vec![],
            active_milestones,
            next_objective: Some(initial_objective.to_string()),
            completion_status: "in_progress".to_string(),
            created_at: now,
        })
    }

    pub async fn append_state(
        pool: &SqlitePool,
        session_id: &str,
        turn_index: usize,
        current_arc: Option<&str>,
        current_scene: Option<&str>,
        current_objective: Option<&str>,
        character_states: &Value,
        relationship_states: &Value,
        established_facts: &[String],
        unresolved_conflicts: &[String],
        completed_milestones: &[String],
        active_milestones: &[String],
        next_objective: Option<&str>,
        completion_status: &str,
    ) -> Result<NarrativeState, AppError> {
        let id = format!("ns-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let turn_i64 = turn_index as i64;

        let char_str = serde_json::to_string(character_states).unwrap_or_else(|_| "{}".to_string());
        let rel_str = serde_json::to_string(relationship_states).unwrap_or_else(|_| "{}".to_string());
        let facts_str = serde_json::to_string(established_facts).unwrap_or_else(|_| "[]".to_string());
        let conflicts_str = serde_json::to_string(unresolved_conflicts).unwrap_or_else(|_| "[]".to_string());
        let completed_str = serde_json::to_string(completed_milestones).unwrap_or_else(|_| "[]".to_string());
        let active_str = serde_json::to_string(active_milestones).unwrap_or_else(|_| "[]".to_string());

        sqlx::query(
            "INSERT INTO narrative_states (
                id, session_id, turn_index, current_arc, current_scene,
                current_objective, character_states_json, relationship_states_json,
                established_facts_json, unresolved_conflicts_json,
                completed_milestones_json, active_milestones_json,
                next_objective, completion_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(session_id)
        .bind(turn_i64)
        .bind(current_arc)
        .bind(current_scene)
        .bind(current_objective)
        .bind(&char_str)
        .bind(&rel_str)
        .bind(&facts_str)
        .bind(&conflicts_str)
        .bind(&completed_str)
        .bind(&active_str)
        .bind(next_objective)
        .bind(completion_status)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(NarrativeState {
            id,
            session_id: session_id.to_string(),
            turn_index,
            current_arc: current_arc.map(|s| s.to_string()),
            current_scene: current_scene.map(|s| s.to_string()),
            current_objective: current_objective.map(|s| s.to_string()),
            character_states: character_states.clone(),
            relationship_states: relationship_states.clone(),
            established_facts: established_facts.to_vec(),
            unresolved_conflicts: unresolved_conflicts.to_vec(),
            completed_milestones: completed_milestones.to_vec(),
            active_milestones: active_milestones.to_vec(),
            next_objective: next_objective.map(|s| s.to_string()),
            completion_status: completion_status.to_string(),
            created_at: now,
        })
    }
}
