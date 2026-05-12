-- =============================================================================
-- 20261009000000_provision_organization.sql
-- BRT subsystem 1 §4.1 — atomic org provisioning for self-serve signup.
--
-- Replaces the ad-hoc client-side flow in `src/lib/ensureOrganizationMembership.ts`
-- (org insert → membership insert → no audit trail, no atomicity, no slug retry).
--
-- All three steps now live in a single SECURITY DEFINER function so a partial
-- failure rolls back the whole provision. Slug collisions resolve with -2/-3
-- suffixes (capped at 50 attempts to avoid infinite loops on misconfigured input).
--
-- Audit-log entry is written with metadata.source = 'self_serve' so we can later
-- distinguish self-serve orgs from invite-provisioned and pilot orgs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- provision_organization()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION provision_organization(
  p_name      text,
  p_slug      text,
  p_owner     uuid,
  p_metadata  jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    uuid;
  v_slug      text;
  v_attempt   int := 0;
  v_user_meta record;
BEGIN
  -- Validate inputs
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'provision_organization: name is required';
  END IF;
  IF p_owner IS NULL THEN
    RAISE EXCEPTION 'provision_organization: owner user id is required';
  END IF;

  -- Normalize the slug: lowercase, kebab-case, fall back to name-derived slug
  v_slug := lower(regexp_replace(coalesce(nullif(trim(p_slug), ''), p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '^-+|-+$', '', 'g');
  IF length(v_slug) = 0 THEN
    v_slug := 'org-' || substring(p_owner::text, 1, 8);
  END IF;

  -- Slug collision retry — cap at 50 attempts, then error out so caller can prompt user.
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 50 THEN
      RAISE EXCEPTION 'provision_organization: could not find a free slug after 50 attempts (base: %)', p_slug;
    END IF;
    v_slug := lower(regexp_replace(coalesce(nullif(trim(p_slug), ''), p_name), '[^a-z0-9]+', '-', 'g')) || '-' || v_attempt;
  END LOOP;

  -- Create the org
  INSERT INTO organizations (name, slug, plan, settings)
  VALUES (trim(p_name), v_slug, 'starter', p_metadata)
  RETURNING id INTO v_org_id;

  -- Owner membership
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_owner, 'owner');

  -- Pull denormalized user metadata for the audit row (best-effort; never fatal).
  SELECT email INTO v_user_meta
  FROM auth.users
  WHERE id = p_owner;

  -- Audit-log entry — `entity_id = v_org_id` so the org's own audit trail
  -- starts with its creation event. project_id is null because the org isn't
  -- yet bound to a project.
  INSERT INTO audit_log (
    organization_id,
    user_id,
    user_email,
    entity_type,
    entity_id,
    action,
    metadata
  ) VALUES (
    v_org_id,
    p_owner,
    v_user_meta.email,
    'organization',
    v_org_id,
    'create',
    jsonb_build_object('source', 'self_serve', 'slug', v_slug, 'plan', 'starter')
      || coalesce(p_metadata, '{}'::jsonb)
  );

  RETURN v_org_id;
END $$;

COMMENT ON FUNCTION provision_organization IS
  'BRT sub-1 §4.1: atomic self-serve org provisioning. Returns the new org id. Slug-collision retry capped at 50.';

-- ---------------------------------------------------------------------------
-- verify_membership() — helper for edge functions to assert that a calling
-- user belongs to the org owning a given resource. Returns true / false; never
-- raises (callers map false to 403).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_membership(
  p_user_id uuid,
  p_org_id  uuid
) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = p_user_id AND organization_id = p_org_id
  );
$$;

COMMENT ON FUNCTION verify_membership IS
  'BRT sub-1 §4.2: edge-function helper. Returns true if user belongs to org. Never raises.';

-- ---------------------------------------------------------------------------
-- Permissions: anon never invokes; authenticated needs both.
-- SECURITY DEFINER means the function runs as the migration owner, so we
-- explicitly grant EXECUTE only to authenticated. Anonymous signup callers
-- must go through an edge function with the service role key, not direct RPC.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION provision_organization(text, text, uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION provision_organization(text, text, uuid, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION verify_membership(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION verify_membership(uuid, uuid) TO authenticated, service_role;
