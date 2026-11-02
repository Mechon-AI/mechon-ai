import React, { useState, useEffect } from 'react'
import {
  Cpu,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  Server
} from 'lucide-react'
import { useProviderStore } from '../../stores/useProviderStore'
import {
  getProviders,
  createProvider,
  deleteProvider,
  testProvider
} from '../../services/api'
import type { Provider } from '../../types'

export const ProviderManagerView: React.FC = () => {
  const { providers, activeProviderId, activeModel, setActiveProviderId, setActiveModel, fetchProviders } = useProviderStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState('openai_compatible')
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:11434/v1')
  const [apiKey, setApiKey] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { healthy: boolean; models: string[] }>>({})

  useEffect(() => {
    fetchProviders()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !baseUrl.trim()) return
    await createProvider({
      name: name.trim(),
      provider_type: providerType,
      base_url: baseUrl.trim(),
      api_key: apiKey.trim() || undefined,
      default_model: defaultModel.trim() || undefined
    })
    await fetchProviders()
    setShowAddModal(false)
    setName('')
    setApiKey('')
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this provider endpoint?')) {
      await deleteProvider(id)
      await fetchProviders()
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const res = await testProvider(id)
      setTestResults(prev => ({ ...prev, [id]: res }))
      await fetchProviders()
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { healthy: false, models: [] } }))
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" /> Model Provider Manager
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure local endpoints (Ollama, vLLM, LM Studio) or OpenAI-compatible inference servers.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> Add Provider
        </button>
      </div>

      {/* Providers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map(p => {
          const isActive = p.id === activeProviderId
          const testStatus = testResults[p.id]

          return (
            <div
              key={p.id}
              className={`p-5 rounded-xl bg-card border flex flex-col justify-between transition-all ${
                isActive ? 'border-primary ring-1 ring-primary/40 shadow-md' : 'border-border'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{p.name}</h3>
                      {isActive && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 uppercase">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                      {p.base_url}
                    </span>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary border border-border">
                    {p.provider_type}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>Cached Models ({p.models_cache?.length || 0}):</span>
                    {testStatus && (
                      <span className={testStatus.healthy ? 'text-emerald-400 font-bold' : 'text-destructive font-bold'}>
                        {testStatus.healthy ? 'Connected' : 'Connection Failed'}
                      </span>
                    )}
                  </div>
                  {p.models_cache && p.models_cache.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pt-1">
                      {p.models_cache.map(m => (
                        <button
                          key={m}
                          onClick={() => {
                            setActiveProviderId(p.id)
                            setActiveModel(m)
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                            isActive && activeModel === m
                              ? 'bg-primary text-primary-foreground border-primary font-bold'
                              : 'bg-secondary/60 hover:bg-secondary border-border text-muted-foreground'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground italic">
                      Click 'Test & Refresh' to query available models.
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs">
                {!isActive ? (
                  <button
                    onClick={() => setActiveProviderId(p.id)}
                    className="text-primary hover:underline font-medium"
                  >
                    Set as Active Provider
                  </button>
                ) : (
                  <span className="text-emerald-400 font-medium">Currently Selected</span>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleTest(p.id)}
                    disabled={testingId === p.id}
                    className="px-2.5 py-1 rounded bg-secondary hover:bg-accent border border-border text-[11px] flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    title="Test endpoint and discover models"
                  >
                    <RefreshCw className={`h-3 w-3 ${testingId === p.id ? 'animate-spin' : ''}`} /> Test & Refresh
                  </button>

                  {p.id !== 'mock' && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Delete Provider"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Provider Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4 text-xs">
            <h3 className="text-base font-bold">Add Model Provider</h3>

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1">
                <label className="font-medium text-muted-foreground">Provider Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Local Ollama or vLLM Server"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-muted-foreground">Provider Protocol</label>
                <select
                  value={providerType}
                  onChange={e => {
                    setProviderType(e.target.value)
                    if (e.target.value === 'ollama') {
                      setBaseUrl('http://127.0.0.1:11434')
                    } else if (e.target.value === 'openai_compatible') {
                      setBaseUrl('http://127.0.0.1:8000/v1')
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="openai_compatible">OpenAI-Compatible (vLLM / LM Studio / OpenAI)</option>
                  <option value="ollama">Native Ollama API</option>
                  <option value="custom_http">Custom HTTP Endpoint</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-muted-foreground">Base URL</label>
                <input
                  type="text"
                  required
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-muted-foreground">API Key (Optional for local servers)</label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-sm"
                >
                  Save Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
