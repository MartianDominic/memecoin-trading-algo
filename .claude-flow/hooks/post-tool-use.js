#!/usr/bin/env node
// Auto-generated hook for error recovery integration

const HookErrorRecovery = require('../../scripts/hook-error-recovery.js');
const config = require('../../config/hook-recovery.config.json');

const recovery = new HookErrorRecovery(config);

// Monitor this hook execution for errors
process.on('uncaughtException', (error) => {
    recovery.log(`Hook execution error: ${error.message}`, 'error');
});

process.on('unhandledRejection', (reason, promise) => {
    recovery.log(`Unhandled promise rejection: ${reason}`, 'error');
});

// Pass through the original hook data
console.log(JSON.stringify(process.argv.slice(2)));
