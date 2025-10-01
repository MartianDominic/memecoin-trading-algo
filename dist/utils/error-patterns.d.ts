/**
 * Error Pattern Detection Utility
 * Centralized error pattern matching for various system components
 */
export interface ErrorMatch {
    matched: boolean;
    type?: string;
    toolUseId?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, unknown>;
}
export interface ErrorPattern {
    name: string;
    patterns: RegExp[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    extractors?: {
        toolUseId?: RegExp;
        errorCode?: RegExp;
        timestamp?: RegExp;
    };
}
export declare class ErrorPatternRegistry {
    private readonly patterns;
    /**
     * Match a log line against all registered error patterns
     */
    match(line: string): ErrorMatch;
    /**
     * Match against specific pattern types
     */
    matchType(line: string, patternType: string): ErrorMatch;
    /**
     * Extract tool_use ID from any text
     */
    extractToolUseId(text: string): string | null;
    /**
     * Register a new error pattern
     */
    registerPattern(type: string, pattern: ErrorPattern): void;
    /**
     * Get all registered pattern types
     */
    getPatternTypes(): string[];
    /**
     * Get pattern details
     */
    getPattern(type: string): ErrorPattern | undefined;
    /**
     * Check if a pattern type exists
     */
    hasPattern(type: string): boolean;
    /**
     * Get patterns by severity level
     */
    getPatternsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): Array<[string, ErrorPattern]>;
    private extractValue;
    private extractAllValues;
}
export declare const errorPatterns: ErrorPatternRegistry;
//# sourceMappingURL=error-patterns.d.ts.map