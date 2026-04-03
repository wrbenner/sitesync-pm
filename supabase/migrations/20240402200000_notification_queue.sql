-- notification_queue: stores outbound notifications pending delivery
create table if not exists notification_queue (
  id                uuid        primary key default gen_random_uuid(),
  project_id        uuid        not null references projects(id) on delete cascade,
  recipient_user_id uuid        not null references auth.users(id),
  recipient_email   text        not null,
  template_name     text        not null,
  template_data     jsonb       not null default '{}',
  entity_type       text,
  entity_id         uuid,
  status            text        not null default 'pending'
                                check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at           timestamptz,
  error             text,
  retry_count       integer     not null default 0,
  created_at        timestamptz default now()
);

-- indexes for queue processing and project scoping
create index if not exists notification_queue_status_created_at_idx
  on notification_queue (status, created_at);

create index if not exists notification_queue_project_id_idx
  on notification_queue (project_id);

-- row level security
alter table notification_queue enable row level security;

-- recipients can read their own notifications
create policy "notification_queue_select_own"
  on notification_queue
  for select
  using (recipient_user_id = auth.uid());

-- any authenticated project member can enqueue a notification
create policy "notification_queue_insert_authenticated"
  on notification_queue
  for insert
  with check (auth.role() = 'authenticated');

-- notification_preferences: per-user toggle settings for notification types
create table if not exists notification_preferences (
  user_id                  uuid    primary key references auth.users(id),
  rfi_assigned             boolean default true,
  rfi_overdue              boolean default true,
  submittal_returned       boolean default true,
  submittal_approved       boolean default true,
  change_order_pending     boolean default true,
  daily_log_reminder       boolean default true,
  punch_item_assigned      boolean default true,
  meeting_scheduled        boolean default true,
  digest_enabled           boolean default true,
  digest_time              time    default '19:00:00',
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

alter table notification_preferences enable row level security;

-- users can read and update only their own preferences row
create policy "notification_preferences_own"
  on notification_preferences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
