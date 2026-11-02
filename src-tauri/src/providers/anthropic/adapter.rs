use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::sync::mpsc::UnboundedSender;
use crate::providers::capabilities::ModelCapabilities;
use crate::providers::errors::{ProviderError, ProviderErrorCode};
use crate::providers::models::{ChatRequest, ChatResponse, ModelInfo};
use crate::providers::traits::ModelProvider;

pub struct AnthropicAdapter {
    pub base_url: String,
    pub api_key: Option<String>,
    pub client: reqwest::Client,
    pub capabilities: ModelCapabilities,
}

impl AnthropicAdapter {
    pub fn new(
        base_url: String,
        api_key: Option<String>,
        timeout_secs: u64,
        capabilities: ModelCapabilities,
    ) -> Self {
        let timeout = if timeout_secs == 0 { 60 } else { timeout_secs };
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(timeout))
            .build()
            .unwrap_or_default();

        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key,
            client,
            capabilities,
        }
    }

    fn apply_headers(&self, mut builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(key) = &self.api_key {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                builder = builder.header("x-api-key", trimmed);
            }
        }
        builder
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
    }

    fn format_messages(&self, request: &ChatRequest) -> (Option<String>, Vec<Value>) {
        let mut system_prompt = None;
        let mut formatted = Vec::new();

        for msg in &request.messages {
            if msg.role == "system" {
                system_prompt = Some(msg.content.clone());
            } else {
                formatted.push(json!({
                    "role": if msg.role == "assistant" { "assistant" } else { "user" },
                    "content": msg.content
                }));
            }
        }

        if formatted.is_empty() {
            formatted.push(json!({
                "role": "user",
                "content": "Hello"
            }));
        }

        (system_prompt, formatted)
    }
}

#[async_trait]
impl ModelProvider for AnthropicAdapter {
    async fn list_models(&self) -> Result<Vec<ModelInfo>, ProviderError> {
        let url = format!("{}/models", self.base_url);
        let req = self.apply_headers(self.client.get(&url));
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if res.status().is_success() {
            if let Ok(json) = res.json::<Value>().await {
                if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                    let mut models = Vec::new();
                    for m in data {
                        if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                            models.push(ModelInfo {
                                id: id.to_string(),
                                name: id.to_string(),
                                context_window: Some(200000),
                                max_output_tokens: Some(8192),
                                capabilities: self.capabilities,
                            });
                        }
                    }
                    if !models.is_empty() {
                        return Ok(models);
                    }
                }
            }
        }

        // Curated fallback
        Ok(vec![
            ModelInfo {
                id: "claude-3-5-sonnet-20241022".to_string(),
                name: "Claude 3.5 Sonnet".to_string(),
                context_window: Some(200000),
                max_output_tokens: Some(8192),
                capabilities: self.capabilities,
            },
            ModelInfo {
                id: "claude-3-5-haiku-20241022".to_string(),
                name: "Claude 3.5 Haiku".to_string(),
                context_window: Some(200000),
                max_output_tokens: Some(8192),
                capabilities: self.capabilities,
            },
            ModelInfo {
                id: "claude-3-opus-20240229".to_string(),
                name: "Claude 3 Opus".to_string(),
                context_window: Some(200000),
                max_output_tokens: Some(4096),
                capabilities: self.capabilities,
            },
        ])
    }

    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, ProviderError> {
        let url = format!("{}/messages", self.base_url);
        let (system_prompt, messages) = self.format_messages(&request);

        let mut body = json!({
            "model": request.model,
            "messages": messages,
            "max_tokens": request.max_tokens.unwrap_or(2048),
            "temperature": request.temperature.unwrap_or(0.7),
            "top_p": request.top_p.unwrap_or(0.9),
            "stream": false
        });

        if let Some(sys) = system_prompt {
            body["system"] = json!(sys);
        }

        let req = self.apply_headers(self.client.post(&url)).json(&body);
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let text = res.text().await.unwrap_or_default();
            return Err(ProviderError::from_status(status, &text, &url));
        }

        let json: Value = res.json().await.map_err(|e| {
            ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Failed to parse Anthropic JSON: {}", e))
        })?;

        let mut content = String::new();
        if let Some(blocks) = json.get("content").and_then(|c| c.as_array()) {
            for b in blocks {
                if let Some(t) = b.get("text").and_then(|txt| txt.as_str()) {
                    content.push_str(t);
                }
            }
        }

        let stop_reason = json.get("stop_reason").and_then(|s| s.as_str()).map(|s| s.to_string());

        Ok(ChatResponse {
            role: "assistant".to_string(),
            content,
            model: request.model,
            finish_reason: stop_reason,
            usage: None,
        })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), ProviderError> {
        let url = format!("{}/messages", self.base_url);
        let (system_prompt, messages) = self.format_messages(&request);

        let mut body = json!({
            "model": request.model,
            "messages": messages,
            "max_tokens": request.max_tokens.unwrap_or(2048),
            "temperature": request.temperature.unwrap_or(0.7),
            "top_p": request.top_p.unwrap_or(0.9),
            "stream": true
        });

        if let Some(sys) = system_prompt {
            body["system"] = json!(sys);
        }

        let req = self.apply_headers(self.client.post(&url)).json(&body);
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let text = res.text().await.unwrap_or_default();
            return Err(ProviderError::from_status(status, &text, &url));
        }

        use futures_util::StreamExt;
        let mut stream = res.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res.map_err(|e| {
                ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Stream error: {}", e))
            })?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(line_end) = buffer.find('\n') {
                let line = buffer[..line_end].trim().to_string();
                buffer.drain(..=line_end);

                if line.is_empty() {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    if let Ok(parsed) = serde_json::from_str::<Value>(data) {
                        let event_type = parsed.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        if event_type == "content_block_delta" {
                            if let Some(delta) = parsed.pointer("/delta/text").and_then(|t| t.as_str()) {
                                let _ = sender.send(delta.to_string());
                            }
                        } else if event_type == "message_stop" {
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
