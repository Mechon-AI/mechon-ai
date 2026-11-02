import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Terminal,
  Sparkles,
  Sliders,
  Send,
  MessageSquareCode,
  GitCompare,
  Copy,
  Check
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useProviderStore } from '../../stores/useProviderStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { generateCompletion, createSFTSession, addSFTMessage, createDPOTask } from '../../services/api'

export const PlaygroundView: React.FC = () => {
  const navigate = useNavigate()
  const { providers, activeProviderId, activeModel, setActiveProviderId, setActiveModel } = useProviderStore()
  const { activeProjectId, ensureActiveProject } = useProjectStore()

  const [prompt, setPrompt] = useState('Explain gradient descent and provide a numerical example with eta = 0.1.')
  const [systemPrompt, setSystemPrompt] = useState('You are an expert ML dataset engineer.')
  const [temperature, setTemperature] = useState(0.7)
  const [topP, setTopP] = useState(0.9)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [output, setOutput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return
    setIsGenerating(true)
    try {
      const res = await generateCompletion({
        provider_id: activeProviderId,
        model: activeModel,
        prompt: prompt.trim(),
        system_prompt: systemPrompt.trim(),
        temperature,
        top_p: topP,
        max_tokens: maxTokens
      })
      setOutput(res.content || '')
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleTransferToSFT = async () => {
    let pId = activeProjectId || (await ensureActiveProject())
    if (!pId || !output) return
    const session = await createSFTSession({
      project_id: pId,
      title: `Playground Draft: ${prompt.slice(0, 30)}...`,
      system_prompt: systemPrompt,
      model: activeModel
    })
    await addSFTMessage(session.id, { role: 'user', content: prompt })
    await addSFTMessage(session.id, { role: 'assistant', content: output })
    navigate('/sft')
  }

  const handleTransferToDPO = async () => {
    let pId = activeProjectId || (await ensureActiveProject())
    if (!pId || !output) return
    await createDPOTask({
      project_id: pId,
      prompt: prompt,
      system_prompt: systemPrompt,
      response_a: output,
      response_b: ''
    })
    navigate('/dpo')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" /> Model Playground
          </h2>
          <p className="text-xs text-muted-foreground">
            Test and evaluate prompt generations across connected inference models before committing into datasets.
          </p>
        </div>

        {output && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleTransferToSFT}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-accent border border-border flex items-center gap-1.5"
            >
              <MessageSquareCode className="h-3.5 w-3.5 text-primary" /> Send to SFT Draft
            </button>
            <button
              onClick={handleTransferToDPO}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-accent border border-border flex items-center gap-1.5"
            >
              <GitCompare className="h-3.5 w-3.5 text-indigo-400" /> Send to DPO Task
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prompt Input & Controls */}
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                System Instructions
              </label>
              <textarea
                rows={2}
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-secondary/70 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                User Prompt
              </label>
              <textarea
                rows={5}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-secondary/70 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Sliders */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Temperature</span>
                  <span className="font-mono">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.05"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Top P</span>
                  <span className="font-mono">{topP}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={topP}
                  onChange={e => setTopP(parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? 'Generating...' : 'Execute Generation'}
            </button>
          </div>
        </div>

        {/* Output Area */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-card border border-border flex flex-col justify-between shadow-sm min-h-[420px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Model Output</span>
              {output && (
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground text-xs flex items-center gap-1"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>Copy</span>
                </button>
              )}
            </div>

            <div className="prose prose-invert prose-xs max-w-none min-h-[300px]">
              {output ? (
                <ReactMarkdown>{output}</ReactMarkdown>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic py-24">
                  Output will render here...
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>Model: {activeModel}</span>
            <span>Words: {output ? output.split(/\s+/).filter(Boolean).length : 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
