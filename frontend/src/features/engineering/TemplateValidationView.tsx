import React, { useState, useEffect } from 'react'
import {
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
  Layers,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { getSupportedTemplateModels, validateChatTemplates } from '../../services/api'
import type { ModelTemplateDef, TemplateCompatibilitySummary, ValidationResult } from '../../types'

export const TemplateValidationView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()

  const [models, setModels] = useState<ModelTemplateDef[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>('llama-3-instruct')
  const [addGenerationPrompt, setAddGenerationPrompt] = useState<boolean>(false)
  const [summary, setSummary] = useState<TemplateCompatibilitySummary | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'errors' | 'warnings' | 'valid'>('all')
  const [inspectedRecord, setInspectedRecord] = useState<ValidationResult | null>(null)

  useEffect(() => {
    loadModels()
  }, [])

  useEffect(() => {
    if (selectedModelId) {
      runValidation()
    }
  }, [activeProjectId, selectedModelId, addGenerationPrompt])

  const loadModels = async () => {
    try {
      const defs = await getSupportedTemplateModels()
      setModels(defs)
      if (defs.length > 0 && !selectedModelId) {
        setSelectedModelId(defs[0].id)
      }
    } catch (err) {
      console.error('Failed to load supported template models:', err)
    }
  }

  const runValidation = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (!pId || !selectedModelId) return

    setIsLoading(true)
    try {
      const res = await validateChatTemplates(pId, selectedModelId, addGenerationPrompt)
      setSummary(res)
      if (res?.results && res.results.length > 0) {
        setInspectedRecord(res.results[0])
      } else {
        setInspectedRecord(null)
      }
    } catch (err) {
      console.error('Failed to validate chat templates:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedModel = models.find(m => m.id === selectedModelId)

  const filteredResults = (summary?.results || []).filter(r => {
    if (!r) return false
    const errCount = r.errors?.length || 0
    const warnCount = r.warnings?.length || 0
    if (activeFilter === 'errors') return !r.is_valid || errCount > 0
    if (activeFilter === 'warnings') return warnCount > 0
    if (activeFilter === 'valid') return r.is_valid && errCount === 0
    return true
  })

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileCode2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Model-Aware Chat Template Validation</h1>
              <p className="text-sm text-muted-foreground">
                Verify dataset schema compatibility against real Jinja2 chat templates for target foundation models.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => runValidation()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Revalidate
          </button>
        </div>
      </div>

      {/* Target Model & Options Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-xl border border-border bg-card/60">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Target Foundation Model
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {models.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedModelId(m.id)}
                className={`px-3 py-2.5 text-left rounded-lg border text-sm transition-all ${
                  selectedModelId === m.id
                    ? 'border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary'
                    : 'border-border/60 hover:border-border hover:bg-secondary/40 text-muted-foreground'
                }`}
              >
                <div className="font-semibold text-foreground text-xs">{m.name}</div>
                <div className="text-[11px] font-mono text-muted-foreground capitalize">{m.family}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 flex flex-col justify-between border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Template Controls
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={addGenerationPrompt}
                onChange={e => setAddGenerationPrompt(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-xs text-foreground">Add generation prompt</span>
            </label>
            <p className="text-[11px] text-muted-foreground mt-1">
              Appends assistant turn prefix for inference/evaluation mode.
            </p>
          </div>

          {selectedModel && (
            <div className="p-2.5 rounded-lg bg-secondary/50 text-[11px] space-y-1 font-mono text-muted-foreground border border-border/40">
              <div className="flex justify-between">
                <span>BOS:</span>
                <span className="text-foreground">{selectedModel.bos_token || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span>EOS:</span>
                <span className="text-foreground">{selectedModel.eos_token}</span>
              </div>
              <div className="flex justify-between">
                <span>System Role:</span>
                <span className={selectedModel.supports_system_role ? 'text-green-500 font-semibold' : 'text-amber-500'}>
                  {selectedModel.supports_system_role ? 'Native Support' : 'Mapped to User'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-xs text-muted-foreground font-medium">Total Evaluated</div>
            <div className="text-2xl font-bold mt-1">{summary.total_records}</div>
            <div className="text-[11px] text-muted-foreground mt-1">SFT multi-turn dialogues</div>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Compliant
            </div>
            <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {summary.compliant_records}
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-1">
              {summary.compliance_rate.toFixed(1)}% compatibility
            </div>
          </div>
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" />
              Non-Compliant
            </div>
            <div className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
              {summary.non_compliant_records}
            </div>
            <div className="text-[11px] text-red-600/80 mt-1">
              Requires template schema fixes
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-xs text-muted-foreground font-medium">Compliance Rate</div>
            <div className="text-2xl font-bold mt-1">{summary.compliance_rate.toFixed(1)}%</div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${
                  summary.compliance_rate >= 95
                    ? 'bg-emerald-500'
                    : summary.compliance_rate >= 80
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, summary.compliance_rate))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Validation Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Record List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Dataset Records</h3>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeFilter === 'all' ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/40'
                }`}
              >
                All ({(summary?.results || []).length})
              </button>
              <button
                onClick={() => setActiveFilter('errors')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeFilter === 'errors' ? 'bg-red-500/10 text-red-500 font-medium' : 'text-muted-foreground hover:bg-secondary/40'
                }`}
              >
                Errors ({(summary?.results || []).filter(r => !r.is_valid || (r.errors?.length || 0) > 0).length})
              </button>
              <button
                onClick={() => setActiveFilter('warnings')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeFilter === 'warnings' ? 'bg-amber-500/10 text-amber-500 font-medium' : 'text-muted-foreground hover:bg-secondary/40'
                }`}
              >
                Warnings ({(summary?.results || []).filter(r => (r.warnings?.length || 0) > 0).length})
              </button>
            </div>
          </div>

          <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border/60 max-h-[560px] overflow-y-auto">
            {filteredResults.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No records match current filter criteria.
              </div>
            ) : (
              filteredResults.map(res => {
                const isSelected = inspectedRecord?.record_id === res.record_id
                return (
                  <button
                    key={res.record_id}
                    onClick={() => setInspectedRecord(res)}
                    className={`w-full p-3.5 text-left flex items-start justify-between gap-3 transition-colors ${
                      isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-secondary/30'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {res.is_valid && (res.errors || []).length === 0 ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3 w-3" /> Valid
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                            <XCircle className="h-3 w-3" /> Incompatible
                          </span>
                        )}
                        {(res.warnings || []).length > 0 && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                            <AlertTriangle className="h-3 w-3" /> {(res.warnings || []).length}
                          </span>
                        )}
                        <span className="text-xs font-mono text-muted-foreground truncate">
                          {(res.record_id || '').slice(0, 8)}...
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Estimated tokens: <span className="font-mono text-foreground">{res.token_estimate ?? 0}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Inspector Detail */}
        <div className="lg:col-span-7 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Record Diagnostic & Render Preview</h3>

          {inspectedRecord ? (
            <div className="border border-border rounded-xl bg-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <div className="text-xs text-muted-foreground font-mono">Record ID</div>
                  <div className="text-sm font-mono font-medium">{inspectedRecord.record_id || 'N/A'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Token Estimate</div>
                  <div className="text-sm font-mono font-semibold text-primary">
                    {inspectedRecord.token_estimate ?? 0} tokens
                  </div>
                </div>
              </div>

              {/* Errors */}
              {(inspectedRecord.errors || []).length > 0 && (
                <div className="p-3.5 rounded-lg border border-red-500/30 bg-red-500/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
                    <XCircle className="h-4 w-4" />
                    Validation Failures ({(inspectedRecord.errors || []).length})
                  </div>
                  <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 list-disc list-inside">
                    {(inspectedRecord.errors || []).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {(inspectedRecord.warnings || []).length > 0 && (
                <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                    Template Warnings ({(inspectedRecord.warnings || []).length})
                  </div>
                  <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1 list-disc list-inside">
                    {(inspectedRecord.warnings || []).map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rendered Template Output */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Rendered Model Sequence
                  </label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Format: {selectedModel?.name}
                  </span>
                </div>
                <div className="p-4 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[360px] border border-border/80">
                  {inspectedRecord.rendered_template || (
                    <span className="text-muted-foreground italic">
                      Template rendering failed due to syntax or schema errors above.
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-xl bg-card p-12 text-center text-sm text-muted-foreground">
              Select a conversation record from the list to view its rendered chat template sequence and validation breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default TemplateValidationView
