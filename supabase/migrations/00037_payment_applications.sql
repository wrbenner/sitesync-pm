-- AIA G702/G703 Payment Application system with lien waiver tracking.

-- Payment Applications (AIA G702)
CREATE TABLE IF NOT EXISTS payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) NOT NULL,
  application_number int NOT NULL,
  period_to date NOT NULL,
  contractor_id uuid,
  contractor_name text,
  -- Financial calculations
  original_contract_sum numeric(14,2) NOT NULL DEFAULT 0,
  net_change_orders numeric(14,2) NOT NULL DEFAULT 0,
  contract_sum_to_date numeric(14,2) GENERATED ALWAYS AS (original_contract_sum + net_change_orders) STORED,
  total_completed_and_stored numeric(14,2) NOT NULL DEFAULT 0,
  retainage_percent numeric(5,2) NOT NULL DEFAULT 10.00,
  retainage_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_earned_less_retainage numeric(14,2) GENERATED ALWAYS AS (total_completed_and_stored - retainage_amount) STORED,
  less_previous_certificates numeric(14,2) NOT NULL DEFAULT 0,
  current_payment_due numeric(14,2) NOT NULL DEFAULT 0,
  balance_to_finish numeric(14,2) NOT NULL DEFAULT 0,
  -- Workflow
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'gc_review', 'owner_review', 'approved', 'rejected', 'paid', 'void')),
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id),
  gc_reviewed_at timestamptz,
  gc_reviewed_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  rejected_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id),
  rejection_comments text,
  paid_at timestamptz,
  payment_date date,
  check_number text,
  -- Signatures
  contractor_signature jsonb,
  architect_signature jsonb,
  owner_signature jsonb,
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, application_number)
);

CREATE INDEX idx_payment_apps_project ON payment_applications(project_id, application_number DESC);
CREATE INDEX idx_payment_apps_status ON payment_applications(project_id, status);

ALTER TABLE payment_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_apps_select ON payment_applications FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY pay_apps_insert ON payment_applications FOR INSERT
  WITH CHECK (has_project_permission(project_id, 'project_manager'));
CREATE POLICY pay_apps_update ON payment_applications FOR UPDATE
  USING (has_project_permission(project_id, 'project_manager'));

-- Payment Line Items (AIA G703 Continuation Sheet)
CREATE TABLE IF NOT EXISTS payment_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES payment_applications(id) ON DELETE CASCADE NOT NULL,
  item_number text NOT NULL,
  cost_code text NOT NULL,
  description text NOT NULL,
  scheduled_value numeric(14,2) NOT NULL DEFAULT 0,
  previous_completed numeric(14,2) NOT NULL DEFAULT 0,
  this_period numeric(14,2) NOT NULL DEFAULT 0,
  materials_stored numeric(14,2) NOT NULL DEFAULT 0,
  total_completed_and_stored numeric(14,2) GENERATED ALWAYS AS (previous_completed + this_period + materials_stored) STORED,
  percent_complete numeric(5,2) NOT NULL DEFAULT 0,
  balance_to_finish numeric(14,2) NOT NULL DEFAULT 0,
  retainage numeric(14,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pay_line_items_app ON payment_line_items(application_id, sort_order);

-- Lien Waivers
CREATE TABLE IF NOT EXISTS lien_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) NOT NULL,
  application_id uuid REFERENCES payment_applications(id),
  contractor_name text NOT NULL,
  amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'conditional', 'unconditional', 'final', 'waived')),
  waiver_state text NOT NULL DEFAULT 'generic' CHECK (waiver_state IN ('california', 'texas', 'florida', 'new_york', 'generic')),
  through_date date NOT NULL,
  signed_at timestamptz,
  signed_by text,
  document_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_lien_waivers_project ON lien_waivers(project_id);
CREATE INDEX idx_lien_waivers_app ON lien_waivers(application_id);

ALTER TABLE lien_waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY lien_waivers_select ON lien_waivers FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
CREATE POLICY lien_waivers_manage ON lien_waivers FOR ALL
  USING (has_project_permission(project_id, 'project_manager'));

-- Triggers
CREATE TRIGGER set_pay_apps_updated_at BEFORE UPDATE ON payment_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_lien_waivers_updated_at BEFORE UPDATE ON lien_waivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
