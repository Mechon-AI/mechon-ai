import React, { useState, useEffect } from 'react'
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
  ChevronRight
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useProjectStore } from '../../stores/useProjectStore'
import {
  getSFTRecords,
  deleteSFTRecord,
  duplicateSFTRecord,
  getDPOTasks,
  deleteDPOTask,
  duplicateDPOTask
} from '../../services/api'
import type { SFTRecord, DPOTask } from '../../types'

export const DatasetExplorerView: React.FC = () => {
  const { activeProjectId } = useProjectStore()

  const [activeTab, setActiveTab] = useState<'sft' | 'dpo'>('sft')
  const [search, setSearch] = useState('')
  const [sftRecords, setSftRecords] = useState<SFTRecord[]>([])
  const [dpoTasks, setDpoTasks] = useState<DPOTask[]>([])
  const [selectedSFT, setSelectedSFT] = useState<SFTRecord | null>(null)
  const [selectedDPO, setSelectedDPO] = useState<DPOTask | null>(null)
  const [viewMode, setViewMode] = useState<'rendered' | 'json'>('rendered')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (activeProjectId) {
      loadData()
    }
  }, [activeProjectId, activeTab, search])

  const loadData = async () => {
    if (!activeProjectId) return
    if (activeTab === 'sft') {
      const res = await getSFTRecords(activeProjectId, search || undefined)
      setSftRecords(res.records)
      if (res.records.length > 0 && !selectedSFT) {
        setSelectedSFT(res.records[0])
      }
    } else {
      const res = await getDPOTasks(activeProjectId, undefined, search || undefined)
      setDpoTasks(res.tasks)
      if (res.tasks.length > 0 && !selectedDPO) {
        setSelectedDPO(res.tasks[0])
      }
    }
  }

  const handleDeleteSFT = async (id: string) => {
    if (confirm('Delete this committed SFT conversation record?')) {
      await deleteSFTRecord(id)
      loadData()
      if (selectedSFT?.id === id) setSelectedSFT(null)
    }
  }

  const handleDeleteDPO = async (id: string) => {
    if (confirm('Delete this DPO preference task?')) {
      await deleteDPOTask(id)
      loadData()
      if (selectedDPO?.id === id) setSelectedDPO(null)
    }
  }

  const handleDuplicateSFT = async (id: string) => {
    await duplicateSFTRecord(id)
    loadData()
  }

  const handleDuplicateDPO = async (id: string) => {
    await duplicateDPOTask(id)
    loadData()
  }

  const copyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left List Pane */}
      <div className="w-96 border-r border-border bg-card/40 flex flex-col shrink-0">
        {/* Tab Header */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unified Explorer</h2>
            <div className="flex items-center rounded-lg bg-secondary p-0.5 border border-border">
              <button
                onClick={() => {
                  setActiveTab('sft')
                  setSelectedSFT(null)
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeTab === 'sft' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                SFT Records
              </button>
              <button
                onClick={() => {
                  setActiveTab('dpo')
                  setSelectedDPO(null)
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  activeTab === 'dpo' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                DPO Tasks
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${activeTab.toUpperCase()} records...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {activeTab === 'sft' ? (
            sftRecords.map(r => {
              const isSelected = selectedSFT?.id === r.id
              const firstUser = r.messages.find(m => m.role === 'user')
              const title = r.metadata.title || firstUser?.content || 'Conversation Record'

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedSFT(r)}
                  className={`p-3 rounded-lg text-xs cursor-pointer border transition-all space-y-1.5 ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                      : 'bg-card/50 hover:bg-secondary/60 border-border/50 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-xs truncate max-w-[200px]">{title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      #{r.id.slice(0, 6)}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {firstUser?.content || 'No prompt preview'}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1">
                    <span>{r.turn_count} turns • {r.character_count} chars</span>
                    {r.metadata.tags && r.metadata.tags.length > 0 && (
                      <span className="text-primary truncate max-w-[100px]">
                        {r.metadata.tags.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            dpoTasks.map(t => {
              const isSelected = selectedDPO?.id === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedDPO(t)}
                  className={`p-3 rounded-lg text-xs cursor-pointer border transition-all space-y-1.5 ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                      : 'bg-card/50 hover:bg-secondary/60 border-border/50 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-xs truncate max-w-[200px]">{t.prompt}</span>
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
              )
            })
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
            <span className="font-mono text-xs text-primary">
              {activeTab === 'sft' ? selectedSFT?.id : selectedDPO?.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg bg-secondary p-0.5 border border-border">
              <button
                onClick={() => setViewMode('rendered')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                  viewMode === 'rendered' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
                title="Rendered Dialogue View"
              >
                <Eye className="h-3.5 w-3.5" /> Rendered
              </button>
              <button
                onClick={() => setViewMode('json')}
                className={`p-1.5 rounded text-xs flex items-center gap-1 ${
                  viewMode === 'json' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
                title="Raw JSON Schema View"
              >
                <Code2 className="h-3.5 w-3.5" /> JSON
              </button>
            </div>

            {/* Actions */}
            {activeTab === 'sft' && selectedSFT && (
              <>
                <button
                  onClick={() => copyJson(selectedSFT)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  title="Copy Record JSON"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleDuplicateSFT(selectedSFT.id)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  title="Duplicate Record"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteSFT(selectedSFT.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Delete Record"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {activeTab === 'dpo' && selectedDPO && (
              <>
                <button
                  onClick={() => copyJson(selectedDPO)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  title="Copy DPO JSON"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleDuplicateDPO(selectedDPO.id)}
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  title="Duplicate Task"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteDPO(selectedDPO.id)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Delete Task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'sft' && selectedSFT ? (
            viewMode === 'rendered' ? (
              <div className="max-w-4xl mx-auto space-y-4">
                {/* Meta Banner */}
                <div className="p-4 rounded-xl bg-card border border-border text-xs space-y-2">
                  <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>Turns: {selectedSFT.turn_count}</span>
                    <span>Characters: {selectedSFT.character_count}</span>
                    <span>Revision: #{selectedSFT.revision}</span>
                  </div>
                  {selectedSFT.metadata.tags && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedSFT.metadata.tags.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-primary/20 text-primary">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Conversation Turns */}
                <div className="space-y-4">
                  {selectedSFT.messages.map((m, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs">
                      <span className="font-bold uppercase tracking-wider text-primary text-[10px] font-mono">
                        {m.role} • Turn #{idx + 1}
                      </span>
                      <div className="prose prose-invert prose-xs max-w-none">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <pre className="p-4 rounded-xl bg-secondary/40 border border-border text-xs font-mono overflow-auto max-w-4xl mx-auto">
                {JSON.stringify(selectedSFT, null, 2)}
              </pre>
            )
          ) : activeTab === 'dpo' && selectedDPO ? (
            viewMode === 'rendered' ? (
              <div className="max-w-4xl mx-auto space-y-4 text-xs">
                {/* Prompt */}
                <div className="p-4 rounded-xl bg-card border border-border space-y-1">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Evaluation Prompt</span>
                  <p className="font-medium">{selectedDPO.prompt}</p>
                </div>

                {/* Side-by-side completions */}
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className={`p-4 rounded-xl border ${
                      selectedDPO.preference === 'a' ? 'bg-emerald-950/20 border-emerald-500/60' : 'bg-card border-border'
                    }`}
                  >
                    <span className="font-bold text-[10px] uppercase text-primary block mb-2">Response A</span>
                    <div className="prose prose-invert prose-xs">
                      <ReactMarkdown>{selectedDPO.response_a}</ReactMarkdown>
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-xl border ${
                      selectedDPO.preference === 'b' ? 'bg-emerald-950/20 border-emerald-500/60' : 'bg-card border-border'
                    }`}
                  >
                    <span className="font-bold text-[10px] uppercase text-indigo-400 block mb-2">Response B</span>
                    <div className="prose prose-invert prose-xs">
                      <ReactMarkdown>{selectedDPO.response_b}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Preference Summary */}
                {selectedDPO.preference && (
                  <div className="p-4 rounded-xl bg-card border border-border space-y-1">
                    <span className="font-bold uppercase text-[10px] text-emerald-400">Chosen Preference: {selectedDPO.preference.toUpperCase()}</span>
                    {selectedDPO.rationale && <p className="text-muted-foreground">{selectedDPO.rationale}</p>}
                  </div>
                )}
              </div>
            ) : (
              <pre className="p-4 rounded-xl bg-secondary/40 border border-border text-xs font-mono overflow-auto max-w-4xl mx-auto">
                {JSON.stringify(selectedDPO, null, 2)}
              </pre>
            )
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Select a record from the list to inspect details.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
