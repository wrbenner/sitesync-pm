-- Safety Planning Module — Pre-Task Plans and Job Hazard Analyses

CREATE TABLE IF NOT EXISTS pre_task_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  crew_name text,
  foreman text,
  task_description text NOT NULL,
  hazards jsonb DEFAULT '[]',  -- [{hazard, control_measure, ppe_required}]
  emergency_plan text,
  attendees jsonb DEFAULT '[]',  -- [{name, signature_url}]
  status text DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pre_task_plans' AND column_name = 'project_id') THEN

    CREATE INDEX IF NOT EXISTS idx_ptp_project ON pre_task_plans(project_id);

  END IF;

END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pre_task_plans' AND column_name = 'date') THEN
    CREATE INDEX IF NOT EXISTS idx_ptp_date ON pre_task_plans(date);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pre_task_plans' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_ptp_status ON pre_task_plans(status);
  END IF;
END $$;

ALTER TABLE pre_task_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pre_task_plans_select ON pre_task_plans;
CREATE POLICY pre_task_plans_select ON pre_task_plans FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS pre_task_plans_insert ON pre_task_plans;
CREATE POLICY pre_task_plans_insert ON pre_task_plans FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS pre_task_plans_update ON pre_task_plans;
CREATE POLICY pre_task_plans_update ON pre_task_plans FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS pre_task_plans_delete ON pre_task_plans;
CREATE POLICY pre_task_plans_delete ON pre_task_plans FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
