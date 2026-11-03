import React, { useEffect, useState } from 'react'
import { Filter, Globe, ChevronDown } from 'lucide-react'
import { getCorpusLanguages } from '../../services/api'
import { CorpusLanguageStats } from '../../types/languages'

interface LanguageFilterProps {
  projectId: string
  selectedMode: string
  selectedPair: string
  onModeChange: (mode: string) => void
  onPairChange: (pair: string) => void
  className?: string
}

export const LanguageFilter: React.FC<LanguageFilterProps> = ({
  projectId,
  selectedMode,
  selectedPair,
  onModeChange,
  onPairChange,
  className = ''
}) => {
  const [stats, setStats] = useState<CorpusLanguageStats>({
    language_pairs: [],
    primary_languages: [],
    secondary_languages: [],
    modes: []
  })

  useEffect(() => {
    let mounted = true
    if (projectId) {
      getCorpusLanguages(projectId)
        .then(res => {
          if (mounted && res) {
            setStats({
              language_pairs: Array.isArray(res.language_pairs) ? res.language_pairs : [],
              primary_languages: Array.isArray(res.primary_languages) ? res.primary_languages : [],
              secondary_languages: Array.isArray(res.secondary_languages) ? res.secondary_languages : [],
              modes: Array.isArray(res.modes) ? res.modes : []
            })
          }
        })
        .catch(err => {
          console.warn('Failed to fetch corpus languages:', err)
        })
    }
    return () => {
      mounted = false
    }
  }, [projectId])

  const pairs = Array.isArray(stats?.language_pairs) ? stats.language_pairs : []

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {/* Mode pill toggles */}
      <div className="flex items-center rounded-md bg-secondary/60 p-0.5 border border-border/80">
        {['all', 'bilingual', 'monolingual'].map(m => {
          const isActive = selectedMode === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/30 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'all' ? 'All' : m === 'bilingual' ? 'Bilingual' : 'Monolingual'}
            </button>
          )
        })}
      </div>

      {/* Language Pair / Specific Filter dropdown if pairs exist */}
      {pairs.length > 0 && (
        <div className="relative inline-flex items-center">
          <select
            value={selectedPair}
            onChange={e => onPairChange(e.target.value)}
            className="pl-2 pr-6 py-0.5 text-[11px] rounded-md bg-secondary/60 border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer appearance-none max-w-[150px] truncate"
          >
            <option value="all">All Pairs</option>
            {pairs.map((item, idx) => {
              const pairValue = typeof item === 'string' ? item : item?.pair || `pair-${idx}`
              const pairLabel = typeof item === 'string'
                ? item.toUpperCase()
                : item?.label || (item?.pair ? item.pair.toUpperCase() : `Pair #${idx + 1}`)
              return (
                <option key={pairValue} value={pairValue}>
                  {pairLabel}
                </option>
              )
            })}
          </select>
          <ChevronDown className="absolute right-1.5 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
      )}
    </div>
  )
}
