-- ═══════════════════════════════════════════════════════════════
-- Migration: estimate_rollups
-- Version: 20260424000012
-- Purpose: Per-division rolling estimate snapshots used by the
--          Estimating page Rollups tab. Variance vs. budget is
--          computed in the UI by joining against budget_items.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS estimate_rollups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  division         text NOT NULL,
  total_estimated  numeric(18, 2) NOT NULL DEFAULT 0,
  total_committed  numeric(18, 2) NOT NULL DEFAULT 0,
  as_of            date NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estimate_rollups_unique_division_asof
    UNIQUE (project_id, division, as_of)
);

CREATE INDEX IF NOT EXISTS idx_estimate_rollups_project_asof
  ON estimate_rollups (project_id, as_of DESC);
CREATE INDEX IF NOT EXISTS idx_estimate_rollups_division
  ON estimate_rollups (project_id, division);

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_estimate_rollups_updated_at ON estimate_rollups;
CREATE TRIGGER trg_estimate_rollups_updated_at
  BEFORE UPDATE ON estimate_rollups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE estimate_rollups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estimate_rollups_select ON estimate_rollups;
CREATE POLICY estimate_rollups_select ON estimate_rollups FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS estimate_rollups_insert ON estimate_rollups;
CREATE POLICY estimate_rollups_insert ON estimate_rollups FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS estimate_rollups_update ON estimate_rollups;
CREATE POLICY estimate_rollups_update ON estimate_rollups FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS estimate_rollups_delete ON estimate_rollups;
CREATE POLICY estimate_rollups_delete ON estimate_rollups FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));
