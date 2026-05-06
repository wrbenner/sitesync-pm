-- Scheduled Insights — observability log + retention.
--
-- Each worker invocation records one row per (project, detector, run)
-- so we can answer:
--   * "How many insights did the aging detector compute today?"
--   * "What % of computed insights got promoted to drafts?"
--   * "Where is the worker spending its time?"
--
-- Reference: docs/audits/SCHEDULED_INSIGHTS_SPEC_2026-05-04.md § Phase 6
--
-- 30-day retention via daily prune cron. Pre-pilot, the log can grow
-- unbounded for diagnostics; post-pilot we lock it down.

BEGIN;

CREATE TABLE IF NOT EXISTS public.scheduled_insights_log (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  detector_kind   text          NOT NULL
                                CHECK (detector_kind IN ('aging','cascade','variance','staffing','weather')),
  computed_count  integer       NOT NULL DEFAULT 0,  -- insights produced by detector
  promoted_count  integer       NOT NULL DEFAULT 0,  -- of those, how many became drafts
  withdrawn_count integer       NOT NULL DEFAULT 0,  -- stale drafts withdrawn this run
  duration_ms     integer,                            -- worker time on this (project, detector)
  job_msg_id      bigint,                             -- pgmq message id for cross-reference
  attempt         integer       NOT NULL DEFAULT 1,
  outcome         text          NOT NULL DEFAULT 'success'
                                CHECK (outcome IN ('success','partial','failed','abandoned')),
  error_message   text,
  computed_at     timestamptz   NOT NULL DEFAULT NOW()
);

-- Throughput analysis index (the dashboard queries from spec § Phase 6).
CREATE INDEX IF NOT EXISTS idx_scheduled_insights_log_recent
  ON public.scheduled_insights_log (computed_at DESC, detector_kind);

-- Per-project drill-down.
CREATE INDEX IF NOT EXISTS idx_scheduled_insights_log_project
  ON public.scheduled_insights_log (project_id, computed_at DESC);

-- Failed/abandoned runs surface fast.
CREATE INDEX IF NOT EXISTS idx_scheduled_insights_log_failed
  ON public.scheduled_insights_log (outcome, computed_at DESC)
  WHERE outcome IN ('failed','abandoned');

COMMENT ON TABLE public.scheduled_insights_log IS
  'Per-worker-invocation observability log. Read by Lap 2 dashboard queries; pruned on a 30-day rolling window.';

-- ── RLS ────────────────────────────────────────────────────────────
-- Service role inserts; org admins read for their projects only.
ALTER TABLE public.scheduled_insights_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_insights_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduled_insights_log_select_admin ON public.scheduled_insights_log;
CREATE POLICY scheduled_insights_log_select_admin ON public.scheduled_insights_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
       JOIN public.organization_members om ON om.organization_id = p.organization_id
       WHERE p.id = scheduled_insights_log.project_id
         AND om.user_id = auth.uid()
         AND om.role IN ('owner','admin')
    )
  );

-- ── Retention prune (daily) ────────────────────────────────────────
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping insights-log-prune schedule.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'insights-log-prune') THEN
    PERFORM cron.unschedule('insights-log-prune');
  END IF;

  -- 04:13 UTC daily — off-peak for both US and EU pilots, and out of
  -- the 18:00-UTC gate-workflow window.
  PERFORM cron.schedule(
    'insights-log-prune',
    '13 4 * * *',
    $cron$
      DELETE FROM public.scheduled_insights_log
       WHERE computed_at < NOW() - INTERVAL '30 days';
    $cron$
  );

  RAISE NOTICE 'insights-log-prune scheduled daily at 04:13 UTC.';
END $do$;

COMMIT;
