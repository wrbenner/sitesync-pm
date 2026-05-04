-- portfolio-summary-refresh — pg_cron schedule (5-min cadence)
--
-- Refreshes the materialized view that powers the portfolio dashboard
-- (60+ projects rolled up). Materialized views are query-fast but write-
-- slow, so we refresh on a fixed cadence rather than on every entity
-- mutation. 5 min is acceptable lag for executive dashboards (the only
-- consumers); finer-grained data is available on the per-project pages.
--
-- ADMIN PRE-APPLY: pg_cron and pg_net must be enabled (see
-- 20260430160000_notification_queue_worker_cron.sql for setup notes).
-- This migration silently no-ops if the extensions aren't present.

do $do$
begin
  if not exists (
    select 1 from pg_extension where extname in ('pg_cron', 'pg_net')
  ) then
    raise notice 'pg_cron and/or pg_net not installed — skipping portfolio-summary-refresh schedule.';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'portfolio-summary-refresh') then
    perform cron.unschedule('portfolio-summary-refresh');
  end if;

  perform cron.schedule(
    'portfolio-summary-refresh',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/portfolio-summary-refresh',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('source', 'cron')
      );
    $job$
  );

  raise notice 'portfolio-summary-refresh scheduled every 5 minutes.';
end
$do$;
