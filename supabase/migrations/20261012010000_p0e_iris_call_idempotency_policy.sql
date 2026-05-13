-- BRT sub-0 Day 1 — P0-E: user-scoped policy for iris_call_idempotency
--
-- The audit flagged `rls_enabled_no_policy` on this table. Verified during
-- Day 0 preflight that the iris-call edge function's idempotency
-- read/write paths (supabase/functions/iris-call/index.ts lines 190 + 218)
-- use the auth-helper-returned client (supabase/functions/shared/auth.ts
-- line 198), which is created with the user's Bearer JWT + ANON KEY and
-- runs as the `authenticated` role.
--
-- With RLS enabled and zero policies, that role sees zero rows on SELECT
-- and is blocked from INSERT/UPDATE. The cache write failure is caught
-- silently (writeIdempotencyCache logs to console.warn and returns —
-- "cache write failures must not turn a successful call into a 500"),
-- so the symptom in production is: every iris-call is a cache miss, and
-- every retry under the same idempotency key results in a duplicate
-- upstream LLM call billed at full rate.
--
-- Fix: a per-user-row policy. Each row already carries `user_id`, so the
-- policy can use the standard `user_id = (SELECT auth.uid())` shape.
-- Wrapping `auth.uid()` in a subquery satisfies the `auth_rls_initplan`
-- performance lint (called once per query instead of once per row),
-- which is the project's standard pattern in recent migrations
-- (see e.g. drawings_*, exports_*, project_files_* on storage.objects).
--
-- The policy uses `FOR ALL` because the function does both SELECT
-- (cache read) and INSERT (cache write); using ALL with both USING and
-- WITH CHECK predicates is more compact than four per-cmd policies and
-- doesn't trigger `multiple_permissive_policies` here (no other policy
-- on this table).
--
-- Service-role access continues to bypass RLS as before (Supabase
-- service-role connections set `request.jwt.claim.role = service_role`
-- which is exempt from RLS). No change needed for any cron/maintenance
-- job that runs cleanup.

CREATE POLICY iris_call_idempotency_own_row
  ON public.iris_call_idempotency
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON POLICY iris_call_idempotency_own_row ON public.iris_call_idempotency IS
  'BRT sub-0 day-1 P0-E. Lets the iris-call edge function read and write '
  'its own idempotency rows under user-JWT context. Service role bypasses '
  'RLS and remains free to clean up expired rows in cron.';
