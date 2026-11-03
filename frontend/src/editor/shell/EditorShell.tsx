import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MenuBar } from './MenuBar'
import { EditorToolbar } from './EditorToolbar'
import { ExplorerPanel } from './ExplorerPanel'
import { InspectorPanel } from '../inspector/InspectorPanel'
import { BottomPanel } from '../bottom-panel/BottomPanel'
import { TabBar } from '../tabs/TabBar'
import { TabContentRenderer } from '../tabs/TabRegistry'
import { ResizeDivider } from '../../components/common/ResizeDivider'
import { CommandPaletteModal } from '../command-palette/CommandPaletteModal'
import { ShortcutReferenceModal } from '../shortcuts/ShortcutReferenceModal'
import { useKeyboardShortcuts } from '../shortcuts/KeyboardShortcutManager'
import { initializeDefaultCommands } from '../command-palette/registerDefaultCommands'
import { useEditorStore } from '../stores/useEditorStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProviderStore } from '../../stores/useProviderStore'
import { useConsoleStore } from '../stores/useConsoleStore'
import { X, ExternalLink } from 'lucide-react'

export const EditorShell: React.FC = () => {
  const {
    tabs,
    activeTabId,
    layout,
    setLeftPanelWidth,
    setRightPanelWidth,
    setBottomPanelHeight
  } = useEditorStore()

  const { fetchProjects } = useProjectStore()
  const { fetchProviders } = useProviderStore()
  const { addLog } = useConsoleStore()

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false)
  const [aboutModalOpen, setAboutModalOpen] = useState(false)

  // Resizing state
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const [isDraggingBottom, setIsDraggingBottom] = useState(false)

  // Initial load
  useEffect(() => {
    fetchProjects()
    fetchProviders()
    initializeDefaultCommands({
      openShortcuts: () => setShortcutsModalOpen(true),
      openAbout: () => setAboutModalOpen(true),
      openQuickOpen: () => setCommandPaletteOpen(true),
      saveActive: () => addLog('info', 'system', 'Active editor state saved.')
    })
  }, [])

  // Keyboard shortcut listener
  useKeyboardShortcuts({
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    onOpenQuickOpen: () => setCommandPaletteOpen(true),
    onOpenShortcutsModal: () => setShortcutsModalOpen(true),
    onSave: () => addLog('info', 'system', 'Saved current editor.')
  })

  // Left Panel Resize
  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingLeft(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      setLeftPanelWidth(moveEvent.clientX)
    }

    const onMouseUp = () => {
      setIsDraggingLeft(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  // Right Panel Resize
  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingRight(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      setRightPanelWidth(window.innerWidth - moveEvent.clientX)
    }

    const onMouseUp = () => {
      setIsDraggingRight(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  // Bottom Panel Resize
  const handleBottomResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingBottom(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      setBottomPanelHeight(window.innerHeight - moveEvent.clientY)
    }

    const onMouseUp = () => {
      setIsDraggingBottom(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground select-none font-sans antialiased">
      {/* 1. Main Menu Bar (Top) */}
      <div className="relative z-50 shrink-0">
        <MenuBar
          onOpenShortcuts={() => setShortcutsModalOpen(true)}
          onOpenAbout={() => setAboutModalOpen(true)}
          onSave={() => addLog('info', 'system', 'Saved workspace state.')}
        />
      </div>

      {/* 2. Toolbar */}
      <div className="relative z-50 shrink-0">
        <EditorToolbar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenQuickOpen={() => setCommandPaletteOpen(true)}
          onSave={() => addLog('info', 'system', 'Quick save triggered.')}
        />
      </div>

      {/* 3. Master Workspace Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative z-0">
        {/* Left Panel: Project Explorer */}
        {layout.leftPanelVisible && (
          <>
            <aside
              style={{ width: `${layout.leftPanelWidth}px` }}
              className="h-full shrink-0 border-r border-border overflow-hidden flex flex-col"
            >
              <ExplorerPanel />
            </aside>
            <ResizeDivider
              direction="horizontal"
              isDragging={isDraggingLeft}
              onMouseDown={handleLeftResizeStart}
              onDoubleClick={() => setLeftPanelWidth(260)}
              title="Drag to resize Explorer. Double-click to reset."
            />
          </>
        )}

        {/* Central Workspace & Bottom Panel */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Central Tabbed Workspace */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Tab Bar */}
            <TabBar />

            {/* Central Content Area (Keep-Alive per tab) */}
            <main className="flex-1 overflow-hidden relative bg-background/50">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId
                return (
                  <div
                    key={tab.id}
                    className={`absolute inset-0 h-full w-full ${isActive ? 'block' : 'hidden'}`}
                  >
                    <TabContentRenderer tab={tab} />
                  </div>
                )
              })}
            </main>
          </div>

          {/* Bottom Panel */}
          {layout.bottomPanelVisible && (
            <>
              <ResizeDivider
                direction="vertical"
                isDragging={isDraggingBottom}
                onMouseDown={handleBottomResizeStart}
                onDoubleClick={() => setBottomPanelHeight(220)}
                title="Drag to resize Bottom Panel. Double-click to reset."
              />
              <div
                style={{ height: `${layout.bottomPanelHeight}px` }}
                className="shrink-0 border-t border-border overflow-hidden"
              >
                <BottomPanel />
              </div>
            </>
          )}
        </div>

        {/* Right Panel: Contextual Inspector */}
        {layout.rightPanelVisible && (
          <>
            <ResizeDivider
              direction="horizontal"
              isDragging={isDraggingRight}
              onMouseDown={handleRightResizeStart}
              onDoubleClick={() => setRightPanelWidth(320)}
              title="Drag to resize Inspector. Double-click to reset."
            />
            <aside
              style={{ width: `${layout.rightPanelWidth}px` }}
              className="h-full shrink-0 border-l border-border overflow-hidden flex flex-col"
            >
              <InspectorPanel />
            </aside>
          </>
        )}
      </div>

      {/* Global Modals */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <ShortcutReferenceModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />

      {/* About Mechon AI Modal */}
      {aboutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setAboutModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3.5 pb-4 border-b border-border/80">
              <img src="/mechon-icon.svg" alt="Mechon AI Logo" className="h-10 w-10 drop-shadow-md" />
              <div>
                <h3 className="text-base font-bold text-foreground font-mono">MECHON AI</h3>
                <p className="text-[11px] text-primary font-medium tracking-wide">
                  An Integrated Development Environment for AI Dataset Engineering
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-muted-foreground leading-relaxed">
              <p>
                <strong>Mechon AI</strong> is a native, local-first workstation engineered for creating, curating, evaluating, and partitioning datasets for Supervised Fine-Tuning (SFT) and Direct Preference Optimization (DPO).
              </p>

              <div className="p-3 rounded-lg bg-secondary/30 border border-border/70 text-[10px] space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="text-foreground">1.2.0 (Editor Architecture)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Core Architecture:</span>
                  <span className="text-foreground">Tauri 2 • Native Rust • React 18 • SQLite WAL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security:</span>
                  <span className="text-emerald-400">100% Local-First (Zero Telemetry)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Design Language:</span>
                  <span className="text-foreground">High-Density Modular IDE</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/60 text-xs">
                <a
                  href="https://github.com/Mechon-AI/mechon-ai"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> github.com/Mechon-AI
                </a>
                <button
                  onClick={() => setAboutModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-secondary hover:bg-accent text-foreground font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
