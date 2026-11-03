import { create } from 'zustand'
import type { EditorTab, EditorTabType, BottomPanelTab, WorkspacePreset, LayoutDimensions, CustomPreset } from '../types'

const STORAGE_KEY = 'mechon_ai_editor_workspace_v2'

const DEFAULT_TABS: EditorTab[] = [
  { id: 'tab-datasets', type: 'datasets', title: 'Mechon Corpus', closable: true },
  { id: 'tab-story-architect', type: 'story-architect', title: 'Story Architect', closable: true },
  { id: 'tab-sft', type: 'sft', title: 'SFT Studio', closable: true }
]

const DEFAULT_LAYOUT: LayoutDimensions = {
  leftPanelVisible: true,
  leftPanelWidth: 260,
  rightPanelVisible: true,
  rightPanelWidth: 320,
  bottomPanelVisible: true,
  bottomPanelHeight: 220,
  bottomActiveTab: 'console',
  currentPreset: 'dataset-engineering'
}

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string
  recentClosedTabs: EditorTab[]
  layout: LayoutDimensions
  customPresets: Record<string, CustomPreset>
  
  // Tab actions
  openTab: (tab: { type: EditorTabType; title: string; id?: string; params?: Record<string, any>; forceActive?: boolean }) => string
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
  reopenClosedTab: () => void
  setActiveTab: (tabId: string) => void
  setTabDirty: (tabId: string, dirty: boolean) => void
  updateTabTitle: (tabId: string, title: string) => void
  
  // Layout actions
  toggleLeftPanel: (force?: boolean) => void
  toggleRightPanel: (force?: boolean) => void
  toggleBottomPanel: (force?: boolean) => void
  setLeftPanelWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void
  setBottomPanelHeight: (height: number) => void
  setBottomActiveTab: (tab: BottomPanelTab) => void
  applyPreset: (preset: WorkspacePreset) => void
  saveCustomPreset: (name: string) => void
  deleteCustomPreset: (name: string) => void
  resetLayout: () => void
}

function loadPersistedState(): Partial<EditorState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return {
      tabs: Array.isArray(data.tabs) && data.tabs.length > 0 ? data.tabs : DEFAULT_TABS,
      activeTabId: data.activeTabId || DEFAULT_TABS[0].id,
      layout: { ...DEFAULT_LAYOUT, ...data.layout },
      customPresets: data.customPresets || {}
    }
  } catch (e) {
    console.warn('Failed to load persisted editor state:', e)
    return {}
  }
}

function persistState(state: { tabs: EditorTab[]; activeTabId: string; layout: LayoutDimensions; customPresets: Record<string, CustomPreset> }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      layout: state.layout,
      customPresets: state.customPresets
    }))
  } catch (e) {
    console.warn('Failed to persist editor state:', e)
  }
}

const initialLoaded = loadPersistedState()

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: initialLoaded.tabs || DEFAULT_TABS,
  activeTabId: initialLoaded.activeTabId || DEFAULT_TABS[0].id,
  recentClosedTabs: [],
  layout: initialLoaded.layout || DEFAULT_LAYOUT,
  customPresets: initialLoaded.customPresets || {},

  openTab: ({ type, title, id, params, forceActive = true }) => {
    const { tabs } = get()
    const targetId = id || `tab-${type}`
    
    // Check if tab already exists
    const existingIndex = tabs.findIndex(t => t.id === targetId || (t.type === type && !params && !t.params))
    
    if (existingIndex !== -1) {
      const existingTab = tabs[existingIndex]
      if (forceActive) {
        set({ activeTabId: existingTab.id })
      }
      persistState(get())
      return existingTab.id
    }

    const newTab: EditorTab = {
      id: targetId,
      type,
      title,
      closable: true,
      params
    }

    const newTabs = [...tabs, newTab]
    set({
      tabs: newTabs,
      activeTabId: forceActive ? newTab.id : get().activeTabId
    })
    persistState(get())
    return newTab.id
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId, recentClosedTabs } = get()
    if (tabs.length <= 1) {
      // Don't close the very last tab, keep at least one
      return
    }

    const tabIndex = tabs.findIndex(t => t.id === tabId)
    if (tabIndex === -1) return

    const closedTab = tabs[tabIndex]
    const newTabs = tabs.filter(t => t.id !== tabId)
    let newActiveId = activeTabId

    if (activeTabId === tabId) {
      // Switch to previous or next tab
      const nextIndex = Math.min(tabIndex, newTabs.length - 1)
      newActiveId = newTabs[nextIndex].id
    }

    set({
      tabs: newTabs,
      activeTabId: newActiveId,
      recentClosedTabs: [closedTab, ...recentClosedTabs.slice(0, 15)]
    })
    persistState(get())
  },

  closeOtherTabs: (tabId: string) => {
    const { tabs } = get()
    const target = tabs.find(t => t.id === tabId)
    if (!target) return
    const closed = tabs.filter(t => t.id !== tabId)
    set(state => ({
      tabs: [target],
      activeTabId: target.id,
      recentClosedTabs: [...closed, ...state.recentClosedTabs].slice(0, 20)
    }))
    persistState(get())
  },

  closeAllTabs: () => {
    const { tabs } = get()
    const defaultTab = DEFAULT_TABS[0]
    set(state => ({
      tabs: [defaultTab],
      activeTabId: defaultTab.id,
      recentClosedTabs: [...tabs, ...state.recentClosedTabs].slice(0, 20)
    }))
    persistState(get())
  },

  reopenClosedTab: () => {
    const { recentClosedTabs, tabs } = get()
    if (recentClosedTabs.length === 0) return

    const [tabToReopen, ...rest] = recentClosedTabs
    const exists = tabs.some(t => t.id === tabToReopen.id)
    if (exists) {
      set({ activeTabId: tabToReopen.id, recentClosedTabs: rest })
      return
    }

    set({
      tabs: [...tabs, tabToReopen],
      activeTabId: tabToReopen.id,
      recentClosedTabs: rest
    })
    persistState(get())
  },

  setActiveTab: (tabId: string) => {
    const { tabs } = get()
    if (tabs.some(t => t.id === tabId)) {
      set({ activeTabId: tabId })
      persistState(get())
    }
  },

  setTabDirty: (tabId: string, dirty: boolean) => {
    set(state => ({
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, dirty } : t)
    }))
  },

  updateTabTitle: (tabId: string, title: string) => {
    set(state => ({
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, title } : t)
    }))
    persistState(get())
  },

  toggleLeftPanel: (force?: boolean) => {
    set(state => {
      const next = force !== undefined ? force : !state.layout.leftPanelVisible
      return { layout: { ...state.layout, leftPanelVisible: next } }
    })
    persistState(get())
  },

  toggleRightPanel: (force?: boolean) => {
    set(state => {
      const next = force !== undefined ? force : !state.layout.rightPanelVisible
      return { layout: { ...state.layout, rightPanelVisible: next } }
    })
    persistState(get())
  },

  toggleBottomPanel: (force?: boolean) => {
    set(state => {
      const next = force !== undefined ? force : !state.layout.bottomPanelVisible
      return { layout: { ...state.layout, bottomPanelVisible: next } }
    })
    persistState(get())
  },

  setLeftPanelWidth: (width: number) => {
    const clamped = Math.max(180, Math.min(width, 600))
    set(state => ({ layout: { ...state.layout, leftPanelWidth: clamped } }))
    persistState(get())
  },

  setRightPanelWidth: (width: number) => {
    const clamped = Math.max(200, Math.min(width, 700))
    set(state => ({ layout: { ...state.layout, rightPanelWidth: clamped } }))
    persistState(get())
  },

  setBottomPanelHeight: (height: number) => {
    const clamped = Math.max(120, Math.min(height, 500))
    set(state => ({ layout: { ...state.layout, bottomPanelHeight: clamped } }))
    persistState(get())
  },

  setBottomActiveTab: (tab: BottomPanelTab) => {
    set(state => ({
      layout: { ...state.layout, bottomActiveTab: tab, bottomPanelVisible: true }
    }))
    persistState(get())
  },

  applyPreset: (preset: WorkspacePreset) => {
    const state = get()
    if (preset === 'dataset-engineering') {
      get().openTab({ type: 'datasets', title: 'Mechon Corpus' })
      set({
        layout: {
          ...state.layout,
          leftPanelVisible: true,
          leftPanelWidth: 260,
          rightPanelVisible: true,
          rightPanelWidth: 320,
          bottomPanelVisible: true,
          bottomPanelHeight: 220,
          bottomActiveTab: 'dataset-preview',
          currentPreset: 'dataset-engineering'
        }
      })
    } else if (preset === 'agent-engineering') {
      get().openTab({ type: 'story-architect', title: 'Story Architect' })
      set({
        layout: {
          ...state.layout,
          leftPanelVisible: true,
          leftPanelWidth: 260,
          rightPanelVisible: true,
          rightPanelWidth: 340,
          bottomPanelVisible: true,
          bottomPanelHeight: 240,
          bottomActiveTab: 'agent-logs',
          currentPreset: 'agent-engineering'
        }
      })
    } else if (preset === 'sft-engineering') {
      get().openTab({ type: 'sft', title: 'SFT Studio' })
      set({
        layout: {
          ...state.layout,
          leftPanelVisible: true,
          leftPanelWidth: 260,
          rightPanelVisible: true,
          rightPanelWidth: 320,
          bottomPanelVisible: true,
          bottomPanelHeight: 220,
          bottomActiveTab: 'dataset-preview',
          currentPreset: 'sft-engineering'
        }
      })
    } else if (preset === 'dpo-evaluation') {
      get().openTab({ type: 'dpo', title: 'DPO Studio' })
      set({
        layout: {
          ...state.layout,
          leftPanelVisible: true,
          leftPanelWidth: 260,
          rightPanelVisible: true,
          rightPanelWidth: 320,
          bottomPanelVisible: true,
          bottomPanelHeight: 220,
          bottomActiveTab: 'inference-logs',
          currentPreset: 'dpo-evaluation'
        }
      })
    } else if (preset === 'quality-assurance') {
      get().openTab({ type: 'quality', title: 'Quality Control' })
      set({
        layout: {
          ...state.layout,
          leftPanelVisible: true,
          leftPanelWidth: 260,
          rightPanelVisible: true,
          rightPanelWidth: 320,
          bottomPanelVisible: true,
          bottomPanelHeight: 240,
          bottomActiveTab: 'validation',
          currentPreset: 'quality-assurance'
        }
      })
    } else if (preset === 'provider-engineering') {
      get().openTab({ type: 'playground', title: 'Model Playground' })
      set({
        layout: {
          ...state.layout,
          leftPanelVisible: true,
          leftPanelWidth: 260,
          rightPanelVisible: true,
          rightPanelWidth: 340,
          bottomPanelVisible: true,
          bottomPanelHeight: 240,
          bottomActiveTab: 'diagnostics',
          currentPreset: 'provider-engineering'
        }
      })
    } else if (state.customPresets[preset]) {
      const custom = state.customPresets[preset]
      set({
        layout: { ...custom.layout, currentPreset: 'custom' }
      })
    }
    persistState(get())
  },

  saveCustomPreset: (name: string) => {
    const { layout, tabs, activeTabId, customPresets } = get()
    const activeTab = tabs.find(t => t.id === activeTabId)
    const custom: CustomPreset = {
      name,
      layout: { ...layout, currentPreset: 'custom' },
      activeTabs: tabs.map(t => ({ type: t.type, title: t.title, params: t.params })),
      activeTabType: activeTab?.type
    }
    set({
      customPresets: { ...customPresets, [name]: custom }
    })
    persistState(get())
  },

  deleteCustomPreset: (name: string) => {
    const { customPresets } = get()
    const next = { ...customPresets }
    delete next[name]
    set({ customPresets: next })
    persistState(get())
  },

  resetLayout: () => {
    set({
      layout: { ...DEFAULT_LAYOUT },
      tabs: DEFAULT_TABS,
      activeTabId: DEFAULT_TABS[0].id
    })
    persistState(get())
  }
}))
