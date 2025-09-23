import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
export declare class AnalyticsController {
    private prisma;
    constructor(prisma: PrismaClient);
    getDashboardSummary(req: Request, res: Response): Promise<void>;
    getMarketMetrics(req: Request, res: Response): Promise<void>;
    getPerformanceMetrics(req: Request, res: Response): Promise<void>;
    getTrends(req: Request, res: Response): Promise<void>;
    private getTotalTokens;
    private getTotalVolume24h;
    private getTotalMarketCap;
    private getTotalMarketCapAtDate;
    private getTotalVolumeAtDate;
    private getTopPerformers;
    private getTopLosers;
    private getRiskDistribution;
    private getRecentActivity;
    private getMarketTrends;
    private getActiveAlertsCount;
    private getActiveTokensCount;
    private getNewTokensCount;
    private getAverageSafetyScore;
    private calculateDominanceIndex;
    private getPerformanceData;
    private getTrendingData;
    private getTimeRange;
    private getIntervalMs;
    private tokenToResponse;
}
//# sourceMappingURL=analytics.controller.d.ts.map