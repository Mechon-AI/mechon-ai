import React, { useState, useEffect } from 'react'
import {
  Database,
  Search,
  Filter,
  X,
  Layers,
  Clock,
  Tag,
  ChevronDown,
  ChevronRight,
  FileText,
  Copy,
  ExternalLink,
  Loader2,
  CheckCircle,
  Languages
} from 'lucide-react'
import { getSFTRecords } from '../../services/api'
import type { SFTRecord } from '../../types'
import { LanguageIdentityBadge } from '../../components/language'
import { lookupLanguage } from '../../types/languages'

interface LoadFromCorpusModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onLoadRecord: (recordId: string, asNewDraft: boolean) => Promise<void>
}

export const LoadFromCorpusModal: React.FC<LoadFromCorpusModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onLoadRecord
}) => {
  const [records, setRecords] = useState<SFTRecord[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [langFilter, setLangFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingRecordId, setLoadingRecordId] = useState<string | null>(null)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && projectId) {
      loadRecords()
    }
  }, [isOpen, projectId, search, langFilter, tagFilter])

  const loadRecords = async () => {
    setIsLoading(true)
    try {
      const res = await getSFTRecords(
        projectId,
        search || undefined,
        tagFilter || undefined,
        langFilter === 'all' ? undefined : langFilter,
        100,
        0
      )
      setRecords(res.records || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load corpus records:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelect = async (recordId: string, asNewDraft: boolean) => {
    setLoadingRecordId(recordId)
    try {
      await onLoadRecord(recordId, asNewDraft)
      onClose()
    } finally {
      setLoadingRecordId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Load from Mechon Corpus</h2>
              <p className="text-xs text-muted-foreground">
                Browse and load existing dataset conversations into the Universal Corpus Editor.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-border bg-secondary/10 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search dialogues, topics, keywords..."
              className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={langFilter}
              onChange={e => setLangFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:border-primary"
            >
              <option value="all">All Languages</option>
              <option value="monolingual">Monolingual Only</option>
              <option value="bilingual">Bilingual Only</option>
              <option value="multilingual">Multilingual Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              placeholder="Filter by tag..."
              className="w-28 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary"
            />
          </div>

          <span className="text-xs text-muted-foreground ml-auto font-mono">
            {records.length} of {total} records
          </span>
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
              <span className="text-xs">Fetching Corpus records...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Database className="w-8 h-8 opacity-30 mb-2" />
              <p className="text-sm font-medium text-foreground">No matching Corpus records found</p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                You can commit new conversations from the editor to build your dataset.
              </p>
            </div>
          ) : (
            records.map(record => {
              const isExpanded = expandedRecordId === record.id
              const isSelectedLoading = loadingRecordId === record.id
              const title = record.metadata?.title || `Corpus Record ${record.id.slice(0, 8)}`
              const tags = record.metadata?.tags || []
              const messages = Array.isArray(record.messages) ? record.messages : []
              const primaryLang = lookupLanguage(record.primary_language || 'id')
              const secondaryLang = record.secondary_language ? lookupLanguage(record.secondary_language) : null

              return (
                <div
                  key={record.id}
                  className="rounded-lg border border-border bg-card/60 hover:bg-card transition-all overflow-hidden"
                >
                  <div className="p-3.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                        className="mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                        title={isExpanded ? 'Collapse preview' : 'Expand preview'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="text-xs font-semibold text-foreground truncate">{title}</h4>
                          <span className="px-1.5 py-0.5 rounded-sm bg-secondary text-[10px] text-muted-foreground font-mono">
                            v{record.revision}
                          </span>
                          <span className="capitalize px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 text-[10px]">
                            {record.language_mode || 'monolingual'}
                          </span>
                        </div>

                        {/* Metadata tags & specs */}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            {record.turn_count} turns
                          </span>
                          <span>&bull;</span>
                          <span>{record.character_count.toLocaleString()} chars (~{Math.round(record.character_count / 4)} tokens)</span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(record.updated_at || record.created_at).toLocaleDateString()}
                          </span>

                          <div className="flex items-center gap-1.5 ml-2">
                            <LanguageIdentityBadge
                              primaryLanguage={primaryLang.code}
                              secondaryLanguage={secondaryLang?.code}
                              mode={record.language_mode}
                              compact
                            />
                          </div>
                        </div>

                        {/* Tags */}
                        {tags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {tags.map((t: string) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded-xs bg-secondary/80 text-[10px] text-muted-foreground border border-border/50"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleSelect(record.id, false)}
                        disabled={isSelectedLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                        title="Load into editor linked to this record. Saving will update this record (revision bump)."
                      >
                        {isSelectedLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5" />
                        )}
                        <span>Load to Edit</span>
                      </button>

                      <button
                        onClick={() => handleSelect(record.id, true)}
                        disabled={isSelectedLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 text-xs font-medium border border-border transition-colors disabled:opacity-50 cursor-pointer"
                        title="Load as a new unlinked draft copy."
                      >
                        <Copy className="w-3 h-3 text-muted-foreground" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Dialogue Preview */}
                  {isExpanded && (
                    <div className="border-t border-border/60 bg-background/50 p-3 text-xs space-y-2 max-h-56 overflow-y-auto">
                      <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground mb-1">
                        Turn Preview ({messages.length} messages)
                      </div>
                      {messages.map((m: any, idx: number) => {
                        const isAssistant = m.role === 'assistant'
                        const isSystem = m.role === 'system'
                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded-md text-[11px] ${
                              isSystem
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono'
                                : isAssistant
                                ? 'bg-secondary/80 border border-border/40 text-foreground'
                                : 'bg-primary/10 border border-primary/20 text-foreground'
                            }`}
                          >
                            <span className="font-semibold capitalize text-[10px] opacity-75 mr-2">
                              {m.role}:
                            </span>
                            <span>{m.content}</span>
                            {m.translations && Object.keys(m.translations).length > 0 && (
                              <div className="mt-1 pt-1 border-t border-border/30 text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                                {Object.entries(m.translations).map(([lang, text]: [string, any]) => (
                                  <span key={lang} className="truncate max-w-xs">
                                    <strong className="uppercase">{lang}:</strong> {String(text)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-secondary/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>Editing a loaded record will preserve the original until you explicitly click "Save to Corpus".</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-colors text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
