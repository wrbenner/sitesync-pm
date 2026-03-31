-- Notification Preferences and Enhancement

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  -- Per-type preferences: 'all', 'in_app', 'email', 'off'
  mention_channel text DEFAULT 'all',
  assignment_channel text DEFAULT 'all',
  status_change_channel text DEFAULT 'in_app',
  approval_needed_channel text DEFAULT 'all',
  overdue_channel text DEFAULT 'all',
  ai_insight_channel text DEFAULT 'in_app',
  comment_channel text DEFAULT 'in_app',
  system_channel text DEFAULT 'in_app',
  -- Global settings
  quiet_hours_start text DEFAULT '19:00',
  quiet_hours_end text DEFAULT '06:00',
  daily_digest boolean DEFAULT false,
  digest_time text DEFAULT '17:00',
  muted_projects uuid[] DEFAULT '{}',
  muted_threads jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY np_select ON notification_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY np_insert ON notification_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY np_update ON notification_preferences FOR UPDATE USING (user_id = auth.uid());

CREATE TRIGGER set_notification_prefs_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add metadata to notifications for grouping
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_key text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_notifications_group ON notifications(group_key);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- Function to check notification preference before sending
CREATE OR REPLACE FUNCTION should_send_notification(
  p_user_id uuid,
  p_notification_type text,
  p_channel text DEFAULT 'in_app'
) RETURNS boolean AS $$
DECLARE
  pref text;
  quiet_start text;
  quiet_end text;
  current_time_str text;
BEGIN
  -- Get user preference for this type
  EXECUTE format(
    'SELECT %I, quiet_hours_start, quiet_hours_end FROM notification_preferences WHERE user_id = $1',
    p_notification_type || '_channel'
  ) INTO pref, quiet_start, quiet_end USING p_user_id;

  -- Default to 'all' if no preference set
  IF pref IS NULL THEN pref := 'all'; END IF;

  -- Check if this channel is enabled
  IF pref = 'off' THEN RETURN false; END IF;
  IF pref != 'all' AND pref != p_channel THEN RETURN false; END IF;

  -- Check quiet hours for email/push
  IF p_channel IN ('email', 'push') AND quiet_start IS NOT NULL THEN
    current_time_str := to_char(now() AT TIME ZONE 'UTC', 'HH24:MI');
    IF quiet_start > quiet_end THEN
      IF current_time_str >= quiet_start OR current_time_str <= quiet_end THEN
        RETURN false;
      END IF;
    ELSE
      IF current_time_str >= quiet_start AND current_time_str <= quiet_end THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
