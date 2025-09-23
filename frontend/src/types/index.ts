export interface Token {
  id: string
  symbol: string
  name: string
  price: number
  marketCap: number
  volume24h: number
  priceChange24h: number
  priceChangePercentage24h: number
  liquidity: number
  holders: number
  age: number // in hours
  risk: "low" | "medium" | "high"
  lastUpdated: string
  contractAddress: string
  chain: string
  // Additional fields for comprehensive filtering
  safetyScore: number // 0-10 scale
  isHoneypot: boolean
  hasRouting: boolean
  slippagePercent: number
  creatorRugCount: number
  topHoldersPercent: number
  verified: boolean
  liquidityLocked: boolean
  createdAt: string
  ath: number // All-time high
  atl: number // All-time low
  totalSupply: number
  circulatingSupply: number
}

export interface TokenFilter {
  id: string
  name: string
  conditions: FilterCondition[]
  active: boolean
}

export interface FilterCondition {
  field: keyof Token
  operator: "gt" | "lt" | "eq" | "gte" | "lte" | "contains"
  value: string | number
}

export interface Alert {
  id: string
  tokenId: string
  type: "price" | "volume" | "liquidity" | "holders"
  condition: FilterCondition
  triggered: boolean
  createdAt: string
  severity: "low" | "medium" | "high"
  message: string
}

export interface ChartData {
  timestamp: number
  price: number
  volume: number
  marketCap: number
}