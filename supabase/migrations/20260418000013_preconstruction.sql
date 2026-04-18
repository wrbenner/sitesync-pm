-- Preconstruction & Bidding Module (Enterprise)
-- Adds enterprise-style bid packages for the Preconstruction page.
-- Note: existing `bid_packages` and `bid_responses` tables remain for legacy use.
-- This module introduces `precon_bid_packages` and `precon_bid_submissions` for the new UI.

CREATE TABLE IF NOT EXISTS precon_bid_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  package_number text NOT NULL,
  title text NOT NULL,
  description text,
  csi_division integer,
  trade text,
  estimated_value integer DEFAULT 0, -- cents
  bid_due_date timestamptz,
  status text DEFAULT 'draft' CHECK (status IN ('draft','issued','receiving_bids','evaluating','awarded','cancelled')),
  awarded_to uuid,
  awarded_amount integer,
  scope_documents jsonb DEFAULT '[]',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_precon_bid_packages_project ON precon_bid_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_precon_bid_packages_status ON precon_bid_packages(status);

CREATE TABLE IF NOT EXISTS precon_bid_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_package_id uuid REFERENCES precon_bid_packages(id) ON DELETE CASCADE NOT NULL,
  bidder_name text NOT NULL,
  bidder_company text,
  bid_amount integer NOT NULL, -- cents
  submitted_at timestamptz DEFAULT now(),
  notes text,
  file_url text,
  status text DEFAULT 'received' CHECK (status IN ('received','under_review','shortlisted','accepted','rejected')),
  evaluation_score numeric
);

CREATE INDEX IF NOT EXISTS idx_precon_bid_submissions_package ON precon_bid_submissions(bid_package_id);

ALTER TABLE precon_bid_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE precon_bid_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS precon_bid_packages_select ON precon_bid_packages;
CREATE POLICY precon_bid_packages_select ON precon_bid_packages FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS precon_bid_packages_insert ON precon_bid_packages;
CREATE POLICY precon_bid_packages_insert ON precon_bid_packages FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS precon_bid_packages_update ON precon_bid_packages;
CREATE POLICY precon_bid_packages_update ON precon_bid_packages FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS precon_bid_packages_delete ON precon_bid_packages;
CREATE POLICY precon_bid_packages_delete ON precon_bid_packages FOR DELETE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS precon_bid_submissions_select ON precon_bid_submissions;
CREATE POLICY precon_bid_submissions_select ON precon_bid_submissions FOR SELECT
  USING (bid_package_id IN (SELECT id FROM precon_bid_packages WHERE project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS precon_bid_submissions_insert ON precon_bid_submissions;
CREATE POLICY precon_bid_submissions_insert ON precon_bid_submissions FOR INSERT
  WITH CHECK (bid_package_id IN (SELECT id FROM precon_bid_packages WHERE project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS precon_bid_submissions_update ON precon_bid_submissions;
CREATE POLICY precon_bid_submissions_update ON precon_bid_submissions FOR UPDATE
  USING (bid_package_id IN (SELECT id FROM precon_bid_packages WHERE project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS precon_bid_submissions_delete ON precon_bid_submissions;
CREATE POLICY precon_bid_submissions_delete ON precon_bid_submissions FOR DELETE
  USING (bid_package_id IN (SELECT id FROM precon_bid_packages WHERE project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())));
