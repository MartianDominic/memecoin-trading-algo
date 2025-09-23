import { Request, Response, NextFunction } from 'express';
interface ErrorWithStatus extends Error {
    status?: number;
    statusCode?: number;
    code?: string;
    details?: unknown;
}
export declare class ApiValidationError extends Error {
    details?: unknown | undefined;
    statusCode: number;
    code: "VALIDATION_ERROR";
    constructor(message: string, details?: unknown | undefined);
}
export declare class ApiNotFoundError extends Error {
    statusCode: number;
    code: "NOT_FOUND";
    constructor(message?: string);
}
export declare class ApiUnauthorizedError extends Error {
    statusCode: number;
    code: "UNAUTHORIZED";
    constructor(message?: string);
}
export declare class ApiForbiddenError extends Error {
    statusCode: number;
    code: "FORBIDDEN";
    constructor(message?: string);
}
export declare class ApiRateLimitError extends Error {
    statusCode: number;
    code: "RATE_LIMIT_EXCEEDED";
    constructor(message?: string);
}
export declare class ApiInternalError extends Error {
    details?: unknown | undefined;
    statusCode: number;
    code: "INTERNAL_ERROR";
    constructor(message?: string, details?: unknown | undefined);
}
export declare class ApiServiceUnavailableError extends Error {
    statusCode: number;
    code: "SERVICE_UNAVAILABLE";
    constructor(message?: string);
}
export declare const errorHandler: (error: ErrorWithStatus, req: Request, res: Response, next: NextFunction) => void;
export declare const asyncHandler: <T extends Request, U extends Response>(fn: (req: T, res: U, next: NextFunction) => Promise<void>) => (req: T, res: U, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response) => void;
export declare const createValidationError: (message: string, details?: unknown) => ApiValidationError;
export declare const createNotFoundError: (resource?: string) => ApiNotFoundError;
export declare const createUnauthorizedError: (message?: string) => ApiUnauthorizedError;
export declare const createForbiddenError: (message?: string) => ApiForbiddenError;
export declare const createRateLimitError: (message?: string) => ApiRateLimitError;
export declare const createInternalError: (message?: string, details?: unknown) => ApiInternalError;
export declare const createServiceUnavailableError: (message?: string) => ApiServiceUnavailableError;
export declare const reportError: (error: Error, context?: Record<string, unknown>) => void;
export declare const getErrorStats: () => {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: number;
};
export {};
//# sourceMappingURL=error.middleware.d.ts.map