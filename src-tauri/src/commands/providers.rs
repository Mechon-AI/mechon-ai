use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use sqlx::SqlitePool;
use serde_json::json;
use tokio::sync::mpsc;
use crate::credentials::{
    legacy_credential_ref, make_credential_ref, CredentialStatus, CredentialStore,
};
use crate::errors::AppError;
use crate::models::{Provider, ProviderCreateInput, ProviderUpdateInput};
use crate::providers::definition::ProviderDefinition;
use crate::providers::factory::ProviderFactory;
use crate::providers::models::{ChatMessage, ChatRequest, ConnectionTestResult};
use crate::providers::registry::ProviderRegistry;
use crate::services::provider_service::ProviderService;

#[tauri::command]
pub fn get_provider_definitions() -> Vec<ProviderDefinition> {
    ProviderRegistry::global().all()
}

#[tauri::command]
pub async fn get_providers(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
) -> Result<Vec<Provider>, AppError> {
    ProviderService::list(&pool, vault.inner().as_ref()).await
}

#[tauri::command]
pub async fn get_provider(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    id: String,
) -> Result<Provider, AppError> {
    ProviderService::get(&pool, &id, vault.inner().as_ref()).await
}

#[tauri::command]
pub async fn create_provider_cmd(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    data: ProviderCreateInput,
) -> Result<Provider, AppError> {
    ProviderService::create(&pool, data, vault.inner().as_ref()).await
}

#[tauri::command]
pub async fn update_provider_cmd(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    id: String,
    data: ProviderUpdateInput,
) -> Result<Provider, AppError> {
    ProviderService::update(&pool, &id, data, vault.inner().as_ref()).await
}

#[tauri::command]
pub async fn delete_provider_cmd(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    id: String,
) -> Result<(), AppError> {
    ProviderService::delete(&pool, &id, vault.inner().as_ref()).await
}

#[tauri::command]
pub async fn test_provider(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    id: String,
) -> Result<ConnectionTestResult, AppError> {
    ProviderService::test_provider(&pool, &id, vault.inner().as_ref()).await
}

// -------------------------------------------------------------
// Credential Vault Management Commands
// -------------------------------------------------------------
#[tauri::command]
pub async fn save_provider_credentials(
    vault: State<'_, Arc<dyn CredentialStore>>,
    provider_id: String,
    api_key: String,
) -> Result<CredentialStatus, AppError> {
    let ref_id = make_credential_ref(&provider_id);
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("API key cannot be empty".to_string()));
    }
    vault.inner().as_ref().save_credential(&ref_id, trimmed)
        .map_err(|e| AppError::Internal(format!("Failed to save credential: {}", e)))?;
    Ok(vault.inner().as_ref().get_status(&ref_id))
}

#[tauri::command]
pub fn get_provider_credential_status(
    vault: State<'_, Arc<dyn CredentialStore>>,
    provider_id: String,
) -> CredentialStatus {
    let ref_id = make_credential_ref(&provider_id);
    let mut status = vault.inner().as_ref().get_status(&ref_id);
    if !status.has_api_key {
        let leg = legacy_credential_ref(&provider_id);
        let alt = vault.inner().as_ref().get_status(&leg);
        if alt.has_api_key {
            status = alt;
        }
    }
    status
}

#[tauri::command]
pub async fn replace_provider_credentials(
    vault: State<'_, Arc<dyn CredentialStore>>,
    provider_id: String,
    api_key: String,
) -> Result<CredentialStatus, AppError> {
    save_provider_credentials(vault, provider_id, api_key).await
}

#[tauri::command]
pub async fn delete_provider_credentials(
    vault: State<'_, Arc<dyn CredentialStore>>,
    provider_id: String,
) -> Result<CredentialStatus, AppError> {
    let ref_id = make_credential_ref(&provider_id);
    let _ = vault.inner().as_ref().delete_credential(&ref_id);
    let _ = vault.inner().as_ref().delete_credential(&legacy_credential_ref(&provider_id));
    Ok(vault.inner().as_ref().get_status(&ref_id))
}

// -------------------------------------------------------------
// Inference & Model Execution (Centralized Model Factory)
// -------------------------------------------------------------
#[derive(serde::Deserialize)]
pub struct GenerateCompletionInput {
    pub provider_id: String,
    pub model: Option<String>,
    pub prompt: Option<String>,
    pub messages: Option<Vec<ChatMessage>>,
    pub system_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i64>,
}

#[tauri::command]
pub async fn generate_completion(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    data: GenerateCompletionInput,
) -> Result<serde_json::Value, AppError> {
    let provider = ProviderService::get(&pool, &data.provider_id, vault.inner().as_ref()).await?;
    let api_key = ProviderService::get_raw_key(&pool, &data.provider_id, vault.inner().as_ref()).await?;

    let model = data.model
        .or(provider.default_model)
        .unwrap_or_else(|| "default-model".to_string());

    let mut chat_messages = Vec::new();
    if let Some(sys) = data.system_prompt {
        if !sys.trim().is_empty() {
            chat_messages.push(ChatMessage {
                role: "system".to_string(),
                content: sys,
            });
        }
    }

    if let Some(msgs) = data.messages {
        chat_messages.extend(msgs);
    } else if let Some(p) = data.prompt {
        chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: p,
        });
    }

    let instance = ProviderFactory::create(
        &provider.provider_type,
        &provider.base_url,
        api_key,
        provider.timeout_seconds,
    );

    let chat_req = ChatRequest {
        model: model.clone(),
        messages: chat_messages,
        temperature: data.temperature,
        top_p: data.top_p,
        max_tokens: data.max_tokens,
        stream: false,
    };

    let resp = instance.chat(chat_req).await
        .map_err(|e| AppError::Provider(e.message))?;

    Ok(json!({
        "role": resp.role,
        "content": resp.content,
        "model": resp.model,
        "finish_reason": resp.finish_reason
    }))
}

#[derive(serde::Deserialize)]
pub struct GenerateDPOPairInput {
    pub provider_id: String,
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub model_a: Option<String>,
    pub model_b: Option<String>,
    pub temp_a: Option<f64>,
    pub temp_b: Option<f64>,
}

#[tauri::command]
pub async fn generate_dpo_pair(
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    params: GenerateDPOPairInput,
) -> Result<serde_json::Value, AppError> {
    let provider = ProviderService::get(&pool, &params.provider_id, vault.inner().as_ref()).await?;
    let api_key = ProviderService::get_raw_key(&pool, &params.provider_id, vault.inner().as_ref()).await?;

    let model_a = params.model_a
        .or_else(|| provider.default_model.clone())
        .unwrap_or_else(|| "default-model".to_string());

    let model_b = params.model_b
        .or_else(|| provider.default_model.clone())
        .unwrap_or_else(|| model_a.clone());

    let mut messages_a = Vec::new();
    let mut messages_b = Vec::new();

    if let Some(ref sys) = params.system_prompt {
        if !sys.trim().is_empty() {
            messages_a.push(ChatMessage { role: "system".to_string(), content: sys.clone() });
            messages_b.push(ChatMessage { role: "system".to_string(), content: sys.clone() });
        }
    }
    messages_a.push(ChatMessage { role: "user".to_string(), content: params.prompt.clone() });
    messages_b.push(ChatMessage { role: "user".to_string(), content: params.prompt.clone() });

    let instance = ProviderFactory::create(
        &provider.provider_type,
        &provider.base_url,
        api_key,
        provider.timeout_seconds,
    );

    let req_a = ChatRequest {
        model: model_a.clone(),
        messages: messages_a,
        temperature: params.temp_a.or(Some(0.7)),
        top_p: Some(0.9),
        max_tokens: Some(2048),
        stream: false,
    };

    let req_b = ChatRequest {
        model: model_b.clone(),
        messages: messages_b,
        temperature: params.temp_b.or(Some(0.9)),
        top_p: Some(0.95),
        max_tokens: Some(2048),
        stream: false,
    };

    let start_a = std::time::Instant::now();
    let resp_a = instance.chat(req_a).await
        .map_err(|e| AppError::Provider(format!("Model A generation failed: {}", e.message)))?;
    let latency_a = start_a.elapsed().as_millis() as i64;

    let start_b = std::time::Instant::now();
    let resp_b = instance.chat(req_b).await
        .map_err(|e| AppError::Provider(format!("Model B generation failed: {}", e.message)))?;
    let latency_b = start_b.elapsed().as_millis() as i64;

    Ok(json!({
        "response_a": resp_a.content,
        "response_b": resp_b.content,
        "model_a": model_a,
        "model_b": model_b,
        "latency_a_ms": latency_a,
        "latency_b_ms": latency_b
    }))
}

#[derive(serde::Deserialize)]
pub struct StreamCompletionInput {
    pub session_id: String,
    pub provider_id: String,
    pub model: Option<String>,
    pub messages: Vec<ChatMessage>,
    pub system_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i64>,
}

#[tauri::command]
pub async fn stream_completion(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    vault: State<'_, Arc<dyn CredentialStore>>,
    data: StreamCompletionInput,
) -> Result<String, AppError> {
    let provider = ProviderService::get(&pool, &data.provider_id, vault.inner().as_ref()).await?;
    let api_key = ProviderService::get_raw_key(&pool, &data.provider_id, vault.inner().as_ref()).await?;

    let model = data.model
        .or(provider.default_model)
        .unwrap_or_else(|| "default-model".to_string());

    let mut chat_messages = Vec::new();
    if let Some(sys) = data.system_prompt {
        if !sys.trim().is_empty() {
            chat_messages.push(ChatMessage {
                role: "system".to_string(),
                content: sys,
            });
        }
    }
    chat_messages.extend(data.messages);

    let instance = ProviderFactory::create(
        &provider.provider_type,
        &provider.base_url,
        api_key,
        provider.timeout_seconds,
    );

    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    let chat_req = ChatRequest {
        model: model.clone(),
        messages: chat_messages,
        temperature: data.temperature,
        top_p: data.top_p,
        max_tokens: data.max_tokens,
        stream: true,
    };

    let session_id_clone = data.session_id.clone();
    let app_clone = app.clone();

    // Spawn provider stream task
    tokio::spawn(async move {
        if let Err(e) = instance.chat_stream(chat_req, tx).await {
            let _ = app_clone.emit(&format!("sft-stream-error-{}", session_id_clone), json!({ "error": e.message }));
        }
    });

    let mut full_accumulated = String::new();
    let event_name = format!("sft-stream-token-{}", data.session_id);

    while let Some(token) = rx.recv().await {
        full_accumulated.push_str(&token);
        let _ = app.emit(&event_name, json!({ "token": token, "accumulated": full_accumulated }));
    }

    let end_event = format!("sft-stream-done-{}", data.session_id);
    let _ = app.emit(&end_event, json!({ "content": full_accumulated }));

    Ok(full_accumulated)
}
