import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  Project,
  SFTSession,
  SFTRecord,
  DPOTask,
  Provider,
  DatasetVersion,
  ValidationReport
} from '../types'

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
  limit = 50,
  offset = 0
): Promise<{ records: SFTRecord[]; total: number }> =>
  invoke<{ records: SFTRecord[]; total: number }>('get_sft_records', {
    projectId,
    search,
    tag,
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

export const createProvider = (data: any): Promise<Provider> =>
  invoke<Provider>('create_provider_cmd', { data })

export const updateProvider = (id: string, data: any): Promise<Provider> =>
  invoke<Provider>('update_provider_cmd', { id, data })

export const deleteProvider = (id: string): Promise<void> =>
  invoke('delete_provider_cmd', { id })

export const testProvider = (id: string): Promise<{ healthy: boolean; models: string[] }> =>
  invoke<{ healthy: boolean; models: string[] }>('test_provider', { id })

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

export const generateDPOPair = (params: {
  provider_id: string
  prompt: string
  system_prompt?: string
  model_a?: string
  model_b?: string
  temp_a?: number
  temp_b?: number
}): Promise<{
  response_a: string
  response_b: string
  model_a: string
  model_b: string
  latency_a_ms?: number
  latency_b_ms?: number
}> =>
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
// Import & Export API
// -------------------------------------------------------------
export const exportSFTDataset = (
  projectId: string,
  format = 'jsonl',
  includeMetadata = true
): Promise<string> =>
  invoke<string>('export_sft_dataset', {
    projectId,
    formatType: format,
    includeMetadata
  })

export const exportDPODataset = (
  projectId: string,
  format = 'jsonl',
  includeMetadata = true,
  onlyCompleted = true
): Promise<string> =>
  invoke<string>('export_dpo_dataset', {
    projectId,
    formatType: format,
    includeMetadata,
    onlyCompleted
  })

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
