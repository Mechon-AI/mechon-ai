import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  Search,
  MessageSquareCode,
  GitCompare,
  Copy,
  Trash2,
  Edit2,
  Code2,
  Eye,
  Check,
  Tag,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
  Download,
  X,
  AlertCircle,
  CheckCircle,
  FileText,
  Languages,
  CheckSquare,
  Square,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { ErrorBoundary } from '../../components/common/ErrorBoundary'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSelectionStore } from '../../stores/useSelectionStore'
import {
  getSFTRecords,
  deleteSFTRecord,
  duplicateSFTRecord,
  updateSFTRecord,
  getDPOTasks,
  deleteDPOTask,
  duplicateDPOTask,
  updateDPOTask
} from '../../services/api'
import type { SFTRecord, DPOTask } from '../../types'
import { LanguageFilter, LanguageIdentityBadge } from '../../components/language'
import { lookupLanguage, isRTL } from '../../types/languages'

export const DatasetExplorerView: React.FC = () => {
  const navigate = useNavigate()
  const { activeProjectId, ensureActiveProject } = useProjectStore()
  const {
    selectedSftIds,
    selectedDpoIds,
    toggleSftSelection,
    selectAllVisibleSft,
    clearSftSelection,
    isSftSelected,
    toggleDpoSelection,
    selectAllVisibleDpo,
    clearDpoSelection,
    isDpoSelected
  } = useSelectionStore()

  const [activeTab, setActiveTab] = useState<'sft' | 'dpo'>('sft')
  const [search, setSearch] = useState('')
  const [languageFilter, setLanguageFilter] = useState<'all' | 'bilingual' | 'monolingual'>('all')
  const [selectedPair, setSelectedPair] = useState<string>('all')
  const [sftRecords, setSftRecords] = useState<SFTRecord[]>([])
  const [dpoTasks, setDpoTasks] = useState<DPOTask[]>([])
  const [selectedSFT, setSelectedSFT] = useState<SFTRecord | null>(null)
  const [selectedDPO, setSelectedDPO] = useState<DPOTask | null>(null)
  const [viewMode, setViewMode] = useState<'rendered' | 'bilingual' | 'json'>('rendered')
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Edit Modals
  const [editingSFT, setEditingSFT] = useState<SFTRecord | null>(null)
  const [sftTitle, setSftTitle] = useState('')
  const [sftTags, setSftTags] = useState('')

  const [editingDPO, setEditingDPO] = useState<DPOTask | null>(null)
  const [dpoPrompt, setDpoPrompt] = useState('')
  const [dpoResponseA, setDpoResponseA] = useState('')
  const [dpoResponseB, setDpoResponseB] = useState('')
  const [dpoPreference, setDpoPreference] = useState('')

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  useEffect(() => {
    initView()
  }, [activeProjectId, activeTab, search, languageFilter, selectedPair])

  const initView = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (pId) {
      loadData(pId)
    }
  }

  const loadData = async (projectId?: string) => {
    const targetProject = projectId || activeProjectId
    if (!targetProject) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      if (activeTab === 'sft') {
        const langMode = languageFilter !== 'all' ? languageFilter : undefined
        const res = await getSFTRecords(targetProject, search || undefined, undefined, langMode)
        let filtered = Array.isArray(res?.records) ? res.records : []
        if (selectedPair && selectedPair !== 'all') {
          const parts = selectedPair.split(/->|-/)
          const p = parts[0]?.trim()?.toLowerCase()
          const s = parts[1]?.trim()?.toLowerCase()
          if (p && s) {
            filtered = filtered.filter(r => {
              const rP = (r.primary_language || '').toLowerCase()
              const rS = (r.secondary_language || '').toLowerCase()
              return rP === p && rS === s
            })
          }
        }
        setSftRecords(filtered)
        if (filtered.length > 0) {
          if (!selectedSFT || !filtered.some(r => r.id === selectedSFT.id)) {
            setSelectedSFT(filtered[0])
          }
        } else {
          setSelectedSFT(null)
        }
      } else {
        const res = await getDPOTasks(targetProject, undefined, search || undefined)
        const tasks = Array.isArray(res?.tasks) ? res.tasks : []
        setDpoTasks(tasks)
        if (tasks.length > 0) {
          if (!selectedDPO || !tasks.some(t => t.id === selectedDPO.id)) {
            setSelectedDPO(tasks[0])
          }
        } else {
          setSelectedDPO(null)
        }
      }
    } catch (err: any) {
      showFeedback('error', `Failed to load records: ${err.message || 'Unknown database error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSFT = async (id: string) => {
    if (confirm('Delete this committed SFT conversation record? This removes it permanently from the training corpus.')) {
      try {
        await deleteSFTRecord(id)
        showFeedback('success', 'SFT record deleted.')
        loadData()
        if (selectedSFT?.id === id) setSelectedSFT(null)
      } catch (err: any) {
        showFeedback('error', `Delete failed: ${err.message}`)
      }
    }
  }

  const handleDeleteDPO = async (id: string) => {
    if (confirm('Delete this DPO preference task?')) {
      try {
        await deleteDPOTask(id)
        showFeedback('success', 'DPO task deleted.')
        loadData()
        if (selectedDPO?.id === id) setSelectedDPO(null)
      } catch (err: any) {
        showFeedback('error', `Delete failed: ${err.message}`)
      }
    }
  }

  const handleDuplicateSFT = async (id: string) => {
    try {
      await duplicateSFTRecord(id)
      showFeedback('success', 'SFT record duplicated.')
      loadData()
    } catch (err: any) {
      showFeedback('error', `Duplicate failed: ${err.message}`)
    }
  }

  const handleDuplicateDPO = async (id: string) => {
    try {
      await duplicateDPOTask(id)
      showFeedback('success', 'DPO task duplicated.')
      loadData()
    } catch (err: any) {
      showFeedback('error', `Duplicate failed: ${err.message}`)
    }
  }

  const openEditSFT = (r: SFTRecord) => {
    setEditingSFT(r)
    setSftTitle(r.metadata?.title || '')
    setSftTags((r.metadata?.tags || []).join(', '))
  }

  const saveEditSFT = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSFT) return
    try {
      const updatedMeta = {
        ...editingSFT.metadata,
        title: sftTitle.trim(),
        tags: sftTags.split(',').map(t => t.trim()).filter(Boolean)
      }
      const updated = await updateSFTRecord(editingSFT.id, { metadata: updatedMeta })
      setSelectedSFT(updated)
      setEditingSFT(null)
      showFeedback('success', 'SFT record updated.')
      loadData()
    } catch (err: any) {
      showFeedback('error', `Failed to update record: ${err.message}`)
    }
  }

  const openEditDPO = (t: DPOTask) => {
    setEditingDPO(t)
    setDpoPrompt(t.prompt)
    setDpoResponseA(t.response_a || '')
    setDpoResponseB(t.response_b || '')
    setDpoPreference(t.preference || '')
  }

  const saveEditDPO = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDPO) return
    try {
      const updated = await updateDPOTask(editingDPO.id, {
        prompt: dpoPrompt.trim(),
        response_a: dpoResponseA,
        response_b: dpoResponseB,
        preference: (dpoPreference as any) || undefined
      })
      setSelectedDPO(updated)
      setEditingDPO(null)
      showFeedback('success', 'DPO task updated.')
      loadData()
    } catch (err: any) {
      showFeedback('error', `Failed to update DPO task: ${err.message}`)
    }
  }

  const copyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left List Pane */}
      <div className="w-96 border-r border-border bg-card/40 flex flex-col shrink-0 select-none">
        {/* Tab Header */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mechon Corpus</h2>
            <div className="flex items-center rounded-lg bg-secondary p-0.5 border border-border">
              <button
                onClick={() => {
                  setActiveTab('sft')
                  setSelectedSFT(null)
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  activeTab === 'sft' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                SFT Records ({sftRecords.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('dpo')
                  setSelectedDPO(null)
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  activeTab === 'dpo' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                DPO Tasks ({dpoTasks.length})
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${activeTab.toUpperCase()} records by content or tag...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {activeTab === 'sft' && (
            <div className="pt-1">
              <LanguageFilter
                projectId={activeProjectId || ''}
                selectedMode={languageFilter}
                selectedPair={selectedPair}
                onModeChange={(m) => setLanguageFilter(m as any)}
                onPairChange={(p) => setSelectedPair(p)}
                className="w-full justify-between"
              />
            </div>
          )}
        </div>

        {/* Master Selection Control Bar */}
        <div className="px-3 py-2 bg-secondary/40 border-b border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeTab === 'sft') {
                  selectAllVisibleSft(sftRecords.map(r => r.id))
                } else {
                  selectAllVisibleDpo(dpoTasks.map(t => t.id))
                }
              }}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium text-xs cursor-pointer"
              title="Toggle select all visible"
            >
              {activeTab === 'sft' ? (
                sftRecords.length > 0 && sftRecords.every(r => isSftSelected(r.id)) ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )
              ) : (
                dpoTasks.length > 0 && dpoTasks.every(t => isDpoSelected(t.id)) ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )
              )}
              <span className="text-[11px]">Select All</span>
            </button>

            {(activeTab === 'sft' ? selectedSftIds.length : selectedDpoIds.length) > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-primary/20 text-primary font-mono font-bold text-[10px]">
                {activeTab === 'sft' ? selectedSftIds.length : selectedDpoIds.length} selected
              </span>
            )}
          </div>

          {(activeTab === 'sft' ? selectedSftIds.length : selectedDpoIds.length) > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (activeTab === 'sft') clearSftSelection()
                  else clearDpoSelection()
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={() => navigate(`/export?pipeline=${activeTab}&source=selected`)}
                className="px-2 py-1 rounded bg-primary text-primary-foreground font-semibold text-[10px] flex items-center gap-1 shadow-sm hover:opacity-90 cursor-pointer"
              >
                <Download className="h-3 w-3" />
                Export ({activeTab === 'sft' ? selectedSftIds.length : selectedDpoIds.length})
              </button>
            </div>
          )}
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-3">
              <RefreshCw className="h-6 w-6 text-primary animate-spin mx-auto" />
              <p>Loading Mechon Corpus records...</p>
            </div>
          ) : activeTab === 'sft' ? (
            sftRecords.length > 0 ? (
              sftRecords.map(r => {
                const isCurrent = selectedSFT?.id === r.id
                const isSelected = isSftSelected(r.id)
                const safeMessages = Array.isArray(r?.messages) ? r.messages : []
                const firstUser = safeMessages.find((m: any) => m?.role === 'user')
                const userContent = typeof firstUser?.content === 'string' ? firstUser.content : ''
                const title = r?.metadata?.title || userContent || 'Conversation Record'
                const isBilingual = r?.language_mode === 'bilingual' || safeMessages.some((m: any) => m?.translations && Object.keys(m.translations).length > 0)
                const tags = Array.isArray(r?.metadata?.tags) ? r.metadata.tags : []

                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedSFT(r)}
                    className={`p-3 rounded-lg text-xs cursor-pointer border transition-all space-y-1.5 ${
                      isCurrent
                        ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                        : isSelected
                        ? 'bg-primary/5 border-primary/40 text-foreground'
                        : 'bg-card/50 hover:bg-secondary/60 border-border/50 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          e.stopPropagation()
                          toggleSftSelection(r.id)
                        }}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground text-xs truncate max-w-[170px]">{title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            #{r.id.slice(0, 6)}
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {userContent || 'No prompt preview'}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1">
                          <span>{r.turn_count || safeMessages.length} turns</span>
                          <div className="flex items-center gap-1">
                            {isBilingual && (
                              <LanguageIdentityBadge
                                primaryLanguage={r.primary_language}
                                secondaryLanguage={r.secondary_language}
                                mode="bilingual"
                                compact
                              />
                            )}
                            {tags.length > 0 && (
                              <span className="text-primary truncate max-w-[70px]">
                                #{tags[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                <Database className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p>No SFT records match the current filter.</p>
                <button
                  onClick={() => navigate('/sft')}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs"
                >
                  Create in Mechon SFT
                </button>
              </div>
            )
          ) : (
            dpoTasks.length > 0 ? (
              dpoTasks.map(t => {
                const isCurrent = selectedDPO?.id === t.id
                const isSelected = isDpoSelected(t.id)
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedDPO(t)}
                    className={`p-3 rounded-lg text-xs cursor-pointer border transition-all space-y-1.5 ${
                      isCurrent
                        ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                        : isSelected
                        ? 'bg-primary/5 border-primary/40 text-foreground'
                        : 'bg-card/50 hover:bg-secondary/60 border-border/50 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          e.stopPropagation()
                          toggleDpoSelection(t.id)
                        }}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground text-xs truncate max-w-[170px]">{t.prompt}</span>
                          {t.preference ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                              {t.preference}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-accent text-muted-foreground">
                              PENDING
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {t.response_a || 'Awaiting response generation'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                <GitCompare className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p>No DPO preference tasks found.</p>
                <button
                  onClick={() => navigate('/dpo')}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs"
                >
                  Create in Mechon DPO
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Right Detail Inspection Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Detail Header */}
        <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card/40 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              {activeTab === 'sft' ? 'SFT Record Inspector' : 'DPO Pair Inspector'}
            </span>
            <span className="font-mono text-xs text-primary font-bold">
              {activeTab === 'sft' ? (selectedSFT ? `#${selectedSFT.id.slice(0, 8)}` : '') : (selectedDPO ? `#${selectedDPO.id.slice(0, 8)}` : '')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg bg-secondary p-0.5 border border-border">
              <button
                onClick={() => setViewMode('rendered')}
                className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 font-medium transition-colors ${
                  viewMode === 'rendered' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
                title="Rendered Dialogue View"
              >
                <Eye className="h-3.5 w-3.5" /> Rendered
              </button>
              {activeTab === 'sft' && (selectedSFT?.language_mode === 'bilingual' || selectedSFT?.messages?.some(m => m.translations && Object.keys(m.translations).length > 0)) && (
                <button
                  onClick={() => setViewMode('bilingual')}
                  className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 font-medium transition-colors ${
                    viewMode === 'bilingual' ? 'bg-cyan-600 text-white shadow-sm' : 'text-muted-foreground hover:text-cyan-400'
                  }`}
                  title="Side-by-Side Bilingual Aligned View"
                >
                  <Languages className="h-3.5 w-3.5" /> Bilingual Aligned
                </button>
              )}
              <button
                onClick={() => setViewMode('json')}
                className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 font-medium transition-colors ${
                  viewMode === 'json' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
                title="Raw JSON Schema View"
              >
                <Code2 className="h-3.5 w-3.5" /> JSON
              </button>
            </div>

            {/* Actions for SFT */}
            {activeTab === 'sft' && selectedSFT && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigate(`/sft?recordId=${selectedSFT.id}`)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs font-semibold transition-colors cursor-pointer"
                  title="Open and edit conversation in Universal Corpus Editor"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in Editor</span>
                </button>
                <button
                  onClick={() => openEditSFT(selectedSFT)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit Record Metadata"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => copyJson(selectedSFT)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy Record JSON"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleDuplicateSFT(selectedSFT.id)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Duplicate Record"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteSFT(selectedSFT.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete Record"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Actions for DPO */}
            {activeTab === 'dpo' && selectedDPO && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditDPO(selectedDPO)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit Task & Responses"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => copyJson(selectedDPO)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy DPO JSON"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleDuplicateDPO(selectedDPO.id)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title="Duplicate Task"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteDPO(selectedDPO.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete Task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notification Toast */}
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

        {/* Content Viewer */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'sft' ? (
            selectedSFT ? (
              viewMode === 'rendered' ? (
                <div className="max-w-4xl mx-auto space-y-4">
                  {/* Metadata Card */}
                  <div className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-foreground">
                        {selectedSFT.metadata?.title || 'Supervised Fine-Tuning Record'}
                      </h3>
                      <span className="font-mono text-muted-foreground text-[10px]">
                        Created: {new Date(selectedSFT.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedSFT.metadata?.tags?.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20 font-mono">
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/80 text-[11px] font-mono text-muted-foreground">
                      <div>Turns: {selectedSFT.turn_count} messages</div>
                      <div>Characters: {selectedSFT.character_count}</div>
                      <div>Format: Canonical OpenAI/TRL</div>
                    </div>
                  </div>

                  {/* Messages Flow */}
                  <div className="space-y-4 pt-2">
                    {(Array.isArray(selectedSFT.messages) ? selectedSFT.messages : []).map((m: any, idx: number) => {
                      const isUser = m?.role === 'user'
                      const isSystem = m?.role === 'system'
                      const messageContent = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2 ${
                            isSystem
                              ? 'bg-secondary/40 border-border/80 text-muted-foreground'
                              : isUser
                              ? 'bg-primary/15 border-primary/30 text-foreground'
                              : 'bg-card border-border text-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase font-bold border-b border-border/60 pb-1">
                            <span>{m?.role || 'message'}</span>
                            <span>Turn {idx + 1}</span>
                          </div>
                          <div className="prose prose-invert prose-xs max-w-none break-words">
                            <ReactMarkdown>{messageContent}</ReactMarkdown>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : viewMode === 'bilingual' ? (
                <div className="max-w-5xl mx-auto space-y-4">
                  {(() => {
                    const pInfo = lookupLanguage(selectedSFT.primary_language || 'id')
                    const sInfo = lookupLanguage(selectedSFT.secondary_language || 'en')
                    return (
                      <>
                        {/* Bilingual Header Banner */}
                        <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Languages className="h-5 w-5 text-cyan-400" />
                            <div>
                              <h4 className="font-bold text-foreground">Bilingual Parallel Dataset View</h4>
                              <p className="text-[11px] text-muted-foreground">
                                Aligned turn-by-turn between {pInfo.name} ({pInfo.code.toUpperCase()}) and {sInfo.name} ({sInfo.code.toUpperCase()})
                              </p>
                            </div>
                          </div>
                          <LanguageIdentityBadge
                            primaryLanguage={selectedSFT.primary_language}
                            secondaryLanguage={selectedSFT.secondary_language}
                            mode="bilingual"
                          />
                        </div>

                        {/* Side-by-Side Column Headers */}
                        <div className="grid grid-cols-2 gap-4 border-b border-border pb-2 text-xs font-bold uppercase tracking-wider">
                          <span className="text-primary flex items-center gap-1.5">
                            Primary Language ({pInfo.name} - {pInfo.code.toUpperCase()})
                            {pInfo.rtl && <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono">RTL</span>}
                          </span>
                          <span className="text-cyan-400 flex items-center gap-1.5">
                            Target Translation ({sInfo.name} - {sInfo.code.toUpperCase()})
                            {sInfo.rtl && <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono">RTL</span>}
                          </span>
                        </div>

                        {/* Aligned Turns */}
                        <div className="space-y-4">
                          {(Array.isArray(selectedSFT.messages) ? selectedSFT.messages : []).map((m: any, idx: number) => {
                            const secLang = selectedSFT.secondary_language || 'en'
                            const transObj = m?.translations && typeof m.translations === 'object' ? m.translations : {}
                            const rawTrans = transObj[secLang] ?? (Object.values(transObj)[0] ?? null)
                            const transText = typeof rawTrans === 'string' ? rawTrans : rawTrans ? JSON.stringify(rawTrans) : null

                            const statusObj = m?.translation_status && typeof m.translation_status === 'object' ? m.translation_status : {}
                            const rawStatus = statusObj[secLang] ?? (Object.values(statusObj)[0] ?? 'approved')
                            const status = typeof rawStatus === 'string' ? rawStatus : 'approved'
                            const primaryContent = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')

                            return (
                              <div key={idx} className="grid grid-cols-2 gap-4">
                                {/* Left: Primary Turn */}
                                <div className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs">
                                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase border-b border-border/60 pb-1">
                                    <span className="font-bold text-foreground">{m?.role || 'user'}</span>
                                    <span>Turn {idx + 1}</span>
                                  </div>
                                  <div
                                    dir={pInfo.rtl ? 'rtl' : 'ltr'}
                                    className={`prose prose-invert prose-xs max-w-none break-words ${
                                      pInfo.rtl ? 'text-right' : 'text-left'
                                    }`}
                                  >
                                    <ReactMarkdown>{primaryContent}</ReactMarkdown>
                                  </div>
                                </div>

                                {/* Right: Translated Turn */}
                                <div className="p-4 rounded-xl bg-card border border-cyan-500/30 space-y-2 text-xs">
                                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase border-b border-border/60 pb-1">
                                    <span className="font-bold text-cyan-400">{m?.role || 'assistant'} ({sInfo.code.toUpperCase()})</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-primary/20 text-primary'
                                    }`}>
                                      {status}
                                    </span>
                                  </div>
                                  <div
                                    dir={sInfo.rtl ? 'rtl' : 'ltr'}
                                    className={`prose prose-invert prose-xs max-w-none break-words ${
                                      sInfo.rtl ? 'text-right' : 'text-left'
                                    }`}
                                  >
                                    {transText ? (
                                      <ReactMarkdown>{transText}</ReactMarkdown>
                                    ) : (
                                      <span className="text-muted-foreground italic">No translation available for this turn</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  <pre className="p-4 rounded-xl bg-card border border-border text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
                    {JSON.stringify(selectedSFT, null, 2)}
                  </pre>
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Select an SFT record from the left list to inspect.
              </div>
            )
          ) : (
            selectedDPO ? (
              viewMode === 'rendered' ? (
                <div className="max-w-4xl mx-auto space-y-5 text-xs">
                  {/* Prompt Card */}
                  <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Prompt</span>
                    <div className="font-medium text-foreground leading-relaxed">{selectedDPO.prompt}</div>
                  </div>

                  {/* Side-by-Side Responses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border space-y-2 ${selectedDPO.preference === 'a' ? 'bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500/30' : 'bg-card border-border'}`}>
                      <div className="flex items-center justify-between border-b border-border/60 pb-1">
                        <span className="font-bold text-xs uppercase tracking-wider text-primary">Response A</span>
                        {selectedDPO.preference === 'a' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400">CHOSEN</span>
                        )}
                      </div>
                      <div className="prose prose-invert prose-xs max-w-none break-words">
                        <ReactMarkdown>{selectedDPO.response_a || '(Empty)'}</ReactMarkdown>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border space-y-2 ${selectedDPO.preference === 'b' ? 'bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500/30' : 'bg-card border-border'}`}>
                      <div className="flex items-center justify-between border-b border-border/60 pb-1">
                        <span className="font-bold text-xs uppercase tracking-wider text-indigo-400">Response B</span>
                        {selectedDPO.preference === 'b' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400">CHOSEN</span>
                        )}
                      </div>
                      <div className="prose prose-invert prose-xs max-w-none break-words">
                        <ReactMarkdown>{selectedDPO.response_b || '(Empty)'}</ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  {/* Annotation Rationale */}
                  {selectedDPO.rationale && (
                    <div className="p-4 rounded-xl bg-card border border-border space-y-1">
                      <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Annotator Rationale</span>
                      <p className="text-muted-foreground leading-relaxed">{selectedDPO.rationale}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  <pre className="p-4 rounded-xl bg-card border border-border text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
                    {JSON.stringify(selectedDPO, null, 2)}
                  </pre>
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Select a DPO task from the left list to inspect.
              </div>
            )
          )}
        </div>
      </div>

      {/* Edit SFT Record Modal */}
      {editingSFT && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h3 className="text-base font-bold text-foreground">Edit SFT Record Metadata</h3>
              <button onClick={() => setEditingSFT(null)} className="p-1 rounded-lg hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveEditSFT} className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Record Title</label>
                <input
                  type="text"
                  required
                  value={sftTitle}
                  onChange={e => setSftTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={sftTags}
                  onChange={e => setSftTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. reasoning, math, code"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingSFT(null)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-secondary font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-sm"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit DPO Task Modal */}
      {editingDPO && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h3 className="text-base font-bold text-foreground">Edit DPO Comparison Task</h3>
              <button onClick={() => setEditingDPO(null)} className="p-1 rounded-lg hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveEditDPO} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Prompt</label>
                <textarea
                  rows={2}
                  required
                  value={dpoPrompt}
                  onChange={e => setDpoPrompt(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Response A</label>
                <textarea
                  rows={4}
                  value={dpoResponseA}
                  onChange={e => setDpoResponseA(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Response B</label>
                <textarea
                  rows={4}
                  value={dpoResponseB}
                  onChange={e => setDpoResponseB(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Preference Choice</label>
                <select
                  value={dpoPreference}
                  onChange={e => setDpoPreference(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">(None - Pending)</option>
                  <option value="a">A is Better</option>
                  <option value="b">B is Better</option>
                  <option value="tie">Tie</option>
                  <option value="both_bad">Both Bad</option>
                  <option value="skip">Skip</option>
                  <option value="flag">Flag</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingDPO(null)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-secondary font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-sm"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
