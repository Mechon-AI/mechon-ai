use sqlx::SqlitePool;
use uuid::Uuid;
use chrono::Utc;
use serde_json::Value;
use tracing::info;
use crate::credentials::{
    compute_fingerprint, legacy_credential_ref, make_credential_ref, CredentialStore,
};
use crate::errors::AppError;
use crate::models::{Provider, ProviderCreateInput, ProviderUpdateInput};
use crate::providers::models::ConnectionTestResult;
use crate::providers::registry::ProviderRegistry;
use crate::services::connection_tester::ConnectionTester;

pub struct ProviderService;

impl ProviderService {
    pub async fn list(pool: &SqlitePool, vault: &dyn CredentialStore) -> Result<Vec<Provider>, AppError> {
        let rows = sqlx::query_as::<_, (
            String, String, String, String, Option<String>, Option<String>,
            String, i64, i64, String, String, String
        )>(
            "SELECT id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at
             FROM providers
             ORDER BY created_at ASC"
        )
        .fetch_all(pool)
        .await?;

        let mut providers = Vec::new();
        for r in rows {
            let primary_ref = r.4.clone().unwrap_or_else(|| make_credential_ref(&r.0));
            let mut status = vault.get_status(&primary_ref);
            if !status.has_api_key {
                let alt_ref = legacy_credential_ref(&r.0);
                let alt_status = vault.get_status(&alt_ref);
                if alt_status.has_api_key {
                    status = alt_status;
                }
            }

            let models_cache: Vec<String> = serde_json::from_str(&r.6).unwrap_or_default();
            let settings: Value = serde_json::from_str(&r.9).unwrap_or(serde_json::json!({}));

            providers.push(Provider {
                id: r.0,
                name: r.1,
                provider_type: r.2,
                base_url: r.3,
                has_api_key: status.has_api_key,
                credential_status: status.credential_status,
                masked_hint: status.masked_hint,
                default_model: r.5,
                models_cache,
                timeout_seconds: r.7,
                is_active: r.8 != 0,
                settings,
                created_at: r.10,
                updated_at: r.11,
            });
        }

        Ok(providers)
    }

    pub async fn get(pool: &SqlitePool, id: &str, vault: &dyn CredentialStore) -> Result<Provider, AppError> {
        let row = sqlx::query_as::<_, (
            String, String, String, String, Option<String>, Option<String>,
            String, i64, i64, String, String, String
        )>(
            "SELECT id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at
             FROM providers
             WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Provider {} not found", id)))?;

        let primary_ref = row.4.clone().unwrap_or_else(|| make_credential_ref(&row.0));
        let mut status = vault.get_status(&primary_ref);
        if !status.has_api_key {
            let alt_ref = legacy_credential_ref(&row.0);
            let alt_status = vault.get_status(&alt_ref);
            if alt_status.has_api_key {
                status = alt_status;
            }
        }

        let models_cache: Vec<String> = serde_json::from_str(&row.6).unwrap_or_default();
        let settings: Value = serde_json::from_str(&row.9).unwrap_or(serde_json::json!({}));

        Ok(Provider {
            id: row.0,
            name: row.1,
            provider_type: row.2,
            base_url: row.3,
            has_api_key: status.has_api_key,
            credential_status: status.credential_status,
            masked_hint: status.masked_hint,
            default_model: row.5,
            models_cache,
            timeout_seconds: row.7,
            is_active: row.8 != 0,
            settings,
            created_at: row.10,
            updated_at: row.11,
        })
    }

    pub async fn get_raw_key(
        pool: &SqlitePool,
        id: &str,
        vault: &dyn CredentialStore,
    ) -> Result<Option<String>, AppError> {
        let row = sqlx::query_as::<_, (Option<String>, Option<String>)>(
            "SELECT credential_ref, api_key_encrypted FROM providers WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        if let Some((cred_ref, legacy_key)) = row {
            // 1. Try DB-stored credential_ref
            if let Some(ref cr) = cred_ref {
                if let Ok(Some(secret)) = vault.get_credential(cr) {
                    let trimmed = secret.trim();
                    if !trimmed.is_empty() {
                        return Ok(Some(trimmed.to_string()));
                    }
                }
            }

            // 2. Try standard reference provider:{id}:api_key
            let std_ref = make_credential_ref(id);
            if let Ok(Some(secret)) = vault.get_credential(&std_ref) {
                let trimmed = secret.trim();
                if !trimmed.is_empty() {
                    return Ok(Some(trimmed.to_string()));
                }
            }

            // 3. Try legacy reference provider_{id}
            let leg_ref = legacy_credential_ref(id);
            if let Ok(Some(secret)) = vault.get_credential(&leg_ref) {
                let trimmed = secret.trim();
                if !trimmed.is_empty() {
                    return Ok(Some(trimmed.to_string()));
                }
            }

            // 4. Fallback: migrate legacy plaintext/encrypted key from DB
            if let Some(legacy) = legacy_key {
                let trimmed = legacy.trim();
                if !trimmed.is_empty() {
                    let _ = vault.save_credential(&std_ref, trimmed);
                    let _ = sqlx::query(
                        "UPDATE providers SET credential_ref = ?, api_key_encrypted = NULL WHERE id = ?"
                    )
                    .bind(&std_ref)
                    .bind(id)
                    .execute(pool)
                    .await;
                    return Ok(Some(trimmed.to_string()));
                }
            }
        }

        Ok(None)
    }

    pub async fn create(
        pool: &SqlitePool,
        input: ProviderCreateInput,
        vault: &dyn CredentialStore,
    ) -> Result<Provider, AppError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let timeout = input.timeout_seconds.unwrap_or(60);
        let settings_str = input.settings.map(|v| v.to_string()).unwrap_or_else(|| "{}".to_string());

        let registry = ProviderRegistry::global();
        let definition = registry.get_or_default(&input.provider_type);

        let base_url = input.base_url.unwrap_or_else(|| {
            let mut u = definition.default_host.clone();
            if !definition.default_path.is_empty() {
                u.push_str(&definition.default_path);
            }
            u
        });

        let default_model = input.default_model.or_else(|| Some(definition.default_model.clone()));
        let initial_cache = serde_json::to_string(&definition.curated_models)?;

        let ref_id = make_credential_ref(&id);
        let mut credential_ref = None;

        if let Some(ref key) = input.api_key {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                info!("[Credential] Provider ID: {}", id);
                info!("[Credential] Vault backend: {}", vault.backend_name());
                info!("[Credential] Vault availability: AVAILABLE");

                vault.save_credential(&ref_id, trimmed)
                    .map_err(|e| AppError::Internal(format!("Failed to save credential to vault: {}", e)))?;

                // Read-back verification
                match vault.get_credential(&ref_id) {
                    Ok(Some(retrieved)) if retrieved == trimmed => {
                        let fp = compute_fingerprint(trimmed);
                        info!("[Credential] Save operation: SUCCESS");
                        info!("[Credential] Read-back verification: SUCCESS");
                        info!("[Credential] Credential length: {}", trimmed.len());
                        info!("[Credential] Credential fingerprint: {}", fp);
                        credential_ref = Some(ref_id.clone());
                    }
                    _ => {
                        let _ = vault.delete_credential(&ref_id);
                        return Err(AppError::Internal(
                            "Credential save failed: immediate vault read-back verification failed".to_string()
                        ));
                    }
                }
            }
        }

        let insert_res = sqlx::query(
            "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)"
        )
        .bind(&id)
        .bind(&input.name)
        .bind(&definition.provider_type.as_str())
        .bind(&base_url)
        .bind(&credential_ref)
        .bind(&default_model)
        .bind(&initial_cache)
        .bind(timeout)
        .bind(&settings_str)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await;

        if let Err(e) = insert_res {
            // Rollback vault write if database transaction fails
            if credential_ref.is_some() {
                let _ = vault.delete_credential(&ref_id);
            }
            return Err(AppError::from(e));
        }

        Self::get(pool, &id, vault).await
    }

    pub async fn update(
        pool: &SqlitePool,
        id: &str,
        input: ProviderUpdateInput,
        vault: &dyn CredentialStore,
    ) -> Result<Provider, AppError> {
        let existing = Self::get(pool, id, vault).await?;
        let now = Utc::now().to_rfc3339();

        let name = input.name.unwrap_or(existing.name);
        let base_url = input.base_url.unwrap_or(existing.base_url);
        let default_model = input.default_model.or(existing.default_model);
        let timeout = input.timeout_seconds.unwrap_or(existing.timeout_seconds);
        let is_active = input.is_active.map(|b| if b { 1 } else { 0 }).unwrap_or(if existing.is_active { 1 } else { 0 });
        let settings_str = input.settings.map(|v| v.to_string()).unwrap_or_else(|| existing.settings.to_string());

        let ref_id = make_credential_ref(id);
        let credential_ref = if input.clear_api_key == Some(true) {
            info!("[Credential] Explicit credential removal requested for provider {}", id);
            let _ = vault.delete_credential(&ref_id);
            let _ = vault.delete_credential(&legacy_credential_ref(id));
            None
        } else if let Some(ref new_key) = input.api_key {
            let trimmed = new_key.trim();
            if !trimmed.is_empty() {
                info!("[Credential] Updating credential for provider {}", id);
                vault.save_credential(&ref_id, trimmed)
                    .map_err(|e| AppError::Internal(format!("Failed to update credential in vault: {}", e)))?;

                // Read-back verification
                match vault.get_credential(&ref_id) {
                    Ok(Some(retrieved)) if retrieved == trimmed => {
                        let fp = compute_fingerprint(trimmed);
                        info!("[Credential] Save operation: SUCCESS");
                        info!("[Credential] Read-back verification: SUCCESS");
                        info!("[Credential] Credential length: {}", trimmed.len());
                        info!("[Credential] Credential fingerprint: {}", fp);
                        Some(ref_id)
                    }
                    _ => {
                        return Err(AppError::Internal(
                            "Credential update failed: vault read-back verification failed".to_string()
                        ));
                    }
                }
            } else {
                // Empty string in update means preserve existing credential reference!
                let cur = sqlx::query_scalar::<_, Option<String>>(
                    "SELECT credential_ref FROM providers WHERE id = ?"
                )
                .bind(id)
                .fetch_one(pool)
                .await
                .unwrap_or(None);
                cur.or_else(|| Some(ref_id))
            }
        } else {
            // Unchanged: preserve existing credential reference!
            let cur = sqlx::query_scalar::<_, Option<String>>(
                "SELECT credential_ref FROM providers WHERE id = ?"
            )
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap_or(None);
            cur
        };

        sqlx::query(
            "UPDATE providers
             SET name = ?, base_url = ?, credential_ref = ?, default_model = ?, timeout_seconds = ?, is_active = ?, settings_json = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&name)
        .bind(&base_url)
        .bind(&credential_ref)
        .bind(&default_model)
        .bind(timeout)
        .bind(is_active)
        .bind(&settings_str)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

        Self::get(pool, id, vault).await
    }

    pub async fn delete(pool: &SqlitePool, id: &str, vault: &dyn CredentialStore) -> Result<(), AppError> {
        let std_ref = make_credential_ref(id);
        let leg_ref = legacy_credential_ref(id);

        sqlx::query("DELETE FROM providers WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        let _ = vault.delete_credential(&std_ref);
        let _ = vault.delete_credential(&leg_ref);
        Ok(())
    }

    pub async fn test_provider(
        pool: &SqlitePool,
        id: &str,
        vault: &dyn CredentialStore,
    ) -> Result<ConnectionTestResult, AppError> {
        let provider = Self::get(pool, id, vault).await?;
        let api_key = Self::get_raw_key(pool, id, vault).await?;

        let key_fingerprint = api_key.as_ref().map(|k| compute_fingerprint(k));
        info!(
            "[Credential] Testing provider '{}' ({}), key present: {}, fingerprint: {:?}",
            provider.name, provider.provider_type, api_key.is_some(), key_fingerprint
        );

        let result = ConnectionTester::test_provider_with_key(
            &provider.provider_type,
            &provider.base_url,
            api_key,
            provider.timeout_seconds,
        ).await;

        if result.success && !result.models.is_empty() {
            let models_json = serde_json::to_string(&result.models)?;
            let now = Utc::now().to_rfc3339();
            let default_model = if provider.default_model.is_none() || provider.default_model.as_deref() == Some("") {
                result.models.first().cloned()
            } else {
                provider.default_model
            };

            let _ = sqlx::query(
                "UPDATE providers SET models_cache_json = ?, default_model = ?, updated_at = ? WHERE id = ?"
            )
            .bind(&models_json)
            .bind(&default_model)
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await;
        }

        Ok(result)
    }

    pub async fn diagnose(
        pool: &SqlitePool,
        id: &str,
        vault: &dyn CredentialStore,
    ) -> Result<crate::providers::models::ProviderDiagnosticReport, AppError> {
        let provider = Self::get(pool, id, vault).await?;
        let api_key = Self::get_raw_key(pool, id, vault).await?;

        let report = ConnectionTester::diagnose_provider(
            &provider.id,
            &provider.name,
            &provider.provider_type,
            &provider.base_url,
            provider.default_model.as_deref(),
            api_key,
            provider.timeout_seconds,
        ).await;

        if report.model_discovery_status == crate::providers::models::DiagnosticCheckStatus::Pass && !report.models_discovered.is_empty() {
            let models_json = serde_json::to_string(&report.models_discovered)?;
            let now = Utc::now().to_rfc3339();
            let default_model = if provider.default_model.is_none() || provider.default_model.as_deref() == Some("") {
                report.models_discovered.first().cloned()
            } else {
                provider.default_model
            };

            let _ = sqlx::query(
                "UPDATE providers SET models_cache_json = ?, default_model = ?, updated_at = ? WHERE id = ?"
            )
            .bind(&models_json)
            .bind(&default_model)
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await;
        }

        Ok(report)
    }

    pub async fn migrate_legacy_credentials(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
    ) -> Result<(), AppError> {
        let rows = sqlx::query_as::<_, (String, Option<String>)>(
            "SELECT id, api_key_encrypted FROM providers WHERE api_key_encrypted IS NOT NULL AND api_key_encrypted != ''"
        )
        .fetch_all(pool)
        .await?;

        for (id, legacy_key) in rows {
            if let Some(key) = legacy_key {
                let trimmed = key.trim();
                if !trimmed.is_empty() {
                    let std_ref = make_credential_ref(&id);
                    if vault.save_credential(&std_ref, trimmed).is_ok() {
                        info!("Migrated legacy credential for provider {} to vault (ref={})", id, std_ref);
                        let _ = sqlx::query("UPDATE providers SET credential_ref = ?, api_key_encrypted = NULL WHERE id = ?")
                            .bind(&std_ref)
                            .bind(&id)
                            .execute(pool)
                            .await;
                    }
                }
            }
        }

        Ok(())
    }
}
