use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitSummary {
    pub split_id: String,
    pub name: String,
    pub seed: u64,
    pub train_count: usize,
    pub val_count: usize,
    pub eval_count: usize,
    pub total_count: usize,
    pub train_pct: f64,
    pub val_pct: f64,
    pub eval_pct: f64,
    pub leakage_free: bool,
    pub leakage_violations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitAssignmentItem {
    pub record_id: String,
    pub record_type: String, // "sft" or "dpo"
    pub split_name: String,  // "train", "val", "eval"
    pub group_id: Option<String>,
}

pub struct SplitEngine;

impl SplitEngine {
    /// Deterministic pseudo-random generator using SplitMix64 based on the seed
    fn splitmix64(state: &mut u64) -> u64 {
        *state = state.wrapping_add(0x9e3779b97f4a7c15);
        let mut z = *state;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
        z ^ (z >> 31)
    }

    /// Group-based deterministic splitting with 100% data leakage prevention
    pub fn create_leakage_free_split(
        split_id: &str,
        name: &str,
        records: &[(String, String, Option<String>)], // (Record ID, Record Type, Group ID)
        seed: u64,
        train_ratio: f64,
        val_ratio: f64,
        eval_ratio: f64,
    ) -> (SplitSummary, Vec<SplitAssignmentItem>) {
        let total_ratio = train_ratio + val_ratio + eval_ratio;
        let norm_train = if total_ratio > 0.0 { train_ratio / total_ratio } else { 0.8 };
        let norm_val = if total_ratio > 0.0 { val_ratio / total_ratio } else { 0.1 };

        // 1. Group records by group_id (or individual record ID if no group)
        let mut groups: HashMap<String, Vec<(String, String)>> = HashMap::new();
        for (rec_id, r_type, group_opt) in records {
            let key = group_opt.clone().unwrap_or_else(|| rec_id.clone());
            groups.entry(key).or_default().push((rec_id.clone(), r_type.clone()));
        }

        // Sort group keys for deterministic ordering prior to shuffle
        let mut group_keys: Vec<String> = groups.keys().cloned().collect();
        group_keys.sort();

        // 2. Deterministic Fisher-Yates shuffle using seed
        let mut rng_state = seed;
        for i in (1..group_keys.len()).rev() {
            let rand_val = Self::splitmix64(&mut rng_state);
            let j = (rand_val as usize) % (i + 1);
            group_keys.swap(i, j);
        }

        // 3. Assign atomic groups to splits
        let mut assignments = Vec::new();
        let total_groups = group_keys.len();
        let train_cutoff = ((total_groups as f64) * norm_train).round() as usize;
        let val_cutoff = ((total_groups as f64) * (norm_train + norm_val)).round() as usize;

        let mut train_count = 0usize;
        let mut val_count = 0usize;
        let mut eval_count = 0usize;

        for (idx, group_key) in group_keys.iter().enumerate() {
            let split_name = if idx < train_cutoff {
                "train"
            } else if idx < val_cutoff {
                "val"
            } else {
                "eval"
            };

            let items = &groups[group_key];
            for (rec_id, r_type) in items {
                match split_name {
                    "train" => train_count += 1,
                    "val" => val_count += 1,
                    _ => eval_count += 1,
                }

                assignments.push(SplitAssignmentItem {
                    record_id: rec_id.clone(),
                    record_type: r_type.clone(),
                    split_name: split_name.to_string(),
                    group_id: Some(group_key.clone()),
                });
            }
        }

        // 4. Verify Leakage Integrity
        let (leakage_free, violations) = Self::verify_leakage(&assignments);

        let total_count = train_count + val_count + eval_count;
        let summary = SplitSummary {
            split_id: split_id.to_string(),
            name: name.to_string(),
            seed,
            train_count,
            val_count,
            eval_count,
            total_count,
            train_pct: if total_count > 0 { ((train_count as f64) / (total_count as f64)) * 100.0 } else { 0.0 },
            val_pct: if total_count > 0 { ((val_count as f64) / (total_count as f64)) * 100.0 } else { 0.0 },
            eval_pct: if total_count > 0 { ((eval_count as f64) / (total_count as f64)) * 100.0 } else { 0.0 },
            leakage_free,
            leakage_violations: violations,
        };

        (summary, assignments)
    }

    /// Verifies that no group_id spans multiple distinct splits
    pub fn verify_leakage(assignments: &[SplitAssignmentItem]) -> (bool, Vec<String>) {
        let mut group_splits: HashMap<String, HashSet<String>> = HashMap::new();
        for item in assignments {
            if let Some(ref gid) = item.group_id {
                group_splits.entry(gid.clone()).or_default().insert(item.split_name.clone());
            }
        }

        let mut violations = Vec::new();
        for (gid, splits) in group_splits {
            if splits.len() > 1 {
                violations.push(format!(
                    "Data Leakage Detected: Group '{}' is distributed across multiple splits: {:?}",
                    gid, splits
                ));
            }
        }

        let is_free = violations.is_empty();
        (is_free, violations)
    }
}
