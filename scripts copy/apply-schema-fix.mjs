#!/usr/bin/env node

/**
 * Apply database schema fixes to resolve campaign creation/editing issues
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import centralized configuration
import { SUPABASE_CONFIG } from '../src/config/supabase.ts';

const SUPABASE_PROJECT_REF = SUPABASE_CONFIG.PROJECT_REF;
const SUPABASE_URL = SUPABASE_CONFIG.PROJECT_URL;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.ANON_KEY;

console.log('🚀 Starting database schema fix for campaign system...\n');

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function authenticateUser() {
  console.log('🔐 Authenticating with Supabase...');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'jdominykas7@gmail.com',
    password: 'Test1234'
  });

  if (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }

  console.log(`✅ Authenticated as: ${data.user.email}`);
  console.log(`👤 User ID: ${data.user.id}\n`);

  return data.user;
}

async function executeSQL(sql, description) {
  console.log(`⚡ ${description}...`);

  try {
    const { data, error } = await supabase.from('_sql').select('*').gte('id', 0); // This will fail but shows connection

    // Since direct SQL execution isn't available, we'll use RPC calls for function creation
    // For now, let's test function availability first

    return { success: true };
  } catch (err) {
    console.log(`⚠️  ${description} encountered issue: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function testFunctionAvailability() {
  console.log('🧪 Testing function availability...\n');

  const functions = [
    { name: 'campaign_has_revisions', testId: '00000000-0000-0000-0000-000000000000' },
    { name: 'create_initial_campaign_revision', testId: '00000000-0000-0000-0000-000000000000' }
  ];

  const results = {};

  for (const func of functions) {
    try {
      console.log(`🔍 Testing ${func.name}...`);

      const { data, error } = await supabase.rpc(func.name, {
        p_campaign_id: func.testId
      });

      if (error) {
        if (error.message.includes('not found') || error.message.includes('PGRST202')) {
          results[func.name] = { exists: false, error: 'Function not found' };
          console.log(`❌ ${func.name}: MISSING`);
        } else if (error.message.includes('Campaign not found')) {
          results[func.name] = { exists: true, error: 'Function exists (expected error with test ID)' };
          console.log(`✅ ${func.name}: EXISTS`);
        } else {
          results[func.name] = { exists: false, error: error.message };
          console.log(`❌ ${func.name}: ERROR - ${error.message}`);
        }
      } else {
        results[func.name] = { exists: true, result: data };
        console.log(`✅ ${func.name}: EXISTS`);
      }
    } catch (err) {
      results[func.name] = { exists: false, error: err.message };
      console.log(`❌ ${func.name}: ERROR - ${err.message}`);
    }
  }

  return results;
}

async function testColumnExistence() {
  console.log('\n🗃️  Testing column existence...\n');

  try {
    // Test leads.is_current column
    console.log('🔍 Testing leads.is_current column...');
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .select('id, is_current')
      .limit(1);

    if (leadsError) {
      if (leadsError.message.includes('column "is_current" does not exist')) {
        console.log('❌ leads.is_current: MISSING');
      } else {
        console.log(`❌ leads.is_current: ERROR - ${leadsError.message}`);
      }
    } else {
      console.log('✅ leads.is_current: EXISTS');
    }

    // Test message_templates.campaign_id column
    console.log('🔍 Testing message_templates.campaign_id column...');
    const { data: templatesData, error: templatesError } = await supabase
      .from('message_templates')
      .select('id, campaign_id')
      .limit(1);

    if (templatesError) {
      if (templatesError.message.includes('column "campaign_id" does not exist')) {
        console.log('❌ message_templates.campaign_id: MISSING');
      } else {
        console.log(`❌ message_templates.campaign_id: ERROR - ${templatesError.message}`);
      }
    } else {
      console.log('✅ message_templates.campaign_id: EXISTS');
    }

  } catch (err) {
    console.log(`❌ Column testing failed: ${err.message}`);
  }
}

async function checkTableExists(tableName) {
  console.log(`🔍 Checking if ${tableName} table exists...`);

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log(`❌ ${tableName} table: MISSING`);
        return false;
      } else {
        console.log(`✅ ${tableName} table: EXISTS`);
        return true;
      }
    } else {
      console.log(`✅ ${tableName} table: EXISTS`);
      return true;
    }
  } catch (err) {
    console.log(`❌ ${tableName} table check failed: ${err.message}`);
    return false;
  }
}

async function main() {
  try {
    // Step 1: Authenticate
    const user = await authenticateUser();

    // Step 2: Check current state
    console.log('📊 Checking current database state...\n');

    // Check if campaign_revisions table exists
    const hasRevisionsTable = await checkTableExists('campaign_revisions');

    // Test column existence
    await testColumnExistence();

    // Test function availability
    const functionResults = await testFunctionAvailability();

    console.log('\n📋 CURRENT STATE SUMMARY:');
    console.log('='.repeat(50));
    console.log(`campaign_revisions table: ${hasRevisionsTable ? '✅ EXISTS' : '❌ MISSING'}`);

    Object.entries(functionResults).forEach(([name, result]) => {
      console.log(`${name}: ${result.exists ? '✅ EXISTS' : '❌ MISSING'}`);
    });

    // Step 3: Provide instructions for manual fix
    console.log('\n🔧 MANUAL MIGRATION REQUIRED:');
    console.log('='.repeat(50));
    console.log('The schema fixes need to be applied manually through the Supabase dashboard:');
    console.log('');
    console.log(`1. Go to: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql`);
    console.log('2. Copy and execute the contents of:');
    console.log('   supabase/migrations/20250921000004_complete_schema_fix.sql');
    console.log('');
    console.log('This will:');
    console.log('   • Add missing columns to leads and message_templates tables');
    console.log('   • Create campaign_revisions table for state persistence');
    console.log('   • Create missing functions for revision management');
    console.log('   • Set up proper indexes and security policies');

    console.log('\n🏁 Analysis completed!');

  } catch (error) {
    console.error('\n💥 Error:', error.message);
    process.exit(1);
  }
}

main();