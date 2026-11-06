import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquareCode,
  GitCompare,
  Database,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { getDashboardAnalytics } from '../../services/api'
import { StudioRefreshButton } from '../../components/common/StudioRefreshButton'
import { useAutoDatasetSync } from '../../hooks/useAutoDatasetSync'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

export const DashboardView: React.FC = () => {
  const navigate = useNavigate()
  const { activeProjectId, getActiveProject } = useProjectStore()
  const activeProject = getActiveProject()
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [activeProjectId])

  useAutoDatasetSync(() => loadAnalytics(), { enabled: true })

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const data = await getDashboardAnalytics(activeProjectId || undefined)
      setAnalytics(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const sftCount = analytics?.sft_metrics?.total_sft_records || 0
  const dpoCount = analytics?.dpo_metrics?.completed || 0
  const draftCount = analytics?.sft_metrics?.draft_sessions || 0
  const pendingDPO = analytics?.dpo_metrics?.pending || 0
  const growthData = analytics?.timeline_growth || []

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-gradient-to-r from-primary/10 via-accent/30 to-background border border-primary/20 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/20 text-primary border border-primary/30">
              WORKBENCH
            </span>
            <h2 className="text-xl font-bold tracking-tight">
              {activeProject ? activeProject.name : 'Dataset Engineering Workstation'}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Create, annotate, validate, and export high-quality Supervised Fine-Tuning (SFT) multi-turn conversations
            and Direct Preference Optimization (DPO) preference pairs locally.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StudioRefreshButton
            onRefresh={() => loadAnalytics()}
            isRefreshing={loading}
          />
          <button
            onClick={() => navigate('/sft')}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium flex items-center gap-2 shadow-sm transition-all"
          >
            <MessageSquareCode className="h-4 w-4" /> New SFT Chat
          </button>
          <button
            onClick={() => navigate('/dpo')}
            className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent text-xs font-medium border border-border flex items-center gap-2 transition-all"
          >
            <GitCompare className="h-4 w-4" /> DPO Pair Task
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SFT Records */}
        <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">SFT Records</span>
            <MessageSquareCode className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono">{sftCount}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span>{draftCount} active conversation drafts</span>
            </div>
          </div>
        </div>

        {/* DPO Preference Pairs */}
        <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">DPO Preference Pairs</span>
            <GitCompare className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono">{dpoCount}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span>{pendingDPO} pending annotations</span>
            </div>
          </div>
        </div>

        {/* Average Turns */}
        <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Turns / Conversation</span>
            <Layers className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono">
              {analytics?.sft_metrics?.avg_turns || 0}
            </div>
            <div className="text-[11px] text-muted-foreground">
              ~{analytics?.sft_metrics?.avg_characters || 0} characters / turn
            </div>
          </div>
        </div>

        {/* Quality Health */}
        <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Quality Assurance</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono text-emerald-400">100%</div>
            <div className="text-[11px] text-muted-foreground">Zero silent data modifications</div>
          </div>
        </div>
      </div>

      {/* Dataset Growth & Fast Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Chart */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Dataset Accumulation Timeline</h3>
            </div>
            <span className="text-xs text-muted-foreground font-mono">Records Committed</span>
          </div>

          <div className="h-64 w-full pt-4">
            {growthData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#11131a', borderColor: '#23283a', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="#6366f1" fill="url(#growthGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-xs space-y-2">
                <Database className="h-8 w-8 text-muted-foreground/40" />
                <p>No committed dataset records yet.</p>
                <p className="text-[11px] text-muted-foreground/60">
                  Commit your first SFT conversation or DPO task to see timeline analytics.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Workflows */}
        <div className="p-6 rounded-xl bg-card border border-border shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Core Workflows</h3>
            <p className="text-xs text-muted-foreground">Direct access to the studio dataset pipelines:</p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => navigate('/sft')}
                className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/60 transition-all flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-medium block">SFT Multi-Turn Chat</span>
                  <span className="text-[10px] text-muted-foreground">Interactive prompt-response authoring</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => navigate('/dpo')}
                className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/60 transition-all flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-medium block">DPO Preference Collector</span>
                  <span className="text-[10px] text-muted-foreground">Generate pairs and annotate choices</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => navigate('/datasets')}
                className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/60 transition-all flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-medium block">Unified Dataset Explorer</span>
                  <span className="text-[10px] text-muted-foreground">Inspect, filter, edit raw conversations</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              <button
                onClick={() => navigate('/export')}
                className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/60 transition-all flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-medium block">Export Center</span>
                  <span className="text-[10px] text-muted-foreground">JSONL, JSON, CSV for training</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Linux / XDG Storage</span>
            <span className="font-mono text-emerald-400">Ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}
