import React, { useState, useEffect } from 'react'
import { Database, RefreshCw, ExternalLink, Code, Search } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { getSFTRecords } from '../../services/api'
import { useEditorStore } from '../stores/useEditorStore'
import { useInspectorStore } from '../stores/useInspectorStore'
import { StudioRefreshButton } from '../../components/common/StudioRefreshButton'
import { useAutoDatasetSync } from '../../hooks/useAutoDatasetSync'

export const DatasetPreviewTab: React.FC = () => {
  const { getActiveProject } = useProjectStore()
  const { openTab } = useEditorStore()
  const { inspect } = useInspectorStore()

  const activeProject = getActiveProject()
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const fetchPreview = async () => {
    if (!activeProject) return
    setLoading(true)
    try {
      const res = await getSFTRecords(activeProject.id, search || undefined, undefined, undefined, 25, 0)
      setRecords(res.records || [])
    } catch (e) {
      console.warn('Dataset preview fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPreview()
  }, [activeProject?.id])

  useAutoDatasetSync(() => fetchPreview(), { datasetType: 'sft', enabled: true })

  const filtered = records.filter((r) => {
    if (!search) return true
    return JSON.stringify(r).toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      <div className="h-7 border-b border-border/80 px-3 flex items-center justify-between bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">
            Live Corpus Records ({filtered.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search preview..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPreview()}
              className="pl-6 pr-2 py-0.5 rounded bg-background/60 border border-border text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary h-6 w-36"
            />
          </div>

          <StudioRefreshButton
            onRefresh={fetchPreview}
            isRefreshing={loading}
            size="sm"
            label=""
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-[11px] font-mono">
          <thead>
            <tr className="border-b border-border/80 bg-secondary/40 text-muted-foreground">
              <th className="py-1.5 px-3">ID</th>
              <th className="py-1.5 px-3">Type</th>
              <th className="py-1.5 px-3">Turns</th>
              <th className="py-1.5 px-3">First Message Preview</th>
              <th className="py-1.5 px-3">Rating</th>
              <th className="py-1.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map((rec) => {
              const firstMsg = rec.messages?.[0]?.content || rec.prompt || 'No message'
              return (
                <tr
                  key={rec.id}
                  onClick={() =>
                    inspect({
                      type: 'dataset_record',
                      id: rec.id,
                      title: `Record ${rec.id.slice(0, 8)}`,
                      data: rec
                    })
                  }
                  className="hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="py-1.5 px-3 text-primary truncate max-w-[100px]">{rec.id.slice(0, 8)}</td>
                  <td className="py-1.5 px-3 uppercase text-[10px] text-muted-foreground">SFT</td>
                  <td className="py-1.5 px-3">{rec.messages?.length || 1}</td>
                  <td className="py-1.5 px-3 truncate max-w-xs text-foreground font-sans">{firstMsg}</td>
                  <td className="py-1.5 px-3 text-emerald-400">{rec.quality_rating || 5}★</td>
                  <td className="py-1.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openTab({
                          type: 'record-editor',
                          title: `Edit ${rec.id.slice(0, 6)}`,
                          id: `record-edit-${rec.id}`,
                          params: { recordType: 'sft', record: rec }
                        })
                      }}
                      className="px-2 py-0.5 rounded bg-secondary hover:bg-accent text-foreground text-[10px] inline-flex items-center gap-1 border border-border"
                      title="Open in Tab"
                    >
                      <ExternalLink className="h-3 w-3" /> Edit
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            {activeProject ? 'No dataset records found in this project.' : 'Select an active project.'}
          </div>
        )}
      </div>
    </div>
  )
}
