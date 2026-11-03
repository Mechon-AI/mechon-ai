use sqlx::SqlitePool;
use uuid::Uuid;
use serde_json::json;
use mechon_ai::credentials::InMemoryCredentialStore;
use mechon_ai::models::{
    ProjectCreateInput, SFTSessionCreateInput, SFTMessageCreateInput,
    SFTCommitInput, SFTMessage
};
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::services::sft_service::SFTService;
use mechon_ai::services::translation_service::TranslationService;
use mechon_ai::services::version_service::VersionService;
use mechon_ai::services::dataset_service::DatasetService;

async fn setup_test_db() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    sqlx::query(include_str!("../migrations/20261102000000_init_schema.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(include_str!("../migrations/20261103000000_engineering_expansion.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(include_str!("../migrations/20261103100000_story_architect.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(include_str!("../migrations/20261103200000_story_architect_revisions.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(include_str!("../migrations/20261103210000_tri_agent_model_selector.sql"))
        .execute(&pool)
        .await
        .unwrap();

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
async fn test_load_corpus_record_into_editor_and_commit_updates() {
    let pool = setup_test_db().await;
    let vault = InMemoryCredentialStore::new();

    // 1. Create a project
    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Corpus Editor Test Project".to_string(),
        description: Some("Testing Universal Corpus Editor".to_string()),
        settings: None,
    }).await.unwrap();

    // 2. Create initial conversation session and commit to Corpus
    let session = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Original Multilingual Conversation".to_string()),
        system_prompt: Some("You are an expert polyglot assistant.".to_string()),
        language_mode: Some("monolingual".to_string()),
        primary_language: Some("en".to_string()),
        ..Default::default()
    }).await.unwrap();

    let msg1 = SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "What is quantum computing?".to_string(),
        model: None,
    }).await.unwrap();

    let msg2 = SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "Quantum computing harnesses quantum mechanics to solve complex problems.".to_string(),
        model: Some("mock-model".to_string()),
    }).await.unwrap();

    let original_record = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
        title_override: Some("Quantum Computing Dialogue".to_string()),
        tags: Some(vec!["physics".to_string(), "quantum".to_string()]),
        primary_language: Some("en".to_string()),
        language_mode: Some("monolingual".to_string()),
        ..Default::default()
    }).await.unwrap();

    assert_eq!(original_record.revision, 1);
    assert_eq!(original_record.turn_count, 2);

    // 3. Load from Corpus into Editor (linked to original record)
    let loaded_session = SFTService::load_corpus_record_into_session(&pool, &original_record.id, false).await.unwrap();
    assert_eq!(loaded_session.committed_record_id, Some(original_record.id.clone()));
    assert_eq!(loaded_session.system_prompt, "You are an expert polyglot assistant.");
    assert_eq!(loaded_session.messages.len(), 2);
    assert_eq!(loaded_session.messages[0].content, "What is quantum computing?");

    // 4. Edit a message and add a third turn
    SFTService::update_message(&pool, &loaded_session.messages[0].id, "Explain quantum computing simply.").await.unwrap();
    let msg3 = SFTService::add_message(&pool, &loaded_session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "How does superposition work?".to_string(),
        model: None,
    }).await.unwrap();

    // 5. Test turn reordering
    let reordered = SFTService::reorder_messages(
        &pool,
        &loaded_session.id,
        vec![msg3.id.clone(), loaded_session.messages[0].id.clone(), loaded_session.messages[1].id.clone()],
    ).await.unwrap();
    assert_eq!(reordered[0].id, msg3.id);
    assert_eq!(reordered[0].sequence_order, 0);
    assert_eq!(reordered[1].id, loaded_session.messages[0].id);
    assert_eq!(reordered[1].sequence_order, 1);

    // Restore original sensible order
    let reordered_back = SFTService::reorder_messages(
        &pool,
        &loaded_session.id,
        vec![loaded_session.messages[0].id.clone(), loaded_session.messages[1].id.clone(), msg3.id.clone()],
    ).await.unwrap();
    assert_eq!(reordered_back[0].id, loaded_session.messages[0].id);

    // 6. Save changes back to Corpus (overwrites existing record, bumps revision)
    let updated_record = SFTService::commit_session(&pool, &loaded_session.id, SFTCommitInput {
        title_override: Some("Quantum Computing Dialogue - Revised".to_string()),
        tags: Some(vec!["physics".to_string(), "quantum".to_string(), "updated".to_string()]),
        create_version_snapshot: Some(true),
        version_tag: Some("v1.1.0".to_string()),
        version_description: Some("Added superposition query".to_string()),
        ..Default::default()
    }).await.unwrap();

    assert_eq!(updated_record.id, original_record.id);
    assert_eq!(updated_record.revision, 2);
    assert_eq!(updated_record.turn_count, 3);

    // Verify snapshot was created in dataset_versions
    let versions = VersionService::list(&pool, &project.id, Some("sft")).await.unwrap();
    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0].version_tag, "v1.1.0");

    // 7. Test Save As New Record
    let saved_as_new_record = SFTService::commit_session(&pool, &loaded_session.id, SFTCommitInput {
        title_override: Some("Quantum Computing Branch".to_string()),
        save_as_new: Some(true),
        ..Default::default()
    }).await.unwrap();

    assert_ne!(saved_as_new_record.id, original_record.id);
    assert_eq!(saved_as_new_record.revision, 1);
    assert_eq!(saved_as_new_record.turn_count, 3);
}

#[tokio::test]
async fn test_dynamic_multilingual_translations_and_approval_workflow() {
    let pool = setup_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Multilingual Corpus Project".to_string(),
        description: Some("Testing dynamic multilingual translations".to_string()),
        settings: None,
    }).await.unwrap();

    // Create session in Indonesian (id)
    let session = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Percakapan Sains".to_string()),
        system_prompt: Some("Kamu adalah asisten sains yang ramah.".to_string()),
        language_mode: Some("multilingual".to_string()),
        primary_language: Some("id".to_string()),
        secondary_language: Some("ja".to_string()),
        ..Default::default()
    }).await.unwrap();

    let msg1 = SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Halo, apa kabar?".to_string(),
        model: None,
    }).await.unwrap();

    let msg2 = SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "Kabar baik! Ada yang bisa saya bantu hari ini?".to_string(),
        model: Some("mock-model".to_string()),
    }).await.unwrap();

    // Mock translate to Japanese (ja)
    let translated_session = TranslationService::translate_session(
        &pool,
        &vault,
        &session.id,
        "ja",
        Some("mock"),
        Some("mock-model"),
    ).await.unwrap();

    assert_eq!(translated_session.messages.len(), 2);
    for m in &translated_session.messages {
        let trans = m.translations.as_object().unwrap();
        assert!(trans.contains_key("ja"), "Expected translations to contain 'ja'");
        let status = m.translation_status.as_object().unwrap();
        assert_eq!(status.get("ja").and_then(|s| s.as_str()), Some("generated"));
    }

    // Bulk approve all Japanese translations
    let approved_session = TranslationService::approve_all_translations(&pool, &session.id, "ja").await.unwrap();
    for m in &approved_session.messages {
        let status = m.translation_status.as_object().unwrap();
        assert_eq!(status.get("ja").and_then(|s| s.as_str()), Some("approved"));
    }

    // Translate to German (de) as additional language
    let de_session = TranslationService::translate_session(
        &pool,
        &vault,
        &session.id,
        "de",
        Some("mock"),
        Some("mock-model"),
    ).await.unwrap();

    let m1 = &de_session.messages[0];
    let trans1 = m1.translations.as_object().unwrap();
    assert!(trans1.contains_key("ja"));
    assert!(trans1.contains_key("de"));

    // Remove German translation from message 1
    let removed_msg = SFTService::remove_message_translation(&pool, &m1.id, "de").await.unwrap();
    let trans_removed = removed_msg.translations.as_object().unwrap();
    assert!(!trans_removed.contains_key("de"));
    assert!(trans_removed.contains_key("ja"));

    // Commit multilingual record to Corpus
    let record = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
        title_override: Some("Percakapan Sains ID-JA-DE".to_string()),
        language_mode: Some("multilingual".to_string()),
        primary_language: Some("id".to_string()),
        secondary_language: Some("ja".to_string()),
        ..Default::default()
    }).await.unwrap();

    assert_eq!(record.turn_count, 2);
    let msgs_json = record.messages.as_array().unwrap();
    assert_eq!(msgs_json.len(), 3); // 1 system + 2 turns
    let turn1 = &msgs_json[1];
    assert!(turn1.get("translations").is_some());
}
