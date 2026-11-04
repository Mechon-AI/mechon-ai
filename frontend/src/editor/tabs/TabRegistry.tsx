import React from 'react'
import type { EditorTab } from '../types'
import { ErrorBoundary } from '../../components/common/ErrorBoundary'

import { DashboardView } from '../../features/dashboard/DashboardView'
import { ProjectsView } from '../../features/projects/ProjectsView'
import { StoryArchitectView } from '../../features/story_architect/StoryArchitectView'
import { SFTStudioView } from '../../features/sft/SFTStudioView'
import { DPOStudioView } from '../../features/dpo/DPOStudioView'
import { DatasetExplorerView } from '../../features/datasets/DatasetExplorerView'
import { DatasetForgeView } from '../../features/forge/DatasetForgeView'
import { PlaygroundView } from '../../features/playground/PlaygroundView'
import { QualityControlView } from '../../features/quality/QualityControlView'
import { AnalyticsView } from '../../features/analytics/AnalyticsView'
import { VersionHistoryView } from '../../features/versions/VersionHistoryView'
import { ExportCenterView } from '../../features/export/ExportCenterView'
import { ProviderManagerView } from '../../features/providers/ProviderManagerView'
import { SettingsView } from '../../features/settings/SettingsView'
import { TemplateValidationView } from '../../features/engineering/TemplateValidationView'
import { SequenceAnalyticsView } from '../../features/engineering/SequenceAnalyticsView'
import { DeduplicationView } from '../../features/engineering/DeduplicationView'
import { PersonaAuditView } from '../../features/engineering/PersonaAuditView'
import { SplitManagerView } from '../../features/engineering/SplitManagerView'
import { TrainingReadinessView } from '../../features/readiness/TrainingReadinessView'
import { RecordEditorView } from './RecordEditorView'

interface TabContentRendererProps {
  tab: EditorTab
}

export const TabContentRenderer: React.FC<TabContentRendererProps> = React.memo(({ tab }) => {
  const renderView = () => {
    switch (tab.type) {
      case 'dashboard':
        return <DashboardView />
      case 'projects':
        return <ProjectsView />
      case 'story-architect':
        return <StoryArchitectView />
      case 'sft':
        return <SFTStudioView />
      case 'dpo':
        return <DPOStudioView />
      case 'datasets':
        return <DatasetExplorerView />
      case 'forge':
        return <DatasetForgeView />
      case 'playground':
        return <PlaygroundView />
      case 'quality':
        return <QualityControlView />
      case 'analytics':
        return <AnalyticsView />
      case 'versions':
        return <VersionHistoryView />
      case 'export':
        return <ExportCenterView tab={tab} />
      case 'providers':
        return <ProviderManagerView />
      case 'settings':
        return <SettingsView />
      case 'engineering/templates':
        return <TemplateValidationView />
      case 'engineering/sequence':
        return <SequenceAnalyticsView />
      case 'engineering/dedup':
        return <DeduplicationView />
      case 'engineering/persona':
        return <PersonaAuditView />
      case 'engineering/splits':
        return <SplitManagerView />
      case 'readiness':
        return <TrainingReadinessView />
      case 'record-editor':
        return <RecordEditorView tabId={tab.id} params={tab.params as any} />
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            Module {tab.type} is not recognized.
          </div>
        )
    }
  }

  return (
    <div className="w-full h-full overflow-auto">
      <ErrorBoundary fallbackTitle={`Error in ${tab.title}`}>{renderView()}</ErrorBoundary>
    </div>
  )
})
