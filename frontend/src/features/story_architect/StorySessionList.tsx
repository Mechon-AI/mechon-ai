import React, { useState } from 'react'
import {
  Sparkles,
  Plus,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  ChevronRight,
  BookOpen,
  Users,
  Cpu,
  GraduationCap,
  Briefcase,
  Scale,
  Headphones,
  Sliders,
  X
} from 'lucide-react'
import type { StorySession, CreateStorySessionInput, InteractionType } from '../../types/story_architect'
import { STORY_TEMPLATES } from './templates'

interface StorySessionListProps {
  sessions: StorySession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onCreateSession: (input: CreateStorySessionInput) => Promise<void>
  onDeleteSession: (id: string) => Promise<void>
  loading: boolean
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  storytelling: BookOpen,
  interactive_roleplay: Users,
  technical_discussion: Cpu,
  educational_tutoring: GraduationCap,
  interview_simulation: Briefcase,
  debate: Scale,
  customer_support_simulation: Headphones,
  custom: Sliders
}

export const StorySessionList: React.FC<StorySessionListProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  loading
}) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('storytelling')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [executionMode, setExecutionMode] = useState<'manual' | 'hybrid' | 'auto_allow'>('manual')
  const [targetTurns, setTargetTurns] = useState(8)
  const [submitting, setSubmitting] = useState(false)

  const handleOpenModal = () => {
    const t = STORY_TEMPLATES.find(x => x.id === selectedTemplate)
    setTitle(t ? `${t.title} Scenario` : 'New Conversation Scenario')
    setDescription(t?.description ?? '')
    setModalOpen(true)
  }

  const handleTemplateSelect = (tmplId: string) => {
    setSelectedTemplate(tmplId)
    const t = STORY_TEMPLATES.find(x => x.id === tmplId)
    if (t) {
      setTitle(`${t.title} Scenario`)
      setDescription(t.description)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || submitting) return
    setSubmitting(true)
    try {
      await onCreateSession({
        project_id: '', // filled by view
        title: title.trim(),
        description: description.trim() || undefined,
        interaction_type: selectedTemplate,
        target_turns: targetTurns,
        execution_mode: executionMode,
        primary_language: 'en'
      })
      setModalOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        )
      case 'in_progress':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-sky-400 bg-sky-950/40 border border-sky-800/40 px-2 py-0.5 rounded-full">
            <Play className="w-3 h-3" /> In Progress
          </span>
        )
      case 'paused':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-full">
            <Pause className="w-3 h-3" /> Paused
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 bg-zinc-800/40 border border-zinc-700/40 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" /> Draft
          </span>
        )
    }
  }

  return (
    <div className="flex flex-col h-full bg-card/40 border-r border-border select-none">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Story Scenarios
            </h2>
            <p className="text-[10px] text-muted-foreground/80">
              {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-2.5 py-1.5 rounded-md transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading && sessions.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Loading scenarios...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-xs text-muted-foreground">No story sessions found.</p>
            <button
              onClick={handleOpenModal}
              className="text-xs text-primary hover:underline font-medium"
            >
              Create your first plan &rarr;
            </button>
          </div>
        ) : (
          sessions.map(s => {
            const isActive = s.id === activeSessionId
            const IconComp = TYPE_ICONS[s.interaction_type] || BookOpen

            return (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`group relative p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  isActive
                    ? 'bg-accent/60 border-primary/50 shadow-sm'
                    : 'bg-card/30 border-border/60 hover:bg-card/70 hover:border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <IconComp className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-xs font-medium truncate text-foreground">
                      {s.title || 'Untitled Scenario'}
                    </span>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (confirm(`Delete session "${s.title}"?`)) {
                        onDeleteSession(s.id)
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(s.status)}
                    <span className="capitalize text-[10px] bg-secondary/80 px-1.5 py-0.5 rounded border border-border/40">
                      {s.execution_mode.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono">
                    {s.tokens_used.toLocaleString()} tok
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">New Story Architect Session</h3>
                <p className="text-xs text-muted-foreground">
                  Select an interaction archetype and configure autonomy guardrails.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Archetypes */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-2">
                  Interaction Archetype
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STORY_TEMPLATES.map(t => {
                    const Icon = TYPE_ICONS[t.id] || BookOpen
                    const isSel = selectedTemplate === t.id
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleTemplateSelect(t.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer text-left transition-all ${
                          isSel
                            ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                            : 'bg-card/50 border-border/60 hover:bg-secondary/40 text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-4 h-4 ${isSel ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className="text-xs font-semibold text-foreground">{t.title}</span>
                        </div>
                        <p className="text-[11px] line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Title & Desc */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Scenario Title <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Cyberpunk Noir Investigation"
                    className="w-full text-xs px-3 py-2 rounded-md bg-secondary/40 border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Executive Brief / Narrative Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief description of the context, participants, and goals..."
                    className="w-full text-xs px-3 py-2 rounded-md bg-secondary/40 border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground resize-none"
                  />
                </div>
              </div>

              {/* Execution Mode & Turns */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Supervision Mode
                  </label>
                  <select
                    value={executionMode}
                    onChange={e => setExecutionMode(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-md bg-secondary/40 border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    <option value="manual">Manual Review (Engineer Approves Every Turn)</option>
                    <option value="hybrid">Hybrid (Autonomous with Safety Pauses)</option>
                    <option value="auto_allow">Auto-Allow (Continuous Autonomous Loop)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Target Conversation Turns
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={targetTurns}
                    onChange={e => setTargetTurns(parseInt(e.target.value) || 6)}
                    className="w-full text-xs px-3 py-2 rounded-md bg-secondary/40 border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md border border-border hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="px-4 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Initializing Plan...' : 'Create Scenario Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
