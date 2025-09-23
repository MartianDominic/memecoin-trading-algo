#!/bin/bash

# Test Setup Script for Memecoin Trading Algorithm
# This script prepares the test environment and runs comprehensive tests

set -e  # Exit on any error

echo "🚀 Setting up test environment for Memecoin Trading Algorithm..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
        exit 1
    fi

    print_success "Node.js version $(node --version) is installed"
}

# Check if PostgreSQL is running
check_postgres() {
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL client not found. Please ensure PostgreSQL is installed."
        return 1
    fi

    # Try to connect to default test database
    if ! PGPASSWORD=test psql -h localhost -U test -d postgres -c "SELECT 1;" &> /dev/null; then
        print_warning "Cannot connect to PostgreSQL. Attempting to start local instance..."

        # Try to start PostgreSQL service (Ubuntu/Debian)
        if command -v systemctl &> /dev/null; then
            sudo systemctl start postgresql || print_warning "Failed to start PostgreSQL service"
        fi

        # Create test user and database if needed
        print_status "Setting up test database..."
        sudo -u postgres createuser -s test 2>/dev/null || true
        sudo -u postgres createdb memecoin_test -O test 2>/dev/null || true
        sudo -u postgres psql -c "ALTER USER test PASSWORD 'test';" 2>/dev/null || true
    fi

    print_success "PostgreSQL is available"
}

# Check if Redis is running
check_redis() {
    if ! command -v redis-cli &> /dev/null; then
        print_warning "Redis client not found. Please ensure Redis is installed."
        return 1
    fi

    if ! redis-cli ping &> /dev/null; then
        print_warning "Redis is not running. Attempting to start..."

        if command -v systemctl &> /dev/null; then
            sudo systemctl start redis-server || print_warning "Failed to start Redis service"
        else
            redis-server --daemonize yes || print_warning "Failed to start Redis"
        fi
    fi

    print_success "Redis is available"
}

# Setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."

    # Create .env.test file if it doesn't exist
    if [ ! -f .env.test ]; then
        cat > .env.test << EOF
# Test Environment Configuration
NODE_ENV=test
PORT=3001

# Database Configuration
DATABASE_URL=postgresql://test:test@localhost:5432/memecoin_test
REDIS_URL=redis://localhost:6379/1

# API Configuration
DEXSCREENER_BASE_URL=https://api.dexscreener.com/latest
RUGCHECK_BASE_URL=https://api.rugcheck.xyz
JUPITER_BASE_URL=https://quote-api.jup.ag/v6
SOLSCAN_BASE_URL=https://api.solscan.io

# Rate Limiting
API_RATE_LIMIT_REQUESTS=100
API_RATE_LIMIT_WINDOW=60000

# WebSocket Configuration
WS_PORT=3002

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/test.log

# Security
JWT_SECRET=test-secret-key-do-not-use-in-production
BCRYPT_ROUNDS=10

# Feature Flags
ENABLE_SAFETY_ANALYSIS=true
ENABLE_REAL_TIME_UPDATES=true
ENABLE_ALERTS=true
EOF
        print_success "Created .env.test file"
    else
        print_success ".env.test file already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."

    # Backend dependencies
    if [ -d "backend" ]; then
        cd backend
        npm install
        cd ..
        print_success "Backend dependencies installed"
    fi

    # Frontend dependencies
    if [ -d "frontend" ]; then
        cd frontend
        npm install
        cd ..
        print_success "Frontend dependencies installed"
    fi

    # Root dependencies (if package.json exists)
    if [ -f "package.json" ]; then
        npm install
        print_success "Root dependencies installed"
    fi
}

# Setup database
setup_database() {
    print_status "Setting up test database..."

    cd backend

    # Generate Prisma client
    npm run db:generate || {
        print_error "Failed to generate Prisma client"
        exit 1
    }

    # Push database schema
    npm run db:push || {
        print_error "Failed to push database schema"
        exit 1
    }

    # Seed test data
    npm run db:seed || {
        print_warning "Failed to seed database (this is optional)"
    }

    cd ..
    print_success "Database setup completed"
}

# Create log directories
setup_logging() {
    print_status "Setting up logging directories..."

    mkdir -p logs
    mkdir -p tests/coverage
    mkdir -p tests/reports

    # Create log files with proper permissions
    touch logs/test.log
    touch logs/error.log
    chmod 644 logs/*.log

    print_success "Logging directories created"
}

# Run health checks
run_health_checks() {
    print_status "Running health checks..."

    # Check if all required ports are available
    check_port() {
        local port=$1
        local service=$2

        if lsof -i:$port &> /dev/null; then
            print_warning "Port $port is in use (needed for $service)"
        else
            print_success "Port $port is available for $service"
        fi
    }

    check_port 3000 "API Server"
    check_port 3001 "Test API Server"
    check_port 3002 "WebSocket Server"
    check_port 5432 "PostgreSQL"
    check_port 6379 "Redis"
}

# Run tests
run_tests() {
    print_status "Running test suite..."

    # Backend tests
    if [ -d "backend" ]; then
        cd backend
        print_status "Running backend tests..."

        # Unit tests
        npm test -- --testPathPattern=unit --coverage --verbose

        # Integration tests
        npm test -- --testPathPattern=integration --verbose

        cd ..
        print_success "Backend tests completed"
    fi

    # Frontend tests (if exists)
    if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        cd frontend
        print_status "Running frontend tests..."
        npm test -- --coverage --watchAll=false
        cd ..
        print_success "Frontend tests completed"
    fi

    # E2E tests
    if [ -d "tests/e2e" ]; then
        print_status "Running E2E tests..."
        npm test -- --testPathPattern=e2e --verbose
        print_success "E2E tests completed"
    fi
}

# Generate test reports
generate_reports() {
    print_status "Generating test reports..."

    # Combine coverage reports
    if [ -d "backend/coverage" ]; then
        cp -r backend/coverage/* tests/coverage/ 2>/dev/null || true
    fi

    if [ -d "frontend/coverage" ]; then
        cp -r frontend/coverage/* tests/coverage/ 2>/dev/null || true
    fi

    # Generate HTML coverage report
    if command -v nyc &> /dev/null; then
        nyc report --reporter=html --report-dir=tests/coverage
    fi

    print_success "Test reports generated in tests/coverage/"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."

    # Stop any test servers that might be running
    pkill -f "test-server" 2>/dev/null || true

    print_success "Cleanup completed"
}

# Main execution
main() {
    print_status "Starting comprehensive test setup..."

    # Pre-flight checks
    check_node
    check_postgres
    check_redis

    # Setup
    setup_environment
    setup_logging
    install_dependencies
    setup_database

    # Health checks
    run_health_checks

    # Handle command line arguments
    case "${1:-all}" in
        "setup")
            print_success "Setup completed successfully!"
            ;;
        "test")
            run_tests
            generate_reports
            print_success "Tests completed successfully!"
            ;;
        "health")
            print_success "Health checks completed!"
            ;;
        "all"|*)
            run_tests
            generate_reports
            print_success "Complete test setup and execution finished!"
            ;;
    esac
}

# Trap cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"