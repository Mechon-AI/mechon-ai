import React, { useState } from 'react'
import {
  X,
  Plus,
  Circle,
  Database,
  Sparkles,
  MessageSquareCode,
  GitCompare,
  FileCode2,
  Terminal,
  ShieldCheck,
  BarChart3,
  History,
  FileDown,
  Cpu,
  Settings,
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  FileCheck2,
  CopyCheck,
  Users,
  GitFork,
  BarChart2,
  FileEdit
} from 'lucide-react'
import { useEditorStore } from '../stores/useEditorStore'
import { TabContextMenu } from './TabContextMenu'
import type { EditorTabType } from '../types'

const TAB_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  'story-architect': Sparkles,
  sft: MessageSquareCode,
  dpo: GitCompare,
  datasets: Database,
  forge: FileCode2,
  playground: Terminal,
  quality: ShieldCheck,
  analytics: BarChart3,
  versions: History,
  export: FileDown,
  providers: Cpu,
  settings: Settings,
  'engineering/templates': FileCode2,
  'engineering/sequence': BarChart2,
  'engineering/dedup': CopyCheck,
  'engineering/persona': Users,
  'engineering/splits': GitFork,
  readiness: FileCheck2,
  'record-editor': FileEdit
}

const AVAILABLE_MODULES: { type: EditorTabType; title: string; category: string }[] = [
  { type: 'datasets', title: 'Mechon Corpus', category: 'Core' },
  { type: 'story-architect', title: 'Story Architect', category: 'Core' },
  { type: 'sft', title: 'SFT Studio', category: 'Core' },
  { type: 'dpo', title: 'DPO Studio', category: 'Core' },
  { type: 'forge', title: 'Dataset Forge', category: 'Core' },
  { type: 'playground', title: 'Model Playground', category: 'Core' },
  { type: 'readiness', title: 'Training Readiness', category: 'Engineering' },
  { type: 'engineering/templates', title: 'Chat Templates', category: 'Engineering' },
  { type: 'engineering/sequence', title: 'Sequence Analytics', category: 'Engineering' },
  { type: 'engineering/dedup', title: 'Deduplication', category: 'Engineering' },
  { type: 'engineering/persona', title: 'Persona Audit', category: 'Engineering' },
  { type: 'engineering/splits', title: 'Partition Splits', category: 'Engineering' },
  { type: 'quality', title: 'Quality Control', category: 'Delivery' },
  { type: 'analytics', title: 'Dataset Analytics', category: 'Delivery' },
  { type: 'versions', title: 'Version History', category: 'Delivery' },
  { type: 'export', title: 'Export Center', category: 'Delivery' },
  { type: 'providers', title: 'Provider Manager', category: 'System' },
  { type: 'settings', title: 'Preferences', category: 'System' }
]

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab } = useEditorStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, tabId })
  }

  return (
    <div className="h-9 border-b border-border bg-card px-1 flex items-center justify-between select-none shrink-0 relative">
      {/* Scrollable Tabs Container */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar h-full py-1 flex-1 min-w-0 pr-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          const Icon = TAB_ICONS[tab.type] || Database

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              className={`group flex items-center gap-2 h-7 px-3 rounded-md text-xs font-medium cursor-pointer border transition-all shrink-0 max-w-[200px] ${
                isActive
                  ? 'bg-secondary/90 border-border text-foreground shadow-sm'
                  : 'bg-transparent border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="truncate flex-1">{tab.title}</span>

              {tab.dirty && (
                <span title="Unsaved changes" className="flex items-center">
                  <Circle className="h-2 w-2 fill-amber-400 text-amber-400 shrink-0" />
                </span>
              )}

              {tab.closable !== false && tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className={`p-0.5 rounded hover:bg-destructive/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity ${
                    isActive ? 'opacity-80' : ''
                  }`}
                  title="Close Tab (Ctrl+W)"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}

        {/* Plus / New Tab Button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Open Module Tab"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div
                className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-border bg-[#11131a] dark:bg-[#11131a] light:bg-white text-popover-foreground p-1 shadow-2xl z-50 divide-y divide-border/60"
                onClick={() => setDropdownOpen(false)}
              >
              {['Core', 'Engineering', 'Delivery', 'System'].map((cat) => (
                <div key={cat} className="py-1">
                  <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    {cat}
                  </div>
                  {AVAILABLE_MODULES.filter((m) => m.category === cat).map((m) => {
                    const ModIcon = TAB_ICONS[m.type] || Database
                    return (
                      <button
                        key={m.type}
                        onClick={() => openTab({ type: m.type, title: m.title })}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-accent text-left transition-colors"
                      >
                        <ModIcon className="h-3.5 w-3.5 text-primary" />
                        <span>{m.title}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>

      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabId={contextMenu.tabId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
