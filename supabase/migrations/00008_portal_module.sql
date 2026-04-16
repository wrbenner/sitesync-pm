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
    OR email = (SELECT email FROM auth.users WHERE id = (select auth.uid()))
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
    OR user_id = (select auth.uid())
  );

CREATE POLICY portal_users_insert ON portal_users FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY portal_users_update ON portal_users FOR UPDATE
  USING (
    is_project_member(project_id)
    OR user_id = (select auth.uid())
  );

CREATE POLICY portal_users_delete ON portal_users FOR DELETE
  USING (is_project_member(project_id));

-- Owner Updates: project members full CRUD, published updates visible to portal users of that project
CREATE POLICY owner_updates_select ON owner_updates FOR SELECT
  USING (
    is_project_member(project_id)
    OR (published = true AND project_id IN (
      SELECT pu.project_id FROM portal_users pu WHERE pu.user_id = (select auth.uid())
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
      SELECT pu.id FROM portal_users pu WHERE pu.user_id = (select auth.uid())
    )
  );

CREATE POLICY sub_invoices_insert ON subcontractor_invoices FOR INSERT
  WITH CHECK (
    is_project_member(project_id)
    OR subcontractor_id IN (
      SELECT pu.id FROM portal_users pu WHERE pu.user_id = (select auth.uid())
    )
  );

CREATE POLICY sub_invoices_update ON subcontractor_invoices FOR UPDATE
  USING (
    is_project_member(project_id)
    OR subcontractor_id IN (
      SELECT pu.id FROM portal_users pu WHERE pu.user_id = (select auth.uid())
    )
  );

CREATE POLICY sub_invoices_delete ON subcontractor_invoices FOR DELETE
  USING (is_project_member(project_id));

-- Insurance Certificates: project members see all, sub sees their own company
CREATE POLICY insurance_certs_select ON insurance_certificates FOR SELECT
  USING (
    is_project_member(project_id)
    OR company IN (
      SELECT pu.company FROM portal_users pu WHERE pu.user_id = (select auth.uid())
    )
  );

CREATE POLICY insurance_certs_insert ON insurance_certificates FOR INSERT
  WITH CHECK (
    is_project_member(project_id)
    OR company IN (
      SELECT pu.company FROM portal_users pu WHERE pu.user_id = (select auth.uid())
    )
  );

CREATE POLICY insurance_certs_update ON insurance_certificates FOR UPDATE
  USING (
    is_project_member(project_id)
    OR company IN (
      SELECT pu.company FROM portal_users pu WHERE pu.user_id = (select auth.uid())
    )
  );

CREATE POLICY insurance_certs_delete ON insurance_certificates FOR DELETE
  USING (is_project_member(project_id));

