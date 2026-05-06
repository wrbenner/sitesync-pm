-- =============================================================================
-- Fix infinite-recursion 500 on `profiles_select_org` RLS policy.
--
-- The original policy (introduced in 20260416000002_create_profiles.sql) is:
--
--     CREATE POLICY profiles_select_org ON profiles FOR SELECT
--       USING (
--         organization_id IN (
--           SELECT organization_id FROM profiles WHERE user_id = (select auth.uid())
--         )
--       );
--
-- The inner SELECT FROM profiles re-triggers the same RLS policy, which
-- re-runs the inner SELECT, ad infinitum. Postgres aborts the query and
-- the server returns HTTP 500 to the client. This blew up every profile
-- lookup in the app — including team-avatar bars, presence-bar consumers,
-- and the audit-log user-name resolver — and was visible in the dev
-- console as repeated `GET /rest/v1/profiles?...&user_id=in.(...) 500`.
--
-- The fix introduces a SECURITY DEFINER helper that resolves the
-- caller's organization_id without going back through the policy. Because
-- the function executes as its owner (postgres), the inner SELECT skips
-- RLS entirely. The policy then becomes a single equality check, no
-- subquery, no recursion.
-- =============================================================================

-- 1. Helper function. STABLE so the planner can cache the result within a
-- single query, and SET search_path to a fixed value to neutralise the
-- well-known SECURITY DEFINER + search_path injection class.
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- Restrict execution to the roles that need it. Public callers cannot
-- discover anyone else's org_id through this helper because it only
-- ever returns the row matching auth.uid().
REVOKE ALL ON FUNCTION public.current_user_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_organization_id() TO service_role;

-- 2. Replace the recursive policy with one that calls the helper.
DROP POLICY IF EXISTS profiles_select_org ON profiles;
CREATE POLICY profiles_select_org ON profiles FOR SELECT
  USING (organization_id = public.current_user_organization_id());

-- 3. Sanity guard — re-create the self-row policy too so a fresh schema
-- coming through the migration chain ends up with both policies present.
-- (The original 20260416000002 already creates this; we keep this as a
-- defence-in-depth re-statement without dropping the existing grant.)
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles FOR SELECT
  USING (user_id = (select auth.uid()));

COMMENT ON FUNCTION public.current_user_organization_id() IS
  'Returns the organization_id of the currently authenticated user. SECURITY '
  'DEFINER so it bypasses RLS on profiles, breaking the recursion that the '
  'plain subquery form (`SELECT organization_id FROM profiles WHERE user_id '
  '= auth.uid()`) caused inside the profiles_select_org policy.';
