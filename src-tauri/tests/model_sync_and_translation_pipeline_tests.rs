use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use mechon_ai::credentials::InMemoryCredentialStore;
use mechon_ai::models::{ProjectCreateInput, SFTSessionCreateInput, SFTMessageCreateInput};
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::services::sft_service::SFTService;
use mechon_ai::services::translation_service::TranslationService;
use mechon_ai::story_architect::models::*;
use mechon_ai::story_architect::session_service::StorySessionService;

async fn setup_test_db() -> SqlitePool {
    let options = SqliteConnectOptions::new()
        .filename(":memory:")
        .foreign_keys(true);

    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .expect("Failed to connect to in-memory SQLite");

    let init_sql = include_str!("../migrations/20261102000000_init_schema.sql");
    sqlx::raw_sql(init_sql).execute(&pool).await.unwrap();

    let eng_sql = include_str!("../migrations/20261103000000_engineering_expansion.sql");
    sqlx::raw_sql(eng_sql).execute(&pool).await.unwrap();

    let story_sql = include_str!("../migrations/20261103100000_story_architect.sql");
    sqlx::raw_sql(story_sql).execute(&pool).await.unwrap();

    let rev_sql = include_str!("../migrations/20261103200000_story_architect_revisions.sql");
    sqlx::raw_sql(rev_sql).execute(&pool).await.unwrap();

    let tri_sql = include_str!("../migrations/20261103210000_tri_agent_model_selector.sql");
    sqlx::raw_sql(tri_sql).execute(&pool).await.unwrap();

    let now = chrono::Utc::now().to_rfc3339();

    // 1. Mock Anthropic Provider
    sqlx::query(
        "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
         VALUES ('anthropic', 'Anthropic', 'mock', 'https://api.anthropic.com', NULL, 'claude-haiku-5-5', '[\"claude-haiku-5-5\", \"claude-sonnet-5-5\"]', 30, 1, '{}', ?, ?)"
    )
    .bind(&now).bind(&now).execute(&pool).await.unwrap();

    // 2. Mock Google Gemini Provider
    sqlx::query(
        "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
         VALUES ('gemini', 'Google Gemini', 'mock', 'https://generativelanguage.googleapis.com', NULL, 'gemini-2.5-flash', '[\"gemini-2.5-flash\", \"gemini-2.5-pro\"]', 30, 1, '{}', ?, ?)"
    )
    .bind(&now).bind(&now).execute(&pool).await.unwrap();

    // 3. Mock Groq Provider
    sqlx::query(
        "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
         VALUES ('groq', 'Groq', 'mock', 'https://api.groq.com', NULL, 'llama-3.1-8b-instant', '[\"llama-3.1-8b-instant\", \"qwen-3-8-27b\"]', 30, 1, '{}', ?, ?)"
    )
    .bind(&now).bind(&now).execute(&pool).await.unwrap();

    pool
}

#[tokio::test]
async fn test_scenario_gemini_main_inference_and_claude_planning() {
    let pool = setup_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Model Sync Test".to_string(),
            description: None,
            settings: None,
        },
    ).await.unwrap();

    // Configure Gemini for main inference, Claude for planning
    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id.clone(),
            title: "Cyberpunk Odyssey".to_string(),
            description: None,
            interaction_type: Some("storytelling".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(4),
            execution_mode: Some("auto_allow".to_string()),
            auto_pause_conditions: None,
            planning_provider_id: Some("anthropic".to_string()),
            planning_model: Some("claude-haiku-5-5".to_string()),
            inference_provider_id: Some("gemini".to_string()),
            inference_model: Some("gemini-2.5-flash".to_string()),
            evaluation_provider_id: Some("anthropic".to_string()),
            evaluation_model: Some("claude-haiku-5-5".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    ).await.unwrap();

    assert_eq!(session.planning_provider_id.as_deref(), Some("anthropic"));
    assert_eq!(session.planning_model.as_deref(), Some("claude-haiku-5-5"));
    assert_eq!(session.inference_provider_id.as_deref(), Some("gemini"));
    assert_eq!(session.inference_model.as_deref(), Some("gemini-2.5-flash"));

    // Execute step - verify planning agent used Claude and inference agent used Gemini
    let step = StorySessionService::execute_autonomous_step(
        None,
        &pool,
        &vault,
        &session.id,
        Some("gemini"),
        Some("gemini-2.5-flash"),
        Some("anthropic"),
        Some("claude-haiku-5-5"),
        None,
        None,
    ).await.unwrap();

    let logs = step.logs.join("\n");
    assert!(logs.contains("provider='anthropic', model='claude-haiku-5-5'"), "Planning should explicitly report Claude Haiku");
    assert!(logs.contains("provider='gemini', model='gemini-2.5-flash'"), "Inference should explicitly report Gemini Flash");
}

#[tokio::test]
async fn test_scenario_groq_main_inference_and_gemini_translation() {
    let pool = setup_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Translation Pipeline Test".to_string(),
            description: None,
            settings: None,
        },
    ).await.unwrap();

    // SFT session configured with Groq for main inference
    let session = SFTService::create_session(
        &pool,
        SFTSessionCreateInput {
            project_id: project.id.clone(),
            title: Some("Indonesian Customer Support".to_string()),
            system_prompt: Some("Helpful AI".to_string()),
            provider_id: Some("groq".to_string()),
            model: Some("llama-3.1-8b-instant".to_string()),
            temperature: None,
            top_p: None,
            max_tokens: None,
            language_mode: Some("monolingual".to_string()),
            primary_language: Some("id".to_string()),
            secondary_language: Some("en".to_string()),
            language_metadata: None,
        },
    ).await.unwrap();

    // Add conversation turns in source language (id)
    let msg1 = SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "Halo, bagaimana cara mengatur model inferensi di Mechon AI?".to_string(),
        model: None,
    }).await.unwrap();

    let msg2 = SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "Anda dapat memilih model di bilah alat atas melalui pemilih model terpadu.".to_string(),
        model: Some("llama-3.1-8b-instant".to_string()),
    }).await.unwrap();

    // Now translate entire session to English using Google Gemini (Translation Agent Model)
    let translated = TranslationService::translate_session_selective(
        &pool,
        &vault,
        &session.id,
        "en",
        Some("gemini"),
        Some("gemini-2.5-flash"),
        None,
        false,
    ).await.unwrap();

    assert_eq!(translated.language_mode, "bilingual");
    assert_eq!(translated.secondary_language, "en");

    for m in &translated.messages {
        assert!(m.translations.get("en").is_some(), "Translation must be generated for turn {}", m.id);
        assert_eq!(m.translation_status.get("en").and_then(|v| v.as_str()), Some("completed"));
    }

    // Turn 1: Regenerate single message translation
    let regen_msg1 = TranslationService::translate_single_message(
        &pool,
        &vault,
        &session.id,
        &msg1.id,
        "en",
        Some("gemini"),
        Some("gemini-2.5-flash"),
    ).await.unwrap();

    assert_eq!(regen_msg1.translation_status.get("en").and_then(|v| v.as_str()), Some("completed"));

    // Turn 2: Edit translation manually and approve
    TranslationService::update_message_translation(
        &pool,
        &msg2.id,
        "en",
        "You can choose the model in the top toolbar using the unified model selector.",
        "approved",
    ).await.unwrap();

    let reloaded = SFTService::get_session(&pool, &session.id).await.unwrap();
    let reloaded_msg2 = reloaded.messages.iter().find(|m| m.id == msg2.id).unwrap();
    assert_eq!(reloaded_msg2.translation_status.get("en").and_then(|v| v.as_str()), Some("approved"));
    assert_eq!(
        reloaded_msg2.translations.get("en").and_then(|v| v.as_str()),
        Some("You can choose the model in the top toolbar using the unified model selector.")
    );

    // Translating without force_regenerate must PRESERVE the approved manual edit
    let re_translated = TranslationService::translate_session_selective(
        &pool,
        &vault,
        &session.id,
        "en",
        Some("gemini"),
        Some("gemini-2.5-flash"),
        None,
        false,
    ).await.unwrap();

    let preserved_msg2 = re_translated.messages.iter().find(|m| m.id == msg2.id).unwrap();
    assert_eq!(preserved_msg2.translation_status.get("en").and_then(|v| v.as_str()), Some("approved"));
    assert_eq!(
        preserved_msg2.translations.get("en").and_then(|v| v.as_str()),
        Some("You can choose the model in the top toolbar using the unified model selector.")
    );
}
