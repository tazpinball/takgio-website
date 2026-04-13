-- ============================================================
-- TAKGIO Project Dashboard — Database Schema
-- ============================================================
-- Run this in the Supabase SQL Editor (supabase.com > your project > SQL Editor)
-- This creates the new relational schema for the project dashboard.
-- ============================================================

-- 1. Projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  stage TEXT DEFAULT 'Idea' CHECK (stage IN ('Idea', 'Building', 'UAT', 'Live', 'Paused', 'Discarded')),
  priority TEXT CHECK (priority IN ('High', 'Medium', 'Low')),
  category TEXT,
  industry TEXT,
  client TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  version TEXT,
  external_links JSONB DEFAULT '[]',
  github_repo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 2. Updates table (activity timeline entries)
CREATE TABLE updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  time_spent TEXT,
  hours NUMERIC DEFAULT NULL,
  tools TEXT[] DEFAULT '{}',
  version TEXT,
  release_notes TEXT,
  update_type TEXT DEFAULT 'manual' CHECK (update_type IN ('manual', 'claude', 'system')),
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tasks table (requests assigned to team members)
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_to_name TEXT,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_by_name TEXT,
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 4. Task responses
CREATE TABLE task_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Stage transitions (automatic log of stage changes)
CREATE TABLE stage_transitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Project follows (users can favorite/follow projects)
CREATE TABLE project_follows (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

-- ============================================================
-- Indexes for common queries
-- ============================================================

CREATE INDEX idx_projects_stage ON projects(stage);
CREATE INDEX idx_projects_priority ON projects(priority);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX idx_updates_project_id ON updates(project_id);
CREATE INDEX idx_updates_created_at ON updates(created_at DESC);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_stage_transitions_project_id ON stage_transitions(project_id);

-- ============================================================
-- Auto-update updated_at on projects when modified
-- ============================================================

CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
-- All authenticated users can read and write all data.
-- This is appropriate for a 3-person team with equal access.
-- The anon role has no access.
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_follows ENABLE ROW LEVEL SECURITY;

-- Projects: authenticated users can do everything
CREATE POLICY "Authenticated users can read projects"
  ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert projects"
  ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update projects"
  ON projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete projects"
  ON projects FOR DELETE TO authenticated USING (true);

-- Updates: authenticated users can do everything
CREATE POLICY "Authenticated users can read updates"
  ON updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert updates"
  ON updates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update updates"
  ON updates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete updates"
  ON updates FOR DELETE TO authenticated USING (true);

-- Tasks: authenticated users can do everything
CREATE POLICY "Authenticated users can read tasks"
  ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tasks"
  ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks"
  ON tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete tasks"
  ON tasks FOR DELETE TO authenticated USING (true);

-- Task responses: authenticated users can do everything
CREATE POLICY "Authenticated users can read task_responses"
  ON task_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert task_responses"
  ON task_responses FOR INSERT TO authenticated WITH CHECK (true);

-- Stage transitions: authenticated users can read and insert
CREATE POLICY "Authenticated users can read stage_transitions"
  ON stage_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stage_transitions"
  ON stage_transitions FOR INSERT TO authenticated WITH CHECK (true);

-- Project follows: authenticated users can manage their own follows
CREATE POLICY "Authenticated users can read project_follows"
  ON project_follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own follows"
  ON project_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own follows"
  ON project_follows FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Create user accounts after running this schema
-- ============================================================
-- Go to Authentication > Users in the Supabase dashboard
-- and create accounts for:
--   1. Ted Takvorian
--   2. Ritchie Takvorian
--   3. Steve Caggiano
-- ============================================================
