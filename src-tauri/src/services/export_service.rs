use sqlx::SqlitePool;
use serde_json::{json, Value};
use uuid::Uuid;
use chrono::Utc;
use crate::errors::AppError;

pub struct ExportService;

fn transform_messages_for_bilingual_mode(
    messages: &Value,
    bilingual_mode: Option<&str>,
    _primary_lang: &str,
    secondary_lang: &str,
) -> Value {
    let mode = bilingual_mode.unwrap_or("canonical_aligned").to_lowercase();
    match mode.as_str() {
        "primary_only" => {
            if let Some(arr) = messages.as_array() {
                let transformed: Vec<Value> = arr.iter().map(|m| {
                    let role = m.get("role").cloned().unwrap_or(json!("user"));
                    let content = m.get("content").cloned().unwrap_or(json!(""));
                    json!({
                        "role": role,
                        "content": content
                    })
                }).collect();
                Value::Array(transformed)
            } else {
                messages.clone()
            }
        }
        "secondary_only" => {
            if let Some(arr) = messages.as_array() {
                let transformed: Vec<Value> = arr.iter().map(|m| {
                    let role = m.get("role").cloned().unwrap_or(json!("user"));
                    let content = if let Some(trans) = m.get("translations").and_then(|t| t.as_object()) {
                        trans.get(secondary_lang)
                            .or_else(|| trans.get("en"))
                            .or_else(|| trans.values().next())
                            .and_then(|v| v.as_str())
                            .map(|s| json!(s))
                            .unwrap_or_else(|| m.get("content").cloned().unwrap_or(json!("")))
                    } else {
                        m.get("content").cloned().unwrap_or(json!(""))
                    };
                    json!({
                        "role": role,
                        "content": content
                    })
                }).collect();
                Value::Array(transformed)
            } else {
                messages.clone()
            }
        }
        _ => {
            // canonical_aligned: preserve messages structure as is
            messages.clone()
        }
    }
}

impl ExportService {
    pub async fn export_sft(
        pool: &SqlitePool,
        project_id: &str,
        format_type: &str,
        include_metadata: bool,
        record_ids: Option<Vec<String>>,
        bilingual_mode: Option<&str>,
    ) -> Result<String, AppError> {
        let records = if let Some(ref ids) = record_ids {
            if ids.is_empty() {
                return Err(AppError::Validation("No examples selected. Select records from Mechon Corpus first.".to_string()));
            }
            crate::services::dataset_service::DatasetService::get_sft_records_by_ids(
                pool,
                project_id,
                ids,
            ).await?
        } else {
            let (recs, _) = crate::services::dataset_service::DatasetService::list_sft_records(
                pool,
                project_id,
                None,
                None,
                100000,
                0,
            ).await?;
            recs
        };

        match format_type.to_lowercase().as_str() {
            "json" => {
                let items: Vec<Value> = records.into_iter().map(|r| {
                    let final_messages = transform_messages_for_bilingual_mode(
                        &r.messages,
                        bilingual_mode,
                        &r.primary_language,
                        &r.secondary_language,
                    );
                    if include_metadata {
                        let primary_info = crate::languages::LanguageRegistry::lookup(&r.primary_language);
                        let secondary_info = crate::languages::LanguageRegistry::lookup(&r.secondary_language);
                        json!({
                            "schema_version": "2.0",
                            "id": r.id,
                            "type": "sft",
                            "language": {
                                "mode": r.language_mode,
                                "primary": {
                                    "code": primary_info.code,
                                    "name": primary_info.name,
                                    "native_name": primary_info.native_name
                                },
                                "secondary": {
                                    "code": secondary_info.code,
                                    "name": secondary_info.name,
                                    "native_name": secondary_info.native_name
                                }
                            },
                            "messages": final_messages,
                            "turn_count": r.turn_count,
                            "character_count": r.character_count,
                            "metadata": r.metadata,
                            "created_at": r.created_at
                        })
                    } else {
                        json!({
                            "messages": final_messages
                        })
                    }
                }).collect();
                Ok(serde_json::to_string_pretty(&items)?)
            }
            "csv" => {
                let mut wtr = csv::Writer::from_writer(vec![]);
                if include_metadata {
                    wtr.write_record(&["id", "messages", "turn_count", "language_mode", "primary_language", "secondary_language", "metadata", "created_at"])
                        .map_err(|e| AppError::Internal(e.to_string()))?;
                    for r in records {
                        let final_messages = transform_messages_for_bilingual_mode(
                            &r.messages,
                            bilingual_mode,
                            &r.primary_language,
                            &r.secondary_language,
                        );
                        wtr.write_record(&[
                            r.id,
                            final_messages.to_string(),
                            r.turn_count.to_string(),
                            r.language_mode,
                            r.primary_language,
                            r.secondary_language,
                            r.metadata.to_string(),
                            r.created_at,
                        ]).map_err(|e| AppError::Internal(e.to_string()))?;
                    }
                } else {
                    wtr.write_record(&["messages"]).map_err(|e| AppError::Internal(e.to_string()))?;
                    for r in records {
                        let final_messages = transform_messages_for_bilingual_mode(
                            &r.messages,
                            bilingual_mode,
                            &r.primary_language,
                            &r.secondary_language,
                        );
                        wtr.write_record(&[final_messages.to_string()]).map_err(|e| AppError::Internal(e.to_string()))?;
                    }
                }
                let bytes = wtr.into_inner().map_err(|e| AppError::Internal(e.to_string()))?;
                Ok(String::from_utf8_lossy(&bytes).to_string())
            }
            "txt" => {
                let mut texts = Vec::new();
                for r in records {
                    let final_messages = transform_messages_for_bilingual_mode(
                        &r.messages,
                        bilingual_mode,
                        &r.primary_language,
                        &r.secondary_language,
                    );
                    let primary_info = crate::languages::LanguageRegistry::lookup(&r.primary_language);
                    let secondary_info = crate::languages::LanguageRegistry::lookup(&r.secondary_language);
                    let mut conv = format!(
                        "RECORD ID: {}\nLANGUAGE: {} ({}) -> {} ({}) [Mode: {}]\n----------------------------------------\n",
                        r.id, primary_info.name, primary_info.code, secondary_info.name, secondary_info.code, r.language_mode
                    );
                    if let Some(msgs) = final_messages.as_array() {
                        for m in msgs {
                            let role = m.get("role").and_then(|v| v.as_str()).unwrap_or("unknown");
                            let content = m.get("content").and_then(|v| v.as_str()).unwrap_or("");
                            conv.push_str(&format!("{}: {}\n\n", role.to_uppercase(), content));
                        }
                    }
                    conv.push_str("========================================\n\n");
                    texts.push(conv);
                }
                Ok(texts.concat())
            }
            _ => {
                // Default: JSONL
                let mut lines = Vec::new();
                for r in records {
                    let final_messages = transform_messages_for_bilingual_mode(
                        &r.messages,
                        bilingual_mode,
                        &r.primary_language,
                        &r.secondary_language,
                    );
                    let obj = if include_metadata {
                        let primary_info = crate::languages::LanguageRegistry::lookup(&r.primary_language);
                        let secondary_info = crate::languages::LanguageRegistry::lookup(&r.secondary_language);
                        json!({
                            "schema_version": "2.0",
                            "id": r.id,
                            "type": "sft",
                            "language": {
                                "mode": r.language_mode,
                                "primary": {
                                    "code": primary_info.code,
                                    "name": primary_info.name,
                                    "native_name": primary_info.native_name
                                },
                                "secondary": {
                                    "code": secondary_info.code,
                                    "name": secondary_info.name,
                                    "native_name": secondary_info.native_name
                                }
                            },
                            "messages": final_messages,
                            "turn_count": r.turn_count,
                            "character_count": r.character_count,
                            "metadata": r.metadata,
                            "created_at": r.created_at
                        })
                    } else {
                        json!({
                            "messages": final_messages
                        })
                    };
                    lines.push(serde_json::to_string(&obj)?);
                }
                Ok(lines.join("\n"))
            }
        }
    }

    pub async fn export_dpo(
        pool: &SqlitePool,
        project_id: &str,
        format_type: &str,
        include_metadata: bool,
        only_completed: bool,
        record_ids: Option<Vec<String>>,
    ) -> Result<String, AppError> {
        let tasks = if let Some(ref ids) = record_ids {
            if ids.is_empty() {
                return Err(AppError::Validation("No examples selected. Select records from Mechon Corpus first.".to_string()));
            }
            let mut list = crate::services::dpo_service::DPOService::get_tasks_by_ids(
                pool, project_id, ids,
            ).await?;
            if only_completed {
                list.retain(|t| t.status == "completed" || t.preference.is_some());
            }
            list
        } else {
            let (list, _) = crate::services::dpo_service::DPOService::list(
                pool,
                project_id,
                if only_completed { Some("completed") } else { None },
                None,
                100000,
                0,
            ).await?;
            list
        };

        let items: Vec<Value> = tasks.into_iter().filter_map(|t| {
            let (chosen, rejected, is_definitive) = match t.preference.as_deref() {
                Some("a") => (Some(&t.response_a), Some(&t.response_b), true),
                Some("b") => (Some(&t.response_b), Some(&t.response_a), true),
                Some("tie") => (Some(&t.response_a), Some(&t.response_b), false),
                Some("both_bad") => (None, None, false),
                _ => (None, None, false),
            };

            if only_completed && !is_definitive && t.preference.as_deref() != Some("tie") {
                return None;
            }

            let mut obj = serde_json::Map::new();
            obj.insert("prompt".to_string(), json!(t.prompt));
            if let Some(sys) = t.system_prompt {
                if !sys.is_empty() {
                    obj.insert("system_prompt".to_string(), json!(sys));
                }
            }
            if let Some(c) = chosen {
                obj.insert("chosen".to_string(), json!(c));
            }
            if let Some(r) = rejected {
                obj.insert("rejected".to_string(), json!(r));
            }
            obj.insert("preference".to_string(), json!(t.preference));

            if include_metadata {
                obj.insert("id".to_string(), json!(t.id));
                obj.insert("status".to_string(), json!(t.status));
                obj.insert("rationale".to_string(), json!(t.rationale));
                obj.insert("helpfulness_rating".to_string(), json!(t.helpfulness_rating));
                obj.insert("factuality_rating".to_string(), json!(t.factuality_rating));
                obj.insert("metadata".to_string(), t.metadata);
            }

            Some(Value::Object(obj))
        }).collect();

        match format_type.to_lowercase().as_str() {
            "json" => Ok(serde_json::to_string_pretty(&items)?),
            "csv" => {
                let mut wtr = csv::Writer::from_writer(vec![]);
                wtr.write_record(&["prompt", "chosen", "rejected", "preference"])
                    .map_err(|e| AppError::Internal(e.to_string()))?;
                for it in &items {
                    wtr.write_record(&[
                        it.get("prompt").and_then(|v| v.as_str()).unwrap_or(""),
                        it.get("chosen").and_then(|v| v.as_str()).unwrap_or(""),
                        it.get("rejected").and_then(|v| v.as_str()).unwrap_or(""),
                        it.get("preference").and_then(|v| v.as_str()).unwrap_or(""),
                    ]).map_err(|e| AppError::Internal(e.to_string()))?;
                }
                let bytes = wtr.into_inner().map_err(|e| AppError::Internal(e.to_string()))?;
                Ok(String::from_utf8_lossy(&bytes).to_string())
            }
            "txt" => {
                let mut texts = Vec::new();
                for it in &items {
                    let prompt = it.get("prompt").and_then(|v| v.as_str()).unwrap_or("");
                    let chosen = it.get("chosen").and_then(|v| v.as_str()).unwrap_or("");
                    let rejected = it.get("rejected").and_then(|v| v.as_str()).unwrap_or("");
                    let pref = it.get("preference").and_then(|v| v.as_str()).unwrap_or("");
                    texts.push(format!(
                        "PROMPT:\n{}\n\nCHOSEN [{}]:\n{}\n\nREJECTED:\n{}\n\n========================================\n\n",
                        prompt, pref, chosen, rejected
                    ));
                }
                Ok(texts.concat())
            }
            _ => {
                let lines: Result<Vec<String>, _> = items.into_iter().map(|it| serde_json::to_string(&it)).collect();
                Ok(lines?.join("\n"))
            }
        }
    }

    pub async fn import_content(
        pool: &SqlitePool,
        project_id: &str,
        content: &str,
    ) -> Result<serde_json::Value, AppError> {
        let mut imported_sft = 0;
        let mut imported_dpo = 0;
        let now = Utc::now().to_rfc3339();

        let parse_sft_item = |it: &Value| -> Option<(String, String, String, Value, Value, Value)> {
            let messages = it.get("messages")?;

            // Extract language info
            let (mode, primary, secondary, lang_obj) = if let Some(l_obj) = it.get("language").and_then(|v| v.as_object()) {
                let m = l_obj.get("mode").and_then(|v| v.as_str()).unwrap_or("bilingual").to_string();
                let p = l_obj.get("primary").and_then(|p| p.get("code").or_else(|| p.get("name"))).and_then(|v| v.as_str()).unwrap_or("en").to_string();
                let s = l_obj.get("secondary").and_then(|s| s.get("code").or_else(|| s.get("name"))).and_then(|v| v.as_str()).unwrap_or("id").to_string();
                let canon = crate::languages::LanguageRegistry::build_canonical_language_object(&m, &p, Some(&s));
                (m, p, s, canon)
            } else {
                // Legacy fields
                let p = it.get("primary_language").and_then(|v| v.as_str()).unwrap_or("id").to_string();
                let s = it.get("secondary_language").and_then(|v| v.as_str()).unwrap_or("en").to_string();
                let mut m = it.get("language_mode").and_then(|v| v.as_str()).unwrap_or("monolingual").to_string();

                if m == "monolingual" {
                    if let Some(arr) = messages.as_array() {
                        if arr.iter().any(|msg| msg.get("translations").and_then(|t| t.as_object()).map(|o| !o.is_empty()).unwrap_or(false)) {
                            m = "bilingual".to_string();
                        }
                    }
                }
                let canon = crate::languages::LanguageRegistry::build_canonical_language_object(&m, &p, Some(&s));
                (m, p, s, canon)
            };

            let metadata = it.get("metadata").cloned().unwrap_or(json!({}));
            Some((mode, primary, secondary, lang_obj, messages.clone(), metadata))
        };

        // Check if content is array JSON
        if let Ok(Value::Array(items)) = serde_json::from_str::<Value>(content) {
            for it in items {
                if let Some((mode, p_lang, s_lang, lang_meta, messages, metadata)) = parse_sft_item(&it) {
                    let raw_id = it.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| Uuid::new_v4().to_string());
                    let id = if sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM sft_records WHERE id = ?").bind(&raw_id).fetch_one(pool).await.unwrap_or(0) > 0 {
                        Uuid::new_v4().to_string()
                    } else {
                        raw_id
                    };
                    let turns = messages.as_array().map(|a| a.len() as i64).unwrap_or(0);
                    let char_count = messages.to_string().len() as i64;
                    let lang_meta_str = serde_json::to_string(&lang_meta).unwrap_or_else(|_| "{}".to_string());
                    let meta_str = serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string());

                    sqlx::query(
                        "INSERT INTO sft_records (id, project_id, messages_json, turn_count, character_count, language_mode, primary_language, secondary_language, language_metadata_json, metadata_json, revision, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
                    )
                    .bind(&id)
                    .bind(project_id)
                    .bind(&messages.to_string())
                    .bind(turns)
                    .bind(char_count)
                    .bind(&mode)
                    .bind(&p_lang)
                    .bind(&s_lang)
                    .bind(&lang_meta_str)
                    .bind(&meta_str)
                    .bind(&now)
                    .bind(&now)
                    .execute(pool)
                    .await?;
                    imported_sft += 1;
                } else if let Some(prompt) = it.get("prompt").and_then(|v| v.as_str()) {
                    let resp_a = it.get("chosen").or_else(|| it.get("response_a")).and_then(|v| v.as_str()).unwrap_or("");
                    let resp_b = it.get("rejected").or_else(|| it.get("response_b")).and_then(|v| v.as_str()).unwrap_or("");
                    let pref = it.get("preference").and_then(|v| v.as_str()).unwrap_or("a");
                    let id = it.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| Uuid::new_v4().to_string());
                    sqlx::query(
                        "INSERT INTO dpo_tasks (id, project_id, prompt, response_a, response_b, preference, status, metadata_json, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, 'completed', '{}', ?, ?)"
                    )
                    .bind(&id)
                    .bind(project_id)
                    .bind(prompt)
                    .bind(resp_a)
                    .bind(resp_b)
                    .bind(pref)
                    .bind(&now)
                    .bind(&now)
                    .execute(pool)
                    .await?;
                    imported_dpo += 1;
                }
            }
        } else {
            // Treat as JSONL
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() { continue; }
                if let Ok(it) = serde_json::from_str::<Value>(trimmed) {
                    if let Some((mode, p_lang, s_lang, lang_meta, messages, metadata)) = parse_sft_item(&it) {
                        let raw_id = it.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| Uuid::new_v4().to_string());
                        let id = if sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM sft_records WHERE id = ?").bind(&raw_id).fetch_one(pool).await.unwrap_or(0) > 0 {
                            Uuid::new_v4().to_string()
                        } else {
                            raw_id
                        };
                        let turns = messages.as_array().map(|a| a.len() as i64).unwrap_or(0);
                        let char_count = messages.to_string().len() as i64;
                        let lang_meta_str = serde_json::to_string(&lang_meta).unwrap_or_else(|_| "{}".to_string());
                        let meta_str = serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string());

                        sqlx::query(
                            "INSERT INTO sft_records (id, project_id, messages_json, turn_count, character_count, language_mode, primary_language, secondary_language, language_metadata_json, metadata_json, revision, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
                        )
                        .bind(&id)
                        .bind(project_id)
                        .bind(&messages.to_string())
                        .bind(turns)
                        .bind(char_count)
                        .bind(&mode)
                        .bind(&p_lang)
                        .bind(&s_lang)
                        .bind(&lang_meta_str)
                        .bind(&meta_str)
                        .bind(&now)
                        .bind(&now)
                        .execute(pool)
                        .await?;
                        imported_sft += 1;
                    } else if let Some(prompt) = it.get("prompt").and_then(|v| v.as_str()) {
                        let resp_a = it.get("chosen").or_else(|| it.get("response_a")).and_then(|v| v.as_str()).unwrap_or("");
                        let resp_b = it.get("rejected").or_else(|| it.get("response_b")).and_then(|v| v.as_str()).unwrap_or("");
                        let pref = it.get("preference").and_then(|v| v.as_str()).unwrap_or("a");
                        let id = it.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| Uuid::new_v4().to_string());
                        sqlx::query(
                            "INSERT INTO dpo_tasks (id, project_id, prompt, response_a, response_b, preference, status, metadata_json, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, 'completed', '{}', ?, ?)"
                        )
                        .bind(&id)
                        .bind(project_id)
                        .bind(prompt)
                        .bind(resp_a)
                        .bind(resp_b)
                        .bind(pref)
                        .bind(&now)
                        .bind(&now)
                        .execute(pool)
                        .await?;
                        imported_dpo += 1;
                    }
                }
            }
        }

        Ok(json!({
            "imported_sft_records": imported_sft,
            "imported_dpo_tasks": imported_dpo,
            "total_imported": imported_sft + imported_dpo
        }))
    }

    pub async fn count_sft(
        pool: &SqlitePool,
        project_id: &str,
        record_ids: Option<&[String]>,
    ) -> Result<usize, AppError> {
        if let Some(ids) = record_ids {
            if ids.is_empty() {
                return Ok(0);
            }
            let records = crate::services::dataset_service::DatasetService::get_sft_records_by_ids(
                pool, project_id, ids,
            ).await?;
            Ok(records.len())
        } else {
            let (_, total) = crate::services::dataset_service::DatasetService::list_sft_records(
                pool, project_id, None, None, 1, 0,
            ).await?;
            Ok(total as usize)
        }
    }

    pub async fn count_dpo(
        pool: &SqlitePool,
        project_id: &str,
        only_completed: bool,
        record_ids: Option<&[String]>,
    ) -> Result<usize, AppError> {
        if let Some(ids) = record_ids {
            if ids.is_empty() {
                return Ok(0);
            }
            let mut tasks = crate::services::dpo_service::DPOService::get_tasks_by_ids(
                pool, project_id, ids,
            ).await?;
            if only_completed {
                tasks.retain(|t| t.status == "completed" || t.preference.is_some());
            }
            Ok(tasks.len())
        } else {
            let (tasks, _) = crate::services::dpo_service::DPOService::list(
                pool,
                project_id,
                if only_completed { Some("completed") } else { None },
                None,
                100000,
                0,
            ).await?;
            Ok(tasks.len())
        }
    }
}
