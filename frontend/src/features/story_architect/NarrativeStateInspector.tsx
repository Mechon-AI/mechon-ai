import React from 'react'
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react'
import type { NarrativeState } from '../../types/story_architect'

interface NarrativeStateInspectorProps {
  state: NarrativeState | null
}

export const NarrativeStateInspector: React.FC<NarrativeStateInspectorProps> = ({ state }) => {
  if (!state) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground select-none">
        <Activity className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
        <p>No active narrative state established yet.</p>
        <p className="text-[11px] text-muted-foreground/80 mt-1">State will update automatically with each assistant turn.</p>
      </div>
    )
  }

  const establishedFacts = Array.isArray(state.established_facts) ? state.established_facts : []
  const conflicts = Array.isArray(state.unresolved_conflicts) ? state.unresolved_conflicts : []
  const completedMilestones = Array.isArray(state.completed_milestones) ? state.completed_milestones : []

  return (
    <div className="p-3 space-y-4 text-xs select-none overflow-y-auto max-h-full">
      {/* Overview Status */}
      <div className="p-2.5 rounded-lg border border-border bg-card/60 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase font-mono block">Current Arc</span>
          <span className="text-xs font-semibold text-foreground">
            {state.current_arc || 'Baseline Interaction'}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-muted-foreground uppercase font-mono block">Continuity</span>
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
            {state.continuity_status}
          </span>
        </div>
      </div>

      {/* Pacing / Summary */}
      {state.pacing_summary && (
        <div className="p-2.5 rounded-lg border border-border bg-secondary/30">
          <span className="text-[10px] font-semibold text-primary uppercase font-mono block mb-1">
            Narrative Assessment
          </span>
          <p className="text-xs text-foreground/90 leading-relaxed">
            {state.pacing_summary}
          </p>
        </div>
      )}

      {/* Established Facts */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Established Ground Truths ({establishedFacts.length})</span>
          </h4>
        </div>
        {establishedFacts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No persistent facts established yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {establishedFacts.map((fact, idx) => (
              <li
                key={idx}
                className="p-2 rounded bg-card/40 border border-border/60 text-[11px] text-foreground leading-snug flex items-start gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Unresolved Conflicts */}
      {conflicts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide font-mono flex items-center gap-1.5 mb-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Active Dilemmas ({conflicts.length})</span>
          </h4>
          <ul className="space-y-1.5">
            {conflicts.map((c, idx) => (
              <li
                key={idx}
                className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-[11px] text-amber-200 leading-snug"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Hint */}
      {state.next_objective_hint && (
        <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-[11px]">
          <span className="font-semibold block mb-0.5">Recommended Next Focus:</span>
          <span className="text-foreground/90">{state.next_objective_hint}</span>
        </div>
      )}
    </div>
  )
}
