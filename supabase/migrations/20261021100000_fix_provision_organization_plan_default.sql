-- =============================================================================
-- 20261021100000_fix_provision_organization_plan_default.sql
-- P0 production fix: provision_organization() defaulted plan to 'starter', but
-- organizations_plan_check allows only ('free', 'pro', 'enterprise'). Every
-- self-serve signup has been failing 100% with constraint violation.
--
-- Discovered 2026-05-14 by the BRT scale-test harness: 32 of 50 seed attempts
-- failed with `new row for relation "organizations" violates check constraint
-- "organizations_plan_check"`. The constraint was tightened in an earlier
-- migration to remove 'starter' but the RPC body was never updated to match.
--
-- This migration:
--   1. Replaces the v2 idempotent provision_organization() to use 'free'.
--   2. Updates the audit_log metadata plan literal to 'free' so the audit
--      trail accurately records what was inserted.
--
-- Schema-level invariant preserved: the function signature, return type,
-- security model, and idempotency semantics are unchanged. Only the plan
-- literal and one comment change.
-- =============================================================================

CREATE OR REPLACE FUNCTION provision_organization(
  p_name      text,
  p_slug      text,
  p_owner     uuid,
  p_metadata  jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org_id          uuid;
  v_slug            text;
  v_canonical_slug  text;
  v_attempt         int := 0;
  v_user_email      text;
  v_existing_org_id uuid;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'provision_organization: name is required';
  END IF;
  IF p_owner IS NULL THEN
    RAISE EXCEPTION 'provision_organization: owner user id is required';
  END IF;

  v_canonical_slug := lower(regexp_replace(
    coalesce(nullif(trim(p_slug), ''), p_name), '[^a-z0-9]+', '-', 'g'));
  v_canonical_slug := regexp_replace(v_canonical_slug, '^-+|-+$', '', 'g');
  IF length(v_canonical_slug) = 0 THEN
    v_canonical_slug := 'org-' || substring(p_owner::text, 1, 8);
  END IF;

  -- Idempotency: if this owner already owns an org with the canonical slug
  -- prefix, return the existing id rather than creating a duplicate.
  SELECT o.id INTO v_existing_org_id
  FROM organizations o
  JOIN organization_members m ON m.organization_id = o.id AND m.user_id = p_owner AND m.role = 'owner'
  WHERE o.slug LIKE v_canonical_slug || '%'
  ORDER BY o.created_at ASC
  LIMIT 1;
  IF v_existing_org_id IS NOT NULL THEN
    RETURN v_existing_org_id;
  END IF;

  v_slug := v_canonical_slug;
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 50 THEN
      RAISE EXCEPTION 'provision_organization: could not find a free slug after 50 attempts (base: %)', p_slug;
    END IF;
    v_slug := v_canonical_slug || '-' || v_attempt;
  END LOOP;

  -- 'free' matches organizations_plan_check + every existing customer row.
  -- Prior versions used 'starter' which the constraint rejects (P0 fix).
  INSERT INTO organizations (name, slug, plan, settings)
  VALUES (trim(p_name), v_slug, 'free', p_metadata)
  RETURNING id INTO v_org_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_owner, 'owner');

  SELECT email INTO v_user_email FROM auth.users WHERE id = p_owner;

  INSERT INTO audit_log (
    organization_id, user_id, user_email, entity_type, entity_id, action, metadata
  ) VALUES (
    v_org_id, p_owner, v_user_email, 'organization', v_org_id, 'create',
    jsonb_build_object('source', 'self_serve', 'slug', v_slug, 'plan', 'free')
      || coalesce(p_metadata, '{}'::jsonb)
  );

  RETURN v_org_id;
END $fn$;

COMMENT ON FUNCTION provision_organization IS
  'BRT sub-1 §4.1 + 2026-05-14 plan fix: atomic self-serve org provisioning. Defaults plan to ''free'' (matches organizations_plan_check). Returns org id. Idempotent: re-runs by the same owner with the same slug prefix return the existing org id rather than creating duplicates. Slug-collision retry capped at 50.';
