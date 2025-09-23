/**
 * Performance Metrics Framework for Token Detection Pipeline
 * Comprehensive monitoring and analysis system
 */

class TokenDetectionMetrics {
  constructor() {
    this.metrics = {
      detection: {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        falsePositiveRate: 0,
        falseNegativeRate: 0,
        totalTokensProcessed: 0,
        validTokensDetected: 0,
        rugPullsDetected: 0,
        falseAlarms: 0
      },
      performance: {
        avgProcessingTime: 0,
        maxProcessingTime: 0,
        minProcessingTime: Infinity,
        throughput: 0, // tokens per second
        cpuUsage: 0,
        memoryUsage: 0,
        apiCallLatency: 0,
        blockchainSyncLatency: 0
      },
      trading: {
        totalTrades: 0,
        profitableTrades: 0,
        lossyTrades: 0,
        totalPnL: 0,
        avgTradeSize: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        winRate: 0
      },
      system: {
        uptime: 0,
        restarts: 0,
        errors: 0,
        warnings: 0,
        diskUsage: 0,
        networkUsage: 0
      }
    };
    
    this.historicalData = [];
    this.alerts = [];
    this.startTime = Date.now();
  }

  // Detection Performance Metrics
  updateDetectionMetrics(detectionResult, groundTruth) {
    this.metrics.detection.totalTokensProcessed++;
    
    if (detectionResult.isValid === groundTruth.isValid) {
      if (detectionResult.isValid) {
        this.metrics.detection.validTokensDetected++;
      }
    } else {
      if (detectionResult.isValid && !groundTruth.isValid) {
        this.metrics.detection.falseAlarms++;
      }
    }
    
    this.calculateDetectionRates();
  }

  calculateDetectionRates() {
    const total = this.metrics.detection.totalTokensProcessed;
    const valid = this.metrics.detection.validTokensDetected;
    const falsePos = this.metrics.detection.falseAlarms;
    
    if (total > 0) {
      this.metrics.detection.accuracy = valid / total;
      this.metrics.detection.falsePositiveRate = falsePos / total;
      this.metrics.detection.precision = falsePos > 0 ? valid / (valid + falsePos) : 1;
      this.metrics.detection.recall = valid / total;
      
      const precision = this.metrics.detection.precision;
      const recall = this.metrics.detection.recall;
      this.metrics.detection.f1Score = precision + recall > 0 ? 
        2 * (precision * recall) / (precision + recall) : 0;
    }
  }

  // Performance Monitoring
  recordProcessingTime(timeMs) {
    this.metrics.performance.avgProcessingTime = 
      (this.metrics.performance.avgProcessingTime + timeMs) / 2;
    this.metrics.performance.maxProcessingTime = 
      Math.max(this.metrics.performance.maxProcessingTime, timeMs);
    this.metrics.performance.minProcessingTime = 
      Math.min(this.metrics.performance.minProcessingTime, timeMs);
  }

  updateSystemMetrics(systemData) {
    this.metrics.performance.cpuUsage = systemData.cpu;
    this.metrics.performance.memoryUsage = systemData.memory;
    this.metrics.system.diskUsage = systemData.disk;
    this.metrics.system.networkUsage = systemData.network;
  }

  // Trading Performance
  recordTrade(trade) {
    this.metrics.trading.totalTrades++;
    this.metrics.trading.totalPnL += trade.pnl;
    
    if (trade.pnl > 0) {
      this.metrics.trading.profitableTrades++;
    } else {
      this.metrics.trading.lossyTrades++;
    }
    
    this.metrics.trading.winRate = 
      this.metrics.trading.profitableTrades / this.metrics.trading.totalTrades;
    
    this.metrics.trading.avgTradeSize = 
      (this.metrics.trading.avgTradeSize + trade.size) / 2;
  }

  // Alert System
  checkAlerts() {
    const alerts = [];
    
    // Performance alerts
    if (this.metrics.performance.avgProcessingTime > 5000) {
      alerts.push({
        type: 'performance',
        severity: 'high',
        message: 'High processing latency detected',
        value: this.metrics.performance.avgProcessingTime
      });
    }
    
    // Detection accuracy alerts
    if (this.metrics.detection.accuracy < 0.85) {
      alerts.push({
        type: 'detection',
        severity: 'medium',
        message: 'Detection accuracy below threshold',
        value: this.metrics.detection.accuracy
      });
    }
    
    // System resource alerts
    if (this.metrics.performance.memoryUsage > 0.9) {
      alerts.push({
        type: 'system',
        severity: 'high',
        message: 'High memory usage detected',
        value: this.metrics.performance.memoryUsage
      });
    }
    
    this.alerts = alerts;
    return alerts;
  }

  // Reporting
  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      metrics: this.metrics,
      alerts: this.alerts,
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.metrics.detection.falsePositiveRate > 0.1) {
      recommendations.push({
        category: 'detection',
        priority: 'high',
        description: 'Tune detection parameters to reduce false positives',
        action: 'Adjust sensitivity thresholds'
      });
    }
    
    if (this.metrics.performance.avgProcessingTime > 3000) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        description: 'Optimize processing pipeline for better latency',
        action: 'Implement caching and parallel processing'
      });
    }
    
    if (this.metrics.trading.winRate < 0.6) {
      recommendations.push({
        category: 'trading',
        priority: 'high',
        description: 'Review trading strategy effectiveness',
        action: 'Backtest and optimize entry/exit conditions'
      });
    }
    
    return recommendations;
  }

  // Data export for further analysis
  exportMetrics(format = 'json') {
    const data = {
      metrics: this.metrics,
      historical: this.historicalData,
      timestamp: new Date().toISOString()
    };
    
    switch (format) {
      case 'csv':
        return this.convertToCSV(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  convertToCSV(data) {
    // Implementation for CSV conversion
    const rows = [];
    rows.push(['Metric', 'Category', 'Value', 'Timestamp']);
    
    Object.entries(data.metrics).forEach(([category, metrics]) => {
      Object.entries(metrics).forEach(([metric, value]) => {
        rows.push([metric, category, value, data.timestamp]);
      });
    });
    
    return rows.map(row => row.join(',')).join('\n');
  }
}

module.exports = TokenDetectionMetrics;