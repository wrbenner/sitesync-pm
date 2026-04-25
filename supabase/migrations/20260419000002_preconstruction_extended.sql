-- =============================================================================
-- SiteSync PM: Extended Preconstruction Module
-- Adds subcontractor database, bid invitations with tracking, scope items
-- for bid leveling, and bid-level scope responses for comparison matrices.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Subcontractor Database (organization-level)
-- ---------------------------------------------------------------------------
-- A GC's subcontractor database is their competitive advantage.
-- This stores contacts, trades, prequalification status, and performance.

CREATE TABLE IF NOT EXISTS precon_subcontractors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  company_name    text NOT NULL,
  contact_name    text,
  email           text,
  phone           text,
  address         text,
  city            text,
  state           text,
  zip             text,
  -- Trade classification
  primary_trade   text,
  csi_divisions   integer[] DEFAULT '{}',
  -- Prequalification
  prequalified    boolean DEFAULT false,
  prequalified_at timestamptz,
  bonding_limit   integer, -- cents
  insurance_verified boolean DEFAULT false,
  license_number  text,
  -- Performance tracking
  rating          numeric CHECK (rating >= 0 AND rating <= 5),
  projects_completed integer DEFAULT 0,
  avg_bid_accuracy numeric, -- percentage: how close bids are to final cost
  notes           text,
  tags            text[] DEFAULT '{}',
  -- Status
  status          text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted', 'pending_review')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_subcontractors' AND column_name = 'organization_id') THEN

    CREATE INDEX IF NOT EXISTS idx_precon_subs_org ON precon_subcontractors(organization_id);

  END IF;

END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_subcontractors' AND column_name = 'primary_trade') THEN
    CREATE INDEX IF NOT EXISTS idx_precon_subs_trade ON precon_subcontractors(primary_trade);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_subcontractors' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_precon_subs_status ON precon_subcontractors(status);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_subcontractors' AND column_name = 'company_name') THEN
    CREATE INDEX IF NOT EXISTS idx_precon_subs_company ON precon_subcontractors(company_name);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Bid Invitations (track who was invited to each bid package)
-- ---------------------------------------------------------------------------
-- This is the heart of bid management: tracking which subs were invited,
-- whether they've viewed the invitation, and their response status.

CREATE TABLE IF NOT EXISTS precon_bid_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_package_id  uuid REFERENCES precon_bid_packages(id) ON DELETE CASCADE NOT NULL,
  subcontractor_id uuid REFERENCES precon_subcontractors(id) ON DELETE SET NULL,
  -- Allow manual entry without a sub record
  company_name    text NOT NULL,
  contact_name    text,
  email           text,
  phone           text,
  -- Tracking
  status          text DEFAULT 'invited' CHECK (status IN (
                    'invited', 'viewed', 'bidding', 'declined', 'submitted', 'no_response'
                  )),
  invited_at      timestamptz DEFAULT now(),
  viewed_at       timestamptz,
  responded_at    timestamptz,
  decline_reason  text,
  notes           text,
  -- Link to submission if they bid
  bid_submission_id uuid REFERENCES precon_bid_submissions(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_bid_invitations' AND column_name = 'bid_package_id') THEN

    CREATE INDEX IF NOT EXISTS idx_precon_invitations_pkg ON precon_bid_invitations(bid_package_id);

  END IF;

END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_bid_invitations' AND column_name = 'subcontractor_id') THEN
    CREATE INDEX IF NOT EXISTS idx_precon_invitations_sub ON precon_bid_invitations(subcontractor_id);
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_bid_invitations' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_precon_invitations_status ON precon_bid_invitations(status);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Scope Items (per bid package, for bid leveling)
-- ---------------------------------------------------------------------------
-- Each bid package has a list of scope items. During bid leveling,
-- we check which items each bidder includes, excludes, or qualifies.

CREATE TABLE IF NOT EXISTS precon_scope_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_package_id  uuid REFERENCES precon_bid_packages(id) ON DELETE CASCADE NOT NULL,
  description     text NOT NULL,
  category        text, -- e.g. 'Labor', 'Material', 'Equipment', 'General'
  sort_order      integer DEFAULT 0,
  required        boolean DEFAULT true, -- is this a required scope item?
  created_at      timestamptz DEFAULT now()
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_scope_items' AND column_name = 'bid_package_id') THEN

    CREATE INDEX IF NOT EXISTS idx_precon_scope_items_pkg ON precon_scope_items(bid_package_id);

  END IF;

END $$;

-- ---------------------------------------------------------------------------
-- 4. Bid Scope Responses (per bidder per scope item)
-- ---------------------------------------------------------------------------
-- For each scope item, each bidder's response: included, excluded, or qualified.
-- This powers the bid leveling comparison matrix.

CREATE TABLE IF NOT EXISTS precon_bid_scope_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_item_id   uuid REFERENCES precon_scope_items(id) ON DELETE CASCADE NOT NULL,
  bid_submission_id uuid REFERENCES precon_bid_submissions(id) ON DELETE CASCADE NOT NULL,
  response        text DEFAULT 'unknown' CHECK (response IN (
                    'included', 'excluded', 'qualified', 'unknown'
                  )),
  qualification_note text, -- explanation if qualified
  cost_impact     integer, -- cents, estimated cost if excluded
  created_at      timestamptz DEFAULT now(),
  UNIQUE(scope_item_id, bid_submission_id)
);

DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_bid_scope_responses' AND column_name = 'scope_item_id') THEN

    CREATE INDEX IF NOT EXISTS idx_precon_scope_resp_item ON precon_bid_scope_responses(scope_item_id);

  END IF;

END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'precon_bid_scope_responses' AND column_name = 'bid_submission_id') THEN
    CREATE INDEX IF NOT EXISTS idx_precon_scope_resp_sub ON precon_bid_scope_responses(bid_submission_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Add columns to existing tables
-- ---------------------------------------------------------------------------

-- Add awarded_to text field for company name (not just UUID)
ALTER TABLE precon_bid_packages ADD COLUMN IF NOT EXISTS awarded_to_company text;
ALTER TABLE precon_bid_packages ADD COLUMN IF NOT EXISTS pre_bid_meeting timestamptz;
ALTER TABLE precon_bid_packages ADD COLUMN IF NOT EXISTS addenda_count integer DEFAULT 0;

-- Add evaluation fields to submissions
ALTER TABLE precon_bid_submissions ADD COLUMN IF NOT EXISTS exclusions text;
ALTER TABLE precon_bid_submissions ADD COLUMN IF NOT EXISTS inclusions text;
ALTER TABLE precon_bid_submissions ADD COLUMN IF NOT EXISTS qualifications text;
ALTER TABLE precon_bid_submissions ADD COLUMN IF NOT EXISTS schedule_days integer;
ALTER TABLE precon_bid_submissions ADD COLUMN IF NOT EXISTS bond_included boolean;
ALTER TABLE precon_bid_submissions ADD COLUMN IF NOT EXISTS alternate_amounts jsonb DEFAULT '[]';

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE precon_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE precon_bid_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE precon_scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE precon_bid_scope_responses ENABLE ROW LEVEL SECURITY;

-- Subcontractors: org-level access
DROP POLICY IF EXISTS precon_subs_select ON precon_subcontractors;
CREATE POLICY precon_subs_select ON precon_subcontractors FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS precon_subs_insert ON precon_subcontractors;
CREATE POLICY precon_subs_insert ON precon_subcontractors FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS precon_subs_update ON precon_subcontractors;
CREATE POLICY precon_subs_update ON precon_subcontractors FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS precon_subs_delete ON precon_subcontractors;
CREATE POLICY precon_subs_delete ON precon_subcontractors FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Bid Invitations: project-level through bid_packages
DROP POLICY IF EXISTS precon_invitations_select ON precon_bid_invitations;
CREATE POLICY precon_invitations_select ON precon_bid_invitations FOR SELECT
  USING (bid_package_id IN (
    SELECT id FROM precon_bid_packages WHERE project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS precon_invitations_insert ON precon_bid_invitations;
CREATE POLICY precon_invitations_insert ON precon_bid_invitations FOR INSERT
  WITH CHECK (bid_package_id IN (
    SELECT id FROM precon_bid_packages WHERE project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS precon_invitations_update ON precon_bid_invitations;
CREATE POLICY precon_invitations_update ON precon_bid_invitations FOR UPDATE
  USING (bid_package_id IN (
    SELECT id FROM precon_bid_packages WHERE project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS precon_invitations_delete ON precon_bid_invitations;
CREATE POLICY precon_invitations_delete ON precon_bid_invitations FOR DELETE
  USING (bid_package_id IN (
    SELECT id FROM precon_bid_packages WHERE project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

-- Scope Items: project-level through bid_packages
DROP POLICY IF EXISTS precon_scope_items_select ON precon_scope_items;
CREATE POLICY precon_scope_items_select ON precon_scope_items FOR SELECT
  USING (bid_package_id IN (
    SELECT id FROM precon_bid_packages WHERE project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS precon_scope_items_insert ON precon_scope_items;
CREATE POLICY precon_scope_items_insert ON precon_scope_items FOR INSERT
  WITH CHECK (bid_package_id IN (
    SELECT id FROM precon_bid_packages WHERE project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS precon_scope_items_update ON precon_scope_items;
CREATE POLICY precon_scope_items_update ON precon_scope_items FOR UPDATE
  USING (bid_package_id IN (
    SELECT id FROM precon_bid_packages WHERE project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS precon_scope_items_delete ON precon_scope_items;
CREATE POLICY precon_scope_items_delete ON precon_scope_items FOR DELETE
  USING (bid_package_id IN (
    SELECT id FROM precon_bid_packages WHERE project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  ));

-- Scope Responses: through scope_items -> bid_packages
DROP POLICY IF EXISTS precon_scope_resp_select ON precon_bid_scope_responses;
CREATE POLICY precon_scope_resp_select ON precon_bid_scope_responses FOR SELECT
  USING (scope_item_id IN (
    SELECT id FROM precon_scope_items WHERE bid_package_id IN (
      SELECT id FROM precon_bid_packages WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  ));

DROP POLICY IF EXISTS precon_scope_resp_insert ON precon_bid_scope_responses;
CREATE POLICY precon_scope_resp_insert ON precon_bid_scope_responses FOR INSERT
  WITH CHECK (scope_item_id IN (
    SELECT id FROM precon_scope_items WHERE bid_package_id IN (
      SELECT id FROM precon_bid_packages WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  ));

DROP POLICY IF EXISTS precon_scope_resp_update ON precon_bid_scope_responses;
CREATE POLICY precon_scope_resp_update ON precon_bid_scope_responses FOR UPDATE
  USING (scope_item_id IN (
    SELECT id FROM precon_scope_items WHERE bid_package_id IN (
      SELECT id FROM precon_bid_packages WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  ));

DROP POLICY IF EXISTS precon_scope_resp_delete ON precon_bid_scope_responses;
CREATE POLICY precon_scope_resp_delete ON precon_bid_scope_responses FOR DELETE
  USING (scope_item_id IN (
    SELECT id FROM precon_scope_items WHERE bid_package_id IN (
      SELECT id FROM precon_bid_packages WHERE project_id IN (
        SELECT project_id FROM project_members WHERE user_id = auth.uid()
      )
    )
  ));
