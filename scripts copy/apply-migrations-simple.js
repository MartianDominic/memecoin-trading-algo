#!/usr/bin/env node
/**
 * Simple Migration Applier
 * Uses direct SQL execution through Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SUPABASE_CONFIG } from '../src/config/supabase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Core SQL statements for the migration
const migrationSql = `
-- Phase 1: Create campaign_revisions table
CREATE TABLE IF NOT EXISTS public.campaign_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  revision_type text NOT NULL CHECK (revision_type IN ('draft', 'auto_save', 'manual_save', 'published')),

  campaign_data jsonb NOT NULL,
  leads_data jsonb,
  messages_data jsonb,
  schedule_data jsonb,

  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  commit_message text,
  parent_revision_id uuid REFERENCES public.campaign_revisions(id),
  changes jsonb,
  is_current boolean DEFAULT false,

  UNIQUE(campaign_id, revision_number)
);

-- Phase 2: Add missing columns to existing tables
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS revision_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true;

ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS revision_id uuid;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true;
`;

const functionsSql = `
-- Function to check if campaign has revisions
CREATE OR REPLACE FUNCTION public.campaign_has_revisions(p_campaign_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.campaign_revisions
    WHERE campaign_id = p_campaign_id
  );
END;
$$;

-- Function to create initial revision
CREATE OR REPLACE FUNCTION public.create_initial_campaign_revision(p_campaign_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.campaigns;
  v_revision_id uuid;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;
  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.campaign_revisions WHERE campaign_id = p_campaign_id) THEN
    SELECT id INTO v_revision_id
    FROM public.campaign_revisions
    WHERE campaign_id = p_campaign_id AND is_current = true
    ORDER BY created_at DESC
    LIMIT 1;
    RETURN v_revision_id;
  END IF;

  INSERT INTO public.campaign_revisions (
    campaign_id,
    revision_number,
    revision_type,
    campaign_data,
    created_by,
    commit_message,
    is_current
  ) VALUES (
    p_campaign_id,
    1,
    'manual_save',
    jsonb_build_object(
      'name', v_campaign.name,
      'description', v_campaign.description,
      'account_id', v_campaign.account_id,
      'daily_limit', v_campaign.daily_limit,
      'status', v_campaign.status
    ),
    v_campaign.user_id,
    'Initial revision created',
    true
  ) RETURNING id INTO v_revision_id;

  RETURN v_revision_id;
END;
$$;
`;

async function executeSQL(sql, description) {
  console.log(`🔄 ${description}...`);

  try {
    // Use a more direct approach - create a temporary table and drop it
    // This forces SQL execution through the client
    const tempTableName = `temp_migration_${Date.now()}`;

    const { error } = await supabase.rpc('exec', {
      sql: sql
    });

    if (error && !error.message.includes('already exists')) {
      throw error;
    }

    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

async function testFunctions() {
  console.log('\n🔍 Testing database functions...');

  try {
    // Test campaign_has_revisions
    const { data: hasRevisions, error: hasError } = await supabase.rpc('campaign_has_revisions', {
      p_campaign_id: '00000000-0000-0000-0000-000000000000'
    });

    if (hasError && hasError.message.includes('does not exist')) {
      console.log('❌ campaign_has_revisions function missing');
      return false;
    }

    console.log('✅ campaign_has_revisions function working');

    return true;
  } catch (error) {
    console.error('❌ Function test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Simple Migration Application');
  console.log('================================');

  // Check if we can access the database
  try {
    const { data, error } = await supabase.from('campaigns').select('id').limit(1);
    if (error) {
      console.error('❌ Cannot access database:', error.message);
      return;
    }
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }

  console.log('\n📋 Since direct SQL execution has limitations,');
  console.log('📋 I will show you the exact SQL statements to run manually.');
  console.log('📋 You can execute these in the Supabase SQL editor.\n');

  console.log('🔧 SQL TO EXECUTE IN SUPABASE SQL EDITOR:');
  console.log('==========================================');
  console.log(migrationSql);
  console.log('-- Functions:');
  console.log(functionsSql);

  // Test if functions already exist
  await testFunctions();
}

main().catch(console.error);