# Database Schema Documentation

## Overview

The memecoin trading algorithm uses a PostgreSQL database to store token metadata, analysis results, user filters, and alerts. The schema is designed for high-performance token screening and real-time analysis.

## Database Structure

### Core Tables

#### 1. `tokens` - Main token information table
Stores fundamental token metadata and tracking information.

**Key Fields:**
- `address` (PRIMARY KEY): Solana token address (base58 encoded, max 44 chars)
- `symbol`, `name`: Token identifiers
- `market_cap`, `price_usd`, `volume_24h`: Market data with high precision
- `first_detected_at`, `last_updated_at`: Timing information
- `is_active`, `is_verified`, `is_scam`, `is_honeypot`: Status flags

**Indexes:**
- Primary index on address
- Performance indexes on market_cap, volume_24h, created_at
- Composite indexes for common query patterns

#### 2. `token_analysis` - Combined analysis results
Stores comprehensive analysis data from multiple sources (DEXScreener, RugCheck, Jupiter, Solscan).

**Key Fields:**
- `token_address` (FOREIGN KEY): References tokens(address)
- `dex_data`, `rug_data`, `jupiter_data`, `solscan_data`: JSONB analysis results
- `overall_score`, `risk_score`, `opportunity_score`: Calculated scores (0-100)
- `analysis_complete`: Flag indicating if analysis is finished
- `analysis_timestamp`: When analysis was performed

**Indexes:**
- Optimized for latest analysis queries
- Score-based indexes for filtering
- Composite indexes for high-opportunity and low-risk queries

#### 3. `user_filters` - Custom user filters
Stores user-defined filtering criteria for token screening.

**Key Fields:**
- `name`, `description`: Filter identification
- `criteria_json` (JSONB): Filter criteria with proper typing
- `user_id`: Owner identification
- `usage_count`, `last_used_at`: Usage tracking
- `is_public`: Sharing flag

**Indexes:**
- GIN index on criteria_json for JSON searches
- User and public filter optimization

#### 4. `alerts` - Token alerts and notifications
Manages user alerts and system notifications.

**Key Fields:**
- `token_address` (FOREIGN KEY): Related token
- `alert_type`: 'price_spike', 'volume_surge', 'rug_risk', 'new_token', 'score_change'
- `severity`: 'low', 'medium', 'high', 'critical'
- `alert_data` (JSONB): Structured alert information
- `acknowledged`, `dismissed`: Status tracking

**Indexes:**
- User-specific unread alerts
- Token-specific alerts
- Severity-based filtering

### Support Tables

#### 5. `filter_templates` - Predefined filter templates
Common filter patterns for quick user selection.

#### 6. `alert_subscriptions` - User alert preferences
User notification settings and delivery preferences.

## Database Views

### `v_latest_token_analysis`
Combines token information with their latest analysis results for dashboard queries.

### `v_unread_alerts`
Shows unread alerts with token information for notification systems.

### `v_top_opportunities`
Pre-calculated view of highest-scoring tokens for quick access.

### `v_recent_discoveries`
Tokens discovered within the last 24 hours with analysis data.

## Database Functions

### Utility Functions
- `get_latest_token_analysis(token_address)`: Get most recent analysis for a token
- `increment_filter_usage(filter_id)`: Update filter usage statistics
- `cleanup_expired_alerts()`: Remove old expired alerts

### Alert Functions
- `create_alert(...)`: Create new alert with proper validation
- `acknowledge_alert(alert_id, user_id)`: Mark alert as acknowledged
- `dismiss_alert(alert_id, user_id)`: Dismiss an alert

### Trigger Functions
- `update_*_updated_at()`: Automatically update timestamp fields

## Performance Considerations

### Indexing Strategy
- **Primary indexes**: All foreign keys and frequently queried fields
- **Composite indexes**: Common query patterns (active + market_cap, user + unread alerts)
- **Partial indexes**: Filtered indexes for specific conditions (active tokens, complete analysis)
- **GIN indexes**: JSON data searches (criteria_json, alert_data)

### Query Optimization
- **Latest analysis pattern**: Uses LATERAL joins for efficient latest-record queries
- **Batch operations**: Bulk insert methods for high-volume data
- **Pagination support**: Limit/offset with proper ordering

### Data Management
- **Automatic cleanup**: Expired alerts removal
- **Timestamp triggers**: Automatic last_updated_at maintenance
- **JSON validation**: Constraints ensure valid JSON structure

## Usage Examples

### DatabaseService Class

The `DatabaseService` class provides a comprehensive interface for all database operations:

```typescript
import DatabaseService from './DatabaseService';

const db = new DatabaseService(config);

// Token operations
const token = await db.createToken(tokenData);
const tokens = await db.getTokens({ limit: 100, orderBy: 'market_cap' });

// Analysis operations
const analysis = await db.createTokenAnalysis(analysisData);
const latest = await db.getLatestTokenAnalysis(tokenAddress);

// Filter operations
const filter = await db.createUserFilter(filterData);
const filtered = await db.applyFilters(addresses, criteria);

// Alert operations
const alertId = await db.createAlert(alertData);
const alerts = await db.getUserAlerts(userId, { unreadOnly: true });

// Analytics
const opportunities = await db.getTopOpportunities(20);
const discoveries = await db.getRecentDiscoveries(24);
```

### Bulk Operations

For high-volume data ingestion:

```typescript
// Bulk insert tokens (processes in batches)
await db.bulkInsertTokens(tokenArray, {
  batchSize: 100,
  onConflict: 'update'
});

// Bulk insert analysis results
await db.bulkInsertAnalysis(analysisArray, {
  batchSize: 50
});
```

### Transaction Support

For atomic operations:

```typescript
await db.withTransaction(async (client) => {
  await db.createToken(tokenData);
  await db.createTokenAnalysis(analysisData);
  await db.createAlert(alertData);
});
```

## Migration Strategy

### Initial Setup
1. Run `001_initial_schema.sql` migration
2. Verify all tables, indexes, and functions are created
3. Insert default filter templates
4. Test with sample data

### Future Migrations
- Follow numbered migration pattern: `002_add_feature.sql`
- Always include rollback procedures
- Test migrations on staging environment first

## Security Considerations

- **SQL Injection Prevention**: All queries use parameterized statements
- **Access Control**: User-based filtering in queries
- **Data Validation**: JSON schema validation for structured data
- **Audit Trail**: Timestamps and user tracking for all operations

## Monitoring and Maintenance

### Health Checks
```typescript
const health = await db.healthCheck();
console.log(`Database: ${health.healthy ? 'OK' : 'FAIL'} (${health.latency}ms)`);
```

### Statistics
```typescript
const stats = await db.getTokenStatistics();
// Returns: { total, active, analyzed, recentlyAdded }
```

### Cleanup Operations
```typescript
// Remove expired alerts
const removed = await db.cleanupExpiredAlerts();
```

## Environment Configuration

Required environment variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=memecoin_trading
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=true  # for production
```

## File Structure

```
src/database/
├── tokens.sql              # Token table schema
├── token_analysis.sql      # Analysis table schema
├── filters.sql             # Filter tables schema
├── alerts.sql              # Alert tables schema
├── DatabaseService.ts      # Main service class
├── test-integration.ts     # Integration tests
└── migrations/
    └── 001_initial_schema.sql  # Complete initial migration
```

This schema provides a robust foundation for the memecoin trading algorithm with proper typing, performance optimization, and scalability considerations.