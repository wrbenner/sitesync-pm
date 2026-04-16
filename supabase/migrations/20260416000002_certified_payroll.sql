-- =============================================================================
-- Certified Payroll / Davis-Bacon Compliance — Database Schema
-- =============================================================================
-- Federal prevailing wage compliance per 40 U.S.C. §§ 3141-3148.
-- WH-347 form data, prevailing wage rates from SAM.gov, sub CPR collection.
-- All tables idempotent (IF NOT EXISTS). Financial calculations use integer cents.
-- =============================================================================

-- ── Prevailing Wage Determinations (from SAM.gov) ──────────────────────────

CREATE TABLE IF NOT EXISTS prevailing_wage_determinations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  wd_number           TEXT NOT NULL,                     -- e.g., 'NC20240005'
  wd_revision         INTEGER NOT NULL DEFAULT 0,        -- revision number
  state               TEXT NOT NULL,                     -- 2-letter state code
  county              TEXT NOT NULL,
  construction_type   TEXT NOT NULL
                      CHECK (construction_type IN ('building', 'residential', 'heavy', 'highway')),
  source              TEXT NOT NULL DEFAULT 'federal'
                      CHECK (source IN ('federal', 'state')),
  effective_date      DATE NOT NULL,
  locked_at_bid       BOOLEAN DEFAULT FALSE,             -- rate locked at bid opening
  raw_data            JSONB,                             -- full WD as returned by SAM.gov
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_pwd_project
    ON prevailing_wage_determinations(project_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Classification Rates (within a wage determination) ─────────────────────

CREATE TABLE IF NOT EXISTS wd_classification_rates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wd_id               UUID NOT NULL REFERENCES prevailing_wage_determinations(id) ON DELETE CASCADE,
  classification_name TEXT NOT NULL,                     -- e.g., 'ELEC0003-005 06/01/2024'
  trade_group         TEXT,                              -- e.g., 'Electrician'
  base_hourly_rate    INTEGER NOT NULL,                  -- cents (e.g., 3400 = $34.00)
  fringe_rate         INTEGER NOT NULL,                  -- cents (e.g., 2100 = $21.00)
  total_rate          INTEGER GENERATED ALWAYS AS (base_hourly_rate + fringe_rate) STORED,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_wcr_wd
    ON wd_classification_rates(wd_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Certified Payroll Reports (WH-347 header) ─────────────────────────────

CREATE TABLE IF NOT EXISTS certified_payroll_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contractor_company  TEXT NOT NULL,                     -- legal business name
  contractor_address  TEXT,
  is_prime            BOOLEAN NOT NULL DEFAULT FALSE,    -- prime contractor or subcontractor
  payroll_number      INTEGER NOT NULL,                  -- sequential, never gaps, starts at 1
  week_ending_date    DATE NOT NULL,                     -- last day of the workweek
  wd_numbers          TEXT[] NOT NULL DEFAULT '{}',      -- all applicable WD numbers for this period
  is_final            BOOLEAN DEFAULT FALSE,             -- "Final DBRA Certified Payroll" checkbox
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'revised')),
  -- Certification (Statement of Compliance, Page 2)
  certified_by        UUID REFERENCES auth.users(id),
  certified_at        TIMESTAMPTZ,
  certifier_name      TEXT,                              -- name of certifying official
  certifier_title     TEXT,                              -- title of certifying official
  certifier_phone     TEXT,
  certifier_email     TEXT,
  signature_token     TEXT,                              -- e-signature verification token
  -- Review
  reviewed_by         UUID REFERENCES auth.users(id),
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  -- Compliance boxes (Page 2)
  box1_proper_payment BOOLEAN DEFAULT FALSE,
  box2_accurate_payroll BOOLEAN DEFAULT FALSE,
  box3_work_performed BOOLEAN DEFAULT FALSE,
  box4_apprentices    BOOLEAN DEFAULT FALSE,             -- only if apprentices employed
  box5_fringe_benefits BOOLEAN DEFAULT FALSE,            -- only if claiming fringe credit
  box6_deductions_compliant BOOLEAN DEFAULT FALSE,
  -- Metadata
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, organization_id, payroll_number, contractor_company)
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cpr_project_week
    ON certified_payroll_reports(project_id, week_ending_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cpr_status
    ON certified_payroll_reports(project_id, status);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── CPR Employee Entries (workers listed on WH-347 Page 1) ────────────────

CREATE TABLE IF NOT EXISTS certified_payroll_employees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID NOT NULL REFERENCES certified_payroll_reports(id) ON DELETE CASCADE,
  entry_number        INTEGER NOT NULL,                  -- Column 1A (sequential per report)
  last_name           TEXT NOT NULL,                     -- Column 1B
  first_name          TEXT NOT NULL,                     -- Column 1C
  middle_initial      TEXT,                              -- Column 1D
  worker_id_last4     TEXT NOT NULL                      -- Column 1E (last 4 SSN ONLY)
                      CHECK (length(worker_id_last4) <= 4),
  is_apprentice       BOOLEAN DEFAULT FALSE,             -- Column 2: J or RA
  apprentice_level    TEXT,                              -- progression level if RA
  apprentice_program  TEXT,                              -- program name if RA
  apprentice_body     TEXT CHECK (apprentice_body IS NULL OR apprentice_body IN ('OA', 'SAA')),
  classification      TEXT NOT NULL,                     -- Column 3 (from wage determination)
  wd_classification_id UUID REFERENCES wd_classification_rates(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cpe_report
    ON certified_payroll_employees(report_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Payroll Line Items (daily hours + pay per worker) ─────────────────────

CREATE TABLE IF NOT EXISTS payroll_line_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES certified_payroll_employees(id) ON DELETE CASCADE,
  day_of_week         INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  work_date           DATE NOT NULL,
  st_hours            NUMERIC(5,2) DEFAULT 0,            -- straight time hours
  ot_hours            NUMERIC(5,2) DEFAULT 0,            -- overtime hours
  -- Rates in cents (integer math, no floating point)
  hourly_rate_st      INTEGER NOT NULL,                  -- Column 6A top (cents)
  hourly_rate_ot      INTEGER NOT NULL,                  -- Column 6A bottom (cents)
  fringe_credit       INTEGER DEFAULT 0,                 -- Column 6B (cents)
  cash_in_lieu        INTEGER DEFAULT 0,                 -- Column 6C (cents)
  -- Gross pay
  gross_this_project  INTEGER,                           -- Column 7A (cents)
  gross_all_work      INTEGER,                           -- Column 7B (cents)
  -- Deductions
  deductions_tax      INTEGER DEFAULT 0,                 -- tax withholdings (cents)
  deductions_fica     INTEGER DEFAULT 0,                 -- FICA (cents)
  deductions_other    INTEGER DEFAULT 0,                 -- other deductions (cents)
  deductions_other_desc TEXT,                            -- required description if >0
  net_pay             INTEGER,                           -- Column 9 (cents)
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_pli_employee
    ON payroll_line_items(employee_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Employee Fringe Benefit Plans (Page 2, Box 5 table) ───────────────────

CREATE TABLE IF NOT EXISTS employee_fringe_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES certified_payroll_employees(id) ON DELETE CASCADE,
  plan_name           TEXT NOT NULL,
  plan_type           TEXT,                              -- health, pension, vacation, etc.
  plan_number         TEXT,
  is_funded           BOOLEAN DEFAULT TRUE,              -- unfunded requires prior DOL approval
  hourly_amount       INTEGER NOT NULL,                  -- cents per hour
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE prevailing_wage_determinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wd_classification_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certified_payroll_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE certified_payroll_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_fringe_plans ENABLE ROW LEVEL SECURITY;

-- Organization-scoped access for wage determinations and CPRs
DO $$ BEGIN
  CREATE POLICY pwd_org_access ON prevailing_wage_determinations
    USING (organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (SELECT auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY cpr_org_access ON certified_payroll_reports
    USING (organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (SELECT auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cascade through report_id for employee and line item tables
DO $$ BEGIN
  CREATE POLICY cpe_via_report ON certified_payroll_employees
    USING (report_id IN (
      SELECT id FROM certified_payroll_reports
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid())
      )
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY pli_via_employee ON payroll_line_items
    USING (employee_id IN (
      SELECT id FROM certified_payroll_employees
      WHERE report_id IN (
        SELECT id FROM certified_payroll_reports
        WHERE organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY efp_via_employee ON employee_fringe_plans
    USING (employee_id IN (
      SELECT id FROM certified_payroll_employees
      WHERE report_id IN (
        SELECT id FROM certified_payroll_reports
        WHERE organization_id IN (
          SELECT organization_id FROM organization_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY wcr_via_wd ON wd_classification_rates
    USING (wd_id IN (
      SELECT id FROM prevailing_wage_determinations
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid())
      )
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sub access: subcontractors on the project can see and submit their own CPRs
DO $$ BEGIN
  CREATE POLICY cpr_sub_access ON certified_payroll_reports
    FOR SELECT
    USING (
      project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = (SELECT auth.uid())
        AND role = 'subcontractor'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY cpr_sub_insert ON certified_payroll_reports
    FOR INSERT
    WITH CHECK (
      project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = (SELECT auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
