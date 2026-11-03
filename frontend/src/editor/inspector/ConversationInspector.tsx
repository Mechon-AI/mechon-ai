import React from 'react'
import { MessageSquareCode, Globe, CheckCircle2, Cpu } from 'lucide-react'

interface ConversationInspectorProps {
  data: any
}

export const ConversationInspector: React.FC<ConversationInspectorProps> = ({ data }) => {
  if (!data) return null

  return (
    <div className="space-y-4 text-xs">
      <div className="p-3 rounded-xl border border-border bg-card/60 space-y-1.5">
        <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-primary/20 text-primary">
          SFT Conversation Draft
        </span>
        <h4 className="font-semibold text-foreground text-sm truncate">{data.title || 'Untitled Session'}</h4>
        <div className="text-[10px] font-mono text-muted-foreground truncate">ID: {data.id}</div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          System Instructions
        </span>
        <div className="p-2.5 rounded-lg border border-border bg-secondary/30 text-[11px] font-mono text-foreground max-h-32 overflow-y-auto">
          {data.system_prompt || 'Standard AI dataset engineering prompt.'}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Conversation Metrics
        </span>
        <div className="rounded-lg border border-border bg-secondary/30 divide-y divide-border/60">
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Total Turns</span>
            <span className="font-semibold text-foreground font-mono">{data.messages?.length || data.message_count || 0}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Primary Language</span>
            <span className="font-semibold text-foreground font-mono">{data.primary_language || 'en'}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Translation Status</span>
            <span className="font-semibold text-foreground font-mono">
              {data.has_translations ? 'Bilingual Ready' : 'Single Language'}
            </span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Schema Quality</span>
            <span className="text-emerald-400 font-semibold font-mono flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Valid Alternation
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
