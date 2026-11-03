import React, { useState } from 'react'
import { Check, CheckCircle2, Edit2, RefreshCw, Globe, CheckCheck, Save, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { lookupLanguage } from '../../types/languages'

interface MultilingualMessageViewerProps {
  primaryLanguage?: string
  secondaryLanguage?: string
  role: string
  primaryContent: string
  secondaryContent?: string
  translationStatus?: string
  onEditTranslation?: (newContent: string) => Promise<void> | void
  onRegenerateTranslation?: () => Promise<void> | void
  onApproveTranslation?: () => Promise<void> | void
  isRegenerating?: boolean
  readOnly?: boolean
  className?: string
}

export const MultilingualMessageViewer: React.FC<MultilingualMessageViewerProps> = ({
  primaryLanguage = 'en',
  secondaryLanguage = 'id',
  role,
  primaryContent,
  secondaryContent,
  translationStatus = 'pending',
  onEditTranslation,
  onRegenerateTranslation,
  onApproveTranslation,
  isRegenerating = false,
  readOnly = false,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(secondaryContent || '')
  const [isSaving, setIsSaving] = useState(false)

  const pInfo = lookupLanguage(primaryLanguage)
  const sInfo = lookupLanguage(secondaryLanguage)

  const handleSave = async () => {
    if (onEditTranslation) {
      setIsSaving(true)
      try {
        await onEditTranslation(draft)
        setIsEditing(false)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const roleBadgeColor =
    role === 'system'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : role === 'user'
      ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
      : 'text-purple-400 bg-purple-500/10 border-purple-500/20'

  return (
    <div className={`rounded-xl border border-border bg-card/60 overflow-hidden shadow-sm ${className}`}>
      {/* Header with Role and Pair */}
      <div className="px-4 py-2 bg-secondary/40 border-b border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded uppercase font-mono font-bold text-[10px] border ${roleBadgeColor}`}>
            {role}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3 text-primary" />
            {pInfo.name} ({pInfo.code}) ↔ {sInfo.name} ({sInfo.code})
          </span>
        </div>

        {/* Translation Status Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
              translationStatus === 'approved'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : translationStatus === 'edited'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : translationStatus === 'generated'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'bg-secondary text-muted-foreground border border-border'
            }`}
          >
            {translationStatus}
          </span>
        </div>
      </div>

      {/* Parallel Grid: Left = Primary, Right = Secondary */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Primary Content Column */}
        <div className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                {pInfo.name} ({pInfo.code})
                {pInfo.rtl && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono font-bold">
                    RTL
                  </span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">Source</span>
            </div>

            <div
              dir={pInfo.rtl ? 'rtl' : 'ltr'}
              className={`prose prose-invert prose-xs max-w-none text-foreground leading-relaxed text-xs ${
                pInfo.rtl ? 'text-right font-sans' : 'text-left'
              }`}
            >
              <ReactMarkdown>{primaryContent}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Secondary Content Column */}
        <div className="p-4 flex flex-col justify-between bg-secondary/10">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-cyan-400 flex items-center gap-1">
                {sInfo.name} ({sInfo.code})
                {sInfo.rtl && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono font-bold">
                    RTL
                  </span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">Target Translation</span>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  dir={sInfo.rtl ? 'rtl' : 'ltr'}
                  rows={4}
                  className={`w-full p-2.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-y ${
                    sInfo.rtl ? 'text-right' : 'text-left'
                  }`}
                  placeholder={`Translate turn into ${sInfo.name}...`}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(secondaryContent || '')
                      setIsEditing(false)
                    }}
                    className="px-2.5 py-1 rounded text-[11px] border border-border hover:bg-secondary cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1 rounded text-[11px] font-bold bg-primary text-primary-foreground shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="h-3 w-3" />
                    Save Edit
                  </button>
                </div>
              </div>
            ) : secondaryContent ? (
              <div
                dir={sInfo.rtl ? 'rtl' : 'ltr'}
                className={`prose prose-invert prose-xs max-w-none text-foreground leading-relaxed text-xs ${
                  sInfo.rtl ? 'text-right font-sans' : 'text-left'
                }`}
              >
                <ReactMarkdown>{secondaryContent}</ReactMarkdown>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-secondary/30 border border-dashed border-border text-center text-xs text-muted-foreground italic">
                Translation not generated yet for {sInfo.name}.
              </div>
            )}
          </div>

          {/* Action strip for turn */}
          {!readOnly && (
            <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-border/60 text-xs">
              {onEditTranslation && !isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(secondaryContent || '')
                    setIsEditing(true)
                  }}
                  className="px-2 py-1 rounded bg-secondary hover:bg-accent border border-border text-foreground flex items-center gap-1 cursor-pointer"
                  title="Edit translation"
                >
                  <Edit2 className="h-3 w-3 text-muted-foreground" />
                  Edit
                </button>
              )}

              {onRegenerateTranslation && (
                <button
                  type="button"
                  onClick={onRegenerateTranslation}
                  disabled={isRegenerating}
                  className="px-2 py-1 rounded bg-secondary hover:bg-accent border border-border text-foreground flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  title="Re-translate this turn"
                >
                  <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                  Re-translate
                </button>
              )}

              {onApproveTranslation && translationStatus !== 'approved' && secondaryContent && (
                <button
                  type="button"
                  onClick={onApproveTranslation}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 cursor-pointer shadow-sm"
                  title="Approve turn translation"
                >
                  <Check className="h-3 w-3" />
                  Approve
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
