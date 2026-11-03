import { create } from 'zustand'

interface SelectionState {
  selectedSftIds: string[]
  selectedDpoIds: string[]
  toggleSftSelection: (id: string) => void
  selectSftIds: (ids: string[]) => void
  clearSftSelection: () => void
  selectAllVisibleSft: (ids: string[]) => void
  isSftSelected: (id: string) => boolean

  toggleDpoSelection: (id: string) => void
  selectDpoIds: (ids: string[]) => void
  clearDpoSelection: () => void
  selectAllVisibleDpo: (ids: string[]) => void
  isDpoSelected: (id: string) => boolean
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedSftIds: [],
  selectedDpoIds: [],

  toggleSftSelection: (id: string) =>
    set((state) => ({
      selectedSftIds: state.selectedSftIds.includes(id)
        ? state.selectedSftIds.filter((item) => item !== id)
        : [...state.selectedSftIds, id],
    })),

  selectSftIds: (ids: string[]) => set({ selectedSftIds: ids }),

  clearSftSelection: () => set({ selectedSftIds: [] }),

  selectAllVisibleSft: (ids: string[]) =>
    set((state) => {
      const allSelected = ids.length > 0 && ids.every((id) => state.selectedSftIds.includes(id))
      if (allSelected) {
        return {
          selectedSftIds: state.selectedSftIds.filter((id) => !ids.includes(id)),
        }
      }
      const newSet = new Set([...state.selectedSftIds, ...ids])
      return { selectedSftIds: Array.from(newSet) }
    }),

  isSftSelected: (id: string) => get().selectedSftIds.includes(id),

  toggleDpoSelection: (id: string) =>
    set((state) => ({
      selectedDpoIds: state.selectedDpoIds.includes(id)
        ? state.selectedDpoIds.filter((item) => item !== id)
        : [...state.selectedDpoIds, id],
    })),

  selectDpoIds: (ids: string[]) => set({ selectedDpoIds: ids }),

  clearDpoSelection: () => set({ selectedDpoIds: [] }),

  selectAllVisibleDpo: (ids: string[]) =>
    set((state) => {
      const allSelected = ids.length > 0 && ids.every((id) => state.selectedDpoIds.includes(id))
      if (allSelected) {
        return {
          selectedDpoIds: state.selectedDpoIds.filter((id) => !ids.includes(id)),
        }
      }
      const newSet = new Set([...state.selectedDpoIds, ...ids])
      return { selectedDpoIds: Array.from(newSet) }
    }),

  isDpoSelected: (id: string) => get().selectedDpoIds.includes(id),
}))
