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
    get server(): any;
    get websocketManager(): WebSocketManager;
    get database(): any;
}
export default ApiServer;
//# sourceMappingURL=api-server.d.ts.map