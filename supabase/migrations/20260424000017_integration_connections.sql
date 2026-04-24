-- ═══════════════════════════════════════════════════════════════
-- Migration: integration_connections
-- Version: 20260424000017
-- Purpose: Connection ledger for the /integrations page. One row per
--          organization↔provider pair tracking auth state, last sync,
--          and encrypted OAuth tokens. Sync history lives in
--          integration_sync_jobs (separate migration).
--
-- Real OAuth callback handling is NOT wired yet — the page stubs it via
--   1. Connect → insert with status='pending_auth'
--   2. Confirm → UPDATE status='connected'
-- Encrypted-token columns are reserved for the eventual real flow.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integration_connections (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider                     text NOT NULL
    CHECK (provider IN ('procore', 'sage', 'quickbooks', 'autodesk_bim360', 'oracle_aconex')),
  account_name                 text,
  status                       text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'pending_auth', 'connected', 'error', 'revoked')),
  oauth_token_encrypted        text,
  oauth_refresh_token_encrypted text,
  expires_at                   timestamptz,
  last_sync_at                 timestamptz,
  scope                        text,
  metadata                     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_org
  ON integration_connections (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_connections_org_provider
  ON integration_connections (organization_id, provider);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status
  ON integration_connections (organization_id, status);

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_integration_connections_updated_at ON integration_connections;
CREATE TRIGGER trg_integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
-- Integration state is org-wide (shared across all projects in the org),
-- so policies key off organization_members rather than project_members.
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_connections_select ON integration_connections;
CREATE POLICY integration_connections_select ON integration_connections FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS integration_connections_insert ON integration_connections;
CREATE POLICY integration_connections_insert ON integration_connections FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS integration_connections_update ON integration_connections;
CREATE POLICY integration_connections_update ON integration_connections FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS integration_connections_delete ON integration_connections;
CREATE POLICY integration_connections_delete ON integration_connections FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
  ));
