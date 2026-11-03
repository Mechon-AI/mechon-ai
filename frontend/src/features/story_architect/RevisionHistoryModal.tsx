import React, { useState, useEffect } from 'react'
import {
  X,
  History,
  RotateCcw,
  Clock,
  Cpu,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  FileText
} from 'lucide-react'
import { listMessageRevisions, restoreMessageRevision } from '../../services/api'
import type { StoryMessage, StoryMessageRevision } from '../../types/story_architect'

interface RevisionHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  message: StoryMessage | null
  onRevisionRestored: (updatedMessage: StoryMessage) => void
}

export const RevisionHistoryModal: React.FC<RevisionHistoryModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  message,
  onRevisionRestored
}) => {
  const [revisions, setRevisions] = useState<StoryMessageRevision[]>([])
  const [selectedRevision, setSelectedRevision] = useState<StoryMessageRevision | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !message) {
      setRevisions([])
      setSelectedRevision(null)
      setError(null)
      return
    }

    const loadRevisions = async () => {
      setLoading(true)
      setError(null)
      try {
        const revs = await listMessageRevisions(message.id)
        setRevisions(revs)
        if (revs.length > 0) {
          setSelectedRevision(revs[0])
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load revisions')
      } finally {
        setLoading(false)
      }
    }

    loadRevisions()
  }, [isOpen, message])

  if (!isOpen || !message) return null

  const handleRestore = async (revision: StoryMessageRevision) => {
    if (!window.confirm(`Restore this revision from ${new Date(revision.created_at).toLocaleString()}? Note that downstream conversation turns will be marked as outdated.`)) {
      return
    }

    setRestoring(true)
    setError(null)
    try {
      const restored = await restoreMessageRevision({
        session_id: sessionId,
        revision_id: revision.id
      })
      onRevisionRestored(restored)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to restore revision')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Revision History
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-mono">
                  Turn {message.turn_index} • {message.role === 'user' ? 'User Prompt' : 'Assistant Turn'}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Inspect past edits, compare with original content, and restore previous turns.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Revisions Sidebar */}
          <div className="w-72 border-r border-border bg-secondary/20 flex flex-col overflow-y-auto">
            <div className="p-3 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Snapshots ({revisions.length})
            </div>

            {loading ? (
              <div className="p-4 text-xs text-muted-foreground text-center">Loading revisions...</div>
            ) : revisions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No revisions recorded yet. Revisions are created when prompts or responses are edited or regenerated.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {revisions.map((rev, index) => {
                  const isSelected = selectedRevision?.id === rev.id
                  const date = new Date(rev.created_at)

                  return (
                    <button
                      key={rev.id}
                      onClick={() => setSelectedRevision(rev)}
                      className={`w-full text-left p-3 transition-colors flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-primary/10 border-l-2 border-primary text-foreground'
                          : 'hover:bg-secondary/40 text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">
                          v{revisions.length - index}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-[11px] truncate capitalize">
                        {rev.revision_reason.replace(/_/g, ' ')}
                      </div>

                      {(rev.provider_id || rev.model) && (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-primary/80">
                          <Cpu className="w-3 h-3" />
                          <span className="truncate">{rev.provider_id}{rev.model ? ` / ${rev.model}` : ''}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Diff / Detail View */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4 bg-card">
            {error && (
              <div className="p-3 mb-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {selectedRevision ? (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Saved:</span>
                    <span className="font-mono text-foreground">
                      {new Date(selectedRevision.created_at).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-primary capitalize">{selectedRevision.revision_reason.replace(/_/g, ' ')}</span>
                  </div>

                  <button
                    onClick={() => handleRestore(selectedRevision)}
                    disabled={restoring}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{restoring ? 'Restoring...' : 'Restore This Version'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1">
                  {/* Original / Prior Snapshot */}
                  <div className="flex flex-col border border-border/80 rounded-xl overflow-hidden bg-secondary/10">
                    <div className="p-2.5 bg-secondary/30 border-b border-border/80 text-xs font-semibold flex items-center gap-2 text-amber-400">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Original Content (Prior to Change)</span>
                    </div>
                    <div className="p-3.5 text-xs text-foreground font-mono whitespace-pre-wrap overflow-y-auto flex-1 leading-relaxed">
                      {selectedRevision.original_content || '(Empty)'}
                    </div>
                  </div>

                  {/* Modified / Restored Target */}
                  <div className="flex flex-col border border-border/80 rounded-xl overflow-hidden bg-secondary/10">
                    <div className="p-2.5 bg-secondary/30 border-b border-border/80 text-xs font-semibold flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resulting Content (Saved Snapshot)</span>
                    </div>
                    <div className="p-3.5 text-xs text-foreground font-mono whitespace-pre-wrap overflow-y-auto flex-1 leading-relaxed">
                      {selectedRevision.modified_content || selectedRevision.original_content || '(Empty)'}
                    </div>
                  </div>
                </div>

                {/* Warning on Downstream Invalidation */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Restoring this earlier turn will preserve context integrity by marking subsequent downstream conversation turns as outdated.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                <History className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">Select a snapshot on the left to inspect content diff.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-card/40 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            Current version in session: {message.content.length} characters • {message.token_count} tokens
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
