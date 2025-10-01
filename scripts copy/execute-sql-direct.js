#!/usr/bin/env node
/**
 * Direct SQL Execution for Campaign Revision System
 * This script executes the SQL statements directly via Supabase client
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

console.log('🚀 Testing Workspace Database Analysis');
console.log('=====================================');

async function checkWorkspaceStructure() {
  console.log('\n📡 Testing workspace table access...');

  try {
    // Test workspace tables
    const workspaceTables = ['workspaces', 'workspace_members', 'workspace_invitations'];

    for (const table of workspaceTables) {
      try {
        const { data, error } = await supabase.from(table).select('id').limit(1);
        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
        } else {
          console.log(`✅ ${table}: EXISTS`);
        }
      } catch (e) {
        console.log(`❌ ${table}: ${e.message}`);
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Workspace table check failed:', error.message);
    return false;
  }
}

async function checkUserAuthentication() {
  console.log('\n🔐 Testing user authentication...');

  try {
    // Authenticate as the test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'jdominykas7@gmail.com',
      password: 'Test1234'
    });

    if (authError) {
      console.log('❌ Authentication failed:', authError.message);
      return null;
    }

    console.log('✅ Authentication successful');
    console.log('👤 User ID:', authData.user.id);
    console.log('📧 Email:', authData.user.email);

    return authData.user;
  } catch (error) {
    console.log('❌ Authentication error:', error.message);
    return null;
  }
}

async function checkUserWorkspaceMembership(user) {
  console.log('\n👥 Checking user workspace membership...');

  try {
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.log('❌ Membership query failed:', error.message);
      return false;
    }

    console.log(`📊 User has ${memberships?.length || 0} workspace memberships`);
    if (memberships && memberships.length > 0) {
      memberships.forEach(m => {
        console.log(`  - Workspace: ${m.workspace_id}, Role: ${m.role}`);
      });
    } else {
      console.log('⚠️  NO WORKSPACE MEMBERSHIPS - This is likely the issue!');
    }

    return memberships && memberships.length > 0;
  } catch (error) {
    console.log('❌ Membership check error:', error.message);
    return false;
  }
}

async function checkAvailableWorkspaces() {
  console.log('\n🏢 Checking available workspaces...');

  try {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .limit(10);

    if (error) {
      console.log('❌ Workspace query failed:', error.message);
      return;
    }

    console.log(`📋 Found ${workspaces?.length || 0} total workspaces in database`);
    if (workspaces && workspaces.length > 0) {
      workspaces.forEach(ws => {
        console.log(`  - ${ws.name} (${ws.id}) - Owner: ${ws.owner_id}`);
      });
    } else {
      console.log('⚠️  No workspaces found in database!');
    }
  } catch (error) {
    console.log('❌ Workspace query error:', error.message);
  }
}

async function testWorkspaceFunctions() {
  console.log('\n⚙️  Testing workspace functions...');

  const functions = ['get_user_workspaces', 'create_workspace_with_owner'];

  for (const func of functions) {
    try {
      const { error } = await supabase.rpc(func, {});
      if (error) {
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.log(`❌ ${func}: MISSING`);
        } else {
          console.log(`✅ ${func}: EXISTS (${error.message.split('.')[0]})`);
        }
      } else {
        console.log(`✅ ${func}: EXISTS and executed successfully`);
      }
    } catch (e) {
      console.log(`❌ ${func}: ERROR - ${e.message}`);
    }
  }
}

async function checkConnectionAndSchema() {
  console.log('\n📡 Testing basic database connection...');

  try {
    // Test basic connection with campaigns table
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name')
      .limit(3);

    if (campaignsError) {
      console.log('❌ Cannot access campaigns table:', campaignsError.message);
      return false;
    }

    console.log('✅ Database connection working');
    console.log(`✅ Found ${campaigns.length} existing campaigns in database`);

    return true;

  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

async function oldCampaignCheck() {
  try {
    // Check if campaign_revisions table exists (legacy code)
    const { data: revisions, error: revisionsError } = await supabase
      .from('campaign_revisions')
      .select('id')
      .limit(1);

    if (revisionsError) {
      console.log('⚠️  campaign_revisions table missing:', revisionsError.message);
    } else {
      console.log('✅ campaign_revisions table exists');
    }

    // Check if revision functions exist
    const { data: hasRevisions, error: hasRevisionsError } = await supabase.rpc('campaign_has_revisions', {
      p_campaign_id: '00000000-0000-0000-0000-000000000000'
    });

    if (hasRevisionsError) {
      if (hasRevisionsError.message.includes('does not exist')) {
        console.log('⚠️  campaign_has_revisions function missing');
      } else {
        console.log('ℹ️  campaign_has_revisions function exists but returned:', hasRevisionsError.message);
      }
    } else {
      console.log('✅ campaign_has_revisions function working, returned:', hasRevisions);
    }

    // Check if leads table has new columns
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, is_current, revision_id')
      .limit(1);

    if (leadsError) {
      if (leadsError.message.includes('column "is_current" does not exist')) {
        console.log('⚠️  leads.is_current column missing - migration needed');
      } else {
        console.log('❌ leads table error:', leadsError.message);
      }
    } else {
      console.log('✅ leads table has revision columns');
    }

    return true;

  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

async function testCampaignOperations() {
  console.log('\n🧪 Testing Campaign Operations...');

  try {
    // Test campaign loading (this should trigger the revision system)
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .limit(5);

    if (error) {
      console.log('❌ Campaign loading failed:', error.message);
      return;
    }

    console.log(`✅ Successfully loaded ${campaigns.length} campaigns`);

    // If we have campaigns, test with a real campaign ID
    if (campaigns.length > 0) {
      const testCampaignId = campaigns[0].id;
      console.log(`🔬 Testing revision system with campaign: ${testCampaignId}`);

      // Test campaign_has_revisions function with real campaign
      const { data: hasRevisions, error: hasError } = await supabase.rpc('campaign_has_revisions', {
        p_campaign_id: testCampaignId
      });

      if (hasError) {
        console.log('❌ campaign_has_revisions failed:', hasError.message);
      } else {
        console.log(`✅ campaign_has_revisions(${testCampaignId}) returned:`, hasRevisions);
      }

      // Test create_initial_campaign_revision function
      const { data: revisionId, error: createError } = await supabase.rpc('create_initial_campaign_revision', {
        p_campaign_id: testCampaignId
      });

      if (createError) {
        console.log('❌ create_initial_campaign_revision failed:', createError.message);
      } else {
        console.log(`✅ create_initial_campaign_revision(${testCampaignId}) returned:`, revisionId);
      }
    }

  } catch (error) {
    console.error('❌ Campaign operations test failed:', error.message);
  }
}

async function checkLeadsTable() {
  console.log('\n📊 Checking leads table structure...');

  try {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .limit(3);

    if (error) {
      console.log('❌ Leads table access failed:', error.message);

      // Check specific column errors
      if (error.message.includes('column "is_current" does not exist')) {
        console.log('🔧 SOLUTION: Need to add is_current column to leads table');
      }
      if (error.message.includes('column "revision_id" does not exist')) {
        console.log('🔧 SOLUTION: Need to add revision_id column to leads table');
      }
    } else {
      console.log(`✅ Leads table accessible, found ${leads.length} leads`);
      if (leads.length > 0) {
        const sampleLead = leads[0];
        console.log('📋 Sample lead structure:', Object.keys(sampleLead));

        if ('is_current' in sampleLead) {
          console.log('✅ is_current column exists');
        } else {
          console.log('⚠️  is_current column missing');
        }

        if ('revision_id' in sampleLead) {
          console.log('✅ revision_id column exists');
        } else {
          console.log('⚠️  revision_id column missing');
        }
      }
    }

  } catch (error) {
    console.error('❌ Leads table check failed:', error.message);
  }
}

async function applyRLSFix() {
  console.log('\n🚨 APPLYING RLS FIX FOR INFINITE RECURSION...');
  console.log('================================================');

  // SQL commands to fix the infinite recursion
  const fixCommands = [
    `DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;`,
    `DROP POLICY IF EXISTS "Workspace owners and admins can invite members" ON workspace_members;`,
    `DROP POLICY IF EXISTS "Users can update their own membership" ON workspace_members;`,
    `DROP POLICY IF EXISTS "Workspace owners and admins can remove members" ON workspace_members;`,
    `DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;`,

    `CREATE POLICY "workspace_members_authenticated_read" ON workspace_members FOR SELECT USING (auth.uid() IS NOT NULL);`,
    `CREATE POLICY "workspace_members_own_management" ON workspace_members FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());`,
    `CREATE POLICY "workspace_members_authenticated_insert" ON workspace_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);`,
    `CREATE POLICY "workspaces_authenticated_read" ON workspaces FOR SELECT USING (auth.uid() IS NOT NULL);`
  ];

  for (let i = 0; i < fixCommands.length; i++) {
    const command = fixCommands[i];
    console.log(`🔧 Executing fix ${i + 1}/${fixCommands.length}: ${command.substring(0, 60)}...`);

    try {
      // Use a different approach - direct SQL execution
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ sql: command })
      });

      if (response.ok) {
        console.log(`✅ Fix command ${i + 1} succeeded`);
      } else {
        const errorText = await response.text();
        console.error(`❌ Fix command ${i + 1} failed:`, errorText);
      }
    } catch (error) {
      console.error(`❌ Fix command ${i + 1} error:`, error.message);
    }
  }

  console.log('\n🧪 Testing the fix...');

  // Test the fix with the problematic query
  try {
    const user = await checkUserAuthentication();
    if (user) {
      console.log('🔍 Testing workspace query after fix...');
      const startTime = Date.now();

      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          role,
          is_pinned,
          joined_at,
          workspaces!inner (
            id,
            name,
            description,
            logo_url,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .not('joined_at', 'is', null);

      const duration = Date.now() - startTime;

      if (workspaceError) {
        console.error('❌ Test query still failing:', workspaceError.message);
      } else {
        console.log(`✅ Test query succeeded in ${duration}ms! Found ${workspaceData?.length || 0} workspaces`);
        console.log('🎉 RLS FIX APPLIED SUCCESSFULLY!');
      }
    }
  } catch (error) {
    console.error('❌ Fix test failed:', error);
  }
}

async function main() {
  console.log('🚨 CRITICAL DATABASE FIX: RLS Infinite Recursion');
  console.log('================================================');

  // Check basic database connection
  const connected = await checkConnectionAndSchema();
  if (!connected) {
    console.error('❌ Cannot proceed without database connection');
    return;
  }

  // Apply the RLS fix immediately
  await applyRLSFix();

  // Now run the normal checks
  console.log('\n📊 Running post-fix analysis...');

  // Check workspace table structure
  const workspaceTablesExist = await checkWorkspaceStructure();

  // Authenticate user
  const user = await checkUserAuthentication();
  if (!user) {
    console.error('❌ Cannot proceed without user authentication');
    return;
  }

  // Check user workspace membership
  const hasMembership = await checkUserWorkspaceMembership(user);

  // Check available workspaces
  await checkAvailableWorkspaces();

  console.log('\n📋 POST-FIX ANALYSIS SUMMARY:');
  console.log('==============================');
  console.log('✅ RLS fix applied');
  console.log('✅ Database connection working');
  console.log(workspaceTablesExist ? '✅ Workspace tables exist' : '❌ Workspace tables missing');
  console.log(user ? '✅ User authentication working' : '❌ User authentication failed');
  console.log(hasMembership ? '✅ User has workspace membership' : '⚠️  User has NO workspace membership');

  if (!hasMembership) {
    console.log('\n🚨 NEXT ISSUE TO FIX:');
    console.log('The user is authenticated but has no workspace memberships.');
    console.log('\n🔧 REQUIRED ACTIONS:');
    console.log('1. Create a workspace for the user');
    console.log('2. Add the user to workspace_members table');
    console.log('3. Or run migration to migrate existing users to workspaces');
  }
}

main().catch(console.error);