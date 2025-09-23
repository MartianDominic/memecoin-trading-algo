import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebSocketManager } from '../websocket/websocket-manager';
export declare class FiltersController {
    private prisma;
    private wsManager;
    private filterStorage;
    constructor(prisma: PrismaClient, wsManager: WebSocketManager);
    listFilters(req: Request, res: Response): Promise<void>;
    getFilter(req: Request, res: Response): Promise<void>;
    createFilter(req: Request, res: Response): Promise<void>;
    updateFilter(req: Request, res: Response): Promise<void>;
    deleteFilter(req: Request, res: Response): Promise<void>;
    executeFilter(req: Request, res: Response): Promise<void>;
    private applyFilter;
    private generateId;
}
//# sourceMappingURL=filters.controller.d.ts.map