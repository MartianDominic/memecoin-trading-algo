# 🚀 Memecoin Trading Algorithm

A comprehensive, real-time memecoin trading algorithm that automatically discovers, analyzes, and filters tokens on Solana using multiple data sources and advanced filtering criteria.

## 🎯 System Overview

This system combines 4 external APIs to create a powerful token analysis pipeline:

1. **DEXScreener** → Token discovery and market metrics
2. **RugCheck** → Security analysis and honeypot detection
3. **Jupiter** → Routing analysis and slippage calculation
4. **Solscan** → Creator behavior and holder distribution

Every 5 minutes, the system:
- Discovers new tokens
- Applies comprehensive filtering
- Stores high-quality opportunities
- Sends real-time alerts
- Updates the live dashboard

## ✨ Key Features

### 🔍 **Automated Token Discovery**
- Scans for tokens launched in the last 24 hours
- Applies multi-stage filtering pipeline
- Real-time processing every 5 minutes

### 🛡️ **Advanced Security Analysis**
- Honeypot detection
- Mint/freeze authority checks
- Creator rug history analysis
- Holder concentration monitoring

### 📊 **Comprehensive Filtering**
- **Age**: < 24 hours, > 30 minutes
- **Liquidity**: > $5,000
- **Volume**: > $1,000 (24h)
- **Safety Score**: ≥ 6/10
- **No Honeypot Risk**
- **Jupiter Routing**: Available with < 10% slippage on $500
- **Creator History**: < 3 previous rugs
- **Holder Distribution**: Top 3 holders < 60% total supply

### 🎨 **Modern Dashboard**
- Real-time token table with advanced filtering
- Custom filter builder
- Interactive charts and analytics
- Alert notifications
- Export functionality (CSV/JSON)
- Mobile-responsive design

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Frontend (Next.js)                  │
│  • Real-time dashboard with shadcn/ui components    │
│  • Custom filter builder                           │
│  • WebSocket integration for live updates          │
└─────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│                API Layer (Express.js)               │
│  • REST endpoints                                   │
│  • WebSocket server                                │
│  • Authentication & rate limiting                  │
└─────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│            Token Aggregation Service                │
│  • 5-minute scheduler (node-cron)                  │
│  • Parallel API processing                         │
│  • Multi-stage filtering pipeline                  │
└─────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ DEXScreener │  │  RugCheck   │  │   Jupiter   │
│   Service   │  │   Service   │  │   Service   │
└─────────────┘  └─────────────┘  └─────────────┘
        ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              Database (PostgreSQL)                  │
│  • Token metadata & analysis results               │
│  • Custom filters & user preferences              │
│  • Alert history & notifications                  │
└─────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis (optional, for caching)

### 1. Clone and Setup
```bash
git clone <your-repo>
cd memecoin-trading-algo

# Run the complete deployment script
chmod +x scripts/deploy-complete-system.sh
./scripts/deploy-complete-system.sh
```

### 2. Configure Environment
Edit `.env` with your database credentials and API keys:
```bash
nano .env
```

### 3. Start the System
```bash
# Start everything (backend + frontend)
npm run start:all

# Or start components individually:
npm run start:aggregator  # 5-minute data collection
npm run start:api        # REST API server
npm run start:websocket  # Real-time updates
```

### 4. Access the Dashboard
- **Frontend**: http://localhost:3001
- **API**: http://localhost:3000
- **WebSocket**: ws://localhost:3002

## 📖 API Documentation

### Token Endpoints
```bash
GET /api/v1/tokens              # List filtered tokens
GET /api/v1/tokens/:address     # Token details
POST /api/v1/tokens/analyze     # Manual analysis
```

### Filter Management
```bash
GET /api/v1/filters             # List saved filters
POST /api/v1/filters            # Create custom filter
POST /api/v1/filters/:id/execute # Run filter
```

### Real-time Events
```javascript
// WebSocket connection
const socket = io('ws://localhost:3002');

// Subscribe to events
socket.on('token:new', (token) => {
  console.log('New opportunity:', token);
});

socket.on('alert:new', (alert) => {
  console.log('Alert:', alert.message);
});
```

## 🛠️ Development

### Project Structure
```
src/
├── api/                    # Express.js API layer
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Express middleware
│   ├── routes/            # API route definitions
│   └── websocket/         # WebSocket management
├── services/              # External API integrations
│   ├── dexscreener.service.ts
│   ├── rugcheck.service.ts
│   ├── jupiter.service.ts
│   ├── solscan.service.ts
│   └── token-aggregator.service.ts
├── database/              # Database schema & operations
├── types/                 # TypeScript type definitions
└── utils/                 # Shared utilities

frontend/                  # Next.js frontend
├── src/
│   ├── app/              # App Router pages
│   ├── components/       # React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities & API client
│   └── stores/          # Zustand state management
└── public/              # Static assets
```

### Available Scripts
```bash
npm run build             # Build TypeScript
npm run dev              # Development mode
npm run test             # Run tests
npm run lint             # Lint code
npm run db:migrate       # Run database migrations
npm run health           # Check system health
```

## 🔧 Configuration

### Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=memecoin_trading
DB_USERNAME=postgres
DB_PASSWORD=your_password

# External APIs (optional - uses simulation if missing)
DEXSCREENER_API_KEY=your_key
RUGCHECK_API_KEY=your_key
JUPITER_API_KEY=your_key
SOLSCAN_API_KEY=your_key

# API Configuration
PORT=3000
WEBSOCKET_PORT=3002
RATE_LIMIT_MAX_REQUESTS=100
```

### Filter Customization
Modify the filter criteria in `src/services/token-aggregator.service.ts`:
```typescript
const filters: TokenFilterCriteria = {
  maxAge: 24,              // Maximum age in hours
  minLiquidity: 5000,      // Minimum liquidity in USD
  minVolume: 1000,         // Minimum 24h volume in USD
  minSafetyScore: 6,       // Minimum safety score (0-10)
  maxSlippage: 10,         // Maximum slippage percentage
  maxCreatorRugs: 2,       // Maximum creator rug history
  maxTopHoldersPercentage: 60  // Maximum top holder concentration
};
```

## 📊 Dashboard Features

### Token Table
- Real-time updates every 5 minutes
- Advanced sorting and filtering
- Export to CSV/JSON
- Pagination and search

### Filter Builder
- Visual filter creation
- Save and share filters
- Real-time preview
- Template filters

### Analytics
- Market overview statistics
- Top movers and gainers
- Risk distribution charts
- Performance metrics

### Alerts
- Real-time notifications
- Severity levels (low, medium, high)
- Custom alert rules
- Alert history

## 🔒 Security

- API key authentication
- Rate limiting (100 requests/15min)
- Input validation and sanitization
- SQL injection prevention
- CORS configuration
- Request logging and monitoring

## 📈 Performance

- **5-minute data collection** cycle
- **Parallel API processing** (up to 10 concurrent)
- **Redis caching** for improved response times
- **Database connection pooling**
- **WebSocket** for real-time updates
- **Optimized database queries** with proper indexing

## 🧪 Testing

```bash
npm test                 # Run all tests
npm run test:coverage    # Coverage report
npm run test:integration # Integration tests
```

## 🚀 Deployment

### Production Setup
1. Use environment variables for all secrets
2. Enable database SSL connections
3. Configure Redis for session storage
4. Set up monitoring and logging
5. Enable rate limiting and security headers

### Docker Support (Optional)
```dockerfile
# Add to Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000 3002
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Documentation**: Check `/docs/` directory
- **API Reference**: http://localhost:3000/api/v1/docs
- **Health Check**: http://localhost:3000/health
- **Logs**: Check `logs/app.log`

## 🎯 Roadmap

- [ ] Machine learning price prediction
- [ ] Automated trading execution
- [ ] Multi-chain support (Ethereum, BSC)
- [ ] Advanced charting with TradingView
- [ ] Portfolio management features
- [ ] Social sentiment analysis
- [ ] Mobile app (React Native)

---

**Happy Trading! 🚀**

Built with ❤️ using Node.js, TypeScript, PostgreSQL, Next.js, and shadcn/ui.