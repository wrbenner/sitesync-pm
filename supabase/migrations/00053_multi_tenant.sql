-- =============================================================================
-- 002_multi_tenant.sql
-- Multi-tenant, multi-project architecture for SiteSync.
-- Each GC company is an organization (tenant). Projects belong to orgs.
-- Users have roles on organizations and separate roles on individual projects.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- organizations (tenants)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  logo_url   text,
  plan       text NOT NULL DEFAULT 'professional'
               CHECK (plan IN ('starter', 'professional', 'enterprise')),
  settings   jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Members of the org can read it; org owners can mutate it
DROP POLICY IF EXISTS organizations_select ON organizations;
CREATE POLICY organizations_select ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS organizations_update ON organizations;
CREATE POLICY organizations_update ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner', 'admin', 'member')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships and co-members within their orgs
DROP POLICY IF EXISTS org_members_select ON organization_members;
CREATE POLICY org_members_select ON organization_members FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS org_members_insert ON organization_members;
CREATE POLICY org_members_insert ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS org_members_delete ON organization_members;
CREATE POLICY org_members_delete ON organization_members FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
  );

-- Indexes for fast membership lookups
CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_user
  ON organization_members(organization_id, user_id);

-- ---------------------------------------------------------------------------
-- projects: add organization_id foreign key
-- ---------------------------------------------------------------------------

ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_org
  ON projects(organization_id);

-- ---------------------------------------------------------------------------
-- project_members: add permissions column and expand role set
-- ---------------------------------------------------------------------------

ALTER TABLE project_members ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}';

-- Drop and recreate the role constraint to include all construction roles
ALTER TABLE project_members
  DROP CONSTRAINT IF EXISTS project_members_role_check;

ALTER TABLE project_members
  ADD CONSTRAINT project_members_role_check
  CHECK (role IN (
    'project_executive',
    'project_manager',
    'superintendent',
    'project_engineer',
    'safety_manager',
    'field_engineer',
    'subcontractor',
    'owner_rep',
    'architect',
    'viewer',
    -- legacy roles kept for backward compat
    'owner',
    'admin',
    'member'
  ));

-- ---------------------------------------------------------------------------
-- updated_at trigger for organizations
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
