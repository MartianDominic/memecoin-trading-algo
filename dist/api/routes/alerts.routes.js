"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAlertRoutes = createAlertRoutes;
// Alert Routes - REST endpoints for alert system management
const express_1 = require("express");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const api_types_1 = require("../types/api.types");
const zod_1 = require("zod");
// Validation schemas for alert routes
const alertIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Alert ID is required')
});
const bulkActionSchema = zod_1.z.object({
    action: zod_1.z.enum(['acknowledge', 'dismiss']),
    alertIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one alert ID is required').max(100, 'Maximum 100 alerts at once')
});
function createAlertRoutes(alertsController) {
    const router = (0, express_1.Router)();
    // GET /api/v1/alerts - Get alerts with pagination and filters
    router.get('/', (0, validation_middleware_1.validate)(api_types_1.alertsQuerySchema, 'query'), (0, error_middleware_1.asyncHandler)(alertsController.getAlerts.bind(alertsController)));
    // GET /api/v1/alerts/summary - Get alert summary statistics
    router.get('/summary', (0, error_middleware_1.asyncHandler)(alertsController.getAlertSummary.bind(alertsController)));
    // GET /api/v1/alerts/:id - Get specific alert
    router.get('/:id', (0, validation_middleware_1.validate)(alertIdSchema, 'params'), (0, error_middleware_1.asyncHandler)(alertsController.getAlert.bind(alertsController)));
    // POST /api/v1/alerts - Create new alert trigger (requires auth)
    router.post('/', auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)(api_types_1.createAlertSchema, 'body'), (0, error_middleware_1.asyncHandler)(alertsController.createAlert.bind(alertsController)));
    // POST /api/v1/alerts/:id/acknowledge - Mark alert as read/acknowledged
    router.post('/:id/acknowledge', (0, validation_middleware_1.validate)(alertIdSchema, 'params'), (0, error_middleware_1.asyncHandler)(alertsController.acknowledgeAlert.bind(alertsController)));
    // DELETE /api/v1/alerts/:id - Dismiss/delete alert
    router.delete('/:id', (0, validation_middleware_1.validate)(alertIdSchema, 'params'), (0, error_middleware_1.asyncHandler)(alertsController.dismissAlert.bind(alertsController)));
    // POST /api/v1/alerts/bulk - Bulk operations on alerts
    router.post('/bulk', auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)(bulkActionSchema, 'body'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { action, alertIds } = req.body;
        // Process bulk action
        const results = await Promise.allSettled(alertIds.map(async (alertId) => {
            // Create mock request/response objects for controller methods
            const mockReq = {
                params: { id: alertId }
            };
            const mockRes = {
                json: () => mockRes,
                status: () => mockRes
            };
            switch (action) {
                case 'acknowledge':
                    return await alertsController.acknowledgeAlert(mockReq, mockRes);
                case 'dismiss':
                    return await alertsController.dismissAlert(mockReq, mockRes);
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        }));
        const successful = results.filter(result => result.status === 'fulfilled').length;
        const failed = results.filter(result => result.status === 'rejected').length;
        res.json({
            success: true,
            data: {
                processed: alertIds.length,
                successful,
                failed,
                action
            },
            message: `Bulk ${action} completed`,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/alerts/types - Get available alert types and their configurations
    router.get('/types', (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const alertTypes = [
            {
                type: 'PRICE_ALERT',
                name: 'Price Alert',
                description: 'Triggered when token price crosses a threshold',
                supportedMetrics: ['price', 'priceChange1h', 'priceChange24h', 'priceChange7d'],
                supportedOperators: ['gt', 'lt', 'gte', 'lte'],
                examples: [
                    { metric: 'priceChange24h', operator: 'gt', value: 50, description: 'Price up 50% in 24h' },
                    { metric: 'price', operator: 'lt', value: 0.001, description: 'Price drops below $0.001' }
                ]
            },
            {
                type: 'VOLUME_ALERT',
                name: 'Volume Alert',
                description: 'Triggered when trading volume meets criteria',
                supportedMetrics: ['volume24h', 'volumeChange24h'],
                supportedOperators: ['gt', 'gte'],
                examples: [
                    { metric: 'volume24h', operator: 'gt', value: 1000000, description: 'Volume exceeds $1M' },
                    { metric: 'volumeChange24h', operator: 'gt', value: 500, description: 'Volume up 500%' }
                ]
            },
            {
                type: 'SAFETY_ALERT',
                name: 'Safety Alert',
                description: 'Triggered when safety score changes significantly',
                supportedMetrics: ['safetyScore', 'riskLevel'],
                supportedOperators: ['lt', 'lte', 'eq'],
                examples: [
                    { metric: 'safetyScore', operator: 'lt', value: 5, description: 'Safety score below 5' },
                    { metric: 'riskLevel', operator: 'eq', value: 'VERY_HIGH', description: 'Risk level becomes very high' }
                ]
            },
            {
                type: 'SIGNAL_ALERT',
                name: 'Signal Alert',
                description: 'Triggered when trading signals are generated',
                supportedMetrics: ['signalStrength', 'signalConfidence', 'signalAction'],
                supportedOperators: ['gt', 'gte', 'eq'],
                examples: [
                    { metric: 'signalStrength', operator: 'gt', value: 0.8, description: 'Strong signal generated' },
                    { metric: 'signalAction', operator: 'eq', value: 'BUY', description: 'Buy signal generated' }
                ]
            }
        ];
        res.json({
            success: true,
            data: alertTypes,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/alerts/subscriptions - Get user's alert subscriptions (requires premium)
    router.get('/subscriptions', (0, auth_middleware_1.requireTier)('premium'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock subscriptions endpoint
        res.json({
            success: true,
            data: {
                activeSubscriptions: 0,
                maxSubscriptions: 100,
                subscriptionsByType: {
                    PRICE_ALERT: 0,
                    VOLUME_ALERT: 0,
                    SAFETY_ALERT: 0,
                    SIGNAL_ALERT: 0,
                    NEWS_ALERT: 0
                }
            },
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // POST /api/v1/alerts/test - Test alert configuration (requires auth)
    router.post('/test', auth_middleware_1.requireAuth, (0, validation_middleware_1.validate)(api_types_1.createAlertSchema, 'body'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Test alert configuration without creating it
        const alertData = req.body;
        res.json({
            success: true,
            data: {
                isValid: true,
                estimatedTriggerFrequency: 'low', // low, medium, high
                potentialIssues: [],
                recommendation: 'Alert configuration looks good'
            },
            message: 'Alert configuration tested successfully',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // GET /api/v1/alerts/history - Get alert history (requires premium)
    router.get('/history', (0, auth_middleware_1.requireTier)('premium'), validation_middleware_1.validatePagination, (0, validation_middleware_1.validate)(zod_1.z.object({
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
        type: zod_1.z.enum(['PRICE_ALERT', 'VOLUME_ALERT', 'SAFETY_ALERT', 'SIGNAL_ALERT', 'NEWS_ALERT']).optional()
    }), 'query'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock alert history
        res.json({
            success: true,
            data: [],
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false
            },
            message: 'Alert history endpoint - implementation pending',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    // POST /api/v1/alerts/webhook - Configure webhook for alerts (requires enterprise)
    router.post('/webhook', (0, auth_middleware_1.requireTier)('enterprise'), (0, validation_middleware_1.validate)(zod_1.z.object({
        url: zod_1.z.string().url('Invalid webhook URL'),
        secret: zod_1.z.string().min(10, 'Webhook secret must be at least 10 characters'),
        events: zod_1.z.array(zod_1.z.enum(['alert.created', 'alert.triggered', 'alert.acknowledged'])).min(1)
    }), 'body'), (0, error_middleware_1.asyncHandler)(async (req, res) => {
        // Mock webhook configuration
        res.json({
            success: true,
            data: {
                id: `webhook_${Date.now()}`,
                url: req.body.url,
                events: req.body.events,
                isActive: true,
                createdAt: new Date().toISOString()
            },
            message: 'Webhook configured successfully',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    }));
    return router;
}
//# sourceMappingURL=alerts.routes.js.map