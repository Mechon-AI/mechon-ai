import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project } from '../types'
import { getProjects, createProject } from '../services/api'

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  isLoading: boolean
  error: string | null
  fetchProjects: () => Promise<void>
  setActiveProjectId: (id: string) => void
  getActiveProject: () => Project | undefined
  ensureActiveProject: () => Promise<string>
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
          let list = await getProjects()
          
          // Auto-bootstrap default project if backend has no projects
          if (list.length === 0) {
            try {
              const defaultProj = await createProject({
                name: 'General AI Alignment Lab',
                description: 'Default workspace for multi-turn SFT and pairwise DPO dataset engineering.'
              })
              list = [defaultProj]
            } catch (createErr) {
              console.error('Failed to auto-create default project:', createErr)
            }
          }

          set({ projects: list, isLoading: false })

          // Ensure activeProjectId is valid
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
        return projects.find(p => p.id === activeProjectId) || projects[0]
      },

      ensureActiveProject: async () => {
        const state = get()
        if (state.activeProjectId && state.projects.some(p => p.id === state.activeProjectId)) {
          return state.activeProjectId
        }
        await state.fetchProjects()
        const refreshed = get()
        if (refreshed.activeProjectId) {
          return refreshed.activeProjectId
        }
        if (refreshed.projects.length > 0) {
          set({ activeProjectId: refreshed.projects[0].id })
          return refreshed.projects[0].id
        }
        // Fallback create
        const created = await createProject({
          name: 'General AI Alignment Lab',
          description: 'Default workspace for multi-turn SFT and pairwise DPO dataset engineering.'
        })
        set({ projects: [created], activeProjectId: created.id })
        return created.id
      }
    }),
    {
      name: 'mechon-project-storage'
    }
  )
)
