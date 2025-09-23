// TypeScript types matching backend API

export interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  holders: number;
  transactions24h: number;
  createdAt: string;
  lastUpdated: string;
  isVerified: boolean;
  tags: string[];
  metadata?: {
    description?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    logo?: string;
  };
}

export interface TokenFilters {
  minPrice?: number;
  maxPrice?: number;
  minVolume24h?: number;
  maxVolume24h?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
  maxLiquidity?: number;
  minHolders?: number;
  maxHolders?: number;
  minTransactions24h?: number;
  maxTransactions24h?: number;
  isVerified?: boolean;
  tags?: string[];
  sortBy?: 'price' | 'volume24h' | 'marketCap' | 'priceChange24h' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface UserFilter {
  id: string;
  name: string;
  description?: string;
  filters: TokenFilters;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  tokenAddress: string;
  type: 'price_above' | 'price_below' | 'volume_spike' | 'new_token' | 'large_transaction';
  condition: {
    threshold?: number;
    percentage?: number;
    timeframe?: string;
  };
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt?: string;
  createdAt: string;
  updatedAt: string;
  token?: Token;
}

export interface WebSocketMessage {
  type: 'token_update' | 'new_token' | 'alert_triggered' | 'connection_status';
  data: any;
  timestamp: string;
}

export interface TokenUpdate {
  address: string;
  price: number;
  priceChange: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  transactions24h: number;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: any;
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  lastConnected?: Date;
  reconnectAttempts: number;
  error?: string;
}

// React Query keys
export const QueryKeys = {
  tokens: ['tokens'] as const,
  token: (address: string) => ['token', address] as const,
  filters: ['filters'] as const,
  filter: (id: string) => ['filter', id] as const,
  alerts: ['alerts'] as const,
  alert: (id: string) => ['alert', id] as const,
} as const;

// API endpoints
export const API_ENDPOINTS = {
  tokens: '/api/tokens',
  token: (address: string) => `/api/tokens/${address}`,
  filters: '/api/filters',
  filter: (id: string) => `/api/filters/${id}`,
  alerts: '/api/alerts',
  alert: (id: string) => `/api/alerts/${id}`,
  websocket: '/ws',
} as const;

// WebSocket event types
export const WS_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  TOKEN_UPDATE: 'token_update',
  NEW_TOKEN: 'new_token',
  ALERT_TRIGGERED: 'alert_triggered',
  SUBSCRIBE_TOKEN: 'subscribe_token',
  UNSUBSCRIBE_TOKEN: 'unsubscribe_token',
  SUBSCRIBE_ALERTS: 'subscribe_alerts',
  UNSUBSCRIBE_ALERTS: 'unsubscribe_alerts',
} as const;

export type WSEventType = typeof WS_EVENTS[keyof typeof WS_EVENTS];