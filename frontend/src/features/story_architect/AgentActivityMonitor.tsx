import React, { useState } from 'react'
import {
  ShieldCheck,
  TrendingUp,
  Award,
  AlertTriangle,
  Cpu,
  BrainCircuit,
  Bot,
  Compass,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Check,
  Loader2
} from 'lucide-react'
import type { AgentEvaluation, StorySession } from '../../types/story_architect'
import type { Provider } from '../../types'

interface AgentActivityMonitorProps {
  evaluation: AgentEvaluation | null
  session: StorySession | null
  providers?: Provider[]
  onUpdateAgent?: (agent: 'planning' | 'inference' | 'evaluation', providerId: string, model: string) => Promise<void>
  onRefreshProvider?: (providerId: string) => Promise<void>
  executingAgent?: 'planning' | 'inference' | 'evaluation' | null
  logs?: string[]
}

export const AgentActivityMonitor: React.FC<AgentActivityMonitorProps> = ({
  evaluation,
  session,
  providers = [],
  onUpdateAgent,
  onRefreshProvider,
  executingAgent = null,
  logs = []
}) => {
  const [refreshingProviderId, setRefreshingProviderId] = useState<string | null>(null)
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null)

  const handleProviderChange = async (agent: 'planning' | 'inference' | 'evaluation', newProviderId: string) => {
    if (!onUpdateAgent || !session) return
    const p = providers.find(item => item.id === newProviderId)
    const newModel = p?.default_model || (p?.models_cache && p.models_cache[0]) || 'default'
    await onUpdateAgent(agent, newProviderId, newModel)
    triggerSavedFeedback(agent)
  }

  const handleModelChange = async (agent: 'planning' | 'inference' | 'evaluation', newModel: string) => {
    if (!onUpdateAgent || !session) return
    const currentProviderId = agent === 'planning'
      ? (session.planning_provider_id || 'mock')
      : agent === 'inference'
        ? (session.inference_provider_id || 'mock')
        : (session.evaluation_provider_id || 'mock')

    await onUpdateAgent(agent, currentProviderId, newModel)
    triggerSavedFeedback(agent)
  }

  const handleRefresh = async (providerId: string) => {
    if (!onRefreshProvider) return
    setRefreshingProviderId(providerId)
    try {
      await onRefreshProvider(providerId)
    } finally {
      setRefreshingProviderId(null)
    }
  }

  const triggerSavedFeedback = (agent: string) => {
    setSavedFeedback(agent)
    setTimeout(() => {
      setSavedFeedback(null)
    }, 2000)
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.85) return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
    if (score >= 0.70) return 'text-sky-400 bg-sky-950/40 border-sky-800/40'
    return 'text-rose-400 bg-rose-950/40 border-rose-800/40'
  }

  const getProgressBarColor = (score: number) => {
    if (score >= 0.85) return 'bg-emerald-500'
    if (score >= 0.70) return 'bg-sky-500'
    return 'bg-rose-500'
  }

  // Agent selector configuration item
  const renderAgentRow = (
    agentKey: 'planning' | 'inference' | 'evaluation',
    label: string,
    Icon: React.ElementType,
    accentColor: string,
    currentProviderId: string | undefined,
    currentModel: string | undefined
  ) => {
    const activeProvider = providers.find(p => p.id === currentProviderId) || providers[0]
    const pId = activeProvider?.id || currentProviderId || 'mock'

    const activeModel = currentModel || activeProvider?.default_model || (activeProvider?.models_cache && activeProvider.models_cache[0]) || 'default'

    const availableModels = activeProvider?.models_cache && activeProvider.models_cache.length > 0
      ? activeProvider.models_cache
      : [activeModel]

    // If current model is not in available models, include it so selection is never lost
    const finalModelList = currentModel && !availableModels.includes(currentModel)
      ? [currentModel, ...availableModels]
      : availableModels
    const isExecuting = executingAgent === agentKey
    const isRefreshing = refreshingProviderId === pId
    const isModelCached = activeProvider?.models_cache?.includes(activeModel) || pId === 'mock'

    return (
      <div className={`p-2 rounded-lg border transition-all ${
        isExecuting
          ? 'bg-primary/10 border-primary shadow-xs'
          : 'bg-secondary/40 border-border/50 hover:border-border'
      }`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 font-medium text-foreground text-xs">
            <Icon className={`w-3.5 h-3.5 ${accentColor}`} />
            <span>{label}</span>
          </span>

          <div className="flex items-center gap-1.5">
            {/* Status indicators */}
            {isExecuting ? (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-primary/20 text-primary border border-primary/30 flex items-center gap-1 animate-pulse">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                <span>Running</span>
              </span>
            ) : !isModelCached && pId !== 'mock' ? (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5" title="Model not yet detected in provider cache">
                <AlertCircle className="w-2.5 h-2.5" />
                <span>Unverified</span>
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Ready</span>
              </span>
            )}

            {/* Refresh Provider Models Button */}
            <button
              type="button"
              onClick={() => handleRefresh(pId)}
              disabled={isRefreshing}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title={`Refresh models for ${activeProvider?.name || pId}`}
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
        </div>

        {/* Interactive Provider & Model Selectors */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          {/* Provider Selector */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] uppercase font-mono text-muted-foreground">Provider</label>
            <select
              value={pId}
              onChange={e => handleProviderChange(agentKey, e.target.value)}
              disabled={!session || !onUpdateAgent}
              className="w-full px-2 py-1 rounded bg-background/80 border border-border text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary truncate cursor-pointer disabled:opacity-50"
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] uppercase font-mono text-muted-foreground">Model</label>
            <select
              value={activeModel}
              onChange={e => handleModelChange(agentKey, e.target.value)}
              disabled={!session || !onUpdateAgent}
              className="w-full px-2 py-1 rounded bg-background/80 border border-border font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary truncate cursor-pointer disabled:opacity-50"
            >
              {finalModelList.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3.5 text-xs select-none overflow-y-auto max-h-full">
      {/* Tri-Model Provenance Panel */}
      <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase font-mono tracking-wider">
            Tri-Agent Model Configuration
          </h4>
          {savedFeedback && (
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 animate-fade-in">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {renderAgentRow(
            'planning',
            'Planning Agent',
            Compass,
            'text-primary',
            session?.planning_provider_id,
            session?.planning_model
          )}

          {renderAgentRow(
            'inference',
            'Inference Model',
            Bot,
            'text-sky-400',
            session?.inference_provider_id,
            session?.inference_model
          )}

          {renderAgentRow(
            'evaluation',
            'Evaluation Agent',
            BrainCircuit,
            'text-emerald-400',
            session?.evaluation_provider_id,
            session?.evaluation_model
          )}
        </div>
      </div>

      {/* Latest Evaluation Metrics */}
      {evaluation ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Turn #{evaluation.turn_index} Evaluation</span>
            </h4>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border bg-secondary/60 text-foreground">
              {evaluation.next_recommended_action.replace('_', ' ')}
            </span>
          </div>

          {/* Metric Gauges */}
          <div className="space-y-2">
            {/* Consistency */}
            <div className="p-2 rounded-lg border border-border bg-card/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-primary" /> Persona & Setting Consistency
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${getScoreColor(evaluation.consistency_score)}`}>
                  {(evaluation.consistency_score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressBarColor(evaluation.consistency_score)}`}
                  style={{ width: `${evaluation.consistency_score * 100}%` }}
                />
              </div>
              {evaluation.consistency_details && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  {evaluation.consistency_details}
                </p>
              )}
            </div>

            {/* Progress */}
            <div className="p-2 rounded-lg border border-border bg-card/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-sky-400" /> Objective Progress
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${getScoreColor(evaluation.progress_score)}`}>
                  {(evaluation.progress_score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressBarColor(evaluation.progress_score)}`}
                  style={{ width: `${evaluation.progress_score * 100}%` }}
                />
              </div>
              {evaluation.progress_details && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  {evaluation.progress_details}
                </p>
              )}
            </div>

            {/* Quality */}
            <div className="p-2 rounded-lg border border-border bg-card/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                  <Award className="w-3 h-3 text-emerald-400" /> Synthesis & Depth Quality
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${getScoreColor(evaluation.quality_score)}`}>
                  {(evaluation.quality_score * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressBarColor(evaluation.quality_score)}`}
                  style={{ width: `${evaluation.quality_score * 100}%` }}
                />
              </div>
              {evaluation.quality_details && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  {evaluation.quality_details}
                </p>
              )}
            </div>
          </div>

          {/* Contradiction & Repetition Alerts */}
          {evaluation.detected_contradictions.length > 0 ? (
            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Contradictions Detected</span>
              </div>
              <ul className="list-disc list-inside text-[10px] space-y-0.5">
                {evaluation.detected_contradictions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>No narrative contradictions detected.</span>
            </div>
          )}

          {evaluation.repetition_detected && (
            <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-900/50 text-amber-300 text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Repetitive phrasing or circular argumentation flagged.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 text-center text-muted-foreground text-[11px] border border-dashed border-border rounded-lg">
          Evaluation agent will analyze assistant turns automatically upon arrival.
        </div>
      )}
      {/* Execution Cycle Logs */}
      <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase font-mono tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <span>Agent Cycle Logs</span>
          </h4>
          <span className="text-[10px] font-mono text-muted-foreground">
            {logs.length} entries
          </span>
        </div>
        <div className="max-h-48 overflow-y-auto rounded bg-secondary/50 p-2 font-mono text-[10px] space-y-1 border border-border/50">
          {logs.length > 0 ? (
            logs.map((log, idx) => (
              <div key={idx} className="leading-tight text-foreground/80 break-words">
                <span className="text-muted-foreground mr-1">›</span>
                {log}
              </div>
            ))
          ) : (
            <div className="text-muted-foreground text-center py-2">
              No cycle logs recorded yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
