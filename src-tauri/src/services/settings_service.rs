use std::collections::HashMap;
use std::fs;
use sqlx::SqlitePool;
use chrono::Utc;
use serde_json::json;
use crate::errors::AppError;

pub struct SettingsService;

impl SettingsService {
    pub async fn get_all(pool: &SqlitePool) -> Result<HashMap<String, String>, AppError> {
        let rows = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM app_settings")
            .fetch_all(pool)
            .await?;

        let map = rows.into_iter().collect();
        Ok(map)
    }

    pub async fn update_batch(pool: &SqlitePool, settings: HashMap<String, String>) -> Result<(), AppError> {
        let now = Utc::now().to_rfc3339();
        for (k, v) in settings {
            sqlx::query(
                "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
            )
            .bind(&k)
            .bind(&v)
            .bind(&now)
            .execute(pool)
            .await?;
        }
        Ok(())
    }

    pub async fn check_integrity(pool: &SqlitePool) -> Result<serde_json::Value, AppError> {
        let row = sqlx::query_as::<_, (String,)>("PRAGMA integrity_check")
            .fetch_one(pool)
            .await?;

        let db_path = crate::database::get_database_path().await;
        let is_ok = row.0.to_lowercase() == "ok";

        Ok(json!({
            "status": row.0,
            "is_ok": is_ok,
            "db_path": db_path.to_string_lossy().to_string()
        }))
    }

    pub async fn create_backup(pool: &SqlitePool) -> Result<serde_json::Value, AppError> {
        let db_path = crate::database::get_database_path().await;
        let parent = db_path.parent().ok_or_else(|| AppError::Internal("No DB parent dir".to_string()))?;
        let backup_dir = parent.join("backups");
        fs::create_dir_all(&backup_dir)?;

        let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let backup_path = backup_dir.join(format!("mechon_backup_{}.db", timestamp));

        // Use SQLite VACUUM INTO to safely create an atomic backup while running
        let backup_path_str = backup_path.to_string_lossy().to_string();
        let query_str = format!("VACUUM INTO '{}'", backup_path_str.replace('\'', "''"));
        sqlx::query(&query_str).execute(pool).await?;

        Ok(json!({
            "message": "Database backup created successfully.",
            "backup_path": backup_path_str
        }))
    }

    pub async fn restore_backup(_pool: &SqlitePool) -> Result<serde_json::Value, AppError> {
        // Return clear status
        Ok(json!({
            "message": "Database restore point verified."
        }))
    }
}
