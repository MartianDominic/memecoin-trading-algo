#!/bin/bash

# Complete Memecoin Trading Algorithm Deployment Script
# This script sets up and starts the entire system

set -e  # Exit on any error

echo "🚀 Starting Complete Memecoin Trading Algorithm Deployment"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}==== $1 ====${NC}"
}

# Check prerequisites
print_header "Checking Prerequisites"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

print_status "Node.js version: $(node --version) ✓"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL CLI not found. Make sure PostgreSQL is installed and running."
fi

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    print_warning "Redis CLI not found. Make sure Redis is installed and running."
fi

# Set up environment variables
print_header "Setting up Environment"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file..."
    cat > .env << EOL
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=memecoin_trading
DB_USERNAME=postgres
DB_PASSWORD=your_password_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# API Configuration
PORT=3000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here

# External API Keys (Replace with your actual keys)
DEXSCREENER_API_KEY=
RUGCHECK_API_KEY=
JUPITER_API_KEY=
SOLSCAN_API_KEY=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket Configuration
WEBSOCKET_PORT=3002

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3002
EOL
    print_warning "⚠️  Please edit .env file with your actual database credentials and API keys"
    print_warning "⚠️  The system will use fallback simulation data for missing API keys"
fi

# Install backend dependencies
print_header "Installing Backend Dependencies"
print_status "Installing Node.js dependencies..."
npm install

# Add any missing dependencies
print_status "Installing additional dependencies..."
npm install --save express cors helmet compression morgan
npm install --save socket.io ws
npm install --save pg redis ioredis
npm install --save node-cron axios
npm install --save joi zod
npm install --save winston
npm install --save-dev @types/express @types/node @types/cors
npm install --save-dev @types/morgan @types/pg
npm install --save-dev jest ts-jest @types/jest
npm install --save-dev nodemon ts-node

# Set up database
print_header "Setting up Database"

# Source environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Create database if it doesn't exist
print_status "Creating database if it doesn't exist..."
createdb "$DB_NAME" 2>/dev/null || print_status "Database already exists or creation failed - continuing..."

# Run migrations
print_status "Running database migrations..."
if [ -f "src/database/migrations/001_initial_schema.sql" ]; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -f src/database/migrations/001_initial_schema.sql
    print_status "Database schema created ✓"
else
    print_warning "Migration file not found, skipping database setup"
fi

# Install frontend dependencies
print_header "Setting up Frontend"
cd frontend

# Check if package.json exists
if [ ! -f package.json ]; then
    print_status "Initializing Next.js frontend..."
    npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
fi

print_status "Installing frontend dependencies..."
npm install

# Install shadcn/ui if not already installed
if [ ! -f "components.json" ]; then
    print_status "Setting up shadcn/ui..."
    npx shadcn@latest init --yes
fi

# Install required shadcn components
print_status "Installing shadcn/ui components..."
npx shadcn@latest add table card badge button input select form tabs sidebar alert chart data-table

# Install additional frontend dependencies
npm install --save @tanstack/react-query @tanstack/react-table
npm install --save zustand socket.io-client
npm install --save recharts lucide-react
npm install --save axios date-fns
npm install --save react-hook-form @hookform/resolvers
npm install --save zod

cd ..

# Build the frontend
print_header "Building Frontend"
cd frontend
npm run build
cd ..

# Compile TypeScript backend
print_header "Building Backend"
print_status "Compiling TypeScript..."
npx tsc

# Create startup scripts
print_header "Creating Startup Scripts"

# Backend startup script
cat > scripts/start-backend.sh << 'EOL'
#!/bin/bash
echo "🔧 Starting Backend Services..."

# Start the aggregation service (5-minute scheduler)
echo "Starting token aggregation service..."
NODE_ENV=development node dist/services/token-aggregator.service.js &
AGGREGATOR_PID=$!

# Start the API server
echo "Starting API server on port 3000..."
NODE_ENV=development node dist/api/api-server.js &
API_PID=$!

# Start WebSocket server
echo "Starting WebSocket server on port 3002..."
NODE_ENV=development node dist/api/websocket/websocket-manager.js &
WS_PID=$!

echo "Backend services started:"
echo "  - API Server: http://localhost:3000"
echo "  - WebSocket: ws://localhost:3002"
echo "  - Aggregation Service: Running every 5 minutes"

# Save PIDs for cleanup
echo $AGGREGATOR_PID > .aggregator.pid
echo $API_PID > .api.pid
echo $WS_PID > .ws.pid

wait
EOL

# Frontend startup script
cat > scripts/start-frontend.sh << 'EOL'
#!/bin/bash
echo "🎨 Starting Frontend..."
cd frontend
npm run dev
EOL

# Complete system startup script
cat > scripts/start-all.sh << 'EOL'
#!/bin/bash
echo "🚀 Starting Complete Memecoin Trading System..."

# Start backend services in background
./scripts/start-backend.sh &

# Wait a moment for backend to start
sleep 5

# Start frontend
echo "Starting frontend dashboard..."
./scripts/start-frontend.sh
EOL

# Stop script
cat > scripts/stop-all.sh << 'EOL'
#!/bin/bash
echo "🛑 Stopping all services..."

# Kill backend processes
if [ -f .aggregator.pid ]; then
    kill $(cat .aggregator.pid) 2>/dev/null
    rm .aggregator.pid
fi

if [ -f .api.pid ]; then
    kill $(cat .api.pid) 2>/dev/null
    rm .api.pid
fi

if [ -f .ws.pid ]; then
    kill $(cat .ws.pid) 2>/dev/null
    rm .ws.pid
fi

# Kill any remaining node processes
pkill -f "token-aggregator"
pkill -f "api-server"
pkill -f "websocket-manager"

echo "All services stopped."
EOL

# Make scripts executable
chmod +x scripts/*.sh

# Create quick start documentation
print_header "Creating Documentation"

cat > QUICK_START.md << 'EOL'
# Memecoin Trading Algorithm - Quick Start Guide

## 🚀 System Architecture

Your memecoin trading algorithm consists of:

1. **Data Aggregation Service** - Collects data every 5 minutes from:
   - DEXScreener (token discovery & metrics)
   - RugCheck (security analysis)
   - Jupiter (routing & slippage)
   - Solscan (creator & holder analysis)

2. **Filter Pipeline** - Applies your criteria:
   - Age: <24h, >30min
   - Liquidity: >$5k
   - Volume: >$1k
   - Safety: ≥6/10, no honeypot
   - Routing: exists, <10% slippage on $500
   - Creator: <3 rugs, top 3 holders <60%

3. **Real-time Dashboard** - Next.js frontend with:
   - Live token table with filtering
   - Custom filter builder
   - Real-time alerts
   - Export functionality
   - Charts and analytics

## 🏃‍♂️ Quick Start

### 1. Configure Environment
```bash
# Edit .env file with your database credentials and API keys
nano .env
```

### 2. Start the Complete System
```bash
# Start everything (backend + frontend)
./scripts/start-all.sh
```

### 3. Access the Dashboard
- **Frontend Dashboard**: http://localhost:3001
- **API Documentation**: http://localhost:3000/api/v1/docs
- **Health Check**: http://localhost:3000/health

## 🔧 Individual Services

### Start Backend Only
```bash
./scripts/start-backend.sh
```

### Start Frontend Only
```bash
./scripts/start-frontend.sh
```

### Stop All Services
```bash
./scripts/stop-all.sh
```

## 📊 API Endpoints

### Tokens
- `GET /api/v1/tokens` - List filtered tokens
- `GET /api/v1/tokens/:address` - Token details
- `POST /api/v1/tokens/analyze` - Manual analysis

### Filters
- `GET /api/v1/filters` - List saved filters
- `POST /api/v1/filters` - Create custom filter
- `POST /api/v1/filters/:id/execute` - Run filter

### Alerts
- `GET /api/v1/alerts` - Get alerts
- `POST /api/v1/alerts/:id/acknowledge` - Mark as read

### Analytics
- `GET /api/v1/analytics/summary` - Dashboard stats
- `GET /api/v1/analytics/trends` - Market trends

### Export
- `POST /api/v1/export/tokens` - Export data (CSV/JSON)

## 🔍 Monitoring

### Real-time Events (WebSocket)
- `token:new` - New token discovered
- `token:updated` - Token data updated
- `alert:new` - New alert generated
- `filter:result` - Filter execution results

### Health Checks
- **API Health**: `GET /api/v1/health`
- **Database**: Automatic connection testing
- **External APIs**: Service status monitoring

## 🛠️ Troubleshooting

### Database Connection Issues
1. Ensure PostgreSQL is running
2. Check credentials in `.env`
3. Verify database exists: `createdb memecoin_trading`

### Missing API Data
- System uses simulation data when API keys are missing
- Add real API keys to `.env` for live data

### Port Conflicts
- API Server: 3000
- WebSocket: 3002
- Frontend: 3001

### Performance Tuning
- Adjust `RATE_LIMIT_MAX_REQUESTS` in `.env`
- Configure database connection pooling
- Enable Redis caching

## 📈 Usage Examples

### Custom Filter Creation
```javascript
const customFilter = {
  minLiquidity: 10000,    // $10k minimum
  maxAge: 12,             // 12 hours max age
  minSafetyScore: 8,      // High safety only
  maxSlippage: 5          // 5% max slippage
};
```

### Subscribing to Real-time Updates
```javascript
const socket = io('ws://localhost:3002');
socket.on('token:new', (token) => {
  console.log('New token found:', token.symbol);
});
```

## 🔐 Security Notes

- Never commit API keys to version control
- Use environment variables for all secrets
- Enable rate limiting in production
- Regularly update dependencies

## 📚 Next Steps

1. Configure your API keys for live data
2. Set up a production database
3. Deploy to your preferred hosting platform
4. Configure monitoring and alerting
5. Implement automated trading logic

Happy trading! 🚀
EOL

print_header "Deployment Complete!"

echo
echo "✅ Your memecoin trading algorithm is ready!"
echo
echo "🔧 Next steps:"
echo "   1. Edit .env with your database credentials and API keys"
echo "   2. Run: ./scripts/start-all.sh"
echo "   3. Open: http://localhost:3001"
echo
echo "📚 Documentation:"
echo "   - Quick Start: ./QUICK_START.md"
echo "   - API Docs: http://localhost:3000/api/v1/docs"
echo "   - Code Review: ./docs/COMPREHENSIVE_CODE_REVIEW.md"
echo
echo "🎯 The system will:"
echo "   • Discover new tokens every 5 minutes"
echo "   • Apply your filter criteria automatically"
echo "   • Send real-time alerts for opportunities"
echo "   • Provide a live dashboard for monitoring"
echo
print_status "Ready to start trading! 🚀"