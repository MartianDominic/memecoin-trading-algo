/**
 * Token Types - Core token data structures and interfaces
 */

export interface TokenData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply?: number;
  description?: string;
  logoURI?: string;
  tags?: string[];
  chainId?: number;
  verified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TokenMetrics {
  address: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  volumeChange24h: number;
  marketCap: number;
  marketCapChange24h: number;
  liquidity: number;
  liquidityChange24h: number;
  fdv?: number; // Fully Diluted Valuation
  circulatingSupply?: number;
  totalSupply?: number;
  holders?: number;
  transactions24h?: number;
  buys24h?: number;
  sells24h?: number;
  timestamp: Date;
}

export interface TokenSecurity {
  address: string;
  isContract: boolean;
  isProxy: boolean;
  isVerified: boolean;
  hasSourceCode: boolean;
  rugScore: number; // 0-100, higher is riskier
  liquidityScore: number; // 0-100, higher is better
  holderScore: number; // 0-100, higher is better
  securityScore: number; // Overall security score
  flags: SecurityFlag[];
  warnings: string[];
  checkTimestamp: Date;
  // Additional properties for compatibility
  honeypotRisk?: boolean;
  rugPullRisk?: boolean;
  contractVerified?: boolean;
}

export interface SecurityFlag {
  type: 'WARNING' | 'CRITICAL' | 'INFO';
  message: string;
  severity: number; // 1-10
}

export interface DetectionResult {
  token: TokenData;
  metrics: TokenMetrics;
  security: TokenSecurity;
  confidence: number; // 0-1, confidence in detection
  triggers: DetectionTrigger[];
  detected_at: Date;
  // Additional properties for compatibility
  score?: number; // Overall score 0-100
  alerts?: TokenAlert[];
}

export interface DetectionTrigger {
  type: 'volume_spike' | 'price_spike' | 'new_listing' | 'social_mention' | 'whale_activity';
  value: number;
  threshold: number;
  triggered_at: Date;
}

export interface PipelineConfig {
  enabled: boolean;
  intervalMs: number;
  batchSize: number;
  maxRetries: number;
  timeout: number;
  filters: DetectionFilter[];
  thresholds: DetectionThresholds;
}

export interface DetectionFilter {
  type: 'min_volume' | 'min_liquidity' | 'min_market_cap' | 'max_age' | 'blacklist';
  value: number | string | string[];
  enabled: boolean;
}

export interface DetectionThresholds {
  volumeSpike: number; // Percentage increase
  priceSpike: number; // Percentage increase
  liquidityMin: number; // Minimum liquidity in USD
  holderMin: number; // Minimum number of holders
  marketCapMin: number; // Minimum market cap
  securityScoreMin: number; // Minimum security score
}

export interface TokenAlert {
  id: string;
  token: TokenData;
  type: AlertType;
  title: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  data: Record<string, unknown>;
  triggered_at: Date;
  acknowledged: boolean;
  acknowledged_at?: Date;
  resolved: boolean;
  resolved_at?: Date;
}

export type AlertType =
  | 'NEW_TOKEN_DETECTED'
  | 'VOLUME_SPIKE'
  | 'PRICE_SPIKE'
  | 'LIQUIDITY_DROP'
  | 'SECURITY_WARNING'
  | 'RUG_PULL_DETECTED'
  | 'WHALE_ACTIVITY'
  | 'SOCIAL_TREND';

export interface TokenAnalysis {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  analysis: {
    technical: TechnicalAnalysis;
    fundamental: FundamentalAnalysis;
    sentiment: SentimentAnalysis;
    risk: RiskAnalysis;
  };
  score: number; // Overall score 0-100
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'AVOID';
  confidence: number; // 0-1
  generated_at: Date;
}

export interface TechnicalAnalysis {
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  support: number[];
  resistance: number[];
  rsi: number;
  macd: { signal: number; histogram: number; macd: number };
  volume_profile: 'INCREASING' | 'DECREASING' | 'STABLE';
  momentum: number; // -1 to 1
}

export interface FundamentalAnalysis {
  liquidity_health: number; // 0-100
  holder_distribution: number; // 0-100
  contract_security: number; // 0-100
  team_credibility: number; // 0-100
  project_utility: number; // 0-100
  community_strength: number; // 0-100
}

export interface SentimentAnalysis {
  social_score: number; // 0-100
  mention_count: number;
  sentiment_ratio: number; // -1 to 1
  influential_mentions: number;
  trending_score: number; // 0-100
  platforms: Record<string, number>; // platform -> score
}

export interface RiskAnalysis {
  rug_pull_risk: number; // 0-100
  liquidity_risk: number; // 0-100
  volatility_risk: number; // 0-100
  regulatory_risk: number; // 0-100
  technical_risk: number; // 0-100
  overall_risk: number; // 0-100
  risk_factors: string[];
}

export interface TokenPair {
  address: string;
  token0: TokenData;
  token1: TokenData;
  reserve0: number;
  reserve1: number;
  liquidity: number;
  fee: number;
  volume24h: number;
  exchange: string;
  lastUpdated: Date;
}

export interface PriceData {
  address: string;
  price: number;
  timestamp: Date;
  volume: number;
  source: string;
  confidence: number;
}

export interface MarketData {
  address: string;
  symbol: string;
  price: number;
  priceChange: {
    '1h': number;
    '24h': number;
    '7d': number;
    '30d': number;
  };
  volume: {
    '1h': number;
    '24h': number;
    '7d': number;
    '30d': number;
  };
  marketCap: number;
  fdv: number;
  liquidity: number;
  holders: number;
  lastUpdated: Date;
}