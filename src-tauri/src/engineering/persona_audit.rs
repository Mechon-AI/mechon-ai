use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemPromptCluster {
    pub prompt_text: String,
    pub normalized_text: String,
    pub count: usize,
    pub percentage: f64,
    pub sample_record_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaWarning {
    pub warning_type: String, // "missing_system", "persona_variance", "conflicting_instructions", "policy_deviation"
    pub severity: String,     // "warning", "info", "error"
    pub message: String,
    pub record_id: Option<String>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaAuditReport {
    #[serde(alias = "policy_applied")]
    pub policy: String, // "single_consistent_persona", "multiple_intentional_personas", "mixed_instruction", "custom"
    #[serde(alias = "total_records")]
    pub total_conversations: usize,
    #[serde(alias = "records_with_system_prompt")]
    pub conversations_with_system: usize,
    #[serde(alias = "records_missing_system_prompt")]
    pub conversations_missing_system: usize,
    #[serde(alias = "unique_system_prompts")]
    pub unique_system_prompts_count: usize,
    pub dominant_persona: Option<String>,
    #[serde(alias = "dominant_persona_share")]
    pub dominant_persona_pct: f64,
    pub clusters: Vec<SystemPromptCluster>,
    pub warnings: Vec<PersonaWarning>,
    #[serde(alias = "is_policy_compliant")]
    pub policy_compliance: bool,
}

pub struct PersonaAuditEngine;

impl PersonaAuditEngine {
    pub fn analyze(
        conversations: &[(String, Option<String>)], // (Record ID, System Prompt)
        policy: &str,
    ) -> PersonaAuditReport {
        let total = conversations.len();
        if total == 0 {
            return PersonaAuditReport {
                policy: policy.to_string(),
                total_conversations: 0,
                conversations_with_system: 0,
                conversations_missing_system: 0,
                unique_system_prompts_count: 0,
                dominant_persona: None,
                dominant_persona_pct: 0.0,
                clusters: Vec::new(),
                warnings: Vec::new(),
                policy_compliance: true,
            };
        }

        let mut missing_count = 0usize;
        let mut prompt_groups: HashMap<String, (String, Vec<String>)> = HashMap::new(); // norm -> (orig, ids)
        let mut warnings = Vec::new();

        for (rec_id, sys_opt) in conversations {
            match sys_opt {
                None => {
                    missing_count += 1;
                    warnings.push(PersonaWarning {
                        warning_type: "missing_system".to_string(),
                        severity: "warning".to_string(),
                        message: "Conversation has no system prompt defined.".to_string(),
                        record_id: Some(rec_id.clone()),
                        details: Some("System prompts establish model alignment boundaries and safety instructions.".to_string()),
                    });
                }
                Some(text) if text.trim().is_empty() => {
                    missing_count += 1;
                    warnings.push(PersonaWarning {
                        warning_type: "missing_system".to_string(),
                        severity: "warning".to_string(),
                        message: "Conversation has empty whitespace system prompt.".to_string(),
                        record_id: Some(rec_id.clone()),
                        details: None,
                    });
                }
                Some(text) => {
                    let norm = text.to_lowercase().split_whitespace().collect::<Vec<_>>().join(" ");
                    let entry = prompt_groups.entry(norm.clone()).or_insert_with(|| (text.trim().to_string(), Vec::new()));
                    entry.1.push(rec_id.clone());

                    // Check for conflicting instructions inside prompt
                    let lower = norm.to_lowercase();
                    if lower.contains("concise") && lower.contains("detailed and comprehensive") {
                        warnings.push(PersonaWarning {
                            warning_type: "conflicting_instructions".to_string(),
                            severity: "warning".to_string(),
                            message: "System prompt contains contradictory length instructions ('concise' vs 'detailed and comprehensive').".to_string(),
                            record_id: Some(rec_id.clone()),
                            details: Some(text.chars().take(120).collect()),
                        });
                    }
                }
            }
        }

        let mut clusters = Vec::new();
        for (norm, (orig, ids)) in prompt_groups {
            let count = ids.len();
            let pct = ((count as f64) / (total as f64)) * 100.0;
            clusters.push(SystemPromptCluster {
                prompt_text: orig,
                normalized_text: norm,
                count,
                percentage: pct,
                sample_record_ids: ids.into_iter().take(5).collect(),
            });
        }

        // Sort clusters by frequency descending
        clusters.sort_by(|a, b| b.count.cmp(&a.count));

        let dominant_persona = clusters.first().map(|c| c.prompt_text.clone());
        let dominant_persona_pct = clusters.first().map(|c| c.percentage).unwrap_or(0.0);
        let unique_count = clusters.len();

        // Evaluate against policy
        let mut policy_compliance = true;

        match policy {
            "single_consistent_persona" => {
                if unique_count > 1 {
                    policy_compliance = false;
                    warnings.push(PersonaWarning {
                        warning_type: "policy_deviation".to_string(),
                        severity: "error".to_string(),
                        message: format!(
                            "Policy requires a single consistent persona, but {} distinct system prompts were found. Dominant persona covers {:.1}%.",
                            unique_count, dominant_persona_pct
                        ),
                        record_id: None,
                        details: Some("Select the primary persona and unify or align diverging examples.".to_string()),
                    });
                }
                if missing_count > 0 {
                    policy_compliance = false;
                }
            }
            "multiple_intentional_personas" => {
                // If there are many singleton personas (> 30% of prompts have count = 1), flag noise
                let singletons = clusters.iter().filter(|c| c.count == 1).count();
                if singletons > (unique_count / 2) && unique_count > 5 {
                    warnings.push(PersonaWarning {
                        warning_type: "persona_variance".to_string(),
                        severity: "warning".to_string(),
                        message: format!(
                            "High persona fragmentation: {} singleton system prompts detected with only 1 occurrence.",
                            singletons
                        ),
                        record_id: None,
                        details: Some("Review whether isolated system prompts are intentional task personas or accidental variations.".to_string()),
                    });
                }
            }
            _ => {
                // mixed_instruction allows arbitrary diversity, no policy failure unless missing prompts
            }
        }

        PersonaAuditReport {
            policy: policy.to_string(),
            total_conversations: total,
            conversations_with_system: total.saturating_sub(missing_count),
            conversations_missing_system: missing_count,
            unique_system_prompts_count: unique_count,
            dominant_persona,
            dominant_persona_pct,
            clusters,
            warnings,
            policy_compliance,
        }
    }
}
