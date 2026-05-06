-- notification_queue_worker — pg_cron schedule (1-minute cadence)
--
-- ADMIN PRE-APPLY: pg_cron and pg_net must be enabled at the org level
-- before this migration runs. Run as a Supabase admin:
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- The migration below is idempotent — it can be applied (or re-applied)
-- safely once the extensions are present. Until they are, the migration
-- silently no-ops via the IF EXISTS guard so deploy pipelines don't break.

do $do$
begin
  if not exists (
    select 1 from pg_extension where extname in ('pg_cron', 'pg_net')
  ) then
    raise notice 'pg_cron and/or pg_net not installed — skipping schedule. Enable extensions and re-run this migration.';
    return;
  end if;

  -- Drop any prior schedule with the same name so re-applies don't double-tick.
  if exists (select 1 from cron.job where jobname = 'notification-queue-worker') then
    perform cron.unschedule('notification-queue-worker');
  end if;

  perform cron.schedule(
    'notification-queue-worker',
    '*/1 * * * *',
    $job$
      select net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/notification-queue-worker',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('source', 'cron')
      );
    $job$
  );

  raise notice 'notification-queue-worker scheduled every minute.';
end
$do$;

-- Required runtime configuration (set as Supabase secrets):
--   app.supabase_url        — e.g. https://hypxrmcppjfbtlwuoafc.supabase.co
--   app.service_role_key    — the project service role key
--
-- These can be configured via:
--   alter database postgres set "app.supabase_url" = '<value>';
--   alter database postgres set "app.service_role_key" = '<value>';

do $guard$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cmt$comment on extension pg_cron is 'Scheduled jobs — used for SLA escalation, daily log auto-draft, COI watcher, and notification queue worker.'$cmt$;
  end if;
end
$guard$;
