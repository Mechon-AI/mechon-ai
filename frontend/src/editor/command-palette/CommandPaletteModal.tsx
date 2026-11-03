import React, { useState, useEffect, useRef } from 'react'
import { Search, Command, ArrowRight } from 'lucide-react'
import { getCommands, type EditorCommand } from './CommandRegistry'

interface CommandPaletteModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const commands = getCommands()
  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase()
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.description && cmd.description.toLowerCase().includes(q)) ||
      cmd.category.toLowerCase().includes(q)
    )
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].handler()
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-border bg-secondary/30">
          <Command className="h-4 w-4 text-primary shrink-0 mr-3" />
          <input
            type="text"
            placeholder="Type a command or search actions..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-medium"
            autoFocus
          />
          <kbd className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-muted-foreground border border-border">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {filtered.map((cmd, idx) => {
            const isSelected = idx === selectedIndex
            return (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.handler()
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-secondary/70'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                  <span
                    className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded tracking-wider shrink-0 ${
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground font-semibold'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {cmd.category}
                  </span>
                  <span className="truncate">{cmd.title}</span>
                  {cmd.description && (
                    <span
                      className={`text-[11px] truncate hidden sm:inline ${
                        isSelected ? 'text-primary-foreground/75' : 'text-muted-foreground'
                      }`}
                    >
                      — {cmd.description}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {cmd.shortcut && (
                    <kbd
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                        isSelected
                          ? 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground'
                          : 'border-border bg-secondary text-muted-foreground'
                      }`}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                  {isSelected && <ArrowRight className="h-3.5 w-3.5 opacity-90" />}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No matching commands found.
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-border/80 bg-secondary/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Dismiss</span>
          </div>
          <span>{filtered.length} available commands</span>
        </div>
      </div>
    </div>
  )
}
