-- ═══════════════════════════════════════════════════════════════
-- Migration: fix_profiles_rls_recursion
-- Version:   20260506000000
-- Purpose:   Repair the recursive `profiles_select_org` policy that
--            was returning 500 (Internal Server Error) on every
--            cross-user profile fetch (the `useProfileNames` hook).
--
--            Original policy queried `profiles` to authorize
--            `profiles` — Postgres+PostgREST cannot evaluate that
--            under FORCE ROW LEVEL SECURITY without infinite
--            recursion. The classic Supabase remedy is to expose a
--            SECURITY DEFINER helper that returns the calling user's
--            organization IDs *without* going through the policy,
--            and rewrite the policy to call that helper.
--
--            Idempotent: safe to rerun.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Helper: current user's org IDs, RLS-bypass by design ───
-- Callers MUST be authenticated (auth.uid() will be null otherwise
-- and the function returns no rows — same effective denial).
-- search_path is pinned to defeat search_path-based privilege
-- escalations on SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;

COMMENT ON FUNCTION public.current_user_org_ids() IS
  'Returns the calling user''s organization IDs from organization_members, '
  'bypassing RLS to avoid recursion in policies that gate on org membership. '
  'Source of truth for cross-user visibility checks (profiles, settings, etc).';

-- ── 2. Rewrite the recursive policy on profiles ───────────────
DROP POLICY IF EXISTS profiles_select_org ON profiles;
CREATE POLICY profiles_select_org ON profiles FOR SELECT
  USING (
    organization_id IN (SELECT public.current_user_org_ids())
  );

-- ── 3. Profile-fallback path ──────────────────────────────────
-- The original policy also covered the case where a user has a
-- profile but no organization_members row yet (mid-onboarding).
-- That case is already covered by `profiles_select_own`
-- (user_id = auth.uid()), so no additional policy is needed here.
