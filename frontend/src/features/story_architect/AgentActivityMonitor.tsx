import React from 'react'
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
  AlertCircle
} from 'lucide-react'
import type { AgentEvaluation, StorySession } from '../../types/story_architect'

interface AgentActivityMonitorProps {
  evaluation: AgentEvaluation | null
  session: StorySession | null
  logs?: string[]
}

export const AgentActivityMonitor: React.FC<AgentActivityMonitorProps> = ({ evaluation, session, logs = [] }) => {
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

  return (
    <div className="p-3 space-y-3.5 text-xs select-none overflow-y-auto max-h-full">
      {/* Tri-Model Provenance Panel */}
      <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-2">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase font-mono tracking-wider">
          Tri-Agent Model Configuration
        </h4>
        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          <div className="flex items-center justify-between p-1.5 rounded bg-secondary/40 border border-border/40">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Compass className="w-3.5 h-3.5 text-primary" />
              <span>Planning Agent</span>
            </span>
            <span className="font-mono text-foreground font-medium truncate max-w-[140px]">
              {session?.planning_model || 'default'}
            </span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded bg-secondary/40 border border-border/40">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Bot className="w-3.5 h-3.5 text-sky-400" />
              <span>Inference Model</span>
            </span>
            <span className="font-mono text-foreground font-medium truncate max-w-[140px]">
              {session?.inference_model || 'default'}
            </span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded bg-secondary/40 border border-border/40">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
              <span>Evaluation Agent</span>
            </span>
            <span className="font-mono text-foreground font-medium truncate max-w-[140px]">
              {session?.evaluation_model || 'default'}
            </span>
          </div>
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
