import React, { useState } from 'react'
import {
  Database,
  CheckCircle2,
  X,
  ExternalLink,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { StorySession, CommitToSFTResult } from '../../types/story_architect'

interface CommitToSFTModalProps {
  session: StorySession
  messageCount: number
  onCommit: (title?: string, description?: string, includePlanningMetadata?: boolean) => Promise<CommitToSFTResult>
  onClose: () => void
}

export const CommitToSFTModal: React.FC<CommitToSFTModalProps> = ({
  session,
  messageCount,
  onCommit,
  onClose
}) => {
  const navigate = useNavigate()
  const [title, setTitle] = useState(session.title)
  const [description, setDescription] = useState(session.description || '')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState<CommitToSFTResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || committing) return
    setCommitting(true)
    setError(null)
    try {
      const res = await onCommit(title.trim(), description.trim() || undefined, includeMetadata)
      setResult(res)
    } catch (err: any) {
      setError(err?.message || 'Failed to commit conversation to SFT Corpus')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Commit to Mechon SFT Corpus</h3>
              <p className="text-[11px] text-muted-foreground">
                Export autonomous interaction as a fine-tuning conversation record.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {result ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-foreground">Successfully Committed!</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {result.message_count} conversation turns have been registered in the Mechon SFT dataset corpus.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-secondary/40 border border-border text-left font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">SFT Record ID:</span>
                <span className="text-foreground font-semibold">{result.sft_record_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SFT Session ID:</span>
                <span className="text-foreground">{result.sft_session_id}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  onClose()
                  navigate('/datasets')
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs bg-primary text-primary-foreground font-semibold rounded-lg shadow-sm hover:bg-primary/90 transition-colors"
              >
                <span>View in Corpus Explorer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className="px-3 py-2 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Corpus Record Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md bg-secondary/40 border border-border focus:ring-1 focus:ring-primary focus:outline-none text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Description / Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional dataset notes..."
                className="w-full text-xs px-3 py-2 rounded-md bg-secondary/40 border border-border focus:ring-1 focus:ring-primary focus:outline-none text-foreground resize-none"
              />
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/80 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-medium text-foreground block">Dataset Summary</span>
                <span className="text-[11px] text-muted-foreground block">
                  {messageCount} messages ({Math.floor(messageCount / 2)} complete conversation turns)
                </span>
              </div>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-card border border-border text-foreground uppercase">
                {session.primary_language} {session.secondary_language ? `→ ${session.secondary_language}` : ''}
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground select-none">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={e => setIncludeMetadata(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span>Embed Story Architect Planning Provenance in Dataset Record</span>
            </label>

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md border border-border hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={committing || !title.trim() || messageCount === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-primary text-primary-foreground font-semibold rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{committing ? 'Committing to Corpus...' : 'Commit Record'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
