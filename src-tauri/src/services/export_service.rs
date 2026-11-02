use sqlx::SqlitePool;
use serde_json::{json, Value};
use uuid::Uuid;
use chrono::Utc;
use crate::errors::AppError;

pub struct ExportService;

impl ExportService {
    pub async fn export_sft(
        pool: &SqlitePool,
        project_id: &str,
        format_type: &str,
        include_metadata: bool,
    ) -> Result<String, AppError> {
        let (records, _) = crate::services::dataset_service::DatasetService::list_sft_records(
            pool,
            project_id,
            None,
            None,
            100000,
            0,
        ).await?;

        match format_type.to_lowercase().as_str() {
            "json" => {
                let items: Vec<Value> = records.into_iter().map(|r| {
                    if include_metadata {
                        json!({
                            "id": r.id,
                            "messages": r.messages,
                            "turn_count": r.turn_count,
                            "character_count": r.character_count,
                            "metadata": r.metadata,
                            "created_at": r.created_at
                        })
                    } else {
                        json!({
                            "messages": r.messages
                        })
                    }
                }).collect();
                Ok(serde_json::to_string_pretty(&items)?)
            }
            "csv" => {
                let mut wtr = csv::Writer::from_writer(vec![]);
                if include_metadata {
                    wtr.write_record(&["id", "messages", "turn_count", "metadata", "created_at"])
                        .map_err(|e| AppError::Internal(e.to_string()))?;
                    for r in records {
                        wtr.write_record(&[
                            r.id,
                            r.messages.to_string(),
                            r.turn_count.to_string(),
                            r.metadata.to_string(),
                            r.created_at,
                        ]).map_err(|e| AppError::Internal(e.to_string()))?;
                    }
                } else {
                    wtr.write_record(&["messages"]).map_err(|e| AppError::Internal(e.to_string()))?;
                    for r in records {
                        wtr.write_record(&[r.messages.to_string()]).map_err(|e| AppError::Internal(e.to_string()))?;
                    }
                }
                let bytes = wtr.into_inner().map_err(|e| AppError::Internal(e.to_string()))?;
                Ok(String::from_utf8_lossy(&bytes).to_string())
            }
            _ => {
                // Default: JSONL
                let mut lines = Vec::new();
                for r in records {
                    let obj = if include_metadata {
                        json!({
                            "id": r.id,
                            "messages": r.messages,
                            "turn_count": r.turn_count,
                            "character_count": r.character_count,
                            "metadata": r.metadata,
                            "created_at": r.created_at
                        })
                    } else {
                        json!({
                            "messages": r.messages
                        })
                    };
                    lines.push(serde_json::to_string(&obj)?);
                }
                Ok(lines.join("\n"))
            }
        }
    }

    pub async fn export_dpo(
        pool: &SqlitePool,
        project_id: &str,
        format_type: &str,
        include_metadata: bool,
        only_completed: bool,
    ) -> Result<String, AppError> {
        let (tasks, _) = crate::services::dpo_service::DPOService::list(
            pool,
            project_id,
            if only_completed { Some("completed") } else { None },
            None,
            100000,
            0,
        ).await?;

        let items: Vec<Value> = tasks.into_iter().filter_map(|t| {
            let (chosen, rejected, is_definitive) = match t.preference.as_deref() {
                Some("a") => (Some(&t.response_a), Some(&t.response_b), true),
                Some("b") => (Some(&t.response_b), Some(&t.response_a), true),
                Some("tie") => (Some(&t.response_a), Some(&t.response_b), false),
                Some("both_bad") => (None, None, false),
                _ => (None, None, false),
            };

            if only_completed && !is_definitive && t.preference.as_deref() != Some("tie") {
                return None;
            }

            let mut obj = serde_json::Map::new();
            obj.insert("prompt".to_string(), json!(t.prompt));
            if let Some(sys) = t.system_prompt {
                if !sys.is_empty() {
                    obj.insert("system_prompt".to_string(), json!(sys));
                }
            }
            if let Some(c) = chosen {
                obj.insert("chosen".to_string(), json!(c));
            }
            if let Some(r) = rejected {
                obj.insert("rejected".to_string(), json!(r));
            }
            obj.insert("preference".to_string(), json!(t.preference));

            if include_metadata {
                obj.insert("id".to_string(), json!(t.id));
                obj.insert("status".to_string(), json!(t.status));
                obj.insert("rationale".to_string(), json!(t.rationale));
                obj.insert("helpfulness_rating".to_string(), json!(t.helpfulness_rating));
                obj.insert("factuality_rating".to_string(), json!(t.factuality_rating));
                obj.insert("metadata".to_string(), t.metadata);
            }

            Some(Value::Object(obj))
        }).collect();

        match format_type.to_lowercase().as_str() {
            "json" => Ok(serde_json::to_string_pretty(&items)?),
            "csv" => {
                let mut wtr = csv::Writer::from_writer(vec![]);
                wtr.write_record(&["prompt", "chosen", "rejected", "preference"])
                    .map_err(|e| AppError::Internal(e.to_string()))?;
                for it in &items {
                    wtr.write_record(&[
                        it.get("prompt").and_then(|v| v.as_str()).unwrap_or(""),
                        it.get("chosen").and_then(|v| v.as_str()).unwrap_or(""),
                        it.get("rejected").and_then(|v| v.as_str()).unwrap_or(""),
                        it.get("preference").and_then(|v| v.as_str()).unwrap_or(""),
                    ]).map_err(|e| AppError::Internal(e.to_string()))?;
                }
                let bytes = wtr.into_inner().map_err(|e| AppError::Internal(e.to_string()))?;
                Ok(String::from_utf8_lossy(&bytes).to_string())
            }
            _ => {
                let lines: Result<Vec<String>, _> = items.into_iter().map(|it| serde_json::to_string(&it)).collect();
                Ok(lines?.join("\n"))
            }
        }
    }

    pub async fn import_content(
        pool: &SqlitePool,
        project_id: &str,
        content: &str,
    ) -> Result<serde_json::Value, AppError> {
        let mut imported_sft = 0;
        let mut imported_dpo = 0;
        let now = Utc::now().to_rfc3339();

        // Check if content is array JSON
        if let Ok(Value::Array(items)) = serde_json::from_str::<Value>(content) {
            for it in items {
                if let Some(messages) = it.get("messages") {
                    let id = Uuid::new_v4().to_string();
                    let turns = messages.as_array().map(|a| a.len() as i64).unwrap_or(0);
                    let char_count = messages.to_string().len() as i64;
                    sqlx::query(
                        "INSERT INTO sft_records (id, project_id, messages_json, turn_count, character_count, metadata_json, revision, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, '{}', 1, ?, ?)"
                    )
                    .bind(&id)
                    .bind(project_id)
                    .bind(&messages.to_string())
                    .bind(turns)
                    .bind(char_count)
                    .bind(&now)
                    .bind(&now)
                    .execute(pool)
                    .await?;
                    imported_sft += 1;
                } else if let Some(prompt) = it.get("prompt").and_then(|v| v.as_str()) {
                    let resp_a = it.get("chosen").or_else(|| it.get("response_a")).and_then(|v| v.as_str()).unwrap_or("");
                    let resp_b = it.get("rejected").or_else(|| it.get("response_b")).and_then(|v| v.as_str()).unwrap_or("");
                    let pref = it.get("preference").and_then(|v| v.as_str()).unwrap_or("a");
                    let id = Uuid::new_v4().to_string();
                    sqlx::query(
                        "INSERT INTO dpo_tasks (id, project_id, prompt, response_a, response_b, preference, status, metadata_json, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, 'completed', '{}', ?, ?)"
                    )
                    .bind(&id)
                    .bind(project_id)
                    .bind(prompt)
                    .bind(resp_a)
                    .bind(resp_b)
                    .bind(pref)
                    .bind(&now)
                    .bind(&now)
                    .execute(pool)
                    .await?;
                    imported_dpo += 1;
                }
            }
        } else {
            // Treat as JSONL
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() { continue; }
                if let Ok(it) = serde_json::from_str::<Value>(trimmed) {
                    if let Some(messages) = it.get("messages") {
                        let id = Uuid::new_v4().to_string();
                        let turns = messages.as_array().map(|a| a.len() as i64).unwrap_or(0);
                        let char_count = messages.to_string().len() as i64;
                        sqlx::query(
                            "INSERT INTO sft_records (id, project_id, messages_json, turn_count, character_count, metadata_json, revision, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, '{}', 1, ?, ?)"
                        )
                        .bind(&id)
                        .bind(project_id)
                        .bind(&messages.to_string())
                        .bind(turns)
                        .bind(char_count)
                        .bind(&now)
                        .bind(&now)
                        .execute(pool)
                        .await?;
                        imported_sft += 1;
                    } else if let Some(prompt) = it.get("prompt").and_then(|v| v.as_str()) {
                        let resp_a = it.get("chosen").or_else(|| it.get("response_a")).and_then(|v| v.as_str()).unwrap_or("");
                        let resp_b = it.get("rejected").or_else(|| it.get("response_b")).and_then(|v| v.as_str()).unwrap_or("");
                        let pref = it.get("preference").and_then(|v| v.as_str()).unwrap_or("a");
                        let id = Uuid::new_v4().to_string();
                        sqlx::query(
                            "INSERT INTO dpo_tasks (id, project_id, prompt, response_a, response_b, preference, status, metadata_json, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, 'completed', '{}', ?, ?)"
                        )
                        .bind(&id)
                        .bind(project_id)
                        .bind(prompt)
                        .bind(resp_a)
                        .bind(resp_b)
                        .bind(pref)
                        .bind(&now)
                        .bind(&now)
                        .execute(pool)
                        .await?;
                        imported_dpo += 1;
                    }
                }
            }
        }

        Ok(json!({
            "imported_sft_records": imported_sft,
            "imported_dpo_tasks": imported_dpo,
            "total_imported": imported_sft + imported_dpo
        }))
    }
}
