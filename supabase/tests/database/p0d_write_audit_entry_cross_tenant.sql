-- BRT sub-0 day-3 P0-D verification: write_audit_entry rejects cross-tenant calls.
--
-- Pre-fix, any authenticated caller could forge audit entries for projects
-- they aren't a member of. Post-fix, the inline EXISTS gate on project_members
-- causes 42501 before the INSERT lands.

BEGIN;

SET LOCAL search_path = extensions, public;

SELECT plan(1);

-- Act as a user with no project memberships.
SELECT set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
SET LOCAL role authenticated;

SELECT throws_ok(
  $$ SELECT public.write_audit_entry(
       '00000000-0000-0000-0000-000000000000'::uuid,
       'test_action',
       'test_entity',
       NULL, NULL, NULL, NULL
     ) $$,
  '42501',
  NULL,
  'write_audit_entry on non-member project raises 42501'
);

SELECT * FROM finish();

ROLLBACK;
