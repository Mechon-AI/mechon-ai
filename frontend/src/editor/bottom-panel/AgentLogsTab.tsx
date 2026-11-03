import React, { useState } from 'react'
import { Sparkles, Trash2, Copy, Search, CheckCircle, Bot } from 'lucide-react'
import { useConsoleStore } from '../stores/useConsoleStore'

export const AgentLogsTab: React.FC = () => {
  const { logs, clearCategory } = useConsoleStore()
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState(false)

  const agentLogs = logs.filter((l) => l.category === 'agent')
  const filtered = agentLogs.filter((l) => (filter ? l.message.toLowerCase().includes(filter.toLowerCase()) : true))

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
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">Story Architect Agent Traces</span>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Search traces..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-2 pr-2 py-0.5 rounded bg-background/60 border border-border text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary h-6 w-36"
          />
          <button
            onClick={handleCopy}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Copy agent traces"
          >
            {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => clearCategory('agent')}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
            title="Clear agent logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1.5">
        {filtered.map((log) => (
          <div
            key={log.id}
            className="p-2 rounded-lg bg-card/60 border border-border/80 space-y-1"
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-primary font-bold">AGENT EXECUTION</span>
              <span className="text-muted-foreground">{log.timestamp}</span>
            </div>
            <p className="text-foreground">{log.message}</p>
            {log.details && (
              <pre className="text-[10px] text-muted-foreground bg-secondary/60 p-1.5 rounded overflow-x-auto">
                {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
              </pre>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            No active Story Architect agent logs.
          </div>
        )}
      </div>
    </div>
  )
}
