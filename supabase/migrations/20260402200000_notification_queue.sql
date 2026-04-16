-- idempotent version of notification_queue migration
CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id),
  recipient_email text not null,
  template_name text,
  template_data jsonb not null default '{}',
  entity_type text,
  entity_id uuid,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_queue_project ON notification_queue(project_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_recipient ON notification_queue(recipient_user_id);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY 'nq_select_own' ON notification_queue
    FOR SELECT USING (recipient_user_id = (select auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY 'nq_insert_members' ON notification_queue
    FOR INSERT WITH CHECK (project_id IN (
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = (select auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  rfi_assigned boolean not null default true,
  rfi_overdue boolean not null default true,
  submittal_status_change boolean not null default true,
  change_order_pending boolean not null default true,
  daily_log_reminder boolean not null default true,
  punch_item_assigned boolean not null default true,
  meeting_scheduled boolean not null default true,
  digest_enabled boolean not null default true,
  digest_time time not null default '19:00:00',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY 'np_own' ON notification_preferences
    FOR ALL USING (user_id = (select auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON notification_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_prefs
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
