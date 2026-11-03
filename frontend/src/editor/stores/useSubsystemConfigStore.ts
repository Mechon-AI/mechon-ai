import { create } from 'zustand'
import type { Provider } from '../../types'

export type SubsystemId = 'main_inference' | 'planning' | 'translation' | 'evaluation'

export interface SubsystemConfigItem {
  id: SubsystemId
  name: string
  label: string
  description: string
  provider_id: string
  model_id: string
}

export interface SubsystemConfigurations {
  main_inference: SubsystemConfigItem
  planning: SubsystemConfigItem
  translation: SubsystemConfigItem
  evaluation: SubsystemConfigItem
}

interface SubsystemConfigState {
  configs: SubsystemConfigurations
  activeConfigSubsystem: SubsystemId
  setActiveConfigSubsystem: (subsystem: SubsystemId) => void
  setSubsystemModel: (subsystem: SubsystemId, providerId: string, modelId: string) => void
  getSubsystemConfig: (subsystem: SubsystemId) => { provider_id: string; model_id: string }
  syncWithProviders: (providers: Provider[]) => void
}

const STORAGE_KEY = 'mechon_ai_subsystem_model_configs_v1'

const DEFAULT_CONFIGS: SubsystemConfigurations = {
  main_inference: {
    id: 'main_inference',
    name: 'Main Inference Engine',
    label: 'Main Inference',
    description: 'Powers chat generation, dataset sample completions, and dialogue simulation.',
    provider_id: '',
    model_id: ''
  },
  planning: {
    id: 'planning',
    name: 'Story Planning Agent',
    label: 'Planning Agent',
    description: 'Drives autonomous Story Architect turns, goal formulating, and character dialogue planning.',
    provider_id: '',
    model_id: ''
  },
  translation: {
    id: 'translation',
    name: 'Multilingual Translation Engine',
    label: 'Translation Agent',
    description: 'Handles cross-lingual turn localization, dialogue alignment, and terminology preservation.',
    provider_id: '',
    model_id: ''
  },
  evaluation: {
    id: 'evaluation',
    name: 'Evaluation & Quality Agent',
    label: 'Evaluation Agent',
    description: 'Computes narrative consistency, safety thresholds, and quality scores.',
    provider_id: '',
    model_id: ''
  }
}

function loadPersistedConfigs(): SubsystemConfigurations {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIGS
    const parsed = JSON.parse(raw)
    return {
      main_inference: { ...DEFAULT_CONFIGS.main_inference, ...(parsed.main_inference || {}) },
      planning: { ...DEFAULT_CONFIGS.planning, ...(parsed.planning || {}) },
      translation: { ...DEFAULT_CONFIGS.translation, ...(parsed.translation || {}) },
      evaluation: { ...DEFAULT_CONFIGS.evaluation, ...(parsed.evaluation || {}) }
    }
  } catch (err) {
    console.warn('Failed to load persisted subsystem configs:', err)
    return DEFAULT_CONFIGS
  }
}

function persistConfigs(configs: SubsystemConfigurations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  } catch (err) {
    console.warn('Failed to persist subsystem configs:', err)
  }
}

export const useSubsystemConfigStore = create<SubsystemConfigState>((set, get) => ({
  configs: loadPersistedConfigs(),
  activeConfigSubsystem: 'main_inference',

  setActiveConfigSubsystem: (subsystem: SubsystemId) => {
    set({ activeConfigSubsystem: subsystem })
  },

  setSubsystemModel: (subsystem: SubsystemId, providerId: string, modelId: string) => {
    const current = get().configs
    const updated = {
      ...current,
      [subsystem]: {
        ...current[subsystem],
        provider_id: providerId,
        model_id: modelId
      }
    }
    set({ configs: updated })
    persistConfigs(updated)
  },

  getSubsystemConfig: (subsystem: SubsystemId) => {
    const item = get().configs[subsystem]
    return {
      provider_id: item?.provider_id || '',
      model_id: item?.model_id || ''
    }
  },

  syncWithProviders: (providers: Provider[]) => {
    if (!providers || providers.length === 0) return
    const current = get().configs
    let changed = false
    const updated = { ...current }

    const activeProviders = providers.filter(p => p.is_active)
    const fallbackProvider = activeProviders[0] || providers[0]

    // Helper to validate and resolve fallback
    const resolveForSubsystem = (sub: SubsystemId, preferredProviderName?: string) => {
      const existing = current[sub]
      const provMatch = providers.find(p => p.id === existing.provider_id)
      
      if (!existing.provider_id || !provMatch) {
        // Try to match preferred provider (e.g. Anthropic for planning, Gemini for translation)
        const preferred = preferredProviderName 
          ? providers.find(p => p.name.toLowerCase().includes(preferredProviderName.toLowerCase()) || p.provider_type.toLowerCase().includes(preferredProviderName.toLowerCase()))
          : null
        const chosen = preferred || fallbackProvider
        const chosenModel = chosen.default_model || (chosen.models_cache && chosen.models_cache[0]) || 'default'

        updated[sub] = {
          ...updated[sub],
          provider_id: chosen.id,
          model_id: chosenModel
        }
        changed = true
      } else if (!existing.model_id) {
        const defaultModel = provMatch.default_model || (provMatch.models_cache && provMatch.models_cache[0]) || 'default'
        updated[sub] = {
          ...updated[sub],
          model_id: defaultModel
        }
        changed = true
      }
    }

    resolveForSubsystem('main_inference')
    resolveForSubsystem('planning', 'anthropic')
    resolveForSubsystem('translation', 'gemini')
    resolveForSubsystem('evaluation')

    if (changed) {
      set({ configs: updated })
      persistConfigs(updated)
    }
  }
}))
