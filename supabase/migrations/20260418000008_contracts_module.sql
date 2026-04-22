-- Contracts Module
-- Tracks prime contracts, subcontracts, PSAs, and purchase orders.
--
-- NOTE: 00010_accounting_module.sql already created a `contracts` table with
-- a different column naming convention (type, original_value, counterparty,
-- retainage_percent). This migration reconciles both schemas by creating the
-- table fresh if absent, and otherwise adding the new-style columns
-- (contract_type, contract_amount, counterparty_name, retention_percentage)
-- alongside the old ones so every consumer keeps working.

-- ── Case 1: table doesn't exist → create with the new schema ───────────
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  contract_type text CHECK (contract_type IN ('prime','subcontract','psa','purchase_order')),
  title text NOT NULL,
  counterparty_name text,
  counterparty_contact_id uuid REFERENCES directory_contacts(id) ON DELETE SET NULL,
  contract_amount integer NOT NULL DEFAULT 0,  -- cents
  start_date date,
  end_date date,
  status text DEFAULT 'draft',
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

-- ── Case 2: table already exists → additively add the new-style columns ──
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_type text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_amount integer DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS counterparty_name text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS counterparty_contact_id uuid REFERENCES directory_contacts(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS scope_of_work text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS retention_percentage numeric DEFAULT 10;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS insurance_required boolean DEFAULT true;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS bonding_required boolean DEFAULT false;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS executed_date date;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notes text;

-- Backfill new-style columns from legacy ones where both exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='contract_type') THEN
    UPDATE contracts SET contract_type = type WHERE contract_type IS NULL AND type IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='original_value')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='contract_amount') THEN
    -- original_value is numeric dollars; contract_amount is integer cents.
    UPDATE contracts SET contract_amount = ROUND(original_value * 100)::integer
      WHERE contract_amount = 0 AND original_value IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='counterparty')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='counterparty_name') THEN
    UPDATE contracts SET counterparty_name = counterparty WHERE counterparty_name IS NULL AND counterparty IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='retainage_percent')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='retention_percentage') THEN
    UPDATE contracts SET retention_percentage = retainage_percent WHERE retention_percentage IS NULL AND retainage_percent IS NOT NULL;
  END IF;
END $$;

-- ── Indexes — guard each on column existence ─────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='project_id') THEN
    CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='status') THEN
    CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='contract_type') THEN
    CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type);
  END IF;
END $$;

-- ── RLS + policies — safe to re-run ─────────────────────────────────
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
