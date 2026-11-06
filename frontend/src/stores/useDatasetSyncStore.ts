import { create } from 'zustand'
import { listen } from '@tauri-apps/api/event'

export interface DatasetChangeEventPayload {
  dataset_type: 'sft' | 'dpo' | 'all'
  action: 'commit' | 'update' | 'delete' | 'duplicate' | 'import'
  project_id?: string
  record_id?: string
  timestamp: string
}

interface DatasetSyncState {
  lastEvent: DatasetChangeEventPayload | null
  lastSyncTimestamp: number
  eventVersion: number
  isSyncing: boolean
  syncError: string | null
  setSyncing: (syncing: boolean) => void
  setSyncError: (error: string | null) => void
  recordEvent: (payload: DatasetChangeEventPayload) => void
  notifyRefresh: () => void
}

let listenerInitialized = false

export const useDatasetSyncStore = create<DatasetSyncState>((set, get) => {
  if (typeof window !== 'undefined' && !listenerInitialized) {
    listenerInitialized = true
    try {
      listen<DatasetChangeEventPayload>('dataset-change', (event) => {
        const payload = event.payload
        set({
          lastEvent: payload,
          lastSyncTimestamp: Date.now(),
          eventVersion: get().eventVersion + 1,
          syncError: null
        })
      }).catch((err) => {
        console.warn('[DatasetSync] Failed to register Tauri listener for dataset-change:', err)
      })
    } catch (err) {
      console.warn('[DatasetSync] Could not attach listener:', err)
    }
  }

  return {
    lastEvent: null,
    lastSyncTimestamp: Date.now(),
    eventVersion: 0,
    isSyncing: false,
    syncError: null,
    setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),
    setSyncError: (error: string | null) => set({ syncError: error }),
    recordEvent: (payload: DatasetChangeEventPayload) => {
      set({
        lastEvent: payload,
        lastSyncTimestamp: Date.now(),
        eventVersion: get().eventVersion + 1,
        syncError: null
      })
    },
    notifyRefresh: () => {
      set({
        lastSyncTimestamp: Date.now(),
        eventVersion: get().eventVersion + 1,
        syncError: null
      })
    }
  }
})
