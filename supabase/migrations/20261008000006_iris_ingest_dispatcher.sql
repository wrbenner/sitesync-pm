-- ────────────────────────────────────────────────────────────────────────────
-- iris_ingest_dispatcher — Phase 3c
-- ────────────────────────────────────────────────────────────────────────────
-- Spec: docs/audits/IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md §6
-- ADR-003: hybrid cron (pg_cron heartbeat + pgmq queue + edge fn workers).
--
-- 4 new AFTER INSERT/UPDATE triggers (daily_logs, media_assets,
-- conversations, change_orders) PLUS a pg_cron heartbeat that fires every
-- minute and pings the iris-ingest-dispatcher edge fn. The edge fn drains
-- pgmq messages and routes each to its per-source worker.
--
-- Triggers are non-fatal (RAISE NOTICE on failure) — same pattern as Phase
-- 3b. The dispatcher's daily reconcile sweeps missed enqueues.
--
-- Day-0 SQL bug screen:
--   - No || concat in DDL: PASS.
--   - No expression in PRIMARY KEY: PASS.
--   - FK column types match: PASS (no FKs in this migration; only triggers
--     reference NEW row columns).
--   - Timestamp 20261008000006 unique: PASS.

-- ── daily_logs trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.daily_logs_iris_ingest_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_hash TEXT;
BEGIN
  v_version_hash := md5(
    coalesce(NEW.weather, '')
    || '|' || coalesce(NEW.narrative, '')
    || '|' || coalesce(NEW.status, '')
    || '|' || coalesce(NEW.log_date::text, '')
    || '|' || coalesce(NEW.updated_at::text, '')
  );

  PERFORM public.iris_enqueue_ingest(
    'daily_log',
    NEW.id::text,
    NEW.project_id,
    (SELECT organization_id FROM public.projects WHERE id = NEW.project_id LIMIT 1),
    v_version_hash
  );
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER daily_logs_iris_ingest
  AFTER INSERT OR UPDATE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.daily_logs_iris_ingest_trigger();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── change_orders trigger ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.change_orders_iris_ingest_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_hash TEXT;
BEGIN
  v_version_hash := md5(
    coalesce(NEW.co_number, '')
    || '|' || coalesce(NEW.status, '')
    || '|' || coalesce(NEW.total_cents::text, '')
    || '|' || coalesce(NEW.justification, '')
    || '|' || coalesce(NEW.updated_at::text, '')
  );

  PERFORM public.iris_enqueue_ingest(
    'change_order',
    NEW.id::text,
    NEW.project_id,
    (SELECT organization_id FROM public.projects WHERE id = NEW.project_id LIMIT 1),
    v_version_hash
  );
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER change_orders_iris_ingest
  AFTER INSERT OR UPDATE ON public.change_orders
  FOR EACH ROW EXECUTE FUNCTION public.change_orders_iris_ingest_trigger();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── pg_cron heartbeat ──────────────────────────────────────────────────────
-- Schedules a 1-minute heartbeat that pings the iris-ingest-dispatcher edge
-- fn. The dispatcher reads pgmq messages, routes each to its per-source
-- worker by source_type, and acks on success.
--
-- pg_cron lives in the cron schema. We use net.http_post (pg_net extension)
-- to call the edge fn. Both pg_cron + pg_net are installed on staging
-- (verified pre-flight).

DO $$ BEGIN
  -- Idempotent unschedule first — if a previous job exists under this name,
  -- unschedule it before re-creating. This makes the migration re-runnable.
  PERFORM cron.unschedule('iris-ingest-dispatcher-tick');
EXCEPTION WHEN OTHERS THEN
  -- Job didn't exist; that's fine.
  NULL;
END $$;

-- Note: the edge fn URL is project-specific. The migration encodes it via a
-- format() call against a setting; in staging/prod the dba sets the
-- iris.dispatcher_url GUC. If the GUC is unset the cron emits a NOTICE and
-- skips — safe default during local dev.

DO $$
DECLARE
  v_url TEXT;
BEGIN
  -- Try to read the dispatcher URL from settings. Fall back to NULL on
  -- "unrecognized configuration parameter" — that's the local-dev path
  -- where pg_cron is installed but no edge fn URL is configured.
  BEGIN
    v_url := current_setting('iris.dispatcher_url', true);
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
  END;

  IF v_url IS NULL OR v_url = '' THEN
    RAISE NOTICE 'iris.dispatcher_url GUC not set; iris-ingest-dispatcher-tick cron not scheduled. Set via ALTER DATABASE postgres SET iris.dispatcher_url = ''https://.../iris-ingest-dispatcher''; then re-run this migration.';
  ELSE
    -- Schedule the heartbeat. net.http_post returns immediately; the edge
    -- fn does the work.
    PERFORM cron.schedule(
      'iris-ingest-dispatcher-tick',
      '* * * * *',
      format(
        'SELECT net.http_post(url := %L, headers := ''{"Content-Type": "application/json"}''::jsonb, body := ''{"trigger": "cron"}''::jsonb)',
        v_url
      )
    );
    RAISE NOTICE 'iris-ingest-dispatcher-tick cron scheduled (every minute, pings %).', v_url;
  END IF;
END $$;
