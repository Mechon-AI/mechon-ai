use std::time::Instant;
use crate::credentials::CredentialStore;
use crate::providers::errors::ProviderErrorCode;
use crate::providers::factory::ProviderFactory;
use crate::providers::models::ConnectionTestResult;

pub struct ConnectionTester;

impl ConnectionTester {
    pub async fn test_provider(
        provider_type: &str,
        base_url: &str,
        credential_ref: Option<&str>,
        vault: &dyn CredentialStore,
        timeout_secs: i64,
    ) -> ConnectionTestResult {
        let start = Instant::now();

        // 1. Retrieve credential securely from vault
        let api_key = if let Some(cred_ref) = credential_ref {
            vault.get_credential(cred_ref).unwrap_or(None)
        } else {
            None
        };

        // 2. Instantiate native adapter from factory
        let adapter = ProviderFactory::create(
            provider_type,
            base_url,
            api_key,
            timeout_secs,
        );

        // 3. Perform real network request
        match adapter.list_models().await {
            Ok(models) => {
                let latency_ms = start.elapsed().as_millis() as i64;
                let model_ids: Vec<String> = models.into_iter().map(|m| m.id).collect();
                ConnectionTestResult {
                    success: true,
                    code: ProviderErrorCode::Success,
                    message: format!("Connection verified successfully ({} ms). Discovered {} model(s).", latency_ms, model_ids.len()),
                    models: model_ids,
                    latency_ms,
                }
            }
            Err(err) => {
                let latency_ms = start.elapsed().as_millis() as i64;
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
}
