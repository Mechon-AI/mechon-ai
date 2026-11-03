export * from './languages'
export * from './engineering'

export interface Project {
  id: string
  name: string
  description?: string
  is_archived: boolean
  created_at: string
  updated_at: string
  settings: Record<string, any>
  sft_record_count: number
  dpo_task_count: number
  active_draft_count: number
}

export interface SFTMessage {
  id: string
  session_id: string
  role: 'system' | 'developer' | 'user' | 'assistant' | 'tool' | string
  content: string
  sequence_order: number
  model?: string
  token_count: number
  translations?: Record<string, string>
  translation_status?: Record<string, 'pending' | 'generated' | 'edited' | 'approved' | 'rejected' | 'needs_review' | 'failed' | string>
  created_at: string
}

export interface SFTSession {
  id: string
  project_id: string
  title: string
  system_prompt: string
  status: 'draft' | 'in_progress' | 'ready_to_commit' | 'committed' | 'archived'
  provider_id?: string
  model?: string
  temperature: number
  top_p: number
  max_tokens: number
  language_mode?: 'monolingual' | 'bilingual' | 'multilingual' | string
  primary_language?: string
  secondary_language?: string
  target_languages?: string[]
  language_metadata?: Record<string, any>
  committed_record_id?: string
  messages: SFTMessage[]
  created_at: string
  updated_at: string
}

export interface SFTCommitInput {
  title_override?: string
  tags?: string[]
  metadata?: Record<string, any>
  language_mode?: string
  primary_language?: string
  secondary_language?: string
  language_metadata?: Record<string, any>
  save_as_new?: boolean
  create_version_snapshot?: boolean
  version_tag?: string
  version_description?: string
}

export interface SFTRecordMessage {
  role: string
  content: string
  translations?: Record<string, string>
  translation_status?: Record<string, string>
}

export interface SFTRecord {
  id: string
  project_id: string
  session_id?: string
  messages: SFTRecordMessage[]
  turn_count: number
  character_count: number
  language_mode?: 'monolingual' | 'bilingual'
  primary_language?: string
  secondary_language?: string
  language_metadata?: Record<string, any>
  metadata: {
    tags?: string[]
    source?: string
    model?: string
    title?: string
    committed_at?: string
    [key: string]: any
  }
  revision: number
  created_at: string
  updated_at: string
}

export interface ExportToFileInput {
  project_id: string
  pipeline: 'sft' | 'dpo'
  format_type: 'jsonl' | 'json' | 'csv' | 'txt'
  include_metadata?: boolean
  only_completed?: boolean
  destination_path?: string
  record_ids?: string[]
  bilingual_mode?: 'canonical_aligned' | 'primary_only' | 'secondary_only'
}

export interface DPOTask {
  id: string
  project_id: string
  prompt: string
  system_prompt?: string
  response_a: string
  response_b: string
  preference?: 'a' | 'b' | 'tie' | 'both_bad' | 'skip' | 'flag' | null
  rationale?: string
  helpfulness_rating?: number
  factuality_rating?: number
  status: 'pending' | 'completed' | 'flagged' | 'skipped'
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ModelCapabilities {
  vision: boolean
  tool_use: boolean
  reasoning: boolean
  streaming: boolean
  structured_output: boolean
  json_mode: boolean
}

export interface ProviderDefinition {
  id: string
  name: string
  provider_type: string
  default_host: string
  default_path: string
  default_model: string
  curated_models: string[]
  capabilities: ModelCapabilities
  supports_model_discovery: boolean
  supports_streaming: boolean
  requires_api_key: boolean
  auth_header_format?: string
  documentation_url?: string
}

export interface CredentialStatus {
  has_api_key: boolean
  credential_status: string
  masked_hint?: string
}

export interface VaultDiagnostics {
  dbus_available: boolean
  dbus_address?: string
  secret_service_available: boolean
  secret_service_unlocked: boolean
  secret_tool_installed: boolean
  active_backend: string
  write_test: string
  read_back_test: string
  delete_test: string
  error_details?: string
  actionable_guidance?: string
}

export interface ConnectionTestResult {
  success: boolean
  code: string
  message: string
  models: string[]
  latency_ms: number
}

export type DiagnosticCheckStatus = 'pass' | 'fail' | 'warning' | 'skipped'

export interface ProviderDiagnosticReport {
  provider_id: string
  provider_type: string
  provider_name: string
  base_url: string
  model_used?: string

  connection_status: DiagnosticCheckStatus
  connection_latency_ms?: number
  connection_http_status?: number
  connection_error?: string

  auth_status: DiagnosticCheckStatus
  auth_details: string

  model_discovery_status: DiagnosticCheckStatus
  models_discovered: string[]
  discovery_latency_ms?: number
  discovery_error?: string

  generation_status: DiagnosticCheckStatus
  generation_latency_ms?: number
  generation_http_status?: number
  generation_sample_output?: string
  generation_error?: string

  streaming_status: DiagnosticCheckStatus
  streaming_latency_ms?: number
  streaming_chunk_count: number
  streaming_sample_output?: string
  streaming_error?: string

  is_operational: boolean
  total_latency_ms: number
  diagnostic_summary: string
}

export interface Provider {
  id: string
  name: string
  provider_type: string
  base_url: string
  has_api_key: boolean
  credential_status: string
  masked_hint?: string
  default_model?: string
  models_cache: string[]
  timeout_seconds: number
  is_active: boolean
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ProviderCreateInput {
  name: string
  provider_type: string
  base_url?: string
  api_key?: string
  default_model?: string
  timeout_seconds?: number
  settings?: Record<string, any>
}

export interface ProviderUpdateInput {
  name?: string
  base_url?: string
  api_key?: string
  clear_api_key?: boolean
  default_model?: string
  timeout_seconds?: number
  is_active?: boolean
  settings?: Record<string, any>
}

export interface DatasetVersion {
  id: string
  project_id: string
  dataset_type: 'sft' | 'dpo' | 'combined'
  version_tag: string
  record_count: number
  checksum_sha256: string
  parent_version_id?: string
  change_summary?: string
  description?: string
  created_at: string
  records?: any[]
}

export interface ValidationIssue {
  record_id: string
  dataset_type: 'sft' | 'dpo'
  severity: 'error' | 'warning' | 'info'
  issue_type: string
  message: string
  suggested_fix?: string
}

export interface ValidationReport {
  dataset_type: 'sft' | 'dpo'
  total_records: number
  passed_records: number
  failed_records: number
  error_count: number
  warning_count: number
  issues: ValidationIssue[]
  generated_at: string
}
