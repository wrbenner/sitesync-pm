-- Auto-create a `profiles` row when a new user signs up.
--
-- Why: the app supports three sign-in paths (magic-link, OAuth, password).
-- Only the password signup flow inserts a profile row manually
-- (see useAuth.signUp). Magic-link and OAuth users never get a profile,
-- which makes /settings 500 the first time they visit it (the page
-- queries profiles by user_id and finds nothing). This trigger fires
-- once per new auth.users row regardless of how the user signed up.
--
-- The trigger pulls first_name / last_name / full_name from
-- raw_user_meta_data, which Supabase populates from the OAuth provider's
-- profile or from the `options.data` field on signInWithOtp / signUp.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  first_name text := meta->>'first_name';
  last_name  text := meta->>'last_name';
  full_name  text := meta->>'full_name';
BEGIN
  -- Compose a sensible full_name when we only got components.
  IF full_name IS NULL OR full_name = '' THEN
    full_name := NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '');
  END IF;
  -- Final fallback: use the email's local part so the row isn't blank.
  IF full_name IS NULL OR full_name = '' THEN
    full_name := SPLIT_PART(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.profiles (user_id, full_name, first_name, last_name)
  VALUES (NEW.id, full_name, first_name, last_name)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: any existing user without a profile gets one now.
-- (Idempotent thanks to ON CONFLICT in the trigger; this catches users
-- who signed up before the trigger existed.)
INSERT INTO public.profiles (user_id, full_name, first_name, last_name)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(TRIM(CONCAT_WS(' ',
      u.raw_user_meta_data->>'first_name',
      u.raw_user_meta_data->>'last_name'
    )), ''),
    SPLIT_PART(u.email, '@', 1)
  ) AS full_name,
  u.raw_user_meta_data->>'first_name',
  u.raw_user_meta_data->>'last_name'
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;
