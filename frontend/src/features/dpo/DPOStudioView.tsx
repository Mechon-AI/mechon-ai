import React, { useState, useEffect } from 'react'
import {
  GitCompare,
  Plus,
  Sparkles,
  Undo2,
  ThumbsUp,
  Check,
  Copy,
  Sliders,
  ChevronRight,
  Clock,
  Layers,
  Flag,
  RotateCcw,
  Edit3,
  Eye,
  Trash2,
  X,
  AlertCircle,
  CheckCircle,
  Cpu
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProviderStore } from '../../stores/useProviderStore'
import { useInspectorStore } from '../../editor/stores/useInspectorStore'
import {
  getDPOTasks,
  createDPOTask,
  updateDPOTask,
  annotateDPOTask,
  undoLastDPOAnnotation,
  generateDPOPair,
  generateCompletion,
  deleteDPOTask
} from '../../services/api'
import type { DPOTask } from '../../types'
import { formatErrorMessage } from '../../utils/errors'

export const DPOStudioView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()
  const { providers, activeProviderId, activeModel, setActiveProviderId, setActiveModel, fetchProviders } = useProviderStore()

  const [tasks, setTasks] = useState<DPOTask[]>([])
  const [activeTask, setActiveTask] = useState<DPOTask | null>(null)
  const [prompt, setPrompt] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, factual, and concise assistant.')
  const [responseA, setResponseA] = useState('')
  const [responseB, setResponseB] = useState('')
  const [editModeA, setEditModeA] = useState(false)
  const [editModeB, setEditModeB] = useState(false)
  const [rationale, setRationale] = useState('')
  const [helpfulness, setHelpfulness] = useState(5)
  const [factuality, setFactuality] = useState(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedPanel, setCopiedPanel] = useState<'a' | 'b' | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Candidate A & B Model Selection
  const [providerIdA, setProviderIdA] = useState<string>('')
  const [modelA, setModelA] = useState<string>('')
  const [tempA, setTempA] = useState<number>(0.7)
  const [errorA, setErrorA] = useState<string | null>(null)

  const [providerIdB, setProviderIdB] = useState<string>('')
  const [modelB, setModelB] = useState<string>('')
  const [tempB, setTempB] = useState<number>(0.9)
  const [errorB, setErrorB] = useState<string | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const applySameModelPreset = () => {
    if (providerIdA) {
      setProviderIdB(providerIdA)
      setModelB(modelA)
      setTempA(0.2)
      setTempB(0.9)
      showFeedback('success', 'Preset applied: Same model, low temp (0.2) vs high temp (0.9)')
    }
  }

  const applyCrossModelPreset = () => {
    setTempA(0.7)
    setTempB(0.7)
    if (providers.length > 1) {
      const otherP = providers.find(p => p.id !== providerIdA) || providers[1]
      setProviderIdB(otherP.id)
      const models = getModelsForProvider(otherP.id)
      if (models.length > 0) setModelB(models[0])
    } else if (providers.length === 1) {
      const models = getModelsForProvider(providers[0].id)
      if (models.length > 1) {
        const otherM = models.find(m => m !== modelA) || models[1]
        setModelB(otherM)
      }
    }
    showFeedback('success', 'Preset applied: Cross-model comparison (temp 0.7)')
  }

  const getModelsForProvider = (pId: string): string[] => {
    const p = providers.find(item => item.id === pId)
    if (!p) return []
    if (p.models_cache && p.models_cache.length > 0) return p.models_cache
    if (p.default_model) return [p.default_model]
    return []
  }

  useEffect(() => {
    fetchProviders()
    initView()
  }, [activeProjectId])

  // Synchronize candidate selections when providers load
  useEffect(() => {
    if (providers.length === 0) return

    if (!providerIdA || !providers.some(p => p.id === providerIdA)) {
      const defP = providers.find(p => p.id === activeProviderId) || providers[0]
      if (defP) {
        setProviderIdA(defP.id)
        const defM = activeModel || defP.default_model || (defP.models_cache && defP.models_cache[0]) || ''
        setModelA(defM)
      }
    }

    if (!providerIdB || !providers.some(p => p.id === providerIdB)) {
      const defP = providers.find(p => p.id === activeProviderId) || providers[0]
      if (defP) {
        setProviderIdB(defP.id)
        const defM = activeModel || defP.default_model || (defP.models_cache && defP.models_cache[0]) || ''
        setModelB(defM)
      }
    }
  }, [providers, activeProviderId, activeModel])

  useEffect(() => {
    if (activeTask) {
      useInspectorStore.getState().inspect({
        type: 'dataset_record',
        id: activeTask.id,
        title: `DPO Task #${activeTask.id.slice(0, 8)}`,
        data: activeTask
      })
    }
  }, [activeTask?.id])

  const initView = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (pId) {
      loadTasks(pId)
    }
  }

  // Setup Keyboard Shortcuts (A, B, T, X, S, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input, textarea, or contentEditable
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (!activeTask || isGenerating) return

      const key = e.key.toUpperCase()
      if (key === 'A') {
        e.preventDefault()
        handlePreference('a')
      } else if (key === 'B') {
        e.preventDefault()
        handlePreference('b')
      } else if (key === 'T') {
        e.preventDefault()
        handlePreference('tie')
      } else if (key === 'X') {
        e.preventDefault()
        handlePreference('both_bad')
      } else if (key === 'S') {
        e.preventDefault()
        handlePreference('skip')
      } else if (key === 'F') {
        e.preventDefault()
        handlePreference('flag')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTask, isGenerating, responseA, responseB, rationale, helpfulness, factuality, providerIdA, modelA, providerIdB, modelB])

  const loadTasks = async (projectId?: string) => {
    const targetProject = projectId || activeProjectId
    if (!targetProject) return
    try {
      const res = await getDPOTasks(targetProject)
      setTasks(res.tasks)
      if (res.tasks.length > 0) {
        selectTask(res.tasks[0])
      } else {
        handleNewTask(targetProject)
      }
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to load DPO tasks'))
    }
  }

  const selectTask = (t: DPOTask) => {
    setActiveTask(t)
    setPrompt(t.prompt)
    setSystemPrompt(t.system_prompt || '')
    setResponseA(t.response_a || '')
    setResponseB(t.response_b || '')
    setRationale(t.rationale || '')
    setHelpfulness(t.helpfulness_rating || 5)
    setFactuality(t.factuality_rating || 5)
    setEditModeA(!t.response_a)
    setEditModeB(!t.response_b)
    setErrorA(null)
    setErrorB(null)

    // Restore candidate metadata if present
    const meta = typeof t.metadata === 'object' && t.metadata !== null ? (t.metadata as Record<string, any>) : {}
    const defaultP = providers.find(p => p.id === activeProviderId) || providers[0]

    // Candidate A
    const targetPA = (meta.provider_a && providers.some(p => p.id === meta.provider_a))
      ? meta.provider_a
      : (providerIdA && providers.some(p => p.id === providerIdA) ? providerIdA : defaultP?.id || '')
    setProviderIdA(targetPA)
    
    const availableModelsA = getModelsForProvider(targetPA)
    const targetMA = (meta.model_a && availableModelsA.includes(meta.model_a))
      ? meta.model_a
      : (modelA && availableModelsA.includes(modelA) ? modelA : (availableModelsA[0] || ''))
    setModelA(targetMA)

    if (meta.temp_a !== undefined) setTempA(Number(meta.temp_a))

    // Candidate B
    const targetPB = (meta.provider_b && providers.some(p => p.id === meta.provider_b))
      ? meta.provider_b
      : (providerIdB && providers.some(p => p.id === providerIdB) ? providerIdB : defaultP?.id || '')
    setProviderIdB(targetPB)
    
    const availableModelsB = getModelsForProvider(targetPB)
    const targetMB = (meta.model_b && availableModelsB.includes(meta.model_b))
      ? meta.model_b
      : (modelB && availableModelsB.includes(modelB) ? modelB : (availableModelsB[0] || ''))
    setModelB(targetMB)

    if (meta.temp_b !== undefined) setTempB(Number(meta.temp_b))
  }

  const handleProviderAChange = (pId: string) => {
    setProviderIdA(pId)
    const models = getModelsForProvider(pId)
    setModelA(models[0] || '')
    setErrorA(null)
  }

  const handleProviderBChange = (pId: string) => {
    setProviderIdB(pId)
    const models = getModelsForProvider(pId)
    setModelB(models[0] || '')
    setErrorB(null)
  }

  const handleNewTask = async (projectId?: string) => {
    const targetProject = projectId || activeProjectId
    if (!targetProject) return
    try {
      const newTask = await createDPOTask({
        project_id: targetProject,
        prompt: 'Explain how Direct Preference Optimization aligns LLMs.',
        system_prompt: 'You are an AI alignment researcher.',
        response_a: '',
        response_b: ''
      })
      setTasks(prev => [newTask, ...prev])
      selectTask(newTask)
      showFeedback('success', 'New DPO preference task created.')
    } catch (err: any) {
      showFeedback('error', `Failed to create task: ${err.message}`)
    }
  }

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this DPO comparison task?')) {
      try {
        await deleteDPOTask(taskId)
        setTasks(prev => prev.filter(t => t.id !== taskId))
        if (activeTask?.id === taskId) {
          const remaining = tasks.filter(t => t.id !== taskId)
          if (remaining.length > 0) {
            selectTask(remaining[0])
          } else {
            setActiveTask(null)
          }
        }
        showFeedback('success', 'Task deleted.')
      } catch (err: any) {
        showFeedback('error', `Failed to delete task: ${err.message}`)
      }
    }
  }

  const handleGenerateBoth = async () => {
    if (!activeTask || !prompt.trim() || isGenerating) return

    if (!providerIdA || !modelA) {
      showFeedback('error', 'Please select a provider and model for Candidate A.')
      return
    }
    if (!providerIdB || !modelB) {
      showFeedback('error', 'Please select a provider and model for Candidate B.')
      return
    }

    setIsGenerating(true)
    setErrorA(null)
    setErrorB(null)
    try {
      // First save prompt/system prompt
      await updateDPOTask(activeTask.id, {
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim()
      })

      const res = await generateDPOPair({
        provider_id_a: providerIdA,
        provider_id_b: providerIdB,
        model_a: modelA,
        model_b: modelB,
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim(),
        temp_a: tempA,
        temp_b: tempB
      })

      if (res.success_a && res.response_a) {
        setResponseA(res.response_a)
        setEditModeA(false)
        setErrorA(null)
      } else if (res.error_a) {
        setErrorA(formatErrorMessage(res.error_a, 'Candidate A generation failed'))
      }

      if (res.success_b && res.response_b) {
        setResponseB(res.response_b)
        setEditModeB(false)
        setErrorB(null)
      } else if (res.error_b) {
        setErrorB(formatErrorMessage(res.error_b, 'Candidate B generation failed'))
      }

      const updated = await updateDPOTask(activeTask.id, {
        response_a: res.success_a ? res.response_a : responseA,
        response_b: res.success_b ? res.response_b : responseB,
        metadata: {
          ...(typeof activeTask.metadata === 'object' && activeTask.metadata !== null ? activeTask.metadata : {}),
          model_a: res.model_a || modelA,
          model_b: res.model_b || modelB,
          provider_a: res.provider_id_a || providerIdA,
          provider_b: res.provider_id_b || providerIdB,
          temp_a: tempA,
          temp_b: tempB,
          latency_a: res.latency_a_ms,
          latency_b: res.latency_b_ms
        }
      })

      setActiveTask(updated)
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))

      if (res.success_a && res.success_b) {
        showFeedback('success', 'Both candidate responses generated successfully.')
      } else if (res.success_a) {
        showFeedback('error', `Candidate A succeeded, but Candidate B failed: ${res.error_b}`)
      } else if (res.success_b) {
        showFeedback('error', `Candidate B succeeded, but Candidate A failed: ${res.error_a}`)
      }
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Dual generation failed'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateSingle = async (target: 'a' | 'b') => {
    if (!activeTask || !prompt.trim() || isGenerating) return

    const provId = target === 'a' ? providerIdA : providerIdB
    const targetModel = target === 'a' ? modelA : modelB
    const candidateName = target === 'a' ? 'Candidate A' : 'Candidate B'

    if (!provId || !targetModel) {
      showFeedback('error', `Please select a provider and model for ${candidateName}.`)
      return
    }

    setIsGenerating(true)
    if (target === 'a') setErrorA(null)
    else setErrorB(null)

    try {
      const temp = target === 'a' ? tempA : tempB
      const res = await generateCompletion({
        provider_id: provId,
        model: targetModel,
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim(),
        temperature: temp
      })

      if (target === 'a') {
        setResponseA(res.content)
        setEditModeA(false)
        setErrorA(null)
        const updated = await updateDPOTask(activeTask.id, {
          response_a: res.content,
          metadata: {
            ...(typeof activeTask.metadata === 'object' && activeTask.metadata !== null ? activeTask.metadata : {}),
            model_a: res.model || targetModel,
            provider_a: provId,
            temp_a: tempA
          }
        })
        setActiveTask(updated)
        setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      } else {
        setResponseB(res.content)
        setEditModeB(false)
        setErrorB(null)
        const updated = await updateDPOTask(activeTask.id, {
          response_b: res.content,
          metadata: {
            ...(typeof activeTask.metadata === 'object' && activeTask.metadata !== null ? activeTask.metadata : {}),
            model_b: res.model || targetModel,
            provider_b: provId,
            temp_b: tempB
          }
        })
        setActiveTask(updated)
        setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      }
      showFeedback('success', `${candidateName} generated successfully.`)
    } catch (err: any) {
      const formatted = formatErrorMessage(err, `${candidateName} generation failed`)
      if (target === 'a') setErrorA(formatted)
      else setErrorB(formatted)
      showFeedback('error', formatted)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveTextChanges = async () => {
    if (!activeTask) return
    try {
      const updated = await updateDPOTask(activeTask.id, {
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim(),
        response_a: responseA,
        response_b: responseB,
        rationale: rationale.trim(),
        helpfulness_rating: helpfulness,
        factuality_rating: factuality
      })
      setActiveTask(updated)
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      showFeedback('success', 'Changes saved.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Save failed'))
    }
  }

  const handlePreference = async (pref: string) => {
    if (!activeTask) return
    if (!responseA.trim() && !responseB.trim() && !['skip', 'flag'].includes(pref)) {
      showFeedback('error', 'Both response A and B must be present before recording a choice.')
      return
    }

    try {
      // First ensure texts are saved
      await updateDPOTask(activeTask.id, {
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim(),
        response_a: responseA,
        response_b: responseB
      })

      const updated = await annotateDPOTask(activeTask.id, {
        preference: pref,
        rationale: rationale.trim() || undefined,
        helpfulness_rating: helpfulness,
        factuality_rating: factuality,
        metadata: {
          ...(typeof activeTask.metadata === 'object' && activeTask.metadata !== null ? activeTask.metadata : {}),
          annotated_at: new Date().toISOString(),
          provider_a: providerIdA,
          model_a: modelA,
          provider_b: providerIdB,
          model_b: modelB
        }
      })

      setActiveTask(updated)
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      showFeedback('success', `Preference "${pref.toUpperCase()}" recorded!`)

      // Auto-advance to next pending task if available
      const pendingTasks = tasks.filter(t => t.id !== updated.id && t.status === 'pending')
      if (pendingTasks.length > 0) {
        selectTask(pendingTasks[0])
      }
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Annotation failed'))
    }
  }

  const handleUndo = async () => {
    if (!activeProjectId) return
    try {
      const undone = await undoLastDPOAnnotation(activeProjectId)
      setTasks(prev => prev.map(t => (t.id === undone.id ? undone : t)))
      selectTask(undone)
      showFeedback('success', 'Last annotation reverted to pending.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Undo failed'))
    }
  }

  const copyText = (text: string, panel: 'a' | 'b') => {
    navigator.clipboard.writeText(text)
    setCopiedPanel(panel)
    setTimeout(() => setCopiedPanel(null), 2000)
  }

  const filteredTasks = tasks.filter(t => {
    if (filterStatus === 'all') return true
    return t.status === filterStatus
  })

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Tasks Drawer */}
      <aside className="w-72 border-r border-border bg-card/40 flex flex-col shrink-0 select-none">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">DPO Tasks</span>
            <button
              onClick={() => handleNewTask()}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs flex items-center gap-1 shadow-sm font-semibold transition-all"
              title="New Comparison Task"
            >
              <Plus className="h-3.5 w-3.5" /> New Task
            </button>
          </div>

          <div className="flex items-center rounded-lg bg-secondary p-0.5 border border-border text-[11px]">
            {['all', 'pending', 'completed'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`flex-1 py-1 rounded text-center capitalize transition-colors ${
                  filterStatus === st ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredTasks.map(t => {
            const isSelected = activeTask?.id === t.id
            const isDone = t.status === 'completed'
            return (
              <div
                key={t.id}
                onClick={() => selectTask(t)}
                className={`p-2.5 rounded-lg text-xs cursor-pointer border transition-all space-y-1 group ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                    : 'bg-card/50 hover:bg-secondary/60 border-border/50 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold truncate text-foreground text-xs flex-1">{t.prompt}</span>
                  <div className="flex items-center gap-1">
                    {t.preference ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                        {t.preference}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-accent text-muted-foreground">
                        PENDING
                      </span>
                    )}
                    <button
                      onClick={e => handleDeleteTask(t.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                      title="Delete Task"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{t.response_a ? 'Ready' : 'No A'} • {t.response_b ? 'Ready' : 'No B'}</span>
                  <span>{isDone ? 'Annotated' : 'Unrated'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Center DPO Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {activeTask ? (
          <>
            {/* Header Bar */}
            <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card/40 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">DPO Comparison</span>
                <span className="font-mono text-xs text-primary font-bold">#{activeTask.id.slice(0, 8)}</span>
                {activeTask?.status === 'completed' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    CHOICE: {activeTask.preference?.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-accent border border-border flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  title="Undo last recorded preference"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Undo Last
                </button>
                <button
                  onClick={handleSaveTextChanges}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-accent border border-border text-foreground transition-colors"
                >
                  Save Draft
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {notification && (
              <div
                className={`px-6 py-2 text-xs flex items-center justify-between border-b ${
                  notification.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                }`}
              >
                <span>{notification.message}</span>
                <button onClick={() => setNotification(null)} className="p-0.5 hover:opacity-75">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Workspace Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Prompt Section */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Evaluation Prompt
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGenerateSingle('a')}
                      disabled={isGenerating || !prompt.trim()}
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                      title="Generate or Regenerate Candidate A only"
                    >
                      {responseA ? 'Regen A' : 'Generate A'}
                    </button>
                    <button
                      onClick={() => handleGenerateSingle('b')}
                      disabled={isGenerating || !prompt.trim()}
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                      title="Generate or Regenerate Candidate B only"
                    >
                      {responseB ? 'Regen B' : 'Generate B'}
                    </button>
                    <button
                      onClick={handleGenerateBoth}
                      disabled={isGenerating || !prompt.trim()}
                      className="px-3.5 py-1 rounded text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-all"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} /> Generate Both
                    </button>
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Enter target prompt to evaluate..."
                  className="w-full p-2.5 rounded-lg bg-secondary/70 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Presets Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Presets:</span>
                  <button
                    type="button"
                    onClick={applySameModelPreset}
                    className="px-2.5 py-1 rounded text-xs bg-secondary hover:bg-accent border border-border text-foreground transition-all"
                  >
                    Same Model (Diff Temp)
                  </button>
                  <button
                    type="button"
                    onClick={applyCrossModelPreset}
                    className="px-2.5 py-1 rounded text-xs bg-secondary hover:bg-accent border border-border text-foreground transition-all"
                  >
                    Cross-Model Comparison
                  </button>
                </div>
              </div>

              {/* Side-by-side Response Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel A */}
                <div
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    activeTask?.preference === 'a'
                      ? 'bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="border-b border-border/80 pb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs uppercase tracking-wider text-primary">
                            Candidate A
                          </span>
                          {activeTask?.preference === 'a' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              CHOSEN
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleGenerateSingle('a')}
                            disabled={isGenerating || !prompt.trim() || !providerIdA || !modelA}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary hover:bg-accent border border-border text-foreground flex items-center gap-1 disabled:opacity-50"
                            title={responseA ? "Regenerate Candidate A" : "Generate Candidate A"}
                          >
                            <Sparkles className="h-3 w-3" /> {responseA ? 'Regen A' : 'Generate A'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditModeA(!editModeA)}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground flex items-center gap-1"
                          >
                            {editModeA ? <Eye className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
                            {editModeA ? 'Preview' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyText(responseA, 'a')}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                            title="Copy Response A"
                          >
                            {copiedPanel === 'a' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Candidate A Configuration Selectors */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">Provider</label>
                          <select
                            value={providerIdA}
                            onChange={e => handleProviderAChange(e.target.value)}
                            className="w-full text-xs p-1.5 rounded bg-secondary/80 border border-border focus:ring-1 focus:ring-primary outline-none"
                          >
                            {providers.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">Model</label>
                          <select
                            value={modelA}
                            onChange={e => setModelA(e.target.value)}
                            className="w-full text-xs p-1.5 rounded bg-secondary/80 border border-border focus:ring-1 focus:ring-primary outline-none font-mono"
                          >
                            {getModelsForProvider(providerIdA).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Temp: {tempA}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={tempA}
                            onChange={e => setTempA(parseFloat(e.target.value))}
                            className="w-full accent-primary h-1.5 bg-secondary rounded cursor-pointer mt-1"
                          />
                        </div>
                      </div>

                      {/* Metadata Badge */}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono pt-1">
                        <span className="px-1.5 py-0.5 rounded bg-secondary/60 border border-border/50">
                          {providers.find(p => p.id === providerIdA)?.name || providerIdA || 'Provider'} / {modelA || 'No model'} (temp: {tempA})
                        </span>
                      </div>

                      {/* Candidate A Error Banner with Retry */}
                      {errorA && (
                        <div className="p-2 rounded bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center justify-between gap-2 mt-1">
                          <div className="truncate" title={errorA}>
                            <span className="font-semibold">Error:</span> {errorA}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGenerateSingle('a')}
                            disabled={isGenerating}
                            className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[10px] font-bold shrink-0"
                          >
                            Retry Candidate A
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="min-h-[180px] text-xs leading-relaxed">
                      {editModeA ? (
                        <textarea
                          rows={8}
                          value={responseA}
                          onChange={e => setResponseA(e.target.value)}
                          placeholder="Type or paste Candidate Response A here..."
                          className="w-full p-2.5 rounded-lg bg-secondary/80 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        />
                      ) : responseA ? (
                        <div className="prose prose-invert prose-xs max-w-none break-words">
                          <ReactMarkdown>{responseA}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-muted-foreground italic p-4 text-center">
                          Click 'Edit' to write manually or click 'Generate Both'.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>{responseA.split(/\s+/).filter(Boolean).length} words</span>
                    <button
                      type="button"
                      onClick={() => handlePreference('a')}
                      disabled={!responseA.trim()}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm disabled:opacity-40 transition-all"
                    >
                      <ThumbsUp className="h-3 w-3" /> Prefer A (Key: A)
                    </button>
                  </div>
                </div>

                {/* Panel B */}
                <div
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    activeTask?.preference === 'b'
                      ? 'bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="border-b border-border/80 pb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs uppercase tracking-wider text-indigo-400">
                            Candidate B
                          </span>
                          {activeTask?.preference === 'b' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              CHOSEN
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleGenerateSingle('b')}
                            disabled={isGenerating || !prompt.trim() || !providerIdB || !modelB}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary hover:bg-accent border border-border text-foreground flex items-center gap-1 disabled:opacity-50"
                            title={responseB ? "Regenerate Candidate B" : "Generate Candidate B"}
                          >
                            <Sparkles className="h-3 w-3" /> {responseB ? 'Regen B' : 'Generate B'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditModeB(!editModeB)}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground flex items-center gap-1"
                          >
                            {editModeB ? <Eye className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
                            {editModeB ? 'Preview' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyText(responseB, 'b')}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                            title="Copy Response B"
                          >
                            {copiedPanel === 'b' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Candidate B Configuration Selectors */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">Provider</label>
                          <select
                            value={providerIdB}
                            onChange={e => handleProviderBChange(e.target.value)}
                            className="w-full text-xs p-1.5 rounded bg-secondary/80 border border-border focus:ring-1 focus:ring-primary outline-none"
                          >
                            {providers.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">Model</label>
                          <select
                            value={modelB}
                            onChange={e => setModelB(e.target.value)}
                            className="w-full text-xs p-1.5 rounded bg-secondary/80 border border-border focus:ring-1 focus:ring-primary outline-none font-mono"
                          >
                            {getModelsForProvider(providerIdB).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Temp: {tempB}</label>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={tempB}
                            onChange={e => setTempB(parseFloat(e.target.value))}
                            className="w-full accent-primary h-1.5 bg-secondary rounded cursor-pointer mt-1"
                          />
                        </div>
                      </div>

                      {/* Metadata Badge */}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono pt-1">
                        <span className="px-1.5 py-0.5 rounded bg-secondary/60 border border-border/50">
                          {providers.find(p => p.id === providerIdB)?.name || providerIdB || 'Provider'} / {modelB || 'No model'} (temp: {tempB})
                        </span>
                      </div>

                      {/* Candidate B Error Banner with Retry */}
                      {errorB && (
                        <div className="p-2 rounded bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center justify-between gap-2 mt-1">
                          <div className="truncate" title={errorB}>
                            <span className="font-semibold">Error:</span> {errorB}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGenerateSingle('b')}
                            disabled={isGenerating}
                            className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[10px] font-bold shrink-0"
                          >
                            Retry Candidate B
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="min-h-[180px] text-xs leading-relaxed">
                      {editModeB ? (
                        <textarea
                          rows={8}
                          value={responseB}
                          onChange={e => setResponseB(e.target.value)}
                          placeholder="Type or paste Candidate Response B here..."
                          className="w-full p-2.5 rounded-lg bg-secondary/80 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        />
                      ) : responseB ? (
                        <div className="prose prose-invert prose-xs max-w-none break-words">
                          <ReactMarkdown>{responseB}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-muted-foreground italic p-4 text-center">
                          Click 'Edit' to write manually or click 'Generate Both'.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>{responseB.split(/\s+/).filter(Boolean).length} words</span>
                    <button
                      type="button"
                      onClick={() => handlePreference('b')}
                      disabled={!responseB.trim()}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm disabled:opacity-40 transition-all"
                    >
                      <ThumbsUp className="h-3 w-3" /> Prefer B (Key: B)
                    </button>
                  </div>
                </div>
              </div>

              {/* Preference Decision Toolbar */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Record Preference Decision:
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handlePreference('a')}
                      disabled={!responseA.trim()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        activeTask?.preference === 'a'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-secondary hover:bg-accent border-border text-foreground'
                      }`}
                    >
                      A is Better (A)
                    </button>

                    <button
                      onClick={() => handlePreference('b')}
                      disabled={!responseB.trim()}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        activeTask?.preference === 'b'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-secondary hover:bg-accent border-border text-foreground'
                      }`}
                    >
                      B is Better (B)
                    </button>

                    <button
                      onClick={() => handlePreference('tie')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        activeTask?.preference === 'tie'
                          ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                          : 'bg-secondary hover:bg-accent border-border text-foreground'
                      }`}
                    >
                      Tie (T)
                    </button>

                    <button
                      onClick={() => handlePreference('both_bad')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        activeTask?.preference === 'both_bad'
                          ? 'bg-destructive text-white border-destructive shadow-sm'
                          : 'bg-secondary hover:bg-accent border-border text-foreground'
                      }`}
                    >
                      Both Bad (X)
                    </button>

                    <button
                      onClick={() => handlePreference('skip')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        activeTask?.preference === 'skip'
                          ? 'bg-muted text-foreground border-border'
                          : 'bg-secondary hover:bg-accent border-border text-muted-foreground'
                      }`}
                    >
                      Skip (S)
                    </button>

                    <button
                      onClick={() => handlePreference('flag')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1 transition-all ${
                        activeTask?.preference === 'flag'
                          ? 'bg-rose-700 text-white border-rose-600'
                          : 'bg-secondary hover:bg-accent border-border text-rose-400'
                      }`}
                    >
                      <Flag className="h-3 w-3" /> Flag (F)
                    </button>
                  </div>
                </div>

                {/* Optional Annotation Rationale */}
                <div className="space-y-1.5 pt-2 border-t border-border/80">
                  <label className="text-xs font-semibold text-foreground">
                    Annotator Rationale / Feedback (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={rationale}
                    onChange={e => setRationale(e.target.value)}
                    placeholder="Document why chosen response was preferred (factual accuracy, brevity, helpfulness)..."
                    className="w-full p-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-xs text-muted-foreground p-8">
            <div className="space-y-3">
              <GitCompare className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p>No active DPO task selected. Click "New Task" to begin pairwise annotation.</p>
              <button
                onClick={() => handleNewTask()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                Create DPO Task
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
