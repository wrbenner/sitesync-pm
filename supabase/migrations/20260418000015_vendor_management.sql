-- Vendor Management Module
-- Tracks subcontractors, suppliers, consultants with performance history.

CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  trade text,
  license_number text,
  insurance_expiry date,
  bonding_capacity integer, -- cents
  status text DEFAULT 'active' CHECK (status IN ('active','probation','suspended','blacklisted')),
  performance_score numeric,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_project ON vendors(project_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_trade ON vendors(trade);

CREATE TABLE IF NOT EXISTS vendor_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  evaluator uuid REFERENCES auth.users(id),
  quality_score integer CHECK (quality_score BETWEEN 1 AND 5),
  schedule_score integer CHECK (schedule_score BETWEEN 1 AND 5),
  safety_score integer CHECK (safety_score BETWEEN 1 AND 5),
  communication_score integer CHECK (communication_score BETWEEN 1 AND 5),
  overall_score numeric GENERATED ALWAYS AS ((quality_score + schedule_score + safety_score + communication_score) / 4.0) STORED,
  comments text,
  evaluated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_evaluations_vendor ON vendor_evaluations(vendor_id);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendors_select ON vendors;
CREATE POLICY vendors_select ON vendors FOR SELECT
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendors_insert ON vendors;
CREATE POLICY vendors_insert ON vendors FOR INSERT
  WITH CHECK (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendors_update ON vendors;
CREATE POLICY vendors_update ON vendors FOR UPDATE
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendors_delete ON vendors;
CREATE POLICY vendors_delete ON vendors FOR DELETE
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendor_evaluations_select ON vendor_evaluations;
CREATE POLICY vendor_evaluations_select ON vendor_evaluations FOR SELECT
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendor_evaluations_insert ON vendor_evaluations;
CREATE POLICY vendor_evaluations_insert ON vendor_evaluations FOR INSERT
  WITH CHECK (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendor_evaluations_update ON vendor_evaluations;
CREATE POLICY vendor_evaluations_update ON vendor_evaluations FOR UPDATE
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendor_evaluations_delete ON vendor_evaluations;
CREATE POLICY vendor_evaluations_delete ON vendor_evaluations FOR DELETE
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
