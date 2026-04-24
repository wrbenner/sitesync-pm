-- ═══════════════════════════════════════════════════════════════
-- Migration: crew_checkins
-- Version: 20260424000002
-- Purpose: QR-scan crew check-in log (lighter-weight than
--          site_check_ins — no workforce_members join, supports
--          offline-first writes via useCheckIn / useOfflineMutation).
--          Consumed in src/hooks/useCheckIn.ts useCheckIn().
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crew_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         text NOT NULL,
  location_id     text NOT NULL,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  checked_out_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crew_checkins_project_time
  ON crew_checkins (project_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_crew_checkins_user
  ON crew_checkins (user_id);
CREATE INDEX IF NOT EXISTS idx_crew_checkins_location
  ON crew_checkins (location_id);

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_crew_checkins_updated_at ON crew_checkins;
CREATE TRIGGER trg_crew_checkins_updated_at
  BEFORE UPDATE ON crew_checkins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE crew_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crew_checkins_select ON crew_checkins;
CREATE POLICY crew_checkins_select ON crew_checkins FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS crew_checkins_insert ON crew_checkins;
CREATE POLICY crew_checkins_insert ON crew_checkins FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS crew_checkins_update ON crew_checkins;
CREATE POLICY crew_checkins_update ON crew_checkins FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS crew_checkins_delete ON crew_checkins;
CREATE POLICY crew_checkins_delete ON crew_checkins FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));
