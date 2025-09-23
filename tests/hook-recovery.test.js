/**
 * Test suite for Hook Error Recovery Tool
 */

const fs = require('fs');
const path = require('path');
const HookErrorRecovery = require('../scripts/hook-error-recovery.js');

describe('HookErrorRecovery', () => {
  let recovery;
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(__dirname, 'temp-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

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

  describe('Error Detection', () => {
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

    test('should detect API error patterns', () => {
      const logLine = "API Error: 400 {\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"tool_use ids found without tool_result\"}}";
      const parsed = recovery.parseLogLine(logLine);

      expect(parsed.isError).toBe(true);
    });
  });

  describe('Tool Result Generation', () => {
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
      expect(content.recovery_timestamp).toBeDefined();
    });
  });

  describe('Session Injection', () => {
    test('should inject tool_result into session file', async () => {
      const sessionDir = path.join(tempDir, '.claude-flow');
      fs.mkdirSync(sessionDir, { recursive: true });

      const sessionFile = path.join(sessionDir, 'session.json');
      fs.writeFileSync(sessionFile, JSON.stringify({ existing: 'data' }));

      // Temporarily change working directory for the test
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      const toolResult = {
        type: 'tool_result',
        tool_use_id: 'test123',
        content: 'test content'
      };

      const success = await recovery.injectViaSession(toolResult);

      expect(success).toBe(true);

      const updatedSession = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      expect(updatedSession.tool_results).toBeDefined();
      expect(updatedSession.tool_results).toHaveLength(1);
      expect(updatedSession.tool_results[0]).toEqual(toolResult);

      process.chdir(originalCwd);
    });
  });

  describe('Recovery Trigger', () => {
    test('should create and process recovery trigger', async () => {
      const originalCwd = process.cwd();
      process.chdir(tempDir);

      const claudeFlowDir = path.join(tempDir, '.claude-flow');
      fs.mkdirSync(claudeFlowDir, { recursive: true });

      const toolResult = {
        type: 'tool_result',
        tool_use_id: 'trigger_test',
        content: 'trigger content'
      };

      // Start the trigger completion process
      const triggerPromise = recovery.triggerCompletion(toolResult);

      // Simulate trigger processing by removing the file after a delay
      setTimeout(() => {
        const triggerPath = path.join(claudeFlowDir, 'recovery-trigger.json');
        if (fs.existsSync(triggerPath)) {
          fs.unlinkSync(triggerPath);
        }
      }, 50);

      const success = await triggerPromise;
      expect(success).toBe(true);

      process.chdir(originalCwd);
    });
  });

  describe('Error Handling', () => {
    test('should handle error with retry logic', async () => {
      const errorData = {
        message: 'Test error message',
        toolUseId: 'test_retry_123',
        errorType: 'incomplete_tool_result'
      };

      // Mock injectToolResult to fail initially
      const originalInject = recovery.injectToolResult;
      let callCount = 0;
      recovery.injectToolResult = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount > 1); // Succeed on second call
      });

      const result = await recovery.handleHookError(errorData);

      expect(recovery.injectToolResult).toHaveBeenCalled();
      recovery.injectToolResult = originalInject;
    });

    test('should respect max retry limit', async () => {
      const errorData = {
        message: 'Test error message',
        toolUseId: 'test_max_retry',
        errorType: 'incomplete_tool_result'
      };

      // Set retry count to max
      recovery.recoveryAttempts.set('test_max_retry', recovery.config.maxRetries);

      const result = await recovery.handleHookError(errorData);
      expect(result).toBe(false);
    });
  });

  describe('Statistics', () => {
    test('should track statistics correctly', () => {
      recovery.activeToolUses.set('test1', { id: 'test1' });
      recovery.activeToolUses.set('test2', { id: 'test2' });
      recovery.recoveryAttempts.set('retry1', 2);
      recovery.recoveryAttempts.set('retry2', 1);

      const stats = recovery.getStats();

      expect(stats.activeToolUses).toBe(2);
      expect(stats.totalRecoveryAttempts).toBe(3);
      expect(stats.isMonitoring).toBe(false);
    });
  });

  describe('Logging', () => {
    test('should write to log files', () => {
      recovery.log('Test message', 'info');

      const logContent = fs.readFileSync(recovery.config.logFile, 'utf8');
      expect(logContent).toContain('Test message');
      expect(logContent).toContain('[INFO]');
    });

    test('should write recovery logs', () => {
      recovery.logRecovery('Recovery test message');

      const recoveryLogContent = fs.readFileSync(recovery.config.recoveryLogFile, 'utf8');
      expect(recoveryLogContent).toContain('Recovery test message');
      expect(recoveryLogContent).toContain('[RECOVERY]');
    });
  });
});

// Integration test
describe('HookErrorRecovery Integration', () => {
  test('should handle complete error scenario', async () => {
    const tempDir = path.join(__dirname, 'integration-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const recovery = new HookErrorRecovery({
        logFile: path.join(tempDir, 'integration-errors.log'),
        recoveryLogFile: path.join(tempDir, 'integration-recovery.log'),
        autoRecover: true,
        maxRetries: 1,
        retryDelay: 50
      });

      // Simulate the exact error from the user's message
      const realWorldError = `⎿  Hook PostToolUse:Edit completed
  ⎿  API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.24: \`tool_use\` ids were found without \`tool_result\` blocks immediately after:
     toolu_01X7Svg8CzbRc5BzdaXXXNaJ. Each \`tool_use\` block must have a corresponding \`tool_result\` block in the next message."},"request_id":"req_011CTS5hAc7JjX2uqMp1wGMs"}`;

      // Process the error
      await recovery.processLogLine(realWorldError);

      // Verify logs were written
      const errorLog = fs.readFileSync(path.join(tempDir, 'integration-errors.log'), 'utf8');
      expect(errorLog).toContain('toolu_01X7Svg8CzbRc5BzdaXXXNaJ');

    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 10000);
});