-- Contracts Module
-- Tracks prime contracts, subcontracts, PSAs, and purchase orders.

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  contract_type text NOT NULL CHECK (contract_type IN ('prime','subcontract','psa','purchase_order')),
  title text NOT NULL,
  counterparty_name text NOT NULL,
  counterparty_contact_id uuid REFERENCES directory_contacts(id) ON DELETE SET NULL,
  contract_amount integer NOT NULL DEFAULT 0,  -- cents
  start_date date,
  end_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft','pending_signature','active','completed','terminated')),
  scope_of_work text,
  retention_percentage numeric DEFAULT 10,
  insurance_required boolean DEFAULT true,
  bonding_required boolean DEFAULT false,
  executed_date date,
  file_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contracts_select ON contracts;
CREATE POLICY contracts_select ON contracts FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS contracts_insert ON contracts;
CREATE POLICY contracts_insert ON contracts FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS contracts_update ON contracts;
CREATE POLICY contracts_update ON contracts FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS contracts_delete ON contracts;
CREATE POLICY contracts_delete ON contracts FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
