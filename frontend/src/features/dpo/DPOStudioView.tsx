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

export const DPOStudioView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()
  const { providers, activeProviderId, activeModel, setActiveProviderId, setActiveModel } = useProviderStore()

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

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  useEffect(() => {
    initView()
  }, [activeProjectId])

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
  }, [activeTask, isGenerating, responseA, responseB, rationale, helpfulness, factuality])

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
      showFeedback('error', `Failed to load DPO tasks: ${err.message}`)
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
    setIsGenerating(true)
    try {
      // First save prompt/system prompt
      await updateDPOTask(activeTask.id, {
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim()
      })

      const res = await generateDPOPair({
        provider_id: activeProviderId,
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim(),
        temp_a: 0.7,
        temp_b: 0.95
      })

      setResponseA(res.response_a)
      setResponseB(res.response_b)
      setEditModeA(false)
      setEditModeB(false)

      const updated = await updateDPOTask(activeTask.id, {
        response_a: res.response_a,
        response_b: res.response_b,
        metadata: {
          model_a: res.model_a,
          model_b: res.model_b,
          latency_a: res.latency_a_ms,
          latency_b: res.latency_b_ms
        }
      })

      setActiveTask(updated)
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      showFeedback('success', 'Both candidate responses generated successfully.')
    } catch (err: any) {
      showFeedback('error', `Dual generation failed: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateSingle = async (target: 'a' | 'b') => {
    if (!activeTask || !prompt.trim() || isGenerating) return
    setIsGenerating(true)
    try {
      const temp = target === 'a' ? 0.7 : 0.95
      const res = await generateCompletion({
        provider_id: activeProviderId,
        model: activeModel,
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim(),
        temperature: temp
      })

      if (target === 'a') {
        setResponseA(res.content)
        setEditModeA(false)
        const updated = await updateDPOTask(activeTask.id, { response_a: res.content })
        setActiveTask(updated)
        setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      } else {
        setResponseB(res.content)
        setEditModeB(false)
        const updated = await updateDPOTask(activeTask.id, { response_b: res.content })
        setActiveTask(updated)
        setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      }
      showFeedback('success', `Candidate ${target.toUpperCase()} generated.`)
    } catch (err: any) {
      showFeedback('error', `Single turn generation failed: ${err.message}`)
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
      showFeedback('error', `Save failed: ${err.message}`)
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
          annotated_at: new Date().toISOString(),
          provider_id: activeProviderId,
          model: activeModel
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
      showFeedback('error', `Annotation failed: ${err.message}`)
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
      showFeedback('error', `Undo failed: ${err.message}`)
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
                    >
                      Regen A
                    </button>
                    <button
                      onClick={() => handleGenerateSingle('b')}
                      disabled={isGenerating || !prompt.trim()}
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                    >
                      Regen B
                    </button>
                    <button
                      onClick={handleGenerateBoth}
                      disabled={isGenerating || !prompt.trim()}
                      className="px-3 py-1 rounded text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-all"
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
                    <div className="flex items-center justify-between border-b border-border/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-primary">
                          Response A
                        </span>
                        {activeTask?.preference === 'a' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            CHOSEN
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditModeA(!editModeA)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground flex items-center gap-1"
                        >
                          {editModeA ? <Eye className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
                          {editModeA ? 'Preview' : 'Edit Text'}
                        </button>
                        <button
                          onClick={() => copyText(responseA, 'a')}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                          title="Copy Response A"
                        >
                          {copiedPanel === 'a' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
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
                          Click 'Edit Text' to write manually or click 'Generate Both'.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>{responseA.split(/\s+/).filter(Boolean).length} words</span>
                    <button
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
                    <div className="flex items-center justify-between border-b border-border/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-indigo-400">
                          Response B
                        </span>
                        {activeTask?.preference === 'b' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            CHOSEN
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditModeB(!editModeB)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground flex items-center gap-1"
                        >
                          {editModeB ? <Eye className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
                          {editModeB ? 'Preview' : 'Edit Text'}
                        </button>
                        <button
                          onClick={() => copyText(responseB, 'b')}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                          title="Copy Response B"
                        >
                          {copiedPanel === 'b' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
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
                          Click 'Edit Text' to write manually or click 'Generate Both'.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span>{responseB.split(/\s+/).filter(Boolean).length} words</span>
                    <button
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
