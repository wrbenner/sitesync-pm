-- BRT sub-0 Day 1 — P1-D verification: verify_audit_chain EXECUTE revoked
--
-- The function is the deposition-grade hash-chain verifier. Anon and
-- authenticated callers must NOT be able to execute it (it bypasses RLS
-- on audit_log and returns the full audit content). Service role retains
-- access for the offline integrity-check cron.

BEGIN;

SET LOCAL search_path = extensions, public;

SELECT plan(3);

SELECT ok(
  NOT has_function_privilege('anon', 'public.verify_audit_chain()', 'EXECUTE'),
  'anon cannot EXECUTE verify_audit_chain'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.verify_audit_chain()', 'EXECUTE'),
  'authenticated cannot EXECUTE verify_audit_chain'
);

SELECT ok(
  has_function_privilege('service_role', 'public.verify_audit_chain()', 'EXECUTE'),
  'service_role retains EXECUTE on verify_audit_chain'
);

SELECT * FROM finish();

ROLLBACK;
