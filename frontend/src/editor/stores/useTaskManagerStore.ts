import { create } from 'zustand'

export interface EditorTask {
  id: string
  name: string
  category: 'inference' | 'validation' | 'export' | 'translation' | 'corpus'
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number // 0 to 100
  startedAt: string
  finishedAt?: string
  error?: string
}

interface TaskManagerState {
  tasks: EditorTask[]
  addTask: (task: Omit<EditorTask, 'id' | 'startedAt'>) => string
  updateTask: (id: string, updates: Partial<EditorTask>) => void
  cancelTask: (id: string) => void
  clearCompleted: () => void
}

export const useTaskManagerStore = create<TaskManagerState>((set) => ({
  tasks: [],

  addTask: (task) => {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const newTask: EditorTask = {
      ...task,
      id,
      startedAt: new Date().toLocaleTimeString()
    }
    set((state) => ({ tasks: [newTask, ...state.tasks] }))
    return id
  },

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              ...updates,
              ...(updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled'
                ? { finishedAt: new Date().toLocaleTimeString() }
                : {})
            }
          : t
      )
    })),

  cancelTask: (id) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'cancelled',
              finishedAt: new Date().toLocaleTimeString()
            }
          : t
      )
    })),

  clearCompleted: () =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.status === 'running')
    }))
}))
