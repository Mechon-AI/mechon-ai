import React, { useState } from 'react'
import { Terminal, Trash2, Copy, Search, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import { useConsoleStore, type LogLevel } from '../stores/useConsoleStore'

export const ConsoleTab: React.FC = () => {
  const { logs, clearCategory } = useConsoleStore()
  const [filter, setFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [copied, setCopied] = useState(false)

  const consoleLogs = logs.filter((l) => l.category === 'system' || l.category === 'agent' || l.category === 'inference')
  const filtered = consoleLogs.filter((l) => {
    if (levelFilter !== 'all' && l.level !== levelFilter) return false
    if (filter && !l.message.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  const handleCopy = () => {
    const text = filtered.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
      case 'warn':
        return <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
      case 'error':
        return <XCircle className="h-3 w-3 text-destructive shrink-0" />
      default:
        return <Info className="h-3 w-3 text-primary shrink-0" />
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* Console Toolbar */}
      <div className="h-7 border-b border-border/80 px-3 flex items-center justify-between bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-6 pr-2 py-0.5 rounded bg-background/60 border border-border text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary h-6 w-44"
            />
          </div>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as any)}
            className="h-6 px-1.5 rounded bg-background/60 border border-border text-[11px] text-foreground focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Copy logs to clipboard"
          >
            {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => clearCategory('system')}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
            title="Clear logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1">
        {filtered.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-2 px-2 py-1 rounded hover:bg-secondary/40 transition-colors"
          >
            <span className="text-muted-foreground/60 shrink-0">{log.timestamp}</span>
            {getLevelIcon(log.level)}
            <span
              className={`shrink-0 font-bold uppercase text-[9px] px-1 rounded ${
                log.level === 'error'
                  ? 'bg-destructive/20 text-destructive'
                  : log.level === 'warn'
                  ? 'bg-amber-500/20 text-amber-400'
                  : log.level === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-primary/20 text-primary'
              }`}
            >
              {log.level}
            </span>
            <span className="text-foreground break-all flex-1">{log.message}</span>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            No console output recorded.
          </div>
        )}
      </div>
    </div>
  )
}
