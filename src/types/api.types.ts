/**
 * Shared API Types for Token Detection Pipeline
 * Hive Mind Integration - API Service Layer
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  source: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  backoffMs: number;
  maxRetries: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

// DEXScreener Types
export interface DexScreenerPair {
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
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  pairCreatedAt: number;
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[];
}

export interface DexScreenerTokenData {
  address: string;
  symbol: string;
  name: string;
  launchTimestamp: number;
  price: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  age: number; // hours since launch
  filtered: boolean;
  filterReason?: string;
}

// RugCheck Types
export interface RugCheckResult {
  address: string;
  honeypotRisk: boolean;
  mintAuthority: boolean;
  freezeAuthority: boolean;
  liquidityLocked: boolean;
  holderConcentration: number; // percentage held by top 10
  safetyScore: number; // 0-10 scale
  risks: string[];
  warnings: string[];
  filtered: boolean;
  filterReason?: string;
}

// Jupiter Types
export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface JupiterTokenData {
  address: string;
  routingAvailable: boolean;
  slippageEstimate: number; // percentage
  spread: number;
  volume24h: number;
  blacklisted: boolean;
  routeCount: number;
  filtered: boolean;
  filterReason?: string;
}

// Solscan Types
export interface SolscanTokenHolder {
  address: string;
  amount: string;
  decimals: number;
  owner: string;
  rank: number;
}

export interface SolscanCreatorInfo {
  address: string;
  createdTokens: number;
  ruggedTokens: number;
  successfulTokens: number;
  successRate: number;
  firstTokenDate: Date;
  averageHolding: number; // days
}

export interface SolscanTokenData {
  address: string;
  creatorWallet: string;
  creatorInfo: SolscanCreatorInfo;
  topHolders: SolscanTokenHolder[];
  topHoldersPercentage: number; // top 3 holders percentage
  fundingPattern: 'organic' | 'suspicious' | 'coordinated';
  filtered: boolean;
  filterReason?: string;
}

// Unified Filter Criteria
export interface TokenFilterCriteria {
  // DEXScreener filters
  minAge?: number; // hours
  maxAge?: number; // hours
  minLiquidity?: number; // USD
  minVolume?: number; // USD

  // RugCheck filters
  minSafetyScore?: number; // 0-10
  allowHoneypot?: boolean;

  // Jupiter filters
  maxSlippage?: number; // percentage
  requireRouting?: boolean;
  allowBlacklisted?: boolean;

  // Solscan filters
  maxCreatorRugs?: number;
  maxTopHoldersPercentage?: number; // percentage
}

// Combined Token Analysis
export interface CombinedTokenAnalysis {
  address: string;
  dexScreener: DexScreenerTokenData;
  rugCheck: RugCheckResult;
  jupiter: JupiterTokenData;
  solscan: SolscanTokenData;
  overallScore: number; // 0-100 composite score
  passed: boolean;
  failedFilters: string[];
  timestamp: Date;
}

// Health Check Types
export interface ServiceHealthCheck {
  service: string;
  healthy: boolean;
  latency: number; // ms
  errorRate: number; // percentage
  lastCheck: Date;
  endpoint: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // seconds
  key: string;
}