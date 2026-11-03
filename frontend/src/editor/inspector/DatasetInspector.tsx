import React from 'react'
import { Database, Calendar, Tag, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react'

interface DatasetInspectorProps {
  data: any
}

export const DatasetInspector: React.FC<DatasetInspectorProps> = ({ data }) => {
  if (!data) return null

  const isSft = Array.isArray(data.messages) || data.turns !== undefined
  const turnsCount = data.messages?.length || data.turns || (data.chosen ? 2 : 1)
  const tokenEst = data.token_count || Math.round(JSON.stringify(data).length / 4)

  return (
    <div className="space-y-4 text-xs">
      <div className="p-3 rounded-xl border border-border bg-card/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-primary/20 text-primary">
            {isSft ? 'SFT Record' : 'DPO Preference Pair'}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {data.id?.slice(0, 10) || 'Active'}
          </span>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground truncate">
          ID: {data.id || 'N/A'}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Structural Properties
        </span>
        <div className="rounded-lg border border-border bg-secondary/30 divide-y divide-border/60">
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Turns</span>
            <span className="font-semibold text-foreground font-mono">{turnsCount}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Estimated Tokens</span>
            <span className="font-semibold text-foreground font-mono">~{tokenEst}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Language Pair</span>
            <span className="font-semibold text-foreground font-mono">
              {data.language_pair || data.language || 'en-US'}
            </span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Quality Rating</span>
            <span className="font-semibold text-emerald-400 font-mono">
              {data.quality_rating || data.rating ? `${data.quality_rating || data.rating}/5 ★` : 'Unrated'}
            </span>
          </div>
        </div>
      </div>

      {data.tags && data.tags.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
            Tags & Classifications
          </span>
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((t: string) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-md bg-secondary border border-border text-[10px] font-mono text-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.rationale && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
            DPO Rationale
          </span>
          <div className="p-2.5 rounded-lg border border-border bg-secondary/30 text-xs text-foreground font-sans">
            {data.rationale}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Provenance & Metadata
        </span>
        <div className="rounded-lg border border-border bg-secondary/30 p-2.5 space-y-1.5 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span className="text-foreground">{data.created_at ? new Date(data.created_at).toLocaleDateString() : 'Today'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source:</span>
            <span className="text-foreground">{data.source || 'Native Studio'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Validation:</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Validated
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
