use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use serde_json::{json, Value};
use crate::errors::AppError;
use crate::models::{
    SFTCommitInput, SFTMessage, SFTMessageCreateInput, SFTRecord, SFTSession,
    SFTSessionCreateInput, SFTSessionUpdateInput,
};

pub struct SFTService;

impl SFTService {
    pub async fn list_sessions(
        pool: &SqlitePool,
        project_id: &str,
        status: Option<&str>,
    ) -> Result<Vec<SFTSession>, AppError> {
        let (sql, bind_status) = match status {
            Some(s) if !s.is_empty() => (
                "SELECT id, project_id, title, system_prompt, status, provider_id, model, temperature, top_p, max_tokens, committed_record_id, created_at, updated_at
                 FROM sft_sessions
                 WHERE project_id = ? AND status = ?
                 ORDER BY updated_at DESC",
                Some(s),
            ),
            _ => (
                "SELECT id, project_id, title, system_prompt, status, provider_id, model, temperature, top_p, max_tokens, committed_record_id, created_at, updated_at
                 FROM sft_sessions
                 WHERE project_id = ?
                 ORDER BY updated_at DESC",
                None,
            ),
        };

        let rows = if let Some(s) = bind_status {
            sqlx::query_as::<_, (String, String, String, String, String, Option<String>, Option<String>, f64, f64, i64, Option<String>, String, String)>(sql)
                .bind(project_id)
                .bind(s)
                .fetch_all(pool)
                .await?
        } else {
            sqlx::query_as::<_, (String, String, String, String, String, Option<String>, Option<String>, f64, f64, i64, Option<String>, String, String)>(sql)
                .bind(project_id)
                .fetch_all(pool)
                .await?
        };

        let mut sessions = Vec::new();
        for r in rows {
            let messages = Self::get_messages(pool, &r.0).await?;
            sessions.push(SFTSession {
                id: r.0,
                project_id: r.1,
                title: r.2,
                system_prompt: r.3,
                status: r.4,
                provider_id: r.5,
                model: r.6,
                temperature: r.7,
                top_p: r.8,
                max_tokens: r.9,
                committed_record_id: r.10,
                messages,
                created_at: r.11,
                updated_at: r.12,
            });
        }

        Ok(sessions)
    }

    pub async fn get_session(pool: &SqlitePool, session_id: &str) -> Result<SFTSession, AppError> {
        let row = sqlx::query_as::<_, (String, String, String, String, String, Option<String>, Option<String>, f64, f64, i64, Option<String>, String, String)>(
            "SELECT id, project_id, title, system_prompt, status, provider_id, model, temperature, top_p, max_tokens, committed_record_id, created_at, updated_at
             FROM sft_sessions
             WHERE id = ?"
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("SFT session {} not found", session_id)))?;

        let messages = Self::get_messages(pool, session_id).await?;

        Ok(SFTSession {
            id: row.0,
            project_id: row.1,
            title: row.2,
            system_prompt: row.3,
            status: row.4,
            provider_id: row.5,
            model: row.6,
            temperature: row.7,
            top_p: row.8,
            max_tokens: row.9,
            committed_record_id: row.10,
            messages,
            created_at: row.11,
            updated_at: row.12,
        })
    }

    pub async fn get_messages(pool: &SqlitePool, session_id: &str) -> Result<Vec<SFTMessage>, AppError> {
        let rows = sqlx::query_as::<_, (String, String, String, String, i64, Option<String>, i64, String)>(
            "SELECT id, session_id, role, content, sequence_order, model, token_count, created_at
             FROM sft_messages
             WHERE session_id = ?
             ORDER BY sequence_order ASC"
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        let messages = rows.into_iter().map(|r| SFTMessage {
            id: r.0,
            session_id: r.1,
            role: r.2,
            content: r.3,
            sequence_order: r.4,
            model: r.5,
            token_count: r.6,
            created_at: r.7,
        }).collect();

        Ok(messages)
    }

    pub async fn create_session(pool: &SqlitePool, input: SFTSessionCreateInput) -> Result<SFTSession, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let title = input.title.unwrap_or_else(|| "Untitled Conversation".to_string());
        let system_prompt = input.system_prompt.unwrap_or_else(|| "You are a helpful, respectful, and honest assistant.".to_string());
        let temperature = input.temperature.unwrap_or(0.7);
        let top_p = input.top_p.unwrap_or(0.9);
        let max_tokens = input.max_tokens.unwrap_or(2048);

        sqlx::query(
            "INSERT INTO sft_sessions (id, project_id, title, system_prompt, status, provider_id, model, temperature, top_p, max_tokens, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&input.project_id)
        .bind(&title)
        .bind(&system_prompt)
        .bind(&input.provider_id)
        .bind(&input.model)
        .bind(temperature)
        .bind(top_p)
        .bind(max_tokens)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::get_session(pool, &id).await
    }

    pub async fn update_session(pool: &SqlitePool, session_id: &str, input: SFTSessionUpdateInput) -> Result<SFTSession, AppError> {
        let existing = Self::get_session(pool, session_id).await?;
        let now = Utc::now().to_rfc3339();

        let title = input.title.unwrap_or(existing.title);
        let system_prompt = input.system_prompt.unwrap_or(existing.system_prompt);
        let status = input.status.unwrap_or(existing.status);
        let provider_id = input.provider_id.or(existing.provider_id);
        let model = input.model.or(existing.model);
        let temperature = input.temperature.unwrap_or(existing.temperature);
        let top_p = input.top_p.unwrap_or(existing.top_p);
        let max_tokens = input.max_tokens.unwrap_or(existing.max_tokens);

        sqlx::query(
            "UPDATE sft_sessions SET title = ?, system_prompt = ?, status = ?, provider_id = ?, model = ?, temperature = ?, top_p = ?, max_tokens = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&title)
        .bind(&system_prompt)
        .bind(&status)
        .bind(&provider_id)
        .bind(&model)
        .bind(temperature)
        .bind(top_p)
        .bind(max_tokens)
        .bind(&now)
        .bind(session_id)
        .execute(pool)
        .await?;

        Self::get_session(pool, session_id).await
    }

    pub async fn delete_session(pool: &SqlitePool, session_id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM sft_sessions WHERE id = ?")
            .bind(session_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn duplicate_session(pool: &SqlitePool, session_id: &str) -> Result<SFTSession, AppError> {
        let original = Self::get_session(pool, session_id).await?;
        let new_session = Self::create_session(pool, SFTSessionCreateInput {
            project_id: original.project_id,
            title: Some(format!("{} (Copy)", original.title)),
            system_prompt: Some(original.system_prompt),
            provider_id: original.provider_id,
            model: original.model,
            temperature: Some(original.temperature),
            top_p: Some(original.top_p),
            max_tokens: Some(original.max_tokens),
        }).await?;

        // Clone messages
        for msg in original.messages {
            Self::add_message(pool, &new_session.id, SFTMessageCreateInput {
                role: msg.role,
                content: msg.content,
                model: msg.model,
            }).await?;
        }

        Self::get_session(pool, &new_session.id).await
    }

    pub async fn add_message(
        pool: &SqlitePool,
        session_id: &str,
        input: SFTMessageCreateInput,
    ) -> Result<SFTMessage, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let next_seq: (i64,) = sqlx::query_as(
            "SELECT COALESCE(MAX(sequence_order), -1) + 1 FROM sft_messages WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_one(pool)
        .await?;

        // Approx token count
        let token_count = (input.content.len() as i64 / 4).max(1);

        sqlx::query(
            "INSERT INTO sft_messages (id, session_id, role, content, sequence_order, model, token_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(session_id)
        .bind(&input.role)
        .bind(&input.content)
        .bind(next_seq.0)
        .bind(&input.model)
        .bind(token_count)
        .bind(&now)
        .execute(pool)
        .await?;

        // Touch session updated_at
        sqlx::query("UPDATE sft_sessions SET updated_at = ?, status = 'in_progress' WHERE id = ?")
            .bind(&now)
            .bind(session_id)
            .execute(pool)
            .await?;

        Ok(SFTMessage {
            id,
            session_id: session_id.to_string(),
            role: input.role,
            content: input.content,
            sequence_order: next_seq.0,
            model: input.model,
            token_count,
            created_at: now,
        })
    }

    pub async fn update_message(pool: &SqlitePool, message_id: &str, content: &str) -> Result<(), AppError> {
        let token_count = (content.len() as i64 / 4).max(1);
        sqlx::query("UPDATE sft_messages SET content = ?, token_count = ? WHERE id = ?")
            .bind(content)
            .bind(token_count)
            .bind(message_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn delete_message(pool: &SqlitePool, message_id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM sft_messages WHERE id = ?")
            .bind(message_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn truncate_downstream(pool: &SqlitePool, session_id: &str, from_sequence: i64) -> Result<(), AppError> {
        sqlx::query("DELETE FROM sft_messages WHERE session_id = ? AND sequence_order >= ?")
            .bind(session_id)
            .bind(from_sequence)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// CRITICAL SFT SPECIFICATION:
    /// One completed conversation must produce exactly ONE SFT dataset record.
    /// Multiple conversations append records to the same project's SFT dataset.
    /// Never create one JSON file per conversation.
    /// Prevent duplication if retried: update existing committed record or create new if not yet committed.
    pub async fn commit_session(
        pool: &SqlitePool,
        session_id: &str,
        input: SFTCommitInput,
    ) -> Result<SFTRecord, AppError> {
        let session = Self::get_session(pool, session_id).await?;
        if session.messages.is_empty() {
            return Err(AppError::Validation("Cannot commit an empty conversation with no messages.".to_string()));
        }

        let now = Utc::now().to_rfc3339();

        // Build messages array: include system prompt if present, then each message in order
        let mut messages_array = Vec::new();
        if !session.system_prompt.trim().is_empty() {
            messages_array.push(json!({
                "role": "system",
                "content": session.system_prompt.trim()
            }));
        }

        let mut total_chars = 0;
        for msg in &session.messages {
            total_chars += msg.content.len() as i64;
            messages_array.push(json!({
                "role": msg.role,
                "content": msg.content
            }));
        }

        let turn_count = session.messages.len() as i64;
        let messages_json = serde_json::to_string(&messages_array)?;

        let mut metadata_obj = match input.metadata {
            Some(Value::Object(map)) => map,
            _ => serde_json::Map::new(),
        };

        if let Some(tags) = input.tags {
            metadata_obj.insert("tags".to_string(), json!(tags));
        }
        if let Some(override_title) = input.title_override {
            metadata_obj.insert("title".to_string(), json!(override_title));
        } else {
            metadata_obj.insert("title".to_string(), json!(session.title));
        }
        if let Some(model) = session.model {
            metadata_obj.insert("model".to_string(), json!(model));
        }
        metadata_obj.insert("source_session_id".to_string(), json!(session.id));

        let metadata_json = serde_json::to_string(&Value::Object(metadata_obj))?;

        // Check if session was already committed once to prevent duplication
        let record_id = if let Some(existing_record_id) = &session.committed_record_id {
            // Update existing record
            sqlx::query(
                "UPDATE sft_records
                 SET messages_json = ?, turn_count = ?, character_count = ?, metadata_json = ?, revision = revision + 1, updated_at = ?
                 WHERE id = ?"
            )
            .bind(&messages_json)
            .bind(turn_count)
            .bind(total_chars)
            .bind(&metadata_json)
            .bind(&now)
            .bind(existing_record_id)
            .execute(pool)
            .await?;

            existing_record_id.clone()
        } else {
            // Insert brand new single SFT record
            let new_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO sft_records (id, project_id, session_id, messages_json, turn_count, character_count, metadata_json, revision, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
            )
            .bind(&new_id)
            .bind(&session.project_id)
            .bind(&session.id)
            .bind(&messages_json)
            .bind(turn_count)
            .bind(total_chars)
            .bind(&metadata_json)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await?;

            new_id
        };

        // Mark session as committed with reference
        sqlx::query(
            "UPDATE sft_sessions
             SET status = 'committed', committed_record_id = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&record_id)
        .bind(&now)
        .bind(&session.id)
        .execute(pool)
        .await?;

        // Log audit event
        let audit_id = Uuid::new_v4().to_string();
        let _ = sqlx::query(
            "INSERT INTO audit_logs (id, project_id, event_type, entity_type, entity_id, details_json, created_at)
             VALUES (?, ?, 'commit_sft_conversation', 'sft_record', ?, ?, ?)"
        )
        .bind(&audit_id)
        .bind(&session.project_id)
        .bind(&record_id)
        .bind(&json!({ "session_id": session.id, "turns": turn_count }).to_string())
        .bind(&now)
        .execute(pool)
        .await;

        crate::services::dataset_service::DatasetService::get_sft_record(pool, &record_id).await
    }
}
