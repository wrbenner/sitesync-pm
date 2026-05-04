-- ═══════════════════════════════════════════════════════════════
-- Migration: cost_codes (org-scoped cost-code library)
-- Version: 20260502120002
--
-- Stores the cost-code master list per organization, populated from
-- the accounting-system importers. Code is unique within an org so
-- repeat imports overwrite cleanly via UPSERT.
--
-- Compat note: an earlier migration (20260418000018_job_costing.sql)
-- created `cost_codes` as a project-scoped budget table. The columns
-- below are added additively; library rows are distinguished from
-- project-budget rows by `organization_id IS NOT NULL`. The unique
-- (organization_id, code) is enforced via a partial unique index so
-- legacy rows with NULL organization_id don't violate it.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cost_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Library columns (additive). Older project-scoped rows have these as NULL.
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS organization_id    uuid;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS name               text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS division           text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS type               text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS rate               numeric(10,2);
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS source_system      text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS source_external_id text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS is_active          boolean NOT NULL DEFAULT true;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cost_codes_type_chk'
       AND conrelid = 'public.cost_codes'::regclass
  ) THEN
    ALTER TABLE cost_codes
      ADD CONSTRAINT cost_codes_type_chk
      CHECK (type IS NULL OR type IN ('labor','material','equipment','sub','overhead'));
  END IF;
END $$;

-- Partial unique index — applies only to library rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cost_codes_org_code
  ON cost_codes (organization_id, code)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cost_codes_org_active
  ON cost_codes (organization_id, is_active)
  WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cost_codes_org_division
  ON cost_codes (organization_id, division)
  WHERE organization_id IS NOT NULL;

ALTER TABLE cost_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cost_codes_select_org_member ON cost_codes;
CREATE POLICY cost_codes_select_org_member ON cost_codes
  FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cost_codes_insert_org_admin ON cost_codes;
CREATE POLICY cost_codes_insert_org_admin ON cost_codes
  FOR INSERT
  WITH CHECK (
    organization_id IS NULL
    OR organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS cost_codes_update_org_admin ON cost_codes;
CREATE POLICY cost_codes_update_org_admin ON cost_codes
  FOR UPDATE
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS cost_codes_delete_org_admin ON cost_codes;
CREATE POLICY cost_codes_delete_org_admin ON cost_codes
  FOR DELETE
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );
