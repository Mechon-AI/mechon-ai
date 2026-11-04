use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use serde_json::Value;
use mechon_ai::models::{
    DPOAnnotationInput, DPOTaskCreateInput, ProjectCreateInput, SFTCommitInput,
    SFTMessageCreateInput, SFTSessionCreateInput,
};
use mechon_ai::services::dpo_service::DPOService;
use mechon_ai::services::export_service::ExportService;
use mechon_ai::services::engineering_service::EngineeringService;
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::services::sft_service::SFTService;

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
async fn test_corpus_single_record_export_integrity() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Corpus Single Export Studio".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // Create 5 distinct SFT records
    let mut record_ids = Vec::new();
    for i in 1..=5 {
        let session = SFTService::create_session(&pool, SFTSessionCreateInput {
            project_id: project.id.clone(),
            title: Some(format!("Scenario {}", i)),
            system_prompt: Some("System Persona".to_string()),
            provider_id: Some("mock".to_string()),
            model: Some("mock-llama-3-8b".to_string()),
            temperature: Some(0.7),
            top_p: Some(0.9),
            max_tokens: Some(1024),
            language_mode: Some("monolingual".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            language_metadata: None,
        }).await.unwrap();

        SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
            role: "user".to_string(),
            content: format!("Question for unique turn {}", i),
            model: None,
        }).await.unwrap();

        SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
            role: "assistant".to_string(),
            content: format!("Response for unique turn {}", i),
            model: Some("mock-llama-3-8b".to_string()),
        }).await.unwrap();

        let record = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
            title_override: Some(format!("Scenario {}", i)),
            tags: Some(vec![format!("batch-{}", i)]),
            metadata: None,
            language_mode: None,
            primary_language: None,
            secondary_language: None,
            language_metadata: None,
            ..Default::default()
        }).await.unwrap();

        record_ids.push(record.id);
    }

    assert_eq!(record_ids.len(), 5);

    // Target single record: Record #3
    let target_id = record_ids[2].clone();
    let target_slice = vec![target_id.clone()];

    // Verify count_sft
    let count = ExportService::count_sft(&pool, &project.id, Some(&target_slice)).await.unwrap();
    assert_eq!(count, 1, "Count for single record export must be exactly 1");

    // 1. JSON Export
    let json_str = ExportService::export_sft(&pool, &project.id, "json", true, Some(target_slice.clone()), None).await.unwrap();
    let items: Vec<Value> = serde_json::from_str(&json_str).expect("Exported JSON must be valid JSON array");
    assert_eq!(items.len(), 1, "JSON export of single record must contain exactly 1 item");
    assert_eq!(items[0]["id"], target_id);
    assert_eq!(items[0]["schema_version"], "2.0");
    assert_eq!(items[0]["type"], "sft");
    assert!(json_str.contains("Question for unique turn 3"));
    assert!(!json_str.contains("Question for unique turn 1"));
    assert!(!json_str.contains("Question for unique turn 2"));
    assert!(!json_str.contains("Question for unique turn 4"));
    assert!(!json_str.contains("Question for unique turn 5"));

    // 2. JSONL Export
    let jsonl_str = ExportService::export_sft(&pool, &project.id, "jsonl", true, Some(target_slice.clone()), None).await.unwrap();
    let lines: Vec<&str> = jsonl_str.lines().filter(|l| !l.trim().is_empty()).collect();
    assert_eq!(lines.len(), 1, "JSONL export of single record must produce exactly 1 line");
    let line_val: Value = serde_json::from_str(lines[0]).expect("Line must be valid JSON");
    assert_eq!(line_val["id"], target_id);
    assert!(lines[0].contains("Response for unique turn 3"));

    // 3. CSV Export
    let csv_str = ExportService::export_sft(&pool, &project.id, "csv", true, Some(target_slice.clone()), None).await.unwrap();
    let mut rdr = csv::Reader::from_reader(csv_str.as_bytes());
    let mut csv_rows = Vec::new();
    for result in rdr.records() {
        csv_rows.push(result.unwrap());
    }
    assert_eq!(csv_rows.len(), 1, "CSV export of single record must contain header + 1 data row");
    assert_eq!(&csv_rows[0][0], &target_id);
    assert!(csv_rows[0][1].contains("Question for unique turn 3"));
}

#[tokio::test]
async fn test_corpus_selection_vs_entire_scope() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Scope Separation Studio".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    let mut record_ids = Vec::new();
    for i in 1..=4 {
        let session = SFTService::create_session(&pool, SFTSessionCreateInput {
            project_id: project.id.clone(),
            title: Some(format!("Item {}", i)),
            system_prompt: None,
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
            content: format!("Prompt item {}", i),
            model: None,
        }).await.unwrap();

        let record = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
            ..Default::default()
        }).await.unwrap();

        record_ids.push(record.id);
    }

    // A. Entire Corpus scope (None)
    let entire_count = ExportService::count_sft(&pool, &project.id, None).await.unwrap();
    assert_eq!(entire_count, 4);

    let entire_jsonl = ExportService::export_sft(&pool, &project.id, "jsonl", false, None, None).await.unwrap();
    let entire_lines: Vec<&str> = entire_jsonl.lines().filter(|l| !l.trim().is_empty()).collect();
    assert_eq!(entire_lines.len(), 4);

    // B. Selected Examples scope (Record 1 and Record 4)
    let selected_ids = vec![record_ids[0].clone(), record_ids[3].clone()];
    let selected_count = ExportService::count_sft(&pool, &project.id, Some(&selected_ids)).await.unwrap();
    assert_eq!(selected_count, 2);

    let selected_jsonl = ExportService::export_sft(&pool, &project.id, "jsonl", false, Some(selected_ids), None).await.unwrap();
    let selected_lines: Vec<&str> = selected_jsonl.lines().filter(|l| !l.trim().is_empty()).collect();
    assert_eq!(selected_lines.len(), 2);
    assert!(selected_jsonl.contains("Prompt item 1"));
    assert!(selected_jsonl.contains("Prompt item 4"));
    assert!(!selected_jsonl.contains("Prompt item 2"));
    assert!(!selected_jsonl.contains("Prompt item 3"));

    // C. Empty selection must fail with validation error
    let empty_res = ExportService::export_sft(&pool, &project.id, "jsonl", false, Some(vec![]), None).await;
    assert!(empty_res.is_err());
    assert_eq!(ExportService::count_sft(&pool, &project.id, Some(&vec![])).await.unwrap(), 0);
}

#[tokio::test]
async fn test_conversational_dpo_selective_and_single_export() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Conversational DPO Export Studio".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    let mut task_ids = Vec::new();
    for i in 1..=3 {
        let task = DPOService::create(&pool, DPOTaskCreateInput {
            project_id: project.id.clone(),
            prompt: format!("Evaluate coding task {}", i),
            system_prompt: Some("You are an expert engineer.".to_string()),
            response_a: Some(format!("Clean solution {}", i)),
            response_b: Some(format!("Messy solution {}", i)),
            metadata: None,
        }).await.unwrap();

        DPOService::annotate(&pool, &task.id, DPOAnnotationInput {
            preference: "a".to_string(),
            rationale: Some(format!("Solution A is properly structured for task {}", i)),
            helpfulness_rating: Some(5),
            factuality_rating: Some(5),
            metadata: None,
        }).await.unwrap();

        task_ids.push(task.id);
    }

    // 1. Full Conversational DPO export (all 3 tasks)
    let full_export = EngineeringService::export_conversational_dpo(
        &pool,
        &project.id,
        "jsonl",
        true,
        None,
    ).await.unwrap();
    let full_lines: Vec<&str> = full_export.lines().filter(|l| !l.trim().is_empty()).collect();
    assert_eq!(full_lines.len(), 3);

    // 2. Single DPO task selective export (Task #2 only)
    let target_task_id = task_ids[1].clone();
    let single_export = EngineeringService::export_conversational_dpo(
        &pool,
        &project.id,
        "jsonl",
        true,
        Some(vec![target_task_id.clone()]),
    ).await.unwrap();

    let single_lines: Vec<&str> = single_export.lines().filter(|l| !l.trim().is_empty()).collect();
    assert_eq!(single_lines.len(), 1, "Selective conversational DPO export must contain exactly 1 record");
    assert!(single_export.contains("Evaluate coding task 2"));
    assert!(single_export.contains("Clean solution 2"));
    assert!(!single_export.contains("Evaluate coding task 1"));
    assert!(!single_export.contains("Evaluate coding task 3"));

    // Verify HF TRL conversational schema
    let parsed: Value = serde_json::from_str(single_lines[0]).expect("Record must be valid JSON");
    assert!(parsed.get("chosen").is_some());
    assert!(parsed.get("rejected").is_some());

    // 3. Empty selection handling
    let empty_err = EngineeringService::export_conversational_dpo(
        &pool,
        &project.id,
        "jsonl",
        true,
        Some(vec![]),
    ).await;
    assert!(empty_err.is_err(), "Empty selective conversational DPO export must return validation error");
}
