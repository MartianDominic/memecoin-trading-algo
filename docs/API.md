# Memecoin Trading Algorithm API Documentation

## Overview

The Memecoin Trading Algorithm provides a comprehensive API for discovering, analyzing, and tracking memecoin tokens on the Solana blockchain. The system offers real-time price monitoring, safety analysis, and trading signal generation.

## Base URL

**Development:** `http://localhost:3000`
**WebSocket:** `ws://localhost:3002/ws`

## Authentication

Most endpoints require API key authentication. Include your API key in the header:

```http
Authorization: Bearer YOUR_API_KEY
```

## Rate Limiting

- **Default:** 100 requests per minute per IP
- **Authenticated:** 1000 requests per minute per API key

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when window resets

## Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_123456",
    "processingTime": 150
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_NOT_FOUND",
    "message": "Token with address 'abc123' not found",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_123456"
  }
}
```

---

## Endpoints

### Health Check

#### GET /health

Check API health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "version": "1.0.0",
    "services": {
      "database": "connected",
      "redis": "connected",
      "websocket": "active"
    }
  }
}
```

---

### Token Discovery

#### GET /api/tokens/discover

Discover new tokens based on filters.

**Query Parameters:**
- `minLiquidity` (number): Minimum liquidity in USD (default: 10000)
- `minVolume24h` (number): Minimum 24h volume (default: 50000)
- `maxAge` (string): Maximum token age (e.g., "24h", "7d")
- `limit` (number): Maximum results (default: 50, max: 100)

**Example Request:**
```http
GET /api/tokens/discover?minLiquidity=25000&minVolume24h=100000&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": [
      {
        "address": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
        "symbol": "BONK",
        "name": "Bonk",
        "decimals": 5,
        "totalSupply": "100000000000000",
        "chain": "solana",
        "createdAt": "2024-01-01T12:00:00.000Z",
        "metrics": {
          "price": 0.0000234,
          "marketCap": 234000000,
          "volume24h": 12500000,
          "liquidity": 45000,
          "priceChange24h": 15.7,
          "holders": 125000
        },
        "safety": {
          "riskScore": 35,
          "liquidityRisk": 3,
          "ownershipRisk": 4,
          "tradingRisk": 2,
          "technicalRisk": 3,
          "isRugPull": false,
          "isHoneypot": false
        }
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "hasNext": true
    }
  }
}
```

#### POST /api/tokens/analyze

Analyze a specific token by address.

**Request Body:**
```json
{
  "address": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  "deepAnalysis": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": {
      "address": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
      "symbol": "BONK",
      "name": "Bonk",
      "analysis": {
        "overallRating": "MODERATE_RISK",
        "riskScore": 45,
        "strengths": [
          "High trading volume",
          "Large holder base",
          "Good liquidity"
        ],
        "risks": [
          "High concentration in top holders",
          "Recent price volatility"
        ],
        "recommendation": "MONITOR",
        "confidence": 0.85
      }
    }
  }
}
```

---

### Token Tracking

#### GET /api/tokens

Get tracked tokens with filtering.

**Query Parameters:**
- `status` (string): Filter by status (active, inactive, all)
- `riskLevel` (string): Filter by risk (low, medium, high)
- `sortBy` (string): Sort field (price, volume, marketCap, riskScore)
- `order` (string): Sort order (asc, desc)
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": [...],
    "pagination": {
      "total": 500,
      "page": 1,
      "limit": 20,
      "totalPages": 25
    }
  }
}
```

#### GET /api/tokens/:address

Get detailed information for a specific token.

**Path Parameters:**
- `address` (string): Token contract address

**Response:**
```json
{
  "success": true,
  "data": {
    "token": {
      "address": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
      "symbol": "BONK",
      "name": "Bonk",
      "decimals": 5,
      "currentMetrics": {
        "price": 0.0000234,
        "priceUsd": 0.0000234,
        "marketCap": 234000000,
        "volume24h": 12500000,
        "volumeChange24h": 25.3,
        "priceChange1h": 2.1,
        "priceChange24h": 15.7,
        "priceChange7d": -8.5,
        "liquidity": 45000,
        "holders": 125000,
        "lastUpdated": "2024-01-01T12:00:00.000Z"
      },
      "historicalData": [
        {
          "timestamp": "2024-01-01T11:00:00.000Z",
          "price": 0.0000220,
          "volume": 11200000,
          "marketCap": 220000000
        }
      ],
      "safetyAnalysis": {
        "lastAnalyzed": "2024-01-01T11:30:00.000Z",
        "riskScore": 35,
        "riskLevel": "MODERATE",
        "factors": {
          "liquidity": { "score": 8, "status": "GOOD" },
          "ownership": { "score": 6, "status": "MODERATE" },
          "trading": { "score": 7, "status": "GOOD" },
          "technical": { "score": 8, "status": "GOOD" }
        },
        "flags": [],
        "isRugPull": false,
        "isHoneypot": false,
        "confidence": 0.92
      }
    }
  }
}
```

#### PUT /api/tokens/:address/watch

Add token to watchlist.

**Request Body:**
```json
{
  "alertThresholds": {
    "priceChangePercent": 20,
    "volumeThreshold": 1000000,
    "riskScoreThreshold": 70
  }
}
```

#### DELETE /api/tokens/:address/watch

Remove token from watchlist.

---

### Real-time Data

#### GET /api/tokens/:address/live

Get real-time token data stream endpoint info.

**Response:**
```json
{
  "success": true,
  "data": {
    "streamUrl": "ws://localhost:3002/ws",
    "subscriptionTopic": "token_updates_4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    "authentication": {
      "required": true,
      "method": "bearer_token"
    }
  }
}
```

---

### Trading Signals

#### GET /api/signals

Get trading signals based on analysis.

**Query Parameters:**
- `type` (string): Signal type (buy, sell, watch, all)
- `confidence` (number): Minimum confidence (0-1)
- `timeframe` (string): Signal timeframe (1h, 4h, 1d)
- `limit` (number): Maximum results

**Response:**
```json
{
  "success": true,
  "data": {
    "signals": [
      {
        "id": "signal_123",
        "tokenAddress": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
        "type": "BUY",
        "confidence": 0.85,
        "strength": "STRONG",
        "reasoning": [
          "Breaking resistance at $0.000025",
          "Volume spike (+150%)",
          "Positive momentum indicators"
        ],
        "targetPrice": 0.000030,
        "stopLoss": 0.000020,
        "riskReward": 2.5,
        "timeframe": "4h",
        "validUntil": "2024-01-01T16:00:00.000Z",
        "createdAt": "2024-01-01T12:00:00.000Z"
      }
    ]
  }
}
```

#### POST /api/signals/custom

Create custom signal based on criteria.

**Request Body:**
```json
{
  "name": "High Volume Breakout",
  "criteria": {
    "priceChange24h": { "min": 10 },
    "volumeChange24h": { "min": 100 },
    "riskScore": { "max": 50 },
    "liquidity": { "min": 25000 }
  },
  "alertSettings": {
    "webhook": "https://your-app.com/webhook",
    "email": true
  }
}
```

---

### Analytics

#### GET /api/analytics/market

Get market-wide analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "marketSummary": {
      "totalTokens": 15234,
      "activeTokens": 8765,
      "totalMarketCap": 45000000000,
      "total24hVolume": 2300000000,
      "averageRiskScore": 42.5,
      "newTokens24h": 234
    },
    "topPerformers": [
      {
        "address": "...",
        "symbol": "TOKEN1",
        "priceChange24h": 156.7
      }
    ],
    "riskDistribution": {
      "low": 3421,
      "moderate": 4123,
      "high": 1221
    }
  }
}
```

#### GET /api/analytics/tokens/:address/history

Get historical analytics for a token.

**Query Parameters:**
- `timeframe` (string): 1h, 4h, 1d, 1w, 1m
- `metrics` (string): Comma-separated list (price, volume, holders)

---

### Alerts

#### GET /api/alerts

Get user alerts.

#### POST /api/alerts

Create new alert.

**Request Body:**
```json
{
  "name": "BONK Price Alert",
  "tokenAddress": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  "conditions": {
    "priceChange24h": { "threshold": 20, "direction": "above" },
    "volume24h": { "threshold": 1000000, "direction": "above" }
  },
  "actions": {
    "webhook": "https://your-app.com/alert",
    "email": true
  },
  "isActive": true
}
```

#### PUT /api/alerts/:id

Update alert.

#### DELETE /api/alerts/:id

Delete alert.

---

## WebSocket API

### Connection

Connect to WebSocket server:

```javascript
const ws = new WebSocket('ws://localhost:3002/ws');

// Authentication
ws.send(JSON.stringify({
  type: 'AUTH',
  token: 'your_api_key'
}));
```

### Subscriptions

#### Price Updates

```javascript
// Subscribe to price updates
ws.send(JSON.stringify({
  type: 'SUBSCRIBE',
  channel: 'price_updates',
  tokens: ['4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R']
}));

// Receive updates
{
  "type": "PRICE_UPDATE",
  "data": {
    "address": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    "symbol": "BONK",
    "price": 0.0000234,
    "priceChange24h": 15.7,
    "volume24h": 12500000,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Alert Notifications

```javascript
// Subscribe to alerts
ws.send(JSON.stringify({
  type: 'SUBSCRIBE',
  channel: 'alerts',
  filters: {
    severity: ['HIGH', 'CRITICAL']
  }
}));

// Receive alerts
{
  "type": "ALERT",
  "data": {
    "id": "alert_123",
    "tokenAddress": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    "alertType": "PRICE_SPIKE",
    "severity": "HIGH",
    "message": "BONK price increased 25% in 5 minutes",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_TOKEN_ADDRESS` | Token address format is invalid |
| `TOKEN_NOT_FOUND` | Token not found in database |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `INSUFFICIENT_PERMISSIONS` | API key lacks required permissions |
| `INVALID_PARAMETERS` | Request parameters are invalid |
| `SERVICE_UNAVAILABLE` | External service unavailable |
| `ANALYSIS_FAILED` | Token analysis failed |
| `SUBSCRIPTION_FAILED` | WebSocket subscription failed |

---

## SDKs and Examples

### JavaScript/Node.js

```javascript
const MemecoinAPI = require('memecoin-trading-api');

const client = new MemecoinAPI({
  apiKey: 'your_api_key',
  baseUrl: 'http://localhost:3000'
});

// Discover new tokens
const tokens = await client.tokens.discover({
  minLiquidity: 25000,
  minVolume24h: 100000
});

// Get real-time updates
const ws = client.createWebSocket();
ws.subscribe('price_updates', ['token_address']);
ws.on('price_update', (data) => {
  console.log('Price update:', data);
});
```

### Python

```python
import memecoin_api

client = memecoin_api.Client(
    api_key='your_api_key',
    base_url='http://localhost:3000'
)

# Discover tokens
tokens = client.tokens.discover(
    min_liquidity=25000,
    min_volume_24h=100000
)

# Analyze token
analysis = client.tokens.analyze('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R')
```

---

## Rate Limits and Best Practices

1. **Respect Rate Limits**: Stay within your rate limits to avoid throttling
2. **Use WebSockets**: For real-time data, use WebSocket connections instead of polling
3. **Batch Requests**: When possible, batch multiple token requests
4. **Cache Results**: Cache non-real-time data to reduce API calls
5. **Handle Errors**: Implement proper error handling and retry logic
6. **Use Filters**: Apply appropriate filters to reduce response sizes

---

## Support

For API support, documentation updates, or feature requests:

- **GitHub Issues**: [github.com/your-repo/memecoin-trading-algo/issues](https://github.com/your-repo/memecoin-trading-algo/issues)
- **Documentation**: [docs.memecoin-trading.com](https://docs.memecoin-trading.com)
- **Status Page**: [status.memecoin-trading.com](https://status.memecoin-trading.com)