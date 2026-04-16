-- =============================================================================
-- Create profiles table for user profile data.
-- This table is referenced by authStore, supabase.ts, and multiple components.
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name                text,
  first_name               text,
  last_name                text,
  phone                    text,
  company                  text,
  trade                    text,
  job_title                text,
  avatar_url               text,
  notification_preferences jsonb DEFAULT '{}',
  organization_id          uuid REFERENCES organizations(id) ON DELETE SET NULL,
  role                     text DEFAULT 'member',
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles FOR SELECT
  USING (user_id = auth.uid());

-- Users in the same organization can see each other's profiles
DROP POLICY IF EXISTS profiles_select_org ON profiles;
CREATE POLICY profiles_select_org ON profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own profile
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own profile
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(organization_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- Add INSERT policy on organizations so new users can create their first org
-- =============================================================================
DROP POLICY IF EXISTS organizations_insert_authenticated ON organizations;
CREATE POLICY organizations_insert_authenticated ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow the creating user to insert themselves as owner of the new org
DROP POLICY IF EXISTS org_members_insert_self ON organization_members;
CREATE POLICY org_members_insert_self ON organization_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
