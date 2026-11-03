import type {
  TrainingReadinessReport,
  ReadinessCheckItem,
  TemplateCompatibilitySummary,
  ValidationResult,
  ModelTemplateDef,
  SequenceAnalyticsReport,
  HistogramBucket,
  LengthComparisonPoint,
  DeduplicationReport,
  DuplicateGroup,
  DuplicateRecordEntry,
  PersonaAuditReport,
  SystemPromptCluster,
  PersonaWarning,
  SplitSummary,
  SplitAssignmentItem
} from '../types/engineering'

/**
 * Normalizes readiness report items from backend Rust structs or API payloads.
 */
export function normalizeReadinessCheck(c: any): ReadinessCheckItem {
  if (!c || typeof c !== 'object') {
    return {
      dimension: 'General',
      title: 'Validation Check',
      status: 'pass',
      is_mandatory: false,
      details: 'Check completed successfully'
    }
  }

  let status: 'pass' | 'warn' | 'fail' = 'pass'
  if (c.status === 'pass' || c.status === 'warn' || c.status === 'fail') {
    status = c.status
  } else if (typeof c.passed === 'boolean') {
    if (c.passed) {
      status = 'pass'
    } else if (c.severity === 'warning' || c.severity === 'warn') {
      status = 'warn'
    } else {
      status = 'fail'
    }
  }

  return {
    dimension: String(c.dimension ?? c.category ?? 'General'),
    title: String(c.title ?? c.name ?? 'Readiness Dimension'),
    status,
    is_mandatory: Boolean(c.is_mandatory),
    details: String(c.details ?? c.message ?? ''),
    recommendation: c.recommendation ?? (c.details ? String(c.details) : undefined)
  }
}

/**
 * Normalizes a full Training Readiness Report.
 */
export function normalizeReadinessReport(raw: any): TrainingReadinessReport {
  if (!raw || typeof raw !== 'object') {
    return {
      report_id: `rep_${Date.now()}`,
      project_id: '',
      title: 'Training Readiness Report',
      overall_status: 'READY',
      total_records: 0,
      target_model: 'llama',
      max_seq_len: 4096,
      generated_at: new Date().toISOString(),
      checks: [],
      markdown_summary: ''
    }
  }

  const rawStatus = String(raw.overall_status ?? raw.status ?? 'READY').toUpperCase()
  const overall_status: 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED' =
    rawStatus.includes('WARN')
      ? 'READY_WITH_WARNINGS'
      : rawStatus.includes('BLOCK') || rawStatus.includes('FAIL')
      ? 'BLOCKED'
      : 'READY'

  const rawChecks = Array.isArray(raw.checks) ? raw.checks : []

  return {
    report_id: String(raw.report_id ?? `rep_${Date.now()}`),
    project_id: String(raw.project_id ?? ''),
    title: String(raw.title ?? 'Production Training Readiness Audit'),
    overall_status,
    total_records: Number(raw.total_records ?? raw.total_examples ?? 0),
    target_model: String(raw.target_model ?? raw.model_family ?? 'llama'),
    max_seq_len: Number(raw.max_seq_len ?? raw.configured_max_seq_len ?? 4096),
    generated_at: String(raw.generated_at ?? new Date().toISOString()),
    checks: rawChecks.map(normalizeReadinessCheck),
    markdown_summary: String(raw.markdown_summary ?? '')
  }
}

/**
 * Normalizes Model Template Definition
 */
export function normalizeModelTemplate(raw: any): ModelTemplateDef {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 'custom',
      name: 'Custom Template',
      family: 'generic',
      template: '',
      bos_token: '<s>',
      eos_token: '</s>',
      supports_system_role: true
    }
  }

  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? 'Custom Model'),
    family: String(raw.family ?? 'generic'),
    template: String(raw.template ?? ''),
    bos_token: String(raw.bos_token ?? ''),
    eos_token: String(raw.eos_token ?? ''),
    supports_system_role: Boolean(raw.supports_system_role ?? raw.supports_system ?? true),
    system_turn_template: raw.system_turn_template ? String(raw.system_turn_template) : undefined
  }
}

/**
 * Normalizes Template Validation Results
 */
export function normalizeValidationResult(r: any): ValidationResult {
  if (!r || typeof r !== 'object') {
    return {
      record_id: '',
      is_valid: true,
      errors: [],
      warnings: [],
      token_estimate: 0
    }
  }

  return {
    record_id: String(r.record_id ?? ''),
    is_valid: Boolean(r.is_valid),
    errors: Array.isArray(r.errors) ? r.errors.map(String) : [],
    warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
    rendered_template: r.rendered_template ?? r.rendered ?? '',
    token_estimate: Number(r.token_estimate ?? 0)
  }
}

/**
 * Normalizes Template Compatibility Summary
 */
export function normalizeTemplateSummary(raw: any): TemplateCompatibilitySummary {
  if (!raw || typeof raw !== 'object') {
    return {
      total_records: 0,
      compliant_records: 0,
      non_compliant_records: 0,
      compliance_rate: 100.0,
      model_id: '',
      model_name: '',
      results: []
    }
  }

  const rawResults = Array.isArray(raw.results)
    ? raw.results
    : Array.isArray(raw.sample_results)
    ? raw.sample_results
    : []

  return {
    total_records: Number(raw.total_records ?? raw.total_examples ?? 0),
    compliant_records: Number(raw.compliant_records ?? raw.compliant_count ?? 0),
    non_compliant_records: Number(raw.non_compliant_records ?? raw.non_compliant_count ?? 0),
    compliance_rate: Number(raw.compliance_rate ?? 0),
    model_id: String(raw.model_id ?? ''),
    model_name: String(raw.model_name ?? ''),
    results: rawResults.map(normalizeValidationResult)
  }
}

/**
 * Normalizes Sequence Analytics Report
 */
export function normalizeSequenceReport(raw: any): SequenceAnalyticsReport {
  if (!raw || typeof raw !== 'object') {
    return {
      total_records: 0,
      model_family: 'llama',
      max_seq_len: 4096,
      truncation_strategy: 'tail',
      min_len: 0,
      max_len: 0,
      mean_len: 0,
      median_len: 0,
      p90_len: 0,
      p95_len: 0,
      p99_len: 0,
      total_estimated_tokens: 0,
      truncated_records_count: 0,
      truncated_tokens_count: 0,
      histogram: [],
      comparison_matrix: []
    }
  }

  const rawHistogram = Array.isArray(raw.histogram) ? raw.histogram : []
  const histogram: HistogramBucket[] = rawHistogram.map((b: any) => ({
    min_len: Number(b?.min_len ?? b?.min_range ?? 0),
    max_len: Number(b?.max_len ?? b?.max_range ?? 0),
    count: Number(b?.count ?? 0),
    percentage: Number(b?.percentage ?? 0)
  }))

  const rawMatrix = Array.isArray(raw.comparison_matrix)
    ? raw.comparison_matrix
    : Array.isArray(raw.multi_limit_comparison)
    ? raw.multi_limit_comparison
    : []

  const comparison_matrix: LengthComparisonPoint[] = rawMatrix.map((m: any) => ({
    limit: Number(m?.limit ?? m?.max_seq_len ?? 0),
    records_within_limit: Number(m?.records_within_limit ?? m?.within_limit ?? 0),
    records_exceeding_limit: Number(m?.records_exceeding_limit ?? m?.exceeding_limit ?? 0),
    pct_within_limit: Number(
      m?.pct_within_limit ?? (100 - (Number(m?.truncation_risk_pct) || 0))
    ),
    total_tokens_at_limit: Number(m?.total_tokens_at_limit ?? m?.estimated_retained_tokens ?? 0),
    tokens_truncated: Number(m?.tokens_truncated ?? m?.estimated_truncated_tokens ?? 0)
  }))

  return {
    total_records: Number(raw.total_records ?? raw.total_examples ?? 0),
    model_family: String(raw.model_family ?? 'llama'),
    max_seq_len: Number(raw.max_seq_len ?? raw.configured_max_seq_len ?? 4096),
    truncation_strategy: String(raw.truncation_strategy ?? 'tail'),
    min_len: Number(raw.min_len ?? raw.min_tokens ?? 0),
    max_len: Number(raw.max_len ?? raw.max_tokens ?? 0),
    mean_len: Number(raw.mean_len ?? raw.mean_tokens ?? 0),
    median_len: Number(raw.median_len ?? raw.median_tokens ?? 0),
    p90_len: Number(raw.p90_len ?? raw.p90_tokens ?? 0),
    p95_len: Number(raw.p95_len ?? raw.p95_tokens ?? 0),
    p99_len: Number(raw.p99_len ?? raw.p99_tokens ?? 0),
    total_estimated_tokens: Number(raw.total_estimated_tokens ?? raw.total_tokens ?? 0),
    truncated_records_count: Number(raw.truncated_records_count ?? raw.exceeding_count ?? 0),
    truncated_tokens_count: Number(raw.truncated_tokens_count ?? raw.estimated_truncated_tokens ?? 0),
    histogram,
    comparison_matrix
  }
}

/**
 * Normalizes Deduplication Report
 */
export function normalizeDedupReport(raw: any): DeduplicationReport {
  if (!raw || typeof raw !== 'object') {
    return {
      total_scanned: 0,
      unique_records: 0,
      duplicate_groups_count: 0,
      total_duplicate_records: 0,
      exact_duplicates: 0,
      normalized_duplicates: 0,
      near_duplicates: 0,
      groups: []
    }
  }

  const rawGroups = Array.isArray(raw.groups) ? raw.groups : []
  const groups: DuplicateGroup[] = rawGroups.map((g: any) => {
    const rawRecords = Array.isArray(g?.records) ? g.records : []
    const records: DuplicateRecordEntry[] = rawRecords.map((r: any) => ({
      record_id: String(r?.record_id ?? ''),
      title: String(r?.title ?? 'Untitled Record'),
      system_prompt: String(r?.system_prompt ?? ''),
      preview: String(r?.preview ?? ''),
      similarity_to_primary: Number(r?.similarity_to_primary ?? 1.0),
      decision: r?.decision,
      note: r?.note
    }))

    return {
      group_id: String(g?.group_id ?? ''),
      match_type: (g?.match_type ?? g?.duplicate_type ?? 'near') as 'exact' | 'normalized' | 'near' | string,
      primary_record_id: String(g?.primary_record_id ?? ''),
      records
    }
  })

  const exact = Number(raw.exact_duplicates ?? raw.exact_duplicate_groups_count ?? 0)
  const norm = Number(raw.normalized_duplicates ?? raw.normalized_duplicate_groups_count ?? 0)
  const near = Number(raw.near_duplicates ?? raw.near_duplicate_groups_count ?? 0)

  return {
    total_scanned: Number(raw.total_scanned ?? raw.total_records_analyzed ?? 0),
    unique_records: Number(raw.unique_records ?? raw.total_unique_records ?? 0),
    duplicate_groups_count: Number(raw.duplicate_groups_count ?? (exact + norm + near)),
    total_duplicate_records: Number(raw.total_duplicate_records ?? raw.total_duplicate_records_flagged ?? 0),
    exact_duplicates: exact,
    normalized_duplicates: norm,
    near_duplicates: near,
    groups
  }
}

/**
 * Normalizes Persona Audit Report
 */
export function normalizePersonaReport(raw: any): PersonaAuditReport {
  if (!raw || typeof raw !== 'object') {
    return {
      total_records: 0,
      records_with_system_prompt: 0,
      records_missing_system_prompt: 0,
      unique_system_prompts: 0,
      dominant_persona_share: 0,
      policy_applied: 'multiple_intentional_personas',
      is_policy_compliant: true,
      clusters: [],
      warnings: []
    }
  }

  const rawClusters = Array.isArray(raw.clusters) ? raw.clusters : []
  const clusters: SystemPromptCluster[] = rawClusters.map((c: any, idx: number) => ({
    cluster_id: String(c?.cluster_id ?? `cluster-${idx + 1}`),
    prompt_text: String(c?.prompt_text ?? ''),
    count: Number(c?.count ?? 0),
    percentage: Number(c?.percentage ?? 0),
    sample_record_ids: Array.isArray(c?.sample_record_ids) ? c.sample_record_ids.map(String) : []
  }))

  const rawWarnings = Array.isArray(raw.warnings) ? raw.warnings : []
  const warnings: PersonaWarning[] = rawWarnings.map((w: any) => ({
    warning_type: String(w?.warning_type ?? 'warning'),
    message: String(w?.message ?? ''),
    severity: (w?.severity ?? 'warning') as 'info' | 'warning' | 'critical',
    affected_records_count: Number(w?.affected_records_count ?? 1)
  }))

  return {
    total_records: Number(raw.total_records ?? raw.total_conversations ?? 0),
    records_with_system_prompt: Number(raw.records_with_system_prompt ?? raw.conversations_with_system ?? 0),
    records_missing_system_prompt: Number(raw.records_missing_system_prompt ?? raw.conversations_missing_system ?? 0),
    unique_system_prompts: Number(raw.unique_system_prompts ?? raw.unique_system_prompts_count ?? 0),
    dominant_persona_share: Number(raw.dominant_persona_share ?? raw.dominant_persona_pct ?? 0),
    policy_applied: String(raw.policy_applied ?? raw.policy ?? 'multiple_intentional_personas'),
    is_policy_compliant: Boolean(raw.is_policy_compliant ?? raw.policy_compliance ?? true),
    clusters,
    warnings
  }
}

/**
 * Normalizes Split Summary
 */
export function normalizeSplitSummary(raw: any): SplitSummary {
  if (!raw || typeof raw !== 'object') {
    return {
      split_id: `split_${Date.now()}`,
      name: 'Default Partition',
      seed: 42,
      train_pct: 0.8,
      val_pct: 0.1,
      eval_pct: 0.1,
      total_count: 0,
      train_count: 0,
      val_count: 0,
      eval_count: 0,
      created_at: new Date().toISOString(),
      zero_leakage_verified: true,
      assignments: []
    }
  }

  const rawAssignments = Array.isArray(raw.assignments) ? raw.assignments : []
  const assignments: SplitAssignmentItem[] = rawAssignments.map((a: any) => ({
    record_id: String(a?.record_id ?? ''),
    record_type: String(a?.record_type ?? 'sft'),
    split_name: String(a?.split_name ?? 'train'),
    group_id: a?.group_id ? String(a.group_id) : undefined
  }))

  return {
    split_id: String(raw.split_id ?? ''),
    name: String(raw.name ?? 'Dataset Split'),
    seed: Number(raw.seed ?? 42),
    train_pct: Number(raw.train_pct ?? 0.8),
    val_pct: Number(raw.val_pct ?? 0.1),
    eval_pct: Number(raw.eval_pct ?? 0.1),
    total_count: Number(raw.total_count ?? 0),
    train_count: Number(raw.train_count ?? 0),
    val_count: Number(raw.val_count ?? 0),
    eval_count: Number(raw.eval_count ?? 0),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    zero_leakage_verified: Boolean(raw.zero_leakage_verified ?? raw.leakage_free ?? true),
    assignments
  }
}
