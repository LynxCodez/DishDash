-- ============================================================
-- DISHDASH — One-time promo redemption (run once in Supabase SQL Editor)
-- Safe to re-run: every statement is idempotent.
--
-- Optional, but recommended. Without it the app still boots and still
-- enforces "one time" — just PER BROWSER instead of per account, because
-- the fallback record is a localStorage entry keyed by the account id.
-- With it, a code spent on a phone is spent on the laptop too.
--
-- The write path never fails because of this table: a missing relation is
-- detected and the app degrades quietly (see pullPromoUses / isMissingTable
-- in assets/js/store.js).
-- ============================================================

-- ---------- 1. REDEMPTIONS ----------
-- One row per (account, code): the unique constraint IS the rule. Deleting
-- the row hands the code back — which is exactly what cancelling an order
-- does, so a welcome code is never burned by an order that never happened.
create table if not exists public.promo_redemptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  code       text not null,                 -- upper-cased, e.g. 'DISHWELCOME'
  order_id   text references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists idx_promo_redemptions_user on public.promo_redemptions(user_id);
create index if not exists idx_promo_redemptions_code on public.promo_redemptions(code);

-- ---------- 2. RLS ----------
-- A customer reads, writes and releases ONLY their own redemptions. Admins
-- get a read-only view for reporting; they deliberately cannot insert, so an
-- admin browsing the site can never spend a customer's code.
alter table public.promo_redemptions enable row level security;

drop policy if exists "own promo read"   on public.promo_redemptions;
create policy "own promo read"   on public.promo_redemptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own promo insert" on public.promo_redemptions;
create policy "own promo insert" on public.promo_redemptions for insert to authenticated
  with check (auth.uid() = user_id);

-- upsert (the normal write path) needs UPDATE as well as INSERT
drop policy if exists "own promo update" on public.promo_redemptions;
create policy "own promo update" on public.promo_redemptions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own promo delete" on public.promo_redemptions;
create policy "own promo delete" on public.promo_redemptions for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "admin reads promo redemptions" on public.promo_redemptions;
create policy "admin reads promo redemptions" on public.promo_redemptions for select to authenticated
  using (public.is_admin());

-- ---------- 3. GRANTS ----------
grant select, insert, update, delete on public.promo_redemptions to authenticated;

-- No realtime subscription needed: a code is spent once, by one account,
-- at checkout — there is no second screen that must react instantly.
