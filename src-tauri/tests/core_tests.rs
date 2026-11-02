use sqlx::sqlite::SqliteConnectOptions;
use sqlx::SqlitePool;
use mechon_ai::models::*;
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::services::sft_service::SFTService;
use mechon_ai::services::dpo_service::DPOService;
use mechon_ai::services::dataset_service::DatasetService;
use mechon_ai::services::validation_service::ValidationService;
use mechon_ai::services::version_service::VersionService;
use mechon_ai::services::export_service::ExportService;
use mechon_ai::providers::{create_provider, ChatMessage, ChatRequest};

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
    sqlx::raw_sql(schema_sql)
        .execute(&pool)
        .await
        .expect("Failed to run schema migration");

    pool
}

#[tokio::test]
async fn test_project_crud() {
    let pool = setup_test_db().await;

    // Create
    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Test Lab".to_string(),
        description: Some("Alignment testing project".to_string()),
        settings: None,
    }).await.expect("Failed to create project");

    assert_eq!(project.name, "Test Lab");
    assert!(!project.is_archived);

    // List
    let projects = ProjectService::list(&pool, false).await.expect("Failed to list projects");
    assert_eq!(projects.len(), 1);

    // Update
    let updated = ProjectService::update(&pool, &project.id, ProjectUpdateInput {
        name: Some("Renamed Lab".to_string()),
        description: None,
        is_archived: None,
        settings: None,
    }).await.expect("Failed to update project");
    assert_eq!(updated.name, "Renamed Lab");

    // Delete
    ProjectService::delete(&pool, &project.id).await.expect("Failed to delete project");
    let after_delete = ProjectService::list(&pool, false).await.expect("Failed to list");
    assert_eq!(after_delete.len(), 0);
}

#[tokio::test]
async fn test_sft_conversation_to_single_record_commit() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "SFT Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // 1. Create SFT session
    let session = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Rust Ownership Dialogue".to_string()),
        system_prompt: Some("You are a helpful Rust expert.".to_string()),
        provider_id: Some("mock".to_string()),
        model: Some("mock-llama-3-8b".to_string()),
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(2048),
    }).await.unwrap();

    assert_eq!(session.status, "draft");

    // 2. Add multi-turn messages
    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Explain Rust ownership in one sentence.".to_string(),
        model: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "Rust ownership manages memory safely at compile time via a single owner discipline.".to_string(),
        model: Some("mock-llama-3-8b".to_string()),
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Give an example of borrowing.".to_string(),
        model: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "An example is passing &String instead of String.".to_string(),
        model: Some("mock-llama-3-8b".to_string()),
    }).await.unwrap();

    // 3. Commit conversation
    // CRITICAL: Exactly ONE SFT Record must be produced from the entire multi-turn conversation!
    let record = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
        title_override: None,
        tags: Some(vec!["rust".to_string(), "memory-safety".to_string()]),
        metadata: None,
    }).await.unwrap();

    assert_eq!(record.turn_count, 4);
    assert_eq!(record.session_id.as_deref(), Some(session.id.as_str()));

    // Verify messages in record include system prompt + 4 turns
    let msgs = record.messages.as_array().expect("Expected JSON array of messages");
    assert_eq!(msgs.len(), 5); // 1 system + 4 conversation turns
    assert_eq!(msgs[0]["role"], "system");
    assert_eq!(msgs[1]["role"], "user");
    assert_eq!(msgs[2]["role"], "assistant");
    assert_eq!(msgs[3]["role"], "user");
    assert_eq!(msgs[4]["role"], "assistant");

    // Check dataset count: exactly 1 SFT record
    let (records, total) = DatasetService::list_sft_records(&pool, &project.id, None, None, 10, 0).await.unwrap();
    assert_eq!(total, 1);
    assert_eq!(records.len(), 1);

    // 4. Retry commit should update the existing record, NOT duplicate it!
    let record_retry = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
        title_override: Some("Updated Title".to_string()),
        tags: Some(vec!["updated-tag".to_string()]),
        metadata: None,
    }).await.unwrap();

    assert_eq!(record_retry.id, record.id);
    assert_eq!(record_retry.revision, 2);

    let (_, total_after_retry) = DatasetService::list_sft_records(&pool, &project.id, None, None, 10, 0).await.unwrap();
    assert_eq!(total_after_retry, 1); // Still exactly 1!
}

#[tokio::test]
async fn test_dpo_task_and_annotation() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "DPO Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // Create DPO task
    let task = DPOService::create(&pool, DPOTaskCreateInput {
        project_id: project.id.clone(),
        prompt: "Write a haiku about compiling Rust.".to_string(),
        system_prompt: None,
        response_a: Some("Borrow checker speaks,\nTypes align in harmony,\nBinary is born.".to_string()),
        response_b: Some("Rust is fast and good,\nI like writing code in it,\nCompile takes a while.".to_string()),
        metadata: None,
    }).await.unwrap();

    assert_eq!(task.status, "pending");
    assert!(task.preference.is_none());

    // Annotate preference A
    let annotated = DPOService::annotate(&pool, &task.id, DPOAnnotationInput {
        preference: "a".to_string(),
        rationale: Some("Response A follows the 5-7-5 syllable structure correctly and is poetic.".to_string()),
        helpfulness_rating: Some(5),
        factuality_rating: Some(5),
        metadata: None,
    }).await.unwrap();

    assert_eq!(annotated.status, "completed");
    assert_eq!(annotated.preference.as_deref(), Some("a"));
    assert_eq!(annotated.helpfulness_rating, Some(5));

    // Test Undo annotation
    let undone = DPOService::undo_last_annotation(&pool, &project.id).await.unwrap();
    assert!(undone.is_some());
    let undone_task = undone.unwrap();
    assert_eq!(undone_task.id, task.id);
    assert_eq!(undone_task.status, "pending");
    assert!(undone_task.preference.is_none());
}

#[tokio::test]
async fn test_dataset_validation_engine() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Validation Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // Test SFT validation
    let report_empty = ValidationService::validate_dataset(&pool, &project.id, "sft").await.unwrap();
    assert_eq!(report_empty.total_records, 0);

    // Create session and commit
    let session = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Valid Chat".to_string()),
        system_prompt: Some("System prompt".to_string()),
        provider_id: None,
        model: None,
        temperature: None,
        top_p: None,
        max_tokens: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "What is 2+2?".to_string(),
        model: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "2+2 equals 4.".to_string(),
        model: None,
    }).await.unwrap();

    SFTService::commit_session(&pool, &session.id, SFTCommitInput {
        title_override: None,
        tags: None,
        metadata: None,
    }).await.unwrap();

    let report_valid = ValidationService::validate_dataset(&pool, &project.id, "sft").await.unwrap();
    assert_eq!(report_valid.total_records, 1);
    assert_eq!(report_valid.passed_records, 1);
    assert_eq!(report_valid.failed_records, 0);
    assert_eq!(report_valid.error_count, 0);
}

#[tokio::test]
async fn test_dataset_export_and_versioning() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Export Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // Create DPO task and annotate
    let task = DPOService::create(&pool, DPOTaskCreateInput {
        project_id: project.id.clone(),
        prompt: "Tell me a joke".to_string(),
        system_prompt: None,
        response_a: Some("Why did the crab never share? Because he was shellfish.".to_string()),
        response_b: Some("Bad joke.".to_string()),
        metadata: None,
    }).await.unwrap();

    DPOService::annotate(&pool, &task.id, DPOAnnotationInput {
        preference: "a".to_string(),
        rationale: None,
        helpfulness_rating: Some(5),
        factuality_rating: Some(5),
        metadata: None,
    }).await.unwrap();

    // Export DPO in JSONL
    let export_jsonl = ExportService::export_dpo(&pool, &project.id, "jsonl", false, true).await.unwrap();
    assert!(export_jsonl.contains("shellfish"));
    assert!(export_jsonl.contains("\"chosen\""));
    assert!(export_jsonl.contains("\"rejected\""));

    // Snapshot versioning
    let snapshot = VersionService::create_snapshot(&pool, SnapshotCreateInput {
        project_id: project.id.clone(),
        dataset_type: "dpo".to_string(),
        version_tag: "v1.0.0".to_string(),
        description: Some("First release snapshot".to_string()),
    }).await.unwrap();

    assert_eq!(snapshot.record_count, 1);
    assert_eq!(snapshot.checksum_sha256.len(), 64);

    let versions = VersionService::list(&pool, &project.id, None).await.unwrap();
    assert_eq!(versions.len(), 1);
}

#[tokio::test]
async fn test_offline_mock_provider() {
    let provider = create_provider("mock", "http://127.0.0.1:0", None, 30);
    let models = provider.test_connection().await.unwrap();
    assert!(!models.is_empty());

    let resp = provider.chat(ChatRequest {
        model: "mock-llama-3-8b".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Hello Mechon AI".to_string() }],
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(1024),
        stream: false,
    }).await.unwrap();

    assert_eq!(resp.role, "assistant");
    assert!(resp.content.contains("Mechon AI offline engine verified"));
}
