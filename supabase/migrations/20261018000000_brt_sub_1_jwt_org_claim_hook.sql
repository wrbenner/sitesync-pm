-- BRT sub-1 §4.3 — JWT org_id custom claim hook.
--
-- Adds:
--   1. profiles.active_org_id (nullable FK to organizations.id) — the
--      authoritative source-of-truth for the user's currently-active org.
--      Defaults via the auth hook to the user's first owner-role org if
--      this column is null at token-mint time.
--
--   2. custom_access_token_hook(event jsonb) — Supabase auth hook that
--      injects org_id into JWT claims on token mint/refresh. Wired in the
--      Supabase dashboard under Authentication → Hooks → Custom Access
--      Token Hook (or via auth.config).
--
-- Once the dashboard hook is registered, every authenticated request to
-- PostgREST and edge functions carries `org_id` in the JWT, which RLS
-- policies can read via `auth.jwt() ->> 'org_id'`.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_org_id uuid
    REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_org_id
  ON profiles(active_org_id)
  WHERE active_org_id IS NOT NULL;

COMMENT ON COLUMN profiles.active_org_id IS
  'BRT sub-1 §4.3: authoritative active org for this user. Reads/writes via switch-active-org edge fn. JWT org_id claim derives from here.';

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id  uuid;
  v_claims  jsonb;
BEGIN
  v_user_id := (event ->> 'user_id')::uuid;
  v_claims  := event -> 'claims';

  IF v_user_id IS NULL THEN
    RETURN event;
  END IF;

  -- Prefer the explicit active_org_id on profiles; fall back to the user's
  -- first owner-role membership so brand-new accounts also carry a claim.
  SELECT COALESCE(
    p.active_org_id,
    (SELECT om.organization_id
       FROM organization_members om
      WHERE om.user_id = v_user_id
      ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
               om.joined_at NULLS LAST
      LIMIT 1)
  ) INTO v_org_id
  FROM profiles p
  WHERE p.user_id = v_user_id;

  IF v_org_id IS NOT NULL THEN
    v_claims := jsonb_set(COALESCE(v_claims, '{}'::jsonb), '{org_id}', to_jsonb(v_org_id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END $$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'BRT sub-1 §4.3: injects org_id into JWT claims. Register in Supabase dashboard → Authentication → Hooks → Custom Access Token Hook.';

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- The hook runs as supabase_auth_admin, which needs read access to the
-- backing tables. Standard Supabase auth-hook grants:
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.profiles, public.organization_members TO supabase_auth_admin;

-- Helper RPC: switch active org. Called by the switch-active-org edge fn
-- as service_role; also callable by the user directly (RLS-style gate
-- inside the function checks membership before writing).
CREATE OR REPLACE FUNCTION public.set_active_org(p_target_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_is_member boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'set_active_org: not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_target_org_id IS NULL THEN
    RAISE EXCEPTION 'set_active_org: target_org_id is required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM organization_members
     WHERE user_id = v_user_id AND organization_id = p_target_org_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'set_active_org: caller is not a member of org %', p_target_org_id
      USING ERRCODE = '42501';
  END IF;

  UPDATE profiles
     SET active_org_id = p_target_org_id, updated_at = now()
   WHERE user_id = v_user_id;

  RETURN p_target_org_id;
END $$;

COMMENT ON FUNCTION public.set_active_org(uuid) IS
  'BRT sub-1 §4.3: validates membership then writes profiles.active_org_id. Caller must auth.uid()->member. Token must be refreshed after to pick up the new org_id JWT claim.';
REVOKE EXECUTE ON FUNCTION public.set_active_org(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_active_org(uuid) TO authenticated, service_role;
