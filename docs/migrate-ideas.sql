-- ============================================================
-- Migrate existing ideas → projects table
-- ============================================================
-- Run this AFTER running supabase-schema.sql and creating
-- at least one user account in Supabase Auth.
--
-- Replace 'YOUR_USER_ID' below with Ted's actual auth.users UUID
-- (find it in Supabase Dashboard > Authentication > Users)
-- ============================================================

-- Step 1: Insert ideas as projects
-- Maps the old metadata JSON fields to the new relational columns
INSERT INTO projects (
  name,
  description,
  stage,
  priority,
  category,
  industry,
  client,
  tech_stack,
  created_by,
  created_by_name,
  created_at,
  updated_at
)
SELECT
  i.name,
  i.description,
  -- Map old stage values to new stages
  CASE
    WHEN i.metadata->>'stage' IN ('Draft', 'Submitted') THEN 'Idea'
    WHEN i.metadata->>'stage' = 'Under Review' THEN 'Idea'
    WHEN i.metadata->>'stage' = 'Approved' THEN 'Active'
    WHEN i.metadata->>'stage' = 'In Progress' THEN 'Active'
    WHEN i.metadata->>'stage' = 'Testing / Pilot' THEN 'Active'
    WHEN i.metadata->>'stage' = 'Completed' THEN 'Completed'
    WHEN i.metadata->>'stage' = 'On Hold' THEN 'Paused'
    WHEN i.metadata->>'stage' = 'Discarded' THEN 'Discarded'
    ELSE 'Idea'
  END AS stage,
  -- Map priority
  CASE
    WHEN i.metadata->>'priority' IN ('Low', 'Medium', 'High') THEN i.metadata->>'priority'
    WHEN i.metadata->>'priority' = 'Critical' THEN 'High'
    ELSE NULL
  END AS priority,
  i.metadata->>'category' AS category,
  i.metadata->>'industry' AS industry,
  i.metadata->>'client' AS client,
  '{}' AS tech_stack,
  'YOUR_USER_ID'::UUID AS created_by,
  COALESCE(i.created_by, 'Ted') AS created_by_name,
  i.created_at,
  i.created_at AS updated_at
FROM ideas i
ORDER BY i.created_at;

-- Step 2: Log the initial stage transition for each migrated project
INSERT INTO stage_transitions (project_id, from_stage, to_stage, changed_by_name, created_at)
SELECT
  p.id,
  NULL,
  p.stage,
  'Migration',
  p.created_at
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM stage_transitions st WHERE st.project_id = p.id
);

-- ============================================================
-- After running this:
-- 1. Verify the projects table has your data
-- 2. The old 'ideas' table can be kept as a backup or dropped later
-- ============================================================
