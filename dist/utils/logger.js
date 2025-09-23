"use strict";
/**
 * Advanced Logging Utility
 * Hive Mind Integration - Comprehensive Logging System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor(config = {
        level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
        enableConsole: true,
        enableFile: false,
        enableHiveMemory: true,
        maxMemoryEntries: 1000,
        service: 'memecoin-api'
    }) {
        this.config = config;
        this.memoryLog = [];
        this.correlationId = null;
    }
    static getInstance(config) {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }
    setCorrelationId(id) {
        this.correlationId = id;
    }
    clearCorrelationId() {
        this.correlationId = null;
    }
    error(message, meta) {
        this.log(LogLevel.ERROR, message, meta);
    }
    warn(message, meta) {
        this.log(LogLevel.WARN, message, meta);
    }
    info(message, meta) {
        this.log(LogLevel.INFO, message, meta);
    }
    debug(message, meta) {
        this.log(LogLevel.DEBUG, message, meta);
    }
    log(level, message, meta) {
        if (level > this.config.level) {
            return;
        }
        const entry = {
            timestamp: new Date(),
            level,
            message,
            meta,
            service: this.config.service,
            correlationId: this.correlationId || undefined
        };
        // Console output
        if (this.config.enableConsole) {
            this.logToConsole(entry);
        }
        // Memory storage for hive integration
        if (this.config.enableHiveMemory) {
            this.logToMemory(entry);
        }
        // File logging would go here
        if (this.config.enableFile) {
            this.logToFile(entry);
        }
    }
    logToConsole(entry) {
        const timestamp = entry.timestamp.toISOString();
        const levelName = LogLevel[entry.level];
        const service = entry.service ? `[${entry.service}]` : '';
        const correlation = entry.correlationId ? `[${entry.correlationId}]` : '';
        const prefix = `${timestamp} ${levelName} ${service}${correlation}`;
        const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
        switch (entry.level) {
            case LogLevel.ERROR:
                console.error(`${prefix} ${entry.message}${metaStr}`);
                break;
            case LogLevel.WARN:
                console.warn(`${prefix} ${entry.message}${metaStr}`);
                break;
            case LogLevel.INFO:
                console.info(`${prefix} ${entry.message}${metaStr}`);
                break;
            case LogLevel.DEBUG:
                console.debug(`${prefix} ${entry.message}${metaStr}`);
                break;
        }
    }
    logToMemory(entry) {
        this.memoryLog.push(entry);
        // Maintain max memory entries
        if (this.memoryLog.length > this.config.maxMemoryEntries) {
            this.memoryLog.shift();
        }
    }
    logToFile(entry) {
        // File logging implementation would go here
        // For now, this is a placeholder
    }
    /**
     * Get recent log entries from memory
     */
    getRecentLogs(count = 100, level) {
        let logs = [...this.memoryLog];
        if (level !== undefined) {
            logs = logs.filter(entry => entry.level <= level);
        }
        return logs.slice(-count);
    }
    /**
     * Get log statistics
     */
    getStats() {
        const errorCount = this.memoryLog.filter(e => e.level === LogLevel.ERROR).length;
        const warnCount = this.memoryLog.filter(e => e.level === LogLevel.WARN).length;
        const infoCount = this.memoryLog.filter(e => e.level === LogLevel.INFO).length;
        const debugCount = this.memoryLog.filter(e => e.level === LogLevel.DEBUG).length;
        const timestamps = this.memoryLog.map(e => e.timestamp);
        const oldestEntry = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined;
        const newestEntry = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined;
        return {
            totalEntries: this.memoryLog.length,
            errorCount,
            warnCount,
            infoCount,
            debugCount,
            oldestEntry,
            newestEntry
        };
    }
    /**
     * Clear memory logs
     */
    clearLogs() {
        this.memoryLog.length = 0;
    }
    /**
     * Update logger configuration
     */
    updateConfig(updates) {
        Object.assign(this.config, updates);
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Create a child logger with additional context
     */
    child(context) {
        const childLogger = new Logger({
            ...this.config,
            service: context.service || this.config.service
        });
        if (context.correlationId) {
            childLogger.setCorrelationId(context.correlationId);
        }
        return childLogger;
    }
    /**
     * Log performance metrics
     */
    logPerformance(operation, startTime, meta) {
        const duration = Date.now() - startTime;
        this.debug(`Performance: ${operation} completed`, {
            operation,
            duration,
            ...meta
        });
    }
    /**
     * Log API requests
     */
    logApiRequest(method, url, status, duration) {
        const level = status && status >= 400 ? LogLevel.WARN : LogLevel.INFO;
        this.log(level, `API ${method} ${url}`, {
            method,
            url,
            status,
            duration
        });
    }
    /**
     * Log with structured format for specific event types
     */
    logEvent(eventType, data) {
        this.info(`Event: ${eventType}`, {
            eventType,
            ...data
        });
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map