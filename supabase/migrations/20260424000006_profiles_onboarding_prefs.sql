-- ═══════════════════════════════════════════════════════════════
-- Migration: profiles — onboarded_at + dashboard_preferences
-- Version: 20260424000006
-- Purpose: Track onboarding completion per user so the onboarding
--          flow is not shown repeatedly, and persist the widget
--          selections made on the final onboarding step.
--
--          Consumed by src/pages/Onboarding.tsx (Finish step)
--          via useMarkOnboardingComplete in
--          src/hooks/mutations/onboarding.ts.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarded_at          timestamptz,
  ADD COLUMN IF NOT EXISTS dashboard_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_onboarded_at
  ON profiles (onboarded_at) WHERE onboarded_at IS NOT NULL;
