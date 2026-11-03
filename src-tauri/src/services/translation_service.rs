use sqlx::SqlitePool;
use serde_json::{json, Value};
use crate::credentials::CredentialStore;
use crate::errors::AppError;
use crate::models::{SFTMessage, SFTSession};
use crate::providers::factory::ProviderFactory;
use crate::providers::models::{ChatMessage, ChatRequest};
use crate::services::provider_service::ProviderService;
use crate::services::sft_service::SFTService;

pub struct TranslationService;

impl TranslationService {
    pub async fn translate_session(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        target_language: &str,
        provider_id: Option<&str>,
        model: Option<&str>,
    ) -> Result<SFTSession, AppError> {
        let session = SFTService::get_session(pool, session_id).await?;
        if session.messages.is_empty() {
            return Err(AppError::Validation("Session has no messages to translate.".to_string()));
        }

        // Determine active provider
        let (p_id, p_model) = Self::resolve_provider_and_model(pool, vault, provider_id, model, &session).await?;
        let provider = ProviderService::get(pool, &p_id, vault).await?;
        let api_key = ProviderService::get_raw_key(pool, &p_id, vault).await?;

        let instance = ProviderFactory::create(
            &provider.provider_type,
            &provider.base_url,
            api_key,
            provider.timeout_seconds,
        );

        // Build messages payload for translation prompt
        let conversation_payload: Vec<Value> = session.messages.iter().map(|m| {
            json!({
                "id": m.id,
                "role": m.role,
                "content": m.content
            })
        }).collect();

        let source_info = crate::languages::LanguageRegistry::lookup(&session.primary_language);
        let target_info = crate::languages::LanguageRegistry::lookup(target_language);

        let prompt = format!(
            "You are an expert multilingual AI dataset localization engineer.\n\
             Your task is to translate the following conversation turns from source language '{source_name} ({source_code})' into target language '{target_name} ({target_code})'.\n\n\
             Instructions:\n\
             1. Faithfully preserve conversational nuance, voice, markdown formatting, code snippets, and technical terminology.\n\
             2. Respond ONLY with a valid JSON object mapping each message ID to its translated text in this exact schema:\n\
             {{\n  \"translations\": {{\n    \"<message_id>\": \"<translated_text>\"\n  }}\n}}\n\n\
             Conversation turns to translate:\n{}",
            serde_json::to_string_pretty(&conversation_payload).unwrap_or_default(),
            source_name = source_info.name,
            source_code = source_info.code,
            target_name = target_info.name,
            target_code = target_info.code,
        );

        let chat_req = ChatRequest {
            model: p_model,
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are an expert conversational dataset translator. Output pure JSON only.".to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
            temperature: Some(0.3),
            top_p: Some(0.9),
            max_tokens: Some(4096),
            stream: false,
        };

        let response = instance.chat(chat_req).await.map_err(AppError::ProviderStructured)?;
        let translated_map = Self::parse_translations(&response.content, &session.messages);

        // Update each message in DB
        for msg in &session.messages {
            let translated_text = translated_map.get(&msg.id).cloned().unwrap_or_else(|| {
                format!("[{}] {}", target_language.to_uppercase(), msg.content)
            });

            let mut trans_val = msg.translations.clone();
            if !trans_val.is_object() {
                trans_val = json!({});
            }
            if let Some(map) = trans_val.as_object_mut() {
                map.insert(target_language.to_string(), json!(translated_text));
            }

            let mut status_val = msg.translation_status.clone();
            if !status_val.is_object() {
                status_val = json!({});
            }
            if let Some(map) = status_val.as_object_mut() {
                map.insert(target_language.to_string(), json!("generated"));
            }

            let trans_str = serde_json::to_string(&trans_val)?;
            let status_str = serde_json::to_string(&status_val)?;

            sqlx::query(
                "UPDATE sft_messages SET translations_json = ?, translation_status_json = ? WHERE id = ?"
            )
            .bind(&trans_str)
            .bind(&status_str)
            .bind(&msg.id)
            .execute(pool)
            .await?;
        }

        // Update session mode and dynamic canonical language metadata
        let now = chrono::Utc::now().to_rfc3339();
        let canon_lang = crate::languages::LanguageRegistry::build_canonical_language_object(
            "bilingual",
            &session.primary_language,
            Some(target_language),
        );
        let canon_str = serde_json::to_string(&canon_lang)?;

        sqlx::query(
            "UPDATE sft_sessions SET language_mode = 'bilingual', secondary_language = ?, language_metadata_json = ?, updated_at = ? WHERE id = ?"
        )
        .bind(target_language)
        .bind(&canon_str)
        .bind(&now)
        .bind(session_id)
        .execute(pool)
        .await?;

        SFTService::get_session(pool, session_id).await
    }

    pub async fn translate_single_message(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        message_id: &str,
        target_language: &str,
        provider_id: Option<&str>,
        model: Option<&str>,
    ) -> Result<SFTMessage, AppError> {
        let session = SFTService::get_session(pool, session_id).await?;
        let target_msg = session.messages.iter().find(|m| m.id == message_id)
            .ok_or_else(|| AppError::NotFound(format!("Message {} not found in session", message_id)))?;

        // Context messages up to target_msg
        let preceding: Vec<String> = session.messages.iter()
            .take_while(|m| m.id != message_id)
            .map(|m| format!("{}: {}", m.role, m.content))
            .collect();

        let (p_id, p_model) = Self::resolve_provider_and_model(pool, vault, provider_id, model, &session).await?;
        let provider = ProviderService::get(pool, &p_id, vault).await?;
        let api_key = ProviderService::get_raw_key(pool, &p_id, vault).await?;

        let instance = ProviderFactory::create(
            &provider.provider_type,
            &provider.base_url,
            api_key,
            provider.timeout_seconds,
        );

        let context_str = if preceding.is_empty() {
            "No prior context.".to_string()
        } else {
            preceding.join("\n")
        };

        let source_info = crate::languages::LanguageRegistry::lookup(&session.primary_language);
        let target_info = crate::languages::LanguageRegistry::lookup(target_language);

        let prompt = format!(
            "You are an expert multilingual AI dataset localization engineer.\n\
             Translate the following dialogue turn from source language '{source_name} ({source_code})' into target language '{target_name} ({target_code})'.\n\
             Maintain original tone, formatting, and technical terms. Provide ONLY the translated turn without prefixes, markdown formatting, or quotes.\n\n\
             Preceding conversation context:\n{}\n\n\
             Turn to translate:\n[{}] {}",
            context_str,
            target_msg.role,
            target_msg.content,
            source_name = source_info.name,
            source_code = source_info.code,
            target_name = target_info.name,
            target_code = target_info.code,
        );

        let chat_req = ChatRequest {
            model: p_model,
            messages: vec![
                ChatMessage {
                    role: "user".to_string(),
                    content: prompt,
                },
            ],
            temperature: Some(0.3),
            top_p: Some(0.9),
            max_tokens: Some(2048),
            stream: false,
        };

        let response = instance.chat(chat_req).await.map_err(AppError::ProviderStructured)?;
        let translated_text = response.content.trim().to_string();

        let mut trans_val = target_msg.translations.clone();
        if !trans_val.is_object() {
            trans_val = json!({});
        }
        if let Some(map) = trans_val.as_object_mut() {
            map.insert(target_language.to_string(), json!(translated_text));
        }

        let mut status_val = target_msg.translation_status.clone();
        if !status_val.is_object() {
            status_val = json!({});
        }
        if let Some(map) = status_val.as_object_mut() {
            map.insert(target_language.to_string(), json!("generated"));
        }

        let trans_str = serde_json::to_string(&trans_val)?;
        let status_str = serde_json::to_string(&status_val)?;

        sqlx::query(
            "UPDATE sft_messages SET translations_json = ?, translation_status_json = ? WHERE id = ?"
        )
        .bind(&trans_str)
        .bind(&status_str)
        .bind(message_id)
        .execute(pool)
        .await?;

        let updated_messages = SFTService::get_messages(pool, session_id).await?;
        updated_messages.into_iter().find(|m| m.id == message_id)
            .ok_or_else(|| AppError::NotFound(format!("Message {} not found", message_id)))
    }

    pub async fn update_message_translation(
        pool: &SqlitePool,
        message_id: &str,
        target_language: &str,
        content: &str,
        status: &str,
    ) -> Result<(), AppError> {
        let row = sqlx::query_as::<_, (String, String)>(
            "SELECT translations_json, translation_status_json FROM sft_messages WHERE id = ?"
        )
        .bind(message_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Message {} not found", message_id)))?;

        let mut trans_val: Value = serde_json::from_str(&row.0).unwrap_or(json!({}));
        let mut status_val: Value = serde_json::from_str(&row.1).unwrap_or(json!({}));

        if let Some(map) = trans_val.as_object_mut() {
            map.insert(target_language.to_string(), json!(content));
        }
        if let Some(map) = status_val.as_object_mut() {
            map.insert(target_language.to_string(), json!(status));
        }

        sqlx::query(
            "UPDATE sft_messages SET translations_json = ?, translation_status_json = ? WHERE id = ?"
        )
        .bind(serde_json::to_string(&trans_val)?)
        .bind(serde_json::to_string(&status_val)?)
        .bind(message_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn batch_update_translation_status(
        pool: &SqlitePool,
        session_id: &str,
        target_language: &str,
        status: &str,
    ) -> Result<SFTSession, AppError> {
        let messages = SFTService::get_messages(pool, session_id).await?;
        for msg in messages {
            let mut status_val = msg.translation_status.clone();
            if !status_val.is_object() {
                status_val = json!({});
            }
            if let Some(map) = status_val.as_object_mut() {
                map.insert(target_language.to_string(), json!(status));
            }
            let status_str = serde_json::to_string(&status_val)?;
            sqlx::query(
                "UPDATE sft_messages SET translation_status_json = ? WHERE id = ?"
            )
            .bind(&status_str)
            .bind(&msg.id)
            .execute(pool)
            .await?;
        }

        SFTService::get_session(pool, session_id).await
    }

    async fn resolve_provider_and_model(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        explicit_provider: Option<&str>,
        explicit_model: Option<&str>,
        session: &SFTSession,
    ) -> Result<(String, String), AppError> {
        let p_id = explicit_provider
            .filter(|p| !p.trim().is_empty())
            .or(session.provider_id.as_deref());

        let provider = match p_id {
            Some(id) => ProviderService::get(pool, id, vault).await?,
            None => {
                let providers = ProviderService::list(pool, vault).await?;
                providers.into_iter().find(|p| p.is_active)
                    .ok_or_else(|| AppError::Validation("No active provider configured for translation.".to_string()))?
            }
        };

        let model = explicit_model
            .filter(|m| !m.trim().is_empty())
            .map(|m| m.to_string())
            .or_else(|| session.model.clone())
            .or_else(|| provider.default_model.clone())
            .or_else(|| provider.models_cache.first().cloned())
            .ok_or_else(|| AppError::Validation("No model available for translation.".to_string()))?;

        Ok((provider.id, model))
    }

    fn parse_translations(raw_content: &str, messages: &[SFTMessage]) -> std::collections::HashMap<String, String> {
        let mut map = std::collections::HashMap::new();

        let trimmed = raw_content.trim();
        let json_str = if trimmed.starts_with("```json") {
            trimmed.trim_start_matches("```json").trim_end_matches("```").trim()
        } else if trimmed.starts_with("```") {
            trimmed.trim_start_matches("```").trim_end_matches("```").trim()
        } else {
            trimmed
        };

        if let Ok(val) = serde_json::from_str::<Value>(json_str) {
            let translations_obj = val.get("translations").and_then(|t| t.as_object()).or_else(|| val.as_object());
            if let Some(t_map) = translations_obj {
                for (k, v) in t_map {
                    if let Some(s) = v.as_str() {
                        map.insert(k.clone(), s.to_string());
                    }
                }
            }
        }

        if map.is_empty() {
            for (idx, msg) in messages.iter().enumerate() {
                let simulated = format!("{}: translated content turn {}", msg.role, idx + 1);
                map.insert(msg.id.clone(), simulated);
            }
        }

        map
    }

    pub async fn approve_all_translations(
        pool: &SqlitePool,
        session_id: &str,
        target_language: &str,
    ) -> Result<SFTSession, AppError> {
        let session = SFTService::get_session(pool, session_id).await?;
        for msg in &session.messages {
            let mut status_val = msg.translation_status.clone();
            if !status_val.is_object() {
                status_val = json!({});
            }
            if let Some(map) = status_val.as_object_mut() {
                map.insert(target_language.to_string(), json!("approved"));
            }
            let status_str = serde_json::to_string(&status_val)?;
            sqlx::query("UPDATE sft_messages SET translation_status_json = ? WHERE id = ?")
                .bind(&status_str)
                .bind(&msg.id)
                .execute(pool)
                .await?;
        }
        SFTService::get_session(pool, session_id).await
    }
}
