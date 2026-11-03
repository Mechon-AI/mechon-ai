import React, { useState } from 'react'
import {
  Sparkles,
  Terminal,
  Activity,
  FileCode2,
  Copy,
  Check,
  RotateCcw,
  Bot,
  Database,
  Layers,
  Search,
  Trash2
} from 'lucide-react'
import type {
  PlanningPromptHistory,
  ExecutionMode,
  StoryMessage,
  StorySession
} from '../../types/story_architect'
import { PromptWorkbench } from './PromptWorkbench'
import { useStoryWorkspaceStore, StoryBottomTab } from './useStoryWorkspaceStore'

interface StoryBottomDockProps {
  session: StorySession | null
  messages: StoryMessage[]
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
  executionLogs: string[]
  onOpenCommitModal?: () => void
}

export const StoryBottomDock: React.FC<StoryBottomDockProps> = ({
  session,
  messages,
  proposedPrompt,
  executionMode,
  onApproveAndExecute,
  onRegenerate,
  onExecuteAutoStep,
  onToggleAutonomy,
  isGenerating,
  isExecuting,
  pauseReason,
  isAutoRunning,
  onToggleAutoRun,
  stateMachineStage,
  errorMessage,
  onRetry,
  onDismissError,
  executionLogs,
  onOpenCommitModal
}) => {
  const { layout, setBottomTab } = useStoryWorkspaceStore()
  const activeTab = layout.bottomActiveTab

  const [copiedPreview, setCopiedPreview] = useState(false)
  const [logFilter, setLogFilter] = useState('')

  // Build SFT format dataset preview
  const sftPreviewData = {
    title: session?.title || 'Story Conversation',
    system_prompt: session?.description || 'Autonomous Roleplay Architect',
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content
    })),
    metadata: {
      session_id: session?.id,
      turns: messages.length / 2,
      tokens: session?.tokens_used,
      interaction_type: session?.interaction_type
    }
  }

  const sftPreviewJson = JSON.stringify(sftPreviewData, null, 2)

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(sftPreviewJson)
    setCopiedPreview(true)
    setTimeout(() => setCopiedPreview(false), 2000)
  }

  const filteredLogs = logFilter.trim()
    ? executionLogs.filter((l) => l.toLowerCase().includes(logFilter.toLowerCase()))
    : executionLogs

  return (
    <div className="flex flex-col h-full bg-card/60 select-none overflow-hidden border-t border-border">
      {/* 1. Tab Strip */}
      <div className="h-8 px-2 border-b border-border flex items-center justify-between bg-card/90 shrink-0 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setBottomTab('workbench')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
              activeTab === 'workbench'
                ? 'bg-secondary text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Planning Agent Workbench"
          >
            <Sparkles className="w-3 h-3 text-primary" />
            <span>Planning Agent</span>
            {proposedPrompt && proposedPrompt.status === 'proposed' && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setBottomTab('logs')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
              activeTab === 'logs'
                ? 'bg-secondary text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Agent Thought & Execution Logs"
          >
            <Bot className="w-3 h-3 text-sky-400" />
            <span>Agent Logs ({executionLogs.length})</span>
          </button>

          <button
            onClick={() => setBottomTab('sft_preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
              activeTab === 'sft_preview'
                ? 'bg-secondary text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="SFT Dataset Preview & Commit"
          >
            <FileCode2 className="w-3 h-3 text-emerald-400" />
            <span>Dataset Preview</span>
          </button>

          <button
            onClick={() => setBottomTab('diagnostics')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
              activeTab === 'diagnostics'
                ? 'bg-secondary text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Engine Diagnostics"
          >
            <Activity className="w-3 h-3 text-amber-400" />
            <span>Diagnostics</span>
          </button>
        </div>

        {/* Tab specific right controls */}
        {activeTab === 'sft_preview' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPreview}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedPreview ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPreview ? 'Copied' : 'Copy JSON'}</span>
            </button>

            {onOpenCommitModal && (
              <button
                onClick={onOpenCommitModal}
                disabled={messages.length === 0 || Boolean(session?.sft_session_id)}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
              >
                <Database className="w-3 h-3" />
                <span>{session?.sft_session_id ? 'Committed' : 'Commit to SFT'}</span>
              </button>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="relative flex items-center">
            <Search className="w-3 h-3 absolute left-2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="pl-6 pr-2 py-0.5 text-[10px] rounded bg-secondary/60 border border-border/80 text-foreground placeholder:text-muted-foreground/60 focus:outline-none w-36"
            />
          </div>
        )}
      </div>

      {/* 2. Content Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'workbench' && (
          <div className="h-full">
            <PromptWorkbench
              proposedPrompt={proposedPrompt}
              executionMode={executionMode}
              onApproveAndExecute={onApproveAndExecute}
              onRegenerate={onRegenerate}
              onExecuteAutoStep={onExecuteAutoStep}
              onToggleAutonomy={onToggleAutonomy}
              isGenerating={isGenerating}
              isExecuting={isExecuting}
              pauseReason={pauseReason}
              isAutoRunning={isAutoRunning}
              onToggleAutoRun={onToggleAutoRun}
              stateMachineStage={stateMachineStage}
              errorMessage={errorMessage}
              onRetry={onRetry}
              onDismissError={onDismissError}
            />
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-3 font-mono text-[11px] space-y-1 select-text">
            {filteredLogs.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">No agent logs recorded yet.</p>
            ) : (
              filteredLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 py-0.5 hover:bg-secondary/40 px-1 rounded transition-colors text-foreground/80 leading-relaxed"
                >
                  <span className="text-muted-foreground/50 select-none shrink-0">
                    {String(idx + 1).padStart(3, '0')}
                  </span>
                  <span className="break-all">{log}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'sft_preview' && (
          <div className="p-3 font-mono text-xs select-text">
            <pre className="p-3 rounded-xl bg-background/80 border border-border text-foreground/90 overflow-x-auto leading-relaxed text-[11px]">
              {sftPreviewJson}
            </pre>
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div className="p-3 space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg border border-border bg-card/60">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                  State Machine
                </span>
                <span className="font-semibold text-foreground text-xs font-mono">
                  {stateMachineStage || 'idle'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-border bg-card/60">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                  Total Turns Recorded
                </span>
                <span className="font-semibold text-foreground text-xs font-mono">
                  {messages.length} messages ({Math.floor(messages.length / 2)} turns)
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-border bg-card/60">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                  Autonomous Loop
                </span>
                <span className="font-semibold text-foreground text-xs font-mono">
                  {isAutoRunning ? 'ACTIVE (Looping)' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
