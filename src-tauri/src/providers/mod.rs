pub mod anthropic;
pub mod capabilities;
pub mod definition;
pub mod errors;
pub mod factory;
pub mod gemini;
pub mod mock;
pub mod models;
pub mod models_dev;
pub mod ollama;
pub mod openai;
pub mod registry;
pub mod traits;

// Re-exports
pub use capabilities::ModelCapabilities;
pub use definition::{ProviderDefinition, ProviderType};
pub use errors::{ProviderError, ProviderErrorCode};
pub use factory::ProviderFactory;
pub use models::{ChatMessage, ChatRequest, ChatResponse, ConnectionTestResult, ModelInfo, UsageInfo};
pub use registry::ProviderRegistry;
pub use traits::ModelProvider;

// Factory function
pub fn create_provider(
    provider_type: &str,
    base_url: &str,
    api_key: Option<String>,
    timeout_secs: i64,
) -> std::sync::Arc<dyn ModelProvider> {
    ProviderFactory::create(provider_type, base_url, api_key, timeout_secs)
}
