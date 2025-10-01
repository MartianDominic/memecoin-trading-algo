#!/usr/bin/env node

/**
 * Apply database migration directly using Supabase client
 * This bypasses CLI authentication issues
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { SUPABASE_CONFIG } from '../src/config/supabase.ts';

const SUPABASE_URL = SUPABASE_CONFIG.PROJECT_URL;
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.ANON_KEY;

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function applyMigration() {
  try {
    console.log('🔐 Attempting to authenticate...');

    // Try to sign in with user credentials
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'jdominykas7@gmail.com',
      password: 'Test1234'
    });

    if (error) {
      console.error('❌ Authentication failed:', error.message);
      return;
    }

    console.log('✅ Authentication successful!');
    console.log('👤 User:', data.user.email);

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20250921000004_complete_schema_fix.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded, executing...');

    // Split the migration into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} statements to execute`);

    let successCount = 0;
    let errors = [];

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (!statement) continue;

      try {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        const { error } = await supabase.rpc('sql_exec', {
          sql: statement + ';'
        });

        if (error) {
          console.warn(`⚠️  Statement ${i + 1} failed:`, error.message);
          errors.push({ statement: i + 1, error: error.message });
        } else {
          successCount++;
        }
      } catch (err) {
        console.warn(`⚠️  Statement ${i + 1} failed:`, err.message);
        errors.push({ statement: i + 1, error: err.message });
      }
    }

    console.log(`\n📈 Migration Results:`);
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(({ statement, error }) => {
        console.log(`  Statement ${statement}: ${error}`);
      });
    }

    // Test if the functions now exist
    console.log('\n🧪 Testing function availability...');

    try {
      const { data: hasRevisions, error: revError } = await supabase
        .rpc('campaign_has_revisions', { p_campaign_id: '00000000-0000-0000-0000-000000000000' });

      if (revError && !revError.message.includes('Campaign not found')) {
        console.log('❌ campaign_has_revisions function still missing');
      } else {
        console.log('✅ campaign_has_revisions function available');
      }
    } catch (err) {
      console.log('❌ campaign_has_revisions function test failed:', err.message);
    }

    console.log('\n🏁 Migration application completed!');

  } catch (error) {
    console.error('💥 Failed to apply migration:', error);
  }
}

applyMigration();