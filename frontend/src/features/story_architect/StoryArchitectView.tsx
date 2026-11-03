import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sparkles,
  BookOpen,
  Sliders,
  ChevronDown,
  ChevronRight,
  Database,
  RefreshCw,
  Layers,
  Settings2,
  Activity,
  Bot,
  AlertCircle,
  RotateCcw,
  Play,
  Pause,
  Cpu
} from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProviderStore } from '../../stores/useProviderStore'
import { useResizable } from '../../hooks/useResizable'
import { ResizeDivider } from '../../components/common/ResizeDivider'
import type {
  StorySession,
  PlanningSpecification,
  PlanningMilestone,
  StoryMessage,
  PlanningPromptHistory,
  NarrativeState,
  AgentEvaluation,
  CreateStorySessionInput,
  UpdateStorySessionInput,
  AgentRuntimeConfig,
  SavePlanningSpecInput,
  SaveMilestoneInput,
  ExecutionMode,
  AutoStepResult
} from '../../types/story_architect'
import {
  listStorySessions,
  getStorySession,
  createStorySession,
  updateStorySession,
  deleteStorySession,
  getPlanningSpec,
  savePlanningSpec,
  listMilestones,
  saveMilestones,
  listStoryMessages,
  generateNextPrompt,
  approveAndExecuteTurn,
  executeAutonomousStep,
  listPromptHistory,
  getLatestNarrativeState,
  commitStoryToSFT,
  editStoryMessage,
  regenerateStoryTurn,
  restoreMessageRevision,
  testProvider
} from '../../services/api'
import {
  normalizeStorySession,
  normalizePlanningSpec,
  normalizeMilestone
} from '../../utils/engineeringNormalizers'
import { StorySessionList } from './StorySessionList'
import { PlanningEditor } from './PlanningEditor'
import { StoryTimeline } from './StoryTimeline'
import { StoryConversationViewer } from './StoryConversationViewer'
import { PromptWorkbench } from './PromptWorkbench'
import { NarrativeStateInspector } from './NarrativeStateInspector'
import { AgentActivityMonitor } from './AgentActivityMonitor'
import { CommitToSFTModal } from './CommitToSFTModal'

export const StoryArchitectView: React.FC = () => {
  const { activeProjectId } = useProjectStore()
  const {
    providers,
    activeProviderId,
    activeModel,
    setActiveProviderId,
    setActiveModel,
    fetchProviders
  } = useProviderStore()

  // Sessions state
  const [sessions, setSessions] = useState<StorySession[]>([])
  const [activeSession, setActiveSession] = useState<StorySession | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)

  // Active Session Details
  const [spec, setSpec] = useState<PlanningSpecification | null>(null)
  const [milestones, setMilestones] = useState<PlanningMilestone[]>([])
  const [messages, setMessages] = useState<StoryMessage[]>([])
  const [proposedPrompt, setProposedPrompt] = useState<PlanningPromptHistory | null>(null)
  const [narrativeState, setNarrativeState] = useState<NarrativeState | null>(null)
  const [latestEvaluation, setLatestEvaluation] = useState<AgentEvaluation | null>(null)
  const [executionLogs, setExecutionLogs] = useState<string[]>([])

  // State Machine and Loop Controls
  const [stateMachineStage, setStateMachineStage] = useState<string>('idle')
  const [isAutoRunning, setIsAutoRunning] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)

  // UI state
  const [planExpanded, setPlanExpanded] = useState(true)
  const [rightTab, setRightTab] = useState<'narrative' | 'agent'>('narrative')
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
  const [isExecutingTurn, setIsExecutingTurn] = useState(false)
  const [savingSpec, setSavingSpec] = useState(false)
  const [savingMilestones, setSavingMilestones] = useState(false)
  const [pauseReason, setPauseReason] = useState<string | null>(null)

  // Streaming state
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  // Resizable Panels Hook
  const {
    size: scenarioListWidth,
    isDragging: isScenarioDragging,
    handleMouseDown: handleScenarioResize,
    handleDoubleClick: handleScenarioReset,
    resetToDefault: resetScenarioWidth
  } = useResizable({
    key: 'story_scenario_list_width',
    initialSize: 288,
    minSize: 220,
    maxSize: 420
  })

  const {
    size: specEditorHeight,
    isDragging: isSpecDragging,
    handleMouseDown: handleSpecResize,
    handleDoubleClick: handleSpecReset,
    resetToDefault: resetSpecHeight
  } = useResizable({
    key: 'story_spec_editor_height',
    initialSize: 260,
    minSize: 150,
    maxSize: 500,
    direction: 'vertical'
  })

  const {
    size: rightPaneWidth,
    isDragging: isRightPaneDragging,
    handleMouseDown: handleRightPaneResize,
    handleDoubleClick: handleRightPaneReset,
    resetToDefault: resetRightPaneWidth
  } = useResizable({
    key: 'story_right_pane_width',
    initialSize: 340,
    minSize: 280,
    maxSize: 550,
    reverse: true
  })

  const handleResetLayout = () => {
    resetScenarioWidth()
    resetSpecHeight()
    resetRightPaneWidth()
  }

  // Fetch all sessions on mount or when activeProjectId changes
  useEffect(() => {
    if (activeProjectId) {
      loadSessions(activeProjectId)
    }
  }, [activeProjectId])

  // Setup streaming and turn-completed listener when activeSession changes
  useEffect(() => {
    if (!activeSession) return

    let unlistenToken: (() => void) | undefined
    let unlistenDone: (() => void) | undefined
    let unlistenCompleted: (() => void) | undefined
    let unlistenError: (() => void) | undefined

    const setupListeners = async () => {
      unlistenToken = await listen<any>(`story-stream-token-${activeSession.id}`, event => {
        setIsStreaming(true)
        setStreamingContent(event.payload.accumulated || '')
      })

      unlistenDone = await listen<any>(`story-stream-done-${activeSession.id}`, () => {
        setIsStreaming(false)
        // Keep streamingContent intact until story-turn-completed fires!
      })

      unlistenCompleted = await listen<any>(`story-turn-completed-${activeSession.id}`, () => {
        setIsStreaming(false)
        setStreamingContent('')
        loadSessionDetails(activeSession.id)
      })

      unlistenError = await listen<any>(`story-stream-error-${activeSession.id}`, event => {
        setIsStreaming(false)
        setStreamingContent('')
        setExecutionError(event.payload.error || 'Model execution error')
      })
    }

    setupListeners()

    return () => {
      unlistenToken?.()
      unlistenDone?.()
      unlistenCompleted?.()
      unlistenError?.()
    }
  }, [activeSession?.id])

  const loadSessions = async (projId: string) => {
    setLoadingSessions(true)
    try {
      const res = await listStorySessions(projId)
      const normalized = (Array.isArray(res) ? res : []).map(normalizeStorySession)
      setSessions(normalized)
      if (normalized.length > 0 && !activeSession) {
        handleSelectSession(normalized[0].id)
      }
    } catch (err) {
      console.error('Failed to list story sessions:', err)
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleSelectSession = async (sessionId: string) => {
    try {
      setIsAutoRunning(false)
      setExecutionError(null)
      const s = await getStorySession(sessionId)
      const normSession = normalizeStorySession(s)
      setActiveSession(normSession)
      loadSessionDetails(sessionId)
    } catch (err) {
      console.error('Failed to get story session:', err)
    }
  }

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const [specRes, milesRes, msgsRes, historyRes, stateRes] = await Promise.all([
        getPlanningSpec(sessionId).catch(() => null),
        listMilestones(sessionId).catch(() => []),
        listStoryMessages(sessionId).catch(() => []),
        listPromptHistory(sessionId).catch(() => []),
        getLatestNarrativeState(sessionId).catch(() => null)
      ])

      if (specRes) setSpec(normalizePlanningSpec(specRes))
      setMilestones((Array.isArray(milesRes) ? milesRes : []).map(normalizeMilestone))
      setMessages(Array.isArray(msgsRes) ? msgsRes : [])

      const proposed = (Array.isArray(historyRes) ? historyRes : []).find(h => h.status === 'proposed')
      setProposedPrompt(proposed || null)

      if (stateRes) setNarrativeState(stateRes)
    } catch (err) {
      console.error('Failed to load session details:', err)
    }
  }

  const handleCreateSession = async (input: CreateStorySessionInput) => {
    if (!activeProjectId) return
    try {
      const created = await createStorySession({
        ...input,
        project_id: activeProjectId,
        inference_provider_id: activeProviderId || undefined,
        inference_model: activeModel || undefined,
        planning_provider_id: activeProviderId || undefined,
        planning_model: activeModel || undefined,
        evaluation_provider_id: activeProviderId || undefined,
        evaluation_model: activeModel || undefined
      })
      const norm = normalizeStorySession(created)
      setSessions([norm, ...sessions])
      setActiveSession(norm)
      loadSessionDetails(norm.id)
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteStorySession(sessionId)
      const remaining = sessions.filter(s => s.id !== sessionId)
      setSessions(remaining)
      if (activeSession?.id === sessionId) {
        if (remaining.length > 0) {
          handleSelectSession(remaining[0].id)
        } else {
          setActiveSession(null)
          setSpec(null)
          setMilestones([])
          setMessages([])
          setProposedPrompt(null)
          setNarrativeState(null)
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  const handleSaveSpec = async (input: SavePlanningSpecInput) => {
    setSavingSpec(true)
    try {
      const res = await savePlanningSpec(input)
      setSpec(normalizePlanningSpec(res))
    } catch (err) {
      console.error('Failed to save spec:', err)
    } finally {
      setSavingSpec(false)
    }
  }

  const handleSaveMilestones = async (mileInputs: SaveMilestoneInput[]) => {
    if (!activeSession) return
    setSavingMilestones(true)
    try {
      const res = await saveMilestones(activeSession.id, mileInputs)
      setMilestones((Array.isArray(res) ? res : []).map(normalizeMilestone))
    } catch (err) {
      console.error('Failed to save milestones:', err)
    } finally {
      setSavingMilestones(false)
    }
  }

  const handleGenerateNextPrompt = async (feedback?: string) => {
    if (!activeSession) return
    setIsGeneratingPrompt(true)
    setStateMachineStage('planning')
    setExecutionError(null)
    try {
      const planningProvider = activeSession.planning_provider_id || activeSession.planning_agent_config?.provider_id || activeProviderId || undefined
      const planningModel = activeSession.planning_model || activeSession.planning_agent_config?.model_id || activeSession.planning_agent_config?.model || activeModel || undefined
      const p = await generateNextPrompt(
        activeSession.id,
        feedback,
        planningProvider,
        planningModel
      )
      setProposedPrompt(p)
      setPauseReason(null)
      setStateMachineStage('awaiting_approval')
    } catch (err: any) {
      console.error('Failed to generate next prompt:', err)
      setExecutionError(err?.message || String(err))
      setStateMachineStage('error')
    } finally {
      setIsGeneratingPrompt(false)
    }
  }

  const handleApproveAndExecute = async (content: string, promptHistoryId?: string, edited?: boolean) => {
    if (!activeSession) return
    setIsExecutingTurn(true)
    setStateMachineStage('generating')
    setExecutionError(null)
    try {
      const inferenceProvider = activeSession.inference_provider_id || activeSession.inference_agent_config?.provider_id || activeProviderId || undefined
      const inferenceModel = activeSession.inference_model || activeSession.inference_agent_config?.model_id || activeSession.inference_agent_config?.model || activeModel || undefined
      const result: AutoStepResult = await approveAndExecuteTurn(
        activeSession.id,
        content,
        promptHistoryId,
        edited,
        inferenceProvider,
        inferenceModel
      )

      if (result.logs && result.logs.length > 0) {
        setExecutionLogs(prev => [...result.logs, ...prev].slice(0, 50))
      }

      if (result.evaluation) setLatestEvaluation(result.evaluation)
      if (result.narrative_state) setNarrativeState(result.narrative_state)
      if (result.prompt) setProposedPrompt(result.prompt)

      await loadSessionDetails(activeSession.id)
      const updatedS = await getStorySession(activeSession.id)
      setActiveSession(normalizeStorySession(updatedS))

      if (result.action_taken === 'completed') {
        setStateMachineStage('completed')
      } else {
        setStateMachineStage('cycle_completed')
      }
    } catch (err: any) {
      console.error('Failed to execute turn:', err)
      setExecutionError(err?.message || String(err))
      setStateMachineStage('error')
    } finally {
      setIsExecutingTurn(false)
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const handleExecuteAutoStep = async () => {
    if (!activeSession) return
    setIsExecutingTurn(true)
    setStateMachineStage('generating')
    setExecutionError(null)
    try {
      const inferenceProvider = activeSession.inference_provider_id || activeSession.inference_agent_config?.provider_id || activeProviderId || undefined
      const inferenceModel = activeSession.inference_model || activeSession.inference_agent_config?.model_id || activeSession.inference_agent_config?.model || activeModel || undefined
      const result: AutoStepResult = await executeAutonomousStep(
        activeSession.id,
        inferenceProvider,
        inferenceModel
      )

      if (result.logs && result.logs.length > 0) {
        setExecutionLogs(prev => [...result.logs, ...prev].slice(0, 50))
      }

      if (result.pause_reason) {
        setPauseReason(result.pause_reason)
        setIsAutoRunning(false)
        setStateMachineStage('paused')
      } else {
        setPauseReason(null)
      }

      if (result.prompt) setProposedPrompt(result.prompt)
      if (result.evaluation) setLatestEvaluation(result.evaluation)
      if (result.narrative_state) setNarrativeState(result.narrative_state)

      await loadSessionDetails(activeSession.id)
      const updatedS = await getStorySession(activeSession.id)
      const norm = normalizeStorySession(updatedS)
      setActiveSession(norm)

      if (norm.status === 'completed' || result.action_taken === 'completed') {
        setIsAutoRunning(false)
        setStateMachineStage('completed')
      } else if (result.action_taken === 'awaiting_approval') {
        setStateMachineStage('awaiting_approval')
      } else {
        setStateMachineStage('cycle_completed')
      }
    } catch (err: any) {
      console.error('Autonomous step error:', err)
      setIsAutoRunning(false)
      setExecutionError(err?.message || String(err))
      setStateMachineStage('error')
    } finally {
      setIsExecutingTurn(false)
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const handleUpdateAgentConfig = async (
    role: 'planning' | 'inference' | 'evaluation',
    providerId: string,
    model: string
  ) => {
    if (!activeSession) return
    const current = role === 'planning'
      ? activeSession.planning_agent_config
      : role === 'inference'
        ? activeSession.inference_agent_config
        : activeSession.evaluation_agent_config

    const updatedConfig: AgentRuntimeConfig = {
      ...(current || {
        provider_id: providerId,
        model_id: model,
        model: model,
        display_name: `${role.charAt(0).toUpperCase() + role.slice(1)} Agent`,
        enabled: true
      }),
      provider_id: providerId,
      model_id: model,
      model: model
    }

    const payload: Partial<UpdateStorySessionInput> & { id: string } = {
      id: activeSession.id
    }

    if (role === 'planning') {
      payload.planning_agent_config = updatedConfig
      payload.planning_provider_id = providerId
      payload.planning_model = model
    } else if (role === 'inference') {
      payload.inference_agent_config = updatedConfig
      payload.inference_provider_id = providerId
      payload.inference_model = model
    } else {
      payload.evaluation_agent_config = updatedConfig
      payload.evaluation_provider_id = providerId
      payload.evaluation_model = model
    }

    try {
      const updated = await updateStorySession(payload)
      const norm = normalizeStorySession(updated)
      setActiveSession(norm)
      setSessions(prev => prev.map(s => s.id === norm.id ? norm : s))
    } catch (err) {
      console.error('Failed to update agent config:', err)
    }
  }

  const handleRefreshProviderModels = async (providerId: string) => {
    try {
      if (providerId) {
        await testProvider(providerId)
      }
      await fetchProviders()
    } catch (err) {
      console.error('Failed to refresh provider:', err)
    }
  }

  const handleEditMessage = async (messageId: string, content: string, reason?: string) => {
    if (!activeSession) return
    try {
      await editStoryMessage({
        session_id: activeSession.id,
        message_id: messageId,
        content,
        reason
      })
      await loadSessionDetails(activeSession.id)
    } catch (err: any) {
      console.error('Failed to edit message:', err)
      setExecutionError(err?.message || String(err))
    }
  }

  const handleRegenerateTurn = async (turnIndex: number) => {
    if (!activeSession) return
    setIsExecutingTurn(true)
    setStateMachineStage('generating')
    setExecutionError(null)
    try {
      await regenerateStoryTurn({
        session_id: activeSession.id,
        turn_index: turnIndex,
        provider_id: activeProviderId || undefined,
        model: activeModel || undefined
      })
      await loadSessionDetails(activeSession.id)
      setStateMachineStage('cycle_completed')
    } catch (err: any) {
      console.error('Failed to regenerate turn:', err)
      setExecutionError(err?.message || String(err))
      setStateMachineStage('error')
    } finally {
      setIsExecutingTurn(false)
    }
  }

  const handleRevisionRestored = async (_updatedMessage: StoryMessage) => {
    if (!activeSession) return
    await loadSessionDetails(activeSession.id)
  }

  // Continuous Auto-Allow Loop Runner
  useEffect(() => {
    if (!isAutoRunning || !activeSession || isExecutingTurn || isGeneratingPrompt) return

    if (activeSession.status === 'completed' || activeSession.status === 'paused') {
      setIsAutoRunning(false)
      return
    }

    if (activeSession.execution_mode !== 'auto_allow') {
      setIsAutoRunning(false)
      return
    }

    const timer = setTimeout(() => {
      handleExecuteAutoStep()
    }, 600)

    return () => clearTimeout(timer)
  }, [isAutoRunning, activeSession?.status, activeSession?.execution_mode, isExecutingTurn, isGeneratingPrompt])

  const handleToggleAutoRun = () => {
    setIsAutoRunning(prev => !prev)
    setExecutionError(null)
  }

  const handleToggleAutonomy = async (mode: ExecutionMode) => {
    if (!activeSession) return
    setIsAutoRunning(false)
    try {
      const updated = await updateStorySession({
        id: activeSession.id,
        execution_mode: mode
      })
      setActiveSession(normalizeStorySession(updated))
    } catch (err) {
      console.error('Failed to update execution mode:', err)
    }
  }

  const handleCommitSFT = async (title?: string, description?: string, includePlanningMetadata?: boolean) => {
    if (!activeSession) throw new Error('No active session')
    const res = await commitStoryToSFT({
      session_id: activeSession.id,
      title,
      description,
      include_planning_metadata: Boolean(includePlanningMetadata)
    })
    const updated = await getStorySession(activeSession.id)
    setActiveSession(normalizeStorySession(updated))
    return res
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Left Pane: Sessions Drawer */}
      <div
        style={{ width: `${scenarioListWidth}px` }}
        className="shrink-0 h-full overflow-hidden"
      >
        <StorySessionList
          sessions={sessions}
          activeSessionId={activeSession?.id || null}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          loading={loadingSessions}
        />
      </div>

      {/* Resizable Divider: Scenario List */}
      <ResizeDivider
        direction="horizontal"
        isDragging={isScenarioDragging}
        onMouseDown={handleScenarioResize}
        onDoubleClick={handleScenarioReset}
        title="Drag to resize scenario list. Double-click to reset."
      />

      {/* Center Pane: Active Session Studio */}
      {activeSession ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 border-r border-border">
          {/* Header Bar */}
          <div className="h-14 px-4 border-b border-border flex items-center justify-between bg-card/40 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground truncate">
                    {activeSession.title}
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-secondary/80 text-foreground uppercase">
                    {activeSession.interaction_type.replace('_', ' ')}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase ${
                    activeSession.status === 'completed'
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                      : activeSession.status === 'paused'
                      ? 'bg-amber-950/40 border-amber-800 text-amber-400'
                      : 'bg-primary/20 border-primary/40 text-primary'
                  }`}>
                    {activeSession.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                  <span>Target: {activeSession.target_turns} turns</span>
                  <span>&bull;</span>
                  <span>Tokens: {activeSession.tokens_used.toLocaleString()}</span>
                  <span>&bull;</span>
                  <span className="capitalize">Mode: {activeSession.execution_mode.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Provider & Model Selector */}
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-secondary/60 border border-border text-xs">
                <Cpu className="h-3.5 w-3.5 text-primary ml-1" />
                <select
                  value={activeProviderId}
                  onChange={e => {
                    const pId = e.target.value
                    setActiveProviderId(pId)
                    const targetP = providers.find(p => p.id === pId)
                    const newModel = targetP?.default_model || (targetP?.models_cache && targetP.models_cache[0]) || 'default'
                    setActiveModel(newModel)
                    if (activeSession) {
                      handleUpdateAgentConfig('inference', pId, newModel)
                    }
                  }}
                  className="bg-transparent text-foreground border-none text-[11px] focus:outline-none cursor-pointer"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <span className="text-muted-foreground/60">•</span>

                {(() => {
                  const currentP = providers.find(p => p.id === activeProviderId)
                  const availableModels = currentP?.models_cache && currentP.models_cache.length > 0
                    ? currentP.models_cache
                    : [activeModel || 'default']
                  const currentModel = availableModels.includes(activeModel)
                    ? activeModel
                    : availableModels[0]

                  return (
                    <select
                      value={currentModel}
                      onChange={e => {
                        const m = e.target.value
                        setActiveModel(m)
                        if (activeSession) {
                          handleUpdateAgentConfig('inference', activeProviderId, m)
                        }
                      }}
                      className="bg-transparent text-foreground border-none text-[11px] focus:outline-none cursor-pointer max-w-[140px] truncate font-mono"
                    >
                      {availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )
                })()}
              </div>

              <button
                onClick={handleResetLayout}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md border border-border/80 hover:bg-secondary transition-colors"
                title="Reset all panels to default layout"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset Layout</span>
              </button>

              <button
                onClick={() => setPlanExpanded(!planExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary transition-colors"
                title={planExpanded ? 'Collapse Plan Specification' : 'Expand Plan Specification'}
              >
                {planExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span>Plan Spec</span>
              </button>

              <button
                onClick={() => setCommitModalOpen(true)}
                disabled={messages.length === 0 || Boolean(activeSession.sft_session_id)}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-40"
                title={activeSession.sft_session_id ? 'Already committed to SFT Corpus' : 'Commit conversation turns to Mechon SFT Corpus'}
              >
                <Database className="w-3.5 h-3.5" />
                <span>{activeSession.sft_session_id ? 'Committed to SFT' : 'Commit to SFT'}</span>
              </button>
            </div>
          </div>

          {/* Expandable Planning Spec Editor */}
          {planExpanded && spec && (
            <>
              <div
                style={{ height: `${specEditorHeight}px` }}
                className="shrink-0 overflow-hidden"
              >
                <PlanningEditor
                  spec={spec}
                  onSaveSpec={handleSaveSpec}
                  saving={savingSpec}
                />
              </div>

              {/* Resizable Divider: Spec Editor */}
              <ResizeDivider
                direction="vertical"
                isDragging={isSpecDragging}
                onMouseDown={handleSpecResize}
                onDoubleClick={handleSpecReset}
                title="Drag to resize plan specification. Double-click to reset."
              />
            </>
          )}

          {/* Timeline Milestones Ribbon */}
          <StoryTimeline
            milestones={milestones}
            onSaveMilestones={handleSaveMilestones}
            saving={savingMilestones}
          />

          {/* Conversation Transcript */}
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
            <StoryConversationViewer
              sessionId={activeSession.id}
              messages={messages}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
              onEditMessage={handleEditMessage}
              onRegenerateTurn={handleRegenerateTurn}
              onRevisionRestored={handleRevisionRestored}
            />
          </div>

          {/* Prompt Workbench & Autonomous Controls */}
          <PromptWorkbench
            proposedPrompt={proposedPrompt}
            executionMode={activeSession.execution_mode}
            onApproveAndExecute={handleApproveAndExecute}
            onRegenerate={handleGenerateNextPrompt}
            onExecuteAutoStep={handleExecuteAutoStep}
            onToggleAutonomy={handleToggleAutonomy}
            isGenerating={isGeneratingPrompt}
            isExecuting={isExecutingTurn}
            pauseReason={pauseReason}
            isAutoRunning={isAutoRunning}
            onToggleAutoRun={handleToggleAutoRun}
            stateMachineStage={stateMachineStage}
            errorMessage={executionError}
            onRetry={handleExecuteAutoStep}
            onDismissError={() => setExecutionError(null)}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground select-none">
          <Sparkles className="w-10 h-10 mb-3 text-muted-foreground/60" />
          <h3 className="text-base font-semibold text-foreground mb-1">
            Mechon Story Architect
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">
            Plan the interaction. Engineer the conversation. Select or create a scenario on the left to begin.
          </p>
        </div>
      )}

      {/* Resizable Divider: Right Pane */}
      {activeSession && (
        <ResizeDivider
          direction="horizontal"
          isDragging={isRightPaneDragging}
          onMouseDown={handleRightPaneResize}
          onDoubleClick={handleRightPaneReset}
          title="Drag to resize inspector pane. Double-click to reset."
        />
      )}

      {/* Right Pane: State & Agent Monitor */}
      {activeSession && (
        <div
          style={{ width: `${rightPaneWidth}px` }}
          className="shrink-0 h-full flex flex-col bg-card/30 overflow-hidden"
        >
          {/* Tabs */}
          <div className="h-11 px-3 border-b border-border flex items-center gap-1 bg-card/60">
            <button
              onClick={() => setRightTab('narrative')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                rightTab === 'narrative'
                  ? 'bg-secondary text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span>Narrative State</span>
            </button>

            <button
              onClick={() => setRightTab('agent')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                rightTab === 'agent'
                  ? 'bg-secondary text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-sky-400" />
              <span>Agent Monitor</span>
            </button>
          </div>

          {/* Right Pane Content */}
          <div className="flex-1 overflow-y-auto">
            {rightTab === 'narrative' ? (
              <NarrativeStateInspector state={narrativeState} />
            ) : (
              <AgentActivityMonitor
                evaluation={latestEvaluation}
                session={activeSession}
                logs={executionLogs}
                providers={providers}
                onUpdateAgent={handleUpdateAgentConfig}
                onRefreshProvider={handleRefreshProviderModels}
                executingAgent={
                  stateMachineStage === 'planning' || isGeneratingPrompt
                    ? 'planning'
                    : stateMachineStage === 'generating' || isExecutingTurn
                      ? 'inference'
                      : stateMachineStage === 'evaluating'
                        ? 'evaluation'
                        : null
                }
              />
            )}
          </div>
        </div>
      )}

      {/* Commit To SFT Modal */}
      {commitModalOpen && activeSession && (
        <CommitToSFTModal
          session={activeSession}
          messageCount={messages.length}
          onCommit={handleCommitSFT}
          onClose={() => setCommitModalOpen(false)}
        />
      )}
    </div>
  )
}
