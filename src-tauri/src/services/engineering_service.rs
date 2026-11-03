use sqlx::SqlitePool;
use std::collections::HashMap;
use serde_json::Value;
use uuid::Uuid;

use crate::engineering::template_engine::{ChatTemplateEngine, ModelTemplateDef, TemplateCompatibilitySummary};
use crate::engineering::conversational_dpo::ConversationalDPOEngine;
use crate::engineering::deduplication::{DeduplicationEngine, DeduplicationReport};
use crate::engineering::persona_audit::{PersonaAuditEngine, PersonaAuditReport};
use crate::engineering::readiness_engine::{ReadinessEngine, TrainingReadinessReport};
use crate::engineering::sequence_analytics::{SequenceAnalyticsEngine, SequenceAnalyticsReport};
use crate::engineering::split_engine::{SplitEngine, SplitSummary};
use crate::errors::AppError;

pub struct EngineeringService;

impl EngineeringService {
    pub fn get_supported_template_models() -> Vec<ModelTemplateDef> {
        ChatTemplateEngine::get_curated_models()
    }

    /// Run chat template serialization and validation across all SFT records in project
    pub async fn validate_chat_templates(
        pool: &SqlitePool,
        project_id: &str,
        model_id: &str,
        add_generation_prompt: bool,
    ) -> Result<TemplateCompatibilitySummary, AppError> {
        let model = ChatTemplateEngine::get_model_def(model_id).ok_or_else(|| {
            AppError::Validation(format!("Unsupported foundation model identifier: '{}'", model_id))
        })?;

        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, messages_json FROM sft_records WHERE project_id = ? ORDER BY created_at ASC"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let total = rows.len();
        let mut results = Vec::new();
        let mut error_counts: HashMap<String, usize> = HashMap::new();
        let mut compliant = 0;
        let mut non_compliant = 0;

        for (id, msgs_json) in rows {
            let messages: Vec<Value> = serde_json::from_str(&msgs_json).unwrap_or_default();
            let res = ChatTemplateEngine::validate_example(&id, &messages, &model, add_generation_prompt);
            if res.is_valid {
                compliant += 1;
            } else {
                non_compliant += 1;
                for err in &res.errors {
                    *error_counts.entry(err.clone()).or_insert(0) += 1;
                }
            }
            results.push(res);
        }

        let mut common_errors: Vec<(String, usize)> = error_counts.into_iter().collect();
        common_errors.sort_by(|a, b| b.1.cmp(&a.1));

        let compliance_rate = if total > 0 {
            ((compliant as f64) / (total as f64)) * 100.0
        } else {
            100.0
        };

        Ok(TemplateCompatibilitySummary {
            model_id: model.id.clone(),
            model_name: model.name.clone(),
            family: model.family.clone(),
            total_examples: total,
            compliant_count: compliant,
            non_compliant_count: non_compliant,
            compliance_rate,
            common_errors: common_errors.into_iter().take(10).collect(),
            sample_results: results.into_iter().take(20).collect(),
        })
    }

    /// Sequence analytics across dataset records
    pub async fn run_sequence_analytics(
        pool: &SqlitePool,
        project_id: &str,
        model_family: &str,
        max_seq_len: usize,
        truncation_strategy: &str,
        include_special_tokens: bool,
    ) -> Result<SequenceAnalyticsReport, AppError> {
        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, messages_json FROM sft_records WHERE project_id = ? ORDER BY created_at ASC"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let examples: Vec<(String, String)> = rows
            .into_iter()
            .map(|(id, msgs_json)| {
                let messages: Vec<Value> = serde_json::from_str(&msgs_json).unwrap_or_default();
                let text: String = messages
                    .iter()
                    .filter_map(|m| m.get("content").and_then(|c| c.as_str()))
                    .collect::<Vec<_>>()
                    .join("\n\n");
                (id, text)
            })
            .collect();

        Ok(SequenceAnalyticsEngine::analyze(
            &examples,
            model_family,
            max_seq_len,
            truncation_strategy,
            include_special_tokens,
        ))
    }

    /// Exact, normalized, and near-duplicate detection
    pub async fn run_deduplication(
        pool: &SqlitePool,
        project_id: &str,
        near_threshold: f64,
    ) -> Result<DeduplicationReport, AppError> {
        let rows: Vec<(String, String, String)> = sqlx::query_as(
            "SELECT id, metadata_json, messages_json FROM sft_records WHERE project_id = ? ORDER BY created_at ASC"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        // Load saved decisions from database
        let decisions_rows: Vec<(String, String, Option<String>)> = sqlx::query_as(
            "SELECT record_id, decision, note FROM duplicate_review_decisions WHERE project_id = ?"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let mut decisions_map = HashMap::new();
        for (rec_id, dec, note) in decisions_rows {
            decisions_map.insert(rec_id, (dec, note));
        }

        let examples: Vec<(String, String, String)> = rows
            .into_iter()
            .map(|(id, meta_json, msgs_json)| {
                let meta: Value = serde_json::from_str(&meta_json).unwrap_or_default();
                let title = meta.get("title").and_then(|t| t.as_str()).unwrap_or("Record").to_string();
                let messages: Vec<Value> = serde_json::from_str(&msgs_json).unwrap_or_default();
                let text: String = messages
                    .iter()
                    .filter_map(|m| m.get("content").and_then(|c| c.as_str()))
                    .collect::<Vec<_>>()
                    .join("\n");
                (id, title, text)
            })
            .collect();

        Ok(DeduplicationEngine::analyze(
            &examples,
            near_threshold,
            &decisions_map,
        ))
    }

    /// Save human engineer review decision for duplicate records
    pub async fn save_duplicate_decision(
        pool: &SqlitePool,
        project_id: &str,
        group_id: &str,
        record_id: &str,
        decision: &str,
        note: Option<&str>,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO duplicate_review_decisions (project_id, group_id, record_id, decision, note, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(project_id, group_id, record_id) DO UPDATE SET
                decision = excluded.decision,
                note = excluded.note,
                updated_at = excluded.updated_at"
        )
        .bind(project_id)
        .bind(group_id)
        .bind(record_id)
        .bind(decision)
        .bind(note)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// System prompt persona audit
    pub async fn run_persona_audit(
        pool: &SqlitePool,
        project_id: &str,
        policy: &str,
    ) -> Result<PersonaAuditReport, AppError> {
        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, messages_json FROM sft_records WHERE project_id = ? ORDER BY created_at ASC"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let conversations: Vec<(String, Option<String>)> = rows
            .into_iter()
            .map(|(id, msgs_json)| {
                let messages: Vec<Value> = serde_json::from_str(&msgs_json).unwrap_or_default();
                let sys = messages
                    .iter()
                    .find(|m| m.get("role").and_then(|r| r.as_str()) == Some("system"))
                    .and_then(|m| m.get("content").and_then(|c| c.as_str()))
                    .map(|s| s.to_string());
                (id, sys)
            })
            .collect();

        Ok(PersonaAuditEngine::analyze(&conversations, policy))
    }

    /// Create reproducible, leakage-free dataset split
    pub async fn create_dataset_split(
        pool: &SqlitePool,
        project_id: &str,
        name: &str,
        seed: u64,
        train_pct: f64,
        val_pct: f64,
        eval_pct: f64,
    ) -> Result<SplitSummary, AppError> {
        let sft_rows: Vec<(String, Option<String>)> = sqlx::query_as(
            "SELECT id, session_id FROM sft_records WHERE project_id = ?"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let dpo_rows: Vec<(String,)> = sqlx::query_as(
            "SELECT id FROM dpo_tasks WHERE project_id = ?"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let mut records = Vec::new();
        for (id, session_id) in sft_rows {
            records.push((id, "sft".to_string(), session_id));
        }
        for (id,) in dpo_rows {
            records.push((id, "dpo".to_string(), None));
        }

        let split_id = format!("split-{}", Uuid::new_v4());
        let (summary, assignments) = SplitEngine::create_leakage_free_split(
            &split_id,
            name,
            &records,
            seed,
            train_pct,
            val_pct,
            eval_pct,
        );

        let now = chrono::Utc::now().to_rfc3339();
        let config_json = serde_json::json!({
            "seed": seed,
            "train_pct": train_pct,
            "val_pct": val_pct,
            "eval_pct": eval_pct
        }).to_string();

        let mut tx = pool.begin().await?;

        sqlx::query(
            "INSERT INTO dataset_splits (id, project_id, name, version_tag, seed, train_pct, val_pct, eval_pct, leakage_free, total_count, train_count, val_count, eval_count, config_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&split_id)
        .bind(project_id)
        .bind(name)
        .bind("v1.0")
        .bind(seed as i64)
        .bind(train_pct)
        .bind(val_pct)
        .bind(eval_pct)
        .bind(if summary.leakage_free { 1 } else { 0 })
        .bind(summary.total_count as i64)
        .bind(summary.train_count as i64)
        .bind(summary.val_count as i64)
        .bind(summary.eval_count as i64)
        .bind(&config_json)
        .bind(&now)
        .execute(&mut *tx)
        .await?;

        for item in assignments {
            sqlx::query(
                "INSERT INTO dataset_split_assignments (split_id, record_id, record_type, split_name, group_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)"
            )
            .bind(&split_id)
            .bind(&item.record_id)
            .bind(&item.record_type)
            .bind(&item.split_name)
            .bind(&item.group_id)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        Ok(summary)
    }

    /// List existing dataset splits for project
    pub async fn list_dataset_splits(
        pool: &SqlitePool,
        project_id: &str,
    ) -> Result<Vec<SplitSummary>, AppError> {
        let rows: Vec<(String, String, i64, i64, i64, i64, i64, f64, f64, f64, i64)> = sqlx::query_as(
            "SELECT id, name, seed, train_count, val_count, eval_count, total_count, train_pct, val_pct, eval_pct, leakage_free
             FROM dataset_splits
             WHERE project_id = ?
             ORDER BY created_at DESC"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let splits = rows.into_iter().map(|r| SplitSummary {
            split_id: r.0,
            name: r.1,
            seed: r.2 as u64,
            train_count: r.3 as usize,
            val_count: r.4 as usize,
            eval_count: r.5 as usize,
            total_count: r.6 as usize,
            train_pct: r.7,
            val_pct: r.8,
            eval_pct: r.9,
            leakage_free: r.10 == 1,
            leakage_violations: Vec::new(),
        }).collect();

        Ok(splits)
    }

    /// Generate Training Readiness Flagship Report
    pub async fn generate_training_readiness_report(
        pool: &SqlitePool,
        project_id: &str,
        title: &str,
        model_family: &str,
        max_seq_len: usize,
    ) -> Result<TrainingReadinessReport, AppError> {
        let (sft_count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sft_records WHERE project_id = ?"
        )
        .bind(project_id)
        .fetch_one(pool)
        .await?;

        let (dpo_count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM dpo_tasks WHERE project_id = ?"
        )
        .bind(project_id)
        .fetch_one(pool)
        .await?;

        let tmpl_summary = Self::validate_chat_templates(pool, project_id, model_family, false).await.ok();
        let seq_report = Self::run_sequence_analytics(pool, project_id, model_family, max_seq_len, "tail", true).await.ok();
        let dedup_report = Self::run_deduplication(pool, project_id, 0.85).await.ok();
        let persona_report = Self::run_persona_audit(pool, project_id, "multiple_intentional_personas").await.ok();

        let splits = Self::list_dataset_splits(pool, project_id).await.unwrap_or_default();
        let latest_split = splits.first();

        let report_id = format!("rep-{}", Uuid::new_v4());
        let report = ReadinessEngine::evaluate(
            &report_id,
            project_id,
            title,
            model_family,
            max_seq_len,
            sft_count as usize,
            dpo_count as usize,
            tmpl_summary.as_ref(),
            seq_report.as_ref(),
            dedup_report.as_ref(),
            persona_report.as_ref(),
            latest_split,
            None,
        );

        let now = chrono::Utc::now().to_rfc3339();
        let report_json_str = serde_json::to_string(&report).unwrap_or_else(|_| "{}".to_string());
        let summary_json_str = serde_json::to_string(&report.summary).unwrap_or_else(|_| "{}".to_string());

        sqlx::query(
            "INSERT INTO training_readiness_reports (id, project_id, title, status, model_family, max_seq_len, total_records, summary_json, report_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&report.report_id)
        .bind(project_id)
        .bind(&report.title)
        .bind(&report.status)
        .bind(&report.model_family)
        .bind(report.max_seq_len as i64)
        .bind(report.total_records as i64)
        .bind(&summary_json_str)
        .bind(&report_json_str)
        .bind(&now)
        .execute(pool)
        .await?;

        Ok(report)
    }

    /// List saved readiness reports
    pub async fn list_readiness_reports(
        pool: &SqlitePool,
        project_id: &str,
    ) -> Result<Vec<TrainingReadinessReport>, AppError> {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT report_json FROM training_readiness_reports WHERE project_id = ? ORDER BY created_at DESC"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await?;

        let list = rows
            .into_iter()
            .filter_map(|(json_str,)| serde_json::from_str::<TrainingReadinessReport>(&json_str).ok())
            .collect();

        Ok(list)
    }

    /// Export DPO dataset in Hugging Face TRL Conversational Preference format
    pub async fn export_conversational_dpo(
        pool: &SqlitePool,
        project_id: &str,
        format_type: &str,
        only_completed: bool,
    ) -> Result<String, AppError> {
        let sql = if only_completed {
            "SELECT id, system_prompt, prompt, response_a, response_b, preference, rationale, metadata_json
             FROM dpo_tasks
             WHERE project_id = ? AND preference IS NOT NULL AND preference IN ('a', 'b')
             ORDER BY created_at ASC"
        } else {
            "SELECT id, system_prompt, prompt, response_a, response_b, preference, rationale, metadata_json
             FROM dpo_tasks
             WHERE project_id = ?
             ORDER BY created_at ASC"
        };

        let rows: Vec<(String, Option<String>, String, String, String, Option<String>, Option<String>, String)> = sqlx::query_as(sql)
            .bind(project_id)
            .fetch_all(pool)
            .await?;

        let mut formatted = Vec::new();
        for (id, sys, prompt, resp_a, resp_b, pref, rat, meta_json) in rows {
            let meta: Option<Value> = serde_json::from_str(&meta_json).ok();
            if let Some(record) = ConversationalDPOEngine::format_task(
                &id,
                sys.as_deref(),
                &prompt,
                &resp_a,
                &resp_b,
                pref.as_deref(),
                rat.as_deref(),
                meta,
            ) {
                formatted.push(record);
            }
        }

        ConversationalDPOEngine::serialize_dataset(&formatted, format_type)
            .map_err(|e| AppError::Internal(e))
    }
}
