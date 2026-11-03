import React from 'react'
import { FolderKanban, Database, MessageSquareCode, GitCompare, Calendar } from 'lucide-react'

interface ProjectInspectorProps {
  data: any
}

export const ProjectInspector: React.FC<ProjectInspectorProps> = ({ data }) => {
  if (!data) return null

  return (
    <div className="space-y-4 text-xs">
      <div className="p-3 rounded-xl border border-border bg-card/60 space-y-1.5">
        <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-primary/20 text-primary">
          Active Workspace Project
        </span>
        <h4 className="font-semibold text-foreground text-sm truncate">{data.name}</h4>
        {data.description && <p className="text-[11px] text-muted-foreground">{data.description}</p>}
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Corpus Statistics
        </span>
        <div className="rounded-lg border border-border bg-secondary/30 divide-y divide-border/60">
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">SFT Records</span>
            <span className="font-semibold text-foreground font-mono">{data.sft_record_count || 0}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">DPO Tasks</span>
            <span className="font-semibold text-foreground font-mono">{data.dpo_task_count || 0}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Active Drafts</span>
            <span className="font-semibold text-foreground font-mono">{data.active_draft_count || 0}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Database Information
        </span>
        <div className="rounded-lg border border-border bg-secondary/30 p-2.5 space-y-1.5 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Engine:</span>
            <span className="text-foreground">SQLite WAL Mode</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span className="text-foreground">
              {data.created_at ? new Date(data.created_at).toLocaleDateString() : 'Initial'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
