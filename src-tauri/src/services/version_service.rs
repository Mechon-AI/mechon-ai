use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use sha2::{Sha256, Digest};
use serde_json::json;
use crate::errors::AppError;
use crate::models::{DatasetVersion, SnapshotCreateInput};

pub struct VersionService;

impl VersionService {
    pub async fn list(
        pool: &SqlitePool,
        project_id: &str,
        dataset_type: Option<&str>,
    ) -> Result<Vec<DatasetVersion>, AppError> {
        let (sql, bind_type) = match dataset_type {
            Some(t) if !t.is_empty() && t != "all" => (
                "SELECT id, project_id, dataset_type, version_tag, record_count, checksum_sha256, parent_version_id, change_summary, description, created_at
                 FROM dataset_versions
                 WHERE project_id = ? AND dataset_type = ?
                 ORDER BY created_at DESC",
                Some(t),
            ),
            _ => (
                "SELECT id, project_id, dataset_type, version_tag, record_count, checksum_sha256, parent_version_id, change_summary, description, created_at
                 FROM dataset_versions
                 WHERE project_id = ?
                 ORDER BY created_at DESC",
                None,
            ),
        };

        let rows = if let Some(t) = bind_type {
            sqlx::query_as::<_, (String, String, String, String, i64, String, Option<String>, Option<String>, Option<String>, String)>(sql)
                .bind(project_id)
                .bind(t)
                .fetch_all(pool)
                .await?
        } else {
            sqlx::query_as::<_, (String, String, String, String, i64, String, Option<String>, Option<String>, Option<String>, String)>(sql)
                .bind(project_id)
                .fetch_all(pool)
                .await?
        };

        let versions = rows.into_iter().map(|r| DatasetVersion {
            id: r.0,
            project_id: r.1,
            dataset_type: r.2,
            version_tag: r.3,
            record_count: r.4,
            checksum_sha256: r.5,
            parent_version_id: r.6,
            change_summary: r.7,
            description: r.8,
            created_at: r.9,
        }).collect();

        Ok(versions)
    }

    pub async fn create_snapshot(
        pool: &SqlitePool,
        input: SnapshotCreateInput,
    ) -> Result<DatasetVersion, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let (snapshot_json, record_count, summary) = if input.dataset_type == "sft" {
            let records = crate::services::dataset_service::DatasetService::list_sft_records(
                pool,
                &input.project_id,
                None,
                None,
                100000,
                0,
            ).await?;
            let count = records.0.len() as i64;
            let serialized = serde_json::to_string(&records.0)?;
            (serialized, count, format!("SFT snapshot containing {} records", count))
        } else if input.dataset_type == "dpo" {
            let tasks = crate::services::dpo_service::DPOService::list(
                pool,
                &input.project_id,
                None,
                None,
                100000,
                0,
            ).await?;
            let count = tasks.0.len() as i64;
            let serialized = serde_json::to_string(&tasks.0)?;
            (serialized, count, format!("DPO snapshot containing {} tasks", count))
        } else {
            let sft = crate::services::dataset_service::DatasetService::list_sft_records(pool, &input.project_id, None, None, 100000, 0).await?;
            let dpo = crate::services::dpo_service::DPOService::list(pool, &input.project_id, None, None, 100000, 0).await?;
            let combined = json!({
                "sft": sft.0,
                "dpo": dpo.0
            });
            let count = (sft.0.len() + dpo.0.len()) as i64;
            let serialized = serde_json::to_string(&combined)?;
            (serialized, count, format!("Combined snapshot: {} SFT records, {} DPO tasks", sft.0.len(), dpo.0.len()))
        };

        // Compute SHA-256
        let mut hasher = Sha256::new();
        hasher.update(snapshot_json.as_bytes());
        let checksum = hex::encode(hasher.finalize());

        sqlx::query(
            "INSERT INTO dataset_versions (id, project_id, dataset_type, version_tag, record_count, checksum_sha256, change_summary, description, snapshot_data_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&input.project_id)
        .bind(&input.dataset_type)
        .bind(&input.version_tag)
        .bind(record_count)
        .bind(&checksum)
        .bind(&summary)
        .bind(&input.description)
        .bind(&snapshot_json)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(DatasetVersion {
            id,
            project_id: input.project_id,
            dataset_type: input.dataset_type,
            version_tag: input.version_tag,
            record_count,
            checksum_sha256: checksum,
            parent_version_id: None,
            change_summary: Some(summary),
            description: input.description,
            created_at: now,
        })
    }

    pub async fn restore_snapshot(pool: &SqlitePool, version_id: &str) -> Result<(), AppError> {
        let row = sqlx::query_as::<_, (String, String, String)>(
            "SELECT project_id, dataset_type, snapshot_data_json FROM dataset_versions WHERE id = ?"
        )
        .bind(version_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Version {} not found", version_id)))?;

        let (project_id, dataset_type, snapshot_json) = row;

        if dataset_type == "sft" {
            let records: Vec<crate::models::SFTRecord> = serde_json::from_str(&snapshot_json)?;
            sqlx::query("DELETE FROM sft_records WHERE project_id = ?").bind(&project_id).execute(pool).await?;

            for r in records {
                let msgs_str = r.messages.to_string();
                let meta_str = r.metadata.to_string();
                sqlx::query(
                    "INSERT INTO sft_records (id, project_id, session_id, messages_json, turn_count, character_count, metadata_json, revision, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .bind(&r.id)
                .bind(&project_id)
                .bind(&r.session_id)
                .bind(&msgs_str)
                .bind(r.turn_count)
                .bind(r.character_count)
                .bind(&meta_str)
                .bind(r.revision)
                .bind(&r.created_at)
                .bind(&r.updated_at)
                .execute(pool)
                .await?;
            }
        } else if dataset_type == "dpo" {
            let tasks: Vec<crate::models::DPOTask> = serde_json::from_str(&snapshot_json)?;
            sqlx::query("DELETE FROM dpo_tasks WHERE project_id = ?").bind(&project_id).execute(pool).await?;

            for t in tasks {
                let meta_str = t.metadata.to_string();
                sqlx::query(
                    "INSERT INTO dpo_tasks (id, project_id, prompt, system_prompt, response_a, response_b, preference, rationale, helpfulness_rating, factuality_rating, status, metadata_json, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .bind(&t.id)
                .bind(&project_id)
                .bind(&t.prompt)
                .bind(&t.system_prompt)
                .bind(&t.response_a)
                .bind(&t.response_b)
                .bind(&t.preference)
                .bind(&t.rationale)
                .bind(t.helpfulness_rating)
                .bind(t.factuality_rating)
                .bind(&t.status)
                .bind(&meta_str)
                .bind(&t.created_at)
                .bind(&t.updated_at)
                .execute(pool)
                .await?;
            }
        }

        Ok(())
    }

    pub async fn compare_snapshots(
        pool: &SqlitePool,
        version_a: &str,
        version_b: &str,
    ) -> Result<serde_json::Value, AppError> {
        let v_a = sqlx::query_as::<_, (String, String, i64, String)>(
            "SELECT version_tag, dataset_type, record_count, checksum_sha256 FROM dataset_versions WHERE id = ?"
        ).bind(version_a).fetch_optional(pool).await?.ok_or_else(|| AppError::NotFound(version_a.to_string()))?;

        let v_b = sqlx::query_as::<_, (String, String, i64, String)>(
            "SELECT version_tag, dataset_type, record_count, checksum_sha256 FROM dataset_versions WHERE id = ?"
        ).bind(version_b).fetch_optional(pool).await?.ok_or_else(|| AppError::NotFound(version_b.to_string()))?;

        Ok(json!({
            "version_a": {
                "id": version_a,
                "tag": v_a.0,
                "dataset_type": v_a.1,
                "record_count": v_a.2,
                "checksum": v_a.3
            },
            "version_b": {
                "id": version_b,
                "tag": v_b.0,
                "dataset_type": v_b.1,
                "record_count": v_b.2,
                "checksum": v_b.3
            },
            "record_difference": v_b.2 - v_a.2,
            "is_identical": v_a.3 == v_b.3
        }))
    }
}
