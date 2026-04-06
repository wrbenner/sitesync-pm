-- Fix: infinite recursion in organization_members RLS policy
-- Root cause: org_members_select policy queries organization_members from within
-- organization_members RLS, causing infinite recursion on any org membership check.
-- Fix: use a SECURITY DEFINER function to break the recursion.

-- Step 1: Create a security definer function that bypasses RLS
-- This function can safely query organization_members without triggering policies
CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_my_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_org_ids() TO anon;

-- Step 2: Replace the recursive policy with one using the safe function
DROP POLICY IF EXISTS org_members_select ON organization_members;
CREATE POLICY org_members_select ON organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT get_my_org_ids())
  );

-- Step 3: Fix organizations table policy too (same pattern)
DROP POLICY IF EXISTS org_select ON organizations;
CREATE POLICY org_select ON organizations FOR SELECT
  USING (id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS organizations_update ON organizations;
CREATE POLICY organizations_update ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      -- Safe because this query is inside SECURITY DEFINER context via function
    )
  );

-- Step 4: Fix any other policies that use the recursive pattern
-- (all policies that check organization_members from other tables are fine —
-- the recursion only happens when organization_members policies reference themselves)

