-- Local-dev bootstrap. Idempotent. No-op on prod where these are already
-- provisioned via the Database → Extensions dashboard.
--
-- Two unrelated unblocks consolidated into one early migration so a fresh
-- `supabase start` on a developer machine runs all downstream migrations
-- without needing manual admin steps.
--
-- 1. pg_cron + pg_net
--    Downstream cron migrations guard with `WHERE extname IN ('pg_cron','pg_net')`.
--    The supabase/postgres image preinstalls pg_net but not pg_cron, so on a
--    fresh local DB the guard sees pg_net and waves the migration through to
--    `cron.job` references that haven't been created yet.
--
-- 2. rfi_notification_recipient_role
--    20260507200721_rfi_information_density.sql references this enum on
--    rfi_distributions.recipient_role, but the canonical definition lives in
--    20260508040000_rfi_settings_unblock_c3_e1_e2.sql which is a day later in
--    calendar order. Pre-create it here; the later migration's CREATE TYPE is
--    duplicate_object-safe.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  CREATE TYPE public.rfi_notification_recipient_role AS ENUM (
    'creator',
    'manager',
    'assignee',
    'distribution_group',
    'watcher'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
