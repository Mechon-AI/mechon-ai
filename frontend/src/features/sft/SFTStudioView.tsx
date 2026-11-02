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
  Layers
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
  generateCompletion
} from '../../services/api'
import type { SFTSession, SFTMessage } from '../../types'

export const SFTStudioView: React.FC = () => {
  const { activeProjectId } = useProjectStore()
  const { providers, activeProviderId, activeModel } = useProviderStore()

  const [sessions, setSessions] = useState<SFTSession[]>([])
  const [activeSession, setActiveSession] = useState<SFTSession | null>(null)
  const [sessionSearch, setSessionSearch] = useState('')
  const [inputContent, setInputContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Drawer / Param state
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [commitTags, setCommitTags] = useState('math, reasoning')
  const [commitTitle, setCommitTitle] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitSuccessMessage, setCommitSuccessMessage] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeProjectId) {
      loadSessions()
    }
  }, [activeProjectId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages, isGenerating])

  const loadSessions = async () => {
    if (!activeProjectId) return
    try {
      const list = await getSFTSessions(activeProjectId)
      setSessions(list)
      if (list.length > 0) {
        // If current active session not in list or null, pick first
        if (!activeSession || !list.some(s => s.id === activeSession.id)) {
          loadSessionDetails(list[0].id)
        }
      } else {
        // Create initial draft session if none exist
        handleNewSession()
      }
    } catch {
      // ignore
    }
  }

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const full = await getSFTSession(sessionId)
      setActiveSession(full)
    } catch {
      // ignore
    }
  }

  const handleNewSession = async () => {
    if (!activeProjectId) return
    const created = await createSFTSession({
      project_id: activeProjectId,
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
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputContent.trim() || !activeSession || isGenerating) return

    const userText = inputContent.trim()
    setInputContent('')

    // 1. Save User Turn to Backend
    const userMsg = await addSFTMessage(activeSession.id, {
      role: 'user',
      content: userText,
      model: activeSession.model
    })

    // Update activeSession state immediately
    const updatedMessages = [...(activeSession.messages || []), userMsg as SFTMessage]
    setActiveSession({ ...activeSession, messages: updatedMessages, status: 'in_progress' })

    // 2. Generate Assistant Response
    setIsGenerating(true)
    try {
      const history = updatedMessages.map(m => ({ role: m.role, content: m.content }))
      const res = await generateCompletion({
        provider_id: activeSession.provider_id || activeProviderId,
        model: activeSession.model || activeModel,
        prompt: userText,
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
        model: activeSession.model
      })

      setActiveSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, assistantMsg as SFTMessage]
      } : null)
      
      // Refresh session list status
      loadSessions()
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEditSave = async (messageId: string) => {
    if (!editContent.trim()) return
    await updateSFTMessage(messageId, editContent.trim())
    if (activeSession) {
      loadSessionDetails(activeSession.id)
    }
    setEditingMessageId(null)
    setEditContent('')
  }

  const handleRegenerateFrom = async (sequenceOrder: number) => {
    if (!activeSession) return
    // Truncate assistant response and any following turns
    await truncateSFTDownstream(activeSession.id, sequenceOrder)
    const refreshed = await getSFTSession(activeSession.id)
    setActiveSession(refreshed)

    // Trigger generation for the last user turn
    const msgs = refreshed.messages || []
    const lastUser = [...msgs].reverse().find(m => m.role === 'user')
    if (lastUser) {
      setIsGenerating(true)
      try {
        const res = await generateCompletion({
          provider_id: activeSession.provider_id || activeProviderId,
          model: activeSession.model || activeModel,
          prompt: lastUser.content,
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
      } finally {
        setIsGenerating(false)
      }
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    await deleteSFTMessage(messageId)
    if (activeSession) {
      loadSessionDetails(activeSession.id)
    }
  }

  const handleCommitConfirm = async () => {
    if (!activeSession) return
    setIsCommitting(true)
    setCommitSuccessMessage(null)
    try {
      const tagsArray = commitTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const record = await commitSFTSession(activeSession.id, {
        title_override: commitTitle.trim() || activeSession.title,
        tags: tagsArray,
        metadata: {
          model: activeSession.model,
          temperature: activeSession.temperature
        }
      })

      setCommitSuccessMessage(`Successfully committed conversation as SFT record #${record.id.slice(0, 8)}!`)
      setShowCommitModal(false)
      loadSessions()
      loadSessionDetails(activeSession.id)
    } catch (err: any) {
      alert(`Commit failed: ${err.message}`)
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

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sessions Drawer */}
      <aside className="w-72 border-r border-border bg-card/40 flex flex-col shrink-0 select-none">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conversations</span>
            <button
              onClick={handleNewSession}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs flex items-center gap-1 shadow-sm"
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
                className={`p-2.5 rounded-lg text-xs cursor-pointer border transition-all space-y-1 ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                    : 'bg-card/50 hover:bg-secondary/60 border-border/50 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium truncate text-foreground text-xs">{s.title}</span>
                  {isCommitted ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      COMMITTED
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-accent text-muted-foreground">
                      DRAFT
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{s.model || 'mock-llama-3-8b'}</span>
                  <span>{s.messages ? s.messages.length : 0} turns</span>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main Conversation Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background/30">
        {activeSession ? (
          <>
            {/* Conversation Header Bar */}
            <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card/40 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={activeSession.title}
                  onChange={e => {
                    const updated = { ...activeSession, title: e.target.value }
                    setActiveSession(updated)
                    updateSFTSession(activeSession.id, { title: e.target.value })
                  }}
                  className="font-bold text-sm bg-transparent hover:bg-secondary/50 px-2 py-1 rounded border border-transparent hover:border-border focus:border-primary focus:outline-none transition-all"
                />

                {activeSession.status === 'committed' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Committed to SFT Dataset
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                    showSystemPrompt
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-secondary/70 hover:bg-secondary border-border text-muted-foreground'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" /> System Prompt
                </button>

                {/* Commit Action */}
                <button
                  onClick={() => {
                    setCommitTitle(activeSession.title)
                    setShowCommitModal(true)
                  }}
                  disabled={!activeSession.messages || activeSession.messages.length === 0}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Commit entire conversation as one SFT training example"
                >
                  <BookmarkPlus className="h-4 w-4" /> Commit to SFT Dataset
                </button>
              </div>
            </div>

            {/* Collapsible System Prompt Banner */}
            {showSystemPrompt && (
              <div className="p-4 border-b border-border bg-secondary/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                    System Instructions
                  </span>
                  <span className="text-[10px] text-muted-foreground">Applies to model context</span>
                </div>
                <textarea
                  rows={2}
                  value={activeSession.system_prompt}
                  onChange={e => {
                    const updated = { ...activeSession, system_prompt: e.target.value }
                    setActiveSession(updated)
                    updateSFTSession(activeSession.id, { system_prompt: e.target.value })
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="System prompt instructions..."
                />
              </div>
            )}

            {/* Notification alert on commit */}
            {commitSuccessMessage && (
              <div className="mx-6 mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
                <span>{commitSuccessMessage}</span>
                <button
                  onClick={() => setCommitSuccessMessage(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ×
                </button>
              </div>
            )}

            {/* Messages Chat List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeSession.messages && activeSession.messages.length > 0 ? (
                activeSession.messages.map((m, idx) => {
                  const isUser = m.role === 'user'
                  const isEditing = editingMessageId === m.id

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col space-y-1.5 ${
                        isUser ? 'items-end' : 'items-start'
                      }`}
                    >
                      {/* Role & Model Tag */}
                      <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground font-mono">
                        <span className="font-semibold text-foreground uppercase">{m.role}</span>
                        {m.model && !isUser && <span>• {m.model}</span>}
                        <span>• Turn #{idx + 1}</span>
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`group relative max-w-3xl rounded-xl px-4 py-3 text-xs leading-relaxed border shadow-sm ${
                          isUser
                            ? 'bg-primary text-primary-foreground border-primary/60'
                            : 'bg-card border-border text-foreground'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              rows={4}
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              className="w-full p-2 rounded bg-background text-foreground border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingMessageId(null)}
                                className="px-2.5 py-1 rounded bg-secondary text-secondary-foreground text-[11px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleEditSave(m.id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-medium"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="prose prose-invert prose-xs max-w-none">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        )}

                        {/* Turn Actions on Hover */}
                        {!isEditing && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-popover/90 backdrop-blur-sm border border-border rounded-md p-0.5 shadow-md">
                            <button
                              onClick={() => copyToClipboard(m.content, m.id)}
                              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                              title="Copy text"
                            >
                              {copiedId === m.id ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setEditingMessageId(m.id)
                                setEditContent(m.content)
                              }}
                              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                              title="Edit message turn"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            {!isUser && (
                              <button
                                onClick={() => handleRegenerateFrom(m.sequence_order)}
                                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                                title="Regenerate assistant response"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMessage(m.id)}
                              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                              title="Delete turn"
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
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-xs space-y-3">
                  <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-primary border border-border">
                    <MessageSquareCode className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">Interactive SFT Studio</h3>
                    <p className="max-w-sm mt-1">
                      Type a user prompt below to start building this conversation turn. Continue multi-turn dialogue,
                      edit any turn, and commit the complete conversation as one SFT training record.
                    </p>
                  </div>
                </div>
              )}

              {isGenerating && (
                <div className="flex items-center gap-2 text-xs text-primary animate-pulse p-2">
                  <Sparkles className="h-4 w-4 animate-spin" />
                  <span>Assistant is generating response...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-4 border-t border-border bg-card/40 shrink-0">
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
                  className="h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all shrink-0"
                >
                  {isGenerating ? <Square className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Send</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-xs text-muted-foreground">
            Select or create a conversation draft to begin.
          </div>
        )}
      </div>

      {/* Commit Session Modal */}
      {showCommitModal && activeSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Commit Session to SFT Dataset</h3>
              <p className="text-xs text-muted-foreground">
                This will save the entire multi-turn conversation (all {activeSession.messages.length} turns) as ONE atomic SFT dataset record.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Record Title</label>
                <input
                  type="text"
                  value={commitTitle}
                  onChange={e => setCommitTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={commitTags}
                  onChange={e => setCommitTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. math, gradient-descent, reasoning"
                />
              </div>

              <div className="p-3 rounded-lg bg-secondary/40 border border-border/80 text-[11px] space-y-1 font-mono text-muted-foreground">
                <div>Model: {activeSession.model || 'mock-llama-3-8b'}</div>
                <div>Turns: {activeSession.messages.length} messages</div>
                <div>Format: Canonical OpenAI/ChatML messages schema</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCommitModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitConfirm}
                disabled={isCommitting}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm flex items-center gap-1.5"
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
