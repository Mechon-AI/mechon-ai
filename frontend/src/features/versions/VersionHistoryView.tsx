import React, { useState, useEffect } from 'react'
import {
  History,
  Plus,
  RotateCcw,
  GitCompare,
  FileCheck2,
  Copy,
  Check,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import {
  getVersions,
  createSnapshot,
  restoreSnapshot,
  compareSnapshots
} from '../../services/api'
import type { DatasetVersion } from '../../types'

export const VersionHistoryView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()

  const [versions, setVersions] = useState<DatasetVersion[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDiffModal, setShowDiffModal] = useState(false)
  const [diffResult, setDiffResult] = useState<any>(null)

  const [versionTag, setVersionTag] = useState('')
  const [datasetType, setDatasetType] = useState('combined')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedSha, setCopiedSha] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Compare selections
  const [versionA, setVersionA] = useState('')
  const [versionB, setVersionB] = useState('')

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  useEffect(() => {
    initView()
  }, [activeProjectId])

  const initView = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (pId) {
      loadVersions(pId)
    }
  }

  const loadVersions = async (projectId?: string) => {
    const targetProject = projectId || activeProjectId
    if (!targetProject) return
    try {
      const list = await getVersions(targetProject)
      setVersions(list)
      if (list.length >= 2) {
        setVersionA(list[0].id)
        setVersionB(list[1].id)
      }
    } catch (err: any) {
      showFeedback('error', `Failed to load versions: ${err.message}`)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProjectId || !versionTag.trim()) return
    setIsSubmitting(true)
    try {
      await createSnapshot({
        project_id: activeProjectId,
        dataset_type: datasetType,
        version_tag: versionTag.trim(),
        description: description.trim()
      })
      await loadVersions()
      setShowCreateModal(false)
      setVersionTag('')
      setDescription('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestore = async (versionId: string, tag: string) => {
    if (confirm(`Are you sure you want to rollback the dataset to snapshot "${tag}"? Current unversioned changes will be replaced.`)) {
      await restoreSnapshot(versionId)
      alert(`Dataset rolled back to snapshot ${tag}!`)
    }
  }

  const handleCompare = async () => {
    if (!versionA || !versionB) return
    try {
      const res = await compareSnapshots(versionA, versionB)
      setDiffResult(res)
      setShowDiffModal(true)
    } catch (err: any) {
      alert(`Comparison failed: ${err.message}`)
    }
  }

  const copySha = (sha: string) => {
    navigator.clipboard.writeText(sha)
    setCopiedSha(sha)
    setTimeout(() => setCopiedSha(null), 2000)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Dataset Version History & Snapshots
          </h2>
          <p className="text-xs text-muted-foreground">
            Cryptographic SHA-256 snapshots, dataset comparison diffs, and instant state rollbacks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {versions.length >= 2 && (
            <button
              onClick={handleCompare}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent border border-border text-xs font-medium flex items-center gap-1.5"
            >
              <GitCompare className="h-3.5 w-3.5" /> Compare Snapshots
            </button>
          )}

          <button
            onClick={() => {
              const defaultTag = `v1.${versions.length}.0`
              setVersionTag(defaultTag)
              setShowCreateModal(true)
            }}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Create Snapshot
          </button>
        </div>
      </div>

      {/* Snapshots List */}
      <div className="space-y-3">
        {versions.length > 0 ? (
          versions.map(v => (
            <div
              key={v.id}
              className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-sm text-foreground">{v.version_tag}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/20 text-primary border border-primary/30 uppercase">
                    {v.dataset_type}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {v.record_count} records
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">{v.description || v.change_summary}</p>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                  <span>SHA-256: {v.checksum_sha256.slice(0, 16)}...</span>
                  <button
                    onClick={() => copySha(v.checksum_sha256)}
                    className="hover:text-foreground text-[10px]"
                    title="Copy full checksum"
                  >
                    {copiedSha === v.checksum_sha256 ? (
                      <Check className="h-3 w-3 text-emerald-400 inline" />
                    ) : (
                      <Copy className="h-3 w-3 inline" />
                    )}
                  </button>
                  <span>• {new Date(v.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleRestore(v.id, v.version_tag)}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent border border-border text-xs font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-400" /> Restore Snapshot
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 rounded-xl bg-card border border-border text-center text-xs text-muted-foreground space-y-2">
            <History className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="font-semibold text-foreground">No snapshots created yet.</p>
            <p className="text-[11px]">
              Take a snapshot to freeze your dataset version with a cryptographic SHA-256 checksum before fine-tuning.
            </p>
          </div>
        )}
      </div>

      {/* Create Snapshot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold">Create Dataset Snapshot</h3>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium text-muted-foreground">Version Tag</label>
                <input
                  type="text"
                  required
                  value={versionTag}
                  onChange={e => setVersionTag(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  placeholder="e.g. v1.0.0"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-muted-foreground">Dataset Scope</label>
                <select
                  value={datasetType}
                  onChange={e => setDatasetType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="combined">Combined (SFT + DPO)</option>
                  <option value="sft">SFT Records Only</option>
                  <option value="dpo">DPO Tasks Only</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-muted-foreground">Description / Release Notes</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Notes on curation, filtering, or downstream model target..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !versionTag.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Snapshot Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compare Diff Modal */}
      {showDiffModal && diffResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4 text-xs">
            <h3 className="text-base font-bold">Snapshot Comparison Diff</h3>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] text-muted-foreground uppercase">Added</span>
                <div className="text-xl font-bold font-mono text-emerald-400">+{diffResult.added_count}</div>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-[10px] text-muted-foreground uppercase">Removed</span>
                <div className="text-xl font-bold font-mono text-destructive">-{diffResult.removed_count}</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] text-muted-foreground uppercase">Modified</span>
                <div className="text-xl font-bold font-mono text-amber-400">~{diffResult.modified_count}</div>
              </div>
            </div>

            <div className="space-y-1 font-mono text-[11px] text-muted-foreground p-3 rounded-lg bg-secondary/50 border border-border">
              <div>Version A: {diffResult.version_a.tag} ({diffResult.version_a.count} recs)</div>
              <div>Version B: {diffResult.version_b.tag} ({diffResult.version_b.count} recs)</div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
