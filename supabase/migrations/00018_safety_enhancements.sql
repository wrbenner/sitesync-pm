-- Safety Module Enhancements

-- Inspection templates for reusable checklists
CREATE TABLE IF NOT EXISTS safety_inspection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text CHECK (type IN ('daily_site','weekly_area','equipment','scaffold','excavation','electrical','fire_protection','crane','confined_space')),
  description text,
  items jsonb NOT NULL DEFAULT '[]',
  is_global boolean DEFAULT false,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE safety_inspection_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY sit_select ON safety_inspection_templates FOR SELECT USING (is_global = true OR created_by = (select auth.uid()));
CREATE POLICY sit_insert ON safety_inspection_templates FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Corrective actions table (from inspection deficiencies)
CREATE TABLE IF NOT EXISTS corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  source_type text CHECK (source_type IN ('inspection','incident','observation')),
  source_id uuid,
  description text NOT NULL,
  severity text CHECK (severity IN ('minor','major','critical','imminent_danger')),
  status text DEFAULT 'identified' CHECK (status IN ('identified','assigned','in_progress','verified','closed')),
  assigned_to uuid REFERENCES auth.users,
  due_date date,
  completed_date date,
  verified_by uuid REFERENCES auth.users,
  verified_date date,
  photos jsonb DEFAULT '[]',
  notes text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corrective_actions_project ON corrective_actions(project_id);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_status ON corrective_actions(status);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_source ON corrective_actions(source_type, source_id);

ALTER TABLE corrective_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ca_select ON corrective_actions FOR SELECT USING (is_project_member(project_id));
CREATE POLICY ca_insert ON corrective_actions FOR INSERT WITH CHECK (is_project_role(project_id, ARRAY['owner','admin','member']));
CREATE POLICY ca_update ON corrective_actions FOR UPDATE USING (is_project_role(project_id, ARRAY['owner','admin','member']));
CREATE POLICY ca_delete ON corrective_actions FOR DELETE USING (is_project_role(project_id, ARRAY['owner','admin']));

CREATE TRIGGER set_corrective_actions_updated_at BEFORE UPDATE ON corrective_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enhance incidents with OSHA fields
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS osha_case_number text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS days_away_from_work int DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS days_restricted_duty int DEFAULT 0;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS body_part text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS nature_of_injury text;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS root_cause_analysis jsonb DEFAULT '{}';

-- Add schedule field to toolbox_talks
ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS recurring boolean DEFAULT false;
ALTER TABLE toolbox_talks ADD COLUMN IF NOT EXISTS recurrence_rule text;

-- Seed inspection templates
INSERT INTO safety_inspection_templates (name, type, description, is_global, items) VALUES
('Daily Site Safety Walk', 'daily_site', 'Standard daily safety walkthrough checklist', true,
 '[{"category":"housekeeping","question":"Work areas clean and free of debris","required_photo":false},{"category":"housekeeping","question":"Access routes clear and unobstructed","required_photo":false},{"category":"fall_protection","question":"All fall protection in place for work above 6 feet","required_photo":true},{"category":"fall_protection","question":"Guardrails, safety nets, or personal fall arrest systems in use","required_photo":false},{"category":"ppe","question":"Workers wearing required PPE (hard hat, vest, boots, glasses)","required_photo":false},{"category":"electrical","question":"Temporary electrical panels properly labeled and covered","required_photo":false},{"category":"electrical","question":"Extension cords in good condition, no splices","required_photo":false},{"category":"fire_safety","question":"Fire extinguishers accessible and current inspection tags","required_photo":false},{"category":"signage","question":"Warning signs posted at hazardous areas","required_photo":false},{"category":"equipment","question":"Equipment operators have valid certifications","required_photo":false}]'),
('Weekly Area Safety Audit', 'weekly_area', 'Detailed weekly area inspection', true,
 '[{"category":"fall_protection","question":"Floor and roof openings properly covered or guarded","required_photo":true},{"category":"scaffolding","question":"Scaffold erected by competent person with inspection tag","required_photo":true},{"category":"scaffolding","question":"Scaffold planking in good condition, fully decked","required_photo":false},{"category":"excavation","question":"Excavations properly sloped, shored, or shielded","required_photo":true},{"category":"excavation","question":"Spoil piles set back minimum 2 feet from edge","required_photo":false},{"category":"electrical","question":"GFCI protection on all temporary circuits","required_photo":false},{"category":"equipment","question":"Equipment daily inspection logs current","required_photo":false},{"category":"housekeeping","question":"Waste containers available and not overflowing","required_photo":false},{"category":"environmental","question":"Stormwater BMPs in place and functioning","required_photo":true},{"category":"fire_safety","question":"Hot work permits current for all welding and cutting","required_photo":false},{"category":"signage","question":"SDS sheets available for all chemicals on site","required_photo":false},{"category":"ppe","question":"Respiratory protection properly fitted and stored","required_photo":false}]'),
('Scaffold Inspection', 'scaffold', 'Pre use scaffold inspection per OSHA 1926.451', true,
 '[{"category":"scaffolding","question":"Base plates and mudsills properly installed","required_photo":true},{"category":"scaffolding","question":"All connections tight and secure","required_photo":false},{"category":"scaffolding","question":"Platform fully planked (no gaps over 1 inch)","required_photo":true},{"category":"scaffolding","question":"Guardrails on all open sides (42 inch top, 21 inch mid, toe board)","required_photo":true},{"category":"scaffolding","question":"Access ladder properly secured","required_photo":false},{"category":"scaffolding","question":"Scaffold tied to structure at required intervals","required_photo":false},{"category":"scaffolding","question":"No overloading beyond rated capacity","required_photo":false},{"category":"scaffolding","question":"Competent person inspection tag current","required_photo":true}]')
ON CONFLICT DO NOTHING;
