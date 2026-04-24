-- ═══════════════════════════════════════════════════════════════
-- Migration: integration_sync_jobs
-- Version: 20260424000018
-- Purpose: Per-connection sync history. One row per manual or scheduled
--          sync attempt — fuels the sync-history table on the
--          /integrations detail panel.
--
-- RLS inherits org membership by joining through integration_connections
-- so we don't need a separate organization_id column.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integration_sync_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id      uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  entity_type        text NOT NULL
    CHECK (entity_type IN ('rfis', 'submittals', 'budget', 'drawings', 'schedule', 'documents')),
  direction          text NOT NULL DEFAULT 'bidirectional'
    CHECK (direction IN ('import', 'export', 'bidirectional')),
  status             text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  records_processed  integer NOT NULL DEFAULT 0,
  records_failed     integer NOT NULL DEFAULT 0,
  error_message      text,
  started_at         timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_connection
  ON integration_sync_jobs (connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_status
  ON integration_sync_jobs (status)
  WHERE status IN ('queued', 'running');

-- ── updated_at trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_integration_sync_jobs_updated_at ON integration_sync_jobs;
CREATE TRIGGER trg_integration_sync_jobs_updated_at
  BEFORE UPDATE ON integration_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
-- Policies gate on the connection's organization, so any org member
-- who can see the connection can see its sync history.
ALTER TABLE integration_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_sync_jobs_select ON integration_sync_jobs;
CREATE POLICY integration_sync_jobs_select ON integration_sync_jobs FOR SELECT
  USING (connection_id IN (
    SELECT c.id FROM integration_connections c
      WHERE c.organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
  ));

DROP POLICY IF EXISTS integration_sync_jobs_insert ON integration_sync_jobs;
CREATE POLICY integration_sync_jobs_insert ON integration_sync_jobs FOR INSERT
  WITH CHECK (connection_id IN (
    SELECT c.id FROM integration_connections c
      WHERE c.organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
  ));

DROP POLICY IF EXISTS integration_sync_jobs_update ON integration_sync_jobs;
CREATE POLICY integration_sync_jobs_update ON integration_sync_jobs FOR UPDATE
  USING (connection_id IN (
    SELECT c.id FROM integration_connections c
      WHERE c.organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
  ));

DROP POLICY IF EXISTS integration_sync_jobs_delete ON integration_sync_jobs;
CREATE POLICY integration_sync_jobs_delete ON integration_sync_jobs FOR DELETE
  USING (connection_id IN (
    SELECT c.id FROM integration_connections c
      WHERE c.organization_id IN (
        SELECT organization_id FROM organization_members
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
      )
  ));
