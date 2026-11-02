use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use crate::errors::AppError;
use crate::models::{
    DPOAnnotationInput, DPOTask, DPOTaskCreateInput, DPOTaskUpdateInput
};

pub struct DPOService;

impl DPOService {
    pub async fn list(
        pool: &SqlitePool,
        project_id: &str,
        status: Option<&str>,
        search: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<(Vec<DPOTask>, i64), AppError> {
        let mut conditions = vec!["project_id = ?".to_string()];
        let mut bind_status = None;
        let mut bind_search = None;

        if let Some(s) = status {
            if !s.is_empty() && s != "all" {
                conditions.push("status = ?".to_string());
                bind_status = Some(s.to_string());
            }
        }

        if let Some(q) = search {
            if !q.trim().is_empty() {
                conditions.push("(prompt LIKE ? OR response_a LIKE ? OR response_b LIKE ?)".to_string());
                bind_search = Some(format!("%{}%", q.trim()));
            }
        }

        let where_clause = conditions.join(" AND ");

        let count_sql = format!("SELECT COUNT(*) FROM dpo_tasks WHERE {}", where_clause);
        let mut count_query = sqlx::query_as::<_, (i64,)>(&count_sql).bind(project_id);
        if let Some(s) = &bind_status {
            count_query = count_query.bind(s);
        }
        if let Some(ref q) = bind_search {
            count_query = count_query.bind(q).bind(q).bind(q);
        }
        let total = count_query.fetch_one(pool).await?.0;

        let data_sql = format!(
            "SELECT id, project_id, prompt, system_prompt, response_a, response_b, preference, rationale, helpfulness_rating, factuality_rating, status, metadata_json, created_at, updated_at
             FROM dpo_tasks
             WHERE {}
             ORDER BY updated_at DESC
             LIMIT ? OFFSET ?",
            where_clause
        );

        let mut data_query = sqlx::query_as::<_, (
            String, String, String, Option<String>, String, String,
            Option<String>, Option<String>, Option<i64>, Option<i64>,
            String, String, String, String
        )>(&data_sql).bind(project_id);

        if let Some(s) = &bind_status {
            data_query = data_query.bind(s);
        }
        if let Some(ref q) = bind_search {
            data_query = data_query.bind(q).bind(q).bind(q);
        }
        data_query = data_query.bind(limit).bind(offset);

        let rows = data_query.fetch_all(pool).await?;

        let tasks = rows.into_iter().map(|r| {
            let metadata: Value = serde_json::from_str(&r.11).unwrap_or(serde_json::json!({}));
            DPOTask {
                id: r.0,
                project_id: r.1,
                prompt: r.2,
                system_prompt: r.3,
                response_a: r.4,
                response_b: r.5,
                preference: r.6,
                rationale: r.7,
                helpfulness_rating: r.8,
                factuality_rating: r.9,
                status: r.10,
                metadata,
                created_at: r.12,
                updated_at: r.13,
            }
        }).collect();

        Ok((tasks, total))
    }

    pub async fn get(pool: &SqlitePool, id: &str) -> Result<DPOTask, AppError> {
        let row = sqlx::query_as::<_, (
            String, String, String, Option<String>, String, String,
            Option<String>, Option<String>, Option<i64>, Option<i64>,
            String, String, String, String
        )>(
            "SELECT id, project_id, prompt, system_prompt, response_a, response_b, preference, rationale, helpfulness_rating, factuality_rating, status, metadata_json, created_at, updated_at
             FROM dpo_tasks
             WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("DPO task {} not found", id)))?;

        let metadata: Value = serde_json::from_str(&row.11).unwrap_or(serde_json::json!({}));
        Ok(DPOTask {
            id: row.0,
            project_id: row.1,
            prompt: row.2,
            system_prompt: row.3,
            response_a: row.4,
            response_b: row.5,
            preference: row.6,
            rationale: row.7,
            helpfulness_rating: row.8,
            factuality_rating: row.9,
            status: row.10,
            metadata,
            created_at: row.12,
            updated_at: row.13,
        })
    }

    pub async fn create(pool: &SqlitePool, input: DPOTaskCreateInput) -> Result<DPOTask, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let metadata_str = input.metadata.map(|v| v.to_string()).unwrap_or_else(|| "{}".to_string());
        let resp_a = input.response_a.unwrap_or_default();
        let resp_b = input.response_b.unwrap_or_default();

        sqlx::query(
            "INSERT INTO dpo_tasks (id, project_id, prompt, system_prompt, response_a, response_b, status, metadata_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)"
        )
        .bind(&id)
        .bind(&input.project_id)
        .bind(&input.prompt)
        .bind(&input.system_prompt)
        .bind(&resp_a)
        .bind(&resp_b)
        .bind(&metadata_str)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::get(pool, &id).await
    }

    pub async fn annotate(
        pool: &SqlitePool,
        task_id: &str,
        input: DPOAnnotationInput,
    ) -> Result<DPOTask, AppError> {
        let existing = Self::get(pool, task_id).await?;
        let now = Utc::now().to_rfc3339();

        let status = match input.preference.as_str() {
            "flag" => "flagged",
            "skip" => "skipped",
            _ => "completed",
        };

        let metadata_str = if let Some(m) = input.metadata {
            m.to_string()
        } else {
            existing.metadata.to_string()
        };

        sqlx::query(
            "UPDATE dpo_tasks
             SET preference = ?, rationale = ?, helpfulness_rating = ?, factuality_rating = ?, status = ?, metadata_json = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&input.preference)
        .bind(&input.rationale)
        .bind(input.helpfulness_rating)
        .bind(input.factuality_rating)
        .bind(status)
        .bind(&metadata_str)
        .bind(&now)
        .bind(task_id)
        .execute(pool)
        .await?;

        Self::get(pool, task_id).await
    }

    pub async fn undo_last_annotation(pool: &SqlitePool, project_id: &str) -> Result<Option<DPOTask>, AppError> {
        let row = sqlx::query_as::<_, (String,)>(
            "SELECT id FROM dpo_tasks
             WHERE project_id = ? AND status IN ('completed', 'flagged', 'skipped')
             ORDER BY updated_at DESC
             LIMIT 1"
        )
        .bind(project_id)
        .fetch_optional(pool)
        .await?;

        if let Some((id,)) = row {
            let now = Utc::now().to_rfc3339();
            sqlx::query(
                "UPDATE dpo_tasks
                 SET preference = NULL, rationale = NULL, helpfulness_rating = NULL, factuality_rating = NULL, status = 'pending', updated_at = ?
                 WHERE id = ?"
            )
            .bind(&now)
            .bind(&id)
            .execute(pool)
            .await?;

            let task = Self::get(pool, &id).await?;
            Ok(Some(task))
        } else {
            Ok(None)
        }
    }

    pub async fn update(pool: &SqlitePool, id: &str, input: DPOTaskUpdateInput) -> Result<DPOTask, AppError> {
        let existing = Self::get(pool, id).await?;
        let now = Utc::now().to_rfc3339();

        let prompt = input.prompt.unwrap_or(existing.prompt);
        let system_prompt = input.system_prompt.or(existing.system_prompt);
        let response_a = input.response_a.unwrap_or(existing.response_a);
        let response_b = input.response_b.unwrap_or(existing.response_b);
        let preference = input.preference.or(existing.preference);
        let rationale = input.rationale.or(existing.rationale);
        let helpfulness = input.helpfulness_rating.or(existing.helpfulness_rating);
        let factuality = input.factuality_rating.or(existing.factuality_rating);
        let metadata_str = input.metadata.map(|v| v.to_string()).unwrap_or_else(|| existing.metadata.to_string());

        let status = if preference.is_some() { "completed" } else { &existing.status };

        sqlx::query(
            "UPDATE dpo_tasks
             SET prompt = ?, system_prompt = ?, response_a = ?, response_b = ?, preference = ?, rationale = ?, helpfulness_rating = ?, factuality_rating = ?, status = ?, metadata_json = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&prompt)
        .bind(&system_prompt)
        .bind(&response_a)
        .bind(&response_b)
        .bind(&preference)
        .bind(&rationale)
        .bind(helpfulness)
        .bind(factuality)
        .bind(status)
        .bind(&metadata_str)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Self::get(pool, id).await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM dpo_tasks WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn duplicate(pool: &SqlitePool, id: &str) -> Result<DPOTask, AppError> {
        let orig = Self::get(pool, id).await?;
        Self::create(pool, DPOTaskCreateInput {
            project_id: orig.project_id,
            prompt: orig.prompt,
            system_prompt: orig.system_prompt,
            response_a: Some(orig.response_a),
            response_b: Some(orig.response_b),
            metadata: Some(orig.metadata),
        }).await
    }
}
