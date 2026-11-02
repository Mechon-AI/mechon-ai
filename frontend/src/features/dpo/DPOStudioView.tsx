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
  RotateCcw
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProviderStore } from '../../stores/useProviderStore'
import {
  getDPOTasks,
  createDPOTask,
  annotateDPOTask,
  undoLastDPOAnnotation,
  generateDPOPair,
  generateCompletion
} from '../../services/api'
import type { DPOTask } from '../../types'

export const DPOStudioView: React.FC = () => {
  const { activeProjectId } = useProjectStore()
  const { activeProviderId, activeModel } = useProviderStore()

  const [tasks, setTasks] = useState<DPOTask[]>([])
  const [activeTask, setActiveTask] = useState<DPOTask | null>(null)
  const [prompt, setPrompt] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, factual, and concise assistant.')
  const [responseA, setResponseA] = useState('')
  const [responseB, setResponseB] = useState('')
  const [rationale, setRationale] = useState('')
  const [helpfulness, setHelpfulness] = useState(5)
  const [factuality, setFactuality] = useState(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedPanel, setCopiedPanel] = useState<'a' | 'b' | null>(null)

  useEffect(() => {
    if (activeProjectId) {
      loadTasks()
    }
  }, [activeProjectId])

  // Setup Keyboard Shortcuts (A, B, T, X, S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an input or textarea
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
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTask, isGenerating, responseA, responseB, rationale, helpfulness, factuality])

  const loadTasks = async () => {
    if (!activeProjectId) return
    try {
      const res = await getDPOTasks(activeProjectId)
      setTasks(res.tasks)
      if (res.tasks.length > 0) {
        selectTask(res.tasks[0])
      } else {
        handleNewTask()
      }
    } catch {
      // ignore
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
  }

  const handleNewTask = async () => {
    if (!activeProjectId) return
    const newTask = await createDPOTask({
      project_id: activeProjectId,
      prompt: 'Explain how Direct Preference Optimization aligns LLMs.',
      system_prompt: 'You are an AI alignment researcher.',
      response_a: '',
      response_b: ''
    })
    setTasks(prev => [newTask, ...prev])
    selectTask(newTask)
  }

  const handleGenerateBoth = async () => {
    if (!activeTask || !prompt.trim() || isGenerating) return
    setIsGenerating(true)
    try {
      const res = await generateDPOPair({
        provider_id: activeProviderId,
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim(),
        temp_a: 0.7,
        temp_b: 0.95
      })

      setResponseA(res.response_a)
      setResponseB(res.response_b)
      setActiveTask(prev => prev ? {
        ...prev,
        prompt: prompt.trim(),
        response_a: res.response_a,
        response_b: res.response_b
      } : null)
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateSingle = async (target: 'a' | 'b') => {
    if (!activeTask || !prompt.trim() || isGenerating) return
    setIsGenerating(true)
    try {
      const res = await generateCompletion({
        provider_id: activeProviderId,
        model: activeModel,
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim(),
        temperature: target === 'a' ? 0.7 : 0.95
      })

      if (target === 'a') {
        setResponseA(res.content)
      } else {
        setResponseB(res.content)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePreference = async (pref: string) => {
    if (!activeTask) return
    try {
      const updated = await annotateDPOTask(activeTask.id, {
        preference: pref,
        rationale: rationale.trim(),
        helpfulness_rating: helpfulness,
        factuality_rating: factuality,
        metadata: {
          prompt,
          response_a: responseA,
          response_b: responseB
        }
      })

      // Update in task list
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))
      setActiveTask(updated)

      // Move to next pending task or create new
      const nextPending = tasks.find(t => t.id !== updated.id && t.status === 'pending')
      if (nextPending) {
        selectTask(nextPending)
      }
    } catch (err: any) {
      alert(`Failed to save preference: ${err.message}`)
    }
  }

  const handleUndo = async () => {
    if (!activeProjectId) return
    try {
      const undone = await undoLastDPOAnnotation(activeProjectId)
      setTasks(prev => prev.map(t => (t.id === undone.id ? undone : t)))
      selectTask(undone)
    } catch (err: any) {
      alert(`Undo failed: ${err.message}`)
    }
  }

  const copyText = (text: string, panel: 'a' | 'b') => {
    navigator.clipboard.writeText(text)
    setCopiedPanel(panel)
    setTimeout(() => setCopiedPanel(null), 2000)
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Center DPO Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Header Bar */}
        <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card/40 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-primary" /> Direct Preference Optimization Studio
            </h2>
            {activeTask?.status === 'completed' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PREFERENCE: {activeTask.preference?.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-secondary hover:bg-secondary/80 border border-border flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              title="Undo last recorded preference"
            >
              <Undo2 className="h-3.5 w-3.5" /> Undo Last
            </button>
            <button
              onClick={handleNewTask}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> New Task
            </button>
          </div>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Prompt Section */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                Evaluation Prompt
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerateSingle('a')}
                  disabled={isGenerating || !prompt.trim()}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Regen A
                </button>
                <button
                  onClick={() => handleGenerateSingle('b')}
                  disabled={isGenerating || !prompt.trim()}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Regen B
                </button>
                <button
                  onClick={handleGenerateBoth}
                  disabled={isGenerating || !prompt.trim()}
                  className="px-3 py-1 rounded text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Generate Both
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
                  <span className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                    Response A (Temp 0.7)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyText(responseA, 'a')}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      {copiedPanel === 'a' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                <div className="min-h-[160px] text-xs leading-relaxed prose prose-invert prose-xs max-w-none">
                  {responseA ? (
                    <ReactMarkdown>{responseA}</ReactMarkdown>
                  ) : (
                    <span className="text-muted-foreground italic">Click 'Generate Both' or enter Response A...</span>
                  )}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>{responseA.split(/\s+/).filter(Boolean).length} words</span>
                <button
                  onClick={() => handlePreference('a')}
                  disabled={!responseA || !responseB}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm disabled:opacity-40"
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
                  <span className="font-bold text-xs uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    Response B (Temp 0.95)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyText(responseB, 'b')}
                      className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      {copiedPanel === 'b' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                <div className="min-h-[160px] text-xs leading-relaxed prose prose-invert prose-xs max-w-none">
                  {responseB ? (
                    <ReactMarkdown>{responseB}</ReactMarkdown>
                  ) : (
                    <span className="text-muted-foreground italic">Click 'Generate Both' or enter Response B...</span>
                  )}
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>{responseB.split(/\s+/).filter(Boolean).length} words</span>
                <button
                  onClick={() => handlePreference('b')}
                  disabled={!responseA || !responseB}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm disabled:opacity-40"
                >
                  <ThumbsUp className="h-3 w-3" /> Prefer B (Key: B)
                </button>
              </div>
            </div>
          </div>

          {/* Preference Decision Bar & Metadata */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Preference Decision:
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handlePreference('a')}
                  disabled={!responseA || !responseB}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    activeTask?.preference === 'a'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-secondary hover:bg-accent border-border text-foreground'
                  }`}
                >
                  A is Better (A)
                </button>

                <button
                  onClick={() => handlePreference('b')}
                  disabled={!responseA || !responseB}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    activeTask?.preference === 'b'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-secondary hover:bg-accent border-border text-foreground'
                  }`}
                >
                  B is Better (B)
                </button>

                <button
                  onClick={() => handlePreference('tie')}
                  disabled={!responseA || !responseB}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    activeTask?.preference === 'tie'
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-secondary hover:bg-accent border-border text-foreground'
                  }`}
                >
                  Tie (T)
                </button>

                <button
                  onClick={() => handlePreference('both_bad')}
                  disabled={!responseA || !responseB}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    activeTask?.preference === 'both_bad'
                      ? 'bg-destructive text-white border-destructive'
                      : 'bg-secondary hover:bg-accent border-border text-foreground'
                  }`}
                >
                  Both Bad (X)
                </button>

                <button
                  onClick={() => handlePreference('skip')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-accent border border-border text-muted-foreground"
                >
                  Skip (S)
                </button>
              </div>
            </div>

            {/* Rationale Input */}
            <div className="space-y-1.5 pt-2 border-t border-border/80">
              <label className="text-xs font-medium text-muted-foreground">Annotation Rationale / Reason</label>
              <input
                type="text"
                placeholder="Explain why one response was chosen over the other..."
                value={rationale}
                onChange={e => setRationale(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Task Queue Drawer */}
      <aside className="w-72 border-l border-border bg-card/40 flex flex-col shrink-0 select-none">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">DPO Task Queue</span>
          <span className="text-[10px] text-muted-foreground font-mono">{tasks.length} tasks</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tasks.map(t => {
            const isSelected = activeTask?.id === t.id
            const isDone = t.status === 'completed'
            return (
              <div
                key={t.id}
                onClick={() => selectTask(t)}
                className={`p-2.5 rounded-lg text-xs cursor-pointer border transition-all space-y-1 ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                    : 'bg-card/50 hover:bg-secondary/60 border-border/50 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium truncate text-foreground text-xs">{t.prompt}</span>
                  {isDone ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                      {t.preference}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-accent text-muted-foreground">
                      PENDING
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
