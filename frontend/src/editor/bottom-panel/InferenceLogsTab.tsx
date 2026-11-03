import React, { useState } from 'react'
import { Cpu, Trash2, Copy, CheckCircle, Search, Radio } from 'lucide-react'
import { useConsoleStore } from '../stores/useConsoleStore'

export const InferenceLogsTab: React.FC = () => {
  const { logs, clearCategory } = useConsoleStore()
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState(false)

  const inferenceLogs = logs.filter((l) => l.category === 'inference')
  const filtered = inferenceLogs.filter((l) => (filter ? l.message.toLowerCase().includes(filter.toLowerCase()) : true))

  const handleCopy = () => {
    const text = filtered.map((l) => `[${l.timestamp}] ${l.message}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      <div className="h-7 border-b border-border/80 px-3 flex items-center justify-between bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">
            Inference Activity & Latency Monitor
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Search inference..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-2 pr-2 py-0.5 rounded bg-background/60 border border-border text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary h-6 w-36"
          />
          <button
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Copy inference logs"
          >
            {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => clearCategory('inference')}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
            title="Clear inference logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1">
        {filtered.map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between px-2.5 py-1 rounded hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-muted-foreground/60 shrink-0">{log.timestamp}</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                  log.level === 'error'
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {log.level === 'error' ? 'FAIL' : 'OK 200'}
              </span>
              <span className="text-foreground truncate">{log.message}</span>
            </div>
            {log.details?.latency && (
              <span className="text-muted-foreground text-[10px] shrink-0 font-mono">
                {log.details.latency}ms
              </span>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            No inference traffic recorded yet. Run a prompt in SFT Studio, DPO, or Model Playground.
          </div>
        )}
      </div>
    </div>
  )
}
