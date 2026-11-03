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
  Sparkles
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { StoryMessage } from '../../types/story_architect'
import { RevisionHistoryModal } from './RevisionHistoryModal'

interface StoryConversationViewerProps {
  sessionId: string
  messages: StoryMessage[]
  streamingToken?: string
  streamingContent?: string
  isStreaming?: boolean
  onEditMessage?: (messageId: string, content: string, reason?: string) => Promise<void>
  onRegenerateTurn?: (turnIndex: number) => Promise<void>
  onRevisionRestored?: (message: StoryMessage) => void
}

export const StoryConversationViewer: React.FC<StoryConversationViewerProps> = ({
  sessionId,
  messages,
  streamingContent,
  isStreaming,
  onEditMessage,
  onRegenerateTurn,
  onRevisionRestored
}) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // In-place editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editReason, setEditReason] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Regenerating turn state
  const [regeneratingTurnIndex, setRegeneratingTurnIndex] = useState<number | null>(null)

  // Revision history modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedHistoryMessage, setSelectedHistoryMessage] = useState<StoryMessage | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const startEditing = (m: StoryMessage) => {
    setEditingMessageId(m.id)
    setEditContent(m.content)
    setEditReason('Refined prompt instructions')
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

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-muted-foreground">
        <div className="w-12 h-12 rounded-2xl bg-secondary/80 flex items-center justify-center text-primary mb-3">
          <BookOpen className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">Conversation Not Started</h4>
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
          The planning agent will convert your structured plan into purposeful dialogue prompts. Review or approve the upcoming turn below.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((m, idx) => {
        const isUser = m.role === 'user'
        const isEditingThis = editingMessageId === m.id
        const isRegeneratingThis = regeneratingTurnIndex === m.turn_index
        const revCount = m.revision_count ?? 0

        return (
          <div key={m.id || idx} className="space-y-1.5">
            {/* Outdated Context Warning Banner */}
            {m.is_outdated && (
              <div className="max-w-4xl mx-auto flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    <strong>Outdated Context:</strong> An earlier turn was edited. This {isUser ? 'prompt' : 'response'} may no longer reflect upstream changes.
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

            <div
              className={`flex gap-3 group max-w-4xl ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
            >
              {/* Avatar for Assistant */}
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              {/* Message Bubble Container */}
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
                <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-border/20 text-[10px] opacity-80">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wider font-mono">
                      {isUser ? 'Engineer Prompt' : 'Autonomous Assistant'}
                    </span>
                    <span className="text-[10px] opacity-60">Turn {m.turn_index}</span>

                    {/* Provider and Model Badge */}
                    {(m.provider_id || m.model) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono border border-white/10">
                        <Cpu className="w-2.5 h-2.5 text-primary" />
                        <span>{m.provider_id}{m.model ? ` : ${m.model}` : ''}</span>
                      </span>
                    )}

                    {/* Revision count badge */}
                    {revCount > 0 && (
                      <button
                        onClick={() => openRevisionHistory(m)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] hover:bg-amber-500/30 transition-colors"
                        title="View revision history"
                      >
                        <History className="w-2.5 h-2.5" />
                        <span>v{revCount + 1} ({revCount} edit{revCount > 1 ? 's' : ''})</span>
                      </button>
                    )}
                  </div>

                  {/* Actions / Metrics Bar */}
                  <div className="flex items-center gap-2 font-mono">
                    {m.token_count > 0 && <span>{m.token_count} tok</span>}
                    {m.latency_ms > 0 && <span>{m.latency_ms}ms</span>}

                    {/* Edit button for User message */}
                    {isUser && onEditMessage && !isEditingThis && (
                      <button
                        onClick={() => startEditing(m)}
                        className="hover:opacity-100 opacity-70 transition-opacity p-0.5 text-primary-foreground hover:bg-white/10 rounded"
                        title="Edit prompt"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}

                    {/* Regenerate button for Assistant turn */}
                    {!isUser && onRegenerateTurn && (
                      <button
                        onClick={() => triggerRegenerate(m.turn_index)}
                        disabled={isRegeneratingThis}
                        className="hover:opacity-100 opacity-70 transition-opacity p-0.5 text-muted-foreground hover:text-primary hover:bg-secondary rounded"
                        title="Regenerate assistant turn using currently selected provider/model"
                      >
                        <RotateCcw className={`w-3 h-3 ${isRegeneratingThis ? 'animate-spin text-primary' : ''}`} />
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

                    {/* Copy Text */}
                    <button
                      onClick={() => handleCopy(m.id, m.content)}
                      className="hover:opacity-100 opacity-70 transition-opacity p-0.5"
                      title="Copy message text"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3 h-3 text-emerald-300" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Inline Prompt Editor */}
                {isEditingThis ? (
                  <div className="space-y-2 mt-1">
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={4}
                      className="w-full p-2.5 rounded-xl bg-background/90 text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary text-xs leading-relaxed font-sans resize-y"
                      placeholder="Edit conversation prompt..."
                    />

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editReason}
                        onChange={e => setEditReason(e.target.value)}
                        placeholder="Reason for edit (optional)..."
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
                <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Streaming bubble */}
      {isStreaming && (
        <div className="flex gap-3 mr-auto max-w-4xl justify-start">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
            <Bot className="w-4 h-4 animate-pulse" />
          </div>
          <div className="p-3.5 rounded-2xl border border-primary/40 bg-card rounded-tl-none text-xs text-foreground leading-relaxed max-w-2xl shadow-md flex-1">
            <div className="flex items-center gap-2 mb-1 text-[10px] text-primary font-mono font-semibold">
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>Generating response...</span>
            </div>
            <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap">
              {streamingContent || '...'}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      {/* Revision History Modal */}
      <RevisionHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        sessionId={sessionId}
        message={selectedHistoryMessage}
        onRevisionRestored={msg => {
          if (onRevisionRestored) onRevisionRestored(msg)
        }}
      />
    </div>
  )
}
