import { create } from 'zustand'

export type LogLevel = 'info' | 'warn' | 'error' | 'success'
export type LogCategory = 'system' | 'agent' | 'inference' | 'diagnostics' | 'corpus'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  details?: any
}

interface ConsoleState {
  logs: LogEntry[]
  addLog: (level: LogLevel, category: LogCategory, message: string, details?: any) => void
  clearCategory: (category: LogCategory) => void
  clearAll: () => void
}

/** Sanitize message or details to never leak API keys, secret tokens, or private credentials */
function sanitizeSecrets(text: string): string {
  if (typeof text !== 'string') return text
  return text
    .replace(/(?:sk-[a-zA-Z0-9_\-]{20,})/g, 'sk-***[REDACTED]')
    .replace(/(?:Bearer\s+)[a-zA-Z0-9_\-\.]{15,}/gi, 'Bearer ***[REDACTED]')
    .replace(/(?:api[_-]?key["':\s=]+)[a-zA-Z0-9_\-]{15,}/gi, 'api_key=***[REDACTED]')
}

function sanitizeDetails(details: any): any {
  if (!details) return details
  try {
    const str = JSON.stringify(details)
    const sanitized = sanitizeSecrets(str)
    return JSON.parse(sanitized)
  } catch {
    return details
  }
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  logs: [
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      category: 'system',
      message: 'Mechon AI Studio Editor Shell initialized.'
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString(),
      level: 'success',
      category: 'system',
      message: 'Native Rust SQLite WAL storage connected.'
    }
  ],

  addLog: (level: LogLevel, category: LogCategory, message: string, details?: any) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      category,
      message: sanitizeSecrets(message),
      details: sanitizeDetails(details)
    }

    set((state) => ({
      logs: [entry, ...state.logs].slice(0, 500) // Keep latest 500 logs
    }))
  },

  clearCategory: (category: LogCategory) =>
    set((state) => ({
      logs: state.logs.filter((l) => l.category !== category)
    })),

  clearAll: () => set({ logs: [] })
}))
