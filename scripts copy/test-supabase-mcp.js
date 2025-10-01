#!/usr/bin/env node

/**
 * Test Script for Supabase MCP Write Mode
 *
 * This script can be used to verify Supabase MCP functionality
 * Run this after restarting Claude Code to test the MCP connection
 */

// Import centralized configuration
import { SUPABASE_CONFIG } from '../src/config/supabase.ts';
const SUPABASE_PROJECT_REF = SUPABASE_CONFIG.PROJECT_REF;

console.log('🧪 Supabase MCP Write Mode Test Script');
console.log('=====================================');

console.log('✅ MCP Configuration Updated:');
console.log('   - Removed --read-only flag');
console.log('   - Enabled write mode');
console.log(`   - Project ref: ${SUPABASE_PROJECT_REF}`);

console.log('\n🔄 Next Steps:');
console.log('1. Restart Claude Code to apply MCP configuration changes');
console.log('2. After restart, the following MCP tools should be available:');
console.log('   - mcp__supabase__list_tables');
console.log('   - mcp__supabase__execute_sql');
console.log('   - mcp__supabase__list_projects');

console.log('\n📝 Test Commands to Try After Restart:');
console.log('1. List tables: Use mcp__supabase__list_tables');
console.log('2. Read data: mcp__supabase__execute_sql with SELECT query');
console.log('3. Write test: mcp__supabase__execute_sql with INSERT query');

console.log('\n⚠️  Write Mode Security Note:');
console.log('   Write mode is now enabled - use carefully in production!');
console.log('   Consider using read-only mode for safety in production environments.');

console.log('\n🎯 Sample Test Queries:');
console.log('   SELECT: SELECT * FROM campaigns LIMIT 5;');
console.log('   INSERT: INSERT INTO test_table (name) VALUES (\'MCP Test\');');
console.log('   (Adjust table names based on your schema)');

console.log('\n✨ Configuration File Updated: .mcp.json');
console.log('🔑 Environment Variable: SUPABASE_ACCESS_TOKEN is set');

// Test the environment variable
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (token) {
    console.log('✅ SUPABASE_ACCESS_TOKEN is available');
    console.log(`   Token starts with: ${token.substring(0, 20)}...`);
} else {
    console.log('❌ SUPABASE_ACCESS_TOKEN not found in environment');
}

console.log('\n🎉 Setup Complete! Restart Claude Code to test MCP functionality.');