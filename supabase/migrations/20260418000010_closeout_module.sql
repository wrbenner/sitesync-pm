-- Closeout Module
--
-- 00026_construction_workflows.sql already created closeout_items with a
-- different column shape (category, trade, description, assigned_to,
-- completed_date, document_url). This migration adds the richer columns
-- the new app expects (item_type, title, responsible_party, vendor_contact_id,
-- submitted_date, approved_date, file_url, expiration_date) while tolerating
-- the legacy schema. Indexes are guarded on column existence.

CREATE TABLE IF NOT EXISTS closeout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  item_type text,
  title text,
  description text,
  responsible_party text,
  vendor_contact_id uuid REFERENCES directory_contacts(id) ON DELETE SET NULL,
  due_date date,
  submitted_date date,
  approved_date date,
  status text DEFAULT 'pending',
  file_url text,
  expiration_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Additive columns for the older-schema installation.
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS item_type text;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS responsible_party text;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS vendor_contact_id uuid REFERENCES directory_contacts(id) ON DELETE SET NULL;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS submitted_date date;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS approved_date date;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS expiration_date date;
ALTER TABLE closeout_items ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Backfill from legacy columns where both forms exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='category')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='item_type') THEN
    UPDATE closeout_items SET item_type = category WHERE item_type IS NULL AND category IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='description')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='title') THEN
    UPDATE closeout_items SET title = description WHERE title IS NULL AND description IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='document_url')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='file_url') THEN
    UPDATE closeout_items SET file_url = document_url WHERE file_url IS NULL AND document_url IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='completed_date')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='approved_date') THEN
    UPDATE closeout_items SET approved_date = completed_date WHERE approved_date IS NULL AND completed_date IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='project_id') THEN
    CREATE INDEX IF NOT EXISTS idx_closeout_project ON closeout_items(project_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='item_type') THEN
    CREATE INDEX IF NOT EXISTS idx_closeout_type ON closeout_items(item_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closeout_items' AND column_name='status') THEN
    CREATE INDEX IF NOT EXISTS idx_closeout_status ON closeout_items(status);
  END IF;
END $$;

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
