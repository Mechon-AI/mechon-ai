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
            setStats(res)
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

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Mode pill toggles */}
      <div className="flex items-center rounded-lg bg-secondary/80 p-0.5 border border-border">
        {['all', 'bilingual', 'monolingual'].map(m => {
          const isActive = selectedMode === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'all' ? 'All Modes' : m}
            </button>
          )
        })}
      </div>

      {/* Language Pair / Specific Filter dropdown if pairs exist */}
      {stats.language_pairs.length > 0 && (
        <div className="relative inline-flex items-center">
          <select
            value={selectedPair}
            onChange={e => onPairChange(e.target.value)}
            className="pl-2 pr-7 py-1 text-xs rounded-lg bg-secondary/80 border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer appearance-none"
          >
            <option value="all">All Language Pairs</option>
            {stats.language_pairs.map(pair => (
              <option key={pair} value={pair}>
                {pair.toUpperCase()}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
      )}
    </div>
  )
}
