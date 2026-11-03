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

#[test]
fn test_schema_backward_and_dual_alias_compatibility() {
    use mechon_ai::engineering::readiness_engine::TrainingReadinessReport;
    use mechon_ai::engineering::sequence_analytics::SequenceAnalyticsReport;
    use mechon_ai::engineering::deduplication::DeduplicationReport;
    use mechon_ai::engineering::persona_audit::PersonaAuditReport;
    use mechon_ai::engineering::split_engine::SplitSummary;

    // 1. Training Readiness Report with legacy/modern dual aliases
    let legacy_readiness_json = json!({
        "report_id": "rep-test-01",
        "project_id": "proj-01",
        "title": "Legacy Audit",
        "status": "READY",
        "model_family": "llama",
        "max_seq_len": 4096,
        "generated_at": "2026-11-03T00:00:00Z",
        "total_records": 10,
        "sft_count": 5,
        "dpo_count": 5,
        "total_estimated_tokens": 12000,
        "checks": [
            {
                "category": "Dataset Overview",
                "name": "Dataset Non-Empty",
                "passed": true,
                "is_mandatory": true,
                "severity": "info",
                "message": "Dataset contains 10 records",
                "details": null
            }
        ],
        "summary": {},
        "markdown_summary": "# Report"
    });

    let report: TrainingReadinessReport = serde_json::from_value(legacy_readiness_json)
        .expect("Should deserialize legacy readiness json");
    assert_eq!(report.model_family, "llama");
    assert_eq!(report.status, "READY");
    assert_eq!(report.checks[0].category, "Dataset Overview");

    // Modern aliases deserialization
    let modern_readiness_json = json!({
        "report_id": "rep-test-02",
        "project_id": "proj-01",
        "title": "Modern Audit",
        "overall_status": "READY_WITH_WARNINGS",
        "target_model": "qwen",
        "max_seq_len": 8192,
        "generated_at": "2026-11-03T00:00:00Z",
        "total_records": 25,
        "sft_count": 20,
        "dpo_count": 5,
        "total_estimated_tokens": 50000,
        "checks": [
            {
                "dimension": "Format Compliance",
                "title": "Jinja Validation",
                "passed": true,
                "is_mandatory": true,
                "severity": "info",
                "message": "Passed",
                "recommendation": "None needed"
            }
        ],
        "summary": {},
        "markdown_summary": "# Report"
    });

    let modern_report: TrainingReadinessReport = serde_json::from_value(modern_readiness_json)
        .expect("Should deserialize modern readiness json");
    assert_eq!(modern_report.model_family, "qwen");
    assert_eq!(modern_report.status, "READY_WITH_WARNINGS");
    assert_eq!(modern_report.checks[0].category, "Format Compliance");

    // 2. Split Summary with alias
    let split_json = json!({
        "split_id": "sp-01",
        "name": "Partition A",
        "seed": 42,
        "train_count": 80,
        "val_count": 10,
        "eval_count": 10,
        "total_count": 100,
        "train_pct": 0.8,
        "val_pct": 0.1,
        "eval_pct": 0.1,
        "zero_leakage_verified": true,
        "leakage_violations": []
    });

    let split: SplitSummary = serde_json::from_value(split_json)
        .expect("Should deserialize split summary with zero_leakage_verified");
    assert!(split.leakage_free);

    // 3. Deduplication Report with match_type alias
    let dedup_json = json!({
        "total_scanned": 100,
        "unique_records": 90,
        "exact_duplicates": 2,
        "normalized_duplicates": 3,
        "near_duplicates": 5,
        "total_duplicate_records": 10,
        "duplicate_rate_pct": 10.0,
        "groups": [
            {
                "group_id": "grp-01",
                "match_type": "exact",
                "primary_record_id": "rec-1",
                "max_similarity": 1.0,
                "records": []
            }
        ]
    });

    let dedup: DeduplicationReport = serde_json::from_value(dedup_json)
        .expect("Should deserialize dedup report with aliases");
    assert_eq!(dedup.total_records_analyzed, 100);
    assert_eq!(dedup.groups[0].duplicate_type, "exact");

    // 4. Persona Report with aliases
    let persona_json = json!({
        "policy_applied": "single_consistent_persona",
        "total_records": 50,
        "records_with_system_prompt": 45,
        "records_missing_system_prompt": 5,
        "unique_system_prompts": 2,
        "dominant_persona": "Helpful AI",
        "dominant_persona_share": 90.0,
        "clusters": [],
        "warnings": [],
        "is_policy_compliant": true
    });

    let persona: PersonaAuditReport = serde_json::from_value(persona_json)
        .expect("Should deserialize persona report with aliases");
    assert_eq!(persona.policy, "single_consistent_persona");
    assert_eq!(persona.total_conversations, 50);
    assert!(persona.policy_compliance);

    // 5. Sequence Analytics Report with aliases
    let seq_json = json!({
        "model_family": "llama",
        "max_seq_len": 4096,
        "truncation_strategy": "tail",
        "include_special_tokens": true,
        "total_records": 100,
        "total_estimated_tokens": 125000,
        "min_len": 120,
        "max_len": 4200,
        "mean_len": 1250.0,
        "median_len": 1100.0,
        "p90_len": 2800,
        "p95_len": 3500,
        "p99_len": 4100,
        "histogram": [
            { "min_len": 0, "max_len": 500, "count": 20, "percentage": 20.0 }
        ],
        "truncated_records_count": 2,
        "exceeding_percentage": 2.0,
        "truncated_tokens_count": 250,
        "estimated_retained_tokens": 124750,
        "comparison_matrix": [
            {
                "limit": 4096,
                "records_within_limit": 98,
                "records_exceeding_limit": 2,
                "pct_within_limit": 98.0,
                "tokens_truncated": 250,
                "total_tokens_at_limit": 124750
            }
        ],
        "outlier_example_ids": []
    });

    let seq: SequenceAnalyticsReport = serde_json::from_value(seq_json)
        .expect("Should deserialize sequence report with aliases");
    assert_eq!(seq.total_examples, 100);
    assert_eq!(seq.configured_max_seq_len, 4096);
    assert_eq!(seq.histogram[0].min_range, 0);
    assert_eq!(seq.multi_limit_comparison[0].max_seq_len, 4096);
}
