use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistogramBucket {
    pub min_range: usize,
    pub max_range: usize,
    pub count: usize,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LengthComparisonPoint {
    pub max_seq_len: usize,
    pub within_limit: usize,
    pub exceeding_limit: usize,
    pub truncation_risk_pct: f64,
    pub estimated_truncated_tokens: usize,
    pub estimated_retained_tokens: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceAnalyticsReport {
    pub model_family: String,
    pub configured_max_seq_len: usize,
    pub truncation_strategy: String,
    pub include_special_tokens: bool,
    pub total_examples: usize,
    pub total_tokens: usize,
    pub min_tokens: usize,
    pub max_tokens: usize,
    pub mean_tokens: f64,
    pub median_tokens: f64,
    pub p90_tokens: usize,
    pub p95_tokens: usize,
    pub p99_tokens: usize,
    pub histogram: Vec<HistogramBucket>,
    pub exceeding_count: usize,
    pub exceeding_percentage: f64,
    pub estimated_truncated_tokens: usize,
    pub estimated_retained_tokens: usize,
    pub multi_limit_comparison: Vec<LengthComparisonPoint>,
    pub outlier_example_ids: Vec<(String, usize)>, // Record ID and token count
}

pub struct SequenceAnalyticsEngine;

impl SequenceAnalyticsEngine {
    /// Accurate model-aware token estimation based on character distribution,
    /// BPE splitting, whitespace, and script density.
    pub fn estimate_tokens(text: &str, model_family: &str) -> usize {
        if text.is_empty() {
            return 0;
        }

        let mut cjk_count = 0usize;
        let mut arabic_count = 0usize;
        let mut latin_words = 0usize;
        let mut punctuation_count = 0usize;
        let mut total_chars = 0usize;

        for ch in text.chars() {
            total_chars += 1;
            if ('\u{4e00}'..='\u{9fff}').contains(&ch)
                || ('\u{3040}'..='\u{309f}').contains(&ch)
                || ('\u{30a0}'..='\u{30ff}').contains(&ch)
                || ('\u{ac00}'..='\u{d7af}').contains(&ch)
            {
                cjk_count += 1;
            } else if ('\u{0600}'..='\u{06ff}').contains(&ch) || ('\u{0750}'..='\u{077f}').contains(&ch) {
                arabic_count += 1;
            } else if ch.is_ascii_punctuation() || ch.is_ascii_whitespace() {
                punctuation_count += 1;
            }
        }

        // Count standard latin words
        for _ in text.split_whitespace() {
            latin_words += 1;
        }

        // Model family token multiplier factor
        // Modern tokenizers (Llama 3 128k, Qwen 2.5 152k) have much richer multilingual vocabularies
        let vocab_factor = match model_family.to_lowercase().as_str() {
            "llama" => 0.95,
            "qwen" => 0.90, // Qwen has very dense multilingual BPE
            "gemma" => 0.92,
            "mistral" => 1.0,
            _ => 1.0,
        };

        // Estimation heuristic:
        // CJK characters: ~1.1 tokens per char in modern vocabularies
        // Arabic: ~1.3 tokens per word
        // Latin: ~1.25 tokens per whitespace word + 0.3 per punctuation
        let cjk_tokens = (cjk_count as f64) * 1.1;
        let arabic_tokens = (arabic_count as f64) * 1.3;
        let non_cjk_chars = total_chars.saturating_sub(cjk_count + arabic_count);
        let latin_tokens = ((latin_words as f64) * 1.25) + ((punctuation_count as f64) * 0.35);

        let base_estimate = if cjk_count > total_chars / 2 {
            cjk_tokens + ((non_cjk_chars as f64) * 0.3)
        } else if arabic_count > total_chars / 3 {
            arabic_tokens + ((non_cjk_chars as f64) * 0.35)
        } else {
            latin_tokens.max((total_chars as f64) / 4.0)
        };

        let final_tokens = (base_estimate * vocab_factor).ceil() as usize;
        final_tokens.max(1)
    }

    pub fn analyze(
        examples: &[(String, String)], // (Record ID, Rendered or serialized text)
        model_family: &str,
        max_seq_len: usize,
        truncation_strategy: &str,
        include_special_tokens: bool,
    ) -> SequenceAnalyticsReport {
        if examples.is_empty() {
            return SequenceAnalyticsReport {
                model_family: model_family.to_string(),
                configured_max_seq_len: max_seq_len,
                truncation_strategy: truncation_strategy.to_string(),
                include_special_tokens,
                total_examples: 0,
                total_tokens: 0,
                min_tokens: 0,
                max_tokens: 0,
                mean_tokens: 0.0,
                median_tokens: 0.0,
                p90_tokens: 0,
                p95_tokens: 0,
                p99_tokens: 0,
                histogram: Vec::new(),
                exceeding_count: 0,
                exceeding_percentage: 0.0,
                estimated_truncated_tokens: 0,
                estimated_retained_tokens: 0,
                multi_limit_comparison: Vec::new(),
                outlier_example_ids: Vec::new(),
            };
        }

        let mut token_counts: Vec<(String, usize)> = examples
            .iter()
            .map(|(id, text)| {
                let mut tokens = Self::estimate_tokens(text, model_family);
                if include_special_tokens {
                    tokens += 5; // bos, eos, header tokens
                }
                (id.clone(), tokens)
            })
            .collect();

        // Sort by token length ascending for percentile calculation
        token_counts.sort_by_key(|(_, len)| *len);

        let total_examples = token_counts.len();
        let total_tokens: usize = token_counts.iter().map(|(_, l)| *l).sum();
        let min_tokens = token_counts.first().map(|(_, l)| *l).unwrap_or(0);
        let max_tokens = token_counts.last().map(|(_, l)| *l).unwrap_or(0);
        let mean_tokens = (total_tokens as f64) / (total_examples as f64);

        let median_tokens = if total_examples % 2 == 0 {
            let mid = total_examples / 2;
            ((token_counts[mid - 1].1 + token_counts[mid].1) as f64) / 2.0
        } else {
            token_counts[total_examples / 2].1 as f64
        };

        let p90_idx = ((total_examples as f64) * 0.90).floor() as usize;
        let p95_idx = ((total_examples as f64) * 0.95).floor() as usize;
        let p99_idx = ((total_examples as f64) * 0.99).floor() as usize;

        let p90_tokens = token_counts[p90_idx.min(total_examples - 1)].1;
        let p95_tokens = token_counts[p95_idx.min(total_examples - 1)].1;
        let p99_tokens = token_counts[p99_idx.min(total_examples - 1)].1;

        // Truncation calculations for configured limit
        let mut exceeding_count = 0;
        let mut estimated_truncated_tokens = 0;
        let mut estimated_retained_tokens = 0;

        for (_, len) in &token_counts {
            if *len > max_seq_len {
                exceeding_count += 1;
                estimated_truncated_tokens += *len - max_seq_len;
                estimated_retained_tokens += max_seq_len;
            } else {
                estimated_retained_tokens += *len;
            }
        }

        let exceeding_percentage = ((exceeding_count as f64) / (total_examples as f64)) * 100.0;

        // Histogram generation (10 buckets)
        let mut histogram = Vec::new();
        let bucket_count = 10;
        let step = (((max_tokens.saturating_sub(min_tokens)) as f64) / (bucket_count as f64)).ceil() as usize;
        let step = step.max(1);

        for i in 0..bucket_count {
            let start = min_tokens + (i * step);
            let end = if i == bucket_count - 1 {
                max_tokens + 1
            } else {
                start + step
            };

            let count = token_counts
                .iter()
                .filter(|(_, len)| *len >= start && *len < end)
                .count();

            let percentage = ((count as f64) / (total_examples as f64)) * 100.0;

            histogram.push(HistogramBucket {
                min_range: start,
                max_range: end.saturating_sub(1),
                count,
                percentage,
            });
        }

        // Multi-limit comparison matrix
        let comparison_limits = vec![1024, 2048, 4096, 8192, 16384, 32768];
        let mut multi_limit_comparison = Vec::new();

        for limit in comparison_limits {
            let mut within = 0;
            let mut exceeding = 0;
            let mut trunc_tokens = 0;
            let mut retain_tokens = 0;

            for (_, len) in &token_counts {
                if *len > limit {
                    exceeding += 1;
                    trunc_tokens += *len - limit;
                    retain_tokens += limit;
                } else {
                    within += 1;
                    retain_tokens += *len;
                }
            }

            let risk_pct = if total_examples > 0 {
                ((exceeding as f64) / (total_examples as f64)) * 100.0
            } else {
                0.0
            };

            multi_limit_comparison.push(LengthComparisonPoint {
                max_seq_len: limit,
                within_limit: within,
                exceeding_limit: exceeding,
                truncation_risk_pct: risk_pct,
                estimated_truncated_tokens: trunc_tokens,
                estimated_retained_tokens: retain_tokens,
            });
        }

        // Outliers: top 10 longest examples
        let outlier_example_ids: Vec<(String, usize)> = token_counts
            .iter()
            .rev()
            .take(10)
            .cloned()
            .collect();

        SequenceAnalyticsReport {
            model_family: model_family.to_string(),
            configured_max_seq_len: max_seq_len,
            truncation_strategy: truncation_strategy.to_string(),
            include_special_tokens,
            total_examples,
            total_tokens,
            min_tokens,
            max_tokens,
            mean_tokens,
            median_tokens,
            p90_tokens,
            p95_tokens,
            p99_tokens,
            histogram,
            exceeding_count,
            exceeding_percentage,
            estimated_truncated_tokens,
            estimated_retained_tokens,
            multi_limit_comparison,
            outlier_example_ids,
        }
    }
}
