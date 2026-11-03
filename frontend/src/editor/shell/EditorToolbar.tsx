import React, { useState } from 'react'
import {
  FolderKanban,
  ChevronDown,
  Layout,
  Save,
  RotateCcw,
  RotateCw,
  Search,
  Command,
  Bot,
  Cpu,
  Circle,
  Plus,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Check,
  Bookmark
} from 'lucide-react'
import { useEditorStore } from '../stores/useEditorStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProviderStore } from '../../stores/useProviderStore'
import { useConsoleStore } from '../stores/useConsoleStore'
import { ProviderModelSelector } from './ProviderModelSelector'
import type { WorkspacePreset } from '../types'

interface EditorToolbarProps {
  onOpenCommandPalette: () => void
  onOpenQuickOpen: () => void
  onSave?: () => void
}

const PRESET_NAMES: Record<WorkspacePreset, string> = {
  'dataset-engineering': 'Dataset Engineering',
  'agent-engineering': 'Agent Engineering',
  'sft-engineering': 'SFT Engineering',
  'dpo-evaluation': 'DPO Evaluation',
  'quality-assurance': 'Quality Assurance',
  'provider-engineering': 'Provider Engineering',
  custom: 'Custom Layout'
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onOpenCommandPalette,
  onOpenQuickOpen,
  onSave
}) => {
  const {
    layout,
    tabs,
    activeTabId,
    applyPreset,
    saveCustomPreset,
    toggleLeftPanel,
    toggleRightPanel,
    toggleBottomPanel,
    setBottomActiveTab,
    openTab
  } = useEditorStore()

  const { projects, activeProjectId, setActiveProjectId, getActiveProject } = useProjectStore()
  const { providers, activeProviderId, activeModel, isOnline, setActiveProviderId, setActiveModel } = useProviderStore()
  const { addLog } = useConsoleStore()

  const [projectDropdown, setProjectDropdown] = useState(false)
  const [presetDropdown, setPresetDropdown] = useState(false)
  const [customPresetName, setCustomPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)

  const activeProject = getActiveProject()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const hasDirtyTabs = tabs.some((t) => t.dirty)

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault()
    if (customPresetName.trim()) {
      saveCustomPreset(customPresetName.trim())
      setCustomPresetName('')
      setSavingPreset(false)
      addLog('info', 'system', `Custom layout preset '${customPresetName.trim()}' saved.`)
    }
  }

  return (
    <div className="h-10 border-b border-border bg-card/95 backdrop-blur-md px-3 flex items-center justify-between gap-3 select-none shrink-0 text-xs relative z-40">
      {/* Left: Project Selector & Layout Presets */}
      <div className="flex items-center gap-2">
        {/* Project Selector */}
        <div className="relative">
          <button
            onClick={() => setProjectDropdown(!projectDropdown)}
            className="flex items-center gap-2 h-7 px-2.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border/80 transition-colors text-foreground font-medium max-w-[200px]"
          >
            <FolderKanban className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{activeProject?.name || 'Select Project'}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>

          {projectDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProjectDropdown(false)} />
              <div
                className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-border bg-popover text-popover-foreground p-1 shadow-2xl z-50 divide-y divide-border/60 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setProjectDropdown(false)}
              >
                <div className="max-h-48 overflow-y-auto py-0.5">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveProjectId(p.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        p.id === activeProjectId
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-foreground hover:bg-accent'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] opacity-70 font-mono ml-2">
                        {p.sft_record_count + p.dpo_task_count} rec
                      </span>
                    </button>
                  ))}
                </div>
                <div className="pt-1">
                  <button
                    onClick={() => openTab({ type: 'projects', title: 'Projects' })}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" /> Manage Projects
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Layout Preset Selector */}
        <div className="relative">
          <button
            onClick={() => setPresetDropdown(!presetDropdown)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border/60 transition-colors text-muted-foreground hover:text-foreground text-[11px]"
          >
            <Layout className="h-3 w-3 text-primary shrink-0" />
            <span className="font-medium text-foreground">{PRESET_NAMES[layout.currentPreset] || 'Layout'}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>

          {presetDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPresetDropdown(false)} />
              <div className="absolute left-0 top-full mt-1 w-60 rounded-xl border border-border bg-popover text-popover-foreground p-1 shadow-2xl z-50 text-xs divide-y divide-border/60 animate-in fade-in zoom-in-95 duration-100">
                <div className="py-1">
                  <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Presets
                  </div>
                  {(
                    [
                      'dataset-engineering',
                      'agent-engineering',
                      'sft-engineering',
                      'dpo-evaluation',
                      'quality-assurance',
                      'provider-engineering'
                    ] as WorkspacePreset[]
                  ).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        applyPreset(preset)
                        setPresetDropdown(false)
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors ${
                        layout.currentPreset === preset
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-foreground hover:bg-accent'
                      }`}
                    >
                      <span>{PRESET_NAMES[preset]}</span>
                      {layout.currentPreset === preset && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>

                {/* Custom Presets Save Form */}
                <div className="p-2">
                {savingPreset ? (
                  <form onSubmit={handleSavePreset} className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Preset name..."
                      value={customPresetName}
                      onChange={(e) => setCustomPresetName(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setSavingPreset(false)}
                        className="px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setSavingPreset(true)}
                    className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-xs text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Bookmark className="h-3 w-3" /> Save Current Layout...
                  </button>
                )}
              </div>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Center: Command Palette, Quick Search, Quick Save, Undo/Redo */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 h-7 px-3 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-all shadow-xs"
          title="Open Command Palette (Ctrl+Shift+P)"
        >
          <Command className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-medium">Command Palette</span>
          <kbd className="px-1 py-0.2 rounded bg-background/60 text-[9px] font-mono text-muted-foreground border border-border">
            Ctrl+Shift+P
          </kbd>
        </button>

        <button
          onClick={onOpenQuickOpen}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Quick Open (Ctrl+P)"
        >
          <Search className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border/80 mx-1" />

        <button
          onClick={() => {
            if (onSave) onSave()
            addLog('info', 'system', 'Saved active changes.')
          }}
          className={`flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors ${
            hasDirtyTabs
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
              : 'bg-transparent border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          title="Quick Save (Ctrl+S)"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Save</span>
          {hasDirtyTabs && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
        </button>

        <button
          onClick={() => document.execCommand('undo')}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => document.execCommand('redo')}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Right: Agent Status, Inference Selector & Panel Toggles */}
      <div className="flex items-center gap-2">
        {/* Agent Activity Indicator */}
        <button
          onClick={() => setBottomActiveTab('agent-logs')}
          className="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/60 transition-colors text-[11px]"
          title="Story Architect Agent Status"
        >
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground font-mono">Agent:</span>
          <span className="text-emerald-400 font-semibold font-mono">Ready</span>
        </button>

        {/* Interactive Inference Provider & Model Selector */}
        <div className="hidden lg:flex items-center">
          <ProviderModelSelector />
        </div>

        <div className="h-4 w-px bg-border/80 mx-1" />

        {/* Panel Toggles */}
        <button
          onClick={() => toggleLeftPanel()}
          className={`p-1.5 rounded-lg transition-colors ${
            layout.leftPanelVisible
              ? 'bg-secondary text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          title="Toggle Left Explorer (Ctrl+B)"
        >
          <PanelLeft className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => toggleBottomPanel()}
          className={`p-1.5 rounded-lg transition-colors ${
            layout.bottomPanelVisible
              ? 'bg-secondary text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          title="Toggle Bottom Console (Ctrl+J)"
        >
          <PanelBottom className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => toggleRightPanel()}
          className={`p-1.5 rounded-lg transition-colors ${
            layout.rightPanelVisible
              ? 'bg-secondary text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          title="Toggle Property Inspector (Ctrl+Shift+I)"
        >
          <PanelRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
