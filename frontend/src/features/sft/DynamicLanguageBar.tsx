import React, { useState, useRef, useEffect } from 'react'
import {
  Languages,
  Plus,
  X,
  Search,
  Check,
  ChevronDown,
  Globe,
  Sparkles
} from 'lucide-react'
import { FALLBACK_LANGUAGES, lookupLanguage, isRTL, type LanguageInfo } from '../../types/languages'

interface DynamicLanguageBarProps {
  languageMode: 'monolingual' | 'bilingual' | 'multilingual' | string
  primaryLanguage: string
  targetLanguages: string[]
  activeLanguageTab: string // either primary or one of targetLanguages
  onChangeMode: (mode: 'monolingual' | 'bilingual' | 'multilingual') => void
  onChangePrimaryLanguage: (langCode: string) => void
  onAddTargetLanguage: (langCode: string) => void
  onRemoveTargetLanguage: (langCode: string) => void
  onSelectLanguageTab: (langCode: string) => void
  onOpenTranslateModal?: () => void
}

export const DynamicLanguageBar: React.FC<DynamicLanguageBarProps> = ({
  languageMode,
  primaryLanguage,
  targetLanguages,
  activeLanguageTab,
  onChangeMode,
  onChangePrimaryLanguage,
  onAddTargetLanguage,
  onRemoveTargetLanguage,
  onSelectLanguageTab,
  onOpenTranslateModal
}) => {
  const [showPrimaryPicker, setShowPrimaryPicker] = useState(false)
  const [showAddTargetPicker, setShowAddTargetPicker] = useState(false)
  const [primarySearch, setPrimarySearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')

  const primaryRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (primaryRef.current && !primaryRef.current.contains(e.target as Node)) {
        setShowPrimaryPicker(false)
      }
      if (targetRef.current && !targetRef.current.contains(e.target as Node)) {
        setShowAddTargetPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredPrimary = FALLBACK_LANGUAGES.filter(
    l => l.name.toLowerCase().includes(primarySearch.toLowerCase()) ||
         l.code.toLowerCase().includes(primarySearch.toLowerCase()) ||
         l.native_name.toLowerCase().includes(primarySearch.toLowerCase())
  )

  const availableForTarget = FALLBACK_LANGUAGES.filter(
    l => l.code !== primaryLanguage && !targetLanguages.includes(l.code)
  ).filter(
    l => l.name.toLowerCase().includes(targetSearch.toLowerCase()) ||
         l.code.toLowerCase().includes(targetSearch.toLowerCase()) ||
         l.native_name.toLowerCase().includes(targetSearch.toLowerCase())
  )

  const primaryInfo = lookupLanguage(primaryLanguage)
  const isMonolingual = languageMode === 'monolingual'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-secondary/20 border-b border-border text-xs">
      {/* Left: Mode switch & Primary Language */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-lg bg-secondary/80 border border-border p-0.5 text-[11px]">
          <button
            onClick={() => onChangeMode('monolingual')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              isMonolingual
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monolingual
          </button>
          <button
            onClick={() => onChangeMode(targetLanguages.length > 1 ? 'multilingual' : 'bilingual')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
              !isMonolingual
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Multilingual ({targetLanguages.length})
          </button>
        </div>

        <span className="text-muted-foreground/40">|</span>

        {/* Primary Language Dropdown */}
        <div className="relative" ref={primaryRef}>
          <button
            onClick={() => setShowPrimaryPicker(!showPrimaryPicker)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-[11px] text-foreground transition-colors cursor-pointer"
            title="Dataset Primary / Source Language"
          >
            <span className="text-muted-foreground text-[10px] uppercase font-mono">Source:</span>
            <span className="font-semibold">{primaryInfo.name}</span>
            <span className="text-[10px] font-mono opacity-70">({primaryInfo.code})</span>
            {primaryInfo.rtl && (
              <span className="text-[9px] px-1 rounded-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">RTL</span>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
          </button>

          {showPrimaryPicker && (
            <div className="absolute left-0 mt-1.5 w-64 bg-card border border-border rounded-lg shadow-xl z-50 p-2 animate-in fade-in duration-100">
              <div className="relative mb-2">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={primarySearch}
                  onChange={e => setPrimarySearch(e.target.value)}
                  placeholder="Search language..."
                  autoFocus
                  className="w-full pl-7 pr-2 py-1 bg-background border border-border rounded-md text-[11px] text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>

              <div className="max-h-52 overflow-y-auto space-y-0.5">
                {filteredPrimary.map(l => (
                  <button
                    key={l.code}
                    onClick={() => {
                      onChangePrimaryLanguage(l.code)
                      setShowPrimaryPicker(false)
                      setPrimarySearch('')
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-[11px] transition-colors cursor-pointer ${
                      primaryLanguage === l.code
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-medium truncate">{l.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate font-mono">({l.native_name})</span>
                    </div>
                    {primaryLanguage === l.code && <Check className="w-3 h-3 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Target Language Tabs / Manager */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {isMonolingual ? (
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <span>Monolingual mode active</span>
            <button
              onClick={() => {
                onChangeMode('bilingual')
                if (targetLanguages.length === 0) {
                  const defaultTarget = primaryLanguage === 'en' ? 'id' : 'en'
                  onAddTargetLanguage(defaultTarget)
                }
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-primary hover:bg-secondary/80 border border-border text-[11px] cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Enable Translations</span>
            </button>
          </div>
        ) : (
          <>
            <span className="text-[10px] uppercase font-mono text-muted-foreground mr-1">Views:</span>

            {/* Primary Language View Tab */}
            <button
              onClick={() => onSelectLanguageTab(primaryLanguage)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                activeLanguageTab === primaryLanguage
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>{primaryInfo.code.toUpperCase()} (Primary)</span>
            </button>

            {/* Target Language Tabs */}
            {targetLanguages.map(tCode => {
              const tInfo = lookupLanguage(tCode)
              const isActive = activeLanguageTab === tCode

              return (
                <div
                  key={tCode}
                  className={`flex items-center rounded-lg border transition-all ${
                    isActive
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 shadow-xs'
                      : 'bg-secondary/60 border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <button
                    onClick={() => onSelectLanguageTab(tCode)}
                    className="px-2 py-1 text-[11px] font-medium cursor-pointer"
                  >
                    {tInfo.name} ({tInfo.code.toUpperCase()})
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      onRemoveTargetLanguage(tCode)
                    }}
                    className="p-1 hover:text-rose-400 hover:bg-rose-500/10 rounded-r-lg transition-colors cursor-pointer"
                    title={`Remove ${tInfo.name} translation`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}

            {/* Add Target Language Picker */}
            <div className="relative" ref={targetRef}>
              <button
                onClick={() => setShowAddTargetPicker(!showAddTargetPicker)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-[11px] text-foreground transition-colors cursor-pointer"
                title="Add translation language"
              >
                <Plus className="w-3 h-3" />
                <span>Add Lang</span>
              </button>

              {showAddTargetPicker && (
                <div className="absolute right-0 mt-1.5 w-60 bg-card border border-border rounded-lg shadow-xl z-50 p-2 animate-in fade-in duration-100">
                  <div className="relative mb-2">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={targetSearch}
                      onChange={e => setTargetSearch(e.target.value)}
                      placeholder="Search language to add..."
                      autoFocus
                      className="w-full pl-7 pr-2 py-1 bg-background border border-border rounded-md text-[11px] text-foreground focus:outline-hidden focus:border-primary"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {availableForTarget.length === 0 ? (
                      <div className="py-3 text-center text-[10px] text-muted-foreground">
                        No languages available
                      </div>
                    ) : (
                      availableForTarget.map(l => (
                        <button
                          key={l.code}
                          onClick={() => {
                            onAddTargetLanguage(l.code)
                            setShowAddTargetPicker(false)
                            setTargetSearch('')
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-[11px] text-foreground hover:bg-secondary transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-medium truncate">{l.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">({l.code})</span>
                          </div>
                          {l.rtl && (
                            <span className="text-[9px] px-1 rounded-xs bg-amber-500/10 text-amber-400">RTL</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Translate Button */}
            {onOpenTranslateModal && (
              <button
                onClick={onOpenTranslateModal}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-[11px] font-medium transition-colors cursor-pointer shadow-xs ml-1"
                title="Generate AI translations for turns"
              >
                <Sparkles className="w-3 h-3" />
                <span>Translate LLM</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
