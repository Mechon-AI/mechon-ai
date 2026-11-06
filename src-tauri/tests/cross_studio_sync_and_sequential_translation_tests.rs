use sqlx::SqlitePool;
use mechon_ai::credentials::InMemoryCredentialStore;
use mechon_ai::models::{
    ProjectCreateInput, ProviderCreateInput, SFTCommitInput, SFTMessageCreateInput, SFTSessionCreateInput,
};
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::services::provider_service::ProviderService;
use mechon_ai::services::sft_service::SFTService;
use mechon_ai::services::translation_service::TranslationService;
use mechon_ai::services::translation_parser::clean_translation_output;
use mechon_ai::services::dataset_service::DatasetService;

async fn setup_test_db() -> SqlitePool {
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .connect("sqlite::memory:")
        .await
        .unwrap();

    let schema_sql = include_str!("../migrations/20261102000000_init_schema.sql");
    sqlx::raw_sql(schema_sql).execute(&pool).await.unwrap();

    let eng_schema_sql = include_str!("../migrations/20261103000000_engineering_expansion.sql");
    sqlx::raw_sql(eng_schema_sql).execute(&pool).await.unwrap();

    let story_schema_sql = include_str!("../migrations/20261103100000_story_architect.sql");
    sqlx::raw_sql(story_schema_sql).execute(&pool).await.unwrap();

    let mobile_schema_sql = include_str!("../migrations/20261104000000_mobile_companion.sql");
    sqlx::raw_sql(mobile_schema_sql).execute(&pool).await.unwrap();

    pool
}

#[tokio::test]
async fn test_sequential_translation_parser_robustness() {
    // 1. Valid JSON object
    let json_resp = r#"{"translation": "Halo dunia, apa kabar?"}"#;
    assert_eq!(clean_translation_output(json_resp), "Halo dunia, apa kabar?");

    // 2. JSON wrapped in markdown code fences
    let fenced_json = "```json\n{\n  \"translation\": \"Halo dari markdown block\"\n}\n```";
    assert_eq!(clean_translation_output(fenced_json), "Halo dari markdown block");

    // 3. Plain text with conversational prefix
    let prefixed = "Here is the translation: Selamat pagi rekan semua.";
    assert_eq!(clean_translation_output(prefixed), "Selamat pagi rekan semua.");

    // 4. Quoted text
    let quoted = "\"Teks terjemahan dalam tanda kutip\"";
    assert_eq!(clean_translation_output(quoted), "Teks terjemahan dalam tanda kutip");

    // 5. Raw text without JSON
    let raw = "Halo ini terjemahan murni tanpa format.";
    assert_eq!(clean_translation_output(raw), "Halo ini terjemahan murni tanpa format.");
}

#[tokio::test]
async fn test_sequential_per_turn_translation_execution_and_persistence() {
    let pool = setup_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Seq Translation Test".to_string(),
        description: Some("Testing per-turn sequential translation".to_string()),
        settings: None,
    }).await.unwrap();

    let provider = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: "Mock Provider".to_string(),
            provider_type: "mock".to_string(),
            base_url: Some("http://localhost".to_string()),
            api_key: None,
            default_model: Some("mock-model".to_string()),
            timeout_seconds: Some(10),
            settings: None,
        },
        &vault,
    ).await.unwrap();

    let session = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Bilingual Multi-turn Session".to_string()),
        system_prompt: Some("You are an AI assistant.".to_string()),
        provider_id: Some(provider.id.clone()),
        model: Some("mock-model".to_string()),
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(2048),
        language_mode: Some("monolingual".to_string()),
        primary_language: Some("en".to_string()),
        secondary_language: Some("id".to_string()),
        language_metadata: None,
    }).await.unwrap();

    // Add 3 turns
    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "What is machine learning?".to_string(),
        model: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "Machine learning is a subset of artificial intelligence.".to_string(),
        model: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Explain supervised fine-tuning.".to_string(),
        model: None,
    }).await.unwrap();

    // Execute sequential translation
    let translated_session = TranslationService::translate_session_selective(
        &pool,
        &vault,
        &session.id,
        "id",
        Some(&provider.id),
        Some("mock-model"),
        None,
        false,
    ).await.unwrap();

    assert_eq!(translated_session.messages.len(), 3);
    assert_eq!(translated_session.language_mode, "bilingual");
    assert_eq!(translated_session.secondary_language, "id");

    for m in &translated_session.messages {
        let trans = m.translations.get("id").and_then(|v| v.as_str());
        assert!(trans.is_some(), "Translation must exist for message {}", m.id);
        assert!(!trans.unwrap().is_empty(), "Translation must not be empty");
        let status = m.translation_status.get("id").and_then(|v| v.as_str());
        assert_eq!(status, Some("completed"));
    }
}

#[tokio::test]
async fn test_cross_studio_commit_and_query_sync() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Studio Sync Project".to_string(),
        description: Some("Cross-studio database queries".to_string()),
        settings: None,
    }).await.unwrap();

    // 1. Studio A (SFT Studio) drafts a conversation
    let session = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Dialogue Session A".to_string()),
        system_prompt: Some("Sys prompt".to_string()),
        provider_id: Some("mock".to_string()),
        model: Some("mock-model".to_string()),
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(2048),
        language_mode: Some("monolingual".to_string()),
        primary_language: Some("id".to_string()),
        secondary_language: Some("en".to_string()),
        language_metadata: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Halo dunia".to_string(),
        model: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "Halo! Ada yang bisa saya bantu?".to_string(),
        model: None,
    }).await.unwrap();

    // Studio B checks corpus records before commit
    let (recs_before, total_before) = DatasetService::list_sft_records(&pool, &project.id, None, None, 50, 0).await.unwrap();
    assert_eq!(total_before, 0);
    assert!(recs_before.is_empty());

    // Studio A commits the session to corpus
    let committed_record = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
        tags: Some(vec!["sync-test".to_string()]),
        ..Default::default()
    }).await.unwrap();

    assert_eq!(committed_record.project_id, project.id);
    assert_eq!(committed_record.turn_count, 2);

    // Studio B (Dataset Explorer / Export Center) queries authoritative SQLite
    let (recs_after, total_after) = DatasetService::list_sft_records(&pool, &project.id, None, None, 50, 0).await.unwrap();
    assert_eq!(total_after, 1);
    assert_eq!(recs_after.len(), 1);
    assert_eq!(recs_after[0].id, committed_record.id);

    // Multiple consecutive commits
    let session2 = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Dialogue Session B".to_string()),
        system_prompt: None,
        provider_id: Some("mock".to_string()),
        model: Some("mock-model".to_string()),
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(2048),
        language_mode: Some("monolingual".to_string()),
        primary_language: Some("id".to_string()),
        secondary_language: Some("en".to_string()),
        language_metadata: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session2.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Turn 2".to_string(),
        model: None,
    }).await.unwrap();

    let committed2 = SFTService::commit_session(&pool, &session2.id, SFTCommitInput::default()).await.unwrap();

    let (recs_multi, total_multi) = DatasetService::list_sft_records(&pool, &project.id, None, None, 50, 0).await.unwrap();
    assert_eq!(total_multi, 2);
    assert!(recs_multi.iter().any(|r| r.id == committed_record.id));
    assert!(recs_multi.iter().any(|r| r.id == committed2.id));
}
