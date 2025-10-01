/**
 * Schema Verification Script
 *
 * This script verifies that all required database functions and columns
 * exist for the campaign revision system to work properly.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing Supabase configuration in .env.local');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFunctions() {
  console.log('\n=== Verifying required functions...');

  const functionsToCheck = [
    'campaign_has_revisions',
    'create_initial_campaign_revision',
    'create_campaign_revision',
    'get_latest_campaign_revision',
    'restore_campaign_revision'
  ];

  const results = {};

  for (const funcName of functionsToCheck) {
    try {
      // Try to call each function with a test UUID
      const testUuid = '00000000-0000-0000-0000-000000000000';
      const { error } = await supabase.rpc(funcName, { campaign_id: testUuid });

      if (error && error.code === '42883') {
        // Function doesn't exist
        results[funcName] = { exists: false, error: 'Function not found' };
      } else if (error && (error.code === 'CR001' || error.message.includes('Campaign not found'))) {
        // Function exists but campaign not found (expected for test UUID)
        results[funcName] = { exists: true };
      } else if (error && error.code === '23503') {
        // Foreign key constraint (function exists)
        results[funcName] = { exists: true };
      } else {
        // Function executed successfully or expected error
        results[funcName] = { exists: true };
      }
    } catch (err) {
      results[funcName] = { exists: false, error: err.message };
    }
  }

  return results;
}

async function verifyColumns() {
  console.log('\n=== Verifying required columns...');

  const columnsToCheck = [
    { table: 'campaigns', columns: ['is_current', 'revision_id'] },
    { table: 'leads', columns: ['is_current', 'revision_id', 'bio', 'notes', 'last_contacted'] },
    { table: 'message_templates', columns: ['is_current', 'revision_id', 'campaign_id', 'delay_days'] },
    { table: 'campaign_revisions', columns: ['id', 'campaign_id', 'revision_number', 'is_current'] }
  ];

  const results = {};

  for (const { table, columns } of columnsToCheck) {
    results[table] = {};

    for (const column of columns) {
      try {
        // Try to select the column from the table
        const { error } = await supabase
          .from(table)
          .select(column)
          .limit(1);

        if (error && error.code === '42703') {
          // Column doesn't exist
          results[table][column] = { exists: false, error: 'Column not found' };
        } else if (error && error.code === '42P01') {
          // Table doesn't exist
          results[table][column] = { exists: false, error: 'Table not found' };
        } else {
          // Column exists
          results[table][column] = { exists: true };
        }
      } catch (err) {
        results[table][column] = { exists: false, error: err.message };
      }
    }
  }

  return results;
}

async function runVerification() {
  console.log('=== Starting schema verification...');

  try {
    const functionResults = await verifyFunctions();
    const columnResults = await verifyColumns();

    console.log('\n=== VERIFICATION RESULTS:');
    console.log('========================');

    // Check functions
    console.log('\n=== FUNCTIONS:');
    let allFunctionsExist = true;
    Object.entries(functionResults).forEach(([funcName, result]) => {
      const status = result.exists ? 'OK' : 'MISSING';
      console.log(`  ${status} ${funcName}`);
      if (!result.exists) {
        allFunctionsExist = false;
        console.log(`    Error: ${result.error}`);
      }
    });

    // Check columns
    console.log('\n=== COLUMNS:');
    let allColumnsExist = true;
    Object.entries(columnResults).forEach(([table, columns]) => {
      console.log(`  Table: ${table}`);
      Object.entries(columns).forEach(([column, result]) => {
        const status = result.exists ? 'OK' : 'MISSING';
        console.log(`    ${status} ${column}`);
        if (!result.exists) {
          allColumnsExist = false;
          console.log(`      Error: ${result.error}`);
        }
      });
    });

    console.log('\n=== SUMMARY:');
    console.log('============');
    if (allFunctionsExist && allColumnsExist) {
      console.log('SUCCESS: All required functions and columns exist!');
      console.log('SUCCESS: Schema is ready for campaign revision system');
    } else {
      console.log('ERROR: Some functions or columns are missing');
      console.log('==> Please run the migration script: 20250921000004_complete_schema_fix.sql');
    }

  } catch (error) {
    console.error('==> Verification failed:', error.message);
    process.exit(1);
  }
}

// Run the verification
runVerification().catch((err) => {
  console.error('==> Unexpected error:', err.message);
  process.exit(1);
});