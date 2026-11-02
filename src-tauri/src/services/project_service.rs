use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use crate::errors::AppError;
use crate::models::{Project, ProjectCreateInput, ProjectUpdateInput};

pub struct ProjectService;

impl ProjectService {
    pub async fn list(pool: &SqlitePool, include_archived: bool) -> Result<Vec<Project>, AppError> {
        let sql = if include_archived {
            r#"
            SELECT 
                p.id, p.name, p.description, p.is_archived, p.created_at, p.updated_at, p.settings_json,
                (SELECT COUNT(*) FROM sft_records WHERE project_id = p.id) as sft_record_count,
                (SELECT COUNT(*) FROM dpo_tasks WHERE project_id = p.id) as dpo_task_count,
                (SELECT COUNT(*) FROM sft_sessions WHERE project_id = p.id AND status != 'committed') as active_draft_count
            FROM projects p
            ORDER BY p.updated_at DESC
            "#
        } else {
            r#"
            SELECT 
                p.id, p.name, p.description, p.is_archived, p.created_at, p.updated_at, p.settings_json,
                (SELECT COUNT(*) FROM sft_records WHERE project_id = p.id) as sft_record_count,
                (SELECT COUNT(*) FROM dpo_tasks WHERE project_id = p.id) as dpo_task_count,
                (SELECT COUNT(*) FROM sft_sessions WHERE project_id = p.id AND status != 'committed') as active_draft_count
            FROM projects p
            WHERE p.is_archived = 0
            ORDER BY p.updated_at DESC
            "#
        };

        let rows = sqlx::query_as::<_, (String, String, Option<String>, i64, String, String, String, i64, i64, i64)>(sql)
            .fetch_all(pool)
            .await?;

        let projects = rows.into_iter().map(|(id, name, desc, arch, created, updated, settings_str, sft_cnt, dpo_cnt, draft_cnt)| {
            let settings: Value = serde_json::from_str(&settings_str).unwrap_or(serde_json::json!({}));
            Project {
                id,
                name,
                description: desc,
                is_archived: arch != 0,
                created_at: created,
                updated_at: updated,
                settings,
                sft_record_count: sft_cnt,
                dpo_task_count: dpo_cnt,
                active_draft_count: draft_cnt,
            }
        }).collect();

        Ok(projects)
    }

    pub async fn get(pool: &SqlitePool, id: &str) -> Result<Project, AppError> {
        let row = sqlx::query_as::<_, (String, String, Option<String>, i64, String, String, String, i64, i64, i64)>(
            r#"
            SELECT 
                p.id, p.name, p.description, p.is_archived, p.created_at, p.updated_at, p.settings_json,
                (SELECT COUNT(*) FROM sft_records WHERE project_id = p.id) as sft_record_count,
                (SELECT COUNT(*) FROM dpo_tasks WHERE project_id = p.id) as dpo_task_count,
                (SELECT COUNT(*) FROM sft_sessions WHERE project_id = p.id AND status != 'committed') as active_draft_count
            FROM projects p
            WHERE p.id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Project {} not found", id)))?;

        let settings: Value = serde_json::from_str(&row.6).unwrap_or(serde_json::json!({}));
        Ok(Project {
            id: row.0,
            name: row.1,
            description: row.2,
            is_archived: row.3 != 0,
            created_at: row.4,
            updated_at: row.5,
            settings,
            sft_record_count: row.7,
            dpo_task_count: row.8,
            active_draft_count: row.9,
        })
    }

    pub async fn create(pool: &SqlitePool, input: ProjectCreateInput) -> Result<Project, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let settings_str = input.settings.map(|v| v.to_string()).unwrap_or_else(|| "{}".to_string());

        sqlx::query(
            "INSERT INTO projects (id, name, description, is_archived, created_at, updated_at, settings_json)
             VALUES (?, ?, ?, 0, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&now)
        .bind(&now)
        .bind(&settings_str)
        .execute(pool)
        .await?;

        Self::get(pool, &id).await
    }

    pub async fn update(pool: &SqlitePool, id: &str, input: ProjectUpdateInput) -> Result<Project, AppError> {
        let existing = Self::get(pool, id).await?;
        let now = Utc::now().to_rfc3339();

        let name = input.name.unwrap_or(existing.name);
        let description = input.description.or(existing.description);
        let is_archived = input.is_archived.map(|b| if b { 1 } else { 0 }).unwrap_or(if existing.is_archived { 1 } else { 0 });
        let settings_str = input.settings.map(|v| v.to_string()).unwrap_or_else(|| existing.settings.to_string());

        sqlx::query(
            "UPDATE projects SET name = ?, description = ?, is_archived = ?, settings_json = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&name)
        .bind(&description)
        .bind(is_archived)
        .bind(&settings_str)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Self::get(pool, id).await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM projects WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn duplicate(pool: &SqlitePool, id: &str, new_name: Option<String>) -> Result<Project, AppError> {
        let original = Self::get(pool, id).await?;
        let name = new_name.unwrap_or_else(|| format!("{} (Copy)", original.name));
        Self::create(pool, ProjectCreateInput {
            name,
            description: original.description,
            settings: Some(original.settings),
        }).await
    }
}
