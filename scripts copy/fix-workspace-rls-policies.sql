-- Fix for infinite recursion in workspace RLS policies
-- This script removes circular dependencies in workspace_members policies

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Workspace owners and admins can invite members" ON workspace_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON workspace_members;
DROP POLICY IF EXISTS "Workspace owners and admins can remove members" ON workspace_members;

-- Create new policies without circular references

-- 1. Users can view their own membership record
CREATE POLICY "Users can view their own membership" ON workspace_members
    FOR SELECT
    USING (user_id = auth.uid());

-- 2. Workspace owners can view all members (avoid circular reference by using direct ownership check)
CREATE POLICY "Workspace owners can view all members" ON workspace_members
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- 3. Simple insert policy for workspace owners
CREATE POLICY "Workspace owners can invite members" ON workspace_members
    FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- 4. Users can update their own membership (simplified)
CREATE POLICY "Users can update their own membership" ON workspace_members
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 5. Workspace owners can remove members
CREATE POLICY "Workspace owners can remove members" ON workspace_members
    FOR DELETE
    USING (
        user_id = auth.uid() OR -- Users can leave
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- Update workspaces policies to be simpler
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;

CREATE POLICY "Users can view their own workspaces" ON workspaces
    FOR SELECT
    USING (
        owner_id = auth.uid() OR
        id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid() AND joined_at IS NOT NULL
        )
    );

-- Ensure the policies are enabled
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;