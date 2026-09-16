-- ============================================================
-- DISHDASH — Supabase schema (paste into Supabase SQL Editor, Run once)
-- ============================================================
-- Creates: profiles, categories, foods, favorites, orders, order_items
-- Security: Row Level Security everywhere. Customers see only their
-- own data; everyone can read the public menu; admins (role in
-- profiles table) manage the catalog and all orders.
-- ============================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PROFILES  (linked 1-to-1 with auth.users)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  phone       text default '',
  role        text not null default 'customer' check (role in ('customer','admin')),
  created_at  timestamptz not null default now(),
  delivery_name    text default '',
  delivery_phone   text default '',
  delivery_address text default '',
  delivery_city    text default '',
  delivery_note    text default ''
);

-- auto-create a profile row whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',  split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. CATEGORIES
-- ============================================================
create table if not exists public.categories (
  id    text primary key,            -- 'burgers', 'drinks', ...
  name  text not null,
  emoji text default '',
  img   text default '',
  sort  int not null default 0
);

-- ============================================================
-- 3. FOODS
-- ============================================================
create table if not exists public.foods (
  id          int primary key,
  cat         text not null references public.categories(id) on update cascade,
  name        text not null,
  price       numeric(12,2) not null check (price >= 0),
  old_price   numeric(12,2),
  rating      numeric(3,1) default 4.5,
  reviews     int default 0,
  prep        int default 20,
  tag         text,
  popular     boolean default false,
  in_stock    boolean default true,
  img         text default '',
  description text default '',
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 4. FAVORITES
-- ============================================================
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  food_id int  not null references public.foods(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

-- ============================================================
-- 5. ORDERS  (customer field is denormalized on purpose — an order
--    is a receipt; it must not change when a profile is edited)
-- ============================================================
create table if not exists public.orders (
  id           text primary key,             -- 'DD-1010'
  seq          int generated always as identity,
  user_id      uuid references public.profiles(id) on delete set null,
  customer     jsonb not null,               -- {name, phone, address, city, note}
  items        jsonb not null,               -- [{dishId,name,price,qty,img,note}]
  sub          numeric(12,2) not null,
  delivery_fee numeric(12,2) not null default 0,
  discount     numeric(12,2) not null default 0,
  promo_code   text,
  total        numeric(12,2) not null,
  pay          text not null,                -- card | cod | bank_transfer
  pay_status   text not null default 'pending', -- paid | pending | awaiting_verification
  pay_ref      text,
  pay_account  jsonb,                        -- item 3: customer's VERIFIED paying account
                                             -- {account,bankCode,bank,accountName,source,at}
  verified_at  timestamptz,
  paid_at      timestamptz,
  status       text not null default 'pending',
  status_history jsonb not null default '[]',
  rev          bigint not null default 0,    -- last-touch ms; higher rev wins on merge
  placed_at    timestamptz not null default now(),
  eta_min      int default 35,
  source       text default 'app'
);

-- ============================================================
-- 6. ORDER_ITEMS  (normalized copy of items — good to show both
--    in a defense: jsonb snapshot + relational detail)
-- ============================================================
create table if not exists public.order_items (
  id         bigint generated always as identity primary key,
  order_id   text not null references public.orders(id) on delete cascade,
  dish_id    int references public.foods(id) on delete set null,
  name       text not null,
  price      numeric(12,2) not null,
  qty        int not null check (qty > 0),
  note       text default ''
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- shared id sequence so orders created from ANY browser get unique DD-#### ids
create sequence if not exists order_id_seq start 1010;

create or replace function public.assign_order_id()
returns trigger
language plpgsql
as $$
begin
  if new.id is null or new.id = '' then
    new.id := 'DD-' || nextval('order_id_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_order_id on public.orders;
create trigger trg_assign_order_id
  before insert on public.orders
  for each row execute function public.assign_order_id();

-- trigger: keep order_items in sync with the order's items jsonb
create or replace function public.sync_order_items()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.order_items where order_id = new.id;
  insert into public.order_items (order_id, dish_id, name, price, qty, note)
  select new.id,
         (item->>'dishId')::int,
         item->>'name',
         (item->>'price')::numeric,
         (item->>'qty')::int,
         coalesce(item->>'note','')
  from jsonb_array_elements(new.items) as item;
  return new;
end;
$$;

drop trigger if exists trg_sync_order_items on public.orders;
create trigger trg_sync_order_items
  after insert or update of items on public.orders
  for each row execute function public.sync_order_items();

-- security: only admins may change a profile's role (blocks self-promotion).
-- BOOTSTRAP EXCEPTION: while NO admin exists yet, a user may make themselves
-- admin once — this is what lets the one-click demo setup work. After the
-- first admin exists, the rule locks in (documented in SETUP-SUPABASE.md).
create or replace function public.protect_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if public.is_admin() then
      return new; -- admins can manage roles
    end if;
    if new.role = 'admin' and new.id = auth.uid()
       and not exists (select 1 from public.profiles where role = 'admin') then
      return new; -- bootstrap: first admin claims the role
    end if;
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_role on public.profiles;
create trigger trg_protect_role
  before update on public.profiles
  for each row execute function public.protect_role_change();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- NOTE: MUST be security definer. This function reads public.profiles, and
-- the profiles table has RLS policies that call is_admin() — without definer
-- rights the policy would re-enter itself forever ("stack depth limit exceeded").
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.foods      enable row level security;
alter table public.favorites  enable row level security;
alter table public.orders     enable row level security;
alter table public.order_items enable row level security;

-- profiles: you read/update your own; admins can read all
create policy "read own profile"      on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "update own profile"    on public.profiles for update using (auth.uid() = id);
create policy "admin reads profiles"  on public.profiles for select to authenticated using (public.is_admin());

-- catalog: public read, admin write
create policy "public read categories" on public.categories for select using (true);
create policy "admin writes categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public read foods" on public.foods for select using (true);
create policy "admin writes foods" on public.foods for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- favorites: strictly per-user
create policy "own favorites select" on public.favorites for select using (auth.uid() = user_id);
create policy "own favorites write"  on public.favorites for insert with check (auth.uid() = user_id);
create policy "own favorites delete" on public.favorites for delete using (auth.uid() = user_id);

-- orders: customers create/read own; admins manage all
create policy "own orders select"  on public.orders for select using (auth.uid() = user_id or public.is_admin());
create policy "own orders insert"  on public.orders for insert with check (auth.uid() = user_id or user_id is null or public.is_admin());
create policy "admin deletes orders" on public.orders for delete using (public.is_admin());
create policy "own order items select" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "admin updates orders" on public.orders for update using (public.is_admin());

-- ============================================================
-- GRANTS  (required! tables created via the SQL editor get NO
-- permissions by default — RLS policies then decide what each
-- role may actually see/do)
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all functions in schema public to anon, authenticated;

alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

-- ============================================================
-- REALTIME  (live cross-browser updates)
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.foods;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.categories;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ============================================================
-- BASE CATALOG SEED  (categories + the 25 DishDash dishes)
-- ============================================================
insert into public.categories (id, name, emoji, img, sort) values
  ('burgers',  'Burgers',  '🍔', 'photo-1568901346375-23c9450c58cd', 1),
  ('pizza',    'Pizza',    '🍕', 'photo-1513104890138-7c749659a591', 2),
  ('chicken',  'Chicken',  '🍗', 'photo-1562967914-608f82629710',    3),
  ('rice',     'Rice',     '🍛', 'photo-1512058564366-18510be2db19', 4),
  ('pasta',    'Pasta',    '🍝', 'photo-1621996346565-e3dbc646d9a9', 5),
  ('snacks',   'Snacks',   '🍟', 'photo-1573080496219-bb080dd4f877', 6),
  ('desserts', 'Desserts', '🍰', 'photo-1578985545062-69928b1d9587', 7),
  ('drinks',   'Drinks',   '🥤', 'photo-1554866585-cd94860890b7',    8)
on conflict (id) do nothing;

insert into public.foods (id, cat, name, price, old_price, rating, reviews, prep, tag, popular, in_stock, img, description) values
  (1,  'burgers',  'Classic Beef Burger',          5500,  null, 4.9, 1240, 22, 'Bestseller',       true,  true,  'photo-1568901346375-23c9450c58cd', 'Juicy 100% beef patty, melted cheddar, crisp lettuce and our secret house sauce in a toasted brioche bun. Served with golden fries.'),
  (2,  'burgers',  'Crispy Chicken Burger',        5900,  null, 4.7,  860, 24, null,               true,  true,  'photo-1607013251379-e6eecfffe234', 'Buttermilk-brined crunchy chicken fillet, cool coleslaw and smoky mayo stacked in a soft sesame bun. A crowd favourite.'),
  (3,  'burgers',  'Double Smash BBQ Burger',      7200,  8000, 4.8,  540, 26, 'New',              false, true,  'photo-1550547660-d9450f859349',    'Two smashed beef patties caramelised with barbecue glaze, crispy onions and double cheddar. For serious appetites.'),
  (4,  'pizza',    'Margherita Pizza',             7500,  null, 4.8,  980, 30, null,               true,  true,  'photo-1513104890138-7c749659a591', 'Wood-fired base brushed with rich tomato sauce, fresh mozzarella and basil, finished with a drizzle of olive oil.'),
  (5,  'pizza',    'Pepperoni Pizza',              9500,  null, 4.9, 1510, 32, 'Bestseller',       true,  true,  'photo-1565299624946-b28f40a0ae38', 'Generously loaded with spicy pepperoni and bubbling mozzarella over our signature slow-cooked tomato base.'),
  (6,  'pizza',    'BBQ Chicken Pizza',            11000, null, 4.6,  320, 34, null,               false, false, 'photo-1574071318508-1cdbab80d002', 'Smoky BBQ sauce, grilled chicken strips, red onions and sweet corn crowned with a three-cheese blend.'),
  (7,  'chicken',  'Chicken Wings (6 pcs)',        5200,  null, 4.8,  690, 25, 'Spicy',            true,  true,  'photo-1608039755401-742074f0548d', 'Sticky-glazed wings tossed in your choice of sweet chilli, honey garlic or peri-peri heat. Comes with ranch dip.'),
  (8,  'chicken',  'Grilled Half Chicken',         6900,  null, 4.5,  410, 35, null,               false, true,  'photo-1598103442097-8b74394b95c6', 'Half chicken flame-grilled and basted in native spices, served with grilled vegetables and a side of yaji.'),
  (9,  'chicken',  'Fried Chicken & Chips',        5800,  null, 4.7,  880, 28, 'Local favourite',  true,  true,  'photo-1562967914-608f82629710',    'Four pieces of golden crispy fried chicken with seasoned fries. Weeknight comfort, done right.'),
  (10, 'rice',     'Jollof Rice & Chicken',        4800,  null, 4.9, 2100, 25, 'Bestseller',       true,  true,  'photo-1604329760661-e71dc83f8f26', 'Party-style smoky jollof rice cooked in rich tomato-pepper sauce, served with grilled chicken and plantain.'),
  (11, 'rice',     'Fried Rice & Grilled Chicken', 5200,  null, 4.7,  940, 26, 'Local favourite',  true,  true,  'photo-1603133872878-684f208fb84b', 'Wok-tossed fried rice with mixed vegetables and fluffy egg, paired with juicy grilled chicken.'),
  (12, 'rice',     'Coconut Rice & Peppered Beef', 5600,  null, 4.6,  380, 30, 'New',              false, true,  'photo-1512058564366-18510be2db19', 'Fragrant coconut rice simmered in mild spices, topped with tender peppered beef and fried plantain.'),
  (13, 'pasta',    'Spaghetti Bolognese',          5900,  null, 4.8,  760, 27, null,               true,  true,  'photo-1621996346565-e3dbc646d9a9', 'Al dente spaghetti folded into a slow-simmered beef ragù with garlic bread on the side. Proper comfort.'),
  (14, 'pasta',    'Creamy Alfredo Pasta',         6500,  null, 4.7,  450, 28, null,               false, true,  'photo-1645112411341-6c4fd023714a', 'Fettuccine tossed in a silky parmesan cream sauce with grilled chicken and a hint of nutmeg.'),
  (15, 'snacks',   'French Fries',                 2500,  null, 4.8, 1330, 15, null,               true,  true,  'photo-1573080496219-bb080dd4f877', 'Double-cooked, crispy on the outside and fluffy inside. Served hot with ketchup and our smoky dip.'),
  (16, 'snacks',   'Meat Pie',                     1500,  null, 4.6, 1120, 12, null,               true,  true,  'photo-1601050690597-df0568f70950', 'Golden, buttery pastry packed with savoury minced beef, potato and carrot. Baked fresh all day.'),
  (17, 'snacks',   'Beef Shawarma Wrap',           4500,  null, 4.9,  870, 16, 'Bestseller',       true,  true,  'photo-1561651823-34feb02250e4',    'Sliced beef shawarma with creamy garlic sauce, fresh vegetables and a squeeze of lemon, wrapped in soft flatbread.'),
  (18, 'snacks',   'Suya Skewers',                 4000,  null, 4.8,  520, 18, 'Spicy',            false, true,  'photo-1529193591184-b1d58069ecdd', 'Beef suya coated in fiery yaji spice, charred over open flame and served with sliced onions and tomatoes.'),
  (19, 'desserts', 'Chocolate Lava Cake',          4500,  null, 4.9,  610, 20, 'Bestseller',       true,  true,  'photo-1578985545062-69928b1d9587', 'Warm chocolate cake with a molten centre that flows when you cut in. Vanilla ice cream on the side.'),
  (20, 'desserts', 'Vanilla Ice Cream Tub',        3500,  null, 4.6,  290,  8, null,               false, true,  'photo-1563805042-7684c019e1cb',    'Creamy Madagascan vanilla gelato, hand-churned and served chilled. Add a brownie for extra joy.'),
  (21, 'desserts', 'Red Velvet Cupcake',           2800,  null, 4.5,  180, 10, 'New',              false, true,  'photo-1563729784474-d77dbb933a9e', 'Soft red velvet cake with cream-cheese frosting and a dusting of cocoa. One is never quite enough.'),
  (22, 'drinks',   'Chilled Soft Drink',           800,   null, 4.5, 1450,  2, null,               true,  true,  'photo-1554866585-cd94860890b7',    'Ice-cold Coca-Cola, Fanta or Sprite — your pick of the classic. The perfect sidekick to any meal.'),
  (23, 'drinks',   'Chapman Cocktail',             2000,  null, 4.7,  640,  6, null,               true,  true,  'photo-1553530666-ba11a7da3888',    'The Nigerian classic — a fruity blend of bitters, grenadine and citrus over ice with cucumber and lemon.'),
  (24, 'drinks',   'Fresh Orange Juice',           2500,  null, 4.8,  350,  6, null,               false, true,  'photo-1600271886742-f049cd451bba', 'Squeezed to order from sweet Nigerian oranges. No sugar, no preservatives — just sunshine in a cup.'),
  (25, 'drinks',   'Zobo Cooler',                  1500,  null, 4.6,  270,  5, 'New',              false, true,  'photo-1546171753-97d7676e4602',    'Tangy hibiscus drink brewed with ginger and pineapple, served ice cold. Heritage refreshment.')
on conflict (id) do update set
  cat = excluded.cat, name = excluded.name, price = excluded.price,
  old_price = excluded.old_price, rating = excluded.rating, reviews = excluded.reviews,
  prep = excluded.prep, tag = excluded.tag, popular = excluded.popular,
  in_stock = excluded.in_stock, img = excluded.img, description = excluded.description;

-- ============================================================
-- DONE. Next steps:
-- 1. Authentication > Providers > Email: disable "Confirm email"
--    (this also selects the in-app verification flow — see below)
-- 2. Run supabase/verification-schema.sql (email verification: codes,
--    RPCs, guard trigger). Optional — the app works without it, it just
--    has no verification step to show.
-- 3. Open /setup-demo.html in the site and click the buttons
-- ============================================================


-- ============================================================
-- REVIEWS & FEEDBACK (see reviews-schema.sql for the standalone block)
-- ============================================================
-- ============================================================
-- Safe to re-run: everything is idempotent.
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

-- NOTE on the "Verified order" badge: the app derives it on read by checking
-- whether the reviewer has a DELIVERED order whose order_items contain this
-- dish. order_items.dish_id is populated automatically from each order's
-- items jsonb by the sync_order_items trigger above, so the badge stays
-- correct without duplicating the flag in this table.
create index if not exists idx_reviews_food on public.reviews(food_id);
create index if not exists idx_reviews_user on public.reviews(user_id);

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
-- review per dish (the unique constraint enforces "one per dish"); admins can
-- moderate. The "Verified order" badge is a read-time badge, not a gate.
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
