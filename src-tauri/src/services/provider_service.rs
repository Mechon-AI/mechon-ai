use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use crate::errors::AppError;
use crate::models::{Provider, ProviderCreateInput, ProviderUpdateInput};
use crate::providers::create_provider;

pub struct ProviderService;

impl ProviderService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<Provider>, AppError> {
        let rows = sqlx::query_as::<_, (
            String, String, String, String, Option<String>, Option<String>,
            String, i64, i64, String, String, String
        )>(
            "SELECT id, name, provider_type, base_url, api_key_encrypted, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at
             FROM providers
             ORDER BY created_at ASC"
        )
        .fetch_all(pool)
        .await?;

        let providers = rows.into_iter().map(|r| {
            let has_api_key = r.4.as_ref().map(|k| !k.is_empty()).unwrap_or(false);
            let models_cache: Vec<String> = serde_json::from_str(&r.6).unwrap_or_default();
            let settings: Value = serde_json::from_str(&r.9).unwrap_or(serde_json::json!({}));
            Provider {
                id: r.0,
                name: r.1,
                provider_type: r.2,
                base_url: r.3,
                has_api_key,
                default_model: r.5,
                models_cache,
                timeout_seconds: r.7,
                is_active: r.8 != 0,
                settings,
                created_at: r.10,
                updated_at: r.11,
            }
        }).collect();

        Ok(providers)
    }

    pub async fn get(pool: &SqlitePool, id: &str) -> Result<Provider, AppError> {
        let row = sqlx::query_as::<_, (
            String, String, String, String, Option<String>, Option<String>,
            String, i64, i64, String, String, String
        )>(
            "SELECT id, name, provider_type, base_url, api_key_encrypted, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at
             FROM providers
             WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Provider {} not found", id)))?;

        let has_api_key = row.4.as_ref().map(|k| !k.is_empty()).unwrap_or(false);
        let models_cache: Vec<String> = serde_json::from_str(&row.6).unwrap_or_default();
        let settings: Value = serde_json::from_str(&row.9).unwrap_or(serde_json::json!({}));

        Ok(Provider {
            id: row.0,
            name: row.1,
            provider_type: row.2,
            base_url: row.3,
            has_api_key,
            default_model: row.5,
            models_cache,
            timeout_seconds: row.7,
            is_active: row.8 != 0,
            settings,
            created_at: row.10,
            updated_at: row.11,
        })
    }

    pub async fn get_raw_key(pool: &SqlitePool, id: &str) -> Result<Option<String>, AppError> {
        let row = sqlx::query_as::<_, (Option<String>,)>(
            "SELECT api_key_encrypted FROM providers WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(row.and_then(|r| r.0))
    }

    pub async fn create(pool: &SqlitePool, input: ProviderCreateInput) -> Result<Provider, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let timeout = input.timeout_seconds.unwrap_or(60);
        let settings_str = input.settings.map(|v| v.to_string()).unwrap_or_else(|| "{}".to_string());

        sqlx::query(
            "INSERT INTO providers (id, name, provider_type, base_url, api_key_encrypted, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, '[]', ?, 1, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&input.name)
        .bind(&input.provider_type)
        .bind(&input.base_url)
        .bind(&input.api_key)
        .bind(&input.default_model)
        .bind(timeout)
        .bind(&settings_str)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        Self::get(pool, &id).await
    }

    pub async fn update(pool: &SqlitePool, id: &str, input: ProviderUpdateInput) -> Result<Provider, AppError> {
        let existing = Self::get(pool, id).await?;
        let existing_raw_key = Self::get_raw_key(pool, id).await?;
        let now = Utc::now().to_rfc3339();

        let name = input.name.unwrap_or(existing.name);
        let base_url = input.base_url.unwrap_or(existing.base_url);
        let api_key = input.api_key.or(existing_raw_key);
        let default_model = input.default_model.or(existing.default_model);
        let timeout = input.timeout_seconds.unwrap_or(existing.timeout_seconds);
        let is_active = input.is_active.map(|b| if b { 1 } else { 0 }).unwrap_or(if existing.is_active { 1 } else { 0 });
        let settings_str = input.settings.map(|v| v.to_string()).unwrap_or_else(|| existing.settings.to_string());

        sqlx::query(
            "UPDATE providers
             SET name = ?, base_url = ?, api_key_encrypted = ?, default_model = ?, timeout_seconds = ?, is_active = ?, settings_json = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&name)
        .bind(&base_url)
        .bind(&api_key)
        .bind(&default_model)
        .bind(timeout)
        .bind(is_active)
        .bind(&settings_str)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Self::get(pool, id).await
    }

    pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM providers WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn test_provider(pool: &SqlitePool, id: &str) -> Result<(bool, Vec<String>), AppError> {
        let provider = Self::get(pool, id).await?;
        let api_key = Self::get_raw_key(pool, id).await?;

        let instance = create_provider(
            &provider.provider_type,
            &provider.base_url,
            api_key,
            provider.timeout_seconds,
        );

        let models = instance.test_connection().await?;
        let models_cache_json = serde_json::to_string(&models)?;
        let now = Utc::now().to_rfc3339();

        let default_model = if provider.default_model.is_none() || provider.default_model.as_deref() == Some("") {
            models.first().cloned()
        } else {
            provider.default_model
        };

        sqlx::query(
            "UPDATE providers SET models_cache_json = ?, default_model = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&models_cache_json)
        .bind(&default_model)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Ok((true, models))
    }
}
