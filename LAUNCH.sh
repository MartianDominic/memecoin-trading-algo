#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════"
echo "  MEMECOIN TRADING ALGORITHM - LAUNCH SCRIPT"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Change to project directory
cd "$(dirname "$0")"

# Step 1: Check .env file
echo "Step 1: Checking environment configuration..."
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found!${NC}"
    echo "Creating .env from example..."
    cp .env.example .env
    echo -e "${YELLOW}Please edit .env and update the following:${NC}"
    echo "  - DB_PASSWORD"
    echo "  - DATABASE_URL"
    echo "  - REDIS_PASSWORD (if using Redis)"
    echo "  - JWT_SECRET"
    echo ""
    echo "Press Enter after updating .env file, or Ctrl+C to exit..."
    read
fi
echo -e "${GREEN}✓ .env file exists${NC}"
echo ""

# Step 2: Check PostgreSQL
echo "Step 2: Checking PostgreSQL..."
if ! systemctl is-active --quiet postgresql 2>/dev/null && ! pg_isready 2>/dev/null; then
    echo -e "${YELLOW}⚠ PostgreSQL not running, attempting to start...${NC}"
    sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start || {
        echo -e "${RED}✗ Failed to start PostgreSQL${NC}"
        echo "Please start PostgreSQL manually:"
        echo "  sudo systemctl start postgresql"
        exit 1
    }
fi
echo -e "${GREEN}✓ PostgreSQL is running${NC}"
echo ""

# Step 3: Check Redis (optional)
echo "Step 3: Checking Redis (optional for caching)..."
if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${YELLOW}⚠ Redis not running (app will work without it)${NC}"
    read -p "Try to start Redis? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        redis-server --daemonize yes 2>/dev/null || \
        sudo systemctl start redis-server 2>/dev/null || \
        sudo service redis-server start 2>/dev/null || \
        echo -e "${YELLOW}Could not start Redis automatically${NC}"
    fi
fi
echo ""

# Step 4: Create database
echo "Step 4: Setting up database..."
source .env 2>/dev/null || true

# Check if database exists
if sudo -u postgres psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw memecoin_trading; then
    echo -e "${GREEN}✓ Database already exists${NC}"
else
    echo "Creating database..."
    sudo -u postgres psql -c "CREATE DATABASE memecoin_trading OWNER postgres;" 2>/dev/null || {
        echo -e "${YELLOW}⚠ Could not create database automatically${NC}"
        echo "Please create it manually:"
        echo "  sudo -u postgres psql -c \"CREATE DATABASE memecoin_trading OWNER postgres;\""
        read -p "Press Enter after creating the database..."
    }
fi
echo ""

# Step 5: Run Prisma migrations
echo "Step 5: Running database migrations..."
npx prisma db push --accept-data-loss 2>&1 | tail -5 || {
    echo -e "${RED}✗ Database migration failed${NC}"
    echo "Please check your DATABASE_URL in .env"
    exit 1
}
echo -e "${GREEN}✓ Database schema updated${NC}"
echo ""

# Step 6: Build project (if needed)
echo "Step 6: Checking build..."
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo "Building project..."
    npm run build 2>&1 | tail -5
fi
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 7: Create logs directory
mkdir -p logs

# Step 8: Launch application
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ All checks passed! Starting application...${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Access points:"
echo "  • Main App:    http://localhost:3000"
echo "  • API Server:  http://localhost:3001"
echo "  • WebSocket:   ws://localhost:8080"
echo "  • Health:      http://localhost:3000/health"
echo ""
echo "Press Ctrl+C to stop the application"
echo ""

# Launch the application
NODE_ENV=development npm start
