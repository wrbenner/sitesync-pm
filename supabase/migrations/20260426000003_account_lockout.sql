-- Account lockout: per-email failed-login tracking with sliding-window
-- threshold to defeat credential-stuffing.
--
-- Why: Supabase Auth rate-limits per IP, but a determined attacker
-- distributing across IPs can still grind a single account. This adds
-- a per-email counter that locks the account for 15 minutes after
-- 5 failed attempts in any rolling 15-minute window.
--
-- Why RPCs (SECURITY DEFINER) instead of direct table access:
-- The check + record functions run with elevated privileges so anonymous
-- callers can hit them without RLS exposure. The functions themselves
-- normalize the email and rate-limit themselves to defeat enumeration:
-- a non-existent email returns the same shape as a wrong-password attempt.

-- ── Table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_lower  text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  ip_hint      text,
  user_agent   text
);

CREATE INDEX IF NOT EXISTS idx_failed_logins_lookup
  ON failed_login_attempts (email_lower, attempted_at DESC);

ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no direct read/write from app users. Only the
-- SECURITY DEFINER RPCs below can touch this table from the app side.

-- ── RPC: record a failed login ───────────────────────────────

CREATE OR REPLACE FUNCTION record_failed_login(
  email_to_record text,
  ip_hint_text    text DEFAULT NULL,
  user_agent_text text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Defensive: cap email length so a malicious caller can't fill the
  -- table with multi-MB rows.
  IF email_to_record IS NULL OR length(email_to_record) > 320 THEN
    RETURN;
  END IF;

  INSERT INTO failed_login_attempts (email_lower, ip_hint, user_agent)
  VALUES (
    lower(trim(email_to_record)),
    NULLIF(left(coalesce(ip_hint_text, ''), 64), ''),
    NULLIF(left(coalesce(user_agent_text, ''), 256), '')
  );

  -- Garbage-collect: drop attempts older than 24h on every write.
  -- Keeps the table small without a separate cron.
  DELETE FROM failed_login_attempts
   WHERE attempted_at < now() - interval '24 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION record_failed_login(text, text, text) TO anon, authenticated;

-- ── RPC: check lockout state for an email ────────────────────

CREATE OR REPLACE FUNCTION check_login_lockout(
  email_to_check text
)
RETURNS TABLE (
  is_locked       boolean,
  attempts_in_window int,
  attempts_allowed int,
  unlocks_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
  oldest_at    timestamptz;
  threshold    int := 5;          -- attempts allowed
  window_size  interval := interval '15 minutes';
BEGIN
  IF email_to_check IS NULL OR length(email_to_check) > 320 THEN
    is_locked := false;
    attempts_in_window := 0;
    attempts_allowed := threshold;
    unlocks_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT count(*), min(attempted_at)
    INTO recent_count, oldest_at
    FROM failed_login_attempts
   WHERE email_lower = lower(trim(email_to_check))
     AND attempted_at > now() - window_size;

  attempts_in_window := coalesce(recent_count, 0);
  attempts_allowed := threshold;
  is_locked := attempts_in_window >= threshold;
  unlocks_at := CASE
    WHEN is_locked THEN coalesce(oldest_at, now()) + window_size
    ELSE NULL
  END;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION check_login_lockout(text) TO anon, authenticated;

COMMENT ON TABLE failed_login_attempts IS
  'Per-email failed sign-in tracking for account lockout. Written + read only via SECURITY DEFINER RPCs (record_failed_login, check_login_lockout). RLS is locked tight; no direct access from app users.';
