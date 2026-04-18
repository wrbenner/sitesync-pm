-- Closeout Management Module
-- Tracks warranties, O&M manuals, attic stock, lien waivers, as-builts, etc.

CREATE TABLE IF NOT EXISTS closeout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  item_type text NOT NULL CHECK (item_type IN (
    'warranty','om_manual','attic_stock','lien_waiver',
    'final_inspection','as_built','certificate_of_occupancy'
  )),
  title text NOT NULL,
  description text,
  responsible_party text,
  vendor_contact_id uuid REFERENCES directory_contacts(id) ON DELETE SET NULL,
  due_date date,
  submitted_date date,
  approved_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','submitted','approved','na')),
  file_url text,
  expiration_date date,  -- for warranties
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closeout_project ON closeout_items(project_id);
CREATE INDEX IF NOT EXISTS idx_closeout_type ON closeout_items(item_type);
CREATE INDEX IF NOT EXISTS idx_closeout_status ON closeout_items(status);

ALTER TABLE closeout_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS closeout_items_select ON closeout_items;
CREATE POLICY closeout_items_select ON closeout_items FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS closeout_items_insert ON closeout_items;
CREATE POLICY closeout_items_insert ON closeout_items FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS closeout_items_update ON closeout_items;
CREATE POLICY closeout_items_update ON closeout_items FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS closeout_items_delete ON closeout_items;
CREATE POLICY closeout_items_delete ON closeout_items FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
