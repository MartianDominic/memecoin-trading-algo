#!/bin/bash

# =============================================================================
# MEMECOIN TRADING ALGORITHM - COMPLETE SETUP SCRIPT
# =============================================================================
# This script automates the complete setup of the trading algorithm
# Run with: bash scripts/complete-setup.sh
# =============================================================================

set -e  # Exit on error

echo "🚀 Starting Memecoin Trading Algorithm Setup..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# =============================================================================
# 1. CREATE .ENV FILE
# =============================================================================
echo "📝 Step 1: Creating .env file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file from example${NC}"
    echo -e "${YELLOW}⚠ Please update .env with your actual credentials before continuing!${NC}"
    echo ""
    read -p "Press Enter after updating .env file, or Ctrl+C to exit and update later..."
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi
echo ""

# =============================================================================
# 2. START REDIS SERVICE
# =============================================================================
echo "🔧 Step 2: Starting Redis service..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✓ Redis is already running${NC}"
    else
        echo "Starting Redis..."
        sudo systemctl start redis-server 2>/dev/null || sudo service redis-server start 2>/dev/null || {
            echo -e "${YELLOW}⚠ Could not start Redis automatically${NC}"
            echo "Please start Redis manually with: sudo systemctl start redis-server"
            read -p "Press Enter after starting Redis..."
        }
    fi
else
    echo -e "${RED}✗ Redis not installed. Please install Redis first.${NC}"
    exit 1
fi
echo ""

# =============================================================================
# 3. CHECK POSTGRESQL
# =============================================================================
echo "🗄️  Step 3: Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    if systemctl is-active --quiet postgresql 2>/dev/null || pg_isready &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL is running${NC}"
    else
        echo "Starting PostgreSQL..."
        sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start 2>/dev/null || {
            echo -e "${YELLOW}⚠ Could not start PostgreSQL automatically${NC}"
            echo "Please start PostgreSQL manually"
            exit 1
        }
    fi
else
    echo -e "${RED}✗ PostgreSQL not installed. Please install PostgreSQL first.${NC}"
    exit 1
fi
echo ""

# =============================================================================
# 4. CREATE DATABASE
# =============================================================================
echo "💾 Step 4: Creating database..."
source .env 2>/dev/null || true

# Create database user if doesn't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = '${DB_USERNAME:-postgres}'" | grep -q 1 || {
    echo "Creating database user..."
    sudo -u postgres psql -c "CREATE USER ${DB_USERNAME:-postgres} WITH PASSWORD '${DB_PASSWORD:-your_secure_password_here}';"
}

# Create database if doesn't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME:-memecoin_trading}'" | grep -q 1 || {
    echo "Creating database..."
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME:-memecoin_trading} OWNER ${DB_USERNAME:-postgres};"
    echo -e "${GREEN}✓ Database created${NC}"
} || echo -e "${GREEN}✓ Database already exists${NC}"
echo ""

# =============================================================================
# 5. INSTALL DEPENDENCIES
# =============================================================================
echo "📦 Step 5: Installing dependencies..."
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# =============================================================================
# 6. GENERATE PRISMA CLIENT
# =============================================================================
echo "🔨 Step 6: Generating Prisma client..."
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"
echo ""

# =============================================================================
# 7. RUN DATABASE MIGRATIONS
# =============================================================================
echo "🔄 Step 7: Running database migrations..."
npx prisma db push --accept-data-loss 2>/dev/null || {
    echo "Running alternative migration..."
    npx prisma migrate dev --name init
}
echo -e "${GREEN}✓ Database migrations completed${NC}"
echo ""

# =============================================================================
# 8. BUILD PROJECT
# =============================================================================
echo "🏗️  Step 8: Building TypeScript project..."
npm run build
echo -e "${GREEN}✓ Project built successfully${NC}"
echo ""

# =============================================================================
# 9. CREATE LOG DIRECTORY
# =============================================================================
echo "📁 Step 9: Setting up log directory..."
mkdir -p logs
echo -e "${GREEN}✓ Log directory created${NC}"
echo ""

# =============================================================================
# SETUP COMPLETE
# =============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✨ Setup Complete!${NC}"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "You can now start the application with:"
echo ""
echo "  🎯 Main App:        npm start"
echo "  🌐 API Server:      npm run start:api"
echo "  🔌 WebSocket:       npm run start:websocket"
echo "  📊 Aggregator:      npm run start:aggregator"
echo "  🚀 All Services:    npm run start:all"
echo "  🐳 Docker Stack:    docker-compose up -d"
echo ""
echo "To check health:     npm run health"
echo "To view logs:        npm run logs"
echo ""
echo "════════════════════════════════════════════════════════════════"
