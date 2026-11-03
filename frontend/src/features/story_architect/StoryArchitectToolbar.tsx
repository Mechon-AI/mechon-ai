import React, { useState } from 'react'
import {
  Sparkles,
  Database,
  Layout,
  ChevronDown,
  Check,
  PanelLeft,
  PanelRight,
  PanelBottom,
  Play,
  Pause,
  Cpu,
  Bookmark,
  Layers,
  Circle
} from 'lucide-react'
import type { StorySession, ExecutionMode } from '../../types/story_architect'
import {
  useStoryWorkspaceStore,
  StoryWorkspacePreset
} from './useStoryWorkspaceStore'
import { ProviderModelSelector } from '../../editor/shell/ProviderModelSelector'

interface StoryArchitectToolbarProps {
  session: StorySession | null
  activeModel?: string
  activeProviderId?: string
  isAutoRunning: boolean
  isExecutingTurn: boolean
  isGeneratingPrompt: boolean
  onToggleAutoRun: () => void
  onToggleAutonomy: (mode: ExecutionMode) => Promise<void>
  onOpenCommitModal: () => void
  hasMessages: boolean
}

const PRESET_LABELS: Record<StoryWorkspacePreset, string> = {
  'conversation-focus': 'Conversation Focus',
  'story-planning': 'Story Planning',
  'agent-supervision': 'Agent Supervision',
  'narrative-design': 'Narrative Design',
  'dataset-prep': 'Dataset Preparation',
  custom: 'Custom Layout'
}

export const StoryArchitectToolbar: React.FC<StoryArchitectToolbarProps> = ({
  session,
  activeModel,
  activeProviderId,
  isAutoRunning,
  isExecutingTurn,
  isGeneratingPrompt,
  onToggleAutoRun,
  onToggleAutonomy,
  onOpenCommitModal,
  hasMessages
}) => {
  const {
    layout,
    applyPreset,
    toggleLeftDock,
    toggleRightDock,
    toggleBottomDock,
    saveCustomPreset
  } = useStoryWorkspaceStore()

  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false)
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const [savingPreset, setSavingPreset] = useState(false)
  const [customName, setCustomName] = useState('')

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customName.trim()) return
    saveCustomPreset(customName.trim())
    setSavingPreset(false)
    setCustomName('')
    setPresetDropdownOpen(false)
  }

  const turnsRecorded = session ? Math.floor((session.tokens_used > 0 ? 1 : 0) /* placeholder */) : 0

  return (
    <div className="h-10 border-b border-border bg-card/90 backdrop-blur-md px-3 flex items-center justify-between gap-3 shrink-0 text-xs select-none z-30 relative">
      {/* 1. Left: Scenario Title, Status Badge, Metrics */}
      <div className="flex items-center gap-2 truncate">
        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
        <h2 className="text-xs font-semibold text-foreground truncate max-w-xs" title={session?.title}>
          {session?.title || 'Story Architect'}
        </h2>

        {session && (
          <>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-bold shrink-0 ${
                session.status === 'completed'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                  : session.status === 'paused'
                  ? 'bg-amber-950/40 border-amber-800 text-amber-400'
                  : 'bg-primary/20 border-primary/40 text-primary'
              }`}
            >
              {session.status}
            </span>

            <span className="text-[10px] text-muted-foreground font-mono hidden md:inline shrink-0">
              {session.target_turns} turns • {session.tokens_used.toLocaleString()} tok
            </span>
          </>
        )}
      </div>

      {/* 2. Center: Execution Mode & Auto Loop Runner */}
      {session && (
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Autonomy Mode Selector */}
          <div className="relative">
            <button
              onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-[11px] font-medium text-foreground transition-colors"
              title="Execution autonomy mode"
            >
              <span className="text-muted-foreground">Mode:</span>
              <span className="font-semibold capitalize">{session.execution_mode.replace('_', ' ')}</span>
              <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            </button>

            {modeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModeDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-1 w-48 rounded-xl border border-border bg-popover text-popover-foreground p-1 shadow-2xl z-50 text-xs divide-y divide-border/60">
                  <div className="py-0.5">
                    {(['manual', 'hybrid', 'auto_allow'] as ExecutionMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          onToggleAutonomy(mode)
                          setModeDropdownOpen(false)
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors ${
                          session.execution_mode === mode
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'text-foreground hover:bg-accent'
                        }`}
                      >
                        <span className="capitalize">{mode.replace('_', ' ')}</span>
                        {session.execution_mode === mode && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Continuous Auto Loop Play/Pause Toggle */}
          {session.execution_mode === 'auto_allow' && (
            <button
              onClick={onToggleAutoRun}
              className={`flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                isAutoRunning
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 hover:bg-emerald-600/30 shadow-xs'
                  : 'bg-secondary hover:bg-secondary/80 border-border text-muted-foreground hover:text-foreground'
              }`}
              title={isAutoRunning ? 'Pause Continuous Auto Loop' : 'Start Continuous Auto Loop'}
            >
              {isAutoRunning ? (
                <>
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Looping</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Run Auto Loop</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* 3. Right: Model, Presets, Dock Toggles, Commit to SFT */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Interactive Provider & Model Selector */}
        <div className="hidden xl:flex items-center">
          <ProviderModelSelector />
        </div>

        {/* Layout Preset Selector */}
        <div className="relative">
          <button
            onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-[11px] text-foreground transition-colors"
            title="Workspace Layout Preset"
          >
            <Layout className="w-3 h-3 text-primary shrink-0" />
            <span className="font-medium hidden sm:inline">{PRESET_LABELS[layout.currentPreset] || 'Layout'}</span>
            <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
          </button>

          {presetDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPresetDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-popover text-popover-foreground p-1 shadow-2xl z-50 text-xs divide-y divide-border/60">
                <div className="py-1">
                  <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Workspace Presets
                  </div>
                  {(
                    [
                      'conversation-focus',
                      'story-planning',
                      'agent-supervision',
                      'narrative-design',
                      'dataset-prep'
                    ] as StoryWorkspacePreset[]
                  ).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        applyPreset(preset)
                        setPresetDropdownOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors ${
                        layout.currentPreset === preset
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-foreground hover:bg-accent'
                      }`}
                    >
                      <span>{PRESET_LABELS[preset]}</span>
                      {layout.currentPreset === preset && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>

                <div className="p-2">
                  {savingPreset ? (
                    <form onSubmit={handleSaveCustom} className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Preset name..."
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-background border border-border text-xs text-foreground focus:outline-none"
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
                      <Bookmark className="w-3 h-3" /> Save Layout...
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="h-4 w-px bg-border/80 mx-0.5" />

        {/* Dock Panel Toggles */}
        <button
          onClick={toggleLeftDock}
          className={`p-1.5 rounded-lg transition-colors ${
            layout.leftDockVisible
              ? 'bg-secondary text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          title="Toggle Left Explorer Dock"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleBottomDock}
          className={`p-1.5 rounded-lg transition-colors ${
            layout.bottomDockVisible
              ? 'bg-secondary text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          title="Toggle Bottom Control Room Dock"
        >
          <PanelBottom className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleRightDock}
          className={`p-1.5 rounded-lg transition-colors ${
            layout.rightDockVisible
              ? 'bg-secondary text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          title="Toggle Right Inspector Dock"
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>

        {/* Commit to SFT Action Button */}
        {session && (
          <button
            onClick={onOpenCommitModal}
            disabled={!hasMessages || Boolean(session.sft_session_id)}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors disabled:opacity-40"
            title={
              session.sft_session_id
                ? 'Already committed to Mechon SFT Corpus'
                : 'Commit conversation turns to Mechon SFT Corpus'
            }
          >
            <Database className="w-3 h-3" />
            <span className="hidden sm:inline">
              {session.sft_session_id ? 'Committed' : 'Commit to SFT'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
