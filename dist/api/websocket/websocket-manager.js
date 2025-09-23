"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
// WebSocket Manager - Real-time Broadcasting and Connection Management
const ws_1 = require("ws");
const logger_1 = require("../../backend/src/config/logger");
class WebSocketManager {
    constructor(wss, prisma) {
        this.wss = wss;
        this.prisma = prisma;
        this.clients = new Map();
        this.channelSubscriptions = new Map(); // channel -> client IDs
        this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
        this.CONNECTION_TIMEOUT = 60000; // 60 seconds
        this.startHeartbeat();
        logger_1.logger.info('WebSocket Manager initialized');
    }
    handleConnection(ws, req) {
        const clientId = this.generateClientId();
        const userAgent = req.headers['user-agent'];
        const ip = this.getClientIP(req);
        const client = {
            id: clientId,
            ws,
            subscriptions: new Set(),
            metadata: {
                userAgent,
                ip,
                connectedAt: new Date(),
                lastPing: new Date()
            }
        };
        this.clients.set(clientId, client);
        // Set up WebSocket event handlers
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(clientId, message);
            }
            catch (error) {
                logger_1.logger.error('Invalid WebSocket message format:', error);
                this.sendError(clientId, 'Invalid message format');
            }
        });
        ws.on('close', () => {
            this.handleDisconnection(clientId);
        });
        ws.on('error', (error) => {
            logger_1.logger.error(`WebSocket error for client ${clientId}:`, error);
            this.handleDisconnection(clientId);
        });
        // Send welcome message
        this.sendMessage(clientId, {
            type: 'welcome',
            payload: {
                clientId,
                availableChannels: this.getAvailableChannels(),
                serverTime: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        });
        logger_1.logger.info('WebSocket client connected', {
            clientId,
            ip,
            userAgent: userAgent?.substring(0, 100)
        });
        return clientId;
    }
    handleMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) {
            logger_1.logger.warn('Message from unknown client:', clientId);
            return;
        }
        switch (message.type) {
            case 'subscribe':
                this.handleSubscription(clientId, message.channels, message.filters);
                break;
            case 'unsubscribe':
                this.handleUnsubscription(clientId, message.channels);
                break;
            case 'ping':
                this.handlePing(clientId);
                break;
            default:
                logger_1.logger.warn('Unknown message type:', message);
                this.sendError(clientId, 'Unknown message type');
        }
    }
    handleDisconnection(clientId) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        // Remove from all channel subscriptions
        client.subscriptions.forEach(channel => {
            const channelClients = this.channelSubscriptions.get(channel);
            if (channelClients) {
                channelClients.delete(clientId);
                if (channelClients.size === 0) {
                    this.channelSubscriptions.delete(channel);
                }
            }
        });
        // Remove client
        this.clients.delete(clientId);
        logger_1.logger.info('WebSocket client disconnected', {
            clientId,
            connectionDuration: Date.now() - client.metadata.connectedAt.getTime()
        });
    }
    broadcastTokenUpdate(tokenAddress, data) {
        const message = {
            type: 'TOKEN_UPDATE',
            payload: {
                address: tokenAddress,
                priceData: data.payload?.priceData,
                safetyScore: data.payload?.safetyScore,
                signals: data.payload?.signals
            },
            timestamp: new Date().toISOString(),
            channel: `token:${tokenAddress}`
        };
        this.broadcastToChannel(`token:${tokenAddress}`, message);
        this.broadcastToChannel('tokens', message); // Also broadcast to general tokens channel
    }
    broadcastAlert(alert) {
        const message = {
            type: 'ALERT',
            payload: alert,
            timestamp: new Date().toISOString(),
            channel: 'alerts'
        };
        this.broadcastToChannel('alerts', message);
        // Also send to token-specific channel if applicable
        if (alert.tokenAddress) {
            this.broadcastToChannel(`token:${alert.tokenAddress}`, message);
        }
    }
    broadcastFilterResults(filterId, data) {
        const message = {
            type: 'FILTER_RESULT',
            payload: {
                filterId,
                results: data.payload?.results || [],
                count: data.payload?.count || 0
            },
            timestamp: new Date().toISOString(),
            channel: `filter:${filterId}`
        };
        this.broadcastToChannel(`filter:${filterId}`, message);
        this.broadcastToChannel('filters', message);
    }
    broadcastMarketUpdate() {
        // Broadcast general market updates periodically
        const message = {
            type: 'PRICE_UPDATE',
            payload: {
                marketStatus: 'active',
                lastUpdate: new Date().toISOString(),
                connectionCount: this.clients.size
            },
            timestamp: new Date().toISOString(),
            channel: 'market'
        };
        this.broadcastToChannel('market', message);
    }
    getConnectionCount() {
        return this.clients.size;
    }
    getChannelSubscriptions() {
        const subscriptions = {};
        this.channelSubscriptions.forEach((clients, channel) => {
            subscriptions[channel] = clients.size;
        });
        return subscriptions;
    }
    closeAllConnections() {
        this.clients.forEach((client, clientId) => {
            try {
                client.ws.close(1000, 'Server shutdown');
            }
            catch (error) {
                logger_1.logger.error(`Error closing connection for client ${clientId}:`, error);
            }
        });
        this.clients.clear();
        this.channelSubscriptions.clear();
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        logger_1.logger.info('All WebSocket connections closed');
    }
    handleSubscription(clientId, channels, filters) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        const validChannels = channels.filter(channel => this.isValidChannel(channel));
        validChannels.forEach(channel => {
            // Add client to channel
            client.subscriptions.add(channel);
            if (!this.channelSubscriptions.has(channel)) {
                this.channelSubscriptions.set(channel, new Set());
            }
            this.channelSubscriptions.get(channel).add(clientId);
        });
        this.sendMessage(clientId, {
            type: 'subscription_ack',
            payload: {
                subscribed: validChannels,
                filters
            },
            timestamp: new Date().toISOString()
        });
        logger_1.logger.info('Client subscribed to channels', {
            clientId,
            channels: validChannels
        });
    }
    handleUnsubscription(clientId, channels) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        channels.forEach(channel => {
            client.subscriptions.delete(channel);
            const channelClients = this.channelSubscriptions.get(channel);
            if (channelClients) {
                channelClients.delete(clientId);
                if (channelClients.size === 0) {
                    this.channelSubscriptions.delete(channel);
                }
            }
        });
        this.sendMessage(clientId, {
            type: 'unsubscription_ack',
            payload: {
                unsubscribed: channels
            },
            timestamp: new Date().toISOString()
        });
        logger_1.logger.info('Client unsubscribed from channels', {
            clientId,
            channels
        });
    }
    handlePing(clientId) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        client.metadata.lastPing = new Date();
        const pongMessage = {
            type: 'pong',
            timestamp: new Date().toISOString()
        };
        this.sendMessage(clientId, pongMessage);
    }
    broadcastToChannel(channel, message) {
        const channelClients = this.channelSubscriptions.get(channel);
        if (!channelClients || channelClients.size === 0) {
            return;
        }
        const messageStr = JSON.stringify(message);
        let sentCount = 0;
        let failedCount = 0;
        channelClients.forEach(clientId => {
            const client = this.clients.get(clientId);
            if (client && client.ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    client.ws.send(messageStr);
                    sentCount++;
                }
                catch (error) {
                    logger_1.logger.error(`Failed to send message to client ${clientId}:`, error);
                    failedCount++;
                    this.handleDisconnection(clientId);
                }
            }
            else {
                // Clean up dead connections
                this.handleDisconnection(clientId);
                failedCount++;
            }
        });
        if (sentCount > 0) {
            logger_1.logger.debug('Broadcast message sent', {
                channel,
                messageType: message.type,
                recipients: sentCount,
                failed: failedCount
            });
        }
    }
    sendMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== ws_1.WebSocket.OPEN) {
            return;
        }
        try {
            client.ws.send(JSON.stringify(message));
        }
        catch (error) {
            logger_1.logger.error(`Failed to send message to client ${clientId}:`, error);
            this.handleDisconnection(clientId);
        }
    }
    sendError(clientId, message) {
        this.sendMessage(clientId, {
            type: 'error',
            payload: {
                message,
                timestamp: new Date().toISOString()
            }
        });
    }
    isValidChannel(channel) {
        const validChannels = [
            'tokens',
            'alerts',
            'filters',
            'market',
            'signals'
        ];
        // Check for valid channel patterns
        const channelPatterns = [
            /^token:[a-zA-Z0-9]+$/, // token:ADDRESS
            /^filter:[a-zA-Z0-9_]+$/, // filter:FILTER_ID
            /^user:[a-zA-Z0-9_]+$/ // user:USER_ID
        ];
        return validChannels.includes(channel) ||
            channelPatterns.some(pattern => pattern.test(channel));
    }
    getAvailableChannels() {
        return [
            'tokens', // All token updates
            'alerts', // Alert notifications
            'filters', // Filter execution results
            'market', // General market updates
            'signals' // Trading signals
        ];
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            const now = new Date();
            const deadClients = [];
            this.clients.forEach((client, clientId) => {
                const timeSinceLastPing = now.getTime() - (client.metadata.lastPing?.getTime() || 0);
                if (timeSinceLastPing > this.CONNECTION_TIMEOUT) {
                    deadClients.push(clientId);
                }
                else if (client.ws.readyState === ws_1.WebSocket.OPEN) {
                    // Send ping
                    try {
                        client.ws.ping();
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to ping client ${clientId}:`, error);
                        deadClients.push(clientId);
                    }
                }
            });
            // Clean up dead connections
            deadClients.forEach(clientId => {
                this.handleDisconnection(clientId);
            });
            if (deadClients.length > 0) {
                logger_1.logger.info('Cleaned up dead WebSocket connections', {
                    count: deadClients.length
                });
            }
        }, this.HEARTBEAT_INTERVAL);
    }
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getClientIP(req) {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded
            ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
            : req.socket.remoteAddress;
        return ip || 'unknown';
    }
}
exports.WebSocketManager = WebSocketManager;
//# sourceMappingURL=websocket-manager.js.map