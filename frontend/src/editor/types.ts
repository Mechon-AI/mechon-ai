export type EditorTabType =
  | 'dashboard'
  | 'projects'
  | 'story-architect'
  | 'sft'
  | 'dpo'
  | 'datasets'
  | 'forge'
  | 'playground'
  | 'quality'
  | 'analytics'
  | 'versions'
  | 'export'
  | 'providers'
  | 'settings'
  | 'engineering/templates'
  | 'engineering/sequence'
  | 'engineering/dedup'
  | 'engineering/persona'
  | 'engineering/splits'
  | 'readiness'
  | 'record-editor'

export interface EditorTab {
  id: string
  type: EditorTabType
  title: string
  icon?: string
  dirty?: boolean
  closable?: boolean
  params?: Record<string, any>
}

export type BottomPanelTab =
  | 'console'
  | 'agent-logs'
  | 'diagnostics'
  | 'task-manager'
  | 'dataset-preview'
  | 'validation'
  | 'inference-logs'

export type WorkspacePreset =
  | 'dataset-engineering'
  | 'agent-engineering'
  | 'sft-engineering'
  | 'dpo-evaluation'
  | 'quality-assurance'
  | 'provider-engineering'
  | 'custom'

export interface LayoutDimensions {
  leftPanelVisible: boolean
  leftPanelWidth: number
  rightPanelVisible: boolean
  rightPanelWidth: number
  bottomPanelVisible: boolean
  bottomPanelHeight: number
  bottomActiveTab: BottomPanelTab
  currentPreset: WorkspacePreset
}

export interface CustomPreset {
  name: string
  layout: LayoutDimensions
  activeTabs: { type: EditorTabType; title: string; params?: any }[]
  activeTabType?: EditorTabType
}
