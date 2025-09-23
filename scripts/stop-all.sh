#!/bin/bash

# Memecoin Trading Algorithm - Stop All Services
# This script stops all components of the trading system

set -e

echo "🛑 Stopping Memecoin Trading Algorithm System..."

# Create .pids directory if it doesn't exist
mkdir -p .pids

# Function to stop a service by PID file
stop_service() {
    local service_name="$1"
    local pid_file="$2"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "  • Stopping $service_name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true

            # Wait for graceful shutdown
            local count=0
            while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                ((count++))
            done

            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                echo "    Force killing $service_name..."
                kill -9 "$pid" 2>/dev/null || true
            fi

            echo "    ✅ $service_name stopped"
        else
            echo "  • $service_name was not running"
        fi
        rm -f "$pid_file"
    else
        echo "  • No PID file found for $service_name"
    fi
}

# Stop services by PID files
stop_service "API Server" ".pids/api.pid"
stop_service "WebSocket Manager" ".pids/websocket.pid"
stop_service "Token Aggregator" ".pids/aggregator.pid"

# Also kill by process name as backup
echo "🔍 Checking for any remaining processes..."
pkill -f "dist/api/api-server.js" 2>/dev/null || true
pkill -f "dist/api/websocket/websocket-manager.js" 2>/dev/null || true
pkill -f "dist/services/token-aggregator.service.js" 2>/dev/null || true

# Clean up PID directory
rm -rf .pids

echo "✅ All services stopped successfully!"
echo "💡 To start all services again, run: npm run start:all"