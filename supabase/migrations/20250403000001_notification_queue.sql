-- idempotent version: all objects created with IF NOT EXISTS or DO/EXCEPTION blocks
create table if not exists notification_queue (
  id                uuid        primary key default gen_random_uuid(),
  project_id        uuid        not null references projects(id) on delete cascade,
  recipient_user_id uuid        not null references auth.users(id),
  recipient_email   text        not null,
  trigger_type      text,
  template_name     text,
  template_data     jsonb       not null default '{}',
  entity_type       text,
  entity_id         uuid,
  status            text        not null default 'pending'
                                check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts          integer     not null default 0,
  max_attempts      integer     not null default 3,
  sent_at           timestamptz,
  error             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists notification_preferences (
  id                       uuid    primary key default gen_random_uuid(),
  user_id                  uuid    not null references auth.users(id) on delete cascade unique,
  rfi_assigned             boolean default true,
  rfi_overdue              boolean default true,
  submittal_status         boolean default true,
  change_order_pending     boolean default true,
  daily_log_reminder       boolean default true,
  punch_item_assigned      boolean default true,
  meeting_scheduled        boolean default true,
  digest_enabled           boolean default true,
  digest_time              time    default '19:00:00',
  timezone                 text    default 'America/Denver',
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

alter table notification_queue enable row level security;
alter table notification_preferences enable row level security;

do $$ begin
  create policy "notification_queue_select_own" on notification_queue
    for select using (recipient_user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notification_queue_insert_project_members" on notification_queue
    for insert with check (
      project_id in (select pm.project_id from project_members pm where pm.user_id = (select auth.uid()))
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notification_preferences_select_own" on notification_preferences
    for select using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notification_preferences_insert_own" on notification_preferences
    for insert with check (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notification_preferences_update_own" on notification_preferences
    for update using (user_id = (select auth.uid()));
exception when duplicate_object then null; end $$;

create index if not exists idx_notification_queue_status on notification_queue(status, created_at);
create index if not exists idx_notification_queue_recipient on notification_queue(recipient_user_id, created_at desc);
create index if not exists idx_notification_queue_project on notification_queue(project_id);
create index if not exists idx_notification_preferences_user on notification_preferences(user_id);

do $$ begin
  create trigger set_updated_at before update on notification_queue
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger set_updated_at_prefs before update on notification_preferences
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;
