import React, { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useDatasetSyncStore } from '../../stores/useDatasetSyncStore'

interface StudioRefreshButtonProps {
  onRefresh: () => Promise<void> | void
  label?: string
  lastSynced?: number
  isRefreshing?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export const StudioRefreshButton: React.FC<StudioRefreshButtonProps> = ({
  onRefresh,
  label = 'Refresh',
  lastSynced,
  isRefreshing: externalRefreshing,
  className = '',
  size = 'md'
}) => {
  const storeLastSync = useDatasetSyncStore((s) => s.lastSyncTimestamp)
  const notifyRefresh = useDatasetSyncStore((s) => s.notifyRefresh)
  const syncTimestamp = lastSynced || storeLastSync

  const [internalLoading, setInternalLoading] = useState(false)
  const [successPing, setSuccessPing] = useState(false)
  const [errorPing, setErrorPing] = useState<string | null>(null)

  const loading = externalRefreshing !== undefined ? externalRefreshing : internalLoading

  const handleClick = async () => {
    if (loading) return
    setInternalLoading(true)
    setErrorPing(null)
    setSuccessPing(false)
    try {
      await onRefresh()
      notifyRefresh()
      setSuccessPing(true)
      setTimeout(() => setSuccessPing(false), 2000)
    } catch (err: any) {
      setErrorPing(err?.message || 'Refresh failed')
      setTimeout(() => setErrorPing(null), 4000)
    } finally {
      setInternalLoading(false)
    }
  }

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs'

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title={`Synchronize with SQLite database. Last synced: ${formatTimestamp(syncTimestamp)}`}
        className={`inline-flex items-center gap-1.5 font-medium rounded-md border transition-all duration-150 select-none shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
          errorPing
            ? 'border-red-500/40 text-red-400 bg-red-500/10'
            : successPing
            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
            : 'border-border/60 hover:border-primary/40 text-foreground/80 hover:text-foreground bg-card/60 hover:bg-secondary/40'
        } ${sizeClass}`}
      >
        {errorPing ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
        ) : successPing ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
        )}
        <span>{loading ? 'Refreshing...' : label}</span>
      </button>

      {syncTimestamp > 0 && (
        <span className="text-[11px] text-muted-foreground/70 hidden sm:inline-block font-mono">
          Synced {formatTimestamp(syncTimestamp)}
        </span>
      )}
    </div>
  )
}
