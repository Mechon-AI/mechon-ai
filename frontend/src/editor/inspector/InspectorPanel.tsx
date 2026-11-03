import React from 'react'
import { Sliders, X, Eye, Info } from 'lucide-react'
import { useInspectorStore } from '../stores/useInspectorStore'
import { useEditorStore } from '../stores/useEditorStore'
import { useProjectStore } from '../../stores/useProjectStore'

import { DatasetInspector } from './DatasetInspector'
import { ConversationInspector } from './ConversationInspector'
import { AgentInspector } from './AgentInspector'
import { ProviderInspector } from './ProviderInspector'
import { ProjectInspector } from './ProjectInspector'

export const InspectorPanel: React.FC = () => {
  const { target, clear } = useInspectorStore()
  const { toggleRightPanel } = useEditorStore()
  const { getActiveProject } = useProjectStore()

  const activeProject = getActiveProject()

  // Fallback to active project if nothing is specifically selected
  const activeTarget = target || (activeProject ? { type: 'project', id: activeProject.id, title: activeProject.name, data: activeProject } : null)

  const renderContent = () => {
    if (!activeTarget) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground p-6">
          <Info className="h-8 w-8 stroke-[1.5] mb-2 opacity-50" />
          <p className="text-xs font-medium text-foreground">No Object Selected</p>
          <p className="text-[11px] mt-1 text-muted-foreground">
            Select a dataset record, conversation, agent, or provider to inspect and edit its properties.
          </p>
        </div>
      )
    }

    switch (activeTarget.type) {
      case 'dataset_record':
        return <DatasetInspector data={activeTarget.data} />
      case 'sft_session':
        return <ConversationInspector data={activeTarget.data} />
      case 'story_agent':
        return <AgentInspector data={activeTarget.data} />
      case 'provider':
        return <ProviderInspector data={activeTarget.data} />
      case 'project':
        return <ProjectInspector data={activeTarget.data} />
      default:
        return (
          <div className="p-3 text-xs text-muted-foreground">
            <pre className="font-mono text-[10px] bg-secondary/50 p-2 rounded-lg overflow-auto max-h-96">
              {JSON.stringify(activeTarget.data, null, 2)}
            </pre>
          </div>
        )
    }
  }

  return (
    <div className="h-full flex flex-col bg-card/60 backdrop-blur-md select-none overflow-hidden">
      {/* Inspector Header */}
      <div className="h-9 px-3 border-b border-border flex items-center justify-between shrink-0 bg-secondary/30">
        <div className="flex items-center gap-2">
          <Sliders className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
            Inspector
          </span>
        </div>

        <div className="flex items-center gap-1">
          {target && (
            <button
              onClick={clear}
              className="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Clear selection"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => toggleRightPanel(false)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Collapse Inspector (Ctrl+Shift+I)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {renderContent()}
      </div>
    </div>
  )
}
