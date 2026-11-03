use serde::{Deserialize, Serialize};
use super::capabilities::ModelCapabilities;
use super::errors::ProviderErrorCode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i64>,
    pub stream: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UsageInfo {
    pub prompt_tokens: Option<i64>,
    pub completion_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub role: String,
    pub content: String,
    pub model: String,
    pub finish_reason: Option<String>,
    pub usage: Option<UsageInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
    pub capabilities: ModelCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub code: ProviderErrorCode,
    pub message: String,
    pub models: Vec<String>,
    pub latency_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticCheckStatus {
    Pass,
    Fail,
    Warning,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDiagnosticReport {
    pub provider_id: String,
    pub provider_type: String,
    pub provider_name: String,
    pub base_url: String,
    pub model_used: Option<String>,

    pub connection_status: DiagnosticCheckStatus,
    pub connection_latency_ms: Option<i64>,
    pub connection_http_status: Option<u16>,
    pub connection_error: Option<String>,

    pub auth_status: DiagnosticCheckStatus,
    pub auth_details: String,

    pub model_discovery_status: DiagnosticCheckStatus,
    pub models_discovered: Vec<String>,
    pub discovery_latency_ms: Option<i64>,
    pub discovery_error: Option<String>,

    pub generation_status: DiagnosticCheckStatus,
    pub generation_latency_ms: Option<i64>,
    pub generation_http_status: Option<u16>,
    pub generation_sample_output: Option<String>,
    pub generation_error: Option<String>,

    pub streaming_status: DiagnosticCheckStatus,
    pub streaming_latency_ms: Option<i64>,
    pub streaming_chunk_count: usize,
    pub streaming_sample_output: Option<String>,
    pub streaming_error: Option<String>,

    pub is_operational: bool,
    pub total_latency_ms: i64,
    pub diagnostic_summary: String,
}
