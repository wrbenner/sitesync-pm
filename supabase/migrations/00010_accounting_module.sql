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

-- =============================================================================
-- Seed Data
-- =============================================================================

DO $$
DECLARE
  user_mike UUID := '11111111-1111-1111-1111-111111111111';
  project_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- Contract IDs
  ctr_prime UUID := 'ee000001-0000-0000-0000-000000000001';
  ctr_sub UUID := 'ee000001-0000-0000-0000-000000000002';
  ctr_prof UUID := 'ee000001-0000-0000-0000-000000000003';

  -- Schedule of Values IDs
  sov_01 UUID := 'ee000002-0000-0000-0000-000000000001';
  sov_02 UUID := 'ee000002-0000-0000-0000-000000000002';
  sov_03 UUID := 'ee000002-0000-0000-0000-000000000003';
  sov_04 UUID := 'ee000002-0000-0000-0000-000000000004';
  sov_05 UUID := 'ee000002-0000-0000-0000-000000000005';
  sov_06 UUID := 'ee000002-0000-0000-0000-000000000006';
  sov_07 UUID := 'ee000002-0000-0000-0000-000000000007';
  sov_08 UUID := 'ee000002-0000-0000-0000-000000000008';
  sov_09 UUID := 'ee000002-0000-0000-0000-000000000009';
  sov_10 UUID := 'ee000002-0000-0000-0000-000000000010';

  -- Pay Application IDs
  pa_01 UUID := 'ee000003-0000-0000-0000-000000000001';
  pa_02 UUID := 'ee000003-0000-0000-0000-000000000002';

  -- Job Cost Entry IDs
  jce_01 UUID := 'ee000004-0000-0000-0000-000000000001';
  jce_02 UUID := 'ee000004-0000-0000-0000-000000000002';
  jce_03 UUID := 'ee000004-0000-0000-0000-000000000003';
  jce_04 UUID := 'ee000004-0000-0000-0000-000000000004';
  jce_05 UUID := 'ee000004-0000-0000-0000-000000000005';
  jce_06 UUID := 'ee000004-0000-0000-0000-000000000006';
  jce_07 UUID := 'ee000004-0000-0000-0000-000000000007';
  jce_08 UUID := 'ee000004-0000-0000-0000-000000000008';
  jce_09 UUID := 'ee000004-0000-0000-0000-000000000009';
  jce_10 UUID := 'ee000004-0000-0000-0000-000000000010';
  jce_11 UUID := 'ee000004-0000-0000-0000-000000000011';
  jce_12 UUID := 'ee000004-0000-0000-0000-000000000012';
  jce_13 UUID := 'ee000004-0000-0000-0000-000000000013';
  jce_14 UUID := 'ee000004-0000-0000-0000-000000000014';
  jce_15 UUID := 'ee000004-0000-0000-0000-000000000015';

  -- Invoice Payable IDs
  inv_01 UUID := 'ee000005-0000-0000-0000-000000000001';
  inv_02 UUID := 'ee000005-0000-0000-0000-000000000002';
  inv_03 UUID := 'ee000005-0000-0000-0000-000000000003';
  inv_04 UUID := 'ee000005-0000-0000-0000-000000000004';
  inv_05 UUID := 'ee000005-0000-0000-0000-000000000005';

  -- WIP Report ID
  wip_01 UUID := 'ee000006-0000-0000-0000-000000000001';

  -- Retainage Ledger IDs
  ret_01 UUID := 'ee000007-0000-0000-0000-000000000001';
  ret_02 UUID := 'ee000007-0000-0000-0000-000000000002';
  ret_03 UUID := 'ee000007-0000-0000-0000-000000000003';

BEGIN

  -- -------------------------------------------------------------------------
  -- Contracts: 1 prime (in_progress), 1 subcontract (executed), 1 professional_services (completed)
  -- -------------------------------------------------------------------------
  INSERT INTO contracts (id, project_id, type, contract_number, title, counterparty, counterparty_contact, counterparty_email, original_value, revised_value, retainage_percent, start_date, end_date, status, payment_terms, billing_method, documents, created_by) VALUES
    (ctr_prime, project_id, 'prime',
     'GC-2026-001',
     'Riverside Tower General Construction',
     'Riverside Development Partners LLC',
     'Sarah Mitchell', 'smitchell@riversidedev.com',
     48500000, 49875000, 10,
     '2025-06-01', '2027-03-31',
     'in_progress',
     'Net 30 from certified pay application',
     'fixed_price',
     '[{"name":"Executed Contract.pdf","url":"https://storage.sitesync.ai/docs/contract-gc-001.pdf"},{"name":"Insurance Certificate.pdf","url":"https://storage.sitesync.ai/docs/insurance-gc-001.pdf"}]',
     user_mike),

    (ctr_sub, project_id, 'subcontract',
     'SC-2026-014',
     'Structural Steel Fabrication and Erection',
     'Apex Steel Fabricators',
     'Tom Reynolds', 'tom@apexsteel.com',
     4250000, 4250000, 10,
     '2025-09-15', '2026-08-30',
     'executed',
     'Net 30 from approved invoice',
     'fixed_price',
     '[{"name":"Subcontract SC-014.pdf","url":"https://storage.sitesync.ai/docs/contract-sc-014.pdf"}]',
     user_mike),

    (ctr_prof, project_id, 'professional_services',
     'PS-2026-003',
     'Geotechnical Engineering and Testing',
     'Lone Star Geotechnical Inc.',
     'Dr. James Park', 'jpark@lonestargeotechnical.com',
     185000, 198500, 0,
     '2025-04-01', '2025-12-15',
     'completed',
     'Net 15 upon receipt',
     'time_and_materials',
     '[{"name":"Professional Services Agreement.pdf","url":"https://storage.sitesync.ai/docs/contract-ps-003.pdf"},{"name":"Final Report.pdf","url":"https://storage.sitesync.ai/docs/geotech-final-report.pdf"}]',
     user_mike);

  -- -------------------------------------------------------------------------
  -- Schedule of Values: 10 items for the prime contract
  -- -------------------------------------------------------------------------
  INSERT INTO schedule_of_values (id, contract_id, item_number, description, scheduled_value, previous_completed, this_period_completed, materials_stored, total_completed, percent_complete, retainage, balance_to_finish, sort_order) VALUES
    (sov_01, ctr_prime, '01', 'General Conditions and Project Management', 3880000, 2716000, 194000, 0, 2910000, 75.00, 291000, 970000, 1),
    (sov_02, ctr_prime, '02', 'Site Work and Excavation', 2425000, 2425000, 0, 0, 2425000, 100.00, 242500, 0, 2),
    (sov_03, ctr_prime, '03', 'Concrete and Foundations', 7275000, 6547500, 363750, 0, 6911250, 95.00, 691125, 363750, 3),
    (sov_04, ctr_prime, '04', 'Structural Steel', 4850000, 3880000, 242500, 0, 4122500, 85.00, 412250, 727500, 4),
    (sov_05, ctr_prime, '05', 'Exterior Enclosure and Curtain Wall', 6790000, 2716000, 679000, 339500, 3734500, 55.00, 373450, 3055500, 5),
    (sov_06, ctr_prime, '06', 'Mechanical Systems', 5820000, 1746000, 582000, 291000, 2619000, 45.00, 261900, 3201000, 6),
    (sov_07, ctr_prime, '07', 'Electrical Systems', 4365000, 1309500, 436500, 218250, 1964250, 45.00, 196425, 2400750, 7),
    (sov_08, ctr_prime, '08', 'Plumbing and Fire Protection', 3395000, 1018500, 339500, 169750, 1527750, 45.00, 152775, 1867250, 8),
    (sov_09, ctr_prime, '09', 'Interior Finishes', 6790000, 679000, 339500, 0, 1018500, 15.00, 101850, 5771500, 9),
    (sov_10, ctr_prime, '10', 'Elevators and Vertical Transport', 3285000, 986000, 328500, 0, 1314500, 40.00, 131450, 1970500, 10);

  -- -------------------------------------------------------------------------
  -- Pay Applications: 1 certified, 1 draft
  -- -------------------------------------------------------------------------
  INSERT INTO pay_applications (id, contract_id, project_id, application_number, period_to, original_contract_sum, net_change_orders, contract_sum_to_date, total_completed_and_stored, retainage, total_earned_less_retainage, less_previous_certificates, current_payment_due, balance_to_finish, status, submitted_date, certified_date, paid_date, paid_amount, certified_by, signature_url) VALUES
    (pa_01, ctr_prime, project_id, 9,
     '2026-02-28',
     48500000, 1375000, 49875000,
     24023500, 2402350, 21621150,
     19350000, 2271150, 25851500,
     'certified',
     '2026-03-05', '2026-03-12', NULL, NULL,
     user_mike,
     'https://storage.sitesync.ai/docs/payapp-009-signature.png'),

    (pa_02, ctr_prime, project_id, 10,
     '2026-03-31',
     48500000, 1375000, 49875000,
     28547250, 2854725, 25692525,
     21621150, 4071375, 21327750,
     'draft',
     NULL, NULL, NULL, NULL,
     NULL,
     NULL);

  -- -------------------------------------------------------------------------
  -- Job Cost Entries: 15 entries across labor, material, equipment, subcontractor
  -- -------------------------------------------------------------------------
  INSERT INTO job_cost_entries (id, project_id, contract_id, cost_code, cost_type, description, vendor, date, quantity, unit_cost, amount, invoice_number, invoice_url, posted, posted_date, created_by) VALUES
    -- Labor entries (4)
    (jce_01, project_id, ctr_prime, '03 30 00', 'labor',
     'Concrete finishing crew, Level 16 deck prep', NULL,
     '2026-03-24', 128, 68.50, 8768, NULL, NULL,
     true, '2026-03-25', user_mike),

    (jce_02, project_id, ctr_prime, '05 12 00', 'labor',
     'Ironworker crew, floor 17 steel erection', NULL,
     '2026-03-25', 96, 82.00, 7872, NULL, NULL,
     true, '2026-03-26', user_mike),

    (jce_03, project_id, ctr_prime, '09 29 00', 'labor',
     'Drywall hanging crew, floors 6 through 8', NULL,
     '2026-03-25', 72, 58.00, 4176, NULL, NULL,
     true, '2026-03-26', user_mike),

    (jce_04, project_id, ctr_prime, '22 11 00', 'labor',
     'Plumbing rough in crew, floors 8 through 10', NULL,
     '2026-03-26', 64, 75.00, 4800, NULL, NULL,
     false, NULL, user_mike),

    -- Material entries (4)
    (jce_05, project_id, ctr_prime, '05 12 00', 'material',
     'Structural steel, W14x90 beams and connection hardware', 'Apex Steel Fabricators',
     '2026-02-28', 1, 529725, 529725, 'ASF-2026-1180',
     'https://storage.sitesync.ai/invoices/asf-1180.pdf',
     true, '2026-03-05', user_mike),

    (jce_06, project_id, ctr_prime, '22 11 00', 'material',
     'Copper pipe, fittings, and hangers for floors 8 through 12', 'National Mechanical Supply',
     '2026-03-12', 1, 170880, 170880, 'NMS-2026-4420',
     'https://storage.sitesync.ai/invoices/nms-4420.pdf',
     true, '2026-03-15', user_mike),

    (jce_07, project_id, ctr_prime, '09 29 00', 'material',
     'Fire rated drywall 5/8 inch sheets, 320 sheets delivered', 'BuildPro Supply',
     '2026-03-20', 320, 42.50, 13600, 'BPS-2026-7891',
     'https://storage.sitesync.ai/invoices/bps-7891.pdf',
     true, '2026-03-22', user_mike),

    (jce_08, project_id, ctr_prime, '07 84 00', 'material',
     'Firestop sealant and putty pads for penetration sealing', 'FireSafe Products',
     '2026-03-22', 86, 28.50, 2451, 'FSP-2026-0334',
     NULL,
     false, NULL, user_mike),

    -- Equipment entries (3)
    (jce_09, project_id, ctr_prime, '01 50 00', 'equipment',
     'Tower crane rental, March 2026', 'Bigge Crane and Rigging',
     '2026-03-01', 1, 42000, 42000, 'BGCR-2026-3300',
     'https://storage.sitesync.ai/invoices/bgcr-3300.pdf',
     true, '2026-03-05', user_mike),

    (jce_10, project_id, ctr_prime, '01 50 00', 'equipment',
     'Telehandler and boom lift rental, March 2026', 'Sunbelt Rentals',
     '2026-03-01', 1, 12300, 12300, 'SBR-2026-88140',
     'https://storage.sitesync.ai/invoices/sbr-88140.pdf',
     true, '2026-03-05', user_mike),

    (jce_11, project_id, ctr_prime, '01 50 00', 'equipment',
     'Temporary power generator rental, March 2026', 'United Rentals',
     '2026-03-01', 1, 4500, 4500, 'UR-2026-55230',
     'https://storage.sitesync.ai/invoices/ur-55230.pdf',
     true, '2026-03-05', user_mike),

    -- Subcontractor entries (4)
    (jce_12, project_id, ctr_sub, '05 12 00', 'subcontractor',
     'Structural steel erection progress billing, February 2026', 'Apex Steel Fabricators',
     '2026-03-01', 1, 425000, 425000, 'ASF-2026-PAY-07',
     'https://storage.sitesync.ai/invoices/asf-pay-07.pdf',
     true, '2026-03-08', user_mike),

    (jce_13, project_id, ctr_prime, '23 00 00', 'subcontractor',
     'HVAC ductwork installation, floors 5 through 7', 'Metro Mechanical Contractors',
     '2026-03-15', 1, 187500, 187500, 'MMC-2026-0290',
     'https://storage.sitesync.ai/invoices/mmc-0290.pdf',
     true, '2026-03-18', user_mike),

    (jce_14, project_id, ctr_prime, '26 00 00', 'subcontractor',
     'Electrical rough in, floors 8 through 10', 'Lone Star Electric',
     '2026-03-20', 1, 156000, 156000, 'LSE-2026-1140',
     'https://storage.sitesync.ai/invoices/lse-1140.pdf',
     false, NULL, user_mike),

    (jce_15, project_id, ctr_prime, '21 00 00', 'subcontractor',
     'Fire sprinkler installation, floors 3 through 6', 'Capitol Fire Protection',
     '2026-03-22', 1, 94800, 94800, 'CFP-2026-0088',
     'https://storage.sitesync.ai/invoices/cfp-0088.pdf',
     false, NULL, user_mike);

  -- -------------------------------------------------------------------------
  -- Invoices Payable: 5 invoices (received, coded, approved, paid, paid)
  -- -------------------------------------------------------------------------
  INSERT INTO invoices_payable (id, project_id, vendor, invoice_number, invoice_date, due_date, amount, tax, total, status, cost_code, po_number, document_url, notes, approved_by, approved_at, paid_date, check_number, created_by) VALUES
    (inv_01, project_id,
     'Apex Steel Fabricators', 'ASF-2026-1180',
     '2026-02-28', '2026-03-30',
     487500, 38025, 525525,
     'paid', '05 12 00', NULL,
     'https://storage.sitesync.ai/invoices/asf-1180.pdf',
     'Final payment for structural steel package, floors 14 through 18.',
     user_mike, now() - interval '20 days',
     '2026-03-28', 'CHK-10452',
     user_mike),

    (inv_02, project_id,
     'Bigge Crane and Rigging', 'BGCR-2026-3300',
     '2026-03-01', '2026-03-31',
     42000, 0, 42000,
     'approved', '01 50 00', NULL,
     'https://storage.sitesync.ai/invoices/bgcr-3300.pdf',
     'Tower crane monthly rental, March 2026.',
     user_mike, now() - interval '5 days',
     NULL, NULL,
     user_mike),

    (inv_03, project_id,
     'Metro Mechanical Contractors', 'MMC-2026-0290',
     '2026-03-15', '2026-04-14',
     187500, 0, 187500,
     'coded', '23 00 00', NULL,
     'https://storage.sitesync.ai/invoices/mmc-0290.pdf',
     'HVAC ductwork installation progress payment. Verified against field completion.',
     NULL, NULL,
     NULL, NULL,
     user_mike),

    (inv_04, project_id,
     'Lone Star Electric', 'LSE-2026-1140',
     '2026-03-20', '2026-04-19',
     156000, 0, 156000,
     'received', '26 00 00', NULL,
     'https://storage.sitesync.ai/invoices/lse-1140.pdf',
     'Electrical rough in progress billing. Awaiting field verification before coding.',
     NULL, NULL,
     NULL, NULL,
     user_mike),

    (inv_05, project_id,
     'National Mechanical Supply', 'NMS-2026-4420',
     '2026-03-12', '2026-04-11',
     156800, 12230, 169030,
     'paid', '22 11 00', NULL,
     'https://storage.sitesync.ai/invoices/nms-4420.pdf',
     'MEP rough in materials, partial delivery. Backorder credit of $1,850 pending.',
     user_mike, now() - interval '10 days',
     '2026-03-25', 'CHK-10468',
     user_mike);

  -- -------------------------------------------------------------------------
  -- WIP Report: 1 final period report
  -- -------------------------------------------------------------------------
  INSERT INTO wip_reports (id, project_id, period_end, contract_amount, total_costs_to_date, estimated_costs_to_complete, total_estimated_costs, percent_complete_cost, earned_revenue, billed_to_date, over_under_billing, gross_profit, gross_profit_margin, status, created_by) VALUES
    (wip_01, project_id,
     '2026-02-28',
     49875000,
     28450000, 16750000, 45200000,
     62.94,
     31391250, 24023500,
     7367750,
     4675000, 9.37,
     'final',
     user_mike);

  -- -------------------------------------------------------------------------
  -- Retainage Ledger: 3 entries (2 held by owner, 1 held from sub)
  -- -------------------------------------------------------------------------
  INSERT INTO retainage_ledger (id, project_id, contract_id, type, amount, released_amount, balance, release_date, conditions) VALUES
    (ret_01, project_id, ctr_prime, 'held_by_owner',
     2402350, 0, 2402350,
     NULL,
     'Retainage to be released at substantial completion per AIA A201 Section 9.8.5. Owner may release 50% at 50% project completion upon written request.'),

    (ret_02, project_id, ctr_sub, 'held_from_sub',
     297500, 0, 297500,
     NULL,
     'Retainage held per subcontract terms. Release upon completion and acceptance of all structural steel work, receipt of final lien waiver, and closeout documents.'),

    (ret_03, project_id, ctr_prof, 'held_by_owner',
     0, 0, 0,
     '2025-12-20',
     'No retainage held on professional services contract. All payments released upon final report acceptance.');

END $$;
