-- =============================================================================
-- 20261031000000_oauth_state_nonce_table.sql
--
-- FMEA R.SLACK.1 (CRITICAL) — OAuth redirect/state validation.
--
-- Hazard (Wave-6 — tests/security/slack-oauth-origin-mismatch.spec.ts):
--   `supabase/functions/oauth-token-exchange/index.ts` accepts a
--   client-supplied `redirectUri` and forwards it verbatim to the upstream
--   provider's token endpoint as `redirect_uri`. There is no allowlist, no
--   Origin/Referer enforcement, and no `state` nonce verification. An
--   attacker can intercept access tokens / chain CSRF + open-redirect
--   against any of the 5 supported providers (quickbooks, google_drive,
--   autodesk_bim360, sharepoint, docusign).
--
-- This migration adds:
--   1. `public.oauth_pending_states` — short-lived state nonces stored
--      server-side at auth initiation time. Each row is keyed by a
--      cryptographically-random opaque `state` token. RLS limits visibility
--      to the originating user. The token-exchange edge function (running
--      as the caller) consumes the row to prove the callback originated
--      from a request *it* made.
--   2. `issue_oauth_state(p_provider, p_redirect_uri)` — SECURITY DEFINER
--      RPC that mints a new state nonce, persists `(user_id, provider,
--      redirect_uri, expires_at)`, and returns the opaque token to the
--      caller. TTL = 10 minutes. Older expired rows are pruned on each
--      issue.
--   3. `consume_oauth_state(p_state, p_provider, p_redirect_uri)` —
--      SECURITY DEFINER RPC consumed by the edge function during code
--      exchange. Validates state exists + not expired + provider matches +
--      redirect_uri matches + belongs to caller, then deletes the row.
--      Returns boolean. Single-use by design.
--
-- Security:
--   - State token is generated via `encode(gen_random_bytes(32), 'base64')`
--     (256-bit entropy, URL-safe after base64 strip).
--   - RLS: users can read/delete only their own pending states. INSERT
--     happens through the SECURITY DEFINER RPC (which checks auth.uid()).
--   - consume_oauth_state uses `for update skip locked` + delete to ensure
--     single-use semantics under concurrent calls.
--   - Expired rows are eagerly pruned to keep the table small.
-- =============================================================================

create extension if not exists pgcrypto;

-- ── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.oauth_pending_states (
  state         text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null,
  redirect_uri  text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists oauth_pending_states_user_id_idx
  on public.oauth_pending_states (user_id);

create index if not exists oauth_pending_states_expires_at_idx
  on public.oauth_pending_states (expires_at);

alter table public.oauth_pending_states enable row level security;

-- Users can see their own pending states (debug / pending-flows UI).
drop policy if exists "oauth_pending_states select own"
  on public.oauth_pending_states;

create policy "oauth_pending_states select own"
  on public.oauth_pending_states
  for select
  to authenticated
  using (user_id = auth.uid());

-- Allow callers to drop their own stale states (e.g. cancel flow).
drop policy if exists "oauth_pending_states delete own"
  on public.oauth_pending_states;

create policy "oauth_pending_states delete own"
  on public.oauth_pending_states
  for delete
  to authenticated
  using (user_id = auth.uid());

-- No direct INSERT/UPDATE — only the SECURITY DEFINER RPCs may mutate.
revoke insert, update on public.oauth_pending_states from anon, authenticated;

-- ── RPC: issue_oauth_state ──────────────────────────────────────────────────
--
-- Called by the SPA before redirecting the user to the provider's auth URL.
-- Returns an opaque state token the client must include in both the
-- provider's `state` query param AND the eventual /exchange request body.

create or replace function public.issue_oauth_state(
  p_provider text,
  p_redirect_uri text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_state  text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_provider is null or length(trim(p_provider)) = 0 then
    raise exception 'provider required' using errcode = '22023';
  end if;

  if p_redirect_uri is null or length(trim(p_redirect_uri)) = 0 then
    raise exception 'redirect_uri required' using errcode = '22023';
  end if;

  -- Opportunistic prune of expired rows (bounded scan via index).
  delete from public.oauth_pending_states
  where expires_at < now() - interval '1 hour';

  -- 256 bits of entropy, URL-safe (strip +/= for query-param friendliness).
  v_state := replace(replace(replace(
    encode(gen_random_bytes(32), 'base64'),
    '+', '-'), '/', '_'), '=', '');

  insert into public.oauth_pending_states (state, user_id, provider, redirect_uri, expires_at)
  values (v_state, v_uid, p_provider, p_redirect_uri, now() + interval '10 minutes');

  return v_state;
end;
$$;

revoke all on function public.issue_oauth_state(text, text) from public, anon;
grant execute on function public.issue_oauth_state(text, text) to authenticated;

-- ── RPC: consume_oauth_state ────────────────────────────────────────────────
--
-- Called by the oauth-token-exchange edge function during code exchange.
-- Verifies all four invariants and deletes the row on success. Returns
-- true on match; false otherwise. Single-use.

create or replace function public.consume_oauth_state(
  p_state text,
  p_provider text,
  p_redirect_uri text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_row_id text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_state is null or length(trim(p_state)) = 0 then
    return false;
  end if;

  select state into v_row_id
  from public.oauth_pending_states
  where state = p_state
    and user_id = v_uid
    and provider = p_provider
    and redirect_uri = p_redirect_uri
    and expires_at > now()
  for update skip locked
  limit 1;

  if v_row_id is null then
    return false;
  end if;

  delete from public.oauth_pending_states where state = v_row_id;

  return true;
end;
$$;

revoke all on function public.consume_oauth_state(text, text, text) from public, anon;
grant execute on function public.consume_oauth_state(text, text, text) to authenticated;

-- ── Notes ───────────────────────────────────────────────────────────────────
-- Verification:
--   select count(*) from pg_proc
--     where proname in ('issue_oauth_state','consume_oauth_state');
--   → 2
--
--   select count(*) from information_schema.tables
--     where table_schema='public' and table_name='oauth_pending_states';
--   → 1
