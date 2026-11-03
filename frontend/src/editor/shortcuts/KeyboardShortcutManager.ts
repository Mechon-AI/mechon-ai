import { useEffect } from 'react'
import { useEditorStore } from '../stores/useEditorStore'

interface ShortcutListenerProps {
  onOpenCommandPalette: () => void
  onOpenQuickOpen: () => void
  onOpenShortcutsModal: () => void
  onSave?: () => void
  onSaveAll?: () => void
}

export function useKeyboardShortcuts({
  onOpenCommandPalette,
  onOpenQuickOpen,
  onOpenShortcutsModal,
  onSave,
  onSaveAll
}: ShortcutListenerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement)?.isContentEditable

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const ctrlOrMeta = isMac ? e.metaKey : e.ctrlKey

      // Global: Ctrl+Shift+P -> Command Palette (allowed even in inputs)
      if (ctrlOrMeta && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault()
        onOpenCommandPalette()
        return
      }

      // Global: Ctrl+P -> Quick Open
      if (ctrlOrMeta && !e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault()
        onOpenQuickOpen()
        return
      }

      // Global: Ctrl+S -> Save
      if (ctrlOrMeta && !e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault()
        if (onSave) onSave()
        return
      }

      // Global: Ctrl+Shift+S -> Save All
      if (ctrlOrMeta && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault()
        if (onSaveAll) onSaveAll()
        return
      }

      // Global: Ctrl+/ -> Shortcut reference
      if (ctrlOrMeta && e.key === '/') {
        e.preventDefault()
        onOpenShortcutsModal()
        return
      }

      // Global: Ctrl+B -> Toggle Explorer
      if (ctrlOrMeta && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        useEditorStore.getState().toggleLeftPanel()
        return
      }

      // Global: Ctrl+J -> Toggle Bottom Panel
      if (ctrlOrMeta && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        useEditorStore.getState().toggleBottomPanel()
        return
      }

      // Global: Ctrl+Shift+I -> Toggle Inspector
      if (ctrlOrMeta && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        useEditorStore.getState().toggleRightPanel()
        return
      }

      // Ctrl+, -> Settings
      if (ctrlOrMeta && e.key === ',') {
        e.preventDefault()
        useEditorStore.getState().openTab({ type: 'settings', title: 'Settings' })
        return
      }

      // F11 -> Toggle Fullscreen
      if (e.key === 'F11') {
        e.preventDefault()
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        } else {
          document.exitFullscreen().catch(() => {})
        }
        return
      }

      // The following shortcuts only activate when NOT editing text in inputs
      if (isInputFocused) {
        return
      }

      // Ctrl+W -> Close active tab
      if (ctrlOrMeta && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault()
        const state = useEditorStore.getState()
        if (state.activeTabId) {
          state.closeTab(state.activeTabId)
        }
        return
      }

      // Ctrl+Tab / Ctrl+Shift+Tab -> Next / Prev tab
      if (ctrlOrMeta && e.key === 'Tab') {
        e.preventDefault()
        const { tabs, activeTabId, setActiveTab } = useEditorStore.getState()
        if (tabs.length <= 1) return
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
        if (currentIndex === -1) return

        if (e.shiftKey) {
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
          setActiveTab(tabs[prevIndex].id)
        } else {
          const nextIndex = (currentIndex + 1) % tabs.length
          setActiveTab(tabs[nextIndex].id)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenCommandPalette, onOpenQuickOpen, onOpenShortcutsModal, onSave, onSaveAll])
}
