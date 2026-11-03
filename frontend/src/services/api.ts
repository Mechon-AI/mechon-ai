import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  Project,
  SFTSession,
  SFTMessage,
  SFTRecord,
  DPOTask,
  Provider,
  ProviderDefinition,
  ProviderCreateInput,
  ProviderUpdateInput,
  CredentialStatus,
  VaultDiagnostics,
  ConnectionTestResult,
  ProviderDiagnosticReport,
  DatasetVersion,
  ValidationReport,
  ModelTemplateDef,
  TemplateCompatibilitySummary,
  SequenceAnalyticsReport,
  DeduplicationReport,
  PersonaAuditReport,
  SplitSummary,
  TrainingReadinessReport
} from '../types'

import type {
  StorySession,
  PlanningSpecification,
  PlanningMilestone,
  StoryMessage,
  PlanningPromptHistory,
  NarrativeState,
  AgentEvaluation,
  CreateStorySessionInput,
  UpdateStorySessionInput,
  SavePlanningSpecInput,
  SaveMilestoneInput,
  CommitToSFTInput,
  CommitToSFTResult,
  AutoStepResult,
  StoryMessageRevision,
  EditStoryMessageInput,
  RegenerateAssistantTurnInput,
  RestoreRevisionInput,
  ExecutionTurnResult
} from '../types/story_architect'

import {
  normalizeReadinessReport,
  normalizeTemplateSummary,
  normalizeModelTemplate,
  normalizeSequenceReport,
  normalizeDedupReport,
  normalizePersonaReport,
  normalizeSplitSummary
} from '../utils/engineeringNormalizers'

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__)
}

/** Configures backend connection. In Tauri native mode, verifies core engine readiness. */
export async function configureBackendApi(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const status = await invoke<{ healthy: boolean; is_embedded_rust?: boolean }>('get_backend_status')
      if (!status.healthy) {
        throw new Error('Mechon AI native Rust core status reported unhealthy.')
      }
    } catch (e: any) {
      console.warn('Native status check error:', e)
    }
  }
}

// -------------------------------------------------------------
// Projects API
// -------------------------------------------------------------
export const getProjects = async (includeArchived = false): Promise<Project[]> => {
  if (isTauriEnvironment()) {
    return invoke<Project[]>('get_projects', { includeArchived })
  }
  return [
    {
      id: 'default-project-mechon-001',
      name: 'General AI Alignment Lab',
      description: 'Primary workstation project for SFT multi-turn dialogues and DPO pairwise curation.',
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      settings: {},
      sft_record_count: 0,
      dpo_task_count: 0,
      active_draft_count: 0
    }
  ]
}

export const getProject = (id: string): Promise<Project> =>
  invoke<Project>('get_project', { id })

export const createProject = (data: { name: string; description?: string; settings?: any }): Promise<Project> =>
  invoke<Project>('create_project', { data })

export const updateProject = (id: string, data: Partial<Project>): Promise<Project> =>
  invoke<Project>('update_project', { id, data })

export const deleteProject = (id: string): Promise<void> =>
  invoke<void>('delete_project', { id })

export const duplicateProject = (id: string, name?: string): Promise<Project> =>
  invoke<Project>('duplicate_project', { id, name })

// -------------------------------------------------------------
// SFT Studio API
// -------------------------------------------------------------
export const getSFTSessions = (projectId: string, status?: string): Promise<SFTSession[]> =>
  invoke<SFTSession[]>('get_sft_sessions', { projectId, status })

export const getSFTSession = (sessionId: string): Promise<SFTSession> =>
  invoke<SFTSession>('get_sft_session', { sessionId })

export const createSFTSession = (data: Partial<SFTSession>): Promise<SFTSession> =>
  invoke<SFTSession>('create_sft_session', { data })

export const updateSFTSession = (sessionId: string, data: Partial<SFTSession>): Promise<SFTSession> =>
  invoke<SFTSession>('update_sft_session', { sessionId, data })

export const deleteSFTSession = (sessionId: string): Promise<void> =>
  invoke<void>('delete_sft_session', { sessionId })

export const duplicateSFTSession = (sessionId: string): Promise<SFTSession> =>
  invoke<SFTSession>('duplicate_sft_session', { sessionId })

export const addSFTMessage = (
  sessionId: string,
  data: { role: string; content: string; model?: string }
): Promise<any> =>
  invoke('add_sft_message', { sessionId, data })

export const updateSFTMessage = (messageId: string, content: string): Promise<void> =>
  invoke('update_sft_message', { messageId, content })

export const deleteSFTMessage = (messageId: string): Promise<void> =>
  invoke('delete_sft_message', { messageId })

export const truncateSFTDownstream = (sessionId: string, fromSequence: number): Promise<void> =>
  invoke('truncate_sft_downstream', { sessionId, fromSequence })

// SFT Commit: CRITICAL 1 conversation -> exactly 1 SFT Record
export const commitSFTSession = (
  sessionId: string,
  data: { title_override?: string; tags?: string[]; metadata?: any }
): Promise<SFTRecord> =>
  invoke<SFTRecord>('commit_sft_session', { sessionId, data })

// SFT Records
export const getSFTRecords = (
  projectId: string,
  search?: string,
  tag?: string,
  languageMode?: string,
  limit = 50,
  offset = 0
): Promise<{ records: SFTRecord[]; total: number }> =>
  invoke<{ records: SFTRecord[]; total: number }>('get_sft_records', {
    projectId,
    search,
    tag,
    languageMode,
    limit,
    offset
  })

export const getSFTRecord = (recordId: string): Promise<SFTRecord> =>
  invoke<SFTRecord>('get_sft_record', { recordId })

export const updateSFTRecord = (recordId: string, data: any): Promise<SFTRecord> =>
  invoke<SFTRecord>('update_sft_record', { recordId, data })

export const deleteSFTRecord = (recordId: string): Promise<void> =>
  invoke('delete_sft_record', { recordId })

export const duplicateSFTRecord = (recordId: string): Promise<SFTRecord> =>
  invoke<SFTRecord>('duplicate_sft_record', { recordId })

// -------------------------------------------------------------
// DPO Studio API
// -------------------------------------------------------------
export const getDPOTasks = (
  projectId: string,
  status?: string,
  search?: string,
  limit = 50,
  offset = 0
): Promise<{ tasks: DPOTask[]; total: number }> =>
  invoke<{ tasks: DPOTask[]; total: number }>('get_dpo_tasks', {
    projectId,
    status,
    search,
    limit,
    offset
  })

export const createDPOTask = (data: Partial<DPOTask>): Promise<DPOTask> =>
  invoke<DPOTask>('create_dpo_task', { data })

export const getDPOTask = (taskId: string): Promise<DPOTask> =>
  invoke<DPOTask>('get_dpo_task', { taskId })

export const annotateDPOTask = (
  taskId: string,
  data: {
    preference: string
    rationale?: string
    helpfulness_rating?: number
    factuality_rating?: number
    metadata?: any
  }
): Promise<DPOTask> =>
  invoke<DPOTask>('annotate_dpo_task', { taskId, data })

export const undoLastDPOAnnotation = (projectId: string): Promise<DPOTask | null> =>
  invoke<DPOTask | null>('undo_last_dpo_annotation', { projectId })

export const deleteDPOTask = (taskId: string): Promise<void> =>
  invoke('delete_dpo_task', { taskId })

export const duplicateDPOTask = (taskId: string): Promise<DPOTask> =>
  invoke<DPOTask>('duplicate_dpo_task', { taskId })

export const updateDPOTask = (taskId: string, data: Partial<DPOTask>): Promise<DPOTask> =>
  invoke<DPOTask>('update_dpo_task', { taskId, data })

// -------------------------------------------------------------
// Providers & Inference API
// -------------------------------------------------------------
export const getProviderDefinitions = async (): Promise<ProviderDefinition[]> => {
  if (isTauriEnvironment()) {
    return invoke<ProviderDefinition[]>('get_provider_definitions')
  }
  return []
}

export const getProviders = async (): Promise<Provider[]> => {
  if (isTauriEnvironment()) {
    return invoke<Provider[]>('get_providers')
  }
  return [
    {
      id: 'mock',
      name: 'Mechon Offline Mock Provider',
      provider_type: 'mock',
      base_url: 'http://127.0.0.1:0',
      has_api_key: false,
      credential_status: 'empty',
      default_model: 'mock-llama-3-8b',
      models_cache: ['mock-llama-3-8b', 'mock-mistral-7b', 'mock-qwen-2.5-7b'],
      timeout_seconds: 30,
      is_active: true,
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]
}

export const createProvider = (data: ProviderCreateInput): Promise<Provider> =>
  invoke<Provider>('create_provider_cmd', { data })

export const updateProvider = (id: string, data: ProviderUpdateInput): Promise<Provider> =>
  invoke<Provider>('update_provider_cmd', { id, data })

export const deleteProvider = (id: string): Promise<void> =>
  invoke('delete_provider_cmd', { id })

export const testProvider = (id: string): Promise<ConnectionTestResult> =>
  invoke<ConnectionTestResult>('test_provider', { id })

export const diagnoseProvider = (id: string): Promise<ProviderDiagnosticReport> =>
  invoke<ProviderDiagnosticReport>('diagnose_provider', { id })

export const saveProviderCredentials = (providerId: string, apiKey: string): Promise<CredentialStatus> =>
  invoke<CredentialStatus>('save_provider_credentials', { providerId, apiKey })

export const getProviderCredentialStatus = (providerId: string): Promise<CredentialStatus> =>
  invoke<CredentialStatus>('get_provider_credential_status', { providerId })

export const replaceProviderCredentials = (providerId: string, apiKey: string): Promise<CredentialStatus> =>
  invoke<CredentialStatus>('replace_provider_credentials', { providerId, apiKey })

export const deleteProviderCredentials = (providerId: string): Promise<CredentialStatus> =>
  invoke<CredentialStatus>('delete_provider_credentials', { providerId })

export const getVaultDiagnostics = (): Promise<VaultDiagnostics> =>
  invoke<VaultDiagnostics>('get_vault_diagnostics')

export const generateCompletion = (data: {
  provider_id: string
  model?: string
  prompt?: string
  messages?: Array<{ role: string; content: string }>
  system_prompt?: string
  temperature?: number
  top_p?: number
  max_tokens?: number
}): Promise<{ role: string; content: string; model: string; finish_reason?: string }> =>
  invoke('generate_completion', { data })

export interface GenerateDPOPairParams {
  provider_id?: string
  provider_id_a?: string
  provider_id_b?: string
  prompt: string
  system_prompt?: string
  model_a?: string
  model_b?: string
  temp_a?: number
  temp_b?: number
}

export interface GenerateDPOPairResult {
  success_a: boolean
  success_b: boolean
  response_a: string
  response_b: string
  model_a: string
  model_b: string
  provider_id_a?: string
  provider_id_b?: string
  latency_a_ms?: number
  latency_b_ms?: number
  error_a?: string | null
  error_b?: string | null
}

export const generateDPOPair = (params: GenerateDPOPairParams): Promise<GenerateDPOPairResult> =>
  invoke('generate_dpo_pair', { params })

/** Real-time token streaming for multi-turn SFT generation. */
export async function streamCompletion(
  data: {
    session_id: string
    provider_id: string
    model?: string
    messages: Array<{ role: string; content: string }>
    system_prompt?: string
    temperature?: number
    top_p?: number
    max_tokens?: number
  },
  onToken: (token: string, accumulated: string) => void,
  onDone?: (fullContent: string) => void,
  onError?: (err: string) => void
): Promise<() => void> {
  const tokenEvent = `sft-stream-token-${data.session_id}`
  const doneEvent = `sft-stream-done-${data.session_id}`
  const errorEvent = `sft-stream-error-${data.session_id}`

  const unlistenToken = await listen<{ token: string; accumulated: string }>(tokenEvent, (event) => {
    onToken(event.payload.token, event.payload.accumulated)
  })

  const unlistenDone = await listen<{ content: string }>(doneEvent, (event) => {
    if (onDone) onDone(event.payload.content)
  })

  const unlistenError = await listen<{ error: string }>(errorEvent, (event) => {
    if (onError) onError(event.payload.error)
  })

  // Start native streaming invoke in background
  invoke('stream_completion', { data }).catch((err: any) => {
    if (onError) onError(String(err))
  })

  return () => {
    unlistenToken()
    unlistenDone()
    unlistenError()
  }
}

// -------------------------------------------------------------
// Quality Control / Validation
// -------------------------------------------------------------
export const validateDataset = (
  projectId: string,
  datasetType: 'sft' | 'dpo'
): Promise<ValidationReport> =>
  invoke<ValidationReport>('validate_dataset', { projectId, datasetType })

// -------------------------------------------------------------
// Versioning API
// -------------------------------------------------------------
export const getVersions = (projectId: string, datasetType?: string): Promise<DatasetVersion[]> =>
  invoke<DatasetVersion[]>('get_versions', { projectId, datasetType })

export const createSnapshot = (data: {
  project_id: string
  dataset_type: string
  version_tag: string
  description?: string
}): Promise<DatasetVersion> =>
  invoke<DatasetVersion>('create_snapshot', { data })

export const restoreSnapshot = (versionId: string): Promise<void> =>
  invoke('restore_snapshot', { versionId })

export const compareSnapshots = (versionA: string, versionB: string): Promise<any> =>
  invoke('compare_snapshots', { versionA, versionB })

// -------------------------------------------------------------
// Analytics API
// -------------------------------------------------------------
export const getDashboardAnalytics = (projectId?: string): Promise<any> =>
  invoke('get_dashboard_analytics', { projectId })

// -------------------------------------------------------------
// Translation & Bilingual API
// -------------------------------------------------------------
export const getSupportedLanguages = (): Promise<import('../types').LanguageInfo[]> =>
  invoke<import('../types').LanguageInfo[]>('get_supported_languages')

export const lookupLanguageInfo = (code: string): Promise<import('../types').LanguageInfo> =>
  invoke<import('../types').LanguageInfo>('lookup_language_info', { code })

export const getCorpusLanguages = (projectId: string): Promise<import('../types').CorpusLanguageStats> =>
  invoke<import('../types').CorpusLanguageStats>('get_corpus_languages', { projectId })

export const translateSFTSession = (data: {
  session_id: string
  target_language: string
  provider_id?: string
  model?: string
}): Promise<SFTSession> =>
  invoke<SFTSession>('translate_sft_session', { data })

export const translateSFTMessage = (data: {
  session_id: string
  message_id: string
  target_language: string
  provider_id?: string
  model?: string
}): Promise<SFTMessage> =>
  invoke<SFTMessage>('translate_sft_message', { data })

export const updateSFTMessageTranslation = (data: {
  message_id: string
  target_language: string
  content: string
  status: string
}): Promise<void> =>
  invoke('update_sft_message_translation', { data })

export const batchUpdateTranslationStatus = (data: {
  session_id: string
  target_language: string
  status: string
}): Promise<SFTSession> =>
  invoke<SFTSession>('batch_update_translation_status', { data })

// -------------------------------------------------------------
// Import & Export API
// -------------------------------------------------------------
export const exportSFTDataset = (
  projectId: string,
  format = 'jsonl',
  includeMetadata = true,
  recordIds?: string[],
  bilingualMode?: string
): Promise<string> =>
  invoke<string>('export_sft_dataset', {
    projectId,
    formatType: format,
    includeMetadata,
    recordIds,
    bilingualMode
  })

export const exportDPODataset = (
  projectId: string,
  format = 'jsonl',
  includeMetadata = true,
  onlyCompleted = true,
  recordIds?: string[]
): Promise<string> =>
  invoke<string>('export_dpo_dataset', {
    projectId,
    formatType: format,
    includeMetadata,
    onlyCompleted,
    recordIds
  })

export interface ExportToFileParams {
  project_id: string
  pipeline: 'sft' | 'dpo'
  format_type: string
  include_metadata?: boolean
  only_completed?: boolean
  destination_path?: string
  record_ids?: string[]
  bilingual_mode?: 'canonical_aligned' | 'primary_only' | 'secondary_only'
}

export interface ExportToFileResult {
  success: boolean
  cancelled: boolean
  file_path?: string
  record_count: number
  file_size_bytes: number
  format: string
  error?: string
}

export const exportDatasetToFile = (params: ExportToFileParams): Promise<ExportToFileResult> =>
  invoke<ExportToFileResult>('export_dataset_to_file', { params })

export const importDatasetFile = async (projectId: string, file: File): Promise<any> => {
  const content = await file.text()
  return invoke('import_dataset_file', { projectId, content })
}

// -------------------------------------------------------------
// Settings & Maintenance API
// -------------------------------------------------------------
export const getSettings = (): Promise<Record<string, string>> =>
  invoke<Record<string, string>>('get_settings')

export const updateSettings = (data: Record<string, string>): Promise<void> =>
  invoke('update_settings', { data })

export const checkDatabaseIntegrity = (): Promise<{ status: string; is_ok: boolean; db_path: string }> =>
  invoke('check_database_integrity')

export const createDatabaseBackup = (): Promise<{ message: string; backup_path: string }> =>
  invoke('create_database_backup')

export const restoreDatabaseBackup = (): Promise<{ message: string }> =>
  invoke('restore_database_backup')

export const openDataFolder = (): Promise<void> =>
  invoke('open_data_folder')

// -------------------------------------------------------------
// Fine-Tuning Engineering Expansion API
// -------------------------------------------------------------

export const getSupportedTemplateModels = async (): Promise<ModelTemplateDef[]> => {
  const res = await invoke<any[]>('get_supported_template_models')
  return (Array.isArray(res) ? res : []).map(normalizeModelTemplate)
}

export const validateChatTemplates = async (
  projectId: string,
  modelId: string,
  addGenerationPrompt = false
): Promise<TemplateCompatibilitySummary> => {
  const res = await invoke<any>('validate_chat_templates', {
    projectId,
    modelId,
    addGenerationPrompt
  })
  return normalizeTemplateSummary(res)
}

export const runSequenceAnalytics = async (
  projectId: string,
  modelFamily: string,
  maxSeqLen = 4096,
  truncationStrategy = 'tail',
  includeSpecialTokens = true
): Promise<SequenceAnalyticsReport> => {
  const res = await invoke<any>('run_sequence_analytics', {
    projectId,
    modelFamily,
    maxSeqLen,
    truncationStrategy,
    includeSpecialTokens
  })
  return normalizeSequenceReport(res)
}

export const runDeduplication = async (
  projectId: string,
  nearThreshold = 0.85
): Promise<DeduplicationReport> => {
  const res = await invoke<any>('run_deduplication', {
    projectId,
    nearThreshold
  })
  return normalizeDedupReport(res)
}

export const saveDuplicateDecision = (
  projectId: string,
  groupId: string,
  recordId: string,
  decision: 'retain' | 'exclude' | 'acceptable',
  note?: string
): Promise<void> =>
  invoke('save_duplicate_decision', {
    projectId,
    groupId,
    recordId,
    decision,
    note
  })

export const runPersonaAudit = async (
  projectId: string,
  policy = 'multiple_intentional_personas'
): Promise<PersonaAuditReport> => {
  const res = await invoke<any>('run_persona_audit', {
    projectId,
    policy
  })
  return normalizePersonaReport(res)
}

export const createDatasetSplit = async (
  projectId: string,
  name: string,
  seed = 42,
  trainPct = 0.80,
  valPct = 0.10,
  evalPct = 0.10
): Promise<SplitSummary> => {
  const res = await invoke<any>('create_dataset_split', {
    projectId,
    name,
    seed,
    trainPct,
    valPct,
    evalPct
  })
  return normalizeSplitSummary(res)
}

export const listDatasetSplits = async (projectId: string): Promise<SplitSummary[]> => {
  const res = await invoke<any[]>('list_dataset_splits', { projectId })
  return (Array.isArray(res) ? res : []).map(normalizeSplitSummary)
}

export const generateTrainingReadinessReport = async (
  projectId: string,
  title: string,
  modelFamily = 'llama',
  maxSeqLen = 4096
): Promise<TrainingReadinessReport> => {
  const res = await invoke<any>('generate_training_readiness_report', {
    projectId,
    title,
    modelFamily,
    maxSeqLen
  })
  return normalizeReadinessReport(res)
}

export const listReadinessReports = async (projectId: string): Promise<TrainingReadinessReport[]> => {
  const res = await invoke<any[]>('list_readiness_reports', { projectId })
  return (Array.isArray(res) ? res : []).map(normalizeReadinessReport)
}

export const exportConversationalDPO = (
  projectId: string,
  formatType = 'jsonl',
  onlyCompleted = true
): Promise<string> =>
  invoke<string>('export_conversational_dpo', {
    projectId,
    formatType,
    onlyCompleted
  })

// -------------------------------------------------------------
// Story Architect API
// -------------------------------------------------------------
export const listStorySessions = (projectId: string): Promise<StorySession[]> =>
  invoke<StorySession[]>('list_story_sessions', { projectId })

export const getStorySession = (sessionId: string): Promise<StorySession> =>
  invoke<StorySession>('get_story_session', { sessionId })

export const createStorySession = (data: CreateStorySessionInput): Promise<StorySession> =>
  invoke<StorySession>('create_story_session', { data })

export const updateStorySession = (data: UpdateStorySessionInput): Promise<StorySession> =>
  invoke<StorySession>('update_story_session', { data })

export const deleteStorySession = (sessionId: string): Promise<void> =>
  invoke<void>('delete_story_session', { sessionId })

export const getPlanningSpec = (sessionId: string): Promise<PlanningSpecification> =>
  invoke<PlanningSpecification>('get_planning_spec', { sessionId })

export const savePlanningSpec = (data: SavePlanningSpecInput): Promise<PlanningSpecification> =>
  invoke<PlanningSpecification>('save_planning_spec', { data })

export const listMilestones = (sessionId: string): Promise<PlanningMilestone[]> =>
  invoke<PlanningMilestone[]>('list_milestones', { sessionId })

export const saveMilestones = (sessionId: string, milestones: SaveMilestoneInput[]): Promise<PlanningMilestone[]> =>
  invoke<PlanningMilestone[]>('save_milestones', { sessionId, milestones })

export const listStoryMessages = (sessionId: string): Promise<StoryMessage[]> =>
  invoke<StoryMessage[]>('list_story_messages', { sessionId })

export const generateNextPrompt = (
  sessionId: string,
  feedback?: string,
  providerId?: string,
  model?: string
): Promise<PlanningPromptHistory> =>
  invoke<PlanningPromptHistory>('generate_next_prompt', { sessionId, feedback, providerId, model })

export const approveAndExecuteTurn = (
  sessionId: string,
  promptContent: string,
  promptHistoryId?: string,
  engineerEdited?: boolean,
  providerId?: string,
  model?: string
): Promise<AutoStepResult> =>
  invoke<AutoStepResult>('approve_and_execute_turn', {
    sessionId,
    promptContent,
    promptHistoryId,
    engineerEdited,
    providerId,
    model
  })

export const executeAutonomousStep = (
  sessionId: string,
  providerId?: string,
  model?: string
): Promise<AutoStepResult> =>
  invoke<AutoStepResult>('execute_autonomous_step', { sessionId, providerId, model })

export const pauseStorySession = (sessionId: string, reason?: string): Promise<void> =>
  invoke<void>('pause_story_session', { sessionId, reason })

export const resumeStorySession = (sessionId: string): Promise<void> =>
  invoke<void>('resume_story_session', { sessionId })

export const listPromptHistory = (sessionId: string): Promise<PlanningPromptHistory[]> =>
  invoke<PlanningPromptHistory[]>('list_prompt_history', { sessionId })

export const getLatestNarrativeState = (sessionId: string): Promise<NarrativeState | null> =>
  invoke<NarrativeState | null>('get_narrative_state', { sessionId })

export const commitStoryToSFT = (data: CommitToSFTInput): Promise<CommitToSFTResult> =>
  invoke<CommitToSFTResult>('commit_story_to_sft', { data })

export const editStoryMessage = (data: EditStoryMessageInput): Promise<StoryMessage> =>
  invoke<StoryMessage>('edit_story_message', { data })

export const listMessageRevisions = (messageId: string): Promise<StoryMessageRevision[]> =>
  invoke<StoryMessageRevision[]>('list_message_revisions', { messageId })

export const restoreMessageRevision = (data: RestoreRevisionInput): Promise<StoryMessage> =>
  invoke<StoryMessage>('restore_message_revision', { data })

export const regenerateStoryTurn = (data: RegenerateAssistantTurnInput): Promise<ExecutionTurnResult> =>
  invoke<ExecutionTurnResult>('regenerate_story_turn', { data })


