import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project } from '../types'
import { getProjects } from '../services/api'

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  isLoading: boolean
  error: string | null
  fetchProjects: () => Promise<void>
  setActiveProjectId: (id: string) => void
  getActiveProject: () => Project | undefined
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      isLoading: false,
      error: null,

      fetchProjects: async () => {
        set({ isLoading: true, error: null })
        try {
          const list = await getProjects()
          set({ projects: list, isLoading: false })
          // If no active project or active project no longer exists, select first
          const currentId = get().activeProjectId
          if (!currentId || !list.some(p => p.id === currentId)) {
            if (list.length > 0) {
              set({ activeProjectId: list[0].id })
            }
          }
        } catch (err: any) {
          set({ error: err.message, isLoading: false })
        }
      },

      setActiveProjectId: (id: string) => {
        set({ activeProjectId: id })
      },

      getActiveProject: () => {
        const { projects, activeProjectId } = get()
        return projects.find(p => p.id === activeProjectId)
      }
    }),
    {
      name: 'local-ai-dataset-studio-project'
    }
  )
)
