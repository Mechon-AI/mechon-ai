import React, { useState } from 'react'
import {
  Sparkles,
  X,
  Languages,
  Cpu,
  Sliders,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import type { Provider, SFTSession } from '../../types'
import { lookupLanguage, FALLBACK_LANGUAGES } from '../../types/languages'
import { translateSFTSession } from '../../services/api'

interface TranslateModalProps {
  session: SFTSession
  providers: Provider[]
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedSession: SFTSession) => void
}

export const TranslateModal: React.FC<TranslateModalProps> = ({
  session,
  providers,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [targetLang, setTargetLang] = useState<string>(
    session.secondary_language || (session.primary_language === 'en' ? 'id' : 'en')
  )
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    session.provider_id || providers[0]?.id || 'mock'
  )
  const currentProvider = providers.find(p => p.id === selectedProviderId) || providers[0]
  const availableModels = currentProvider?.models_cache && currentProvider.models_cache.length > 0
    ? currentProvider.models_cache
    : [currentProvider?.default_model || 'default']

  const [selectedModel, setSelectedModel] = useState<string>(
    session.model && availableModels.includes(session.model)
      ? session.model
      : currentProvider?.default_model || availableModels[0]
  )
  const [temperature, setTemperature] = useState(0.3)
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleTranslate = async () => {
    setIsTranslating(true)
    setError(null)
    try {
      const updated = await translateSFTSession({
        session_id: session.id,
        target_language: targetLang,
        provider_id: selectedProviderId,
        model: selectedModel
      })
      onSuccess(updated)
      onClose()
    } catch (err: any) {
      console.error('Translation failed:', err)
      setError(err?.message || String(err))
    } finally {
      setIsTranslating(false)
    }
  }

  const primaryInfo = lookupLanguage(session.primary_language || 'id')
  const targetInfo = lookupLanguage(targetLang)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">LLM Translation Studio</h3>
              <p className="text-xs text-muted-foreground">
                Generate high-quality conversational translations across turns.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Language Pair */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
            <div>
              <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
                Source Language (Original)
              </label>
              <div className="font-semibold text-foreground flex items-center gap-1.5 py-1">
                <span>{primaryInfo.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">({primaryInfo.code})</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
                Target Language
              </label>
              <select
                value={targetLang}
                onChange={e => setTargetLang(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-hidden focus:border-primary"
              >
                {FALLBACK_LANGUAGES.filter(l => l.code !== session.primary_language).map(l => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              <span>Inference Provider</span>
            </label>
            <select
              value={selectedProviderId}
              onChange={e => {
                const newPId = e.target.value
                setSelectedProviderId(newPId)
                const p = providers.find(item => item.id === newPId)
                const newModel = p?.default_model || (p?.models_cache && p.models_cache[0]) || 'default'
                setSelectedModel(newModel)
              }}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:border-primary"
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.provider_type})
                </option>
              ))}
            </select>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-foreground">
              Model
            </label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-hidden focus:border-primary"
            >
              {availableModels.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Temperature (Consistency):</span>
              <span className="font-mono font-medium">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <p className="text-[10px] text-muted-foreground">
              Lower temperatures (0.1–0.3) provide precise, faithful translations with preserved terminology.
            </p>
          </div>

          {/* Notice */}
          <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px]">
            Translates all {session.messages.length} conversation turns into {targetInfo.name}. Original content is safely preserved.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border bg-secondary/30">
          <button
            onClick={onClose}
            disabled={isTranslating}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Translating conversation...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Translation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
