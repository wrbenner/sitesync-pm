-- =============================================================================
-- 20261028000000_mfa_backup_codes.sql
--
-- Issue #586 (CRITICAL) — MFA backup recovery codes.
--
-- Hazard (Wave-1 adversarial-auditor + FMEA F.MFA.1):
--   Users enroll TOTP, lose their phone, are locked out forever. Supabase's
--   default `mfa.enroll()` response only returns a TOTP secret — there is no
--   built-in recovery-code mechanism. We have to roll our own.
--
-- This migration adds:
--   1. `public.user_mfa_backup_codes` — append-only hash store. RLS: each user
--      sees their own rows only; nobody (including the user) can write directly.
--      All mutation happens via the two SECURITY DEFINER RPCs below.
--   2. `generate_mfa_backup_codes()` — generates 10 random alphanumeric codes,
--      hashes each with pgcrypto's `crypt(code, gen_salt('bf', 10))`, stores
--      hashes, returns plaintext codes ONCE in the response. Idempotent in the
--      sense that calling it again invalidates the prior batch (delete-then-insert).
--   3. `consume_mfa_backup_code(p_code)` — looks up unused hashes for the calling
--      user, matches the plaintext via `crypt(p_code, stored_hash) = stored_hash`,
--      marks the matched row `used_at = now()`. Returns boolean. Designed for the
--      future recovery flow at login time.
--
-- Security:
--   - Plaintext codes NEVER stored. Only bcrypt hashes (work factor 10).
--   - RLS prevents user-side INSERT/UPDATE/DELETE; only the SECURITY DEFINER
--     functions can mutate.
--   - generate_mfa_backup_codes does `delete from ... where user_id = auth.uid()`
--     before insert, so re-rolling is safe and the old batch is invalidated.
--   - consume_mfa_backup_code uses `for update skip locked` to prevent race
--     consumption of the same code.
-- =============================================================================

create extension if not exists pgcrypto;

-- ── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.user_mfa_backup_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);

create index if not exists user_mfa_backup_codes_user_id_idx
  on public.user_mfa_backup_codes (user_id)
  where used_at is null;

alter table public.user_mfa_backup_codes enable row level security;

-- Users can READ their own codes (used for the "how many remain" UI).
-- They CANNOT directly INSERT/UPDATE/DELETE — only the RPCs below can mutate.
drop policy if exists "user_mfa_backup_codes select own"
  on public.user_mfa_backup_codes;

create policy "user_mfa_backup_codes select own"
  on public.user_mfa_backup_codes
  for select
  to authenticated
  using (user_id = auth.uid());

-- Belt-and-suspenders: revoke direct write grants from anon and authenticated.
-- Service role retains all grants. The SECURITY DEFINER RPCs run as the
-- function owner (postgres) and bypass these.
revoke insert, update, delete on public.user_mfa_backup_codes from anon, authenticated;

-- ── RPC: generate_mfa_backup_codes ──────────────────────────────────────────
--
-- Generates 10 random codes, hashes, stores, returns plaintext array ONCE.
-- Re-rolls invalidate the prior batch.

create or replace function public.generate_mfa_backup_codes()
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_codes  text[] := array[]::text[];
  v_code   text;
  i        int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Invalidate any prior batch so the user only ever has one active set.
  delete from public.user_mfa_backup_codes where user_id = v_uid;

  -- 10 codes, 10 alphanumeric chars each, formatted XXXXX-XXXXX for legibility.
  for i in 1..10 loop
    -- 10 chars from a 32-char alphabet (no 0/O/1/I confusion).
    v_code := '';
    for j in 1..10 loop
      v_code := v_code || substr(
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        1 + (floor(random() * 32))::int,
        1
      );
    end loop;
    v_code := substr(v_code, 1, 5) || '-' || substr(v_code, 6, 5);

    insert into public.user_mfa_backup_codes (user_id, code_hash)
    values (v_uid, crypt(v_code, gen_salt('bf', 10)));

    v_codes := v_codes || v_code;
  end loop;

  return v_codes;
end;
$$;

revoke all on function public.generate_mfa_backup_codes() from public, anon;
grant execute on function public.generate_mfa_backup_codes() to authenticated;

-- ── RPC: consume_mfa_backup_code ────────────────────────────────────────────
--
-- Used during the recovery login flow (future PR). Returns true if the code
-- matched an unused hash for the calling user; marks it used.

create or replace function public.consume_mfa_backup_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_row_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    return false;
  end if;

  -- Constant-ish iteration over the small (<=10) unused-code set, comparing
  -- via crypt(). For each row we do one bcrypt op. Lock to prevent double-use.
  select id into v_row_id
  from public.user_mfa_backup_codes
  where user_id = v_uid
    and used_at is null
    and code_hash = crypt(p_code, code_hash)
  for update skip locked
  limit 1;

  if v_row_id is null then
    return false;
  end if;

  update public.user_mfa_backup_codes
  set used_at = now()
  where id = v_row_id;

  return true;
end;
$$;

revoke all on function public.consume_mfa_backup_code(text) from public, anon;
grant execute on function public.consume_mfa_backup_code(text) to authenticated;

-- ── Notes ───────────────────────────────────────────────────────────────────
-- Verification:
--   select count(*) from pg_proc
--     where proname in ('generate_mfa_backup_codes','consume_mfa_backup_code');
--   → 2
--
--   select count(*) from information_schema.tables
--     where table_schema='public' and table_name='user_mfa_backup_codes';
--   → 1
