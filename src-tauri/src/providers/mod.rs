use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::mpsc::UnboundedSender;
use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i64>,
    pub stream: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub role: String,
    pub content: String,
    pub model: String,
    pub finish_reason: Option<String>,
}

#[async_trait]
pub trait ModelProvider: Send + Sync {
    async fn test_connection(&self) -> Result<Vec<String>, AppError>;
    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, AppError>;
    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), AppError>;
}

// -------------------------------------------------------------
// OpenAI-Compatible Provider (vLLM, LM Studio, SGLang, OpenAI, LocalAI)
// -------------------------------------------------------------
pub struct OpenAICompatibleProvider {
    pub base_url: String,
    pub api_key: Option<String>,
    pub client: reqwest::Client,
}

impl OpenAICompatibleProvider {
    pub fn new(base_url: String, api_key: Option<String>, timeout_secs: u64) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .build()
            .unwrap_or_default();
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key,
            client,
        }
    }

    fn auth_header(&self, builder: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(key) = &self.api_key {
            if !key.is_empty() {
                return builder.header("Authorization", format!("Bearer {}", key));
            }
        }
        builder
    }
}

#[async_trait]
impl ModelProvider for OpenAICompatibleProvider {
    async fn test_connection(&self) -> Result<Vec<String>, AppError> {
        let url = format!("{}/models", self.base_url);
        let req = self.auth_header(self.client.get(&url));
        let res = req.send().await.map_err(|e| AppError::Provider(format!("Failed to connect to {}: {}", url, e)))?;

        if !res.status().is_success() {
            return Err(AppError::Provider(format!(
                "Provider returned status code: {}",
                res.status()
            )));
        }

        let json: Value = res.json().await?;
        let mut models = Vec::new();
        if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
            for m in data {
                if let Some(id) = m.get("id").and_then(|i| i.as_str()) {
                    models.push(id.to_string());
                }
            }
        }
        if models.is_empty() {
            models.push("default-model".to_string());
        }
        Ok(models)
    }

    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, AppError> {
        let url = format!("{}/chat/completions", self.base_url);
        let payload = json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature.unwrap_or(0.7),
            "top_p": request.top_p.unwrap_or(0.9),
            "max_tokens": request.max_tokens.unwrap_or(2048),
            "stream": false
        });

        let req = self.auth_header(self.client.post(&url).json(&payload));
        let res = req.send().await.map_err(|e| AppError::Provider(format!("Chat request failed: {}", e)))?;

        if !res.status().is_success() {
            let error_text = res.text().await.unwrap_or_default();
            return Err(AppError::Provider(format!("Chat failed: {}", error_text)));
        }

        let json: Value = res.json().await?;
        let content = json
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let finish_reason = json
            .pointer("/choices/0/finish_reason")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(ChatResponse {
            role: "assistant".to_string(),
            content,
            model: request.model,
            finish_reason,
        })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), AppError> {
        let url = format!("{}/chat/completions", self.base_url);
        let payload = json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature.unwrap_or(0.7),
            "top_p": request.top_p.unwrap_or(0.9),
            "max_tokens": request.max_tokens.unwrap_or(2048),
            "stream": true
        });

        let req = self.auth_header(self.client.post(&url).json(&payload));
        let res = req.send().await.map_err(|e| AppError::Provider(format!("Streaming request failed: {}", e)))?;

        if !res.status().is_success() {
            let error_text = res.text().await.unwrap_or_default();
            return Err(AppError::Provider(format!("Stream failed: {}", error_text)));
        }

        use futures_util::StreamExt;
        let mut stream = res.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| AppError::Provider(format!("Chunk error: {}", e)))?;
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
}

// -------------------------------------------------------------
// Ollama Native Provider
// -------------------------------------------------------------
pub struct OllamaProvider {
    pub base_url: String,
    pub client: reqwest::Client,
}

impl OllamaProvider {
    pub fn new(base_url: String, timeout_secs: u64) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .build()
            .unwrap_or_default();
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client,
        }
    }
}

#[async_trait]
impl ModelProvider for OllamaProvider {
    async fn test_connection(&self) -> Result<Vec<String>, AppError> {
        let url = format!("{}/api/tags", self.base_url);
        let res = self.client.get(&url).send().await
            .map_err(|e| AppError::Provider(format!("Failed to connect to Ollama at {}: {}", url, e)))?;

        if !res.status().is_success() {
            return Err(AppError::Provider(format!("Ollama returned status {}", res.status())));
        }

        let json: Value = res.json().await?;
        let mut models = Vec::new();
        if let Some(arr) = json.get("models").and_then(|m| m.as_array()) {
            for m in arr {
                if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                    models.push(name.to_string());
                }
            }
        }
        if models.is_empty() {
            models.push("llama3:latest".to_string());
        }
        Ok(models)
    }

    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, AppError> {
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
            .map_err(|e| AppError::Provider(format!("Ollama chat failed: {}", e)))?;

        if !res.status().is_success() {
            let error_text = res.text().await.unwrap_or_default();
            return Err(AppError::Provider(format!("Ollama request failed: {}", error_text)));
        }

        let json: Value = res.json().await?;
        let content = json.pointer("/message/content").and_then(|v| v.as_str()).unwrap_or("").to_string();

        Ok(ChatResponse {
            role: "assistant".to_string(),
            content,
            model: request.model,
            finish_reason: Some("stop".to_string()),
        })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), AppError> {
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
            .map_err(|e| AppError::Provider(format!("Ollama streaming request failed: {}", e)))?;

        if !res.status().is_success() {
            let error_text = res.text().await.unwrap_or_default();
            return Err(AppError::Provider(format!("Ollama stream error: {}", error_text)));
        }

        use futures_util::StreamExt;
        let mut stream = res.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| AppError::Provider(format!("Chunk error: {}", e)))?;
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
}

// -------------------------------------------------------------
// Mock Provider (Guarantees offline testing & fast demo verification)
// -------------------------------------------------------------
pub struct MockProvider;

#[async_trait]
impl ModelProvider for MockProvider {
    async fn test_connection(&self) -> Result<Vec<String>, AppError> {
        Ok(vec![
            "mock-llama-3-8b".to_string(),
            "mock-mistral-7b".to_string(),
            "mock-qwen-2.5-7b".to_string(),
        ])
    }

    async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, AppError> {
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
        })
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
        sender: UnboundedSender<String>,
    ) -> Result<(), AppError> {
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
            tokio::time::sleep(tokio::time::Duration::from_millis(25)).await;
        }

        Ok(())
    }
}

// -------------------------------------------------------------
// Provider Factory
// -------------------------------------------------------------
pub fn create_provider(
    provider_type: &str,
    base_url: &str,
    api_key: Option<String>,
    timeout_secs: i64,
) -> Box<dyn ModelProvider> {
    let timeout = if timeout_secs <= 0 { 60 } else { timeout_secs as u64 };
    match provider_type {
        "mock" => Box::new(MockProvider),
        "ollama" => Box::new(OllamaProvider::new(base_url.to_string(), timeout)),
        _ => Box::new(OpenAICompatibleProvider::new(
            base_url.to_string(),
            api_key,
            timeout,
        )),
    }
}
