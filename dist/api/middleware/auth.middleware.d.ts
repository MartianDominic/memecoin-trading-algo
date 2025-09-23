import { Request, Response, NextFunction } from 'express';
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        apiKey: string;
        tier: 'free' | 'premium' | 'enterprise';
        rateLimits: {
            requestsPerMinute: number;
            requestsPerHour: number;
        };
    };
}
export interface ApiKeyData {
    id: string;
    name: string;
    tier: 'free' | 'premium' | 'enterprise';
    rateLimits: {
        requestsPerMinute: number;
        requestsPerHour: number;
    };
    isActive: boolean;
}
export declare const authMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireTier: (minTier: "free" | "premium" | "enterprise") => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare function addApiKey(apiKey: string, data: ApiKeyData): void;
export declare function revokeApiKey(apiKey: string): boolean;
export declare function getApiKeyStats(): {
    total: number;
    active: number;
    byTier: Record<string, number>;
};
export {};
//# sourceMappingURL=auth.middleware.d.ts.map