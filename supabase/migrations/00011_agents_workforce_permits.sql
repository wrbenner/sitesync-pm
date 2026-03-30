-- =============================================================================
-- SiteSync AI: AI Agents, Workforce Management, and Permit Tracking
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

-- =============================================================================
-- Seed Data
-- =============================================================================

DO $$
DECLARE
  user_mike UUID := '11111111-1111-1111-1111-111111111111';
  project_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- AI Agent IDs
  ag_drawing UUID := 'ff000001-0000-0000-0000-000000000001';
  ag_submittal UUID := 'ff000001-0000-0000-0000-000000000002';
  ag_schedule UUID := 'ff000001-0000-0000-0000-000000000003';
  ag_dailylog UUID := 'ff000001-0000-0000-0000-000000000004';
  ag_rfi UUID := 'ff000001-0000-0000-0000-000000000005';
  ag_safety UUID := 'ff000001-0000-0000-0000-000000000006';
  ag_cost UUID := 'ff000001-0000-0000-0000-000000000007';
  ag_document UUID := 'ff000001-0000-0000-0000-000000000008';

  -- AI Agent Action IDs
  aa_01 UUID := 'ff000002-0000-0000-0000-000000000001';
  aa_02 UUID := 'ff000002-0000-0000-0000-000000000002';
  aa_03 UUID := 'ff000002-0000-0000-0000-000000000003';
  aa_04 UUID := 'ff000002-0000-0000-0000-000000000004';
  aa_05 UUID := 'ff000002-0000-0000-0000-000000000005';
  aa_06 UUID := 'ff000002-0000-0000-0000-000000000006';
  aa_07 UUID := 'ff000002-0000-0000-0000-000000000007';
  aa_08 UUID := 'ff000002-0000-0000-0000-000000000008';
  aa_09 UUID := 'ff000002-0000-0000-0000-000000000009';
  aa_10 UUID := 'ff000002-0000-0000-0000-000000000010';
  aa_11 UUID := 'ff000002-0000-0000-0000-000000000011';
  aa_12 UUID := 'ff000002-0000-0000-0000-000000000012';

  -- Workforce Member IDs
  wf_01 UUID := 'ff000003-0000-0000-0000-000000000001';
  wf_02 UUID := 'ff000003-0000-0000-0000-000000000002';
  wf_03 UUID := 'ff000003-0000-0000-0000-000000000003';
  wf_04 UUID := 'ff000003-0000-0000-0000-000000000004';
  wf_05 UUID := 'ff000003-0000-0000-0000-000000000005';
  wf_06 UUID := 'ff000003-0000-0000-0000-000000000006';
  wf_07 UUID := 'ff000003-0000-0000-0000-000000000007';
  wf_08 UUID := 'ff000003-0000-0000-0000-000000000008';
  wf_09 UUID := 'ff000003-0000-0000-0000-000000000009';
  wf_10 UUID := 'ff000003-0000-0000-0000-000000000010';
  wf_11 UUID := 'ff000003-0000-0000-0000-000000000011';
  wf_12 UUID := 'ff000003-0000-0000-0000-000000000012';
  wf_13 UUID := 'ff000003-0000-0000-0000-000000000013';
  wf_14 UUID := 'ff000003-0000-0000-0000-000000000014';
  wf_15 UUID := 'ff000003-0000-0000-0000-000000000015';

  -- Workforce Assignment IDs
  wa_01 UUID := 'ff000004-0000-0000-0000-000000000001';
  wa_02 UUID := 'ff000004-0000-0000-0000-000000000002';
  wa_03 UUID := 'ff000004-0000-0000-0000-000000000003';
  wa_04 UUID := 'ff000004-0000-0000-0000-000000000004';
  wa_05 UUID := 'ff000004-0000-0000-0000-000000000005';
  wa_06 UUID := 'ff000004-0000-0000-0000-000000000006';
  wa_07 UUID := 'ff000004-0000-0000-0000-000000000007';
  wa_08 UUID := 'ff000004-0000-0000-0000-000000000008';
  wa_09 UUID := 'ff000004-0000-0000-0000-000000000009';
  wa_10 UUID := 'ff000004-0000-0000-0000-000000000010';

  -- Time Entry IDs
  te_01 UUID := 'ff000005-0000-0000-0000-000000000001';
  te_02 UUID := 'ff000005-0000-0000-0000-000000000002';
  te_03 UUID := 'ff000005-0000-0000-0000-000000000003';
  te_04 UUID := 'ff000005-0000-0000-0000-000000000004';
  te_05 UUID := 'ff000005-0000-0000-0000-000000000005';
  te_06 UUID := 'ff000005-0000-0000-0000-000000000006';
  te_07 UUID := 'ff000005-0000-0000-0000-000000000007';
  te_08 UUID := 'ff000005-0000-0000-0000-000000000008';
  te_09 UUID := 'ff000005-0000-0000-0000-000000000009';
  te_10 UUID := 'ff000005-0000-0000-0000-000000000010';
  te_11 UUID := 'ff000005-0000-0000-0000-000000000011';
  te_12 UUID := 'ff000005-0000-0000-0000-000000000012';
  te_13 UUID := 'ff000005-0000-0000-0000-000000000013';
  te_14 UUID := 'ff000005-0000-0000-0000-000000000014';
  te_15 UUID := 'ff000005-0000-0000-0000-000000000015';
  te_16 UUID := 'ff000005-0000-0000-0000-000000000016';
  te_17 UUID := 'ff000005-0000-0000-0000-000000000017';
  te_18 UUID := 'ff000005-0000-0000-0000-000000000018';
  te_19 UUID := 'ff000005-0000-0000-0000-000000000019';
  te_20 UUID := 'ff000005-0000-0000-0000-000000000020';

  -- Labor Forecast IDs
  lf_01 UUID := 'ff000006-0000-0000-0000-000000000001';
  lf_02 UUID := 'ff000006-0000-0000-0000-000000000002';
  lf_03 UUID := 'ff000006-0000-0000-0000-000000000003';
  lf_04 UUID := 'ff000006-0000-0000-0000-000000000004';
  lf_05 UUID := 'ff000006-0000-0000-0000-000000000005';
  lf_06 UUID := 'ff000006-0000-0000-0000-000000000006';
  lf_07 UUID := 'ff000006-0000-0000-0000-000000000007';
  lf_08 UUID := 'ff000006-0000-0000-0000-000000000008';

  -- Permit IDs
  pm_building UUID := 'ff000007-0000-0000-0000-000000000001';
  pm_electrical UUID := 'ff000007-0000-0000-0000-000000000002';
  pm_plumbing UUID := 'ff000007-0000-0000-0000-000000000003';
  pm_mechanical UUID := 'ff000007-0000-0000-0000-000000000004';
  pm_fire UUID := 'ff000007-0000-0000-0000-000000000005';
  pm_grading UUID := 'ff000007-0000-0000-0000-000000000006';

  -- Permit Inspection IDs
  pi_01 UUID := 'ff000008-0000-0000-0000-000000000001';
  pi_02 UUID := 'ff000008-0000-0000-0000-000000000002';
  pi_03 UUID := 'ff000008-0000-0000-0000-000000000003';
  pi_04 UUID := 'ff000008-0000-0000-0000-000000000004';
  pi_05 UUID := 'ff000008-0000-0000-0000-000000000005';
  pi_06 UUID := 'ff000008-0000-0000-0000-000000000006';
  pi_07 UUID := 'ff000008-0000-0000-0000-000000000007';
  pi_08 UUID := 'ff000008-0000-0000-0000-000000000008';
  pi_09 UUID := 'ff000008-0000-0000-0000-000000000009';
  pi_10 UUID := 'ff000008-0000-0000-0000-000000000010';

BEGIN

  -- -------------------------------------------------------------------------
  -- AI Agents: 8 agents (one of each type), all active, varied action counts
  -- -------------------------------------------------------------------------
  INSERT INTO ai_agents (id, project_id, agent_type, status, last_run, next_run, configuration, actions_taken, actions_approved, actions_rejected) VALUES
    (ag_drawing, project_id, 'drawing_analyzer', 'active',
     now() - interval '2 hours', now() + interval '4 hours',
     '{"scan_frequency":"6h","detect_clashes":true,"compare_revisions":true,"output_format":"pdf"}',
     142, 128, 6),

    (ag_submittal, project_id, 'submittal_prefiller', 'active',
     now() - interval '1 hour', now() + interval '3 hours',
     '{"auto_fill_specs":true,"match_threshold":0.85,"include_alternates":false}',
     87, 79, 3),

    (ag_schedule, project_id, 'schedule_predictor', 'active',
     now() - interval '12 hours', now() + interval '12 hours',
     '{"lookahead_weeks":6,"weather_adjusted":true,"resource_constrained":true}',
     56, 48, 4),

    (ag_dailylog, project_id, 'daily_log_analyzer', 'active',
     now() - interval '30 minutes', now() + interval '24 hours',
     '{"sentiment_analysis":true,"safety_flagging":true,"auto_tag_trades":true}',
     210, 195, 8),

    (ag_rfi, project_id, 'rfi_router', 'active',
     now() - interval '45 minutes', now() + interval '2 hours',
     '{"auto_assign":true,"priority_detection":true,"similar_rfi_match":true}',
     63, 58, 2),

    (ag_safety, project_id, 'safety_monitor', 'active',
     now() - interval '15 minutes', now() + interval '1 hour',
     '{"photo_analysis":true,"ppe_detection":true,"hazard_zones":true,"alert_threshold":"medium"}',
     324, 298, 14),

    (ag_cost, project_id, 'cost_forecaster', 'active',
     now() - interval '6 hours', now() + interval '24 hours',
     '{"forecast_months":6,"variance_threshold":0.05,"include_contingency":true}',
     38, 34, 2),

    (ag_document, project_id, 'document_classifier', 'active',
     now() - interval '3 hours', now() + interval '6 hours',
     '{"ocr_enabled":true,"auto_tag":true,"filing_rules":"csi_division","confidence_threshold":0.90}',
     176, 162, 7);

  -- -------------------------------------------------------------------------
  -- AI Agent Actions: 12 actions across agent types
  -- -------------------------------------------------------------------------
  INSERT INTO ai_agent_actions (id, agent_id, project_id, action_type, description, confidence, input_data, output_data, status, reviewed_by, reviewed_at, applied, applied_at) VALUES
    -- Drawing analyzer actions
    (aa_01, ag_drawing, project_id, 'clash_detection',
     'Detected MEP clash between HVAC ductwork and structural beam at grid D7, floor 14. Duct routing conflicts with W14x90 beam flange.',
     0.94,
     '{"drawing_set":"S-14","sheet":"S-14.3","grid":"D7","floor":14}',
     '{"clash_type":"hard","systems":["HVAC","structural"],"suggested_resolution":"Lower duct routing by 6 inches or reroute through adjacent bay"}',
     'approved', user_mike, now() - interval '4 hours', true, now() - interval '3 hours'),

    (aa_02, ag_drawing, project_id, 'revision_comparison',
     'Drawing revision A3.2 Rev 4 shows relocated fire exit on floor 12 east elevation. Door repositioned 8 feet south of original location.',
     0.97,
     '{"drawing":"A3.2","old_revision":3,"new_revision":4}',
     '{"changes_detected":3,"critical_changes":1,"affected_trades":["framing","fire_protection","electrical"]}',
     'approved', user_mike, now() - interval '2 days', true, now() - interval '2 days'),

    -- Submittal prefiller actions
    (aa_03, ag_submittal, project_id, 'prefill_submittal',
     'Pre filled submittal for curtain wall glazing system. Matched spec section 08 44 13 to Kawneer 1600 Wall System product data.',
     0.91,
     '{"spec_section":"08 44 13","product_category":"curtain_wall"}',
     '{"manufacturer":"Kawneer","product":"1600 Wall System 2","data_sheets":2,"shop_drawings":1}',
     'pending_review', NULL, NULL, false, NULL),

    (aa_04, ag_submittal, project_id, 'prefill_submittal',
     'Pre filled submittal for elevator cab finishes. Matched spec section 14 21 00 to ThyssenKrupp endura MRL product data.',
     0.88,
     '{"spec_section":"14 21 00","product_category":"elevator"}',
     '{"manufacturer":"ThyssenKrupp","product":"endura MRL","data_sheets":3,"shop_drawings":2}',
     'auto_applied', NULL, NULL, true, now() - interval '1 day'),

    -- Schedule predictor actions
    (aa_05, ag_schedule, project_id, 'delay_prediction',
     'Predicted 3 day delay on curtain wall installation due to forecasted high winds (sustained 25+ mph) from April 2 through April 4.',
     0.86,
     '{"activity":"curtain_wall_install","planned_start":"2026-04-01","weather_source":"NOAA"}',
     '{"predicted_delay_days":3,"new_start":"2026-04-05","impact":"non_critical","float_remaining":8}',
     'approved', user_mike, now() - interval '1 day', true, now() - interval '1 day'),

    (aa_06, ag_schedule, project_id, 'resource_conflict',
     'Resource conflict detected: concrete finishing crew scheduled on both Level 16 deck and elevator pit walls on April 5. Recommend staggering pours.',
     0.92,
     '{"activities":["level_16_deck","elevator_pit"],"date":"2026-04-05","crew":"concrete_finishing"}',
     '{"conflict_type":"resource_overallocation","suggested_resolution":"Move elevator pit pour to April 8","cost_impact":0}',
     'pending_review', NULL, NULL, false, NULL),

    -- Daily log analyzer actions
    (aa_07, ag_dailylog, project_id, 'safety_flag',
     'Daily log entry from March 26 mentions missing guardrail on floor 15 east stairwell opening. Flagged as immediate safety concern.',
     0.96,
     '{"log_date":"2026-03-26","entry_text":"Noticed guardrail missing on 15th floor east stair opening"}',
     '{"severity":"critical","category":"fall_protection","osha_ref":"1926.502(b)","recommended_action":"Install temporary guardrail immediately"}',
     'auto_applied', NULL, NULL, true, now() - interval '2 days'),

    (aa_08, ag_dailylog, project_id, 'trade_tagging',
     'Auto tagged 14 daily log entries from March 27 across 6 trades. Identified 3 entries with potential weather delay documentation.',
     0.89,
     '{"log_date":"2026-03-27","entries_count":14}',
     '{"trades_tagged":["ironworkers","electricians","plumbers","drywall","painters","laborers"],"weather_related":3}',
     'auto_applied', NULL, NULL, true, now() - interval '1 day'),

    -- RFI router actions
    (aa_09, ag_rfi, project_id, 'rfi_routing',
     'Routed RFI 047 regarding waterproofing detail at level 3 planter boxes to structural engineer and landscape architect. Found 2 similar resolved RFIs.',
     0.93,
     '{"rfi_number":"047","subject":"Waterproofing detail at L3 planter boxes"}',
     '{"assigned_to":["structural_engineer","landscape_architect"],"similar_rfis":["RFI-018","RFI-032"],"priority":"standard"}',
     'approved', user_mike, now() - interval '3 hours', true, now() - interval '2 hours'),

    -- Safety monitor actions
    (aa_10, ag_safety, project_id, 'ppe_violation',
     'Photo analysis detected 2 workers without hard hats on floor 16 active steel erection area. Timestamp 2026 03 26 at 14:23.',
     0.91,
     '{"photo_source":"field_capture","location":"floor_16","timestamp":"2026-03-26T14:23:00Z"}',
     '{"violation_type":"ppe_hard_hat","workers_count":2,"zone":"active_overhead_work","osha_ref":"1926.100(a)"}',
     'approved', user_mike, now() - interval '2 days', true, now() - interval '2 days'),

    -- Cost forecaster actions
    (aa_11, ag_cost, project_id, 'variance_alert',
     'Structural steel cost code 05 12 00 trending 4.2% over budget. Current spend $4,180,000 against $4,012,000 budgeted. Driven by connection hardware price escalation.',
     0.87,
     '{"cost_code":"05 12 00","budget":4012000,"actual":4180000}',
     '{"variance_percent":4.2,"variance_amount":168000,"driver":"material_price_escalation","forecast_at_complete":4350000}',
     'pending_review', NULL, NULL, false, NULL),

    -- Document classifier actions
    (aa_12, ag_document, project_id, 'auto_classify',
     'Classified 8 uploaded documents: 3 shop drawings filed to Division 05, 2 product data sheets to Division 08, 2 test reports to Division 03, 1 insurance certificate to project admin.',
     0.93,
     '{"documents_count":8,"upload_batch":"2026-03-25"}',
     '{"classified":8,"divisions":{"05":3,"08":2,"03":2,"admin":1},"confidence_avg":0.93}',
     'auto_applied', NULL, NULL, true, now() - interval '3 days');

  -- -------------------------------------------------------------------------
  -- Workforce Members: 15 across trades
  -- -------------------------------------------------------------------------
  INSERT INTO workforce_members (id, project_id, name, email, phone, company, trade, role, hourly_rate, overtime_rate, hire_date, status, skills, languages, emergency_contact_name, emergency_contact_phone) VALUES
    (wf_01, project_id, 'Carlos Ramirez', 'cramirez@apexsteel.com', '(555) 201 1001',
     'Apex Steel Fabricators', 'Ironworker', 'foreman',
     82.00, 123.00, '2025-06-15', 'active',
     '["structural_steel","welding","rigging","crane_signals"]',
     '["en","es"]',
     'Maria Ramirez', '(555) 201 9001'),

    (wf_02, project_id, 'James Washington', 'jwashington@apexsteel.com', '(555) 201 1002',
     'Apex Steel Fabricators', 'Ironworker', 'journeyman',
     72.00, 108.00, '2025-06-15', 'active',
     '["structural_steel","welding","bolt_up"]',
     '["en"]',
     'Linda Washington', '(555) 201 9002'),

    (wf_03, project_id, 'Miguel Torres', 'mtorres@apexsteel.com', '(555) 201 1003',
     'Apex Steel Fabricators', 'Ironworker', 'apprentice',
     45.00, 67.50, '2025-09-01', 'active',
     '["bolt_up","crane_signals"]',
     '["en","es"]',
     'Rosa Torres', '(555) 201 9003'),

    (wf_04, project_id, 'David Chen', 'dchen@metromechanical.com', '(555) 202 1004',
     'Metro Mechanical Contractors', 'Plumber', 'foreman',
     78.00, 117.00, '2025-07-01', 'active',
     '["copper_brazing","medical_gas","backflow","fire_protection"]',
     '["en","zh"]',
     'Wei Chen', '(555) 202 9004'),

    (wf_05, project_id, 'Robert Garcia', 'rgarcia@metromechanical.com', '(555) 202 1005',
     'Metro Mechanical Contractors', 'Plumber', 'journeyman',
     68.00, 102.00, '2025-07-01', 'active',
     '["copper_brazing","pvc","drainage"]',
     '["en","es"]',
     'Ana Garcia', '(555) 202 9005'),

    (wf_06, project_id, 'Kevin Nguyen', 'knguyen@lonestarelectric.com', '(555) 203 1006',
     'Lone Star Electric', 'Electrician', 'foreman',
     80.00, 120.00, '2025-08-01', 'active',
     '["conduit_bending","fire_alarm","medium_voltage","controls"]',
     '["en","vi"]',
     'Linh Nguyen', '(555) 203 9006'),

    (wf_07, project_id, 'Marcus Johnson', 'mjohnson@lonestarelectric.com', '(555) 203 1007',
     'Lone Star Electric', 'Electrician', 'journeyman',
     70.00, 105.00, '2025-08-01', 'active',
     '["conduit_bending","wire_pulling","panel_terminations"]',
     '["en"]',
     'Tanya Johnson', '(555) 203 9007'),

    (wf_08, project_id, 'Derek Williams', 'dwilliams@lonestarelectric.com', '(555) 203 1008',
     'Lone Star Electric', 'Electrician', 'apprentice',
     42.00, 63.00, '2026-01-15', 'active',
     '["wire_pulling","box_rough_in"]',
     '["en"]',
     'Sandra Williams', '(555) 203 9008'),

    (wf_09, project_id, 'Tony Morales', 'tmorales@capitolfire.com', '(555) 204 1009',
     'Capitol Fire Protection', 'Pipefitter', 'foreman',
     76.00, 114.00, '2025-09-15', 'active',
     '["sprinkler_systems","standpipe","fire_pump","threading"]',
     '["en","es"]',
     'Carmen Morales', '(555) 204 9009'),

    (wf_10, project_id, 'Ryan O''Brien', 'robrien@capitolfire.com', '(555) 204 1010',
     'Capitol Fire Protection', 'Pipefitter', 'journeyman',
     66.00, 99.00, '2025-09-15', 'active',
     '["sprinkler_systems","grooved_piping"]',
     '["en"]',
     'Megan O''Brien', '(555) 204 9010'),

    (wf_11, project_id, 'Frank Patterson', 'fpatterson@interiorpros.com', '(555) 205 1011',
     'Interior Pros LLC', 'Carpenter', 'foreman',
     74.00, 111.00, '2025-11-01', 'active',
     '["metal_framing","drywall","acoustical_ceiling","finish_carpentry"]',
     '["en"]',
     'Janet Patterson', '(555) 205 9011'),

    (wf_12, project_id, 'Luis Hernandez', 'lhernandez@interiorpros.com', '(555) 205 1012',
     'Interior Pros LLC', 'Carpenter', 'journeyman',
     62.00, 93.00, '2025-11-01', 'active',
     '["metal_framing","drywall","taping"]',
     '["en","es"]',
     'Elena Hernandez', '(555) 205 9012'),

    (wf_13, project_id, 'Ahmed Hassan', 'ahassan@metromechanical.com', '(555) 202 1013',
     'Metro Mechanical Contractors', 'HVAC Technician', 'journeyman',
     72.00, 108.00, '2025-10-01', 'active',
     '["ductwork","sheet_metal","controls","refrigeration"]',
     '["en","ar"]',
     'Fatima Hassan', '(555) 202 9013'),

    (wf_14, project_id, 'Jake Morrison', NULL, '(555) 206 1014',
     'Riverside General Contractors', 'Laborer', 'laborer',
     38.00, 57.00, '2025-06-01', 'active',
     '["concrete_placement","cleanup","material_handling","flagging"]',
     '["en"]',
     'Beth Morrison', '(555) 206 9014'),

    (wf_15, project_id, 'Andrei Volkov', 'avolkov@interiorpros.com', '(555) 205 1015',
     'Interior Pros LLC', 'Painter', 'journeyman',
     58.00, 87.00, '2026-02-01', 'active',
     '["spray_application","roller","fireproofing","epoxy"]',
     '["en","ru"]',
     'Natalia Volkov', '(555) 205 9015');

  -- -------------------------------------------------------------------------
  -- Workforce Assignments: 10 assignments
  -- -------------------------------------------------------------------------
  INSERT INTO workforce_assignments (id, workforce_member_id, project_id, crew_id, start_date, end_date, hours_per_day, status) VALUES
    (wa_01, wf_01, project_id, NULL, '2025-09-15', '2026-08-30', 10, 'active'),
    (wa_02, wf_02, project_id, NULL, '2025-09-15', '2026-08-30', 10, 'active'),
    (wa_03, wf_03, project_id, NULL, '2025-09-01', '2026-08-30', 8, 'active'),
    (wa_04, wf_04, project_id, NULL, '2025-10-01', '2026-06-30', 8, 'active'),
    (wa_05, wf_05, project_id, NULL, '2025-10-01', '2026-06-30', 8, 'active'),
    (wa_06, wf_06, project_id, NULL, '2025-11-01', '2026-09-30', 8, 'active'),
    (wa_07, wf_07, project_id, NULL, '2025-11-01', '2026-09-30', 8, 'active'),
    (wa_08, wf_11, project_id, NULL, '2025-11-01', '2027-01-31', 8, 'active'),
    (wa_09, wf_13, project_id, NULL, '2025-10-01', '2026-07-31', 8, 'active'),
    (wa_10, wf_14, project_id, NULL, '2025-06-01', '2027-03-31', 8, 'active');

  -- -------------------------------------------------------------------------
  -- Time Entries: 20 entries across recent days
  -- -------------------------------------------------------------------------
  INSERT INTO time_entries (id, workforce_member_id, project_id, date, clock_in, clock_out, regular_hours, overtime_hours, double_time_hours, break_minutes, cost_code, task_description, approved, approved_by, geolocation_in, geolocation_out) VALUES
    -- March 25 entries
    (te_01, wf_01, project_id, '2026-03-25',
     '2026-03-25 06:00:00-06', '2026-03-25 16:30:00-06',
     8, 2, 0, 30, '05 12 00',
     'Steel erection floor 17. Set 8 beams, 4 columns. Bolted connections on grid lines A through D.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_02, wf_02, project_id, '2026-03-25',
     '2026-03-25 06:00:00-06', '2026-03-25 16:30:00-06',
     8, 2, 0, 30, '05 12 00',
     'Steel erection floor 17. Assisted with beam placement and bolt up.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_03, wf_04, project_id, '2026-03-25',
     '2026-03-25 07:00:00-06', '2026-03-25 15:30:00-06',
     8, 0, 0, 30, '22 11 00',
     'Plumbing rough in floor 9. Installed copper supply lines and waste piping in units 901 through 904.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_04, wf_06, project_id, '2026-03-25',
     '2026-03-25 07:00:00-06', '2026-03-25 15:30:00-06',
     8, 0, 0, 30, '26 05 00',
     'Electrical rough in floor 8. Pulled wire in conduit runs, terminated 3 panels.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_05, wf_11, project_id, '2026-03-25',
     '2026-03-25 07:00:00-06', '2026-03-25 15:30:00-06',
     8, 0, 0, 30, '09 29 00',
     'Drywall hanging floor 7. Completed units 701 through 703, both sides of demising walls.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    -- March 26 entries
    (te_06, wf_01, project_id, '2026-03-26',
     '2026-03-26 06:00:00-06', '2026-03-26 16:30:00-06',
     8, 2, 0, 30, '05 12 00',
     'Steel erection floor 17 continued. 6 beam picks, started connection welding on grid E.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_07, wf_03, project_id, '2026-03-26',
     '2026-03-26 06:00:00-06', '2026-03-26 14:30:00-06',
     8, 0, 0, 30, '05 12 00',
     'Assisted with bolt up on floor 17 connections. Signaled crane for column sets.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_08, wf_05, project_id, '2026-03-26',
     '2026-03-26 07:00:00-06', '2026-03-26 15:30:00-06',
     8, 0, 0, 30, '22 11 00',
     'Plumbing rough in floor 9 continued. Waste piping for units 905 through 908. Pressure tested floor 8 lines.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_09, wf_07, project_id, '2026-03-26',
     '2026-03-26 07:00:00-06', '2026-03-26 15:30:00-06',
     8, 0, 0, 30, '26 05 00',
     'Wire pulling on floor 8, completed conduit runs in corridor. Started branch circuits in units.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_10, wf_09, project_id, '2026-03-26',
     '2026-03-26 07:00:00-06', '2026-03-26 15:30:00-06',
     8, 0, 0, 30, '21 13 00',
     'Fire sprinkler rough in floor 5. Installed branch lines and heads in corridor and units 501 through 506.',
     true, user_mike,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    -- March 27 entries
    (te_11, wf_01, project_id, '2026-03-27',
     '2026-03-27 06:00:00-06', '2026-03-27 17:00:00-06',
     8, 2, 1, 30, '05 12 00',
     'Floor 18 steel started. Set 6 columns, 8 beams. Overtime shift for critical path activities.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_12, wf_02, project_id, '2026-03-27',
     '2026-03-27 06:00:00-06', '2026-03-27 17:00:00-06',
     8, 2, 1, 30, '05 12 00',
     'Floor 18 steel erection support. Bolt up and plumbing on connections.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_13, wf_04, project_id, '2026-03-27',
     '2026-03-27 07:00:00-06', '2026-03-27 15:30:00-06',
     8, 0, 0, 30, '22 11 00',
     'Plumbing rough in floor 10 started. Laid out waste and vent piping for units 1001 through 1004.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_14, wf_08, project_id, '2026-03-27',
     '2026-03-27 07:00:00-06', '2026-03-27 15:30:00-06',
     8, 0, 0, 30, '26 05 00',
     'Box rough in on floor 9. Installed device boxes and junction boxes per layout.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_15, wf_12, project_id, '2026-03-27',
     '2026-03-27 07:00:00-06', '2026-03-27 15:30:00-06',
     8, 0, 0, 30, '09 29 00',
     'Metal framing floor 8 corridor. Installed studs and track for demising walls between units.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_16, wf_13, project_id, '2026-03-27',
     '2026-03-27 07:00:00-06', '2026-03-27 16:00:00-06',
     8, 1, 0, 30, '23 31 00',
     'HVAC ductwork installation floor 7. Hung main trunk line in corridor, connected 4 branch ducts.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_17, wf_10, project_id, '2026-03-27',
     '2026-03-27 07:00:00-06', '2026-03-27 15:30:00-06',
     8, 0, 0, 30, '21 13 00',
     'Fire sprinkler rough in floor 5 continued. Completed heads in units 507 through 512.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_18, wf_14, project_id, '2026-03-27',
     '2026-03-27 07:00:00-06', '2026-03-27 15:30:00-06',
     8, 0, 0, 30, '01 74 00',
     'General cleanup floors 5 and 6. Removed debris, organized material staging areas.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_19, wf_15, project_id, '2026-03-27',
     '2026-03-27 07:00:00-06', '2026-03-27 15:30:00-06',
     8, 0, 0, 30, '09 91 00',
     'Primer application floor 4 corridor and common areas. Two coats on drywall surfaces.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}'),

    (te_20, wf_11, project_id, '2026-03-27',
     '2026-03-27 07:00:00-06', '2026-03-27 16:00:00-06',
     8, 1, 0, 30, '09 29 00',
     'Drywall hanging floor 7 units 704 through 708. Overtime to stay ahead of taping crew.',
     false, NULL,
     '{"lat":30.2672,"lng":-97.7431}', '{"lat":30.2672,"lng":-97.7431}');

  -- -------------------------------------------------------------------------
  -- Labor Forecasts: 8 forecasts for upcoming weeks
  -- -------------------------------------------------------------------------
  INSERT INTO labor_forecasts (id, project_id, week_start, trade, headcount_needed, hours_needed, source, confidence) VALUES
    (lf_01, project_id, '2026-03-30', 'Ironworker', 6, 300, 'ai_predicted', 0.91),
    (lf_02, project_id, '2026-03-30', 'Electrician', 8, 320, 'ai_predicted', 0.88),
    (lf_03, project_id, '2026-03-30', 'Plumber', 5, 200, 'manual', NULL),
    (lf_04, project_id, '2026-03-30', 'Carpenter', 10, 400, 'ai_predicted', 0.85),
    (lf_05, project_id, '2026-04-06', 'Ironworker', 4, 200, 'ai_predicted', 0.87),
    (lf_06, project_id, '2026-04-06', 'Electrician', 10, 400, 'ai_predicted', 0.84),
    (lf_07, project_id, '2026-04-06', 'HVAC Technician', 6, 240, 'manual', NULL),
    (lf_08, project_id, '2026-04-06', 'Painter', 4, 160, 'ai_predicted', 0.82);

  -- -------------------------------------------------------------------------
  -- Permits: 6 permits (building approved, electrical approved, plumbing
  --   under review, mechanical not applied, fire approved, grading closed)
  -- -------------------------------------------------------------------------
  INSERT INTO permits (id, project_id, type, permit_number, jurisdiction, authority, status, applied_date, issued_date, expiration_date, fee, paid, conditions, special_inspections, documents, contact_name, contact_phone, notes, created_by) VALUES
    (pm_building, project_id, 'building',
     'BP-2025-04821', 'City of Austin', 'Austin Development Services Department',
     'approved',
     '2025-03-15', '2025-05-28', '2027-05-28',
     125000, true,
     'Comply with 2021 IBC and all local amendments. Third party special inspections required for structural steel, concrete, and fireproofing. Weekly progress reports to building official.',
     '["structural_steel_welding","concrete_placement","fireproofing","post_tensioning"]',
     '[{"name":"Building Permit.pdf","url":"https://storage.sitesync.ai/permits/bp-2025-04821.pdf"},{"name":"Approved Plans.pdf","url":"https://storage.sitesync.ai/permits/bp-2025-04821-plans.pdf"}]',
     'Jennifer Walsh', '(512) 974 2000',
     'Master building permit for 22 story mixed use tower. All plan review comments resolved. Special inspection agency: Terracon.',
     user_mike),

    (pm_electrical, project_id, 'electrical',
     'EP-2025-11340', 'City of Austin', 'Austin Development Services Department',
     'approved',
     '2025-06-10', '2025-07-22', '2027-07-22',
     18500, true,
     'Comply with 2020 NEC. Medium voltage switchgear inspection required prior to energization. Emergency generator load bank test required.',
     '["medium_voltage","emergency_power","fire_alarm"]',
     '[{"name":"Electrical Permit.pdf","url":"https://storage.sitesync.ai/permits/ep-2025-11340.pdf"}]',
     'Robert Tran', '(512) 974 2100',
     'Electrical permit for full building. Covers service entrance, distribution, lighting, fire alarm, and low voltage systems.',
     user_mike),

    (pm_plumbing, project_id, 'plumbing',
     'PP-2026-00892', 'City of Austin', 'Austin Development Services Department',
     'under_review',
     '2026-02-20', NULL, NULL,
     12000, true,
     NULL,
     '[]',
     '[{"name":"Plumbing Application.pdf","url":"https://storage.sitesync.ai/permits/pp-2026-00892-app.pdf"}]',
     'Robert Tran', '(512) 974 2100',
     'Plumbing permit for floors 8 through 22 residential units. Application submitted with revised mechanical room layouts. Plan review comments expected by April 1.',
     user_mike),

    (pm_mechanical, project_id, 'mechanical',
     NULL, 'City of Austin', 'Austin Development Services Department',
     'not_applied',
     NULL, NULL, NULL,
     NULL, false,
     NULL,
     '[]',
     '[]',
     'Robert Tran', '(512) 974 2100',
     'Mechanical permit for rooftop equipment installation. Waiting on final equipment submittals before applying. Target application date April 15.',
     user_mike),

    (pm_fire, project_id, 'fire',
     'FP-2025-07650', 'City of Austin', 'Austin Fire Department',
     'approved',
     '2025-05-01', '2025-06-15', '2027-06-15',
     22000, true,
     'Fire sprinkler shop drawings approved. Standpipe system required during construction per AFD directive. Fire watch required during all hot work operations.',
     '["sprinkler_system","standpipe","fire_pump","smoke_control"]',
     '[{"name":"Fire Permit.pdf","url":"https://storage.sitesync.ai/permits/fp-2025-07650.pdf"},{"name":"Sprinkler Shop Drawings.pdf","url":"https://storage.sitesync.ai/permits/fp-2025-07650-sprinkler.pdf"}]',
     'Captain Mike Davis', '(512) 974 0130',
     'Fire protection permit covering sprinkler, standpipe, fire pump, and smoke control systems. AFD plan review approved with no comments.',
     user_mike),

    (pm_grading, project_id, 'grading',
     'GP-2025-02110', 'City of Austin', 'Austin Watershed Protection Department',
     'closed',
     '2025-02-01', '2025-03-10', '2026-03-10',
     8500, true,
     'SWPPP required and on file. Erosion controls must be maintained through final stabilization. Weekly inspections required during active grading.',
     '[]',
     '[{"name":"Grading Permit.pdf","url":"https://storage.sitesync.ai/permits/gp-2025-02110.pdf"},{"name":"SWPPP.pdf","url":"https://storage.sitesync.ai/permits/gp-2025-02110-swppp.pdf"},{"name":"Close Out Letter.pdf","url":"https://storage.sitesync.ai/permits/gp-2025-02110-closeout.pdf"}]',
     'Amanda Reyes', '(512) 974 2550',
     'Grading permit for site preparation and mass excavation. All grading complete, final stabilization achieved, permit closed out March 2026.',
     user_mike);

  -- -------------------------------------------------------------------------
  -- Permit Inspections: 10 inspections linked to permits
  -- -------------------------------------------------------------------------
  INSERT INTO permit_inspections (id, permit_id, type, status, scheduled_date, inspector_name, result_notes, corrections_required, re_inspection_date) VALUES
    -- Building permit inspections
    (pi_01, pm_building, 'foundation', 'passed',
     '2025-08-15', 'Gary Mitchell',
     'Foundation inspection passed. Rebar placement and concrete mix verified per approved plans. No deficiencies noted.',
     NULL, NULL),

    (pi_02, pm_building, 'framing', 'passed',
     '2026-01-20', 'Gary Mitchell',
     'Structural steel framing inspection for floors 1 through 12 passed. All connections per approved shop drawings. Fireproofing thickness verified.',
     NULL, NULL),

    (pi_03, pm_building, 'framing', 'scheduled',
     '2026-04-15', NULL,
     NULL, NULL, NULL),

    (pi_04, pm_building, 'rough_in', 'scheduled',
     '2026-05-01', NULL,
     NULL, NULL, NULL),

    -- Electrical permit inspections
    (pi_05, pm_electrical, 'rough_in', 'passed',
     '2026-02-10', 'Steve Park',
     'Electrical rough in floors 3 through 7 passed. Conduit fill ratios within code. Box fill calculations verified.',
     NULL, NULL),

    (pi_06, pm_electrical, 'rough_in', 'scheduled',
     '2026-04-20', NULL,
     NULL, NULL, NULL),

    -- Fire permit inspections
    (pi_07, pm_fire, 'rough_in', 'passed',
     '2026-01-28', 'Captain James Rivera',
     'Sprinkler rough in floors 1 through 4 passed. Branch line spacing and head coverage per NFPA 13. Hydrostatic test at 200 PSI for 2 hours, no leaks.',
     NULL, NULL),

    (pi_08, pm_fire, 'rough_in', 'failed',
     '2026-03-15', 'Captain James Rivera',
     'Sprinkler rough in floors 5 through 6 failed. Three heads in corridor on floor 5 exceed maximum spacing per NFPA 13.',
     'Relocate 3 sprinkler heads in floor 5 corridor to meet 15 foot maximum spacing requirement per NFPA 13 Section 8.6.2.',
     '2026-04-01'),

    (pi_09, pm_fire, 'special', 'scheduled',
     '2026-04-10', NULL,
     NULL, NULL, NULL),

    -- Grading permit inspection
    (pi_10, pm_grading, 'final', 'passed',
     '2026-02-28', 'Amanda Reyes',
     'Final grading inspection passed. All erosion controls functioning. Site stabilized with permanent landscaping and hardscape. SWPPP terminated.',
     NULL, NULL);

END $$;
