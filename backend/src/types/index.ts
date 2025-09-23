// Core type definitions for the memecoin trading backend

export interface TokenData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chain: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  marketCap?: number;
  totalSupply?: bigint;
  circulatingSupply?: bigint;
  launchDate?: Date;
}

export interface PriceInfo {
  price: number;
  priceChange1h?: number;
  priceChange24h?: number;
  priceChange7d?: number;
  volume24h?: number;
  volumeChange24h?: number;
  liquidity?: number;
  liquidityChange24h?: number;
  marketCap?: number;
  fdv?: number;
  timestamp: Date;
  source: string;
}

export interface SafetyAnalysis {
  overallScore: number; // 0-10
  riskLevel: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  liquidityScore?: number;
  holderScore?: number;
  contractScore?: number;
  teamScore?: number;
  socialScore?: number;
  isHoneypot: boolean;
  hasRenounced: boolean;
  hasLiquidity: boolean;
  hasVerifiedContract: boolean;
  holderCount?: number;
  topHolderPercent?: number;
  contractAge?: number;
  mintAuthority?: boolean;
  freezeAuthority?: boolean;
  source: string;
}

export interface TradingSignal {
  signalType: 'MOMENTUM' | 'REVERSAL' | 'BREAKOUT' | 'VOLUME_SPIKE' | 'SAFETY_ALERT' | 'FUNDAMENTAL';
  strength: number; // 0-1
  confidence: number; // 0-1
  action: 'BUY' | 'SELL' | 'HOLD';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  indicators: string[];
  reasoning?: string;
  isActive: boolean;
  expiresAt?: Date;
}

// API Response types for external services
export interface DexScreenerToken {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
}

export interface GmgnTokenData {
  token_address: string;
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
  price_usd: number;
  market_cap: number;
  volume_24h: number;
  price_change_24h: number;
  liquidity_usd: number;
  holder_count: number;
  creation_time: number;
  is_honeypot: boolean;
  contract_verified: boolean;
  top_holders: Array<{
    address: string;
    percentage: number;
    balance: string;
  }>;
}

export interface GeckoTerminalToken {
  id: string;
  type: string;
  attributes: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    total_supply: string;
    price_usd: string;
    fdv_usd: string;
    market_cap_usd: string;
    total_reserve_in_usd: string;
    volume_usd: {
      h24: string;
    };
    price_change_percentage: {
      h1: string;
      h24: string;
    };
  };
}

export interface SolscanTokenData {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  supply: string;
  type: string;
  tags: string[];
  holder: number;
  market: {
    price: number;
    volume24h: number;
    marketCap: number;
    priceChange24h: number;
  };
  createTime: number;
  mintAuthority?: string;
  freezeAuthority?: string;
}

// Configuration types
export interface ApiConfig {
  dexscreener: {
    baseUrl: string;
    apiKey?: string;
    rateLimit: number;
  };
  gmgn: {
    baseUrl: string;
    apiKey?: string;
    rateLimit: number;
  };
  geckoterminal: {
    baseUrl: string;
    apiKey?: string;
    rateLimit: number;
  };
  solscan: {
    baseUrl: string;
    apiKey?: string;
    rateLimit: number;
  };
}

export interface TradingConfig {
  maxPositionSizeUsd: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxConcurrentTrades: number;
  safetyScoreThreshold: number;
  volumeThresholdUsd: number;
  marketCapMinUsd: number;
  marketCapMaxUsd: number;
  tokenScanIntervalMs: number;
  maxTokensPerScan: number;
}

// Error types
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public provider?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class RateLimitError extends ApiError {
  constructor(provider: string, resetTime?: Date) {
    super(`Rate limit exceeded for ${provider}`, 429, provider);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}