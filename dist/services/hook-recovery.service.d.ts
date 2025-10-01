/**
 * Hook Error Recovery Service
 * Integrated with existing service patterns and utilities
 */
import { EventEmitter } from 'events';
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
export declare class HookRecoveryService extends EventEmitter {
    private readonly config;
    private readonly activeToolUses;
    private readonly recoveryAttempts;
    private readonly recoveryTimes;
    private readonly processes;
    private readonly watchers;
    private readonly logger;
    private isMonitoring;
    private readonly defaultConfig;
    constructor(config?: RecoveryConfig);
    /**
     * Start monitoring for hook errors
     */
    startMonitoring(): Promise<void>;
    /**
     * Stop monitoring
     */
    stopMonitoring(): Promise<void>;
    /**
     * Handle detected hook error
     */
    handleHookError(errorData: HookErrorData): Promise<boolean>;
    /**
     * Generate tool result for recovery
     */
    private generateToolResult;
    /**
     * Inject tool result using available methods
     */
    private injectToolResult;
    /**
     * Inject via Claude Flow hooks
     */
    private injectViaClaudeFlowHooks;
    /**
     * Inject via session file
     */
    private injectViaSession;
    /**
     * Inject via recovery trigger
     */
    private injectViaTrigger;
    /**
     * Process a log line for error detection
     */
    private processLogLine;
    /**
     * Watch a log file for changes
     */
    private watchLogFile;
    /**
     * Monitor for recovery triggers
     */
    private monitorRecoveryTriggers;
    /**
     * Get recovery statistics
     */
    getStats(): RecoveryStats;
    /**
     * Test recovery with mock error
     */
    testRecovery(): Promise<boolean>;
    /**
     * Kill a specific process
     */
    private killProcess;
    /**
     * Clean up all processes
     */
    private cleanupProcesses;
    /**
     * Clean up all resources
     */
    private cleanup;
}
//# sourceMappingURL=hook-recovery.service.d.ts.map