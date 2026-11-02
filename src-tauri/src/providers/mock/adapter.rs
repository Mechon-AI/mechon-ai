use async_trait::async_trait;
use tokio::sync::mpsc::UnboundedSender;
use crate::providers::capabilities::ModelCapabilities;
use crate::providers::errors::ProviderError;
use crate::providers::models::{ChatRequest, ChatResponse, ModelInfo};
use crate::providers::traits::ModelProvider;

pub struct MockAdapter;

#[async_trait]
impl ModelProvider for MockAdapter {
    async fn list_models(&self) -> Result<Vec<ModelInfo>, ProviderError> {
        Ok(vec![
            ModelInfo {
                id: "mock-llama-3-8b".to_string(),
                name: "Mock Llama 3 (8B)".to_string(),
                context_window: Some(8192),
                max_output_tokens: Some(4096),
                capabilities: ModelCapabilities::all(),
            },
            ModelInfo {
                id: "mock-mistral-7b".to_string(),
                name: "Mock Mistral (7B)".to_string(),
                context_window: Some(8192),
                max_output_tokens: Some(4096),
                capabilities: ModelCapabilities::all(),
            },
            ModelInfo {
                id: "mock-qwen-2.5-7b".to_string(),
                name: "Mock Qwen 2.5 (7B)".to_string(),
                context_window: Some(32768),
                max_output_tokens: Some(4096),
                capabilities: ModelCapabilities::all(),
            },
        ])
    }

    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, ProviderError> {
        let last_prompt = request
            .messages
            .last()
            .map(|m| m.content.as_str())
            .unwrap_or("Hello");

        let response_content = format!(
            "This is a synthesized high-fidelity response for model [{}] addressing prompt: \"{}\". Mechon AI offline engine verified.",
            request.model,
            if last_prompt.len() > 60 { &last_prompt[..60] } else { last_prompt }
        );

        Ok(ChatResponse {
            role: "assistant".to_string(),
            content: response_content,
            model: request.model,
            finish_reason: Some("stop".to_string()),
            usage: None,
        })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), ProviderError> {
        let last_prompt = request
            .messages
            .last()
            .map(|m| m.content.as_str())
            .unwrap_or("Hello");

        let tokens = vec![
            "This ", "is ", "a ", "synthesized ", "high-fidelity ", "response ",
            "from ", &request.model, " addressing: \"", last_prompt, "\". ",
            "Mechon AI ", "native ", "Rust ", "streaming ", "engine ", "verified."
        ];

        for token in tokens {
            let _ = sender.send(token.to_string());
            tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;
        }

        Ok(())
    }

    fn capabilities(&self) -> ModelCapabilities {
        ModelCapabilities::all()
    }
}
