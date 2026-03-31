-- Organization and Permission System

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  plan text DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Organization members
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Link projects to organizations
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);

-- Updated at trigger
CREATE TRIGGER set_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations: members can view, owners can edit
CREATE POLICY org_select ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY org_insert ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY org_update ON organizations FOR UPDATE
  USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Organization members
CREATE POLICY org_members_select ON organization_members FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members om WHERE om.user_id = auth.uid()));
CREATE POLICY org_members_insert ON organization_members FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')));
CREATE POLICY org_members_delete ON organization_members FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')));

-- Permission helper functions
CREATE OR REPLACE FUNCTION get_user_project_role(p_project_id uuid)
RETURNS text AS $$
  SELECT role FROM project_members WHERE project_id = p_project_id AND user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_user_approve(p_project_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_user_create(p_project_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

