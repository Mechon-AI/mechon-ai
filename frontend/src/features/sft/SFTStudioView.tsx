import React, { useState, useEffect, useRef } from 'react'
import {
  MessageSquareCode,
  Plus,
  Send,
  Square,
  Sparkles,
  Edit2,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  CheckCircle,
  Sliders,
  ChevronDown,
  ChevronRight,
  BookmarkPlus,
  Tag,
  Search,
  ExternalLink,
  Layers,
  Cpu,
  X,
  AlertCircle,
  Languages,
  CheckCheck,
  ArrowRight
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProviderStore } from '../../stores/useProviderStore'
import {
  getSFTSessions,
  getSFTSession,
  createSFTSession,
  updateSFTSession,
  deleteSFTSession,
  duplicateSFTSession,
  addSFTMessage,
  updateSFTMessage,
  deleteSFTMessage,
  truncateSFTDownstream,
  commitSFTSession,
  generateCompletion,
  translateSFTSession,
  translateSFTMessage,
  updateSFTMessageTranslation,
  batchUpdateTranslationStatus
} from '../../services/api'
import type { SFTSession, SFTMessage } from '../../types'
import { formatErrorMessage } from '../../utils/errors'
import { LanguagePairSelector, LanguageIdentityBadge } from '../../components/language'
import { lookupLanguage, isRTL } from '../../types/languages'

export const SFTStudioView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()
  const { providers, activeProviderId, activeModel, setActiveProviderId, setActiveModel, fetchProviders } = useProviderStore()

  const [sessions, setSessions] = useState<SFTSession[]>([])
  const [activeSession, setActiveSession] = useState<SFTSession | null>(null)
  const [sessionSearch, setSessionSearch] = useState('')
  const [inputContent, setInputContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Bilingual & Review state
  const [studioMode, setStudioMode] = useState<'chat' | 'bilingual'>('chat')
  const [isTranslating, setIsTranslating] = useState(false)
  const [editingTranslationId, setEditingTranslationId] = useState<string | null>(null)
  const [translationEditText, setTranslationEditText] = useState('')
  const [isRegeneratingTurnId, setIsRegeneratingTurnId] = useState<string | null>(null)

  // Drawer / Param state
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [showParamsDrawer, setShowParamsDrawer] = useState(false)
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [commitTags, setCommitTags] = useState('dialogue, instruction')
  const [commitTitle, setCommitTitle] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  useEffect(() => {
    fetchProviders()
    initView()
  }, [activeProjectId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages, isGenerating])

  const initView = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (pId) {
      loadSessions(pId)
    }
  }

  const loadSessions = async (projectId?: string) => {
    const targetProject = projectId || activeProjectId
    if (!targetProject) return
    try {
      const list = await getSFTSessions(targetProject)
      setSessions(list)
      if (list.length > 0) {
        // If current active session not in list or null, pick first
        if (!activeSession || !list.some(s => s.id === activeSession.id)) {
          loadSessionDetails(list[0].id)
        }
      } else {
        // Create initial draft session if none exist
        handleNewSession(targetProject)
      }
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Could not load sessions'))
    }
  }

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const full = await getSFTSession(sessionId)
      setActiveSession(full)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to load conversation details'))
    }
  }

  const handleNewSession = async (projectId?: string) => {
    const targetProject = projectId || activeProjectId
    if (!targetProject) return
    try {
      const created = await createSFTSession({
        project_id: targetProject,
        title: 'New Conversation Draft',
        system_prompt: 'You are a helpful, respectful, and honest assistant.',
        provider_id: activeProviderId,
        model: activeModel,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2048
      })
      setSessions(prev => [created, ...prev])
      setActiveSession(created)
      showFeedback('success', 'New conversation draft created.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to create conversation'))
    }
  }

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this conversation draft?')) {
      try {
        await deleteSFTSession(sessionId)
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (activeSession?.id === sessionId) {
          const remaining = sessions.filter(s => s.id !== sessionId)
          if (remaining.length > 0) {
            loadSessionDetails(remaining[0].id)
          } else {
            setActiveSession(null)
          }
        }
        showFeedback('success', 'Conversation draft deleted.')
      } catch (err: any) {
        showFeedback('error', formatErrorMessage(err, 'Failed to delete session'))
      }
    }
  }

  const handleSendMessage = async (e?: React.FormEvent, retryUserText?: string) => {
    if (e) e.preventDefault()
    if (!activeSession || isGenerating) return

    const userText = retryUserText || inputContent.trim()
    if (!userText) return
    if (!retryUserText) setInputContent('')

    const pId = activeSession.provider_id || activeProviderId
    const targetModel = activeSession.model || activeModel

    if (!pId) {
      showFeedback('error', 'Please select an active provider before generating.')
      return
    }

    setIsGenerating(true)
    try {
      let currentMessages = activeSession.messages || []

      // If this is a new message (not retrying an existing user turn)
      if (!retryUserText) {
        const userMsg = await addSFTMessage(activeSession.id, {
          role: 'user',
          content: userText,
          model: targetModel
        })
        currentMessages = [...currentMessages, userMsg as SFTMessage]
        setActiveSession({ ...activeSession, messages: currentMessages, status: 'in_progress' })
      }

      // 2. Generate Assistant Response with full multi-turn history
      const history = currentMessages.map(m => ({ role: m.role, content: m.content }))

      const res = await generateCompletion({
        provider_id: pId,
        model: targetModel,
        prompt: userText,
        messages: history,
        system_prompt: activeSession.system_prompt,
        temperature: activeSession.temperature,
        top_p: activeSession.top_p,
        max_tokens: activeSession.max_tokens
      })

      const assistantText = res.content || 'No response generated.'

      // 3. Save Assistant Turn to Backend
      const assistantMsg = await addSFTMessage(activeSession.id, {
        role: 'assistant',
        content: assistantText,
        model: res.model || targetModel
      })

      setActiveSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, assistantMsg as SFTMessage]
      } : null)

      // Refresh session list status
      loadSessions()
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Generation failed'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEditSave = async (messageId: string) => {
    if (!editContent.trim()) return
    try {
      await updateSFTMessage(messageId, editContent.trim())
      if (activeSession) {
        await loadSessionDetails(activeSession.id)
      }
      setEditingMessageId(null)
      setEditContent('')
      showFeedback('success', 'Message updated.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to update message'))
    }
  }

  const handleRegenerateFrom = async (sequenceOrder: number) => {
    if (!activeSession) return
    try {
      // Truncate assistant response and any following turns
      await truncateSFTDownstream(activeSession.id, sequenceOrder)
      const refreshed = await getSFTSession(activeSession.id)
      setActiveSession(refreshed)

      // Trigger generation for the remaining conversation context
      const msgs = refreshed.messages || []
      const lastUser = [...msgs].reverse().find(m => m.role === 'user')
      if (lastUser) {
        setIsGenerating(true)
        const history = msgs.map(m => ({ role: m.role, content: m.content }))
        const res = await generateCompletion({
          provider_id: activeSession.provider_id || activeProviderId,
          model: activeSession.model || activeModel,
          prompt: lastUser.content,
          messages: history,
          system_prompt: activeSession.system_prompt,
          temperature: activeSession.temperature
        })
        const asstMsg = await addSFTMessage(activeSession.id, {
          role: 'assistant',
          content: res.content,
          model: activeSession.model
        })
        setActiveSession(prev => prev ? {
          ...prev,
          messages: [...prev.messages, asstMsg as SFTMessage]
        } : null)
      }
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Regeneration failed'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteSFTMessage(messageId)
      if (activeSession) {
        await loadSessionDetails(activeSession.id)
      }
      showFeedback('success', 'Turn deleted.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Delete failed'))
    }
  }

  const handleTranslateSession = async () => {
    if (!activeSession) return
    if (!activeSession.messages || activeSession.messages.length === 0) {
      showFeedback('error', 'No conversation turns to translate. Add user and assistant messages first.')
      return
    }

    const targetLang = activeSession.secondary_language || 'en'
    const pId = activeSession.provider_id || activeProviderId
    const targetModel = activeSession.model || activeModel

    setIsTranslating(true)
    try {
      const updated = await translateSFTSession({
        session_id: activeSession.id,
        target_language: targetLang,
        provider_id: pId,
        model: targetModel
      })
      setActiveSession(updated)
      setStudioMode('bilingual')
      showFeedback('success', `Conversation translated to ${targetLang.toUpperCase()} successfully. Review aligned turns below.`)
      loadSessions()
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Translation failed'))
    } finally {
      setIsTranslating(false)
    }
  }

  const handleTranslateSingleTurn = async (messageId: string) => {
    if (!activeSession) return
    const targetLang = activeSession.secondary_language || 'en'
    const pId = activeSession.provider_id || activeProviderId
    const targetModel = activeSession.model || activeModel

    setIsRegeneratingTurnId(messageId)
    try {
      const updatedMsg = await translateSFTMessage({
        session_id: activeSession.id,
        message_id: messageId,
        target_language: targetLang,
        provider_id: pId,
        model: targetModel
      })
      setActiveSession(prev => prev ? {
        ...prev,
        messages: prev.messages.map(m => m.id === messageId ? updatedMsg : m)
      } : null)
      showFeedback('success', 'Turn re-translated with context.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Turn translation failed'))
    } finally {
      setIsRegeneratingTurnId(null)
    }
  }

  const handleApproveTurn = async (messageId: string, content?: string) => {
    if (!activeSession) return
    const targetLang = activeSession.secondary_language || 'en'
    const msg = activeSession.messages.find(m => m.id === messageId)
    const text = content !== undefined ? content : (msg?.translations?.[targetLang] || '')

    try {
      await updateSFTMessageTranslation({
        message_id: messageId,
        target_language: targetLang,
        content: text,
        status: 'approved'
      })
      await loadSessionDetails(activeSession.id)
      showFeedback('success', 'Turn translation approved.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Approval failed'))
    }
  }

  const handleApproveAllTurns = async () => {
    if (!activeSession) return
    const targetLang = activeSession.secondary_language || 'en'
    try {
      const updated = await batchUpdateTranslationStatus({
        session_id: activeSession.id,
        target_language: targetLang,
        status: 'approved'
      })
      setActiveSession(updated)
      showFeedback('success', 'All turns approved!')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Bulk approval failed'))
    }
  }

  const handleCommitConfirm = async () => {
    if (!activeSession) return
    if (!activeSession.messages || activeSession.messages.length === 0) {
      showFeedback('error', 'Cannot commit an empty conversation. Add at least one turn.')
      return
    }

    setIsCommitting(true)
    try {
      const tagsArray = commitTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const isBilingual = activeSession.language_mode === 'bilingual' ||
        activeSession.messages.some(m => m.translations && Object.keys(m.translations).length > 0)

      const record = await commitSFTSession(activeSession.id, {
        title_override: commitTitle.trim() || activeSession.title,
        tags: tagsArray,
        metadata: {
          model: activeSession.model || activeModel,
          provider_id: activeSession.provider_id || activeProviderId,
          temperature: activeSession.temperature,
          language_mode: isBilingual ? 'bilingual' : 'monolingual',
          primary_language: activeSession.primary_language || 'id',
          secondary_language: activeSession.secondary_language || 'en'
        }
      })

      showFeedback('success', `Committed conversation as SFT record #${record.id.slice(0, 8)}!`)
      setShowCommitModal(false)
      await loadSessions()
      await loadSessionDetails(activeSession.id)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Commit failed'))
    } finally {
      setIsCommitting(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(sessionSearch.toLowerCase())
  )

  const activeProvider = providers.find(p => p.id === (activeSession?.provider_id || activeProviderId))

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sessions Drawer */}
      <aside className="w-72 border-r border-border bg-card/40 flex flex-col shrink-0 select-none">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conversations</span>
            <button
              onClick={() => handleNewSession()}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs flex items-center gap-1 shadow-sm font-semibold transition-all"
              title="New SFT Chat"
            >
              <Plus className="h-3.5 w-3.5" /> New Chat
            </button>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter sessions..."
              value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredSessions.map(s => {
            const isSelected = activeSession?.id === s.id
            const isCommitted = s.status === 'committed'
            return (
              <div
                key={s.id}
                onClick={() => loadSessionDetails(s.id)}
                className={`p-2.5 rounded-lg text-xs cursor-pointer border transition-all space-y-1 group ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                    : 'bg-card/50 hover:bg-secondary/60 border-border/50 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium truncate text-foreground text-xs flex-1">{s.title}</span>
                  <div className="flex items-center gap-1">
                    {isCommitted ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        COMMITTED
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-accent text-muted-foreground">
                        DRAFT
                      </span>
                    )}
                    <button
                      onClick={e => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                      title="Delete Draft"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span className="truncate max-w-[120px]">{s.model || 'mock-llama-3-8b'}</span>
                  <span>{s.messages ? s.messages.length : 0} turns</span>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main Conversation Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {activeSession ? (
          <>
            {/* Conversation Header Bar */}
            <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card/40 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <input
                  type="text"
                  value={activeSession.title}
                  onChange={e => {
                    const updated = { ...activeSession, title: e.target.value }
                    setActiveSession(updated)
                    updateSFTSession(activeSession.id, { title: e.target.value })
                  }}
                  className="font-bold text-sm bg-transparent hover:bg-secondary/50 px-2 py-1 rounded border border-transparent hover:border-border focus:border-primary focus:outline-none transition-all truncate max-w-xs"
                />

                {/* Workspace Mode Switcher */}
                <div className="flex items-center rounded-lg bg-secondary p-0.5 border border-border shrink-0">
                  <button
                    onClick={() => setStudioMode('chat')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                      studioMode === 'chat'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageSquareCode className="h-3.5 w-3.5" /> Chat
                  </button>
                  <button
                    onClick={() => setStudioMode('bilingual')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                      studioMode === 'bilingual'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-cyan-400'
                    }`}
                  >
                    <Languages className="h-3.5 w-3.5" /> Bilingual Review
                  </button>
                </div>

                {activeSession.status === 'committed' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                    <CheckCircle className="h-3 w-3" /> COMMITTED TO SFT
                  </span>
                )}
              </div>

              {/* Provider & Parameter Controls */}
              <div className="flex items-center gap-2">
                {/* Provider & Model Selectors */}
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-secondary/60 border border-border text-xs">
                  <Cpu className="h-3.5 w-3.5 text-primary ml-1" />
                  <select
                    value={activeSession.provider_id || activeProviderId}
                    onChange={e => {
                      const pId = e.target.value
                      setActiveProviderId(pId)
                      const targetP = providers.find(p => p.id === pId)
                      const newModel = targetP?.default_model || (targetP?.models_cache && targetP.models_cache[0]) || 'default'
                      setActiveSession(prev => prev ? { ...prev, provider_id: pId, model: newModel } : null)
                      updateSFTSession(activeSession.id, { provider_id: pId, model: newModel })
                    }}
                    className="bg-transparent text-foreground border-none text-[11px] focus:outline-none cursor-pointer"
                  >
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <span className="text-muted-foreground/60">•</span>

                  <select
                    value={activeSession.model || activeModel}
                    onChange={e => {
                      const m = e.target.value
                      setActiveModel(m)
                      setActiveSession(prev => prev ? { ...prev, model: m } : null)
                      updateSFTSession(activeSession.id, { model: m })
                    }}
                    className="bg-transparent text-foreground font-mono text-[11px] border-none focus:outline-none cursor-pointer max-w-[140px] truncate"
                  >
                    {activeProvider?.models_cache && activeProvider.models_cache.length > 0 ? (
                      activeProvider.models_cache.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))
                    ) : (
                      <option value={activeSession.model || activeModel}>{activeSession.model || activeModel}</option>
                    )}
                  </select>
                </div>

                <button
                  onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    showSystemPrompt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary hover:bg-accent border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="Edit System Instructions"
                >
                  System Prompt
                </button>

                <button
                  onClick={() => {
                    setCommitTitle(activeSession.title)
                    setShowCommitModal(true)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Commit conversation as atomic SFT dataset record"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" /> Commit to Dataset
                </button>
              </div>
            </div>

            {/* Bilingual Configuration Strip */}
            <div className="px-6 py-2 border-b border-border bg-card/60 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-cyan-400" />
                <span className="font-semibold text-muted-foreground text-[11px]">Bilingual Workflow:</span>

                <LanguagePairSelector
                  primaryLanguage={activeSession.primary_language || 'id'}
                  secondaryLanguage={activeSession.secondary_language || 'en'}
                  onPrimaryChange={(code) => {
                    setActiveSession(prev => prev ? { ...prev, primary_language: code } : null)
                    updateSFTSession(activeSession.id, { primary_language: code })
                  }}
                  onSecondaryChange={(code) => {
                    setActiveSession(prev => prev ? { ...prev, secondary_language: code } : null)
                    updateSFTSession(activeSession.id, { secondary_language: code })
                  }}
                  onSwap={() => {
                    const curP = activeSession.primary_language || 'id'
                    const curS = activeSession.secondary_language || 'en'
                    setActiveSession(prev => prev ? { ...prev, primary_language: curS, secondary_language: curP } : null)
                    updateSFTSession(activeSession.id, { primary_language: curS, secondary_language: curP })
                  }}
                  compact
                />

                <button
                  onClick={handleTranslateSession}
                  disabled={isTranslating || !activeSession.messages || activeSession.messages.length === 0}
                  className="ml-2 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-[11px] flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                  title="Translate entire conversation context-aware to target language"
                >
                  <RefreshCw className={`h-3 w-3 ${isTranslating ? 'animate-spin' : ''}`} />
                  {isTranslating ? 'Translating Turns...' : 'Generate Translation'}
                </button>
              </div>

              {/* Progress counter & bulk actions in Bilingual Review mode */}
              {studioMode === 'bilingual' && activeSession.messages && activeSession.messages.length > 0 && (() => {
                const secLang = activeSession.secondary_language || 'en'
                const approvedCount = activeSession.messages.filter(m => m.translation_status?.[secLang] === 'approved').length
                const totalCount = activeSession.messages.length
                const percent = Math.round((approvedCount / totalCount) * 100)

                return (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Approved: <strong className="text-foreground">{approvedCount}</strong>/{totalCount} ({percent}%)
                      </span>
                      <div className="w-20 h-2 rounded-full bg-secondary overflow-hidden border border-border">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleApproveAllTurns}
                      className="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 border border-border text-[11px] font-semibold text-foreground flex items-center gap-1 cursor-pointer"
                      title="Mark all translated turns as approved"
                    >
                      <CheckCheck className="h-3 w-3 text-emerald-400" />
                      Approve All Turns
                    </button>
                  </div>
                )
              })()}
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

            {/* System Prompt Collapsible Banner */}
            {showSystemPrompt && (
              <div className="p-4 border-b border-border bg-card/60 backdrop-blur-sm space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">System Instructions</span>
                  <span className="text-[10px]">Applied at generation start</span>
                </div>
                <textarea
                  rows={2}
                  value={activeSession.system_prompt}
                  onChange={e => {
                    const updated = { ...activeSession, system_prompt: e.target.value }
                    setActiveSession(updated)
                    updateSFTSession(activeSession.id, { system_prompt: e.target.value })
                  }}
                  className="w-full p-2.5 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter system prompt for model behavior..."
                />
              </div>
            )}

            {/* Content Area: Chat Mode vs Side-by-Side Bilingual Review Mode */}
            {studioMode === 'chat' ? (
              <>
                {/* Messages Chat Flow */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {activeSession.messages && activeSession.messages.length > 0 ? (
                    activeSession.messages.map((m, index) => {
                      const isUser = m.role === 'user'
                      const isEditing = editingMessageId === m.id

                      return (
                        <div
                          key={m.id || index}
                          className={`flex flex-col gap-1.5 group max-w-4xl mx-auto ${
                            isUser ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                            <span className="font-bold uppercase tracking-wider font-mono">
                              {isUser ? 'USER' : `ASSISTANT (${m.model || activeSession.model || 'model'})`}
                            </span>
                            <span>•</span>
                            <span>Turn {index + 1}</span>
                            {m.translations && Object.keys(m.translations).length > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 text-[9px] font-bold">
                                Translated
                              </span>
                            )}
                          </div>

                          <div
                            className={`relative rounded-2xl p-4 text-xs leading-relaxed max-w-[85%] border shadow-sm transition-all ${
                              isUser
                                ? 'bg-primary text-primary-foreground border-primary/40'
                                : 'bg-card text-foreground border-border'
                            }`}
                          >
                            {isEditing ? (
                              <div className="space-y-2 min-w-[320px]">
                                <textarea
                                  rows={4}
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  className="w-full p-2.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-2.5 py-1 rounded text-[11px] hover:bg-secondary border border-border"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleEditSave(m.id)}
                                    className="px-3 py-1 rounded text-[11px] font-bold bg-primary text-primary-foreground shadow-sm"
                                  >
                                    Save Turn
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="prose prose-invert prose-xs max-w-none break-words">
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                              </div>
                            )}

                            {/* Floating Turn Action Toolbar */}
                            {!isEditing && (
                              <div className="absolute right-2 -bottom-3.5 hidden group-hover:flex items-center gap-1 bg-card border border-border rounded-lg shadow-md px-1.5 py-0.5 text-muted-foreground text-[10px]">
                                <button
                                  onClick={() => copyToClipboard(m.content, m.id)}
                                  className="p-1 hover:text-foreground hover:bg-secondary rounded"
                                  title="Copy Turn Content"
                                >
                                  {copiedId === m.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMessageId(m.id)
                                    setEditContent(m.content)
                                  }}
                                  className="p-1 hover:text-foreground hover:bg-secondary rounded"
                                  title="Edit Turn"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                {!isUser && (
                                  <button
                                    onClick={() => handleRegenerateFrom(m.sequence_order)}
                                    className="p-1 hover:text-primary hover:bg-secondary rounded"
                                    title="Regenerate from this turn"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteMessage(m.id)}
                                  className="p-1 hover:text-destructive hover:bg-destructive/10 rounded"
                                  title="Delete Turn"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center text-center text-xs text-muted-foreground py-16">
                      <div className="space-y-2 max-w-md">
                        <MessageSquareCode className="h-10 w-10 text-primary/40 mx-auto" />
                        <h3 className="font-bold text-foreground text-sm">Empty Conversation Draft</h3>
                        <p className="leading-relaxed">
                          Type your prompt below to start building this multi-turn demonstration. Then use "Generate Translation" to create an aligned bilingual dataset.
                        </p>
                      </div>
                    </div>
                  )}

                  {isGenerating && (
                    <div className="flex items-center gap-2 text-xs text-primary animate-pulse p-4 max-w-4xl mx-auto">
                      <Sparkles className="h-4 w-4 animate-spin" />
                      <span>Model is generating completion...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input Bar */}
                <div className="p-4 border-t border-border bg-card/40 shrink-0">
                  {activeSession.messages &&
                    activeSession.messages.length > 0 &&
                    activeSession.messages[activeSession.messages.length - 1].role === 'user' &&
                    !isGenerating && (
                      <div className="max-w-4xl mx-auto mb-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5" /> Last user turn has no assistant response.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const lastUserMsg = activeSession.messages[activeSession.messages.length - 1]
                            handleSendMessage(undefined, lastUserMsg.content)
                          }}
                          className="px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" /> Retry Generation
                        </button>
                      </div>
                    )}

                  <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto flex items-end gap-2">
                    <textarea
                      rows={2}
                      value={inputContent}
                      onChange={e => setInputContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      placeholder="Type user message (Enter to send, Shift+Enter for newline)..."
                      className="flex-1 p-3 rounded-xl bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />

                    <button
                      type="submit"
                      disabled={isGenerating || !inputContent.trim()}
                      className="h-10 px-5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                    >
                      {isGenerating ? <Square className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              /* Side-by-Side Bilingual Review Interface */
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="max-w-5xl mx-auto space-y-4">
                  {(() => {
                    const pLang = lookupLanguage(activeSession.primary_language || 'id')
                    const sLang = lookupLanguage(activeSession.secondary_language || 'en')
                    return (
                      <div className="grid grid-cols-2 gap-4 border-b border-border pb-2 text-xs font-bold uppercase tracking-wider">
                        <span className="text-primary flex items-center gap-1.5">
                          Primary ({pLang.name} - {pLang.code.toUpperCase()})
                          {pLang.rtl && <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono">RTL</span>}
                        </span>
                        <span className="text-cyan-400 flex items-center gap-1.5">
                          Translation ({sLang.name} - {sLang.code.toUpperCase()})
                          {sLang.rtl && <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono">RTL</span>}
                        </span>
                      </div>
                    )
                  })()}

                  {activeSession.messages && activeSession.messages.length > 0 ? (
                    activeSession.messages.map((m, index) => {
                      const secLang = activeSession.secondary_language || 'en'
                      const transText = m.translations?.[secLang] || (m.translations ? Object.values(m.translations)[0] : '')
                      const status = (m.translation_status?.[secLang] || 'pending').toLowerCase()
                      const isEditing = editingTranslationId === m.id
                      const isRegenerating = isRegeneratingTurnId === m.id
                      const pInfo = lookupLanguage(activeSession.primary_language || 'id')
                      const sInfo = lookupLanguage(secLang)

                      return (
                        <div key={m.id || index} className="grid grid-cols-2 gap-4 items-start">
                          {/* Left: Original Primary Message */}
                          <div className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs shadow-sm">
                            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase border-b border-border/60 pb-1">
                              <span className="font-bold text-foreground">{m.role}</span>
                              <span>Turn {index + 1}</span>
                            </div>
                            <div
                              dir={pInfo.rtl ? 'rtl' : 'ltr'}
                              className={`prose prose-invert prose-xs max-w-none break-words ${
                                pInfo.rtl ? 'text-right' : 'text-left'
                              }`}
                            >
                              <ReactMarkdown>{m.content}</ReactMarkdown>
                            </div>
                          </div>

                          {/* Right: Aligned Translation Card */}
                          <div className="p-4 rounded-xl bg-card border border-cyan-500/30 space-y-3 text-xs shadow-sm">
                            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase border-b border-border/60 pb-1">
                              <span className="font-bold text-cyan-400">{m.role} ({sInfo.code.toUpperCase()})</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  status === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : status === 'generated'
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    : status === 'edited'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-secondary text-muted-foreground'
                                }`}
                              >
                                {status}
                              </span>
                            </div>

                            {isEditing ? (
                              <div className="space-y-2">
                                <textarea
                                  rows={4}
                                  value={translationEditText}
                                  onChange={e => setTranslationEditText(e.target.value)}
                                  dir={sInfo.rtl ? 'rtl' : 'ltr'}
                                  className={`w-full p-2.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary ${
                                    sInfo.rtl ? 'text-right' : 'text-left'
                                  }`}
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setEditingTranslationId(null)}
                                    className="px-2.5 py-1 rounded text-[11px] border border-border hover:bg-secondary cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await handleApproveTurn(m.id, translationEditText)
                                      setEditingTranslationId(null)
                                    }}
                                    className="px-3 py-1 rounded text-[11px] font-bold bg-primary text-primary-foreground shadow-sm cursor-pointer"
                                  >
                                    Save & Approve
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                dir={sInfo.rtl ? 'rtl' : 'ltr'}
                                className={`prose prose-invert prose-xs max-w-none break-words min-h-[40px] ${
                                  sInfo.rtl ? 'text-right' : 'text-left'
                                }`}
                              >
                                {transText ? (
                                  <ReactMarkdown>{transText}</ReactMarkdown>
                                ) : (
                                  <span className="text-muted-foreground italic">
                                    No translation generated for this turn yet. Click "Regenerate Turn" or "Generate Translation".
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Action Buttons for Turn */}
                            {!isEditing && (
                              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingTranslationId(m.id)
                                      setTranslationEditText(transText)
                                    }}
                                    className="px-2 py-1 rounded bg-secondary hover:bg-accent border border-border text-foreground flex items-center gap-1 cursor-pointer"
                                    title="Edit translated text"
                                  >
                                    <Edit2 className="h-3 w-3" /> Edit
                                  </button>
                                  <button
                                    onClick={() => handleTranslateSingleTurn(m.id)}
                                    disabled={isRegenerating}
                                    className="px-2 py-1 rounded bg-secondary hover:bg-accent border border-border text-foreground flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                    title="Regenerate single turn translation in context"
                                  >
                                    <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin text-cyan-400' : ''}`} />
                                    Regenerate
                                  </button>
                                </div>

                                {status !== 'approved' && transText && (
                                  <button
                                    onClick={() => handleApproveTurn(m.id)}
                                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
                                    title="Approve turn translation"
                                  >
                                    <Check className="h-3 w-3" /> Approve
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="p-12 text-center text-xs text-muted-foreground">
                      No messages to review. Add conversation turns in Chat mode first.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-xs text-muted-foreground p-8">
            <div className="space-y-3">
              <MessageSquareCode className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p>No active conversation. Select a session or click New Chat to start.</p>
              <button
                onClick={() => handleNewSession()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              >
                Create New Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Commit Session Modal */}
      {showCommitModal && activeSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Commit Session to SFT Dataset</h3>
                <p className="text-xs text-muted-foreground">
                  The entire conversation ({activeSession.messages.length} turns) will commit as EXACTLY ONE atomic SFT dataset record.
                </p>
              </div>
              <button onClick={() => setShowCommitModal(false)} className="p-1 rounded-lg hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Record Title</label>
                <input
                  type="text"
                  value={commitTitle}
                  onChange={e => setCommitTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={commitTags}
                  onChange={e => setCommitTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. reasoning, customer-support, bilingual"
                />
              </div>

              <div className="p-3 rounded-lg bg-secondary/40 border border-border/80 text-[11px] space-y-1 font-mono text-muted-foreground">
                <div>Model: {activeSession.model || activeModel}</div>
                <div>Turns: {activeSession.messages.length} messages (Canonical ChatML Schema)</div>
                <div className="flex items-center gap-2">
                  <span>Language Alignment:</span>
                  <LanguageIdentityBadge
                    primaryLanguage={activeSession.primary_language || 'id'}
                    secondaryLanguage={activeSession.secondary_language || 'en'}
                    mode={activeSession.language_mode || 'bilingual'}
                  />
                </div>
                <div>Commit Destination: Project SFT Corpus (1 Atomic Record)</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCommitModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium hover:bg-secondary border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitConfirm}
                disabled={isCommitting}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <BookmarkPlus className="h-4 w-4" />
                {isCommitting ? 'Committing...' : 'Confirm & Commit Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
