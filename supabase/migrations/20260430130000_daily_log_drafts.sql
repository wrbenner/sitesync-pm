-- ═══════════════════════════════════════════════════════════════
-- Migration: daily_log_drafts uniqueness + projects.timezone
-- Version: 20260430130000
--
-- Purpose: enables Tab A (Daily Log Auto-Draft).
--
-- Two pieces:
--   1. UNIQUE partial index on drafted_actions guaranteeing one pending
--      draft per (project_id, draft_date) for action_type='daily_log.draft'.
--      This prevents two supers on the same job from racing each other
--      and producing duplicate drafts. Whoever generates first wins;
--      others get a "Draft already exists — view it?" surface.
--
--   2. Index on (project_id, payload->>'date') for the existence check
--      the edge function uses on every invocation (idempotent regen).
--
--   3. projects.timezone IANA tz string ('America/New_York', 'UTC') so
--      the cron's "5pm in project local time" makes sense across DST.
--      Default to 'UTC' so existing rows aren't disturbed.
-- ═══════════════════════════════════════════════════════════════

-- Project timezone — used by the 5pm cron + display formatting.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_timezone_format'
  ) THEN
    -- IANA names are alpha + slash + alpha (Etc/UTC, America/New_York).
    -- The 'UTC' shorthand is also accepted.
    ALTER TABLE projects ADD CONSTRAINT projects_timezone_format
      CHECK (timezone = 'UTC' OR timezone ~ '^[A-Za-z_]+/[A-Za-z_/+\-0-9]+$');
  END IF;
END $$;

-- Index that backs the edge function's existence check on every run:
--   SELECT id FROM drafted_actions
--   WHERE project_id = ? AND action_type = 'daily_log.draft'
--     AND payload->>'date' = ? AND status IN ('pending','approved')
CREATE INDEX IF NOT EXISTS idx_drafted_actions_dailylog_date
  ON drafted_actions ((payload ->> 'date'))
  WHERE action_type = 'daily_log.draft';

-- Uniqueness: at most one pending or approved daily_log.draft per
-- (project_id, date). Using a partial unique index keeps this scoped to
-- the kind of draft we care about; rejected/failed drafts are excluded
-- so a re-generation after rejection works without conflict.
CREATE UNIQUE INDEX IF NOT EXISTS uq_drafted_actions_dailylog_per_day
  ON drafted_actions (project_id, (payload ->> 'date'))
  WHERE action_type = 'daily_log.draft'
    AND status IN ('pending', 'approved');
