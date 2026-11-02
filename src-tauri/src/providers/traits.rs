use async_trait::async_trait;
use tokio::sync::mpsc::UnboundedSender;
use super::capabilities::ModelCapabilities;
use super::errors::ProviderError;
use super::models::{ChatRequest, ChatResponse, ModelInfo};

#[async_trait]
pub trait ModelProvider: Send + Sync {
    /// Discovers or lists models available from this provider
    async fn list_models(&self) -> Result<Vec<ModelInfo>, ProviderError>;

    /// Executes non-streaming completion
    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, ProviderError>;

    /// Executes token streaming completion
    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), ProviderError>;

    /// Returns general capabilities of this provider
    fn capabilities(&self) -> ModelCapabilities;
}
