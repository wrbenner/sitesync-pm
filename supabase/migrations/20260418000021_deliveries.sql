-- Delivery Tracking
--
-- 00009_procurement_equipment.sql already created deliveries with columns
-- (delivery_date, carrier, tracking_number, inspection_notes, photos jsonb,
-- packing_slip_url). This migration adds the new columns (delivery_number,
-- supplier, expected_date, actual_date, items, receiving_notes, photo_urls)
-- additively and guards every index on column existence.

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  delivery_number serial,
  supplier text,
  purchase_order_id uuid,
  expected_date date,
  actual_date date,
  status text DEFAULT 'scheduled',
  items jsonb DEFAULT '[]',
  receiving_notes text,
  photo_urls text[],
  received_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_number serial;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS expected_date date;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS actual_date date;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS receiving_notes text;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS photo_urls text[];

-- Backfill new columns from legacy equivalents.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='delivery_date')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='actual_date') THEN
    UPDATE deliveries SET actual_date = delivery_date WHERE actual_date IS NULL AND delivery_date IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='inspection_notes')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='receiving_notes') THEN
    UPDATE deliveries SET receiving_notes = inspection_notes WHERE receiving_notes IS NULL AND inspection_notes IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='project_id') THEN
    CREATE INDEX IF NOT EXISTS idx_deliveries_project ON deliveries(project_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='expected_date') THEN
    CREATE INDEX IF NOT EXISTS idx_deliveries_expected ON deliveries(expected_date);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='status') THEN
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
  END IF;
END $$;

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
