/**
 * Advanced Logging Utility
 * Hive Mind Integration - Comprehensive Logging System
 */

export enum LogLevel {
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

export class Logger {
  private static instance: Logger;
  private readonly memoryLog: LogEntry[] = [];
  private correlationId: string | null = null;

  private constructor(
    private readonly config: LoggerConfig = {
      level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
      enableConsole: true,
      enableFile: false,
      enableHiveMemory: true,
      maxMemoryEntries: 1000,
      service: 'memecoin-api'
    }
  ) {}

  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  clearCorrelationId(): void {
    this.correlationId = null;
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (level > this.config.level) {
      return;
    }

    const entry: LogEntry = {
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

  private logToConsole(entry: LogEntry): void {
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

  private logToMemory(entry: LogEntry): void {
    this.memoryLog.push(entry);

    // Maintain max memory entries
    if (this.memoryLog.length > this.config.maxMemoryEntries) {
      this.memoryLog.shift();
    }
  }

  private logToFile(entry: LogEntry): void {
    // File logging implementation would go here
    // For now, this is a placeholder
  }

  /**
   * Get recent log entries from memory
   */
  getRecentLogs(count: number = 100, level?: LogLevel): LogEntry[] {
    let logs = [...this.memoryLog];

    if (level !== undefined) {
      logs = logs.filter(entry => entry.level <= level);
    }

    return logs.slice(-count);
  }

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
  } {
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
  clearLogs(): void {
    this.memoryLog.length = 0;
  }

  /**
   * Update logger configuration
   */
  updateConfig(updates: Partial<LoggerConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: { service?: string; correlationId?: string }): Logger {
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
  logPerformance(operation: string, startTime: number, meta?: Record<string, unknown>): void {
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
  logApiRequest(method: string, url: string, status?: number, duration?: number): void {
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
  logEvent(eventType: string, data: Record<string, unknown>): void {
    this.info(`Event: ${eventType}`, {
      eventType,
      ...data
    });
  }
}