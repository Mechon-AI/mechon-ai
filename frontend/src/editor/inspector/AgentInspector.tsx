import React from 'react'
import { Sparkles, Cpu, Sliders, Shield } from 'lucide-react'

interface AgentInspectorProps {
  data: any
}

export const AgentInspector: React.FC<AgentInspectorProps> = ({ data }) => {
  if (!data) return null

  return (
    <div className="space-y-4 text-xs">
      <div className="p-3 rounded-xl border border-border bg-card/60 space-y-1.5">
        <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-primary/20 text-primary">
          Story Architect Agent
        </span>
        <h4 className="font-semibold text-foreground text-sm truncate">{data.name || 'Architect Agent'}</h4>
        <p className="text-[11px] text-muted-foreground">{data.role || 'Autonomous Narrative & Prompt Engineer'}</p>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Inference & Model Binding
        </span>
        <div className="rounded-lg border border-border bg-secondary/30 divide-y divide-border/60">
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Provider</span>
            <span className="font-semibold text-foreground font-mono">{data.provider || 'Active Provider'}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Model</span>
            <span className="font-semibold text-foreground font-mono">{data.model || 'Auto-routed'}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Temperature</span>
            <span className="font-semibold text-foreground font-mono">{data.temperature ?? 0.7}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Max Tokens</span>
            <span className="font-semibold text-foreground font-mono">{data.max_tokens ?? 2048}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Agent System Instructions
        </span>
        <div className="p-2.5 rounded-lg border border-border bg-secondary/30 text-[11px] font-mono text-muted-foreground max-h-36 overflow-y-auto">
          {data.instructions ||
            'Generate coherent multi-turn roleplay narratives with structured turn goals and character continuity.'}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Execution Policy
        </span>
        <div className="rounded-lg border border-border bg-secondary/30 p-2.5 space-y-1.5 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Retry Policy:</span>
            <span className="text-foreground">Exponential Backoff (3 retries)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Auto-Review:</span>
            <span className="text-emerald-400">Enabled</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate Limit Guard:</span>
            <span className="text-foreground">HTTP 429 Interceptor</span>
          </div>
        </div>
      </div>
    </div>
  )
}
