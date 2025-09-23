# Memecoin Trading Algorithm - Setup Guide

## 🚀 Quick Start

Get the memecoin trading system up and running in minutes with comprehensive testing.

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download](https://postgresql.org/download/))
- **Redis** 6+ ([Download](https://redis.io/download))
- **Git** ([Download](https://git-scm.com/downloads))

### Installation

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd memecoin-trading-algo

   # Run automated setup
   ./scripts/test-setup.sh
   ```

2. **Manual Setup** (if automated setup fails)
   ```bash
   # Install dependencies
   npm install
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..

   # Setup environment
   cp config/test.env .env

   # Setup database
   cd backend
   npm run db:generate
   npm run db:push
   npm run db:seed
   cd ..
   ```

3. **Start Development Environment**
   ```bash
   # Start all services
   ./scripts/dev-server.sh

   # Or start individual services
   cd backend && npm run dev &
   cd frontend && npm start &
   ```

---

## 📊 Testing Infrastructure

### Test Structure

```
tests/
├── unit/                 # Unit tests
│   ├── services/        # API service tests
│   └── utils/           # Utility function tests
├── integration/         # Integration tests
│   ├── data-pipeline.test.ts
│   ├── websocket.test.ts
│   └── api-endpoints.test.ts
├── e2e/                 # End-to-end tests
├── fixtures/            # Test data
├── mocks/              # Service mocks
├── setup/              # Test setup files
└── utils/              # Test utilities
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=unit
npm test -- --testPathPattern=integration
npm test -- --testPathPattern=e2e

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Specific test file
npm test tests/unit/services/DexScreenerService.test.ts
```

### Test Configuration

Tests are configured with multiple Jest projects:

- **Backend Unit Tests**: Fast, isolated component tests
- **Backend Integration Tests**: Database and API integration
- **Frontend Unit Tests**: React component tests
- **E2E Tests**: Full system workflow tests

### Test Environments

#### Development
- Uses mock APIs for external services
- In-memory test database
- Fast execution

#### Staging
- Real API integrations (with rate limiting)
- Staging database
- Full feature testing

#### Production
- Smoke tests only
- Production monitoring
- Health checks

---

## 🗄️ Database Setup

### PostgreSQL Configuration

1. **Create Database**
   ```bash
   createdb memecoin_trading
   createdb memecoin_test  # For testing
   ```

2. **Configure Environment**
   ```bash
   # .env
   DATABASE_URL="postgresql://username:password@localhost:5432/memecoin_trading"
   ```

3. **Run Migrations**
   ```bash
   cd backend
   npm run db:generate  # Generate Prisma client
   npm run db:push     # Push schema to database
   npm run db:seed     # Seed with initial data
   ```

### Redis Configuration

1. **Start Redis**
   ```bash
   redis-server
   # Or: systemctl start redis
   # Or: brew services start redis
   ```

2. **Configure Environment**
   ```bash
   # .env
   REDIS_URL="redis://localhost:6379"
   ```

---

## 🔧 Environment Configuration

### Environment Files

- `.env` - Development environment
- `.env.test` - Testing environment
- `.env.production` - Production environment

### Required Variables

```bash
# Core Configuration
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/memecoin_trading
REDIS_URL=redis://localhost:6379

# External APIs
DEXSCREENER_BASE_URL=https://api.dexscreener.com/latest
RUGCHECK_BASE_URL=https://api.rugcheck.xyz
JUPITER_BASE_URL=https://quote-api.jup.ag/v6
SOLSCAN_BASE_URL=https://api.solscan.io

# WebSocket
WS_PORT=3002

# Security
JWT_SECRET=your-secret-key
BCRYPT_ROUNDS=12

# Features
ENABLE_SAFETY_ANALYSIS=true
ENABLE_REAL_TIME_UPDATES=true
ENABLE_ALERTS=true

# Rate Limiting
API_RATE_LIMIT_REQUESTS=100
API_RATE_LIMIT_WINDOW=60000
```

---

## 🧪 Test Data and Fixtures

### Test Database

The test suite uses a separate PostgreSQL database with seeded test data:

```typescript
// Test tokens
const testTokens = [
  {
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'TEST1',
    name: 'Test Token 1',
    // ... metrics and safety data
  }
];
```

### Mock Services

External API services are mocked for testing:

- **DexScreener API**: Mock token pair data
- **RugCheck API**: Mock safety analysis
- **Jupiter API**: Mock price data
- **Solscan API**: Mock blockchain data

### Fixtures

Test fixtures provide consistent data for tests:

```javascript
// tests/fixtures/tokens.js
module.exports = {
  validToken: {
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'BONK',
    // ... complete token data
  },

  highRiskToken: {
    // Scam token for safety testing
  }
};
```

---

## 📈 Performance Testing

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Run load tests
artillery run tests/load/api-load-test.yml
artillery run tests/load/websocket-load-test.yml
```

### Benchmarking

```bash
# Run performance benchmarks
npm run benchmark

# Specific benchmarks
npm run benchmark:api
npm run benchmark:database
npm run benchmark:filters
```

### Performance Targets

- **API Response Time**: < 200ms (95th percentile)
- **Database Queries**: < 50ms average
- **WebSocket Latency**: < 100ms
- **Memory Usage**: < 512MB steady state
- **CPU Usage**: < 70% under normal load

---

## 🔍 Monitoring and Debugging

### Health Checks

```bash
# Check service health
curl http://localhost:3000/health

# Detailed health check
curl http://localhost:3000/health/detailed
```

### Logging

```bash
# View logs
tail -f logs/app.log
tail -f logs/error.log
tail -f logs/websocket.log

# Log levels
export LOG_LEVEL=debug  # debug, info, warn, error
```

### Debugging

```javascript
// Enable debug mode
DEBUG=memecoin:* npm run dev

// Database debugging
DEBUG=prisma:* npm run dev

// WebSocket debugging
DEBUG=ws npm run dev
```

---

## 🚀 Deployment

### Development Deployment

```bash
# Start all services
./scripts/dev-server.sh

# Services will be available at:
# - Backend API: http://localhost:3000
# - WebSocket: ws://localhost:3002/ws
# - Frontend: http://localhost:3001
```

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
npm start

# With PM2 process manager
pm2 start ecosystem.config.js
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Production environment
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔧 Development Workflow

### Code Quality

```bash
# Linting
npm run lint
npm run lint:fix

# Type checking
npm run typecheck

# Formatting
npm run format

# Pre-commit hooks
npm run pre-commit
```

### Testing Workflow

1. **Write Tests First** (TDD)
   ```bash
   # Create test file
   cp tests/templates/service.test.ts tests/unit/services/NewService.test.ts

   # Write failing tests
   npm test -- --watch tests/unit/services/NewService.test.ts
   ```

2. **Implement Feature**
   ```bash
   # Implement to make tests pass
   # Run tests continuously
   npm test -- --watch
   ```

3. **Integration Testing**
   ```bash
   # Test integration
   npm run test:integration

   # Test full pipeline
   npm run test:e2e
   ```

### Git Workflow

```bash
# Feature branch
git checkout -b feature/new-feature

# Commit with tests
git add tests/unit/services/NewService.test.ts
git add src/services/NewService.ts
git commit -m "feat: add new service with comprehensive tests"

# Run pre-push checks
npm run pre-push

# Create pull request
gh pr create --title "Add new service" --body "Comprehensive implementation with tests"
```

---

## 📚 Additional Resources

### Documentation

- [API Documentation](./API.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Testing Strategy](./TESTING.md)
- [Deployment Guide](./DEPLOYMENT.md)

### Tools and Scripts

- `./scripts/test-setup.sh` - Automated test environment setup
- `./scripts/dev-server.sh` - Development server startup
- `./scripts/integration.js` - Full integration testing
- `./scripts/benchmark.sh` - Performance benchmarking

### Troubleshooting

#### Common Issues

1. **Port Already in Use**
   ```bash
   # Find and kill process on port
   lsof -ti:3000 | xargs kill -9
   ```

2. **Database Connection Failed**
   ```bash
   # Check PostgreSQL status
   pg_isready -h localhost -p 5432

   # Restart PostgreSQL
   sudo systemctl restart postgresql
   ```

3. **Redis Connection Failed**
   ```bash
   # Check Redis status
   redis-cli ping

   # Start Redis
   redis-server --daemonize yes
   ```

4. **Test Database Issues**
   ```bash
   # Reset test database
   cd backend
   npm run db:reset
   npm run db:seed
   ```

#### Getting Help

- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Join discussions for questions and ideas
- **Documentation**: Check the `/docs` folder for detailed guides
- **Logs**: Check `/logs` folder for detailed error information

---

## 🎯 Next Steps

After setup is complete:

1. **Explore the API** using the provided documentation
2. **Run the test suite** to understand the system behavior
3. **Check the real-time dashboard** at http://localhost:3001
4. **Review the monitoring** and health check endpoints
5. **Customize filters** and alerts for your trading strategy

Happy trading! 🚀📈