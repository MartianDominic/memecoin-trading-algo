"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertsController = void 0;
const zod_1 = require("zod");
const logger_1 = require("../../backend/src/config/logger");
const api_types_1 = require("../types/api.types");
// In-memory alert storage (in production, use database)
class AlertStorage {
    constructor() {
        this.alerts = new Map();
        this.alertTriggers = new Map();
    }
    createAlert(alert) {
        this.alerts.set(alert.id, alert);
    }
    getAlert(id) {
        return this.alerts.get(id);
    }
    listAlerts(filters = {}) {
        let alerts = Array.from(this.alerts.values());
        if (filters.type) {
            alerts = alerts.filter(alert => alert.type === filters.type);
        }
        if (filters.severity) {
            alerts = alerts.filter(alert => alert.severity === filters.severity);
        }
        if (filters.isRead !== undefined) {
            alerts = alerts.filter(alert => alert.isRead === filters.isRead);
        }
        if (filters.tokenAddress) {
            alerts = alerts.filter(alert => alert.tokenAddress === filters.tokenAddress);
        }
        if (filters.startDate) {
            const startDate = new Date(filters.startDate);
            alerts = alerts.filter(alert => new Date(alert.triggeredAt) >= startDate);
        }
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            alerts = alerts.filter(alert => new Date(alert.triggeredAt) <= endDate);
        }
        // Sort by triggered date (newest first)
        return alerts.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
    }
    updateAlert(id, updates) {
        const alert = this.alerts.get(id);
        if (!alert)
            return undefined;
        const updatedAlert = { ...alert, ...updates };
        this.alerts.set(id, updatedAlert);
        return updatedAlert;
    }
    deleteAlert(id) {
        return this.alerts.delete(id);
    }
    getActiveAlerts() {
        return Array.from(this.alerts.values()).filter(alert => !alert.isRead);
    }
    createTrigger(alertId, condition) {
        this.alertTriggers.set(alertId, condition);
    }
    getTrigger(alertId) {
        return this.alertTriggers.get(alertId);
    }
    getAllTriggers() {
        return Array.from(this.alertTriggers.entries());
    }
}
class AlertsController {
    constructor(prisma, wsManager) {
        this.prisma = prisma;
        this.wsManager = wsManager;
        this.alertStorage = new AlertStorage();
        // Initialize with sample alerts
        this.initializeSampleAlerts();
    }
    // GET /api/v1/alerts - Get alerts with pagination and filters
    async getAlerts(req, res) {
        try {
            const query = api_types_1.alertsQuerySchema.parse(req.query);
            const allAlerts = this.alertStorage.listAlerts(query);
            const total = allAlerts.length;
            // Apply pagination
            const skip = (query.page - 1) * query.limit;
            const paginatedAlerts = allAlerts.slice(skip, skip + query.limit);
            const response = {
                success: true,
                data: paginatedAlerts,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total,
                    totalPages: Math.ceil(total / query.limit),
                    hasNext: skip + query.limit < total,
                    hasPrev: query.page > 1
                },
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Alerts retrieved successfully', {
                count: paginatedAlerts.length,
                total,
                filters: query
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
                    message: 'Invalid query parameters',
                    details: error.errors,
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            logger_1.logger.error('Error fetching alerts:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch alerts',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // GET /api/v1/alerts/:id - Get specific alert
    async getAlert(req, res) {
        try {
            const { id } = req.params;
            const alert = this.alertStorage.getAlert(id);
            if (!alert) {
                res.status(404).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.ALERT_NOT_FOUND,
                    message: 'Alert not found',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const response = {
                success: true,
                data: alert,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Alert retrieved successfully', {
                alertId: id,
                type: alert.type
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching alert:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch alert',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // POST /api/v1/alerts - Create new alert trigger
    async createAlert(req, res) {
        try {
            const alertData = api_types_1.createAlertSchema.parse(req.body);
            const alert = {
                id: this.generateId(),
                type: alertData.type,
                title: this.generateAlertTitle(alertData),
                message: alertData.message || this.generateAlertMessage(alertData),
                severity: alertData.severity || 'MEDIUM',
                tokenAddress: alertData.tokenAddress,
                tokenSymbol: undefined, // Will be resolved from tokenAddress
                triggeredAt: new Date().toISOString(),
                isRead: false,
                metadata: {
                    condition: alertData.condition,
                    createdBy: req.headers['x-user-id'] || 'system'
                }
            };
            // Resolve token symbol if tokenAddress provided
            if (alert.tokenAddress) {
                try {
                    const token = await this.prisma.token.findUnique({
                        where: { address: alert.tokenAddress },
                        select: { symbol: true }
                    });
                    if (token) {
                        alert.tokenSymbol = token.symbol;
                    }
                }
                catch (error) {
                    logger_1.logger.warn('Failed to resolve token symbol:', error);
                }
            }
            this.alertStorage.createAlert(alert);
            this.alertStorage.createTrigger(alert.id, alertData.condition);
            // Broadcast alert via WebSocket
            this.wsManager.broadcastAlert(alert);
            const response = {
                success: true,
                data: alert,
                message: 'Alert created successfully',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.status(201).json(response);
            logger_1.logger.info('Alert created successfully', {
                alertId: alert.id,
                type: alert.type,
                tokenAddress: alert.tokenAddress
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
                    message: 'Invalid alert data',
                    details: error.errors,
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            logger_1.logger.error('Error creating alert:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to create alert',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // POST /api/v1/alerts/:id/acknowledge - Mark alert as read/acknowledged
    async acknowledgeAlert(req, res) {
        try {
            const { id } = req.params;
            const alert = this.alertStorage.getAlert(id);
            if (!alert) {
                res.status(404).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.ALERT_NOT_FOUND,
                    message: 'Alert not found',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const updatedAlert = this.alertStorage.updateAlert(id, {
                isRead: true,
                acknowledgedAt: new Date().toISOString()
            });
            const response = {
                success: true,
                data: updatedAlert,
                message: 'Alert acknowledged successfully',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Alert acknowledged successfully', {
                alertId: id
            });
        }
        catch (error) {
            logger_1.logger.error('Error acknowledging alert:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to acknowledge alert',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // DELETE /api/v1/alerts/:id - Dismiss/delete alert
    async dismissAlert(req, res) {
        try {
            const { id } = req.params;
            const alert = this.alertStorage.getAlert(id);
            if (!alert) {
                res.status(404).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.ALERT_NOT_FOUND,
                    message: 'Alert not found',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const deleted = this.alertStorage.deleteAlert(id);
            if (!deleted) {
                res.status(500).json({
                    success: false,
                    error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                    message: 'Failed to dismiss alert',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                });
                return;
            }
            const response = {
                success: true,
                message: 'Alert dismissed successfully',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Alert dismissed successfully', {
                alertId: id
            });
        }
        catch (error) {
            logger_1.logger.error('Error dismissing alert:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to dismiss alert',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // GET /api/v1/alerts/summary - Get alert summary statistics
    async getAlertSummary(req, res) {
        try {
            const allAlerts = this.alertStorage.listAlerts();
            const activeAlerts = this.alertStorage.getActiveAlerts();
            const summary = {
                total: allAlerts.length,
                active: activeAlerts.length,
                acknowledged: allAlerts.filter(a => a.isRead).length,
                bySeverity: {
                    LOW: allAlerts.filter(a => a.severity === 'LOW').length,
                    MEDIUM: allAlerts.filter(a => a.severity === 'MEDIUM').length,
                    HIGH: allAlerts.filter(a => a.severity === 'HIGH').length,
                    CRITICAL: allAlerts.filter(a => a.severity === 'CRITICAL').length,
                },
                byType: {
                    PRICE_ALERT: allAlerts.filter(a => a.type === 'PRICE_ALERT').length,
                    VOLUME_ALERT: allAlerts.filter(a => a.type === 'VOLUME_ALERT').length,
                    SAFETY_ALERT: allAlerts.filter(a => a.type === 'SAFETY_ALERT').length,
                    SIGNAL_ALERT: allAlerts.filter(a => a.type === 'SIGNAL_ALERT').length,
                    NEWS_ALERT: allAlerts.filter(a => a.type === 'NEWS_ALERT').length,
                },
                recent: allAlerts.slice(0, 5) // Last 5 alerts
            };
            const response = {
                success: true,
                data: summary,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
            res.json(response);
            logger_1.logger.info('Alert summary retrieved successfully');
        }
        catch (error) {
            logger_1.logger.error('Error fetching alert summary:', error);
            res.status(500).json({
                success: false,
                error: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
                message: 'Failed to fetch alert summary',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        }
    }
    // Trigger alert evaluation (called by data pipeline)
    async triggerAlert(tokenAddress, metric, value) {
        try {
            // Find all active triggers that might be affected
            const triggers = this.alertStorage.getAllTriggers();
            for (const [alertId, condition] of triggers) {
                if (condition.metric === metric) {
                    const shouldTrigger = this.evaluateCondition(condition, value);
                    if (shouldTrigger) {
                        const alert = {
                            id: this.generateId(),
                            type: this.getAlertTypeFromMetric(metric),
                            title: `${metric} Alert`,
                            message: `${metric} value ${value} triggered alert condition`,
                            severity: 'MEDIUM',
                            tokenAddress,
                            triggeredAt: new Date().toISOString(),
                            isRead: false,
                            metadata: {
                                metric,
                                value,
                                condition,
                                triggeredBy: 'system'
                            }
                        };
                        this.alertStorage.createAlert(alert);
                        this.wsManager.broadcastAlert(alert);
                        logger_1.logger.info('Alert triggered automatically', {
                            alertId: alert.id,
                            tokenAddress,
                            metric,
                            value
                        });
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error triggering alerts:', error);
        }
    }
    evaluateCondition(condition, value) {
        switch (condition.operator) {
            case 'gt': return value > condition.value;
            case 'gte': return value >= condition.value;
            case 'lt': return value < condition.value;
            case 'lte': return value <= condition.value;
            case 'eq': return value === condition.value;
            default: return false;
        }
    }
    getAlertTypeFromMetric(metric) {
        if (metric.includes('price'))
            return 'PRICE_ALERT';
        if (metric.includes('volume'))
            return 'VOLUME_ALERT';
        if (metric.includes('safety') || metric.includes('risk'))
            return 'SAFETY_ALERT';
        if (metric.includes('signal'))
            return 'SIGNAL_ALERT';
        return 'NEWS_ALERT';
    }
    generateAlertTitle(alertData) {
        const metricName = alertData.condition.metric.replace('_', ' ').toUpperCase();
        return `${metricName} Alert`;
    }
    generateAlertMessage(alertData) {
        const { metric, operator, value } = alertData.condition;
        const operatorText = {
            'gt': 'greater than',
            'gte': 'greater than or equal to',
            'lt': 'less than',
            'lte': 'less than or equal to',
            'eq': 'equal to'
        }[operator];
        return `Alert triggered when ${metric} is ${operatorText} ${value}`;
    }
    generateId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    initializeSampleAlerts() {
        // Create sample alerts for demonstration
        const sampleAlerts = [
            {
                id: 'alert_sample_1',
                type: 'PRICE_ALERT',
                title: 'High Price Movement Detected',
                message: 'Token DOGE has increased by 25% in the last hour',
                severity: 'HIGH',
                tokenAddress: 'DGFzH5FEcLJcr8T2Dv9jMKV9BxPGvXdLyKLv5qV8pump',
                tokenSymbol: 'DOGE',
                triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
                isRead: false,
                metadata: {
                    priceChange: 25.5,
                    previousPrice: 0.08,
                    currentPrice: 0.1
                }
            },
            {
                id: 'alert_sample_2',
                type: 'VOLUME_ALERT',
                title: 'Volume Spike Alert',
                message: 'Unusual trading volume detected for PEPE',
                severity: 'MEDIUM',
                tokenAddress: 'PEPEjHzQqHQQfH5JnJLVKzPdqrGqqLxgN4VJ3Rnpump',
                tokenSymbol: 'PEPE',
                triggeredAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
                isRead: false,
                metadata: {
                    volumeIncrease: 340,
                    normalVolume: 50000,
                    currentVolume: 220000
                }
            },
            {
                id: 'alert_sample_3',
                type: 'SAFETY_ALERT',
                title: 'Low Safety Score Warning',
                message: 'Token SCAM has a very low safety score of 2.1/10',
                severity: 'CRITICAL',
                tokenAddress: 'SCAMxyz123456789',
                tokenSymbol: 'SCAM',
                triggeredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
                isRead: true,
                acknowledgedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
                metadata: {
                    safetyScore: 2.1,
                    riskLevel: 'VERY_HIGH',
                    riskFactors: ['honeypot_detected', 'no_liquidity', 'mint_authority']
                }
            }
        ];
        sampleAlerts.forEach(alert => {
            this.alertStorage.createAlert(alert);
        });
        logger_1.logger.info('Sample alerts initialized', { count: sampleAlerts.length });
    }
}
exports.AlertsController = AlertsController;
//# sourceMappingURL=alerts.controller.js.map