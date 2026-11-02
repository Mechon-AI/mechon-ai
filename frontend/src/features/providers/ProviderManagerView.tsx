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
  ShieldAlert,
  Server,
  Key,
  Clock,
  Sparkles,
  Check,
  X
} from 'lucide-react'
import { useProviderStore } from '../../stores/useProviderStore'
import {
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider
} from '../../services/api'
import type { Provider } from '../../types'

export const ProviderManagerView: React.FC = () => {
  const {
    providers,
    activeProviderId,
    activeModel,
    setActiveProviderId,
    setActiveModel,
    fetchProviders
  } = useProviderStore()

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('openai_compatible')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434/v1')
  const [apiKey, setApiKey] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [timeoutSeconds, setTimeoutSeconds] = useState(60)

  // Feedback states
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { healthy: boolean; models: string[]; message?: string }>>({})
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [customModelInput, setCustomModelInput] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchProviders()
  }, [])

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const openAddModal = () => {
    setEditingProvider(null)
    setName('')
    setProviderType('ollama')
    setBaseUrl('http://127.0.0.1:11434')
    setApiKey('')
    setDefaultModel('llama3:latest')
    setTimeoutSeconds(60)
    setShowModal(true)
  }

  const openEditModal = (p: Provider) => {
    setEditingProvider(p)
    setName(p.name)
    setProviderType(p.provider_type)
    setBaseUrl(p.base_url)
    setApiKey('')
    setDefaultModel(p.default_model || '')
    setTimeoutSeconds(p.timeout_seconds || 60)
    setShowModal(true)
  }

  const handleProtocolChange = (type: string) => {
    setProviderType(type)
    if (type === 'ollama') {
      setBaseUrl('http://127.0.0.1:11434')
      if (!defaultModel || defaultModel === 'default') setDefaultModel('llama3:latest')
    } else if (type === 'openai_compatible') {
      setBaseUrl('http://127.0.0.1:8000/v1')
      if (!defaultModel) setDefaultModel('')
    } else if (type === 'custom_http') {
      setBaseUrl('http://127.0.0.1:8080/v1')
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
          api_key: apiKey.trim() || undefined,
          default_model: defaultModel.trim() || undefined,
          timeout_seconds: timeoutSeconds
        })
        showFeedback('success', `Provider "${name.trim()}" updated successfully.`)
      } else {
        await createProvider({
          name: name.trim(),
          provider_type: providerType,
          base_url: baseUrl.trim(),
          api_key: apiKey.trim() || undefined,
          default_model: defaultModel.trim() || undefined,
          timeout_seconds: timeoutSeconds
        })
        showFeedback('success', `Provider "${name.trim()}" created successfully.`)
      }
      await fetchProviders()
      setShowModal(false)
    } catch (err: any) {
      showFeedback('error', `Failed to save provider: ${err.message}`)
    }
  }

  const handleDelete = async (p: Provider) => {
    if (p.id === 'mock') {
      showFeedback('error', 'The built-in Mock provider cannot be deleted.')
      return
    }
    if (confirm(`Are you sure you want to delete the provider endpoint "${p.name}"?`)) {
      try {
        await deleteProvider(p.id)
        if (activeProviderId === p.id) {
          setActiveProviderId('mock')
        }
        await fetchProviders()
        showFeedback('success', `Provider "${p.name}" deleted.`)
      } catch (err: any) {
        showFeedback('error', `Delete failed: ${err.message}`)
      }
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const res = await testProvider(id)
      setTestResults(prev => ({ ...prev, [id]: res }))
      await fetchProviders()
      if (res.healthy) {
        showFeedback('success', `Connection to provider succeeded! Discovered ${res.models.length} model(s).`)
      } else {
        showFeedback('error', `Connection test failed. Server is unreachable or returned error.`)
      }
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [id]: { healthy: false, models: [], message: err.message }
      }))
      showFeedback('error', `Connection error: ${err.message}`)
    } finally {
      setTestingId(null)
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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" /> Model Provider Manager
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure local endpoints (Ollama, vLLM, LM Studio, SGLang) or remote OpenAI-compatible servers.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" /> Add Provider
        </button>
      </div>

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
                    <span className="text-[11px] font-mono text-muted-foreground block truncate mt-0.5">
                      {p.base_url}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary border border-border text-muted-foreground">
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
                <div className="p-3 rounded-lg bg-secondary/40 border border-border/70 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Endpoint Health:</span>
                    {testStatus ? (
                      <span className={`font-semibold flex items-center gap-1 ${testStatus.healthy ? 'text-emerald-400' : 'text-destructive'}`}>
                        {testStatus.healthy ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {testStatus.healthy ? 'Connected & Verified' : 'Connection Failed'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Untested (click 'Test Connection')</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Default Model:</span>
                    <span className="font-mono text-foreground font-medium truncate max-w-[200px]">
                      {p.default_model || (p.models_cache && p.models_cache[0]) || 'default'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Authentication:</span>
                    <span>{p.has_api_key ? 'API Key Configured' : 'None (Local / Public)'}</span>
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
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 rounded-md bg-secondary/20 border border-border/40">
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
                      No models cached. Click "Test Connection" to query available models from endpoint.
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
              </div>
            </div>
          )
        })}
      </div>

      {/* Add / Edit Provider Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h3 className="text-base font-bold text-foreground">
                {editingProvider ? 'Edit Model Provider' : 'Add Model Provider'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Provider Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Local Ollama, vLLM Server, LM Studio"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {!editingProvider && (
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Protocol Architecture</label>
                  <select
                    value={providerType}
                    onChange={e => handleProtocolChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ollama">Native Ollama API (e.g. http://127.0.0.1:11434)</option>
                    <option value="openai_compatible">OpenAI-Compatible (vLLM, LM Studio, SGLang, OpenAI)</option>
                    <option value="custom_http">Custom HTTP Inference Server</option>
                  </select>
                </div>
              )}

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
                  Loopback or intranet URL. For OpenAI compatible: append /v1.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Default Model Name</label>
                  <input
                    type="text"
                    placeholder="e.g. llama3:latest, gpt-4o"
                    value={defaultModel}
                    onChange={e => setDefaultModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
                  />
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

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  API Key {editingProvider?.has_api_key && '(Leave empty to keep existing key)'}
                </label>
                <input
                  type="password"
                  placeholder={editingProvider?.has_api_key ? '••••••••••••••••' : 'Optional for local endpoints'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
                />
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
    </div>
  )
}
