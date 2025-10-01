import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { PrismaClient } from '@prisma/client';
interface WebSocketMessage {
    type: string;
    data?: Record<string, unknown>;
    timestamp?: string;
}
interface TokenUpdateData {
    address: string;
    symbol: string;
    price?: number;
    volume24h?: number;
    marketCap?: number;
}
interface TokenUpdateMessage extends WebSocketMessage {
    type: 'token_update';
    data: TokenUpdateData;
}
interface FilterResultData {
    filterId: string;
    results: Record<string, unknown>[];
    totalCount: number;
}
interface FilterResultMessage extends WebSocketMessage {
    type: 'filter_results';
    data: FilterResultData;
}
interface AlertCondition {
    metric: string;
    operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
    value: number;
    period?: string;
}
interface Alert {
    id: string;
    type: string;
    condition: AlertCondition;
    isActive: boolean;
    tokenId: string;
}
interface SubscriptionMessage {
    type: 'subscribe' | 'unsubscribe';
    channels: string[];
    filters?: Record<string, unknown>;
}
interface PingMessage {
    type: 'ping';
}
type IncomingMessage = SubscriptionMessage | PingMessage;
export declare class WebSocketManager {
    private wss;
    private prisma;
    private clients;
    private channelSubscriptions;
    private heartbeatInterval;
    private readonly HEARTBEAT_INTERVAL;
    private readonly CONNECTION_TIMEOUT;
    constructor(wss: WebSocketServer, prisma: PrismaClient);
    handleConnection(ws: WebSocket, req: IncomingMessage): string;
    handleMessage(clientId: string, message: IncomingMessage): void;
    handleDisconnection(clientId: string): void;
    broadcastTokenUpdate(tokenAddress: string, data: Partial<TokenUpdateMessage>): void;
    broadcastAlert(alert: Alert): void;
    broadcastFilterResults(filterId: string, data: Partial<FilterResultMessage>): void;
    broadcastMarketUpdate(): void;
    getConnectionCount(): number;
    getChannelSubscriptions(): Record<string, number>;
    closeAllConnections(): void;
    private handleSubscription;
    private handleUnsubscription;
    private handlePing;
    private broadcastToChannel;
    private sendMessage;
    private sendError;
    private isValidChannel;
    private getAvailableChannels;
    private startHeartbeat;
    private generateClientId;
    private getClientIP;
}
export {};
//# sourceMappingURL=websocket-manager.d.ts.map