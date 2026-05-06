-- ═══════════════════════════════════════════════════════════════
-- Migration: typing_indicators
-- Version: 20260501100001
--
-- Purpose: backs the "Walker is typing…" presence pill on entity
-- detail pages. We use a thin database table (instead of pure
-- realtime broadcast) so the indicator survives reconnects and is
-- visible to everyone watching the entity, not just users currently
-- subscribed to the broadcast channel.
--
-- Rows are ephemeral by nature: a typing event is a heartbeat that
-- expires after ~10 seconds of silence. We GC rows older than 60s
-- via the pg_cron snippet at the bottom (admin-apply-only).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS typing_indicators (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name    text NOT NULL,
  -- Last heartbeat. The UI considers a row "active" when this is
  -- within the last 10 seconds of NOW().
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- One active row per (entity, user). Updates bump last_seen_at.
CREATE UNIQUE INDEX IF NOT EXISTS uq_typing_indicators_entity_user
  ON typing_indicators (entity_type, entity_id, user_id);

CREATE INDEX IF NOT EXISTS idx_typing_indicators_recent
  ON typing_indicators (entity_type, entity_id, last_seen_at DESC);

ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'typing_indicators_project_access') THEN
    CREATE POLICY typing_indicators_project_access ON typing_indicators
      FOR ALL
      USING (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()))
      WITH CHECK (project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ── GC schedule (admin-apply via dashboard or cron migration) ─────
--   SELECT cron.schedule(
--     'gc-typing-indicators',
--     '* * * * *',  -- every minute
--     $$ DELETE FROM typing_indicators WHERE last_seen_at < now() - interval '60 seconds' $$
--   );
