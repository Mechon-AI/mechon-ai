import React, { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Bot,
  User,
  Shield,
  Users,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Square,
  Send,
  Cpu,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Layers,
  Flag,
  Info
} from 'lucide-react'
import type {
  PlanningPromptHistory,
  ExecutionMode,
  CharacterProfile,
  PlanningMilestone,
  StorySession
} from '../../types/story_architect'

interface PlanningAgentDockTabProps {
  session: StorySession | null
  characters?: CharacterProfile[]
  proposedPrompt: PlanningPromptHistory | null
  executionMode: ExecutionMode | string
  milestones: PlanningMilestone[]
  activeModel?: string
  activeProviderId?: string
  isGeneratingPrompt: boolean
  isExecutingTurn: boolean
  isStreaming: boolean
  isAutoRunning: boolean
  pauseReason?: string | null
  stateMachineStage?: string
  errorMessage?: string | null
  onSendAndExecute: (content: string, promptHistoryId?: string, edited?: boolean) => Promise<void>
  onStepAutonomous: () => Promise<void>
  onPlanNextPrompt: (feedback?: string) => Promise<void>
  onToggleAutonomy: (mode: ExecutionMode) => Promise<void>
  onToggleAutoRun: () => void
  onStopGeneration?: () => void
  onRetry?: () => void
  onDismissError?: () => void
}

export const PlanningAgentDockTab: React.FC<PlanningAgentDockTabProps> = ({
  session,
  characters = [],
  proposedPrompt,
  executionMode,
  milestones = [],
  activeModel,
  activeProviderId,
  isGeneratingPrompt,
  isExecutingTurn,
  isStreaming,
  isAutoRunning,
  pauseReason,
  stateMachineStage = 'idle',
  errorMessage,
  onSendAndExecute,
  onStepAutonomous,
  onPlanNextPrompt,
  onToggleAutonomy,
  onToggleAutoRun,
  onStopGeneration,
  onRetry,
  onDismissError
}) => {
  const [content, setContent] = useState('')
  const [selectedSpeaker, setSelectedSpeaker] = useState<'user' | 'assistant' | 'system' | string>('user')
  const [speakerDropdownOpen, setSpeakerDropdownOpen] = useState(false)
  const [showRationale, setShowRationale] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isBusy = isGeneratingPrompt || isExecutingTurn || isStreaming

  // Prefill prompt when proposedPrompt changes
  useEffect(() => {
    if (proposedPrompt && proposedPrompt.status === 'proposed') {
      setContent(proposedPrompt.prompt_content)
    }
  }, [proposedPrompt?.id])

  const handleUsePlannedPrompt = () => {
    if (proposedPrompt) {
      setContent(proposedPrompt.prompt_content)
      setSelectedSpeaker('user')
      textareaRef.current?.focus()
    }
  }

  const handleSend = () => {
    if (!content.trim() || isBusy) return
    const textToSend = content.trim()
    const historyId = proposedPrompt?.id
    const wasEdited = proposedPrompt ? textToSend !== proposedPrompt.prompt_content : true
    onSendAndExecute(textToSend, historyId, wasEdited)
    setContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const getSpeakerLabel = () => {
    if (selectedSpeaker === 'user') return 'User (Director / Engineer)'
    if (selectedSpeaker === 'assistant') return 'Assistant (AI Actor)'
    if (selectedSpeaker === 'system') return 'System (World Context)'
    const char = characters.find((c) => c.name === selectedSpeaker)
    return char ? `${char.name} (${char.role || 'Character'})` : selectedSpeaker
  }

  const activeMilestone = milestones.find((m) => m.status === 'active') || milestones[0]

  return (
    <div className="flex flex-col h-full bg-card/40 select-none overflow-y-auto p-3 space-y-3.5 text-xs">
      {/* 1. Header & Stage Status */}
      <div className="p-2.5 rounded-xl border border-border bg-card/80 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <div>
            <span className="font-semibold text-foreground text-xs block">
              Planning Agent
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Stage: <strong className="text-primary font-medium">{stateMachineStage}</strong>
            </span>
          </div>
        </div>

        {/* Planning Model Indicator */}
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono text-purple-300"
          title={`Planning Agent Model: ${session?.planning_model || session?.planning_agent_config?.model_id || activeModel || 'default'}`}
        >
          <Bot className="w-2.5 h-2.5 text-purple-400 shrink-0" />
          <span className="truncate max-w-[120px] font-semibold">
            {session?.planning_model || session?.planning_agent_config?.model_id || activeModel || 'default'}
          </span>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-2.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-xs space-y-1.5 animate-in fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold">Execution Error</span>
            </div>
            {onDismissError && (
              <button
                onClick={onDismissError}
                className="text-[10px] hover:underline opacity-80"
              >
                Dismiss
              </button>
            )}
          </div>
          <p className="text-[11px] leading-relaxed break-words font-mono bg-black/20 p-1.5 rounded">
            {errorMessage}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-2 py-0.5 rounded bg-destructive text-white text-[10px] font-medium hover:bg-destructive/90 transition-colors"
            >
              Retry Step
            </button>
          )}
        </div>
      )}

      {/* 2. Step 1: Review Current Objective & Rationale */}
      <div className="p-2.5 rounded-xl border border-border bg-card/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
            <Flag className="w-3 h-3 text-primary" />
            1. Active Narrative Objective
          </span>
          {activeMilestone && (
            <span className="px-1.5 py-0.2 rounded bg-secondary text-[9px] font-mono text-muted-foreground">
              Milestone #{activeMilestone.order_index + 1}
            </span>
          )}
        </div>

        <p className="text-xs text-foreground/90 font-medium leading-relaxed bg-background/60 p-2 rounded-lg border border-border/60">
          {proposedPrompt?.current_objective ||
            activeMilestone?.objective ||
            session?.description ||
            'Progress the narrative and character dynamics.'}
        </p>

        {/* Planning Rationale Toggle */}
        {proposedPrompt?.contextual_rationale && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowRationale(!showRationale)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {showRationale ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Agent Planning Rationale</span>
            </button>

            {showRationale && (
              <p className="mt-1 text-[11px] text-muted-foreground/90 leading-relaxed italic bg-secondary/30 p-2 rounded border border-border/40">
                "{proposedPrompt.contextual_rationale}"
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Step 2: Autonomy Execution Mode */}
      <div className="p-2.5 rounded-xl border border-border bg-card/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
            <Sliders className="w-3 h-3 text-sky-400" />
            2. Execution Autonomy
          </span>
          <span className="text-[10px] font-mono text-primary capitalize">
            {executionMode.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-secondary/60 p-1 rounded-lg border border-border/80">
          {(
            [
              { id: 'manual', label: 'Manual Review' },
              { id: 'hybrid', label: 'Hybrid Safety' },
              { id: 'auto_allow', label: 'Auto-Allow' }
            ] as { id: ExecutionMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onToggleAutonomy(m.id)}
              className={`py-1 px-1 rounded text-[10px] font-medium transition-colors truncate ${
                executionMode === m.id
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Auto-Allow Continuous Runner */}
        {executionMode === 'auto_allow' && (
          <div className="pt-1 flex items-center justify-between gap-2 bg-emerald-950/20 border border-emerald-900/40 p-2 rounded-lg">
            <div className="text-[11px] text-emerald-300">
              <span className="font-semibold block">Continuous Loop</span>
              <span className="text-[10px] opacity-75">
                {isAutoRunning ? 'Executing turns autonomously...' : 'Paused on standby'}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleAutoRun}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                isAutoRunning
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/40'
              }`}
            >
              {isAutoRunning ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              <span>{isAutoRunning ? 'Pause' : 'Start Loop'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. Step 3: Conversation Composer & Prompt Input */}
      <div className="p-2.5 rounded-xl border border-border bg-card/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
            <User className="w-3 h-3 text-primary" />
            3. Conversation Composer
          </span>

          {proposedPrompt && proposedPrompt.status === 'proposed' && (
            <button
              type="button"
              onClick={handleUsePlannedPrompt}
              className="text-[10px] text-primary hover:underline font-medium"
            >
              Reset to Planned
            </button>
          )}
        </div>

        {/* Speaker Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSpeakerDropdownOpen(!speakerDropdownOpen)}
            className="w-full flex items-center justify-between h-7 px-2.5 rounded-lg bg-background border border-border text-[11px] font-medium text-foreground transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 truncate">
              {selectedSpeaker === 'user' ? (
                <User className="w-3 h-3 text-primary shrink-0" />
              ) : selectedSpeaker === 'assistant' ? (
                <Bot className="w-3 h-3 text-sky-400 shrink-0" />
              ) : selectedSpeaker === 'system' ? (
                <Shield className="w-3 h-3 text-amber-400 shrink-0" />
              ) : (
                <Users className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
              <span className="truncate">{getSpeakerLabel()}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>

          {speakerDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setSpeakerDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1 w-full rounded-xl border border-border bg-popover text-popover-foreground p-1 shadow-2xl z-40 text-xs divide-y divide-border/60">
                <div className="py-0.5">
                  <button
                    onClick={() => {
                      setSelectedSpeaker('user')
                      setSpeakerDropdownOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-left transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>User (Director / Engineer)</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSpeaker('assistant')
                      setSpeakerDropdownOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-left transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5 text-sky-400" />
                    <span>Assistant (AI Actor)</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSpeaker('system')
                      setSpeakerDropdownOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-left transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>System (Stage Context)</span>
                  </button>
                </div>

                {characters.length > 0 && (
                  <div className="py-0.5">
                    <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      Characters
                    </div>
                    {characters.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => {
                          setSelectedSpeaker(c.name)
                          setSpeakerDropdownOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-accent text-left transition-colors"
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {c.role || 'Character'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter prompt instructions, dialogue prompt, or stage direction (Ctrl+Enter to send)..."
          disabled={isBusy}
          rows={4}
          className="w-full p-2.5 rounded-xl bg-background border border-border text-foreground text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-y shadow-inner"
        />

        {/* Action Controls */}
        <div className="space-y-2 pt-1">
          {/* Primary Execute Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!content.trim() || isBusy}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-sm disabled:opacity-40 cursor-pointer"
            title="Execute turn with prompt (Ctrl+Enter)"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isExecutingTurn ? 'Generating Turn...' : 'Execute Turn'}</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            {/* Step Autonomous */}
            <button
              type="button"
              onClick={onStepAutonomous}
              disabled={isBusy}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs text-foreground font-medium transition-colors disabled:opacity-40"
              title="Agent drafts prompt and generates response immediately"
            >
              <Sparkles className="w-3 h-3 text-primary" />
              <span>Step Turn</span>
            </button>

            {/* Plan Next Turn */}
            <button
              type="button"
              onClick={() => onPlanNextPrompt(feedback.trim() || undefined)}
              disabled={isBusy}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              title="Draft next prompt based on narrative state"
            >
              <RotateCcw className={`w-3 h-3 ${isGeneratingPrompt ? 'animate-spin' : ''}`} />
              <span>{isGeneratingPrompt ? 'Planning...' : 'Plan Next Turn'}</span>
            </button>
          </div>

          {/* Feedback Input Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowFeedbackInput(!showFeedbackInput)}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Info className="w-2.5 h-2.5" />
              <span>{showFeedbackInput ? 'Hide guidance' : 'Provide guidance for planning agent'}</span>
            </button>

            {showFeedbackInput && (
              <div className="mt-1.5 space-y-1 animate-in fade-in">
                <input
                  type="text"
                  placeholder="e.g., Introduce tension, involve Vasquez..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Stop Button when Generating */}
          {isBusy && onStopGeneration && (
            <button
              type="button"
              onClick={onStopGeneration}
              className="w-full flex items-center justify-center gap-1 py-1 rounded-lg bg-destructive/20 border border-destructive/40 text-destructive text-xs font-semibold hover:bg-destructive/30 transition-colors"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Cancel Current Execution</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
