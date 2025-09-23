/**
 * Real-time Analytics Dashboard for Token Detection Pipeline
 * Provides live monitoring and visualization capabilities
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const TokenDetectionMetrics = require('./performanceMetrics');

class AnalyticsDashboard {
  constructor(port = 3001) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.port = port;
    this.metrics = new TokenDetectionMetrics();
    this.updateInterval = 1000; // 1 second
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupRoutes() {
    // Serve static dashboard files
    this.app.use(express.static('src/analytics/dashboard'));
    this.app.use(express.json());

    // API endpoints
    this.app.get('/api/metrics', (req, res) => {
      res.json(this.metrics.generateReport());
    });

    this.app.get('/api/metrics/export/:format', (req, res) => {
      const format = req.params.format;
      const data = this.metrics.exportMetrics(format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');
      } else {
        res.setHeader('Content-Type', 'application/json');
      }
      
      res.send(data);
    });

    this.app.post('/api/metrics/detection', (req, res) => {
      const { detectionResult, groundTruth } = req.body;
      this.metrics.updateDetectionMetrics(detectionResult, groundTruth);
      res.json({ status: 'updated' });
    });

    this.app.post('/api/metrics/trade', (req, res) => {
      const trade = req.body;
      this.metrics.recordTrade(trade);
      res.json({ status: 'recorded' });
    });

    this.app.get('/api/alerts', (req, res) => {
      const alerts = this.metrics.checkAlerts();
      res.json(alerts);
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected to analytics dashboard');
      
      // Send initial metrics
      socket.emit('metrics-update', this.metrics.generateReport());
      
      socket.on('disconnect', () => {
        console.log('Client disconnected from analytics dashboard');
      });
      
      socket.on('request-metrics', () => {
        socket.emit('metrics-update', this.metrics.generateReport());
      });
    });
  }

  startRealTimeUpdates() {
    setInterval(() => {
      const report = this.metrics.generateReport();
      const alerts = this.metrics.checkAlerts();
      
      // Broadcast to all connected clients
      this.io.emit('metrics-update', report);
      
      if (alerts.length > 0) {
        this.io.emit('alerts-update', alerts);
      }
      
      // Log critical alerts
      alerts.filter(alert => alert.severity === 'high')
        .forEach(alert => {
          console.warn(`[ALERT] ${alert.message}: ${alert.value}`);
        });
    }, this.updateInterval);
  }

  // Simulate live data for testing
  simulateData() {
    setInterval(() => {
      // Simulate detection result
      const detectionResult = {
        isValid: Math.random() > 0.2,
        confidence: Math.random(),
        tokenAddress: `0x${Math.random().toString(16).substr(2, 40)}`
      };
      
      const groundTruth = {
        isValid: Math.random() > 0.15 // Slightly higher chance of being valid
      };
      
      this.metrics.updateDetectionMetrics(detectionResult, groundTruth);
      
      // Simulate processing time
      this.metrics.recordProcessingTime(Math.random() * 5000 + 100);
      
      // Simulate system metrics
      this.metrics.updateSystemMetrics({
        cpu: Math.random() * 100,
        memory: Math.random() * 0.9,
        disk: Math.random() * 0.8,
        network: Math.random() * 1000
      });
      
      // Simulate trade (less frequent)
      if (Math.random() > 0.9) {
        this.metrics.recordTrade({
          pnl: (Math.random() - 0.4) * 1000, // Slightly positive bias
          size: Math.random() * 10000 + 100
        });
      }
    }, 2000); // Every 2 seconds
  }

  start(simulate = false) {
    this.server.listen(this.port, () => {
      console.log(`Analytics Dashboard running on port ${this.port}`);
      console.log(`Dashboard URL: http://localhost:${this.port}`);
      console.log(`API URL: http://localhost:${this.port}/api/metrics`);
    });
    
    this.startRealTimeUpdates();
    
    if (simulate) {
      console.log('Starting data simulation for testing...');
      this.simulateData();
    }
  }

  stop() {
    this.server.close();
    console.log('Analytics Dashboard stopped');
  }
}

module.exports = AnalyticsDashboard;