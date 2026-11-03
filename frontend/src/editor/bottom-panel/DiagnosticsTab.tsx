import React, { useState } from 'react'
import { Activity, ShieldCheck, CheckCircle2, XCircle, RefreshCw, Cpu, Server } from 'lucide-react'
import { useProviderStore } from '../../stores/useProviderStore'
import { testProvider, getVaultDiagnostics } from '../../services/api'
import { useConsoleStore } from '../stores/useConsoleStore'
import type { ConnectionTestResult } from '../../types'

export const DiagnosticsTab: React.FC = () => {
  const { providers, activeProviderId, isOnline } = useProviderStore()
  const { addLog } = useConsoleStore()

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [vaultStatus, setVaultStatus] = useState<any>(null)

  const handleRunDiagnostics = async () => {
    if (!activeProviderId) return
    setTesting(true)
    try {
      const conn = await testProvider(activeProviderId)
      const vault = await getVaultDiagnostics()
      setTestResult(conn)
      setVaultStatus(vault)
      addLog(conn.success ? 'success' : 'error', 'diagnostics', `Provider diagnostics: ${conn.message}`)
    } catch (err: any) {
      setTestResult({
        success: false,
        code: 'ERROR',
        message: err.message || String(err),
        models: [],
        latency_ms: 0
      })
      addLog('error', 'diagnostics', 'Diagnostics check failed', err)
    } finally {
      setTesting(false)
    }
  }

  const activeProvider = providers.find((p) => p.id === activeProviderId)

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      <div className="h-7 border-b border-border/80 px-3 flex items-center justify-between bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground">
            Provider & Vault Diagnostics ({activeProvider?.name || 'None'})
          </span>
        </div>

        <button
          onClick={handleRunDiagnostics}
          disabled={testing || !activeProviderId}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${testing ? 'animate-spin' : ''}`} />
          Run Health Check
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Active Provider Card */}
          <div className="p-3 rounded-xl border border-border bg-card/60 space-y-1.5">
            <span className="text-[10px] font-bold uppercase font-mono text-muted-foreground">Inference Endpoint</span>
            <div className="font-semibold text-foreground truncate">{activeProvider?.name || 'No Provider'}</div>
            <div className="text-[11px] font-mono text-muted-foreground truncate">
              {activeProvider?.base_url || 'http://localhost:11434'}
            </div>
            <div className="pt-1 flex items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Status:</span>
              <span className={`font-semibold ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isOnline ? 'Online' : 'Pending / Offline'}
              </span>
            </div>
          </div>

          {/* Key Vault Card */}
          <div className="p-3 rounded-xl border border-border bg-card/60 space-y-1.5">
            <span className="text-[10px] font-bold uppercase font-mono text-muted-foreground">Credential Storage</span>
            <div className="font-semibold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Local-First
            </div>
            <p className="text-[11px] text-muted-foreground">
              Encrypted Vault with KDE Wallet / Secret Service integration.
            </p>
            <div className="pt-1 text-[10px] font-mono text-muted-foreground">
              Zero telemetry • Local persistence
            </div>
          </div>

          {/* Model Cache Card */}
          <div className="p-3 rounded-xl border border-border bg-card/60 space-y-1.5">
            <span className="text-[10px] font-bold uppercase font-mono text-muted-foreground">Discovered Models</span>
            <div className="font-semibold text-foreground font-mono">
              {activeProvider?.models_cache?.length || 0} Models Available
            </div>
            <div className="text-[11px] text-muted-foreground font-mono truncate">
              Default: {activeProvider?.default_model || 'None configured'}
            </div>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl border ${
              testResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-destructive/10 border-destructive/30'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className={testResult.success ? 'text-emerald-400' : 'text-destructive'}>
                {testResult.success ? 'Provider Health Check Passed' : 'Health Check Warning'}
              </span>
            </div>
            <p className="text-xs text-foreground mt-1">{testResult.message}</p>
            {testResult.latency_ms !== undefined && (
              <p className="text-[11px] font-mono text-muted-foreground mt-1">
                Round-trip Latency: {testResult.latency_ms} ms
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
