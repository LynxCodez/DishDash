-- ============================================================
-- DISHDASH — EMAIL VERIFICATION
-- ------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor, after schema.sql.
-- Safe to re-run: everything is idempotent.
--
-- What this adds:
--   1. profiles.email_verified_at  — when the address was confirmed
--   2. public.verification_codes   — hashed, expiring, single-use codes
--   3. three RPCs the app calls    — request / confirm / mark (link mode)
--   4. a guard so a client cannot set its own verified flag
--
-- TWO MODES, ONE SCHEMA
--   The app supports both, and picks automatically from how Supabase
--   responds to a sign-up (see README → "Email verification"):
--     • "Confirm email" OFF  → in-app code mode. request_email_code()
--       mints a 6-digit code and returns it so the app can show it in a
--       clearly-labelled demo panel. No email is sent to anyone.
--     • "Confirm email" ON   → real email link mode. Supabase emails the
--       confirmation itself; mark_email_verified() then mirrors the
--       result onto the profile.
--   In BOTH modes the ordering gate reads the same profile flag.
-- ============================================================


-- ---------- 1. THE FLAG ----------
-- Added, and every EXISTING account grandfathered as verified, exactly once.
-- The guard is on whether the column already exists: without it, re-running
-- this file would silently verify any account that had not yet confirmed.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'email_verified_at'
  ) then
    alter table public.profiles add column email_verified_at timestamptz;

    -- Grandfather the demo accounts and seeded customers so nothing that
    -- worked before this feature shipped suddenly cannot order. Accounts
    -- created after this point start unverified.
    update public.profiles set email_verified_at = now();
    raise notice 'verification: column added, existing profiles grandfathered as verified';
  end if;
end $$;


-- ---------- 2. CODES ----------
-- Only the SHA-256 hash is stored. Row-level security is enabled with NO
-- policies, so no client can read this table at all — only the SECURITY
-- DEFINER functions below touch it.
create table if not exists public.verification_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  channel     text not null default 'email',
  code_hash   text not null,
  attempts    int  not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists verification_codes_user_idx
  on public.verification_codes (user_id, created_at desc);

alter table public.verification_codes enable row level security;
revoke all on public.verification_codes from anon, authenticated;


-- ---------- 3. RPCs ----------
-- Codes live for 10 minutes, tolerate 5 wrong attempts, are single-use, and
-- cannot be re-requested for 60 seconds. Rules run in the database so they
-- hold no matter what the browser does.
-- The hash uses sha256() from POSTGRES CORE (PG11+), not pgcrypto's digest() — zero
-- extension dependencies. CAUTION: core sha256(bytea) RETURNS bytea, not text (verify
-- in the PG docs, "Binary String Functions") — it MUST be wrapped as
-- encode(sha256(convert_to(x,'UTF8')), 'hex') to yield hex text for code_hash.
-- Removing the encode() breaks confirm_email_code with
-- "operator does not exist: text <> bytea" (this actually happened; don't repeat it).

create or replace function public.request_email_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  v_cooldown int  := 60;      -- seconds between requests
  v_ttl      int  := 600;     -- 10 minutes
  v_last     timestamptz;
  v_code     text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to verify your email.');
  end if;

  select max(created_at) into v_last
    from public.verification_codes where user_id = uid;

  if v_last is not null and v_last > now() - make_interval(secs => v_cooldown) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Please wait a moment before requesting another code.',
      'retryAfter', ceil(extract(epoch from (v_last + make_interval(secs => v_cooldown)) - now()))
    );
  end if;

  -- only ever one live code per customer
  update public.verification_codes
     set consumed_at = now()
   where user_id = uid and consumed_at is null;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.verification_codes (user_id, channel, code_hash, expires_at)
  values (uid, 'email', encode(sha256(convert_to(v_code, 'UTF8')), 'hex'), now() + make_interval(secs => v_ttl));

  -- Returned so the demo can display it. In a production build this value
  -- would go to your email provider instead and never reach the browser.
  return jsonb_build_object('ok', true, 'code', v_code, 'expiresIn', v_ttl, 'cooldown', v_cooldown);
end $$;


create or replace function public.confirm_email_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  v_max int  := 5;            -- wrong attempts allowed per code
  v_row public.verification_codes;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to verify your email.');
  end if;

  if coalesce(trim(p_code), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Enter the 6-digit code.');
  end if;

  select * into v_row
    from public.verification_codes
   where user_id = uid and consumed_at is null
   order by created_at desc
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No active code — request a new one.');
  end if;

  if v_row.expires_at <= now() then
    update public.verification_codes set consumed_at = now() where id = v_row.id;
    return jsonb_build_object('ok', false, 'error', 'That code has expired. Request a new one.');
  end if;

  if v_row.attempts >= v_max then
    update public.verification_codes set consumed_at = now() where id = v_row.id;
    return jsonb_build_object('ok', false, 'error', 'Too many incorrect attempts. Request a new code.');
  end if;

  if v_row.code_hash <> encode(sha256(convert_to(trim(p_code), 'UTF8')), 'hex') then
    update public.verification_codes set attempts = attempts + 1 where id = v_row.id;
    return jsonb_build_object(
      'ok', false,
      'error', 'That code is not correct.',
      'attemptsLeft', greatest(0, v_max - (v_row.attempts + 1))
    );
  end if;

  update public.verification_codes set consumed_at = now() where id = v_row.id;

  perform set_config('dishdash.verify', 'on', true);
  update public.profiles set email_verified_at = now() where id = uid;

  return jsonb_build_object('ok', true);
end $$;


-- Link mode only: Supabase owns the truth about confirmation, so this mirrors
-- it onto the profile. It refuses to stamp anyone whose email Supabase has
-- not actually confirmed.
create or replace function public.mark_email_verified()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  v_conf timestamptz;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in.');
  end if;

  select email_confirmed_at into v_conf from auth.users where id = uid;

  if v_conf is null then
    return jsonb_build_object('ok', false, 'error', 'Your email has not been confirmed yet.');
  end if;

  perform set_config('dishdash.verify', 'on', true);
  update public.profiles
     set email_verified_at = coalesce(email_verified_at, v_conf)
   where id = uid;

  return jsonb_build_object('ok', true);
end $$;


grant execute on function public.request_email_code()      to authenticated;
grant execute on function public.confirm_email_code(text)  to authenticated;
grant execute on function public.mark_email_verified()     to authenticated;


-- ---------- 4. GUARD ----------
-- Mirrors the protect_role_change() pattern from schema.sql: the everyday
-- "update own profile" policy is broad, so without this a client could simply
-- write email_verified_at itself. Only our SECURITY DEFINER functions may
-- change it, and they announce themselves with a transaction-local flag.
create or replace function public.protect_verification_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_verified_at is distinct from old.email_verified_at then
    if current_setting('dishdash.verify', true) = 'on' then
      return new;
    end if;
    raise exception 'email_verified_at is managed by the verification flow';
  end if;
  return new;
end $$;

drop trigger if exists protect_verification_flag on public.profiles;
create trigger protect_verification_flag
  before update on public.profiles
  for each row execute function public.protect_verification_flag();


-- ============================================================
-- DONE. The app picks up the new column automatically. To switch
-- between the two modes see README → "Email verification".
-- ============================================================
