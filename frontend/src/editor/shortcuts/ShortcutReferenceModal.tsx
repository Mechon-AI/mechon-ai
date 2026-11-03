import React, { useState } from 'react'
import { X, Search, Command } from 'lucide-react'

interface ShortcutReferenceModalProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUT_GROUPS = [
  {
    category: 'General & Navigation',
    items: [
      { key: 'Ctrl + Shift + P', description: 'Open Command Palette' },
      { key: 'Ctrl + P', description: 'Quick Open & Module Search' },
      { key: 'Ctrl + ,', description: 'Open Settings / Preferences' },
      { key: 'Ctrl + /', description: 'Show Keyboard Shortcuts' },
      { key: 'F11', description: 'Toggle Fullscreen' }
    ]
  },
  {
    category: 'Tabs & Workspace',
    items: [
      { key: 'Ctrl + W', description: 'Close Active Editor Tab' },
      { key: 'Ctrl + Tab', description: 'Switch to Next Tab' },
      { key: 'Ctrl + Shift + Tab', description: 'Switch to Previous Tab' },
      { key: 'Ctrl + S', description: 'Quick Save Current Editor' },
      { key: 'Ctrl + Shift + S', description: 'Save All Active Changes' }
    ]
  },
  {
    category: 'Panels & Layout',
    items: [
      { key: 'Ctrl + B', description: 'Toggle Left Project Explorer' },
      { key: 'Ctrl + Shift + I', description: 'Toggle Right Property Inspector' },
      { key: 'Ctrl + J', description: 'Toggle Bottom Console / Logs' }
    ]
  }
]

export const ShortcutReferenceModal: React.FC<ShortcutReferenceModalProps> = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState('')

  if (!isOpen) return null

  const filteredGroups = SHORTCUT_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        item.description.toLowerCase().includes(filter.toLowerCase()) ||
        item.key.toLowerCase().includes(filter.toLowerCase())
    )
  })).filter((group) => group.items.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Command className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-secondary/60 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-5 pr-1">
          {filteredGroups.map((group) => (
            <div key={group.category} className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                {group.category}
              </h3>
              <div className="rounded-lg border border-border/80 bg-background/50 divide-y divide-border/60">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between px-3.5 py-2 text-xs">
                    <span className="text-foreground">{item.description}</span>
                    <kbd className="px-2 py-0.5 rounded bg-secondary border border-border/80 text-[11px] font-mono font-medium text-foreground shadow-sm">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No shortcuts found matching "{filter}".
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-secondary text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
