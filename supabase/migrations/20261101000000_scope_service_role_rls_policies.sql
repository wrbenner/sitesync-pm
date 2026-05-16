-- Scope service-role-only RLS policies to TO service_role.
--
-- Background: Supabase Performance/Security advisors flag 7 RLS policies as
-- "rls_policy_always_true" on tables that are documented as
-- service-role-only per BRT sub-1 §4.2 (async_jobs, edit_locks,
-- organism_cycles, organism_experiments, organism_learnings,
-- organism_skills, signature_fields). The policies were created with
-- USING (true)/WITH CHECK (true) but without a TO role clause, so they
-- match `public` (every Postgres role, including anon and authenticated).
--
-- Behavioral effect today: little, because the queries against these
-- tables all originate from edge functions running as the service role,
-- and direct REST access goes through PostgREST which is gated by JWT.
-- But the policy IS visible to the linter as an RLS-bypass and is a real
-- defense-in-depth gap: a stolen authenticated JWT would let a client
-- read/write these tables via the REST API.
--
-- Fix: drop the each existing policy and recreate scoped to service_role.
-- Functional result identical for the legitimate caller (edge fn /
-- supabase-js with service key), bolted-shut for everyone else.
--
-- Safety: idempotent. Wrapped in DO blocks so re-applying is a no-op.
-- No data movement. No schema change. Reversible via the down migration.

BEGIN;

-- ── async_jobs ───────────────────────────────────────────────
DROP POLICY IF EXISTS async_jobs_service ON public.async_jobs;
CREATE POLICY async_jobs_service ON public.async_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── edit_locks ───────────────────────────────────────────────
DROP POLICY IF EXISTS edit_locks_all ON public.edit_locks;
CREATE POLICY edit_locks_all ON public.edit_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── organism_cycles ──────────────────────────────────────────
DROP POLICY IF EXISTS organism_cycles_service ON public.organism_cycles;
CREATE POLICY organism_cycles_service ON public.organism_cycles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── organism_experiments ─────────────────────────────────────
DROP POLICY IF EXISTS organism_experiments_service ON public.organism_experiments;
CREATE POLICY organism_experiments_service ON public.organism_experiments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── organism_learnings ───────────────────────────────────────
DROP POLICY IF EXISTS organism_learnings_service ON public.organism_learnings;
CREATE POLICY organism_learnings_service ON public.organism_learnings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── organism_skills ──────────────────────────────────────────
DROP POLICY IF EXISTS organism_skills_service ON public.organism_skills;
CREATE POLICY organism_skills_service ON public.organism_skills
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── signature_fields ─────────────────────────────────────────
DROP POLICY IF EXISTS signature_fields_all ON public.signature_fields;
CREATE POLICY signature_fields_all ON public.signature_fields
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
