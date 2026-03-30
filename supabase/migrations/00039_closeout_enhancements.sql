-- Project Closeout enhancements: enhanced closeout items, warranty tracking, commissioning.

-- Ensure closeout_items has all needed columns
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS trade text;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS rejection_comments text;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS project_type text;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_closeout_items_project_status ON closeout_items(project_id, status);
CREATE INDEX IF NOT EXISTS idx_closeout_items_category ON closeout_items(project_id, category);
CREATE INDEX IF NOT EXISTS idx_closeout_items_trade ON closeout_items(project_id, trade);

-- Ensure RLS
ALTER TABLE closeout_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS closeout_items_select ON closeout_items;
CREATE POLICY closeout_items_select ON closeout_items FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS closeout_items_manage ON closeout_items;
CREATE POLICY closeout_items_manage ON closeout_items FOR ALL
  USING (has_project_permission(project_id, 'project_manager'));

-- Ensure warranties table has all needed columns
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS trade text;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS coverage_details text;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS reminder_30_sent boolean DEFAULT false;
ALTER TABLE warranties ADD COLUMN IF NOT EXISTS reminder_7_sent boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_warranties_project ON warranties(project_id, status);
CREATE INDEX IF NOT EXISTS idx_warranties_expiry ON warranties(end_date) WHERE status = 'active';

ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS warranties_select ON warranties;
CREATE POLICY warranties_select ON warranties FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS warranties_manage ON warranties;
CREATE POLICY warranties_manage ON warranties FOR ALL
  USING (has_project_permission(project_id, 'project_manager'));

-- Commissioning checklists
CREATE TABLE IF NOT EXISTS commissioning_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) NOT NULL,
  system_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('functional_test', 'startup', 'balancing', 'training', 'documentation')),
  description text NOT NULL,
  equipment_tag text,
  location text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'na')),
  tested_by text,
  tested_at timestamptz,
  result_data jsonb DEFAULT '{}',
  notes text,
  linked_closeout_id uuid REFERENCES closeout_items(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_commissioning_project ON commissioning_items(project_id, status);

ALTER TABLE commissioning_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY commissioning_select ON commissioning_items FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY commissioning_manage ON commissioning_items FOR ALL
  USING (has_project_permission(project_id, 'superintendent'));

-- Auto-update warranty status function
CREATE OR REPLACE FUNCTION update_warranty_status()
RETURNS void AS $$
BEGIN
  UPDATE warranties SET status = 'expired'
  WHERE end_date < CURRENT_DATE AND status = 'active';

  UPDATE warranties SET status = 'expiring_soon'
  WHERE end_date >= CURRENT_DATE AND end_date <= CURRENT_DATE + INTERVAL '30 days' AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE TRIGGER set_commissioning_updated_at BEFORE UPDATE ON commissioning_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
