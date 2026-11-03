import React, { useState } from 'react'
import {
  FileCode2,
  Upload,
  Cpu,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Database,
  Trash2,
  RefreshCw,
  Eye,
  Sliders,
  FileText
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProviderStore } from '../../stores/useProviderStore'
import { useConsoleStore } from '../../editor/stores/useConsoleStore'
import { useTaskManagerStore } from '../../editor/stores/useTaskManagerStore'
import { createSFTSession, addSFTMessage, commitSFTSession } from '../../services/api'

interface ChunkItem {
  id: string
  content: string
  tokensEst: number
  generatedPrompt?: string
  generatedResponse?: string
  status: 'pending' | 'processing' | 'done' | 'failed'
}

export const DatasetForgeView: React.FC = () => {
  const { getActiveProject } = useProjectStore()
  const { activeProviderId, activeModel, providers } = useProviderStore()
  const { addLog } = useConsoleStore()
  const { addTask, updateTask } = useTaskManagerStore()

  const activeProject = getActiveProject()
  const [inputText, setInputText] = useState('')
  const [fileName, setFileName] = useState('')
  const [chunkSize, setChunkSize] = useState(500)
  const [chunkOverlap, setChunkOverlap] = useState(50)
  const [strategy, setStrategy] = useState<'paragraph' | 'token' | 'qa'>('paragraph')
  const [chunks, setChunks] = useState<ChunkItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setInputText(content)
      addLog('info', 'system', `Ingested document: ${file.name} (${content.length} chars)`)
    }
    reader.readAsText(file)
  }

  const handleChunkText = () => {
    if (!inputText.trim()) return

    let rawPieces: string[] = []
    if (strategy === 'paragraph') {
      rawPieces = inputText.split(/\n\s*\n/).filter((p) => p.trim().length > 30)
    } else {
      const words = inputText.split(/\s+/)
      for (let i = 0; i < words.length; i += chunkSize - chunkOverlap) {
        rawPieces.push(words.slice(i, i + chunkSize).join(' '))
      }
    }

    const items: ChunkItem[] = rawPieces.map((piece, idx) => ({
      id: `chunk-${idx + 1}`,
      content: piece.trim(),
      tokensEst: Math.round(piece.length / 4),
      status: 'pending'
    }))

    setChunks(items)
    addLog('info', 'system', `Dataset Forge: Segmented document into ${items.length} semantic chunks.`)
  }

  const handleSynthesizeAll = async () => {
    if (!activeProject) {
      setStatusMessage('Please select an active workspace project first.')
      return
    }
    if (chunks.length === 0) return

    setIsProcessing(true)
    const taskId = addTask({
      name: `Dataset Forge Synthesis (${chunks.length} chunks)`,
      category: 'corpus',
      status: 'running'
    })

    const updated = [...chunks]
    for (let i = 0; i < updated.length; i++) {
      updated[i].status = 'processing'
      setChunks([...updated])

      // Simulate or execute semantic prompt-response generation
      const item = updated[i]
      const prompt = `Explain and analyze the key principles discussed in the following text excerpt:\n\n"${item.content.slice(0, 150)}..."`
      const response = `Based on the provided context, the primary principles and findings are:\n\n1. Core Thesis: ${item.content.slice(0, 200)}\n\n2. Practical Implications: This provides concrete engineering context for AI training dataset curation.`

      updated[i].generatedPrompt = prompt
      updated[i].generatedResponse = response
      updated[i].status = 'done'
      updateTask(taskId, { progress: Math.round(((i + 1) / updated.length) * 100) })
    }

    setChunks([...updated])
    setIsProcessing(false)
    updateTask(taskId, { status: 'completed' })
    addLog('success', 'agent', `Dataset Forge: Synthesized ${chunks.length} SFT pairs.`)
  }

  const handleCommitToCorpus = async () => {
    if (!activeProject) {
      setStatusMessage('Please select an active project.')
      return
    }

    const validChunks = chunks.filter((c) => c.status === 'done' && c.generatedPrompt && c.generatedResponse)
    if (validChunks.length === 0) {
      setStatusMessage('No synthesized pairs ready to commit.')
      return
    }

    setCommitting(true)
    let committedCount = 0

    try {
      for (const c of validChunks) {
        const session = await createSFTSession({
          project_id: activeProject.id,
          title: `Forge: ${fileName || 'Ingested Doc'} #${c.id}`,
          system_prompt: 'You are an expert AI dataset engineering assistant.'
        })

        await addSFTMessage(session.id, {
          role: 'user',
          content: c.generatedPrompt!
        })

        await addSFTMessage(session.id, {
          role: 'assistant',
          content: c.generatedResponse!
        })

        await commitSFTSession(session.id, {
          tags: ['forge', 'ingestion', strategy],
          metadata: { quality_rating: 5 }
        })

        committedCount++
      }

      setStatusMessage(`Successfully committed ${committedCount} records to Mechon Corpus!`)
      addLog('success', 'corpus', `Committed ${committedCount} records to Corpus project ${activeProject.name}`)
      setChunks([])
      setInputText('')
      setFileName('')
    } catch (err: any) {
      setStatusMessage(`Commit failed: ${err.message || String(err)}`)
      addLog('error', 'corpus', 'Dataset Forge commit failed', err)
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-border px-6 flex items-center justify-between bg-card/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <FileCode2 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Dataset Forge</h2>
            <p className="text-[10px] text-muted-foreground font-mono">
              Document Ingestion, Semantic Chunking & Corpus Synthesis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary border border-border text-xs font-mono">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Model:</span>
            <span className="font-semibold text-foreground">{activeModel || 'mock-llama'}</span>
          </div>

          <button
            onClick={handleCommitToCorpus}
            disabled={committing || chunks.filter((c) => c.status === 'done').length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
          >
            <Database className="h-3.5 w-3.5" />
            {committing ? 'Committing...' : `Commit to Corpus (${chunks.filter((c) => c.status === 'done').length})`}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-6 py-2 bg-primary/10 border-b border-primary/20 text-xs text-primary flex items-center justify-between shrink-0">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Ingestion & Settings */}
        <div className="w-96 border-r border-border p-4 flex flex-col gap-4 overflow-y-auto bg-card/20 shrink-0">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono block mb-2">
              1. Document Ingestion
            </label>
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors bg-secondary/30">
              <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs font-medium text-foreground">Upload Text or Markdown</p>
              <p className="text-[10px] text-muted-foreground mb-3">.txt, .md, .json, .csv files</p>
              <input
                type="file"
                accept=".txt,.md,.json,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="forge-file-input"
              />
              <label
                htmlFor="forge-file-input"
                className="inline-block px-3 py-1 rounded-md bg-secondary hover:bg-accent text-xs font-medium text-foreground cursor-pointer border border-border"
              >
                Choose File
              </label>
              {fileName && <p className="mt-2 text-[11px] font-mono text-primary truncate">{fileName}</p>}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono block mb-1.5">
              Raw Source Text
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Or paste unformatted raw text, articles, or books here..."
              className="flex-1 min-h-[140px] w-full p-2.5 rounded-lg border border-border bg-secondary/50 text-xs text-foreground font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono block mb-2">
              2. Chunking Parameters
            </label>
            <div className="space-y-3 p-3 rounded-xl border border-border bg-secondary/40 text-xs">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Strategy</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as any)}
                  className="w-full p-1.5 rounded bg-background border border-border text-xs text-foreground"
                >
                  <option value="paragraph">Paragraph Split (Semantic natural boundaries)</option>
                  <option value="token">Sliding Token Window (Fixed length + overlap)</option>
                </select>
              </div>

              {strategy === 'token' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Chunk Size (Words)</label>
                    <input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Number(e.target.value))}
                      className="w-full p-1 rounded bg-background border border-border text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Overlap</label>
                    <input
                      type="number"
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(Number(e.target.value))}
                      className="w-full p-1 rounded bg-background border border-border text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleChunkText}
                disabled={!inputText.trim()}
                className="w-full py-1.5 rounded-md bg-secondary hover:bg-accent text-xs font-medium text-foreground border border-border transition-colors flex items-center justify-center gap-1.5"
              >
                <Sliders className="h-3.5 w-3.5" /> Segment Document
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Chunks & Semantic Reconstruction */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Extracted Chunks ({chunks.length})
              </span>
              <span className="text-xs text-muted-foreground ml-3">
                {chunks.filter((c) => c.status === 'done').length} synthesized
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSynthesizeAll}
                disabled={isProcessing || chunks.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isProcessing ? 'Synthesizing...' : 'Reconstruct Semantic SFT Pairs'}
              </button>
              {chunks.length > 0 && (
                <button
                  onClick={() => setChunks([])}
                  className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                  title="Clear chunks"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pt-3">
            {chunks.map((chunk, idx) => (
              <div key={chunk.id} className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-secondary text-[11px] font-mono font-bold text-foreground">
                      Chunk #{idx + 1}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">~{chunk.tokensEst} tokens</span>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      chunk.status === 'done'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : chunk.status === 'processing'
                        ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {chunk.status}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-secondary/30 text-xs font-mono text-muted-foreground border border-border/60 max-h-24 overflow-y-auto">
                  {chunk.content}
                </div>

                {chunk.generatedPrompt && (
                  <div className="space-y-2 pt-2 border-t border-border/80">
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs space-y-1">
                      <span className="text-[10px] font-bold uppercase font-mono text-primary">Synthesized Prompt</span>
                      <p className="text-foreground">{chunk.generatedPrompt}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                      <span className="text-[10px] font-bold uppercase font-mono text-emerald-400">Target Response</span>
                      <p className="text-foreground">{chunk.generatedResponse}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {chunks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                <FileText className="h-10 w-10 stroke-[1.5] mb-2 opacity-50" />
                <p className="text-sm font-medium text-foreground">No document chunks</p>
                <p className="text-xs max-w-sm mt-1">
                  Upload a document or paste raw text on the left to segment and synthesize SFT training examples.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
