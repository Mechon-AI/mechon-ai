import { create } from 'zustand'

type ThemeMode = 'dark' | 'light'

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem('mechon-theme-mode') as ThemeMode | null
  if (saved === 'dark' || saved === 'light') {
    return saved
  }
  return 'dark'
}

const applyThemeToDOM = (theme: ThemeMode) => {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),

  setTheme: (theme: ThemeMode) => {
    localStorage.setItem('mechon-theme-mode', theme)
    applyThemeToDOM(theme)
    set({ theme })
  },

  toggleTheme: () => {
    const current = get().theme
    const next: ThemeMode = current === 'dark' ? 'light' : 'dark'
    localStorage.setItem('mechon-theme-mode', next)
    applyThemeToDOM(next)
    set({ theme: next })
  }
}))

// Apply on initial load
if (typeof window !== 'undefined') {
  applyThemeToDOM(getInitialTheme())
}
