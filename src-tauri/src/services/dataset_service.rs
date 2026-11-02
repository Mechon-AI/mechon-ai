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
        let mut conditions = vec!["project_id = ?".to_string()];
        let mut bind_search = None;
        let mut bind_tag = None;

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

        let where_clause = conditions.join(" AND ");

        let count_sql = format!("SELECT COUNT(*) FROM sft_records WHERE {}", where_clause);
        let mut count_query = sqlx::query_as::<_, (i64,)>(&count_sql).bind(project_id);
        if let Some(ref q) = bind_search {
            count_query = count_query.bind(q).bind(q);
        }
        if let Some(ref t) = bind_tag {
            count_query = count_query.bind(t);
        }
        let total = count_query.fetch_one(pool).await?.0;

        let data_sql = format!(
            "SELECT id, project_id, session_id, messages_json, turn_count, character_count, metadata_json, revision, created_at, updated_at
             FROM sft_records
             WHERE {}
             ORDER BY updated_at DESC
             LIMIT ? OFFSET ?",
            where_clause
        );

        let mut data_query = sqlx::query_as::<_, (
            String, String, Option<String>, String, i64, i64, String, i64, String, String
        )>(&data_sql).bind(project_id);

        if let Some(ref q) = bind_search {
            data_query = data_query.bind(q).bind(q);
        }
        if let Some(ref t) = bind_tag {
            data_query = data_query.bind(t);
        }
        data_query = data_query.bind(limit).bind(offset);

        let rows = data_query.fetch_all(pool).await?;

        let records = rows.into_iter().map(|r| {
            let messages: Value = serde_json::from_str(&r.3).unwrap_or(serde_json::json!([]));
            let metadata: Value = serde_json::from_str(&r.6).unwrap_or(serde_json::json!({}));
            SFTRecord {
                id: r.0,
                project_id: r.1,
                session_id: r.2,
                messages,
                turn_count: r.4,
                character_count: r.5,
                metadata,
                revision: r.7,
                created_at: r.8,
                updated_at: r.9,
            }
        }).collect();

        Ok((records, total))
    }

    pub async fn get_sft_record(pool: &SqlitePool, record_id: &str) -> Result<SFTRecord, AppError> {
        let row = sqlx::query_as::<_, (
            String, String, Option<String>, String, i64, i64, String, i64, String, String
        )>(
            "SELECT id, project_id, session_id, messages_json, turn_count, character_count, metadata_json, revision, created_at, updated_at
             FROM sft_records
             WHERE id = ?"
        )
        .bind(record_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("SFT record {} not found", record_id)))?;

        let messages: Value = serde_json::from_str(&row.3).unwrap_or(serde_json::json!([]));
        let metadata: Value = serde_json::from_str(&row.6).unwrap_or(serde_json::json!({}));

        Ok(SFTRecord {
            id: row.0,
            project_id: row.1,
            session_id: row.2,
            messages,
            turn_count: row.4,
            character_count: row.5,
            metadata,
            revision: row.7,
            created_at: row.8,
            updated_at: row.9,
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

        sqlx::query(
            "UPDATE sft_records
             SET messages_json = ?, turn_count = ?, character_count = ?, metadata_json = ?, revision = revision + 1, updated_at = ?
             WHERE id = ?"
        )
        .bind(&messages_json)
        .bind(turn_count)
        .bind(char_count)
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
            "INSERT INTO sft_records (id, project_id, session_id, messages_json, turn_count, character_count, metadata_json, revision, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
        )
        .bind(&new_id)
        .bind(&orig.project_id)
        .bind(&orig.session_id)
        .bind(&orig.messages.to_string())
        .bind(orig.turn_count)
        .bind(orig.character_count)
        .bind(&orig.metadata.to_string())
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::get_sft_record(pool, &new_id).await
    }
}
