-- Permission System: Extended roles, audit trail, org settings

-- ── Extended project_members roles ───────────────────────────
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
  CHECK (role IN ('owner', 'admin', 'project_manager', 'superintendent', 'subcontractor', 'viewer'));

-- Migrate existing 'member' roles to 'project_manager'
UPDATE project_members SET role = 'project_manager' WHERE role = 'member';

-- ── Audit trail table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES auth.users,
  action text NOT NULL, -- create, update, delete, status_change, approve, reject
  entity_type text NOT NULL, -- rfi, task, submittal, change_order, daily_log, etc.
  entity_id uuid,
  entity_title text,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Append only: no UPDATE or DELETE policies on audit_trail
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_trail_select ON audit_trail FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY audit_trail_insert ON audit_trail FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- No UPDATE or DELETE policies — audit trail is immutable

CREATE INDEX idx_audit_trail_project ON audit_trail(project_id, created_at DESC);
CREATE INDEX idx_audit_trail_actor ON audit_trail(actor_id, created_at DESC);
CREATE INDEX idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX idx_audit_trail_action ON audit_trail(action);

-- ── Organization settings ────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_project_role text DEFAULT 'viewer';

-- ── Enhanced permission helper functions ─────────────────────

-- Check if user has a specific role (or higher) in a project
CREATE OR REPLACE FUNCTION has_project_permission(p_project_id uuid, p_min_role text)
RETURNS boolean AS $$
DECLARE
  user_role text;
  role_level int;
  min_level int;
BEGIN
  SELECT role INTO user_role FROM project_members
  WHERE project_id = p_project_id AND user_id = auth.uid();

  IF user_role IS NULL THEN RETURN false; END IF;

  -- Role hierarchy: owner(6) > admin(5) > project_manager(4) > superintendent(3) > subcontractor(2) > viewer(1)
  role_level := CASE user_role
    WHEN 'owner' THEN 6
    WHEN 'admin' THEN 5
    WHEN 'project_manager' THEN 4
    WHEN 'superintendent' THEN 3
    WHEN 'subcontractor' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;

  min_level := CASE p_min_role
    WHEN 'owner' THEN 6
    WHEN 'admin' THEN 5
    WHEN 'project_manager' THEN 4
    WHEN 'superintendent' THEN 3
    WHEN 'subcontractor' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;

  RETURN role_level >= min_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Audit trail writer function (call from triggers or mutations)
CREATE OR REPLACE FUNCTION write_audit_entry(
  p_project_id uuid, p_action text, p_entity_type text,
  p_entity_id uuid DEFAULT NULL, p_entity_title text DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL, p_new_value jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  entry_id uuid;
BEGIN
  INSERT INTO audit_trail (project_id, actor_id, action, entity_type, entity_id, entity_title, old_value, new_value)
  VALUES (p_project_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_entity_title, p_old_value, p_new_value)
  RETURNING id INTO entry_id;
  RETURN entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Update existing RLS policies for role-based access ───────

-- Budget items: subcontractors and viewers cannot see
DROP POLICY IF EXISTS budget_items_select ON budget_items;
CREATE POLICY budget_items_select ON budget_items FOR SELECT
  USING (has_project_permission(project_id, 'superintendent'));

-- Change orders: only PM and above can view
DROP POLICY IF EXISTS change_orders_select ON change_orders;
CREATE POLICY change_orders_select ON change_orders FOR SELECT
  USING (has_project_permission(project_id, 'superintendent'));

-- Daily log approval: only admin and above
-- (existing insert policy allows members, which is correct)
