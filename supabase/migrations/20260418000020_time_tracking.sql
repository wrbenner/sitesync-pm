-- Time Tracking
--
-- 00011_agents_workforce_permits.sql already created time_entries anchored
-- to workforce_members (clock_in/out, regular_hours, overtime_hours, etc.).
-- This migration adds the newer per-user columns (user_id, hours, cost_code_id,
-- activity_description, classification, daily_log_id) additively. User_id and
-- hours cannot be NOT NULL when back-filling over legacy rows, so we relax
-- the constraints and guard every index.

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  date date NOT NULL,
  hours numeric(5,2) CHECK (hours IS NULL OR (hours > 0 AND hours <= 24)),
  cost_code_id uuid REFERENCES cost_codes(id) ON DELETE SET NULL,
  activity_description text,
  classification text,
  approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  daily_log_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS hours numeric(5,2);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS cost_code_id uuid REFERENCES cost_codes(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS activity_description text;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS classification text;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS daily_log_id uuid;

-- Backfill hours from regular+overtime+double-time if legacy columns exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='regular_hours')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='hours') THEN
    UPDATE time_entries
    SET hours = COALESCE(regular_hours, 0) + COALESCE(overtime_hours, 0) + COALESCE(double_time_hours, 0)
    WHERE hours IS NULL
      AND (regular_hours IS NOT NULL OR overtime_hours IS NOT NULL OR double_time_hours IS NOT NULL);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='task_description')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='activity_description') THEN
    UPDATE time_entries SET activity_description = task_description
    WHERE activity_description IS NULL AND task_description IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='project_id') THEN
    CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='date') THEN
    CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_entries' AND column_name='cost_code_id') THEN
    CREATE INDEX IF NOT EXISTS idx_time_entries_cost_code ON time_entries(cost_code_id);
  END IF;
END $$;

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS time_entries_select ON time_entries;
CREATE POLICY time_entries_select ON time_entries FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS time_entries_insert ON time_entries;
CREATE POLICY time_entries_insert ON time_entries FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS time_entries_update ON time_entries;
CREATE POLICY time_entries_update ON time_entries FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS time_entries_delete ON time_entries;
CREATE POLICY time_entries_delete ON time_entries FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
