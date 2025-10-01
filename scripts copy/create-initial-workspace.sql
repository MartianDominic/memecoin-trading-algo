-- Create initial workspace for the user after fixing RLS policies
-- Run this after fixing the RLS policies to provide a workspace for the user

-- User ID: 87995dcc-4e40-4eb7-9a75-8250c6f79479 (jdominykas7@gmail.com)

-- Create a default workspace for the user
INSERT INTO workspaces (id, name, description, owner_id, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'Default Workspace',
    'Initial workspace for getting started',
    '87995dcc-4e40-4eb7-9a75-8250c6f79479',
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- Add the user as owner to workspace_members
INSERT INTO workspace_members (
    id,
    workspace_id,
    user_id,
    role,
    joined_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    w.id,
    '87995dcc-4e40-4eb7-9a75-8250c6f79479',
    'owner',
    NOW(),
    NOW(),
    NOW()
FROM workspaces w
WHERE w.owner_id = '87995dcc-4e40-4eb7-9a75-8250c6f79479'
  AND w.name = 'Default Workspace'
ON CONFLICT DO NOTHING;

-- Verify the workspace was created
SELECT
    w.id as workspace_id,
    w.name as workspace_name,
    w.owner_id,
    wm.user_id,
    wm.role,
    wm.joined_at
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE w.owner_id = '87995dcc-4e40-4eb7-9a75-8250c6f79479';