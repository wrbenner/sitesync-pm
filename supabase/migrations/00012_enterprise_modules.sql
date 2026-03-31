-- =============================================================================
-- SiteSync AI: Enterprise Modules
-- Integrations, custom reports, sustainability tracking, waste management,
-- warranties, and warranty claims.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Integrations
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  type text NOT NULL
    CHECK (type IN ('quickbooks','sage','procore_import','ms_project','google_drive','dropbox','autodesk_bim360','bluebeam','docusign','zapier_webhook')),
  status text DEFAULT 'disconnected'
    CHECK (status IN ('connected','disconnected','error')),
  config jsonb DEFAULT '{}',
  last_sync timestamptz,
  sync_frequency text
    CHECK (sync_frequency IN ('realtime','hourly','daily','manual')),
  error_log jsonb DEFAULT '[]',
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Integration Sync Log
CREATE TABLE integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integrations ON DELETE CASCADE NOT NULL,
  direction text
    CHECK (direction IN ('import','export','bidirectional')),
  records_synced int DEFAULT 0,
  records_failed int DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text
    CHECK (status IN ('success','partial','failed')),
  error_details jsonb DEFAULT '[]'
);

-- Custom Reports
CREATE TABLE custom_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects,
  organization_id uuid,
  name text NOT NULL,
  description text,
  type text
    CHECK (type IN ('table','chart','dashboard','document')),
  data_source text,
  filters jsonb DEFAULT '{}',
  columns jsonb DEFAULT '[]',
  grouping jsonb DEFAULT '[]',
  sorting jsonb DEFAULT '[]',
  chart_type text,
  chart_config jsonb DEFAULT '{}',
  schedule text DEFAULT 'none'
    CHECK (schedule IN ('none','daily','weekly','monthly')),
  recipients jsonb DEFAULT '[]',
  is_template boolean DEFAULT false,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sustainability Metrics
CREATE TABLE sustainability_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  category text
    CHECK (category IN ('energy','water','materials','waste','emissions','indoor_air','site','innovation')),
  metric_name text NOT NULL,
  target_value numeric,
  actual_value numeric,
  unit text,
  reporting_period date,
  source text,
  leed_credit text,
  leed_points numeric,
  notes text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Waste Logs
CREATE TABLE waste_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  date date,
  material_type text
    CHECK (material_type IN ('concrete','wood','metal','drywall','packaging','hazardous','general','soil')),
  quantity numeric,
  unit text
    CHECK (unit IN ('tons','cubic_yards','loads')),
  disposition text
    CHECK (disposition IN ('landfill','recycled','reused','donated','hazardous_disposal')),
  hauler text,
  manifest_number text,
  cost numeric,
  document_url text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

-- Warranties
CREATE TABLE warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  item text NOT NULL,
  category text
    CHECK (category IN ('roofing','hvac','electrical','plumbing','envelope','flooring','painting','equipment','structural','site')),
  subcontractor text,
  manufacturer text,
  warranty_type text
    CHECK (warranty_type IN ('material','labor','performance','extended')),
  start_date date,
  duration_years numeric,
  expiration_date date,
  coverage_description text,
  limitations text,
  document_url text,
  contact_name text,
  contact_phone text,
  contact_email text,
  status text DEFAULT 'active'
    CHECK (status IN ('active','expiring_soon','expired','claimed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Warranty Claims
CREATE TABLE warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_id uuid REFERENCES warranties ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  claim_date date,
  description text NOT NULL,
  location text,
  severity text
    CHECK (severity IN ('minor','moderate','major','critical')),
  status text DEFAULT 'reported'
    CHECK (status IN ('reported','acknowledged','in_repair','resolved','disputed')),
  resolution text,
  resolution_date date,
  cost numeric,
  photos jsonb DEFAULT '[]',
  documents jsonb DEFAULT '[]',
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- Integrations
CREATE INDEX idx_integrations_organization ON integrations (organization_id);
CREATE INDEX idx_integrations_type ON integrations (type);
CREATE INDEX idx_integrations_status ON integrations (status);
CREATE INDEX idx_integrations_created_by ON integrations (created_by);

-- Integration Sync Log
CREATE INDEX idx_integration_sync_log_integration ON integration_sync_log (integration_id);
CREATE INDEX idx_integration_sync_log_status ON integration_sync_log (status);
CREATE INDEX idx_integration_sync_log_started_at ON integration_sync_log (started_at);

-- Custom Reports
CREATE INDEX idx_custom_reports_project ON custom_reports (project_id);
CREATE INDEX idx_custom_reports_organization ON custom_reports (organization_id);
CREATE INDEX idx_custom_reports_type ON custom_reports (type);
CREATE INDEX idx_custom_reports_schedule ON custom_reports (schedule);
CREATE INDEX idx_custom_reports_created_by ON custom_reports (created_by);
CREATE INDEX idx_custom_reports_is_template ON custom_reports (is_template);

-- Sustainability Metrics
CREATE INDEX idx_sustainability_metrics_project ON sustainability_metrics (project_id);
CREATE INDEX idx_sustainability_metrics_category ON sustainability_metrics (category);
CREATE INDEX idx_sustainability_metrics_reporting_period ON sustainability_metrics (reporting_period);
CREATE INDEX idx_sustainability_metrics_created_by ON sustainability_metrics (created_by);

-- Waste Logs
CREATE INDEX idx_waste_logs_project ON waste_logs (project_id);
CREATE INDEX idx_waste_logs_date ON waste_logs (date);
CREATE INDEX idx_waste_logs_material_type ON waste_logs (material_type);
CREATE INDEX idx_waste_logs_disposition ON waste_logs (disposition);
CREATE INDEX idx_waste_logs_created_by ON waste_logs (created_by);

-- Warranties
CREATE INDEX idx_warranties_project ON warranties (project_id);
CREATE INDEX idx_warranties_category ON warranties (category);
CREATE INDEX idx_warranties_status ON warranties (status);
CREATE INDEX idx_warranties_expiration_date ON warranties (expiration_date);
CREATE INDEX idx_warranties_warranty_type ON warranties (warranty_type);

-- Warranty Claims
CREATE INDEX idx_warranty_claims_warranty ON warranty_claims (warranty_id);
CREATE INDEX idx_warranty_claims_project ON warranty_claims (project_id);
CREATE INDEX idx_warranty_claims_status ON warranty_claims (status);
CREATE INDEX idx_warranty_claims_severity ON warranty_claims (severity);
CREATE INDEX idx_warranty_claims_claim_date ON warranty_claims (claim_date);
CREATE INDEX idx_warranty_claims_created_by ON warranty_claims (created_by);

-- ---------------------------------------------------------------------------
-- 3. Updated At Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_custom_reports_updated_at
  BEFORE UPDATE ON custom_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_sustainability_metrics_updated_at
  BEFORE UPDATE ON sustainability_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_warranties_updated_at
  BEFORE UPDATE ON warranties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_warranty_claims_updated_at
  BEFORE UPDATE ON warranty_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sustainability_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;

-- Integrations: accessible by all authenticated users
CREATE POLICY integrations_select ON integrations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY integrations_insert ON integrations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY integrations_update ON integrations FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY integrations_delete ON integrations FOR DELETE
  USING (auth.role() = 'authenticated');

-- Integration Sync Log: accessible via parent integration (authenticated users)
CREATE POLICY integration_sync_log_select ON integration_sync_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY integration_sync_log_insert ON integration_sync_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY integration_sync_log_update ON integration_sync_log FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY integration_sync_log_delete ON integration_sync_log FOR DELETE
  USING (auth.role() = 'authenticated');

-- Custom Reports: accessible by all authenticated users
CREATE POLICY custom_reports_select ON custom_reports FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY custom_reports_insert ON custom_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY custom_reports_update ON custom_reports FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY custom_reports_delete ON custom_reports FOR DELETE
  USING (auth.role() = 'authenticated');

-- Sustainability Metrics: project members
CREATE POLICY sustainability_metrics_select ON sustainability_metrics FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY sustainability_metrics_insert ON sustainability_metrics FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY sustainability_metrics_update ON sustainability_metrics FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY sustainability_metrics_delete ON sustainability_metrics FOR DELETE
  USING (is_project_member(project_id));

-- Waste Logs: project members
CREATE POLICY waste_logs_select ON waste_logs FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY waste_logs_insert ON waste_logs FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY waste_logs_update ON waste_logs FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY waste_logs_delete ON waste_logs FOR DELETE
  USING (is_project_member(project_id));

-- Warranties: project members
CREATE POLICY warranties_select ON warranties FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY warranties_insert ON warranties FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY warranties_update ON warranties FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY warranties_delete ON warranties FOR DELETE
  USING (is_project_member(project_id));

-- Warranty Claims: project members (direct via project_id)
CREATE POLICY warranty_claims_select ON warranty_claims FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY warranty_claims_insert ON warranty_claims FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY warranty_claims_update ON warranty_claims FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY warranty_claims_delete ON warranty_claims FOR DELETE
  USING (is_project_member(project_id));

