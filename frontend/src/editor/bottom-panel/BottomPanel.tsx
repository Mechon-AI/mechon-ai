import React from 'react'
import {
  Terminal,
  Bot,
  Activity,
  ListTodo,
  Database,
  ShieldCheck,
  Radio,
  X,
  ChevronDown
} from 'lucide-react'
import { useEditorStore } from '../stores/useEditorStore'
import { useConsoleStore } from '../stores/useConsoleStore'
import { useTaskManagerStore } from '../stores/useTaskManagerStore'
import type { BottomPanelTab } from '../types'

import { ConsoleTab } from './ConsoleTab'
import { AgentLogsTab } from './AgentLogsTab'
import { DiagnosticsTab } from './DiagnosticsTab'
import { TaskManagerTab } from './TaskManagerTab'
import { DatasetPreviewTab } from './DatasetPreviewTab'
import { ValidationResultsTab } from './ValidationResultsTab'
import { InferenceLogsTab } from './InferenceLogsTab'

export const BottomPanel: React.FC = () => {
  const { layout, setBottomActiveTab, toggleBottomPanel } = useEditorStore()
  const { logs } = useConsoleStore()
  const { tasks } = useTaskManagerStore()

  const activeTab = layout.bottomActiveTab
  const activeTasksCount = tasks.filter((t) => t.status === 'running').length
  const agentLogsCount = logs.filter((l) => l.category === 'agent').length
  const errorLogsCount = logs.filter((l) => l.level === 'error').length

  const renderContent = () => {
    switch (activeTab) {
      case 'console':
        return <ConsoleTab />
      case 'agent-logs':
        return <AgentLogsTab />
      case 'diagnostics':
        return <DiagnosticsTab />
      case 'task-manager':
        return <TaskManagerTab />
      case 'dataset-preview':
        return <DatasetPreviewTab />
      case 'validation':
        return <ValidationResultsTab />
      case 'inference-logs':
        return <InferenceLogsTab />
      default:
        return <ConsoleTab />
    }
  }

  const tabs: { id: BottomPanelTab; label: string; icon: React.ElementType; badge?: number | string }[] = [
    { id: 'console', label: 'Console', icon: Terminal, badge: errorLogsCount > 0 ? `${errorLogsCount}!` : undefined },
    { id: 'agent-logs', label: 'Agent Logs', icon: Bot, badge: agentLogsCount > 0 ? agentLogsCount : undefined },
    { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
    { id: 'task-manager', label: 'Tasks', icon: ListTodo, badge: activeTasksCount > 0 ? activeTasksCount : undefined },
    { id: 'dataset-preview', label: 'Dataset Preview', icon: Database },
    { id: 'validation', label: 'Validation', icon: ShieldCheck },
    { id: 'inference-logs', label: 'Inference Logs', icon: Radio }
  ]

  return (
    <div className="h-full flex flex-col bg-card/60 backdrop-blur-md select-none overflow-hidden">
      {/* Tab Strip */}
      <div className="h-8 border-b border-border px-2 flex items-center justify-between bg-secondary/30 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setBottomActiveTab(tab.id)}
                className={`flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-secondary text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Icon className={`h-3 w-3 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1 py-0.2 rounded-full text-[9px] font-mono leading-none ${
                      String(tab.badge).includes('!')
                        ? 'bg-destructive/20 text-destructive font-bold'
                        : 'bg-primary/20 text-primary'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleBottomPanel(false)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Collapse Bottom Panel (Ctrl+J)"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}
