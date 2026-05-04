-- =============================================================================
-- org_s3_export_config — customer-managed S3 destinations
-- =============================================================================
-- Customer's data engineering team configures their own S3 bucket; we run
-- a nightly cron that exports their org's data as parquet. Their warehouse
-- pulls from their own bucket — we never have ongoing access to their
-- analytics infrastructure.
--
-- Credentials are stored encrypted via pgcrypto. The export edge function
-- decrypts at runtime, signs the request with the customer's STS key, and
-- streams parquet directly. We never persist the customer's data outside
-- of our primary Postgres + their S3 bucket.
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_s3_export_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  /** Region — e.g. 'us-west-2'. */
  bucket_region   text NOT NULL,
  bucket_name     text NOT NULL,
  /** Optional prefix; export writes to s3://bucket/<prefix>/<org_id>/<yyyy-mm-dd>/. */
  bucket_prefix   text,
  /** AWS access keys, encrypted with pgcrypto using the org's KMS key. The
   *  enc_* columns are bytea — never returned by the API row, only consumed
   *  inside the export function via SECURITY DEFINER decrypt helper. */
  enc_access_key_id     bytea,
  enc_secret_access_key bytea,
  /** Optional STS session token for cross-account assume-role flows. */
  enc_session_token     bytea,
  /** Optional max bytes per nightly run; safety belt against runaway tables. */
  max_export_bytes      bigint,
  /** Timestamps for the watcher UI. */
  last_run_at     timestamptz,
  last_run_status text CHECK (last_run_status IN ('success','failed','partial','running','unset')),
  last_run_bytes  bigint,
  last_run_error  text,
  /** Disable without deleting credentials — pause behavior. */
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_s3_export_enabled
  ON org_s3_export_config(organization_id) WHERE enabled = true;

ALTER TABLE org_s3_export_config ENABLE ROW LEVEL SECURITY;

-- Org admins (members of the org) can read their own config; the encrypted
-- columns are NEVER returned by RLS-aware SELECT — the column-level grant
-- below blocks them at the role level.
DO $$ BEGIN
  CREATE POLICY org_s3_admin_select ON org_s3_export_config
    FOR SELECT USING (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;

-- Inserts/updates of credentials go through an encrypt RPC, not direct
-- writes — the RLS policy here gates non-credential fields only.
DO $$ BEGIN
  CREATE POLICY org_s3_admin_update_meta ON org_s3_export_config
    FOR UPDATE USING (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object OR undefined_table THEN NULL; END $$;
