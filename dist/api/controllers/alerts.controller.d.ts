import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebSocketManager } from '../websocket/websocket-manager';
export declare class AlertsController {
    private prisma;
    private wsManager;
    private alertStorage;
    constructor(prisma: PrismaClient, wsManager: WebSocketManager);
    getAlerts(req: Request, res: Response): Promise<void>;
    getAlert(req: Request, res: Response): Promise<void>;
    createAlert(req: Request, res: Response): Promise<void>;
    acknowledgeAlert(req: Request, res: Response): Promise<void>;
    dismissAlert(req: Request, res: Response): Promise<void>;
    getAlertSummary(req: Request, res: Response): Promise<void>;
    triggerAlert(tokenAddress: string, metric: string, value: number): Promise<void>;
    private evaluateCondition;
    private getAlertTypeFromMetric;
    private generateAlertTitle;
    private generateAlertMessage;
    private generateId;
    private initializeSampleAlerts;
}
//# sourceMappingURL=alerts.controller.d.ts.map