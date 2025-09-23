#!/bin/bash

# Development Server Startup Script
# Starts all services needed for development with proper monitoring

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_PORT=3000
WS_PORT=3002
FRONTEND_PORT=3001

# Function to print colored output
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# PID tracking
PIDS=()

# Cleanup function
cleanup() {
    print_status "Shutting down services..."

    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            print_status "Stopped process $pid"
        fi
    done

    # Kill any remaining node processes on our ports
    lsof -ti:$API_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$WS_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true

    print_success "All services stopped"
    exit 0
}

# Trap cleanup on script exit
trap cleanup EXIT INT TERM

# Check if ports are available
check_ports() {
    print_status "Checking port availability..."

    if lsof -i:$API_PORT &>/dev/null; then
        print_error "Port $API_PORT is already in use"
        exit 1
    fi

    if lsof -i:$WS_PORT &>/dev/null; then
        print_error "Port $WS_PORT is already in use"
        exit 1
    fi

    if lsof -i:$FRONTEND_PORT &>/dev/null; then
        print_error "Port $FRONTEND_PORT is already in use"
        exit 1
    fi

    print_success "All ports available"
}

# Start Redis if not running
start_redis() {
    if ! redis-cli ping &>/dev/null; then
        print_status "Starting Redis..."
        redis-server --daemonize yes --port 6379
        sleep 2

        if redis-cli ping &>/dev/null; then
            print_success "Redis started"
        else
            print_error "Failed to start Redis"
            exit 1
        fi
    else
        print_success "Redis already running"
    fi
}

# Start PostgreSQL if needed
start_postgres() {
    if ! pg_isready -h localhost -p 5432 &>/dev/null; then
        print_warning "PostgreSQL not accessible. Please ensure it's running."
        print_status "Try: sudo systemctl start postgresql"
    else
        print_success "PostgreSQL is accessible"
    fi
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."

    # Load environment variables
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
        print_success "Loaded .env file"
    fi

    # Create logs directory
    mkdir -p logs

    # Ensure database is ready
    cd backend
    npm run db:push &>/dev/null || print_warning "Database push failed"
    cd ..
}

# Start backend API server
start_backend() {
    print_status "Starting backend API server on port $API_PORT..."

    cd backend
    npm run dev > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    PIDS+=($BACKEND_PID)
    cd ..

    # Wait for backend to start
    print_status "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:$API_PORT/health &>/dev/null; then
            print_success "Backend API started (PID: $BACKEND_PID)"
            return 0
        fi
        sleep 1
    done

    print_error "Backend failed to start within 30 seconds"
    tail -20 logs/backend.log
    exit 1
}

# Start WebSocket server
start_websocket() {
    print_status "Starting WebSocket server on port $WS_PORT..."

    # Create WebSocket server startup script
    cat > temp_ws_server.js << 'EOF'
const WebSocket = require('ws');
const wss = new WebSocket.Server({
    port: process.env.WS_PORT || 3002,
    path: '/ws'
});

console.log(`WebSocket server started on port ${process.env.WS_PORT || 3002}`);

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection from:', req.socket.remoteAddress);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data);

            // Echo back for development
            ws.send(JSON.stringify({
                type: 'ACK',
                original: data,
                timestamp: Date.now()
            }));

        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'WELCOME',
        message: 'Connected to memecoin trading WebSocket',
        timestamp: Date.now()
    }));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down WebSocket server...');
    wss.close();
    process.exit(0);
});
EOF

    WS_PORT=$WS_PORT node temp_ws_server.js > logs/websocket.log 2>&1 &
    WS_PID=$!
    PIDS+=($WS_PID)

    # Wait for WebSocket server to start
    sleep 2
    if kill -0 $WS_PID 2>/dev/null; then
        print_success "WebSocket server started (PID: $WS_PID)"
    else
        print_error "WebSocket server failed to start"
        tail -10 logs/websocket.log
        exit 1
    fi
}

# Start frontend development server
start_frontend() {
    if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        print_status "Starting frontend development server on port $FRONTEND_PORT..."

        cd frontend
        PORT=$FRONTEND_PORT npm start > ../logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        PIDS+=($FRONTEND_PID)
        cd ..

        print_success "Frontend server started (PID: $FRONTEND_PID)"
    else
        print_warning "Frontend directory not found, skipping frontend server"
    fi
}

# Start monitoring
start_monitoring() {
    print_status "Starting service monitoring..."

    cat > temp_monitor.js << 'EOF'
const http = require('http');
const WebSocket = require('ws');

const services = [
    { name: 'Backend API', url: 'http://localhost:3000/health' },
    { name: 'WebSocket', url: 'ws://localhost:3002/ws' }
];

const checkService = async (service) => {
    try {
        if (service.url.startsWith('http')) {
            const response = await fetch(service.url);
            return response.ok;
        } else if (service.url.startsWith('ws')) {
            return new Promise((resolve) => {
                const ws = new WebSocket(service.url);
                ws.on('open', () => {
                    ws.close();
                    resolve(true);
                });
                ws.on('error', () => resolve(false));
                setTimeout(() => resolve(false), 5000);
            });
        }
    } catch (error) {
        return false;
    }
};

const monitor = async () => {
    console.log('\n📊 Service Status Check - ' + new Date().toLocaleTimeString());
    console.log('━'.repeat(50));

    for (const service of services) {
        const status = await checkService(service);
        const statusIcon = status ? '✅' : '❌';
        const statusText = status ? 'HEALTHY' : 'DOWN';
        console.log(`${statusIcon} ${service.name}: ${statusText}`);
    }

    console.log('━'.repeat(50));
};

// Initial check
monitor();

// Check every 30 seconds
setInterval(monitor, 30000);

console.log('🔍 Service monitor started. Checking services every 30 seconds...');
EOF

    node temp_monitor.js > logs/monitor.log 2>&1 &
    MONITOR_PID=$!
    PIDS+=($MONITOR_PID)

    print_success "Service monitor started (PID: $MONITOR_PID)"
}

# Main function
main() {
    print_status "🚀 Starting Memecoin Trading Development Environment..."

    # Pre-flight checks
    check_ports

    # Start infrastructure
    start_redis
    start_postgres

    # Setup environment
    setup_environment

    # Start services
    start_backend
    start_websocket
    start_frontend
    start_monitoring

    # Display status
    echo
    print_success "🎉 All services started successfully!"
    echo
    echo "📋 Service URLs:"
    echo "   • Backend API:    http://localhost:$API_PORT"
    echo "   • WebSocket:      ws://localhost:$WS_PORT/ws"
    echo "   • Frontend:       http://localhost:$FRONTEND_PORT"
    echo
    echo "📄 Log files:"
    echo "   • Backend:        logs/backend.log"
    echo "   • WebSocket:      logs/websocket.log"
    echo "   • Frontend:       logs/frontend.log"
    echo "   • Monitor:        logs/monitor.log"
    echo
    echo "🔧 Development commands:"
    echo "   • View logs:      tail -f logs/*.log"
    echo "   • Test API:       curl http://localhost:$API_PORT/health"
    echo "   • Test WebSocket: wscat -c ws://localhost:$WS_PORT/ws"
    echo
    echo "Press Ctrl+C to stop all services"
    echo

    # Keep script running
    while true; do
        sleep 1

        # Check if any service died
        for i in "${!PIDS[@]}"; do
            if ! kill -0 "${PIDS[$i]}" 2>/dev/null; then
                print_error "Service with PID ${PIDS[$i]} died!"
                unset 'PIDS[i]'
            fi
        done
    done
}

# Run main function
main "$@"