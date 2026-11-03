use mechon_ai::providers::models::DiagnosticCheckStatus;
use mechon_ai::providers::factory::ProviderFactory;
use mechon_ai::services::connection_tester::ConnectionTester;

#[tokio::test]
async fn test_mock_provider_full_operational_diagnostics() {
    let report = ConnectionTester::diagnose_provider(
        "mock",
        "Built-in Mock LLM",
        "mock",
        "http://localhost",
        Some("mock-llama-3-8b"),
        None,
        5,
    ).await;

    assert!(report.is_operational, "Mock provider must be 100% operational");
    assert_eq!(report.connection_status, DiagnosticCheckStatus::Pass);
    assert_eq!(report.auth_status, DiagnosticCheckStatus::Pass);
    assert_eq!(report.model_discovery_status, DiagnosticCheckStatus::Pass);
    assert_eq!(report.generation_status, DiagnosticCheckStatus::Pass);
    assert_eq!(report.streaming_status, DiagnosticCheckStatus::Pass);
    assert!(report.models_discovered.len() >= 3);
    assert!(report.streaming_chunk_count > 0);
}

#[tokio::test]
async fn test_anthropic_parameter_exclusivity_and_formatting() {
    let adapter = ProviderFactory::create(
        "anthropic",
        "https://api.anthropic.com/v1",
        Some("test-key".to_string()),
        10,
    );

    // Test Anthropic adapter capabilities
    assert_eq!(adapter.capabilities().streaming, true);
    assert_eq!(adapter.capabilities().reasoning, true);

    // Test Claude 5.5 parameter deprecation detection
    assert!(mechon_ai::providers::anthropic::adapter::AnthropicAdapter::is_sampling_deprecated_for_model("claude-haiku-5-5"));
    assert!(mechon_ai::providers::anthropic::adapter::AnthropicAdapter::is_sampling_deprecated_for_model("claude-sonnet-5-5"));
    assert!(mechon_ai::providers::anthropic::adapter::AnthropicAdapter::is_sampling_deprecated_for_model("claude-opus-5-5"));
    assert!(mechon_ai::providers::anthropic::adapter::AnthropicAdapter::is_sampling_deprecated_for_model("claude-fable-5-1"));
    assert!(!mechon_ai::providers::anthropic::adapter::AnthropicAdapter::is_sampling_deprecated_for_model("claude-3-opus-20240229"));

    let anthropic = mechon_ai::providers::anthropic::adapter::AnthropicAdapter::new(
        "https://api.anthropic.com/v1".to_string(),
        Some("test-key".to_string()),
        10,
        adapter.capabilities(),
    );

    // Test payload for Claude 5.5 (temperature must NOT be included)
    let req_claude_5 = mechon_ai::providers::models::ChatRequest {
        model: "claude-haiku-5-5".to_string(),
        messages: vec![
            mechon_ai::providers::models::ChatMessage {
                role: "system".to_string(),
                content: "Be helpful.".to_string(),
            },
            mechon_ai::providers::models::ChatMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
            },
        ],
        temperature: Some(0.7),
        top_p: Some(0.9),
        max_tokens: Some(1024),
        stream: false,
    };

    let payload_5 = anthropic.build_payload(&req_claude_5, false, false);
    assert_eq!(payload_5.get("model").unwrap(), "claude-haiku-5-5");
    assert_eq!(payload_5.get("max_tokens").unwrap(), 1024);
    assert_eq!(payload_5.get("system").unwrap(), "Be helpful.");
    assert!(payload_5.get("temperature").is_none(), "Temperature must be omitted for Claude 5.5");
    assert!(payload_5.get("top_p").is_none(), "Top_p must be omitted for Claude 5.5");

    // Test payload for legacy Claude 3 model (temperature is preserved)
    let req_claude_3 = mechon_ai::providers::models::ChatRequest {
        model: "claude-3-opus-20240229".to_string(),
        messages: vec![
            mechon_ai::providers::models::ChatMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
            },
        ],
        temperature: Some(0.7),
        top_p: None,
        max_tokens: Some(1024),
        stream: false,
    };
    let payload_3 = anthropic.build_payload(&req_claude_3, false, false);
    assert_eq!(payload_3.get("temperature").unwrap(), 0.7);

    // Test 400 error diagnostics formatting
    let fake_400 = r#"{"type":"error","error":{"type":"invalid_request_error","message":"'temperature' is deprecated for this model."},"request_id":"req_test123"}"#;
    let err = mechon_ai::providers::anthropic::adapter::AnthropicAdapter::format_anthropic_error(
        400,
        fake_400,
        "https://api.anthropic.com/v1/messages",
        "claude-haiku-5-5",
        &payload_5,
    );
    assert!(err.message.contains("Parameter 'temperature' is not supported"));
    assert!(err.message.contains("req_test123"));
    assert!(err.message.contains("claude-haiku-5-5"));
}

#[tokio::test]
async fn test_openai_reasoning_model_detection() {
    let adapter = ProviderFactory::create(
        "openai",
        "https://api.openai.com/v1",
        Some("sk-test-key".to_string()),
        10,
    );

    assert_eq!(adapter.capabilities().streaming, true);
    assert_eq!(adapter.capabilities().tool_use, true);
}

#[tokio::test]
async fn test_ollama_adapter_initialization() {
    let adapter = ProviderFactory::create(
        "ollama",
        "http://localhost:11434",
        None,
        10,
    );

    assert_eq!(adapter.capabilities().streaming, true);
}
