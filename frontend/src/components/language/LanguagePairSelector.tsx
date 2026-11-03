import React from 'react'
import { ArrowRight, ArrowLeftRight, Languages } from 'lucide-react'
import { LanguagePicker } from './LanguagePicker'
import { LanguageInfo } from '../../types/languages'

interface LanguagePairSelectorProps {
  primaryLanguage: string
  secondaryLanguage: string
  onPrimaryChange: (code: string, info: LanguageInfo) => void
  onSecondaryChange: (code: string, info: LanguageInfo) => void
  onSwap?: () => void
  disabled?: boolean
  compact?: boolean
  showLabels?: boolean
  className?: string
}

export const LanguagePairSelector: React.FC<LanguagePairSelectorProps> = ({
  primaryLanguage,
  secondaryLanguage,
  onPrimaryChange,
  onSecondaryChange,
  onSwap,
  disabled = false,
  compact = false,
  showLabels = false,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex flex-col">
        {showLabels && (
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Primary / Source
          </span>
        )}
        <LanguagePicker
          value={primaryLanguage}
          onChange={onPrimaryChange}
          disabled={disabled}
          compact={compact}
          placeholder="Primary language..."
        />
      </div>

      <div className="flex items-center pt-0.5">
        {onSwap ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSwap}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Swap source and target languages"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      <div className="flex flex-col">
        {showLabels && (
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Secondary / Target
          </span>
        )}
        <LanguagePicker
          value={secondaryLanguage}
          onChange={onSecondaryChange}
          disabled={disabled}
          compact={compact}
          placeholder="Secondary language..."
        />
      </div>
    </div>
  )
}
