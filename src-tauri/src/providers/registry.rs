use std::collections::HashMap;
use std::sync::OnceLock;
use super::capabilities::ModelCapabilities;
use super::definition::{ProviderDefinition, ProviderType};

static REGISTRY: OnceLock<ProviderRegistry> = OnceLock::new();

#[derive(Debug, Clone)]
pub struct ProviderRegistry {
    definitions: HashMap<String, ProviderDefinition>,
    by_type: HashMap<ProviderType, String>,
}

impl ProviderRegistry {
    pub fn global() -> &'static Self {
        REGISTRY.get_or_init(Self::init_registry)
    }

    fn init_registry() -> Self {
        let mut defs = HashMap::new();
        let mut by_type = HashMap::new();

        let list = vec![
            // 1. OpenAI
            ProviderDefinition {
                id: "openai".to_string(),
                name: "OpenAI".to_string(),
                provider_type: ProviderType::Openai,
                default_host: "https://api.openai.com".to_string(),
                default_path: "/v1".to_string(),
                default_model: "gpt-4o".to_string(),
                curated_models: vec![
                    "gpt-4o".to_string(),
                    "gpt-4o-mini".to_string(),
                    "o1".to_string(),
                    "o1-mini".to_string(),
                    "gpt-4-turbo".to_string(),
                ],
                capabilities: ModelCapabilities {
                    vision: true,
                    tool_use: true,
                    reasoning: true,
                    streaming: true,
                    structured_output: true,
                    json_mode: true,
                },
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://platform.openai.com/docs".to_string()),
            },

            // 2. Anthropic
            ProviderDefinition {
                id: "anthropic".to_string(),
                name: "Anthropic".to_string(),
                provider_type: ProviderType::Anthropic,
                default_host: "https://api.anthropic.com".to_string(),
                default_path: "/v1".to_string(),
                default_model: "claude-haiku-5-5".to_string(),
                curated_models: vec![
                    "claude-haiku-5-5".to_string(),
                    "claude-sonnet-5-5".to_string(),
                    "claude-opus-5-5".to_string(),
                    "claude-fable-5-1".to_string(),
                    "claude-3-5-sonnet-20241022".to_string(),
                    "claude-3-opus-20240229".to_string(),
                ],
                capabilities: ModelCapabilities {
                    vision: true,
                    tool_use: true,
                    reasoning: true,
                    streaming: true,
                    structured_output: true,
                    json_mode: true,
                },
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("{key}".to_string()),
                documentation_url: Some("https://docs.anthropic.com/".to_string()),
            },

            // 3. Google Gemini
            ProviderDefinition {
                id: "gemini".to_string(),
                name: "Google Gemini".to_string(),
                provider_type: ProviderType::Gemini,
                default_host: "https://generativelanguage.googleapis.com".to_string(),
                default_path: "/v1beta".to_string(),
                default_model: "gemini-2.0-flash".to_string(),
                curated_models: vec![
                    "gemini-2.0-flash".to_string(),
                    "gemini-1.5-pro".to_string(),
                    "gemini-1.5-flash".to_string(),
                ],
                capabilities: ModelCapabilities {
                    vision: true,
                    tool_use: true,
                    reasoning: true,
                    streaming: true,
                    structured_output: true,
                    json_mode: true,
                },
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("{key}".to_string()),
                documentation_url: Some("https://ai.google.dev/docs".to_string()),
            },

            // 4. DeepSeek
            ProviderDefinition {
                id: "deepseek".to_string(),
                name: "DeepSeek".to_string(),
                provider_type: ProviderType::Deepseek,
                default_host: "https://api.deepseek.com".to_string(),
                default_path: "/v1".to_string(),
                default_model: "deepseek-chat".to_string(),
                curated_models: vec![
                    "deepseek-chat".to_string(),
                    "deepseek-reasoner".to_string(),
                ],
                capabilities: ModelCapabilities {
                    vision: false,
                    tool_use: true,
                    reasoning: true,
                    streaming: true,
                    structured_output: true,
                    json_mode: true,
                },
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://platform.deepseek.com/".to_string()),
            },

            // 5. Groq
            ProviderDefinition {
                id: "groq".to_string(),
                name: "Groq".to_string(),
                provider_type: ProviderType::Groq,
                default_host: "https://api.groq.com/openai".to_string(),
                default_path: "/v1".to_string(),
                default_model: "llama-3.3-70b-versatile".to_string(),
                curated_models: vec![
                    "llama-3.3-70b-versatile".to_string(),
                    "llama-3.1-8b-instant".to_string(),
                    "mixtral-8x7b-32768".to_string(),
                ],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://console.groq.com/docs".to_string()),
            },

            // 6. OpenRouter
            ProviderDefinition {
                id: "openrouter".to_string(),
                name: "OpenRouter".to_string(),
                provider_type: ProviderType::Openrouter,
                default_host: "https://openrouter.ai/api".to_string(),
                default_path: "/v1".to_string(),
                default_model: "anthropic/claude-3.5-sonnet".to_string(),
                curated_models: vec![
                    "anthropic/claude-3.5-sonnet".to_string(),
                    "meta-llama/llama-3.3-70b-instruct".to_string(),
                    "deepseek/deepseek-r1".to_string(),
                    "google/gemini-2.0-flash-exp:free".to_string(),
                ],
                capabilities: ModelCapabilities::all(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://openrouter.ai/docs".to_string()),
            },

            // 7. xAI
            ProviderDefinition {
                id: "xai".to_string(),
                name: "xAI (Grok)".to_string(),
                provider_type: ProviderType::Xai,
                default_host: "https://api.x.ai".to_string(),
                default_path: "/v1".to_string(),
                default_model: "grok-2-latest".to_string(),
                curated_models: vec![
                    "grok-2-latest".to_string(),
                    "grok-beta".to_string(),
                ],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://docs.x.ai/".to_string()),
            },

            // 8. Together AI
            ProviderDefinition {
                id: "together".to_string(),
                name: "Together AI".to_string(),
                provider_type: ProviderType::Together,
                default_host: "https://api.together.xyz".to_string(),
                default_path: "/v1".to_string(),
                default_model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo".to_string(),
                curated_models: vec![
                    "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo".to_string(),
                    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo".to_string(),
                    "mistralai/Mixtral-8x7B-Instruct-v0.1".to_string(),
                ],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://docs.together.ai/".to_string()),
            },

            // 9. Fireworks AI
            ProviderDefinition {
                id: "fireworks".to_string(),
                name: "Fireworks AI".to_string(),
                provider_type: ProviderType::Fireworks,
                default_host: "https://api.fireworks.ai/inference".to_string(),
                default_path: "/v1".to_string(),
                default_model: "accounts/fireworks/models/llama-v3p1-70b-instruct".to_string(),
                curated_models: vec![
                    "accounts/fireworks/models/llama-v3p1-70b-instruct".to_string(),
                    "accounts/fireworks/models/deepseek-r1".to_string(),
                ],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://docs.fireworks.ai/".to_string()),
            },

            // 10. SiliconFlow
            ProviderDefinition {
                id: "siliconflow".to_string(),
                name: "SiliconFlow".to_string(),
                provider_type: ProviderType::Siliconflow,
                default_host: "https://api.siliconflow.cn".to_string(),
                default_path: "/v1".to_string(),
                default_model: "deepseek-ai/DeepSeek-V3".to_string(),
                curated_models: vec![
                    "deepseek-ai/DeepSeek-V3".to_string(),
                    "deepseek-ai/DeepSeek-R1".to_string(),
                    "Qwen/Qwen2.5-72B-Instruct".to_string(),
                ],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: true,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://docs.siliconflow.cn/".to_string()),
            },

            // 11. Ollama (Local)
            ProviderDefinition {
                id: "ollama".to_string(),
                name: "Ollama (Local)".to_string(),
                provider_type: ProviderType::Ollama,
                default_host: "http://127.0.0.1:11434".to_string(),
                default_path: "".to_string(),
                default_model: "llama3:latest".to_string(),
                curated_models: vec![
                    "llama3:latest".to_string(),
                    "mistral:latest".to_string(),
                    "qwen2.5:latest".to_string(),
                    "phi3:latest".to_string(),
                ],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: false,
                auth_header_format: None,
                documentation_url: Some("https://ollama.com/".to_string()),
            },

            // 12. LM Studio (Local)
            ProviderDefinition {
                id: "lmstudio".to_string(),
                name: "LM Studio (Local)".to_string(),
                provider_type: ProviderType::Lmstudio,
                default_host: "http://127.0.0.1:1234".to_string(),
                default_path: "/v1".to_string(),
                default_model: "local-model".to_string(),
                curated_models: vec!["local-model".to_string()],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: false,
                auth_header_format: None,
                documentation_url: Some("https://lmstudio.ai/".to_string()),
            },

            // 13. vLLM (Local / Server)
            ProviderDefinition {
                id: "vllm".to_string(),
                name: "vLLM".to_string(),
                provider_type: ProviderType::Vllm,
                default_host: "http://127.0.0.1:8000".to_string(),
                default_path: "/v1".to_string(),
                default_model: "default-model".to_string(),
                curated_models: vec!["default-model".to_string()],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: false,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://docs.vllm.ai/".to_string()),
            },

            // 14. SGLang (Local / Server)
            ProviderDefinition {
                id: "sglang".to_string(),
                name: "SGLang".to_string(),
                provider_type: ProviderType::Sglang,
                default_host: "http://127.0.0.1:30000".to_string(),
                default_path: "/v1".to_string(),
                default_model: "default-model".to_string(),
                curated_models: vec!["default-model".to_string()],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: false,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: Some("https://sgl-project.github.io/".to_string()),
            },

            // 15. Custom OpenAI-compatible HTTP
            ProviderDefinition {
                id: "custom_http".to_string(),
                name: "Custom OpenAI Compatible".to_string(),
                provider_type: ProviderType::CustomHttp,
                default_host: "http://127.0.0.1:8080".to_string(),
                default_path: "/v1".to_string(),
                default_model: "custom-model".to_string(),
                curated_models: vec!["custom-model".to_string()],
                capabilities: ModelCapabilities::default(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: false,
                auth_header_format: Some("Bearer {key}".to_string()),
                documentation_url: None,
            },

            // 16. Built-in Offline Mock Provider
            ProviderDefinition {
                id: "mock".to_string(),
                name: "Mechon Offline Mock Provider".to_string(),
                provider_type: ProviderType::Mock,
                default_host: "http://127.0.0.1:0".to_string(),
                default_path: "".to_string(),
                default_model: "mock-llama-3-8b".to_string(),
                curated_models: vec![
                    "mock-llama-3-8b".to_string(),
                    "mock-mistral-7b".to_string(),
                    "mock-qwen-2.5-7b".to_string(),
                ],
                capabilities: ModelCapabilities::all(),
                supports_model_discovery: true,
                supports_streaming: true,
                requires_api_key: false,
                auth_header_format: None,
                documentation_url: None,
            },
        ];

        for d in list {
            by_type.insert(d.provider_type.clone(), d.id.clone());
            defs.insert(d.id.clone(), d);
        }

        Self {
            definitions: defs,
            by_type,
        }
    }

    pub fn get(&self, id: &str) -> Option<&ProviderDefinition> {
        self.definitions.get(id)
    }

    pub fn get_by_type(&self, provider_type: &ProviderType) -> Option<&ProviderDefinition> {
        self.by_type.get(provider_type).and_then(|id| self.definitions.get(id))
    }

    pub fn get_or_default(&self, id_or_type: &str) -> ProviderDefinition {
        if let Some(def) = self.definitions.get(id_or_type) {
            return def.clone();
        }
        let pt = ProviderType::from_str_loose(id_or_type);
        if let Some(def) = self.get_by_type(&pt) {
            return def.clone();
        }
        // Fallback to custom
        self.definitions.get("custom_http").cloned().unwrap()
    }

    pub fn all(&self) -> Vec<ProviderDefinition> {
        let mut list: Vec<_> = self.definitions.values().cloned().collect();
        list.sort_by(|a, b| a.name.cmp(&b.name));
        list
    }
}
