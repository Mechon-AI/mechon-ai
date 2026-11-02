use std::time::Instant;
use tracing::{info, warn};
use crate::credentials::{compute_fingerprint, CredentialStore};
use crate::providers::errors::ProviderErrorCode;
use crate::providers::factory::ProviderFactory;
use crate::providers::models::ConnectionTestResult;

pub struct ConnectionTester;

impl ConnectionTester {
    pub async fn test_provider_with_key(
        provider_type: &str,
        base_url: &str,
        api_key: Option<String>,
        timeout_secs: i64,
    ) -> ConnectionTestResult {
        let start = Instant::now();
        let auth_present = api_key.as_ref().map(|k| !k.trim().is_empty()).unwrap_or(false);
        let fp = api_key.as_ref().map(|k| compute_fingerprint(k));

        info!(
            "[Credential] Initiating connection test for '{}' at '{}' | HTTP authorization: {} | Fingerprint: {:?}",
            provider_type, base_url, if auth_present { "PRESENT" } else { "ABSENT" }, fp
        );

        let adapter = ProviderFactory::create(
            provider_type,
            base_url,
            api_key,
            timeout_secs,
        );

        match adapter.list_models().await {
            Ok(models) => {
                let latency_ms = start.elapsed().as_millis() as i64;
                let model_ids: Vec<String> = models.into_iter().map(|m| m.id).collect();
                info!(
                    "[Credential] HTTP response: 200 SUCCESS ({} ms) | Discovered {} model(s)",
                    latency_ms, model_ids.len()
                );
                ConnectionTestResult {
                    success: true,
                    code: ProviderErrorCode::Success,
                    message: format!(
                        "Connection verified successfully ({} ms). Discovered {} model(s).",
                        latency_ms, model_ids.len()
                    ),
                    models: model_ids,
                    latency_ms,
                }
            }
            Err(err) => {
                let latency_ms = start.elapsed().as_millis() as i64;
                warn!(
                    "[Credential] HTTP response failure: code={:?} status={:?} msg='{}' ({} ms)",
                    err.code, err.http_status, err.message, latency_ms
                );
                ConnectionTestResult {
                    success: false,
                    code: err.code,
                    message: err.message,
                    models: Vec::new(),
                    latency_ms,
                }
            }
        }
    }

    pub async fn test_provider(
        provider_type: &str,
        base_url: &str,
        credential_ref: Option<&str>,
        vault: &dyn CredentialStore,
        timeout_secs: i64,
    ) -> ConnectionTestResult {
        let api_key = if let Some(cred_ref) = credential_ref {
            vault.get_credential(cred_ref).unwrap_or(None)
        } else {
            None
        };

        Self::test_provider_with_key(provider_type, base_url, api_key, timeout_secs).await
    }
}
