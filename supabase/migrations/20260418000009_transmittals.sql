-- Transmittals Module
-- Tracks documents sent to/from subs, architects, owners.

CREATE TABLE IF NOT EXISTS transmittals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  transmittal_number serial,
  to_company text NOT NULL,
  from_company text NOT NULL,
  subject text NOT NULL,
  description text,
  items jsonb DEFAULT '[]',  -- [{document_id, description, copies, action_required}]
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','acknowledged','responded')),
  sent_date timestamptz,
  due_date timestamptz,
  acknowledged_date timestamptz,
  responded_date timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transmittals_project ON transmittals(project_id);
CREATE INDEX IF NOT EXISTS idx_transmittals_status ON transmittals(status);

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
