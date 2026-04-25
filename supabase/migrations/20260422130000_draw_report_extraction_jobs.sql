-- =============================================================================
-- draw_report_extraction_jobs — async job queue for draw-report extraction
-- =============================================================================
-- Same pattern as schedule_import_jobs. Supabase's gateway caps synchronous
-- edge function responses at ~25s, but Gemini extraction on a multi-page
-- HUD 221(d)(4) / G703 continuation sheet with 50+ line items regularly
-- takes 30-90s. We decouple the response from the work:
--   1. Edge function validates auth, creates a row (status='queued'),
--      kicks off Gemini via EdgeRuntime.waitUntil, and returns 202 with the
--      job_id in under 2s.
--   2. Client polls this row every 2s until status ∈ {done, error}.
--   3. Background task writes the Gemini result (or error) back to the row.
-- =============================================================================

CREATE TABLE IF NOT EXISTS draw_report_extraction_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id    uuid REFERENCES documents(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_draw_report_jobs_user_recent
  ON draw_report_extraction_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_draw_report_jobs_project
  ON draw_report_extraction_jobs (project_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION fn_touch_draw_report_extraction_jobs()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_draw_report_extraction_jobs ON draw_report_extraction_jobs;
CREATE TRIGGER trg_touch_draw_report_extraction_jobs
  BEFORE UPDATE ON draw_report_extraction_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_touch_draw_report_extraction_jobs();

-- ── RLS ──────────────────────────────────────────────────────
-- The row's owner can read. Inserts happen only via the edge function
-- (service role), which validates project membership before writing.

ALTER TABLE draw_report_extraction_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS draw_report_jobs_select_own ON draw_report_extraction_jobs;
CREATE POLICY draw_report_jobs_select_own ON draw_report_extraction_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── Realtime (optional — we use polling, but subscribers also work) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'draw_report_extraction_jobs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE draw_report_extraction_jobs';
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;
