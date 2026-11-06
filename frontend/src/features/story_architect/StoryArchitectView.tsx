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
import { useSubsystemConfigStore } from '../../editor/stores/useSubsystemConfigStore'
import { ResizeDivider } from '../../components/common/ResizeDivider'
import { StudioRefreshButton } from '../../components/common/StudioRefreshButton'
import { useAutoDatasetSync } from '../../hooks/useAutoDatasetSync'
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
import { StoryArchitectToolbar } from './StoryArchitectToolbar'
import { StoryLeftDock } from './StoryLeftDock'
import { CentralConversationViewport } from './CentralConversationViewport'
import { StoryRightDock } from './StoryRightDock'
import { StoryBottomDock } from './StoryBottomDock'
import { CommitToSFTModal } from './CommitToSFTModal'
import { useInspectorStore } from '../../editor/stores/useInspectorStore'
import { useConsoleStore } from '../../editor/stores/useConsoleStore'
import { useStoryWorkspaceStore } from './useStoryWorkspaceStore'

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

  const {
    layout,
    setLeftWidth,
    setRightWidth,
    setBottomHeight
  } = useStoryWorkspaceStore()

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
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
  const [isExecutingTurn, setIsExecutingTurn] = useState(false)
  const [savingSpec, setSavingSpec] = useState(false)
  const [savingMilestones, setSavingMilestones] = useState(false)
  const [pauseReason, setPauseReason] = useState<string | null>(null)

  // Streaming state
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  // Dragging state for splitters
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const [isDraggingBottom, setIsDraggingBottom] = useState(false)

  // Left Splitter Resize Handler
  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingLeft(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      setLeftWidth(moveEvent.clientX)
    }

    const onMouseUp = () => {
      setIsDraggingLeft(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [setLeftWidth])

  // Right Splitter Resize Handler
  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingRight(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      setRightWidth(window.innerWidth - moveEvent.clientX)
    }

    const onMouseUp = () => {
      setIsDraggingRight(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [setRightWidth])

  // Bottom Splitter Resize Handler
  const handleBottomResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingBottom(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      setBottomHeight(window.innerHeight - moveEvent.clientY)
    }

    const onMouseUp = () => {
      setIsDraggingBottom(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [setBottomHeight])

  // Synchronize session inference configuration with active provider/model
  useEffect(() => {
    if (activeSession && activeProviderId && activeModel) {
      if (
        activeSession.inference_provider_id !== activeProviderId ||
        activeSession.inference_model !== activeModel
      ) {
        handleUpdateAgentConfig('inference', activeProviderId, activeModel)
      }
    }
  }, [activeProviderId, activeModel, activeSession?.id])

  // Contextual Inspector synchronization
  useEffect(() => {
    if (activeSession) {
      useInspectorStore.getState().inspect({
        type: 'story_agent',
        id: activeSession.id,
        title: `Story: ${activeSession.title}`,
        data: {
          name: activeSession.title,
          role: activeSession.interaction_type || 'Autonomous Roleplay Architect',
          provider: activeSession.inference_provider_id || activeProviderId,
          model: activeSession.inference_model || activeModel,
          temperature: activeSession.inference_agent_config?.temperature ?? 0.7,
          max_tokens: activeSession.inference_agent_config?.max_tokens ?? 2048,
          instructions: activeSession.description || 'Story Architect multi-turn agent'
        }
      })
    }
  }, [activeSession?.id])

  // Fetch all sessions on mount or when activeProjectId changes
  useEffect(() => {
    if (activeProjectId) {
      loadSessions(activeProjectId)
    }
  }, [activeProjectId])

  useAutoDatasetSync(() => {
    if (activeProjectId) {
      loadSessions(activeProjectId)
    }
  }, { enabled: true })

  // Setup streaming and turn-completed listener when activeSession changes
  useEffect(() => {
    if (!activeSession) return

    let unlistenToken: (() => void) | undefined
    let unlistenDone: (() => void) | undefined
    let unlistenCompleted: (() => void) | undefined
    let unlistenError: (() => void) | undefined

    const setupListeners = async () => {
      unlistenToken = await listen<any>(`story-stream-token-${activeSession.id}`, (event) => {
        setIsStreaming(true)
        setStreamingContent(event.payload.accumulated || '')
      })

      unlistenDone = await listen<any>(`story-stream-done-${activeSession.id}`, () => {
        setIsStreaming(false)
      })

      unlistenCompleted = await listen<any>(`story-turn-completed-${activeSession.id}`, () => {
        setIsStreaming(false)
        setStreamingContent('')
        loadSessionDetails(activeSession.id)
      })

      unlistenError = await listen<any>(`story-stream-error-${activeSession.id}`, (event) => {
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

      const proposed = (Array.isArray(historyRes) ? historyRes : []).find(
        (h) => h.status === 'proposed'
      )
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
      const remaining = sessions.filter((s) => s.id !== sessionId)
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
      const planningConfig = useSubsystemConfigStore.getState().configs.planning
      const planningProvider =
        activeSession.planning_provider_id ||
        activeSession.planning_agent_config?.provider_id ||
        planningConfig?.provider_id ||
        activeProviderId ||
        undefined
      const planningModel =
        activeSession.planning_model ||
        activeSession.planning_agent_config?.model_id ||
        activeSession.planning_agent_config?.model ||
        planningConfig?.model_id ||
        activeModel ||
        undefined
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

  const handleApproveAndExecute = async (
    content: string,
    promptHistoryId?: string,
    edited?: boolean
  ) => {
    if (!activeSession) return
    setIsExecutingTurn(true)
    setStateMachineStage('generating')
    setExecutionError(null)
    try {
      const inferenceProvider =
        activeProviderId ||
        activeSession.inference_provider_id ||
        activeSession.inference_agent_config?.provider_id ||
        undefined
      const inferenceModel =
        activeModel ||
        activeSession.inference_model ||
        activeSession.inference_agent_config?.model_id ||
        activeSession.inference_agent_config?.model ||
        undefined
      const result: AutoStepResult = await approveAndExecuteTurn(
        activeSession.id,
        content,
        promptHistoryId,
        edited,
        inferenceProvider,
        inferenceModel
      )

      if (result.logs && result.logs.length > 0) {
        setExecutionLogs((prev) => [...result.logs, ...prev].slice(0, 50))
        result.logs.forEach((l) => useConsoleStore.getState().addLog('info', 'agent', l))
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
      const subs = useSubsystemConfigStore.getState().configs
      const inferenceProvider =
        activeSession.inference_provider_id ||
        activeSession.inference_agent_config?.provider_id ||
        subs.main_inference?.provider_id ||
        activeProviderId ||
        undefined
      const inferenceModel =
        activeSession.inference_model ||
        activeSession.inference_agent_config?.model_id ||
        activeSession.inference_agent_config?.model ||
        subs.main_inference?.model_id ||
        activeModel ||
        undefined

      const planningProvider =
        activeSession.planning_provider_id ||
        activeSession.planning_agent_config?.provider_id ||
        subs.planning?.provider_id ||
        undefined
      const planningModel =
        activeSession.planning_model ||
        activeSession.planning_agent_config?.model_id ||
        subs.planning?.model_id ||
        undefined

      const evaluationProvider =
        activeSession.evaluation_provider_id ||
        activeSession.evaluation_agent_config?.provider_id ||
        subs.evaluation?.provider_id ||
        undefined
      const evaluationModel =
        activeSession.evaluation_model ||
        activeSession.evaluation_agent_config?.model_id ||
        subs.evaluation?.model_id ||
        undefined

      const result: AutoStepResult = await executeAutonomousStep(
        activeSession.id,
        inferenceProvider,
        inferenceModel,
        planningProvider,
        planningModel,
        evaluationProvider,
        evaluationModel
      )

      if (result.logs && result.logs.length > 0) {
        setExecutionLogs((prev) => [...result.logs, ...prev].slice(0, 50))
        result.logs.forEach((l) => useConsoleStore.getState().addLog('info', 'agent', l))
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
    const current =
      role === 'planning'
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
      setSessions((prev) => prev.map((s) => (s.id === norm.id ? norm : s)))
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
  }, [
    isAutoRunning,
    activeSession?.status,
    activeSession?.execution_mode,
    isExecutingTurn,
    isGeneratingPrompt
  ])

  const handleToggleAutoRun = () => {
    setIsAutoRunning((prev) => !prev)
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

  const handleCommitSFT = async (
    title?: string,
    description?: string,
    includePlanningMetadata?: boolean
  ) => {
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
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* 1. Global Story Architect Toolbar */}
      <StoryArchitectToolbar
        session={activeSession}
        activeModel={activeModel}
        activeProviderId={activeProviderId}
        isAutoRunning={isAutoRunning}
        isExecutingTurn={isExecutingTurn}
        isGeneratingPrompt={isGeneratingPrompt}
        onToggleAutoRun={handleToggleAutoRun}
        onToggleAutonomy={handleToggleAutonomy}
        onOpenCommitModal={() => setCommitModalOpen(true)}
        hasMessages={messages.length > 0}
      />

      {/* 2. Main Workspace Body with Docked Surrounding Panels */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Dock Panel */}
        {layout.leftDockVisible && (
          <>
            <aside
              style={{ width: `${layout.leftDockWidth}px` }}
              className="h-full shrink-0 overflow-hidden flex flex-col"
            >
              <StoryLeftDock
                sessions={sessions}
                activeSession={activeSession}
                spec={spec}
                milestones={milestones}
                messages={messages}
                loadingSessions={loadingSessions}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onSaveMilestones={handleSaveMilestones}
                savingMilestones={savingMilestones}
              />
            </aside>
            <ResizeDivider
              direction="horizontal"
              isDragging={isDraggingLeft}
              onMouseDown={handleLeftResizeStart}
              onDoubleClick={() => setLeftWidth(280)}
              title="Drag to resize Left Explorer Dock. Double-click to reset."
            />
          </>
        )}

        {/* Central Workspace: The Dominant Narrative Viewport */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          {activeSession ? (
            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
              {/* Central Conversation Viewport (100% Dedicated Narrative Scene) */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <CentralConversationViewport
                  sessionId={activeSession.id}
                  sessionTitle={activeSession.title}
                  messages={messages}
                  characters={spec?.character_profiles || []}
                  currentArc={narrativeState?.current_arc}
                  streamingContent={streamingContent}
                  isStreaming={isStreaming}
                  onEditMessage={handleEditMessage}
                  onRegenerateTurn={handleRegenerateTurn}
                  onRevisionRestored={handleRevisionRestored}
                  onFocusComposer={() => {
                    useStoryWorkspaceStore.getState().setRightTab('workbench')
                  }}
                />
              </div>

              {/* Bottom Dock Panel (Workbench, Logs, Preview) */}
              {layout.bottomDockVisible && (
                <>
                  <ResizeDivider
                    direction="vertical"
                    isDragging={isDraggingBottom}
                    onMouseDown={handleBottomResizeStart}
                    onDoubleClick={() => setBottomHeight(220)}
                    title="Drag to resize Bottom Control Room Dock. Double-click to reset."
                  />
                  <div
                    style={{ height: `${layout.bottomDockHeight}px` }}
                    className="shrink-0 overflow-hidden flex flex-col"
                  >
                    <StoryBottomDock
                      session={activeSession}
                      messages={messages}
                      stateMachineStage={stateMachineStage}
                      isAutoRunning={isAutoRunning}
                      executionLogs={executionLogs}
                      onOpenCommitModal={() => setCommitModalOpen(true)}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground select-none">
              <div className="w-16 h-16 rounded-3xl bg-secondary/80 border border-border flex items-center justify-center text-primary mb-4 shadow-sm">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Mechon Story Architect
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-4 leading-relaxed">
                Engineer high-quality multi-turn interactive narratives. Select an existing scenario from the left panel or create a new story to begin.
              </p>
            </div>
          )}
        </div>

        {/* Right Dock Panel (Inspector) */}
        {layout.rightDockVisible && activeSession && (
          <>
            <ResizeDivider
              direction="horizontal"
              isDragging={isDraggingRight}
              onMouseDown={handleRightResizeStart}
              onDoubleClick={() => setRightWidth(320)}
              title="Drag to resize Property Inspector Dock. Double-click to reset."
            />
            <aside
              style={{ width: `${layout.rightDockWidth}px` }}
              className="h-full shrink-0 overflow-hidden flex flex-col"
            >
              <StoryRightDock
                session={activeSession}
                spec={spec}
                narrativeState={narrativeState}
                latestEvaluation={latestEvaluation}
                executionLogs={executionLogs}
                providers={providers}
                proposedPrompt={proposedPrompt}
                executionMode={activeSession.execution_mode}
                milestones={milestones}
                activeModel={activeModel}
                activeProviderId={activeProviderId}
                isGeneratingPrompt={isGeneratingPrompt}
                isExecutingTurn={isExecutingTurn}
                isStreaming={isStreaming}
                isAutoRunning={isAutoRunning}
                pauseReason={pauseReason}
                stateMachineStage={stateMachineStage}
                errorMessage={executionError}
                onSaveSpec={handleSaveSpec}
                savingSpec={savingSpec}
                onUpdateAgent={handleUpdateAgentConfig}
                onRefreshProvider={handleRefreshProviderModels}
                onSendAndExecute={handleApproveAndExecute}
                onStepAutonomous={handleExecuteAutoStep}
                onPlanNextPrompt={(f) => handleGenerateNextPrompt(f)}
                onToggleAutonomy={handleToggleAutonomy}
                onToggleAutoRun={handleToggleAutoRun}
                onRetry={handleExecuteAutoStep}
                onDismissError={() => setExecutionError(null)}
              />
            </aside>
          </>
        )}
      </div>

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
