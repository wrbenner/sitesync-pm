-- =============================================================================
-- 20261021000000_bulk_add_team_members.sql
-- BRT scale-test §Track 1c — bulk team membership for role-diverse load.
--
-- Today seed-orgs.ts provisions N orgs each with exactly 1 owner. That makes
-- 500 mock people = 500 owners and zero team workflows can be exercised (Sub
-- responds to PM's RFI; Super approves CO). This RPC accepts a role mix and
-- adds extra members to an existing org.
--
-- Inputs that already exist:
--   * organization_members(organization_id, user_id, role)
--   * auth.users (managed by gotrue; service_role can write via the auth API)
--
-- This RPC does NOT create auth.users — that must happen client-side via
-- supabase.auth.admin.createUser() before calling here, since SQL functions
-- can't safely write to auth.users (gotrue triggers + secret hashing live in
-- the gotrue Go service, not Postgres). Callers pass in pre-created user UUIDs.
-- =============================================================================

CREATE OR REPLACE FUNCTION bulk_add_team_members(
  p_org_id  uuid,
  p_members jsonb -- [{"user_id": "<uuid>", "role": "pm" | "super" | "sub" | "owner" | "architect"}]
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count   int := 0;
  v_member  jsonb;
  v_user_id uuid;
  v_role    text;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'bulk_add_team_members: p_org_id is required';
  END IF;
  IF p_members IS NULL OR jsonb_typeof(p_members) <> 'array' THEN
    RAISE EXCEPTION 'bulk_add_team_members: p_members must be a JSON array';
  END IF;

  -- Sanity: the org must exist and be flagged as a scale-test fixture. Refuse
  -- on real orgs so a mis-pointed service-role key can't corrupt customer data.
  IF NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = p_org_id
      AND (settings->>'scale_test')::boolean IS TRUE
  ) THEN
    RAISE EXCEPTION 'bulk_add_team_members: org % is not a scale_test fixture (refusing to mutate)', p_org_id;
  END IF;

  FOR v_member IN SELECT * FROM jsonb_array_elements(p_members)
  LOOP
    v_user_id := (v_member->>'user_id')::uuid;
    v_role    := coalesce(v_member->>'role', 'pm');

    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Skip if already a member (idempotent re-runs).
    IF EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = p_org_id AND user_id = v_user_id
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (p_org_id, v_user_id, v_role);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END $$;

COMMENT ON FUNCTION bulk_add_team_members IS
  'Scale-test Track 1c: adds N pre-created auth users to an existing scale_test org with a role mix. Refuses on real (non-scale_test) orgs. Idempotent.';

-- Service role only — never callable from the browser. Authenticated users
-- managing real teams should go through the existing add_member edge function.
REVOKE EXECUTE ON FUNCTION bulk_add_team_members(uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION bulk_add_team_members(uuid, jsonb) TO service_role;
