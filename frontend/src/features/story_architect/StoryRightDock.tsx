import React from 'react'
import {
  Sparkles,
  Compass,
  Activity,
  Bot,
  ShieldCheck,
  Sliders,
  FileText,
  Layers,
  Info
} from 'lucide-react'
import type {
  StorySession,
  PlanningSpecification,
  NarrativeState,
  AgentEvaluation,
  SavePlanningSpecInput,
  PlanningPromptHistory,
  ExecutionMode,
  PlanningMilestone
} from '../../types/story_architect'
import type { Provider } from '../../types'
import { PlanningAgentDockTab } from './PlanningAgentDockTab'
import { PlanningEditor } from './PlanningEditor'
import { NarrativeStateInspector } from './NarrativeStateInspector'
import { AgentActivityMonitor } from './AgentActivityMonitor'
import { useStoryWorkspaceStore } from './useStoryWorkspaceStore'

interface StoryRightDockProps {
  session: StorySession | null
  spec: PlanningSpecification | null
  narrativeState: NarrativeState | null
  latestEvaluation: AgentEvaluation | null
  executionLogs: string[]
  providers: Provider[]
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
  stateMachineStage: string
  errorMessage?: string | null
  onSaveSpec: (input: SavePlanningSpecInput) => Promise<void>
  savingSpec: boolean
  onUpdateAgent: (
    role: 'planning' | 'inference' | 'evaluation',
    providerId: string,
    model: string
  ) => Promise<void>
  onRefreshProvider: (providerId: string) => Promise<void>
  onSendAndExecute: (content: string, promptHistoryId?: string, edited?: boolean) => Promise<void>
  onStepAutonomous: () => Promise<void>
  onPlanNextPrompt: (feedback?: string) => Promise<void>
  onToggleAutonomy: (mode: ExecutionMode) => Promise<void>
  onToggleAutoRun: () => void
  onStopGeneration?: () => void
  onRetry?: () => void
  onDismissError?: () => void
}

export const StoryRightDock: React.FC<StoryRightDockProps> = ({
  session,
  spec,
  narrativeState,
  latestEvaluation,
  executionLogs,
  providers,
  proposedPrompt,
  executionMode,
  milestones,
  activeModel,
  activeProviderId,
  isGeneratingPrompt,
  isExecutingTurn,
  isStreaming,
  isAutoRunning,
  pauseReason,
  stateMachineStage,
  errorMessage,
  onSaveSpec,
  savingSpec,
  onUpdateAgent,
  onRefreshProvider,
  onSendAndExecute,
  onStepAutonomous,
  onPlanNextPrompt,
  onToggleAutonomy,
  onToggleAutoRun,
  onStopGeneration,
  onRetry,
  onDismissError
}) => {
  const { layout, setRightTab } = useStoryWorkspaceStore()
  const activeTab = layout.rightActiveTab

  return (
    <div className="flex flex-col h-full bg-card/40 select-none overflow-hidden border-l border-border">
      {/* 1. Tab Strip */}
      <div className="h-8 px-1.5 border-b border-border flex items-center gap-1 bg-card/80 shrink-0 text-xs overflow-x-auto no-scrollbar">
        {/* Planning Agent / Workbench Tab (Primary Relocated Destination) */}
        <button
          onClick={() => setRightTab('workbench')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
            activeTab === 'workbench'
              ? 'bg-secondary text-primary font-semibold shadow-xs border border-primary/30'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Planning Agent Controls & Message Composer"
        >
          <Sparkles className="w-3 h-3 text-primary" />
          <span>Planning Agent</span>
          {proposedPrompt && proposedPrompt.status === 'proposed' && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setRightTab('spec')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
            activeTab === 'spec'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Planning Specification"
        >
          <Compass className="w-3 h-3 text-sky-400" />
          <span>Plan Spec</span>
        </button>

        <button
          onClick={() => setRightTab('narrative')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
            activeTab === 'narrative'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Narrative State & Continuity"
        >
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>Narrative State</span>
        </button>

        <button
          onClick={() => setRightTab('agent')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
            activeTab === 'agent'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Agent Monitor & Evaluation"
        >
          <Bot className="w-3 h-3 text-sky-400" />
          <span>Agent Monitor</span>
        </button>

        <button
          onClick={() => setRightTab('ground_truths')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
            activeTab === 'ground_truths'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Established Ground Truths"
        >
          <ShieldCheck className="w-3 h-3 text-amber-400" />
          <span>Ground Truths</span>
        </button>

        <button
          onClick={() => setRightTab('generation')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
            activeTab === 'generation'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Generation Settings"
        >
          <Sliders className="w-3 h-3 text-purple-400" />
          <span>Settings</span>
        </button>
      </div>

      {/* 2. Content Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Relocated Planning Agent Tab */}
        {activeTab === 'workbench' && (
          <PlanningAgentDockTab
            session={session}
            characters={spec?.character_profiles || []}
            proposedPrompt={proposedPrompt}
            executionMode={executionMode}
            milestones={milestones}
            activeModel={activeModel}
            activeProviderId={activeProviderId}
            isGeneratingPrompt={isGeneratingPrompt}
            isExecutingTurn={isExecutingTurn}
            isStreaming={isStreaming}
            isAutoRunning={isAutoRunning}
            pauseReason={pauseReason}
            stateMachineStage={stateMachineStage}
            errorMessage={errorMessage}
            onSendAndExecute={onSendAndExecute}
            onStepAutonomous={onStepAutonomous}
            onPlanNextPrompt={onPlanNextPrompt}
            onToggleAutonomy={onToggleAutonomy}
            onToggleAutoRun={onToggleAutoRun}
            onStopGeneration={onStopGeneration}
            onRetry={onRetry}
            onDismissError={onDismissError}
          />
        )}

        {activeTab === 'spec' && spec && (
          <div className="h-full flex flex-col">
            <PlanningEditor
              spec={spec}
              onSaveSpec={onSaveSpec}
              saving={savingSpec}
            />
          </div>
        )}

        {activeTab === 'narrative' && (
          <div className="h-full">
            <NarrativeStateInspector state={narrativeState} />
          </div>
        )}

        {activeTab === 'agent' && (
          <div className="h-full">
            <AgentActivityMonitor
              evaluation={latestEvaluation}
              session={session}
              logs={executionLogs}
              providers={providers}
              onUpdateAgent={onUpdateAgent}
              onRefreshProvider={onRefreshProvider}
              executingAgent={
                stateMachineStage === 'planning' || isGeneratingPrompt
                  ? 'planning'
                  : stateMachineStage === 'generating' || isExecutingTurn
                  ? 'inference'
                  : stateMachineStage === 'evaluating'
                  ? 'evaluation'
                  : null
              }
            />
          </div>
        )}

        {activeTab === 'ground_truths' && (
          <div className="p-3 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-border/60 text-[10px] text-muted-foreground uppercase font-mono">
              <span>Established World Facts</span>
              <span>{narrativeState?.established_facts?.length || 0} facts</span>
            </div>

            {narrativeState?.established_facts && narrativeState.established_facts.length > 0 ? (
              <div className="space-y-1.5">
                {narrativeState.established_facts.map((fact, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-card/70 border border-border flex items-start gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span className="text-foreground/90 leading-relaxed text-[11px]">{fact}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground space-y-1">
                <ShieldCheck className="w-6 h-6 mx-auto opacity-50 mb-2" />
                <p>No ground truths established yet.</p>
                <p className="text-[11px] opacity-75">
                  As the narrative progresses, facts extracted by the evaluation agent will persist here.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'generation' && session && (
          <div className="p-3 space-y-3 text-xs">
            <div className="pb-1 border-b border-border/60 text-[10px] text-muted-foreground uppercase font-mono">
              Runtime Generation Parameters
            </div>

            <div className="space-y-2">
              <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                  Temperature
                </span>
                <span className="font-semibold text-foreground text-xs font-mono">
                  {session.temperature ?? 0.7}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                  Max Tokens per Turn
                </span>
                <span className="font-semibold text-foreground text-xs font-mono">
                  {session.max_tokens ?? 2048}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                  Token Budget & Consumption
                </span>
                <span className="font-semibold text-foreground text-xs font-mono">
                  {session.tokens_used.toLocaleString()} / {session.token_budget ? session.token_budget.toLocaleString() : 'Unlimited'} tokens
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                  Inference Provider
                </span>
                <span className="font-semibold text-foreground text-xs font-mono">
                  {session.inference_provider_id || activeProviderId || 'Global Default'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                  Inference Model
                </span>
                <span className="font-semibold text-foreground text-xs font-mono">
                  {session.inference_model || activeModel || 'Global Default'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
