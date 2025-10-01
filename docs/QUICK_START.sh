#!/bin/bash

echo "=========================================="
echo "MEMECOIN TRADING ALGO - QUICK START"
echo "=========================================="
echo ""

echo "This script will attempt to start the application with minimal configuration."
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# 1. Check for .env manually (can't create due to security)
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Please run: cp .env.example .env"
    echo "Then edit .env with your passwords and re-run this script"
    exit 1
fi

# 2. Start Redis
echo "Starting Redis..."
redis-cli ping 2>/dev/null || {
    sudo systemctl start redis-server 2>/dev/null || sudo service redis-server start
}

# 3. Check PostgreSQL
echo "Checking PostgreSQL..."
pg_isready || {
    echo "Starting PostgreSQL..."
    sudo systemctl start postgresql
}

# 4. Create database
echo "Creating database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'memecoin_trading'" | grep -q 1 || {
    sudo -u postgres psql -c "CREATE DATABASE memecoin_trading OWNER postgres;"
}

# 5. Run Prisma
echo "Setting up database schema..."
npx prisma generate
npx prisma db push --skip-generate

# 6. Build (skip type checking for now)
echo "Building application..."
npx tsc --skipLibCheck

# 7. Create logs directory
mkdir -p logs

echo ""
echo "=========================================="
echo "Setup complete! Starting application..."
echo "=========================================="
echo ""

# 8. Start
npm start
