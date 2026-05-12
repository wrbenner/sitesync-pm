-- =============================================================================
-- 20261009000009_storage_backup_log.sql
-- BRT subsystem 8 §4.3 — storage backup heartbeat + run log.
--
-- The cron-storage-backup function appends one row per run. The dashboard
-- (and the BACKUP_RESTORE_DRILL.md verification step) reads from here to
-- confirm "did yesterday's backup actually happen?" without hitting S3.
--
-- Sentry / Slack alert fires if no row has been written in > 36 hours.
-- =============================================================================

CREATE TABLE IF NOT EXISTS storage_backup_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at              timestamptz NOT NULL DEFAULT now(),
  buckets_scanned     int NOT NULL DEFAULT 0,
  objects_replicated  int NOT NULL DEFAULT 0,
  bytes_replicated    bigint NOT NULL DEFAULT 0,
  result              text NOT NULL CHECK (result IN ('success', 'partial', 'failure')),
  error_summary       text
);

CREATE INDEX IF NOT EXISTS idx_storage_backup_log_ran_at
  ON storage_backup_log (ran_at DESC);

ALTER TABLE storage_backup_log ENABLE ROW LEVEL SECURITY;

-- Internal admins read.
DROP POLICY IF EXISTS storage_backup_log_admin_read ON storage_backup_log;
CREATE POLICY storage_backup_log_admin_read ON storage_backup_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = (select auth.uid()) AND is_internal_admin = true)
  );

-- No client INSERT/UPDATE/DELETE policies = service-role only.
