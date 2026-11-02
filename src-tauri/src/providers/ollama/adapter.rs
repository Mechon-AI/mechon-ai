use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::sync::mpsc::UnboundedSender;
use crate::providers::capabilities::ModelCapabilities;
use crate::providers::errors::{ProviderError, ProviderErrorCode};
use crate::providers::models::{ChatRequest, ChatResponse, ModelInfo};
use crate::providers::traits::ModelProvider;

pub struct OllamaAdapter {
    pub base_url: String,
    pub client: reqwest::Client,
    pub capabilities: ModelCapabilities,
}

impl OllamaAdapter {
    pub fn new(base_url: String, timeout_secs: u64, capabilities: ModelCapabilities) -> Self {
        let timeout = if timeout_secs == 0 { 60 } else { timeout_secs };
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(timeout))
            .build()
            .unwrap_or_default();

        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client,
            capabilities,
        }
    }
}

#[async_trait]
impl ModelProvider for OllamaAdapter {
    async fn list_models(&self) -> Result<Vec<ModelInfo>, ProviderError> {
        let url = format!("{}/api/tags", self.base_url);
        let res = self.client.get(&url).send().await
            .map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            return Err(ProviderError::from_status(status, &body, &url));
        }

        let json: Value = res.json().await.map_err(|e| {
            ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Failed to parse Ollama tags: {}", e))
        })?;

        let mut models = Vec::new();
        if let Some(arr) = json.get("models").and_then(|m| m.as_array()) {
            for m in arr {
                if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                    models.push(ModelInfo {
                        id: name.to_string(),
                        name: name.to_string(),
                        context_window: Some(8192),
                        max_output_tokens: Some(4096),
                        capabilities: self.capabilities,
                    });
                }
            }
        }

        if models.is_empty() {
            models.push(ModelInfo {
                id: "llama3:latest".to_string(),
                name: "llama3:latest".to_string(),
                context_window: Some(8192),
                max_output_tokens: Some(4096),
                capabilities: self.capabilities,
            });
        }

        Ok(models)
    }

    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, ProviderError> {
        let url = format!("{}/api/chat", self.base_url);
        let payload = json!({
            "model": request.model,
            "messages": request.messages,
            "stream": false,
            "options": {
                "temperature": request.temperature.unwrap_or(0.7),
                "top_p": request.top_p.unwrap_or(0.9),
                "num_predict": request.max_tokens.unwrap_or(2048)
            }
        });

        let res = self.client.post(&url).json(&payload).send().await
            .map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            return Err(ProviderError::from_status(status, &body, &url));
        }

        let json: Value = res.json().await.map_err(|e| {
            ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Failed to parse Ollama chat JSON: {}", e))
        })?;

        let content = json
            .pointer("/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Ok(ChatResponse {
            role: "assistant".to_string(),
            content,
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
        let url = format!("{}/api/chat", self.base_url);
        let payload = json!({
            "model": request.model,
            "messages": request.messages,
            "stream": true,
            "options": {
                "temperature": request.temperature.unwrap_or(0.7),
                "top_p": request.top_p.unwrap_or(0.9),
                "num_predict": request.max_tokens.unwrap_or(2048)
            }
        });

        let res = self.client.post(&url).json(&payload).send().await
            .map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            return Err(ProviderError::from_status(status, &body, &url));
        }

        use futures_util::StreamExt;
        let mut stream = res.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res.map_err(|e| {
                ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Stream chunk failure: {}", e))
            })?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(line_end) = buffer.find('\n') {
                let line = buffer[..line_end].trim().to_string();
                buffer.drain(..=line_end);

                if line.is_empty() {
                    continue;
                }

                if let Ok(parsed) = serde_json::from_str::<Value>(&line) {
                    if let Some(delta) = parsed.pointer("/message/content").and_then(|v| v.as_str()) {
                        let _ = sender.send(delta.to_string());
                    }
                    if let Some(done) = parsed.get("done").and_then(|v| v.as_bool()) {
                        if done {
                            break;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn capabilities(&self) -> ModelCapabilities {
        self.capabilities
    }
}
