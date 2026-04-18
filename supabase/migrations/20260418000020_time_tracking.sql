-- Time Tracking
-- Per-worker labor hours linked to cost codes for Davis-Bacon compliance.

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  date date NOT NULL,
  hours numeric(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  cost_code_id uuid REFERENCES cost_codes(id) ON DELETE SET NULL,
  activity_description text,
  classification text,
  approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  daily_log_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_cost_code ON time_entries(cost_code_id);

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
