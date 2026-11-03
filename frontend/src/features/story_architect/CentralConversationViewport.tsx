import React, { useRef, useEffect, useState } from 'react'
import {
  User,
  Bot,
  Copy,
  Check,
  Cpu,
  BookOpen,
  Edit3,
  RotateCcw,
  History,
  AlertTriangle,
  Save,
  X,
  Sparkles,
  Search,
  ArrowDown,
  FileText,
  Shield,
  Users
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { StoryMessage, CharacterProfile, PlanningPromptHistory } from '../../types/story_architect'
import { RevisionHistoryModal } from './RevisionHistoryModal'

interface CentralConversationViewportProps {
  sessionId: string
  sessionTitle: string
  messages: StoryMessage[]
  characters?: CharacterProfile[]
  currentArc?: string
  streamingContent?: string
  isStreaming?: boolean
  onEditMessage?: (messageId: string, content: string, reason?: string) => Promise<void>
  onRegenerateTurn?: (turnIndex: number) => Promise<void>
  onRevisionRestored?: (message: StoryMessage) => void
  onFocusComposer?: () => void
}

export const CentralConversationViewport: React.FC<CentralConversationViewportProps> = ({
  sessionId,
  sessionTitle,
  messages,
  characters = [],
  currentArc,
  streamingContent,
  isStreaming = false,
  onEditMessage,
  onRegenerateTurn,
  onRevisionRestored,
  onFocusComposer
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomAnchorRef = useRef<HTMLDivElement>(null)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // In-place Editing
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editReason, setEditReason] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Regenerating
  const [regeneratingTurnIndex, setRegeneratingTurnIndex] = useState<number | null>(null)

  // Revision Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedHistoryMessage, setSelectedHistoryMessage] = useState<StoryMessage | null>(null)

  // Auto-scroll on new message or stream
  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  const scrollToBottom = () => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleCopyFullConversation = () => {
    const formatted = messages
      .map(
        (m) =>
          `### ${m.role === 'user' ? 'Engineer / Director' : 'Assistant (Character)'} (Turn ${m.turn_index})\n\n${m.content}\n`
      )
      .join('\n---\n\n')
    navigator.clipboard.writeText(formatted)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const startEditing = (m: StoryMessage) => {
    setEditingMessageId(m.id)
    setEditContent(m.content)
    setEditReason('Refined narrative instruction')
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditContent('')
    setEditReason('')
  }

  const saveEdit = async (messageId: string) => {
    if (!onEditMessage || !editContent.trim()) return
    setIsSavingEdit(true)
    try {
      await onEditMessage(messageId, editContent.trim(), editReason.trim() || undefined)
      setEditingMessageId(null)
    } catch (err) {
      console.error('Failed to save edited prompt:', err)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const triggerRegenerate = async (turnIndex: number) => {
    if (!onRegenerateTurn) return
    setRegeneratingTurnIndex(turnIndex)
    try {
      await onRegenerateTurn(turnIndex)
    } catch (err) {
      console.error('Failed to regenerate turn:', err)
    } finally {
      setRegeneratingTurnIndex(null)
    }
  }

  const openRevisionHistory = (m: StoryMessage) => {
    setSelectedHistoryMessage(m)
    setHistoryModalOpen(true)
  }

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages

  const outdatedCount = messages.filter((m) => m.is_outdated).length

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-background overflow-hidden relative select-none">
      {/* 1. Contextual Viewport Sub-header */}
      <div className="h-9 border-b border-border bg-card/60 backdrop-blur-sm px-3 flex items-center justify-between gap-3 shrink-0 text-xs text-muted-foreground z-10">
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-foreground text-xs truncate max-w-xs">
            {sessionTitle}
          </span>
          {currentArc && (
            <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-secondary/80 border border-border text-[10px] font-mono text-primary truncate max-w-[150px]">
              Arc: {currentArc}
            </span>
          )}
          {outdatedCount > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-medium">
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
              <span>{outdatedCount} Outdated</span>
            </span>
          )}
        </div>

        {/* Viewport Actions: Search, Copy Full, Scroll Down */}
        <div className="flex items-center gap-2">
          {/* Search within transcript */}
          <div className="relative hidden md:flex items-center">
            <Search className="w-3 h-3 absolute left-2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-6 pr-2 py-0.5 text-[11px] rounded bg-secondary/60 border border-border/80 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary w-40 focus:w-56 transition-all"
            />
          </div>

          {/* Copy full conversation */}
          <button
            onClick={handleCopyFullConversation}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground text-[11px] transition-colors"
            title="Copy full conversation transcript as Markdown"
          >
            {copiedAll ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span className="hidden lg:inline">{copiedAll ? 'Copied' : 'Copy All'}</span>
          </button>

          {/* Scroll to Bottom */}
          <button
            onClick={scrollToBottom}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Chronological Conversation Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 select-text"
      >
        {filteredMessages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none text-muted-foreground min-h-[300px]">
            <div className="w-14 h-14 rounded-2xl bg-secondary/80 border border-border flex items-center justify-center text-primary mb-3 shadow-sm">
              <BookOpen className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-1">
              {messages.length === 0 ? 'Conversation Not Started' : 'No matching messages'}
            </h4>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed mb-4">
              {messages.length === 0
                ? 'Use the Planning Agent panel on the right to compose prompt instructions or trigger autonomous turns.'
                : 'No turns match the current search filter.'}
            </p>
            {messages.length === 0 && onFocusComposer && (
              <button
                onClick={onFocusComposer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Planning Agent</span>
              </button>
            )}
          </div>
        ) : (
          filteredMessages.map((m, idx) => {
            const isUser = m.role === 'user'
            const isEditingThis = editingMessageId === m.id
            const isRegeneratingThis = regeneratingTurnIndex === m.turn_index
            const revCount = m.revision_count ?? 0

            return (
              <div key={m.id || idx} className="space-y-1.5">
                {/* Outdated Warning Banner */}
                {m.is_outdated && (
                  <div className="max-w-4xl mx-auto flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shadow-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        <strong>Outdated Context:</strong> An upstream turn was edited. This response may no longer reflect prior state.
                      </span>
                    </div>
                    {!isUser && onRegenerateTurn && (
                      <button
                        onClick={() => triggerRegenerate(m.turn_index)}
                        disabled={isRegeneratingThis}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-medium transition-colors ml-3 shrink-0"
                      >
                        <RotateCcw className={`w-3 h-3 ${isRegeneratingThis ? 'animate-spin' : ''}`} />
                        <span>{isRegeneratingThis ? 'Regenerating...' : 'Regenerate'}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Message Bubble Container */}
                <div
                  className={`flex gap-3 group max-w-4xl ${
                    isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'
                  }`}
                >
                  {/* Avatar for Assistant */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble Box */}
                  <div
                    className={`p-3.5 rounded-2xl border text-xs leading-relaxed max-w-2xl relative shadow-xs flex-1 ${
                      isUser
                        ? 'bg-primary text-primary-foreground border-primary/80 rounded-tr-none'
                        : `bg-card border-border rounded-tl-none text-foreground ${
                            m.is_outdated ? 'border-amber-500/40' : ''
                          }`
                    }`}
                  >
                    {/* Message Header Bar */}
                    <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-border/20 text-[10px] opacity-80 select-none">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold uppercase tracking-wider font-mono">
                          {isUser ? 'Engineer Prompt' : 'Autonomous Assistant'}
                        </span>
                        <span className="text-[10px] opacity-60">Turn {m.turn_index}</span>

                        {/* Model / Provider Badge */}
                        {(m.provider_id || m.model) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono border border-white/10">
                            <Cpu className="w-2.5 h-2.5 text-primary" />
                            <span>
                              {m.provider_id}
                              {m.model ? ` : ${m.model}` : ''}
                            </span>
                          </span>
                        )}

                        {/* Revision Badge */}
                        {revCount > 0 && (
                          <button
                            onClick={() => openRevisionHistory(m)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] hover:bg-amber-500/30 transition-colors"
                            title="Inspect revision history"
                          >
                            <History className="w-2.5 h-2.5" />
                            <span>
                              v{revCount + 1} ({revCount} edit{revCount > 1 ? 's' : ''})
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Metrics & Action Buttons */}
                      <div className="flex items-center gap-2 font-mono">
                        {m.token_count > 0 && <span>{m.token_count} tok</span>}
                        {m.latency_ms > 0 && <span>{m.latency_ms}ms</span>}

                        {/* Edit Button for User prompt */}
                        {isUser && onEditMessage && !isEditingThis && (
                          <button
                            onClick={() => startEditing(m)}
                            className="hover:opacity-100 opacity-70 transition-opacity p-0.5 text-primary-foreground hover:bg-white/10 rounded"
                            title="Edit prompt instructions"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        )}

                        {/* Regenerate Button for Assistant Turn */}
                        {!isUser && onRegenerateTurn && (
                          <button
                            onClick={() => triggerRegenerate(m.turn_index)}
                            disabled={isRegeneratingThis}
                            className="hover:opacity-100 opacity-70 transition-opacity p-0.5 text-muted-foreground hover:text-primary hover:bg-secondary rounded"
                            title="Regenerate assistant turn with active provider"
                          >
                            <RotateCcw
                              className={`w-3 h-3 ${isRegeneratingThis ? 'animate-spin text-primary' : ''}`}
                            />
                          </button>
                        )}

                        {/* History button if no edits yet */}
                        {revCount === 0 && (
                          <button
                            onClick={() => openRevisionHistory(m)}
                            className="hover:opacity-100 opacity-50 transition-opacity p-0.5 hover:text-foreground rounded"
                            title="Inspect revision history"
                          >
                            <History className="w-3 h-3" />
                          </button>
                        )}

                        {/* Copy Single Message */}
                        <button
                          onClick={() => handleCopy(m.id, m.content)}
                          className="hover:opacity-100 opacity-70 transition-opacity p-0.5"
                          title="Copy message content"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3 h-3 text-emerald-300" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Inline Message Edit View */}
                    {isEditingThis ? (
                      <div className="space-y-2 mt-1">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={4}
                          className="w-full p-2.5 rounded-xl bg-background/90 text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary text-xs leading-relaxed font-sans resize-y"
                          placeholder="Edit conversation prompt..."
                        />

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            placeholder="Reason for revision (optional)..."
                            className="flex-1 px-2.5 py-1 text-[11px] rounded-lg bg-background/60 border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                          />

                          <button
                            onClick={cancelEditing}
                            disabled={isSavingEdit}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>

                          <button
                            onClick={() => saveEdit(m.id)}
                            disabled={isSavingEdit || !editContent.trim()}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                          >
                            <Save className="w-3 h-3" />
                            <span>{isSavingEdit ? 'Saving...' : 'Save & Invalidate Downstream'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-xs max-w-none break-words">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {/* Avatar for User */}
                  {isUser && (
                    <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0 mt-0.5 shadow-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        {/* Live Streaming Response Bubble */}
        {isStreaming && (
          <div className="flex gap-3 mr-auto max-w-4xl justify-start animate-in fade-in">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-xs">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="p-3.5 rounded-2xl border border-primary/40 bg-card rounded-tl-none text-xs text-foreground leading-relaxed max-w-2xl shadow-md flex-1">
              <div className="flex items-center gap-2 mb-1.5 text-[10px] text-primary font-mono font-semibold">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
                <span>Generating autonomous response...</span>
              </div>
              <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap">
                {streamingContent || '...'}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomAnchorRef} />
      </div>

      {/* Revision History Modal */}
      <RevisionHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        sessionId={sessionId}
        message={selectedHistoryMessage}
        onRevisionRestored={(msg) => {
          if (onRevisionRestored) onRevisionRestored(msg)
        }}
      />
    </div>
  )
}
