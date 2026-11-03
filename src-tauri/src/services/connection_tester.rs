use std::time::Instant;
use tokio::sync::mpsc;
use tracing::{info, warn};
use crate::credentials::{compute_fingerprint, CredentialStore};
use crate::providers::errors::ProviderErrorCode;
use crate::providers::factory::ProviderFactory;
use crate::providers::models::{
    ChatMessage, ChatRequest, ConnectionTestResult, DiagnosticCheckStatus, ProviderDiagnosticReport,
};

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

    pub async fn diagnose_provider(
        provider_id: &str,
        provider_name: &str,
        provider_type: &str,
        base_url: &str,
        default_model: Option<&str>,
        api_key: Option<String>,
        timeout_secs: i64,
    ) -> ProviderDiagnosticReport {
        let total_start = Instant::now();
        let adapter = ProviderFactory::create(
            provider_type,
            base_url,
            api_key.clone(),
            timeout_secs.max(10),
        );

        // 1. Auth Check
        let (auth_status, auth_details) = match (provider_type, &api_key) {
            ("mock", _) => (DiagnosticCheckStatus::Pass, "Built-in offline mock provider does not require authentication.".to_string()),
            ("ollama", _) => (DiagnosticCheckStatus::Pass, "Ollama local daemon connection does not require authentication.".to_string()),
            (_, Some(k)) if !k.trim().is_empty() => (
                DiagnosticCheckStatus::Pass,
                format!("API Key present (len={}, fingerprint={})", k.len(), compute_fingerprint(k))
            ),
            (_, _) => (
                DiagnosticCheckStatus::Fail,
                "API Key is missing or empty. Please set an API Key in provider settings.".to_string()
            ),
        };

        // 2. Model Discovery & Connection
        let disc_start = Instant::now();
        let (conn_status, conn_latency, conn_http, conn_err, disc_status, disc_models, disc_latency, disc_err) = match adapter.list_models().await {
            Ok(models) => {
                let ms = disc_start.elapsed().as_millis() as i64;
                let ids: Vec<String> = models.into_iter().map(|m| m.id).collect();
                (
                    DiagnosticCheckStatus::Pass,
                    Some(ms),
                    Some(200),
                    None,
                    DiagnosticCheckStatus::Pass,
                    ids,
                    Some(ms),
                    None,
                )
            }
            Err(err) => {
                let ms = disc_start.elapsed().as_millis() as i64;
                (
                    DiagnosticCheckStatus::Fail,
                    Some(ms),
                    err.http_status,
                    Some(err.message.clone()),
                    DiagnosticCheckStatus::Fail,
                    Vec::new(),
                    Some(ms),
                    Some(err.message),
                )
            }
        };

        // Resolve test model
        let test_model = default_model
            .map(|s| s.to_string())
            .filter(|m| !m.trim().is_empty() && (disc_models.is_empty() || disc_models.contains(m)))
            .or_else(|| disc_models.first().cloned())
            .unwrap_or_else(|| "default".to_string());

        // 3. Non-Streaming Generation Check
        let (gen_status, gen_latency, gen_http, gen_output, gen_err) = if conn_status == DiagnosticCheckStatus::Fail && auth_status == DiagnosticCheckStatus::Fail {
            (DiagnosticCheckStatus::Skipped, None, None, None, Some("Skipped due to connection or authentication failure.".to_string()))
        } else {
            let g_start = Instant::now();
            let req = ChatRequest {
                model: test_model.clone(),
                messages: vec![ChatMessage {
                    role: "user".to_string(),
                    content: "Respond with 'READY' in one word.".to_string(),
                }],
                temperature: Some(0.1),
                top_p: None,
                max_tokens: Some(32),
                stream: false,
            };

            match adapter.chat(req).await {
                Ok(resp) => {
                    let ms = g_start.elapsed().as_millis() as i64;
                    let trimmed = resp.content.trim().to_string();
                    (
                        DiagnosticCheckStatus::Pass,
                        Some(ms),
                        Some(200),
                        Some(trimmed),
                        None,
                    )
                }
                Err(err) => {
                    let ms = g_start.elapsed().as_millis() as i64;
                    (
                        DiagnosticCheckStatus::Fail,
                        Some(ms),
                        err.http_status,
                        None,
                        Some(err.message),
                    )
                }
            }
        };

        // 4. Streaming Generation Check
        let (stream_status, stream_latency, stream_chunks, stream_output, stream_err) = if gen_status != DiagnosticCheckStatus::Pass {
            (DiagnosticCheckStatus::Skipped, None, 0, None, Some("Skipped due to non-streaming generation failure.".to_string()))
        } else {
            let s_start = Instant::now();
            let (tx, mut rx) = mpsc::unbounded_channel();
            let req = ChatRequest {
                model: test_model.clone(),
                messages: vec![ChatMessage {
                    role: "user".to_string(),
                    content: "Count from 1 to 3.".to_string(),
                }],
                temperature: Some(0.1),
                top_p: None,
                max_tokens: Some(32),
                stream: true,
            };

            let stream_fut = adapter.chat_stream(req, tx);
            match stream_fut.await {
                Ok(_) => {
                    let mut collected = String::new();
                    let mut count = 0;
                    while let Ok(chunk) = rx.try_recv() {
                        count += 1;
                        collected.push_str(&chunk);
                    }
                    let ms = s_start.elapsed().as_millis() as i64;
                    (
                        DiagnosticCheckStatus::Pass,
                        Some(ms),
                        count,
                        Some(collected.trim().to_string()),
                        None,
                    )
                }
                Err(err) => {
                    let ms = s_start.elapsed().as_millis() as i64;
                    (
                        DiagnosticCheckStatus::Fail,
                        Some(ms),
                        0,
                        None,
                        Some(err.message),
                    )
                }
            }
        };

        let total_ms = total_start.elapsed().as_millis() as i64;
        let is_op = conn_status == DiagnosticCheckStatus::Pass
            && gen_status == DiagnosticCheckStatus::Pass
            && stream_status == DiagnosticCheckStatus::Pass;

        let summary = if is_op {
            format!("Provider '{}' is 100% OPERATIONAL. Connection, model discovery, standard generation, and streaming all passed (total {} ms).", provider_name, total_ms)
        } else {
            format!("Provider '{}' failed verification. Operational status: NON-OPERATIONAL.", provider_name)
        };

        ProviderDiagnosticReport {
            provider_id: provider_id.to_string(),
            provider_type: provider_type.to_string(),
            provider_name: provider_name.to_string(),
            base_url: base_url.to_string(),
            model_used: Some(test_model),
            connection_status: conn_status,
            connection_latency_ms: conn_latency,
            connection_http_status: conn_http,
            connection_error: conn_err,
            auth_status,
            auth_details,
            model_discovery_status: disc_status,
            models_discovered: disc_models,
            discovery_latency_ms: disc_latency,
            discovery_error: disc_err,
            generation_status: gen_status,
            generation_latency_ms: gen_latency,
            generation_http_status: gen_http,
            generation_sample_output: gen_output,
            generation_error: gen_err,
            streaming_status: stream_status,
            streaming_latency_ms: stream_latency,
            streaming_chunk_count: stream_chunks,
            streaming_sample_output: stream_output,
            streaming_error: stream_err,
            is_operational: is_op,
            total_latency_ms: total_ms,
            diagnostic_summary: summary,
        }
    }
}
