use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateRecordEntry {
    pub record_id: String,
    pub title: String,
    pub similarity_to_primary: f64,
    pub fingerprint: String,
    pub preview: String,
    pub turn_count: usize,
    pub decision: Option<String>, // "retain", "exclude", "acceptable"
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub group_id: String,
    pub duplicate_type: String, // "exact", "normalized", "near"
    pub primary_record_id: String,
    pub max_similarity: f64,
    pub records: Vec<DuplicateRecordEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeduplicationReport {
    pub total_records_analyzed: usize,
    pub total_unique_records: usize,
    pub exact_duplicate_groups_count: usize,
    pub normalized_duplicate_groups_count: usize,
    pub near_duplicate_groups_count: usize,
    pub total_duplicate_records_flagged: usize,
    pub duplicate_rate_pct: f64,
    pub groups: Vec<DuplicateGroup>,
}

pub struct DeduplicationEngine;

impl DeduplicationEngine {
    /// Compute exact SHA-256 hash of raw serialized conversation string
    pub fn compute_exact_hash(text: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// Compute normalized string (trimmed, lowercased, whitespace collapsed, non-alphanumeric filtered)
    pub fn normalize_text(text: &str) -> String {
        let lower = text.to_lowercase();
        let words: Vec<&str> = lower.split_whitespace().collect();
        words.join(" ")
    }

    /// Compute 3-gram character shingles for Jaccard near-duplicate comparison
    pub fn get_shingles(text: &str, k: usize) -> HashSet<String> {
        let clean = Self::normalize_text(text);
        let chars: Vec<char> = clean.chars().collect();
        if chars.len() < k {
            let mut set = HashSet::new();
            if !chars.is_empty() {
                set.insert(chars.into_iter().collect());
            }
            return set;
        }

        let mut shingles = HashSet::new();
        for i in 0..=(chars.len() - k) {
            let shingle: String = chars[i..(i + k)].iter().collect();
            shingles.insert(shingle);
        }
        shingles
    }

    /// Calculate Jaccard similarity between two sets of shingles
    pub fn jaccard_similarity(set_a: &HashSet<String>, set_b: &HashSet<String>) -> f64 {
        if set_a.is_empty() && set_b.is_empty() {
            return 1.0;
        }
        if set_a.is_empty() || set_b.is_empty() {
            return 0.0;
        }
        let intersection = set_a.intersection(set_b).count();
        let union = set_a.union(set_b).count();
        (intersection as f64) / (union as f64)
    }

    pub fn analyze(
        examples: &[(String, String, String)], // (Record ID, Title, Serialized Text)
        near_duplicate_threshold: f64,
        saved_decisions: &HashMap<String, (String, Option<String>)>, // record_id -> (decision, note)
    ) -> DeduplicationReport {
        let total = examples.len();
        if total == 0 {
            return DeduplicationReport {
                total_records_analyzed: 0,
                total_unique_records: 0,
                exact_duplicate_groups_count: 0,
                normalized_duplicate_groups_count: 0,
                near_duplicate_groups_count: 0,
                total_duplicate_records_flagged: 0,
                duplicate_rate_pct: 0.0,
                groups: Vec::new(),
            };
        }

        // 1. Find Exact Duplicates
        let mut exact_map: HashMap<String, Vec<usize>> = HashMap::new();
        for (idx, (_, _, text)) in examples.iter().enumerate() {
            let hash = Self::compute_exact_hash(text);
            exact_map.entry(hash).or_default().push(idx);
        }

        let mut covered_indices = HashSet::new();
        let mut groups = Vec::new();
        let mut group_counter = 1usize;

        for (_hash, indices) in exact_map {
            if indices.len() > 1 {
                let primary_idx = indices[0];
                let primary_id = examples[primary_idx].0.clone();
                let group_id = format!("grp-exact-{:04}", group_counter);
                group_counter += 1;

                let mut entries = Vec::new();
                for &idx in &indices {
                    covered_indices.insert(idx);
                    let (rec_id, title, text) = &examples[idx];
                    let (decision, note) = saved_decisions
                        .get(rec_id)
                        .cloned()
                        .unwrap_or(("retain".to_string(), None));

                    entries.push(DuplicateRecordEntry {
                        record_id: rec_id.clone(),
                        title: title.clone(),
                        similarity_to_primary: 1.0,
                        fingerprint: Self::compute_exact_hash(text),
                        preview: text.chars().take(240).collect(),
                        turn_count: 0,
                        decision: Some(decision),
                        note,
                    });
                }

                groups.push(DuplicateGroup {
                    group_id,
                    duplicate_type: "exact".to_string(),
                    primary_record_id: primary_id,
                    max_similarity: 1.0,
                    records: entries,
                });
            }
        }

        // 2. Find Normalized Duplicates (among uncovered examples)
        let mut norm_map: HashMap<String, Vec<usize>> = HashMap::new();
        for (idx, (_, _, text)) in examples.iter().enumerate() {
            if !covered_indices.contains(&idx) {
                let norm = Self::normalize_text(text);
                let norm_hash = Self::compute_exact_hash(&norm);
                norm_map.entry(norm_hash).or_default().push(idx);
            }
        }

        for (_hash, indices) in norm_map {
            if indices.len() > 1 {
                let primary_idx = indices[0];
                let primary_id = examples[primary_idx].0.clone();
                let group_id = format!("grp-norm-{:04}", group_counter);
                group_counter += 1;

                let mut entries = Vec::new();
                for &idx in &indices {
                    covered_indices.insert(idx);
                    let (rec_id, title, text) = &examples[idx];
                    let (decision, note) = saved_decisions
                        .get(rec_id)
                        .cloned()
                        .unwrap_or(("retain".to_string(), None));

                    entries.push(DuplicateRecordEntry {
                        record_id: rec_id.clone(),
                        title: title.clone(),
                        similarity_to_primary: 0.99,
                        fingerprint: Self::compute_exact_hash(&Self::normalize_text(text)),
                        preview: text.chars().take(240).collect(),
                        turn_count: 0,
                        decision: Some(decision),
                        note,
                    });
                }

                groups.push(DuplicateGroup {
                    group_id,
                    duplicate_type: "normalized".to_string(),
                    primary_record_id: primary_id,
                    max_similarity: 0.99,
                    records: entries,
                });
            }
        }

        // 3. Near-Duplicate Detection via 3-gram Shingles
        let shingle_list: Vec<(usize, HashSet<String>)> = examples
            .iter()
            .enumerate()
            .filter(|(idx, _)| !covered_indices.contains(idx))
            .map(|(idx, (_, _, text))| (idx, Self::get_shingles(text, 3)))
            .collect();

        let threshold = near_duplicate_threshold.clamp(0.50, 0.99);
        let mut near_groups: Vec<Vec<(usize, f64)>> = Vec::new();
        let mut near_covered = HashSet::new();

        for i in 0..shingle_list.len() {
            let (idx_a, shingles_a) = &shingle_list[i];
            if near_covered.contains(idx_a) {
                continue;
            }

            let mut cluster = vec![(*idx_a, 1.0)];

            for j in (i + 1)..shingle_list.len() {
                let (idx_b, shingles_b) = &shingle_list[j];
                if near_covered.contains(idx_b) {
                    continue;
                }

                let sim = Self::jaccard_similarity(shingles_a, shingles_b);
                if sim >= threshold {
                    cluster.push((*idx_b, sim));
                }
            }

            if cluster.len() > 1 {
                for &(idx, _) in &cluster {
                    near_covered.insert(idx);
                }
                near_groups.push(cluster);
            }
        }

        for cluster in near_groups {
            let primary_idx = cluster[0].0;
            let primary_id = examples[primary_idx].0.clone();
            let group_id = format!("grp-near-{:04}", group_counter);
            group_counter += 1;

            let mut max_sim = 0.0f64;
            let mut entries = Vec::new();

            for &(idx, sim) in &cluster {
                if sim < 1.0 && sim > max_sim {
                    max_sim = sim;
                }
                let (rec_id, title, text) = &examples[idx];
                let (decision, note) = saved_decisions
                    .get(rec_id)
                    .cloned()
                    .unwrap_or(("retain".to_string(), None));

                entries.push(DuplicateRecordEntry {
                    record_id: rec_id.clone(),
                    title: title.clone(),
                    similarity_to_primary: sim,
                    fingerprint: Self::compute_exact_hash(text),
                    preview: text.chars().take(240).collect(),
                    turn_count: 0,
                    decision: Some(decision),
                    note,
                });
            }

            groups.push(DuplicateGroup {
                group_id,
                duplicate_type: "near".to_string(),
                primary_record_id: primary_id,
                max_similarity: if max_sim > 0.0 { max_sim } else { threshold },
                records: entries,
            });
        }

        let exact_count = groups.iter().filter(|g| g.duplicate_type == "exact").count();
        let norm_count = groups.iter().filter(|g| g.duplicate_type == "normalized").count();
        let near_count = groups.iter().filter(|g| g.duplicate_type == "near").count();

        let total_flagged: usize = groups.iter().map(|g| g.records.len().saturating_sub(1)).sum();
        let unique_count = total.saturating_sub(total_flagged);
        let dup_rate = ((total_flagged as f64) / (total as f64)) * 100.0;

        DeduplicationReport {
            total_records_analyzed: total,
            total_unique_records: unique_count,
            exact_duplicate_groups_count: exact_count,
            normalized_duplicate_groups_count: norm_count,
            near_duplicate_groups_count: near_count,
            total_duplicate_records_flagged: total_flagged,
            duplicate_rate_pct: dup_rate,
            groups,
        }
    }
}
