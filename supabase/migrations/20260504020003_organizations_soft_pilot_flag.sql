-- organizations.is_soft_pilot — flag to scope Lap 2 features to the
-- soft-pilot tenant only.
--
-- Load-bearing for:
--   * SCHEDULED_INSIGHTS_SPEC — heartbeat fans out to is_soft_pilot=TRUE orgs only
--   * LAP_2_ACCEPTANCE_GATE_SPEC — gate metrics scope by pilot org
--   * SOFT_PILOT_PLAYBOOK — pilot agreement workflow flips the flag
--
-- Per ADR-006 (inline in SOFT_PILOT_PLAYBOOK): soft pilot uses
-- row-level multi-tenancy on the existing Supabase project, NOT a
-- separate project. The flag is the row-level discriminator.
--
-- The flag defaults to FALSE — no behavior changes for existing orgs
-- until Walker explicitly flips an org via the playbook's procedure.

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_soft_pilot boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS soft_pilot_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS soft_pilot_agreement_signed_at timestamptz;

COMMENT ON COLUMN public.organizations.is_soft_pilot IS
  'TRUE = this org is in Lap 2 soft pilot. Drives scheduled-insights fan-out + gate metrics scope.';
COMMENT ON COLUMN public.organizations.soft_pilot_started_at IS
  'When the pilot kicked off. Used as the gate window start when the placeholder slug is replaced.';
COMMENT ON COLUMN public.organizations.soft_pilot_agreement_signed_at IS
  'When the pilot org countersigned the agreement (telemetry/data-handling clauses). NULL until signed.';

-- Index for the heartbeat fan-out predicate. Partial — most orgs are not pilots.
CREATE INDEX IF NOT EXISTS idx_organizations_soft_pilot
  ON public.organizations (id)
  WHERE is_soft_pilot = TRUE;

COMMIT;
