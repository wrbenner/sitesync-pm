-- Account deletion telemetry. Stores a SHA-256 hash of the user id
-- (not the id itself) so we can:
--   1. Prove to compliance that we honored deletion requests.
--   2. Count deletions and capture optional churn reason.
--   3. Detect a re-signup of the same user (hash collisions only).
--
-- Required by App Store Guideline 5.1.1(v) only insofar as the deletion
-- itself must happen. The hash log is an internal audit aid.

create table if not exists public.account_deletion_events (
  id            uuid primary key default gen_random_uuid(),
  user_id_hash  text not null,
  reason        text,
  deleted_at    timestamptz not null default now()
);

create index if not exists idx_account_deletion_events_deleted_at
  on public.account_deletion_events (deleted_at desc);

-- Service role inserts only. No RLS policy for end users — they should
-- never be able to read or write this table directly.
alter table public.account_deletion_events enable row level security;

comment on table public.account_deletion_events is
  'Append-only log of self-service account deletions. user_id_hash is SHA-256(user.id) so historical churn can be analyzed without retaining PII after the auth.users row is destroyed.';
