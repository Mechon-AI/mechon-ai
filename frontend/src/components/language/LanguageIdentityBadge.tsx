import React from 'react'
import { Globe, ArrowRight } from 'lucide-react'
import { lookupLanguage, isRTL } from '../../types/languages'

interface LanguageIdentityBadgeProps {
  primaryLanguage?: string
  secondaryLanguage?: string
  mode?: 'monolingual' | 'bilingual' | string
  compact?: boolean
  className?: string
}

export const LanguageIdentityBadge: React.FC<LanguageIdentityBadgeProps> = ({
  primaryLanguage = 'en',
  secondaryLanguage,
  mode,
  compact = false,
  className = ''
}) => {
  const pInfo = lookupLanguage(primaryLanguage)
  const isBi = (mode === 'bilingual' || Boolean(secondaryLanguage)) && secondaryLanguage !== undefined && secondaryLanguage !== ''
  const sInfo = isBi ? lookupLanguage(secondaryLanguage) : null
  const hasRtl = pInfo.rtl || (sInfo ? sInfo.rtl : false)

  if (isBi && sInfo) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/80 border border-border text-foreground font-mono text-xs ${className}`}
        title={`Bilingual Pair: ${pInfo.name} (${pInfo.code}) → ${sInfo.name} (${sInfo.code})${hasRtl ? ' [Includes RTL]' : ''}`}
      >
        <Globe className="h-3 w-3 text-cyan-400 shrink-0" />
        <span className="font-semibold text-primary">{compact ? pInfo.code.toUpperCase() : pInfo.name}</span>
        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
        <span className="font-semibold text-cyan-400">{compact ? sInfo.code.toUpperCase() : sInfo.name}</span>
        {hasRtl && (
          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono font-bold">
            RTL
          </span>
        )}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/60 border border-border text-foreground font-mono text-xs ${className}`}
      title={`Monolingual: ${pInfo.name} (${pInfo.code})${pInfo.rtl ? ' [RTL]' : ''}`}
    >
      <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="font-medium text-foreground">{compact ? pInfo.code.toUpperCase() : pInfo.name}</span>
      {pInfo.rtl && (
        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono font-bold">
          RTL
        </span>
      )}
    </span>
  )
}
