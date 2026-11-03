import React, { useState, useEffect } from 'react'
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  FileText,
  Shield,
  Layers,
  ChevronDown,
  Info,
  Calendar,
  Cpu
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { generateTrainingReadinessReport, listReadinessReports } from '../../services/api'
import type { TrainingReadinessReport, ReadinessCheckItem } from '../../types'

export const TrainingReadinessView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()

  const [modelFamily, setModelFamily] = useState<string>('llama')
  const [maxSeqLen, setMaxSeqLen] = useState<number>(4096)
  const [reportTitle, setReportTitle] = useState<string>('Production Readiness Audit')
  const [currentReport, setCurrentReport] = useState<TrainingReadinessReport | null>(null)
  const [reportsList, setReportsList] = useState<TrainingReadinessReport[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  useEffect(() => {
    loadReports()
  }, [activeProjectId])

  const loadReports = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (!pId) return

    setIsLoading(true)
    try {
      const list = await listReadinessReports(pId)
      setReportsList(list)
      if (list.length > 0) {
        setCurrentReport(list[0])
      } else {
        // Automatically generate first report
        handleGenerateReport(pId)
      }
    } catch (err) {
      console.error('Failed to load readiness reports:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateReport = async (overrideProjectId?: string) => {
    const pId = overrideProjectId || activeProjectId
    if (!pId) return

    setIsLoading(true)
    try {
      const report = await generateTrainingReadinessReport(
        pId,
        reportTitle,
        modelFamily,
        maxSeqLen
      )
      setCurrentReport(report)
      setReportsList([report, ...reportsList.filter(r => r.report_id !== report.report_id)])
    } catch (err) {
      console.error('Failed to generate training readiness report:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadMarkdown = () => {
    if (!currentReport) return
    const blob = new Blob([currentReport.markdown_summary], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `readiness-report-${currentReport.report_id.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadJson = () => {
    if (!currentReport) return
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `readiness-report-${currentReport.report_id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileCheck2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Training Readiness Report</h1>
              <p className="text-sm text-muted-foreground">
                Comprehensive 8-dimension pre-flight audit for fine-tuning dataset certification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentReport && (
            <>
              <button
                onClick={downloadMarkdown}
                className="flex items-center gap-2 px-3 py-2 border border-border bg-secondary/60 hover:bg-secondary text-sm font-medium rounded-lg transition-colors"
                title="Export as GitHub Flavored Markdown"
              >
                <Download className="h-4 w-4" />
                Markdown
              </button>
              <button
                onClick={downloadJson}
                className="flex items-center gap-2 px-3 py-2 border border-border bg-secondary/60 hover:bg-secondary text-sm font-medium rounded-lg transition-colors"
                title="Export as JSON Diagnostics"
              >
                <FileText className="h-4 w-4" />
                JSON
              </button>
            </>
          )}

          <button
            onClick={() => handleGenerateReport()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Run Full Audit
          </button>
        </div>
      </div>

      {/* Target Configuration Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-xl border border-border bg-card/60">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Audit Title / Release Tag
          </label>
          <input
            type="text"
            value={reportTitle}
            onChange={e => setReportTitle(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary"
            placeholder="e.g. Llama 3 8B Instruct Fine-Tuning v1.0"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Target Foundation Model
          </label>
          <select
            value={modelFamily}
            onChange={e => setModelFamily(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary capitalize"
          >
            <option value="llama">Llama 3 (Meta)</option>
            <option value="qwen">Qwen 2.5 (Alibaba)</option>
            <option value="gemma">Gemma 2 (Google)</option>
            <option value="mistral">Mistral (Mistral AI)</option>
            <option value="phi">Phi 3 / 3.5 (Microsoft)</option>
            <option value="chatml">ChatML Generic</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Context Limit (Tokens)
          </label>
          <select
            value={maxSeqLen}
            onChange={e => setMaxSeqLen(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:ring-1 focus:ring-primary"
          >
            <option value={2048}>2,048 tokens</option>
            <option value={4096}>4,096 tokens</option>
            <option value={8192}>8,192 tokens</option>
            <option value={16384}>16,384 tokens</option>
            <option value={32768}>32,768 tokens</option>
          </select>
        </div>
      </div>

      {/* Main Status Banner */}
      {currentReport && (
        <div
          className={`p-6 rounded-2xl border transition-all ${
            currentReport.overall_status === 'READY'
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : currentReport.overall_status === 'READY_WITH_WARNINGS'
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-red-500/40 bg-red-500/10'
          }`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {currentReport.overall_status === 'READY' ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
              ) : currentReport.overall_status === 'READY_WITH_WARNINGS' ? (
                <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500 shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold tracking-tight">
                    {currentReport.overall_status === 'READY' && 'CERTIFIED FOR TRAINING'}
                    {currentReport.overall_status === 'READY_WITH_WARNINGS' && 'READY WITH QUALITY WARNINGS'}
                    {currentReport.overall_status === 'BLOCKED' && 'TRAINING BLOCKED — ACTION REQUIRED'}
                  </h2>
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      currentReport.overall_status === 'READY'
                        ? 'bg-emerald-500 text-white'
                        : currentReport.overall_status === 'READY_WITH_WARNINGS'
                        ? 'bg-amber-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {currentReport.overall_status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Evaluated {currentReport.total_records} records against {currentReport.target_model.toUpperCase()} at {currentReport.max_seq_len} token limit.
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-muted-foreground font-mono">
              <div>Report ID: {currentReport.report_id.slice(0, 12)}</div>
              <div>Generated: {new Date(currentReport.generated_at).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* 8-Dimension Audit Checklist */}
      {currentReport && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold tracking-tight">Readiness Dimensions Checklist</h3>
            <span className="text-xs text-muted-foreground">
              {currentReport.checks.filter(c => c.status === 'pass').length} / {currentReport.checks.length} Passed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentReport.checks.map(item => (
              <div
                key={item.dimension}
                className={`p-5 rounded-xl border bg-card transition-all space-y-2.5 ${
                  item.status === 'pass'
                    ? 'border-border'
                    : item.status === 'warn'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-red-500/40 bg-red-500/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.status === 'pass' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : item.status === 'warn' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <span className="font-semibold text-sm text-foreground">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.is_mandatory && (
                      <span className="text-[10px] uppercase font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                        Mandatory
                      </span>
                    )}
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        item.status === 'pass'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : item.status === 'warn'
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  {item.details}
                </p>

                {item.recommendation && (
                  <div className="ml-6 p-2.5 rounded-lg bg-secondary/60 border border-border/40 text-xs text-foreground flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>
                      <strong>Recommendation:</strong> {item.recommendation}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Reports */}
      {reportsList.length > 1 && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-3">
          <h3 className="text-sm font-semibold">Prior Audit Reports</h3>
          <div className="divide-y divide-border/60">
            {reportsList.map(r => (
              <div
                key={r.report_id}
                onClick={() => setCurrentReport(r)}
                className={`py-2.5 px-3 flex items-center justify-between text-xs cursor-pointer hover:bg-secondary/40 rounded transition-colors ${
                  currentReport?.report_id === r.report_id ? 'bg-primary/10 font-medium' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      r.overall_status === 'READY'
                        ? 'bg-emerald-500'
                        : r.overall_status === 'READY_WITH_WARNINGS'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span>{r.title}</span>
                  <span className="font-mono text-muted-foreground">({r.target_model})</span>
                </div>
                <div className="font-mono text-muted-foreground">
                  {new Date(r.generated_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
export default TrainingReadinessView
