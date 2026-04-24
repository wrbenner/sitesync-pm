-- ═══════════════════════════════════════════════════════════════
-- Migration: site_check_ins
-- Version: 20260424000001
-- Purpose: Worker check-in/out log for site headcount, late arrivals,
--          and hours on site. Consumed by useHeadcount / useCheckInMutation
--          / useCheckOutMutation in src/hooks/useCheckIn.ts.
--
-- Construction headcount is a legal/OSHA record — never silently
-- drop errors, always hard-fail writes if RLS rejects.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_check_ins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  worker_id     uuid REFERENCES workforce_members(id) ON DELETE SET NULL,
  check_in_at   timestamptz NOT NULL DEFAULT now(),
  check_out_at  timestamptz,
  gps_lat       numeric(9, 6),
  gps_lng       numeric(9, 6),
  method        text NOT NULL DEFAULT 'manual'
    CHECK (method IN ('qr_scan', 'manual', 'geofence')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_check_ins_project_checkin
  ON site_check_ins (project_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_check_ins_worker
  ON site_check_ins (worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_site_check_ins_open
  ON site_check_ins (project_id, check_in_at DESC)
  WHERE check_out_at IS NULL;

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_site_check_ins_updated_at ON site_check_ins;
CREATE TRIGGER trg_site_check_ins_updated_at
  BEFORE UPDATE ON site_check_ins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE site_check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_check_ins_select ON site_check_ins;
CREATE POLICY site_check_ins_select ON site_check_ins FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS site_check_ins_insert ON site_check_ins;
CREATE POLICY site_check_ins_insert ON site_check_ins FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS site_check_ins_update ON site_check_ins;
CREATE POLICY site_check_ins_update ON site_check_ins FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS site_check_ins_delete ON site_check_ins;
CREATE POLICY site_check_ins_delete ON site_check_ins FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));
