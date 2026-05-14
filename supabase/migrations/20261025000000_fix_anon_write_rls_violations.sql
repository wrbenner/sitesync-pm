-- =============================================================================
-- 20261025000000_fix_anon_write_rls_violations.sql
--
-- Fixes 5 anon-write RLS violations discovered by B.5 RLS role-matrix codegen
-- (PR #570) on staging `nrsbvqkpxxlonvkmcmxf`. Tracking: Issue #572.
--
-- Violations:
--   1. public.account_deletion_events — anon can UPDATE
--   2. public.account_deletion_events — anon can DELETE
--   3. public.activity_feed           — anon can UPDATE
--   4. public.agent_tasks             — anon can UPDATE
--   5. public.ai_agent_actions        — anon can UPDATE
--
-- Root cause:
--   Supabase's default `anon` role gets table-level INSERT/UPDATE/DELETE grants
--   on every new public table. RLS is enabled on all four tables, but the
--   probe's classifier (B.5 spec) sees PostgREST return 200 OK with zero rows
--   when an anon UPDATE/DELETE with an impossible-id filter is sent — the
--   policy denies row visibility, so no rows are mutated, but no error is
--   raised either. The probe correctly flags this as 'allow' because it's
--   indistinguishable from a real allow at the API level.
--
-- Fix (Approach A — REVOKE direct grants):
--   REVOKE INSERT, UPDATE, DELETE on each table FROM anon. This forces
--   PostgREST to return a 42501 `permission denied for table` error BEFORE
--   RLS is evaluated, which the probe classifies as 'deny'. `authenticated`
--   role retains its grants — RLS policies continue to govern row-level
--   access for logged-in users. service_role bypasses this entirely.
--
-- Why REVOKE over restrictive RLS policy:
--   - Matches codebase pattern (see 20261013010000_p0a_matview_revoke_direct.sql
--     for the same pattern on matviews; function-level REVOKE FROM anon is
--     used throughout the migration tree).
--   - Surfaces the violation at the grant gate (cheapest, clearest error).
--   - Doesn't require adding/maintaining an additional RESTRICTIVE policy
--     on top of the existing PERMISSIVE policy stack.
--   - Reversible: `GRANT INSERT, UPDATE, DELETE ON <table> TO anon` if ever
--     needed (none of these four tables have a documented anon-write path).
--
-- Why include INSERT in the REVOKE (probe only flagged UPDATE/DELETE):
--   Defense in depth. None of these tables have a legitimate anon-INSERT
--   path either. account_deletion_events writes happen via service_role
--   inside the account-deletion edge function. activity_feed / agent_tasks /
--   ai_agent_actions are written by authenticated user sessions and
--   server-side triggers. Leaving INSERT grants in place would only re-open
--   the same class of violation for the INSERT cells (which the probe didn't
--   classify as 'allow' only because PG rejected the empty-payload INSERT
--   for missing-NOT-NULL columns — a less reliable defense).
-- =============================================================================

-- 1. account_deletion_events — service_role only; never end-user writable.
REVOKE INSERT, UPDATE, DELETE ON public.account_deletion_events FROM anon;

-- 2. activity_feed — authenticated users only (gated by project membership
--    via existing PERMISSIVE policies + is_project_org_writable RESTRICTIVE
--    policy from BRT sub-4 §4.6 sweep).
REVOKE INSERT, UPDATE, DELETE ON public.activity_feed FROM anon;

-- 3. agent_tasks — owner-of-task (auth.uid()) or project admin; never anon.
REVOKE INSERT, UPDATE, DELETE ON public.agent_tasks FROM anon;

-- 4. ai_agent_actions — project members only; never anon.
REVOKE INSERT, UPDATE, DELETE ON public.ai_agent_actions FROM anon;

-- ── Verification ─────────────────────────────────────────────────────────
-- The B.5 generated spec's anon UPDATE/DELETE probes should now classify
-- as 'deny' (PostgREST returns 42501 → matches /^42/ in classify()). The
-- spec file is not modified by this migration; only the database state.
--
-- Manual smoke (run as anon JWT against staging or prod):
--   UPDATE account_deletion_events SET reason='x' WHERE id='00000000-0000-0000-0000-000000000000';
--   → ERROR: 42501: permission denied for table account_deletion_events
--
-- Coverage check:
--   SELECT table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema='public'
--     AND table_name IN ('account_deletion_events','activity_feed','agent_tasks','ai_agent_actions')
--     AND grantee='anon'
--     AND privilege_type IN ('INSERT','UPDATE','DELETE');
--   → 0 rows (post-migration).
