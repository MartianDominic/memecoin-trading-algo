#!/bin/bash

# =============================================================================
# MEMECOIN TRADING ALGORITHM - ENVIRONMENT SETUP SCRIPT
# =============================================================================
# This script sets up the complete development environment A-Z

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running with correct permissions
check_permissions() {
    log "Checking permissions..."
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root - some operations may require different handling"
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js version must be 18 or higher. Current: $(node --version)"
        exit 1
    fi
    success "Node.js $(node --version) is installed"

    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
        exit 1
    fi
    success "npm $(npm --version) is installed"

    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') is installed"
        DOCKER_AVAILABLE=true
    else
        warning "Docker not found - manual database setup will be required"
        DOCKER_AVAILABLE=false
    fi

    # Check PostgreSQL client (optional)
    if command -v psql &> /dev/null; then
        success "PostgreSQL client is installed"
        PSQL_AVAILABLE=true
    else
        warning "PostgreSQL client not found - database operations may be limited"
        PSQL_AVAILABLE=false
    fi
}

# Setup environment file
setup_environment() {
    log "Setting up environment configuration..."

    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp ".env.example" ".env"
            success "Created .env from .env.example"
            warning "Please edit .env and update the following:"
            echo "  - Database passwords"
            echo "  - Redis password"
            echo "  - JWT secret"
            echo "  - API keys (optional)"
        else
            error ".env.example not found!"
            exit 1
        fi
    else
        success ".env file already exists"
    fi
}

# Install Node.js dependencies
install_dependencies() {
    log "Installing Node.js dependencies..."

    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi

    success "Dependencies installed successfully"
}

# Setup databases with Docker
setup_docker_databases() {
    if [ "$DOCKER_AVAILABLE" = true ]; then
        log "Setting up databases with Docker..."

        # Check if docker-compose is available
        if command -v docker-compose &> /dev/null; then
            COMPOSE_CMD="docker-compose"
        elif docker compose version &> /dev/null; then
            COMPOSE_CMD="docker compose"
        else
            error "Neither docker-compose nor 'docker compose' is available"
            return 1
        fi

        # Start only database services
        log "Starting PostgreSQL and Redis..."
        $COMPOSE_CMD up -d postgres redis

        # Wait for services to be ready
        log "Waiting for databases to be ready..."
        sleep 10

        # Check if services are healthy
        for i in {1..30}; do
            if $COMPOSE_CMD exec postgres pg_isready -U postgres > /dev/null 2>&1; then
                success "PostgreSQL is ready"
                break
            fi
            if [ $i -eq 30 ]; then
                error "PostgreSQL failed to start"
                return 1
            fi
            sleep 2
        done

        for i in {1..30}; do
            if $COMPOSE_CMD exec redis redis-cli ping > /dev/null 2>&1; then
                success "Redis is ready"
                break
            fi
            if [ $i -eq 30 ]; then
                error "Redis failed to start"
                return 1
            fi
            sleep 2
        done

        success "Databases are running successfully"
        return 0
    else
        warning "Docker not available - skipping automated database setup"
        return 1
    fi
}

# Setup Prisma
setup_prisma() {
    log "Setting up Prisma..."

    # Generate Prisma client
    npx prisma generate
    success "Prisma client generated"

    # Check if databases are available for migration
    if command -v docker &> /dev/null && docker ps | grep memecoin_postgres > /dev/null; then
        log "Running database migrations..."
        npx prisma db push
        success "Database schema created"

        # Optionally seed database
        if [ -f "prisma/seed.js" ] || [ -f "prisma/seed.ts" ]; then
            log "Seeding database..."
            npx prisma db seed
            success "Database seeded"
        fi
    else
        warning "Database not available - run 'npx prisma db push' after database setup"
    fi
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."

    mkdir -p logs
    mkdir -p config
    mkdir -p scripts
    mkdir -p tests/{backend,frontend,integration,e2e}
    mkdir -p docs

    success "Directories created"
}

# Setup development scripts
setup_scripts() {
    log "Setting up development scripts..."

    # Create start-all script
    cat > scripts/start-all.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting all services..."

# Start databases
if command -v docker-compose &> /dev/null; then
    docker-compose up -d postgres redis
elif docker compose version &> /dev/null; then
    docker compose up -d postgres redis
fi

# Wait for databases
sleep 5

# Start application services
npm run dev &
npm run start:api &
npm run start:websocket &

echo "All services started!"
echo "Main app: http://localhost:3000"
echo "API: http://localhost:3001"
echo "WebSocket: ws://localhost:8080"
EOF

    # Create stop-all script
    cat > scripts/stop-all.sh << 'EOF'
#!/bin/bash
echo "Stopping all services..."

# Kill Node.js processes
pkill -f "node.*dist" || true
pkill -f "nodemon" || true

# Stop Docker services
if command -v docker-compose &> /dev/null; then
    docker-compose down
elif docker compose version &> /dev/null; then
    docker compose down
fi

echo "All services stopped!"
EOF

    # Create health check script
    cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

echo "=== SYSTEM HEALTH CHECK ==="

# Check Node.js app
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Main app is healthy"
else
    echo "❌ Main app is not responding"
fi

# Check API
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ API is healthy"
else
    echo "❌ API is not responding"
fi

# Check databases
if command -v docker &> /dev/null; then
    if docker exec memecoin_postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL is healthy"
    else
        echo "❌ PostgreSQL is not healthy"
    fi

    if docker exec memecoin_redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is healthy"
    else
        echo "❌ Redis is not healthy"
    fi
fi

echo "=== END HEALTH CHECK ==="
EOF

    chmod +x scripts/*.sh
    success "Development scripts created"
}

# Run tests
run_tests() {
    log "Running initial tests..."

    # Build the project first
    npm run build

    # Run tests
    npm test -- --passWithNoTests
    success "Tests completed"
}

# Display final instructions
show_final_instructions() {
    echo ""
    echo "=================================="
    success "SETUP COMPLETED SUCCESSFULLY!"
    echo "=================================="
    echo ""
    echo "📝 Next steps:"
    echo "   1. Edit .env file with your actual passwords and API keys"
    echo "   2. Start the development environment:"
    echo "      ./scripts/start-all.sh"
    echo ""
    echo "🔗 Available URLs:"
    echo "   Main App:    http://localhost:3000"
    echo "   API:         http://localhost:3001"
    echo "   WebSocket:   ws://localhost:8080"
    if [ "$DOCKER_AVAILABLE" = true ]; then
        echo "   PostgreSQL:  localhost:5432"
        echo "   Redis:       localhost:6379"
    fi
    echo ""
    echo "📚 Useful commands:"
    echo "   npm run dev          - Start development server"
    echo "   npm run build        - Build for production"
    echo "   npm test             - Run tests"
    echo "   npm run db:migrate   - Run database migrations"
    echo "   ./scripts/health-check.sh - Check system health"
    echo "   ./scripts/stop-all.sh     - Stop all services"
    echo ""
    if [ "$DOCKER_AVAILABLE" = true ]; then
        echo "🐳 Docker commands:"
        echo "   docker-compose up -d     - Start all services"
        echo "   docker-compose down      - Stop all services"
        echo "   docker-compose logs -f   - View logs"
    fi
    echo ""
}

# Main execution
main() {
    echo "=================================="
    echo "🚀 MEMECOIN TRADING ALGORITHM SETUP"
    echo "=================================="
    echo ""

    check_permissions
    check_requirements
    create_directories
    setup_environment
    install_dependencies

    if setup_docker_databases; then
        setup_prisma
    else
        warning "Skipping Prisma setup - databases not available"
    fi

    setup_scripts

    if [ "${SKIP_TESTS:-false}" != "true" ]; then
        run_tests
    fi

    show_final_instructions
}

# Run main function
main "$@"