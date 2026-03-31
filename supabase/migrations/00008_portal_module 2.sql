-- =============================================================================
-- External Access Portals Module
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Portal Invitations
CREATE TABLE portal_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  portal_type text NOT NULL CHECK (portal_type IN ('owner','subcontractor','architect','inspector')),
  email text NOT NULL,
  name text,
  company text,
  permissions jsonb DEFAULT '["dashboard","documents","photos"]',
  token text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  accepted boolean DEFAULT false,
  accepted_at timestamptz,
  invited_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
);

-- Portal Users
CREATE TABLE portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  portal_type text NOT NULL CHECK (portal_type IN ('owner','subcontractor','architect','inspector')),
  company text,
  permissions jsonb DEFAULT '["dashboard","documents","photos"]',
  last_login timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Owner Updates
CREATE TABLE owner_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text,
  photos jsonb DEFAULT '[]',
  schedule_summary text,
  budget_summary text,
  milestone_updates jsonb DEFAULT '[]',
  weather_summary text,
  published boolean DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Subcontractor Invoices
CREATE TABLE subcontractor_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  subcontractor_id uuid REFERENCES portal_users,
  invoice_number text,
  period_start date,
  period_end date,
  scheduled_value numeric DEFAULT 0,
  work_completed_previous numeric DEFAULT 0,
  work_completed_this_period numeric DEFAULT 0,
  materials_stored numeric DEFAULT 0,
  total_completed numeric DEFAULT 0,
  retainage_percent numeric DEFAULT 10,
  retainage_amount numeric DEFAULT 0,
  amount_due numeric DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','approved','paid','rejected')),
  submitted_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  backup_documents jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insurance Certificates
CREATE TABLE insurance_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  company text NOT NULL,
  subcontractor_id uuid REFERENCES portal_users,
  policy_type text CHECK (policy_type IN ('general_liability','workers_comp','auto','umbrella','professional_liability','pollution')),
  carrier text,
  policy_number text,
  coverage_amount numeric,
  aggregate_limit numeric,
  effective_date date,
  expiration_date date,
  additional_insured boolean DEFAULT false,
  waiver_of_subrogation boolean DEFAULT false,
  document_url text,
  verified boolean DEFAULT false,
  verified_by uuid REFERENCES auth.users,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

-- Portal invitations
CREATE INDEX idx_portal_invitations_project ON portal_invitations(project_id);
CREATE INDEX idx_portal_invitations_email ON portal_invitations(email);
CREATE INDEX idx_portal_invitations_token ON portal_invitations(token);
CREATE INDEX idx_portal_invitations_invited_by ON portal_invitations(invited_by);
CREATE INDEX idx_portal_invitations_expires ON portal_invitations(expires_at);

-- Portal users
CREATE INDEX idx_portal_users_user ON portal_users(user_id);
CREATE INDEX idx_portal_users_project ON portal_users(project_id);
CREATE INDEX idx_portal_users_type ON portal_users(portal_type);

-- Owner updates
CREATE INDEX idx_owner_updates_project ON owner_updates(project_id);
CREATE INDEX idx_owner_updates_published ON owner_updates(published);
CREATE INDEX idx_owner_updates_created_by ON owner_updates(created_by);
CREATE INDEX idx_owner_updates_published_at ON owner_updates(published_at);

-- Subcontractor invoices
CREATE INDEX idx_sub_invoices_project ON subcontractor_invoices(project_id);
CREATE INDEX idx_sub_invoices_subcontractor ON subcontractor_invoices(subcontractor_id);
CREATE INDEX idx_sub_invoices_status ON subcontractor_invoices(status);
CREATE INDEX idx_sub_invoices_period ON subcontractor_invoices(period_start, period_end);
CREATE INDEX idx_sub_invoices_submitted_at ON subcontractor_invoices(submitted_at);

-- Insurance certificates
CREATE INDEX idx_insurance_certs_project ON insurance_certificates(project_id);
CREATE INDEX idx_insurance_certs_subcontractor ON insurance_certificates(subcontractor_id);
CREATE INDEX idx_insurance_certs_company ON insurance_certificates(company);
CREATE INDEX idx_insurance_certs_expiration ON insurance_certificates(expiration_date);
CREATE INDEX idx_insurance_certs_policy_type ON insurance_certificates(policy_type);

-- ---------------------------------------------------------------------------
-- 3. Updated At Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER set_owner_updates_updated_at
  BEFORE UPDATE ON owner_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_sub_invoices_updated_at
  BEFORE UPDATE ON subcontractor_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_insurance_certs_updated_at
  BEFORE UPDATE ON insurance_certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE portal_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_certificates ENABLE ROW LEVEL SECURITY;

-- Portal Invitations: project members can manage, invited user can view their own
CREATE POLICY portal_invitations_select ON portal_invitations FOR SELECT
  USING (
    is_project_member(project_id)
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY portal_invitations_insert ON portal_invitations FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY portal_invitations_update ON portal_invitations FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY portal_invitations_delete ON portal_invitations FOR DELETE
  USING (is_project_member(project_id));

-- Portal Users: project members see all, portal user sees own record
CREATE POLICY portal_users_select ON portal_users FOR SELECT
  USING (
    is_project_member(project_id)
    OR user_id = auth.uid()
  );

CREATE POLICY portal_users_insert ON portal_users FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY portal_users_update ON portal_users FOR UPDATE
  USING (
    is_project_member(project_id)
    OR user_id = auth.uid()
  );

CREATE POLICY portal_users_delete ON portal_users FOR DELETE
  USING (is_project_member(project_id));

-- Owner Updates: project members full CRUD, published updates visible to portal users of that project
CREATE POLICY owner_updates_select ON owner_updates FOR SELECT
  USING (
    is_project_member(project_id)
    OR (published = true AND project_id IN (
      SELECT pu.project_id FROM portal_users pu WHERE pu.user_id = auth.uid()
    ))
  );

CREATE POLICY owner_updates_insert ON owner_updates FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY owner_updates_update ON owner_updates FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY owner_updates_delete ON owner_updates FOR DELETE
  USING (is_project_member(project_id));

-- Subcontractor Invoices: project members see all, sub sees their own
CREATE POLICY sub_invoices_select ON subcontractor_invoices FOR SELECT
  USING (
    is_project_member(project_id)
    OR subcontractor_id IN (
      SELECT pu.id FROM portal_users pu WHERE pu.user_id = auth.uid()
    )
  );

CREATE POLICY sub_invoices_insert ON subcontractor_invoices FOR INSERT
  WITH CHECK (
    is_project_member(project_id)
    OR subcontractor_id IN (
      SELECT pu.id FROM portal_users pu WHERE pu.user_id = auth.uid()
    )
  );

CREATE POLICY sub_invoices_update ON subcontractor_invoices FOR UPDATE
  USING (
    is_project_member(project_id)
    OR subcontractor_id IN (
      SELECT pu.id FROM portal_users pu WHERE pu.user_id = auth.uid()
    )
  );

CREATE POLICY sub_invoices_delete ON subcontractor_invoices FOR DELETE
  USING (is_project_member(project_id));

-- Insurance Certificates: project members see all, sub sees their own company
CREATE POLICY insurance_certs_select ON insurance_certificates FOR SELECT
  USING (
    is_project_member(project_id)
    OR company IN (
      SELECT pu.company FROM portal_users pu WHERE pu.user_id = auth.uid()
    )
  );

CREATE POLICY insurance_certs_insert ON insurance_certificates FOR INSERT
  WITH CHECK (
    is_project_member(project_id)
    OR company IN (
      SELECT pu.company FROM portal_users pu WHERE pu.user_id = auth.uid()
    )
  );

CREATE POLICY insurance_certs_update ON insurance_certificates FOR UPDATE
  USING (
    is_project_member(project_id)
    OR company IN (
      SELECT pu.company FROM portal_users pu WHERE pu.user_id = auth.uid()
    )
  );

CREATE POLICY insurance_certs_delete ON insurance_certificates FOR DELETE
  USING (is_project_member(project_id));

-- =============================================================================
-- Seed Data
-- =============================================================================

DO $$
DECLARE
  user_mike UUID := '11111111-1111-1111-1111-111111111111';
  project_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  -- Portal invitation IDs
  inv_owner UUID := 'cc000001-0000-0000-0000-000000000001';
  inv_architect UUID := 'cc000001-0000-0000-0000-000000000002';
  inv_sub UUID := 'cc000001-0000-0000-0000-000000000003';

  -- Portal user IDs
  pu_owner UUID := 'cc000002-0000-0000-0000-000000000001';
  pu_architect UUID := 'cc000002-0000-0000-0000-000000000002';

  -- Owner update IDs
  ou_1 UUID := 'cc000003-0000-0000-0000-000000000001';
  ou_2 UUID := 'cc000003-0000-0000-0000-000000000002';
  ou_3 UUID := 'cc000003-0000-0000-0000-000000000003';

  -- Sub invoice IDs
  si_1 UUID := 'cc000004-0000-0000-0000-000000000001';
  si_2 UUID := 'cc000004-0000-0000-0000-000000000002';

  -- Placeholder sub portal user for invoices
  pu_sub UUID := 'cc000002-0000-0000-0000-000000000003';
BEGIN

  -- -------------------------------------------------------------------------
  -- Portal Invitations: 1 owner (accepted), 1 architect (accepted), 1 sub (pending)
  -- -------------------------------------------------------------------------
  INSERT INTO portal_invitations (id, project_id, portal_type, email, name, company, permissions, accepted, accepted_at, invited_by) VALUES
    (inv_owner, project_id, 'owner', 'david.chen@riverside-ventures.com', 'David Chen', 'Riverside Ventures LLC',
     '["dashboard","documents","photos","budget","schedule"]', true, now() - interval '14 days', user_mike),
    (inv_architect, project_id, 'architect', 'sarah.martinez@hkpa-architects.com', 'Sarah Martinez', 'HKP Architects',
     '["dashboard","documents","photos","rfis","submittals","drawings"]', true, now() - interval '10 days', user_mike),
    (inv_sub, project_id, 'subcontractor', 'tony.garcia@precisionmech.com', 'Tony Garcia', 'Precision Mechanical Inc.',
     '["dashboard","documents","invoices","insurance"]', false, NULL, user_mike);

  -- -------------------------------------------------------------------------
  -- Portal Users: owner and architect (accepted invitations)
  -- -------------------------------------------------------------------------
  INSERT INTO portal_users (id, user_id, project_id, portal_type, company, permissions, last_login) VALUES
    (pu_owner, NULL, project_id, 'owner', 'Riverside Ventures LLC',
     '["dashboard","documents","photos","budget","schedule"]', now() - interval '1 day'),
    (pu_architect, NULL, project_id, 'architect', 'HKP Architects',
     '["dashboard","documents","photos","rfis","submittals","drawings"]', now() - interval '3 days');

  -- Create the sub portal user for invoice references
  INSERT INTO portal_users (id, user_id, project_id, portal_type, company, permissions, last_login) VALUES
    (pu_sub, NULL, project_id, 'subcontractor', 'Precision Mechanical Inc.',
     '["dashboard","documents","invoices","insurance"]', NULL);

  -- -------------------------------------------------------------------------
  -- Owner Updates: 2 published, 1 draft
  -- -------------------------------------------------------------------------
  INSERT INTO owner_updates (id, project_id, title, content, photos, schedule_summary, budget_summary, milestone_updates, weather_summary, published, published_at, created_by) VALUES
    (ou_1, project_id, 'March Week 3 Progress Update',
     'Structural steel erection on floors 14 through 18 completed ahead of schedule. Curtain wall installation commenced on the south elevation. Mechanical rough in continues on floors 8 through 12 with no major issues.',
     '["https://storage.sitesync.ai/photos/update-001a.jpg","https://storage.sitesync.ai/photos/update-001b.jpg"]',
     'Overall project is 65% complete. Steel erection running 4 days ahead. Interior framing on track for floors 6 through 10.',
     'Current spend: $33.8M of $52M budget (65%). Forecast remains within 2% of baseline.',
     '[{"milestone":"Steel Topping Out","status":"complete","date":"2026-03-15"},{"milestone":"Curtain Wall Start","status":"in_progress","date":"2026-03-18"},{"milestone":"Elevator Installation","status":"upcoming","date":"2026-04-05"}]',
     'Clear skies this week, highs in the low 70s. No weather delays anticipated.',
     true, now() - interval '5 days', user_mike),

    (ou_2, project_id, 'March Week 4 Draft',
     'Curtain wall south elevation 40% complete. Elevator shaft preparation underway. MEP coordination meetings held for floors 13 through 16.',
     '[]',
     'Project at 67% completion. Curtain wall progressing well.',
     'Current spend: $34.2M of $52M budget (65.8%). No change orders pending.',
     '[{"milestone":"Curtain Wall South","status":"in_progress","date":"2026-03-25"},{"milestone":"Elevator Shaft Prep","status":"in_progress","date":"2026-03-22"}]',
     'Chance of rain Thursday. Contingency plan in place for exterior work.',
     false, NULL, user_mike),

    (ou_3, project_id, 'March Week 2 Progress Update',
     'Foundation waterproofing passed final inspection. Structural steel delivery for floors 14 through 18 arrived on schedule. Tower crane repositioned for upper floor work.',
     '["https://storage.sitesync.ai/photos/update-003a.jpg"]',
     'Overall project is 62% complete. All trades on schedule or ahead.',
     'Current spend: $32.1M of $52M budget (61.7%). Two pending change orders totaling $84K under review.',
     '[{"milestone":"Waterproofing Inspection","status":"complete","date":"2026-03-10"},{"milestone":"Steel Delivery Floors 14 to 18","status":"complete","date":"2026-03-09"}]',
     'Mild temperatures, partly cloudy. Ideal conditions for exterior work.',
     true, now() - interval '12 days', user_mike);

  -- -------------------------------------------------------------------------
  -- Subcontractor Invoices: 1 approved, 1 submitted
  -- -------------------------------------------------------------------------
  INSERT INTO subcontractor_invoices (id, project_id, subcontractor_id, invoice_number, period_start, period_end, scheduled_value, work_completed_previous, work_completed_this_period, materials_stored, total_completed, retainage_percent, retainage_amount, amount_due, status, submitted_at, approved_at, notes) VALUES
    (si_1, project_id, pu_sub, 'PMI-2026-007', '2026-02-01', '2026-02-28',
     4200000, 1890000, 420000, 85000, 2395000, 10, 239500, 265500,
     'approved', now() - interval '18 days', now() - interval '10 days',
     'February application. Ductwork installation floors 8 through 10 complete. Equipment pads poured for rooftop units.'),

    (si_2, project_id, pu_sub, 'PMI-2026-008', '2026-03-01', '2026-03-31',
     4200000, 2395000, 378000, 62000, 2835000, 10, 283500, 156500,
     'submitted', now() - interval '3 days', NULL,
     'March application. Mechanical rough in floors 11 and 12 in progress. VAV boxes delivered and staged.');

  -- -------------------------------------------------------------------------
  -- Insurance Certificates: 6 across 3 companies
  -- -------------------------------------------------------------------------
  INSERT INTO insurance_certificates (project_id, company, subcontractor_id, policy_type, carrier, policy_number, coverage_amount, aggregate_limit, effective_date, expiration_date, additional_insured, waiver_of_subrogation, verified, verified_by, verified_at) VALUES
    -- Precision Mechanical Inc. (2 policies)
    (project_id, 'Precision Mechanical Inc.', pu_sub, 'general_liability',
     'Hartford Insurance', 'HRT-GL-2026-44891', 2000000, 4000000,
     '2026-01-01', '2027-01-01', true, true, true, user_mike, now() - interval '30 days'),

    (project_id, 'Precision Mechanical Inc.', pu_sub, 'workers_comp',
     'Hartford Insurance', 'HRT-WC-2026-44892', 1000000, 1000000,
     '2026-01-01', '2027-01-01', false, true, true, user_mike, now() - interval '30 days'),

    -- Apex Steel Fabricators (2 policies, one expiring soon)
    (project_id, 'Apex Steel Fabricators', NULL, 'general_liability',
     'Zurich North America', 'ZNA-GL-2025-77210', 2000000, 5000000,
     '2025-06-15', '2026-06-15', true, true, true, user_mike, now() - interval '60 days'),

    (project_id, 'Apex Steel Fabricators', NULL, 'auto',
     'Zurich North America', 'ZNA-AU-2025-77211', 1000000, 1000000,
     '2025-06-15', '2026-04-15', true, false, true, user_mike, now() - interval '60 days'),

    -- Summit Electrical Contractors (2 policies, one unverified)
    (project_id, 'Summit Electrical Contractors', NULL, 'general_liability',
     'Liberty Mutual', 'LM-GL-2026-33100', 2000000, 4000000,
     '2026-02-01', '2027-02-01', true, true, true, user_mike, now() - interval '20 days'),

    (project_id, 'Summit Electrical Contractors', NULL, 'umbrella',
     'Liberty Mutual', 'LM-UMB-2026-33101', 5000000, 5000000,
     '2026-02-01', '2027-02-01', true, true, false, NULL, NULL);

END $$;
