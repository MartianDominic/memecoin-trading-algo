import { Request, Response, NextFunction } from 'express';
interface LoggedRequest extends Request {
    startTime?: number;
    requestId?: string;
}
export declare const requestLogger: (req: LoggedRequest, res: Response, next: NextFunction) => void;
export declare const securityLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const rateLimitLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const analyticsLogger: (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=request-logger.middleware.d.ts.map