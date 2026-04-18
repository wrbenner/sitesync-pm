-- Delivery Tracking
-- Track material deliveries to the job site.

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  delivery_number serial,
  supplier text NOT NULL,
  purchase_order_id uuid,
  expected_date date NOT NULL,
  actual_date date,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_transit','delivered','partial','rejected','cancelled')),
  items jsonb DEFAULT '[]',
  receiving_notes text,
  photo_urls text[],
  received_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_project ON deliveries(project_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_expected ON deliveries(expected_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deliveries_select ON deliveries;
CREATE POLICY deliveries_select ON deliveries FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS deliveries_insert ON deliveries;
CREATE POLICY deliveries_insert ON deliveries FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS deliveries_update ON deliveries;
CREATE POLICY deliveries_update ON deliveries FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS deliveries_delete ON deliveries;
CREATE POLICY deliveries_delete ON deliveries FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
