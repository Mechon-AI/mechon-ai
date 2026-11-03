import React, { useState } from 'react'
import {
  Send,
  Sparkles,
  Edit3,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  Sliders,
  ChevronDown,
  Layers,
  Info
} from 'lucide-react'
import type { PlanningPromptHistory, ExecutionMode } from '../../types/story_architect'

interface PromptWorkbenchProps {
  proposedPrompt: PlanningPromptHistory | null
  executionMode: ExecutionMode | string
  onApproveAndExecute: (content: string, promptHistoryId?: string, edited?: boolean) => Promise<void>
  onRegenerate: (feedback?: string) => Promise<void>
  onExecuteAutoStep: () => Promise<void>
  onToggleAutonomy: (mode: ExecutionMode) => Promise<void>
  isGenerating: boolean
  isExecuting: boolean
  pauseReason?: string | null
  isAutoRunning?: boolean
  onToggleAutoRun?: () => void
  stateMachineStage?: string
  errorMessage?: string | null
  onRetry?: () => void
  onDismissError?: () => void
}

export const PromptWorkbench: React.FC<PromptWorkbenchProps> = ({
  proposedPrompt,
  executionMode,
  onApproveAndExecute,
  onRegenerate,
  onExecuteAutoStep,
  onToggleAutonomy,
  isGenerating,
  isExecuting,
  pauseReason,
  isAutoRunning = false,
  onToggleAutoRun,
  stateMachineStage = 'idle',
  errorMessage,
  onRetry,
  onDismissError
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [feedback, setFeedback] = useState('')
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)

  React.useEffect(() => {
    if (proposedPrompt) {
      setEditedText(proposedPrompt.prompt_content)
    }
  }, [proposedPrompt])

  const handleApprove = () => {
    if (!proposedPrompt) return
    const textToSend = isEditing ? editedText : proposedPrompt.prompt_content
    onApproveAndExecute(textToSend, proposedPrompt.id, isEditing)
    setIsEditing(false)
  }

  const handleRegenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onRegenerate(feedback.trim() || undefined)
    setShowFeedbackInput(false)
    setFeedback('')
  }

  return (
    <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
      {/* Error Notification if any */}
      {errorMessage && (
        <div className={`mb-3 p-3 rounded-xl border flex items-center justify-between text-xs shadow-sm ${
          errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('rate limit')
            ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
            : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
        }`}>
          <div className="flex items-start gap-2.5 flex-1 pr-2">
            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
              errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('rate limit')
                ? 'text-amber-400'
                : 'text-rose-400'
            }`} />
            <div className="space-y-0.5">
              <span className="font-semibold">
                {errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('rate limit')
                  ? 'Rate Limit Exceeded (HTTP 429):'
                  : 'Execution Error:'}
              </span>{' '}
              <span>{errorMessage}</span>
              {(errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('rate limit')) && (
                <p className="text-[11px] text-amber-300/80 pt-0.5">
                  Tip: Switch to another provider or model in the header bar above, then click Retry to continue instantly without restarting.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs transition-colors shadow-xs"
              >
                Retry
              </button>
            )}
            {onDismissError && (
              <button
                onClick={onDismissError}
                className="text-muted-foreground hover:text-foreground text-xs px-1"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pause Notification if any */}
      {pauseReason && (
        <div className="mb-3 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 flex items-start gap-2.5 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Autonomous Guardrail Activated:</span> {pauseReason}
          </div>
        </div>
      )}

      {/* Header bar with mode toggle */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-primary/10 text-primary">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
            Planning Agent Workbench
          </span>
          {proposedPrompt && (
            <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-mono">
              Turn #{proposedPrompt.turn_index + 1}
            </span>
          )}
          {stateMachineStage && stateMachineStage !== 'idle' && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border bg-primary/20 text-primary border-primary/40 uppercase animate-pulse">
              {stateMachineStage.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Execution Mode Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary/80 p-0.5 rounded-lg border border-border text-[11px]">
            <button
              onClick={() => onToggleAutonomy('manual')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                executionMode === 'manual'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Manual Review
            </button>
            <button
              onClick={() => onToggleAutonomy('hybrid')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                executionMode === 'hybrid'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Hybrid Safety
            </button>
            <button
              onClick={() => onToggleAutonomy('auto_allow')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                executionMode === 'auto_allow'
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Auto-Allow
            </button>
          </div>

          {executionMode === 'auto_allow' && onToggleAutoRun && (
            <button
              onClick={onToggleAutoRun}
              disabled={isGenerating}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                isAutoRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
              }`}
              title={isAutoRunning ? 'Pause Continuous Autonomous Loop' : 'Run Continuous Autonomous Loop until completion'}
            >
              {isAutoRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isAutoRunning ? 'Pause Loop' : 'Run Auto Loop'}</span>
            </button>
          )}

          <button
            onClick={onExecuteAutoStep}
            disabled={isGenerating || isExecuting}
            className="flex items-center gap-1.5 text-xs bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1.5 rounded-lg border border-border transition-colors disabled:opacity-50 font-medium"
            title="Step through one autonomous generation cycle"
          >
            {isExecuting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{isExecuting ? 'Executing...' : 'Step Autonomous Turn'}</span>
          </button>
        </div>
      </div>

      {/* Proposed Prompt Box */}
      {proposedPrompt ? (
        <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
          {/* Agent Rationale & Objective */}
          <div className="flex items-start justify-between gap-3 text-[11px] pb-2 border-b border-primary/20">
            <div>
              <span className="font-semibold text-primary block">Active Objective:</span>
              <p className="text-foreground leading-snug">{proposedPrompt.current_objective}</p>
            </div>
            {proposedPrompt.contextual_rationale && (
              <div className="max-w-md text-right">
                <span className="text-muted-foreground font-semibold block">Planning Rationale:</span>
                <p className="text-muted-foreground line-clamp-2">{proposedPrompt.contextual_rationale}</p>
              </div>
            )}
          </div>

          {/* Prompt Content / Editor */}
          {isEditing ? (
            <div>
              <label className="text-[11px] font-medium text-primary block mb-1">
                Edit Proposed User Prompt:
              </label>
              <textarea
                rows={3}
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg bg-card border border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary text-foreground leading-relaxed"
              />
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-card/80 border border-border/80 text-xs text-foreground leading-relaxed">
              {proposedPrompt.prompt_content}
            </div>
          )}

          {/* Regeneration Feedback drawer */}
          {showFeedbackInput && (
            <form onSubmit={handleRegenerateSubmit} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                autoFocus
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Give guidance to the planning agent (e.g. 'Push the interrogation further')..."
                className="flex-1 text-xs px-3 py-1.5 rounded-md bg-secondary/80 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={isGenerating}
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md font-medium"
              >
                Regenerate
              </button>
              <button
                type="button"
                onClick={() => setShowFeedbackInput(false)}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5"
              >
                Cancel
              </button>
            </form>
          )}

          {/* Action Button Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Prompt'}</span>
              </button>

              <button
                onClick={() => setShowFeedbackInput(!showFeedbackInput)}
                disabled={isGenerating}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>

            <button
              onClick={handleApprove}
              disabled={isExecuting || isGenerating}
              className="flex items-center gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg shadow-md transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isExecuting ? 'Generating Response...' : isEditing ? 'Execute Edited Prompt' : 'Approve & Execute Turn'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-dashed border-border text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            No pending prompt proposed yet.
          </p>
          <button
            onClick={() => onRegenerate()}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-3.5 py-2 rounded-lg shadow-sm transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Next Planned Prompt</span>
          </button>
        </div>
      )}
    </div>
  )
}
