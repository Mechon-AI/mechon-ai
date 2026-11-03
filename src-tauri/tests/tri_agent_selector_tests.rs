use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use mechon_ai::credentials::InMemoryCredentialStore;
use mechon_ai::models::ProjectCreateInput;
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::story_architect::models::*;
use mechon_ai::story_architect::session_service::StorySessionService;

async fn setup_tri_agent_test_db() -> SqlitePool {
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

    // 2. Mock Groq Provider
    sqlx::query(
        "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
         VALUES ('groq', 'Groq', 'mock', 'https://api.groq.com', NULL, 'qwen-3-8-27b', '[\"qwen-3-8-27b\", \"llama-3.3-70b\"]', 30, 1, '{}', ?, ?)"
    )
    .bind(&now).bind(&now).execute(&pool).await.unwrap();

    // 3. Mock Ollama Provider
    sqlx::query(
        "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
         VALUES ('ollama', 'Ollama Local', 'mock', 'http://localhost:11434', NULL, 'llama-3.3', '[\"llama-3.3\", \"mistral\"]', 30, 1, '{}', ?, ?)"
    )
    .bind(&now).bind(&now).execute(&pool).await.unwrap();

    pool
}

#[tokio::test]
async fn test_tri_agent_independent_model_configuration_and_routing() {
    let pool = setup_tri_agent_test_db().await;
    let vault = InMemoryCredentialStore::new();

    // 1. Create Project
    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Tri-Agent Space Exploration".to_string(),
            description: Some("Autonomous multi-agent narrative".to_string()),
            settings: None,
        },
    )
    .await
    .unwrap();

    // 2. Create Session with completely independent tri-agent configurations
    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id.clone(),
            title: "Mars Colony Deep Recon".to_string(),
            description: Some("Investigating anomaly in Sector 4".to_string()),
            interaction_type: Some("storytelling".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(4),
            execution_mode: Some("auto_allow".to_string()),
            auto_pause_conditions: Some(vec!["contradiction_detected".to_string()]),
            planning_provider_id: Some("anthropic".to_string()),
            planning_model: Some("claude-haiku-5-5".to_string()),
            inference_provider_id: Some("groq".to_string()),
            inference_model: Some("qwen-3-8-27b".to_string()),
            evaluation_provider_id: Some("ollama".to_string()),
            evaluation_model: Some("llama-3.3".to_string()),
            planning_agent_config: Some(AgentRuntimeConfig {
                provider_id: "anthropic".to_string(),
                model_id: "claude-haiku-5-5".to_string(),
                model_display_name: Some("Claude Haiku 5.5".to_string()),
                enabled: true,
                capabilities: vec!["prompt_planning".to_string()],
                temperature: Some(0.6),
                top_p: Some(0.9),
                max_tokens: Some(1024),
            }),
            inference_agent_config: Some(AgentRuntimeConfig {
                provider_id: "groq".to_string(),
                model_id: "qwen-3-8-27b".to_string(),
                model_display_name: Some("Qwen 3.8 27B".to_string()),
                enabled: true,
                capabilities: vec!["conversation_generation".to_string()],
                temperature: Some(0.7),
                top_p: Some(0.9),
                max_tokens: Some(2048),
            }),
            evaluation_agent_config: Some(AgentRuntimeConfig {
                provider_id: "ollama".to_string(),
                model_id: "llama-3.3".to_string(),
                model_display_name: Some("Llama 3.3 Local".to_string()),
                enabled: true,
                capabilities: vec!["evaluation_scoring".to_string()],
                temperature: Some(0.2),
                top_p: Some(0.9),
                max_tokens: Some(1024),
            }),
            template_id: None,
        },
    )
    .await
    .expect("Failed to create session with tri-agent config");

    // Verify configurations persisted independently
    assert_eq!(session.planning_provider_id.as_deref(), Some("anthropic"));
    assert_eq!(session.planning_model.as_deref(), Some("claude-haiku-5-5"));
    assert_eq!(session.inference_provider_id.as_deref(), Some("groq"));
    assert_eq!(session.inference_model.as_deref(), Some("qwen-3-8-27b"));
    assert_eq!(session.evaluation_provider_id.as_deref(), Some("ollama"));
    assert_eq!(session.evaluation_model.as_deref(), Some("llama-3.3"));

    assert!(session.planning_agent_config.is_some());
    assert_eq!(session.planning_agent_config.as_ref().unwrap().model_id, "claude-haiku-5-5");
    assert!(session.inference_agent_config.is_some());
    assert_eq!(session.inference_agent_config.as_ref().unwrap().model_id, "qwen-3-8-27b");
    assert!(session.evaluation_agent_config.is_some());
    assert_eq!(session.evaluation_agent_config.as_ref().unwrap().model_id, "llama-3.3");

    // 3. Execute Autonomous Step
    let step_result = StorySessionService::execute_autonomous_step(
        None,
        &pool,
        &vault,
        &session.id,
        None, // No manual override - strictly use tri-agent configs
        None,
        None,
        None,
        None,
        None,
    )
    .await
    .expect("Autonomous step failed");

    // Verify step logs identify each agent's configured model without cross-leakage
    let log_str = step_result.logs.join("\n");
    assert!(log_str.contains("Planning Agent generating prompt using provider='anthropic', model='claude-haiku-5-5'"), "Planning agent should use Anthropic Claude Haiku");
    assert!(log_str.contains("Inference Agent (provider='groq', model='qwen-3-8-27b')"), "Inference agent should use Groq Qwen");
    assert!(log_str.contains("Evaluation Agent (provider='ollama', model='llama-3.3')"), "Evaluation agent should use Ollama Llama");

    // 4. Update ONLY Inference Agent model and verify Planning and Evaluation are NOT modified
    let updated = StorySessionService::update_session(
        &pool,
        UpdateStorySessionInput {
            id: session.id.clone(),
            title: None,
            description: None,
            interaction_type: None,
            primary_language: None,
            secondary_language: None,
            target_turns: None,
            status: None,
            execution_mode: None,
            auto_pause_conditions: None,
            planning_provider_id: None, // DO NOT TOUCH
            planning_model: None,
            inference_provider_id: Some("groq".to_string()),
            inference_model: Some("llama-3.3-70b".to_string()),
            evaluation_provider_id: None, // DO NOT TOUCH
            evaluation_model: None,
            planning_agent_config: None,
            inference_agent_config: Some(AgentRuntimeConfig {
                provider_id: "groq".to_string(),
                model_id: "llama-3.3-70b".to_string(),
                model_display_name: Some("Llama 3.3 70B (Groq)".to_string()),
                enabled: true,
                capabilities: vec!["conversation_generation".to_string()],
                temperature: Some(0.7),
                top_p: Some(0.9),
                max_tokens: Some(2048),
            }),
            evaluation_agent_config: None,
            temperature: None,
            top_p: None,
            max_tokens: None,
            max_turns: None,
            token_budget: None,
        },
    )
    .await
    .expect("Failed to update inference agent model");

    // Planning Agent remains Anthropic Claude Haiku 5.5
    assert_eq!(updated.planning_provider_id.as_deref(), Some("anthropic"));
    assert_eq!(updated.planning_model.as_deref(), Some("claude-haiku-5-5"));
    assert_eq!(updated.planning_agent_config.as_ref().unwrap().model_id, "claude-haiku-5-5");

    // Evaluation Agent remains Ollama Llama 3.3
    assert_eq!(updated.evaluation_provider_id.as_deref(), Some("ollama"));
    assert_eq!(updated.evaluation_model.as_deref(), Some("llama-3.3"));
    assert_eq!(updated.evaluation_agent_config.as_ref().unwrap().model_id, "llama-3.3");

    // Only Inference Agent was modified
    assert_eq!(updated.inference_provider_id.as_deref(), Some("groq"));
    assert_eq!(updated.inference_model.as_deref(), Some("llama-3.3-70b"));
    assert_eq!(updated.inference_agent_config.as_ref().unwrap().model_id, "llama-3.3-70b");

    // 5. Simulate application restart: query session fresh from DB
    let reloaded = StorySessionService::get_session(&pool, &session.id).await.unwrap();
    assert_eq!(reloaded.planning_provider_id.as_deref(), Some("anthropic"));
    assert_eq!(reloaded.planning_model.as_deref(), Some("claude-haiku-5-5"));
    assert_eq!(reloaded.inference_provider_id.as_deref(), Some("groq"));
    assert_eq!(reloaded.inference_model.as_deref(), Some("llama-3.3-70b"));
    assert_eq!(reloaded.evaluation_provider_id.as_deref(), Some("ollama"));
    assert_eq!(reloaded.evaluation_model.as_deref(), Some("llama-3.3"));
}

#[tokio::test]
async fn test_tri_agent_invalid_provider_or_rate_limit_fails_explicitly() {
    let pool = setup_tri_agent_test_db().await;
    let vault = InMemoryCredentialStore::new();

    // 1. Create Project
    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Error Diagnostics Project".to_string(),
            description: None,
            settings: None,
        },
    )
    .await
    .unwrap();

    // 2. Setup a non-existent provider for Planning Agent
    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id.clone(),
            title: "Unavailable Provider Test".to_string(),
            description: None,
            interaction_type: Some("storytelling".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(3),
            execution_mode: Some("auto_allow".to_string()),
            auto_pause_conditions: None,
            planning_provider_id: Some("non-existent-provider".to_string()),
            planning_model: Some("fake-model".to_string()),
            inference_provider_id: Some("groq".to_string()),
            inference_model: Some("qwen-3-8-27b".to_string()),
            evaluation_provider_id: Some("ollama".to_string()),
            evaluation_model: Some("llama-3.3".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .unwrap();

    // 3. Attempt autonomous step - MUST NOT silently fallback to another provider/model!
    let result = StorySessionService::execute_autonomous_step(
        None,
        &pool,
        &vault,
        &session.id,
        None,
        None,
        None,
        None,
        None,
        None,
    )
    .await;

    // Must return explicit Provider or NotFound error
    assert!(result.is_err(), "Non-existent provider must produce an explicit error and never silently fall back");
}
