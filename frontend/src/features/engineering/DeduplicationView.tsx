import React, { useState, useEffect } from 'react'
import {
  CopyCheck,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Info,
  ChevronRight,
  ExternalLink,
  Filter
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { runDeduplication, saveDuplicateDecision } from '../../services/api'
import type { DeduplicationReport, DuplicateGroup, DuplicateRecordEntry } from '../../types'
import { StudioRefreshButton } from '../../components/common/StudioRefreshButton'
import { useAutoDatasetSync } from '../../hooks/useAutoDatasetSync'

export const DeduplicationView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()

  const [threshold, setThreshold] = useState<number>(0.85)
  const [report, setReport] = useState<DeduplicationReport | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'exact' | 'normalized' | 'near'>('all')

  useEffect(() => {
    fetchDeduplication()
  }, [activeProjectId])

  useAutoDatasetSync(() => fetchDeduplication(), { enabled: true })

  const fetchDeduplication = async (overrideThreshold?: number) => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (!pId) return

    setIsLoading(true)
    try {
      const res = await runDeduplication(pId, overrideThreshold ?? threshold)
      setReport(res)
      if (res?.groups && res.groups.length > 0) {
        setSelectedGroup(res.groups[0])
      } else {
        setSelectedGroup(null)
      }
    } catch (err) {
      console.error('Failed to run deduplication:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDecision = async (
    groupId: string,
    recordId: string,
    decision: 'retain' | 'exclude' | 'acceptable',
    note?: string
  ) => {
    if (!activeProjectId) return
    try {
      await saveDuplicateDecision(activeProjectId, groupId, recordId, decision, note)
      // Update local state
      if (report) {
        const updatedGroups = (report.groups || []).map(g => {
          if (g.group_id === groupId) {
            const updatedRecords = (g.records || []).map(r => {
              if (r.record_id === recordId) {
                return { ...r, decision, note }
              }
              return r
            })
            return { ...g, records: updatedRecords }
          }
          return g
        })
        setReport({ ...report, groups: updatedGroups })
        if (selectedGroup && selectedGroup.group_id === groupId) {
          const updatedSelectedRecords = (selectedGroup.records || []).map(r => {
            if (r.record_id === recordId) {
              return { ...r, decision, note }
            }
            return r
          })
          setSelectedGroup({ ...selectedGroup, records: updatedSelectedRecords })
        }
      }
    } catch (err) {
      console.error('Failed to save duplicate decision:', err)
    }
  }

  const filteredGroups = (report?.groups || []).filter(g => {
    if (activeTab === 'all') return true
    return (g.match_type || 'near') === activeTab
  })

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CopyCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Deduplication & Near-Duplicate Review</h1>
              <p className="text-sm text-muted-foreground">
                Detect exact, normalized, and near-duplicate conversations with 3-gram Jaccard index and persistent human review.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StudioRefreshButton
            onRefresh={() => fetchDeduplication()}
            isRefreshing={isLoading}
            label="Run Audit"
          />
        </div>
      </div>

      {/* Threshold Control */}
      <div className="p-5 rounded-xl border border-border bg-card/60 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 w-full md:w-1/2">
          <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Near-Duplicate Jaccard Threshold</span>
            <span className="font-mono text-foreground text-sm font-bold">
              {(threshold * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.50"
            max="0.99"
            step="0.01"
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>50% (Loose)</span>
            <span>85% (Recommended)</span>
            <span>99% (Near-exact)</span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => fetchDeduplication(threshold)}
            disabled={isLoading}
            className="w-full md:w-auto px-4 py-2 border border-border bg-secondary/60 hover:bg-secondary text-sm font-medium rounded-lg transition-colors"
          >
            Apply Threshold
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Scanned Records</div>
            <div className="text-xl font-bold mt-0.5">{report.total_scanned}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Unique Records</div>
            <div className="text-xl font-bold mt-0.5 text-emerald-500">{report.unique_records}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Duplicate Groups</div>
            <div className="text-xl font-bold mt-0.5 text-amber-500">{report.duplicate_groups_count}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Exact (SHA-256)</div>
            <div className="text-xl font-bold mt-0.5 text-red-500">{report.exact_duplicates}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Normalized</div>
            <div className="text-xl font-bold mt-0.5 text-orange-500">{report.normalized_duplicates}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Near-Duplicates</div>
            <div className="text-xl font-bold mt-0.5 text-purple-500">{report.near_duplicates}</div>
          </div>
        </div>
      )}

      {/* Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Duplicate Clusters</h3>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  activeTab === 'all' ? 'bg-secondary font-medium' : 'text-muted-foreground'
                }`}
              >
                All ({(report?.groups || []).length})
              </button>
              <button
                onClick={() => setActiveTab('exact')}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  activeTab === 'exact' ? 'bg-red-500/10 text-red-500 font-medium' : 'text-muted-foreground'
                }`}
              >
                Exact
              </button>
              <button
                onClick={() => setActiveTab('near')}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  activeTab === 'near' ? 'bg-purple-500/10 text-purple-500 font-medium' : 'text-muted-foreground'
                }`}
              >
                Near
              </button>
            </div>
          </div>

          <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border/60 max-h-[560px] overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {report && (report.duplicate_groups_count ?? 0) === 0
                  ? 'No duplicate records detected in active project dataset.'
                  : 'No duplicate groups match active filter.'}
              </div>
            ) : (
              filteredGroups.map(grp => {
                const isSelected = selectedGroup?.group_id === grp.group_id
                const primary = (grp.records || [])[0]
                return (
                  <button
                    key={grp.group_id}
                    onClick={() => setSelectedGroup(grp)}
                    className={`w-full p-3.5 text-left flex items-start justify-between gap-3 transition-colors ${
                      isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-secondary/30'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                            grp.match_type === 'exact'
                              ? 'bg-red-500/10 text-red-500'
                              : grp.match_type === 'normalized'
                              ? 'bg-orange-500/10 text-orange-500'
                              : 'bg-purple-500/10 text-purple-500'
                          }`}
                        >
                          {grp.match_type || 'near'}
                        </span>
                        <span className="text-xs font-semibold truncate text-foreground">
                          {primary?.title || 'Conversation Cluster'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {primary?.preview || 'No preview available'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {(grp.records || []).length} records in cluster
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Side-by-Side Review & Decisions */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Cluster Comparison & Engineer Action</h3>
            {selectedGroup && (
              <span className="text-xs font-mono text-muted-foreground">
                Cluster ID: {(selectedGroup.group_id || '').slice(0, 10)}...
              </span>
            )}
          </div>

          {selectedGroup ? (
            <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
              {(selectedGroup.records || []).map((rec, idx) => {
                const isPrimary = idx === 0
                return (
                  <div
                    key={rec.record_id}
                    className={`border rounded-xl p-4 space-y-3 transition-colors ${
                      isPrimary
                        ? 'border-primary/40 bg-card'
                        : 'border-border bg-card/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          {isPrimary && (
                            <span className="text-[10px] bg-primary text-primary-foreground font-semibold px-2 py-0.5 rounded">
                              Primary Candidate
                            </span>
                          )}
                          <span className="text-xs font-mono font-medium">{rec.record_id}</span>
                          <span className="text-[11px] text-muted-foreground">
                            Similarity: {(rec.similarity_to_primary * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-sm font-semibold mt-1">{rec.title}</div>
                      </div>

                      {/* Decision Badges */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDecision(selectedGroup.group_id, rec.record_id, 'retain')}
                          className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                            rec.decision === 'retain'
                              ? 'bg-emerald-500 text-white border-emerald-600'
                              : 'border-border hover:bg-secondary text-muted-foreground'
                          }`}
                          title="Retain this record in training dataset"
                        >
                          Retain
                        </button>
                        <button
                          onClick={() => handleDecision(selectedGroup.group_id, rec.record_id, 'acceptable')}
                          className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                            rec.decision === 'acceptable'
                              ? 'bg-blue-500 text-white border-blue-600'
                              : 'border-border hover:bg-secondary text-muted-foreground'
                          }`}
                          title="Mark as acceptable intentional variation"
                        >
                          Acceptable
                        </button>
                        <button
                          onClick={() => handleDecision(selectedGroup.group_id, rec.record_id, 'exclude')}
                          className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                            rec.decision === 'exclude'
                              ? 'bg-red-500 text-white border-red-600'
                              : 'border-border hover:bg-secondary text-muted-foreground'
                          }`}
                          title="Exclude record from export and training splits"
                        >
                          Exclude
                        </button>
                      </div>
                    </div>

                    {rec.system_prompt && (
                      <div className="text-xs bg-secondary/40 p-2.5 rounded-lg border border-border/40 font-mono text-muted-foreground">
                        <span className="font-semibold text-foreground">System: </span>
                        {rec.system_prompt}
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-xs whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed border border-border/60">
                      {rec.preview}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="border border-border rounded-xl bg-card p-12 text-center text-sm text-muted-foreground">
              Select a duplicate cluster to review conversation differences and assign engineering retention decisions.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default DeduplicationView
