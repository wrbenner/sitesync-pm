-- BRT sub-1 §4.1 — provision_organization v2 + seed_role_catalogue.
-- Closes the gaps in 20261009000000:
--   1. (canonical_slug, owner) idempotency — same-args retries return existing org_id
--   2. seed_role_catalogue() seeds 6 canonical roles × 32 permissions
--      inside the same SECURITY DEFINER transaction

CREATE OR REPLACE FUNCTION seed_role_catalogue(p_org_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM org_custom_roles WHERE organization_id = p_org_id) THEN
    RETURN 0;
  END IF;
  INSERT INTO org_custom_roles (organization_id, name, description, permissions, is_active)
  VALUES
    (p_org_id, 'owner',
     'Full organization control. Billing, SSO, member management, all project data.',
     ARRAY['projects.create','projects.read','projects.update','projects.delete',
           'rfis.create','rfis.read','rfis.update','rfis.delete',
           'submittals.create','submittals.read','submittals.update','submittals.delete',
           'daily_logs.create','daily_logs.read','daily_logs.update','daily_logs.delete',
           'documents.create','documents.read','documents.update','documents.delete',
           'punch_items.create','punch_items.read','punch_items.update','punch_items.delete',
           'budget.create','budget.read','budget.update','budget.delete',
           'members.create','members.read','members.update','members.delete'], true),
    (p_org_id, 'admin',
     'Org-wide admin. Same as owner minus billing/SSO config (those are owner-only).',
     ARRAY['projects.create','projects.read','projects.update','projects.delete',
           'rfis.create','rfis.read','rfis.update','rfis.delete',
           'submittals.create','submittals.read','submittals.update','submittals.delete',
           'daily_logs.create','daily_logs.read','daily_logs.update','daily_logs.delete',
           'documents.create','documents.read','documents.update','documents.delete',
           'punch_items.create','punch_items.read','punch_items.update','punch_items.delete',
           'budget.create','budget.read','budget.update','budget.delete',
           'members.create','members.read','members.update','members.delete'], true),
    (p_org_id, 'project_manager',
     'Project-scoped admin. Manages day-to-day work on assigned projects.',
     ARRAY['projects.read','projects.update',
           'rfis.create','rfis.read','rfis.update','rfis.delete',
           'submittals.create','submittals.read','submittals.update','submittals.delete',
           'daily_logs.create','daily_logs.read','daily_logs.update','daily_logs.delete',
           'documents.create','documents.read','documents.update','documents.delete',
           'punch_items.create','punch_items.read','punch_items.update','punch_items.delete',
           'budget.read','budget.update','members.read'], true),
    (p_org_id, 'superintendent',
     'Field-focused. Daily logs, RFIs, punch items, schedule. No financial.',
     ARRAY['projects.read',
           'rfis.create','rfis.read','rfis.update',
           'submittals.read','submittals.update',
           'daily_logs.create','daily_logs.read','daily_logs.update',
           'documents.read','documents.update',
           'punch_items.create','punch_items.read','punch_items.update',
           'members.read'], true),
    (p_org_id, 'subcontractor',
     'External sub. Responds to own submittals + RFIs; uploads documents; updates own punch items.',
     ARRAY['projects.read',
           'rfis.read','rfis.update',
           'submittals.read','submittals.update',
           'documents.read','documents.create',
           'punch_items.read','punch_items.update'], true),
    (p_org_id, 'viewer',
     'Read-only across the project. No mutation anywhere.',
     ARRAY['projects.read','rfis.read','submittals.read','daily_logs.read',
           'documents.read','punch_items.read','budget.read'], true);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

COMMENT ON FUNCTION seed_role_catalogue(uuid) IS
  'BRT sub-1 §4.1: seeds 6 canonical roles (owner, admin, project_manager, superintendent, subcontractor, viewer). Idempotent.';
REVOKE EXECUTE ON FUNCTION seed_role_catalogue(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION seed_role_catalogue(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION provision_organization(
  p_name text, p_slug text, p_owner uuid, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_existing_org uuid;
  v_canonical_slug text;
  v_slug text;
  v_attempt int := 0;
  v_user_email text;
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

  -- §4.1 idempotency: same (canonical_slug, owner) → return existing org_id.
  SELECT o.id INTO v_existing_org
    FROM organizations o
    JOIN organization_members m ON m.organization_id = o.id AND m.user_id = p_owner AND m.role = 'owner'
   WHERE o.slug = v_canonical_slug
   LIMIT 1;
  IF v_existing_org IS NOT NULL THEN
    RETURN v_existing_org;
  END IF;

  v_slug := v_canonical_slug;
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 50 THEN
      RAISE EXCEPTION 'provision_organization: could not find a free slug after 50 attempts (base: %)', p_slug;
    END IF;
    v_slug := v_canonical_slug || '-' || v_attempt;
  END LOOP;

  INSERT INTO organizations (name, slug, plan, settings)
  VALUES (trim(p_name), v_slug, 'starter', p_metadata)
  RETURNING id INTO v_org_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_owner, 'owner');

  PERFORM seed_role_catalogue(v_org_id);

  SELECT email INTO v_user_email FROM auth.users WHERE id = p_owner;
  INSERT INTO audit_log (organization_id, user_id, user_email, entity_type, entity_id, action, metadata)
  VALUES (v_org_id, p_owner, v_user_email, 'organization', v_org_id, 'create',
    jsonb_build_object('source', 'self_serve', 'slug', v_slug, 'plan', 'starter')
      || coalesce(p_metadata, '{}'::jsonb));

  RETURN v_org_id;
END $$;

COMMENT ON FUNCTION provision_organization(text, text, uuid, jsonb) IS
  'BRT sub-1 §4.1 v2: idempotent on (canonical_slug, owner). Slug-retry up to 50 for different-owner conflicts. Owner + role catalogue + audit log in single SECURITY DEFINER transaction.';
REVOKE EXECUTE ON FUNCTION provision_organization(text, text, uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION provision_organization(text, text, uuid, jsonb) TO authenticated, service_role;
