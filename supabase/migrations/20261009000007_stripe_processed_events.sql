-- =============================================================================
-- 20261009000007_stripe_processed_events.sql
-- BRT sub-4 §4.3 — Stripe webhook idempotency dedup table.
--
-- Stripe occasionally retries webhook deliveries (network blip, our 5xx,
-- their internal retry). Without dedup, the same event handled twice can
-- double-process: a customer.subscription.created event re-creating the
-- subscription row, etc. Insert-or-skip on event.id makes our handlers
-- idempotent without each handler having to track its own state.
-- =============================================================================

CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id     text PRIMARY KEY,           -- Stripe's evt_xxx id
  event_type   text NOT NULL,              -- e.g. 'customer.subscription.created'
  processed_at timestamptz NOT NULL DEFAULT now(),
  result       text NOT NULL CHECK (result IN ('success', 'failure', 'skip')),
  error_msg    text
);

CREATE INDEX IF NOT EXISTS idx_stripe_processed_events_type_time
  ON stripe_processed_events (event_type, processed_at DESC);

-- 7-day retention is enough for replay protection; older rows can be purged.
CREATE OR REPLACE FUNCTION purge_stripe_processed_events()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM stripe_processed_events
  WHERE processed_at < (now() - interval '7 days');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

COMMENT ON FUNCTION purge_stripe_processed_events IS
  'BRT sub-4 §4.3: nightly purge of dedup rows older than 7 days.';

REVOKE EXECUTE ON FUNCTION purge_stripe_processed_events() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION purge_stripe_processed_events() TO service_role;

-- Frontend never reads this; service-role only.
ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- cancellation_reasons — captures the user's freeform reason from the
-- pre-portal modal so we can read why customers leave.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cancellation_reasons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  reason          text NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_reasons_org_time
  ON cancellation_reasons (organization_id, created_at DESC);

ALTER TABLE cancellation_reasons ENABLE ROW LEVEL SECURITY;

-- Org owner/admin can read their own org's reasons; internal admins can read all.
DROP POLICY IF EXISTS cancellation_reasons_owner_read ON cancellation_reasons;
CREATE POLICY cancellation_reasons_owner_read ON cancellation_reasons FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE user_id = (select auth.uid()) AND is_internal_admin = true
    )
  );
