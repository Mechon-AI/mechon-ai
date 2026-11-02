import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Provider } from '../types'
import { getProviders, testProvider } from '../services/api'

interface ProviderState {
  providers: Provider[]
  activeProviderId: string
  activeModel: string
  isLoading: boolean
  isOnline: boolean
  fetchProviders: () => Promise<void>
  setActiveProviderId: (id: string) => void
  setActiveModel: (model: string) => void
  checkStatus: () => Promise<void>
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      providers: [],
      activeProviderId: 'mock',
      activeModel: 'mock-llama-3-8b',
      isLoading: false,
      isOnline: true,

      fetchProviders: async () => {
        set({ isLoading: true })
        try {
          const list = await getProviders()
          set({ providers: list, isLoading: false })
          
          const currentProviderId = get().activeProviderId
          const found = list.find(p => p.id === currentProviderId)
          if (!found && list.length > 0) {
            // Default to mock or first
            const defaultP = list.find(p => p.id === 'mock') || list[0]
            set({
              activeProviderId: defaultP.id,
              activeModel: defaultP.default_model || (defaultP.models_cache && defaultP.models_cache[0]) || 'default'
            })
          } else if (found && found.models_cache && found.models_cache.length > 0) {
            if (!found.models_cache.includes(get().activeModel)) {
              set({ activeModel: found.models_cache[0] })
            }
          }
        } catch {
          set({ isLoading: false })
        }
      },

      setActiveProviderId: (id: string) => {
        const found = get().providers.find(p => p.id === id)
        const newModel = (found?.models_cache && found.models_cache[0]) || found?.default_model || 'default'
        set({ activeProviderId: id, activeModel: newModel })
      },

      setActiveModel: (model: string) => {
        set({ activeModel: model })
      },

      checkStatus: async () => {
        const pId = get().activeProviderId
        try {
          const res = await testProvider(pId)
          set({ isOnline: res.healthy })
        } catch {
          set({ isOnline: false })
        }
      }
    }),
    {
      name: 'mechon-provider-storage'
    }
  )
)
