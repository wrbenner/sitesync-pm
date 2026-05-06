-- =============================================================================
-- cost_codes tax flags — schema lands; logic deferred
-- =============================================================================
-- Per-state sales/use tax rules on materials are a multi-month business
-- problem (nexus rules vary by state, exemption certificates vary by
-- material class). The schema lands here so cost codes can carry the
-- intent — taxable / exempt / use-tax-applicable. The actual tax engine
-- ships when there's a customer running a real cross-state workflow.
--
-- The columns DO get used today by the WH-347 generator for fringe-vs-
-- straight-time classification on prevailing wage; the tax-specific fields
-- are for the deferred engine.
--
-- Compat note: an earlier migration (20260418000018_job_costing.sql) created
-- `cost_codes` as a project-scoped budget table. This migration extends it
-- additively with org-scoped library columns + tax/labor flags. All new
-- columns are nullable so existing project-scoped rows continue to work.
-- =============================================================================

-- The cost_codes table doesn't exist on every deployment yet. Create a
-- minimal version if missing so the columns have somewhere to live.
CREATE TABLE IF NOT EXISTS cost_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Library / shared columns (additive — older deployments lack these).
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS description     text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS csi_division    text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS parent_code     text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

-- Tax + labor flags (the actual feature additions for this migration).
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS tax_treatment text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS labor_class text;
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS prevailing_wage_required boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cost_codes_tax_treatment_chk'
       AND conrelid = 'public.cost_codes'::regclass
  ) THEN
    ALTER TABLE cost_codes
      ADD CONSTRAINT cost_codes_tax_treatment_chk
      CHECK (tax_treatment IS NULL OR tax_treatment IN ('taxable','exempt','use_tax','manufacturer_exempt','resale_exempt'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cost_codes_labor_class_chk'
       AND conrelid = 'public.cost_codes'::regclass
  ) THEN
    ALTER TABLE cost_codes
      ADD CONSTRAINT cost_codes_labor_class_chk
      CHECK (labor_class IS NULL OR labor_class IN ('skilled_trade','laborer','apprentice','foreman','exempt_supervisor'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cost_codes_code ON cost_codes(code);
CREATE INDEX IF NOT EXISTS idx_cost_codes_org ON cost_codes(organization_id) WHERE organization_id IS NOT NULL;
