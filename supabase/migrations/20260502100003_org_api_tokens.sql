-- ═══════════════════════════════════════════════════════════════
-- Migration: org_api_tokens
-- Version: 20260502100003
--
-- Purpose: long-lived API tokens for org admins to mint, with a
-- scoped permission set. The integration team's wedge.
--
-- Storage: only SHA-256(token) is persisted. The original token is
-- shown to the admin once at mint time and never again. Lookup at
-- request time is constant-time hash compare.
--
-- Rotation + revocation are first-class: revoking sets revoked_at;
-- the gateway rejects any token with non-null revoked_at.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_api_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Display label for the admin UI.
  name            text NOT NULL,
  description     text,
  -- 6-char human-readable prefix (e.g. "ss_live_AB12CD") so admins
  -- can recognize tokens in logs without revealing the full secret.
  prefix          text NOT NULL,
  -- SHA-256 of the original token. Constant-time compared at validate.
  token_hash      text NOT NULL UNIQUE,
  -- Scoped permission identifiers. Subset of the Permission union from
  -- src/hooks/usePermissions.ts. Empty = no permissions (token can do
  -- nothing — useful as a placeholder before scope is set).
  scopes          text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- Project filter. NULL = all projects in the org. Non-null array =
  -- only those project ids.
  project_ids     uuid[],

  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  expires_at      timestamptz,
  last_used_at    timestamptz,
  use_count       int NOT NULL DEFAULT 0,
  -- Captured opportunistically on the first use; useful for forensic
  -- "where was this token first activated?".
  first_used_ip   text,
  first_used_ua   text,

  -- Revocation
  revoked_at      timestamptz,
  revoked_by      uuid REFERENCES auth.users(id),
  revoked_reason  text
);

CREATE INDEX IF NOT EXISTS idx_org_api_tokens_org
  ON org_api_tokens (organization_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_org_api_tokens_prefix
  ON org_api_tokens (prefix);

-- API token usage log — one row per request. Volume is high; we GC
-- rows older than 90d via a follow-up cron.
CREATE TABLE IF NOT EXISTS org_api_token_uses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id        uuid NOT NULL REFERENCES org_api_tokens(id) ON DELETE CASCADE,
  used_at         timestamptz NOT NULL DEFAULT now(),
  ip_address      text,
  user_agent      text,
  endpoint        text,
  outcome         text NOT NULL CHECK (outcome IN ('ok','denied','expired','revoked','rate_limited')),
  status_code     int
);
CREATE INDEX IF NOT EXISTS idx_org_api_token_uses_token
  ON org_api_token_uses (token_id, used_at DESC);

ALTER TABLE org_api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_api_token_uses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_api_tokens_admin_rw') THEN
    CREATE POLICY org_api_tokens_admin_rw ON org_api_tokens
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_api_token_uses_admin_read') THEN
    CREATE POLICY org_api_token_uses_admin_read ON org_api_token_uses
      FOR SELECT
      USING (token_id IN (
        SELECT t.id FROM org_api_tokens t
        JOIN organization_members m ON m.organization_id = t.organization_id
        WHERE m.user_id = auth.uid() AND m.role IN ('owner','admin')
      ));
  END IF;
END $$;
