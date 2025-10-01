import { Server } from 'http';
import { IncomingMessage } from 'http';
import { PrismaClient } from '@prisma/client';
import { WebSocketManager } from './websocket/websocket-manager';
export declare class ApiServer {
    private app;
    private httpServer;
    private wss;
    private prisma;
    private wsManager;
    private tokensController;
    private filtersController;
    private alertsController;
    private analyticsController;
    constructor();
    private initializeMiddleware;
    private initializeRoutes;
    private initializeWebSocket;
    private initializeErrorHandling;
    start(): Promise<void>;
    private gracefulShutdown;
    get server(): Server<typeof IncomingMessage, typeof import("http").ServerResponse>;
    get websocketManager(): WebSocketManager;
    get database(): PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
export default ApiServer;
//# sourceMappingURL=api-server.d.ts.map