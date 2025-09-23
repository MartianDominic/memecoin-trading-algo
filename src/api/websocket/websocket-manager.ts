// WebSocket Manager - Real-time Broadcasting and Connection Management
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../backend/src/config/logger';
import {
  WebSocketMessage,
  TokenUpdateMessage,
  AlertMessage,
  FilterResultMessage,
  Alert
} from '../types/api.types';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  metadata: {
    userAgent?: string;
    ip?: string;
    connectedAt: Date;
    lastPing?: Date;
    userId?: string;
  };
}

interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  channels: string[];
  filters?: Record<string, unknown>;
}

interface PingMessage {
  type: 'ping';
}

interface PongMessage {
  type: 'pong';
  timestamp: string;
}

type IncomingMessage = SubscriptionMessage | PingMessage;

export class WebSocketManager {
  private clients = new Map<string, ClientConnection>();
  private channelSubscriptions = new Map<string, Set<string>>(); // channel -> client IDs
  private heartbeatInterval: NodeJS.Timeout;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 60000; // 60 seconds

  constructor(
    private wss: WebSocketServer,
    private prisma: PrismaClient
  ) {
    this.startHeartbeat();
    logger.info('WebSocket Manager initialized');
  }

  public handleConnection(ws: WebSocket, req: IncomingMessage): string {
    const clientId = this.generateClientId();
    const userAgent = req.headers['user-agent'];
    const ip = this.getClientIP(req);

    const client: ClientConnection = {
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
        const message = JSON.parse(data.toString()) as IncomingMessage;
        this.handleMessage(clientId, message);
      } catch (error) {
        logger.error('Invalid WebSocket message format:', error);
        this.sendError(clientId, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
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

    logger.info('WebSocket client connected', {
      clientId,
      ip,
      userAgent: userAgent?.substring(0, 100)
    });

    return clientId;
  }

  public handleMessage(clientId: string, message: IncomingMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn('Message from unknown client:', clientId);
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
        logger.warn('Unknown message type:', message);
        this.sendError(clientId, 'Unknown message type');
    }
  }

  public handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

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

    logger.info('WebSocket client disconnected', {
      clientId,
      connectionDuration: Date.now() - client.metadata.connectedAt.getTime()
    });
  }

  public broadcastTokenUpdate(tokenAddress: string, data: Partial<TokenUpdateMessage>): void {
    const message: TokenUpdateMessage = {
      type: 'TOKEN_UPDATE',
      payload: {
        address: tokenAddress,
        priceData: data.payload?.priceData!,
        safetyScore: data.payload?.safetyScore,
        signals: data.payload?.signals
      },
      timestamp: new Date().toISOString(),
      channel: `token:${tokenAddress}`
    };

    this.broadcastToChannel(`token:${tokenAddress}`, message);
    this.broadcastToChannel('tokens', message); // Also broadcast to general tokens channel
  }

  public broadcastAlert(alert: Alert): void {
    const message: AlertMessage = {
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

  public broadcastFilterResults(filterId: string, data: Partial<FilterResultMessage>): void {
    const message: FilterResultMessage = {
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

  public broadcastMarketUpdate(): void {
    // Broadcast general market updates periodically
    const message: WebSocketMessage = {
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

  public getConnectionCount(): number {
    return this.clients.size;
  }

  public getChannelSubscriptions(): Record<string, number> {
    const subscriptions: Record<string, number> = {};
    this.channelSubscriptions.forEach((clients, channel) => {
      subscriptions[channel] = clients.size;
    });
    return subscriptions;
  }

  public closeAllConnections(): void {
    this.clients.forEach((client, clientId) => {
      try {
        client.ws.close(1000, 'Server shutdown');
      } catch (error) {
        logger.error(`Error closing connection for client ${clientId}:`, error);
      }
    });

    this.clients.clear();
    this.channelSubscriptions.clear();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    logger.info('All WebSocket connections closed');
  }

  private handleSubscription(clientId: string, channels: string[], filters?: Record<string, unknown>): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const validChannels = channels.filter(channel => this.isValidChannel(channel));

    validChannels.forEach(channel => {
      // Add client to channel
      client.subscriptions.add(channel);

      if (!this.channelSubscriptions.has(channel)) {
        this.channelSubscriptions.set(channel, new Set());
      }
      this.channelSubscriptions.get(channel)!.add(clientId);
    });

    this.sendMessage(clientId, {
      type: 'subscription_ack',
      payload: {
        subscribed: validChannels,
        filters
      },
      timestamp: new Date().toISOString()
    });

    logger.info('Client subscribed to channels', {
      clientId,
      channels: validChannels
    });
  }

  private handleUnsubscription(clientId: string, channels: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

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

    logger.info('Client unsubscribed from channels', {
      clientId,
      channels
    });
  }

  private handlePing(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.metadata.lastPing = new Date();

    const pongMessage: PongMessage = {
      type: 'pong',
      timestamp: new Date().toISOString()
    };

    this.sendMessage(clientId, pongMessage);
  }

  private broadcastToChannel(channel: string, message: WebSocketMessage): void {
    const channelClients = this.channelSubscriptions.get(channel);
    if (!channelClients || channelClients.size === 0) {
      return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    let failedCount = 0;

    channelClients.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
          sentCount++;
        } catch (error) {
          logger.error(`Failed to send message to client ${clientId}:`, error);
          failedCount++;
          this.handleDisconnection(clientId);
        }
      } else {
        // Clean up dead connections
        this.handleDisconnection(clientId);
        failedCount++;
      }
    });

    if (sentCount > 0) {
      logger.debug('Broadcast message sent', {
        channel,
        messageType: message.type,
        recipients: sentCount,
        failed: failedCount
      });
    }
  }

  private sendMessage(clientId: string, message: unknown): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Failed to send message to client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    }
  }

  private sendError(clientId: string, message: string): void {
    this.sendMessage(clientId, {
      type: 'error',
      payload: {
        message,
        timestamp: new Date().toISOString()
      }
    });
  }

  private isValidChannel(channel: string): boolean {
    const validChannels = [
      'tokens',
      'alerts',
      'filters',
      'market',
      'signals'
    ];

    // Check for valid channel patterns
    const channelPatterns = [
      /^token:[a-zA-Z0-9]+$/,    // token:ADDRESS
      /^filter:[a-zA-Z0-9_]+$/,  // filter:FILTER_ID
      /^user:[a-zA-Z0-9_]+$/     // user:USER_ID
    ];

    return validChannels.includes(channel) ||
           channelPatterns.some(pattern => pattern.test(channel));
  }

  private getAvailableChannels(): string[] {
    return [
      'tokens',       // All token updates
      'alerts',       // Alert notifications
      'filters',      // Filter execution results
      'market',       // General market updates
      'signals'       // Trading signals
    ];
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const deadClients: string[] = [];

      this.clients.forEach((client, clientId) => {
        const timeSinceLastPing = now.getTime() - (client.metadata.lastPing?.getTime() || 0);

        if (timeSinceLastPing > this.CONNECTION_TIMEOUT) {
          deadClients.push(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          // Send ping
          try {
            client.ws.ping();
          } catch (error) {
            logger.error(`Failed to ping client ${clientId}:`, error);
            deadClients.push(clientId);
          }
        }
      });

      // Clean up dead connections
      deadClients.forEach(clientId => {
        this.handleDisconnection(clientId);
      });

      if (deadClients.length > 0) {
        logger.info('Cleaned up dead WebSocket connections', {
          count: deadClients.length
        });
      }

    }, this.HEARTBEAT_INTERVAL);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientIP(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
      : req.socket.remoteAddress;
    return ip || 'unknown';
  }
}