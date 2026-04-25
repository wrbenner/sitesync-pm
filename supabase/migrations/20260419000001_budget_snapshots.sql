-- Budget Snapshots: persisted point-in-time captures of budget state.
-- Used for period-over-period comparison (monthly, milestone-based, or on-demand).

CREATE TABLE IF NOT EXISTS budget_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  snapshot_date   date NOT NULL DEFAULT CURRENT_DATE,
  total_budget    numeric(14, 2) NOT NULL DEFAULT 0,
  total_spent     numeric(14, 2) NOT NULL DEFAULT 0,
  total_committed numeric(14, 2) NOT NULL DEFAULT 0,
  division_data   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_snapshots_project
  ON budget_snapshots(project_id, snapshot_date DESC);

ALTER TABLE budget_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_snapshots_select ON budget_snapshots;
CREATE POLICY budget_snapshots_select ON budget_snapshots FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS budget_snapshots_insert ON budget_snapshots;
CREATE POLICY budget_snapshots_insert ON budget_snapshots FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS budget_snapshots_delete ON budget_snapshots;
CREATE POLICY budget_snapshots_delete ON budget_snapshots FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));
