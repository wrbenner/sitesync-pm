-- =============================================================================
-- 20261009000008_dunning_email_log.sql
-- BRT subsystem 4 §4.4 — dunning email idempotency log.
--
-- The dunning-email-send cron consults this table before sending each
-- (subscription, kind) tuple — duplicates are skipped. Without it, a
-- daily cron rerun (or a re-deploy of the function) would send the same
-- "your account is paused" email many times.
-- =============================================================================

CREATE TABLE IF NOT EXISTS dunning_email_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN (
    'trial_ending_in_3_days',
    'payment_failed_day_1',
    'payment_failed_day_3',
    'payment_failed_day_7',
    'account_paused_day_8'
  )),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_dunning_email_log_org_time
  ON dunning_email_log (organization_id, sent_at DESC);

ALTER TABLE dunning_email_log ENABLE ROW LEVEL SECURITY;

-- Org owners + internal admins can see their own dunning history.
DROP POLICY IF EXISTS dunning_email_log_owner_read ON dunning_email_log;
CREATE POLICY dunning_email_log_owner_read ON dunning_email_log FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE user_id = (select auth.uid()) AND is_internal_admin = true
    )
  );

-- Service role only writes; no INSERT policy = client INSERT denied.
