import React, { useEffect, useRef } from 'react'
import { X, Layers, RotateCcw, Pin } from 'lucide-react'
import { useEditorStore } from '../stores/useEditorStore'

interface TabContextMenuProps {
  x: number
  y: number
  tabId: string
  onClose: () => void
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({ x, y, tabId, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const { closeTab, closeOtherTabs, reopenClosedTab } = useEditorStore()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      style={{ top: `${y}px`, left: `${x}px` }}
      className="fixed z-50 min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-xl text-xs text-foreground divide-y divide-border/60"
    >
      <div className="py-0.5">
        <button
          onClick={() => {
            closeTab(tabId)
            onClose()
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-accent text-left"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Close Tab</span>
        </button>
        <button
          onClick={() => {
            closeOtherTabs(tabId)
            onClose()
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-accent text-left"
        >
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Close Other Tabs</span>
        </button>
      </div>

      <div className="py-0.5">
        <button
          onClick={() => {
            reopenClosedTab()
            onClose()
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-accent text-left"
        >
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Reopen Closed Tab</span>
        </button>
      </div>
    </div>
  )
}
