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
    fdv?: number;
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
    rugScore: number;
    liquidityScore: number;
    holderScore: number;
    securityScore: number;
    flags: SecurityFlag[];
    warnings: string[];
    checkTimestamp: Date;
    honeypotRisk?: boolean;
    rugPullRisk?: boolean;
    contractVerified?: boolean;
}
export interface SecurityFlag {
    type: 'WARNING' | 'CRITICAL' | 'INFO';
    message: string;
    severity: number;
}
export interface DetectionResult {
    token: TokenData;
    metrics: TokenMetrics;
    security: TokenSecurity;
    confidence: number;
    triggers: DetectionTrigger[];
    detected_at: Date;
    score?: number;
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
    volumeSpike: number;
    priceSpike: number;
    liquidityMin: number;
    holderMin: number;
    marketCapMin: number;
    securityScoreMin: number;
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
export type AlertType = 'NEW_TOKEN_DETECTED' | 'VOLUME_SPIKE' | 'PRICE_SPIKE' | 'LIQUIDITY_DROP' | 'SECURITY_WARNING' | 'RUG_PULL_DETECTED' | 'WHALE_ACTIVITY' | 'SOCIAL_TREND';
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
    score: number;
    recommendation: 'BUY' | 'SELL' | 'HOLD' | 'AVOID';
    confidence: number;
    generated_at: Date;
}
export interface TechnicalAnalysis {
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    support: number[];
    resistance: number[];
    rsi: number;
    macd: {
        signal: number;
        histogram: number;
        macd: number;
    };
    volume_profile: 'INCREASING' | 'DECREASING' | 'STABLE';
    momentum: number;
}
export interface FundamentalAnalysis {
    liquidity_health: number;
    holder_distribution: number;
    contract_security: number;
    team_credibility: number;
    project_utility: number;
    community_strength: number;
}
export interface SentimentAnalysis {
    social_score: number;
    mention_count: number;
    sentiment_ratio: number;
    influential_mentions: number;
    trending_score: number;
    platforms: Record<string, number>;
}
export interface RiskAnalysis {
    rug_pull_risk: number;
    liquidity_risk: number;
    volatility_risk: number;
    regulatory_risk: number;
    technical_risk: number;
    overall_risk: number;
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
//# sourceMappingURL=tokens.d.ts.map