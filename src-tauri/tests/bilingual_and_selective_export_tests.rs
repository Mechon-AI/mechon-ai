use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use serde_json::Value;
use std::sync::Arc;
use mechon_ai::credentials::{CredentialStore, InMemoryCredentialStore};
use mechon_ai::models::{
    DPOAnnotationInput, DPOTaskCreateInput, ProjectCreateInput, SFTCommitInput,
    SFTMessageCreateInput, SFTSessionCreateInput,
};
use mechon_ai::services::dpo_service::DPOService;
use mechon_ai::services::export_service::ExportService;
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::services::sft_service::SFTService;
use mechon_ai::services::translation_service::TranslationService;

async fn setup_test_db() -> SqlitePool {
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

    // Ensure mock provider exists for testing
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
async fn test_selective_sft_and_dpo_export() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Selective Export Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // Create 3 SFT sessions and commit each into a record
    let mut sft_record_ids = Vec::new();
    for i in 1..=3 {
        let session = SFTService::create_session(&pool, SFTSessionCreateInput {
            project_id: project.id.clone(),
            title: Some(format!("Dialogue {}", i)),
            system_prompt: Some("Assistant".to_string()),
            provider_id: Some("mock".to_string()),
            model: Some("mock-llama-3-8b".to_string()),
            temperature: Some(0.7),
            top_p: Some(0.9),
            max_tokens: Some(1024),
            language_mode: None,
            primary_language: None,
            secondary_language: None,
            language_metadata: None,
        }).await.unwrap();

        SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
            role: "user".to_string(),
            content: format!("Question from dialogue {}", i),
            model: None,
        }).await.unwrap();

        SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
            role: "assistant".to_string(),
            content: format!("Answer for dialogue {}", i),
            model: Some("mock-llama-3-8b".to_string()),
        }).await.unwrap();

        let record = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
            title_override: None,
            tags: Some(vec![format!("tag-{}", i)]),
            metadata: None,
            language_mode: None,
            primary_language: None,
            secondary_language: None,
            language_metadata: None,
            ..Default::default()
        }).await.unwrap();

        sft_record_ids.push(record.id);
    }

    assert_eq!(sft_record_ids.len(), 3);

    // 1. Export only Record 1 and Record 3 (exclude Record 2)
    let selected_ids = vec![sft_record_ids[0].clone(), sft_record_ids[2].clone()];
    let count = ExportService::count_sft(&pool, &project.id, Some(&selected_ids)).await.unwrap();
    assert_eq!(count, 2);

    let export_json = ExportService::export_sft(&pool, &project.id, "json", true, Some(selected_ids.clone()), None).await.unwrap();
    let json_items: Vec<Value> = serde_json::from_str(&export_json).unwrap();
    assert_eq!(json_items.len(), 2);
    assert!(export_json.contains("Question from dialogue 1"));
    assert!(export_json.contains("Question from dialogue 3"));
    assert!(!export_json.contains("Question from dialogue 2"));

    // 2. Export only Record 2
    let single_id = vec![sft_record_ids[1].clone()];
    let export_jsonl = ExportService::export_sft(&pool, &project.id, "jsonl", true, Some(single_id), None).await.unwrap();
    let lines: Vec<&str> = export_jsonl.lines().filter(|l| !l.trim().is_empty()).collect();
    assert_eq!(lines.len(), 1);
    assert!(export_jsonl.contains("Question from dialogue 2"));
    assert!(!export_jsonl.contains("Question from dialogue 1"));
    assert!(!export_jsonl.contains("Question from dialogue 3"));

    // 3. Selective export with empty list must reject with clear validation error
    let empty_selection: Vec<String> = vec![];
    let empty_err = ExportService::export_sft(&pool, &project.id, "jsonl", true, Some(empty_selection), None).await;
    assert!(empty_err.is_err(), "Empty selective export must return validation error");

    // 4. Selective DPO export
    let mut dpo_ids = Vec::new();
    for i in 1..=3 {
        let task = DPOService::create(&pool, DPOTaskCreateInput {
            project_id: project.id.clone(),
            prompt: format!("Prompt for DPO task {}", i),
            system_prompt: None,
            response_a: Some(format!("Good response {}", i)),
            response_b: Some(format!("Bad response {}", i)),
            metadata: None,
        }).await.unwrap();

        DPOService::annotate(&pool, &task.id, DPOAnnotationInput {
            preference: "a".to_string(),
            rationale: Some(format!("Rationale {}", i)),
            helpfulness_rating: Some(5),
            factuality_rating: Some(5),
            metadata: None,
        }).await.unwrap();

        dpo_ids.push(task.id);
    }

    // Export only task 2
    let selected_dpo = vec![dpo_ids[1].clone()];
    let dpo_count = ExportService::count_dpo(&pool, &project.id, true, Some(&selected_dpo)).await.unwrap();
    assert_eq!(dpo_count, 1);

    let dpo_export = ExportService::export_dpo(&pool, &project.id, "jsonl", false, true, Some(selected_dpo)).await.unwrap();
    let dpo_lines: Vec<&str> = dpo_export.lines().filter(|l| !l.trim().is_empty()).collect();
    assert_eq!(dpo_lines.len(), 1);
    assert!(dpo_export.contains("Prompt for DPO task 2"));
    assert!(!dpo_export.contains("Prompt for DPO task 1"));
    assert!(!dpo_export.contains("Prompt for DPO task 3"));
}

#[tokio::test]
async fn test_bilingual_sft_workflow_and_commit() {
    let pool = setup_test_db().await;
    let vault: Arc<dyn CredentialStore> = Arc::new(InMemoryCredentialStore::new());

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Bilingual Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // 1. Create SFT session in bilingual mode (id -> en)
    let session = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Bilingual Customer Support".to_string()),
        system_prompt: Some("Anda adalah asisten AI yang ramah dan membantu.".to_string()),
        provider_id: Some("mock".to_string()),
        model: Some("mock-llama-3-8b".to_string()),
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(1024),
        language_mode: Some("bilingual".to_string()),
        primary_language: Some("id".to_string()),
        secondary_language: Some("en".to_string()),
        language_metadata: None,
    }).await.unwrap();

    assert_eq!(session.language_mode, "bilingual");
    assert_eq!(session.primary_language, "id");
    assert_eq!(session.secondary_language, "en");

    // 2. Add Indonesian turns
    let msg1 = SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Halo, bisakah Anda membantu saya memeriksa pesanan saya?".to_string(),
        model: None,
    }).await.unwrap();

    let msg2 = SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "Tentu saja! Mohon berikan nomor pesanan Anda agar saya dapat melacaknya.".to_string(),
        model: Some("mock-llama-3-8b".to_string()),
    }).await.unwrap();

    // 3. Translate entire session via TranslationService
    let translated_session = TranslationService::translate_session(
        &pool,
        vault.as_ref(),
        &session.id,
        "en",
        Some("mock"),
        Some("mock-llama-3-8b"),
    ).await.unwrap();

    assert_eq!(translated_session.messages.len(), 2);
    for msg in &translated_session.messages {
        assert!(msg.translations.get("en").is_some(), "Message must contain 'en' translation");
        assert_eq!(msg.translation_status.get("en").and_then(|v| v.as_str()), Some("generated"));
    }

    // 4. Edit turn 1 translation and approve it
    TranslationService::update_message_translation(
        &pool,
        &msg1.id,
        "en",
        "Hello, could you help me check my order?",
        "approved",
    ).await.unwrap();

    // 5. Regenerate turn 2 translation
    let regen_msg2 = TranslationService::translate_single_message(
        &pool,
        vault.as_ref(),
        &session.id,
        &msg2.id,
        "en",
        Some("mock"),
        Some("mock-llama-3-8b"),
    ).await.unwrap();

    assert!(regen_msg2.translations.get("en").is_some());
    // Then approve turn 2
    TranslationService::update_message_translation(
        &pool,
        &msg2.id,
        "en",
        "Certainly! Please provide your order number so I can track it.",
        "approved",
    ).await.unwrap();

    // 6. Commit bilingual conversation to Corpus
    // CRITICAL: Must produce exactly ONE bilingual record
    let record = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
        title_override: Some("Bilingual Order Tracking".to_string()),
        tags: Some(vec!["customer-support".to_string(), "id-en".to_string()]),
        metadata: None,
        language_mode: Some("bilingual".to_string()),
        primary_language: Some("id".to_string()),
        secondary_language: Some("en".to_string()),
        language_metadata: None,
        ..Default::default()
    }).await.unwrap();

    assert_eq!(record.language_mode, "bilingual");
    assert_eq!(record.primary_language, "id");
    assert_eq!(record.secondary_language, "en");
    assert_eq!(record.turn_count, 2);

    let msgs = record.messages.as_array().expect("Messages must be array");
    // Turn 1 user message
    let turn1 = &msgs[1];
    assert_eq!(turn1["role"], "user");
    assert_eq!(turn1["content"], "Halo, bisakah Anda membantu saya memeriksa pesanan saya?");
    assert_eq!(turn1["translations"]["en"], "Hello, could you help me check my order?");
    assert_eq!(turn1["translation_status"]["en"], "approved");

    // Turn 2 assistant message
    let turn2 = &msgs[2];
    assert_eq!(turn2["role"], "assistant");
    assert_eq!(turn2["content"], "Tentu saja! Mohon berikan nomor pesanan Anda agar saya dapat melacaknya.");
    assert_eq!(turn2["translations"]["en"], "Certainly! Please provide your order number so I can track it.");
    assert_eq!(turn2["translation_status"]["en"], "approved");

    // 7. Verify all 3 Bilingual Export modes:
    // A. canonical_aligned
    let export_aligned = ExportService::export_sft(
        &pool, &project.id, "jsonl", false, Some(vec![record.id.clone()]), Some("canonical_aligned"),
    ).await.unwrap();
    assert!(export_aligned.contains("translations"));
    assert!(export_aligned.contains("Hello, could you help me check my order?"));
    assert!(export_aligned.contains("Halo, bisakah Anda membantu saya"));

    // B. primary_only
    let export_primary = ExportService::export_sft(
        &pool, &project.id, "jsonl", false, Some(vec![record.id.clone()]), Some("primary_only"),
    ).await.unwrap();
    assert!(export_primary.contains("Halo, bisakah Anda membantu saya memeriksa pesanan saya?"));
    assert!(!export_primary.contains("Hello, could you help me check my order?"));

    // C. secondary_only
    let export_secondary = ExportService::export_sft(
        &pool, &project.id, "jsonl", false, Some(vec![record.id.clone()]), Some("secondary_only"),
    ).await.unwrap();
    assert!(export_secondary.contains("Hello, could you help me check my order?"));
    assert!(export_secondary.contains("Certainly! Please provide your order number so I can track it."));
    assert!(!export_secondary.contains("Halo, bisakah Anda membantu saya memeriksa pesanan saya?"));
}
