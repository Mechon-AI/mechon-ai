use sqlx::SqlitePool;
use chrono::Utc;
use serde_json::Value;
use crate::errors::AppError;
use crate::models::{ValidationIssue, ValidationReport};

pub struct ValidationService;

impl ValidationService {
    pub async fn validate_dataset(
        pool: &SqlitePool,
        project_id: &str,
        dataset_type: &str,
    ) -> Result<ValidationReport, AppError> {
        let now = Utc::now().to_rfc3339();
        let mut issues = Vec::new();
        let mut total_records = 0;
        let mut passed_records = 0;
        let mut failed_records = 0;
        let mut error_count = 0;
        let mut warning_count = 0;

        if dataset_type == "sft" {
            let rows = sqlx::query_as::<_, (String, String, i64, i64)>(
                "SELECT id, messages_json, turn_count, character_count FROM sft_records WHERE project_id = ?"
            )
            .bind(project_id)
            .fetch_all(pool)
            .await?;

            total_records = rows.len() as i64;

            for (id, messages_str, _turn_count, _char_count) in rows {
                let mut record_has_error = false;
                let parsed: Result<Value, _> = serde_json::from_str(&messages_str);

                match parsed {
                    Ok(Value::Array(messages)) => {
                        if messages.is_empty() {
                            issues.push(ValidationIssue {
                                record_id: id.clone(),
                                dataset_type: "sft".to_string(),
                                severity: "error".to_string(),
                                issue_type: "EMPTY_CONVERSATION".to_string(),
                                message: "SFT record contains zero messages.".to_string(),
                                suggested_fix: Some("Add at least one user-assistant exchange.".to_string()),
                            });
                            error_count += 1;
                            record_has_error = true;
                        } else {
                            let mut prev_role = "";
                            let mut has_user = false;
                            let mut has_assistant = false;

                            for (idx, msg) in messages.iter().enumerate() {
                                let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("");
                                let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("");

                                if role == "user" { has_user = true; }
                                if role == "assistant" { has_assistant = true; }

                                if content.trim().is_empty() {
                                    issues.push(ValidationIssue {
                                        record_id: id.clone(),
                                        dataset_type: "sft".to_string(),
                                        severity: "error".to_string(),
                                        issue_type: "EMPTY_MESSAGE_CONTENT".to_string(),
                                        message: format!("Message at index {} has empty content.", idx),
                                        suggested_fix: Some("Fill in content or remove the empty turn.".to_string()),
                                    });
                                    error_count += 1;
                                    record_has_error = true;
                                }

                                if idx > 0 && role == prev_role && role != "system" {
                                    issues.push(ValidationIssue {
                                        record_id: id.clone(),
                                        dataset_type: "sft".to_string(),
                                        severity: "warning".to_string(),
                                        issue_type: "CONSECUTIVE_ROLE_TURNS".to_string(),
                                        message: format!("Consecutive '{}' turns detected at message index {}.", role, idx),
                                        suggested_fix: Some("Merge consecutive turns or insert the alternate role.".to_string()),
                                    });
                                    warning_count += 1;
                                }

                                prev_role = role;
                            }

                            if !has_user || !has_assistant {
                                issues.push(ValidationIssue {
                                    record_id: id.clone(),
                                    dataset_type: "sft".to_string(),
                                    severity: "warning".to_string(),
                                    issue_type: "INCOMPLETE_DIALOGUE".to_string(),
                                    message: "Conversation missing either a user query or assistant response.".to_string(),
                                    suggested_fix: Some("Ensure dialogue has both user and assistant roles.".to_string()),
                                });
                                warning_count += 1;
                            }
                        }
                    }
                    _ => {
                        issues.push(ValidationIssue {
                            record_id: id.clone(),
                            dataset_type: "sft".to_string(),
                            severity: "error".to_string(),
                            issue_type: "MALFORMED_JSON".to_string(),
                            message: "Messages payload is not a valid JSON array.".to_string(),
                            suggested_fix: Some("Reformat record messages to a valid JSON array.".to_string()),
                        });
                        error_count += 1;
                        record_has_error = true;
                    }
                }

                if record_has_error {
                    failed_records += 1;
                } else {
                    passed_records += 1;
                }
            }
        } else if dataset_type == "dpo" {
            let rows = sqlx::query_as::<_, (String, String, String, String, Option<String>, String)>(
                "SELECT id, prompt, response_a, response_b, preference, status FROM dpo_tasks WHERE project_id = ?"
            )
            .bind(project_id)
            .fetch_all(pool)
            .await?;

            total_records = rows.len() as i64;

            for (id, prompt, response_a, response_b, preference, status) in rows {
                let mut record_has_error = false;

                if prompt.trim().is_empty() {
                    issues.push(ValidationIssue {
                        record_id: id.clone(),
                        dataset_type: "dpo".to_string(),
                        severity: "error".to_string(),
                        issue_type: "EMPTY_PROMPT".to_string(),
                        message: "Prompt text is empty.".to_string(),
                        suggested_fix: Some("Provide a non-empty prompt for evaluation.".to_string()),
                    });
                    error_count += 1;
                    record_has_error = true;
                }

                if response_a.trim().is_empty() || response_b.trim().is_empty() {
                    issues.push(ValidationIssue {
                        record_id: id.clone(),
                        dataset_type: "dpo".to_string(),
                        severity: "error".to_string(),
                        issue_type: "MISSING_CANDIDATE_RESPONSE".to_string(),
                        message: "Candidate response A or B is missing.".to_string(),
                        suggested_fix: Some("Ensure both candidate responses are populated.".to_string()),
                    });
                    error_count += 1;
                    record_has_error = true;
                }

                if !response_a.trim().is_empty() && response_a == response_b {
                    issues.push(ValidationIssue {
                        record_id: id.clone(),
                        dataset_type: "dpo".to_string(),
                        severity: "warning".to_string(),
                        issue_type: "IDENTICAL_RESPONSES".to_string(),
                        message: "Response A and Response B are completely identical.".to_string(),
                        suggested_fix: Some("Provide distinct alternative responses for meaningful preference optimization.".to_string()),
                    });
                    warning_count += 1;
                }

                if status == "completed" && preference.is_none() {
                    issues.push(ValidationIssue {
                        record_id: id.clone(),
                        dataset_type: "dpo".to_string(),
                        severity: "error".to_string(),
                        issue_type: "UNSPECIFIED_PREFERENCE".to_string(),
                        message: "Task is marked completed but has no preference choice.".to_string(),
                        suggested_fix: Some("Annotate preference as a, b, tie, or both_bad.".to_string()),
                    });
                    error_count += 1;
                    record_has_error = true;
                }

                if record_has_error {
                    failed_records += 1;
                } else {
                    passed_records += 1;
                }
            }
        }

        Ok(ValidationReport {
            dataset_type: dataset_type.to_string(),
            total_records,
            passed_records,
            failed_records,
            error_count,
            warning_count,
            issues,
            generated_at: now,
        })
    }
}
