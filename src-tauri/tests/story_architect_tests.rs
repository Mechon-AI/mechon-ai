use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use mechon_ai::credentials::InMemoryCredentialStore;
use mechon_ai::models::ProjectCreateInput;
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::story_architect::models::{
    CharacterProfile, CreateStorySessionInput, SavePlanningSpecInput, CommitToSFTInput,
    EditStoryMessageInput, RegenerateAssistantTurnInput, RestoreRevisionInput
};
use mechon_ai::story_architect::session_service::StorySessionService;
use mechon_ai::story_architect::planning_service::PlanningAgentService;
use mechon_ai::story_architect::execution_service::ExecutionService;
use mechon_ai::story_architect::prompt_history::PromptHistoryService;

async fn setup_story_architect_test_db() -> SqlitePool {
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

    // Insert mock provider for simulated model execution
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

    // Insert second mock provider for provider switching tests
    sqlx::query(
        "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
         VALUES ('mock2', 'Mock Provider 2', 'mock', 'http://127.0.0.1:0', NULL, 'mock-claude-3-5', '[\"mock-claude-3-5\"]', 30, 1, '{}', ?, ?)"
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    pool
}

#[tokio::test]
async fn test_story_architect_session_lifecycle_and_planning() {
    let pool = setup_story_architect_test_db().await;

    // 1. Create a Project
    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Story Studio Project".to_string(),
            description: Some("Test project for story architect".to_string()),
            settings: None,
        },
    )
    .await
    .expect("Failed to create project");

    // 2. Create Story Architect Session
    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id.clone(),
            title: "Cyberpunk Detective Investigation".to_string(),
            description: Some("Autonomous neo-noir investigative dialogue".to_string()),
            interaction_type: Some("storytelling".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: Some("id".to_string()),
            target_turns: Some(6),
            execution_mode: Some("hybrid".to_string()),
            auto_pause_conditions: Some(vec![
                "major_milestone".to_string(),
                "contradiction_detected".to_string(),
            ]),
            planning_provider_id: Some("mock".to_string()),
            planning_model: Some("mock-llama-3-8b".to_string()),
            inference_provider_id: Some("mock".to_string()),
            inference_model: Some("mock-llama-3-8b".to_string()),
            evaluation_provider_id: Some("mock".to_string()),
            evaluation_model: Some("mock-llama-3-8b".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .expect("Failed to create story session");

    assert_eq!(session.title, "Cyberpunk Detective Investigation");
    assert_eq!(session.execution_mode, "hybrid");
    assert_eq!(session.status, "draft");

    // Verify initial planning specification was auto-created
    let spec = StorySessionService::get_planning_spec(&pool, &session.id)
        .await
        .expect("Failed to load planning spec");
    assert!(spec.premise.contains("Cyberpunk Detective Investigation"));

    // Verify milestones auto-populated
    let milestones = StorySessionService::list_milestones(&pool, &session.id)
        .await
        .expect("Failed to list milestones");
    assert_eq!(milestones.len(), 5);
    assert_eq!(milestones[0].status, "active");
    assert_eq!(milestones[1].status, "pending");

    // 3. Update Planning Spec
    let updated_spec = StorySessionService::save_planning_spec(
        &pool,
        SavePlanningSpecInput {
            session_id: session.id.clone(),
            premise: "In Neo-Jakarta 2088, Detective Rian investigates an anomalous neural imprint."
                .to_string(),
            world_environment: Some("Neon rain, cybernetic bazaars, megacorp sky-citadels".to_string()),
            character_profiles: Some(vec![
                CharacterProfile {
                    name: "Detective Rian".to_string(),
                    role: "Protagonist".to_string(),
                    personality: "Cynical, observant, weary ex-corporate security officer".to_string(),
                    relationship_to_assistant: None,
                    background: None,
                },
                CharacterProfile {
                    name: "Kallista".to_string(),
                    role: "Informant".to_string(),
                    personality: "Enigmatic memory-broker in the Glitch District".to_string(),
                    relationship_to_assistant: None,
                    background: None,
                }
            ]),
            main_conflict: Some("Deciphering the corrupted memory core before corporate black-ops erase it".to_string()),
            secondary_conflicts: Some("Rian's fading biological neural tissue failing under synthetic overclock".to_string()),
            important_events: Some(vec![
                "Initial meeting at the noodle stall".to_string(),
                "Memory shard extraction".to_string(),
            ]),
            narrative_progression: Some("Slow-burn mystery escalating into high-stakes techno-thriller".to_string()),
            desired_ending: Some("Rian secures the memory but discovers his own identity was fabricated".to_string()),
            constraints_forbidden_developments: Some("No supernatural elements; hard sci-fi constraints only".to_string()),
            learning_objectives: None,
            reasoning_objectives: None,
            communication_objectives: None,
            expected_assistant_behavior: Some("Respond as Kallista or atmospheric third-person narrator with gritty hardboiled tone".to_string()),
            quality_requirements: Some("Maintain consistent sensory descriptions and noir cadence".to_string()),
            completion_criteria: Some("Resolution of memory core inquiry".to_string()),
            custom_fields: None,
        },
    )
    .await
    .expect("Failed to save planning spec");

    assert_eq!(updated_spec.world_environment, "Neon rain, cybernetic bazaars, megacorp sky-citadels");
    assert_eq!(updated_spec.character_profiles.len(), 2);
}

#[tokio::test]
async fn test_autonomous_prompt_generation_execution_and_evaluation() {
    let pool = setup_story_architect_test_db().await;
    let vault = InMemoryCredentialStore::new();

    // 1. Setup Project & Session
    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Autonomous Engine Project".to_string(),
            description: None,
            settings: None,
        },
    )
    .await
    .unwrap();

    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id,
            title: "Mars Colony Emergency".to_string(),
            description: Some("Technical problem-solving dialogue".to_string()),
            interaction_type: Some("technical_discussion".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(4),
            execution_mode: Some("auto_allow".to_string()),
            auto_pause_conditions: Some(vec!["contradiction_detected".to_string()]),
            planning_provider_id: Some("mock".to_string()),
            planning_model: Some("mock-llama-3-8b".to_string()),
            inference_provider_id: Some("mock".to_string()),
            inference_model: Some("mock-llama-3-8b".to_string()),
            evaluation_provider_id: Some("mock".to_string()),
            evaluation_model: Some("mock-llama-3-8b".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .unwrap();

    // 2. Planning Agent generates next prompt
    let proposed_prompt = PlanningAgentService::generate_next_prompt(
        &pool,
        &vault,
        &session.id,
        Some("Start by inquiring about oxygen recycler valve failure"),
        None,
        None,
    )
    .await
    .expect("Planning agent failed to generate prompt");

    assert!(!proposed_prompt.prompt_content.is_empty());
    assert_eq!(proposed_prompt.status, "proposed");
    assert_eq!(proposed_prompt.turn_index, 0);

    // 3. Execution of the turn
    let turn_result = ExecutionService::execute_turn(
        None,
        &pool,
        &vault,
        &session.id,
        &proposed_prompt.prompt_content,
        Some(&proposed_prompt.id),
        false,
        None,
        None,
        None,
        None,
    )
    .await
    .expect("Execution service failed to execute turn");

    // Verify messages created
    assert_eq!(turn_result.user_message.role, "user");
    assert_eq!(turn_result.assistant_message.role, "assistant");
    assert!(turn_result.assistant_message.token_count > 0);

    // Verify turn evaluation recorded
    assert!(turn_result.evaluation.consistency_score >= 0.70);
    assert!(turn_result.evaluation.quality_score >= 0.70);

    // Verify Narrative State updated
    assert_eq!(turn_result.updated_narrative_state.turn_index, 1);
    assert!(!turn_result.updated_narrative_state.established_facts.is_empty());

    // 4. Autonomous Step Loop (auto_allow mode)
    let auto_step = StorySessionService::execute_autonomous_step(
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
    .await
    .expect("Failed to execute autonomous step");

    assert_eq!(auto_step.action_taken, "turn_executed");

    // 5. Commit to SFT Corpus
    let commit_res = StorySessionService::commit_to_sft(
        &pool,
        CommitToSFTInput {
            session_id: session.id.clone(),
            title: Some("Mars Habitat Life-Support Troubleshooting".to_string()),
            description: None,
            include_planning_metadata: true,
        },
    )
    .await
    .expect("Failed to commit Story Architect conversation to SFT Corpus");

    assert!(commit_res.message_count >= 4);
    assert!(!commit_res.sft_record_id.is_empty());
    assert!(!commit_res.sft_session_id.is_empty());

    // Verify story session status is now marked 'completed' with sft_session_id linked
    let updated_session = StorySessionService::get_session(&pool, &session.id).await.unwrap();
    assert_eq!(updated_session.status, "completed");
    assert_eq!(updated_session.sft_session_id, Some(commit_res.sft_session_id));
}

#[tokio::test]
async fn test_manual_mode_and_prompt_review_workflow() {
    let pool = setup_story_architect_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Manual Review Project".to_string(),
            description: None,
            settings: None,
        },
    )
    .await
    .unwrap();

    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id,
            title: "Philosophy of Cognition".to_string(),
            description: Some("Human-supervised dialogue".to_string()),
            interaction_type: Some("educational_tutoring".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(5),
            execution_mode: Some("manual".to_string()),
            auto_pause_conditions: None,
            planning_provider_id: Some("mock".to_string()),
            planning_model: Some("mock-llama-3-8b".to_string()),
            inference_provider_id: Some("mock".to_string()),
            inference_model: Some("mock-llama-3-8b".to_string()),
            evaluation_provider_id: Some("mock".to_string()),
            evaluation_model: Some("mock-llama-3-8b".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .unwrap();

    // In manual mode, autonomous step must generate a prompt and pause for engineer approval
    let step_result = StorySessionService::execute_autonomous_step(
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
    .await
    .expect("Failed autonomous step in manual mode");

    assert_eq!(step_result.action_taken, "prompt_generated");
    let proposed = step_result.prompt.expect("Must return proposed prompt for manual review");
    assert_eq!(proposed.status, "proposed");

    // Engineer decides to edit the prompt
    let edited_prompt_text = "Explain the Chinese Room argument with an emphasis on functionalism.";
    let executed_turn = ExecutionService::execute_turn(
        None,
        &pool,
        &vault,
        &session.id,
        edited_prompt_text,
        Some(&proposed.id),
        true, // engineer_edited = true
        None,
        None,
        None,
        None,
    )
    .await
    .expect("Execution failed with edited prompt");

    assert_eq!(executed_turn.user_message.content, edited_prompt_text);

    // Verify prompt history record is marked as 'edited'
    let history = PromptHistoryService::list_for_session(&pool, &session.id).await.unwrap();
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].status, "edited");
    assert_eq!(history[0].prompt_content, edited_prompt_text);
}

#[tokio::test]
async fn test_consecutive_multi_turn_autonomous_execution() {
    let pool = setup_story_architect_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Multi-Turn Engine Project".to_string(),
            description: None,
            settings: None,
        },
    )
    .await
    .unwrap();

    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id,
            title: "Multi-Turn Scientific Discourse".to_string(),
            description: Some("Autonomous multi-turn loop".to_string()),
            interaction_type: Some("technical_discussion".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(4),
            execution_mode: Some("auto_allow".to_string()),
            auto_pause_conditions: None,
            planning_provider_id: Some("mock".to_string()),
            planning_model: Some("mock-llama-3-8b".to_string()),
            inference_provider_id: Some("mock".to_string()),
            inference_model: Some("mock-llama-3-8b".to_string()),
            evaluation_provider_id: Some("mock".to_string()),
            evaluation_model: Some("mock-llama-3-8b".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .unwrap();

    // Execute multi-turn autonomous cycles consecutively
    let mut turns_completed = 0;
    for cycle in 1..=10 {
        let step = StorySessionService::execute_autonomous_step(
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
        .await
        .expect(&format!("Autonomous step failed at cycle {}", cycle));

        assert!(!step.logs.is_empty(), "Step must include execution logs");

        if step.action_taken == "completed" {
            assert_eq!(step.session_status, "completed");
            break;
        }

        assert_eq!(step.action_taken, "turn_executed");
        assert!(step.message.is_some(), "Must generate assistant message");
        assert!(step.evaluation.is_some(), "Must evaluate generated turn");
        assert!(step.narrative_state.is_some(), "Must update narrative state");
        turns_completed += 1;
    }

    // Verify session reached completion
    let session_state = StorySessionService::get_session(&pool, &session.id).await.unwrap();
    assert_eq!(session_state.status, "completed");
    assert!(turns_completed >= 4, "Must complete at least target 4 turns");

    let messages = StorySessionService::list_messages(&pool, &session.id).await.unwrap();
    assert_eq!(messages.len(), turns_completed * 2, "Each turn must have 1 user and 1 assistant message");
}

#[tokio::test]
async fn test_commit_to_sft_db_constraints_and_duplicate_prevention() {
    use sqlx::Row;

    let pool = setup_story_architect_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "SFT Integration Project".to_string(),
            description: None,
            settings: None,
        },
    )
    .await
    .unwrap();

    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id,
            title: "Quantum Mechanics Q&A".to_string(),
            description: None,
            interaction_type: Some("educational_tutoring".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: Some("id".to_string()),
            target_turns: Some(2),
            execution_mode: Some("auto_allow".to_string()),
            auto_pause_conditions: None,
            planning_provider_id: Some("mock".to_string()),
            planning_model: Some("mock-llama-3-8b".to_string()),
            inference_provider_id: Some("mock".to_string()),
            inference_model: Some("mock-llama-3-8b".to_string()),
            evaluation_provider_id: Some("mock".to_string()),
            evaluation_model: Some("mock-llama-3-8b".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .unwrap();

    // Execute 1 turn so conversation has messages
    let _ = StorySessionService::execute_autonomous_step(
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
    .await
    .unwrap();

    // 1. Commit to SFT
    let commit_res = StorySessionService::commit_to_sft(
        &pool,
        CommitToSFTInput {
            session_id: session.id.clone(),
            title: Some("Quantum Superposition Dialogue".to_string()),
            description: Some("SFT dataset export test".to_string()),
            include_planning_metadata: true,
        },
    )
    .await
    .expect("SFT commit must succeed without NOT NULL constraint failures");

    assert!(!commit_res.sft_session_id.is_empty());
    assert!(!commit_res.sft_record_id.is_empty());

    // 2. Validate SQLite columns in sft_sessions
    let row = sqlx::query(
        "SELECT id, status, temperature, top_p, max_tokens, committed_record_id, language_mode FROM sft_sessions WHERE id = ?"
    )
    .bind(&commit_res.sft_session_id)
    .fetch_one(&pool)
    .await
    .expect("Must fetch created sft_session");

    let status: String = row.get("status");
    let temp: f64 = row.get("temperature");
    let top_p: f64 = row.get("top_p");
    let max_tokens: i64 = row.get("max_tokens");
    let committed_record_id: Option<String> = row.get("committed_record_id");
    let lang_mode: String = row.get("language_mode");

    assert_eq!(status, "completed");
    assert!((temp - 0.7).abs() < 1e-4);
    assert!((top_p - 0.9).abs() < 1e-4);
    assert_eq!(max_tokens, 2048);
    assert_eq!(committed_record_id, Some(commit_res.sft_record_id.clone()));
    assert_eq!(lang_mode, "bilingual");

    // 3. Attempt duplicate commit — must be rejected with Validation error!
    let duplicate_res = StorySessionService::commit_to_sft(
        &pool,
        CommitToSFTInput {
            session_id: session.id.clone(),
            title: Some("Duplicate Attempt".to_string()),
            description: None,
            include_planning_metadata: false,
        },
    )
    .await;

    assert!(duplicate_res.is_err(), "Duplicate commit must fail");
    let err = duplicate_res.err().unwrap();
    match err {
        mechon_ai::errors::AppError::Validation(msg) => {
            assert!(msg.contains("already been committed"));
        }
        other => panic!("Expected AppError::Validation, got {:?}", other),
    }
}

#[tokio::test]
async fn test_provider_switching_precedence_and_persistence() {
    let pool = setup_story_architect_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Provider Switching Project".to_string(),
            description: None,
            settings: None,
        },
    )
    .await
    .unwrap();

    // 1. Initially create session configured with 'mock' provider
    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id.clone(),
            title: "Provider Switch Test".to_string(),
            description: None,
            interaction_type: Some("technical_discussion".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(4),
            execution_mode: Some("manual".to_string()),
            auto_pause_conditions: None,
            planning_provider_id: Some("mock".to_string()),
            planning_model: Some("mock-llama-3-8b".to_string()),
            inference_provider_id: Some("mock".to_string()),
            inference_model: Some("mock-llama-3-8b".to_string()),
            evaluation_provider_id: Some("mock".to_string()),
            evaluation_model: Some("mock-llama-3-8b".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .unwrap();

    assert_eq!(session.inference_provider_id.as_deref(), Some("mock"));

    // 2. User simulates switching to 'mock2' in UI header and executes turn
    let res = StorySessionService::approve_and_execute_step(
        None,
        &pool,
        &vault,
        &session.id,
        "Explain Rust ownership and borrow checker guarantees.",
        None,
        false,
        Some("mock2"),
        Some("mock-claude-3-5"),
    )
    .await
    .expect("Execution with switched provider must succeed");

    let asst_msg = res.message.expect("Assistant message must be produced");
    assert_eq!(asst_msg.provider_id.as_deref(), Some("mock2"));
    assert_eq!(asst_msg.model.as_deref(), Some("mock-claude-3-5"));

    // 3. Verify SQLite story_architect_sessions was updated to persist the new provider
    let updated_session = StorySessionService::get_session(&pool, &session.id).await.unwrap();
    assert_eq!(updated_session.inference_provider_id.as_deref(), Some("mock2"));
    assert_eq!(updated_session.inference_model.as_deref(), Some("mock-claude-3-5"));

    // 4. Subsequent call without explicit override should now naturally use the updated session provider ('mock2')
    let res2 = StorySessionService::approve_and_execute_step(
        None,
        &pool,
        &vault,
        &session.id,
        "Can you demonstrate an example of Lifetime annotations?",
        None,
        false,
        None,
        None,
    )
    .await
    .expect("Second execution must use new persisted provider");

    let asst_msg2 = res2.message.expect("Second assistant message must be produced");
    assert_eq!(asst_msg2.provider_id.as_deref(), Some("mock2"));
}

#[tokio::test]
async fn test_story_architect_edit_prompt_and_downstream_invalidation() {
    let pool = setup_story_architect_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Edit & Invalidation Project".to_string(),
            description: None,
            settings: None,
        },
    )
    .await
    .unwrap();

    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id.clone(),
            title: "Investigation".to_string(),
            description: None,
            interaction_type: Some("storytelling".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(6),
            execution_mode: Some("manual".to_string()),
            auto_pause_conditions: None,
            planning_provider_id: Some("mock".to_string()),
            planning_model: Some("mock-llama-3-8b".to_string()),
            inference_provider_id: Some("mock".to_string()),
            inference_model: Some("mock-llama-3-8b".to_string()),
            evaluation_provider_id: Some("mock".to_string()),
            evaluation_model: Some("mock-llama-3-8b".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .unwrap();

    // Generate Turn 0 & 1
    StorySessionService::approve_and_execute_step(
        None,
        &pool,
        &vault,
        &session.id,
        "Prompt 0: We arrived at the abandoned laboratory.",
        None,
        false,
        None,
        None,
    )
    .await
    .unwrap();

    // Generate Turn 2 & 3
    StorySessionService::approve_and_execute_step(
        None,
        &pool,
        &vault,
        &session.id,
        "Prompt 2: We open the blast doors.",
        None,
        false,
        None,
        None,
    )
    .await
    .unwrap();

    let messages = StorySessionService::list_messages(&pool, &session.id).await.unwrap();
    assert_eq!(messages.len(), 4);
    assert_eq!(messages[0].turn_index, 0);
    assert_eq!(messages[1].turn_index, 1);
    assert_eq!(messages[2].turn_index, 2);
    assert_eq!(messages[3].turn_index, 3);

    // Initial state: none are outdated
    for m in &messages {
        assert!(!m.is_outdated, "Initial messages should not be outdated");
        assert_eq!(m.revision_count, 0);
    }

    // Now edit Turn 0 user prompt!
    let edit_res = StorySessionService::edit_message(
        &pool,
        EditStoryMessageInput {
            session_id: session.id.clone(),
            message_id: messages[0].id.clone(),
            content: "Prompt 0 (EDITED): We arrived at the underground bio-research vault.".to_string(),
            reason: Some("Refined location description".to_string()),
        },
    )
    .await
    .expect("Edit message must succeed");

    assert_eq!(edit_res.content, "Prompt 0 (EDITED): We arrived at the underground bio-research vault.");
    assert_eq!(edit_res.revision_count, 1);
    assert!(!edit_res.is_outdated);

    // Verify downstream messages (turn 1, 2, 3) are now marked is_outdated = true!
    let messages_after = StorySessionService::list_messages(&pool, &session.id).await.unwrap();
    assert!(!messages_after[0].is_outdated, "Turn 0 is the edited message itself, not outdated");
    assert!(messages_after[1].is_outdated, "Turn 1 must be marked outdated");
    assert!(messages_after[2].is_outdated, "Turn 2 must be marked outdated");
    assert!(messages_after[3].is_outdated, "Turn 3 must be marked outdated");

    // Verify revision record was created in database
    let revs = StorySessionService::list_message_revisions(&pool, &messages[0].id).await.unwrap();
    assert_eq!(revs.len(), 1);
    assert_eq!(revs[0].turn_index, 0);
    assert_eq!(revs[0].original_content, "Prompt 0: We arrived at the abandoned laboratory.");
    assert_eq!(revs[0].modified_content, "Prompt 0 (EDITED): We arrived at the underground bio-research vault.");
    assert_eq!(revs[0].revision_reason, "Refined location description");
}

#[tokio::test]
async fn test_story_architect_regenerate_assistant_turn() {
    let pool = setup_story_architect_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Regeneration Project".to_string(),
            description: None,
            settings: None,
        },
    )
    .await
    .unwrap();

    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id.clone(),
            title: "Dialogue".to_string(),
            description: None,
            interaction_type: Some("technical_discussion".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(4),
            execution_mode: Some("manual".to_string()),
            auto_pause_conditions: None,
            planning_provider_id: Some("mock".to_string()),
            planning_model: Some("mock-llama-3-8b".to_string()),
            inference_provider_id: Some("mock".to_string()),
            inference_model: Some("mock-llama-3-8b".to_string()),
            evaluation_provider_id: Some("mock".to_string()),
            evaluation_model: Some("mock-llama-3-8b".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .unwrap();

    StorySessionService::approve_and_execute_step(
        None,
        &pool,
        &vault,
        &session.id,
        "What are zero-cost abstractions in Rust?",
        None,
        false,
        None,
        None,
    )
    .await
    .unwrap();

    let msgs = StorySessionService::list_messages(&pool, &session.id).await.unwrap();
    assert_eq!(msgs.len(), 2);
    let original_asst_content = msgs[1].content.clone();

    // Now regenerate Turn 1 with switched provider 'mock2'
    let regen_res = StorySessionService::regenerate_assistant_turn(
        None,
        &pool,
        &vault,
        RegenerateAssistantTurnInput {
            session_id: session.id.clone(),
            turn_index: 1,
            provider_id: Some("mock2".to_string()),
            model: Some("mock-claude-3-5".to_string()),
        },
    )
    .await
    .expect("Regenerating assistant turn must succeed");

    assert_eq!(regen_res.assistant_message.turn_index, 1);
    assert_eq!(regen_res.assistant_message.provider_id.as_deref(), Some("mock2"));
    assert_eq!(regen_res.assistant_message.model.as_deref(), Some("mock-claude-3-5"));
    assert!(!regen_res.assistant_message.is_outdated);

    // Verify old response was preserved in revision history
    let revs = StorySessionService::list_message_revisions(&pool, &msgs[1].id).await.unwrap();
    assert_eq!(revs.len(), 1);
    assert_eq!(revs[0].original_content, original_asst_content);
    assert_eq!(revs[0].revision_reason, "regenerate");
}

#[tokio::test]
async fn test_story_architect_revision_restoration() {
    let pool = setup_story_architect_test_db().await;
    let vault = InMemoryCredentialStore::new();

    let project = ProjectService::create(
        &pool,
        ProjectCreateInput {
            name: "Restore Project".to_string(),
            description: None,
            settings: None,
        },
    )
    .await
    .unwrap();

    let session = StorySessionService::create_session(
        &pool,
        CreateStorySessionInput {
            project_id: project.id.clone(),
            title: "Restore Session".to_string(),
            description: None,
            interaction_type: Some("storytelling".to_string()),
            primary_language: Some("en".to_string()),
            secondary_language: None,
            target_turns: Some(4),
            execution_mode: Some("manual".to_string()),
            auto_pause_conditions: None,
            planning_provider_id: Some("mock".to_string()),
            planning_model: Some("mock-llama-3-8b".to_string()),
            inference_provider_id: Some("mock".to_string()),
            inference_model: Some("mock-llama-3-8b".to_string()),
            evaluation_provider_id: Some("mock".to_string()),
            evaluation_model: Some("mock-llama-3-8b".to_string()),
            planning_agent_config: None,
            inference_agent_config: None,
            evaluation_agent_config: None,
            template_id: None,
        },
    )
    .await
    .unwrap();

    StorySessionService::approve_and_execute_step(
        None,
        &pool,
        &vault,
        &session.id,
        "Original Prompt 0",
        None,
        false,
        None,
        None,
    )
    .await
    .unwrap();

    let msgs = StorySessionService::list_messages(&pool, &session.id).await.unwrap();
    let msg_id = msgs[0].id.clone();

    // Edit message
    StorySessionService::edit_message(
        &pool,
        EditStoryMessageInput {
            session_id: session.id.clone(),
            message_id: msg_id.clone(),
            content: "Modified Prompt 0".to_string(),
            reason: Some("First edit".to_string()),
        },
    )
    .await
    .unwrap();

    let revs = StorySessionService::list_message_revisions(&pool, &msg_id).await.unwrap();
    assert_eq!(revs.len(), 1);
    let rev_id = revs[0].id.clone();

    // Restore revision
    let restored = StorySessionService::restore_message_revision(
        &pool,
        RestoreRevisionInput {
            session_id: session.id.clone(),
            revision_id: rev_id,
        },
    )
    .await
    .expect("Restoring revision must succeed");

    assert_eq!(restored.content, "Original Prompt 0");
    assert_eq!(restored.revision_count, 2);

    // Downstream assistant message must be marked outdated
    let msgs_restored = StorySessionService::list_messages(&pool, &session.id).await.unwrap();
    assert!(msgs_restored[1].is_outdated);
}

#[tokio::test]
async fn test_http_429_rate_limit_diagnostics() {
    use mechon_ai::providers::errors::{ProviderError, ProviderErrorCode};

    let err_body = r#"{"error": {"message": "Rate limit exceeded. Please try again in 30s.", "code": 429}}"#;
    let provider_err = ProviderError::from_status(429, err_body, "https://api.groq.com/openai/v1/chat/completions");

    assert_eq!(provider_err.code, ProviderErrorCode::RateLimited);
    assert!(provider_err.message.contains("Rate limit exceeded") || provider_err.message.contains("rate limit exceeded"));
    assert!(provider_err.message.contains("switch to another provider in the top header"));
    assert!(provider_err.message.contains("try again in 30s"));
}
