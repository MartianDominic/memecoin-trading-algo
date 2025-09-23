/**
 * Advanced Logging Utility
 * Hive Mind Integration - Comprehensive Logging System
 */
export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    meta?: Record<string, unknown>;
    service?: string;
    correlationId?: string;
}
export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    enableHiveMemory: boolean;
    maxMemoryEntries: number;
    service?: string;
}
export declare class Logger {
    private readonly config;
    private static instance;
    private readonly memoryLog;
    private correlationId;
    private constructor();
    static getInstance(config?: LoggerConfig): Logger;
    setCorrelationId(id: string): void;
    clearCorrelationId(): void;
    error(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
    private log;
    private logToConsole;
    private logToMemory;
    private logToFile;
    /**
     * Get recent log entries from memory
     */
    getRecentLogs(count?: number, level?: LogLevel): LogEntry[];
    /**
     * Get log statistics
     */
    getStats(): {
        totalEntries: number;
        errorCount: number;
        warnCount: number;
        infoCount: number;
        debugCount: number;
        oldestEntry?: Date;
        newestEntry?: Date;
    };
    /**
     * Clear memory logs
     */
    clearLogs(): void;
    /**
     * Update logger configuration
     */
    updateConfig(updates: Partial<LoggerConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): LoggerConfig;
    /**
     * Create a child logger with additional context
     */
    child(context: {
        service?: string;
        correlationId?: string;
    }): Logger;
    /**
     * Log performance metrics
     */
    logPerformance(operation: string, startTime: number, meta?: Record<string, unknown>): void;
    /**
     * Log API requests
     */
    logApiRequest(method: string, url: string, status?: number, duration?: number): void;
    /**
     * Log with structured format for specific event types
     */
    logEvent(eventType: string, data: Record<string, unknown>): void;
}
//# sourceMappingURL=logger.d.ts.map