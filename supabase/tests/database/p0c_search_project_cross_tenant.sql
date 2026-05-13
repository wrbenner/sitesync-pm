-- BRT sub-0 day-3 P0-C verification: search_project rejects cross-tenant calls.
--
-- The SECURITY DEFINER function bypasses RLS on project_members, so the
-- inline EXISTS check is the only barrier between an authenticated caller
-- and any project's full-text-search results. A user with zero
-- project_members rows (or rows for a different project) must get 42501
-- when calling search_project with an arbitrary project_id.

BEGIN;

SET LOCAL search_path = extensions, public;

SELECT plan(1);

-- Act as a user with no project memberships. The function's EXISTS
-- check against project_members will return false → RAISE EXCEPTION.
SELECT set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
SET LOCAL role authenticated;

SELECT throws_ok(
  $$ SELECT public.search_project('00000000-0000-0000-0000-000000000000'::uuid, 'test', 10) $$,
  '42501',
  NULL,
  'search_project on non-member project raises 42501'
);

SELECT * FROM finish();

ROLLBACK;
