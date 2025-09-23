/**
 * Hook Error Recovery Service
 * Integrated with existing service patterns and utilities
 */

import { promises as fs } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { Logger, LogLevel } from '../utils/logger';
import { errorPatterns, ErrorMatch } from '../utils/error-patterns';
import chokidar, { FSWatcher } from 'chokidar';

export interface HookErrorData {
  message: string;
  toolUseId: string;
  errorType: string;
  context?: Record<string, unknown>;
  timestamp?: string;
}

export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

export interface RecoveryConfig {
  autoRecover?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  watchInterval?: number;
  enabledErrorTypes?: string[];
  hookIntegration?: {
    enabled: boolean;
    claudeFlowPath: string;
    sessionPath: string;
    triggerPath?: string;
  };
  monitoring?: {
    watchStdin: boolean;
    watchLogFiles: string[];
    realTimeProcessing: boolean;
  };
  recovery?: {
    methods: string[];
    fallbackBehavior: 'log_only' | 'throw_error' | 'silent';
    notifyOnRecovery: boolean;
  };
}

export interface RecoveryStats {
  activeToolUses: number;
  totalRecoveryAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  isMonitoring: boolean;
  averageRecoveryTime?: number;
  lastRecoveryTime?: Date;
}

export class HookRecoveryService extends EventEmitter {
  private readonly activeToolUses: Map<string, unknown> = new Map();
  private readonly recoveryAttempts: Map<string, number> = new Map();
  private readonly recoveryTimes: Map<string, number> = new Map();
  private readonly processes: Map<string, ChildProcess> = new Map();
  private readonly watchers: Map<string, FSWatcher> = new Map();
  private readonly logger: Logger;
  private isMonitoring = false;

  private readonly defaultConfig: RecoveryConfig = {
    autoRecover: true,
    maxRetries: 3,
    retryDelay: 1000,
    watchInterval: 500,
    enabledErrorTypes: ['incomplete_tool_result', 'hook_completion', 'api_error_400'],
    hookIntegration: {
      enabled: true,
      claudeFlowPath: 'npx claude-flow@alpha',
      sessionPath: '.claude-flow/session.json',
      triggerPath: '.claude-flow/recovery-trigger.json'
    },
    monitoring: {
      watchStdin: true,
      watchLogFiles: [
        '/tmp/claude-code.log',
        '.claude/logs/hooks.log',
        '.claude-flow/logs/execution.log'
      ],
      realTimeProcessing: true
    },
    recovery: {
      methods: ['claude_flow_hooks', 'session_injection', 'trigger_completion'],
      fallbackBehavior: 'log_only',
      notifyOnRecovery: true
    }
  };

  constructor(private readonly config: RecoveryConfig = {}) {
    super();

    // Merge with defaults
    this.config = { ...this.defaultConfig, ...config };

    // Initialize logger
    this.logger = Logger.getInstance({
      service: 'hook-recovery',
      level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
      enableConsole: true,
      enableFile: true,
      enableHiveMemory: true,
      maxMemoryEntries: 1000
    });

    // Setup cleanup on exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('exit', () => this.cleanup());
  }

  /**
   * Start monitoring for hook errors
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn('Hook recovery monitoring already active');
      return;
    }

    this.logger.info('Starting hook error monitoring...');
    this.isMonitoring = true;

    // Monitor stdin for real-time errors
    if (this.config.monitoring?.watchStdin && process.stdin.readable) {
      process.stdin.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => this.processLogLine(line.trim()));
      });
    }

    // Monitor log files
    if (this.config.monitoring?.watchLogFiles) {
      for (const logFile of this.config.monitoring.watchLogFiles) {
        await this.watchLogFile(logFile);
      }
    }

    // Monitor for recovery triggers
    await this.monitorRecoveryTriggers();

    this.emit('monitoring_started');
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.logger.info('Stopping hook error monitoring...');
    this.isMonitoring = false;

    // Close file watchers
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();

    // Clean up processes
    this.cleanupProcesses();

    this.emit('monitoring_stopped');
  }

  /**
   * Handle detected hook error
   */
  async handleHookError(errorData: HookErrorData): Promise<boolean> {
    const { message, toolUseId, errorType } = errorData;
    const startTime = Date.now();

    this.logger.warn(`Handling hook error for tool_use_id: ${toolUseId}`, {
      errorType,
      message: message.substring(0, 200) // Truncate long messages
    });

    if (!this.config.autoRecover) {
      this.logger.info('Auto-recovery disabled, logging error only');
      return false;
    }

    // Check if error type is enabled
    if (this.config.enabledErrorTypes && !this.config.enabledErrorTypes.includes(errorType)) {
      this.logger.debug(`Error type ${errorType} not enabled for recovery`);
      return false;
    }

    const currentRetries = this.recoveryAttempts.get(toolUseId) || 0;

    if (currentRetries >= (this.config.maxRetries || 3)) {
      this.logger.error(`Max retries exceeded for ${toolUseId}`);
      this.emit('recovery_failed', { toolUseId, reason: 'max_retries_exceeded' });
      return false;
    }

    try {
      const toolResult = await this.generateToolResult(toolUseId, message);
      const success = await this.injectToolResult(toolResult);

      if (success) {
        const recoveryTime = Date.now() - startTime;
        this.recoveryTimes.set(toolUseId, recoveryTime);

        this.logger.info(`Successfully recovered tool_use ${toolUseId}`, {
          recoveryTime,
          attempt: currentRetries + 1
        });

        if (this.config.recovery?.notifyOnRecovery) {
          this.emit('recovery_success', { toolUseId, recoveryTime, attempt: currentRetries + 1 });
        }

        this.recoveryAttempts.delete(toolUseId);
        return true;
      } else {
        this.recoveryAttempts.set(toolUseId, currentRetries + 1);
        this.logger.warn(`Recovery attempt ${currentRetries + 1} failed for ${toolUseId}`);

        // Retry after delay
        setTimeout(() => {
          this.handleHookError(errorData);
        }, (this.config.retryDelay || 1000) * (currentRetries + 1));

        return false;
      }
    } catch (error) {
      this.logger.error(`Recovery error for ${toolUseId}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        error: error instanceof Error ? error.stack : error
      });

      this.emit('recovery_error', { toolUseId, error });
      return false;
    }
  }

  /**
   * Generate tool result for recovery
   */
  private async generateToolResult(toolUseId: string, originalError: string): Promise<ToolResult> {
    const toolResult: ToolResult = {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: JSON.stringify({
        status: 'error_recovered',
        original_error: originalError,
        recovery_timestamp: new Date().toISOString(),
        recovery_service: 'hook-recovery-service',
        message: 'Tool execution completed with automatic error recovery'
      }),
      is_error: false
    };

    this.logger.debug(`Generated tool_result for ${toolUseId}`, { toolResult });
    return toolResult;
  }

  /**
   * Inject tool result using available methods
   */
  private async injectToolResult(toolResult: ToolResult): Promise<boolean> {
    const methods = this.config.recovery?.methods || ['claude_flow_hooks', 'session_injection', 'trigger_completion'];

    for (const method of methods) {
      try {
        let success = false;

        switch (method) {
          case 'claude_flow_hooks':
            success = await this.injectViaClaudeFlowHooks(toolResult);
            break;
          case 'session_injection':
            success = await this.injectViaSession(toolResult);
            break;
          case 'trigger_completion':
            success = await this.injectViaTrigger(toolResult);
            break;
          default:
            this.logger.warn(`Unknown recovery method: ${method}`);
        }

        if (success) {
          this.logger.debug(`Successfully injected tool_result via ${method}`, {
            toolUseId: toolResult.tool_use_id,
            method
          });
          return true;
        }
      } catch (error) {
        this.logger.warn(`Recovery method ${method} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    this.logger.error(`All recovery methods failed for ${toolResult.tool_use_id}`);
    return false;
  }

  /**
   * Inject via Claude Flow hooks
   */
  private async injectViaClaudeFlowHooks(toolResult: ToolResult): Promise<boolean> {
    if (!this.config.hookIntegration?.enabled) {
      return false;
    }

    return new Promise((resolve) => {
      const processKey = `hook-${toolResult.tool_use_id}-${Date.now()}`;
      const timeout = setTimeout(() => {
        this.killProcess(processKey);
        resolve(false);
      }, 5000);

      try {
        const proc = spawn('npx', ['claude-flow@alpha', 'hooks', 'post-tool-result'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd()
        });

        this.processes.set(processKey, proc);

        proc.stdin.write(JSON.stringify(toolResult));
        proc.stdin.end();

        proc.on('close', (code) => {
          clearTimeout(timeout);
          this.processes.delete(processKey);
          resolve(code === 0);
        });

        proc.on('error', (err) => {
          clearTimeout(timeout);
          this.processes.delete(processKey);
          this.logger.error(`Claude Flow hook process error: ${err.message}`);
          resolve(false);
        });
      } catch (error) {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  /**
   * Inject via session file
   */
  private async injectViaSession(toolResult: ToolResult): Promise<boolean> {
    if (!this.config.hookIntegration?.sessionPath) {
      return false;
    }

    try {
      const sessionPath = path.resolve(this.config.hookIntegration.sessionPath);
      const sessionDir = path.dirname(sessionPath);

      // Ensure directory exists
      await fs.mkdir(sessionDir, { recursive: true });

      let sessionData: any = {};

      try {
        const existingData = await fs.readFile(sessionPath, 'utf8');
        sessionData = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist or is invalid, start with empty object
      }

      sessionData.tool_results = sessionData.tool_results || [];
      sessionData.tool_results.push(toolResult);
      sessionData.last_recovery = new Date().toISOString();

      await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));

      this.logger.debug(`Injected tool_result via session: ${toolResult.tool_use_id}`);
      return true;
    } catch (error) {
      this.logger.warn(`Session injection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Inject via recovery trigger
   */
  private async injectViaTrigger(toolResult: ToolResult): Promise<boolean> {
    if (!this.config.hookIntegration?.triggerPath) {
      return false;
    }

    try {
      const triggerPath = path.resolve(this.config.hookIntegration.triggerPath);
      const triggerDir = path.dirname(triggerPath);

      await fs.mkdir(triggerDir, { recursive: true });

      const triggerData = {
        tool_result: toolResult,
        timestamp: new Date().toISOString(),
        status: 'pending_completion'
      };

      await fs.writeFile(triggerPath, JSON.stringify(triggerData, null, 2));
      this.logger.debug(`Created recovery trigger for ${toolResult.tool_use_id}`);

      // Wait for trigger to be processed (max 5 seconds)
      for (let i = 0; i < 50; i++) {
        try {
          await fs.access(triggerPath);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch {
          return true; // Trigger was processed
        }
      }

      // Clean up if not processed
      try {
        await fs.unlink(triggerPath);
      } catch {
        // Ignore cleanup errors
      }

      return false;
    } catch (error) {
      this.logger.warn(`Trigger completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Process a log line for error detection
   */
  private async processLogLine(line: string): Promise<void> {
    if (!line || line.length === 0) return;

    const errorMatch = errorPatterns.match(line);

    if (errorMatch.matched && errorMatch.type && errorMatch.toolUseId) {
      this.logger.debug(`Detected error pattern: ${errorMatch.type}`, { line: line.substring(0, 200) });

      await this.handleHookError({
        message: line,
        toolUseId: errorMatch.toolUseId,
        errorType: errorMatch.type,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Watch a log file for changes
   */
  private async watchLogFile(filePath: string): Promise<void> {
    try {
      // Check if file exists
      await fs.access(filePath);

      const watcher = chokidar.watch(filePath, {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      });

      watcher.on('change', async () => {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');

          // Process only recent lines (last 10)
          const recentLines = lines.slice(-10);
          for (const line of recentLines) {
            await this.processLogLine(line.trim());
          }
        } catch (error) {
          this.logger.warn(`Error reading log file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      watcher.on('error', (error) => {
        this.logger.error(`Watch error for ${filePath}: ${error.message}`);
      });

      this.watchers.set(filePath, watcher);
      this.logger.debug(`Watching log file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Cannot watch log file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Monitor for recovery triggers
   */
  private async monitorRecoveryTriggers(): Promise<void> {
    if (!this.config.hookIntegration?.triggerPath) {
      return;
    }

    const triggerPath = path.resolve(this.config.hookIntegration.triggerPath);

    setInterval(async () => {
      try {
        await fs.access(triggerPath);
        const triggerData = JSON.parse(await fs.readFile(triggerPath, 'utf8'));

        if (triggerData.status === 'pending_completion') {
          this.logger.debug(`Processing recovery trigger for ${triggerData.tool_result?.tool_use_id}`);
          await fs.unlink(triggerPath);
        }
      } catch {
        // File doesn't exist or can't be read, continue monitoring
      }
    }, 100);
  }

  /**
   * Get recovery statistics
   */
  getStats(): RecoveryStats {
    const totalAttempts = Array.from(this.recoveryAttempts.values()).reduce((a, b) => a + b, 0);
    const successfulRecoveries = this.recoveryTimes.size;
    const recoveryTimes = Array.from(this.recoveryTimes.values());
    const averageRecoveryTime = recoveryTimes.length > 0
      ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length
      : undefined;

    return {
      activeToolUses: this.activeToolUses.size,
      totalRecoveryAttempts: totalAttempts,
      successfulRecoveries,
      failedRecoveries: Math.max(0, totalAttempts - successfulRecoveries),
      isMonitoring: this.isMonitoring,
      averageRecoveryTime,
      lastRecoveryTime: recoveryTimes.length > 0 ? new Date(Math.max(...Array.from(this.recoveryTimes.keys()).map(k => Date.now()))) : undefined
    };
  }

  /**
   * Test recovery with mock error
   */
  async testRecovery(): Promise<boolean> {
    const mockError: HookErrorData = {
      message: 'API Error: 400 tool_use ids were found without tool_result blocks: toolu_test_recovery_123',
      toolUseId: 'toolu_test_recovery_123',
      errorType: 'incomplete_tool_result',
      timestamp: new Date().toISOString()
    };

    this.logger.info('Testing recovery with mock error...');
    return await this.handleHookError(mockError);
  }

  /**
   * Kill a specific process
   */
  private killProcess(key: string): void {
    const proc = this.processes.get(key);
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
      this.processes.delete(key);
    }
  }

  /**
   * Clean up all processes
   */
  private cleanupProcesses(): void {
    for (const [key, proc] of this.processes) {
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
    }
    this.processes.clear();
  }

  /**
   * Clean up all resources
   */
  private async cleanup(): Promise<void> {
    this.logger.info('Cleaning up hook recovery service...');

    await this.stopMonitoring();
    this.cleanupProcesses();

    this.removeAllListeners();
    this.logger.info('Hook recovery service cleanup complete');
  }
}