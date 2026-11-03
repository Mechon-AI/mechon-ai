use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use serde_json::Value;
use std::sync::Arc;
use mechon_ai::credentials::InMemoryCredentialStore;
use mechon_ai::languages::LanguageRegistry;
use mechon_ai::models::{
    ProjectCreateInput, SFTCommitInput, SFTMessageCreateInput,
    SFTSessionCreateInput,
};
use mechon_ai::services::dataset_service::DatasetService;
use mechon_ai::services::export_service::ExportService;
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::services::sft_service::SFTService;
use mechon_ai::services::translation_service::TranslationService;

async fn setup_multilingual_test_db() -> SqlitePool {
    let options = SqliteConnectOptions::new()
        .filename(":memory:")
        .foreign_keys(true);

    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .expect("Failed to connect to in-memory SQLite");

    let schema_sql = include_str!("../migrations/20261102000000_init_schema.sql");
    sqlx::raw_sql(schema_sql).execute(&pool).await.unwrap();

    // Insert mock provider for simulated translation
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
         VALUES ('mock', 'Mock Provider', 'mock', 'http://127.0.0.1:0', NULL, 'mock-llama-3-8b', '[\"mock-llama-3-8b\"]', 30, 1, '{}', ?, ?)"
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    pool
}

#[tokio::test]
async fn test_multilingual_language_registry_and_rtl() {
    // 14. RTL rendering metadata
    assert!(LanguageRegistry::is_rtl("ar"));
    assert!(LanguageRegistry::is_rtl("he"));
    assert!(LanguageRegistry::is_rtl("fa"));
    assert!(LanguageRegistry::is_rtl("ur"));
    assert!(!LanguageRegistry::is_rtl("en"));
    assert!(!LanguageRegistry::is_rtl("ja"));
    assert!(!LanguageRegistry::is_rtl("id"));
    assert!(!LanguageRegistry::is_rtl("de"));

    // BCP-47 validation
    assert!(LanguageRegistry::validate_bcp47("en"));
    assert!(LanguageRegistry::validate_bcp47("zh-Hans"));
    assert!(LanguageRegistry::validate_bcp47("pt-BR"));
    assert!(LanguageRegistry::validate_bcp47("ar-EG"));
    assert!(!LanguageRegistry::validate_bcp47(""));
    assert!(!LanguageRegistry::validate_bcp47("a"));
    assert!(!LanguageRegistry::validate_bcp47("1234"));

    // Lookup metadata
    let ar = LanguageRegistry::lookup("ar");
    assert_eq!(ar.name, "Arabic");
    assert!(ar.rtl);

    let ja = LanguageRegistry::lookup("ja");
    assert_eq!(ja.name, "Japanese");
    assert!(!ja.rtl);

    let pt_br = LanguageRegistry::lookup("pt-BR");
    assert_eq!(pt_br.code, "pt-BR");
}

#[tokio::test]
async fn test_multilingual_pipeline_all_pairs() {
    let pool = setup_multilingual_test_db().await;
    let vault = Arc::new(InMemoryCredentialStore::new());

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Multilingual Matrix Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // 1. Indonesian -> English (id -> en)
    let s_id_en = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("ID to EN Dialogue".to_string()),
        system_prompt: Some("Assistant".to_string()),
        provider_id: Some("mock".to_string()),
        model: Some("mock-llama-3-8b".to_string()),
        temperature: None,
        top_p: None,
        max_tokens: None,
        language_mode: Some("monolingual".to_string()),
        primary_language: Some("id".to_string()),
        secondary_language: Some("en".to_string()),
        language_metadata: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &s_id_en.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Halo, apa kabar?".to_string(),
        model: None,
    }).await.unwrap();

    let trans_id_en = TranslationService::translate_session(&pool, vault.as_ref(), &s_id_en.id, "en", None, None).await.unwrap();
    assert_eq!(trans_id_en.primary_language, "id");
    assert_eq!(trans_id_en.secondary_language, "en");
    assert_eq!(trans_id_en.language_mode, "bilingual");

    // 2. Japanese -> Arabic (ja -> ar) [RTL test]
    let s_ja_ar = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("JA to AR Dialogue".to_string()),
        system_prompt: Some("Assistant".to_string()),
        provider_id: Some("mock".to_string()),
        model: Some("mock-llama-3-8b".to_string()),
        temperature: None,
        top_p: None,
        max_tokens: None,
        language_mode: Some("monolingual".to_string()),
        primary_language: Some("ja".to_string()),
        secondary_language: Some("ar".to_string()),
        language_metadata: None,
    }).await.unwrap();

    let msg_ja = SFTService::add_message(&pool, &s_ja_ar.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "量子コンピュータとは何ですか？".to_string(),
        model: None,
    }).await.unwrap();

    let trans_ja_ar = TranslationService::translate_session(&pool, vault.as_ref(), &s_ja_ar.id, "ar", None, None).await.unwrap();
    assert_eq!(trans_ja_ar.primary_language, "ja");
    assert_eq!(trans_ja_ar.secondary_language, "ar");
    assert_eq!(trans_ja_ar.language_mode, "bilingual");

    // 8. Turn-level translation edit
    TranslationService::update_message_translation(
        &pool,
        &msg_ja.id,
        "ar",
        "ما هو الحاسوب الكمي؟",
        "approved",
    ).await.unwrap();

    let updated_ja_session = SFTService::get_session(&pool, &s_ja_ar.id).await.unwrap();
    let updated_msg = &updated_ja_session.messages[0];
    assert_eq!(updated_msg.translations.get("ar").and_then(|v| v.as_str()), Some("ما هو الحاسوب الكمي؟"));
    assert_eq!(updated_msg.translation_status.get("ar").and_then(|v| v.as_str()), Some("approved"));

    // 6. Multiple secondary translations: translate to English as well (ja -> ar + en)
    TranslationService::update_message_translation(
        &pool,
        &msg_ja.id,
        "en",
        "What is a quantum computer?",
        "approved",
    ).await.unwrap();

    let multi_session = SFTService::get_session(&pool, &s_ja_ar.id).await.unwrap();
    let multi_msg = &multi_session.messages[0];
    assert_eq!(multi_msg.translations.get("ar").and_then(|v| v.as_str()), Some("ما هو الحاسوب الكمي؟"));
    assert_eq!(multi_msg.translations.get("en").and_then(|v| v.as_str()), Some("What is a quantum computer?"));

    // 3. German -> French (de -> fr)
    let s_de_fr = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("DE to FR Dialogue".to_string()),
        system_prompt: Some("Assistant".to_string()),
        provider_id: Some("mock".to_string()),
        model: Some("mock-llama-3-8b".to_string()),
        temperature: None,
        top_p: None,
        max_tokens: None,
        language_mode: Some("monolingual".to_string()),
        primary_language: Some("de".to_string()),
        secondary_language: Some("fr".to_string()),
        language_metadata: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &s_de_fr.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Guten Tag, wie geht es Ihnen?".to_string(),
        model: None,
    }).await.unwrap();

    TranslationService::translate_session(&pool, vault.as_ref(), &s_de_fr.id, "fr", None, None).await.unwrap();

    // 4. English -> Korean (en -> ko)
    let s_en_ko = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("EN to KO Dialogue".to_string()),
        system_prompt: Some("Assistant".to_string()),
        provider_id: Some("mock".to_string()),
        model: Some("mock-llama-3-8b".to_string()),
        temperature: None,
        top_p: None,
        max_tokens: None,
        language_mode: Some("monolingual".to_string()),
        primary_language: Some("en".to_string()),
        secondary_language: Some("ko".to_string()),
        language_metadata: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &s_en_ko.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "How do I optimize SQL queries?".to_string(),
        model: None,
    }).await.unwrap();

    TranslationService::translate_session(&pool, vault.as_ref(), &s_en_ko.id, "ko", None, None).await.unwrap();

    // 5. Brazilian Portuguese -> Japanese (pt-BR -> ja)
    let s_pt_ja = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("PT-BR to JA Dialogue".to_string()),
        system_prompt: Some("Assistant".to_string()),
        provider_id: Some("mock".to_string()),
        model: Some("mock-llama-3-8b".to_string()),
        temperature: None,
        top_p: None,
        max_tokens: None,
        language_mode: Some("monolingual".to_string()),
        primary_language: Some("pt-BR".to_string()),
        secondary_language: Some("ja".to_string()),
        language_metadata: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &s_pt_ja.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Olá! Como você está hoje?".to_string(),
        model: None,
    }).await.unwrap();

    TranslationService::translate_session(&pool, vault.as_ref(), &s_pt_ja.id, "ja", None, None).await.unwrap();

    // 7. Commit all sessions into dataset records
    let r_id_en = SFTService::commit_session(&pool, &s_id_en.id, SFTCommitInput::default()).await.unwrap();
    let r_ja_ar = SFTService::commit_session(&pool, &s_ja_ar.id, SFTCommitInput::default()).await.unwrap();
    let r_de_fr = SFTService::commit_session(&pool, &s_de_fr.id, SFTCommitInput::default()).await.unwrap();
    let r_en_ko = SFTService::commit_session(&pool, &s_en_ko.id, SFTCommitInput::default()).await.unwrap();
    let r_pt_ja = SFTService::commit_session(&pool, &s_pt_ja.id, SFTCommitInput::default()).await.unwrap();

    assert_eq!(r_id_en.primary_language, "id");
    assert_eq!(r_id_en.secondary_language, "en");

    assert_eq!(r_ja_ar.primary_language, "ja");
    assert_eq!(r_ja_ar.secondary_language, "ar");

    assert_eq!(r_de_fr.primary_language, "de");
    assert_eq!(r_de_fr.secondary_language, "fr");

    assert_eq!(r_en_ko.primary_language, "en");
    assert_eq!(r_en_ko.secondary_language, "ko");

    assert_eq!(r_pt_ja.primary_language, "pt-BR");
    assert_eq!(r_pt_ja.secondary_language, "ja");

    // 9. Dynamic Corpus filters
    let corpus_languages = DatasetService::get_corpus_languages(&pool, &project.id).await.unwrap();
    let pairs = corpus_languages.get("language_pairs").unwrap().as_array().unwrap();
    assert_eq!(pairs.len(), 5);

    let prim_langs = corpus_languages.get("primary_languages").unwrap().as_array().unwrap();
    assert_eq!(prim_langs.len(), 5);

    // 10. Selected-record export (only JA -> AR)
    let selected_json = ExportService::export_sft(
        &pool,
        &project.id,
        "json",
        true,
        Some(vec![r_ja_ar.id.clone()]),
        Some("canonical_aligned"),
    ).await.unwrap();

    let parsed_sel: Value = serde_json::from_str(&selected_json).unwrap();
    assert_eq!(parsed_sel.as_array().unwrap().len(), 1);
    let ja_record = &parsed_sel[0];
    assert_eq!(ja_record["schema_version"], "2.0");
    assert_eq!(ja_record["language"]["primary"]["code"], "ja");
    assert_eq!(ja_record["language"]["primary"]["name"], "Japanese");
    assert_eq!(ja_record["language"]["secondary"]["code"], "ar");
    assert_eq!(ja_record["language"]["secondary"]["name"], "Arabic");

    // 11. Entire-corpus export (all 5 diverse language records)
    let full_json = ExportService::export_sft(
        &pool,
        &project.id,
        "json",
        true,
        None,
        Some("canonical_aligned"),
    ).await.unwrap();

    let parsed_full: Value = serde_json::from_str(&full_json).unwrap();
    assert_eq!(parsed_full.as_array().unwrap().len(), 5);

    // 12. JSON and JSONL round-trip with Canonical Schema v2.0
    let full_jsonl = ExportService::export_sft(
        &pool,
        &project.id,
        "jsonl",
        true,
        None,
        Some("canonical_aligned"),
    ).await.unwrap();

    // Import into a new project
    let import_project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Import Destination Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    let import_res = ExportService::import_content(&pool, &import_project.id, &full_jsonl).await.unwrap();
    assert_eq!(import_res["imported_sft_records"], 5);

    let (imported_records, count) = DatasetService::list_sft_records(&pool, &import_project.id, None, None, 10, 0).await.unwrap();
    assert_eq!(count, 5);

    // Verify imported languages preserved exact dynamic codes
    let mut imported_pairs = Vec::new();
    for rec in &imported_records {
        imported_pairs.push(format!("{}->{}", rec.primary_language, rec.secondary_language));
    }
    assert!(imported_pairs.contains(&"ja->ar".to_string()));
    assert!(imported_pairs.contains(&"de->fr".to_string()));
    assert!(imported_pairs.contains(&"en->ko".to_string()));
    assert!(imported_pairs.contains(&"pt-BR->ja".to_string()));
    assert!(imported_pairs.contains(&"id->en".to_string()));

    // 15. CSV and TXT language metadata preservation
    let csv_export = ExportService::export_sft(
        &pool,
        &project.id,
        "csv",
        true,
        Some(vec![r_ja_ar.id.clone()]),
        Some("canonical_aligned"),
    ).await.unwrap();
    assert!(csv_export.contains("primary_language,secondary_language"));
    assert!(csv_export.contains("ja,ar"));

    let txt_export = ExportService::export_sft(
        &pool,
        &project.id,
        "txt",
        true,
        Some(vec![r_ja_ar.id.clone()]),
        Some("canonical_aligned"),
    ).await.unwrap();
    assert!(txt_export.contains("LANGUAGE: Japanese (ja) -> Arabic (ar)"));

    // 13. Legacy schema migration
    let legacy_json = r#"[
        {
            "id": "legacy-record-1",
            "primary_language": "id",
            "secondary_language": "en",
            "language_mode": "bilingual",
            "messages": [
                {
                    "role": "user",
                    "content": "Halo dunia",
                    "translations": { "en": "Hello world" }
                }
            ]
        }
    ]"#;

    let legacy_import = ExportService::import_content(&pool, &import_project.id, legacy_json).await.unwrap();
    assert_eq!(legacy_import["imported_sft_records"], 1);

    let legacy_rec = DatasetService::get_sft_record(&pool, "legacy-record-1").await.unwrap();
    assert_eq!(legacy_rec.primary_language, "id");
    assert_eq!(legacy_rec.secondary_language, "en");
    assert_eq!(legacy_rec.language_mode, "bilingual");
    assert_eq!(legacy_rec.language_metadata["primary"]["code"], "id");
    assert_eq!(legacy_rec.language_metadata["secondary"]["code"], "en");

    // 16. Verify corpus languages aggregation structure
    let corpus_stats = DatasetService::get_corpus_languages(&pool, &project.id).await.unwrap();
    assert!(corpus_stats["language_pairs"].is_array());
    let pair_array = corpus_stats["language_pairs"].as_array().unwrap();
    assert!(!pair_array.is_empty());
    assert!(pair_array.iter().any(|p| p["pair"] == "ja->ar"));
    assert!(pair_array.iter().any(|p| p["pair"] == "id->en"));
    assert!(pair_array.iter().all(|p| p["label"].is_string()));
}
