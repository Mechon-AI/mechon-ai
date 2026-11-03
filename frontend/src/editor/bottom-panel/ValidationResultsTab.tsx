import React, { useState } from 'react'
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { validateDataset } from '../../services/api'
import { useConsoleStore } from '../stores/useConsoleStore'
import type { ValidationReport } from '../../types'

export const ValidationResultsTab: React.FC = () => {
  const { getActiveProject } = useProjectStore()
  const { addLog } = useConsoleStore()

  const activeProject = getActiveProject()
  const [validating, setValidating] = useState(false)
  const [report, setReport] = useState<ValidationReport | null>(null)

  const handleRunValidation = async () => {
    if (!activeProject) return
    setValidating(true)
    try {
      const res = await validateDataset(activeProject.id, 'sft')
      setReport(res)
      const isValid = res.error_count === 0
      addLog(
        isValid ? 'success' : 'warn',
        'system',
        `Validation completed: ${res.total_records} records, ${res.error_count} errors, ${res.warning_count} warnings.`
      )
    } catch (e: any) {
      addLog('error', 'system', 'Validation run failed', e)
    } finally {
      setValidating(false)
    }
  }

  const isValid = report ? report.error_count === 0 : false

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      <div className="h-7 border-b border-border/80 px-3 flex items-center justify-between bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">
            Dataset Integrity & Quality Validation ({activeProject?.name || 'No Project'})
          </span>
        </div>

        <button
          onClick={handleRunValidation}
          disabled={validating || !activeProject}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${validating ? 'animate-spin' : ''}`} />
          Run Validation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {report ? (
          <div className="space-y-3">
            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                isValid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {isValid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <span className="font-semibold text-xs">
                  {isValid ? 'Dataset Conforms to Training Standards' : 'Validation Issues Detected'}
                </span>
              </div>
              <span className="font-mono text-xs">
                {report.total_records} Records Checked ({report.passed_records} Passed, {report.failed_records} Failed)
              </span>
            </div>

            {report.issues && report.issues.length > 0 ? (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
                  Discovered Issues ({report.issues.length})
                </span>
                <div className="rounded-xl border border-border divide-y divide-border/60 bg-card/60">
                  {report.issues.map((issue, idx) => (
                    <div key={idx} className="p-2.5 flex items-start gap-2.5">
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-foreground text-xs">{issue.message}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          Record ID: {issue.record_id || 'Global'} • Severity: {issue.severity || 'Warning'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-border bg-card/60 text-center text-xs text-muted-foreground">
                Zero syntax errors, empty messages, or schema alternation violations detected!
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-xs">
            Click "Run Validation" to verify your dataset against fine-tuning training standards.
          </div>
        )}
      </div>
    </div>
  )
}
