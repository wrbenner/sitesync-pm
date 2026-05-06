-- ═══════════════════════════════════════════════════════════════
-- Migration: org_sso_config + sso_login_events
-- Version: 20260502100000
--
-- Purpose: per-organization SAML 2.0 / OIDC identity provider config
-- + an audit trail of SSO assertions. The Org Admin pastes their IdP
-- metadata (SAML XML) or OIDC discovery URL, picks attribute mappings,
-- and tests with a single user before enabling org-wide.
--
-- We support both protocols because the IT director's IdP catalog
-- usually exposes one or the other (Okta SAML, Azure AD OIDC, etc.).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_sso_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  protocol            text NOT NULL CHECK (protocol IN ('saml', 'oidc')),
  enabled             boolean NOT NULL DEFAULT false,

  -- ── SAML ──
  -- Identity provider entity id (issuer). Compared against the
  -- assertion's <Issuer> element on each login.
  saml_idp_entity_id  text,
  -- Single Sign-On URL we redirect users to.
  saml_sso_url        text,
  -- Public certificate (PEM, no header trim) used to verify the
  -- assertion signature. Multiple certs allowed during rotation
  -- — separate with a sentinel newline `-----END CERTIFICATE-----`.
  saml_x509_certs     text,
  -- Audience that must match in the assertion's AudienceRestriction.
  saml_sp_entity_id   text,

  -- ── OIDC ──
  oidc_issuer         text,
  oidc_client_id      text,
  -- Encrypted at rest. Stored as TEXT to allow rotation without TYPE change.
  oidc_client_secret_ciphertext text,
  oidc_authorization_endpoint   text,
  oidc_token_endpoint           text,
  oidc_userinfo_endpoint        text,
  oidc_jwks_uri                 text,

  -- ── Attribute mapping (both protocols) ──
  -- JSON object: { "email": "EMAIL", "first_name": "FIRSTNAME",
  -- "last_name": "LASTNAME", "groups": "MEMBEROF" }. Caller-defined
  -- attribute names; the SSO handler reads them via this mapping.
  attribute_mapping   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Group → role mapping. JSON object: { "GC-PMs": "pm",
  -- "GC-Owners": "owner" }. The handler reads the user's claimed
  -- groups and assigns the matching role on JIT provision.
  group_role_mapping  jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Default role when no group mapping matches. NULL = block login
  -- (user must be added manually).
  default_role        text,

  -- JIT user provisioning toggle. When false, only pre-existing
  -- users can sign in via SSO — good for staged rollout.
  allow_jit_provision boolean NOT NULL DEFAULT true,

  -- Test mode: when true, only `test_user_emails[]` can sign in.
  test_mode_enabled   boolean NOT NULL DEFAULT true,
  test_user_emails    text[]  NOT NULL DEFAULT ARRAY[]::text[],

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id),
  updated_by  uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_org_sso_config_org ON org_sso_config (organization_id);

ALTER TABLE org_sso_config ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_sso_config_org_admin_rw') THEN
    CREATE POLICY org_sso_config_org_admin_rw ON org_sso_config
      FOR ALL
      USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ))
      WITH CHECK (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
END $$;

-- ── SSO login events: every assertion processed (success or fail) ──
CREATE TABLE IF NOT EXISTS sso_login_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  protocol        text NOT NULL,
  email           text,
  user_id         uuid REFERENCES auth.users(id),
  outcome         text NOT NULL CHECK (outcome IN ('success','blocked_no_email','blocked_no_org','blocked_test_mode','blocked_signature','blocked_default_role','provisioned')),
  ip_address      text,
  user_agent      text,
  raw_assertion_excerpt text,  -- first 500 chars, useful for IT debug page
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sso_login_events_org ON sso_login_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sso_login_events_email ON sso_login_events (email);

ALTER TABLE sso_login_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sso_login_events_org_admin_read') THEN
    CREATE POLICY sso_login_events_org_admin_read ON sso_login_events
      FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
END $$;
