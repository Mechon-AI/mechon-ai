import React, { useState, useEffect } from 'react'
import {
  BarChart2,
  Sliders,
  Scissors,
  Layers,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  TrendingUp
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { runSequenceAnalytics } from '../../services/api'
import type { SequenceAnalyticsReport } from '../../types'
import { StudioRefreshButton } from '../../components/common/StudioRefreshButton'
import { useAutoDatasetSync } from '../../hooks/useAutoDatasetSync'

export const SequenceAnalyticsView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()

  const [modelFamily, setModelFamily] = useState<string>('llama')
  const [maxSeqLen, setMaxSeqLen] = useState<number>(4096)
  const [truncationStrategy, setTruncationStrategy] = useState<string>('tail')
  const [report, setReport] = useState<SequenceAnalyticsReport | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  useEffect(() => {
    fetchAnalytics()
  }, [activeProjectId, modelFamily, maxSeqLen, truncationStrategy])

  useAutoDatasetSync(() => fetchAnalytics(), { enabled: true })

  const fetchAnalytics = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (!pId) return

    setIsLoading(true)
    try {
      const res = await runSequenceAnalytics(pId, modelFamily, maxSeqLen, truncationStrategy, true)
      setReport(res)
    } catch (err) {
      console.error('Failed to run sequence analytics:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const modelFamilies = [
    { id: 'llama', name: 'Llama 3 (128k Vocab)' },
    { id: 'qwen', name: 'Qwen 2.5 (152k Vocab)' },
    { id: 'gemma', name: 'Gemma 2 (256k Vocab)' },
    { id: 'mistral', name: 'Mistral (32k Vocab)' },
    { id: 'generic', name: 'Standard Heuristic' }
  ]

  const contextLimits = [1024, 2048, 4096, 8192, 16384, 32768]

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BarChart2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sequence Length Analytics & Truncation Matrix</h1>
              <p className="text-sm text-muted-foreground">
                Model-aware token distribution, percentile metrics (P90/P95/P99), and multi-limit truncation simulations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StudioRefreshButton
            onRefresh={() => fetchAnalytics()}
            isRefreshing={isLoading}
            label="Recalculate"
          />
        </div>
      </div>

      {/* Control Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-xl border border-border bg-card/60">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tokenizer Family Multiplier
          </label>
          <select
            value={modelFamily}
            onChange={e => setModelFamily(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary"
          >
            {modelFamilies.map(mf => (
              <option key={mf.id} value={mf.id}>
                {mf.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Target Context Limit (max_seq_len)
          </label>
          <div className="flex gap-1.5">
            {contextLimits.map(lim => (
              <button
                key={lim}
                onClick={() => setMaxSeqLen(lim)}
                className={`flex-1 py-1.5 text-xs rounded-md border font-mono transition-colors ${
                  maxSeqLen === lim
                    ? 'border-primary bg-primary text-primary-foreground font-semibold'
                    : 'border-border/60 hover:bg-secondary text-muted-foreground'
                }`}
              >
                {lim >= 1024 ? `${lim / 1024}k` : lim}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Truncation Policy Strategy
          </label>
          <select
            value={truncationStrategy}
            onChange={e => setTruncationStrategy(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary capitalize"
          >
            <option value="tail">Tail Truncation (Preserve Instructions)</option>
            <option value="head">Head Truncation (Preserve Recent Turns)</option>
            <option value="none">Strict Rejection (No Truncation)</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-[11px] text-muted-foreground font-medium">Total Records</div>
              <div className="text-xl font-bold mt-0.5">{report.total_records ?? 0}</div>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-[11px] text-muted-foreground font-medium">Mean Tokens</div>
              <div className="text-xl font-bold mt-0.5">{(report.mean_len ?? 0).toFixed(0)}</div>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-[11px] text-muted-foreground font-medium">Median</div>
              <div className="text-xl font-bold mt-0.5">{report.median_len ?? 0}</div>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-[11px] text-muted-foreground font-medium">P90 Percentile</div>
              <div className="text-xl font-bold mt-0.5 text-blue-500">{report.p90_len ?? 0}</div>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-[11px] text-muted-foreground font-medium">P95 Percentile</div>
              <div className="text-xl font-bold mt-0.5 text-indigo-500">{report.p95_len ?? 0}</div>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-[11px] text-muted-foreground font-medium">P99 Percentile</div>
              <div className="text-xl font-bold mt-0.5 text-purple-500">{report.p99_len ?? 0}</div>
            </div>
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <div className="text-[11px] text-muted-foreground font-medium">Max Tokens</div>
              <div className="text-xl font-bold mt-0.5 text-amber-500">{report.max_len ?? 0}</div>
            </div>
          </div>

          {/* Truncation Alert Callout */}
          <div className="p-4 rounded-xl border border-border bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${(report.truncated_records_count ?? 0) > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {(report.truncated_records_count ?? 0) > 0 ? <Scissors className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
              </div>
              <div>
                <div className="text-sm font-semibold">
                  {(report.truncated_records_count ?? 0) > 0
                    ? `${report.truncated_records_count} Records (${(((report.truncated_records_count ?? 0) / Math.max(1, report.total_records ?? 1)) * 100).toFixed(1)}%) Exceed ${maxSeqLen} Limit`
                    : `100% of Dataset Records Fit Within ${maxSeqLen} Limit`}
                </div>
                <div className="text-xs text-muted-foreground">
                  Estimated {(report.truncated_tokens_count ?? 0).toLocaleString()} tokens clipped under {truncationStrategy} truncation strategy.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/50">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>Engineer Control: Simulation only. Source records remain 100% intact.</span>
            </div>
          </div>

          {/* Histogram Section */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Sequence Length Distribution</h3>
                <p className="text-xs text-muted-foreground">10-bucket histogram of estimated token lengths</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {(report.histogram || []).map((bucket, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <div className="w-28 font-mono text-muted-foreground text-right shrink-0">
                    {bucket.min_len ?? 0} - {bucket.max_len ?? 0}
                  </div>
                  <div className="flex-1 bg-secondary h-5 rounded overflow-hidden flex items-center">
                    <div
                      className="bg-primary/80 hover:bg-primary h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, bucket.percentage ?? 0))}%` }}
                    />
                  </div>
                  <div className="w-20 font-mono text-foreground text-right shrink-0">
                    {bucket.count ?? 0} ({(bucket.percentage ?? 0).toFixed(1)}%)
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Limit Matrix Comparison */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Multi-Limit Truncation Impact Matrix</h3>
              <p className="text-xs text-muted-foreground">
                Compare dataset retention and token loss across standard training budget limits
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2.5 px-3 font-semibold">Context Limit</th>
                    <th className="py-2.5 px-3 font-semibold">Within Limit</th>
                    <th className="py-2.5 px-3 font-semibold">Exceeding Limit</th>
                    <th className="py-2.5 px-3 font-semibold">Retention Rate</th>
                    <th className="py-2.5 px-3 font-semibold">Retained Tokens</th>
                    <th className="py-2.5 px-3 font-semibold">Tokens Clipped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(report.comparison_matrix || []).map(pt => {
                    const isCurrent = pt.limit === maxSeqLen
                    return (
                      <tr
                        key={pt.limit}
                        className={`hover:bg-secondary/40 transition-colors ${
                          isCurrent ? 'bg-primary/10 font-medium' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-semibold">
                          {pt.limit.toLocaleString()} tokens
                          {isCurrent && (
                            <span className="ml-2 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{pt.records_within_limit ?? 0} records</td>
                        <td className="py-2.5 px-3 font-mono text-amber-500">
                          {pt.records_exceeding_limit ?? 0} records
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-secondary h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full"
                                style={{ width: `${pt.pct_within_limit ?? 0}%` }}
                              />
                            </div>
                            <span className="font-mono">{(pt.pct_within_limit ?? 0).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          {(pt.total_tokens_at_limit ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-red-500">
                          {(pt.tokens_truncated ?? 0) > 0 ? `-${(pt.tokens_truncated ?? 0).toLocaleString()}` : '0'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
export default SequenceAnalyticsView
