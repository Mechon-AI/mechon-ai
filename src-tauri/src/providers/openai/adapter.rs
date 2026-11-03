use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::sync::mpsc::UnboundedSender;
use crate::providers::capabilities::ModelCapabilities;
use crate::providers::errors::{ProviderError, ProviderErrorCode};
use crate::providers::models::{ChatRequest, ChatResponse, ModelInfo};
use crate::providers::traits::ModelProvider;

pub struct OpenAICompatibleAdapter {
    pub base_url: String,
    pub api_key: Option<String>,
    pub auth_header_format: Option<String>,
    pub custom_headers: Vec<(String, String)>,
    pub client: reqwest::Client,
    pub capabilities: ModelCapabilities,
}

impl OpenAICompatibleAdapter {
    pub fn new(
        base_url: String,
        api_key: Option<String>,
        auth_header_format: Option<String>,
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
            auth_header_format,
            custom_headers: Vec::new(),
            client,
            capabilities,
        }
    }

    fn apply_auth(&self, mut builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(key) = &self.api_key {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                let header_val = if let Some(fmt) = &self.auth_header_format {
                    fmt.replace("{key}", trimmed)
                } else {
                    format!("Bearer {}", trimmed)
                };
                builder = builder.header("Authorization", header_val);
            }
        }
        for (k, v) in &self.custom_headers {
            builder = builder.header(k, v);
        }
        builder
    }
}

#[async_trait]
impl ModelProvider for OpenAICompatibleAdapter {
    async fn list_models(&self) -> Result<Vec<ModelInfo>, ProviderError> {
        let url = format!("{}/models", self.base_url);
        let req = self.apply_auth(self.client.get(&url));
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            return Err(ProviderError::from_status(status, &body, &url));
        }

        let json: Value = res.json().await.map_err(|e| {
            ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Failed to parse models JSON: {}", e))
        })?;

        let mut models = Vec::new();
        if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
            for m in data {
                if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                    models.push(ModelInfo {
                        id: id.to_string(),
                        name: id.to_string(),
                        context_window: m.get("context_window").and_then(|v| v.as_i64()),
                        max_output_tokens: m.get("max_tokens").and_then(|v| v.as_i64()),
                        capabilities: self.capabilities,
                    });
                }
            }
        }

        if models.is_empty() {
            models.push(ModelInfo {
                id: "default-model".to_string(),
                name: "default-model".to_string(),
                context_window: Some(4096),
                max_output_tokens: Some(2048),
                capabilities: self.capabilities,
            });
        }

        Ok(models)
    }

    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, ProviderError> {
        let url = format!("{}/chat/completions", self.base_url);
        let payload = json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature.unwrap_or(0.7),
            "top_p": request.top_p.unwrap_or(0.9),
            "max_tokens": request.max_tokens.unwrap_or(2048),
            "stream": false
        });

        let req = self.apply_auth(self.client.post(&url).json(&payload));
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            return Err(ProviderError::from_status(status, &body, &url));
        }

        let json: Value = res.json().await.map_err(|e| {
            ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Malformed response payload: {}", e))
        })?;

        let content = json
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let finish_reason = json
            .pointer("/choices/0/finish_reason")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let usage = json.get("usage").map(|u| crate::providers::models::UsageInfo {
            prompt_tokens: u.get("prompt_tokens").and_then(|v| v.as_i64()),
            completion_tokens: u.get("completion_tokens").and_then(|v| v.as_i64()),
            total_tokens: u.get("total_tokens").and_then(|v| v.as_i64()),
        });

        Ok(ChatResponse {
            role: "assistant".to_string(),
            content,
            model: request.model,
            finish_reason,
            usage,
        })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), ProviderError> {
        let url = format!("{}/chat/completions", self.base_url);
        let payload = json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature.unwrap_or(0.7),
            "top_p": request.top_p.unwrap_or(0.9),
            "max_tokens": request.max_tokens.unwrap_or(2048),
            "stream": true
        });

        let req = self.apply_auth(self.client.post(&url).json(&payload));
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

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

                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        break;
                    }
                    if let Ok(parsed) = serde_json::from_str::<Value>(data) {
                        if let Some(delta) = parsed.pointer("/choices/0/delta/content").and_then(|v| v.as_str()) {
                            let _ = sender.send(delta.to_string());
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
