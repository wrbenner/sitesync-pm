-- ═══════════════════════════════════════════════════════════════
-- Migration: crew_schedules
-- Version: 20260424000010
-- Purpose: Planned crew assignments to schedule activities (phases).
--          Consumed by /crews (PM drags a crew onto a phase) and the
--          productivity dashboard (hours-on-phase / phase_progress_pct).
--
-- phase_id is nullable so a crew can be scheduled without being bound
-- to a specific phase yet (PM is sketching the week). project_id is
-- always required to keep rows scoped for RLS.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crew_schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id    uuid REFERENCES schedule_phases(id) ON DELETE SET NULL,
  crew_name   text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  headcount   integer NOT NULL DEFAULT 1 CHECK (headcount >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_crew_schedules_project_start
  ON crew_schedules (project_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_crew_schedules_phase
  ON crew_schedules (phase_id) WHERE phase_id IS NOT NULL;

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_crew_schedules_updated_at ON crew_schedules;
CREATE TRIGGER trg_crew_schedules_updated_at
  BEFORE UPDATE ON crew_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE crew_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crew_schedules_select ON crew_schedules;
CREATE POLICY crew_schedules_select ON crew_schedules FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS crew_schedules_insert ON crew_schedules;
CREATE POLICY crew_schedules_insert ON crew_schedules FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS crew_schedules_update ON crew_schedules;
CREATE POLICY crew_schedules_update ON crew_schedules FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS crew_schedules_delete ON crew_schedules;
CREATE POLICY crew_schedules_delete ON crew_schedules FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));
