import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditorShell } from './editor/shell/EditorShell'
import { useEditorStore } from './editor/stores/useEditorStore'
import type { EditorTabType } from './editor/types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/** Syncs browser URL route into active editor tab if deep-linked */
const RouteSync: React.FC = () => {
  const location = useLocation()
  const { openTab } = useEditorStore()

  useEffect(() => {
    const path = location.pathname.replace(/^\//, '')
    if (!path) return

    const routeMap: Record<string, { type: EditorTabType; title: string }> = {
      'story-architect': { type: 'story-architect', title: 'Story Architect' },
      sft: { type: 'sft', title: 'SFT Studio' },
      dpo: { type: 'dpo', title: 'DPO Studio' },
      datasets: { type: 'datasets', title: 'Mechon Corpus' },
      forge: { type: 'forge', title: 'Dataset Forge' },
      playground: { type: 'playground', title: 'Model Playground' },
      projects: { type: 'projects', title: 'Projects' },
      quality: { type: 'quality', title: 'Quality Control' },
      analytics: { type: 'analytics', title: 'Analytics' },
      versions: { type: 'versions', title: 'Dataset Snapshots' },
      export: { type: 'export', title: 'Export Center' },
      providers: { type: 'providers', title: 'Providers' },
      settings: { type: 'settings', title: 'Settings' },
      readiness: { type: 'readiness', title: 'Training Readiness' },
      'engineering/templates': { type: 'engineering/templates', title: 'Chat Templates' },
      'engineering/sequence': { type: 'engineering/sequence', title: 'Sequence Analytics' },
      'engineering/dedup': { type: 'engineering/dedup', title: 'Deduplication' },
      'engineering/persona': { type: 'engineering/persona', title: 'Persona Audit' },
      'engineering/splits': { type: 'engineering/splits', title: 'Partition Splits' },
      mobile: { type: 'mobile', title: 'Mobile Companion' },
    }

    if (routeMap[path]) {
      const searchParams = new URLSearchParams(location.search)
      const params: Record<string, string> = {}
      searchParams.forEach((v, k) => {
        params[k] = v
      })
      openTab({
        ...routeMap[path],
        params: Object.keys(params).length > 0 ? params : undefined
      })
    }
  }, [location.pathname, location.search])

  return <EditorShell />
}

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouteSync />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
