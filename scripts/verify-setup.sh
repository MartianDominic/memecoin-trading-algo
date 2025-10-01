#!/bin/bash

# =============================================================================
# MEMECOIN TRADING ALGORITHM - SETUP VERIFICATION SCRIPT
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

# Logging functions
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

error() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

echo -e "${BLUE}"
echo "=============================================="
echo "🔍 MEMECOIN TRADING - SETUP VERIFICATION"
echo "=============================================="
echo -e "${NC}"

# Check 1: Required files exist
info "Checking required configuration files..."

if [ -f ".env.example" ]; then
    success ".env.example exists"
else
    error ".env.example is missing"
fi

if [ -f ".env" ]; then
    success ".env exists"
else
    warning ".env is missing (will be created from .env.example)"
fi

if [ -f "docker-compose.yml" ]; then
    success "docker-compose.yml exists"
else
    error "docker-compose.yml is missing"
fi

if [ -f "package.json" ]; then
    success "package.json exists"
else
    error "package.json is missing"
fi

if [ -f "prisma/schema.prisma" ]; then
    success "Prisma schema exists"
else
    error "Prisma schema is missing"
fi

# Check 2: Required directories exist
info "Checking required directories..."

for dir in "scripts" "config" "src" "logs"; do
    if [ -d "$dir" ]; then
        success "Directory $dir exists"
    else
        error "Directory $dir is missing"
    fi
done

# Check 3: Node.js and npm
info "Checking Node.js environment..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        success "Node.js $NODE_VERSION (compatible)"
    else
        error "Node.js $NODE_VERSION (requires 18+)"
    fi
else
    error "Node.js is not installed"
fi

if command -v npm &> /dev/null; then
    success "npm $(npm --version) is available"
else
    error "npm is not installed"
fi

# Check 4: Docker
info "Checking Docker environment..."

if command -v docker &> /dev/null; then
    success "Docker is installed"

    if command -v docker-compose &> /dev/null; then
        success "docker-compose is available"
    elif docker compose version &> /dev/null 2>&1; then
        success "docker compose is available"
    else
        warning "Neither docker-compose nor 'docker compose' found"
    fi
else
    warning "Docker is not installed (manual database setup required)"
fi

# Check 5: Database client tools
info "Checking database client tools..."

if command -v psql &> /dev/null; then
    success "PostgreSQL client (psql) is available"
else
    warning "PostgreSQL client (psql) not found"
fi

if command -v redis-cli &> /dev/null; then
    success "Redis client (redis-cli) is available"
else
    warning "Redis client (redis-cli) not found"
fi

# Check 6: Dependencies
info "Checking project dependencies..."

if [ -d "node_modules" ]; then
    success "Node modules are installed"

    # Check key dependencies
    if [ -d "node_modules/@prisma" ]; then
        success "Prisma is installed"
    else
        error "Prisma is not installed"
    fi

    if [ -d "node_modules/ioredis" ]; then
        success "Redis client (ioredis) is installed"
    else
        error "Redis client (ioredis) is not installed"
    fi

    if [ -d "node_modules/pg" ]; then
        success "PostgreSQL client (pg) is installed"
    else
        error "PostgreSQL client (pg) is not installed"
    fi
else
    warning "Node modules not installed (run: npm install)"
fi

# Check 7: Script permissions
info "Checking script permissions..."

for script in "scripts/setup-environment.sh" "scripts/quick-start.sh" "scripts/verify-setup.sh"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            success "$script is executable"
        else
            warning "$script exists but is not executable"
        fi
    else
        error "$script is missing"
    fi
done

# Check 8: Configuration validation
info "Checking configuration files..."

if [ -f ".env.example" ]; then
    # Check if .env.example has required variables
    required_vars=("DB_HOST" "DB_PORT" "DB_NAME" "DB_USERNAME" "REDIS_HOST" "REDIS_PORT" "DATABASE_URL")
    for var in "${required_vars[@]}"; do
        if grep -q "^$var=" .env.example; then
            success ".env.example contains $var"
        else
            error ".env.example is missing $var"
        fi
    done
fi

# Check 9: Build verification
info "Checking build configuration..."

if [ -f "tsconfig.json" ]; then
    success "TypeScript configuration exists"
else
    warning "tsconfig.json not found"
fi

if [ -f "jest.config.js" ]; then
    success "Jest configuration exists"
else
    warning "jest.config.js not found"
fi

# Check 10: Port availability (if possible)
info "Checking port availability..."

check_port() {
    local port=$1
    local service=$2

    if command -v netstat &> /dev/null; then
        if netstat -an | grep ":$port " | grep LISTEN > /dev/null; then
            warning "Port $port ($service) is already in use"
        else
            success "Port $port ($service) is available"
        fi
    elif command -v ss &> /dev/null; then
        if ss -an | grep ":$port " | grep LISTEN > /dev/null; then
            warning "Port $port ($service) is already in use"
        else
            success "Port $port ($service) is available"
        fi
    else
        info "Cannot check port $port availability (netstat/ss not found)"
    fi
}

check_port 3000 "Main App"
check_port 3001 "API Server"
check_port 8080 "WebSocket"
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"

# Summary
echo ""
echo "=============================================="
echo -e "${BLUE}📊 VERIFICATION SUMMARY${NC}"
echo "=============================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 PERFECT! Everything is set up correctly.${NC}"
    echo ""
    echo "You can now run:"
    echo "  ./scripts/quick-start.sh    - Start everything quickly"
    echo "  ./scripts/setup-environment.sh - Full setup"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}✅ GOOD! Setup is mostly complete with $WARNINGS warnings.${NC}"
    echo ""
    echo "You can proceed with:"
    echo "  ./scripts/setup-environment.sh - Complete any missing setup"
else
    echo -e "${RED}❌ ISSUES FOUND! $ERRORS errors and $WARNINGS warnings detected.${NC}"
    echo ""
    echo "Please fix the errors before proceeding:"
    echo "  1. Install missing dependencies"
    echo "  2. Create missing files"
    echo "  3. Run: ./scripts/setup-environment.sh"
fi

echo ""
echo "For detailed setup instructions, see the project documentation."

# Exit with appropriate code
if [ $ERRORS -gt 0 ]; then
    exit 1
else
    exit 0
fi