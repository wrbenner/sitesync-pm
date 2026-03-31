-- Certified Payroll (Davis-Bacon compliance) and expanded COI tracking.

-- ── Certified Payroll Reports ────────────────────────────

CREATE TABLE IF NOT EXISTS certified_payroll_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_id         UUID NOT NULL,
  week_ending_date      DATE NOT NULL,
  report_number         VARCHAR(50),
  davis_bacon_compliant BOOLEAN DEFAULT false,
  status                VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at          TIMESTAMPTZ,
  submitted_to_agency   VARCHAR(255),
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, contractor_id, week_ending_date)
);

CREATE TABLE IF NOT EXISTS certified_payroll_employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_report_id   UUID NOT NULL REFERENCES certified_payroll_reports(id) ON DELETE CASCADE,
  employee_name       VARCHAR(255) NOT NULL,
  trade_classification VARCHAR(100),
  hourly_rate         NUMERIC(10, 2),
  hours_worked        NUMERIC(6, 2),
  gross_pay           NUMERIC(15, 2),
  federal_withholding NUMERIC(10, 2),
  social_security     NUMERIC(10, 2),
  medicare            NUMERIC(10, 2),
  state_withholding   NUMERIC(10, 2),
  prevailing_wage_met BOOLEAN,
  fringe_benefits     NUMERIC(10, 2),
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prevailing_wage_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code      VARCHAR(2) NOT NULL,
  county_name     VARCHAR(100),
  project_type    VARCHAR(50),
  trade           VARCHAR(100),
  base_hourly_rate NUMERIC(10, 2),
  fringe_benefits NUMERIC(10, 2),
  effective_date  DATE,
  expires_date    DATE,
  source          VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── COI Extraction & Compliance ──────────────────────────

CREATE TABLE IF NOT EXISTS coi_extractions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_certificate_id UUID NOT NULL REFERENCES insurance_certificates(id) ON DELETE CASCADE,
  insurer_name            VARCHAR(255),
  policy_number           VARCHAR(100),
  coverage_type           VARCHAR(50),
  coverage_limit          NUMERIC(15, 2),
  deductible              NUMERIC(10, 2),
  effective_date          DATE,
  expiration_date         DATE,
  additional_insured      BOOLEAN,
  waiver_of_subrogation   BOOLEAN,
  primary_non_contributory BOOLEAN,
  extraction_confidence   FLOAT,
  verified_by             UUID REFERENCES auth.users(id),
  verified_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coi_requirements (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  coverage_type                   VARCHAR(50) NOT NULL,
  minimum_limit                   NUMERIC(15, 2),
  additional_insured_required     BOOLEAN DEFAULT false,
  waiver_of_subrogation_required  BOOLEAN DEFAULT false,
  primary_non_contributory_required BOOLEAN DEFAULT false,
  notes                           TEXT,
  created_at                      TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────

CREATE INDEX idx_payroll_project ON certified_payroll_reports(project_id);
CREATE INDEX idx_payroll_status ON certified_payroll_reports(project_id, status);
CREATE INDEX idx_payroll_employees ON certified_payroll_employees(payroll_report_id);
CREATE INDEX idx_wage_rates_state ON prevailing_wage_rates(state_code, trade);
CREATE INDEX idx_coi_extract_cert ON coi_extractions(insurance_certificate_id);
CREATE INDEX idx_coi_extract_expiry ON coi_extractions(expiration_date);
CREATE INDEX idx_coi_requirements ON coi_requirements(project_id);

-- ── RLS ──────────────────────────────────────────────────

ALTER TABLE certified_payroll_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE certified_payroll_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE coi_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coi_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY payroll_select ON certified_payroll_reports FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY payroll_insert ON certified_payroll_reports FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY payroll_emp_select ON certified_payroll_employees FOR SELECT
  USING (payroll_report_id IN (SELECT id FROM certified_payroll_reports WHERE project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  )));

CREATE POLICY coi_extract_select ON coi_extractions FOR SELECT
  USING (insurance_certificate_id IN (SELECT id FROM insurance_certificates WHERE project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  )));

CREATE POLICY coi_req_select ON coi_requirements FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY coi_req_manage ON coi_requirements FOR ALL
  USING (project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'project_manager')
  ));
