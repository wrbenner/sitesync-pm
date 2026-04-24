-- ═══════════════════════════════════════════════════════════════
-- Migration: prequalifications
-- Version: 20260424000007
-- Purpose: Track subcontractor prequalification status + supporting
--          documentation (bonding capacity, insurance limits, EMR,
--          license numbers). Consumed by /directory — PrequalDetailPanel
--          and the Companies filter bar.
--
-- company_id is a FK to directory_contacts (per scope spec) — the
-- directory contact representing the company. project_id is carried
-- explicitly so RLS can key off project membership without joining.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prequalifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id         uuid NOT NULL REFERENCES directory_contacts(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_review', 'approved', 'rejected', 'expired')),
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  reviewed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at         timestamptz,
  bonding_capacity   text,
  insurance_limits   text,
  emr_rate           numeric(5, 3),
  years_in_business  integer,
  license_numbers    text,
  documents          jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- One active prequal row per (project, company). Re-submissions update
-- the existing row in place so status history lives in audit_trail, not here.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prequalifications_unique_company
  ON prequalifications (project_id, company_id);
CREATE INDEX IF NOT EXISTS idx_prequalifications_status
  ON prequalifications (project_id, status);
CREATE INDEX IF NOT EXISTS idx_prequalifications_expires_at
  ON prequalifications (expires_at) WHERE expires_at IS NOT NULL;

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_prequalifications_updated_at ON prequalifications;
CREATE TRIGGER trg_prequalifications_updated_at
  BEFORE UPDATE ON prequalifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE prequalifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prequalifications_select ON prequalifications;
CREATE POLICY prequalifications_select ON prequalifications FOR SELECT
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS prequalifications_insert ON prequalifications;
CREATE POLICY prequalifications_insert ON prequalifications FOR INSERT
  WITH CHECK (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
  ));

DROP POLICY IF EXISTS prequalifications_update ON prequalifications;
CREATE POLICY prequalifications_update ON prequalifications FOR UPDATE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
  ));

DROP POLICY IF EXISTS prequalifications_delete ON prequalifications;
CREATE POLICY prequalifications_delete ON prequalifications FOR DELETE
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));
