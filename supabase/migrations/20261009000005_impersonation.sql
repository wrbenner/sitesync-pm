-- =============================================================================
-- 20261009000005_impersonation.sql
-- BRT subsystem 6 §4.3 — admin impersonation infrastructure.
--
-- Lets internal SiteSync support engineers (Walker today; future support
-- hires) sign in *as* a customer to debug an issue without screen-sharing.
-- This is the most invasive privilege in the system and must be
-- deposition-grade traceable.
--
-- Hard contract: customer notification fires BEFORE the session JWT is
-- returned. If the notification cannot be queued, the session is REFUSED,
-- not silently issued. The notification is a feature, not a bug — it
-- builds trust. Customers cannot opt out of being notified about
-- impersonation.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extend the notifications.type CHECK constraint to include the
-- impersonation_started type. Required so the start-impersonation edge fn
-- can write the customer notification.
-- ---------------------------------------------------------------------------

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'rfi_assigned', 'submittal_review', 'punch_item',
    'task_update', 'meeting_reminder', 'ai_alert',
    'daily_log_approval',
    -- BRT sub-6 §4.3
    'impersonation_started', 'impersonation_ended'
  ));

-- ---------------------------------------------------------------------------
-- profiles.is_internal_admin — gate for /admin and impersonation initiation.
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_internal_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.is_internal_admin IS
  'BRT sub-6 §4.3: gate for /admin routes and impersonation initiation. Manually set via SQL only — there is no UI surface to toggle this. Setting requires a written audit-log entry.';

-- Partial index — there should be very few internal admins (Founder + future
-- support hires), so a tiny index on the predicate is cheap.
CREATE INDEX IF NOT EXISTS idx_profiles_internal_admin
  ON profiles (id) WHERE is_internal_admin = true;

-- ---------------------------------------------------------------------------
-- impersonation_sessions — append-only audit table.
-- Every impersonation session creates a row; it is never updated, only the
-- ended_at column is filled. Append-only is enforced by RLS (no UPDATE
-- policy except for the controlled end_impersonation_session function).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  impersonator_user_id  uuid NOT NULL REFERENCES auth.users(id),
  target_user_id        uuid NOT NULL REFERENCES auth.users(id),
  target_org_id         uuid NOT NULL REFERENCES organizations(id),
  reason                text NOT NULL CHECK (length(reason) BETWEEN 10 AND 1000),
  started_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL,
  ended_at              timestamptz,
  ended_reason          text,
  notification_sent_at  timestamptz NOT NULL,  -- the notify-before-JWT timestamp
  ip_address            inet,
  user_agent            text,
  CHECK (expires_at > started_at),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target
  ON impersonation_sessions (target_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_impersonator
  ON impersonation_sessions (impersonator_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active
  ON impersonation_sessions (id) WHERE ended_at IS NULL;

ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Read policies: internal admins see all; org owners see sessions targeting their org.
DROP POLICY IF EXISTS impersonation_sessions_admin_read ON impersonation_sessions;
CREATE POLICY impersonation_sessions_admin_read ON impersonation_sessions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_internal_admin = true)
  );

DROP POLICY IF EXISTS impersonation_sessions_org_owner_read ON impersonation_sessions;
CREATE POLICY impersonation_sessions_org_owner_read ON impersonation_sessions FOR SELECT
  USING (
    target_org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (select auth.uid()) AND role IN ('owner', 'admin')
    )
  );

-- No INSERT/UPDATE/DELETE from clients — only via the SECURITY DEFINER
-- functions below. Append-only-ness comes from absence of policies + RLS on.

-- ---------------------------------------------------------------------------
-- start_impersonation_session()
--
-- Creates an impersonation session row with notification_sent_at populated.
-- If the caller's notification queue write fails (handled at the edge
-- function layer), this row is never inserted. Returns the new session id
-- for the edge function to mint the JWT against.
--
-- The function REQUIRES that p_notification_sent_at be passed by the caller
-- (the edge function), proving notification was queued before the SQL was
-- called. We don't trust the timestamp — we just require its presence as
-- a control-flow forcing function.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION start_impersonation_session(
  p_impersonator_id      uuid,
  p_target_user_id       uuid,
  p_target_org_id        uuid,
  p_reason               text,
  p_notification_sent_at timestamptz,
  p_duration_minutes     int DEFAULT 30,
  p_ip_address           inet DEFAULT NULL,
  p_user_agent           text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_is_admin   boolean;
  v_target_in_org boolean;
BEGIN
  -- Validate impersonator IS an internal admin. Defense in depth — the
  -- edge function should have checked this already, but the SQL refuses too.
  SELECT is_internal_admin INTO v_is_admin
  FROM profiles WHERE id = p_impersonator_id;

  IF NOT coalesce(v_is_admin, false) THEN
    RAISE EXCEPTION 'start_impersonation_session: impersonator is not an internal admin';
  END IF;

  -- Validate target user belongs to target org. Prevents impersonating
  -- a user under an org they don't actually belong to (which would mint
  -- a JWT with no working org context).
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = p_target_user_id AND organization_id = p_target_org_id
  ) INTO v_target_in_org;

  IF NOT v_target_in_org THEN
    RAISE EXCEPTION 'start_impersonation_session: target user does not belong to target org';
  END IF;

  -- Reason quality gate.
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'start_impersonation_session: reason must be at least 10 chars';
  END IF;

  -- Notification-sent-at must be present and recent. Edge function should
  -- have just queued it. Reject sessions where the notification timestamp
  -- is older than 60 seconds (suspicious — possible replay).
  IF p_notification_sent_at IS NULL OR p_notification_sent_at < now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'start_impersonation_session: notification_sent_at missing or stale';
  END IF;

  -- Cap session duration at 60 minutes regardless of caller request.
  IF p_duration_minutes <= 0 OR p_duration_minutes > 60 THEN
    RAISE EXCEPTION 'start_impersonation_session: duration must be 1..60 minutes';
  END IF;

  INSERT INTO impersonation_sessions (
    impersonator_user_id,
    target_user_id,
    target_org_id,
    reason,
    started_at,
    expires_at,
    notification_sent_at,
    ip_address,
    user_agent
  ) VALUES (
    p_impersonator_id,
    p_target_user_id,
    p_target_org_id,
    trim(p_reason),
    now(),
    now() + (p_duration_minutes || ' minutes')::interval,
    p_notification_sent_at,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_session_id;

  -- Mirror to audit_log so the standard chain captures it too.
  INSERT INTO audit_log (
    organization_id, user_id, entity_type, entity_id, action, metadata
  ) VALUES (
    p_target_org_id,
    p_impersonator_id,
    'impersonation_session',
    v_session_id,
    'create',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'duration_minutes', p_duration_minutes,
      'reason', trim(p_reason)
    )
  );

  RETURN v_session_id;
END $$;

COMMENT ON FUNCTION start_impersonation_session IS
  'BRT sub-6 §4.3: open an impersonation session. Refuses if impersonator is not is_internal_admin, if target is not in target_org, if reason < 10 chars, if notification_sent_at is missing/stale, or if duration exceeds 60 min. The notification_sent_at parameter is a control-flow forcing function — the edge function must queue the customer notification before calling this.';

REVOKE EXECUTE ON FUNCTION start_impersonation_session(uuid, uuid, uuid, text, timestamptz, int, inet, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION start_impersonation_session(uuid, uuid, uuid, text, timestamptz, int, inet, text) TO service_role;

-- ---------------------------------------------------------------------------
-- end_impersonation_session() — flip ended_at + ended_reason.
-- Called from end-impersonation edge fn OR auto-expire cron.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION end_impersonation_session(
  p_session_id uuid,
  p_reason     text DEFAULT 'manual'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_org uuid;
  v_impersonator uuid;
  v_target_user uuid;
BEGIN
  UPDATE impersonation_sessions
  SET ended_at = now(),
      ended_reason = coalesce(nullif(trim(p_reason), ''), 'manual')
  WHERE id = p_session_id AND ended_at IS NULL
  RETURNING target_org_id, impersonator_user_id, target_user_id
    INTO v_target_org, v_impersonator, v_target_user;

  IF v_target_org IS NULL THEN
    RETURN false; -- already ended or not found
  END IF;

  INSERT INTO audit_log (
    organization_id, user_id, entity_type, entity_id, action, metadata
  ) VALUES (
    v_target_org,
    v_impersonator,
    'impersonation_session',
    p_session_id,
    'update',
    jsonb_build_object(
      'ended_reason', p_reason,
      'target_user_id', v_target_user,
      'state', 'ended'
    )
  );

  RETURN true;
END $$;

COMMENT ON FUNCTION end_impersonation_session IS
  'BRT sub-6 §4.3: close an impersonation session. Idempotent — already-ended sessions return false.';

REVOKE EXECUTE ON FUNCTION end_impersonation_session(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION end_impersonation_session(uuid, text) TO service_role;
