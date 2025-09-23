import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebSocketManager } from '../websocket/websocket-manager';
export declare class TokensController {
    private prisma;
    private wsManager;
    constructor(prisma: PrismaClient, wsManager: WebSocketManager);
    listTokens(req: Request, res: Response): Promise<void>;
    getToken(req: Request, res: Response): Promise<void>;
    createOrUpdateToken(req: Request, res: Response): Promise<void>;
    private buildOrderBy;
    private calculatePerformanceMetrics;
    private calculateROI;
    private calculateVolatility;
}
//# sourceMappingURL=tokens.controller.d.ts.map