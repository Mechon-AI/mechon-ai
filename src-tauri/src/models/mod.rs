use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub settings: Value,
    pub sft_record_count: i64,
    pub dpo_task_count: i64,
    pub active_draft_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectCreateInput {
    pub name: String,
    pub description: Option<String>,
    pub settings: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectUpdateInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_archived: Option<bool>,
    pub settings: Option<Value>,
}

fn default_empty_json_object() -> Value {
    Value::Object(serde_json::Map::new())
}

fn default_monolingual() -> String {
    "monolingual".to_string()
}

fn default_id_lang() -> String {
    "id".to_string()
}

fn default_en_lang() -> String {
    "en".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SFTMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub sequence_order: i64,
    pub model: Option<String>,
    pub token_count: i64,
    #[serde(default = "default_empty_json_object")]
    pub translations: Value,
    #[serde(default = "default_empty_json_object")]
    pub translation_status: Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SFTMessageCreateInput {
    pub role: String,
    pub content: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SFTSession {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub system_prompt: String,
    pub status: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: i64,
    #[serde(default = "default_monolingual")]
    pub language_mode: String,
    #[serde(default = "default_id_lang")]
    pub primary_language: String,
    #[serde(default = "default_en_lang")]
    pub secondary_language: String,
    #[serde(default = "default_empty_json_object")]
    pub language_metadata: Value,
    pub committed_record_id: Option<String>,
    pub messages: Vec<SFTMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SFTSessionCreateInput {
    pub project_id: String,
    pub title: Option<String>,
    pub system_prompt: Option<String>,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i64>,
    pub language_mode: Option<String>,
    pub primary_language: Option<String>,
    pub secondary_language: Option<String>,
    pub language_metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SFTSessionUpdateInput {
    pub title: Option<String>,
    pub system_prompt: Option<String>,
    pub status: Option<String>,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i64>,
    pub language_mode: Option<String>,
    pub primary_language: Option<String>,
    pub secondary_language: Option<String>,
    pub language_metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SFTCommitInput {
    pub title_override: Option<String>,
    pub tags: Option<Vec<String>>,
    pub metadata: Option<Value>,
    pub language_mode: Option<String>,
    pub primary_language: Option<String>,
    pub secondary_language: Option<String>,
    pub language_metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SFTRecord {
    pub id: String,
    pub project_id: String,
    pub session_id: Option<String>,
    pub messages: Value,
    pub turn_count: i64,
    pub character_count: i64,
    #[serde(default = "default_monolingual")]
    pub language_mode: String,
    #[serde(default = "default_id_lang")]
    pub primary_language: String,
    #[serde(default = "default_en_lang")]
    pub secondary_language: String,
    #[serde(default = "default_empty_json_object")]
    pub language_metadata: Value,
    pub metadata: Value,
    pub revision: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SFTRecordUpdateInput {
    pub messages: Option<Value>,
    pub metadata: Option<Value>,
    pub language_mode: Option<String>,
    pub primary_language: Option<String>,
    pub secondary_language: Option<String>,
    pub language_metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPOTask {
    pub id: String,
    pub project_id: String,
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub response_a: String,
    pub response_b: String,
    pub preference: Option<String>,
    pub rationale: Option<String>,
    pub helpfulness_rating: Option<i64>,
    pub factuality_rating: Option<i64>,
    pub status: String,
    pub metadata: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPOTaskCreateInput {
    pub project_id: String,
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub response_a: Option<String>,
    pub response_b: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPOAnnotationInput {
    pub preference: String,
    pub rationale: Option<String>,
    pub helpfulness_rating: Option<i64>,
    pub factuality_rating: Option<i64>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DPOTaskUpdateInput {
    pub prompt: Option<String>,
    pub system_prompt: Option<String>,
    pub response_a: Option<String>,
    pub response_b: Option<String>,
    pub preference: Option<String>,
    pub rationale: Option<String>,
    pub helpfulness_rating: Option<i64>,
    pub factuality_rating: Option<i64>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub provider_type: String,
    pub base_url: String,
    pub has_api_key: bool,
    pub credential_status: String,
    pub masked_hint: Option<String>,
    pub default_model: Option<String>,
    pub models_cache: Vec<String>,
    pub timeout_seconds: i64,
    pub is_active: bool,
    pub settings: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCreateInput {
    pub name: String,
    pub provider_type: String,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub default_model: Option<String>,
    pub timeout_seconds: Option<i64>,
    pub settings: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderUpdateInput {
    pub name: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub clear_api_key: Option<bool>,
    pub default_model: Option<String>,
    pub timeout_seconds: Option<i64>,
    pub is_active: Option<bool>,
    pub settings: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetVersion {
    pub id: String,
    pub project_id: String,
    pub dataset_type: String,
    pub version_tag: String,
    pub record_count: i64,
    pub checksum_sha256: String,
    pub parent_version_id: Option<String>,
    pub change_summary: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotCreateInput {
    pub project_id: String,
    pub dataset_type: String,
    pub version_tag: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub record_id: String,
    pub dataset_type: String,
    pub severity: String, // "error" | "warning" | "info"
    pub issue_type: String,
    pub message: String,
    pub suggested_fix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationReport {
    pub dataset_type: String,
    pub total_records: i64,
    pub passed_records: i64,
    pub failed_records: i64,
    pub error_count: i64,
    pub warning_count: i64,
    pub issues: Vec<ValidationIssue>,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsResponse {
    pub project_id: Option<String>,
    pub total_projects: i64,
    pub sft_metrics: Value,
    pub dpo_metrics: Value,
    pub shared_metrics: Value,
    pub model_usage: Value,
    pub timeline_growth: Vec<Value>,
}
