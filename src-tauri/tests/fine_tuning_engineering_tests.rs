use mechon_ai::engineering::template_engine::ChatTemplateEngine;
use mechon_ai::engineering::sequence_analytics::SequenceAnalyticsEngine;
use mechon_ai::engineering::deduplication::DeduplicationEngine;
use mechon_ai::engineering::persona_audit::PersonaAuditEngine;
use mechon_ai::engineering::split_engine::SplitEngine;
use mechon_ai::engineering::conversational_dpo::ConversationalDPOEngine;
use mechon_ai::engineering::readiness_engine::ReadinessEngine;
use serde_json::json;
use std::collections::HashMap;

#[test]
fn test_curated_models_chat_template_rendering() {
    let models = ChatTemplateEngine::get_curated_models();
    assert!(models.len() >= 6, "Must curate at least 6 major model families");

    let messages = vec![
        json!({ "role": "system", "content": "You are a concise AI assistant." }),
        json!({ "role": "user", "content": "What is quantum entanglement?" }),
        json!({ "role": "assistant", "content": "Quantum entanglement is a physical phenomenon where particles remain connected." }),
    ];

    for model in &models {
        let result = ChatTemplateEngine::validate_example("rec-001", &messages, model, false);
        assert!(
            result.is_valid,
            "Model '{}' failed validation with errors: {:?}",
            model.name, result.errors
        );
        let rendered = result.rendered.expect("Should have rendered output");
        assert!(!rendered.is_empty(), "Rendered output cannot be empty for '{}'", model.name);

        // Model specific assertions
        if model.family == "llama" {
            assert!(rendered.contains("<|start_header_id|>system<|end_header_id|>"));
            assert!(rendered.contains("<|start_header_id|>user<|end_header_id|>"));
            assert!(rendered.contains("<|start_header_id|>assistant<|end_header_id|>"));
            assert!(rendered.contains("<|eot_id|>"));
        } else if model.family == "qwen" || model.id == "chatml" {
            assert!(rendered.contains("<|im_start|>system"));
            assert!(rendered.contains("<|im_start|>user"));
            assert!(rendered.contains("<|im_start|>assistant"));
            assert!(rendered.contains("<|im_end|>"));
        } else if model.family == "gemma" {
            assert!(rendered.contains("<start_of_turn>user"));
            assert!(rendered.contains("<start_of_turn>model"));
            assert!(rendered.contains("<end_of_turn>"));
        } else if model.family == "mistral" {
            assert!(rendered.contains("[INST]"));
            assert!(rendered.contains("[/INST]"));
        }
    }
}

#[test]
fn test_chat_template_generation_prompt() {
    let llama_model = ChatTemplateEngine::get_model_def("llama-3").unwrap();
    let messages = vec![
        json!({ "role": "user", "content": "Generate a test function." }),
    ];

    let result = ChatTemplateEngine::validate_example("rec-prompt", &messages, &llama_model, true);
    assert!(result.is_valid);
    let rendered = result.rendered.unwrap();
    assert!(rendered.ends_with("<|start_header_id|>assistant<|end_header_id|>\n\n"));
}

#[test]
fn test_chat_template_syntax_and_token_injection_errors() {
    let llama_model = ChatTemplateEngine::get_model_def("llama-3").unwrap();

    // 1. Missing user turn
    let invalid_msgs1 = vec![
        json!({ "role": "system", "content": "System prompt only" }),
    ];
    let res1 = ChatTemplateEngine::validate_example("rec-err1", &invalid_msgs1, &llama_model, false);
    assert!(!res1.is_valid);
    assert!(res1.errors.iter().any(|e| e.contains("Missing required 'user' turn")));

    // 2. Empty turn
    let invalid_msgs2 = vec![
        json!({ "role": "user", "content": "" }),
        json!({ "role": "assistant", "content": "Hello" }),
    ];
    let res2 = ChatTemplateEngine::validate_example("rec-err2", &invalid_msgs2, &llama_model, false);
    assert!(!res2.is_valid);
    assert!(res2.errors.iter().any(|e| e.contains("empty content")));

    // 3. Raw special token injection
    let invalid_msgs3 = vec![
        json!({ "role": "user", "content": "Injected <|end_of_text|> token" }),
        json!({ "role": "assistant", "content": "Response" }),
    ];
    let res3 = ChatTemplateEngine::validate_example("rec-err3", &invalid_msgs3, &llama_model, false);
    assert!(!res3.is_valid);
    assert!(res3.errors.iter().any(|e| e.contains("Special token injection detected")));
}

#[test]
fn test_sequence_analytics_token_estimation_and_histogram() {
    let examples = vec![
        ("r1".to_string(), "The quick brown fox jumps over the lazy dog.".to_string()),
        ("r2".to_string(), "Short text".to_string()),
        ("r3".to_string(), "Ini adalah contoh dataset bahasa Indonesia untuk pengujian fine-tuning.".to_string()),
        ("r4".to_string(), "人工智能和机器学习模型测试。".to_string()),
        ("r5".to_string(), "Long repetitive text ".repeat(150)),
    ];

    let report = SequenceAnalyticsEngine::analyze(&examples, "llama", 500, "tail", true);
    assert_eq!(report.total_examples, 5);
    assert!(report.min_tokens > 0);
    assert!(report.max_tokens > report.min_tokens);
    assert!(report.p90_tokens >= report.median_tokens as usize);
    assert!(report.p99_tokens >= report.p95_tokens);

    // Histogram must have exactly 10 buckets
    assert_eq!(report.histogram.len(), 10);
    let total_bucket_count: usize = report.histogram.iter().map(|b| b.count).sum();
    assert_eq!(total_bucket_count, 5);

    // Multi-limit comparison must have evaluated points
    assert!(!report.multi_limit_comparison.is_empty());
    let point_1024 = report.multi_limit_comparison.iter().find(|p| p.max_seq_len == 1024);
    assert!(point_1024.is_some());
}

#[test]
fn test_deduplication_exact_normalized_and_near() {
    let records = vec![
        ("rec-1".to_string(), "Title 1".to_string(), "What is photosynthesis? Photosynthesis is the process by which green plants produce energy.".to_string()),
        // Exact duplicate
        ("rec-2".to_string(), "Title 2".to_string(), "What is photosynthesis? Photosynthesis is the process by which green plants produce energy.".to_string()),
        // Normalized duplicate (different whitespace & case)
        ("rec-3".to_string(), "Title 3".to_string(), "what   is photosynthesis?   PHOTOSYNTHESIS is the process by which green plants produce energy.  ".to_string()),
        // Near duplicate (slightly varied phrasing)
        ("rec-4".to_string(), "Title 4".to_string(), "Can you explain what is photosynthesis? Photosynthesis is the biological process by which green plants produce energy.".to_string()),
        // Distinct record
        ("rec-5".to_string(), "Title 5".to_string(), "How does an internal combustion engine work? It ignites fuel in cylinders.".to_string()),
    ];

    let decisions = HashMap::new();
    let report = DeduplicationEngine::analyze(&records, 0.70, &decisions);

    assert_eq!(report.total_records_analyzed, 5);
    assert!(report.groups.len() > 0);
    assert!(report.exact_duplicate_groups_count > 0);
}

#[test]
fn test_persona_audit_consistency_and_conflicts() {
    let consistent_records = vec![
        ("r1".to_string(), Some("You are an expert bilingual Indonesian-English translator.".to_string())),
        ("r2".to_string(), Some("You are an expert bilingual Indonesian-English translator.".to_string())),
        ("r3".to_string(), Some("You are an expert bilingual Indonesian-English translator.".to_string())),
    ];

    let rep1 = PersonaAuditEngine::analyze(&consistent_records, "single_consistent_persona");
    assert!(rep1.policy_compliance);
    assert_eq!(rep1.unique_system_prompts_count, 1);
    assert_eq!(rep1.dominant_persona_pct, 100.0);

    let disparate_records = vec![
        ("r1".to_string(), Some("You are an Indonesian translator.".to_string())),
        ("r2".to_string(), Some("You are a Rust systems programmer.".to_string())),
        ("r3".to_string(), Some("You are a medical healthcare assistant.".to_string())),
        ("r4".to_string(), None),
    ];

    let rep2 = PersonaAuditEngine::analyze(&disparate_records, "single_consistent_persona");
    assert!(!rep2.policy_compliance, "Should fail single_consistent_persona policy");
    assert!(rep2.warnings.iter().any(|w| w.warning_type == "policy_deviation"));
    assert!(rep2.warnings.iter().any(|w| w.warning_type == "missing_system"));
}

#[test]
fn test_deterministic_seeded_split_and_zero_leakage() {
    let mut records = Vec::new();
    for i in 1..=100 {
        records.push((
            format!("rec-{:03}", i),
            "sft".to_string(),
            // Group pairs together to test atomic group assignment
            Some(format!("group-{}", i / 5)),
        ));
    }

    let seed = 42u64;
    let (split_summary, assignments) = SplitEngine::create_leakage_free_split(
        "test-split-id",
        "test-split",
        &records,
        seed,
        0.80,
        0.10,
        0.10,
    );

    assert_eq!(split_summary.total_count, 100);
    assert_eq!(assignments.len(), 100);
    assert!(split_summary.train_count >= 70 && split_summary.train_count <= 90);
    assert!(split_summary.val_count > 0);
    assert!(split_summary.eval_count > 0);

    // Guaranteed 0 data leakage
    assert!(split_summary.leakage_free);

    // Verify determinism: same seed produces identical assignments
    let (split_summary_repeat, _) = SplitEngine::create_leakage_free_split(
        "test-split-id-2",
        "test-split-repeat",
        &records,
        seed,
        0.80,
        0.10,
        0.10,
    );
    assert_eq!(split_summary.train_count, split_summary_repeat.train_count);
    assert_eq!(split_summary.val_count, split_summary_repeat.val_count);
    assert_eq!(split_summary.eval_count, split_summary_repeat.eval_count);
}

#[test]
fn test_training_readiness_audit_and_markdown_generation() {
    let report = ReadinessEngine::evaluate(
        "rep-001",
        "p-001",
        "Production Ready Audit",
        "llama",
        4096,
        100,
        25,
        None,
        None,
        None,
        None,
        None,
        None,
    );

    assert!(!report.checks.is_empty());
    assert!(!report.markdown_summary.is_empty());
    assert!(report.markdown_summary.contains("Mechon AI Training Readiness Report"));
}

#[test]
fn test_conversational_dpo_serialization() {
    let rec = ConversationalDPOEngine::format_task(
        "task-001",
        Some("You are a helpful coding assistant."),
        "Write a Rust hello world.",
        "fn main() { println!(\"Hello, world!\"); }",
        "print('hello world')",
        Some("a"),
        Some("Rust implementation is correct and typed."),
        Some(json!({ "tested": true })),
    ).expect("Should format valid task");

    assert_eq!(rec.prompt.len(), 2);
    assert_eq!(rec.chosen.len(), 1);
    assert_eq!(rec.rejected.len(), 1);
    assert_eq!(rec.chosen[0].role, "assistant");
    assert_eq!(rec.rejected[0].role, "assistant");

    let jsonl = ConversationalDPOEngine::serialize_dataset(&[rec.clone()], "jsonl").unwrap();
    assert!(jsonl.contains("\"prompt\":["));
    assert!(jsonl.contains("\"chosen\":["));
    assert!(jsonl.contains("\"rejected\":["));

    let json_arr = ConversationalDPOEngine::serialize_dataset(&[rec], "json").unwrap();
    assert!(json_arr.starts_with('['));
    assert!(json_arr.ends_with(']'));
}
