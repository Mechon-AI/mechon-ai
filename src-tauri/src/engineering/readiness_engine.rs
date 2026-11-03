use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadinessCheckItem {
    pub category: String,
    pub name: String,
    pub passed: bool,
    pub is_mandatory: bool,
    pub severity: String, // "critical", "warning", "info"
    pub message: String,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingReadinessReport {
    pub report_id: String,
    pub project_id: String,
    pub title: String,
    pub status: String, // "READY", "READY_WITH_WARNINGS", "BLOCKED"
    pub model_family: String,
    pub max_seq_len: usize,
    pub generated_at: String,
    pub total_records: usize,
    pub sft_count: usize,
    pub dpo_count: usize,
    pub total_estimated_tokens: usize,
    pub checks: Vec<ReadinessCheckItem>,
    pub summary: Value,
    pub markdown_summary: String,
}

pub struct ReadinessEngine;

impl ReadinessEngine {
    pub fn evaluate(
        report_id: &str,
        project_id: &str,
        title: &str,
        model_family: &str,
        max_seq_len: usize,
        sft_records_count: usize,
        dpo_tasks_count: usize,
        template_summary: Option<&super::template_engine::TemplateCompatibilitySummary>,
        sequence_report: Option<&super::sequence_analytics::SequenceAnalyticsReport>,
        dedup_report: Option<&super::deduplication::DeduplicationReport>,
        persona_report: Option<&super::persona_audit::PersonaAuditReport>,
        split_summary: Option<&super::split_engine::SplitSummary>,
        bilingual_stats: Option<&Value>,
    ) -> TrainingReadinessReport {
        let mut checks = Vec::new();
        let mut has_critical = false;
        let mut has_warning = false;

        let total_records = sft_records_count + dpo_tasks_count;

        // 1. Minimum Dataset Volume Check
        if total_records == 0 {
            checks.push(ReadinessCheckItem {
                category: "Dataset Overview".to_string(),
                name: "Dataset Non-Empty".to_string(),
                passed: false,
                is_mandatory: true,
                severity: "critical".to_string(),
                message: "Dataset contains zero training examples.".to_string(),
                details: Some("Author SFT conversations or annotate DPO preferences before training.".to_string()),
            });
            has_critical = true;
        } else {
            checks.push(ReadinessCheckItem {
                category: "Dataset Overview".to_string(),
                name: "Dataset Non-Empty".to_string(),
                passed: true,
                is_mandatory: true,
                severity: "info".to_string(),
                message: format!("Dataset contains {} total records ({} SFT, {} DPO).", total_records, sft_records_count, dpo_tasks_count),
                details: None,
            });
        }

        // 2. Chat Template Compatibility Check
        if let Some(tmpl) = template_summary {
            if tmpl.non_compliant_count > 0 {
                checks.push(ReadinessCheckItem {
                    category: "Template Compatibility".to_string(),
                    name: format!("{} Chat Template Formatting", tmpl.model_name),
                    passed: false,
                    is_mandatory: true,
                    severity: "critical".to_string(),
                    message: format!(
                        "{} examples failed chat template serialization for model family '{}'.",
                        tmpl.non_compliant_count, tmpl.family
                    ),
                    details: Some("Inspect formatting failures in Template Validation before fine-tuning.".to_string()),
                });
                has_critical = true;
            } else {
                checks.push(ReadinessCheckItem {
                    category: "Template Compatibility".to_string(),
                    name: format!("{} Chat Template Formatting", tmpl.model_name),
                    passed: true,
                    is_mandatory: true,
                    severity: "info".to_string(),
                    message: format!("All {} examples pass {} chat template serialization.", tmpl.compliant_count, tmpl.model_name),
                    details: None,
                });
            }
        }

        // 3. Sequence Length & Truncation Risk Check
        if let Some(seq) = sequence_report {
            if seq.exceeding_percentage > 20.0 {
                checks.push(ReadinessCheckItem {
                    category: "Sequence Analytics".to_string(),
                    name: "Truncation Risk Boundary".to_string(),
                    passed: false,
                    is_mandatory: false,
                    severity: "warning".to_string(),
                    message: format!(
                        "High truncation risk: {:.1}% of examples exceed max_seq_len ({} tokens). Estimated {} truncated tokens.",
                        seq.exceeding_percentage, seq.configured_max_seq_len, seq.estimated_truncated_tokens
                    ),
                    details: Some("Consider raising max_seq_len or pruning long examples to avoid lost response context.".to_string()),
                });
                has_warning = true;
            } else if seq.exceeding_count > 0 {
                checks.push(ReadinessCheckItem {
                    category: "Sequence Analytics".to_string(),
                    name: "Truncation Risk Boundary".to_string(),
                    passed: true,
                    is_mandatory: false,
                    severity: "info".to_string(),
                    message: format!(
                        "Low truncation risk: only {} examples ({:.1}%) exceed {} tokens.",
                        seq.exceeding_count, seq.exceeding_percentage, seq.configured_max_seq_len
                    ),
                    details: None,
                });
            } else {
                checks.push(ReadinessCheckItem {
                    category: "Sequence Analytics".to_string(),
                    name: "Truncation Risk Boundary".to_string(),
                    passed: true,
                    is_mandatory: false,
                    severity: "info".to_string(),
                    message: format!("100% of examples fit comfortably within {} token limit.", seq.configured_max_seq_len),
                    details: None,
                });
            }
        }

        // 4. Deduplication & Data Integrity Check
        if let Some(dedup) = dedup_report {
            if dedup.exact_duplicate_groups_count > 0 {
                checks.push(ReadinessCheckItem {
                    category: "Data Integrity".to_string(),
                    name: "Exact Duplicate Detection".to_string(),
                    passed: false,
                    is_mandatory: false,
                    severity: "warning".to_string(),
                    message: format!(
                        "{} exact duplicate groups detected affecting {} duplicate records.",
                        dedup.exact_duplicate_groups_count, dedup.total_duplicate_records_flagged
                    ),
                    details: Some("Review duplicates in Deduplication workspace before training to avoid overfitting.".to_string()),
                });
                has_warning = true;
            } else {
                checks.push(ReadinessCheckItem {
                    category: "Data Integrity".to_string(),
                    name: "Exact Duplicate Detection".to_string(),
                    passed: true,
                    is_mandatory: false,
                    severity: "info".to_string(),
                    message: "Zero exact duplicate conversations detected in dataset.".to_string(),
                    details: None,
                });
            }
        }

        // 5. System Prompt & Persona Consistency
        if let Some(persona) = persona_report {
            if !persona.policy_compliance {
                checks.push(ReadinessCheckItem {
                    category: "Persona Consistency".to_string(),
                    name: "Persona Alignment Policy".to_string(),
                    passed: false,
                    is_mandatory: false,
                    severity: "warning".to_string(),
                    message: format!(
                        "Policy '{}' failed: {} distinct personas detected across dataset.",
                        persona.policy, persona.unique_system_prompts_count
                    ),
                    details: Some("Align conflicting system prompts or update persona policy in Persona Audit.".to_string()),
                });
                has_warning = true;
            } else {
                checks.push(ReadinessCheckItem {
                    category: "Persona Consistency".to_string(),
                    name: "Persona Alignment Policy".to_string(),
                    passed: true,
                    is_mandatory: false,
                    severity: "info".to_string(),
                    message: format!("System prompt distribution complies with '{}' policy.", persona.policy),
                    details: None,
                });
            }
        }

        // 6. Train / Eval Data Leakage Prevention Check
        if let Some(split) = split_summary {
            if !split.leakage_free {
                checks.push(ReadinessCheckItem {
                    category: "Train/Eval Split Integrity".to_string(),
                    name: "Zero Data Leakage Guarantee".to_string(),
                    passed: false,
                    is_mandatory: true,
                    severity: "critical".to_string(),
                    message: format!("Data leakage detected: {} violation groups cross train/eval boundaries.", split.leakage_violations.len()),
                    details: Some("Regenerate split with group isolation in Train/Eval Manager.".to_string()),
                });
                has_critical = true;
            } else {
                checks.push(ReadinessCheckItem {
                    category: "Train/Eval Split Integrity".to_string(),
                    name: "Zero Data Leakage Guarantee".to_string(),
                    passed: true,
                    is_mandatory: true,
                    severity: "info".to_string(),
                    message: format!(
                        "Split is 100% leakage-free (Train: {}, Val: {}, Eval: {}).",
                        split.train_count, split.val_count, split.eval_count
                    ),
                    details: None,
                });
            }
        }

        // 7. Bilingual Quality & Turn Alignment
        if let Some(bilingual) = bilingual_stats {
            let unapproved = bilingual.get("unapproved_count").and_then(|v| v.as_u64()).unwrap_or(0);
            if unapproved > 0 {
                checks.push(ReadinessCheckItem {
                    category: "Bilingual Quality".to_string(),
                    name: "Translation Human Approval".to_string(),
                    passed: false,
                    is_mandatory: false,
                    severity: "warning".to_string(),
                    message: format!("{} translated turns remain unapproved by human engineer.", unapproved),
                    details: Some("Review and approve turns in SFT Bilingual Review studio.".to_string()),
                });
                has_warning = true;
            }
        }

        // Determine final overall status
        let final_status = if has_critical {
            "BLOCKED".to_string()
        } else if has_warning {
            "READY_WITH_WARNINGS".to_string()
        } else {
            "READY".to_string()
        };

        let total_tokens = sequence_report.map(|s| s.total_tokens).unwrap_or(0);

        // Generate Markdown Summary
        let md = format!(
            "# Mechon AI Training Readiness Report\n\n\
             **Title:** {}\n\
             **Status:** `{}`\n\
             **Target Foundation Model:** {}\n\
             **Configured Max Sequence Length:** {} tokens\n\
             **Total Training Records:** {} (SFT: {}, DPO: {})\n\
             **Estimated Total Tokens:** {}\n\n\
             ## Engineering Validation Summary\n\n\
             | Category | Check | Status | Severity |\n\
             | :--- | :--- | :---: | :--- |\n{}\n\n\
             *Report generated deterministically by Mechon AI Fine-Tuning Workstation.*",
            title,
            final_status,
            model_family.to_uppercase(),
            max_seq_len,
            total_records,
            sft_records_count,
            dpo_tasks_count,
            total_tokens,
            checks
                .iter()
                .map(|c| format!(
                    "| {} | {} | {} | {} |",
                    c.category,
                    c.name,
                    if c.passed { "PASS" } else { "FAIL" },
                    c.severity.to_uppercase()
                ))
                .collect::<Vec<_>>()
                .join("\n")
        );

        let summary_json = serde_json::json!({
            "status": final_status,
            "total_records": total_records,
            "sft_count": sft_records_count,
            "dpo_count": dpo_tasks_count,
            "total_tokens": total_tokens,
            "passed_checks": checks.iter().filter(|c| c.passed).count(),
            "total_checks": checks.len(),
            "critical_failures": checks.iter().filter(|c| !c.passed && c.severity == "critical").count(),
            "warnings_count": checks.iter().filter(|c| !c.passed && c.severity == "warning").count(),
        });

        TrainingReadinessReport {
            report_id: report_id.to_string(),
            project_id: project_id.to_string(),
            title: title.to_string(),
            status: final_status,
            model_family: model_family.to_string(),
            max_seq_len,
            generated_at: chrono::Utc::now().to_rfc3339(),
            total_records,
            sft_count: sft_records_count,
            dpo_count: dpo_tasks_count,
            total_estimated_tokens: total_tokens,
            checks,
            summary: summary_json,
            markdown_summary: md,
        }
    }
}
