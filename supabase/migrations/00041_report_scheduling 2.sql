-- Report Templates and Scheduled Delivery
-- Enables saved report configurations and automated weekly/monthly delivery via email.

-- Saved report templates
CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  report_type text NOT NULL
    CHECK (report_type IN (
      'executive_summary', 'monthly_progress', 'cost_report',
      'schedule_report', 'subcontractor_performance',
      'rfi_log', 'submittal_log', 'punch_list',
      'daily_log_summary', 'safety_report', 'budget_report'
    )),
  config jsonb DEFAULT '{}', -- Filters, date ranges, sections to include
  format text DEFAULT 'pdf' CHECK (format IN ('pdf', 'xlsx')),
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_report_templates_project ON report_templates(project_id);

ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_templates_select ON report_templates FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY report_templates_insert ON report_templates FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY report_templates_update ON report_templates FOR UPDATE
  USING (created_by = auth.uid() OR project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY report_templates_delete ON report_templates FOR DELETE
  USING (created_by = auth.uid() OR project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Scheduled report delivery
CREATE TABLE IF NOT EXISTS report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES report_templates(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  day_of_week int CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, for weekly/biweekly
  day_of_month int CHECK (day_of_month BETWEEN 1 AND 28), -- for monthly
  time_utc time DEFAULT '08:00:00',
  recipients text[] NOT NULL DEFAULT '{}', -- email addresses
  active boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_count int DEFAULT 0,
  last_error text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_report_schedules_project ON report_schedules(project_id);
CREATE INDEX idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE active = true;

ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_schedules_select ON report_schedules FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY report_schedules_insert ON report_schedules FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'project_manager')));

CREATE POLICY report_schedules_update ON report_schedules FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'project_manager')));

CREATE POLICY report_schedules_delete ON report_schedules FOR DELETE
  USING (created_by = auth.uid() OR project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Report generation log
CREATE TABLE IF NOT EXISTS report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES report_templates(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES report_schedules(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  report_type text NOT NULL,
  format text NOT NULL DEFAULT 'pdf',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  storage_path text, -- Supabase Storage path for generated file
  file_size int,
  error text,
  generated_by uuid REFERENCES auth.users(id),
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_report_runs_project ON report_runs(project_id);
CREATE INDEX idx_report_runs_template ON report_runs(template_id);

ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_runs_select ON report_runs FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY report_runs_insert ON report_runs FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

-- Function to calculate next_run_at for a schedule
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_frequency text,
  p_day_of_week int,
  p_day_of_month int,
  p_time_utc time
) RETURNS timestamptz AS $$
DECLARE
  v_next timestamptz;
  v_now timestamptz := now();
BEGIN
  CASE p_frequency
    WHEN 'daily' THEN
      v_next := date_trunc('day', v_now) + p_time_utc::interval;
      IF v_next <= v_now THEN v_next := v_next + interval '1 day'; END IF;
    WHEN 'weekly' THEN
      v_next := date_trunc('week', v_now) + (p_day_of_week || ' days')::interval + p_time_utc::interval;
      IF v_next <= v_now THEN v_next := v_next + interval '1 week'; END IF;
    WHEN 'biweekly' THEN
      v_next := date_trunc('week', v_now) + (p_day_of_week || ' days')::interval + p_time_utc::interval;
      IF v_next <= v_now THEN v_next := v_next + interval '2 weeks'; END IF;
    WHEN 'monthly' THEN
      v_next := date_trunc('month', v_now) + ((p_day_of_month - 1) || ' days')::interval + p_time_utc::interval;
      IF v_next <= v_now THEN v_next := v_next + interval '1 month'; END IF;
    ELSE
      v_next := v_now + interval '1 week';
  END CASE;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-set next_run_at on insert
CREATE OR REPLACE FUNCTION set_next_run_at()
RETURNS trigger AS $$
BEGIN
  NEW.next_run_at := calculate_next_run(NEW.frequency, NEW.day_of_week, NEW.day_of_month, NEW.time_utc);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_schedules_set_next_run
  BEFORE INSERT OR UPDATE OF frequency, day_of_week, day_of_month, time_utc ON report_schedules
  FOR EACH ROW EXECUTE FUNCTION set_next_run_at();

-- Updated at triggers
CREATE TRIGGER set_report_templates_updated_at BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_report_schedules_updated_at BEFORE UPDATE ON report_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
