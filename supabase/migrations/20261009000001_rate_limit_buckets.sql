-- =============================================================================
-- 20261009000001_rate_limit_buckets.sql
-- BRT subsystem 8 §4.1 — per-tenant rate-limit primitive.
--
-- Generalizes the existing per-user `check_ai_rate_limit()` (00020) into a
-- multi-bucket per-org limiter that all edge functions and frontend retry
-- logic can share. Replaces ad-hoc in-function rateLimitMap patterns
-- (e.g., supabase/functions/send-notification) with a durable Postgres-backed
-- counter that survives function cold starts.
--
-- Bucket model: a (org_id, bucket_key, window_start) row holds a counter
-- for that org's calls of that operation in that fixed window. Windows are
-- aligned to wall-clock seconds via a deterministic floor — this means two
-- callers in the same window get the same window_start without coordination.
-- Old rows are reaped nightly by cron-rate-limit-purge.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- rate_limit_buckets — the counters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bucket_key    text        NOT NULL,
  window_start  timestamptz NOT NULL,
  count         int         NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_window
  ON rate_limit_buckets (window_start);

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- No client-side reads or writes — this table is service-role only.
-- Edge functions go through check_rate_limit() (SECURITY DEFINER) below.

-- ---------------------------------------------------------------------------
-- rate_limit_overrides — per-org per-bucket limit override (e.g. enterprise)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rate_limit_overrides (
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bucket_key  text NOT NULL,
  limit_value int  NOT NULL CHECK (limit_value > 0),
  reason      text,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id),
  PRIMARY KEY (org_id, bucket_key)
);

ALTER TABLE rate_limit_overrides ENABLE ROW LEVEL SECURITY;

-- Internal admins read; no UI writes (manual SQL only at Beta).
DROP POLICY IF EXISTS rate_limit_overrides_admin_select ON rate_limit_overrides;
CREATE POLICY rate_limit_overrides_admin_select ON rate_limit_overrides FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- check_rate_limit() — the only public API.
--
-- Returns true if the call should proceed; false if the bucket is full.
-- Atomically increments the counter. Caller is expected to map false → 429.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_org_id      uuid,
  p_bucket_key  text,
  p_limit       int,
  p_window_sec  int
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window     timestamptz;
  v_count      int;
  v_effective  int := p_limit;
  v_override   int;
BEGIN
  IF p_org_id IS NULL OR p_bucket_key IS NULL OR p_limit IS NULL OR p_window_sec IS NULL THEN
    RAISE EXCEPTION 'check_rate_limit: all four args are required';
  END IF;
  IF p_window_sec <= 0 OR p_limit < 0 THEN
    RAISE EXCEPTION 'check_rate_limit: window_sec must be > 0 and limit >= 0';
  END IF;

  -- Per-org override wins if present.
  SELECT limit_value INTO v_override
  FROM rate_limit_overrides
  WHERE org_id = p_org_id AND bucket_key = p_bucket_key;
  IF v_override IS NOT NULL THEN
    v_effective := v_override;
  END IF;

  -- Quantize "now" down to the start of the current window.
  -- Example: window_sec=3600 → window_start is the top of the current hour.
  v_window := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_sec) * p_window_sec
  );

  -- Atomic increment via UPSERT.
  INSERT INTO rate_limit_buckets (org_id, bucket_key, window_start, count)
  VALUES (p_org_id, p_bucket_key, v_window, 1)
  ON CONFLICT (org_id, bucket_key, window_start)
  DO UPDATE SET count = rate_limit_buckets.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= v_effective;
END $$;

COMMENT ON FUNCTION check_rate_limit IS
  'BRT sub-8 §4.1: atomic per-org rate-limit check. Returns true if call should proceed. Window is fixed (not sliding) — wall-clock aligned for coordination-free use.';

REVOKE EXECUTE ON FUNCTION check_rate_limit(uuid, text, int, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION check_rate_limit(uuid, text, int, int) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- purge_rate_limit_buckets() — purge windows older than 7 days.
-- Wired to a daily cron in supabase/functions/cron-rate-limit-purge.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION purge_rate_limit_buckets()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM rate_limit_buckets
  WHERE window_start < (now() - interval '7 days');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

COMMENT ON FUNCTION purge_rate_limit_buckets IS
  'BRT sub-8 §4.1: nightly purge. Returns row count for cron telemetry.';

REVOKE EXECUTE ON FUNCTION purge_rate_limit_buckets() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION purge_rate_limit_buckets() TO service_role;

-- ---------------------------------------------------------------------------
-- Bucket-key constants (for documentation; enforced only at the call site).
-- ---------------------------------------------------------------------------
--
-- ai_call          : 200/hr   → AI chokepoint, iris-call
-- signup           : 5/hr     → public signup (per-IP at the edge layer)
-- invite_send      : 50/hr    → org-scoped team invites
-- password_reset   : 3/hr     → reset email send
-- webhook_inbound  : 1000/min → Stripe webhooks, GitHub webhooks
-- pdf_export       : 20/hr    → AIA G701/G702 export
-- bulk_import      : 5/day    → CSV/Procore migration
