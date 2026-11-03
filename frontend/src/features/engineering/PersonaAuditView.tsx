import React, { useState, useEffect } from 'react'
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Info,
  Shield,
  Layers,
  FileText
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { runPersonaAudit } from '../../services/api'
import type { PersonaAuditReport, SystemPromptCluster, PersonaWarning } from '../../types'

export const PersonaAuditView: React.FC = () => {
  const { activeProjectId, ensureActiveProject } = useProjectStore()

  const [policy, setPolicy] = useState<string>('multiple_intentional_personas')
  const [report, setReport] = useState<PersonaAuditReport | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedCluster, setSelectedCluster] = useState<SystemPromptCluster | null>(null)

  useEffect(() => {
    fetchAudit()
  }, [activeProjectId, policy])

  const fetchAudit = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (!pId) return

    setIsLoading(true)
    try {
      const res = await runPersonaAudit(pId, policy)
      setReport(res)
      if (res.clusters.length > 0) {
        setSelectedCluster(res.clusters[0])
      } else {
        setSelectedCluster(null)
      }
    } catch (err) {
      console.error('Failed to run persona audit:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const policies = [
    {
      id: 'single_consistent_persona',
      name: 'Single Consistent Persona',
      desc: 'Enforces >85% identity consistency with a unified system persona for single-model fine-tuning.'
    },
    {
      id: 'multiple_intentional_personas',
      name: 'Multiple Intentional Personas',
      desc: 'Permits distinct task-specific roles, flagging unintentional fragmentation and tone drift.'
    },
    {
      id: 'mixed_instruction',
      name: 'Mixed Instruction / Generalist',
      desc: 'Allows diverse instructions with permissive persona checks.'
    }
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Prompt & Persona Audit</h1>
              <p className="text-sm text-muted-foreground">
                Inspect persona distribution, detect instruction contradictions, and enforce identity policy compliance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAudit()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Run Audit
          </button>
        </div>
      </div>

      {/* Policy Selector */}
      <div className="p-5 rounded-xl border border-border bg-card/60 space-y-3">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          Target Dataset Persona Policy
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {policies.map(p => (
            <button
              key={p.id}
              onClick={() => setPolicy(p.id)}
              className={`p-3.5 text-left rounded-xl border text-sm transition-all ${
                policy === p.id
                  ? 'border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary'
                  : 'border-border/60 hover:border-border hover:bg-secondary/40 text-muted-foreground'
              }`}
            >
              <div className="font-semibold text-foreground text-xs">{p.name}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-normal">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Row */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Total Records</div>
            <div className="text-xl font-bold mt-0.5">{report.total_records}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">With System Prompt</div>
            <div className="text-xl font-bold mt-0.5 text-emerald-500">
              {report.records_with_system_prompt}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Missing System</div>
            <div className="text-xl font-bold mt-0.5 text-amber-500">
              {report.records_missing_system_prompt}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Unique Personas</div>
            <div className="text-xl font-bold mt-0.5 text-purple-500">
              {report.unique_system_prompts}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Dominant Persona</div>
            <div className="text-xl font-bold mt-0.5 text-blue-500">
              {report.dominant_persona_share.toFixed(1)}%
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-border bg-card">
            <div className="text-[11px] text-muted-foreground font-medium">Policy Compliance</div>
            <div className="mt-1 flex items-center gap-1.5">
              {report.is_policy_compliant ? (
                <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Compliant
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Non-Compliant
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warnings & Persona Clusters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Warnings & Diagnostics */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-semibold">Persona Warnings & Policy Violations</h3>

          {report && report.warnings.length > 0 ? (
            <div className="space-y-2.5">
              {report.warnings.map((w, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border space-y-1 ${
                    w.severity === 'critical'
                      ? 'border-red-500/30 bg-red-500/10'
                      : w.severity === 'warning'
                      ? 'border-amber-500/30 bg-amber-500/10'
                      : 'border-blue-500/30 bg-blue-500/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {w.severity === 'critical' ? (
                      <AlertOctagon className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {w.warning_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] ml-auto font-mono text-muted-foreground">
                      {w.affected_records_count} records
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-6">{w.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 border border-border rounded-xl bg-card text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
              No persona conflicts or policy violations detected.
            </div>
          )}
        </div>

        {/* Persona Frequency Clusters */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">System Prompt Clusters</h3>
            <span className="text-xs text-muted-foreground">
              {report?.clusters.length || 0} unique personas identified
            </span>
          </div>

          <div className="border border-border rounded-xl bg-card overflow-hidden divide-y divide-border/60 max-h-[560px] overflow-y-auto">
            {report?.clusters.map(cluster => {
              const isSelected = selectedCluster?.cluster_id === cluster.cluster_id
              return (
                <div
                  key={cluster.cluster_id}
                  onClick={() => setSelectedCluster(cluster)}
                  className={`p-4 transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-secondary/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-foreground">
                      Cluster {cluster.cluster_id}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-primary font-bold">
                        {cluster.count} records ({cluster.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-950 text-zinc-200 font-mono text-xs whitespace-pre-wrap leading-relaxed border border-border/60 max-h-32 overflow-y-auto">
                    {cluster.prompt_text || (
                      <span className="text-muted-foreground italic">
                        [Empty System Prompt / Direct User Turn]
                      </span>
                    )}
                  </div>

                  {cluster.sample_record_ids.length > 0 && (
                    <div className="mt-2 text-[11px] text-muted-foreground font-mono truncate">
                      Sample records: {cluster.sample_record_ids.join(', ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
export default PersonaAuditView
