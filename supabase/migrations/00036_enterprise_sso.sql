-- Enterprise SSO/SAML configuration and compliance infrastructure

-- SSO Configurations per organization
CREATE TABLE IF NOT EXISTS sso_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider IN ('okta', 'azure_ad', 'onelogin', 'google_workspace')),
  entity_id text NOT NULL,
  sso_url text NOT NULL,
  certificate text NOT NULL,
  enforced boolean DEFAULT false,
  jit_provisioning boolean DEFAULT true,
  default_role text DEFAULT 'viewer',
  allowed_domains text[] NOT NULL DEFAULT '{}',
  scim_enabled boolean DEFAULT false,
  scim_endpoint text,
  scim_token_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sso_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY sso_config_select ON sso_configurations FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid())));
CREATE POLICY sso_config_manage ON sso_configurations FOR ALL
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid()) AND role = 'owner'));

-- Audit trail retention settings per organization
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS audit_retention_years int DEFAULT 7;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_region text DEFAULT 'us' CHECK (data_region IN ('us', 'eu', 'au'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS compliance_level text DEFAULT 'standard' CHECK (compliance_level IN ('standard', 'soc2', 'iso27001'));

-- Encrypted fields vault (references to Supabase Vault secrets)
CREATE TABLE IF NOT EXISTS encrypted_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  vault_secret_id uuid NOT NULL, -- Reference to Supabase Vault
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users,
  UNIQUE (entity_type, entity_id, field_name)
);

CREATE INDEX idx_encrypted_fields_entity ON encrypted_fields(entity_type, entity_id);

ALTER TABLE encrypted_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY encrypted_fields_select ON encrypted_fields FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));
CREATE POLICY encrypted_fields_manage ON encrypted_fields FOR ALL
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')));

-- Compliance reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations NOT NULL,
  project_id uuid REFERENCES projects,
  report_type text NOT NULL CHECK (report_type IN ('soc2_evidence', 'access_report', 'audit_summary', 'data_export')),
  generated_by uuid REFERENCES auth.users NOT NULL,
  date_range_start timestamptz NOT NULL,
  date_range_end timestamptz NOT NULL,
  file_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_compliance_reports_org ON compliance_reports(organization_id, created_at DESC);

ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_reports_select ON compliance_reports FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')));

-- Notification preferences (for weekly digest opt-out)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users,
  weekly_digest boolean DEFAULT true,
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  sms_notifications boolean DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_prefs_own ON notification_preferences FOR ALL
  USING (user_id = (select auth.uid()));

-- Triggers
CREATE TRIGGER set_sso_config_updated_at BEFORE UPDATE ON sso_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_notif_prefs_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
