CREATE TABLE notification_queue (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  recipient_user_id uuid        NOT NULL REFERENCES auth.users(id),
  recipient_email   text        NOT NULL,
  template_name     text        NOT NULL,
  template_data     jsonb       NOT NULL DEFAULT '{}',
  entity_type       text,
  entity_id         uuid,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts          integer     NOT NULL DEFAULT 0,
  max_attempts      integer     NOT NULL DEFAULT 3,
  sent_at           timestamptz,
  error             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_notification_queue_status
  ON notification_queue(status, created_at)
  WHERE status = 'pending';

CREATE INDEX idx_notification_queue_recipient
  ON notification_queue(recipient_user_id, created_at DESC);

CREATE INDEX idx_notification_queue_project
  ON notification_queue(project_id);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view own notifications"
  ON notification_queue
  FOR SELECT
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Authenticated users can insert"
  ON notification_queue
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
    )
  );

CREATE TRIGGER set_notification_queue_updated_at
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  rfi_assigned          boolean DEFAULT true,
  rfi_overdue           boolean DEFAULT true,
  submittal_status      boolean DEFAULT true,
  change_order_pending  boolean DEFAULT true,
  daily_log_reminder    boolean DEFAULT true,
  punch_item_assigned   boolean DEFAULT true,
  meeting_scheduled     boolean DEFAULT true,
  digest_enabled        boolean DEFAULT true,
  digest_time           time    DEFAULT '19:00:00',
  timezone              text    DEFAULT 'America/Denver',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON notification_preferences
  FOR ALL
  USING (user_id = auth.uid());

CREATE TRIGGER set_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
