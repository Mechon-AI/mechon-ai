use sqlx::{Row, SqlitePool};
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
                "SELECT id, project_id, title, system_prompt, status, provider_id, model, temperature, top_p, max_tokens, language_mode, primary_language, secondary_language, language_metadata_json, committed_record_id, created_at, updated_at
                 FROM sft_sessions
                 WHERE project_id = ? AND status = ?
                 ORDER BY updated_at DESC",
                Some(s),
            ),
            _ => (
                "SELECT id, project_id, title, system_prompt, status, provider_id, model, temperature, top_p, max_tokens, language_mode, primary_language, secondary_language, language_metadata_json, committed_record_id, created_at, updated_at
                 FROM sft_sessions
                 WHERE project_id = ?
                 ORDER BY updated_at DESC",
                None,
            ),
        };

        let rows = if let Some(s) = bind_status {
            sqlx::query(sql)
                .bind(project_id)
                .bind(s)
                .fetch_all(pool)
                .await?
        } else {
            sqlx::query(sql)
                .bind(project_id)
                .fetch_all(pool)
                .await?
        };

        let mut sessions = Vec::new();
        for r in rows {
            let session_id: String = r.get("id");
            let messages = Self::get_messages(pool, &session_id).await?;
            let lang_mode_str: String = r.get("language_mode");
            let primary_lang: String = r.get("primary_language");
            let secondary_lang: String = r.get("secondary_language");
            let meta_raw: String = r.get("language_metadata_json");

            let mut lang_meta: Value = serde_json::from_str(&meta_raw).unwrap_or_else(|_| json!({}));
            if !lang_meta.is_object() || lang_meta.as_object().map(|m| m.is_empty()).unwrap_or(true) {
                lang_meta = crate::languages::LanguageRegistry::build_canonical_language_object(
                    &lang_mode_str,
                    &primary_lang,
                    if lang_mode_str == "bilingual" || lang_mode_str == "multilingual" { Some(&secondary_lang) } else { None },
                );
            }
            sessions.push(SFTSession {
                id: session_id,
                project_id: r.get("project_id"),
                title: r.get("title"),
                system_prompt: r.get("system_prompt"),
                status: r.get("status"),
                provider_id: r.get("provider_id"),
                model: r.get("model"),
                temperature: r.get("temperature"),
                top_p: r.get("top_p"),
                max_tokens: r.get("max_tokens"),
                language_mode: lang_mode_str,
                primary_language: primary_lang,
                secondary_language: secondary_lang,
                language_metadata: lang_meta,
                committed_record_id: r.get("committed_record_id"),
                messages,
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            });
        }

        Ok(sessions)
    }

    pub async fn get_session(pool: &SqlitePool, session_id: &str) -> Result<SFTSession, AppError> {
        let row = sqlx::query(
            "SELECT id, project_id, title, system_prompt, status, provider_id, model, temperature, top_p, max_tokens, language_mode, primary_language, secondary_language, language_metadata_json, committed_record_id, created_at, updated_at
             FROM sft_sessions
             WHERE id = ?"
        )
        .bind(session_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("SFT session {} not found", session_id)))?;

        let messages = Self::get_messages(pool, session_id).await?;
        let lang_mode_str: String = row.get("language_mode");
        let primary_lang: String = row.get("primary_language");
        let secondary_lang: String = row.get("secondary_language");
        let meta_raw: String = row.get("language_metadata_json");

        let mut lang_meta: Value = serde_json::from_str(&meta_raw).unwrap_or_else(|_| json!({}));
        if !lang_meta.is_object() || lang_meta.as_object().map(|m| m.is_empty()).unwrap_or(true) {
            lang_meta = crate::languages::LanguageRegistry::build_canonical_language_object(
                &lang_mode_str,
                &primary_lang,
                if lang_mode_str == "bilingual" || lang_mode_str == "multilingual" { Some(&secondary_lang) } else { None },
            );
        }

        Ok(SFTSession {
            id: row.get("id"),
            project_id: row.get("project_id"),
            title: row.get("title"),
            system_prompt: row.get("system_prompt"),
            status: row.get("status"),
            provider_id: row.get("provider_id"),
            model: row.get("model"),
            temperature: row.get("temperature"),
            top_p: row.get("top_p"),
            max_tokens: row.get("max_tokens"),
            language_mode: lang_mode_str,
            primary_language: primary_lang,
            secondary_language: secondary_lang,
            language_metadata: lang_meta,
            committed_record_id: row.get("committed_record_id"),
            messages,
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    pub async fn get_messages(pool: &SqlitePool, session_id: &str) -> Result<Vec<SFTMessage>, AppError> {
        let rows = sqlx::query_as::<_, (String, String, String, String, i64, Option<String>, i64, String, String, String)>(
            "SELECT id, session_id, role, content, sequence_order, model, token_count, translations_json, translation_status_json, created_at
             FROM sft_messages
             WHERE session_id = ?
             ORDER BY sequence_order ASC"
        )
        .bind(session_id)
        .fetch_all(pool)
        .await?;

        let messages = rows.into_iter().map(|r| {
            let translations: Value = serde_json::from_str(&r.7).unwrap_or(json!({}));
            let translation_status: Value = serde_json::from_str(&r.8).unwrap_or(json!({}));
            SFTMessage {
                id: r.0,
                session_id: r.1,
                role: r.2,
                content: r.3,
                sequence_order: r.4,
                model: r.5,
                token_count: r.6,
                translations,
                translation_status,
                created_at: r.9,
            }
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
        let language_mode = input.language_mode.unwrap_or_else(|| "monolingual".to_string());
        let primary_language = input.primary_language.unwrap_or_else(|| "en".to_string());
        let secondary_language = input.secondary_language.unwrap_or_else(|| "id".to_string());
        let language_metadata = input.language_metadata.unwrap_or_else(|| {
            crate::languages::LanguageRegistry::build_canonical_language_object(
                &language_mode,
                &primary_language,
                if language_mode == "bilingual" || language_mode == "multilingual" { Some(&secondary_language) } else { None },
            )
        });
        let language_metadata_json = serde_json::to_string(&language_metadata).unwrap_or_else(|_| "{}".to_string());

        sqlx::query(
            "INSERT INTO sft_sessions (id, project_id, title, system_prompt, status, provider_id, model, temperature, top_p, max_tokens, language_mode, primary_language, secondary_language, language_metadata_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        .bind(&language_mode)
        .bind(&primary_language)
        .bind(&secondary_language)
        .bind(&language_metadata_json)
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
        let language_mode = input.language_mode.unwrap_or(existing.language_mode);
        let primary_language = input.primary_language.unwrap_or(existing.primary_language);
        let secondary_language = input.secondary_language.unwrap_or(existing.secondary_language);
        let language_metadata = input.language_metadata.unwrap_or_else(|| {
            crate::languages::LanguageRegistry::build_canonical_language_object(
                &language_mode,
                &primary_language,
                if language_mode == "bilingual" || language_mode == "multilingual" { Some(&secondary_language) } else { None },
            )
        });
        let language_metadata_json = serde_json::to_string(&language_metadata).unwrap_or_else(|_| "{}".to_string());

        sqlx::query(
            "UPDATE sft_sessions SET title = ?, system_prompt = ?, status = ?, provider_id = ?, model = ?, temperature = ?, top_p = ?, max_tokens = ?, language_mode = ?, primary_language = ?, secondary_language = ?, language_metadata_json = ?, updated_at = ?
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
        .bind(&language_mode)
        .bind(&primary_language)
        .bind(&secondary_language)
        .bind(&language_metadata_json)
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
            language_mode: Some(original.language_mode),
            primary_language: Some(original.primary_language),
            secondary_language: Some(original.secondary_language),
            language_metadata: Some(original.language_metadata),
        }).await?;

        // Clone messages
        for msg in original.messages {
            let new_msg = Self::add_message(pool, &new_session.id, SFTMessageCreateInput {
                role: msg.role,
                content: msg.content,
                model: msg.model,
            }).await?;

            if !msg.translations.as_object().map(|m| m.is_empty()).unwrap_or(true) {
                let trans_str = serde_json::to_string(&msg.translations)?;
                let status_str = serde_json::to_string(&msg.translation_status)?;
                let _ = sqlx::query(
                    "UPDATE sft_messages SET translations_json = ?, translation_status_json = ? WHERE id = ?"
                )
                .bind(&trans_str)
                .bind(&status_str)
                .bind(&new_msg.id)
                .execute(pool)
                .await;
            }
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
            "INSERT INTO sft_messages (id, session_id, role, content, sequence_order, model, token_count, translations_json, translation_status_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, '{}', '{}', ?)"
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
            translations: json!({}),
            translation_status: json!({}),
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
        let is_bilingual = session.language_mode == "bilingual" 
            || input.language_mode.as_deref() == Some("bilingual")
            || session.messages.iter().any(|m| m.translations.as_object().map(|o| !o.is_empty()).unwrap_or(false));

        for msg in &session.messages {
            total_chars += msg.content.len() as i64;
            let mut msg_map = serde_json::Map::new();
            msg_map.insert("role".to_string(), json!(msg.role));
            msg_map.insert("content".to_string(), json!(msg.content));

            if is_bilingual {
                if let Some(trans_obj) = msg.translations.as_object() {
                    if !trans_obj.is_empty() {
                        msg_map.insert("translations".to_string(), msg.translations.clone());
                    }
                }
                if let Some(status_obj) = msg.translation_status.as_object() {
                    if !status_obj.is_empty() {
                        msg_map.insert("translation_status".to_string(), msg.translation_status.clone());
                    }
                }
            }

            messages_array.push(Value::Object(msg_map));
        }

        let turn_count = session.messages.len() as i64;
        let messages_json = serde_json::to_string(&messages_array)?;

        let final_lang_mode = input.language_mode.unwrap_or(session.language_mode);
        let final_primary_lang = input.primary_language.unwrap_or(session.primary_language);
        let final_secondary_lang = input.secondary_language.unwrap_or(session.secondary_language);
        let final_lang_meta = input.language_metadata.unwrap_or_else(|| {
            crate::languages::LanguageRegistry::build_canonical_language_object(
                &final_lang_mode,
                &final_primary_lang,
                if final_lang_mode == "bilingual" || final_lang_mode == "multilingual" { Some(&final_secondary_lang) } else { None },
            )
        });
        let language_metadata_json = serde_json::to_string(&final_lang_meta).unwrap_or_else(|_| "{}".to_string());

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
        metadata_obj.insert("language_mode".to_string(), json!(final_lang_mode));
        metadata_obj.insert("primary_language".to_string(), json!(final_primary_lang));
        metadata_obj.insert("secondary_language".to_string(), json!(final_secondary_lang));

        let metadata_json = serde_json::to_string(&Value::Object(metadata_obj))?;

        let force_new = input.save_as_new.unwrap_or(false);

        // Check if session was already committed once to prevent duplication (unless save_as_new is explicitly requested)
        let record_id = if !force_new && session.committed_record_id.is_some() {
            let existing_record_id = session.committed_record_id.as_ref().unwrap();
            // Update existing record
            sqlx::query(
                "UPDATE sft_records
                 SET messages_json = ?, turn_count = ?, character_count = ?, language_mode = ?, primary_language = ?, secondary_language = ?, language_metadata_json = ?, metadata_json = ?, revision = revision + 1, updated_at = ?
                 WHERE id = ?"
            )
            .bind(&messages_json)
            .bind(turn_count)
            .bind(total_chars)
            .bind(&final_lang_mode)
            .bind(&final_primary_lang)
            .bind(&final_secondary_lang)
            .bind(&language_metadata_json)
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
                "INSERT INTO sft_records (id, project_id, session_id, messages_json, turn_count, character_count, language_mode, primary_language, secondary_language, language_metadata_json, metadata_json, revision, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
            )
            .bind(&new_id)
            .bind(&session.project_id)
            .bind(&session.id)
            .bind(&messages_json)
            .bind(turn_count)
            .bind(total_chars)
            .bind(&final_lang_mode)
            .bind(&final_primary_lang)
            .bind(&final_secondary_lang)
            .bind(&language_metadata_json)
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

        // Optional version snapshot creation
        if input.create_version_snapshot == Some(true) {
            let v_tag = input.version_tag.unwrap_or_else(|| {
                format!("v1.{}.0", Utc::now().format("%Y%m%d%H%M%S"))
            });
            let summary = format!("Committed conversation '{}' (record {}) into SFT dataset", session.title, record_id);
            let description = input.version_description.or(Some(summary));
            let _ = crate::services::version_service::VersionService::create_snapshot(
                pool,
                crate::models::SnapshotCreateInput {
                    project_id: session.project_id.clone(),
                    dataset_type: "sft".to_string(),
                    version_tag: v_tag,
                    description,
                },
            ).await;
        }

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

    /// Load an existing Corpus SFT Record into an active SFTSession for editing or cloning
    pub async fn load_corpus_record_into_session(
        pool: &SqlitePool,
        record_id: &str,
        as_new_draft: bool,
    ) -> Result<SFTSession, AppError> {
        let record = crate::services::dataset_service::DatasetService::get_sft_record(pool, record_id).await?;
        let now = Utc::now().to_rfc3339();
        let new_session_id = Uuid::new_v4().to_string();

        let title = record.metadata.get("title")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("Corpus Record {}", &record.id[..record.id.len().min(8)]));

        let mut system_prompt = "You are a helpful, respectful, and honest assistant.".to_string();
        let mut messages_to_insert = Vec::new();

        if let Some(msg_arr) = record.messages.as_array() {
            let mut seq = 0;
            for (idx, m) in msg_arr.iter().enumerate() {
                let role = m.get("role").and_then(|r| r.as_str()).unwrap_or("user");
                let content = m.get("content").and_then(|c| c.as_str()).unwrap_or("");
                if idx == 0 && role == "system" {
                    system_prompt = content.to_string();
                    continue;
                }
                let translations = m.get("translations").cloned().unwrap_or_else(|| json!({}));
                let trans_status = m.get("translation_status").cloned().unwrap_or_else(|| json!({}));
                messages_to_insert.push((role.to_string(), content.to_string(), seq, translations, trans_status));
                seq += 1;
            }
        }

        let committed_record_id = if as_new_draft {
            None
        } else {
            Some(record.id.clone())
        };

        let lang_meta_str = serde_json::to_string(&record.language_metadata).unwrap_or_else(|_| "{}".to_string());

        sqlx::query(
            "INSERT INTO sft_sessions (id, project_id, title, system_prompt, status, provider_id, model, temperature, top_p, max_tokens, language_mode, primary_language, secondary_language, language_metadata_json, committed_record_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'draft', NULL, NULL, 0.7, 0.9, 2048, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&new_session_id)
        .bind(&record.project_id)
        .bind(&title)
        .bind(&system_prompt)
        .bind(&record.language_mode)
        .bind(&record.primary_language)
        .bind(&record.secondary_language)
        .bind(&lang_meta_str)
        .bind(&committed_record_id)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        for (role, content, seq, trans, trans_status) in messages_to_insert {
            let msg_id = Uuid::new_v4().to_string();
            let token_count = (content.len() as i64 / 4).max(1);
            let trans_str = serde_json::to_string(&trans).unwrap_or_else(|_| "{}".to_string());
            let status_str = serde_json::to_string(&trans_status).unwrap_or_else(|_| "{}".to_string());

            sqlx::query(
                "INSERT INTO sft_messages (id, session_id, role, content, sequence_order, model, token_count, translations_json, translation_status_json, created_at)
                 VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)"
            )
            .bind(&msg_id)
            .bind(&new_session_id)
            .bind(&role)
            .bind(&content)
            .bind(seq)
            .bind(token_count)
            .bind(&trans_str)
            .bind(&status_str)
            .bind(&now)
            .execute(pool)
            .await?;
        }

        Self::get_session(pool, &new_session_id).await
    }

    /// Reorder conversation turns by supplying ordered list of message IDs
    pub async fn reorder_messages(
        pool: &SqlitePool,
        session_id: &str,
        message_ids: Vec<String>,
    ) -> Result<Vec<SFTMessage>, AppError> {
        let mut tx = pool.begin().await?;
        for (idx, msg_id) in message_ids.iter().enumerate() {
            sqlx::query("UPDATE sft_messages SET sequence_order = ? WHERE id = ? AND session_id = ?")
                .bind(idx as i64)
                .bind(msg_id)
                .bind(session_id)
                .execute(&mut *tx)
                .await?;
        }
        let now = Utc::now().to_rfc3339();
        sqlx::query("UPDATE sft_sessions SET updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(session_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;

        let session = Self::get_session(pool, session_id).await?;
        Ok(session.messages)
    }

    /// Remove a specific language translation from a message
    pub async fn remove_message_translation(
        pool: &SqlitePool,
        message_id: &str,
        lang_code: &str,
    ) -> Result<SFTMessage, AppError> {
        let row = sqlx::query_as::<_, (String, String, String, String, i64, Option<String>, i64, String, String, String)>(
            "SELECT id, session_id, role, content, sequence_order, model, token_count, translations_json, translation_status_json, created_at
             FROM sft_messages WHERE id = ?"
        )
        .bind(message_id)
        .fetch_one(pool)
        .await?;

        let mut trans: Value = serde_json::from_str(&row.7).unwrap_or(json!({}));
        let mut status: Value = serde_json::from_str(&row.8).unwrap_or(json!({}));

        if let Some(map) = trans.as_object_mut() {
            map.remove(lang_code);
        }
        if let Some(map) = status.as_object_mut() {
            map.remove(lang_code);
        }

        let trans_str = serde_json::to_string(&trans)?;
        let status_str = serde_json::to_string(&status)?;

        sqlx::query("UPDATE sft_messages SET translations_json = ?, translation_status_json = ? WHERE id = ?")
            .bind(&trans_str)
            .bind(&status_str)
            .bind(message_id)
            .execute(pool)
            .await?;

        Ok(SFTMessage {
            id: row.0,
            session_id: row.1,
            role: row.2,
            content: row.3,
            sequence_order: row.4,
            model: row.5,
            token_count: row.6,
            translations: trans,
            translation_status: status,
            created_at: row.9,
        })
    }
}
