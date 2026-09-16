-- ============================================================
-- DISHDASH — Reviews & site feedback (run once in Supabase SQL Editor)
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- ---------- 1. FOOD REVIEWS ----------
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  food_id    int not null references public.foods(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  title      text default '',
  body       text not null default '',
  created_at timestamptz not null default now(),
  unique (food_id, user_id)            -- one review per customer per dish
);

create index if not exists idx_reviews_food on public.reviews(food_id);
create index if not exists idx_reviews_user on public.reviews(user_id);

-- NOTE on the "Verified order" badge: the app derives it on read by checking
-- whether the reviewer has a DELIVERED order whose order_items contain this
-- dish. order_items.dish_id is populated automatically from each order's
-- items jsonb by the sync_order_items trigger in schema.sql. That keeps the
-- verified flag always correct without duplicating it in this table.

-- ---------- 2. SITE FEEDBACK ----------
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  name       text default '',
  email      text default '',
  rating     int check (rating between 1 and 5),
  message    text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 3. RLS ----------
alter table public.reviews  enable row level security;
alter table public.feedback enable row level security;

-- Reviews: everyone reads; a signed-in customer writes/edits their own one
-- review per dish (the unique constraint enforces "one per dish"); admins
-- can moderate. The "Verified order" badge is a read-time badge, not a gate.
drop policy if exists "public read reviews"    on public.reviews;
create policy "public read reviews"    on public.reviews for select using (true);

drop policy if exists "own reviews insert"     on public.reviews;
create policy "own reviews insert"     on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own reviews update"     on public.reviews;
create policy "own reviews update"     on public.reviews for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reviews delete"     on public.reviews;
create policy "own reviews delete"     on public.reviews for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "admin moderates reviews" on public.reviews;
create policy "admin moderates reviews" on public.reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Feedback: signed-in users submit; admins read the inbox
drop policy if exists "own feedback insert"  on public.feedback;
create policy "own feedback insert"  on public.feedback for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "anonymous feedback insert" on public.feedback;
create policy "anonymous feedback insert" on public.feedback for insert to anon
  with check (user_id is null);

drop policy if exists "admin reads feedback" on public.feedback;
create policy "admin reads feedback" on public.feedback for select to authenticated
  using (public.is_admin());

-- ---------- 4. GRANTS + REALTIME ----------
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant insert on public.feedback to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.reviews;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ---------- 5. LIVE RATING HELPER ----------
-- Average rating + review count per dish. Handy for a future server-side
-- list endpoint; the app itself computes the same numbers from the reviews
-- rows it already reads (and updates them live via the realtime channel).
create or replace view public.food_rating_summary as
select food_id,
       round(avg(rating)::numeric, 1) as avg_rating,
       count(*)::int                  as review_count
from public.reviews
group by food_id;

grant select on public.food_rating_summary to anon, authenticated;
