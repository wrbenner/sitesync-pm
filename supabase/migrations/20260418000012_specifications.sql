-- Specifications Module — CSI MasterFormat sections linked to submittals and RFIs.

CREATE TABLE IF NOT EXISTS specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  section_number text NOT NULL,  -- e.g. "03 30 00"
  title text NOT NULL,  -- e.g. "Cast-in-Place Concrete"
  division integer,  -- CSI division (1-49)
  status text DEFAULT 'active' CHECK (status IN ('active','superseded','deleted')),
  file_url text,
  revision text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, section_number)
);

CREATE INDEX IF NOT EXISTS idx_specs_project ON specifications(project_id);
CREATE INDEX IF NOT EXISTS idx_specs_division ON specifications(division);
CREATE INDEX IF NOT EXISTS idx_specs_section ON specifications(section_number);

ALTER TABLE specifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS specifications_select ON specifications;
CREATE POLICY specifications_select ON specifications FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS specifications_insert ON specifications;
CREATE POLICY specifications_insert ON specifications FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS specifications_update ON specifications;
CREATE POLICY specifications_update ON specifications FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS specifications_delete ON specifications;
CREATE POLICY specifications_delete ON specifications FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- Link spec to submittals (optional reference).
ALTER TABLE IF EXISTS submittals
  ADD COLUMN IF NOT EXISTS specification_id uuid REFERENCES specifications(id) ON DELETE SET NULL;

-- Link spec to RFIs.
ALTER TABLE IF EXISTS rfis
  ADD COLUMN IF NOT EXISTS specification_id uuid REFERENCES specifications(id) ON DELETE SET NULL;
