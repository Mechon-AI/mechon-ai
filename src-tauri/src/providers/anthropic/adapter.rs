use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::sync::mpsc::UnboundedSender;
use crate::providers::capabilities::ModelCapabilities;
use crate::providers::errors::{sanitize_error_message, ProviderError, ProviderErrorCode};
use crate::providers::models::{ChatRequest, ChatResponse, ModelInfo, UsageInfo};
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
            base_url: base_url.trim().trim_end_matches('/').to_string(),
            api_key,
            client,
            capabilities,
        }
    }

    /// Resolve Anthropic /v1/messages endpoint safely
    pub fn messages_url(&self) -> String {
        let trimmed = self.base_url.trim().trim_end_matches('/');
        if trimmed.ends_with("/messages") {
            trimmed.to_string()
        } else if trimmed.ends_with("/v1") {
            format!("{}/messages", trimmed)
        } else {
            format!("{}/v1/messages", trimmed)
        }
    }

    /// Resolve Anthropic /v1/models endpoint safely
    pub fn models_url(&self) -> String {
        let trimmed = self.base_url.trim().trim_end_matches('/');
        if trimmed.ends_with("/messages") {
            format!("{}/models", trimmed.trim_end_matches("/messages"))
        } else if trimmed.ends_with("/v1") {
            format!("{}/models", trimmed)
        } else {
            format!("{}/v1/models", trimmed)
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

    /// Format messages strictly according to Anthropic's protocol:
    /// - Separate top-level system prompt
    /// - Guarantee alternating user and assistant messages
    /// - Guarantee conversation starts with user turn
    fn format_messages(&self, request: &ChatRequest) -> (Option<String>, Vec<Value>) {
        let mut system_prompts = Vec::new();
        let mut raw_dialogue: Vec<(String, String)> = Vec::new();

        for msg in &request.messages {
            if msg.role == "system" {
                if !msg.content.trim().is_empty() {
                    system_prompts.push(msg.content.trim().to_string());
                }
            } else {
                let role = if msg.role == "assistant" { "assistant" } else { "user" };
                raw_dialogue.push((role.to_string(), msg.content.clone()));
            }
        }

        let system_prompt = if !system_prompts.is_empty() {
            Some(system_prompts.join("\n\n"))
        } else {
            None
        };

        // Guarantee alternating turns by coalescing consecutive turns with the same role
        let mut alternating: Vec<Value> = Vec::new();
        for (role, content) in raw_dialogue {
            if let Some(last) = alternating.last_mut() {
                let last_role = last.get("role").and_then(|r| r.as_str()).unwrap_or("");
                if last_role == role {
                    // Merge content
                    let prev_content = last.get("content").and_then(|c| c.as_str()).unwrap_or("");
                    let merged = format!("{}\n\n{}", prev_content, content);
                    last["content"] = json!(merged);
                    continue;
                }
            }
            alternating.push(json!({
                "role": role,
                "content": content
            }));
        }

        // Anthropic requires the first message to be role 'user'
        if alternating.is_empty() {
            alternating.push(json!({
                "role": "user",
                "content": "Hello"
            }));
        } else if alternating[0].get("role").and_then(|r| r.as_str()) != Some("user") {
            alternating.insert(0, json!({
                "role": "user",
                "content": "Hello"
            }));
        }

        (system_prompt, alternating)
    }

    /// Detect models that reject or deprecate sampling parameters (temperature / top_p)
    pub fn is_sampling_deprecated_for_model(model: &str) -> bool {
        let m = model.to_lowercase();
        m.contains("-5") || m.contains("5-5") || m.contains("fable") || m.contains("opus-4") || m.contains("sonnet-4") || m.contains("haiku-4") || m.starts_with("claude-5")
    }

    /// Format detailed Anthropic diagnostic error on HTTP 400 or other errors
    pub fn format_anthropic_error(status: u16, text: &str, url: &str, model: &str, payload: &Value) -> ProviderError {
        let clean_text = sanitize_error_message(text);
        if let Ok(json) = serde_json::from_str::<Value>(&clean_text) {
            let err_obj = json.get("error");
            let err_type = err_obj.and_then(|e| e.get("type")).and_then(|t| t.as_str()).unwrap_or("unknown_anthropic_error");
            let err_msg = err_obj.and_then(|e| e.get("message")).and_then(|m| m.as_str()).unwrap_or(&clean_text);
            let req_id = json.get("request_id").and_then(|r| r.as_str()).unwrap_or("none");

            let mut unsupported_info = String::new();
            let lower = err_msg.to_lowercase();
            if lower.contains("temperature") {
                unsupported_info.push_str(" [Parameter 'temperature' is not supported by this model]");
            }
            if lower.contains("top_p") {
                unsupported_info.push_str(" [Parameter 'top_p' is not supported by this model]");
            }
            if lower.contains("max_tokens") {
                unsupported_info.push_str(" [Parameter 'max_tokens' validation failed]");
            }

            let sanitized_payload = serde_json::to_string(payload).unwrap_or_else(|_| "{}".to_string());

            let formatted = format!(
                "[Anthropic {} (HTTP {})] {}{} (type='{}', request_id='{}', model='{}', payload={})",
                err_type, status, err_msg, unsupported_info, err_type, req_id, model, sanitized_payload
            );

            let code = match status {
                400 => ProviderErrorCode::InvalidRequest,
                401 | 403 => ProviderErrorCode::AuthenticationFailed,
                404 => ProviderErrorCode::ModelNotFound,
                429 => ProviderErrorCode::RateLimited,
                _ => ProviderErrorCode::UnknownError,
            };

            return ProviderError::with_status(code, formatted, status);
        }

        ProviderError::from_status(status, text, url)
    }

    /// Build Anthropic message body obeying parameter exclusivity and model deprecation rules
    pub fn build_payload(&self, request: &ChatRequest, stream: bool, strip_sampling: bool) -> Value {
        let (system_prompt, messages) = self.format_messages(request);

        let mut body = serde_json::Map::new();
        body.insert("model".to_string(), json!(request.model));
        body.insert("messages".to_string(), json!(messages));
        // max_tokens is REQUIRED by Anthropic
        body.insert("max_tokens".to_string(), json!(request.max_tokens.unwrap_or(2048)));

        let model_deprecates_sampling = Self::is_sampling_deprecated_for_model(&request.model);

        // Only send sampling parameters if NOT deprecated for this model and NOT requested to strip
        if !strip_sampling && !model_deprecates_sampling {
            // Anthropic rule: DO NOT set both temperature and top_p.
            if let Some(temp) = request.temperature {
                body.insert("temperature".to_string(), json!(temp));
            } else if let Some(top_p) = request.top_p {
                body.insert("top_p".to_string(), json!(top_p));
            }
        }

        if let Some(sys) = system_prompt {
            body.insert("system".to_string(), json!(sys));
        }

        body.insert("stream".to_string(), json!(stream));
        Value::Object(body)
    }
}

#[async_trait]
impl ModelProvider for AnthropicAdapter {
    async fn list_models(&self) -> Result<Vec<ModelInfo>, ProviderError> {
        let url = self.models_url();
        let req = self.apply_headers(self.client.get(&url));
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        if !res.status().is_success() {
            let status = res.status().as_u16();
            let body = res.text().await.unwrap_or_default();
            return Err(ProviderError::from_status(status, &body, &url));
        }

        if let Ok(json) = res.json::<Value>().await {
            if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                let mut models = Vec::new();
                for m in data {
                    if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                        let display_name = m.get("display_name").and_then(|d| d.as_str()).unwrap_or(id);
                        models.push(ModelInfo {
                            id: id.to_string(),
                            name: display_name.to_string(),
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

        // Curated fallback models when model discovery is empty
        Ok(vec![
            ModelInfo {
                id: "claude-haiku-5-5".to_string(),
                name: "Claude 5.5 Haiku".to_string(),
                context_window: Some(200000),
                max_output_tokens: Some(8192),
                capabilities: self.capabilities,
            },
            ModelInfo {
                id: "claude-sonnet-5-5".to_string(),
                name: "Claude 5.5 Sonnet".to_string(),
                context_window: Some(200000),
                max_output_tokens: Some(8192),
                capabilities: self.capabilities,
            },
            ModelInfo {
                id: "claude-opus-5-5".to_string(),
                name: "Claude 5.5 Opus".to_string(),
                context_window: Some(200000),
                max_output_tokens: Some(8192),
                capabilities: self.capabilities,
            },
            ModelInfo {
                id: "claude-3-5-sonnet-20241022".to_string(),
                name: "Claude 3.5 Sonnet".to_string(),
                context_window: Some(200000),
                max_output_tokens: Some(8192),
                capabilities: self.capabilities,
            },
            ModelInfo {
                id: "claude-fable-5-1".to_string(),
                name: "Claude 5.1 Fable".to_string(),
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
        let url = self.messages_url();
        let body = self.build_payload(&request, false, false);

        let req = self.apply_headers(self.client.post(&url)).json(&body);
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        let (res, _body) = if !res.status().is_success() {
            let status = res.status().as_u16();
            let text = res.text().await.unwrap_or_default();
            let lower = text.to_lowercase();

            // Auto-recovery: If HTTP 400 is due to deprecated sampling parameters (temperature or top_p), retry immediately without them
            if status == 400 && (lower.contains("temperature") || lower.contains("top_p")) {
                tracing::warn!(
                    "[Anthropic] Model '{}' rejected sampling parameters. Retrying request without temperature/top_p...",
                    request.model
                );
                let fallback_body = self.build_payload(&request, false, true);
                let retry_req = self.apply_headers(self.client.post(&url)).json(&fallback_body);
                match retry_req.send().await {
                    Ok(retry_res) if retry_res.status().is_success() => (retry_res, fallback_body),
                    Ok(retry_res) => {
                        let retry_status = retry_res.status().as_u16();
                        let retry_text = retry_res.text().await.unwrap_or_default();
                        return Err(Self::format_anthropic_error(retry_status, &retry_text, &url, &request.model, &fallback_body));
                    }
                    Err(e) => return Err(ProviderError::from_reqwest(&e, &url)),
                }
            } else {
                return Err(Self::format_anthropic_error(status, &text, &url, &request.model, &body));
            }
        } else {
            (res, body)
        };

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

        let usage = json.get("usage").map(|u| {
            let inp = u.get("input_tokens").and_then(|v| v.as_i64());
            let out = u.get("output_tokens").and_then(|v| v.as_i64());
            let tot = match (inp, out) {
                (Some(i), Some(o)) => Some(i + o),
                _ => None,
            };
            UsageInfo {
                prompt_tokens: inp,
                completion_tokens: out,
                total_tokens: tot,
            }
        });

        Ok(ChatResponse {
            role: "assistant".to_string(),
            content,
            model: request.model,
            finish_reason: stop_reason,
            usage,
        })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), ProviderError> {
        let url = self.messages_url();
        let body = self.build_payload(&request, true, false);

        let req = self.apply_headers(self.client.post(&url)).json(&body);
        let res = req.send().await.map_err(|e| ProviderError::from_reqwest(&e, &url))?;

        let res = if !res.status().is_success() {
            let status = res.status().as_u16();
            let text = res.text().await.unwrap_or_default();
            let lower = text.to_lowercase();

            // Auto-recovery: If HTTP 400 is due to deprecated sampling parameters (temperature or top_p), retry stream without them
            if status == 400 && (lower.contains("temperature") || lower.contains("top_p")) {
                tracing::warn!(
                    "[Anthropic Streaming] Model '{}' rejected sampling parameters. Retrying stream without temperature/top_p...",
                    request.model
                );
                let fallback_body = self.build_payload(&request, true, true);
                let retry_req = self.apply_headers(self.client.post(&url)).json(&fallback_body);
                match retry_req.send().await {
                    Ok(retry_res) if retry_res.status().is_success() => retry_res,
                    Ok(retry_res) => {
                        let retry_status = retry_res.status().as_u16();
                        let retry_text = retry_res.text().await.unwrap_or_default();
                        return Err(Self::format_anthropic_error(retry_status, &retry_text, &url, &request.model, &fallback_body));
                    }
                    Err(e) => return Err(ProviderError::from_reqwest(&e, &url)),
                }
            } else {
                return Err(Self::format_anthropic_error(status, &text, &url, &request.model, &body));
            }
        } else {
            res
        };

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
                            let text_chunk = parsed.pointer("/delta/text").and_then(|t| t.as_str())
                                .or_else(|| parsed.pointer("/delta/thinking").and_then(|t| t.as_str()));
                            if let Some(delta) = text_chunk {
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
