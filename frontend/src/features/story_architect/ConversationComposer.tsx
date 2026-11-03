import React, { useState, useRef, useEffect } from 'react'
import {
  Send,
  Sparkles,
  Bot,
  User,
  Shield,
  Layers,
  ChevronDown,
  RotateCcw,
  Square,
  Cpu,
  CornerDownLeft,
  Users
} from 'lucide-react'
import type { CharacterProfile, PlanningPromptHistory } from '../../types/story_architect'

interface ConversationComposerProps {
  characters?: CharacterProfile[]
  proposedPrompt?: PlanningPromptHistory | null
  activeModel?: string
  activeProviderId?: string
  isGeneratingPrompt: boolean
  isExecutingTurn: boolean
  isStreaming: boolean
  onSendAndExecute: (content: string, promptHistoryId?: string, edited?: boolean) => Promise<void>
  onStepAutonomous: () => Promise<void>
  onPlanNextPrompt: () => Promise<void>
  onStopGeneration?: () => void
}

export const ConversationComposer: React.FC<ConversationComposerProps> = ({
  characters = [],
  proposedPrompt,
  activeModel,
  activeProviderId,
  isGeneratingPrompt,
  isExecutingTurn,
  isStreaming,
  onSendAndExecute,
  onStepAutonomous,
  onPlanNextPrompt,
  onStopGeneration
}) => {
  const [content, setContent] = useState('')
  const [selectedSpeaker, setSelectedSpeaker] = useState<'user' | 'assistant' | 'system' | string>('user')
  const [speakerDropdownOpen, setSpeakerDropdownOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isBusy = isGeneratingPrompt || isExecutingTurn || isStreaming

  // When proposedPrompt changes and input is empty, offer easy fill
  const handleUsePlannedPrompt = () => {
    if (proposedPrompt) {
      setContent(proposedPrompt.prompt_content)
      setSelectedSpeaker('user')
      textareaRef.current?.focus()
    }
  }

  const handleSend = () => {
    if (!content.trim() || isBusy) return
    const textToSend = content.trim()
    const historyId = proposedPrompt?.id
    const wasEdited = proposedPrompt ? textToSend !== proposedPrompt.prompt_content : true
    onSendAndExecute(textToSend, historyId, wasEdited)
    setContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const getSpeakerLabel = () => {
    if (selectedSpeaker === 'user') return 'User (Director / Engineer)'
    if (selectedSpeaker === 'assistant') return 'Assistant (AI Actor)'
    if (selectedSpeaker === 'system') return 'System (World Context)'
    const char = characters.find(c => c.name === selectedSpeaker)
    return char ? `${char.name} (${char.role || 'Character'})` : selectedSpeaker
  }

  return (
    <div className="border-t border-border bg-card/95 backdrop-blur-md px-4 py-3 select-none shrink-0 shadow-lg relative z-20">
      {/* Planned Prompt Notice Banner */}
      {proposedPrompt && proposedPrompt.status === 'proposed' && (
        <div className="mb-2.5 flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-primary shrink-0">Planned Prompt:</span>
            <span className="text-foreground/80 truncate font-mono text-[11px]">
              "{proposedPrompt.prompt_content}"
            </span>
          </div>
          <button
            onClick={handleUsePlannedPrompt}
            className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 shrink-0 transition-colors shadow-xs"
          >
            Use Planned Prompt
          </button>
        </div>
      )}

      {/* Top Composer Control Row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* Speaker Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSpeakerDropdownOpen(!speakerDropdownOpen)}
            className="flex items-center gap-1.5 h-6 px-2 rounded-md bg-secondary/80 hover:bg-secondary border border-border text-[11px] font-medium text-foreground transition-colors"
          >
            {selectedSpeaker === 'user' ? (
              <User className="w-3 h-3 text-primary" />
            ) : selectedSpeaker === 'assistant' ? (
              <Bot className="w-3 h-3 text-sky-400" />
            ) : selectedSpeaker === 'system' ? (
              <Shield className="w-3 h-3 text-amber-400" />
            ) : (
              <Users className="w-3 h-3 text-emerald-400" />
            )}
            <span className="max-w-[150px] truncate">{getSpeakerLabel()}</span>
            <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
          </button>

          {speakerDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setSpeakerDropdownOpen(false)}
              />
              <div className="absolute left-0 bottom-full mb-1 w-56 rounded-lg border border-border bg-popover text-popover-foreground p-1 shadow-2xl z-40 text-xs divide-y divide-border/60">
                <div className="py-0.5">
                  <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Standard Roles
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSpeaker('user')
                      setSpeakerDropdownOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-left transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>User (Director / Engineer)</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSpeaker('assistant')
                      setSpeakerDropdownOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-left transition-colors"
                  >
                    <Bot className="w-3.5 h-3.5 text-sky-400" />
                    <span>Assistant (AI Actor)</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSpeaker('system')
                      setSpeakerDropdownOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-accent text-left transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>System (Stage / Context)</span>
                  </button>
                </div>

                {characters.length > 0 && (
                  <div className="py-0.5">
                    <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                      Characters
                    </div>
                    {characters.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => {
                          setSelectedSpeaker(c.name)
                          setSpeakerDropdownOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-accent text-left transition-colors"
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {c.role || 'Character'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Inference Model Badge */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/60 border border-border/80">
            <Cpu className="w-2.5 h-2.5 text-primary" />
            <span className="truncate max-w-[130px]">{activeModel || 'default-model'}</span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/50">Ctrl+Enter to send</span>
        </div>
      </div>

      {/* Main Textarea Input */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isBusy
              ? 'Model or agent is generating turn...'
              : proposedPrompt
              ? `Write prompt or use planned: "${proposedPrompt.prompt_content.slice(0, 60)}..."`
              : 'Write conversation prompt, stage direction, or character dialogue (Ctrl+Enter to send)...'
          }
          disabled={isBusy}
          rows={3}
          className="w-full p-2.5 rounded-xl bg-background/80 border border-border/80 text-foreground text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary/80 transition-all resize-none shadow-inner"
        />

        {/* Actions inside composer */}
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-1.5">
            {/* Step Autonomous Button */}
            <button
              type="button"
              onClick={onStepAutonomous}
              disabled={isBusy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs text-foreground font-medium transition-colors disabled:opacity-40"
              title="Autonomous step: Agent plans and immediately executes the next turn"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Step Autonomous Turn</span>
            </button>

            {/* Plan Next Prompt Button */}
            <button
              type="button"
              onClick={onPlanNextPrompt}
              disabled={isBusy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              title="Ask planning agent to analyze narrative state and draft the next prompt"
            >
              <RotateCcw className={`w-3 h-3 ${isGeneratingPrompt ? 'animate-spin' : ''}`} />
              <span>{isGeneratingPrompt ? 'Planning...' : 'Plan Next Turn'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isBusy && onStopGeneration && (
              <button
                type="button"
                onClick={onStopGeneration}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/20 border border-destructive/40 text-destructive text-xs font-semibold hover:bg-destructive/30 transition-colors"
                title="Stop current execution"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            )}

            {/* Primary Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!content.trim() || isBusy}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-sm disabled:opacity-40"
              title="Execute turn with prompt (Ctrl+Enter)"
            >
              <Send className="w-3 h-3" />
              <span>{isExecutingTurn ? 'Generating...' : 'Execute Turn'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
