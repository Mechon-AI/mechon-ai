import React from 'react'
import {
  Sparkles,
  BookOpen,
  Users,
  Compass,
  Layers,
  Flag,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  UserCheck,
  ChevronRight,
  ShieldAlert,
  Bot
} from 'lucide-react'
import type {
  StorySession,
  CreateStorySessionInput,
  PlanningSpecification,
  PlanningMilestone,
  StoryMessage,
  CharacterProfile,
  SaveMilestoneInput
} from '../../types/story_architect'
import { StorySessionList } from './StorySessionList'
import { StoryTimeline } from './StoryTimeline'
import { useStoryWorkspaceStore, StoryLeftTab } from './useStoryWorkspaceStore'

interface StoryLeftDockProps {
  sessions: StorySession[]
  activeSession: StorySession | null
  spec: PlanningSpecification | null
  milestones: PlanningMilestone[]
  messages: StoryMessage[]
  loadingSessions: boolean
  onSelectSession: (id: string) => void
  onCreateSession: (input: CreateStorySessionInput) => Promise<void>
  onDeleteSession: (id: string) => Promise<void>
  onSaveMilestones: (milestones: SaveMilestoneInput[]) => Promise<void>
  savingMilestones: boolean
  onAddCharacter?: (char: CharacterProfile) => void
}

export const StoryLeftDock: React.FC<StoryLeftDockProps> = ({
  sessions,
  activeSession,
  spec,
  milestones,
  messages,
  loadingSessions,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onSaveMilestones,
  savingMilestones,
  onAddCharacter
}) => {
  const { layout, setLeftTab } = useStoryWorkspaceStore()
  const activeTab = layout.leftActiveTab

  const characters = spec?.character_profiles || []

  return (
    <div className="flex flex-col h-full bg-card/40 select-none overflow-hidden border-r border-border">
      {/* 1. Tab Strip */}
      <div className="h-8 px-1.5 border-b border-border flex items-center gap-1 bg-card/80 shrink-0 text-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setLeftTab('scenarios')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
            activeTab === 'scenarios'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Scenarios list"
        >
          <BookOpen className="w-3 h-3 text-primary" />
          <span>Scenarios</span>
        </button>

        <button
          onClick={() => setLeftTab('hierarchy')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
            activeTab === 'hierarchy'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Conversation Hierarchy Outline"
        >
          <Layers className="w-3 h-3 text-sky-400" />
          <span>Hierarchy ({messages.length})</span>
        </button>

        <button
          onClick={() => setLeftTab('characters')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
            activeTab === 'characters'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Cast & Characters"
        >
          <Users className="w-3 h-3 text-emerald-400" />
          <span>Cast ({characters.length})</span>
        </button>

        <button
          onClick={() => setLeftTab('phases')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
            activeTab === 'phases'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Milestone Phases"
        >
          <Flag className="w-3 h-3 text-amber-400" />
          <span>Phases ({milestones.length})</span>
        </button>

        <button
          onClick={() => setLeftTab('objectives')}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
            activeTab === 'objectives'
              ? 'bg-secondary text-foreground font-semibold shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Narrative Objectives"
        >
          <Target className="w-3 h-3 text-rose-400" />
          <span>Objectives</span>
        </button>
      </div>

      {/* 2. Dock Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'scenarios' && (
          <StorySessionList
            sessions={sessions}
            activeSessionId={activeSession?.id || null}
            onSelectSession={onSelectSession}
            onCreateSession={onCreateSession}
            onDeleteSession={onDeleteSession}
            loading={loadingSessions}
          />
        )}

        {activeTab === 'hierarchy' && (
          <div className="p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-border/60 text-[10px] text-muted-foreground uppercase font-mono">
              <span>Turn Sequence</span>
              <span>{messages.length} messages</span>
            </div>

            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-xs">
                No conversation turns yet.
              </p>
            ) : (
              <div className="space-y-1">
                {messages.map((m) => {
                  const isUser = m.role === 'user'
                  return (
                    <div
                      key={m.id}
                      className={`p-2 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
                        isUser
                          ? 'bg-secondary/40 border-border/80'
                          : 'bg-card/80 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isUser ? (
                          <div className="w-5 h-5 rounded bg-primary/20 text-primary flex items-center justify-center shrink-0 text-[10px] font-bold">
                            U
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 text-[10px] font-bold">
                            A
                          </div>
                        )}
                        <div className="truncate">
                          <span className="font-semibold block text-[11px] truncate">
                            Turn {m.turn_index}: {isUser ? 'Prompt' : 'Response'}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate block max-w-[160px]">
                            {m.content}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-muted-foreground">
                        {m.token_count > 0 && <span>{m.token_count}t</span>}
                        {m.is_outdated && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Outdated" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'characters' && (
          <div className="p-3 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-border/60 text-[10px] text-muted-foreground uppercase font-mono">
              <span>Cast & Dramatis Personae</span>
              <span>{characters.length} characters</span>
            </div>

            {characters.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground space-y-2">
                <Users className="w-6 h-6 mx-auto opacity-50" />
                <p>No characters defined in planning spec.</p>
                <p className="text-[11px] opacity-75">
                  Define characters in the Planning Spec inspector to see their roles here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {characters.map((c, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground text-xs">{c.name}</span>
                      <span className="px-1.5 py-0.2 rounded bg-secondary text-[10px] font-mono text-muted-foreground">
                        {c.role || 'Supporting'}
                      </span>
                    </div>

                    {c.personality && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        <strong className="text-foreground/80 font-normal">Personality:</strong>{' '}
                        {c.personality}
                      </p>
                    )}

                    {c.relationship_to_assistant && (
                      <p className="text-[10px] text-muted-foreground/90 font-mono">
                        Relation: {c.relationship_to_assistant}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'phases' && (
          <div className="h-full flex flex-col">
            <StoryTimeline
              milestones={milestones}
              onSaveMilestones={onSaveMilestones}
              saving={savingMilestones}
            />
          </div>
        )}

        {activeTab === 'objectives' && (
          <div className="p-3 space-y-3 text-xs">
            <div className="pb-1 border-b border-border/60 text-[10px] text-muted-foreground uppercase font-mono">
              Narrative Objectives & Stakes
            </div>

            {spec ? (
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
                  <span className="text-[10px] font-semibold text-primary uppercase font-mono block">
                    Core Premise
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {spec.premise || 'No premise specified.'}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
                  <span className="text-[10px] font-semibold text-rose-400 uppercase font-mono block">
                    Main Conflict
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {spec.main_conflict || 'No main conflict specified.'}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase font-mono block">
                    Forbidden / Constraints
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {spec.constraints_forbidden_developments || 'No strict constraints specified.'}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase font-mono block">
                    Desired Ending
                  </span>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {spec.desired_ending || 'Open-ended narrative progression.'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6">
                No active planning spec loaded.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
