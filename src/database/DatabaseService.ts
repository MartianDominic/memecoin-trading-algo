/**
 * DatabaseService.ts - Comprehensive database operations service
 * Handles CRUD operations for tokens, analysis, filters, and alerts
 */

import { Pool, Client, PoolClient, QueryResult } from 'pg';
import {
  CombinedTokenAnalysis,
  DexScreenerTokenData,
  RugCheckResult,
  JupiterTokenData,
  SolscanTokenData,
  TokenFilterCriteria
} from '../types/api.types';

// Extended database-specific interfaces
export interface DexAnalysisData {
  pairs: Array<{
    dexId: string;
    pairAddress: string;
    priceUsd: string;
    volume24h: number;
    liquidity: number;
    priceChange24h: number;
  }>;
  marketCap: number;
  holders: number;
  lastUpdated: string;
}

export interface RugAnalysisData {
  mintAuthority: boolean;
  freezeAuthority: boolean;
  liquidityLocked: boolean;
  holderConcentration: number;
  topHolders: Array<{
    address: string;
    percentage: number;
  }>;
  risks: string[];
  warnings: string[];
  safetyChecks: {
    hasWebsite: boolean;
    hasLiquidity: boolean;
    hasVolume: boolean;
  };
}

export interface JupiterAnalysisData {
  routeCount: number;
  slippageEstimate: number;
  spread: number;
  liquidityUsd: number;
  priceImpact: number;
  routeQuality: 'good' | 'moderate' | 'poor';
  lastQuoteTime: string;
}

export interface SolscanAnalysisData {
  creatorWallet: string;
  creationTimestamp: number;
  initialLiquidity: number;
  holderDistribution: {
    top10Percentage: number;
    uniqueHolders: number;
  };
  transactionMetrics: {
    totalTransactions: number;
    avgVolumePerTx: number;
    uniqueTraders: number;
  };
  creatorHistory: {
    tokensCreated: number;
    successfulTokens: number;
    ruggedTokens: number;
  };
}

export interface FilterCriteriaJson {
  // Price and market filters
  minMarketCap?: number;
  maxMarketCap?: number;
  minPrice?: number;
  maxPrice?: number;
  minVolume24h?: number;

  // Safety filters
  minRugScore?: number;
  maxRiskScore?: number;
  allowHoneypot?: boolean;
  allowMintAuthority?: boolean;

  // Timing filters
  minAge?: number; // hours
  maxAge?: number; // hours
  firstDetectedHours?: { min?: number; max?: number };

  // Liquidity and trading
  minLiquidity?: number;
  maxSlippage?: number;
  minHolderCount?: number;
  maxTopHoldersPercentage?: number;

  // Score filters
  minOverallScore?: number;
  minOpportunityScore?: number;

  // Custom conditions
  customConditions?: Array<{
    field: string;
    operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
    value: string | number | boolean;
  }>;
}

export interface AlertDataJson {
  // Price-related alerts
  priceData?: {
    currentPrice: number;
    previousPrice: number;
    changePercentage: number;
    triggeredAt: string;
  };

  // Volume alerts
  volumeData?: {
    currentVolume: number;
    averageVolume: number;
    volumeSpike: number;
    timeframe: string;
  };

  // Risk alerts
  riskData?: {
    riskType: string;
    severity: number;
    description: string;
    affectedMetrics: string[];
  };

  // Score change alerts
  scoreData?: {
    previousScore: number;
    currentScore: number;
    scoreDelta: number;
    scoreType: 'overall' | 'risk' | 'opportunity';
  };

  // General metadata
  metadata?: {
    sourceService: string;
    confidence: number;
    additionalContext?: Record<string, string | number | boolean>;
  };
}

export interface TemplateJson {
  name: string;
  description: string;
  criteria: FilterCriteriaJson;
  defaultValues: Record<string, string | number | boolean>;
  uiConfig?: {
    displayOrder: string[];
    groupings: Record<string, string[]>;
    labels: Record<string, string>;
    helpText: Record<string, string>;
  };
}

// Database-specific types
export interface DbToken {
  address: string;
  symbol: string;
  name: string;
  decimals?: number;
  supply?: string;
  market_cap?: string;
  price_usd?: string;
  volume_24h?: string;
  description?: string;
  image_url?: string;
  website_url?: string;
  twitter_url?: string;
  telegram_url?: string;
  first_detected_at: Date;
  created_at: Date;
  last_updated_at: Date;
  is_active: boolean;
  is_verified: boolean;
  is_scam: boolean;
  is_honeypot: boolean;
  price_last_updated?: Date;
  volume_last_updated?: Date;
}

export interface DbTokenAnalysis {
  id: string;
  token_address: string;
  analysis_timestamp: Date;
  dex_data?: DexAnalysisData;
  dex_score?: number;
  dex_last_updated?: Date;
  rug_data?: RugAnalysisData;
  rug_score?: number;
  rug_risk_level?: string;
  rug_last_updated?: Date;
  jupiter_data?: JupiterAnalysisData;
  jupiter_liquidity?: string;
  jupiter_price?: string;
  jupiter_last_updated?: Date;
  solscan_data?: SolscanAnalysisData;
  solscan_holder_count?: number;
  solscan_transaction_count?: number;
  solscan_last_updated?: Date;
  overall_score?: number;
  risk_score?: number;
  opportunity_score?: number;
  analysis_complete: boolean;
  has_errors: boolean;
  error_details?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbUserFilter {
  id: string;
  name: string;
  description?: string;
  criteria_json: FilterCriteriaJson;
  is_active: boolean;
  is_public: boolean;
  user_id?: string;
  created_by?: string;
  usage_count: number;
  last_used_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DbAlert {
  id: string;
  token_address: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  alert_data?: AlertDataJson;
  trigger_value?: string;
  threshold_value?: string;
  user_id?: string;
  filter_id?: string;
  acknowledged: boolean;
  acknowledged_at?: Date;
  acknowledged_by?: string;
  dismissed: boolean;
  dismissed_at?: Date;
  created_at: Date;
  expires_at?: Date;
}

export interface FilterTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  template_json: TemplateJson;
  is_active: boolean;
  sort_order: number;
  icon?: string;
  color?: string;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;  // max number of clients in pool
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  filters?: Record<string, string | number | boolean>;
}

export interface BulkInsertOptions {
  batchSize?: number;
  onConflict?: 'ignore' | 'update' | 'error';
  conflictColumns?: string[];
}

export class DatabaseService {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      max: config.max || 20,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 30000,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    });

    // Setup connection error handling
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      console.log('Database connection established');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    console.log('Database connection closed');
  }

  async runMigration(migrationPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const migrationSql = fs.readFileSync(path.resolve(migrationPath), 'utf8');
      await this.pool.query(migrationSql);
      console.log(`Migration completed: ${migrationPath}`);
    } catch (error) {
      console.error(`Migration failed: ${migrationPath}`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const start = Date.now();
    try {
      await this.pool.query('SELECT 1');
      return {
        healthy: true,
        latency: Date.now() - start
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // TOKEN OPERATIONS
  // ============================================================================

  async createToken(tokenData: Partial<DbToken>): Promise<DbToken> {
    const query = `
      INSERT INTO tokens (
        address, symbol, name, decimals, supply, market_cap, price_usd, volume_24h,
        description, image_url, website_url, twitter_url, telegram_url,
        is_verified, is_scam, is_honeypot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (address) DO UPDATE SET
        symbol = EXCLUDED.symbol,
        name = EXCLUDED.name,
        market_cap = EXCLUDED.market_cap,
        price_usd = EXCLUDED.price_usd,
        volume_24h = EXCLUDED.volume_24h,
        last_updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      tokenData.address,
      tokenData.symbol,
      tokenData.name,
      tokenData.decimals || 9,
      tokenData.supply,
      tokenData.market_cap,
      tokenData.price_usd,
      tokenData.volume_24h,
      tokenData.description,
      tokenData.image_url,
      tokenData.website_url,
      tokenData.twitter_url,
      tokenData.telegram_url,
      tokenData.is_verified || false,
      tokenData.is_scam || false,
      tokenData.is_honeypot || false
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async updateToken(address: string, updates: Partial<DbToken>): Promise<DbToken | null> {
    const setClause = Object.keys(updates)
      .filter(key => key !== 'address')
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    if (!setClause) {
      throw new Error('No valid fields to update');
    }

    const query = `
      UPDATE tokens 
      SET ${setClause}, last_updated_at = CURRENT_TIMESTAMP
      WHERE address = $1
      RETURNING *;
    `;

    const values = [address, ...Object.values(updates).filter((_, index) => 
      Object.keys(updates)[index] !== 'address'
    )];

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async getToken(address: string): Promise<DbToken | null> {
    const query = 'SELECT * FROM tokens WHERE address = $1';
    const result = await this.pool.query(query, [address]);
    return result.rows[0] || null;
  }

  async getTokens(options: QueryOptions = {}): Promise<DbToken[]> {
    let query = 'SELECT * FROM tokens WHERE is_active = true';
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    // Add filters
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query += ` AND ${key} = $${paramIndex}`;
        params.push(value);
        paramIndex++;
      }
    }

    // Add ordering
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    }

    // Add pagination
    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async bulkInsertTokens(
    tokens: Partial<DbToken>[], 
    options: BulkInsertOptions = {}
  ): Promise<void> {
    const batchSize = options.batchSize || 100;
    const onConflict = options.onConflict || 'update';
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      await this.insertTokenBatch(batch, onConflict);
    }
  }

  private async insertTokenBatch(
    tokens: Partial<DbToken>[], 
    onConflict: 'ignore' | 'update' | 'error'
  ): Promise<void> {
    if (tokens.length === 0) return;

    const values = tokens.map((token, index) => {
      const baseIndex = index * 16;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16})`;
    }).join(', ');

    let conflictClause = '';
    if (onConflict === 'ignore') {
      conflictClause = 'ON CONFLICT (address) DO NOTHING';
    } else if (onConflict === 'update') {
      conflictClause = `
        ON CONFLICT (address) DO UPDATE SET
          symbol = EXCLUDED.symbol,
          name = EXCLUDED.name,
          market_cap = EXCLUDED.market_cap,
          price_usd = EXCLUDED.price_usd,
          volume_24h = EXCLUDED.volume_24h,
          last_updated_at = CURRENT_TIMESTAMP
      `;
    }

    const query = `
      INSERT INTO tokens (
        address, symbol, name, decimals, supply, market_cap, price_usd, volume_24h,
        description, image_url, website_url, twitter_url, telegram_url,
        is_verified, is_scam, is_honeypot
      ) VALUES ${values}
      ${conflictClause};
    `;

    const params = tokens.flatMap(token => [
      token.address,
      token.symbol,
      token.name,
      token.decimals || 9,
      token.supply,
      token.market_cap,
      token.price_usd,
      token.volume_24h,
      token.description,
      token.image_url,
      token.website_url,
      token.twitter_url,
      token.telegram_url,
      token.is_verified || false,
      token.is_scam || false,
      token.is_honeypot || false
    ]);

    await this.pool.query(query, params);
  }

  // ============================================================================
  // TOKEN ANALYSIS OPERATIONS
  // ============================================================================

  async createTokenAnalysis(analysisData: Partial<DbTokenAnalysis>): Promise<DbTokenAnalysis> {
    const query = `
      INSERT INTO token_analysis (
        token_address, dex_data, dex_score, rug_data, rug_score, rug_risk_level,
        jupiter_data, jupiter_liquidity, jupiter_price, solscan_data,
        solscan_holder_count, solscan_transaction_count, overall_score,
        risk_score, opportunity_score, analysis_complete, has_errors, error_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *;
    `;

    const values = [
      analysisData.token_address,
      JSON.stringify(analysisData.dex_data),
      analysisData.dex_score,
      JSON.stringify(analysisData.rug_data),
      analysisData.rug_score,
      analysisData.rug_risk_level,
      JSON.stringify(analysisData.jupiter_data),
      analysisData.jupiter_liquidity,
      analysisData.jupiter_price,
      JSON.stringify(analysisData.solscan_data),
      analysisData.solscan_holder_count,
      analysisData.solscan_transaction_count,
      analysisData.overall_score,
      analysisData.risk_score,
      analysisData.opportunity_score,
      analysisData.analysis_complete || false,
      analysisData.has_errors || false,
      analysisData.error_details
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getLatestTokenAnalysis(tokenAddress: string): Promise<DbTokenAnalysis | null> {
    const query = `
      SELECT * FROM token_analysis 
      WHERE token_address = $1 AND analysis_complete = true
      ORDER BY analysis_timestamp DESC 
      LIMIT 1;
    `;
    
    const result = await this.pool.query(query, [tokenAddress]);
    return result.rows[0] || null;
  }

  async getTokenAnalysisHistory(
    tokenAddress: string, 
    options: QueryOptions = {}
  ): Promise<DbTokenAnalysis[]> {
    let query = `
      SELECT * FROM token_analysis 
      WHERE token_address = $1
      ORDER BY analysis_timestamp DESC
    `;
    
    const params = [tokenAddress];
    
    if (options.limit) {
      query += ' LIMIT $2';
      params.push(options.limit);
    }
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async bulkInsertAnalysis(
    analysisData: Partial<DbTokenAnalysis>[],
    options: BulkInsertOptions = {}
  ): Promise<void> {
    const batchSize = options.batchSize || 50;
    
    for (let i = 0; i < analysisData.length; i += batchSize) {
      const batch = analysisData.slice(i, i + batchSize);
      await this.insertAnalysisBatch(batch);
    }
  }

  private async insertAnalysisBatch(analysisData: Partial<DbTokenAnalysis>[]): Promise<void> {
    if (analysisData.length === 0) return;

    const values = analysisData.map((analysis, index) => {
      const baseIndex = index * 18;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16}, $${baseIndex + 17}, $${baseIndex + 18})`;
    }).join(', ');

    const query = `
      INSERT INTO token_analysis (
        token_address, dex_data, dex_score, rug_data, rug_score, rug_risk_level,
        jupiter_data, jupiter_liquidity, jupiter_price, solscan_data,
        solscan_holder_count, solscan_transaction_count, overall_score,
        risk_score, opportunity_score, analysis_complete, has_errors, error_details
      ) VALUES ${values};
    `;

    const params = analysisData.flatMap(analysis => [
      analysis.token_address,
      JSON.stringify(analysis.dex_data),
      analysis.dex_score,
      JSON.stringify(analysis.rug_data),
      analysis.rug_score,
      analysis.rug_risk_level,
      JSON.stringify(analysis.jupiter_data),
      analysis.jupiter_liquidity,
      analysis.jupiter_price,
      JSON.stringify(analysis.solscan_data),
      analysis.solscan_holder_count,
      analysis.solscan_transaction_count,
      analysis.overall_score,
      analysis.risk_score,
      analysis.opportunity_score,
      analysis.analysis_complete || false,
      analysis.has_errors || false,
      analysis.error_details
    ]);

    await this.pool.query(query, params);
  }

  // ============================================================================
  // FILTER OPERATIONS
  // ============================================================================

  async createUserFilter(filterData: Partial<DbUserFilter>): Promise<DbUserFilter> {
    const query = `
      INSERT INTO user_filters (
        name, description, criteria_json, is_active, is_public, user_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [
      filterData.name,
      filterData.description,
      JSON.stringify(filterData.criteria_json),
      filterData.is_active !== false,
      filterData.is_public || false,
      filterData.user_id,
      filterData.created_by
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getUserFilters(userId: string, options: QueryOptions = {}): Promise<DbUserFilter[]> {
    let query = `
      SELECT * FROM user_filters 
      WHERE (user_id = $1 OR is_public = true) AND is_active = true
      ORDER BY created_at DESC
    `;
    
    const params = [userId];
    
    if (options.limit) {
      query += ' LIMIT $2';
      params.push(options.limit);
    }
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getFilterTemplates(): Promise<FilterTemplate[]> {
    const query = `
      SELECT * FROM filter_templates 
      WHERE is_active = true 
      ORDER BY sort_order, name;
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  async incrementFilterUsage(filterId: string): Promise<void> {
    await this.pool.query('SELECT increment_filter_usage($1)', [filterId]);
  }

  async applyFilters(
    tokenAddresses: string[], 
    criteria: TokenFilterCriteria
  ): Promise<string[]> {
    // This is a complex filtering operation that would involve
    // joining with token_analysis and applying multiple conditions
    // Implementation would depend on specific filter logic
    
    let query = `
      SELECT DISTINCT t.address
      FROM tokens t
      LEFT JOIN LATERAL (
        SELECT *
        FROM token_analysis ta
        WHERE ta.token_address = t.address
          AND ta.analysis_complete = true
        ORDER BY ta.analysis_timestamp DESC
        LIMIT 1
      ) latest_analysis ON true
      WHERE t.address = ANY($1::text[])
        AND t.is_active = true
    `;
    
    const params: (string[] | number | boolean)[] = [tokenAddresses];
    let paramIndex = 2;

    // Add dynamic filter conditions based on criteria
    if (criteria.minLiquidity !== undefined) {
      query += ` AND (latest_analysis.jupiter_liquidity::decimal >= $${paramIndex})`;
      params.push(criteria.minLiquidity);
      paramIndex++;
    }

    if (criteria.minSafetyScore !== undefined) {
      query += ` AND (latest_analysis.rug_score >= $${paramIndex})`;
      params.push(criteria.minSafetyScore * 10); // Convert to 0-100 scale
      paramIndex++;
    }

    if (criteria.maxTopHoldersPercentage !== undefined) {
      query += ` AND (latest_analysis.solscan_data->>'topHoldersPercentage')::decimal <= $${paramIndex}`;
      params.push(criteria.maxTopHoldersPercentage);
      paramIndex++;
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => row.address);
  }

  // ============================================================================
  // ALERT OPERATIONS
  // ============================================================================

  async createAlert(alertData: Partial<DbAlert>): Promise<string> {
    const result = await this.pool.query(
      'SELECT create_alert($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        alertData.token_address,
        alertData.alert_type,
        alertData.severity,
        alertData.title,
        alertData.message,
        alertData.user_id,
        JSON.stringify(alertData.alert_data),
        alertData.trigger_value,
        alertData.threshold_value,
        null // expires_hours - can be added if needed
      ]
    );
    
    return result.rows[0].create_alert;
  }

  async getUserAlerts(
    userId: string, 
    options: QueryOptions & { unreadOnly?: boolean } = {}
  ): Promise<DbAlert[]> {
    let query = `
      SELECT * FROM alerts 
      WHERE (user_id = $1 OR user_id IS NULL)
    `;
    
    const params = [userId];
    
    if (options.unreadOnly) {
      query += ' AND acknowledged = false AND dismissed = false';
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options.limit) {
      query += ' LIMIT $2';
      params.push(options.limit);
    }
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT acknowledge_alert($1, $2)',
      [alertId, userId]
    );
    
    return result.rows[0].acknowledge_alert;
  }

  async dismissAlert(alertId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT dismiss_alert($1, $2)',
      [alertId, userId]
    );
    
    return result.rows[0].dismiss_alert;
  }

  async cleanupExpiredAlerts(): Promise<number> {
    const result = await this.pool.query('SELECT cleanup_expired_alerts()');
    return result.rows[0].cleanup_expired_alerts;
  }

  // ============================================================================
  // ANALYTICS AND VIEWS
  // ============================================================================

  async getTopOpportunities(limit: number = 20): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    market_cap: string;
    volume_24h: string;
    price_usd: string;
    overall_score: number;
    opportunity_score: number;
    risk_score: number;
    analysis_timestamp: Date;
  }>> {
    const query = `
      SELECT * FROM v_top_opportunities 
      LIMIT $1;
    `;
    
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async getRecentDiscoveries(hours: number = 24): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    market_cap: string;
    volume_24h: string;
    first_detected_at: Date;
    overall_score: number;
    risk_score: number;
    hours_since_discovery: number;
  }>> {
    const query = `
      SELECT * FROM v_recent_discoveries 
      WHERE hours_since_discovery <= $1
      ORDER BY first_detected_at DESC;
    `;
    
    const result = await this.pool.query(query, [hours]);
    return result.rows;
  }

  async getUnreadAlertsCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM v_unread_alerts 
      WHERE user_id = $1 OR user_id IS NULL;
    `;
    
    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  async getTokenStatistics(): Promise<{
    total: number;
    active: number;
    analyzed: number;
    recentlyAdded: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(DISTINCT ta.token_address) as analyzed,
        COUNT(*) FILTER (WHERE first_detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as recently_added
      FROM tokens t
      LEFT JOIN token_analysis ta ON t.address = ta.token_address AND ta.analysis_complete = true;
    `;
    
    const result = await this.pool.query(query);
    const row = result.rows[0];
    
    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      analyzed: parseInt(row.analyzed),
      recentlyAdded: parseInt(row.recently_added)
    };
  }

  // ============================================================================
  // TRANSACTION SUPPORT
  // ============================================================================

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR EXTERNAL APIs
  // ============================================================================

  async storeCombinedAnalysis(analysis: CombinedTokenAnalysis): Promise<void> {
    await this.withTransaction(async (client) => {
      // Update or create token
      const tokenData: Partial<DbToken> = {
        address: analysis.address,
        symbol: analysis.dexScreener.symbol,
        name: analysis.dexScreener.name,
        market_cap: analysis.dexScreener.marketCap.toString(),
        price_usd: analysis.dexScreener.price.toString(),
        volume_24h: analysis.dexScreener.volume24h.toString(),
        is_scam: !analysis.passed && analysis.failedFilters.some(f => f.includes('scam')),
        is_honeypot: analysis.rugCheck.honeypotRisk
      };

      await this.createToken(tokenData);

      // Store analysis
      const analysisData: Partial<DbTokenAnalysis> = {
        token_address: analysis.address,
        dex_data: analysis.dexScreener,
        dex_score: Math.round(analysis.dexScreener.volume24h / 10000), // Simple scoring
        rug_data: analysis.rugCheck,
        rug_score: analysis.rugCheck.safetyScore * 10,
        rug_risk_level: analysis.rugCheck.safetyScore >= 8 ? 'low' :
                       analysis.rugCheck.safetyScore >= 5 ? 'medium' : 'high'
      };

      await this.createTokenAnalysis(analysisData);
    });
  }
}