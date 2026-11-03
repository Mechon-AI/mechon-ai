import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Cpu,
  ChevronDown,
  Check,
  Search,
  RefreshCw,
  Circle,
  Sparkles,
  Languages,
  Bot,
  Scale,
  Zap
} from 'lucide-react'
import { useProviderStore } from '../../stores/useProviderStore'
import { useSubsystemConfigStore, SubsystemId } from '../stores/useSubsystemConfigStore'
import { testProvider } from '../../services/api'
import { useConsoleStore } from '../stores/useConsoleStore'

interface ProviderModelSelectorProps {
  className?: string
  compact?: boolean
  forcedSubsystem?: SubsystemId
  onModelChange?: (providerId: string, model: string) => void
}

const SUBSYSTEM_META: Record<SubsystemId, { label: string; shortLabel: string; icon: React.ElementType; color: string }> = {
  main_inference: {
    label: 'Main Inference',
    shortLabel: 'Inference',
    icon: Zap,
    color: 'text-amber-400'
  },
  planning: {
    label: 'Planning Agent',
    shortLabel: 'Planning',
    icon: Bot,
    color: 'text-purple-400'
  },
  translation: {
    label: 'Translation Agent',
    shortLabel: 'Translation',
    icon: Languages,
    color: 'text-sky-400'
  },
  evaluation: {
    label: 'Evaluation Agent',
    shortLabel: 'Evaluation',
    icon: Scale,
    color: 'text-emerald-400'
  }
}

export const ProviderModelSelector: React.FC<ProviderModelSelectorProps> = ({
  className = '',
  compact = false,
  forcedSubsystem,
  onModelChange
}) => {
  const {
    providers,
    activeProviderId,
    activeModel,
    setActiveProviderId,
    setActiveModel,
    fetchProviders,
    isOnline,
    checkStatus
  } = useProviderStore()

  const {
    configs,
    activeConfigSubsystem,
    setActiveConfigSubsystem,
    setSubsystemModel,
    syncWithProviders
  } = useSubsystemConfigStore()

  const { addLog } = useConsoleStore()

  const [subsystemDropdownOpen, setSubsystemDropdownOpen] = useState(false)
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Sync providers with subsystem store on mount and provider changes
  useEffect(() => {
    if (providers.length > 0) {
      syncWithProviders(providers)
    }
  }, [providers])

  const currentSubsystemId: SubsystemId = forcedSubsystem || activeConfigSubsystem
  const currentSubsystemConfig = configs[currentSubsystemId]
  const currentSubsystemMeta = SUBSYSTEM_META[currentSubsystemId]

  // Resolve active provider for the current subsystem
  const activeSubsystemProvider = useMemo(() => {
    if (!providers || providers.length === 0) return null
    const targetId = currentSubsystemConfig?.provider_id || activeProviderId
    return providers.find((p) => p.id === targetId) || providers[0]
  }, [providers, currentSubsystemConfig?.provider_id, activeProviderId])

  // Resolve available models for the active subsystem provider
  const availableModels = useMemo(() => {
    if (!activeSubsystemProvider) return []
    const cache = activeSubsystemProvider.models_cache || []
    if (cache.length > 0) return cache
    if (activeSubsystemProvider.default_model) return [activeSubsystemProvider.default_model]
    return [currentSubsystemConfig?.model_id || activeModel || 'default']
  }, [activeSubsystemProvider, currentSubsystemConfig?.model_id, activeModel])

  const activeSubsystemModel = useMemo(() => {
    const configured = currentSubsystemConfig?.model_id
    if (configured && availableModels.includes(configured)) return configured
    if (configured) return configured
    return availableModels[0] || 'default'
  }, [currentSubsystemConfig?.model_id, availableModels])

  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return availableModels
    const query = modelSearch.toLowerCase()
    return availableModels.filter((m) => m.toLowerCase().includes(query))
  }, [availableModels, modelSearch])

  // Focus search input when model dropdown opens
  useEffect(() => {
    if (modelDropdownOpen) {
      setModelSearch('')
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [modelDropdownOpen])

  const handleSelectSubsystem = (sub: SubsystemId) => {
    setActiveConfigSubsystem(sub)
    setSubsystemDropdownOpen(false)
    addLog('info', 'inference', `Active model configuration context switched to [${SUBSYSTEM_META[sub].label}]`)
  }

  const handleSelectProvider = (providerId: string) => {
    const selectedP = providers.find((p) => p.id === providerId)
    if (!selectedP) return

    setProviderDropdownOpen(false)

    // Select valid model for new provider
    const models = selectedP.models_cache || []
    const newModel =
      selectedP.default_model && models.includes(selectedP.default_model)
        ? selectedP.default_model
        : models[0] || selectedP.default_model || 'default'

    setSubsystemModel(currentSubsystemId, providerId, newModel)

    if (currentSubsystemId === 'main_inference') {
      setActiveProviderId(providerId)
      setActiveModel(newModel)
    }

    addLog('info', 'inference', `Switched [${currentSubsystemMeta.label}] provider to ${selectedP.name} (${newModel})`)
    if (onModelChange) {
      onModelChange(providerId, newModel)
    }
  }

  const handleSelectModel = (model: string) => {
    if (!activeSubsystemProvider) return
    setSubsystemModel(currentSubsystemId, activeSubsystemProvider.id, model)
    setModelDropdownOpen(false)

    if (currentSubsystemId === 'main_inference') {
      setActiveModel(model)
    }

    addLog('info', 'inference', `Switched [${currentSubsystemMeta.label}] model to ${model} [${activeSubsystemProvider.name}]`)
    if (onModelChange) {
      onModelChange(activeSubsystemProvider.id, model)
    }
  }

  const handleRefreshModels = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!activeSubsystemProvider) return
    setIsRefreshing(true)
    try {
      addLog('info', 'inference', `Refreshing model list for ${activeSubsystemProvider.name}...`)
      await testProvider(activeSubsystemProvider.id)
      await fetchProviders()
      await checkStatus()
      addLog('info', 'inference', `Models updated for ${activeSubsystemProvider.name}`)
    } catch (err: any) {
      addLog('error', 'inference', `Failed to refresh models: ${err.message || err}`)
    } finally {
      setIsRefreshing(false)
    }
  }

  const SubsystemIcon = currentSubsystemMeta.icon

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* 0. Subsystem Context Selector */}
      {!forcedSubsystem && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setSubsystemDropdownOpen(!subsystemDropdownOpen)
              setProviderDropdownOpen(false)
              setModelDropdownOpen(false)
            }}
            className="flex items-center gap-1 h-7 px-2 rounded-lg bg-secondary/90 hover:bg-secondary border border-border text-xs font-semibold transition-all shadow-xs cursor-pointer select-none"
            title={`Configuring: ${currentSubsystemMeta.label}. Click to select another subsystem.`}
          >
            <SubsystemIcon className={`h-3.5 w-3.5 ${currentSubsystemMeta.color} shrink-0`} />
            <span className="text-[11px] font-semibold text-foreground">
              {currentSubsystemMeta.shortLabel}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>

          {subsystemDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setSubsystemDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-border bg-[#11131a] dark:bg-[#11131a] light:bg-white text-popover-foreground p-1 shadow-2xl z-50 text-xs divide-y divide-border/60 animate-in fade-in zoom-in-95 duration-100">
                <div className="py-1">
                  <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    AI Subsystems
                  </div>
                  {(['main_inference', 'planning', 'translation', 'evaluation'] as SubsystemId[]).map((subId) => {
                    const meta = SUBSYSTEM_META[subId]
                    const Icon = meta.icon
                    const isSelected = subId === currentSubsystemId
                    const cfg = configs[subId]
                    const prov = providers.find((p) => p.id === cfg?.provider_id)

                    return (
                      <button
                        key={subId}
                        onClick={() => handleSelectSubsystem(subId)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                            : 'text-foreground hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-start gap-2 truncate">
                          <Icon className={`h-3.5 w-3.5 mt-0.5 ${isSelected ? 'text-primary-foreground' : meta.color} shrink-0`} />
                          <div className="truncate">
                            <span className="block font-medium truncate">{meta.label}</span>
                            <span className="text-[10px] opacity-75 font-mono block truncate">
                              {prov?.name || 'Default'}: {cfg?.model_id || 'default'}
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 1. Interactive Provider Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setProviderDropdownOpen(!providerDropdownOpen)
            setSubsystemDropdownOpen(false)
            setModelDropdownOpen(false)
          }}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs font-medium text-foreground transition-all shadow-xs cursor-pointer select-none"
          title={`Select Provider for ${currentSubsystemMeta.label}`}
        >
          <Cpu className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate max-w-[120px] font-medium">
            {activeSubsystemProvider?.name || 'Select Provider'}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>

        {providerDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setProviderDropdownOpen(false)}
            />
            <div className="absolute left-0 top-full mt-1 w-56 rounded-xl border border-border bg-[#11131a] dark:bg-[#11131a] light:bg-white text-popover-foreground p-1 shadow-2xl z-50 text-xs divide-y divide-border/60 animate-in fade-in zoom-in-95 duration-100">
              <div className="py-1">
                <div className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Configured Providers
                </div>
                {providers.map((p) => {
                  const isSelected = p.id === activeSubsystemProvider?.id
                  const modelCount = p.models_cache ? p.models_cache.length : 0
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProvider(p.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-foreground hover:bg-accent'
                      }`}
                    >
                      <div className="truncate">
                        <span className="block truncate">{p.name}</span>
                        <span className="text-[10px] opacity-70 font-mono">
                          {p.provider_type} {modelCount > 0 ? `• ${modelCount} models` : ''}
                        </span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <span className="text-muted-foreground/40 font-mono select-none">/</span>

      {/* 2. Interactive Searchable Model Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setModelDropdownOpen(!modelDropdownOpen)
            setSubsystemDropdownOpen(false)
            setProviderDropdownOpen(false)
          }}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-xs font-mono text-foreground transition-all shadow-xs cursor-pointer select-none max-w-[200px]"
          title={`Active model for ${currentSubsystemMeta.label}: ${activeSubsystemModel}. Click to switch.`}
        >
          <span className="truncate text-[11px] font-medium font-mono text-foreground">
            {activeSubsystemModel}
          </span>
          <Circle
            className={`h-2 w-2 shrink-0 fill-current ml-0.5 ${
              isOnline ? 'text-emerald-400' : 'text-amber-400'
            }`}
          />
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>

        {modelDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setModelDropdownOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-border bg-[#11131a] dark:bg-[#11131a] light:bg-white text-popover-foreground p-1 shadow-2xl z-50 text-xs divide-y divide-border/60 animate-in fade-in zoom-in-95 duration-100">
              {/* Header with Search and Refresh */}
              <div className="p-1.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono px-1">
                  <span>
                    {activeSubsystemProvider?.name}: {availableModels.length} models
                  </span>
                  <button
                    onClick={handleRefreshModels}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors cursor-pointer"
                    title="Fetch and refresh model list from provider API"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="h-3 w-3 absolute left-2 top-2 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search models..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="w-full pl-6 pr-2 py-1 rounded-md bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono placeholder:font-sans"
                  />
                </div>
              </div>

              {/* Scrollable Model List */}
              <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
                {filteredModels.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground space-y-1">
                    <p className="text-xs">No matching models found.</p>
                    <button
                      onClick={handleRefreshModels}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Refresh models from provider
                    </button>
                  </div>
                ) : (
                  filteredModels.map((model) => {
                    const isSelected = model === activeSubsystemModel
                    return (
                      <button
                        key={model}
                        onClick={() => handleSelectModel(model)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left font-mono text-[11px] transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                            : 'text-foreground hover:bg-accent'
                        }`}
                      >
                        <span className="truncate">{model}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-1.5" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
