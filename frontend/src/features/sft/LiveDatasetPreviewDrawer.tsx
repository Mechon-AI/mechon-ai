import React, { useState } from 'react'
import {
  Code2,
  Copy,
  Check,
  Download,
  BarChart2,
  X,
  FileText,
  Layers,
  Sparkles,
  ShieldCheck
} from 'lucide-react'
import type { SFTSession } from '../../types'
import { lookupLanguage } from '../../types/languages'

interface LiveDatasetPreviewDrawerProps {
  session: SFTSession
  isOpen: boolean
  onClose: () => void
}

export const LiveDatasetPreviewDrawer: React.FC<LiveDatasetPreviewDrawerProps> = ({
  session,
  isOpen,
  onClose
}) => {
  const [schemaFormat, setSchemaFormat] = useState<'canonical' | 'openai' | 'sharegpt' | 'alpaca'>('canonical')
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  // Calculate live statistics
  const totalTurns = session.messages.length
  const totalChars = session.messages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0)
  const estTokens = Math.round(totalChars / 4)

  // Language completion stats
  const targetLanguages = Array.from(
    new Set(
      session.messages.flatMap(m => (m.translations ? Object.keys(m.translations) : []))
    )
  )

  const langStats = targetLanguages.map(lang => {
    const totalTranslated = session.messages.filter(
      m => m.translations && m.translations[lang] && m.translations[lang].trim() !== ''
    ).length
    const totalApproved = session.messages.filter(
      m => m.translation_status && m.translation_status[lang] === 'approved'
    ).length
    const completionPct = totalTurns > 0 ? Math.round((totalTranslated / totalTurns) * 100) : 0
    const approvedPct = totalTurns > 0 ? Math.round((totalApproved / totalTurns) * 100) : 0
    return {
      lang,
      info: lookupLanguage(lang),
      translated: totalTranslated,
      approved: totalApproved,
      completionPct,
      approvedPct
    }
  })

  // Format the output payload
  const formatPayload = () => {
    if (schemaFormat === 'canonical') {
      const messagesArray = []
      if (session.system_prompt.trim()) {
        messagesArray.push({
          role: 'system',
          content: session.system_prompt.trim()
        })
      }
      for (const m of session.messages) {
        messagesArray.push({
          role: m.role,
          content: m.content,
          translations: m.translations || {},
          translation_status: m.translation_status || {}
        })
      }
      return {
        id: session.committed_record_id || `session_${session.id.slice(0, 8)}`,
        schema_version: '2.0',
        title: session.title,
        language_mode: session.language_mode || 'monolingual',
        primary_language: session.primary_language || 'id',
        secondary_language: session.secondary_language,
        turn_count: totalTurns,
        messages: messagesArray
      }
    } else if (schemaFormat === 'openai') {
      const messages = []
      if (session.system_prompt.trim()) {
        messages.push({ role: 'system', content: session.system_prompt.trim() })
      }
      for (const m of session.messages) {
        messages.push({ role: m.role, content: m.content })
      }
      return { messages }
    } else if (schemaFormat === 'sharegpt') {
      const conversations = []
      if (session.system_prompt.trim()) {
        conversations.push({ from: 'system', value: session.system_prompt.trim() })
      }
      for (const m of session.messages) {
        conversations.push({
          from: m.role === 'assistant' ? 'gpt' : m.role === 'user' ? 'human' : m.role,
          value: m.content
        })
      }
      return { conversations }
    } else {
      // Alpaca format
      const userMsg = session.messages.find(m => m.role === 'user')?.content || ''
      const assistantMsg = session.messages.find(m => m.role === 'assistant')?.content || ''
      return {
        instruction: session.system_prompt.trim() || userMsg,
        input: session.system_prompt.trim() ? userMsg : '',
        output: assistantMsg
      }
    }
  }

  const payloadString = JSON.stringify(formatPayload(), null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(payloadString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([payloadString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${schemaFormat}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-80 md:w-96 border-l border-border bg-card flex flex-col h-full text-foreground shadow-xl shrink-0 animate-in slide-in-from-right-4 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold">Live Dataset Inspector</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Statistics Card */}
        <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] mb-1">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            <span>Dataset Statistics</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-md bg-background border border-border/60">
              <span className="text-[10px] text-muted-foreground block">Turns</span>
              <span className="text-xs font-bold font-mono text-foreground">{totalTurns}</span>
            </div>
            <div className="p-2 rounded-md bg-background border border-border/60">
              <span className="text-[10px] text-muted-foreground block">Characters</span>
              <span className="text-xs font-bold font-mono text-foreground">{totalChars.toLocaleString()}</span>
            </div>
            <div className="p-2 rounded-md bg-background border border-border/60">
              <span className="text-[10px] text-muted-foreground block">Est. Tokens</span>
              <span className="text-xs font-bold font-mono text-foreground">~{estTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Multilingual Completion Status */}
        {langStats.length > 0 && (
          <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Language Alignment & Approval</span>
            </div>
            <div className="space-y-2 pt-1">
              {langStats.map(stat => (
                <div key={stat.lang} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-foreground">{stat.info.name} ({stat.lang.toUpperCase()})</span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {stat.translated}/{totalTurns} ({stat.completionPct}%)
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${stat.approvedPct}%` }}
                      title={`Approved: ${stat.approved}`}
                    />
                    <div
                      className="bg-sky-500 h-full"
                      style={{ width: `${stat.completionPct - stat.approvedPct}%` }}
                      title={`Generated (Needs Review): ${stat.translated - stat.approved}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schema Format Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-foreground flex items-center justify-between">
            <span>Export Schema Format</span>
            <span className="text-[10px] text-muted-foreground font-mono">{schemaFormat}</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-secondary/50 border border-border text-[10px]">
            <button
              onClick={() => setSchemaFormat('canonical')}
              className={`py-1 px-2 rounded-md font-medium text-center transition-colors cursor-pointer ${
                schemaFormat === 'canonical'
                  ? 'bg-background text-primary shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Canonical v2.0
            </button>
            <button
              onClick={() => setSchemaFormat('openai')}
              className={`py-1 px-2 rounded-md font-medium text-center transition-colors cursor-pointer ${
                schemaFormat === 'openai'
                  ? 'bg-background text-primary shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              OpenAI Chat
            </button>
            <button
              onClick={() => setSchemaFormat('sharegpt')}
              className={`py-1 px-2 rounded-md font-medium text-center transition-colors cursor-pointer ${
                schemaFormat === 'sharegpt'
                  ? 'bg-background text-primary shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ShareGPT
            </button>
            <button
              onClick={() => setSchemaFormat('alpaca')}
              className={`py-1 px-2 rounded-md font-medium text-center transition-colors cursor-pointer ${
                schemaFormat === 'alpaca'
                  ? 'bg-background text-primary shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Alpaca
            </button>
          </div>
        </div>

        {/* Live Code Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-mono text-[10px]">JSON RECORD PAYLOAD</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-[10px] text-foreground transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-[10px] text-foreground transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>
            </div>
          </div>
          <pre className="p-3 rounded-lg bg-background border border-border text-[10px] font-mono text-muted-foreground max-h-72 overflow-auto leading-relaxed select-all">
            {payloadString}
          </pre>
        </div>
      </div>
    </div>
  )
}
