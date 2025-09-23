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

export class ErrorPatternRegistry {
  private readonly patterns: Map<string, ErrorPattern> = new Map([
    ['incomplete_tool_result', {
      name: 'Incomplete Tool Result',
      patterns: [
        /tool_use.*ids were found without.*tool_result.*blocks/i,
        /Each `tool_use` block must have a corresponding `tool_result` block/i,
        /tool_use.*found without.*tool_result/i
      ],
      severity: 'high',
      extractors: {
        toolUseId: /toolu_[a-zA-Z0-9_]+/,
        errorCode: /Error: (\d+)/
      }
    }],

    ['hook_completion', {
      name: 'Hook Completion Error',
      patterns: [
        /Hook PostToolUse:(\w+) completed/i,
        /⎿\s*Hook PostToolUse:(\w+) completed/i
      ],
      severity: 'medium',
      extractors: {
        toolUseId: /toolu_[a-zA-Z0-9_]+/
      }
    }],

    ['api_error_400', {
      name: 'API 400 Error',
      patterns: [
        /API Error: 400.*invalid_request_error/i,
        /HTTP 400.*Bad Request/i,
        /400.*invalid_request_error.*tool_use/i
      ],
      severity: 'high',
      extractors: {
        toolUseId: /toolu_[a-zA-Z0-9_]+/,
        errorCode: /Error: (\d+)/
      }
    }],

    ['claude_flow_error', {
      name: 'Claude Flow Integration Error',
      patterns: [
        /claude-flow.*failed/i,
        /npx claude-flow.*error/i,
        /claude-flow hooks.*timeout/i
      ],
      severity: 'medium',
      extractors: {
        toolUseId: /toolu_[a-zA-Z0-9_]+/
      }
    }],

    ['database_connection', {
      name: 'Database Connection Error',
      patterns: [
        /database connection failed/i,
        /ECONNREFUSED.*postgres/i,
        /Prisma.*connection error/i
      ],
      severity: 'critical'
    }],

    ['memory_exhaustion', {
      name: 'Memory Exhaustion',
      patterns: [
        /JavaScript heap out of memory/i,
        /Maximum call stack size exceeded/i,
        /ENOMEM/i
      ],
      severity: 'critical'
    }]
  ]);

  /**
   * Match a log line against all registered error patterns
   */
  match(line: string): ErrorMatch {
    for (const [type, pattern] of this.patterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(line)) {
          return {
            matched: true,
            type,
            severity: pattern.severity,
            toolUseId: this.extractValue(line, pattern.extractors?.toolUseId),
            metadata: {
              pattern: pattern.name,
              matchedRegex: regex.source,
              extractedData: this.extractAllValues(line, pattern.extractors)
            }
          };
        }
      }
    }

    return { matched: false };
  }

  /**
   * Match against specific pattern types
   */
  matchType(line: string, patternType: string): ErrorMatch {
    const pattern = this.patterns.get(patternType);
    if (!pattern) {
      return { matched: false };
    }

    for (const regex of pattern.patterns) {
      if (regex.test(line)) {
        return {
          matched: true,
          type: patternType,
          severity: pattern.severity,
          toolUseId: this.extractValue(line, pattern.extractors?.toolUseId),
          metadata: {
            pattern: pattern.name,
            matchedRegex: regex.source,
            extractedData: this.extractAllValues(line, pattern.extractors)
          }
        };
      }
    }

    return { matched: false };
  }

  /**
   * Extract tool_use ID from any text
   */
  extractToolUseId(text: string): string | null {
    const patterns = [
      /toolu_[a-zA-Z0-9_]+/g,
      /tool_use.*?(toolu_[a-zA-Z0-9_]+)/g
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        const match = matches[0];
        return match.includes('toolu_') ? match : matches[0].match(/toolu_[a-zA-Z0-9_]+/)?.[0] || null;
      }
    }
    return null;
  }

  /**
   * Register a new error pattern
   */
  registerPattern(type: string, pattern: ErrorPattern): void {
    this.patterns.set(type, pattern);
  }

  /**
   * Get all registered pattern types
   */
  getPatternTypes(): string[] {
    return Array.from(this.patterns.keys());
  }

  /**
   * Get pattern details
   */
  getPattern(type: string): ErrorPattern | undefined {
    return this.patterns.get(type);
  }

  /**
   * Check if a pattern type exists
   */
  hasPattern(type: string): boolean {
    return this.patterns.has(type);
  }

  /**
   * Get patterns by severity level
   */
  getPatternsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): Array<[string, ErrorPattern]> {
    return Array.from(this.patterns.entries()).filter(([, pattern]) => pattern.severity === severity);
  }

  private extractValue(text: string, extractor?: RegExp): string | null {
    if (!extractor) return null;

    const match = text.match(extractor);
    return match ? match[0] : null;
  }

  private extractAllValues(text: string, extractors?: Record<string, RegExp>): Record<string, string | null> {
    if (!extractors) return {};

    const result: Record<string, string | null> = {};
    for (const [key, extractor] of Object.entries(extractors)) {
      result[key] = this.extractValue(text, extractor);
    }
    return result;
  }
}

// Export singleton instance
export const errorPatterns = new ErrorPatternRegistry();