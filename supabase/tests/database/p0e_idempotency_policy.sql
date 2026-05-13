-- BRT sub-0 Day 1 — P0-E verification: iris_call_idempotency_own_row policy
--
-- Three assertions:
--   1. Policy exists with cmd = ALL.
--   2. Policy USING predicate references user_id and auth.uid().
--   3. Policy WITH CHECK predicate references user_id and auth.uid().
--
-- A functional cross-user test (set request.jwt.claim.sub, attempt to
-- insert a row with a different user_id, expect violation) lives in
-- Day 3's fixture suite where the seed users + JWT switching pattern is
-- already established.

BEGIN;

SET LOCAL search_path = extensions, public;

SELECT plan(3);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'iris_call_idempotency'
      AND policyname = 'iris_call_idempotency_own_row'
      AND cmd = 'ALL'
  ),
  'iris_call_idempotency_own_row policy exists with cmd=ALL'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'iris_call_idempotency'
      AND policyname = 'iris_call_idempotency_own_row'
      AND qual LIKE '%user_id%'
      AND qual LIKE '%auth.uid()%'
  ),
  'iris_call_idempotency_own_row USING references user_id + auth.uid()'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'iris_call_idempotency'
      AND policyname = 'iris_call_idempotency_own_row'
      AND with_check LIKE '%user_id%'
      AND with_check LIKE '%auth.uid()%'
  ),
  'iris_call_idempotency_own_row WITH CHECK references user_id + auth.uid()'
);

SELECT * FROM finish();

ROLLBACK;
