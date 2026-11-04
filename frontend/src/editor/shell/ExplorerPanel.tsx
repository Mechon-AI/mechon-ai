import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Search,
  Pin,
  Sparkles,
  MessageSquareCode,
  GitCompare,
  Database,
  FileCode2,
  Terminal,
  ShieldCheck,
  BarChart3,
  History,
  FileDown,
  Cpu,
  Settings,
  FolderKanban,
  FileCheck2,
  CopyCheck,
  Users,
  GitFork,
  BarChart2,
  X,
  Plus,
  Smartphone
} from 'lucide-react'
import { useEditorStore } from '../stores/useEditorStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { useInspectorStore } from '../stores/useInspectorStore'
import type { EditorTabType } from '../types'

interface ExplorerItem {
  id: string
  label: string
  type: EditorTabType
  icon: React.ElementType
  badge?: number | string
  highlight?: boolean
}

const CORE_TOOLS: ExplorerItem[] = [
  { id: 'story-architect', label: 'Story Architect', type: 'story-architect', icon: Sparkles, highlight: true },
  { id: 'sft', label: 'SFT Studio', type: 'sft', icon: MessageSquareCode },
  { id: 'dpo', label: 'DPO Studio', type: 'dpo', icon: GitCompare },
  { id: 'forge', label: 'Dataset Forge', type: 'forge', icon: FileCode2 },
  { id: 'datasets', label: 'Mechon Corpus', type: 'datasets', icon: Database },
  { id: 'playground', label: 'Model Playground', type: 'playground', icon: Terminal }
]

const ENGINEERING_TOOLS: ExplorerItem[] = [
  { id: 'readiness', label: 'Training Readiness', type: 'readiness', icon: FileCheck2, highlight: true },
  { id: 'eng-templates', label: 'Chat Templates', type: 'engineering/templates', icon: FileCode2 },
  { id: 'eng-sequence', label: 'Sequence Analytics', type: 'engineering/sequence', icon: BarChart2 },
  { id: 'eng-dedup', label: 'Deduplication', type: 'engineering/dedup', icon: CopyCheck },
  { id: 'eng-persona', label: 'Persona Audit', type: 'engineering/persona', icon: Users },
  { id: 'eng-splits', label: 'Train / Eval Splits', type: 'engineering/splits', icon: GitFork }
]

const DELIVERY_TOOLS: ExplorerItem[] = [
  { id: 'mobile', label: 'Mobile Companion', type: 'mobile', icon: Smartphone, highlight: true },
  { id: 'quality', label: 'Quality Control', type: 'quality', icon: ShieldCheck },
  { id: 'analytics', label: 'Analytics', type: 'analytics', icon: BarChart3 },
  { id: 'versions', label: 'Dataset Snapshots', type: 'versions', icon: History },
  { id: 'export', label: 'Export Center', type: 'export', icon: FileDown },
  { id: 'providers', label: 'Providers', type: 'providers', icon: Cpu },
  { id: 'settings', label: 'Settings', type: 'settings', icon: Settings }
]

export const ExplorerPanel: React.FC = () => {
  const { openTab, toggleLeftPanel } = useEditorStore()
  const { getActiveProject } = useProjectStore()
  const { inspect } = useInspectorStore()

  const activeProject = getActiveProject()

  const [filter, setFilter] = useState('')
  const [pinnedIds, setPinnedIds] = useState<string[]>(['story-architect', 'sft', 'datasets'])
  const [expandedSections, setExpandedSections] = useState({
    project: true,
    pinned: true,
    core: true,
    engineering: true,
    delivery: false
  })

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const allItems = [...CORE_TOOLS, ...ENGINEERING_TOOLS, ...DELIVERY_TOOLS]
  const pinnedItems = allItems.filter((item) => pinnedIds.includes(item.id))

  const matchesFilter = (label: string) => {
    if (!filter) return true
    return label.toLowerCase().includes(filter.toLowerCase())
  }

  const handleItemClick = (item: ExplorerItem) => {
    openTab({ type: item.type, title: item.label })
  }

  return (
    <div className="h-full flex flex-col bg-card/60 backdrop-blur-md select-none overflow-hidden">
      {/* Header */}
      <div className="h-9 px-3 border-b border-border flex items-center justify-between shrink-0 bg-secondary/30">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
            Explorer
          </span>
        </div>

        <button
          onClick={() => toggleLeftPanel(false)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Collapse Explorer (Ctrl+B)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-2 border-b border-border/80">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search hierarchy & tools..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-7 pr-2 py-1 rounded-md bg-secondary/50 border border-border text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
        {/* Project Section */}
        <div>
          <button
            onClick={() => toggleSection('project')}
            className="w-full flex items-center justify-between py-1 px-1.5 text-muted-foreground hover:text-foreground font-mono text-[10px] font-bold uppercase tracking-wider"
          >
            <div className="flex items-center gap-1.5">
              {expandedSections.project ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>Workspace: {activeProject?.name || 'All'}</span>
            </div>
            {activeProject && (
              <span className="text-[9px] bg-secondary px-1.5 py-0.2 rounded font-mono">
                {activeProject.sft_record_count + activeProject.dpo_task_count} rec
              </span>
            )}
          </button>

          {expandedSections.project && activeProject && (
            <div className="pl-3 mt-1 space-y-0.5 border-l border-border/60 ml-2">
              <div
                onClick={() => {
                  inspect({
                    type: 'project',
                    id: activeProject.id,
                    title: activeProject.name,
                    data: activeProject
                  })
                }}
                className="flex items-center justify-between px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <FolderKanban className="h-3 w-3 text-primary" />
                  <span className="truncate">Project Details</span>
                </div>
              </div>

              <div
                onClick={() => openTab({ type: 'sft', title: 'SFT Studio' })}
                className="flex items-center justify-between px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <MessageSquareCode className="h-3 w-3 text-muted-foreground" />
                  <span>SFT Drafts</span>
                </div>
                {activeProject.active_draft_count > 0 && (
                  <span className="text-[9px] text-muted-foreground font-mono">{activeProject.active_draft_count}</span>
                )}
              </div>

              <div
                onClick={() => openTab({ type: 'dpo', title: 'DPO Studio' })}
                className="flex items-center justify-between px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <GitCompare className="h-3 w-3 text-muted-foreground" />
                  <span>DPO Tasks</span>
                </div>
                {activeProject.dpo_task_count > 0 && (
                  <span className="text-[9px] text-muted-foreground font-mono">{activeProject.dpo_task_count}</span>
                )}
              </div>

              <div
                onClick={() => openTab({ type: 'datasets', title: 'Mechon Corpus' })}
                className="flex items-center justify-between px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Database className="h-3 w-3 text-muted-foreground" />
                  <span>Corpus Records</span>
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">{activeProject.sft_record_count}</span>
              </div>
            </div>
          )}
        </div>

        {/* Pinned Tools */}
        {pinnedItems.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('pinned')}
              className="w-full flex items-center justify-between py-1 px-1.5 text-muted-foreground hover:text-foreground font-mono text-[10px] font-bold uppercase tracking-wider"
            >
              <div className="flex items-center gap-1.5">
                {expandedSections.pinned ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span>Pinned Favorites</span>
              </div>
              <Pin className="h-2.5 w-2.5 text-primary" />
            </button>

            {expandedSections.pinned && (
              <div className="space-y-0.5 mt-0.5">
                {pinnedItems.filter((i) => matchesFilter(i.label)).map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={`pinned-${item.id}`}
                      onClick={() => handleItemClick(item)}
                      className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <button
                        onClick={(e) => togglePin(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity"
                        title="Unpin"
                      >
                        <Pin className="h-3 w-3 fill-current text-primary" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Core Studios */}
        <div>
          <button
            onClick={() => toggleSection('core')}
            className="w-full flex items-center justify-between py-1 px-1.5 text-muted-foreground hover:text-foreground font-mono text-[10px] font-bold uppercase tracking-wider"
          >
            <div className="flex items-center gap-1.5">
              {expandedSections.core ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>Core Studios</span>
            </div>
          </button>

          {expandedSections.core && (
            <div className="space-y-0.5 mt-0.5">
              {CORE_TOOLS.filter((i) => matchesFilter(i.label)).map((item) => {
                const Icon = item.icon
                const isPinned = pinnedIds.includes(item.id)
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${item.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <button
                      onClick={(e) => togglePin(item.id, e)}
                      className={`p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity ${
                        isPinned ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title={isPinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className={`h-3 w-3 ${isPinned ? 'fill-current text-primary' : ''}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Fine-Tuning Engineering Suite */}
        <div>
          <button
            onClick={() => toggleSection('engineering')}
            className="w-full flex items-center justify-between py-1 px-1.5 text-muted-foreground hover:text-foreground font-mono text-[10px] font-bold uppercase tracking-wider"
          >
            <div className="flex items-center gap-1.5">
              {expandedSections.engineering ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>Engineering Suite</span>
            </div>
          </button>

          {expandedSections.engineering && (
            <div className="space-y-0.5 mt-0.5">
              {ENGINEERING_TOOLS.filter((i) => matchesFilter(i.label)).map((item) => {
                const Icon = item.icon
                const isPinned = pinnedIds.includes(item.id)
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <button
                      onClick={(e) => togglePin(item.id, e)}
                      className={`p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity ${
                        isPinned ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title={isPinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className={`h-3 w-3 ${isPinned ? 'fill-current text-primary' : ''}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Delivery & System */}
        <div>
          <button
            onClick={() => toggleSection('delivery')}
            className="w-full flex items-center justify-between py-1 px-1.5 text-muted-foreground hover:text-foreground font-mono text-[10px] font-bold uppercase tracking-wider"
          >
            <div className="flex items-center gap-1.5">
              {expandedSections.delivery ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>Delivery & System</span>
            </div>
          </button>

          {expandedSections.delivery && (
            <div className="space-y-0.5 mt-0.5">
              {DELIVERY_TOOLS.filter((i) => matchesFilter(i.label)).map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
