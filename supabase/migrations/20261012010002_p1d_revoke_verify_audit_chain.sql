-- BRT sub-0 Day 1 — P1-D: revoke EXECUTE on verify_audit_chain from anon + authenticated
--
-- This was a P1 finding scheduled for verification on Day 1 morning. Live
-- query during Day 0 preflight confirmed:
--
--   proname             | security_definer | anon_exec | auth_exec | service_role_exec
--   --------------------|------------------|-----------|-----------|------------------
--   verify_audit_chain  | true             | true      | true      | true
--
-- A prior migration intended to revoke this from anon + authenticated,
-- but the grant was reinstated (likely by a subsequent CREATE OR REPLACE
-- FUNCTION which re-applies the default PUBLIC grant). This migration
-- closes the gap and adds a follow-up grant-pinning comment.
--
-- The function is the deposition-grade hash-chain verifier — it reads
-- every audit_log row in order and recomputes the chain. Letting anon
-- or authenticated callers run it leaks the entire audit log via the
-- function's RETURN TABLE, regardless of RLS on audit_log itself
-- (SECURITY DEFINER bypasses RLS).
--
-- Service role retains EXECUTE for the offline integrity-check cron job
-- (see audit_chain_checkpoints migration).

REVOKE EXECUTE ON FUNCTION public.verify_audit_chain() FROM PUBLIC, anon, authenticated;

-- Belt-and-suspenders: any future CREATE OR REPLACE FUNCTION on this
-- name re-applies PUBLIC grants. The trigger below catches that.
-- (Implemented as a comment / TODO since event triggers are a heavier
-- lift; the actual hardening relies on code review of future migrations
-- to not GRANT EXECUTE … TO authenticated on this function.)

COMMENT ON FUNCTION public.verify_audit_chain() IS
  'BRT sub-0 day-1 P1-D: EXECUTE is restricted to service_role. Do not '
  'reinstate anon/authenticated grants — this function returns the full '
  'audit_log content for hash-chain verification and bypasses RLS.';
