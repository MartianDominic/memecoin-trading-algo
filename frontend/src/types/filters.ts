import { Token } from './index'

export interface FilterPreset {
  id: string
  name: string
  description: string
  conditions: FilterCondition[]
  isDefault?: boolean
}

export interface FilterCondition {
  field: keyof Token
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_eq'
  value: string | number | boolean
  label?: string
}

// Predefined filter presets based on requirements
export const DEFAULT_FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'safe-new-tokens',
    name: 'Safe New Tokens',
    description: 'Age <24h, Liquidity >$5k, Volume >$1k, Safety ≥6, No honeypot, Routing exists, <10% slippage, Creator <3 rugs, Top holders <60%',
    isDefault: true,
    conditions: [
      { field: 'age', operator: 'lt', value: 24, label: 'Age less than 24 hours' },
      { field: 'liquidity', operator: 'gt', value: 5000, label: 'Liquidity greater than $5,000' },
      { field: 'volume24h', operator: 'gt', value: 1000, label: 'Volume greater than $1,000' },
      { field: 'safetyScore', operator: 'gte', value: 6, label: 'Safety score 6 or higher' },
      { field: 'isHoneypot', operator: 'eq', value: false, label: 'Not a honeypot' },
      { field: 'hasRouting', operator: 'eq', value: true, label: 'Has routing' },
      { field: 'slippagePercent', operator: 'lt', value: 10, label: 'Slippage less than 10%' },
      { field: 'creatorRugCount', operator: 'lt', value: 3, label: 'Creator has less than 3 rugs' },
      { field: 'topHoldersPercent', operator: 'lt', value: 60, label: 'Top holders less than 60%' }
    ]
  },
  {
    id: 'high-volume',
    name: 'High Volume',
    description: 'Tokens with significant trading activity',
    conditions: [
      { field: 'volume24h', operator: 'gt', value: 10000, label: 'Volume greater than $10,000' },
      { field: 'liquidity', operator: 'gt', value: 50000, label: 'Liquidity greater than $50,000' }
    ]
  },
  {
    id: 'established-safe',
    name: 'Established & Safe',
    description: 'Older tokens with proven safety records',
    conditions: [
      { field: 'age', operator: 'gt', value: 168, label: 'Age greater than 1 week' },
      { field: 'safetyScore', operator: 'gte', value: 8, label: 'Safety score 8 or higher' },
      { field: 'verified', operator: 'eq', value: true, label: 'Verified token' },
      { field: 'liquidityLocked', operator: 'eq', value: true, label: 'Liquidity locked' }
    ]
  },
  {
    id: 'micro-cap',
    name: 'Micro Cap Gems',
    description: 'Small market cap tokens with potential',
    conditions: [
      { field: 'marketCap', operator: 'lt', value: 1000000, label: 'Market cap less than $1M' },
      { field: 'marketCap', operator: 'gt', value: 10000, label: 'Market cap greater than $10K' },
      { field: 'safetyScore', operator: 'gte', value: 5, label: 'Safety score 5 or higher' }
    ]
  }
]