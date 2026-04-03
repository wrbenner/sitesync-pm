-- notification_queue: stores outbound notifications pending delivery
create table if not exists notification_queue (
  id                uuid        primary key default gen_random_uuid(),
  project_id        uuid        not null references projects(id) on delete cascade,
  recipient_user_id uuid        not null references auth.users(id),
  recipient_email   text        not null,
  trigger_type      text        not null,
  template_data     jsonb       not null default '{}',
  status            text        not null default 'pending'
                                check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at           timestamptz,
  error             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- notification_preferences: per-user delivery preferences for each trigger type
create table if not exists notification_preferences (
  id                       uuid    primary key default gen_random_uuid(),
  user_id                  uuid    not null references auth.users(id) on delete cascade unique,
  rfi_assigned             text    default 'instant' check (rfi_assigned in ('instant', 'digest', 'off')),
  rfi_response             text    default 'instant' check (rfi_response in ('instant', 'digest', 'off')),
  rfi_overdue              text    default 'instant' check (rfi_overdue in ('instant', 'digest', 'off')),
  submittal_approved       text    default 'instant' check (submittal_approved in ('instant', 'digest', 'off')),
  submittal_revision       text    default 'instant' check (submittal_revision in ('instant', 'digest', 'off')),
  change_order_pending     text    default 'instant' check (change_order_pending in ('instant', 'digest', 'off')),
  daily_log_reminder       text    default 'instant' check (daily_log_reminder in ('instant', 'digest', 'off')),
  pay_app_review           text    default 'instant' check (pay_app_review in ('instant', 'digest', 'off')),
  punch_item_assigned      text    default 'instant' check (punch_item_assigned in ('instant', 'digest', 'off')),
  meeting_scheduled        text    default 'instant' check (meeting_scheduled in ('instant', 'digest', 'off')),
  daily_digest_enabled     boolean default true,
  daily_digest_time        time    default '19:00:00',
  timezone                 text    default 'America/Denver',
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- row level security
alter table notification_queue enable row level security;
alter table notification_preferences enable row level security;

-- notification_queue policies
create policy "notification_queue_select_own"
  on notification_queue
  for select
  using (recipient_user_id = auth.uid());

create policy "notification_queue_insert_project_members"
  on notification_queue
  for insert
  with check (
    project_id in (
      select pm.project_id
      from project_members pm
      where pm.user_id = auth.uid()
    )
  );

-- notification_preferences policies
create policy "notification_preferences_select_own"
  on notification_preferences
  for select
  using (user_id = auth.uid());

create policy "notification_preferences_insert_own"
  on notification_preferences
  for insert
  with check (user_id = auth.uid());

create policy "notification_preferences_update_own"
  on notification_preferences
  for update
  using (user_id = auth.uid());

-- indexes
create index if not exists idx_notification_queue_status
  on notification_queue (status, created_at);

create index if not exists idx_notification_queue_recipient
  on notification_queue (recipient_user_id, created_at desc);

create index if not exists idx_notification_preferences_user
  on notification_preferences (user_id);

-- updated_at triggers
create trigger set_updated_at
  before update on notification_queue
  for each row execute function update_updated_at();

create trigger set_updated_at
  before update on notification_preferences
  for each row execute function update_updated_at();
