use std::sync::Arc;
use super::anthropic::adapter::AnthropicAdapter;
use super::definition::ProviderType;
use super::gemini::adapter::GeminiAdapter;
use super::mock::adapter::MockAdapter;
use super::ollama::adapter::OllamaAdapter;
use super::openai::adapter::OpenAICompatibleAdapter;
use super::registry::ProviderRegistry;
use super::traits::ModelProvider;

pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create(
        provider_type_str: &str,
        base_url: &str,
        api_key: Option<String>,
        timeout_secs: i64,
    ) -> Arc<dyn ModelProvider> {
        let registry = ProviderRegistry::global();
        let definition = registry.get_or_default(provider_type_str);
        let timeout = if timeout_secs <= 0 { 60 } else { timeout_secs as u64 };
        let effective_url = if base_url.trim().is_empty() {
            let mut url = definition.default_host.clone();
            if !definition.default_path.is_empty() {
                url.push_str(&definition.default_path);
            }
            url
        } else {
            base_url.trim().to_string()
        };

        match definition.provider_type {
            ProviderType::Anthropic => Arc::new(AnthropicAdapter::new(
                effective_url,
                api_key,
                timeout,
                definition.capabilities,
            )),
            ProviderType::Gemini => Arc::new(GeminiAdapter::new(
                effective_url,
                api_key,
                timeout,
                definition.capabilities,
            )),
            ProviderType::Ollama => Arc::new(OllamaAdapter::new(
                effective_url,
                timeout,
                definition.capabilities,
            )),
            ProviderType::Mock => Arc::new(MockAdapter),
            _ => {
                // OpenAI-compatible family (OpenAI, DeepSeek, Groq, OpenRouter, xAI, Together, Fireworks, SiliconFlow, LMStudio, vLLM, SGLang, CustomHttp)
                let mut adapter = OpenAICompatibleAdapter::new(
                    effective_url,
                    api_key,
                    definition.auth_header_format.clone(),
                    timeout,
                    definition.capabilities,
                );

                // Provider-specific headers
                if definition.provider_type == ProviderType::Openrouter {
                    adapter.custom_headers.push(("HTTP-Referer".to_string(), "https://mechon.ai".to_string()));
                    adapter.custom_headers.push(("X-Title".to_string(), "Mechon AI Workstation".to_string()));
                }

                Arc::new(adapter)
            }
        }
    }
}
