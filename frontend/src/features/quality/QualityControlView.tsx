import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Layers,
  FileCheck2,
  Filter
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { validateDataset } from '../../services/api'
import type { ValidationReport } from '../../types'

export const QualityControlView: React.FC = () => {
  const { activeProjectId } = useProjectStore()

  const [datasetType, setDatasetType] = useState<'sft' | 'dpo'>('sft')
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all')

  useEffect(() => {
    if (activeProjectId) {
      runValidation()
    }
  }, [activeProjectId, datasetType])

  const runValidation = async () => {
    if (!activeProjectId) return
    setIsLoading(true)
    try {
      const res = await validateDataset(activeProjectId, datasetType)
      setReport(res)
    } finally {
      setIsLoading(false)
    }
  }

  const issues = report?.issues || []
  const filteredIssues = issues.filter(issue => {
    if (filterSeverity === 'all') return true
    return issue.severity === filterSeverity
  })

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" /> Quality Control & Validation Engine
          </h2>
          <p className="text-xs text-muted-foreground">
            Automated schema checks, turn integrity, role sequencing, and duplicate anomaly detection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Dataset Type Switcher */}
          <div className="flex items-center rounded-lg bg-secondary p-0.5 border border-border">
            <button
              onClick={() => setDatasetType('sft')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                datasetType === 'sft' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Validate SFT
            </button>
            <button
              onClick={() => setDatasetType('dpo')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                datasetType === 'dpo' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Validate DPO
            </button>
          </div>

          <button
            onClick={runValidation}
            disabled={isLoading}
            className="p-2 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground"
            title="Re-run validation"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Records Scanned</span>
            <div className="text-2xl font-bold font-mono mt-1">{report.total_records}</div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
            <span className="text-[11px] font-medium text-emerald-400 uppercase">Passed Clean</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{report.passed_records}</div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
            <span className="text-[11px] font-medium text-destructive uppercase">Errors Found</span>
            <div className="text-2xl font-bold font-mono text-destructive mt-1">{report.error_count}</div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
            <span className="text-[11px] font-medium text-amber-400 uppercase">Warnings</span>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{report.warning_count}</div>
          </div>
        </div>
      )}

      {/* Issues Table */}
      <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Diagnostic Issues ({filteredIssues.length})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={filterSeverity}
              onChange={e => setFilterSeverity(e.target.value as any)}
              className="px-2 py-1 rounded bg-secondary border border-border text-xs focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="error">Errors Only</option>
              <option value="warning">Warnings Only</option>
            </select>
          </div>
        </div>

        {filteredIssues.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground font-mono text-[11px]">
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Record ID</th>
                  <th className="py-2.5 px-3">Issue Type</th>
                  <th className="py-2.5 px-3">Message</th>
                  <th className="py-2.5 px-3">Suggested Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredIssues.map((issue, idx) => (
                  <tr key={idx} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-3 px-3">
                      {issue.severity === 'error' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/20 text-destructive border border-destructive/30 uppercase">
                          ERROR
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                          WARNING
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                      #{issue.record_id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] font-medium text-foreground">
                      {issue.issue_type}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground max-w-xs">{issue.message}</td>
                    <td className="py-3 px-3 text-emerald-400 max-w-xs">{issue.suggested_fix || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground text-xs space-y-2">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
            <p className="font-semibold text-foreground">No quality issues detected!</p>
            <p className="text-[11px]">All checked records conform strictly to training schema standards.</p>
          </div>
        )}
      </div>
    </div>
  )
}
