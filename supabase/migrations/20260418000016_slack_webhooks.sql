-- Phase 7: Slack webhook integration + unified notification channels.
-- Adds Slack support to organization_settings and notification_preferences.

ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS slack_webhook_url text;
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS slack_channel_default text;
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS slack_enabled boolean DEFAULT false;

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS slack_enabled boolean DEFAULT false;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS slack_user_id text;

-- Delivery log for observability + retry: each outbound Slack attempt records
-- status, payload digest, and error (if any) for troubleshooting.
CREATE TABLE IF NOT EXISTS slack_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  project_id uuid,
  event_type text NOT NULL,
  webhook_url_masked text,
  status text NOT NULL CHECK (status IN ('success','failed','skipped')),
  status_code integer,
  error_message text,
  payload_digest text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_delivery_log_org ON slack_delivery_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slack_delivery_log_event ON slack_delivery_log(event_type, created_at DESC);

ALTER TABLE slack_delivery_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY slack_log_select ON slack_delivery_log FOR SELECT USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY slack_log_insert ON slack_delivery_log FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
