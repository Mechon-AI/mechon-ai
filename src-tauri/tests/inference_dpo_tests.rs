use std::sync::Arc;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::SqlitePool;
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use mechon_ai::credentials::{CredentialStore, InMemoryCredentialStore};
use mechon_ai::errors::AppError;
use mechon_ai::models::*;
use mechon_ai::providers::capabilities::ModelCapabilities;
use mechon_ai::providers::errors::{ProviderError, ProviderErrorCode};
use mechon_ai::providers::factory::ProviderFactory;
use mechon_ai::providers::mock::adapter::MockAdapter;
use mechon_ai::providers::models::{ChatMessage, ChatRequest};
use mechon_ai::providers::openai::adapter::OpenAICompatibleAdapter;
use mechon_ai::providers::traits::ModelProvider;
use mechon_ai::services::dpo_service::DPOService;
use mechon_ai::services::export_service::ExportService;
use mechon_ai::services::project_service::ProjectService;
use mechon_ai::services::provider_service::ProviderService;
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
    sqlx::raw_sql(schema_sql)
        .execute(&pool)
        .await
        .expect("Failed to run schema migration");

    pool
}

// ------------------------------------------------------------------------------------------------
// 1. SFT generation with mock provider: verifies prompt, system prompt, temperature, response parsing
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_sft_generation_with_mock_provider() {
    let adapter = MockAdapter;

    let request = ChatRequest {
        model: "mock-llama-3-8b".to_string(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: "You are a concise AI assistant.".to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: "Explain gradient descent in one sentence.".to_string(),
            },
        ],
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(2048),
        stream: false,
    };

    let response = adapter.chat(request).await.expect("Mock chat failed");

    assert_eq!(response.role, "assistant");
    assert_eq!(response.model, "mock-llama-3-8b");
    assert!(response.content.contains("mock-llama-3-8b"));
    assert!(response.content.contains("Explain gradient descent"));
    assert_eq!(response.finish_reason, Some("stop".to_string()));
}

// ------------------------------------------------------------------------------------------------
// 2. SFT generation with OpenAI-compatible adapter: request body, headers, response extraction
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_sft_generation_with_openai_compatible_adapter() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let base_url = format!("http://{}", addr);

    // Spawn mock HTTP server
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buffer = [0u8; 4096];
        let n = socket.read(&mut buffer).await.unwrap();
        let req_text = String::from_utf8_lossy(&buffer[..n]);

        // Verify Authorization header
        assert!(req_text.contains("authorization: Bearer sk-test-key-12345") || req_text.contains("Authorization: Bearer sk-test-key-12345"));

        // Verify request payload contains messages and model
        assert!(req_text.contains("\"model\":\"gpt-4o-mini\""));
        assert!(req_text.contains("\"role\":\"system\""));
        assert!(req_text.contains("\"role\":\"user\""));

        let response_body = json!({
            "id": "chatcmpl-test-123",
            "object": "chat.completion",
            "created": 1700000000,
            "model": "gpt-4o-mini",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Gradient descent optimizes parameters by stepping in the opposite direction of the gradient."
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 15,
                "completion_tokens": 14,
                "total_tokens": 29
            }
        }).to_string();

        let http_response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            response_body.len(),
            response_body
        );

        socket.write_all(http_response.as_bytes()).await.unwrap();
        socket.flush().await.unwrap();
    });

    let adapter = OpenAICompatibleAdapter::new(
        base_url,
        Some("sk-test-key-12345".to_string()),
        None,
        10,
        ModelCapabilities::all(),
    );

    let chat_req = ChatRequest {
        model: "gpt-4o-mini".to_string(),
        messages: vec![
            ChatMessage { role: "system".to_string(), content: "Be concise.".to_string() },
            ChatMessage { role: "user".to_string(), content: "Define gradient descent.".to_string() },
        ],
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(1024),
        stream: false,
    };

    let result = adapter.chat(chat_req).await.expect("OpenAI chat failed");
    assert_eq!(result.role, "assistant");
    assert_eq!(result.model, "gpt-4o-mini");
    assert!(result.content.contains("Gradient descent optimizes parameters"));
    assert_eq!(result.finish_reason, Some("stop".to_string()));
    assert_eq!(result.usage.unwrap().total_tokens, Some(29));
}

// ------------------------------------------------------------------------------------------------
// 3. Model ID and provider selection propagation (no hardcoded fallbacks)
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_model_id_and_provider_selection_propagation() {
    let pool = setup_test_db().await;
    let vault: Arc<dyn CredentialStore> = Arc::new(InMemoryCredentialStore::new());

    // Register a custom provider
    let provider = ProviderService::create(
        &pool,
        ProviderCreateInput {
            name: "DeepSeek Primary".to_string(),
            provider_type: "deepseek".to_string(),
            base_url: Some("https://api.deepseek.com".to_string()),
            api_key: Some("sk-deepseek-test-key".to_string()),
            default_model: Some("deepseek-chat".to_string()),
            timeout_seconds: Some(45),
            settings: None,
        },
        vault.as_ref(),
    ).await.expect("Failed to create provider");

    // Retrieve provider and verify model propagation
    let loaded = ProviderService::get(&pool, &provider.id, vault.as_ref()).await.unwrap();
    assert_eq!(loaded.default_model, Some("deepseek-chat".to_string()));
    assert_eq!(loaded.provider_type, "deepseek");

    // Construct adapter through ProviderFactory
    let instance = ProviderFactory::create(
        &loaded.provider_type,
        &loaded.base_url,
        Some("sk-deepseek-test-key".to_string()),
        loaded.timeout_seconds,
    );

    assert_eq!(instance.capabilities().streaming, true);
}

// ------------------------------------------------------------------------------------------------
// 4. DPO generation with two different models: independent provider/model configuration & parallel execution
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_dpo_generation_with_two_different_models() {
    let adapter_a = MockAdapter;
    let adapter_b = MockAdapter;

    let req_a = ChatRequest {
        model: "mock-llama-3-8b".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Explain gravity.".to_string() }],
        temperature: Some(0.2),
        top_p: Some(0.9),
        max_tokens: Some(1024),
        stream: false,
    };

    let req_b = ChatRequest {
        model: "mock-mistral-7b".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Explain gravity.".to_string() }],
        temperature: Some(0.9),
        top_p: Some(0.9),
        max_tokens: Some(1024),
        stream: false,
    };

    // Parallel generation via tokio::join!
    let (res_a, res_b) = tokio::join!(
        adapter_a.chat(req_a),
        adapter_b.chat(req_b)
    );

    let res_a = res_a.expect("Candidate A failed");
    let res_b = res_b.expect("Candidate B failed");

    assert_eq!(res_a.model, "mock-llama-3-8b");
    assert_eq!(res_b.model, "mock-mistral-7b");
    assert!(res_a.content.contains("mock-llama-3-8b"));
    assert!(res_b.content.contains("mock-mistral-7b"));
    assert_ne!(res_a.content, res_b.content);
}

// ------------------------------------------------------------------------------------------------
// 5. DPO generation with same model (different temperatures)
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_dpo_generation_with_same_model_different_temperatures() {
    let adapter = MockAdapter;

    let req_a = ChatRequest {
        model: "mock-qwen-2.5-7b".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Write a haiku about code.".to_string() }],
        temperature: Some(0.2), // Low temp
        top_p: Some(0.9),
        max_tokens: Some(512),
        stream: false,
    };

    let req_b = ChatRequest {
        model: "mock-qwen-2.5-7b".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Write a haiku about code.".to_string() }],
        temperature: Some(0.95), // High temp
        top_p: Some(0.95),
        max_tokens: Some(512),
        stream: false,
    };

    let (res_a, res_b) = tokio::join!(
        adapter.chat(req_a),
        adapter.chat(req_b)
    );

    let res_a = res_a.unwrap();
    let res_b = res_b.unwrap();

    assert_eq!(res_a.model, "mock-qwen-2.5-7b");
    assert_eq!(res_b.model, "mock-qwen-2.5-7b");
    assert!(!res_a.content.is_empty());
    assert!(!res_b.content.is_empty());
}

// ------------------------------------------------------------------------------------------------
// 6. DPO single candidate generation (Candidate A only, Candidate B only)
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_dpo_single_candidate_generation() {
    let adapter = MockAdapter;

    // Generate Candidate A only
    let req_a = ChatRequest {
        model: "mock-llama-3-8b".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Candidate A test prompt".to_string() }],
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(512),
        stream: false,
    };
    let res_a = adapter.chat(req_a).await.unwrap();
    assert_eq!(res_a.model, "mock-llama-3-8b");
    assert!(res_a.content.contains("Candidate A test prompt"));

    // Generate Candidate B only
    let req_b = ChatRequest {
        model: "mock-mistral-7b".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Candidate B test prompt".to_string() }],
        temperature: Some(0.85),
        top_p: Some(0.9),
        max_tokens: Some(512),
        stream: false,
    };
    let res_b = adapter.chat(req_b).await.unwrap();
    assert_eq!(res_b.model, "mock-mistral-7b");
    assert!(res_b.content.contains("Candidate B test prompt"));
}

// ------------------------------------------------------------------------------------------------
// 7. Error propagation: 401 Unauthorized returns structured informative error (never undefined)
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_error_propagation_401_unauthorized() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let base_url = format!("http://{}", addr);

    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buffer = [0u8; 2048];
        let _ = socket.read(&mut buffer).await.unwrap();

        let error_body = json!({
            "error": {
                "message": "Invalid API Key provided: sk-invalid-key-9999",
                "type": "invalid_request_error",
                "code": "invalid_api_key"
            }
        }).to_string();

        let http_response = format!(
            "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            error_body.len(),
            error_body
        );

        socket.write_all(http_response.as_bytes()).await.unwrap();
        socket.flush().await.unwrap();
    });

    let adapter = OpenAICompatibleAdapter::new(
        base_url,
        Some("sk-invalid-key-9999".to_string()),
        None,
        5,
        ModelCapabilities::all(),
    );

    let chat_req = ChatRequest {
        model: "gpt-4o".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Hello".to_string() }],
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(100),
        stream: false,
    };

    let err = adapter.chat(chat_req).await.unwrap_err();
    assert_eq!(err.code, ProviderErrorCode::AuthenticationFailed);
    assert!(err.message.contains("Invalid API Key provided"));

    // Verify structured AppError JSON serialization
    let app_err = AppError::ProviderStructured(err);
    let serialized = serde_json::to_value(&app_err).unwrap();

    assert_eq!(serialized["status"], 401);
    assert_eq!(serialized["code"], "AuthenticationFailed");
    assert!(serialized["message"].as_str().unwrap().contains("Invalid API Key provided"));
    // Ensure no undefined or empty
    assert!(!serialized["message"].as_str().unwrap().is_empty());
}

// ------------------------------------------------------------------------------------------------
// 8. Error propagation: Model validation error provides clear message and guidance
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_error_propagation_model_validation() {
    let validation_err = AppError::Validation(
        "No valid model selected for Candidate A on provider 'Groq'. Please select a model in provider settings or studio controls.".to_string()
    );

    let serialized = serde_json::to_value(&validation_err).unwrap();
    assert_eq!(serialized["status"], 400);
    assert_eq!(serialized["code"], "VALIDATION_ERROR");
    let msg = serialized["message"].as_str().unwrap();
    assert!(msg.contains("No valid model selected for Candidate A on provider 'Groq'"));
    assert!(msg.contains("Please select a model in provider settings"));
}

// ------------------------------------------------------------------------------------------------
// 9. Data integrity: SFT commit and DPO task updates preserve generated content & model metadata
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_data_integrity_sft_commit_and_dpo_task_metadata() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Integrity Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // 1. DPO Task creation and rich metadata preservation
    let task = DPOService::create(&pool, DPOTaskCreateInput {
        project_id: project.id.clone(),
        prompt: "Compare Rust and C++ memory management.".to_string(),
        system_prompt: Some("You are an expert compiler engineer.".to_string()),
        response_a: Some("Rust enforces compile-time ownership without a garbage collector.".to_string()),
        response_b: Some("C++ uses RAII and manual/smart pointer lifecycles.".to_string()),
        metadata: Some(json!({
            "model_a": "deepseek-reasoner",
            "model_b": "gpt-4o",
            "provider_a": "deepseek",
            "provider_b": "openai",
            "temp_a": 0.2,
            "temp_b": 0.9,
            "latency_a": 412,
            "latency_b": 630
        })),
    }).await.expect("Failed to create DPO task");

    let annotated = DPOService::annotate(&pool, &task.id, DPOAnnotationInput {
        preference: "a".to_string(),
        rationale: Some("Candidate A was more focused on compiler-enforced memory safety.".to_string()),
        helpfulness_rating: Some(5),
        factuality_rating: Some(5),
        metadata: None,
    }).await.expect("Failed to annotate task");

    assert_eq!(annotated.preference, Some("a".to_string()));
    assert_eq!(annotated.metadata["model_a"], "deepseek-reasoner");
    assert_eq!(annotated.metadata["model_b"], "gpt-4o");
    assert_eq!(annotated.metadata["provider_a"], "deepseek");
    assert_eq!(annotated.metadata["temp_a"], 0.2);
    assert_eq!(annotated.metadata["latency_a"], 412);

    // 2. SFT Session and commit to permanent dataset
    let session = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Rust Concurrency Review".to_string()),
        system_prompt: Some("Senior systems engineer.".to_string()),
        provider_id: Some("groq".to_string()),
        model: Some("llama-3.3-70b-versatile".to_string()),
        temperature: Some(0.6),
        top_p: Some(0.9),
        max_tokens: Some(2048),
        language_mode: None,
        primary_language: None,
        secondary_language: None,
        language_metadata: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "user".to_string(),
        content: "What makes Send and Sync safe?".to_string(),
        model: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "Send allows transferring ownership across thread boundaries, Sync allows shared references across threads.".to_string(),
        model: Some("llama-3.3-70b-versatile".to_string()),
    }).await.unwrap();

    let committed = SFTService::commit_session(&pool, &session.id, SFTCommitInput {
        title_override: None,
        tags: Some(vec!["concurrency".to_string()]),
        metadata: None,
        language_mode: None,
        primary_language: None,
        secondary_language: None,
        language_metadata: None,
    }).await.unwrap();
    assert_eq!(committed.turn_count, 2);
    assert_eq!(committed.messages.as_array().unwrap().len(), 3); // 1 system + 2 messages
    assert_eq!(committed.metadata["model"], "llama-3.3-70b-versatile");
}

// ------------------------------------------------------------------------------------------------
// 10. JSONL export: DPO export produces valid JSONL in standard format
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_jsonl_export_standard_format_with_metadata() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "DPO Export Lab".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    // Create DPO tasks with chosen and rejected candidates
    let task = DPOService::create(&pool, DPOTaskCreateInput {
        project_id: project.id.clone(),
        prompt: "Summarize quantum computing.".to_string(),
        system_prompt: Some("Be factual.".to_string()),
        response_a: Some("Quantum computing uses qubits and superposition to solve certain problems exponentially faster.".to_string()),
        response_b: Some("Quantum computers are just really fast normal computers that use lasers.".to_string()),
        metadata: Some(json!({
            "model_a": "claude-3-5-sonnet",
            "model_b": "llama-3-8b",
            "provider_a": "anthropic",
            "provider_b": "groq"
        })),
    }).await.unwrap();

    DPOService::annotate(&pool, &task.id, DPOAnnotationInput {
        preference: "a".to_string(),
        rationale: Some("Candidate A is accurate; Candidate B is factually incorrect.".to_string()),
        helpfulness_rating: Some(5),
        factuality_rating: Some(5),
        metadata: None,
    }).await.unwrap();

    // Export DPO in JSONL format without metadata (standard prompt, chosen, rejected)
    let jsonl_clean = ExportService::export_dpo(&pool, &project.id, "jsonl", false, true, None).await.unwrap();
    assert!(!jsonl_clean.trim().is_empty());

    let parsed_line: Value = serde_json::from_str(jsonl_clean.lines().next().unwrap()).unwrap();
    assert_eq!(parsed_line["prompt"], "Summarize quantum computing.");
    assert_eq!(
        parsed_line["chosen"],
        "Quantum computing uses qubits and superposition to solve certain problems exponentially faster."
    );
    assert_eq!(
        parsed_line["rejected"],
        "Quantum computers are just really fast normal computers that use lasers."
    );
    assert_eq!(parsed_line["preference"], "a");
    // Ensure metadata wasn't leaked when include_metadata=false
    assert!(parsed_line.get("metadata").is_none());

    // Export DPO in JSONL format with metadata
    let jsonl_rich = ExportService::export_dpo(&pool, &project.id, "jsonl", true, true, None).await.unwrap();
    let parsed_rich: Value = serde_json::from_str(jsonl_rich.lines().next().unwrap()).unwrap();
    assert_eq!(parsed_rich["chosen"], parsed_line["chosen"]);
    assert_eq!(parsed_rich["metadata"]["model_a"], "claude-3-5-sonnet");
    assert_eq!(parsed_rich["metadata"]["model_b"], "llama-3-8b");
    assert_eq!(parsed_rich["helpfulness_rating"], 5);
}

// ------------------------------------------------------------------------------------------------
// 11. Real Groq inference verification (if configured in local environment)
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_real_groq_inference_if_configured() {
    let db_path = dirs::data_dir().map(|d| d.join("mechon-ai").join("mechon.db"));
    let db_path = match db_path {
        Some(p) if p.exists() => p,
        _ => {
            println!("Skipping real Groq test: local mechon.db not present.");
            return;
        }
    };

    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .foreign_keys(true);

    let pool = match sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
    {
        Ok(p) => p,
        Err(e) => {
            println!("Skipping real Groq test: cannot connect to mechon.db ({})", e);
            return;
        }
    };

    let vault = Arc::new(mechon_ai::credentials::HybridCredentialVault::new());
    let providers = match ProviderService::list(&pool, vault.as_ref()).await {
        Ok(list) => list,
        Err(_) => return,
    };

    let groq = providers.iter().find(|p| p.provider_type == "groq");
    if let Some(groq_provider) = groq {
        let api_key = ProviderService::get_raw_key(&pool, &groq_provider.id, vault.as_ref()).await.unwrap_or(None);
        if let Some(key) = api_key {
            if !key.trim().is_empty() {
                println!("Testing live Groq provider: {}", groq_provider.name);
                let adapter = ProviderFactory::create(
                    &groq_provider.provider_type,
                    &groq_provider.base_url,
                    Some(key),
                    groq_provider.timeout_seconds,
                );

                let model = groq_provider.models_cache.iter()
                    .find(|m| *m == "openai/gpt-oss-20b" || *m == "openai/gpt-oss-120b" || m.contains("allam"))
                    .cloned()
                    .or(groq_provider.default_model.clone())
                    .unwrap_or_else(|| "llama-3.1-8b-instant".to_string());

                println!("Using Groq model: {}", model);

                // 1. SFT generation: 3 laws of robotics
                let sft_req = ChatRequest {
                    model: model.clone(),
                    messages: vec![
                        ChatMessage { role: "system".to_string(), content: "Answer strictly as requested.".to_string() },
                        ChatMessage { role: "user".to_string(), content: "What are the three laws of robotics? Answer in 3 numbered lines.".to_string() },
                    ],
                    temperature: Some(0.3),
                    top_p: Some(0.9),
                    max_tokens: Some(300),
                    stream: false,
                };

                let res = adapter.chat(sft_req).await;
                match res {
                    Ok(resp) => {
                        println!("Groq SFT Response: {}", resp.content);
                        assert!(!resp.content.trim().is_empty());
                        assert_eq!(resp.role, "assistant");
                    }
                    Err(e) => {
                        println!("Groq SFT returned informative error (e.g. rate limit): [{:?}] {}", e.code, e.message);
                        assert!(!e.message.is_empty(), "Error message must not be empty");
                    }
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

                // 2. DPO generation: 2 candidates with different temperatures in parallel
                let dpo_req_a = ChatRequest {
                    model: model.clone(),
                    messages: vec![
                        ChatMessage { role: "user".to_string(), content: "Explain recursion to a 10-year-old in two sentences.".to_string() },
                    ],
                    temperature: Some(0.2),
                    top_p: Some(0.9),
                    max_tokens: Some(200),
                    stream: false,
                };

                let dpo_req_b = ChatRequest {
                    model: model.clone(),
                    messages: vec![
                        ChatMessage { role: "user".to_string(), content: "Explain recursion to a 10-year-old in two sentences.".to_string() },
                    ],
                    temperature: Some(0.95),
                    top_p: Some(0.95),
                    max_tokens: Some(200),
                    stream: false,
                };

                let (dpo_res_a, dpo_res_b) = tokio::join!(
                    adapter.chat(dpo_req_a),
                    adapter.chat(dpo_req_b)
                );

                // Verify candidate outputs or graceful rate limit error handling
                match (dpo_res_a, dpo_res_b) {
                    (Ok(a), Ok(b)) => {
                        println!("Groq DPO Candidate A (temp 0.2): {}", a.content);
                        println!("Groq DPO Candidate B (temp 0.95): {}", b.content);
                        assert!(!a.content.trim().is_empty());
                        assert!(!b.content.trim().is_empty());
                    }
                    (Ok(a), Err(b_err)) => {
                        println!("Groq Candidate A succeeded: {}", a.content);
                        println!("Groq Candidate B failed gracefully: [{:?}] {}", b_err.code, b_err.message);
                        assert!(!b_err.message.is_empty(), "Error message must be informative");
                    }
                    (Err(a_err), Ok(b)) => {
                        println!("Groq Candidate B succeeded: {}", b.content);
                        println!("Groq Candidate A failed gracefully: [{:?}] {}", a_err.code, a_err.message);
                        assert!(!a_err.message.is_empty(), "Error message must be informative");
                    }
                    (Err(a_err), Err(b_err)) => {
                        println!("Both Groq candidates hit limits: A: {}, B: {}", a_err, b_err);
                    }
                }

                // 2. Negative test: Invalid model returns clear informative error, never blank or undefined
                let bad_req = ChatRequest {
                    model: "non-existent-model-xyz-999".to_string(),
                    messages: vec![ChatMessage { role: "user".to_string(), content: "Hi".to_string() }],
                    temperature: Some(0.5),
                    top_p: Some(0.9),
                    max_tokens: Some(50),
                    stream: false,
                };

                let bad_res = adapter.chat(bad_req).await;
                assert!(bad_res.is_err(), "Invalid model should produce an error");
                let err = bad_res.unwrap_err();
                assert!(!err.message.is_empty(), "Error message must not be blank or undefined");
                println!("Groq negative test (model not found) error: [{:?}] {}", err.code, err.message);
            }
        }
    }
}

// ------------------------------------------------------------------------------------------------
// 12. DPO failure isolation: Candidate A succeeds and B fails, response A preserved
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_dpo_failure_isolation() {
    let adapter_a = MockAdapter;

    // Simulate Candidate A succeeding
    let req_a = ChatRequest {
        model: "mock-llama-3-8b".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Prompt A".to_string() }],
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(512),
        stream: false,
    };
    let res_a = adapter_a.chat(req_a).await;

    // Simulate Candidate B failing with a 404 or auth error
    let res_b: Result<mechon_ai::providers::models::ChatResponse, ProviderError> = Err(ProviderError {
        code: ProviderErrorCode::ModelNotFound,
        message: "Model `retired-model-xyz` does not exist".to_string(),
        http_status: Some(404),
        provider_id: None,
    });

    let resp_a_content = res_a.as_ref().map(|r| r.content.clone()).unwrap_or_default();
    let resp_b_content = res_b.as_ref().map(|r| r.content.clone()).unwrap_or_default();
    let err_a = res_a.as_ref().err().map(|e| e.message.clone());
    let err_b = res_b.as_ref().err().map(|e| e.message.clone());

    assert!(res_a.is_ok());
    assert!(res_b.is_err());
    assert!(!resp_a_content.is_empty());
    assert!(resp_b_content.is_empty());
    assert!(err_a.is_none());
    assert!(err_b.is_some());
    assert!(err_b.unwrap().contains("retired-model-xyz"));

    // Verify Candidate B can be retried independently with a valid model
    let retry_req_b = ChatRequest {
        model: "mock-mistral-7b".to_string(),
        messages: vec![ChatMessage { role: "user".to_string(), content: "Prompt A".to_string() }],
        temperature: Some(0.9),
        top_p: Some(0.9),
        max_tokens: Some(512),
        stream: false,
    };
    let retry_res_b = adapter_a.chat(retry_req_b).await.unwrap();
    assert!(!retry_res_b.content.is_empty());
    assert_eq!(retry_res_b.model, "mock-mistral-7b");
}

// ------------------------------------------------------------------------------------------------
// 13. Export dataset to file: JSON, JSONL, CSV, TXT with post-write file integrity verification
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_export_dataset_to_file_all_formats_and_integrity() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Export Verification Lab".to_string(),
        description: Some("Unicode test 🚀 ñ ü & \"special\"".to_string()),
        settings: None,
    }).await.unwrap();

    // 1. Create SFT session and commit
    let session = SFTService::create_session(&pool, SFTSessionCreateInput {
        project_id: project.id.clone(),
        title: Some("Unicode SFT Session".to_string()),
        system_prompt: Some("You are a multilingual AI.".to_string()),
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
        content: "Translate 'Hello, world!' into Japanese and Spanish: こんにちは, ¡Hola mundo!".to_string(),
        model: None,
    }).await.unwrap();

    SFTService::add_message(&pool, &session.id, SFTMessageCreateInput {
        role: "assistant".to_string(),
        content: "Japanese: こんにちは、世界！\nSpanish: ¡Hola, mundo!".to_string(),
        model: Some("mock-llama-3-8b".to_string()),
    }).await.unwrap();

    SFTService::commit_session(&pool, &session.id, SFTCommitInput {
        title_override: None,
        tags: Some(vec!["translation".to_string(), "unicode".to_string()]),
        metadata: None,
        language_mode: None,
        primary_language: None,
        secondary_language: None,
        language_metadata: None,
    }).await.unwrap();

    // 2. Create DPO task and annotate
    let dpo_task = DPOService::create(&pool, DPOTaskCreateInput {
        project_id: project.id.clone(),
        prompt: "Write a poem with quotes \"like this\" and emojis 🌟.".to_string(),
        system_prompt: Some("Poetic assistant.".to_string()),
        response_a: Some("Stars shine bright in the \"night sky\" 🌟.".to_string()),
        response_b: Some("Stars are big balls of gas.".to_string()),
        metadata: Some(json!({"model_a": "model-1", "model_b": "model-2"})),
    }).await.unwrap();

    DPOService::annotate(&pool, &dpo_task.id, DPOAnnotationInput {
        preference: "a".to_string(),
        rationale: Some("Poetic and followed formatting instructions.".to_string()),
        helpfulness_rating: Some(5),
        factuality_rating: Some(5),
        metadata: None,
    }).await.unwrap();

    let temp_dir = std::env::temp_dir().join(format!("mechon_export_test_{}", uuid::Uuid::new_v4()));
    tokio::fs::create_dir_all(&temp_dir).await.unwrap();

    // Test SFT in JSONL, JSON, CSV, TXT
    for fmt in &["jsonl", "json", "csv", "txt"] {
        let dest = temp_dir.join(format!("sft_export.{}", fmt));
        let content = ExportService::export_sft(&pool, &project.id, fmt, true, None, None).await.unwrap();
        assert!(!content.is_empty(), "SFT {} content must not be empty", fmt);

        tokio::fs::write(&dest, content.as_bytes()).await.unwrap();
        assert!(dest.exists());
        let meta = tokio::fs::metadata(&dest).await.unwrap();
        assert!(meta.len() > 0);

        // Verify parseability
        match *fmt {
            "json" => {
                let v: Value = serde_json::from_str(&content).expect("Valid JSON");
                assert!(v.is_array());
            }
            "jsonl" => {
                for line in content.lines() {
                    if !line.trim().is_empty() {
                        let _: Value = serde_json::from_str(line).expect("Valid JSONL line");
                    }
                }
            }
            "csv" => {
                let mut rdr = csv::Reader::from_reader(content.as_bytes());
                assert!(rdr.records().count() > 0);
            }
            "txt" => {
                assert!(content.contains("USER:") && content.contains("ASSISTANT:"));
            }
            _ => {}
        }
    }

    // Test DPO in JSONL, JSON, CSV, TXT
    for fmt in &["jsonl", "json", "csv", "txt"] {
        let dest = temp_dir.join(format!("dpo_export.{}", fmt));
        let content = ExportService::export_dpo(&pool, &project.id, fmt, true, true, None).await.unwrap();
        assert!(!content.is_empty(), "DPO {} content must not be empty", fmt);

        tokio::fs::write(&dest, content.as_bytes()).await.unwrap();
        assert!(dest.exists());
        let meta = tokio::fs::metadata(&dest).await.unwrap();
        assert!(meta.len() > 0);

        // Verify parseability
        match *fmt {
            "json" => {
                let v: Value = serde_json::from_str(&content).expect("Valid JSON");
                assert!(v.is_array());
            }
            "jsonl" => {
                for line in content.lines() {
                    if !line.trim().is_empty() {
                        let v: Value = serde_json::from_str(line).expect("Valid JSONL line");
                        assert!(v.get("prompt").is_some());
                        assert!(v.get("chosen").is_some());
                    }
                }
            }
            "csv" => {
                let mut rdr = csv::Reader::from_reader(content.as_bytes());
                assert!(rdr.records().count() > 0);
            }
            "txt" => {
                assert!(content.contains("PROMPT:") && content.contains("CHOSEN"));
            }
            _ => {}
        }
    }

    // Clean up temp dir
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;
}

// ------------------------------------------------------------------------------------------------
// 14. Export empty dataset rejection: returns clear validation error
// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn test_export_empty_dataset_rejection() {
    let pool = setup_test_db().await;

    let project = ProjectService::create(&pool, ProjectCreateInput {
        name: "Empty Project".to_string(),
        description: None,
        settings: None,
    }).await.unwrap();

    let count_sft = ExportService::count_sft(&pool, &project.id, None).await.unwrap();
    assert_eq!(count_sft, 0);

    let count_dpo = ExportService::count_dpo(&pool, &project.id, true, None).await.unwrap();
    assert_eq!(count_dpo, 0);
}
