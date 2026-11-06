use sqlx::SqlitePool;
use serde_json::{json, Value};
use tracing::{info, error};
use crate::credentials::CredentialStore;
use crate::errors::AppError;
use crate::models::{SFTMessage, SFTSession};
use crate::providers::factory::ProviderFactory;
use crate::providers::models::{ChatMessage, ChatRequest};
use crate::providers::errors::{ProviderError, ProviderErrorCode};
use crate::services::provider_service::ProviderService;
use crate::services::sft_service::SFTService;
use crate::services::translation_parser::clean_translation_output;

pub struct TranslationService;

impl TranslationService {
    /// Standard translate session method for backward compatibility
    pub async fn translate_session(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        target_language: &str,
        provider_id: Option<&str>,
        model: Option<&str>,
    ) -> Result<SFTSession, AppError> {
        Self::translate_session_selective(
            pool,
            vault,
            session_id,
            target_language,
            provider_id,
            model,
            None,
            false,
        ).await
    }

    /// Selective / configurable translation supporting selective message IDs, preservation of edited/approved turns, and structured observability.
    /// Executes sequentially turn-by-turn with exponential backoff for HTTP 429 / transient errors and immediate persistence.
    pub async fn translate_session_selective(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        target_language: &str,
        provider_id: Option<&str>,
        model: Option<&str>,
        message_ids: Option<&[String]>,
        force_regenerate: bool,
    ) -> Result<SFTSession, AppError> {
        let start_time = std::time::Instant::now();
        let session = SFTService::get_session(pool, session_id).await?;
        if session.messages.is_empty() {
            return Err(AppError::Validation("Session has no messages to translate.".to_string()));
        }

        // Filter messages eligible for translation
        let target_messages: Vec<SFTMessage> = session.messages.clone().into_iter().filter(|m| {
            if let Some(ids) = message_ids {
                if !ids.iter().any(|id| id == &m.id) {
                    return false;
                }
            }
            if force_regenerate {
                return true;
            }
            let st = m.translation_status.get(target_language)
                .and_then(|v| v.as_str())
                .unwrap_or("pending");
            let has_text = m.translations.get(target_language)
                .and_then(|v| v.as_str())
                .map(|t| !t.trim().is_empty())
                .unwrap_or(false);

            st == "pending" || st == "failed" || !has_text
        }).collect();

        if target_messages.is_empty() {
            info!("[TRANSLATION] No eligible untranslated messages found for target_language='{}'. Returning intact.", target_language);
            return SFTService::get_session(pool, session_id).await;
        }

        // Determine active provider & model
        let (p_id, p_model) = Self::resolve_provider_and_model(pool, vault, provider_id, model, &session).await?;
        let provider = ProviderService::get(pool, &p_id, vault).await?;
        let api_key = ProviderService::get_raw_key(pool, &p_id, vault).await?;

        let instance = ProviderFactory::create(
            &provider.provider_type,
            &provider.base_url,
            api_key,
            provider.timeout_seconds,
        );

        let source_info = crate::languages::LanguageRegistry::lookup(&session.primary_language);
        let target_info = crate::languages::LanguageRegistry::lookup(target_language);

        let total_turns = target_messages.len();
        let mut success_count = 0;
        let mut failed_count = 0;

        for (idx, target_msg) in target_messages.iter().enumerate() {
            // Build preceding conversation context up to target_msg
            let preceding: Vec<String> = session.messages.iter()
                .take_while(|m| m.id != target_msg.id)
                .map(|m| format!("{}: {}", m.role, m.content))
                .collect();

            let context_str = if preceding.is_empty() {
                "No prior context.".to_string()
            } else {
                preceding.join("\n")
            };

            let prompt = format!(
                "You are an expert multilingual AI dataset localization engineer.\n\
                 Translate the following dialogue turn from source language '{source_name} ({source_code})' into target language '{target_name} ({target_code})'.\n\
                 Maintain original tone, formatting, speaker role, and technical terms. Provide ONLY the translated turn text.\n\n\
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
                model: p_model.clone(),
                messages: vec![
                    ChatMessage {
                        role: "system".to_string(),
                        content: "You are an expert conversational dataset translator. Output ONLY the translated turn text without conversational remarks, markdown fences, or quotes.".to_string(),
                    },
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

            // Execute request with retry and backoff
            let mut attempts = 0;
            let max_attempts = 3;
            let mut turn_result: Result<String, ProviderError> = Err(ProviderError::new(
                ProviderErrorCode::UnknownError,
                "Translation not initiated",
            ));

            while attempts < max_attempts {
                attempts += 1;
                match instance.chat(chat_req.clone()).await {
                    Ok(resp) => {
                        let cleaned = clean_translation_output(&resp.content);
                        if cleaned.trim().is_empty() {
                            if provider.provider_type == "mock" {
                                let sim = format!("[{}] {}", target_language.to_uppercase(), target_msg.content);
                                turn_result = Ok(sim);
                            } else {
                                turn_result = Err(ProviderError::new(
                                    ProviderErrorCode::InvalidResponse,
                                    "Received empty translation content from provider",
                                ));
                            }
                        } else {
                            turn_result = Ok(cleaned);
                        }
                        break;
                    }
                    Err(err) => {
                        let is_rate_limit = matches!(err.code, ProviderErrorCode::RateLimited);
                        let is_timeout = matches!(err.code, ProviderErrorCode::Timeout);
                        let is_transient = is_rate_limit || is_timeout;

                        if is_transient && attempts < max_attempts {
                            let backoff_ms = match attempts {
                                1 => 200,
                                2 => 400,
                                _ => 800,
                            };
                            tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
                            continue;
                        } else {
                            turn_result = Err(err);
                            break;
                        }
                    }
                }
            }

            match turn_result {
                Ok(translated_text) => {
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
                        map.insert(target_language.to_string(), json!("completed"));
                    }

                    let trans_str = serde_json::to_string(&trans_val)?;
                    let status_str = serde_json::to_string(&status_val)?;

                    sqlx::query(
                        "UPDATE sft_messages SET translations_json = ?, translation_status_json = ? WHERE id = ?"
                    )
                    .bind(&trans_str)
                    .bind(&status_str)
                    .bind(&target_msg.id)
                    .execute(pool)
                    .await?;

                    success_count += 1;
                }
                Err(err) => {
                    error!(
                        "[TRANSLATION] Sequential turn failed: turn={}/{} turn_id='{}' error='{}'",
                        idx + 1, total_turns, target_msg.id, err
                    );

                    let mut status_val = target_msg.translation_status.clone();
                    if !status_val.is_object() {
                        status_val = json!({});
                    }
                    if let Some(map) = status_val.as_object_mut() {
                        map.insert(target_language.to_string(), json!("failed"));
                    }
                    let status_str = serde_json::to_string(&status_val).unwrap_or_else(|_| "{}".to_string());
                    let _ = sqlx::query("UPDATE sft_messages SET translation_status_json = ? WHERE id = ?")
                        .bind(&status_str)
                        .bind(&target_msg.id)
                        .execute(pool)
                        .await;

                    failed_count += 1;

                    // Fatal error detection: abort remaining turns on permanent auth failure
                    if matches!(err.code, ProviderErrorCode::AuthenticationFailed) {
                        return Err(AppError::ProviderStructured(err));
                    }
                }
            }

            // Optional courteous delay between consecutive calls to prevent burst 429
            if idx + 1 < total_turns && provider.provider_type != "mock" {
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            }
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

        let duration_ms = start_time.elapsed().as_millis();
        info!(
            "[TRANSLATION] Sequential translation complete: turns={} success={} failed={} duration_ms={}",
            total_turns, success_count, failed_count, duration_ms
        );

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
        let start_time = std::time::Instant::now();
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
            model: p_model.clone(),
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

        let response = match instance.chat(chat_req).await {
            Ok(resp) => resp,
            Err(err) => {
                error!(
                    "[TRANSLATION] Single message translation failed. agent='Translation Engine' message_id='{}' provider='{}' model='{}' error='{}'",
                    message_id, p_id, p_model, err
                );
                let mut status_val = target_msg.translation_status.clone();
                if !status_val.is_object() { status_val = json!({}); }
                if let Some(map) = status_val.as_object_mut() {
                    map.insert(target_language.to_string(), json!("failed"));
                }
                let status_str = serde_json::to_string(&status_val).unwrap_or_else(|_| "{}".to_string());
                let _ = sqlx::query("UPDATE sft_messages SET translation_status_json = ? WHERE id = ?")
                    .bind(&status_str)
                    .bind(message_id)
                    .execute(pool)
                    .await;
                return Err(AppError::ProviderStructured(err));
            }
        };

        let translated_text = clean_translation_output(&response.content);
        let final_text = if translated_text.trim().is_empty() {
            if provider.provider_type == "mock" {
                format!("[{}] {}", target_language.to_uppercase(), target_msg.content)
            } else {
                return Err(AppError::ProviderStructured(ProviderError::new(
                    ProviderErrorCode::InvalidResponse,
                    "Translation returned empty content from provider",
                )));
            }
        } else {
            translated_text
        };

        let mut trans_val = target_msg.translations.clone();
        if !trans_val.is_object() {
            trans_val = json!({});
        }
        if let Some(map) = trans_val.as_object_mut() {
            map.insert(target_language.to_string(), json!(final_text));
        }

        let mut status_val = target_msg.translation_status.clone();
        if !status_val.is_object() {
            status_val = json!({});
        }
        if let Some(map) = status_val.as_object_mut() {
            map.insert(target_language.to_string(), json!("completed"));
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

        let duration_ms = start_time.elapsed().as_millis();
        info!(
            "[TRANSLATION] agent='Translation Engine' single_turn='{}' provider='{}' model='{}' source='{}' target='{}' status='COMPLETED' duration_ms={}",
            message_id, p_id, p_model, source_info.code, target_info.code, duration_ms
        );

        let updated_messages = SFTService::get_messages(pool, session_id).await?;
        updated_messages.into_iter().find(|m| m.id == message_id)
            .ok_or_else(|| AppError::NotFound(format!("Message {} not found", message_id)))
    }

    pub async fn retry_failed_translations(
        pool: &SqlitePool,
        vault: &dyn CredentialStore,
        session_id: &str,
        target_language: &str,
        provider_id: Option<&str>,
        model: Option<&str>,
    ) -> Result<SFTSession, AppError> {
        let session = SFTService::get_session(pool, session_id).await?;
        let failed_ids: Vec<String> = session.messages.iter().filter(|m| {
            let st = m.translation_status.get(target_language)
                .and_then(|v| v.as_str())
                .unwrap_or("pending");
            let has_text = m.translations.get(target_language)
                .and_then(|v| v.as_str())
                .map(|t| !t.trim().is_empty())
                .unwrap_or(false);
            st == "failed" || st == "pending" || !has_text
        }).map(|m| m.id.clone()).collect();

        if failed_ids.is_empty() {
            return Ok(session);
        }

        Self::translate_session_selective(
            pool,
            vault,
            session_id,
            target_language,
            provider_id,
            model,
            Some(&failed_ids),
            true,
        ).await
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
