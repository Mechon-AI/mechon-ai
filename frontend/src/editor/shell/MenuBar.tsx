import React, { useState, useRef, useEffect } from 'react'
import {
  FolderPlus,
  FolderOpen,
  Save,
  FileDown,
  FileUp,
  Settings,
  Power,
  RotateCcw,
  RotateCw,
  Copy,
  Scissors,
  Clipboard,
  CheckSquare,
  Maximize,
  Sun,
  Moon,
  Layout,
  Layers,
  Sparkles,
  Database,
  Terminal,
  ShieldCheck,
  Activity,
  FileCode2,
  HelpCircle,
  Command,
  Info,
  ExternalLink,
  Bot
} from 'lucide-react'
import { useEditorStore } from '../stores/useEditorStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { useConsoleStore } from '../stores/useConsoleStore'
import { useInspectorStore } from '../stores/useInspectorStore'
import type { WorkspacePreset } from '../types'

interface MenuBarProps {
  onOpenShortcuts: () => void
  onOpenAbout: () => void
  onSave?: () => void
  onSaveAll?: () => void
}

interface MenuItem {
  label: string
  shortcut?: string
  icon?: React.ElementType
  action: () => void
  separator?: boolean
  disabled?: boolean
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onOpenShortcuts,
  onOpenAbout,
  onSave,
  onSaveAll
}) => {
  const {
    openTab,
    closeTab,
    closeOtherTabs,
    reopenClosedTab,
    resetLayout,
    activeTabId,
    tabs,
    layout,
    toggleLeftPanel,
    toggleRightPanel,
    toggleBottomPanel,
    setBottomActiveTab,
    applyPreset
  } = useEditorStore()

  const { theme, toggleTheme } = useThemeStore()
  const { getActiveProject } = useProjectStore()
  const { inspect } = useInspectorStore()
  const { addLog } = useConsoleStore()

  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const menuBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeProject = getActiveProject()

  const fileMenu: MenuItem[] = [
    {
      label: 'New Project...',
      icon: FolderPlus,
      action: () => openTab({ type: 'projects', title: 'Projects' })
    },
    {
      label: 'Open Project...',
      icon: FolderOpen,
      action: () => openTab({ type: 'projects', title: 'Projects' })
    },
    {
      label: 'Save',
      shortcut: 'Ctrl+S',
      icon: Save,
      action: () => {
        if (onSave) onSave()
        addLog('info', 'system', 'Saved current workspace state.')
      }
    },
    {
      label: 'Save All',
      shortcut: 'Ctrl+Shift+S',
      action: () => {
        if (onSaveAll) onSaveAll()
        addLog('info', 'system', 'Saved all open editor tabs.')
      }
    },
    { separator: true, label: '', action: () => {} },
    {
      label: 'Import Dataset...',
      icon: FileUp,
      action: () => openTab({ type: 'datasets', title: 'Mechon Corpus' })
    },
    {
      label: 'Export Center...',
      icon: FileDown,
      action: () => openTab({ type: 'export', title: 'Export Center' })
    },
    { separator: true, label: '', action: () => {} },
    {
      label: 'Preferences...',
      shortcut: 'Ctrl+,',
      icon: Settings,
      action: () => openTab({ type: 'settings', title: 'Settings' })
    },
    {
      label: 'Exit',
      icon: Power,
      action: () => {
        try {
          window.close()
        } catch {
          // Fallback
        }
      }
    }
  ]

  const editMenu: MenuItem[] = [
    {
      label: 'Undo',
      shortcut: 'Ctrl+Z',
      icon: RotateCcw,
      action: () => document.execCommand('undo')
    },
    {
      label: 'Redo',
      shortcut: 'Ctrl+Y',
      icon: RotateCw,
      action: () => document.execCommand('redo')
    },
    { separator: true, label: '', action: () => {} },
    {
      label: 'Cut',
      shortcut: 'Ctrl+X',
      icon: Scissors,
      action: () => document.execCommand('cut')
    },
    {
      label: 'Copy',
      shortcut: 'Ctrl+C',
      icon: Copy,
      action: () => document.execCommand('copy')
    },
    {
      label: 'Paste',
      shortcut: 'Ctrl+V',
      icon: Clipboard,
      action: async () => {
        try {
          const text = await navigator.clipboard.readText()
          document.execCommand('insertText', false, text)
        } catch {
          document.execCommand('paste')
        }
      }
    },
    { separator: true, label: '', action: () => {} },
    {
      label: 'Select All',
      shortcut: 'Ctrl+A',
      icon: CheckSquare,
      action: () => document.execCommand('selectAll')
    }
  ]

  const viewMenu: MenuItem[] = [
    {
      label: `${layout.leftPanelVisible ? 'Hide' : 'Show'} Project Explorer`,
      shortcut: 'Ctrl+B',
      action: () => toggleLeftPanel()
    },
    {
      label: `${layout.rightPanelVisible ? 'Hide' : 'Show'} Property Inspector`,
      shortcut: 'Ctrl+Shift+I',
      action: () => toggleRightPanel()
    },
    {
      label: `${layout.bottomPanelVisible ? 'Hide' : 'Show'} Bottom Console`,
      shortcut: 'Ctrl+J',
      action: () => toggleBottomPanel()
    },
    { separator: true, label: '', action: () => {} },
    {
      label: 'Preset: Dataset Engineering',
      action: () => applyPreset('dataset-engineering')
    },
    {
      label: 'Preset: Agent Engineering',
      action: () => applyPreset('agent-engineering')
    },
    {
      label: 'Preset: SFT Engineering',
      action: () => applyPreset('sft-engineering')
    },
    {
      label: 'Preset: DPO Evaluation',
      action: () => applyPreset('dpo-evaluation')
    },
    {
      label: 'Preset: Quality Assurance',
      action: () => applyPreset('quality-assurance')
    },
    {
      label: 'Preset: Provider Engineering',
      action: () => applyPreset('provider-engineering')
    },
    { separator: true, label: '', action: () => {} },
    {
      label: 'Reset Workspace Layout',
      action: () => resetLayout()
    },
    {
      label: 'Toggle Fullscreen',
      shortcut: 'F11',
      icon: Maximize,
      action: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        } else {
          document.exitFullscreen().catch(() => {})
        }
      }
    },
    {
      label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
      icon: theme === 'dark' ? Sun : Moon,
      action: toggleTheme
    }
  ]

  const projectMenu: MenuItem[] = [
    {
      label: 'Project Information',
      icon: Info,
      action: () => {
        if (activeProject) {
          inspect({
            type: 'project',
            id: activeProject.id,
            title: activeProject.name,
            data: activeProject
          })
          useEditorStore.getState().toggleRightPanel(true)
        } else {
          openTab({ type: 'projects', title: 'Projects' })
        }
      }
    },
    {
      label: 'Project Settings',
      icon: Settings,
      action: () => openTab({ type: 'projects', title: 'Projects' })
    },
    {
      label: 'Dataset Settings & Splits',
      icon: Database,
      action: () => openTab({ type: 'engineering/splits', title: 'Partition Splits' })
    }
  ]

  const toolsMenu: MenuItem[] = [
    {
      label: 'Dataset Validation',
      icon: ShieldCheck,
      action: () => setBottomActiveTab('validation')
    },
    {
      label: 'Provider Diagnostics',
      icon: Activity,
      action: () => setBottomActiveTab('diagnostics')
    },
    {
      label: 'Model Playground',
      icon: Terminal,
      action: () => openTab({ type: 'playground', title: 'Model Playground' })
    },
    {
      label: 'Dataset Forge',
      icon: FileCode2,
      action: () => openTab({ type: 'forge', title: 'Dataset Forge' })
    },
    {
      label: 'Agent Monitor & Logs',
      icon: Bot,
      action: () => setBottomActiveTab('agent-logs')
    }
  ]

  const windowMenu: MenuItem[] = [
    {
      label: 'New Workspace Tab...',
      icon: Layers,
      action: () => openTab({ type: 'datasets', title: 'Mechon Corpus' })
    },
    {
      label: 'Close Tab',
      shortcut: 'Ctrl+W',
      disabled: tabs.length <= 1,
      action: () => {
        if (activeTabId) closeTab(activeTabId)
      }
    },
    {
      label: 'Close Other Tabs',
      disabled: tabs.length <= 1,
      action: () => {
        if (activeTabId) closeOtherTabs(activeTabId)
      }
    },
    {
      label: 'Reopen Closed Tab',
      action: () => reopenClosedTab()
    },
    { separator: true, label: '', action: () => {} },
    {
      label: 'Reset Layout',
      action: () => resetLayout()
    }
  ]

  const helpMenu: MenuItem[] = [
    {
      label: 'Documentation',
      icon: ExternalLink,
      action: () => window.open('https://github.com/Mechon-AI/mechon-ai', '_blank')
    },
    {
      label: 'Keyboard Shortcuts',
      shortcut: 'Ctrl+/',
      icon: Command,
      action: onOpenShortcuts
    },
    { separator: true, label: '', action: () => {} },
    {
      label: 'About Mechon AI',
      icon: Info,
      action: onOpenAbout
    }
  ]

  const menus = [
    { id: 'File', items: fileMenu },
    { id: 'Edit', items: editMenu },
    { id: 'View', items: viewMenu },
    { id: 'Project', items: projectMenu },
    { id: 'Tools', items: toolsMenu },
    { id: 'Window', items: windowMenu },
    { id: 'Help', items: helpMenu }
  ]

  return (
    <div
      ref={menuBarRef}
      className="h-7 border-b border-border bg-card px-2 flex items-center gap-1 select-none shrink-0 text-xs font-medium z-50 relative"
    >
      <div className="flex items-center gap-1.5 mr-2 pl-1">
        <img src="/mechon-icon.svg" alt="Mechon Logo" className="h-4 w-4 drop-shadow-xs" />
        <span className="font-bold tracking-tight text-[11px] font-mono text-foreground">
          MECHON<span className="text-primary font-normal">.AI</span>
        </span>
      </div>

      {menus.map((menu) => (
        <div key={menu.id} className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === menu.id ? null : menu.id)}
            onMouseEnter={() => {
              if (activeMenu !== null) setActiveMenu(menu.id)
            }}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              activeMenu === menu.id
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            {menu.id}
          </button>

          {activeMenu === menu.id && (
            <div className="absolute left-0 top-full mt-0.5 w-56 rounded-lg border border-border bg-[#11131a] dark:bg-[#11131a] light:bg-white p-1 shadow-2xl z-50 text-xs divide-y divide-border/60 animate-in fade-in zoom-in-95 duration-100">
              <div className="py-0.5">
                {menu.items.map((item, idx) => {
                  if (item.separator) {
                    return <div key={idx} className="my-1 border-t border-border/60" />
                  }
                  const Icon = item.icon
                  return (
                    <button
                      key={idx}
                      disabled={item.disabled}
                      onClick={() => {
                        item.action()
                        setActiveMenu(null)
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-accent text-foreground disabled:opacity-40 disabled:pointer-events-none text-left transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.shortcut && (
                        <span className="text-[10px] text-muted-foreground font-mono ml-2 shrink-0">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
