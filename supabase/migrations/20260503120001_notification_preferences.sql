-- =============================================================================
-- Notification preferences (one row per user)
-- =============================================================================
-- Extends the existing notification system; does NOT alter the queue.
--
-- Compat note: an earlier migration (00024_notification_preferences.sql)
-- already created `notification_preferences` with a `(id uuid PK, user_id
-- UNIQUE)` shape and per-channel text columns. We keep that table and
-- additively add the columns the new DND / digest / suggestion-frequency
-- features need. Policies use distinct names from the legacy ones so they
-- coexist (legacy: np_*, new: notif_prefs_*).
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Additive columns for the new DND / digest / suggestion features.
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dnd_start time,
  ADD COLUMN IF NOT EXISTS dnd_end time,
  ADD COLUMN IF NOT EXISTS dnd_timezone text,
  ADD COLUMN IF NOT EXISTS digest_schedule jsonb,
  ADD COLUMN IF NOT EXISTS bypass_dnd_for_critical boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suggestion_frequency text NOT NULL DEFAULT 'occasional';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'notification_preferences_suggestion_frequency_chk'
       AND conrelid = 'public.notification_preferences'::regclass
  ) THEN
    ALTER TABLE notification_preferences
      ADD CONSTRAINT notification_preferences_suggestion_frequency_chk
      CHECK (suggestion_frequency IN ('off','occasional','always'));
  END IF;
END $$;

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_prefs_owner_read ON notification_preferences;
CREATE POLICY notif_prefs_owner_read ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS notif_prefs_owner_write ON notification_preferences;
CREATE POLICY notif_prefs_owner_write ON notification_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
