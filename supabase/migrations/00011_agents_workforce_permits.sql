-- =============================================================================
-- SiteSync PM: AI Agents, Workforce Management, and Permit Tracking
-- AI agent orchestration, workforce members and assignments, time tracking,
-- labor forecasting, permits, and permit inspections.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- AI Agents
CREATE TABLE ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  agent_type text NOT NULL
    CHECK (agent_type IN ('drawing_analyzer','submittal_prefiller','schedule_predictor','daily_log_analyzer','rfi_router','safety_monitor','cost_forecaster','document_classifier')),
  status text DEFAULT 'active'
    CHECK (status IN ('active','paused','disabled')),
  last_run timestamptz,
  next_run timestamptz,
  configuration jsonb DEFAULT '{}',
  actions_taken int DEFAULT 0,
  actions_approved int DEFAULT 0,
  actions_rejected int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- AI Agent Actions
CREATE TABLE ai_agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  action_type text,
  description text NOT NULL,
  confidence numeric,
  input_data jsonb DEFAULT '{}',
  output_data jsonb DEFAULT '{}',
  status text DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected','auto_applied')),
  reviewed_by uuid REFERENCES auth.users,
  reviewed_at timestamptz,
  applied boolean DEFAULT false,
  applied_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Workforce Members
CREATE TABLE workforce_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  organization_id uuid,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  trade text NOT NULL,
  role text
    CHECK (role IN ('journeyman','apprentice','foreman','superintendent','laborer')),
  hourly_rate numeric,
  overtime_rate numeric,
  hire_date date,
  status text DEFAULT 'active'
    CHECK (status IN ('active','inactive','terminated')),
  skills jsonb DEFAULT '[]',
  languages jsonb DEFAULT '["en"]',
  emergency_contact_name text,
  emergency_contact_phone text,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workforce Assignments
CREATE TABLE workforce_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workforce_member_id uuid REFERENCES workforce_members ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  crew_id uuid REFERENCES crews,
  start_date date,
  end_date date,
  hours_per_day numeric DEFAULT 8,
  status text DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','active','completed')),
  created_at timestamptz DEFAULT now()
);

-- Time Entries
CREATE TABLE time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workforce_member_id uuid REFERENCES workforce_members ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  clock_in timestamptz,
  clock_out timestamptz,
  regular_hours numeric,
  overtime_hours numeric,
  double_time_hours numeric,
  break_minutes int DEFAULT 30,
  cost_code text,
  task_description text,
  approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users,
  geolocation_in jsonb,
  geolocation_out jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Labor Forecasts
CREATE TABLE labor_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  trade text,
  headcount_needed int,
  hours_needed numeric,
  source text
    CHECK (source IN ('manual','ai_predicted')),
  confidence numeric,
  created_at timestamptz DEFAULT now()
);

-- Permits
CREATE TABLE permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  type text
    CHECK (type IN ('building','demolition','electrical','plumbing','mechanical','fire','grading','encroachment','environmental','special_use','tcm')),
  permit_number text,
  jurisdiction text,
  authority text,
  status text DEFAULT 'not_applied'
    CHECK (status IN ('not_applied','application_submitted','under_review','approved','denied','expired','closed')),
  applied_date date,
  issued_date date,
  expiration_date date,
  fee numeric,
  paid boolean DEFAULT false,
  conditions text,
  special_inspections jsonb DEFAULT '[]',
  documents jsonb DEFAULT '[]',
  contact_name text,
  contact_phone text,
  notes text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Permit Inspections
CREATE TABLE permit_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid REFERENCES permits ON DELETE CASCADE NOT NULL,
  type text
    CHECK (type IN ('foundation','framing','rough_in','insulation','drywall','final','special')),
  status text DEFAULT 'not_scheduled'
    CHECK (status IN ('not_scheduled','scheduled','passed','failed','partial','cancelled')),
  scheduled_date date,
  inspector_name text,
  result_notes text,
  corrections_required text,
  re_inspection_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- AI Agents
CREATE INDEX idx_ai_agents_project ON ai_agents(project_id);
CREATE INDEX idx_ai_agents_agent_type ON ai_agents(agent_type);
CREATE INDEX idx_ai_agents_status ON ai_agents(status);
CREATE INDEX idx_ai_agents_last_run ON ai_agents(last_run);
CREATE INDEX idx_ai_agents_next_run ON ai_agents(next_run);

-- AI Agent Actions
CREATE INDEX idx_ai_agent_actions_agent ON ai_agent_actions(agent_id);
CREATE INDEX idx_ai_agent_actions_project ON ai_agent_actions(project_id);
CREATE INDEX idx_ai_agent_actions_status ON ai_agent_actions(status);
CREATE INDEX idx_ai_agent_actions_action_type ON ai_agent_actions(action_type);
CREATE INDEX idx_ai_agent_actions_reviewed_by ON ai_agent_actions(reviewed_by);
CREATE INDEX idx_ai_agent_actions_created_at ON ai_agent_actions(created_at);

-- Workforce Members
CREATE INDEX idx_workforce_members_project ON workforce_members(project_id);
CREATE INDEX idx_workforce_members_trade ON workforce_members(trade);
CREATE INDEX idx_workforce_members_role ON workforce_members(role);
CREATE INDEX idx_workforce_members_status ON workforce_members(status);
CREATE INDEX idx_workforce_members_company ON workforce_members(company);
CREATE INDEX idx_workforce_members_hire_date ON workforce_members(hire_date);

-- Workforce Assignments
CREATE INDEX idx_workforce_assignments_member ON workforce_assignments(workforce_member_id);
CREATE INDEX idx_workforce_assignments_project ON workforce_assignments(project_id);
CREATE INDEX idx_workforce_assignments_crew ON workforce_assignments(crew_id);
CREATE INDEX idx_workforce_assignments_status ON workforce_assignments(status);
CREATE INDEX idx_workforce_assignments_start_date ON workforce_assignments(start_date);
CREATE INDEX idx_workforce_assignments_end_date ON workforce_assignments(end_date);

-- Time Entries
CREATE INDEX idx_time_entries_member ON time_entries(workforce_member_id);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);
CREATE INDEX idx_time_entries_cost_code ON time_entries(cost_code);
CREATE INDEX idx_time_entries_approved ON time_entries(approved);
CREATE INDEX idx_time_entries_approved_by ON time_entries(approved_by);

-- Labor Forecasts
CREATE INDEX idx_labor_forecasts_project ON labor_forecasts(project_id);
CREATE INDEX idx_labor_forecasts_week_start ON labor_forecasts(week_start);
CREATE INDEX idx_labor_forecasts_trade ON labor_forecasts(trade);
CREATE INDEX idx_labor_forecasts_source ON labor_forecasts(source);

-- Permits
CREATE INDEX idx_permits_project ON permits(project_id);
CREATE INDEX idx_permits_type ON permits(type);
CREATE INDEX idx_permits_status ON permits(status);
CREATE INDEX idx_permits_permit_number ON permits(permit_number);
CREATE INDEX idx_permits_jurisdiction ON permits(jurisdiction);
CREATE INDEX idx_permits_applied_date ON permits(applied_date);
CREATE INDEX idx_permits_issued_date ON permits(issued_date);
CREATE INDEX idx_permits_expiration_date ON permits(expiration_date);
CREATE INDEX idx_permits_created_by ON permits(created_by);

-- Permit Inspections
CREATE INDEX idx_permit_inspections_permit ON permit_inspections(permit_id);
CREATE INDEX idx_permit_inspections_type ON permit_inspections(type);
CREATE INDEX idx_permit_inspections_status ON permit_inspections(status);
CREATE INDEX idx_permit_inspections_scheduled_date ON permit_inspections(scheduled_date);
CREATE INDEX idx_permit_inspections_re_inspection_date ON permit_inspections(re_inspection_date);

-- ---------------------------------------------------------------------------
-- 3. Updated At Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_workforce_members_updated_at
  BEFORE UPDATE ON workforce_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_permits_updated_at
  BEFORE UPDATE ON permits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_permit_inspections_updated_at
  BEFORE UPDATE ON permit_inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_inspections ENABLE ROW LEVEL SECURITY;

-- AI Agents: project members
CREATE POLICY ai_agents_select ON ai_agents FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY ai_agents_insert ON ai_agents FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY ai_agents_update ON ai_agents FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY ai_agents_delete ON ai_agents FOR DELETE
  USING (is_project_member(project_id));

-- AI Agent Actions: project members
CREATE POLICY ai_agent_actions_select ON ai_agent_actions FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY ai_agent_actions_insert ON ai_agent_actions FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY ai_agent_actions_update ON ai_agent_actions FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY ai_agent_actions_delete ON ai_agent_actions FOR DELETE
  USING (is_project_member(project_id));

-- Workforce Members: project members
CREATE POLICY workforce_members_select ON workforce_members FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY workforce_members_insert ON workforce_members FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY workforce_members_update ON workforce_members FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY workforce_members_delete ON workforce_members FOR DELETE
  USING (is_project_member(project_id));

-- Workforce Assignments: project members
CREATE POLICY workforce_assignments_select ON workforce_assignments FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY workforce_assignments_insert ON workforce_assignments FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY workforce_assignments_update ON workforce_assignments FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY workforce_assignments_delete ON workforce_assignments FOR DELETE
  USING (is_project_member(project_id));

-- Time Entries: project members
CREATE POLICY time_entries_select ON time_entries FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY time_entries_insert ON time_entries FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY time_entries_update ON time_entries FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY time_entries_delete ON time_entries FOR DELETE
  USING (is_project_member(project_id));

-- Labor Forecasts: project members
CREATE POLICY labor_forecasts_select ON labor_forecasts FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY labor_forecasts_insert ON labor_forecasts FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY labor_forecasts_update ON labor_forecasts FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY labor_forecasts_delete ON labor_forecasts FOR DELETE
  USING (is_project_member(project_id));

-- Permits: project members
CREATE POLICY permits_select ON permits FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY permits_insert ON permits FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY permits_update ON permits FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY permits_delete ON permits FOR DELETE
  USING (is_project_member(project_id));

-- Permit Inspections: join through parent permit
CREATE POLICY permit_inspections_select ON permit_inspections FOR SELECT
  USING (
    permit_id IN (
      SELECT p.id FROM permits p WHERE is_project_member(p.project_id)
    )
  );

CREATE POLICY permit_inspections_insert ON permit_inspections FOR INSERT
  WITH CHECK (
    permit_id IN (
      SELECT p.id FROM permits p WHERE is_project_member(p.project_id)
    )
  );

CREATE POLICY permit_inspections_update ON permit_inspections FOR UPDATE
  USING (
    permit_id IN (
      SELECT p.id FROM permits p WHERE is_project_member(p.project_id)
    )
  );

CREATE POLICY permit_inspections_delete ON permit_inspections FOR DELETE
  USING (
    permit_id IN (
      SELECT p.id FROM permits p WHERE is_project_member(p.project_id)
    )
  );

