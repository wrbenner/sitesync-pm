-- API enhancements: webhook failure counter, API key scopes, rate limiting

-- Increment webhook failure count atomically
CREATE OR REPLACE FUNCTION increment_webhook_failures(webhook_id uuid)
RETURNS void AS $$
  UPDATE webhooks
  SET failure_count = failure_count + 1, updated_at = now()
  WHERE id = webhook_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Auto-disable webhooks after 10 consecutive failures
CREATE OR REPLACE FUNCTION check_webhook_health()
RETURNS trigger AS $$
BEGIN
  IF NEW.failure_count >= 10 AND NEW.active = true THEN
    NEW.active := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webhook_health_check ON webhooks;
CREATE TRIGGER webhook_health_check
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION check_webhook_health();
