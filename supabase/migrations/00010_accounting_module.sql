-- =============================================================================
-- SiteSync AI: Construction Accounting Module
-- Contracts, schedule of values, pay applications, job costing, invoices
-- payable, WIP reporting, and retainage tracking.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Contracts
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('prime','subcontract','purchase_order','professional_services')),
  contract_number text,
  title text NOT NULL,
  counterparty text NOT NULL,
  counterparty_contact text,
  counterparty_email text,
  original_value numeric NOT NULL,
  revised_value numeric,
  retainage_percent numeric DEFAULT 10,
  start_date date,
  end_date date,
  status text DEFAULT 'draft'
    CHECK (status IN ('draft','executed','in_progress','completed','closed','terminated')),
  payment_terms text,
  billing_method text
    CHECK (billing_method IN ('fixed_price','time_and_materials','cost_plus','unit_price')),
  documents jsonb DEFAULT '[]',
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Schedule of Values
CREATE TABLE schedule_of_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts ON DELETE CASCADE NOT NULL,
  item_number text,
  description text NOT NULL,
  scheduled_value numeric NOT NULL,
  previous_completed numeric DEFAULT 0,
  this_period_completed numeric DEFAULT 0,
  materials_stored numeric DEFAULT 0,
  total_completed numeric DEFAULT 0,
  percent_complete numeric DEFAULT 0,
  retainage numeric DEFAULT 0,
  balance_to_finish numeric,
  sort_order int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pay Applications
CREATE TABLE pay_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  application_number int,
  period_to date NOT NULL,
  original_contract_sum numeric,
  net_change_orders numeric,
  contract_sum_to_date numeric,
  total_completed_and_stored numeric,
  retainage numeric,
  total_earned_less_retainage numeric,
  less_previous_certificates numeric,
  current_payment_due numeric,
  balance_to_finish numeric,
  status text DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','certified','paid')),
  submitted_date date,
  certified_date date,
  paid_date date,
  paid_amount numeric,
  certified_by uuid REFERENCES auth.users,
  signature_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Job Cost Entries
CREATE TABLE job_cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  contract_id uuid REFERENCES contracts,
  cost_code text NOT NULL,
  cost_type text CHECK (cost_type IN ('labor','material','equipment','subcontractor','other')),
  description text,
  vendor text,
  date date,
  quantity numeric,
  unit_cost numeric,
  amount numeric,
  invoice_number text,
  invoice_url text,
  budget_item_id uuid REFERENCES budget_items,
  posted boolean DEFAULT false,
  posted_date date,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

-- Invoices Payable
CREATE TABLE invoices_payable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  vendor text NOT NULL,
  invoice_number text,
  invoice_date date,
  due_date date,
  amount numeric,
  tax numeric,
  total numeric,
  status text DEFAULT 'received'
    CHECK (status IN ('received','coded','approved','scheduled','paid','disputed')),
  cost_code text,
  budget_item_id uuid REFERENCES budget_items,
  po_number text,
  purchase_order_id uuid REFERENCES purchase_orders,
  document_url text,
  notes text,
  approved_by uuid REFERENCES auth.users,
  approved_at timestamptz,
  paid_date date,
  check_number text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- WIP Reports
CREATE TABLE wip_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  period_end date NOT NULL,
  contract_amount numeric,
  total_costs_to_date numeric,
  estimated_costs_to_complete numeric,
  total_estimated_costs numeric,
  percent_complete_cost numeric,
  earned_revenue numeric,
  billed_to_date numeric,
  over_under_billing numeric,
  gross_profit numeric,
  gross_profit_margin numeric,
  status text DEFAULT 'draft'
    CHECK (status IN ('draft','reviewed','final')),
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

-- Retainage Ledger
CREATE TABLE retainage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  contract_id uuid REFERENCES contracts ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('held_by_owner','held_from_sub')),
  amount numeric,
  released_amount numeric DEFAULT 0,
  balance numeric,
  release_date date,
  conditions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- Contracts
CREATE INDEX idx_contracts_project ON contracts(project_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_type ON contracts(type);
CREATE INDEX idx_contracts_counterparty ON contracts(counterparty);
CREATE INDEX idx_contracts_contract_number ON contracts(contract_number);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);
CREATE INDEX idx_contracts_start_date ON contracts(start_date);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);

-- Schedule of Values
CREATE INDEX idx_sov_contract ON schedule_of_values(contract_id);
CREATE INDEX idx_sov_sort_order ON schedule_of_values(sort_order);

-- Pay Applications
CREATE INDEX idx_pay_apps_contract ON pay_applications(contract_id);
CREATE INDEX idx_pay_apps_project ON pay_applications(project_id);
CREATE INDEX idx_pay_apps_status ON pay_applications(status);
CREATE INDEX idx_pay_apps_period_to ON pay_applications(period_to);
CREATE INDEX idx_pay_apps_certified_by ON pay_applications(certified_by);

-- Job Cost Entries
CREATE INDEX idx_job_cost_project ON job_cost_entries(project_id);
CREATE INDEX idx_job_cost_contract ON job_cost_entries(contract_id);
CREATE INDEX idx_job_cost_cost_code ON job_cost_entries(cost_code);
CREATE INDEX idx_job_cost_cost_type ON job_cost_entries(cost_type);
CREATE INDEX idx_job_cost_date ON job_cost_entries(date);
CREATE INDEX idx_job_cost_vendor ON job_cost_entries(vendor);
CREATE INDEX idx_job_cost_budget_item ON job_cost_entries(budget_item_id);
CREATE INDEX idx_job_cost_posted ON job_cost_entries(posted);
CREATE INDEX idx_job_cost_created_by ON job_cost_entries(created_by);

-- Invoices Payable
CREATE INDEX idx_invoices_payable_project ON invoices_payable(project_id);
CREATE INDEX idx_invoices_payable_vendor ON invoices_payable(vendor);
CREATE INDEX idx_invoices_payable_status ON invoices_payable(status);
CREATE INDEX idx_invoices_payable_due_date ON invoices_payable(due_date);
CREATE INDEX idx_invoices_payable_invoice_date ON invoices_payable(invoice_date);
CREATE INDEX idx_invoices_payable_budget_item ON invoices_payable(budget_item_id);
CREATE INDEX idx_invoices_payable_po ON invoices_payable(purchase_order_id);
CREATE INDEX idx_invoices_payable_approved_by ON invoices_payable(approved_by);
CREATE INDEX idx_invoices_payable_created_by ON invoices_payable(created_by);

-- WIP Reports
CREATE INDEX idx_wip_reports_project ON wip_reports(project_id);
CREATE INDEX idx_wip_reports_period_end ON wip_reports(period_end);
CREATE INDEX idx_wip_reports_status ON wip_reports(status);
CREATE INDEX idx_wip_reports_created_by ON wip_reports(created_by);

-- Retainage Ledger
CREATE INDEX idx_retainage_project ON retainage_ledger(project_id);
CREATE INDEX idx_retainage_contract ON retainage_ledger(contract_id);
CREATE INDEX idx_retainage_type ON retainage_ledger(type);
CREATE INDEX idx_retainage_release_date ON retainage_ledger(release_date);

-- ---------------------------------------------------------------------------
-- 3. Updated At Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_schedule_of_values_updated_at
  BEFORE UPDATE ON schedule_of_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_pay_applications_updated_at
  BEFORE UPDATE ON pay_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_invoices_payable_updated_at
  BEFORE UPDATE ON invoices_payable
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_retainage_ledger_updated_at
  BEFORE UPDATE ON retainage_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_of_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE wip_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE retainage_ledger ENABLE ROW LEVEL SECURITY;

-- Contracts: project members
CREATE POLICY contracts_select ON contracts FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY contracts_insert ON contracts FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY contracts_update ON contracts FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY contracts_delete ON contracts FOR DELETE
  USING (is_project_member(project_id));

-- Schedule of Values: join through parent contract
CREATE POLICY sov_select ON schedule_of_values FOR SELECT
  USING (
    contract_id IN (
      SELECT c.id FROM contracts c WHERE is_project_member(c.project_id)
    )
  );

CREATE POLICY sov_insert ON schedule_of_values FOR INSERT
  WITH CHECK (
    contract_id IN (
      SELECT c.id FROM contracts c WHERE is_project_member(c.project_id)
    )
  );

CREATE POLICY sov_update ON schedule_of_values FOR UPDATE
  USING (
    contract_id IN (
      SELECT c.id FROM contracts c WHERE is_project_member(c.project_id)
    )
  );

CREATE POLICY sov_delete ON schedule_of_values FOR DELETE
  USING (
    contract_id IN (
      SELECT c.id FROM contracts c WHERE is_project_member(c.project_id)
    )
  );

-- Pay Applications: project members
CREATE POLICY pay_apps_select ON pay_applications FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY pay_apps_insert ON pay_applications FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY pay_apps_update ON pay_applications FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY pay_apps_delete ON pay_applications FOR DELETE
  USING (is_project_member(project_id));

-- Job Cost Entries: project members
CREATE POLICY job_cost_select ON job_cost_entries FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY job_cost_insert ON job_cost_entries FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY job_cost_update ON job_cost_entries FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY job_cost_delete ON job_cost_entries FOR DELETE
  USING (is_project_member(project_id));

-- Invoices Payable: project members
CREATE POLICY invoices_payable_select ON invoices_payable FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY invoices_payable_insert ON invoices_payable FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY invoices_payable_update ON invoices_payable FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY invoices_payable_delete ON invoices_payable FOR DELETE
  USING (is_project_member(project_id));

-- WIP Reports: project members
CREATE POLICY wip_reports_select ON wip_reports FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY wip_reports_insert ON wip_reports FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY wip_reports_update ON wip_reports FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY wip_reports_delete ON wip_reports FOR DELETE
  USING (is_project_member(project_id));

-- Retainage Ledger: project members
CREATE POLICY retainage_select ON retainage_ledger FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY retainage_insert ON retainage_ledger FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY retainage_update ON retainage_ledger FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY retainage_delete ON retainage_ledger FOR DELETE
  USING (is_project_member(project_id));

