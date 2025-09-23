#!/bin/bash

# Memecoin Trading Algorithm - Start All Services
# This script starts all components of the trading system

set -e

echo "🚀 Starting Memecoin Trading Algorithm System..."

# Check if required environment variables are set
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Please create one with required environment variables."
    exit 1
fi

# Build the project if needed
echo "📦 Building project..."
npm run build

# Start services in the background
echo "🔧 Starting services..."

# Start API server
echo "  • Starting API server..."
npm run start:api &
API_PID=$!

# Start WebSocket manager
echo "  • Starting WebSocket manager..."
npm run start:websocket &
WS_PID=$!

# Start token aggregator
echo "  • Starting token aggregator..."
npm run start:aggregator &
AGGREGATOR_PID=$!

# Wait a moment for services to initialize
sleep 3

# Health check
echo "🔍 Running health checks..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API server is healthy"
else
    echo "⚠️  API server health check failed"
fi

echo "🎯 All services started successfully!"
echo "📊 API Server: http://localhost:3000"
echo "🔌 WebSocket: ws://localhost:3001"
echo "⚡ Token Aggregator: Running in background"
echo ""
echo "💡 To stop all services, run: npm run stop:all"
echo "📋 To view logs, run: npm run logs"
echo ""
echo "🔧 Process IDs:"
echo "  API Server: $API_PID"
echo "  WebSocket: $WS_PID"
echo "  Aggregator: $AGGREGATOR_PID"

# Save PIDs for stop script
echo "$API_PID" > .pids/api.pid
echo "$WS_PID" > .pids/websocket.pid
echo "$AGGREGATOR_PID" > .pids/aggregator.pid

# Keep script running to monitor services
wait