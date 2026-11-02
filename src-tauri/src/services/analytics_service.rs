use sqlx::SqlitePool;
use serde_json::json;
use crate::errors::AppError;
use crate::models::AnalyticsResponse;

pub struct AnalyticsService;

impl AnalyticsService {
    pub async fn get_dashboard_analytics(
        pool: &SqlitePool,
        project_id: Option<&str>,
    ) -> Result<AnalyticsResponse, AppError> {
        let (project_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM projects WHERE is_archived = 0")
            .fetch_one(pool)
            .await?;

        // SFT metrics
        let (sft_records, sft_turns, sft_chars): (i64, i64, i64) = if let Some(pid) = project_id {
            sqlx::query_as(
                "SELECT COUNT(*), COALESCE(SUM(turn_count), 0), COALESCE(SUM(character_count), 0)
                 FROM sft_records WHERE project_id = ?"
            )
            .bind(pid)
            .fetch_one(pool)
            .await?
        } else {
            sqlx::query_as(
                "SELECT COUNT(*), COALESCE(SUM(turn_count), 0), COALESCE(SUM(character_count), 0)
                 FROM sft_records"
            )
            .fetch_one(pool)
            .await?
        };

        let avg_turns = if sft_records > 0 { sft_turns as f64 / sft_records as f64 } else { 0.0 };
        let avg_chars = if sft_records > 0 { sft_chars as f64 / sft_records as f64 } else { 0.0 };

        // DPO metrics
        let dpo_rows: Vec<(String, Option<String>, i64)> = if let Some(pid) = project_id {
            sqlx::query_as(
                "SELECT status, preference, COUNT(*) FROM dpo_tasks WHERE project_id = ? GROUP BY status, preference"
            )
            .bind(pid)
            .fetch_all(pool)
            .await?
        } else {
            sqlx::query_as(
                "SELECT status, preference, COUNT(*) FROM dpo_tasks GROUP BY status, preference"
            )
            .fetch_all(pool)
            .await?
        };

        let mut total_dpo = 0;
        let mut completed_dpo = 0;
        let mut pending_dpo = 0;
        let mut flagged_dpo = 0;
        let mut skipped_dpo = 0;
        let mut chosen_a = 0;
        let mut chosen_b = 0;
        let mut tie_count = 0;
        let mut both_bad_count = 0;

        for (status, pref, count) in dpo_rows {
            total_dpo += count;
            match status.as_str() {
                "completed" => completed_dpo += count,
                "pending" => pending_dpo += count,
                "flagged" => flagged_dpo += count,
                "skipped" => skipped_dpo += count,
                _ => {}
            }
            if let Some(p) = pref {
                match p.as_str() {
                    "a" => chosen_a += count,
                    "b" => chosen_b += count,
                    "tie" => tie_count += count,
                    "both_bad" => both_bad_count += count,
                    _ => {}
                }
            }
        }

        // Timeline growth
        let timeline_rows: Vec<(String, i64)> = if let Some(pid) = project_id {
            sqlx::query_as(
                "SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*)
                 FROM sft_records
                 WHERE project_id = ?
                 GROUP BY day
                 ORDER BY day ASC
                 LIMIT 30"
            )
            .bind(pid)
            .fetch_all(pool)
            .await?
        } else {
            sqlx::query_as(
                "SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*)
                 FROM sft_records
                 GROUP BY day
                 ORDER BY day ASC
                 LIMIT 30"
            )
            .fetch_all(pool)
            .await?
        };

        let timeline = timeline_rows.into_iter().map(|(day, count)| {
            json!({
                "date": day,
                "count": count
            })
        }).collect();

        Ok(AnalyticsResponse {
            project_id: project_id.map(|s| s.to_string()),
            total_projects: project_count,
            sft_metrics: json!({
                "total_records": sft_records,
                "total_turns": sft_turns,
                "average_turns_per_conversation": (avg_turns * 100.0).round() / 100.0,
                "total_characters": sft_chars,
                "average_characters_per_record": (avg_chars * 100.0).round() / 100.0,
            }),
            dpo_metrics: json!({
                "total_tasks": total_dpo,
                "completed": completed_dpo,
                "pending": pending_dpo,
                "flagged": flagged_dpo,
                "skipped": skipped_dpo,
                "chosen_a": chosen_a,
                "chosen_b": chosen_b,
                "tie": tie_count,
                "both_bad": both_bad_count,
            }),
            shared_metrics: json!({
                "total_dataset_items": sft_records + total_dpo
            }),
            model_usage: json!({
                "default": sft_records
            }),
            timeline_growth: timeline,
        })
    }
}
