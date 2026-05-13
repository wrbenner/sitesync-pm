-- BRT sub-2 §4.5 — raise failed-login lockout threshold from 5 → 10
-- within the same 15-minute window.
--
-- Rationale: 5 attempts is too aggressive for legitimate users juggling
-- password managers + auto-fill mishaps. Spec says 10 fails / 15 min.
-- The check_login_lockout RPC is the only consumer; replace in-place.

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
  threshold    int := 10;         -- BRT sub-2 §4.5: bumped from 5
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
  unlocks_at := CASE WHEN is_locked THEN oldest_at + window_size ELSE NULL END;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_login_lockout(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION check_login_lockout(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION check_login_lockout(text) IS
  'BRT sub-2 §4.5: returns lockout state for an email. Threshold 10 / 15 min window.';
