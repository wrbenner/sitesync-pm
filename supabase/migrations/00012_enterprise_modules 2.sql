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

-- =============================================================================
-- Seed Data
-- =============================================================================

DO $$
DECLARE
  user_mike UUID := '11111111-1111-1111-1111-111111111111';
  project_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  org_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  -- Integration IDs
  int_quickbooks UUID := 'ff120001-0000-0000-0000-000000000001';
  int_zapier UUID := 'ff120001-0000-0000-0000-000000000002';
  int_gdrive UUID := 'ff120001-0000-0000-0000-000000000003';

  -- Integration Sync Log IDs
  sync_01 UUID := 'ff120002-0000-0000-0000-000000000001';
  sync_02 UUID := 'ff120002-0000-0000-0000-000000000002';

  -- Custom Report IDs
  rpt_01 UUID := 'ff120003-0000-0000-0000-000000000001';
  rpt_02 UUID := 'ff120003-0000-0000-0000-000000000002';
  rpt_03 UUID := 'ff120003-0000-0000-0000-000000000003';
  rpt_04 UUID := 'ff120003-0000-0000-0000-000000000004';
  rpt_05 UUID := 'ff120003-0000-0000-0000-000000000005';

  -- Sustainability Metric IDs
  sm_01 UUID := 'ff120004-0000-0000-0000-000000000001';
  sm_02 UUID := 'ff120004-0000-0000-0000-000000000002';
  sm_03 UUID := 'ff120004-0000-0000-0000-000000000003';
  sm_04 UUID := 'ff120004-0000-0000-0000-000000000004';
  sm_05 UUID := 'ff120004-0000-0000-0000-000000000005';
  sm_06 UUID := 'ff120004-0000-0000-0000-000000000006';
  sm_07 UUID := 'ff120004-0000-0000-0000-000000000007';
  sm_08 UUID := 'ff120004-0000-0000-0000-000000000008';
  sm_09 UUID := 'ff120004-0000-0000-0000-000000000009';
  sm_10 UUID := 'ff120004-0000-0000-0000-000000000010';
  sm_11 UUID := 'ff120004-0000-0000-0000-000000000011';
  sm_12 UUID := 'ff120004-0000-0000-0000-000000000012';

  -- Waste Log IDs
  wl_01 UUID := 'ff120005-0000-0000-0000-000000000001';
  wl_02 UUID := 'ff120005-0000-0000-0000-000000000002';
  wl_03 UUID := 'ff120005-0000-0000-0000-000000000003';
  wl_04 UUID := 'ff120005-0000-0000-0000-000000000004';
  wl_05 UUID := 'ff120005-0000-0000-0000-000000000005';
  wl_06 UUID := 'ff120005-0000-0000-0000-000000000006';
  wl_07 UUID := 'ff120005-0000-0000-0000-000000000007';
  wl_08 UUID := 'ff120005-0000-0000-0000-000000000008';

  -- Warranty IDs
  wr_01 UUID := 'ff120006-0000-0000-0000-000000000001';
  wr_02 UUID := 'ff120006-0000-0000-0000-000000000002';
  wr_03 UUID := 'ff120006-0000-0000-0000-000000000003';
  wr_04 UUID := 'ff120006-0000-0000-0000-000000000004';
  wr_05 UUID := 'ff120006-0000-0000-0000-000000000005';
  wr_06 UUID := 'ff120006-0000-0000-0000-000000000006';
  wr_07 UUID := 'ff120006-0000-0000-0000-000000000007';
  wr_08 UUID := 'ff120006-0000-0000-0000-000000000008';
  wr_09 UUID := 'ff120006-0000-0000-0000-000000000009';
  wr_10 UUID := 'ff120006-0000-0000-0000-000000000010';

  -- Warranty Claim IDs
  wc_01 UUID := 'ff120007-0000-0000-0000-000000000001';
  wc_02 UUID := 'ff120007-0000-0000-0000-000000000002';

BEGIN

  -- -------------------------------------------------------------------------
  -- Integrations
  -- -------------------------------------------------------------------------
  INSERT INTO integrations (id, organization_id, type, status, config, last_sync, sync_frequency, error_log, created_by) VALUES
    (int_quickbooks, org_id, 'quickbooks', 'connected',
     '{"company_id": "QBO-4829371", "realm_id": "9130349182", "sync_invoices": true, "sync_payments": true, "sync_vendors": true, "map_cost_codes": true}'::jsonb,
     now() - interval '2 hours', 'hourly', '[]'::jsonb, user_mike),
    (int_zapier, org_id, 'zapier_webhook', 'connected',
     '{"webhook_url": "https://hooks.zapier.com/hooks/catch/12345/abcdef", "events": ["rfi_created","submittal_approved","daily_log_submitted","change_order_approved"]}'::jsonb,
     now() - interval '30 minutes', 'realtime', '[]'::jsonb, user_mike),
    (int_gdrive, org_id, 'google_drive', 'disconnected',
     '{"folder_id": null, "auto_upload_drawings": false}'::jsonb,
     NULL, 'daily', '[]'::jsonb, user_mike);

  -- -------------------------------------------------------------------------
  -- Integration Sync Log
  -- -------------------------------------------------------------------------
  INSERT INTO integration_sync_log (id, integration_id, direction, records_synced, records_failed, started_at, completed_at, status, error_details) VALUES
    (sync_01, int_quickbooks, 'bidirectional', 47, 0,
     now() - interval '2 hours', now() - interval '1 hour 58 minutes', 'success', '[]'::jsonb),
    (sync_02, int_quickbooks, 'export', 12, 2,
     now() - interval '26 hours', now() - interval '25 hours 55 minutes', 'partial',
     '[{"record":"INV-2084","error":"Duplicate customer reference"},{"record":"INV-2091","error":"Missing tax code mapping"}]'::jsonb);

  -- -------------------------------------------------------------------------
  -- Custom Reports (Templates)
  -- -------------------------------------------------------------------------
  INSERT INTO custom_reports (id, project_id, organization_id, name, description, type, data_source, filters, columns, grouping, sorting, chart_type, chart_config, schedule, recipients, is_template, created_by) VALUES
    (rpt_01, project_id, org_id, 'Monthly Progress Report',
     'Comprehensive monthly summary of project schedule, budget, and milestones',
     'document', 'projects',
     '{"date_range": "last_30_days"}'::jsonb,
     '["schedule_status","budget_summary","milestone_tracker","rfi_summary","submittal_summary","safety_incidents"]'::jsonb,
     '["category"]'::jsonb, '["date_desc"]'::jsonb,
     NULL, '{}'::jsonb,
     'monthly', '["pm@constructco.com","owner@clientcorp.com"]'::jsonb,
     true, user_mike),

    (rpt_02, project_id, org_id, 'RFI Aging Analysis',
     'Track open RFIs by age, assignee, and ball in court status',
     'chart', 'rfis',
     '{"status": ["open","in_review"]}'::jsonb,
     '["rfi_number","subject","days_open","assigned_to","ball_in_court"]'::jsonb,
     '["assigned_to"]'::jsonb, '["days_open_desc"]'::jsonb,
     'bar', '{"x_axis": "age_bucket", "y_axis": "count", "color_by": "priority"}'::jsonb,
     'weekly', '["pm@constructco.com"]'::jsonb,
     true, user_mike),

    (rpt_03, project_id, org_id, 'Punch List Summary',
     'Status breakdown of punch list items by trade and location',
     'table', 'punch_list_items',
     '{"status": ["open","in_progress"]}'::jsonb,
     '["item_number","description","location","trade","status","assigned_to","due_date"]'::jsonb,
     '["trade","location"]'::jsonb, '["due_date_asc"]'::jsonb,
     NULL, '{}'::jsonb,
     'daily', '["super@constructco.com"]'::jsonb,
     true, user_mike),

    (rpt_04, project_id, org_id, 'Budget Variance Report',
     'Cost code level comparison of budgeted vs actual spend with forecasting',
     'chart', 'budget_items',
     '{}'::jsonb,
     '["cost_code","description","budget","committed","actual","variance","percent_complete"]'::jsonb,
     '["division"]'::jsonb, '["variance_desc"]'::jsonb,
     'bar', '{"x_axis": "cost_code", "y_axis": "amount", "series": ["budget","actual","forecast"], "stacked": false}'::jsonb,
     'weekly', '["pm@constructco.com","cfo@constructco.com"]'::jsonb,
     true, user_mike),

    (rpt_05, project_id, org_id, 'Safety Summary Dashboard',
     'Weekly safety metrics including incidents, near misses, toolbox talks, and inspection scores',
     'dashboard', 'safety_incidents',
     '{"date_range": "last_7_days"}'::jsonb,
     '["incident_count","near_miss_count","toolbox_talks","inspection_avg_score","days_without_incident"]'::jsonb,
     '["week"]'::jsonb, '["date_desc"]'::jsonb,
     'line', '{"x_axis": "week", "y_axis": "score", "show_trend": true}'::jsonb,
     'weekly', '["safety@constructco.com","pm@constructco.com"]'::jsonb,
     true, user_mike);

  -- -------------------------------------------------------------------------
  -- Sustainability Metrics (12 across LEED categories)
  -- -------------------------------------------------------------------------
  INSERT INTO sustainability_metrics (id, project_id, category, metric_name, target_value, actual_value, unit, reporting_period, source, leed_credit, leed_points, notes, created_by) VALUES
    (sm_01, project_id, 'energy', 'Energy Use Intensity (EUI)',
     85, 78.2, 'kBtu/sf/yr', '2026-03-01', 'Energy model v3.2',
     'EA Credit 1', 6, 'Exceeding baseline by 18%. LED retrofit completed on floors 3 through 8.', user_mike),

    (sm_02, project_id, 'energy', 'Renewable Energy Generation',
     120000, 98500, 'kWh/yr', '2026-03-01', 'Solar array monitoring',
     'EA Credit 2', 2, 'Rooftop PV system at 82% of target. Additional panels scheduled for April.', user_mike),

    (sm_03, project_id, 'water', 'Indoor Water Use Reduction',
     40, 37.5, 'percent', '2026-03-01', 'Fixture schedule calculation',
     'WE Credit 2', 4, 'Low flow fixtures installed on all floors. Greywater system pending commissioning.', user_mike),

    (sm_04, project_id, 'water', 'Outdoor Water Use Reduction',
     50, 62, 'percent', '2026-03-01', 'Landscape water budget',
     'WE Credit 1', 2, 'Native landscaping exceeds target. Drip irrigation fully operational.', user_mike),

    (sm_05, project_id, 'materials', 'Recycled Content',
     20, 24.3, 'percent', '2026-03-01', 'Material tracking log',
     'MR Credit 4', 2, 'Steel, concrete, and carpet tile contributing most recycled content by value.', user_mike),

    (sm_06, project_id, 'materials', 'Regional Materials',
     20, 31.7, 'percent', '2026-03-01', 'Procurement records',
     'MR Credit 5', 2, 'Concrete, masonry, and lumber sourced within 500 miles.', user_mike),

    (sm_07, project_id, 'waste', 'Construction Waste Diversion Rate',
     75, 81.4, 'percent', '2026-03-01', 'Waste hauler reports',
     'MR Credit 2', 2, 'Concrete and metal recycling driving high diversion. Drywall recycling program added in February.', user_mike),

    (sm_08, project_id, 'emissions', 'Embodied Carbon (Structure)',
     NULL, 342, 'kgCO2e/m2', '2026-03-01', 'One Click LCA analysis',
     NULL, NULL, 'Baseline assessment complete. Exploring low carbon concrete mixes for remaining pours.', user_mike),

    (sm_09, project_id, 'indoor_air', 'Low Emitting Materials Compliance',
     100, 95, 'percent', '2026-03-01', 'Product submittals review',
     'IEQ Credit 4', 4, 'Two adhesive products pending CDPH certification. Substitutions identified.', user_mike),

    (sm_10, project_id, 'indoor_air', 'IAQ During Construction',
     NULL, NULL, 'pass_fail', '2026-03-01', 'SMACNA guidelines checklist',
     'IEQ Credit 3', 1, 'MERV 8 filters on all AHUs during construction. Duct protection protocols in place.', user_mike),

    (sm_11, project_id, 'site', 'Open Space Ratio',
     25, 28, 'percent', '2026-03-01', 'Site plan calculation',
     'SS Credit 5', 1, 'Green roof and courtyard areas exceed minimum open space requirement.', user_mike),

    (sm_12, project_id, 'innovation', 'Green Education Program',
     NULL, NULL, 'completed', '2026-03-01', 'Training records',
     'IN Credit 1', 1, 'Sustainability orientation for all trades. Monthly green building newsletter distributed.', user_mike);

  -- -------------------------------------------------------------------------
  -- Waste Logs (8 entries)
  -- -------------------------------------------------------------------------
  INSERT INTO waste_logs (id, project_id, date, material_type, quantity, unit, disposition, hauler, manifest_number, cost, document_url, created_by) VALUES
    (wl_01, project_id, '2026-03-25', 'concrete', 12.5, 'tons', 'recycled',
     'GreenCycle Hauling', 'WM-2026-0341', 375.00, '/files/waste/wm-0341.pdf', user_mike),
    (wl_02, project_id, '2026-03-24', 'metal', 3.2, 'tons', 'recycled',
     'Metro Scrap LLC', 'WM-2026-0340', 0.00, '/files/waste/wm-0340.pdf', user_mike),
    (wl_03, project_id, '2026-03-24', 'wood', 8.0, 'cubic_yards', 'recycled',
     'GreenCycle Hauling', 'WM-2026-0339', 280.00, '/files/waste/wm-0339.pdf', user_mike),
    (wl_04, project_id, '2026-03-22', 'drywall', 4.5, 'tons', 'recycled',
     'Wallboard Recyclers Inc', 'WM-2026-0335', 315.00, '/files/waste/wm-0335.pdf', user_mike),
    (wl_05, project_id, '2026-03-21', 'general', 6.0, 'cubic_yards', 'landfill',
     'City Waste Services', 'WM-2026-0332', 420.00, '/files/waste/wm-0332.pdf', user_mike),
    (wl_06, project_id, '2026-03-20', 'packaging', 15.0, 'cubic_yards', 'recycled',
     'GreenCycle Hauling', 'WM-2026-0328', 225.00, '/files/waste/wm-0328.pdf', user_mike),
    (wl_07, project_id, '2026-03-18', 'hazardous', 0.5, 'tons', 'hazardous_disposal',
     'EnviroSafe Disposal', 'HW-2026-0087', 1850.00, '/files/waste/hw-0087.pdf', user_mike),
    (wl_08, project_id, '2026-03-15', 'soil', 45.0, 'cubic_yards', 'reused',
     'TopSoil Exchange', 'WM-2026-0319', 0.00, '/files/waste/wm-0319.pdf', user_mike);

  -- -------------------------------------------------------------------------
  -- Warranties (10 across categories with varied expiration dates)
  -- -------------------------------------------------------------------------
  INSERT INTO warranties (id, project_id, item, category, subcontractor, manufacturer, warranty_type, start_date, duration_years, expiration_date, coverage_description, limitations, document_url, contact_name, contact_phone, contact_email, status) VALUES
    (wr_01, project_id, 'TPO Roofing Membrane System', 'roofing',
     'Apex Roofing Co', 'Carlisle SynTec', 'material', '2025-08-15', 20,
     '2045-08-15', 'Full membrane system including flashing, penetration boots, and edge metal. Covers material defects and premature degradation.',
     'Does not cover damage from foot traffic, puncture, or acts of nature.',
     '/files/warranties/roof-tpo-carlisle.pdf',
     'Dave Richardson', '(555) 234-5678', 'drichardson@apexroofing.com', 'active'),

    (wr_02, project_id, 'RTU HVAC Units (Qty 6)', 'hvac',
     'Comfort Systems USA', 'Carrier', 'material', '2025-10-01', 5,
     '2030-10-01', 'Compressor, heat exchanger, and all factory installed components. Parts replacement for manufacturing defects.',
     'Annual maintenance by certified technician required to maintain warranty.',
     '/files/warranties/hvac-carrier-rtu.pdf',
     'Sarah Chen', '(555) 345-6789', 'schen@comfortsystems.com', 'active'),

    (wr_03, project_id, 'Variable Frequency Drives', 'electrical',
     'Tri City Electric', 'ABB', 'material', '2025-11-01', 3,
     '2028-11-01', 'VFD units and associated control boards. Covers manufacturing defects and premature component failure.',
     'Excludes damage from power surges, improper input voltage, or environmental contamination.',
     '/files/warranties/electrical-abb-vfd.pdf',
     'Mike Torres', '(555) 456-7890', 'mtorres@tricityelectric.com', 'active'),

    (wr_04, project_id, 'Domestic Water Piping System', 'plumbing',
     'Pacific Plumbing', 'Viega', 'labor', '2025-09-01', 2,
     '2027-09-01', 'ProPress fittings and copper piping installation. Covers joint failures and leaks attributable to workmanship.',
     'Does not cover freeze damage or damage from water treatment chemicals.',
     '/files/warranties/plumbing-viega-propress.pdf',
     'Jim Hargrove', '(555) 567-8901', 'jhargrove@pacificplumbing.com', 'expiring_soon'),

    (wr_05, project_id, 'Curtain Wall System', 'envelope',
     'Enclos Corp', 'Kawneer', 'performance', '2025-07-01', 10,
     '2035-07-01', 'Air infiltration, water penetration, and structural performance of unitized curtain wall system per ASTM E283, E331, and E330.',
     'Excludes glass breakage from impact, thermal stress breakage outside design parameters.',
     '/files/warranties/envelope-kawneer-cw.pdf',
     'Lisa Park', '(555) 678-9012', 'lpark@enclos.com', 'active'),

    (wr_06, project_id, 'Polished Concrete Floors', 'flooring',
     'Diamond Floor Systems', 'Prosoco', 'material', '2025-12-01', 5,
     '2030-12-01', 'Concrete densifier and guard treatment. Covers delamination, discoloration, and loss of sheen under normal use.',
     'Requires adherence to recommended maintenance schedule. Does not cover chemical spills or abrasive damage.',
     '/files/warranties/flooring-prosoco-polish.pdf',
     'Carlos Mendez', '(555) 789-0123', 'cmendez@diamondfloors.com', 'active'),

    (wr_07, project_id, 'Interior Paint System', 'painting',
     'ProCoat Painting', 'Sherwin Williams', 'labor', '2026-01-15', 2,
     '2028-01-15', 'Workmanship warranty covering peeling, blistering, and adhesion failure. Two coat system on all interior surfaces.',
     'Does not cover normal wear, color fading, or damage from cleaning chemicals not specified in maintenance guide.',
     '/files/warranties/painting-sw-interior.pdf',
     'Ana Rodriguez', '(555) 890-1234', 'arodriguez@procoat.com', 'active'),

    (wr_08, project_id, 'Emergency Generator', 'equipment',
     'Power Solutions Inc', 'Caterpillar', 'extended', '2025-06-01', 7,
     '2032-06-01', 'Extended coverage on 500kW diesel generator including engine, alternator, transfer switch, and control panel. Includes annual load bank testing.',
     'Requires use of OEM parts and Cat certified service technicians. Fuel quality must meet Cat specifications.',
     '/files/warranties/equipment-cat-generator.pdf',
     'Bob Franklin', '(555) 901-2345', 'bfranklin@powersolutions.com', 'active'),

    (wr_09, project_id, 'Structural Steel Fireproofing', 'structural',
     'Fireproofing Specialists LLC', 'Isolatek', 'material', '2025-05-01', 1,
     '2026-05-01', 'Spray applied fireproofing on structural steel members. Covers adhesion and thickness requirements per UL assembly.',
     'Does not cover damage from subsequent trades or mechanical impact after application.',
     '/files/warranties/structural-isolatek-fp.pdf',
     'Tom Bradley', '(555) 012-3456', 'tbradley@fireprofspec.com', 'expiring_soon'),

    (wr_10, project_id, 'Site Paving and Striping', 'site',
     'Blacktop Paving Co', 'N/A', 'labor', '2025-04-01', 1,
     '2026-04-01', 'Asphalt paving workmanship including base preparation, compaction, and surface course. Line striping and pavement markings.',
     'Excludes damage from utility cuts, heavy equipment beyond design loading, or deicing chemicals.',
     '/files/warranties/site-paving.pdf',
     'Greg Wallace', '(555) 123-4567', 'gwallace@blacktoppaving.com', 'expired');

  -- -------------------------------------------------------------------------
  -- Warranty Claims (2 entries)
  -- -------------------------------------------------------------------------
  INSERT INTO warranty_claims (id, warranty_id, project_id, claim_date, description, location, severity, status, resolution, resolution_date, cost, photos, documents, created_by) VALUES
    (wc_01, wr_04, project_id, '2026-03-10',
     'ProPress fitting leak detected at 4th floor mechanical room supply line. Approximately 2 GPM leak at elbow joint. Ceiling tiles damaged in suite 410 below.',
     '4th Floor Mechanical Room, Supply Line S4-12',
     'major', 'in_repair', NULL, NULL, NULL,
     '["photos/warranty/wc-01-leak-01.jpg","photos/warranty/wc-01-leak-02.jpg","photos/warranty/wc-01-ceiling-damage.jpg"]'::jsonb,
     '["documents/warranty/wc-01-incident-report.pdf"]'::jsonb,
     user_mike),

    (wc_02, wr_10, project_id, '2026-02-18',
     'Alligator cracking in southeast parking area, approximately 200 SF. Appears to be base failure under dumpster enclosure approach.',
     'Southeast Parking Lot, Grid J-K / 1-2',
     'moderate', 'disputed', 'Contractor claims damage is from overloaded waste hauler vehicles exceeding design loading. Owner disputes based on standard dumpster service trucks.',
     NULL, NULL,
     '["photos/warranty/wc-02-cracking-01.jpg","photos/warranty/wc-02-cracking-02.jpg"]'::jsonb,
     '["documents/warranty/wc-02-claim-letter.pdf","documents/warranty/wc-02-contractor-response.pdf"]'::jsonb,
     user_mike);

END $$;
