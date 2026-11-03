import React, { useState, useEffect } from 'react'
import {
  Cpu,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Server,
  Key,
  Clock,
  Sparkles,
  Check,
  X,
  Lock,
  EyeOff,
  Zap,
  Globe,
  Radio,
  Sliders,
  Activity
} from 'lucide-react'
import { useProviderStore } from '../../stores/useProviderStore'
import {
  getProviderDefinitions,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  diagnoseProvider,
  getVaultDiagnostics
} from '../../services/api'
import type { Provider, ProviderDefinition, ConnectionTestResult, VaultDiagnostics, ProviderDiagnosticReport } from '../../types'

export const ProviderManagerView: React.FC = () => {
  const {
    providers,
    activeProviderId,
    activeModel,
    setActiveProviderId,
    setActiveModel,
    fetchProviders
  } = useProviderStore()

  // Definitions from Rust Registry
  const [definitions, setDefinitions] = useState<ProviderDefinition[]>([])

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)

  // Form states
  const [selectedDefId, setSelectedDefId] = useState('ollama')
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('ollama')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434')
  const [apiKey, setApiKey] = useState('')
  const [willClearKey, setWillClearKey] = useState(false)
  const [defaultModel, setDefaultModel] = useState('')
  const [timeoutSeconds, setTimeoutSeconds] = useState(60)

  // Feedback states
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({})
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [customModelInput, setCustomModelInput] = useState<Record<string, string>>({})
  const [vaultDiag, setVaultDiag] = useState<VaultDiagnostics | null>(null)
  const [showDiagModal, setShowDiagModal] = useState(false)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null)
  const [diagnosticReport, setDiagnosticReport] = useState<ProviderDiagnosticReport | null>(null)
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false)

  useEffect(() => {
    fetchProviders()
    loadDefinitions()
    loadDiagnostics()
  }, [])

  const loadDiagnostics = async () => {
    try {
      setDiagLoading(true)
      const diag = await getVaultDiagnostics()
      setVaultDiag(diag)
    } catch (e) {
      console.error('Failed to run vault diagnostics', e)
    } finally {
      setDiagLoading(false)
    }
  }

  const loadDefinitions = async () => {
    try {
      const defs = await getProviderDefinitions()
      setDefinitions(defs)
    } catch (e) {
      console.error('Failed to load provider definitions', e)
    }
  }

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }

  const openAddModal = (presetId?: string) => {
    setEditingProvider(null)
    setWillClearKey(false)
    setApiKey('')

    const targetDefId = presetId || 'ollama'
    const def = definitions.find(d => d.id === targetDefId) || definitions[0]

    if (def) {
      setSelectedDefId(def.id)
      setName(def.name)
      setProviderType(def.provider_type)
      const url = def.default_path ? `${def.default_host}${def.default_path}` : def.default_host
      setBaseUrl(url)
      setDefaultModel(def.default_model)
      setTimeoutSeconds(60)
    } else {
      setSelectedDefId('ollama')
      setName('Ollama (Local)')
      setProviderType('ollama')
      setBaseUrl('http://127.0.0.1:11434')
      setDefaultModel('llama3:latest')
      setTimeoutSeconds(60)
    }

    setShowModal(true)
  }

  const openEditModal = (p: Provider) => {
    setEditingProvider(p)
    setName(p.name)
    setProviderType(p.provider_type)
    setBaseUrl(p.base_url)
    setApiKey('')
    setWillClearKey(false)
    setDefaultModel(p.default_model || '')
    setTimeoutSeconds(p.timeout_seconds || 60)

    const def = definitions.find(d => d.provider_type === p.provider_type || d.id === p.provider_type)
    if (def) {
      setSelectedDefId(def.id)
    }
    setShowModal(true)
  }

  const handleSelectDefinition = (defId: string) => {
    setSelectedDefId(defId)
    const def = definitions.find(d => d.id === defId)
    if (def) {
      setName(def.name)
      setProviderType(def.provider_type)
      const url = def.default_path ? `${def.default_host}${def.default_path}` : def.default_host
      setBaseUrl(url)
      setDefaultModel(def.default_model)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !baseUrl.trim()) {
      showFeedback('error', 'Provider name and base URL are required.')
      return
    }

    try {
      if (editingProvider) {
        await updateProvider(editingProvider.id, {
          name: name.trim(),
          base_url: baseUrl.trim(),
          api_key: apiKey.trim() ? apiKey.trim() : undefined,
          clear_api_key: willClearKey,
          default_model: defaultModel.trim() || undefined,
          timeout_seconds: timeoutSeconds
        })
        showFeedback('success', `Provider "${name.trim()}" updated successfully.`)
      } else {
        await createProvider({
          name: name.trim(),
          provider_type: providerType,
          base_url: baseUrl.trim(),
          api_key: apiKey.trim() ? apiKey.trim() : undefined,
          default_model: defaultModel.trim() || undefined,
          timeout_seconds: timeoutSeconds
        })
        showFeedback('success', `Provider "${name.trim()}" registered successfully.`)
      }
      await fetchProviders()
      setShowModal(false)
    } catch (err: any) {
      showFeedback('error', `Failed to save provider: ${err.message || err}`)
    }
  }

  const handleDelete = async (p: Provider) => {
    if (p.id === 'mock') {
      showFeedback('error', 'The built-in offline mock provider cannot be deleted.')
      return
    }
    if (confirm(`Are you sure you want to delete the provider endpoint "${p.name}"? Any stored credentials in the secure vault will be deleted.`)) {
      try {
        await deleteProvider(p.id)
        if (activeProviderId === p.id) {
          setActiveProviderId('mock')
        }
        await fetchProviders()
        showFeedback('success', `Provider "${p.name}" deleted.`)
      } catch (err: any) {
        showFeedback('error', `Delete failed: ${err.message || err}`)
      }
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const res = await testProvider(id)
      setTestResults(prev => ({ ...prev, [id]: res }))
      await fetchProviders()
      if (res.success) {
        showFeedback('success', `${res.message}`)
      } else {
        showFeedback('error', `${res.message}`)
      }
    } catch (err: any) {
      const fallbackResult: ConnectionTestResult = {
        success: false,
        code: 'UNKNOWN_ERROR',
        message: err.message || String(err),
        models: [],
        latency_ms: 0
      }
      setTestResults(prev => ({ ...prev, [id]: fallbackResult }))
      showFeedback('error', `Connection error: ${err.message || err}`)
    } finally {
      setTestingId(null)
    }
  }

  const handleDiagnose = async (id: string) => {
    setDiagnosingId(id)
    try {
      const report = await diagnoseProvider(id)
      setDiagnosticReport(report)
      setShowDiagnosticModal(true)
      await fetchProviders()
      if (report.is_operational) {
        showFeedback('success', report.diagnostic_summary)
      } else {
        showFeedback('error', report.diagnostic_summary)
      }
    } catch (err: any) {
      showFeedback('error', `Diagnostic failed: ${err.message || err}`)
    } finally {
      setDiagnosingId(null)
    }
  }

  const handleAddCustomModel = (providerId: string) => {
    const modelTag = (customModelInput[providerId] || '').trim()
    if (!modelTag) return
    setActiveProviderId(providerId)
    setActiveModel(modelTag)
    setCustomModelInput(prev => ({ ...prev, [providerId]: '' }))
    showFeedback('success', `Active model set to "${modelTag}".`)
  }

  // Active definition for modal
  const activeDef = definitions.find(d => d.id === selectedDefId)

  // Categorize definitions for quick adding
  const cloudDefs = definitions.filter(d => ['openai', 'anthropic', 'gemini', 'deepseek', 'groq', 'openrouter', 'xai', 'together', 'fireworks', 'siliconflow'].includes(d.id))
  const localDefs = definitions.filter(d => ['ollama', 'lmstudio', 'vllm', 'sglang'].includes(d.id))
  const otherDefs = definitions.filter(d => ['custom_http', 'mock'].includes(d.id))

  const renderDiagnosticBadge = (result?: ConnectionTestResult) => {
    if (!result) {
      return (
        <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
          <Clock className="h-3 w-3" /> Untested (click 'Test Connection')
        </span>
      )
    }

    if (result.success) {
      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-emerald-400 flex items-center gap-1 text-[11px]">
            <CheckCircle className="h-3 w-3" /> Connected ({result.latency_ms} ms)
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {result.models.length} model(s) discovered
          </span>
        </div>
      )
    }

    const codeLabelMap: Record<string, { label: string; desc: string }> = {
      AUTHENTICATION_FAILED: { label: 'Auth Failed (401/403)', desc: 'Check your API key.' },
      CONNECTION_REFUSED: { label: 'Connection Refused', desc: 'Is local server running?' },
      DNS_FAILURE: { label: 'DNS Failure', desc: 'Cannot resolve hostname.' },
      TIMEOUT: { label: 'Request Timeout', desc: 'Endpoint timed out.' },
      RATE_LIMITED: { label: 'Rate Limited (429)', desc: 'Exceeded rate quota.' },
      QUOTA_EXCEEDED: { label: 'Quota Exceeded', desc: 'Account credit exhausted.' },
      MODEL_NOT_FOUND: { label: 'Model Not Found (404)', desc: 'Check model ID.' },
      UNSUPPORTED_ENDPOINT: { label: 'Endpoint Unsupported', desc: 'Endpoint URL path rejected.' },
      INVALID_URL: { label: 'Invalid URL', desc: 'Malformed protocol or host.' },
      INVALID_RESPONSE: { label: 'Invalid Response', desc: 'Unparseable JSON response.' },
      TLS_ERROR: { label: 'TLS / SSL Error', desc: 'Certificate verification failed.' },
      UNKNOWN_ERROR: { label: 'Connection Error', desc: 'Network communication failed.' }
    }

    const info = codeLabelMap[result.code] || { label: result.code, desc: result.message }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-rose-400 flex items-center gap-1 text-[11px]">
            <AlertCircle className="h-3 w-3" /> {info.label}
          </span>
          {result.latency_ms > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground">({result.latency_ms} ms)</span>
          )}
        </div>
        <p className="text-[10px] text-rose-300/80 leading-tight truncate" title={result.message}>
          {result.message}
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" /> Model Provider Registry & Vault
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage local runtimes (Ollama, vLLM, LM Studio) and cloud APIs with secure OS Keyring / encrypted vault credential isolation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowDiagModal(true); loadDiagnostics(); }}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              vaultDiag?.secret_service_unlocked
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title="Inspect Freedesktop Secret Service / KDE Wallet status"
          >
            {vaultDiag?.secret_service_unlocked ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            )}
            <span>{vaultDiag?.secret_service_unlocked ? 'KDE Wallet: Active' : 'Vault Diagnostics'}</span>
          </button>

          <button
            onClick={() => openAddModal()}
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" /> Add Provider Endpoint
          </button>
        </div>
      </div>

      {/* KDE Plasma / Secret Service Actionable Guidance Banner */}
      {vaultDiag && (!vaultDiag.secret_service_available || !vaultDiag.secret_service_unlocked) && (
        <div className="p-3.5 rounded-lg text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-200">KDE Secret Service / KWallet Notice</div>
              <div className="text-[11px] text-amber-300/80 mt-0.5">
                {vaultDiag.actionable_guidance || vaultDiag.error_details || 'Secret Service is currently locked or inactive.'}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setShowDiagModal(true); loadDiagnostics(); }}
            className="px-2.5 py-1 text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded font-medium border border-amber-500/40 shrink-0"
          >
            Inspect Details
          </button>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border shadow-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-destructive/10 text-destructive border-destructive/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {providers.map(p => {
          const isActive = p.id === activeProviderId
          const testStatus = testResults[p.id]
          const isTesting = testingId === p.id

          return (
            <div
              key={p.id}
              className={`p-5 rounded-xl bg-card border flex flex-col justify-between transition-all ${
                isActive ? 'border-primary ring-1 ring-primary/40 shadow-md' : 'border-border hover:border-border/80'
              }`}
            >
              <div className="space-y-4">
                {/* Provider Title & Type */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 uppercase">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground block truncate mt-0.5" title={p.base_url}>
                      {p.base_url}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary border border-border text-muted-foreground uppercase">
                      {p.provider_type}
                    </span>
                    {p.id !== 'mock' && (
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit Provider"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {p.id !== 'mock' && (
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete Provider"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Connection Status & Details */}
                <div className="p-3 rounded-lg bg-secondary/40 border border-border/70 space-y-2.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold mb-1">Health & Diagnostic Status</span>
                    {renderDiagnosticBadge(testStatus)}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>Default Model:</span>
                    <span className="font-mono text-foreground font-medium truncate max-w-[220px]">
                      {p.default_model || (p.models_cache && p.models_cache[0]) || 'default'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Credential Vault:</span>
                    {p.has_api_key ? (
                      <span className="font-medium text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Stored in Vault {p.masked_hint && <span className="font-mono text-[10px] text-muted-foreground">({p.masked_hint})</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Key className="h-3 w-3 opacity-50" />
                        No API Key (Local / Public)
                      </span>
                    )}
                  </div>
                </div>

                {/* Available / Cached Models */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>Discovered Models ({p.models_cache?.length || 0}):</span>
                    {isActive && (
                      <span className="text-primary font-mono text-[10px]">Active: {activeModel}</span>
                    )}
                  </div>

                  {p.models_cache && p.models_cache.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-md bg-secondary/20 border border-border/40">
                      {p.models_cache.map(m => (
                        <button
                          key={m}
                          onClick={() => {
                            setActiveProviderId(p.id)
                            setActiveModel(m)
                            showFeedback('success', `Active model set to "${m}".`)
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                            isActive && activeModel === m
                              ? 'bg-primary text-primary-foreground border-primary font-bold shadow-sm'
                              : 'bg-secondary hover:bg-accent border-border text-foreground'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic p-2 rounded bg-secondary/20 border border-border/30">
                      No models cached. Click "Test Connection" to discover models.
                    </div>
                  )}

                  {/* Manual Model Override Input */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Use custom model tag..."
                      value={customModelInput[p.id] || ''}
                      onChange={e => setCustomModelInput({ ...customModelInput, [p.id]: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomModel(p.id)
                        }
                      }}
                      className="flex-1 px-2.5 py-1 rounded text-[11px] bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                    <button
                      onClick={() => handleAddCustomModel(p.id)}
                      disabled={!(customModelInput[p.id] || '').trim()}
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-secondary hover:bg-accent border border-border disabled:opacity-40"
                    >
                      Select
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs">
                {!isActive ? (
                  <button
                    onClick={() => {
                      setActiveProviderId(p.id)
                      showFeedback('success', `Active provider switched to "${p.name}".`)
                    }}
                    className="text-primary hover:underline font-semibold"
                  >
                    Set as Active Provider
                  </button>
                ) : (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Currently Active
                  </span>
                )}

                <button
                  onClick={() => handleTest(p.id)}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent border border-border text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin text-primary' : ''}`} />
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>

                <button
                  onClick={() => handleDiagnose(p.id)}
                  disabled={diagnosingId === p.id}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                  title="Run 4-tier operational verification: Connection, Auth, Generation, and Streaming"
                >
                  <Activity className={`h-3.5 w-3.5 ${diagnosingId === p.id ? 'animate-spin' : ''}`} />
                  {diagnosingId === p.id ? 'Diagnosing...' : 'Run Diagnostics'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add / Edit Provider Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h3 className="text-base font-bold text-foreground">
                {editingProvider ? `Configure: ${editingProvider.name}` : 'Add New Model Provider'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Preset Selector for New Providers */}
              {!editingProvider && (
                <div className="space-y-2">
                  <label className="font-semibold text-foreground block">Select Provider Template</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {definitions.map(def => {
                      const isSelected = selectedDefId === def.id
                      return (
                        <button
                          key={def.id}
                          type="button"
                          onClick={() => handleSelectDefinition(def.id)}
                          className={`p-2 text-left rounded-lg border transition-all text-xs ${
                            isSelected
                              ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-xs'
                              : 'bg-secondary/40 border-border hover:bg-secondary text-muted-foreground'
                          }`}
                        >
                          <div className="font-medium truncate">{def.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate uppercase">{def.provider_type}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Provider Capabilities Pill Bar */}
              {activeDef && (
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground">Declared Capabilities:</span>
                    {activeDef.documentation_url && (
                      <a
                        href={activeDef.documentation_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 text-[10px]"
                      >
                        Docs <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeDef.capabilities.streaming && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-primary/15 text-primary border border-primary/25">
                        Streaming
                      </span>
                    )}
                    {activeDef.capabilities.vision && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/25">
                        Vision
                      </span>
                    )}
                    {activeDef.capabilities.tool_use && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-purple-500/15 text-purple-400 border border-purple-500/25">
                        Tool Use
                      </span>
                    )}
                    {activeDef.capabilities.reasoning && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        Reasoning
                      </span>
                    )}
                    {activeDef.capabilities.structured_output && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        Structured Output
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Provider Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Anthropic, Local Ollama"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Base URL Endpoint</label>
                <input
                  type="text"
                  required
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground block">
                  Host and API root URL. Native adapters format individual endpoint paths automatically.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Default Model ID</label>
                  <input
                    type="text"
                    placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                    value={defaultModel}
                    onChange={e => setDefaultModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
                  />
                  {activeDef?.curated_models && activeDef.curated_models.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {activeDef.curated_models.slice(0, 4).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDefaultModel(m)}
                          className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-secondary hover:bg-accent border border-border text-muted-foreground"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Timeout (Seconds)</label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    value={timeoutSeconds}
                    onChange={e => setTimeoutSeconds(parseInt(e.target.value) || 60)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
                  />
                </div>
              </div>

              {/* Secure Credential Vault Input */}
              <div className="space-y-2 pt-2 border-t border-border/80">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" /> API Key / Credential Vault
                  </label>
                  {editingProvider?.has_api_key && (
                    <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Key Stored {editingProvider.masked_hint && `(${editingProvider.masked_hint})`}
                    </span>
                  )}
                </div>

                {editingProvider?.has_api_key && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 space-y-2">
                    <p>
                      Your API credential is securely stored in your local encrypted vault / OS Keyring. Leaving the field below empty keeps your existing key intact.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWillClearKey(!willClearKey)}
                        className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition-all ${
                          willClearKey
                            ? 'bg-destructive/20 border-destructive text-destructive font-bold'
                            : 'bg-secondary hover:bg-accent border-border text-foreground'
                        }`}
                      >
                        {willClearKey ? '✓ Key will be erased on save' : 'Remove Stored Key'}
                      </button>
                      {willClearKey && (
                        <span className="text-[10px] text-destructive">
                          Key will be permanently purged from the secure credential vault upon saving.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {!willClearKey && (
                  <input
                    type="password"
                    placeholder={
                      editingProvider?.has_api_key
                        ? 'Enter new API key to replace existing secret...'
                        : 'Optional for local Ollama / vLLM; required for cloud APIs'
                    }
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
                  />
                )}
                <span className="text-[10px] text-muted-foreground block">
                  Mechon AI never stores plaintext keys in database tables or logs. Keys are stored in the host OS Secret Service / Keyring with stream-encrypted file backup.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/80">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-secondary font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-sm transition-colors"
                >
                  {editingProvider ? 'Save Changes' : 'Create Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Vault Diagnostics Modal */}
      {showDiagModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-sm">Credential Vault Diagnostics</h3>
              </div>
              <button
                onClick={() => setShowDiagModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-secondary/40 p-3.5 rounded-lg space-y-2 border border-border/50">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Active Storage Backend:</span>
                  <span className="font-mono font-medium text-foreground">{vaultDiag?.active_backend || 'Loading...'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">D-Bus Session Bus:</span>
                  <span className={`font-mono text-[11px] ${vaultDiag?.dbus_available ? 'text-emerald-400' : 'text-destructive'}`}>
                    {vaultDiag?.dbus_available ? (vaultDiag.dbus_address || 'Available') : 'Not Found'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Secret Service Daemon:</span>
                  <span className={`font-semibold ${vaultDiag?.secret_service_available ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {vaultDiag?.secret_service_available ? 'Registered on D-Bus (Active)' : 'Not Registered'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Secret Service Unlocked:</span>
                  <span className={`font-semibold ${vaultDiag?.secret_service_unlocked ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {vaultDiag?.secret_service_unlocked ? 'Yes (Ready)' : 'No / Locked'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">secret-tool Utility:</span>
                  <span className={`font-semibold ${vaultDiag?.secret_tool_installed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {vaultDiag?.secret_tool_installed ? 'Installed (/usr/bin/secret-tool)' : 'Missing'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider mb-2">Live Store Verification Probe</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/60 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">Write Probe</div>
                    <span className={`font-bold font-mono text-[11px] ${vaultDiag?.write_test.startsWith('PASS') ? 'text-emerald-400' : 'text-destructive'}`}>
                      {vaultDiag?.write_test || '...'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/60 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">Read-Back Probe</div>
                    <span className={`font-bold font-mono text-[11px] ${vaultDiag?.read_back_test.startsWith('PASS') ? 'text-emerald-400' : 'text-destructive'}`}>
                      {vaultDiag?.read_back_test || '...'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/60 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">Delete Probe</div>
                    <span className={`font-bold font-mono text-[11px] ${vaultDiag?.delete_test.startsWith('PASS') ? 'text-emerald-400' : 'text-destructive'}`}>
                      {vaultDiag?.delete_test || '...'}
                    </span>
                  </div>
                </div>
              </div>

              {vaultDiag?.actionable_guidance && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200">
                  <div className="font-bold text-[11px] mb-1">Actionable Guidance:</div>
                  <div className="text-[11px] leading-relaxed opacity-90">{vaultDiag.actionable_guidance}</div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={loadDiagnostics}
                disabled={diagLoading}
                className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${diagLoading ? 'animate-spin' : ''}`} />
                {diagLoading ? 'Testing...' : 'Re-run Tests'}
              </button>

              <button
                type="button"
                onClick={() => setShowDiagModal(false)}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4-Tier Provider Diagnostic Report Modal */}
      {showDiagnosticModal && diagnosticReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Provider Diagnostic Report: {diagnosticReport.provider_name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {diagnosticReport.provider_type} • {diagnosticReport.base_url}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Overall Operational Banner */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
              diagnosticReport.is_operational
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              <div className="flex items-center gap-2.5">
                {diagnosticReport.is_operational ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <div className="font-bold text-xs uppercase tracking-wide">
                    {diagnosticReport.is_operational ? 'OPERATIONAL (100% VERIFIED)' : 'VERIFICATION FAILED'}
                  </div>
                  <div className="text-[11px] opacity-90">{diagnosticReport.diagnostic_summary}</div>
                </div>
              </div>
              <div className="text-right font-mono text-[11px]">
                <div>{diagnosticReport.total_latency_ms} ms</div>
                <div className="text-[10px] opacity-60">Total Latency</div>
              </div>
            </div>

            {/* Detailed Checks Grid */}
            <div className="space-y-3">
              {/* 1. Connection & Network */}
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-primary" /> 1. Network & Endpoint Connection
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    diagnosticReport.connection_status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {diagnosticReport.connection_status}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between font-mono">
                  <span>Latency: {diagnosticReport.connection_latency_ms ?? 0} ms</span>
                  {diagnosticReport.connection_http_status && (
                    <span>HTTP Status: {diagnosticReport.connection_http_status}</span>
                  )}
                </div>
                {diagnosticReport.connection_error && (
                  <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 font-mono">
                    {diagnosticReport.connection_error}
                  </div>
                )}
              </div>

              {/* 2. Authentication Check */}
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" /> 2. Credential & Authentication
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    diagnosticReport.auth_status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {diagnosticReport.auth_status}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {diagnosticReport.auth_details}
                </div>
              </div>

              {/* 3. Model Discovery Check */}
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-primary" /> 3. Model Discovery ({diagnosticReport.models_discovered.length} found)
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    diagnosticReport.model_discovery_status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {diagnosticReport.model_discovery_status}
                  </span>
                </div>
                {diagnosticReport.models_discovered.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-1">
                    {diagnosticReport.models_discovered.map(m => (
                      <span key={m} className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">No dynamic models discovered (using curated static list).</div>
                )}
                {diagnosticReport.discovery_error && (
                  <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 font-mono">
                    {diagnosticReport.discovery_error}
                  </div>
                )}
              </div>

              {/* 4. Non-Streaming Generation */}
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-primary" /> 4. Non-Streaming Chat Generation (Model: {diagnosticReport.model_used})
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    diagnosticReport.generation_status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {diagnosticReport.generation_status}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between font-mono">
                  <span>Latency: {diagnosticReport.generation_latency_ms ?? 0} ms</span>
                  {diagnosticReport.generation_sample_output && (
                    <span className="text-foreground">Output: "{diagnosticReport.generation_sample_output}"</span>
                  )}
                </div>
                {diagnosticReport.generation_error && (
                  <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 font-mono">
                    {diagnosticReport.generation_error}
                  </div>
                )}
              </div>

              {/* 5. Streaming Generation */}
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-primary" /> 5. Streaming Token SSE Protocol
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    diagnosticReport.streaming_status === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {diagnosticReport.streaming_status}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between font-mono">
                  <span>Chunks Received: {diagnosticReport.streaming_chunk_count}</span>
                  <span>Latency: {diagnosticReport.streaming_latency_ms ?? 0} ms</span>
                </div>
                {diagnosticReport.streaming_sample_output && (
                  <div className="text-[10px] text-muted-foreground font-mono bg-background p-1.5 rounded border border-border">
                    Sample: {diagnosticReport.streaming_sample_output}
                  </div>
                )}
                {diagnosticReport.streaming_error && (
                  <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 font-mono">
                    {diagnosticReport.streaming_error}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
