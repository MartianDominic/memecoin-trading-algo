"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiServer = void 0;
// Express API Server with WebSocket Support for Memecoin Trading Dashboard
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
// Create logger instance
const logger = logger_1.Logger.getInstance();
// Import controllers
const tokens_controller_1 = require("./controllers/tokens.controller");
const filters_controller_1 = require("./controllers/filters.controller");
const alerts_controller_1 = require("./controllers/alerts.controller");
const analytics_controller_1 = require("./controllers/analytics.controller");
const error_middleware_1 = require("./middleware/error.middleware");
const request_logger_middleware_1 = require("./middleware/request-logger.middleware");
// Import routes
const tokens_routes_1 = require("./routes/tokens.routes");
const filters_routes_1 = require("./routes/filters.routes");
const alerts_routes_1 = require("./routes/alerts.routes");
const analytics_routes_1 = require("./routes/analytics.routes");
const export_routes_1 = require("./routes/export.routes");
// Import WebSocket handlers
const websocket_manager_1 = require("./websocket/websocket-manager");
class ApiServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.httpServer = (0, http_1.createServer)(this.app);
        this.prisma = new client_1.PrismaClient();
        // Initialize WebSocket
        this.wss = new ws_1.WebSocketServer({
            server: this.httpServer,
            path: '/api/v1/ws'
        });
        this.wsManager = new websocket_manager_1.WebSocketManager(this.wss, this.prisma);
        // Initialize controllers
        this.tokensController = new tokens_controller_1.TokensController(this.prisma, this.wsManager);
        this.filtersController = new filters_controller_1.FiltersController(this.prisma, this.wsManager);
        this.alertsController = new alerts_controller_1.AlertsController(this.prisma, this.wsManager);
        this.analyticsController = new analytics_controller_1.AnalyticsController(this.prisma);
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeWebSocket();
        this.initializeErrorHandling();
    }
    initializeMiddleware() {
        // Trust proxy for rate limiting and IP detection
        this.app.set('trust proxy', 1);
        // Security middleware
        this.app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                },
            },
            crossOriginEmbedderPolicy: false,
        }));
        // CORS configuration
        this.app.use((0, cors_1.default)({
            origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5173'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
        }));
        // Body parsing middleware
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        // Request logging
        this.app.use(request_logger_middleware_1.requestLogger);
        // Rate limiting
        const rateLimiter = (0, express_rate_limit_1.default)({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // Limit each IP
            message: {
                error: 'Too many requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                return req.ip || req.connection.remoteAddress || 'unknown';
            },
            skip: (req) => {
                // Skip rate limiting for health checks
                return req.path === '/health' || req.path === '/api/v1/health';
            }
        });
        this.app.use('/api/v1/', rateLimiter);
        // API-specific rate limiting for expensive operations
        const strictRateLimiter = (0, express_rate_limit_1.default)({
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 100, // Much lower limit for exports and heavy queries
            message: {
                error: 'Rate limit exceeded for this operation',
                message: 'This operation has a stricter rate limit. Please try again later.',
            }
        });
        this.app.use('/api/v1/export', strictRateLimiter);
        this.app.use('/api/v1/analytics', strictRateLimiter);
    }
    initializeRoutes() {
        // API versioning and info
        this.app.get('/api/v1', (req, res) => {
            res.json({
                name: 'Memecoin Trading API',
                version: '1.0.0',
                description: 'Real-time memecoin trading data and analytics API',
                endpoints: {
                    tokens: '/api/v1/tokens',
                    filters: '/api/v1/filters',
                    alerts: '/api/v1/alerts',
                    analytics: '/api/v1/analytics',
                    export: '/api/v1/export',
                    websocket: '/api/v1/ws'
                },
                documentation: '/api/v1/docs',
                timestamp: new Date().toISOString(),
            });
        });
        // Health check endpoint
        this.app.get('/api/v1/health', async (req, res) => {
            try {
                // Check database connection
                await this.prisma.$queryRaw `SELECT 1`;
                // Check WebSocket server
                const wsConnections = this.wsManager.getConnectionCount();
                res.json({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    environment: process.env.NODE_ENV || 'development',
                    uptime: process.uptime(),
                    database: 'connected',
                    websocket: {
                        status: 'active',
                        connections: wsConnections
                    },
                    memory: {
                        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
                    }
                });
            }
            catch (error) {
                logger.error('Health check failed:', { error: error instanceof Error ? error.message : String(error) });
                res.status(503).json({
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    error: 'Service unavailable',
                    details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
                });
            }
        });
        // Mount API routes
        this.app.use('/api/v1/tokens', (0, tokens_routes_1.createTokenRoutes)(this.tokensController));
        this.app.use('/api/v1/filters', (0, filters_routes_1.createFilterRoutes)(this.filtersController));
        this.app.use('/api/v1/alerts', (0, alerts_routes_1.createAlertRoutes)(this.alertsController));
        this.app.use('/api/v1/analytics', (0, analytics_routes_1.createAnalyticsRoutes)(this.analyticsController));
        this.app.use('/api/v1/export', (0, export_routes_1.createExportRoutes)(this.tokensController));
        // API documentation endpoint (placeholder)
        this.app.get('/api/v1/docs', (req, res) => {
            res.json({
                message: 'API Documentation',
                version: '1.0.0',
                endpoints: {
                    'GET /api/v1/tokens': 'List tokens with pagination and filters',
                    'GET /api/v1/tokens/:address': 'Get specific token details',
                    'POST /api/v1/filters': 'Create custom filter',
                    'GET /api/v1/filters': 'List user filters',
                    'GET /api/v1/alerts': 'Get active alerts',
                    'POST /api/v1/alerts/:id/acknowledge': 'Acknowledge alert',
                    'GET /api/v1/analytics/summary': 'Dashboard summary stats',
                    'GET /api/v1/export/:format': 'Export filtered data',
                    'WS /api/v1/ws': 'WebSocket connection for real-time updates'
                },
                authentication: 'Optional API key in X-API-Key header',
                rateLimit: '1000 requests per 15 minutes per IP',
                timestamp: new Date().toISOString()
            });
        });
    }
    initializeWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const clientId = this.wsManager.handleConnection(ws, req);
            logger.info(`WebSocket client connected: ${clientId}`);
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.wsManager.handleMessage(clientId, message);
                }
                catch (error) {
                    logger.error('Invalid WebSocket message:', { error: error instanceof Error ? error.message : String(error) });
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format',
                        timestamp: new Date().toISOString()
                    }));
                }
            });
            ws.on('close', () => {
                this.wsManager.handleDisconnection(clientId);
                logger.info(`WebSocket client disconnected: ${clientId}`);
            });
            ws.on('error', (error) => {
                logger.error(`WebSocket error for client ${clientId}:`, { error: error instanceof Error ? error.message : String(error) });
                this.wsManager.handleDisconnection(clientId);
            });
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'welcome',
                clientId,
                timestamp: new Date().toISOString(),
                availableChannels: ['tokens', 'alerts', 'signals', 'filters']
            }));
        });
        // Setup periodic data broadcasts
        setInterval(() => {
            this.wsManager.broadcastMarketUpdate();
        }, 5 * 60 * 1000); // Every 5 minutes
        logger.info('WebSocket server initialized on /api/v1/ws');
    }
    initializeErrorHandling() {
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not Found',
                message: `Route ${req.originalUrl} not found`,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });
        // Global error handler
        this.app.use(error_middleware_1.errorHandler);
    }
    async start() {
        try {
            // Connect to database
            await this.prisma.$connect();
            logger.info('Database connected successfully');
            // Start HTTP server
            const port = parseInt(process.env.API_PORT || '3001', 10);
            this.httpServer.listen(port, () => {
                logger.info(`API Server running on port ${port}`, {
                    environment: process.env.NODE_ENV || 'development',
                    port,
                    endpoints: {
                        api: `http://localhost:${port}/api/v1`,
                        docs: `http://localhost:${port}/api/v1/docs`,
                        health: `http://localhost:${port}/api/v1/health`,
                        websocket: `ws://localhost:${port}/api/v1/ws`
                    }
                });
            });
            // Graceful shutdown handlers
            process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
            process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        }
        catch (error) {
            logger.error('Failed to start API server:', { error: error instanceof Error ? error.message : String(error) });
            process.exit(1);
        }
    }
    async gracefulShutdown(signal) {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        // Close WebSocket connections
        this.wsManager.closeAllConnections();
        // Close HTTP server
        this.httpServer.close(() => {
            logger.info('HTTP server closed');
        });
        // Disconnect from database
        await this.prisma.$disconnect();
        logger.info('Database disconnected');
        process.exit(0);
    }
    // Getters for testing and external access
    get server() {
        return this.httpServer;
    }
    get websocketManager() {
        return this.wsManager;
    }
    get database() {
        return this.prisma;
    }
}
exports.ApiServer = ApiServer;
// Export for use in other modules
exports.default = ApiServer;
//# sourceMappingURL=api-server.js.map