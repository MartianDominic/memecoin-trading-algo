-- =====================================================
-- CAMPAIGN REVISION SYSTEM MIGRATION FOR SUPABASE
-- Execute this SQL in Supabase SQL Editor
-- =====================================================

-- Step 1: Create campaign_revisions table
CREATE TABLE IF NOT EXISTS public.campaign_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  revision_type text NOT NULL CHECK (revision_type IN ('draft', 'auto_save', 'manual_save', 'published')),

  -- Complete snapshot of campaign state at this revision
  campaign_data jsonb NOT NULL, -- Campaign settings, metadata
  leads_data jsonb, -- Array of leads at this revision
  messages_data jsonb, -- Message templates at this revision
  schedule_data jsonb, -- Schedule configuration at this revision

  -- Metadata
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  commit_message text,
  parent_revision_id uuid REFERENCES public.campaign_revisions(id),

  -- For efficiency: diff from previous revision (optional)
  changes jsonb,

  -- Status tracking
  is_current boolean DEFAULT false,

  UNIQUE(campaign_id, revision_number)
);

-- Step 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_revisions_campaign_id ON public.campaign_revisions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_revisions_created_at ON public.campaign_revisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_revisions_is_current ON public.campaign_revisions(campaign_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_campaign_revisions_type ON public.campaign_revisions(campaign_id, revision_type);

-- Step 3: Add RLS policies
ALTER TABLE public.campaign_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their campaign revisions"
ON public.campaign_revisions
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.campaigns
  WHERE campaigns.id = campaign_revisions.campaign_id
  AND campaigns.user_id = auth.uid()
));

-- Step 4: Add version tracking columns to existing tables
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS revision_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true;

ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS revision_id uuid;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true;

-- Step 5: Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_leads_revision_current ON public.leads(campaign_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_message_templates_revision_current ON public.message_templates(campaign_id, is_current) WHERE is_current = true;

-- Step 6: Create function to check if campaign has revisions
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

-- Step 7: Create function to create initial revision
CREATE OR REPLACE FUNCTION public.create_initial_campaign_revision(p_campaign_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign public.campaigns;
  v_revision_id uuid;
  v_leads_data jsonb;
  v_messages_data jsonb;
  v_schedule_data jsonb;
BEGIN
  -- Get the campaign
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;
  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  -- Check if revision already exists
  IF EXISTS (SELECT 1 FROM public.campaign_revisions WHERE campaign_id = p_campaign_id) THEN
    -- Return existing revision ID
    SELECT id INTO v_revision_id
    FROM public.campaign_revisions
    WHERE campaign_id = p_campaign_id AND is_current = true
    ORDER BY created_at DESC
    LIMIT 1;
    RETURN v_revision_id;
  END IF;

  -- Collect leads data
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'instagram_username', instagram_username,
      'full_name', full_name,
      'bio', bio,
      'follower_count', follower_count,
      'following_count', following_count,
      'status', status,
      'tags', tags,
      'notes', notes,
      'last_contacted', last_contacted,
      'created_at', created_at
    )
  ), '[]'::jsonb) INTO v_leads_data
  FROM public.leads
  WHERE campaign_id = p_campaign_id;

  -- Collect messages data
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'content', content,
      'variables', variables,
      'delay_days', delay_days,
      'created_at', created_at
    )
  ), '[]'::jsonb) INTO v_messages_data
  FROM public.message_templates
  WHERE campaign_id = p_campaign_id;

  -- Create basic schedule data from campaign
  SELECT jsonb_build_object(
    'startDate', COALESCE(v_campaign.started_at, now()),
    'timeZone', 'UTC',
    'workingHours', jsonb_build_object('start', '09:00', 'end', '17:00'),
    'workingDays', jsonb_build_array('monday', 'tuesday', 'wednesday', 'thursday', 'friday')
  ) INTO v_schedule_data;

  -- Create the initial revision
  INSERT INTO public.campaign_revisions (
    campaign_id,
    revision_number,
    revision_type,
    campaign_data,
    leads_data,
    messages_data,
    schedule_data,
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
      'status', v_campaign.status,
      'wizard_current_step', COALESCE(v_campaign.wizard_current_step, 0)
    ),
    v_leads_data,
    v_messages_data,
    v_schedule_data,
    v_campaign.user_id,
    'Initial revision created from existing campaign data',
    true
  ) RETURNING id INTO v_revision_id;

  -- Mark existing leads as current
  UPDATE public.leads
  SET is_current = true, revision_id = v_revision_id
  WHERE campaign_id = p_campaign_id AND is_current IS NULL;

  -- Mark existing message templates as current
  UPDATE public.message_templates
  SET is_current = true, revision_id = v_revision_id
  WHERE campaign_id = p_campaign_id AND is_current IS NULL;

  RETURN v_revision_id;
END;
$$;

-- Step 8: Create function to get latest revision
CREATE OR REPLACE FUNCTION public.get_latest_campaign_revision(p_campaign_id uuid)
RETURNS public.campaign_revisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revision public.campaign_revisions;
  v_user_id uuid;
BEGIN
  -- Validate user is authenticated and owns the campaign
  SELECT user_id INTO v_user_id FROM public.campaigns WHERE id = p_campaign_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found' USING ERRCODE = 'CR001';
  END IF;

  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'CR002';
  END IF;

  -- Try to get the latest revision
  SELECT * INTO v_revision
  FROM public.campaign_revisions
  WHERE campaign_id = p_campaign_id AND is_current = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- Return the revision (can be null if no revisions exist)
  RETURN v_revision;
END;
$$;

-- Step 9: Initialize existing data (if any)
-- Set is_current = true for all existing leads and message_templates
UPDATE public.leads
SET is_current = true
WHERE is_current IS NULL;

UPDATE public.message_templates
SET is_current = true
WHERE is_current IS NULL;

-- Step 10: Create initial revisions for existing campaigns (if any exist)
INSERT INTO public.campaign_revisions (
  campaign_id,
  revision_number,
  revision_type,
  campaign_data,
  leads_data,
  messages_data,
  schedule_data,
  created_by,
  commit_message,
  is_current,
  created_at
)
SELECT
  c.id as campaign_id,
  1 as revision_number,
  'manual_save' as revision_type,
  jsonb_build_object(
    'name', c.name,
    'description', c.description,
    'account_id', c.account_id,
    'daily_limit', c.daily_limit,
    'status', c.status,
    'wizard_current_step', COALESCE(c.wizard_current_step, 0)
  ) as campaign_data,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'instagram_username', l.instagram_username,
          'full_name', l.full_name,
          'bio', l.bio,
          'follower_count', l.follower_count,
          'following_count', l.following_count,
          'status', l.status,
          'tags', l.tags,
          'notes', l.notes,
          'last_contacted', l.last_contacted,
          'created_at', l.created_at
        )
      )
      FROM public.leads l
      WHERE l.campaign_id = c.id
    ),
    '[]'::jsonb
  ) as leads_data,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', mt.id,
          'content', mt.content,
          'variables', mt.variables,
          'delay_days', mt.delay_days,
          'created_at', mt.created_at
        )
      )
      FROM public.message_templates mt
      WHERE mt.campaign_id = c.id
    ),
    '[]'::jsonb
  ) as messages_data,
  jsonb_build_object(
    'startDate', COALESCE(c.started_at, c.created_at),
    'timeZone', 'UTC',
    'workingHours', jsonb_build_object('start', '09:00', 'end', '17:00'),
    'workingDays', jsonb_build_array('monday', 'tuesday', 'wednesday', 'thursday', 'friday')
  ) as schedule_data,
  c.user_id as created_by,
  'Initial revision created from existing campaign data' as commit_message,
  true as is_current,
  c.created_at
FROM public.campaigns c
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaign_revisions cr
  WHERE cr.campaign_id = c.id
)
AND c.is_wizard_draft = false; -- Only create revisions for actual campaigns, not drafts

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

SELECT 'Migration completed successfully!' as status;