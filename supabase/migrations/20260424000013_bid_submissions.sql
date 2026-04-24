-- ═══════════════════════════════════════════════════════════════
-- Migration: bid_submissions
-- Version: 20260424000013
-- Purpose: Vendor bids submitted against bid_packages. Surfaced in
--          the Estimating page Submissions tab for vendor leveling
--          + the "Award" action which sets status='awarded' and
--          stamps awarded_at.
--
-- RLS: bid_submissions inherits the project context of its parent
-- bid_package — checks `project_members` on the package's project.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bid_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_package_id  uuid NOT NULL REFERENCES bid_packages(id) ON DELETE CASCADE,
  vendor_id       uuid REFERENCES vendors(id) ON DELETE SET NULL,
  amount          numeric(18, 2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'shortlisted', 'awarded', 'declined')),
  submitted_at    timestamptz,
  awarded_at      timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bid_submissions_package
  ON bid_submissions (bid_package_id);
CREATE INDEX IF NOT EXISTS idx_bid_submissions_vendor
  ON bid_submissions (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bid_submissions_status
  ON bid_submissions (bid_package_id, status);

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_bid_submissions_updated_at ON bid_submissions;
CREATE TRIGGER trg_bid_submissions_updated_at
  BEFORE UPDATE ON bid_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE bid_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bid_submissions_select ON bid_submissions;
CREATE POLICY bid_submissions_select ON bid_submissions FOR SELECT
  USING (bid_package_id IN (
    SELECT bp.id FROM bid_packages bp
    WHERE bp.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS bid_submissions_insert ON bid_submissions;
CREATE POLICY bid_submissions_insert ON bid_submissions FOR INSERT
  WITH CHECK (bid_package_id IN (
    SELECT bp.id FROM bid_packages bp
    WHERE bp.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS bid_submissions_update ON bid_submissions;
CREATE POLICY bid_submissions_update ON bid_submissions FOR UPDATE
  USING (bid_package_id IN (
    SELECT bp.id FROM bid_packages bp
    WHERE bp.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS bid_submissions_delete ON bid_submissions;
CREATE POLICY bid_submissions_delete ON bid_submissions FOR DELETE
  USING (bid_package_id IN (
    SELECT bp.id FROM bid_packages bp
    WHERE bp.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  ));
