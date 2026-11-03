import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, ChevronDown, Check, Globe, Sparkles } from 'lucide-react'
import { LanguageInfo, FALLBACK_LANGUAGES, lookupLanguage } from '../../types/languages'
import { getSupportedLanguages } from '../../services/api'

interface LanguagePickerProps {
  value?: string
  onChange: (code: string, info: LanguageInfo) => void
  disabled?: boolean
  label?: string
  placeholder?: string
  className?: string
  compact?: boolean
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  value = 'en',
  onChange,
  disabled = false,
  label,
  placeholder = 'Select language...',
  className = '',
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [languages, setLanguages] = useState<LanguageInfo[]>(FALLBACK_LANGUAGES)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    getSupportedLanguages()
      .then(res => {
        if (mounted && Array.isArray(res) && res.length > 0) {
          setLanguages(res)
        }
      })
      .catch(() => {
        // Fallback already set
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const currentInfo = useMemo(() => lookupLanguage(value, languages), [value, languages])

  const filteredLanguages = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Sort common languages first
      return [...languages].sort((a, b) => {
        if (a.is_common === b.is_common) return a.name.localeCompare(b.name)
        return a.is_common ? -1 : 1
      })
    }
    return languages.filter(
      l =>
        l.name.toLowerCase().includes(q) ||
        l.native_name.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    )
  }, [languages, query])

  const handleSelect = (lang: LanguageInfo) => {
    onChange(lang.code, lang)
    setIsOpen(false)
    setQuery('')
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      const customInfo = lookupLanguage(trimmed, languages)
      onChange(trimmed, customInfo)
      setIsOpen(false)
      setQuery('')
    }
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {label && <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{label}</label>}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border bg-secondary/80 hover:bg-secondary text-foreground text-xs font-medium transition-all ${
          isOpen ? 'ring-1 ring-primary border-primary' : 'border-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${compact ? 'text-[11px] py-1 px-2' : ''}`}
        title={`${currentInfo.name} (${currentInfo.code})${currentInfo.rtl ? ' [RTL]' : ''}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground truncate">
            {compact ? currentInfo.code.toUpperCase() : currentInfo.name}
          </span>
          {!compact && (
            <span className="text-[10px] text-muted-foreground font-mono">
              ({currentInfo.code})
            </span>
          )}
          {currentInfo.rtl && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-500 font-mono font-bold">
              RTL
            </span>
          )}
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 max-w-[90vw] rounded-xl bg-card border border-border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-border bg-secondary/30">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleCustomSubmit(e)
                  }
                }}
                placeholder="Search language or BCP-47 tag..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/20">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map(lang => {
                const isSelected = lang.code.toLowerCase() === value.toLowerCase()
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelect(lang)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-secondary/70 text-foreground'
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{lang.name}</span>
                        {lang.is_common && !query && (
                          <Sparkles className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                        )}
                        {lang.rtl && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono font-bold">
                            RTL
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5">
                        <span className="font-semibold text-foreground/80">{lang.code}</span>
                        {lang.native_name && lang.native_name !== lang.name && (
                          <span className="truncate opacity-75">· {lang.native_name}</span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                )
              })
            ) : (
              <div className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  No standard language matched "{query}".
                </p>
                <button
                  type="button"
                  onClick={handleCustomSubmit}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all cursor-pointer"
                >
                  Use BCP-47 Tag "{query.trim()}"
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
