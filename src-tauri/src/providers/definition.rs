use serde::{Deserialize, Serialize};
use super::capabilities::ModelCapabilities;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderType {
    Openai,
    Anthropic,
    Gemini,
    Ollama,
    Deepseek,
    Groq,
    Openrouter,
    Xai,
    Together,
    Fireworks,
    Siliconflow,
    Lmstudio,
    Vllm,
    Sglang,
    CustomHttp,
    Mock,
}

impl ProviderType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Openai => "openai",
            Self::Anthropic => "anthropic",
            Self::Gemini => "gemini",
            Self::Ollama => "ollama",
            Self::Deepseek => "deepseek",
            Self::Groq => "groq",
            Self::Openrouter => "openrouter",
            Self::Xai => "xai",
            Self::Together => "together",
            Self::Fireworks => "fireworks",
            Self::Siliconflow => "siliconflow",
            Self::Lmstudio => "lmstudio",
            Self::Vllm => "vllm",
            Self::Sglang => "sglang",
            Self::CustomHttp => "custom_http",
            Self::Mock => "mock",
        }
    }

    pub fn from_str_loose(s: &str) -> Self {
        match s.to_lowercase().replace('-', "_").as_str() {
            "openai" | "openai_compatible" => Self::Openai,
            "anthropic" | "claude" => Self::Anthropic,
            "gemini" | "google" => Self::Gemini,
            "ollama" => Self::Ollama,
            "deepseek" => Self::Deepseek,
            "groq" => Self::Groq,
            "openrouter" => Self::Openrouter,
            "xai" | "grok" => Self::Xai,
            "together" | "together_ai" => Self::Together,
            "fireworks" | "fireworks_ai" => Self::Fireworks,
            "siliconflow" => Self::Siliconflow,
            "lmstudio" | "lm_studio" => Self::Lmstudio,
            "vllm" => Self::Vllm,
            "sglang" => Self::Sglang,
            "mock" => Self::Mock,
            _ => Self::CustomHttp,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDefinition {
    pub id: String,
    pub name: String,
    pub provider_type: ProviderType,
    pub default_host: String,
    pub default_path: String,
    pub default_model: String,
    pub curated_models: Vec<String>,
    pub capabilities: ModelCapabilities,
    pub supports_model_discovery: bool,
    pub supports_streaming: bool,
    pub requires_api_key: bool,
    pub auth_header_format: Option<String>,
    pub documentation_url: Option<String>,
}
