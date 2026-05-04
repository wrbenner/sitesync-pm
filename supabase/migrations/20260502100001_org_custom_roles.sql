-- ═══════════════════════════════════════════════════════════════
-- Migration: org_custom_roles + assignments
-- Version: 20260502100001
--
-- Purpose: lets Org Admins define custom roles with arbitrary subsets
-- of permissions. Built-in roles (owner, admin, pm, …) stay; custom
-- roles supplement them.
--
-- Permission checks (RLS + the SPA usePermissions hook) read the
-- effective permission set as: built_in_role_perms ∪ custom_role_perms.
-- Per-project overrides come from a separate migration so a single
-- user can be 'pm' org-wide and 'viewer' on a single job.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_custom_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Display name. Lowercased + slug-friendly version is generated
  -- automatically; we keep the human-readable name here.
  name            text NOT NULL,
  description     text,
  -- Permission identifiers (matches the Permission union in
  -- src/hooks/usePermissions.ts). Validated client + server side.
  -- We store as text[] not as a separate join table because the set
  -- is small and frequently queried.
  permissions     text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- Inherits-from a built-in role. NULL = no inheritance, just
  -- whatever's listed in `permissions`. Useful when admins want
  -- "PM but with org.billing".
  inherits_from   text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  -- Org-scoped uniqueness on (org, name) so the admin UI's "rename"
  -- collisions surface immediately.
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_custom_roles_org
  ON org_custom_roles (organization_id, is_active);

-- Assignments: which users hold which custom role. A user can hold
-- multiple custom roles simultaneously (additive permissions).
CREATE TABLE IF NOT EXISTS org_custom_role_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  custom_role_id  uuid NOT NULL REFERENCES org_custom_roles(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  granted_by      uuid REFERENCES auth.users(id),
  UNIQUE (custom_role_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_custom_role_assignments_user
  ON org_custom_role_assignments (user_id, organization_id);

ALTER TABLE org_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_custom_role_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_custom_roles_admin_rw') THEN
    CREATE POLICY org_custom_roles_admin_rw ON org_custom_roles
      FOR ALL
      USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ))
      WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
  -- Members of the org can READ custom roles (so the UI can render
  -- a user's effective permissions); only admins can mutate.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_custom_roles_member_read') THEN
    CREATE POLICY org_custom_roles_member_read ON org_custom_roles
      FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_custom_role_assignments_admin_rw') THEN
    CREATE POLICY org_custom_role_assignments_admin_rw ON org_custom_role_assignments
      FOR ALL
      USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ))
      WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_custom_role_assignments_self_read') THEN
    CREATE POLICY org_custom_role_assignments_self_read ON org_custom_role_assignments
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;
