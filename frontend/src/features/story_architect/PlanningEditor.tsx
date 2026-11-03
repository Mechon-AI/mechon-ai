import React, { useState, useEffect } from 'react'
import {
  Save,
  Plus,
  Trash2,
  Users,
  Compass,
  AlertOctagon,
  Bot,
  Target,
  Sparkles,
  Layers,
  Check
} from 'lucide-react'
import type { PlanningSpecification, CharacterProfile, SavePlanningSpecInput } from '../../types/story_architect'

interface PlanningEditorProps {
  spec: PlanningSpecification
  onSaveSpec: (input: SavePlanningSpecInput) => Promise<void>
  saving: boolean
}

export const PlanningEditor: React.FC<PlanningEditorProps> = ({ spec, onSaveSpec, saving }) => {
  const [activeTab, setActiveTab] = useState<'narrative' | 'characters' | 'objectives' | 'behavior'>('narrative')
  const [premise, setPremise] = useState(spec.premise || '')
  const [worldEnvironment, setWorldEnvironment] = useState(spec.world_environment || '')
  const [mainConflict, setMainConflict] = useState(spec.main_conflict || '')
  const [secondaryConflicts, setSecondaryConflicts] = useState(spec.secondary_conflicts || '')
  const [desiredEnding, setDesiredEnding] = useState(spec.desired_ending || '')
  const [constraints, setConstraints] = useState(spec.constraints_forbidden_developments || '')
  const [expectedBehavior, setExpectedBehavior] = useState(spec.expected_assistant_behavior || '')
  const [qualityRequirements, setQualityRequirements] = useState(spec.quality_requirements || '')
  const [completionCriteria, setCompletionCriteria] = useState(spec.completion_criteria || '')
  const [characters, setCharacters] = useState<CharacterProfile[]>(spec.character_profiles || [])
  const [isDirty, setIsDirty] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    setPremise(spec.premise || '')
    setWorldEnvironment(spec.world_environment || '')
    setMainConflict(spec.main_conflict || '')
    setSecondaryConflicts(spec.secondary_conflicts || '')
    setDesiredEnding(spec.desired_ending || '')
    setConstraints(spec.constraints_forbidden_developments || '')
    setExpectedBehavior(spec.expected_assistant_behavior || '')
    setQualityRequirements(spec.quality_requirements || '')
    setCompletionCriteria(spec.completion_criteria || '')
    setCharacters(spec.character_profiles || [])
    setIsDirty(false)
  }, [spec])

  const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<any>>, val: any) => {
    setter(val)
    setIsDirty(true)
  }

  const handleAddCharacter = () => {
    const newChar: CharacterProfile = {
      name: `Character ${characters.length + 1}`,
      role: 'Supporting',
      personality: 'Distinctive voice and point of view.'
    }
    setCharacters([...characters, newChar])
    setIsDirty(true)
  }

  const handleRemoveCharacter = (idx: number) => {
    setCharacters(characters.filter((_, i) => i !== idx))
    setIsDirty(true)
  }

  const handleUpdateCharacter = (idx: number, field: keyof CharacterProfile, value: string) => {
    const updated = [...characters]
    updated[idx] = { ...updated[idx], [field]: value }
    setCharacters(updated)
    setIsDirty(true)
  }

  const handleSave = async () => {
    await onSaveSpec({
      session_id: spec.session_id,
      premise,
      world_environment: worldEnvironment,
      main_conflict: mainConflict,
      secondary_conflicts: secondaryConflicts,
      desired_ending: desiredEnding,
      constraints_forbidden_developments: constraints,
      expected_assistant_behavior: expectedBehavior,
      quality_requirements: qualityRequirements,
      completion_criteria: completionCriteria,
      character_profiles: characters
    })
    setIsDirty(false)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-card/20 border-b border-border">
      {/* Tab Navigation & Save Bar */}
      <div className="px-3 py-1 border-b border-border flex items-center justify-between bg-card/60 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('narrative')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
              activeTab === 'narrative'
                ? 'bg-secondary text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Compass className="w-3 h-3 text-primary" />
            <span>Premise & Setting</span>
          </button>

          <button
            onClick={() => setActiveTab('characters')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
              activeTab === 'characters'
                ? 'bg-secondary text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3 h-3 text-primary" />
            <span>Characters ({characters.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('objectives')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
              activeTab === 'objectives'
                ? 'bg-secondary text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Target className="w-3 h-3 text-primary" />
            <span>Objectives</span>
          </button>

          <button
            onClick={() => setActiveTab('behavior')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
              activeTab === 'behavior'
                ? 'bg-secondary text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bot className="w-3 h-3 text-primary" />
            <span>Persona & Rules</span>
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all shadow-sm ${
            justSaved
              ? 'bg-emerald-600 text-white'
              : isDirty
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
              : 'bg-secondary/60 text-muted-foreground cursor-not-allowed'
          }`}
        >
          {justSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span>{saving ? 'Saving...' : justSaved ? 'Saved' : isDirty ? 'Save Plan' : 'Plan Synced'}</span>
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="p-4 overflow-y-auto flex-1 space-y-4">
        {activeTab === 'narrative' && (
          <div className="space-y-4 max-w-4xl">
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1">
                <span>Core Premise & Scenario Foundation</span>
                <span className="text-[10px] text-muted-foreground font-normal">Informs prompt generation agent</span>
              </label>
              <textarea
                rows={3}
                value={premise}
                onChange={e => handleFieldChange(setPremise, e.target.value)}
                placeholder="Describe the underlying premise, scenario, or inquiry..."
                className="w-full text-xs p-3 rounded-lg bg-card/60 border border-border focus:ring-1 focus:ring-primary focus:outline-none text-foreground leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                World Context & Environment
              </label>
              <textarea
                rows={3}
                value={worldEnvironment}
                onChange={e => handleFieldChange(setWorldEnvironment, e.target.value)}
                placeholder="Physical setting, sensory atmosphere, historical context, or system domain..."
                className="w-full text-xs p-3 rounded-lg bg-card/60 border border-border focus:ring-1 focus:ring-primary focus:outline-none text-foreground leading-relaxed"
              />
            </div>
          </div>
        )}

        {activeTab === 'characters' && (
          <div className="space-y-3 max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-foreground">Dramatis Personae / Interlocutor Profiles</h4>
                <p className="text-[11px] text-muted-foreground">Define participants, roles, and behavioral styles.</p>
              </div>
              <button
                onClick={handleAddCharacter}
                className="flex items-center gap-1 text-xs text-primary hover:bg-primary/10 border border-primary/30 px-2.5 py-1 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Character</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {characters.map((char, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border bg-card/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={char.name}
                      onChange={e => handleUpdateCharacter(idx, 'name', e.target.value)}
                      placeholder="Character Name"
                      className="text-xs font-semibold bg-transparent border-b border-border/80 pb-0.5 focus:outline-none focus:border-primary text-foreground w-2/3"
                    />
                    <button
                      onClick={() => handleRemoveCharacter(idx)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Role</span>
                      <input
                        type="text"
                        value={char.role}
                        onChange={e => handleUpdateCharacter(idx, 'role', e.target.value)}
                        placeholder="Protagonist, Informant, Tutor"
                        className="w-full text-xs p-1.5 rounded bg-secondary/50 border border-border/60 text-foreground"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Relation to Assistant</span>
                      <input
                        type="text"
                        value={char.relationship_to_assistant || ''}
                        onChange={e => handleUpdateCharacter(idx, 'relationship_to_assistant', e.target.value)}
                        placeholder="Adversary, Colleague, Mentor"
                        className="w-full text-xs p-1.5 rounded bg-secondary/50 border border-border/60 text-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground block">Persona & Behavioral Invariants</span>
                    <textarea
                      rows={2}
                      value={char.personality}
                      onChange={e => handleUpdateCharacter(idx, 'personality', e.target.value)}
                      placeholder="Distinctive speech patterns, motivations, psychological traits..."
                      className="w-full text-xs p-1.5 rounded bg-secondary/50 border border-border/60 text-foreground resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'objectives' && (
          <div className="space-y-4 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Central Tension / Main Conflict
                </label>
                <textarea
                  rows={3}
                  value={mainConflict}
                  onChange={e => handleFieldChange(setMainConflict, e.target.value)}
                  placeholder="Primary challenge, technical paradox, or dramatic obstacle..."
                  className="w-full text-xs p-3 rounded-lg bg-card/60 border border-border focus:ring-1 focus:ring-primary focus:outline-none text-foreground leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Secondary Friction / Sub-plots
                </label>
                <textarea
                  rows={3}
                  value={secondaryConflicts}
                  onChange={e => handleFieldChange(setSecondaryConflicts, e.target.value)}
                  placeholder="Supporting tensions, hidden agendas, or secondary constraints..."
                  className="w-full text-xs p-3 rounded-lg bg-card/60 border border-border focus:ring-1 focus:ring-primary focus:outline-none text-foreground leading-relaxed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Desired Ending / Target Climax
                </label>
                <textarea
                  rows={2}
                  value={desiredEnding}
                  onChange={e => handleFieldChange(setDesiredEnding, e.target.value)}
                  placeholder="Intended synthesis or outcome state..."
                  className="w-full text-xs p-3 rounded-lg bg-card/60 border border-border focus:ring-1 focus:ring-primary focus:outline-none text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Completion Criteria
                </label>
                <textarea
                  rows={2}
                  value={completionCriteria}
                  onChange={e => handleFieldChange(setCompletionCriteria, e.target.value)}
                  placeholder="Objective condition under which the scenario is marked complete..."
                  className="w-full text-xs p-3 rounded-lg bg-card/60 border border-border focus:ring-1 focus:ring-primary focus:outline-none text-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'behavior' && (
          <div className="space-y-4 max-w-4xl">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Expected Assistant Voice & System Invariants
              </label>
              <textarea
                rows={3}
                value={expectedBehavior}
                onChange={e => handleFieldChange(setExpectedBehavior, e.target.value)}
                placeholder="Injected into inference context: tone, depth, style, and persona guidelines..."
                className="w-full text-xs p-3 rounded-lg bg-card/60 border border-border focus:ring-1 focus:ring-primary focus:outline-none text-foreground leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 mb-1">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Forbidden Developments & Hard Guardrails</span>
              </label>
              <textarea
                rows={3}
                value={constraints}
                onChange={e => handleFieldChange(setConstraints, e.target.value)}
                placeholder="Explicitly forbidden plot developments, tonal shifts, or out-of-domain answers..."
                className="w-full text-xs p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 focus:ring-1 focus:ring-rose-500 focus:outline-none text-foreground leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
