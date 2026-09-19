-- ============================================================
-- DISHDASH — Realtime publication fix
-- ------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor (SQL Editor → New query → paste →
-- Run). It is Step 10 in SETUP-SUPABASE.md. Safe to re-run.
--
-- WHY THIS FILE EXISTS
--
-- Supabase Realtime only streams changes for tables listed in the
-- `supabase_realtime` publication. Subscribing to a table that is NOT listed
-- does not fail loudly — and that silence is the bug this fixes.
--
-- schema.sql published orders, foods, categories and reviews, and
-- refund-schema.sql published refund_requests. `profiles` was never published,
-- but the app subscribed to it anyway — on the SAME channel as orders. The
-- Realtime server refuses the whole postgres subscription when one of its
-- bindings names an unpublished table, while the channel still reports
-- `joined` and subscribe() still reports SUBSCRIBED: no error, no event.
-- The result was that live order updates died everywhere — the customer's
-- tracking page and the admin console both stood still — even though the
-- `orders` binding on that channel was perfectly valid.
--
-- Two things changed in the app alongside this file:
--   1. Each table now gets its own realtime channel, so an unpublished table
--      can only ever cost its own channel (store.js — subscribeRealtime).
--   2. The published tables below, so profiles changes really do stream.
--
-- To check what is published at any time:
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' order by tablename;
-- ============================================================

-- ---------- 1. PUBLISH EVERY TABLE THE APP LISTENS TO ----------
-- `do $$ ... exception when duplicate_object` makes each line a no-op if the
-- table is already published, so re-running this file is harmless.
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.foods;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.categories;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.reviews;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.refund_requests;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---------- 2. REPLICA IDENTITY ----------
-- UPDATE and DELETE events need the previous row values to be streamed.
-- DEFAULT only carries the primary key, which is enough for the app (it
-- re-reads the row it needs after every event), so nothing to change here —
-- FULL would simply put the whole old row on the wire for no benefit.

-- ---------- 3. VERIFY ----------
-- Expect six rows: categories, foods, orders, profiles, refund_requests, reviews.
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
