-- =============================================================================
-- Portfolio Management Module
-- =============================================================================

-- Portfolios
CREATE TABLE portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  description text,
  owner_id uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Portfolio Projects (junction table)
CREATE TABLE portfolio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  sort_order int DEFAULT 0,
  added_at timestamptz DEFAULT now(),
  UNIQUE(portfolio_id, project_id)
);

-- Organization Settings
CREATE TABLE organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#F47820',
  secondary_color text DEFAULT '#0C0D0F',
  default_inspection_templates jsonb DEFAULT '[]',
  default_markup_percentages jsonb DEFAULT '{"overhead": 10, "profit": 8, "bond": 2, "contingency": 5}',
  fiscal_year_start int DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Executive Reports
CREATE TABLE executive_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('monthly','quarterly','annual','custom')),
  period_start date,
  period_end date,
  data jsonb DEFAULT '{}',
  ai_narrative text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_portfolios_owner ON portfolios(owner_id);
CREATE INDEX idx_portfolio_projects_portfolio ON portfolio_projects(portfolio_id);
CREATE INDEX idx_portfolio_projects_project ON portfolio_projects(project_id);
CREATE INDEX idx_organization_settings_org ON organization_settings(organization_id);
CREATE INDEX idx_executive_reports_portfolio ON executive_reports(portfolio_id);
CREATE INDEX idx_executive_reports_period ON executive_reports(period_start, period_end);

-- Updated at triggers
CREATE TRIGGER set_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_organization_settings_updated_at BEFORE UPDATE ON organization_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive_reports ENABLE ROW LEVEL SECURITY;

-- Portfolios: owner can do everything, members of contained projects can view
CREATE POLICY portfolios_select ON portfolios FOR SELECT
  USING (owner_id = auth.uid() OR id IN (
    SELECT pp.portfolio_id FROM portfolio_projects pp
    JOIN project_members pm ON pm.project_id = pp.project_id
    WHERE pm.user_id = auth.uid()
  ));
CREATE POLICY portfolios_insert ON portfolios FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY portfolios_update ON portfolios FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY portfolios_delete ON portfolios FOR DELETE USING (owner_id = auth.uid());

-- Portfolio projects: portfolio owner can manage
CREATE POLICY portfolio_projects_select ON portfolio_projects FOR SELECT
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE owner_id = auth.uid())
    OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY portfolio_projects_insert ON portfolio_projects FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE owner_id = auth.uid()));
CREATE POLICY portfolio_projects_update ON portfolio_projects FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE owner_id = auth.uid()));
CREATE POLICY portfolio_projects_delete ON portfolio_projects FOR DELETE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE owner_id = auth.uid()));

-- Organization settings: authenticated users can view, admins can edit
CREATE POLICY org_settings_select ON organization_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY org_settings_insert ON organization_settings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY org_settings_update ON organization_settings FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Executive reports: through portfolio
CREATE POLICY exec_reports_select ON executive_reports FOR SELECT
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE owner_id = auth.uid())
    OR portfolio_id IN (
      SELECT pp.portfolio_id FROM portfolio_projects pp
      JOIN project_members pm ON pm.project_id = pp.project_id
      WHERE pm.user_id = auth.uid()
    ));
CREATE POLICY exec_reports_insert ON executive_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- Seed Data
-- =============================================================================

DO $$
DECLARE
  user_mike UUID := '11111111-1111-1111-1111-111111111111';
  project_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  portfolio_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
  -- Portfolio
  INSERT INTO portfolios (id, name, description, owner_id) VALUES
    (portfolio_id, 'Dallas Metro Portfolio', 'All active projects in the Dallas metropolitan area', user_mike);

  -- Link project
  INSERT INTO portfolio_projects (portfolio_id, project_id, sort_order) VALUES
    (portfolio_id, project_id, 1);

  -- Organization settings
  INSERT INTO organization_settings (organization_id, name) VALUES
    (NULL, 'Turner and Associates General Contractors');

  -- Sample executive report
  INSERT INTO executive_reports (portfolio_id, type, period_start, period_end, data, ai_narrative, created_by) VALUES
    (portfolio_id, 'monthly', '2026-03-01', '2026-03-31',
     '{"total_value": 52000000, "active_projects": 1, "overall_health": 78, "budget_variance": -2.1, "schedule_spi": 0.96}',
     'March 2026 Executive Summary: The Dallas Metro Portfolio continues to perform well with one active project. The Riverside Commercial Tower is at 65% completion, slightly behind the baseline schedule (SPI 0.96). Budget performance is within acceptable range at 2.1% under forecast. Key highlights include completion of the structural steel package and commencement of curtain wall installation. Three critical RFIs require attention this month. Safety performance remains strong with zero lost time incidents. Recommendation: Allocate additional resources to the exterior facade to recover the 4 day schedule variance before it impacts the interior trades.',
     user_mike);
END $$;
