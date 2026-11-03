export interface ModelTemplateDef {
  id: string
  name: string
  family: string
  template: string
  bos_token: string
  eos_token: string
  supports_system_role: boolean
  system_turn_template?: string
}

export interface ValidationResult {
  record_id: string
  is_valid: boolean
  errors: string[]
  warnings: string[]
  rendered_template?: string
  token_estimate: number
}

export interface TemplateCompatibilitySummary {
  total_records: number
  compliant_records: number
  non_compliant_records: number
  compliance_rate: number
  model_id: string
  model_name: string
  results: ValidationResult[]
}

export interface HistogramBucket {
  min_len: number
  max_len: number
  count: number
  percentage: number
}

export interface LengthComparisonPoint {
  limit: number
  records_within_limit: number
  records_exceeding_limit: number
  pct_within_limit: number
  total_tokens_at_limit: number
  tokens_truncated: number
}

export interface SequenceAnalyticsReport {
  total_records: number
  model_family: string
  max_seq_len: number
  truncation_strategy: string
  min_len: number
  max_len: number
  mean_len: number
  median_len: number
  p90_len: number
  p95_len: number
  p99_len: number
  total_estimated_tokens: number
  truncated_records_count: number
  truncated_tokens_count: number
  histogram: HistogramBucket[]
  comparison_matrix: LengthComparisonPoint[]
}

export interface DuplicateRecordEntry {
  record_id: string
  title: string
  system_prompt: string
  preview: string
  similarity_to_primary: number
  decision?: 'retain' | 'exclude' | 'acceptable' | string
  note?: string
}

export interface DuplicateGroup {
  group_id: string
  match_type: 'exact' | 'normalized' | 'near' | string
  primary_record_id: string
  records: DuplicateRecordEntry[]
}

export interface DeduplicationReport {
  total_scanned: number
  unique_records: number
  duplicate_groups_count: number
  total_duplicate_records: number
  exact_duplicates: number
  normalized_duplicates: number
  near_duplicates: number
  groups: DuplicateGroup[]
}

export interface SystemPromptCluster {
  cluster_id: string
  prompt_text: string
  count: number
  percentage: number
  sample_record_ids: string[]
}

export interface PersonaWarning {
  warning_type: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  affected_records_count: number
}

export interface PersonaAuditReport {
  total_records: number
  records_with_system_prompt: number
  records_missing_system_prompt: number
  unique_system_prompts: number
  dominant_persona_share: number
  policy_applied: string
  is_policy_compliant: boolean
  clusters: SystemPromptCluster[]
  warnings: PersonaWarning[]
}

export interface SplitAssignmentItem {
  record_id: string
  record_type: string
  split_name: 'train' | 'val' | 'eval' | string
  group_id?: string
}

export interface SplitSummary {
  split_id: string
  name: string
  seed: number
  train_pct: number
  val_pct: number
  eval_pct: number
  total_count: number
  train_count: number
  val_count: number
  eval_count: number
  created_at: string
  zero_leakage_verified: boolean
  assignments: SplitAssignmentItem[]
}

export interface ReadinessCheckItem {
  dimension: string
  title: string
  status: 'pass' | 'warn' | 'fail'
  is_mandatory: boolean
  details: string
  recommendation?: string
}

export interface TrainingReadinessReport {
  report_id: string
  project_id: string
  title: string
  overall_status: 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED'
  total_records: number
  target_model: string
  max_seq_len: number
  generated_at: string
  checks: ReadinessCheckItem[]
  markdown_summary: string
}

export interface ConversationalDPOPreference {
  prompt: Array<{ role: string; content: string }>
  chosen: Array<{ role: string; content: string }>
  rejected: Array<{ role: string; content: string }>
  metadata?: Record<string, any>
}
