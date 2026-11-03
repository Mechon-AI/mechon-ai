import React, { useState, useEffect } from 'react'
import {
  GitFork,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Hash,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Lock
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { createDatasetSplit, listDatasetSplits } from '../../services/api'
import type { SplitSummary } from '../../types'

export const SplitManagerView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()

  const [splits, setSplits] = useState<SplitSummary[]>([])
  const [splitName, setSplitName] = useState<string>('prod-split-v1')
  const [seed, setSeed] = useState<number>(42)
  const [trainPct, setTrainPct] = useState<number>(80)
  const [valPct, setValPct] = useState<number>(10)
  const [evalPct, setEvalPct] = useState<number>(10)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedSplit, setSelectedSplit] = useState<SplitSummary | null>(null)

  useEffect(() => {
    loadSplits()
  }, [activeProjectId])

  const loadSplits = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (!pId) return

    setIsLoading(true)
    try {
      const list = await listDatasetSplits(pId)
      setSplits(list)
      if (list.length > 0) {
        setSelectedSplit(list[0])
      }
    } catch (err) {
      console.error('Failed to load dataset splits:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSplit = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (!pId || !splitName) return

    const totalPct = trainPct + valPct + evalPct
    if (Math.abs(totalPct - 100) > 0.01) {
      alert('Split percentages must sum to 100%.')
      return
    }

    setIsLoading(true)
    try {
      const newSplit = await createDatasetSplit(
        pId,
        splitName,
        seed,
        trainPct / 100.0,
        valPct / 100.0,
        evalPct / 100.0
      )
      setSplits([newSplit, ...splits])
      setSelectedSplit(newSplit)
      setSplitName(`split-${Date.now().toString().slice(-4)}`)
    } catch (err) {
      console.error('Failed to create dataset split:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GitFork className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Train / Eval Splitting & Leakage Prevention</h1>
              <p className="text-sm text-muted-foreground">
                Deterministic seeded partitioning with group isolation to guarantee 0 data leakage between train, val, and eval sets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadSplits()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-border bg-secondary/60 hover:bg-secondary text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Split Generator Card */}
      <div className="p-6 rounded-xl border border-border bg-card/60 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Configure Deterministic Partition
          </h3>
          <span className="text-xs bg-emerald-500/10 text-emerald-500 font-semibold px-2.5 py-0.5 rounded flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Group-Level Leakage Shield Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Split Name / Version</label>
            <input
              type="text"
              value={splitName}
              onChange={e => setSplitName(e.target.value)}
              placeholder="e.g. sft-train-split-v1"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Random Seed</label>
            <div className="relative">
              <input
                type="number"
                value={seed}
                onChange={e => setSeed(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                className="absolute right-2 top-2 text-xs text-primary hover:underline font-mono"
              >
                random
              </button>
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground">
              <span>Split Proportions</span>
              <span className="font-mono text-foreground">
                Train: {trainPct}% | Val: {valPct}% | Eval: {evalPct}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input
                  type="number"
                  min="1"
                  max="98"
                  value={trainPct}
                  onChange={e => {
                    const t = parseInt(e.target.value) || 0
                    setTrainPct(t)
                    const rem = 100 - t
                    setValPct(Math.floor(rem / 2))
                    setEvalPct(Math.ceil(rem / 2))
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono"
                  placeholder="Train %"
                />
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={valPct}
                  onChange={e => {
                    const v = parseInt(e.target.value) || 0
                    setValPct(v)
                    setEvalPct(100 - trainPct - v)
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono"
                  placeholder="Val %"
                />
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={evalPct}
                  onChange={e => {
                    const ev = parseInt(e.target.value) || 0
                    setEvalPct(ev)
                    setValPct(100 - trainPct - ev)
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono"
                  placeholder="Eval %"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-primary shrink-0" />
            Group isolation assigns multi-turn sessions and near-duplicate clusters atomically to prevent leakage.
          </p>

          <button
            onClick={handleCreateSplit}
            disabled={isLoading || !splitName}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm shrink-0"
          >
            Create Partition
          </button>
        </div>
      </div>

      {/* Historical Splits & Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Historical Splits List */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-sm font-semibold">Active & Saved Splits ({splits.length})</h3>

          <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border/60 max-h-[560px] overflow-y-auto">
            {splits.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No splits generated yet. Create your first deterministic train/eval partition above.
              </div>
            ) : (
              splits.map(sp => {
                const isSelected = selectedSplit?.split_id === sp.split_id
                return (
                  <button
                    key={sp.split_id}
                    onClick={() => setSelectedSplit(sp)}
                    className={`w-full p-4 text-left transition-colors ${
                      isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{sp.name}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        Seed: {sp.seed}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      <span>Total: <strong className="text-foreground">{sp.total_count}</strong></span>
                      <span>Train: <strong className="text-emerald-500">{sp.train_count}</strong></span>
                      <span>Val: <strong className="text-blue-500">{sp.val_count}</strong></span>
                      <span>Eval: <strong className="text-purple-500">{sp.eval_count}</strong></span>
                    </div>

                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-3 flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(sp.train_count / Math.max(1, sp.total_count)) * 100}%` }} />
                      <div className="bg-blue-500 h-full" style={{ width: `${(sp.val_count / Math.max(1, sp.total_count)) * 100}%` }} />
                      <div className="bg-purple-500 h-full" style={{ width: `${(sp.eval_count / Math.max(1, sp.total_count)) * 100}%` }} />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Selected Split Inspector */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="text-sm font-semibold">Partition Details & Leakage Verification</h3>

          {selectedSplit ? (
            <div className="border border-border rounded-xl bg-card p-6 space-y-6">
              <div className="flex items-start justify-between border-b border-border/60 pb-4">
                <div>
                  <h4 className="text-lg font-bold">{selectedSplit.name}</h4>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    Split ID: {selectedSplit.split_id}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSplit.zero_leakage_verified ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                      <ShieldCheck className="h-4 w-4" /> 0 Data Leakage Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                      <AlertTriangle className="h-4 w-4" /> Potential Boundary Overlap
                    </span>
                  )}
                </div>
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-border bg-secondary/30">
                  <div className="text-[11px] text-muted-foreground">Total Records</div>
                  <div className="text-lg font-bold mt-0.5">{selectedSplit.total_count}</div>
                </div>
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">Train Set</div>
                  <div className="text-lg font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">
                    {selectedSplit.train_count} ({((selectedSplit.train_count / Math.max(1, selectedSplit.total_count)) * 100).toFixed(1)}%)
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
                  <div className="text-[11px] text-blue-600 dark:text-blue-400">Validation</div>
                  <div className="text-lg font-bold mt-0.5 text-blue-600 dark:text-blue-400">
                    {selectedSplit.val_count} ({((selectedSplit.val_count / Math.max(1, selectedSplit.total_count)) * 100).toFixed(1)}%)
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
                  <div className="text-[11px] text-purple-600 dark:text-purple-400">Evaluation</div>
                  <div className="text-lg font-bold mt-0.5 text-purple-600 dark:text-purple-400">
                    {selectedSplit.eval_count} ({((selectedSplit.eval_count / Math.max(1, selectedSplit.total_count)) * 100).toFixed(1)}%)
                  </div>
                </div>
              </div>

              {/* Sample Partition Assignments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <span>Record Split Assignments (First 20 records)</span>
                  <span>{selectedSplit.assignments.length} total assignments</span>
                </div>

                <div className="border border-border/80 rounded-lg overflow-hidden divide-y divide-border/60 max-h-64 overflow-y-auto font-mono text-xs">
                  {selectedSplit.assignments.slice(0, 20).map(item => (
                    <div key={item.record_id} className="p-2.5 flex items-center justify-between hover:bg-secondary/40">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          item.split_name === 'train'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : item.split_name === 'val'
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'bg-purple-500/10 text-purple-500'
                        }`}>
                          {item.split_name}
                        </span>
                        <span className="text-foreground">{item.record_id}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {item.group_id ? `Group: ${item.group_id.slice(0, 8)}` : 'Single Turn'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-xl bg-card p-12 text-center text-sm text-muted-foreground">
              Select a split partition to inspect record distribution and leakage verification.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default SplitManagerView
