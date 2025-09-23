'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Token, Alert } from '@/types'
import { FilterPreset, DEFAULT_FILTER_PRESETS } from '@/types/filters'

interface TokenStore {
  // Data state
  tokens: Token[]
  alerts: Alert[]
  filteredTokens: Token[]

  // UI state
  selectedToken: Token | null
  isLoading: boolean
  error: string | null

  // Filter state
  activeFilters: FilterPreset[]
  customFilters: FilterPreset[]
  searchQuery: string
  sortField: keyof Token
  sortDirection: 'asc' | 'desc'

  // Theme state
  theme: 'light' | 'dark' | 'system'

  // WebSocket state
  isConnected: boolean
  lastUpdate: Date | null

  // Actions
  setTokens: (tokens: Token[]) => void
  setAlerts: (alerts: Alert[]) => void
  setSelectedToken: (token: Token | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Filter actions
  addFilter: (filter: FilterPreset) => void
  removeFilter: (filterId: string) => void
  updateFilter: (filter: FilterPreset) => void
  toggleFilterActive: (filterId: string) => void
  setSearchQuery: (query: string) => void
  setSorting: (field: keyof Token, direction: 'asc' | 'desc') => void
  applyFilters: () => void
  clearAllFilters: () => void

  // Theme actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void

  // WebSocket actions
  setConnected: (connected: boolean) => void
  updateLastUpdate: () => void

  // Export actions
  exportData: (format: 'csv' | 'json') => void
}

export const useTokenStore = create<TokenStore>()(
  persist(
    (set, get) => ({
      // Initial state
      tokens: [],
      alerts: [],
      filteredTokens: [],
      selectedToken: null,
      isLoading: false,
      error: null,

      activeFilters: [DEFAULT_FILTER_PRESETS[0]], // Safe New Tokens as default
      customFilters: [],
      searchQuery: '',
      sortField: 'volume24h',
      sortDirection: 'desc',

      theme: 'system',

      isConnected: false,
      lastUpdate: null,

      // Data actions
      setTokens: (tokens) => {
        set({ tokens })
        get().applyFilters()
      },

      setAlerts: (alerts) => set({ alerts }),
      setSelectedToken: (token) => set({ selectedToken: token }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Filter actions
      addFilter: (filter) => {
        const { customFilters } = get()
        const existingIndex = customFilters.findIndex(f => f.id === filter.id)

        if (existingIndex >= 0) {
          const updated = [...customFilters]
          updated[existingIndex] = filter
          set({ customFilters: updated })
        } else {
          set({ customFilters: [...customFilters, filter] })
        }

        get().applyFilters()
      },

      removeFilter: (filterId) => {
        const { activeFilters, customFilters } = get()

        set({
          activeFilters: activeFilters.filter(f => f.id !== filterId),
          customFilters: customFilters.filter(f => f.id !== filterId)
        })

        get().applyFilters()
      },

      updateFilter: (filter) => {
        const { activeFilters, customFilters } = get()

        const updateArray = (array: FilterPreset[]) =>
          array.map(f => f.id === filter.id ? filter : f)

        set({
          activeFilters: updateArray(activeFilters),
          customFilters: updateArray(customFilters)
        })

        get().applyFilters()
      },

      toggleFilterActive: (filterId) => {
        const { activeFilters, customFilters } = get()
        const allFilters = [...DEFAULT_FILTER_PRESETS, ...customFilters]
        const filter = allFilters.find(f => f.id === filterId)

        if (!filter) return

        const isActive = activeFilters.some(f => f.id === filterId)

        if (isActive) {
          set({ activeFilters: activeFilters.filter(f => f.id !== filterId) })
        } else {
          set({ activeFilters: [...activeFilters, filter] })
        }

        get().applyFilters()
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query })
        get().applyFilters()
      },

      setSorting: (field, direction) => {
        set({ sortField: field, sortDirection: direction })
        get().applyFilters()
      },

      applyFilters: () => {
        const { tokens, activeFilters, searchQuery, sortField, sortDirection } = get()

        let filtered = [...tokens]

        // Apply search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          filtered = filtered.filter(token =>
            token.symbol.toLowerCase().includes(query) ||
            token.name.toLowerCase().includes(query) ||
            token.contractAddress.toLowerCase().includes(query)
          )
        }

        // Apply active filters
        activeFilters.forEach(filter => {
          filter.conditions.forEach(condition => {
            filtered = filtered.filter(token => {
              const value = token[condition.field]
              const conditionValue = condition.value

              switch (condition.operator) {
                case 'gt':
                  return Number(value) > Number(conditionValue)
                case 'gte':
                  return Number(value) >= Number(conditionValue)
                case 'lt':
                  return Number(value) < Number(conditionValue)
                case 'lte':
                  return Number(value) <= Number(conditionValue)
                case 'eq':
                  return value === conditionValue
                case 'not_eq':
                  return value !== conditionValue
                case 'contains':
                  return String(value).toLowerCase().includes(String(conditionValue).toLowerCase())
                default:
                  return true
              }
            })
          })
        })

        // Apply sorting
        filtered.sort((a, b) => {
          const aValue = a[sortField]
          const bValue = b[sortField]

          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
          }

          const aStr = String(aValue).toLowerCase()
          const bStr = String(bValue).toLowerCase()

          if (sortDirection === 'asc') {
            return aStr.localeCompare(bStr)
          } else {
            return bStr.localeCompare(aStr)
          }
        })

        set({ filteredTokens: filtered })
      },

      clearAllFilters: () => {
        set({
          activeFilters: [],
          searchQuery: '',
          sortField: 'volume24h',
          sortDirection: 'desc'
        })
        get().applyFilters()
      },

      // Theme actions
      setTheme: (theme) => set({ theme }),

      // WebSocket actions
      setConnected: (connected) => set({ isConnected: connected }),
      updateLastUpdate: () => set({ lastUpdate: new Date() }),

      // Export actions
      exportData: (format) => {
        const { filteredTokens } = get()

        if (format === 'json') {
          const dataStr = JSON.stringify(filteredTokens, null, 2)
          const dataBlob = new Blob([dataStr], { type: 'application/json' })
          const url = URL.createObjectURL(dataBlob)
          const link = document.createElement('a')
          link.href = url
          link.download = `tokens-${new Date().toISOString().split('T')[0]}.json`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        } else {
          // CSV export
          const headers = [
            'Symbol', 'Name', 'Price', 'Market Cap', 'Volume 24h',
            'Price Change %', 'Liquidity', 'Safety Score', 'Age (hours)',
            'Slippage %', 'Creator Rugs', 'Top Holders %'
          ]

          const csvData = [
            headers.join(','),
            ...filteredTokens.map(token => [
              token.symbol,
              token.name,
              token.price,
              token.marketCap,
              token.volume24h,
              token.priceChangePercentage24h,
              token.liquidity,
              token.safetyScore,
              token.age,
              token.slippagePercent,
              token.creatorRugCount,
              token.topHoldersPercent
            ].join(','))
          ].join('\n')

          const dataBlob = new Blob([csvData], { type: 'text/csv' })
          const url = URL.createObjectURL(dataBlob)
          const link = document.createElement('a')
          link.href = url
          link.download = `tokens-${new Date().toISOString().split('T')[0]}.csv`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }
      },
    }),
    {
      name: 'token-store',
      partialize: (state) => ({
        customFilters: state.customFilters,
        theme: state.theme,
        sortField: state.sortField,
        sortDirection: state.sortDirection,
      }),
    }
  )
)