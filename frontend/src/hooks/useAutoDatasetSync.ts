import { useEffect, useRef } from 'react'
import { useDatasetSyncStore, DatasetChangeEventPayload } from '../stores/useDatasetSyncStore'
import { useProjectStore } from '../stores/useProjectStore'

interface AutoSyncOptions {
  datasetType?: 'sft' | 'dpo' | 'all'
  onDatasetChanged?: (event: DatasetChangeEventPayload | null) => Promise<void> | void
  enabled?: boolean
}

export function useAutoDatasetSync(
  refreshFn: () => Promise<void> | void,
  options: AutoSyncOptions = {}
) {
  const { datasetType = 'all', onDatasetChanged, enabled = true } = options
  const eventVersion = useDatasetSyncStore((s) => s.eventVersion)
  const lastEvent = useDatasetSyncStore((s) => s.lastEvent)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  const isInitialMount = useRef(true)
  const isRefreshingRef = useRef(false)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    if (!enabled) return

    // If an event is present, check relevance to this studio
    if (lastEvent) {
      if (datasetType !== 'all' && lastEvent.dataset_type !== 'all' && lastEvent.dataset_type !== datasetType) {
        return
      }

      // If event scoped to specific project and we are viewing another project, skip
      if (
        lastEvent.project_id &&
        activeProjectId &&
        lastEvent.project_id !== activeProjectId
      ) {
        return
      }
    }

    if (isRefreshingRef.current) return
    isRefreshingRef.current = true

    const doSync = async () => {
      try {
        if (onDatasetChanged) {
          await onDatasetChanged(lastEvent)
        } else {
          await refreshFn()
        }
      } catch (err) {
        console.warn('[AutoDatasetSync] Failed auto-refresh:', err)
      } finally {
        isRefreshingRef.current = false
      }
    }

    doSync()
  }, [eventVersion])
}
