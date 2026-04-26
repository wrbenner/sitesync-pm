-- MFA hard-force tier: 7-day grace then mandatory.
--
-- Phase 1 Track A closeout. Companion to 20260426000003_account_lockout.sql
-- and the existing MfaEnrollment + MfaRequiredBanner UI.
--
-- Behavior:
--   * On profile creation (new signup), mfa_grace_period_until is set to
--     NOW() + 7 days. The banner is dismissible during this window.
--   * After expiry, the banner becomes non-dismissible AND ProtectedRoute
--     redirects privileged-role users to /profile until they enroll.
--   * Once the user enrolls a verified TOTP factor, the column is set
--     to NULL (no longer relevant — they're protected).
--
-- The column lives on profiles, not on auth.users, because we want to
-- keep our app-domain state out of the auth schema (Supabase managed).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS mfa_grace_period_until timestamptz;

-- Existing users: give them the same 7-day grace from migration time.
UPDATE profiles
   SET mfa_grace_period_until = now() + interval '7 days'
 WHERE mfa_grace_period_until IS NULL;

-- Trigger: on every new profile insert, default the grace to 7 days
-- from creation. Application code can also set it explicitly; trigger
-- only fills NULLs.
CREATE OR REPLACE FUNCTION profiles_set_mfa_grace()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.mfa_grace_period_until IS NULL THEN
    NEW.mfa_grace_period_until := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_mfa_grace_trigger ON profiles;
CREATE TRIGGER profiles_set_mfa_grace_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_set_mfa_grace();

COMMENT ON COLUMN profiles.mfa_grace_period_until IS
  'Cut-off after which MFA enrollment becomes mandatory for privileged roles. NULL means MFA already enrolled, or the user is in a non-privileged role and the grace concept does not apply.';
