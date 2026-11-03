use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use crate::errors::AppError;
use crate::models::{SFTRecord, SFTRecordUpdateInput};

pub struct DatasetService;

impl DatasetService {
    pub async fn list_sft_records(
        pool: &SqlitePool,
        project_id: &str,
        search: Option<&str>,
        tag: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<(Vec<SFTRecord>, i64), AppError> {
        Self::list_sft_records_with_filter(pool, project_id, search, tag, None, limit, offset).await
    }

    pub async fn list_sft_records_with_filter(
        pool: &SqlitePool,
        project_id: &str,
        search: Option<&str>,
        tag: Option<&str>,
        language_mode: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<(Vec<SFTRecord>, i64), AppError> {
        let mut conditions = vec!["project_id = ?".to_string()];
        let mut bind_search = None;
        let mut bind_tag = None;
        let mut bind_lang_mode = None;

        if let Some(q) = search {
            if !q.trim().is_empty() {
                conditions.push("(messages_json LIKE ? OR metadata_json LIKE ?)".to_string());
                bind_search = Some(format!("%{}%", q.trim()));
            }
        }

        if let Some(t) = tag {
            if !t.trim().is_empty() {
                conditions.push("metadata_json LIKE ?".to_string());
                bind_tag = Some(format!("%{}%", t.trim()));
            }
        }

        if let Some(lm) = language_mode {
            if !lm.trim().is_empty() && lm != "all" {
                conditions.push("language_mode = ?".to_string());
                bind_lang_mode = Some(lm.trim().to_string());
            }
        }

        let where_clause = conditions.join(" AND ");

        let count_sql = format!("SELECT COUNT(*) FROM sft_records WHERE {}", where_clause);
        let mut count_query = sqlx::query_as::<_, (i64,)>(&count_sql).bind(project_id);
        if let Some(ref q) = bind_search {
            count_query = count_query.bind(q).bind(q);
        }
        if let Some(ref t) = bind_tag {
            count_query = count_query.bind(t);
        }
        if let Some(ref lm) = bind_lang_mode {
            count_query = count_query.bind(lm);
        }
        let total = count_query.fetch_one(pool).await?.0;

        let data_sql = format!(
            "SELECT id, project_id, session_id, messages_json, turn_count, character_count, language_mode, primary_language, secondary_language, metadata_json, revision, created_at, updated_at
             FROM sft_records
             WHERE {}
             ORDER BY updated_at DESC
             LIMIT ? OFFSET ?",
            where_clause
        );

        let mut data_query = sqlx::query_as::<_, (
            String, String, Option<String>, String, i64, i64, String, String, String, String, i64, String, String
        )>(&data_sql).bind(project_id);

        if let Some(ref q) = bind_search {
            data_query = data_query.bind(q).bind(q);
        }
        if let Some(ref t) = bind_tag {
            data_query = data_query.bind(t);
        }
        if let Some(ref lm) = bind_lang_mode {
            data_query = data_query.bind(lm);
        }
        data_query = data_query.bind(limit).bind(offset);

        let rows = data_query.fetch_all(pool).await?;

        let records = rows.into_iter().map(|r| {
            let messages: Value = serde_json::from_str(&r.3).unwrap_or(serde_json::json!([]));
            let metadata: Value = serde_json::from_str(&r.9).unwrap_or(serde_json::json!({}));
            SFTRecord {
                id: r.0,
                project_id: r.1,
                session_id: r.2,
                messages,
                turn_count: r.4,
                character_count: r.5,
                language_mode: r.6,
                primary_language: r.7,
                secondary_language: r.8,
                metadata,
                revision: r.10,
                created_at: r.11,
                updated_at: r.12,
            }
        }).collect();

        Ok((records, total))
    }

    pub async fn get_sft_records_by_ids(
        pool: &SqlitePool,
        project_id: &str,
        ids: &[String],
    ) -> Result<Vec<SFTRecord>, AppError> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id, project_id, session_id, messages_json, turn_count, character_count, language_mode, primary_language, secondary_language, metadata_json, revision, created_at, updated_at
             FROM sft_records
             WHERE project_id = ? AND id IN ({})
             ORDER BY updated_at DESC",
            placeholders
        );
        let mut query = sqlx::query_as::<_, (
            String, String, Option<String>, String, i64, i64, String, String, String, String, i64, String, String
        )>(&sql).bind(project_id);
        for id in ids {
            query = query.bind(id);
        }
        let rows = query.fetch_all(pool).await?;
        let records = rows.into_iter().map(|r| {
            let messages: Value = serde_json::from_str(&r.3).unwrap_or(serde_json::json!([]));
            let metadata: Value = serde_json::from_str(&r.9).unwrap_or(serde_json::json!({}));
            SFTRecord {
                id: r.0,
                project_id: r.1,
                session_id: r.2,
                messages,
                turn_count: r.4,
                character_count: r.5,
                language_mode: r.6,
                primary_language: r.7,
                secondary_language: r.8,
                metadata,
                revision: r.10,
                created_at: r.11,
                updated_at: r.12,
            }
        }).collect();
        Ok(records)
    }

    pub async fn get_sft_record(pool: &SqlitePool, record_id: &str) -> Result<SFTRecord, AppError> {
        let row = sqlx::query_as::<_, (
            String, String, Option<String>, String, i64, i64, String, String, String, String, i64, String, String
        )>(
            "SELECT id, project_id, session_id, messages_json, turn_count, character_count, language_mode, primary_language, secondary_language, metadata_json, revision, created_at, updated_at
             FROM sft_records
             WHERE id = ?"
        )
        .bind(record_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("SFT record {} not found", record_id)))?;

        let messages: Value = serde_json::from_str(&row.3).unwrap_or(serde_json::json!([]));
        let metadata: Value = serde_json::from_str(&row.9).unwrap_or(serde_json::json!({}));

        Ok(SFTRecord {
            id: row.0,
            project_id: row.1,
            session_id: row.2,
            messages,
            turn_count: row.4,
            character_count: row.5,
            language_mode: row.6,
            primary_language: row.7,
            secondary_language: row.8,
            metadata,
            revision: row.10,
            created_at: row.11,
            updated_at: row.12,
        })
    }

    pub async fn update_sft_record(
        pool: &SqlitePool,
        record_id: &str,
        input: SFTRecordUpdateInput,
    ) -> Result<SFTRecord, AppError> {
        let existing = Self::get_sft_record(pool, record_id).await?;
        let now = Utc::now().to_rfc3339();

        let (messages_json, turn_count, char_count) = if let Some(msgs) = input.messages {
            let turns = msgs.as_array().map(|a| a.len() as i64).unwrap_or(existing.turn_count);
            let s = msgs.to_string();
            let c = s.len() as i64;
            (s, turns, c)
        } else {
            (existing.messages.to_string(), existing.turn_count, existing.character_count)
        };

        let metadata_json = input.metadata.map(|m| m.to_string()).unwrap_or_else(|| existing.metadata.to_string());
        let language_mode = input.language_mode.unwrap_or(existing.language_mode);
        let primary_language = input.primary_language.unwrap_or(existing.primary_language);
        let secondary_language = input.secondary_language.unwrap_or(existing.secondary_language);

        sqlx::query(
            "UPDATE sft_records
             SET messages_json = ?, turn_count = ?, character_count = ?, language_mode = ?, primary_language = ?, secondary_language = ?, metadata_json = ?, revision = revision + 1, updated_at = ?
             WHERE id = ?"
        )
        .bind(&messages_json)
        .bind(turn_count)
        .bind(char_count)
        .bind(&language_mode)
        .bind(&primary_language)
        .bind(&secondary_language)
        .bind(&metadata_json)
        .bind(&now)
        .bind(record_id)
        .execute(pool)
        .await?;

        Self::get_sft_record(pool, record_id).await
    }

    pub async fn delete_sft_record(pool: &SqlitePool, record_id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM sft_records WHERE id = ?")
            .bind(record_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn duplicate_sft_record(pool: &SqlitePool, record_id: &str) -> Result<SFTRecord, AppError> {
        let orig = Self::get_sft_record(pool, record_id).await?;
        let new_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT INTO sft_records (id, project_id, session_id, messages_json, turn_count, character_count, language_mode, primary_language, secondary_language, metadata_json, revision, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
        )
        .bind(&new_id)
        .bind(&orig.project_id)
        .bind(&orig.session_id)
        .bind(&orig.messages.to_string())
        .bind(orig.turn_count)
        .bind(orig.character_count)
        .bind(&orig.language_mode)
        .bind(&orig.primary_language)
        .bind(&orig.secondary_language)
        .bind(&orig.metadata.to_string())
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::get_sft_record(pool, &new_id).await
    }
}
