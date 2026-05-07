-- Scheduled Insights — Tier 1 (pg_cron heartbeat) + Tier 2 (pgmq queue).
--
-- ADR-003 (docs/audits/ADR_003_HYBRID_CRON_2026-05-04.md) chose:
--   pg_cron heartbeat → pgmq queue → edge function workers
--
-- Why pgmq, not the existing http_post-direct cron pattern?
--   * Backlog visibility: SELECT * FROM pgmq.q_insights_jobs;
--   * Re-delivery on worker timeout (vt) — no manual retry plumbing.
--   * Survives Supabase function restarts; the queue is in Postgres.
--   * Producer/consumer contract is portable: swap to SQS later without
--     touching the heartbeat or the worker contracts.
--
-- ADMIN PRE-APPLY: pg_cron, pg_net, AND pgmq must be enabled at the
-- org level. Run as a Supabase admin BEFORE this migration:
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--   create extension if not exists pgmq;
--
-- The migration below is idempotent — when extensions are absent it
-- silently no-ops with a NOTICE so deploy pipelines don't break.

BEGIN;

DO $do$
DECLARE
  v_have_pgmq    boolean := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq');
  v_have_pg_cron boolean := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');
  v_have_pg_net  boolean := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net');
BEGIN
  IF NOT v_have_pgmq THEN
    RAISE NOTICE 'pgmq not installed — skipping queue creation. Enable with: create extension pgmq;';
  END IF;
  IF NOT v_have_pg_cron THEN
    RAISE NOTICE 'pg_cron not installed — skipping heartbeat schedule.';
  END IF;
  IF NOT v_have_pg_net THEN
    RAISE NOTICE 'pg_net not installed — skipping worker invoke.';
  END IF;
END $do$;

-- ── Tier 2: the queue ────────────────────────────────────────────────
-- pgmq.create() is itself idempotent on subsequent calls.

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq') THEN
    PERFORM pgmq.create('insights_jobs');
    RAISE NOTICE 'pgmq queue insights_jobs ready.';
  END IF;
END $do$;

-- ── Tier 1: the heartbeat function ───────────────────────────────────
-- Enqueues one job per (active pilot project × detector kind) per tick.
-- One job = one queue entry; the worker fans out across them.
--
-- Why per-(project × detector) not per-project: a failing cascade
-- detector for project X must not block aging for the same project.
-- Failure isolation lives at the queue grain.

CREATE OR REPLACE FUNCTION public.enqueue_insights_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count       integer := 0;
  v_project_id  uuid;
  v_detector    text;
  v_have_pgmq   boolean := EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq');
BEGIN
  IF NOT v_have_pgmq THEN
    -- Heartbeat without pgmq is a no-op: returns 0 jobs. Cron continues
    -- ticking; once pgmq is enabled the very next tick fans out.
    RETURN 0;
  END IF;

  FOR v_project_id IN
    SELECT p.id
      FROM public.projects p
      JOIN public.organizations o ON o.id = p.organization_id
     WHERE o.is_soft_pilot = TRUE
       -- projects.status: most rows use 'active' but be liberal here
       -- so a typo doesn't silently halt the pilot.
       AND COALESCE(p.status, 'active') NOT IN ('archived','deleted','cancelled')
  LOOP
    FOREACH v_detector IN ARRAY ARRAY['aging','cascade','variance','staffing','weather']
    LOOP
      PERFORM pgmq.send(
        'insights_jobs',
        jsonb_build_object(
          'project_id', v_project_id,
          'detector_kind', v_detector,
          'scheduled_for', NOW(),
          'attempt', 1
        )
      );
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_insights_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_insights_jobs() TO service_role;

COMMENT ON FUNCTION public.enqueue_insights_jobs() IS
  'Lap 2 scheduled-insights heartbeat. Enqueues 1 pgmq job per (pilot project × detector) per tick. Silently no-ops if pgmq is absent.';

-- ── Tier 1: the cron schedule ────────────────────────────────────────

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping insights-heartbeat schedule.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'insights-heartbeat') THEN
    PERFORM cron.unschedule('insights-heartbeat');
  END IF;

  -- Every 15 minutes, aligned to :00, :15, :30, :45.
  PERFORM cron.schedule(
    'insights-heartbeat',
    '*/15 * * * *',
    $cron$SELECT public.enqueue_insights_jobs();$cron$
  );

  RAISE NOTICE 'insights-heartbeat scheduled every 15 minutes.';
END $do$;

-- ── Worker invoker (a separate cron entry that hits the edge fn) ─────
-- The worker pulls from the queue. The cron heartbeat above produces;
-- this cron tick consumes. Decoupling the two means a slow worker
-- doesn't slow heartbeats — it just lets the backlog grow until the
-- worker catches up (with backlog-watch alerting per ADR-003).
--
-- The worker invoke runs every 5 minutes — more often than the
-- heartbeat — so jobs are picked up shortly after they're enqueued.

DO $do$
BEGIN
  -- Schema-version-tolerant: BOTH extensions required (the earlier
  -- `extname IN (...)` pattern would pass when only one was installed
  -- and then crash on `cron.job` reference).
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_cron and/or pg_net missing — skipping insights-worker-invoke schedule.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'insights-worker-invoke') THEN
    PERFORM cron.unschedule('insights-worker-invoke');
  END IF;

  PERFORM cron.schedule(
    'insights-worker-invoke',
    '*/5 * * * *',
    $cron$
      SELECT net.http_post(
        url := current_setting('app.supabase_url', true)
               || '/functions/v1/scheduled-insights-worker',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('source','cron')
      );
    $cron$
  );

  RAISE NOTICE 'insights-worker-invoke scheduled every 5 minutes.';
END $do$;

-- Required runtime configuration (set by ops as Supabase secrets / GUCs):
--   app.supabase_url        — e.g. https://hypxrmcppjfbtlwuoafc.supabase.co
--   app.service_role_key    — the project service role key
-- Mirrors the notification-queue-worker pattern so ops set this once.

COMMIT;
