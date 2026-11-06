import React from 'react'
import { Languages, Loader2, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

export interface TranslationTurnStatus {
  turnIndex: number
  totalTurns: number
  currentTurnId?: string
  successCount: number
  failedCount: number
  remainingCount: number
  providerName: string
  modelName: string
  isCancelled: boolean
  isCompleted: boolean
  error?: string | null
}

interface TranslationProgressModalProps {
  status: TranslationTurnStatus
  isOpen: boolean
  onCancel: () => void
  onClose: () => void
  onRetryFailed?: () => void
}

export const TranslationProgressModal: React.FC<TranslationProgressModalProps> = ({
  status,
  isOpen,
  onCancel,
  onClose,
  onRetryFailed
}) => {
  if (!isOpen) return null

  const pct = status.totalTurns > 0
    ? Math.min(100, Math.round(((status.successCount + status.failedCount) / status.totalTurns) * 100))
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Sequential Dataset Translation</h3>
          </div>
          {(status.isCompleted || status.isCancelled) && (
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Progress Bar & Headline */}
          <div>
            <div className="flex justify-between items-baseline mb-1 text-xs">
              <span className="font-medium text-foreground">
                {status.isCompleted
                  ? 'Translation Completed'
                  : status.isCancelled
                  ? 'Translation Cancelled'
                  : `Translating: ${status.turnIndex} / ${status.totalTurns} turns`}
              </span>
              <span className="font-mono text-muted-foreground">{pct}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden border border-border/50">
              <div
                className={`h-full transition-all duration-300 ${
                  status.failedCount > 0 ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60">
              <div className="flex items-center justify-center gap-1 text-emerald-400 font-semibold mb-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{status.successCount}</span>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase">Successful</span>
            </div>

            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60">
              <div className="flex items-center justify-center gap-1 text-red-400 font-semibold mb-0.5">
                <XCircle className="w-3.5 h-3.5" />
                <span>{status.failedCount}</span>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase">Failed</span>
            </div>

            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60">
              <div className="flex items-center justify-center gap-1 text-muted-foreground font-semibold mb-0.5">
                <Loader2 className={`w-3.5 h-3.5 ${!status.isCompleted && !status.isCancelled ? 'animate-spin' : ''}`} />
                <span>{status.remainingCount}</span>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase">Remaining</span>
            </div>
          </div>

          {/* Provider & Model Info */}
          <div className="p-3 rounded-lg bg-secondary/20 border border-border/40 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provider:</span>
              <span className="font-medium text-foreground">{status.providerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Translation Model:</span>
              <span className="font-mono text-primary">{status.modelName}</span>
            </div>
            {status.currentTurnId && !status.isCompleted && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Turn ID:</span>
                <span className="font-mono text-[10px] text-muted-foreground">{status.currentTurnId.slice(0, 12)}...</span>
              </div>
            )}
          </div>

          {/* Error Notice */}
          {status.error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 break-words">{status.error}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/20">
          {!status.isCompleted && !status.isCancelled ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              Cancel Translation
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full justify-end">
              {status.failedCount > 0 && onRetryFailed && (
                <button
                  type="button"
                  onClick={onRetryFailed}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-medium text-amber-400 transition-colors"
                >
                  Retry Failed Turns ({status.failedCount})
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground shadow-xs transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
