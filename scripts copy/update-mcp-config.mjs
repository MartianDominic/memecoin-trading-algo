#!/usr/bin/env node
/**
 * Update MCP Configuration Script
 * Generates .mcp.json using centralized Supabase configuration
 *
 * This ensures the MCP server always uses the correct project reference
 * from our single source of truth in src/config/supabase.ts
 */

import { SUPABASE_CONFIG } from '../src/config/supabase.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Updating MCP configuration with centralized Supabase config...');

const mcpConfig = {
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase",
        `--project-ref=${SUPABASE_CONFIG.PROJECT_REF}`
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": process.env.SUPABASE_ACCESS_TOKEN || "sbp_73d46040c9883c3129fa8c0429a2f8a8d1b6dc44"
      }
    }
  }
};

const mcpConfigPath = path.join(__dirname, '..', '.mcp.json');

try {
  // Write the updated configuration
  fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

  console.log('✅ MCP configuration updated successfully');
  console.log(`📋 Project reference: ${SUPABASE_CONFIG.PROJECT_REF}`);
  console.log(`📋 Project URL: ${SUPABASE_CONFIG.PROJECT_URL}`);
  console.log('📋 Configuration written to: .mcp.json');

  // Verify the file was written correctly
  const written = fs.readFileSync(mcpConfigPath, 'utf8');
  const parsed = JSON.parse(written);

  if (parsed.mcpServers.supabase.args.includes(`--project-ref=${SUPABASE_CONFIG.PROJECT_REF}`)) {
    console.log('✅ Verification passed: Project reference correctly set');
  } else {
    console.error('❌ Verification failed: Project reference not found in generated config');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Failed to update MCP configuration:', error.message);
  process.exit(1);
}

console.log('\n🚀 Next Steps:');
console.log('1. Restart Claude Code to pick up the new MCP configuration');
console.log('2. Run this script whenever the centralized config changes');
console.log('3. Consider adding this to your build process for automatic updates');