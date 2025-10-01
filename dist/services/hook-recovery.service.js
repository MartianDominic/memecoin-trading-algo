"use strict";
/**
 * Hook Error Recovery Service
 * Integrated with existing service patterns and utilities
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookRecoveryService = void 0;
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const events_1 = require("events");
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const error_patterns_1 = require("../utils/error-patterns");
const chokidar_1 = __importDefault(require("chokidar"));
class HookRecoveryService extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.activeToolUses = new Map();
        this.recoveryAttempts = new Map();
        this.recoveryTimes = new Map();
        this.processes = new Map();
        this.watchers = new Map();
        this.isMonitoring = false;
        this.defaultConfig = {
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
        // Merge with defaults
        this.config = { ...this.defaultConfig, ...config };
        // Initialize logger
        this.logger = logger_1.Logger.getInstance({
            service: 'hook-recovery',
            level: process.env.NODE_ENV === 'production' ? logger_1.LogLevel.INFO : logger_1.LogLevel.DEBUG,
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
    async startMonitoring() {
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
    async stopMonitoring() {
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
    async handleHookError(errorData) {
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
            }
            else {
                this.recoveryAttempts.set(toolUseId, currentRetries + 1);
                this.logger.warn(`Recovery attempt ${currentRetries + 1} failed for ${toolUseId}`);
                // Retry after delay
                setTimeout(() => {
                    this.handleHookError(errorData);
                }, (this.config.retryDelay || 1000) * (currentRetries + 1));
                return false;
            }
        }
        catch (error) {
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
    async generateToolResult(toolUseId, originalError) {
        const toolResult = {
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
    async injectToolResult(toolResult) {
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
            }
            catch (error) {
                this.logger.warn(`Recovery method ${method} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        this.logger.error(`All recovery methods failed for ${toolResult.tool_use_id}`);
        return false;
    }
    /**
     * Inject via Claude Flow hooks
     */
    async injectViaClaudeFlowHooks(toolResult) {
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
                const proc = (0, child_process_1.spawn)('npx', ['claude-flow@alpha', 'hooks', 'post-tool-result'], {
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
            }
            catch (error) {
                clearTimeout(timeout);
                resolve(false);
            }
        });
    }
    /**
     * Inject via session file
     */
    async injectViaSession(toolResult) {
        if (!this.config.hookIntegration?.sessionPath) {
            return false;
        }
        try {
            const sessionPath = path_1.default.resolve(this.config.hookIntegration.sessionPath);
            const sessionDir = path_1.default.dirname(sessionPath);
            // Ensure directory exists
            await fs_1.promises.mkdir(sessionDir, { recursive: true });
            let sessionData = {};
            try {
                const existingData = await fs_1.promises.readFile(sessionPath, 'utf8');
                sessionData = JSON.parse(existingData);
            }
            catch (error) {
                // File doesn't exist or is invalid, start with empty object
            }
            sessionData.tool_results = sessionData.tool_results || [];
            sessionData.tool_results.push(toolResult);
            sessionData.last_recovery = new Date().toISOString();
            await fs_1.promises.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
            this.logger.debug(`Injected tool_result via session: ${toolResult.tool_use_id}`);
            return true;
        }
        catch (error) {
            this.logger.warn(`Session injection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }
    /**
     * Inject via recovery trigger
     */
    async injectViaTrigger(toolResult) {
        if (!this.config.hookIntegration?.triggerPath) {
            return false;
        }
        try {
            const triggerPath = path_1.default.resolve(this.config.hookIntegration.triggerPath);
            const triggerDir = path_1.default.dirname(triggerPath);
            await fs_1.promises.mkdir(triggerDir, { recursive: true });
            const triggerData = {
                tool_result: toolResult,
                timestamp: new Date().toISOString(),
                status: 'pending_completion'
            };
            await fs_1.promises.writeFile(triggerPath, JSON.stringify(triggerData, null, 2));
            this.logger.debug(`Created recovery trigger for ${toolResult.tool_use_id}`);
            // Wait for trigger to be processed (max 5 seconds)
            for (let i = 0; i < 50; i++) {
                try {
                    await fs_1.promises.access(triggerPath);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                catch {
                    return true; // Trigger was processed
                }
            }
            // Clean up if not processed
            try {
                await fs_1.promises.unlink(triggerPath);
            }
            catch {
                // Ignore cleanup errors
            }
            return false;
        }
        catch (error) {
            this.logger.warn(`Trigger completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }
    /**
     * Process a log line for error detection
     */
    async processLogLine(line) {
        if (!line || line.length === 0)
            return;
        const errorMatch = error_patterns_1.errorPatterns.match(line);
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
    async watchLogFile(filePath) {
        try {
            // Check if file exists
            await fs_1.promises.access(filePath);
            const watcher = chokidar_1.default.watch(filePath, {
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
                    const content = await fs_1.promises.readFile(filePath, 'utf8');
                    const lines = content.split('\n');
                    // Process only recent lines (last 10)
                    const recentLines = lines.slice(-10);
                    for (const line of recentLines) {
                        await this.processLogLine(line.trim());
                    }
                }
                catch (error) {
                    this.logger.warn(`Error reading log file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });
            watcher.on('error', (error) => {
                this.logger.error(`Watch error for ${filePath}: ${error.message}`);
            });
            this.watchers.set(filePath, watcher);
            this.logger.debug(`Watching log file: ${filePath}`);
        }
        catch (error) {
            this.logger.warn(`Cannot watch log file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Monitor for recovery triggers
     */
    async monitorRecoveryTriggers() {
        if (!this.config.hookIntegration?.triggerPath) {
            return;
        }
        const triggerPath = path_1.default.resolve(this.config.hookIntegration.triggerPath);
        setInterval(async () => {
            try {
                await fs_1.promises.access(triggerPath);
                const triggerData = JSON.parse(await fs_1.promises.readFile(triggerPath, 'utf8'));
                if (triggerData.status === 'pending_completion') {
                    this.logger.debug(`Processing recovery trigger for ${triggerData.tool_result?.tool_use_id}`);
                    await fs_1.promises.unlink(triggerPath);
                }
            }
            catch {
                // File doesn't exist or can't be read, continue monitoring
            }
        }, 100);
    }
    /**
     * Get recovery statistics
     */
    getStats() {
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
    async testRecovery() {
        const mockError = {
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
    killProcess(key) {
        const proc = this.processes.get(key);
        if (proc && !proc.killed) {
            proc.kill('SIGTERM');
            this.processes.delete(key);
        }
    }
    /**
     * Clean up all processes
     */
    cleanupProcesses() {
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
    async cleanup() {
        this.logger.info('Cleaning up hook recovery service...');
        await this.stopMonitoring();
        this.cleanupProcesses();
        this.removeAllListeners();
        this.logger.info('Hook recovery service cleanup complete');
    }
}
exports.HookRecoveryService = HookRecoveryService;
//# sourceMappingURL=hook-recovery.service.js.map