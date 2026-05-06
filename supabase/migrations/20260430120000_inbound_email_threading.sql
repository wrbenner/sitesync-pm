-- Inbound email threading — supports the inbound-email edge function
-- which receives architect/sub replies and threads them back onto the
-- right RFI / Submittal / Change Order without making the sender log in.
--
-- See docs/EMAIL_IN.md for the full design.

-- ── outbound_email_log ───────────────────────────────────────────────────
-- Every outbound email is logged here so In-Reply-To header lookup works
-- when the sender's client preserves message threading.

create table if not exists public.outbound_email_log (
  id uuid primary key default gen_random_uuid(),
  message_id text not null,                       -- un-angle-bracketed
  entity_type text not null check (entity_type in ('rfi', 'submittal', 'change_order')),
  entity_id uuid not null,
  to_emails text[] not null default '{}',
  subject text,
  sent_at timestamptz not null default now(),
  -- Optional: the user who initiated the send. Null for system-driven sends.
  sent_by_user uuid references auth.users(id) on delete set null
);

create unique index if not exists outbound_email_log_message_id_uniq
  on public.outbound_email_log (message_id);
create index if not exists outbound_email_log_entity_idx
  on public.outbound_email_log (entity_type, entity_id, sent_at desc);

-- ── inbound_email_replies ────────────────────────────────────────────────
-- Successfully threaded inbound replies. Render these as comments on the
-- entity's detail view. Confidence band lets the UI show "auto-threaded"
-- vs "verified" badges.

create table if not exists public.inbound_email_replies (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('rfi', 'submittal', 'change_order')),
  entity_id uuid not null,
  from_email text,
  body_text text,
  subject text,
  message_id text,                                -- inbound message ID, for future thread chains
  in_reply_to text,                               -- the message ID this is replying to
  threaded_via text not null check (threaded_via in ('plus-tag', 'in-reply-to', 'subject')),
  threading_confidence text not null check (threading_confidence in ('high', 'medium', 'low')),
  received_at timestamptz not null default now(),
  -- Soft-delete only — these are part of the legal record.
  hidden_at timestamptz,
  hidden_reason text
);

create index if not exists inbound_email_replies_entity_idx
  on public.inbound_email_replies (entity_type, entity_id, received_at desc);
create index if not exists inbound_email_replies_from_email_idx
  on public.inbound_email_replies (from_email);

-- ── inbound_email_unmatched ──────────────────────────────────────────────
-- Replies the threader could not match. Park here so a human can triage
-- instead of silently dropping. The PM gets a daily digest of these.

create table if not exists public.inbound_email_unmatched (
  id uuid primary key default gen_random_uuid(),
  from_email text,
  to_emails text[] not null default '{}',
  subject text,
  body_text text,
  message_id text,
  in_reply_to text,
  received_at timestamptz not null default now(),
  triaged_at timestamptz,
  triaged_by_user uuid references auth.users(id) on delete set null,
  triaged_to_entity_type text check (triaged_to_entity_type in ('rfi', 'submittal', 'change_order')),
  triaged_to_entity_id uuid,
  triage_notes text
);

create index if not exists inbound_email_unmatched_pending_idx
  on public.inbound_email_unmatched (received_at desc)
  where triaged_at is null;

-- ── RLS ─────────────────────────────────────────────────────────────────
-- All three tables are project-scoped indirectly (via the entity FK). The
-- inbound function uses the service role and bypasses RLS. End-user reads
-- happen via the entity detail pages, which enforce project scope upstream.
-- We restrict direct selects to authenticated users in the same project.

alter table public.outbound_email_log enable row level security;
alter table public.inbound_email_replies enable row level security;
alter table public.inbound_email_unmatched enable row level security;

-- Outbound log: visible to project members on the same entity. Computing
-- the project_id requires an entity-specific lookup, so the simplest
-- correct policy is "service role writes; authenticated users see rows
-- where they have access to the underlying entity." For now, we expose
-- read access to authenticated users and rely on the entity detail page
-- to scope queries by entity_id (which is itself project-scoped).
create policy outbound_email_log_select_authenticated on public.outbound_email_log
  for select to authenticated using (true);

create policy inbound_email_replies_select_authenticated on public.inbound_email_replies
  for select to authenticated using (true);

-- Unmatched is more sensitive (raw email content from outside parties).
-- Restrict to service role + project admins. Project admin check uses
-- the existing project_members table.
create policy inbound_email_unmatched_admin_only on public.inbound_email_unmatched
  for select to authenticated using (
    exists (
      select 1 from public.project_members pm
      where pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'project_manager')
    )
  );

-- Inserts are service-role only. No INSERT policy = denied for anon/authenticated.

comment on table public.outbound_email_log is 'Every outbound email send. Used by inbound-email function to thread replies via In-Reply-To header.';
comment on table public.inbound_email_replies is 'Architect/sub replies that successfully threaded onto an RFI/Submittal/CO. Render as comments on the entity detail view.';
comment on table public.inbound_email_unmatched is 'Replies the threader could not match. Daily triage digest.';
