-- Construction-Specific Workflow Tables

-- Closeout Management
CREATE TABLE IF NOT EXISTS closeout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  trade text NOT NULL,
  category text CHECK (category IN ('as_built','oam_manual','warranty','training','attic_stock','final_inspection','certificate','close_out_docs','test_report','commissioning')),
  description text NOT NULL,
  status text DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','submitted','approved','na')),
  assigned_to uuid REFERENCES auth.users,
  due_date date,
  completed_date date,
  document_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_closeout_project ON closeout_items(project_id);
CREATE INDEX idx_closeout_status ON closeout_items(status);
CREATE INDEX idx_closeout_trade ON closeout_items(trade);

ALTER TABLE closeout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ci_select ON closeout_items FOR SELECT USING (is_project_member(project_id));
CREATE POLICY ci_insert ON closeout_items FOR INSERT WITH CHECK (is_project_role(project_id, ARRAY['owner','admin','member']));
CREATE POLICY ci_update ON closeout_items FOR UPDATE USING (is_project_role(project_id, ARRAY['owner','admin','member']));
CREATE POLICY ci_delete ON closeout_items FOR DELETE USING (is_project_role(project_id, ARRAY['owner','admin']));

CREATE TRIGGER set_closeout_updated_at BEFORE UPDATE ON closeout_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Weather Records (daily auto-recorded)
CREATE TABLE IF NOT EXISTS weather_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  temperature_high int,
  temperature_low int,
  conditions text,
  wind_speed text,
  precipitation text,
  precipitation_amount numeric,
  humidity int,
  is_weather_day boolean DEFAULT false,
  impact_description text,
  delay_hours numeric DEFAULT 0,
  source text DEFAULT 'manual' CHECK (source IN ('manual','api','daily_log')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, date)
);

CREATE INDEX idx_weather_project_date ON weather_records(project_id, date);
CREATE INDEX idx_weather_delay ON weather_records(project_id) WHERE is_weather_day = true;

ALTER TABLE weather_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY wr_select ON weather_records FOR SELECT USING (is_project_member(project_id));
CREATE POLICY wr_insert ON weather_records FOR INSERT WITH CHECK (is_project_role(project_id, ARRAY['owner','admin','member']));
CREATE POLICY wr_update ON weather_records FOR UPDATE USING (is_project_role(project_id, ARRAY['owner','admin','member']));

-- Lean Construction: Weekly Work Plan commitments
CREATE TABLE IF NOT EXISTS weekly_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  task_id uuid REFERENCES tasks,
  description text NOT NULL,
  trade text,
  crew_id uuid REFERENCES crews,
  committed_by uuid REFERENCES auth.users,
  status text DEFAULT 'committed' CHECK (status IN ('committed','completed','not_completed')),
  reason_not_completed text,
  constraint_type text CHECK (constraint_type IN ('material','labor','equipment','predecessor','inspection','weather','design','permit','other')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_commitments_project_week ON weekly_commitments(project_id, week_start);
CREATE INDEX idx_commitments_status ON weekly_commitments(status);

ALTER TABLE weekly_commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY wc_select ON weekly_commitments FOR SELECT USING (is_project_member(project_id));
CREATE POLICY wc_insert ON weekly_commitments FOR INSERT WITH CHECK (is_project_role(project_id, ARRAY['owner','admin','member']));
CREATE POLICY wc_update ON weekly_commitments FOR UPDATE USING (is_project_role(project_id, ARRAY['owner','admin','member']));

-- Enhance tasks with lookahead fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS constraint_notes text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS weather_dependent boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS inspection_required boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS material_delivery_required boolean DEFAULT false;

-- Enhance purchase_orders with long-lead tracking
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS is_long_lead boolean DEFAULT false;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS lead_time_weeks int;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS needed_on_site_date date;
