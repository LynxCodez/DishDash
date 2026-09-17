-- ============================================================
-- DISHDASH — Customer order cancellation (run once in Supabase SQL Editor)
-- Safe to re-run: every statement is idempotent.
--
-- WHY THIS FILE EXISTS
-- schema.sql created exactly ONE update policy on public.orders:
--     "admin updates orders"  ... using (public.is_admin())
-- so a customer updating their own order matched ZERO rows. PostgREST does
-- not treat that as an error — it answers 200 with error: null — so the app
-- cheerfully showed "Order cancelled" while the database row stayed pending.
-- Customer cancellation needs its own policy.
--
-- The policy is deliberately NARROW: it only lets a customer flip their OWN
-- order from 'pending' to 'cancelled'. It cannot move an order forward, cannot
-- touch a delivered order, and cannot edit anyone else's order — progress stays
-- admin-only. (The client also asks for the affected rows back and fails loudly
-- on a 0-row update, so a future RLS gap can never silently lie again.)
-- ============================================================

drop policy if exists "own orders cancel" on public.orders;
create policy "own orders cancel" on public.orders for update to authenticated
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'cancelled');

-- No new columns are needed. The cancellation reason and the actor are stored
-- inside status_history — already a jsonb column that orderToDb/orderFromDb
-- map in both directions — so {'status':'cancelled','by':'customer','reason':…}
-- round-trips through Postgres with no schema change.

-- Nothing else: grants on public.orders already include UPDATE for
-- authenticated (see the GRANTS section of schema.sql); RLS was the only
-- thing standing in the way.
