use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::sync::mpsc::UnboundedSender;
use crate::providers::capabilities::ModelCapabilities;
use crate::providers::errors::{ProviderError, ProviderErrorCode};
use crate::providers::models::{ChatRequest, ChatResponse, ModelInfo};
use crate::providers::traits::ModelProvider;

pub struct GeminiAdapter {
    pub base_url: String,
    pub api_key: Option<String>,
    pub client: reqwest::Client,
    pub capabilities: ModelCapabilities,
}

impl GeminiAdapter {
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

    fn apply_auth(&self, mut builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(key) = &self.api_key {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                builder = builder.header("x-goog-api-key", trimmed);
            }
        }
        builder.header("content-type", "application/json")
    }

    fn format_contents(&self, request: &ChatRequest) -> (Option<Value>, Vec<Value>) {
        let mut system_instruction = None;
        let mut contents = Vec::new();

        for msg in &request.messages {
            if msg.role == "system" {
                system_instruction = Some(json!({
                    "parts": [{ "text": msg.content }]
                }));
            } else {
                let role = if msg.role == "assistant" { "model" } else { "user" };
                contents.push(json!({
                    "role": role,
                    "parts": [{ "text": msg.content }]
                }));
            }
        }

        if contents.is_empty() {
            contents.push(json!({
                "role": "user",
                "parts": [{ "text": "Hello" }]
            }));
        }

        (system_instruction, contents)
    }
}

#[async_trait]
impl ModelProvider for GeminiAdapter {
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
            ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Failed to parse Gemini models: {}", e))
        })?;

        let mut models = Vec::new();
        if let Some(arr) = json.get("models").and_then(|m| m.as_array()) {
            for item in arr {
                if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                    let clean_id = name.strip_prefix("models/").unwrap_or(name);
                    let display_name = item.get("displayName").and_then(|d| d.as_str()).unwrap_or(clean_id);
                    models.push(ModelInfo {
                        id: clean_id.to_string(),
                        name: display_name.to_string(),
                        context_window: item.get("inputTokenLimit").and_then(|v| v.as_i64()),
                        max_output_tokens: item.get("outputTokenLimit").and_then(|v| v.as_i64()),
                        capabilities: self.capabilities,
                    });
                }
            }
        }

        if models.is_empty() {
            models.push(ModelInfo {
                id: "gemini-2.0-flash".to_string(),
                name: "Gemini 2.0 Flash".to_string(),
                context_window: Some(1048576),
                max_output_tokens: Some(8192),
                capabilities: self.capabilities,
            });
        }

        Ok(models)
    }

    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, ProviderError> {
        let clean_model = request.model.strip_prefix("models/").unwrap_or(&request.model);
        let url = format!("{}/models/{}:generateContent", self.base_url, clean_model);
        let (system_instruction, contents) = self.format_contents(&request);

        let mut payload = json!({
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature.unwrap_or(0.7),
                "topP": request.top_p.unwrap_or(0.95),
                "maxOutputTokens": request.max_tokens.unwrap_or(2048)
            }
        });

        if let Some(sys) = system_instruction {
            payload["systemInstruction"] = sys;
        }

        let req = self.apply_auth(self.client.post(&url)).json(&payload);
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let text = res.text().await.unwrap_or_default();
            return Err(ProviderError::from_status(status, &text, &url));
        }

        let json: Value = res.json().await.map_err(|e| {
            ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Malformed Gemini response: {}", e))
        })?;

        let mut text = String::new();
        if let Some(parts) = json.pointer("/candidates/0/content/parts").and_then(|p| p.as_array()) {
            for p in parts {
                if let Some(t) = p.get("text").and_then(|txt| txt.as_str()) {
                    text.push_str(t);
                }
            }
        }

        let finish_reason = json
            .pointer("/candidates/0/finishReason")
            .and_then(|r| r.as_str())
            .map(|s| s.to_string());

        Ok(ChatResponse {
            role: "assistant".to_string(),
            content: text,
            model: request.model,
            finish_reason,
            usage: None,
        })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), ProviderError> {
        let clean_model = request.model.strip_prefix("models/").unwrap_or(&request.model);
        let url = format!("{}/models/{}:streamGenerateContent?alt=sse", self.base_url, clean_model);
        let (system_instruction, contents) = self.format_contents(&request);

        let mut payload = json!({
            "contents": contents,
            "generationConfig": {
                "temperature": request.temperature.unwrap_or(0.7),
                "topP": request.top_p.unwrap_or(0.95),
                "maxOutputTokens": request.max_tokens.unwrap_or(2048)
            }
        });

        if let Some(sys) = system_instruction {
            payload["systemInstruction"] = sys;
        }

        let req = self.apply_auth(self.client.post(&url)).json(&payload);
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
                ProviderError::new(ProviderErrorCode::InvalidResponse, format!("Gemini stream error: {}", e))
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
                        if let Some(parts) = parsed.pointer("/candidates/0/content/parts").and_then(|p| p.as_array()) {
                            for p in parts {
                                if let Some(t) = p.get("text").and_then(|txt| txt.as_str()) {
                                    let _ = sender.send(t.to_string());
                                }
                            }
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
