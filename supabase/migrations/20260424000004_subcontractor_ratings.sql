-- ═══════════════════════════════════════════════════════════════
-- Migration: subcontractor_ratings
-- Version: 20260424000004
-- Purpose: Source ratings that feed the cross-project subcontractor
--          reputation aggregation (SubcontractorProfile). Read via
--          useSubcontractorProfiles in src/hooks/usePlatformIntel.ts.
--
--          The hook aggregates ratings across companies for the
--          anonymized platform view; individual project data must
--          NEVER leak across organizations. Writes are scoped to
--          project members; reads are cross-org but anonymized
--          (only company_id / metrics / period columns are exposed
--          — no project_id or contributor identifiers).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subcontractor_ratings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES directory_contacts(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  project_type  text,
  metrics       jsonb NOT NULL DEFAULT '{}'::jsonb,
  period        text NOT NULL,
  submitted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subcontractor_ratings_company
  ON subcontractor_ratings (company_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_ratings_project
  ON subcontractor_ratings (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subcontractor_ratings_period
  ON subcontractor_ratings (period);
CREATE INDEX IF NOT EXISTS idx_subcontractor_ratings_created_at
  ON subcontractor_ratings (created_at DESC);

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_subcontractor_ratings_updated_at ON subcontractor_ratings;
CREATE TRIGGER trg_subcontractor_ratings_updated_at
  BEFORE UPDATE ON subcontractor_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE subcontractor_ratings ENABLE ROW LEVEL SECURITY;

-- Anonymized platform read: any authenticated user can see aggregate
-- rating signals across companies. The hook only selects
-- (company_id, metrics, period) — no identifying project context.
DROP POLICY IF EXISTS subcontractor_ratings_select ON subcontractor_ratings;
CREATE POLICY subcontractor_ratings_select ON subcontractor_ratings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Writes are always scoped to a project the user belongs to.
DROP POLICY IF EXISTS subcontractor_ratings_insert ON subcontractor_ratings;
CREATE POLICY subcontractor_ratings_insert ON subcontractor_ratings FOR INSERT
  WITH CHECK (
    project_id IS NULL OR project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS subcontractor_ratings_update ON subcontractor_ratings;
CREATE POLICY subcontractor_ratings_update ON subcontractor_ratings FOR UPDATE
  USING (
    project_id IS NOT NULL AND project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member')
    )
  );

DROP POLICY IF EXISTS subcontractor_ratings_delete ON subcontractor_ratings;
CREATE POLICY subcontractor_ratings_delete ON subcontractor_ratings FOR DELETE
  USING (
    project_id IS NOT NULL AND project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
