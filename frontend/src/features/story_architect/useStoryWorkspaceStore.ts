import { create } from 'zustand'

export type StoryWorkspacePreset =
  | 'conversation-focus'
  | 'story-planning'
  | 'agent-supervision'
  | 'narrative-design'
  | 'dataset-prep'
  | 'custom'

export type StoryLeftTab = 'scenarios' | 'hierarchy' | 'characters' | 'phases' | 'objectives'
export type StoryRightTab = 'workbench' | 'spec' | 'narrative' | 'agent' | 'ground_truths' | 'generation'
export type StoryBottomTab = 'logs' | 'diagnostics' | 'sft_preview'

export interface StoryWorkspaceLayout {
  currentPreset: StoryWorkspacePreset
  leftDockVisible: boolean
  leftDockWidth: number
  leftActiveTab: StoryLeftTab
  rightDockVisible: boolean
  rightDockWidth: number
  rightActiveTab: StoryRightTab
  bottomDockVisible: boolean
  bottomDockHeight: number
  bottomActiveTab: StoryBottomTab
  customPresets: Record<string, Partial<StoryWorkspaceLayout>>
}

const STORAGE_KEY = 'mechon_story_architect_layout_preset_v4'

const DEFAULT_LAYOUT: StoryWorkspaceLayout = {
  currentPreset: 'conversation-focus',
  leftDockVisible: true,
  leftDockWidth: 280,
  leftActiveTab: 'scenarios',
  rightDockVisible: true,
  rightDockWidth: 360,
  rightActiveTab: 'workbench',
  bottomDockVisible: false,
  bottomDockHeight: 200,
  bottomActiveTab: 'logs',
  customPresets: {}
}

const PRESET_CONFIGS: Record<StoryWorkspacePreset, Partial<StoryWorkspaceLayout>> = {
  'conversation-focus': {
    currentPreset: 'conversation-focus',
    leftDockVisible: false,
    leftDockWidth: 260,
    rightDockVisible: true,
    rightDockWidth: 360,
    bottomDockVisible: false,
    bottomDockHeight: 180,
    leftActiveTab: 'scenarios',
    rightActiveTab: 'workbench',
    bottomActiveTab: 'logs'
  },
  'story-planning': {
    currentPreset: 'story-planning',
    leftDockVisible: true,
    leftDockWidth: 280,
    leftActiveTab: 'phases',
    rightDockVisible: true,
    rightDockWidth: 380,
    rightActiveTab: 'spec',
    bottomDockVisible: false,
    bottomDockHeight: 200,
    bottomActiveTab: 'logs'
  },
  'agent-supervision': {
    currentPreset: 'agent-supervision',
    leftDockVisible: true,
    leftDockWidth: 260,
    leftActiveTab: 'hierarchy',
    rightDockVisible: true,
    rightDockWidth: 360,
    rightActiveTab: 'agent',
    bottomDockVisible: true,
    bottomDockHeight: 220,
    bottomActiveTab: 'logs'
  },
  'narrative-design': {
    currentPreset: 'narrative-design',
    leftDockVisible: true,
    leftDockWidth: 290,
    leftActiveTab: 'characters',
    rightDockVisible: true,
    rightDockWidth: 360,
    rightActiveTab: 'narrative',
    bottomDockVisible: false,
    bottomDockHeight: 200,
    bottomActiveTab: 'logs'
  },
  'dataset-prep': {
    currentPreset: 'dataset-prep',
    leftDockVisible: true,
    leftDockWidth: 260,
    leftActiveTab: 'hierarchy',
    rightDockVisible: true,
    rightDockWidth: 360,
    rightActiveTab: 'workbench',
    bottomDockVisible: true,
    bottomDockHeight: 240,
    bottomActiveTab: 'sft_preview'
  },
  custom: {}
}

const loadInitialLayout = (): StoryWorkspaceLayout => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_LAYOUT, ...parsed }
    }
  } catch (err) {
    console.warn('Failed to parse story layout from storage:', err)
  }
  return DEFAULT_LAYOUT
}

interface StoryWorkspaceStore {
  layout: StoryWorkspaceLayout
  setLayout: (updates: Partial<StoryWorkspaceLayout>) => void
  applyPreset: (preset: StoryWorkspacePreset) => void
  saveCustomPreset: (name: string) => void
  toggleLeftDock: () => void
  toggleRightDock: () => void
  toggleBottomDock: () => void
  setLeftWidth: (width: number) => void
  setRightWidth: (width: number) => void
  setBottomHeight: (height: number) => void
  setLeftTab: (tab: StoryLeftTab) => void
  setRightTab: (tab: StoryRightTab) => void
  setBottomTab: (tab: StoryBottomTab) => void
  resetToDefault: () => void
}

export const useStoryWorkspaceStore = create<StoryWorkspaceStore>((set, get) => ({
  layout: loadInitialLayout(),

  setLayout: (updates) => {
    set((state) => {
      const next = { ...state.layout, ...updates }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (err) {
        console.warn('Failed to save story layout to storage:', err)
      }
      return { layout: next }
    })
  },

  applyPreset: (preset) => {
    const config = PRESET_CONFIGS[preset] || {}
    get().setLayout({
      ...config,
      currentPreset: preset
    })
  },

  saveCustomPreset: (name) => {
    const { layout } = get()
    const customPresets = {
      ...layout.customPresets,
      [name]: {
        leftDockVisible: layout.leftDockVisible,
        leftDockWidth: layout.leftDockWidth,
        leftActiveTab: layout.leftActiveTab,
        rightDockVisible: layout.rightDockVisible,
        rightDockWidth: layout.rightDockWidth,
        rightActiveTab: layout.rightActiveTab,
        bottomDockVisible: layout.bottomDockVisible,
        bottomDockHeight: layout.bottomDockHeight,
        bottomActiveTab: layout.bottomActiveTab
      }
    }
    get().setLayout({ customPresets, currentPreset: 'custom' })
  },

  toggleLeftDock: () => {
    const { layout } = get()
    get().setLayout({ leftDockVisible: !layout.leftDockVisible })
  },

  toggleRightDock: () => {
    const { layout } = get()
    get().setLayout({ rightDockVisible: !layout.rightDockVisible })
  },

  toggleBottomDock: () => {
    const { layout } = get()
    get().setLayout({ bottomDockVisible: !layout.bottomDockVisible })
  },

  setLeftWidth: (width) => {
    const clamped = Math.min(Math.max(width, 200), 550)
    get().setLayout({ leftDockWidth: clamped })
  },

  setRightWidth: (width) => {
    const clamped = Math.min(Math.max(width, 240), 650)
    get().setLayout({ rightDockWidth: clamped })
  },

  setBottomHeight: (height) => {
    const clamped = Math.min(Math.max(height, 140), 600)
    get().setLayout({ bottomDockHeight: clamped })
  },

  setLeftTab: (tab) => get().setLayout({ leftActiveTab: tab, leftDockVisible: true }),
  setRightTab: (tab) => get().setLayout({ rightActiveTab: tab, rightDockVisible: true }),
  setBottomTab: (tab) => get().setLayout({ bottomActiveTab: tab, bottomDockVisible: true }),

  resetToDefault: () => {
    get().setLayout(DEFAULT_LAYOUT)
  }
}))
