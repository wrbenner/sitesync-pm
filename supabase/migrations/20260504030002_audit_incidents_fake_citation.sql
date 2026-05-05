-- Add 'fake_citation' to the audit_incidents.category CHECK list.
--
-- IRIS_CITATIONS_SPEC § Phase 3 mandates an audit_incidents row at
-- severity='medium', category='fake_citation' for every draft rejected
-- because its citation snippet doesn't substring-match the source.
--
-- This migration extends the original CHECK in
-- 20260504010001_audit_incidents.sql without dropping/recreating the
-- table. Postgres requires us to drop and recreate the constraint.

BEGIN;

ALTER TABLE public.audit_incidents
  DROP CONSTRAINT IF EXISTS audit_incidents_category_check;

ALTER TABLE public.audit_incidents
  ADD CONSTRAINT audit_incidents_category_check
  CHECK (category IN (
    'chain_break',
    'rls_leak',
    'unauthorized_decision',
    'ghost_approval',
    'key_leak',
    'webhook_replay',
    'rate_limit_breach',
    'fake_citation',         -- NEW (IRIS_CITATIONS_SPEC)
    'budget_exceeded',       -- NEW (SCHEDULED_INSIGHTS_SPEC § Phase 5)
    'other'
  ));

COMMIT;
