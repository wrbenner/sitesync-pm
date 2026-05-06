-- COI Expiration → Site Check-In Gate
--
-- Adds:
--   * coi_check_in_blocks    — active blocks preventing crew check-in when COI lapsed
--   * coi_expiration_alerts  — log of 14/7/3/1-day reminder emails sent
-- Plus columns on insurance_certificates for finer-grained reminder tracking.
--
-- Day 0 means the cert has expired AND we have not received a renewal upload —
-- the foreman gets a banner explaining why crew check-in is blocked. GC/PM can
-- override with a typed reason that goes into the override row's audit log.
--
-- Idempotent. Safe to re-run.

-- 1. Track which reminder thresholds we've already emailed to avoid spam.
ALTER TABLE insurance_certificates
  ADD COLUMN IF NOT EXISTS reminder_thresholds_sent integer[] DEFAULT '{}';

ALTER TABLE insurance_certificates
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

-- 2. Active block rows. One row per (project, subcontractor) when crew check-in
--    should be blocked. Cleared (deleted or block_until set in past) when a
--    valid COI is uploaded.
CREATE TABLE IF NOT EXISTS coi_check_in_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subcontractor_id uuid, -- nullable: if we only know company_name we still block
  insurance_certificate_id uuid REFERENCES insurance_certificates(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  -- Why is this block active?
  reason text NOT NULL DEFAULT 'coi_expired',
  expired_on date NOT NULL,
  -- Override fields
  overridden_at timestamptz,
  overridden_by uuid REFERENCES auth.users(id),
  override_reason text,
  block_until timestamptz, -- nullable; if non-null and in past, treat as cleared
  -- Provenance
  created_via text DEFAULT 'cron' CHECK (created_via IN ('cron', 'ui', 'api', 'edge_function')),
  source_drafted_action_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE coi_check_in_blocks ADD COLUMN IF NOT EXISTS overridden_at timestamptz;
ALTER TABLE coi_check_in_blocks ADD COLUMN IF NOT EXISTS overridden_by uuid;
ALTER TABLE coi_check_in_blocks ADD COLUMN IF NOT EXISTS override_reason text;
ALTER TABLE coi_check_in_blocks ADD COLUMN IF NOT EXISTS block_until timestamptz;
ALTER TABLE coi_check_in_blocks ADD COLUMN IF NOT EXISTS source_drafted_action_id uuid;
ALTER TABLE coi_check_in_blocks ADD COLUMN IF NOT EXISTS created_via text DEFAULT 'cron';

CREATE INDEX IF NOT EXISTS idx_coi_blocks_project ON coi_check_in_blocks(project_id);
CREATE INDEX IF NOT EXISTS idx_coi_blocks_subcontractor ON coi_check_in_blocks(subcontractor_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_coi_blocks_active
  ON coi_check_in_blocks(project_id, COALESCE(subcontractor_id, '00000000-0000-0000-0000-000000000000'::uuid), insurance_certificate_id)
  WHERE overridden_at IS NULL;

ALTER TABLE coi_check_in_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coi_blocks_select ON coi_check_in_blocks;
CREATE POLICY coi_blocks_select ON coi_check_in_blocks FOR SELECT
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS coi_blocks_insert ON coi_check_in_blocks;
CREATE POLICY coi_blocks_insert ON coi_check_in_blocks FOR INSERT
  WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));

DROP POLICY IF EXISTS coi_blocks_update ON coi_check_in_blocks;
CREATE POLICY coi_blocks_update ON coi_check_in_blocks FOR UPDATE
  USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));

-- 3. Alert log so we can see the trail of reminders sent for a given cert.
CREATE TABLE IF NOT EXISTS coi_expiration_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_certificate_id uuid NOT NULL REFERENCES insurance_certificates(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  threshold_days integer NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'notification', 'sms')),
  recipient text,
  delivery_status text DEFAULT 'queued' CHECK (delivery_status IN ('queued', 'sent', 'failed', 'no_email_configured')),
  failure_reason text,
  created_via text DEFAULT 'cron',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coi_alerts_cert ON coi_expiration_alerts(insurance_certificate_id, created_at DESC);

ALTER TABLE coi_expiration_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coi_alerts_select ON coi_expiration_alerts;
CREATE POLICY coi_alerts_select ON coi_expiration_alerts FOR SELECT
  USING (project_id IS NULL OR project_id IN (SELECT project_id FROM project_members WHERE user_id = (select auth.uid())));
