-- Document Approval Workflows — configurable multi-step approval chains per entity type.

CREATE TABLE IF NOT EXISTS approval_workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('submittal','rfi','change_order','pay_application','daily_log','safety_inspection')),
  name text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]',
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_awt_project ON approval_workflow_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_awt_entity ON approval_workflow_templates(entity_type);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_awt_default
  ON approval_workflow_templates(project_id, entity_type)
  WHERE is_default = true;

CREATE TABLE IF NOT EXISTS approval_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES approval_workflow_templates(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  current_step integer DEFAULT 1,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress','approved','rejected','cancelled')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_project ON approval_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_entity ON approval_instances(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_status ON approval_instances(status);

CREATE TABLE IF NOT EXISTS approval_step_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES approval_instances(id) ON DELETE CASCADE NOT NULL,
  step_order integer NOT NULL,
  assigned_to uuid REFERENCES auth.users(id),
  action text CHECK (action IN ('approved','rejected','returned','acknowledged')),
  comments text,
  acted_at timestamptz,
  due_date timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asa_instance ON approval_step_actions(instance_id);
CREATE INDEX IF NOT EXISTS idx_asa_assigned ON approval_step_actions(assigned_to);

ALTER TABLE approval_workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_step_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS awt_select ON approval_workflow_templates;
CREATE POLICY awt_select ON approval_workflow_templates FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS awt_insert ON approval_workflow_templates;
CREATE POLICY awt_insert ON approval_workflow_templates FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS awt_update ON approval_workflow_templates;
CREATE POLICY awt_update ON approval_workflow_templates FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS awt_delete ON approval_workflow_templates;
CREATE POLICY awt_delete ON approval_workflow_templates FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ai_select ON approval_instances;
CREATE POLICY ai_select ON approval_instances FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS ai_insert ON approval_instances;
CREATE POLICY ai_insert ON approval_instances FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS ai_update ON approval_instances;
CREATE POLICY ai_update ON approval_instances FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS asa_select ON approval_step_actions;
CREATE POLICY asa_select ON approval_step_actions FOR SELECT
  USING (instance_id IN (SELECT id FROM approval_instances WHERE project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())));
DROP POLICY IF EXISTS asa_insert ON approval_step_actions;
CREATE POLICY asa_insert ON approval_step_actions FOR INSERT
  WITH CHECK (instance_id IN (SELECT id FROM approval_instances WHERE project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())));
DROP POLICY IF EXISTS asa_update ON approval_step_actions;
CREATE POLICY asa_update ON approval_step_actions FOR UPDATE
  USING (instance_id IN (SELECT id FROM approval_instances WHERE project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())));
