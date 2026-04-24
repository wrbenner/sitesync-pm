-- ═══════════════════════════════════════════════════════════════
-- Migration: timesheets
-- Version: 20260424000009
-- Purpose: Per-worker, per-day hour tracking against a named activity.
--          Consumed by /time-tracking (super enters daily hours) and
--          productivity rollups on /crews.
--
-- Hours are payroll-impacting — never silently drop errors; hard fail
-- on RLS rejection so the supervisor sees the problem.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS timesheets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  worker_id   uuid NOT NULL REFERENCES workforce_members(id) ON DELETE CASCADE,
  work_date   date NOT NULL,
  hours       numeric(5, 2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  activity    text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheets_project_date
  ON timesheets (project_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_timesheets_worker_date
  ON timesheets (worker_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_timesheets_activity
  ON timesheets (project_id, activity) WHERE activity <> '';

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_timesheets_updated_at ON timesheets;
CREATE TRIGGER trg_timesheets_updated_at
  BEFORE UPDATE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timesheets_select ON timesheets;
CREATE POLICY timesheets_select ON timesheets FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS timesheets_insert ON timesheets;
CREATE POLICY timesheets_insert ON timesheets FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS timesheets_update ON timesheets;
CREATE POLICY timesheets_update ON timesheets FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS timesheets_delete ON timesheets;
CREATE POLICY timesheets_delete ON timesheets FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));
