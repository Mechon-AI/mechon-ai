import { create } from 'zustand'

export type InspectorTargetType =
  | 'dataset_record'
  | 'sft_session'
  | 'story_agent'
  | 'provider'
  | 'project'
  | 'model'
  | 'validation_report'

export interface InspectorTarget {
  type: InspectorTargetType
  id: string
  title: string
  data: any
}

interface InspectorState {
  target: InspectorTarget | null
  inspect: (target: InspectorTarget) => void
  clear: () => void
  updateData: (partial: any) => void
}

export const useInspectorStore = create<InspectorState>((set) => ({
  target: null,
  inspect: (target: InspectorTarget) => set({ target }),
  clear: () => set({ target: null }),
  updateData: (partial: any) =>
    set((state) => (state.target ? { target: { ...state.target, data: { ...state.target.data, ...partial } } } : state))
}))
