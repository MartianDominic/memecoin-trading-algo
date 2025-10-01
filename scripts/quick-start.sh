#!/bin/bash

# =============================================================================
# MEMECOIN TRADING ALGORITHM - QUICK START SCRIPT
# =============================================================================
# One-command setup and start for development

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=============================================="
echo "🚀 MEMECOIN TRADING - QUICK START"
echo "=============================================="
echo -e "${NC}"

# Step 1: Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Setting up environment...${NC}"
    cp .env.example .env
    echo "✅ Created .env file"
    echo "⚠️  Please edit .env with your actual passwords:"
    echo "   - DB_PASSWORD"
    echo "   - REDIS_PASSWORD"
    echo "   - JWT_SECRET"
    echo ""
    echo "Press Enter to continue with default values or Ctrl+C to edit .env first..."
    read -r
fi

# Step 2: Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Step 3: Start databases
echo -e "${YELLOW}🗄️  Starting databases...${NC}"
if command -v docker-compose &> /dev/null; then
    docker-compose up -d postgres redis
elif docker compose version &> /dev/null; then
    docker compose up -d postgres redis
else
    echo "❌ Docker not available. Please start PostgreSQL and Redis manually."
    exit 1
fi

# Step 4: Wait for databases
echo -e "${YELLOW}⏳ Waiting for databases...${NC}"
sleep 8

# Step 5: Setup database schema
echo -e "${YELLOW}🏗️  Setting up database...${NC}"
npx prisma generate
npx prisma db push || echo "⚠️  Database push failed - continuing anyway"

# Step 6: Build project
echo -e "${YELLOW}🔨 Building project...${NC}"
npm run build

# Step 7: Start all services
echo -e "${YELLOW}🚀 Starting all services...${NC}"

# Start services in background
npm run start:api &
API_PID=$!

npm run start:websocket &
WS_PID=$!

npm run dev &
DEV_PID=$!

# Store PIDs for cleanup
echo $API_PID > .api.pid
echo $WS_PID > .ws.pid
echo $DEV_PID > .dev.pid

# Wait a moment for services to start
sleep 5

echo -e "${GREEN}"
echo "✅ ALL SERVICES STARTED SUCCESSFULLY!"
echo ""
echo "🌐 Available services:"
echo "   Main App:    http://localhost:3000"
echo "   API Server:  http://localhost:3001"
echo "   WebSocket:   ws://localhost:8080"
echo "   PostgreSQL:  localhost:5432"
echo "   Redis:       localhost:6379"
echo ""
echo "📚 Management commands:"
echo "   ./scripts/health-check.sh  - Check service health"
echo "   ./scripts/stop-all.sh      - Stop all services"
echo "   docker-compose logs -f     - View all logs"
echo ""
echo "Press Ctrl+C to stop all services"
echo -e "${NC}"

# Wait for interrupt
trap 'echo "Stopping services..."; kill $API_PID $WS_PID $DEV_PID 2>/dev/null; docker-compose down; rm -f .*.pid; exit' INT

# Keep script running
wait