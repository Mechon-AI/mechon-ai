import React, { useState, useEffect } from 'react'
import { Save, AlertCircle, CheckCircle, Code, List, Trash2, Plus } from 'lucide-react'
import { updateSFTRecord, updateDPOTask } from '../../services/api'
import { useEditorStore } from '../stores/useEditorStore'
import { useConsoleStore } from '../stores/useConsoleStore'
import { useInspectorStore } from '../stores/useInspectorStore'

interface RecordEditorViewProps {
  tabId: string
  params?: {
    recordType: 'sft' | 'dpo'
    record: any
  }
}

export const RecordEditorView: React.FC<RecordEditorViewProps> = ({ tabId, params }) => {
  const { setTabDirty } = useEditorStore()
  const { addLog } = useConsoleStore()
  const { inspect } = useInspectorStore()

  const recordType = params?.recordType || 'sft'
  const initialRecord = params?.record || {}

  const [rawJson, setRawJson] = useState('')
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual')
  const [messages, setMessages] = useState<any[]>([])
  const [dpoPrompt, setDpoPrompt] = useState('')
  const [dpoChosen, setDpoChosen] = useState('')
  const [dpoRejected, setDpoRejected] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (initialRecord) {
      setRawJson(JSON.stringify(initialRecord, null, 2))
      if (recordType === 'sft' && Array.isArray(initialRecord.messages)) {
        setMessages(initialRecord.messages)
      } else if (recordType === 'dpo') {
        setDpoPrompt(initialRecord.prompt || '')
        setDpoChosen(initialRecord.chosen || '')
        setDpoRejected(initialRecord.rejected || '')
      }
      inspect({
        type: 'dataset_record',
        id: initialRecord.id || 'record-draft',
        title: `Record: ${initialRecord.id?.slice(0, 8) || 'Draft'}`,
        data: initialRecord
      })
    }
  }, [initialRecord])

  const markDirty = () => {
    setIsDirty(true)
    setTabDirty(tabId, true)
  }

  const handleRawChange = (val: string) => {
    setRawJson(val)
    markDirty()
    try {
      const parsed = JSON.parse(val)
      if (recordType === 'sft' && Array.isArray(parsed.messages)) {
        setMessages(parsed.messages)
      } else if (recordType === 'dpo') {
        setDpoPrompt(parsed.prompt || '')
        setDpoChosen(parsed.chosen || '')
        setDpoRejected(parsed.rejected || '')
      }
    } catch {
      // Invalid JSON syntax while typing is ok
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setStatusMsg(null)
    try {
      if (recordType === 'sft') {
        let payload = { ...initialRecord }
        if (viewMode === 'raw') {
          payload = JSON.parse(rawJson)
        } else {
          payload.messages = messages
        }
        await updateSFTRecord(initialRecord.id, payload)
      } else {
        let payload = { ...initialRecord }
        if (viewMode === 'raw') {
          payload = JSON.parse(rawJson)
        } else {
          payload.prompt = dpoPrompt
          payload.chosen = dpoChosen
          payload.rejected = dpoRejected
        }
        await updateDPOTask(initialRecord.id, payload)
      }

      setIsDirty(false)
      setTabDirty(tabId, false)
      setStatusMsg({ text: 'Record saved successfully.', type: 'success' })
      addLog('success', 'system', `Record ${initialRecord.id} updated in database.`)
    } catch (err: any) {
      setStatusMsg({ text: `Failed to save: ${err.message || String(err)}`, type: 'error' })
      addLog('error', 'system', `Failed to update record ${initialRecord.id}`, err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Top action bar */}
      <div className="h-11 border-b border-border px-4 flex items-center justify-between bg-card/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {recordType.toUpperCase()} Record Editor
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            ID: {initialRecord.id?.slice(0, 12) || 'New'}
          </span>
          {isDirty && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono">
              Unsaved Changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5 text-xs">
            <button
              onClick={() => setViewMode('visual')}
              className={`px-2 py-0.5 rounded-md flex items-center gap-1 ${
                viewMode === 'visual' ? 'bg-background shadow-xs text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              <List className="h-3 w-3" /> Visual
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.5 rounded-md flex items-center gap-1 ${
                viewMode === 'raw' ? 'bg-background shadow-xs text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              <Code className="h-3 w-3" /> Raw JSON
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`px-4 py-1.5 text-xs flex items-center gap-2 border-b shrink-0 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'raw' ? (
          <textarea
            value={rawJson}
            onChange={(e) => handleRawChange(e.target.value)}
            className="w-full h-full p-3 font-mono text-xs rounded-lg border border-border bg-card/60 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            spellCheck={false}
          />
        ) : recordType === 'sft' ? (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                Conversation Turns ({messages.length})
              </span>
              <button
                onClick={() => {
                  setMessages([...messages, { role: 'user', content: '' }])
                  markDirty()
                }}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Turn
              </button>
            </div>

            {messages.map((msg, index) => (
              <div key={index} className="rounded-xl border border-border bg-card/80 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-secondary text-foreground">
                      {msg.role}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">Turn #{index + 1}</span>
                  </div>
                  <button
                    onClick={() => {
                      setMessages(messages.filter((_, i) => i !== index))
                      markDirty()
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove turn"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <textarea
                  value={msg.content || ''}
                  onChange={(e) => {
                    const next = [...messages]
                    next[index] = { ...next[index], content: e.target.value }
                    setMessages(next)
                    markDirty()
                  }}
                  className="w-full min-h-[90px] p-2.5 text-xs rounded-md border border-border bg-secondary/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono"
                  placeholder="Enter message content..."
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Prompt / Instruction
              </label>
              <textarea
                value={dpoPrompt}
                onChange={(e) => {
                  setDpoPrompt(e.target.value)
                  markDirty()
                }}
                className="w-full min-h-[80px] p-3 text-xs rounded-lg border border-border bg-secondary/50 text-foreground font-mono resize-y"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  Chosen (Preferred Response)
                </label>
                <textarea
                  value={dpoChosen}
                  onChange={(e) => {
                    setDpoChosen(e.target.value)
                    markDirty()
                  }}
                  className="w-full min-h-[220px] p-3 text-xs rounded-lg border border-emerald-500/40 bg-emerald-950/10 text-foreground font-mono resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-destructive font-mono">
                  Rejected Response
                </label>
                <textarea
                  value={dpoRejected}
                  onChange={(e) => {
                    setDpoRejected(e.target.value)
                    markDirty()
                  }}
                  className="w-full min-h-[220px] p-3 text-xs rounded-lg border border-destructive/40 bg-destructive/5 text-foreground font-mono resize-y"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
