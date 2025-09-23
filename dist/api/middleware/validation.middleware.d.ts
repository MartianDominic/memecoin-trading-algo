import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
type ValidationTarget = 'body' | 'query' | 'params' | 'headers';
interface ValidationOptions {
    strict?: boolean;
    stripUnknown?: boolean;
    errorMessage?: string;
}
export declare const validate: (schema: ZodSchema, target?: ValidationTarget, options?: ValidationOptions) => (req: Request, res: Response, next: NextFunction) => void;
export declare const commonSchemas: {
    pagination: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
    }, {
        page?: string | undefined;
        limit?: string | undefined;
    }>;
    dateRange: z.ZodEffects<z.ZodObject<{
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        startDate?: string | undefined;
        endDate?: string | undefined;
    }, {
        startDate?: string | undefined;
        endDate?: string | undefined;
    }>, {
        startDate?: string | undefined;
        endDate?: string | undefined;
    }, {
        startDate?: string | undefined;
        endDate?: string | undefined;
    }>;
    tokenAddress: z.ZodObject<{
        address: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        address: string;
    }, {
        address: string;
    }>;
    apiKey: z.ZodObject<{
        'x-api-key': z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        'x-api-key'?: string | undefined;
    }, {
        'x-api-key'?: string | undefined;
    }>;
    sortOptions: z.ZodObject<{
        sortBy: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        sortOrder: "asc" | "desc";
        sortBy?: string | undefined;
    }, {
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
};
export declare const validatePagination: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateDateRange: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateTokenAddress: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateSortOptions: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateQuery: (schema: ZodSchema, options?: ValidationOptions) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateBody: (schema: ZodSchema, options?: ValidationOptions) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateParams: (schema: ZodSchema, options?: ValidationOptions) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateHeaders: (schema: ZodSchema, options?: ValidationOptions) => (req: Request, res: Response, next: NextFunction) => void;
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireJsonContent: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateFileSize: (maxSizeBytes: number) => (req: Request, res: Response, next: NextFunction) => void;
export declare const addRequestId: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateWebhookSignature: (secret: string) => (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=validation.middleware.d.ts.map