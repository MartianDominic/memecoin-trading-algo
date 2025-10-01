#!/usr/bin/env node
/**
 * Execute Database Migration Programmatically
 * This script applies the campaign revision system migration via Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../src/config/supabase.ts';

// Supabase configuration - using centralized config
const SUPABASE_URL = SUPABASE_CONFIG.PROJECT_URL;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: globalThis.localStorage ?? {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// Migration steps - broken down into manageable chunks
const migrationSteps = [
  {
    name: "Add missing columns to leads table",
    sql: `
      ALTER TABLE public.leads
      ADD COLUMN IF NOT EXISTS revision_id uuid,
      ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true;
    `
  },
  {
    name: "Add missing columns to message_templates table",
    sql: `
      ALTER TABLE public.message_templates
      ADD COLUMN IF NOT EXISTS revision_id uuid,
      ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true;
    `
  },
  {
    name: "Update existing leads to be current",
    sql: `
      UPDATE public.leads
      SET is_current = true
      WHERE is_current IS NULL;
    `
  },
  {
    name: "Update existing message_templates to be current",
    sql: `
      UPDATE public.message_templates
      SET is_current = true
      WHERE is_current IS NULL;
    `
  }
];

async function executeStep(step) {
  console.log(`\n🔄 Executing: ${step.name}`);

  try {
    const { data, error } = await supabase.rpc('exec', {
      sql: step.sql
    });

    if (error) {
      console.log(`⚠️  RPC method 'exec' not available, trying alternative approach...`);

      // Alternative: try using a simple query that forces SQL execution
      const { error: altError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .limit(1);

      if (altError) {
        throw new Error(`Migration step failed: ${error.message}`);
      }

      console.log(`⚠️  Cannot execute DDL statements with current permissions`);
      console.log(`📋 Manual execution required in Supabase SQL Editor:`);
      console.log(step.sql);
      return false;
    }

    console.log(`✅ ${step.name} completed successfully`);
    return true;

  } catch (error) {
    console.error(`❌ Failed to execute ${step.name}:`, error.message);
    return false;
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration results...');

  try {
    // Test if new columns exist by trying to select them
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, is_current, revision_id')
      .limit(1);

    if (leadsError) {
      if (leadsError.message.includes('column "is_current" does not exist')) {
        console.log('❌ leads.is_current column still missing');
        return false;
      }
      if (leadsError.message.includes('column "revision_id" does not exist')) {
        console.log('❌ leads.revision_id column still missing');
        return false;
      }
    } else {
      console.log('✅ leads table columns added successfully');
    }

    const { data: templates, error: templatesError } = await supabase
      .from('message_templates')
      .select('id, is_current, revision_id')
      .limit(1);

    if (templatesError) {
      if (templatesError.message.includes('column "is_current" does not exist')) {
        console.log('❌ message_templates.is_current column still missing');
        return false;
      }
    } else {
      console.log('✅ message_templates table columns added successfully');
    }

    return true;

  } catch (error) {
    console.error('❌ Migration verification failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Campaign Revision System Migration');
  console.log('=============================================');

  // Check connection first
  const { data: testData, error: testError } = await supabase
    .from('campaigns')
    .select('id')
    .limit(1);

  if (testError) {
    console.error('❌ Database connection failed:', testError.message);
    return;
  }

  console.log('✅ Database connection verified');

  // Execute migration steps
  let allSuccessful = true;
  for (const step of migrationSteps) {
    const success = await executeStep(step);
    if (!success) {
      allSuccessful = false;
    }
  }

  if (!allSuccessful) {
    console.log('\n⚠️  Some migration steps require manual execution');
    console.log('📋 Please execute the following SQL in Supabase SQL Editor:');
    console.log('\n--- MIGRATION SQL ---');
    migrationSteps.forEach(step => {
      console.log(`\n-- ${step.name}`);
      console.log(step.sql);
    });
    console.log('\n--- END MIGRATION SQL ---\n');
  }

  // Verify results
  const verified = await verifyMigration();

  if (verified) {
    console.log('\n🎉 Migration completed and verified successfully!');
    console.log('📋 Campaign revision system ready for testing');
  } else {
    console.log('\n⚠️  Migration verification failed');
    console.log('📋 Manual intervention may be required');
  }
}

main().catch(console.error);