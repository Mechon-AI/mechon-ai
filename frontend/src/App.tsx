import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'

import { DashboardView } from './features/dashboard/DashboardView'
import { ProjectsView } from './features/projects/ProjectsView'
import { SFTStudioView } from './features/sft/SFTStudioView'
import { DPOStudioView } from './features/dpo/DPOStudioView'
import { DatasetExplorerView } from './features/datasets/DatasetExplorerView'
import { PlaygroundView } from './features/playground/PlaygroundView'
import { QualityControlView } from './features/quality/QualityControlView'
import { AnalyticsView } from './features/analytics/AnalyticsView'
import { VersionHistoryView } from './features/versions/VersionHistoryView'
import { ExportCenterView } from './features/export/ExportCenterView'
import { ProviderManagerView } from './features/providers/ProviderManagerView'
import { SettingsView } from './features/settings/SettingsView'

import { TemplateValidationView } from './features/engineering/TemplateValidationView'
import { SequenceAnalyticsView } from './features/engineering/SequenceAnalyticsView'
import { DeduplicationView } from './features/engineering/DeduplicationView'
import { PersonaAuditView } from './features/engineering/PersonaAuditView'
import { SplitManagerView } from './features/engineering/SplitManagerView'
import { TrainingReadinessView } from './features/readiness/TrainingReadinessView'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<DashboardView />} />
            <Route path="projects" element={<ProjectsView />} />
            <Route path="sft" element={<SFTStudioView />} />
            <Route path="dpo" element={<DPOStudioView />} />
            <Route path="datasets" element={<DatasetExplorerView />} />
            <Route path="playground" element={<PlaygroundView />} />
            <Route path="quality" element={<QualityControlView />} />
            <Route path="analytics" element={<AnalyticsView />} />
            <Route path="versions" element={<VersionHistoryView />} />
            <Route path="export" element={<ExportCenterView />} />
            <Route path="engineering/templates" element={<TemplateValidationView />} />
            <Route path="engineering/sequence" element={<SequenceAnalyticsView />} />
            <Route path="engineering/dedup" element={<DeduplicationView />} />
            <Route path="engineering/persona" element={<PersonaAuditView />} />
            <Route path="engineering/splits" element={<SplitManagerView />} />
            <Route path="readiness" element={<TrainingReadinessView />} />
            <Route path="providers" element={<ProviderManagerView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
