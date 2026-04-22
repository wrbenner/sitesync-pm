-- =============================================================================
-- schedule_import_jobs — async job queue for schedule PDF extraction
-- =============================================================================
-- The extract-schedule-pdf edge function calls Gemini 2.5 Flash, which
-- regularly takes 30-90s on dense Gantt PDFs. Supabase's gateway caps
-- synchronous responses at ~25s, so we were getting 504s before Gemini
-- finished. This table backs an async pattern:
--   1. Edge function validates auth, inserts a row (status='queued'),
--      kicks off Gemini via EdgeRuntime.waitUntil, and returns 202 with
--      the job_id.
--   2. Client subscribes to this row via realtime and awaits the terminal
--      status (done | error).
--   3. Background task in the edge function writes the Gemini result (or
--      error) back to this row.
-- =============================================================================

CREATE TABLE IF NOT EXISTS schedule_import_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued', 'running', 'done', 'error')),
  filename       text,
  result_json    jsonb,
  error_message  text,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_import_jobs_user_recent
  ON schedule_import_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_import_jobs_project
  ON schedule_import_jobs (project_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION fn_touch_schedule_import_jobs()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_schedule_import_jobs ON schedule_import_jobs;
CREATE TRIGGER trg_touch_schedule_import_jobs
  BEFORE UPDATE ON schedule_import_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_touch_schedule_import_jobs();

-- ── RLS ──────────────────────────────────────────────────────
-- The row's owner can read/update. Inserts happen only via the
-- edge function (service role), which already validates project
-- membership before writing.

ALTER TABLE schedule_import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_import_jobs_select_own ON schedule_import_jobs;
CREATE POLICY schedule_import_jobs_select_own ON schedule_import_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS schedule_import_jobs_update_own ON schedule_import_jobs;
CREATE POLICY schedule_import_jobs_update_own ON schedule_import_jobs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No INSERT/DELETE policy for authenticated → only service role can do that.

-- ── Realtime ────────────────────────────────────────────────
-- Publish to supabase_realtime so clients can subscribe to row changes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'schedule_import_jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE schedule_import_jobs';
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- supabase_realtime publication doesn't exist in local/test envs; ignore.
  NULL;
END $$;
