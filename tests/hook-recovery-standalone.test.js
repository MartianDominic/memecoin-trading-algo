/**
 * Standalone Test suite for Hook Error Recovery Tool
 * (No database dependencies)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the HookErrorRecovery class directly
const HookErrorRecovery = require('../scripts/hook-error-recovery.js');

describe('HookErrorRecovery Standalone Tests', () => {
  let recovery;
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-recovery-test-'));

    recovery = new HookErrorRecovery({
      logFile: path.join(tempDir, 'test-errors.log'),
      recoveryLogFile: path.join(tempDir, 'test-recovery.log'),
      autoRecover: true,
      maxRetries: 2,
      retryDelay: 100
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should extract tool_use_id from error message', () => {
    const errorMessage = "API Error: 400 tool_use ids were found without tool_result blocks: toolu_01X7Svg8CzbRc5BzdaXXXNaJ";
    const toolUseId = recovery.extractToolUseId(errorMessage);

    expect(toolUseId).toBe('toolu_01X7Svg8CzbRc5BzdaXXXNaJ');
  });

  test('should detect hook completion patterns', () => {
    const logLine = "⎿ Hook PostToolUse:Edit completed";
    const parsed = recovery.parseLogLine(logLine);

    expect(parsed.isError).toBe(true);
  });

  test('should generate valid tool_result structure', async () => {
    const toolUseId = 'toolu_test123';
    const originalError = 'Test error message';

    const toolResult = await recovery.generateToolResult(toolUseId, originalError);

    expect(toolResult.type).toBe('tool_result');
    expect(toolResult.tool_use_id).toBe(toolUseId);
    expect(toolResult.is_error).toBe(false);
    expect(typeof toolResult.content).toBe('string');

    const content = JSON.parse(toolResult.content);
    expect(content.status).toBe('error_recovered');
    expect(content.original_error).toBe(originalError);
  });

  test('should track statistics correctly', () => {
    recovery.activeToolUses.set('test1', { id: 'test1' });
    recovery.recoveryAttempts.set('retry1', 2);

    const stats = recovery.getStats();

    expect(stats.activeToolUses).toBe(1);
    expect(stats.totalRecoveryAttempts).toBe(2);
    expect(typeof stats.isMonitoring).toBe('boolean');
  });

  test('should write to log files', () => {
    recovery.log('Test message', 'info');

    const logContent = fs.readFileSync(recovery.config.logFile, 'utf8');
    expect(logContent).toContain('Test message');
    expect(logContent).toContain('[INFO]');
  });

  test('should handle real-world error pattern', async () => {
    const realWorldError = `⎿  Hook PostToolUse:Edit completed
  ⎿  API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.24: \`tool_use\` ids were found without \`tool_result\` blocks immediately after: toolu_01X7Svg8CzbRc5BzdaXXXNaJ"}}`;

    const parsed = recovery.parseLogLine(realWorldError);
    expect(parsed.isError).toBe(true);
    expect(parsed.toolUseId).toBe('toolu_01X7Svg8CzbRc5BzdaXXXNaJ');
  });
});

describe('Error Pattern Detection', () => {
  let recovery;

  beforeEach(() => {
    recovery = new HookErrorRecovery({ autoRecover: false });
  });

  test('should match various error patterns', () => {
    const errorPatterns = [
      "⎿ Hook PostToolUse:Edit completed",
      "API Error: 400 tool_use ids found without tool_result",
      "invalid_request_error tool_use blocks toolu_123",
    ];

    errorPatterns.forEach(pattern => {
      const parsed = recovery.parseLogLine(pattern);
      expect(parsed.isError).toBe(true);
    });
  });

  test('should extract tool IDs from various formats', () => {
    const testCases = [
      {
        input: "toolu_01X7Svg8CzbRc5BzdaXXXNaJ found without result",
        expected: "toolu_01X7Svg8CzbRc5BzdaXXXNaJ"
      },
      {
        input: "blocks: toolu_123ABC_test and more text",
        expected: "toolu_123ABC_test"
      },
      {
        input: "messages with toolu_simpleId here",
        expected: "toolu_simpleId"
      }
    ];

    testCases.forEach(({ input, expected }) => {
      const result = recovery.extractToolUseId(input);
      expect(result).toBe(expected);
    });
  });
});