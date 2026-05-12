-- =============================================================================
-- 20261009000006_onboarding_step.sql
-- BRT subsystem 3 §4.1 — track wizard progress so users resume at the
-- right step on return.
--
-- Also fixes a column-reference bug in 20261009000005_impersonation.sql:
-- profiles uses id (PK) AND user_id (FK to auth.users), and the impersonation
-- function should look up profiles by user_id, not by id. The fix is a
-- non-destructive function replacement.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles.onboarding_step — 0 = not started, 5 = completed.
-- profiles.onboarded_at — pre-existing per migration 20260424000006.
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 0
    CHECK (onboarding_step BETWEEN 0 AND 5);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_role text
    CHECK (onboarding_role IS NULL OR onboarding_role IN ('gc', 'sub', 'owner', 'architect'));

COMMENT ON COLUMN profiles.onboarding_step IS
  'BRT sub-3 §4.1: current onboarding wizard step. 0 = not started, 1-5 = step in progress, 5 = completed (paired with onboarded_at).';

COMMENT ON COLUMN profiles.onboarding_role IS
  'BRT sub-3 §3 (Step 1): persona picked during onboarding. Determines downstream copy + sample-data role. Distinct from profiles.trade (specific subcontractor trade like "electrical").';

-- ---------------------------------------------------------------------------
-- Fix: start_impersonation_session() should resolve admin via profiles.user_id,
-- not profiles.id. Same for the end function. Re-create with corrected lookup.
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
  -- profiles.user_id is the FK to auth.users(id), not profiles.id (which
  -- is the profile row's own PK). Fix from 20261009000005.
  SELECT is_internal_admin INTO v_is_admin
  FROM profiles WHERE user_id = p_impersonator_id;

  IF NOT coalesce(v_is_admin, false) THEN
    RAISE EXCEPTION 'start_impersonation_session: impersonator is not an internal admin';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = p_target_user_id AND organization_id = p_target_org_id
  ) INTO v_target_in_org;

  IF NOT v_target_in_org THEN
    RAISE EXCEPTION 'start_impersonation_session: target user does not belong to target org';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'start_impersonation_session: reason must be at least 10 chars';
  END IF;

  IF p_notification_sent_at IS NULL OR p_notification_sent_at < now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'start_impersonation_session: notification_sent_at missing or stale';
  END IF;

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

-- Same rationale: re-grant since CREATE OR REPLACE preserves grants.
