import React from 'react'
import { Cpu, Globe, Key, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react'

interface ProviderInspectorProps {
  data: any
}

export const ProviderInspector: React.FC<ProviderInspectorProps> = ({ data }) => {
  if (!data) return null

  const isOnline = data.is_online !== false && data.healthy !== false

  return (
    <div className="space-y-4 text-xs">
      <div className="p-3 rounded-xl border border-border bg-card/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-primary/20 text-primary">
            {data.provider_type || data.type || 'Inference Provider'}
          </span>
          <span
            className={`text-[10px] font-mono flex items-center gap-1 font-semibold ${
              isOnline ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {isOnline ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <h4 className="font-semibold text-foreground text-sm truncate">{data.name}</h4>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Endpoint & Connectivity
        </span>
        <div className="rounded-lg border border-border bg-secondary/30 divide-y divide-border/60">
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Endpoint</span>
            <span className="font-semibold text-foreground font-mono truncate max-w-[170px]" title={data.base_url || data.endpoint}>
              {data.base_url || data.endpoint || 'http://localhost:11434'}
            </span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Default Model</span>
            <span className="font-semibold text-foreground font-mono truncate max-w-[170px]">
              {data.default_model || 'None'}
            </span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">Available Models</span>
            <span className="font-semibold text-foreground font-mono">
              {data.models_cache?.length || 0} discovered
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
          Credential Storage
        </span>
        <div className="rounded-lg border border-border bg-secondary/30 p-2.5 space-y-1.5 text-[11px] font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Key Vault:</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Encrypted Vault (Zero Telemetry)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">KDE Wallet / Secret:</span>
            <span className="text-foreground">Connected</span>
          </div>
        </div>
      </div>
    </div>
  )
}
