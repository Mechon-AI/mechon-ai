import React, { useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
  Flag,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import type { PlanningMilestone, SaveMilestoneInput } from '../../types/story_architect'

interface StoryTimelineProps {
  milestones: PlanningMilestone[]
  onSaveMilestones: (milestones: SaveMilestoneInput[]) => Promise<void>
  saving: boolean
}

export const StoryTimeline: React.FC<StoryTimelineProps> = ({ milestones, onSaveMilestones, saving }) => {
  const [editing, setEditing] = useState(false)
  const [localMilestones, setLocalMilestones] = useState<PlanningMilestone[]>(milestones)

  React.useEffect(() => {
    setLocalMilestones(milestones)
  }, [milestones])

  const handleAddMilestone = () => {
    const newM: PlanningMilestone = {
      id: `temp-${Date.now()}`,
      session_id: '',
      order_index: localMilestones.length,
      title: `Milestone ${localMilestones.length + 1}`,
      description: 'Milestone objectives and narrative progress.',
      objective: 'Progress toward interaction climax',
      status: localMilestones.length === 0 ? 'active' : 'pending',
      associated_turn_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setLocalMilestones([...localMilestones, newM])
    setEditing(true)
  }

  const handleRemove = (idx: number) => {
    const updated = localMilestones.filter((_, i) => i !== idx).map((m, i) => ({ ...m, order_index: i }))
    setLocalMilestones(updated)
    setEditing(true)
  }

  const handleSave = async () => {
    const inputs: SaveMilestoneInput[] = localMilestones.map((m, i) => ({
      id: m.id.startsWith('temp-') ? undefined : m.id,
      order_index: i,
      title: m.title,
      description: m.description,
      objective: m.objective,
      status: m.status
    }))
    await onSaveMilestones(inputs)
    setEditing(false)
  }

  const handleToggleStatus = (idx: number) => {
    const updated = [...localMilestones]
    const current = updated[idx].status
    const nextStatus = current === 'completed' ? 'active' : current === 'active' ? 'completed' : 'active'
    updated[idx] = { ...updated[idx], status: nextStatus }
    setLocalMilestones(updated)
    setEditing(true)
  }

  return (
    <div className="p-3 border-b border-border bg-card/10 select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Flag className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground tracking-wide uppercase font-mono">
            Milestone Sequence
          </h3>
          <span className="text-[10px] text-muted-foreground font-mono">
            ({localMilestones.filter(m => m.status === 'completed').length}/{localMilestones.length} completed)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {editing && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-[11px] bg-primary text-primary-foreground px-2 py-0.5 rounded font-medium hover:bg-primary/90"
            >
              {saving ? 'Saving...' : 'Save Milestones'}
            </button>
          )}
          <button
            onClick={handleAddMilestone}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border/60 hover:bg-secondary transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Phase
          </button>
        </div>
      </div>

      {/* Horizontal Milestone Ribbon */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
        {localMilestones.map((m, idx) => {
          const isCompleted = m.status === 'completed'
          const isActive = m.status === 'active'

          return (
            <div key={m.id || idx} className="flex items-center gap-2 shrink-0">
              <div
                onClick={() => handleToggleStatus(idx)}
                className={`flex items-start gap-2 p-2 rounded-lg border text-left cursor-pointer transition-all max-w-[200px] ${
                  isCompleted
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                    : isActive
                    ? 'bg-sky-950/30 border-sky-500/50 text-foreground ring-1 ring-sky-500/30 shadow-xs'
                    : 'bg-card/40 border-border/50 text-muted-foreground hover:border-border'
                }`}
                title="Click to toggle completion status"
              >
                <div className="mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isActive ? (
                    <Circle className="w-3.5 h-3.5 text-sky-400 fill-sky-400/20 animate-pulse" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      Phase {idx + 1}
                    </span>
                    {editing && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          handleRemove(idx)
                        }}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs font-semibold truncate leading-tight mt-0.5">
                    {m.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                    {m.objective}
                  </p>
                </div>
              </div>

              {idx < localMilestones.length - 1 && (
                <ArrowRight className="w-3 h-3 text-border shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
