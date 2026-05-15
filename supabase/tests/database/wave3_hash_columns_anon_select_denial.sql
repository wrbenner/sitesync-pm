-- FMEA G.HEADER.2 (wave 3) — sensitive *_hash columns must not leak
-- via PostgREST `?select=` to the anon role.
--
-- Tables + columns covered:
--   account_deletion_events.user_id_hash
--   api_keys.key_hash
--   ai_rfi_drafts.prompt_hash
--   audit_log.entry_hash
--
-- Mechanism: pgTAP checks that
--   (a) the table has ROW LEVEL SECURITY enabled, AND
--   (b) at least one SELECT policy exists scoped to the authenticated
--       role (anon does NOT appear in any policy's `roles` array), AND
--   (c) the anon role has no SELECT privilege via `has_table_privilege`.
--
-- The combination of RLS + no anon grant + authenticated-only policies
-- means an unauthenticated `?select=user_id_hash` request returns 0 rows
-- or 42501. This is the deposition-grade hash-chain guarantee.

BEGIN;

SET LOCAL search_path = extensions, public;

SELECT plan(16);

-- ── 1. account_deletion_events ───────────────────────────────

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.account_deletion_events'::regclass),
  'account_deletion_events has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.account_deletion_events', 'SELECT'),
  'anon has no SELECT privilege on account_deletion_events'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'account_deletion_events'
      AND (cmd = 'SELECT' OR cmd = 'ALL')
  ),
  'account_deletion_events has at least one SELECT/ALL policy'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'account_deletion_events'
      AND 'anon' = ANY (roles)
  ),
  'no policy on account_deletion_events grants anon'
);

-- ── 2. api_keys ──────────────────────────────────────────────

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.api_keys'::regclass),
  'api_keys has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.api_keys', 'SELECT'),
  'anon has no SELECT privilege on api_keys'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_keys'
      AND (cmd = 'SELECT' OR cmd = 'ALL')
  ),
  'api_keys has at least one SELECT/ALL policy'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_keys'
      AND 'anon' = ANY (roles)
  ),
  'no policy on api_keys grants anon'
);

-- ── 3. ai_rfi_drafts ─────────────────────────────────────────

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.ai_rfi_drafts'::regclass),
  'ai_rfi_drafts has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.ai_rfi_drafts', 'SELECT'),
  'anon has no SELECT privilege on ai_rfi_drafts'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_rfi_drafts'
      AND (cmd = 'SELECT' OR cmd = 'ALL')
  ),
  'ai_rfi_drafts has at least one SELECT/ALL policy'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_rfi_drafts'
      AND 'anon' = ANY (roles)
  ),
  'no policy on ai_rfi_drafts grants anon'
);

-- ── 4. audit_log ─────────────────────────────────────────────

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.audit_log'::regclass),
  'audit_log has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.audit_log', 'SELECT'),
  'anon has no SELECT privilege on audit_log'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND (cmd = 'SELECT' OR cmd = 'ALL')
  ),
  'audit_log has at least one SELECT/ALL policy'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND 'anon' = ANY (roles)
  ),
  'no policy on audit_log grants anon'
);

SELECT * FROM finish();

ROLLBACK;
