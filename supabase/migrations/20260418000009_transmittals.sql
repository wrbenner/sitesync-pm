-- Transmittals Module
--
-- 00019_document_enhancements.sql already created transmittals with columns
-- (to_contact, to_email, from_contact, purpose, action_required, notes,
-- document_ids uuid[], sent_at, acknowledged_at). This migration adds the
-- newer columns (description, items jsonb, due_date, responded_date) and
-- guards policies. CREATE TABLE stays for fresh installs; ADD COLUMN
-- handles upgrades.

CREATE TABLE IF NOT EXISTS transmittals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  transmittal_number serial,
  to_company text NOT NULL,
  from_company text,
  subject text NOT NULL,
  description text,
  items jsonb DEFAULT '[]',
  status text DEFAULT 'draft',
  sent_date timestamptz,
  due_date timestamptz,
  acknowledged_date timestamptz,
  responded_date timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transmittals ADD COLUMN IF NOT EXISTS from_company text;
ALTER TABLE transmittals ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE transmittals ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]';
ALTER TABLE transmittals ADD COLUMN IF NOT EXISTS sent_date timestamptz;
ALTER TABLE transmittals ADD COLUMN IF NOT EXISTS due_date timestamptz;
ALTER TABLE transmittals ADD COLUMN IF NOT EXISTS acknowledged_date timestamptz;
ALTER TABLE transmittals ADD COLUMN IF NOT EXISTS responded_date timestamptz;
ALTER TABLE transmittals ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transmittals' AND column_name='sent_at')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transmittals' AND column_name='sent_date') THEN
    UPDATE transmittals SET sent_date = sent_at WHERE sent_date IS NULL AND sent_at IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transmittals' AND column_name='acknowledged_at')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transmittals' AND column_name='acknowledged_date') THEN
    UPDATE transmittals SET acknowledged_date = acknowledged_at WHERE acknowledged_date IS NULL AND acknowledged_at IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transmittals' AND column_name='project_id') THEN
    CREATE INDEX IF NOT EXISTS idx_transmittals_project ON transmittals(project_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transmittals' AND column_name='status') THEN
    CREATE INDEX IF NOT EXISTS idx_transmittals_status ON transmittals(status);
  END IF;
END $$;

ALTER TABLE transmittals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transmittals_select ON transmittals;
CREATE POLICY transmittals_select ON transmittals FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS transmittals_insert ON transmittals;
CREATE POLICY transmittals_insert ON transmittals FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS transmittals_update ON transmittals;
CREATE POLICY transmittals_update ON transmittals FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS transmittals_delete ON transmittals;
CREATE POLICY transmittals_delete ON transmittals FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
