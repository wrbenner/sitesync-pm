-- Fix-up for a production write-path bug surfaced by the BRT scale-test:
--
-- daily_logs_iris_ingest_trigger references NEW.narrative, but daily_logs has
-- no `narrative` column (closest analogue is `summary`). Any INSERT or UPDATE
-- on daily_logs trips 42703 inside the trigger.
--
-- Companion to 20261020000000_fix_iris_ingest_trigger_column_name.sql which
-- corrected projects.org_id → projects.organization_id across the four iris
-- ingest trigger functions. The 20261020 migration left the daily_logs
-- trigger's NEW.narrative reference intact; this migration fixes it.
--
-- This bug is pre-existing — every real production write on daily_logs trips
-- it. It was masked only because no recent user-driven writes reached it
-- after the schema drift. Surfaced by the scale-test harness in ops/ on
-- 2026-05-14.
--
-- Bug 3 retraction note: an earlier draft of this migration also re-declared
-- fn_mark_search_dirty with SECURITY DEFINER to address a perceived RLS
-- rejection on search_index_dirty_flags writes. Verification against
-- pg_proc.prosecdef showed the function ALREADY has SECURITY DEFINER in
-- production (prosecdef=true). The SECDEF re-declaration was dropped from
-- this migration before merge. See docs/audits/IRIS_TRIGGER_FIX_RECEIPT_2026-05-14.md.

CREATE OR REPLACE FUNCTION public.daily_logs_iris_ingest_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_hash TEXT;
BEGIN
  v_version_hash := md5(
    coalesce(NEW.weather, '')
    || '|' || coalesce(NEW.summary, '')
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
