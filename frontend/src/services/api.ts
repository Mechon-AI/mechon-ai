import axios from 'axios'
import type {
  Project,
  SFTSession,
  SFTRecord,
  DPOTask,
  Provider,
  DatasetVersion,
  ValidationReport
} from '../types'

// Automatically detect backend port or use default 18420
const API_BASE = (window as any).__STUDIO_BACKEND_URL__ || 'http://127.0.0.1:18420/api/v1'

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Projects
export const getProjects = (includeArchived = false) =>
  api.get<Project[]>('/projects', { params: { include_archived: includeArchived } }).then(r => r.data)

export const getProject = (id: string) =>
  api.get<Project>(`/projects/${id}`).then(r => r.data)

export const createProject = (data: { name: string; description?: string; settings?: any }) =>
  api.post<Project>('/projects', data).then(r => r.data)

export const updateProject = (id: string, data: Partial<Project>) =>
  api.put<Project>(`/projects/${id}`, data).then(r => r.data)

export const deleteProject = (id: string) =>
  api.delete(`/projects/${id}`).then(r => r.data)

export const duplicateProject = (id: string, name?: string) =>
  api.post<Project>(`/projects/${id}/duplicate`, null, { params: { name } }).then(r => r.data)

// SFT Studio
export const getSFTSessions = (projectId: string, status?: string) =>
  api.get<SFTSession[]>('/sft/sessions', { params: { project_id: projectId, status } }).then(r => r.data)

export const getSFTSession = (sessionId: string) =>
  api.get<SFTSession>(`/sft/sessions/${sessionId}`).then(r => r.data)

export const createSFTSession = (data: Partial<SFTSession>) =>
  api.post<SFTSession>('/sft/sessions', data).then(r => r.data)

export const updateSFTSession = (sessionId: string, data: Partial<SFTSession>) =>
  api.put<SFTSession>(`/sft/sessions/${sessionId}`, data).then(r => r.data)

export const deleteSFTSession = (sessionId: string) =>
  api.delete(`/sft/sessions/${sessionId}`).then(r => r.data)

export const duplicateSFTSession = (sessionId: string) =>
  api.post<SFTSession>(`/sft/sessions/${sessionId}/duplicate`).then(r => r.data)

export const addSFTMessage = (sessionId: string, data: { role: string; content: string; model?: string }) =>
  api.post(`/sft/sessions/${sessionId}/messages`, data).then(r => r.data)

export const updateSFTMessage = (messageId: string, content: string) =>
  api.put(`/sft/messages/${messageId}`, { content }).then(r => r.data)

export const deleteSFTMessage = (messageId: string) =>
  api.delete(`/sft/messages/${messageId}`).then(r => r.data)

export const truncateSFTDownstream = (sessionId: string, fromSequence: number) =>
  api.post(`/sft/sessions/${sessionId}/truncate`, null, { params: { from_sequence: fromSequence } }).then(r => r.data)

// SFT Commit
export const commitSFTSession = (
  sessionId: string,
  data: { title_override?: string; tags?: string[]; metadata?: any }
) => api.post<SFTRecord>(`/sft/sessions/${sessionId}/commit`, data).then(r => r.data)

// SFT Records
export const getSFTRecords = (projectId: string, search?: string, tag?: string, limit = 50, offset = 0) =>
  api.get<{ records: SFTRecord[]; total: number }>('/sft/records', {
    params: { project_id: projectId, search, tag, limit, offset }
  }).then(r => r.data)

export const getSFTRecord = (recordId: string) =>
  api.get<SFTRecord>(`/sft/records/${recordId}`).then(r => r.data)

export const updateSFTRecord = (recordId: string, data: any) =>
  api.put<SFTRecord>(`/sft/records/${recordId}`, data).then(r => r.data)

export const deleteSFTRecord = (recordId: string) =>
  api.delete(`/sft/records/${recordId}`).then(r => r.data)

export const duplicateSFTRecord = (recordId: string) =>
  api.post<SFTRecord>(`/sft/records/${recordId}/duplicate`).then(r => r.data)

// DPO Studio
export const getDPOTasks = (projectId: string, status?: string, search?: string, limit = 50, offset = 0) =>
  api.get<{ tasks: DPOTask[]; total: number }>('/dpo/tasks', {
    params: { project_id: projectId, status, search, limit, offset }
  }).then(r => r.data)

export const createDPOTask = (data: Partial<DPOTask>) =>
  api.post<DPOTask>('/dpo/tasks', data).then(r => r.data)

export const getDPOTask = (taskId: string) =>
  api.get<DPOTask>(`/dpo/tasks/${taskId}`).then(r => r.data)

export const annotateDPOTask = (
  taskId: string,
  data: {
    preference: string
    rationale?: string
    helpfulness_rating?: number
    factuality_rating?: number
    metadata?: any
  }
) => api.put<DPOTask>(`/dpo/tasks/${taskId}/annotate`, data).then(r => r.data)

export const undoLastDPOAnnotation = (projectId: string) =>
  api.post<DPOTask>('/dpo/undo', null, { params: { project_id: projectId } }).then(r => r.data)

export const deleteDPOTask = (taskId: string) =>
  api.delete(`/dpo/tasks/${taskId}`).then(r => r.data)

export const duplicateDPOTask = (taskId: string) =>
  api.post<DPOTask>(`/dpo/tasks/${taskId}/duplicate`).then(r => r.data)

export const updateDPOTask = (taskId: string, data: Partial<DPOTask>) =>
  api.put<DPOTask>(`/dpo/tasks/${taskId}`, data).then(r => r.data)

// Providers & Inference
export const getProviders = () =>
  api.get<Provider[]>('/providers').then(r => r.data)

export const createProvider = (data: any) =>
  api.post<Provider>('/providers', data).then(r => r.data)

export const updateProvider = (id: string, data: any) =>
  api.put<Provider>(`/providers/${id}`, data).then(r => r.data)

export const deleteProvider = (id: string) =>
  api.delete(`/providers/${id}`).then(r => r.data)

export const testProvider = (id: string) =>
  api.post<{ healthy: boolean; models: string[] }>(`/providers/${id}/test`).then(r => r.data)

export const generateCompletion = (data: {
  provider_id: string
  model?: string
  prompt?: string
  messages?: Array<{ role: string; content: string }>
  system_prompt?: string
  temperature?: number
  top_p?: number
  max_tokens?: number
}) => api.post('/inference/generate', data).then(r => r.data)

export const generateDPOPair = (params: {
  provider_id: string
  prompt: string
  system_prompt?: string
  model_a?: string
  model_b?: string
  temp_a?: number
  temp_b?: number
}) => api.post('/inference/dpo-pair', null, { params }).then(r => r.data)

// Quality Control
export const validateDataset = (projectId: string, datasetType: 'sft' | 'dpo') =>
  api.get<ValidationReport>('/quality/validate', {
    params: { project_id: projectId, dataset_type: datasetType }
  }).then(r => r.data)

// Versioning
export const getVersions = (projectId: string, datasetType?: string) =>
  api.get<DatasetVersion[]>('/versions', {
    params: { project_id: projectId, dataset_type: datasetType }
  }).then(r => r.data)

export const createSnapshot = (data: {
  project_id: string
  dataset_type: string
  version_tag: string
  description?: string
}) => api.post<DatasetVersion>('/versions/snapshot', data).then(r => r.data)

export const restoreSnapshot = (versionId: string) =>
  api.post(`/versions/${versionId}/restore`).then(r => r.data)

export const compareSnapshots = (versionA: string, versionB: string) =>
  api.get('/versions/compare', { params: { version_a: versionA, version_b: versionB } }).then(r => r.data)

// Analytics
export const getDashboardAnalytics = (projectId?: string) =>
  api.get('/analytics/dashboard', { params: { project_id: projectId } }).then(r => r.data)

// Export & Import
export const exportSFTDataset = (projectId: string, format = 'jsonl', includeMetadata = true) =>
  api.get('/export/sft', {
    params: { project_id: projectId, format_type: format, include_metadata: includeMetadata },
    responseType: 'text'
  }).then(r => r.data)

export const exportDPODataset = (projectId: string, format = 'jsonl', includeMetadata = true, onlyCompleted = true) =>
  api.get('/export/dpo', {
    params: { project_id: projectId, format_type: format, include_metadata: includeMetadata, only_completed: onlyCompleted },
    responseType: 'text'
  }).then(r => r.data)

export const importDatasetFile = (projectId: string, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/import', form, {
    params: { project_id: projectId },
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

// Settings & Maintenance
export const getSettings = () =>
  api.get('/settings').then(r => r.data)

export const updateSettings = (data: Record<string, string>) =>
  api.put('/settings', data).then(r => r.data)

export const checkDatabaseIntegrity = () =>
  api.get<{ status: string; is_ok: boolean; db_path: string }>('/settings/integrity').then(r => r.data)

export const createDatabaseBackup = () =>
  api.post<{ message: string; backup_path: string }>('/settings/backup').then(r => r.data)

export const restoreDatabaseBackup = () =>
  api.post<{ message: string }>('/settings/restore').then(r => r.data)
