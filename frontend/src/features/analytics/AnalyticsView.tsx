import React, { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Layers,
  Cpu,
  MessageSquareCode,
  GitCompare
} from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { useProjectStore } from '../../stores/useProjectStore'
import { getDashboardAnalytics } from '../../services/api'

export const AnalyticsView: React.FC = () => {
  const { activeProjectId } = useProjectStore()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [activeProjectId])

  const loadAnalytics = async () => {
    setIsLoading(true)
    try {
      const res = await getDashboardAnalytics(activeProjectId || undefined)
      setData(res)
    } finally {
      setIsLoading(false)
    }
  }

  const sftMetrics = data?.sft_metrics || {}
  const dpoMetrics = data?.dpo_metrics || {}

  // SFT Turn Distribution data
  const turnDist = sftMetrics?.turn_distribution || {}
  const turnChartData = Object.keys(turnDist).map(k => ({
    name: k,
    count: turnDist[k]
  }))

  // DPO Preference Pie Data
  const prefCounts = dpoMetrics?.preference_counts || {}
  const pieData = [
    { name: 'Response A', value: prefCounts.a || 0, color: '#6366f1' },
    { name: 'Response B', value: prefCounts.b || 0, color: '#818cf8' },
    { name: 'Tie', value: prefCounts.tie || 0, color: '#f59e0b' },
    { name: 'Both Bad', value: prefCounts.both_bad || 0, color: '#ef4444' }
  ].filter(item => item.value > 0)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Dataset Analytics & Intelligence
        </h2>
        <p className="text-xs text-muted-foreground">
          Quantitative statistics, turn distribution analysis, and preference ratios calculated from local records.
        </p>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-card border border-border space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Committed SFT Records</span>
          <div className="text-2xl font-bold font-mono text-primary">{sftMetrics.total_sft_records || 0}</div>
          <span className="text-[10px] text-muted-foreground">{sftMetrics.draft_sessions || 0} drafts in progress</span>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Completed DPO Pairs</span>
          <div className="text-2xl font-bold font-mono text-indigo-400">{dpoMetrics.completed || 0}</div>
          <span className="text-[10px] text-muted-foreground">{dpoMetrics.pending || 0} pending annotations</span>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Avg Turn Count</span>
          <div className="text-2xl font-bold font-mono text-emerald-400">{sftMetrics.avg_turns || 0}</div>
          <span className="text-[10px] text-muted-foreground">Mean messages per conversation</span>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase">Avg Character Depth</span>
          <div className="text-2xl font-bold font-mono text-amber-400">{sftMetrics.avg_characters || 0}</div>
          <span className="text-[10px] text-muted-foreground">Characters per record</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SFT Turn Distribution */}
        <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquareCode className="h-4 w-4 text-primary" /> SFT Conversation Lengths
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Turn Counts</span>
          </div>

          <div className="h-64 w-full pt-2">
            {turnChartData.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={turnChartData}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#11131a', borderColor: '#23283a', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No SFT records committed yet.
              </div>
            )}
          </div>
        </div>

        {/* DPO Preference Distribution */}
        <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <GitCompare className="h-4 w-4 text-indigo-400" /> DPO Preference Ratios
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Annotator Choices</span>
          </div>

          <div className="h-64 w-full pt-2">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#11131a', borderColor: '#23283a', borderRadius: '8px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No DPO annotations recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
