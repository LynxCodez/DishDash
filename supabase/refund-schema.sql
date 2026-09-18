-- ============================================================
-- DISHDASH — Refunds (run once in Supabase SQL Editor)
-- Safe to re-run: every statement is idempotent.
--
-- WHAT THIS ADDS
-- A refund is its own record, not a column on the order:
--
--     refund_requests(order_id, user_id, amount, reason, status, note, ...)
--
--     · the CUSTOMER inserts one on their own order  → status 'requested'
--     · an ADMIN approves or declines it             → 'approved' | 'rejected'
--     · full order total only, one request per order, and a decision is final
--
-- WHY ITS OWN TABLE (the design decision worth keeping)
-- The alternative — letting the customer append a refund entry to the order's
-- status_history — would have required a broad "customers may update their own
-- orders" policy, and a customer who can update their own order row can also
-- rewrite its total, items or address. RLS cannot express "append one key to a
-- jsonb array and touch nothing else" without a trigger guarding every write.
-- With this table the customer never writes to public.orders at all, so the
-- only order write policy that exists stays as narrow as it already is
-- (admin: everything; customer: own pending → cancelled, see
-- cancel-schema.sql).
--
-- In cloud mode the app attaches each order's refund record to the order as it
-- reads it (see withRefunds() in assets/js/store.js), so pages still see
-- `order.refund` and never join anything themselves.
--
-- REQUIRED for refunds in cloud mode. Without it the app still boots, still
-- lets people order, and reports a clear, actionable message the moment a
-- refund is attempted — it never pretends the request was recorded.
-- ============================================================

-- ---------- 1. THE REQUEST ----------
-- order_id is the primary key on purpose: one order, one refund request, one
-- decision. 'amount' is stored explicitly (not recomputed later) so a refund
-- stays auditable even if the order is edited afterwards.
create table if not exists public.refund_requests (
  order_id   text primary key references public.orders(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  amount     numeric(12,2) not null default 0,
  reason     text not null default '',
  status     text not null default 'requested',   -- requested | approved | rejected
  note       text,                                -- the admin's decision note
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_refund_requests_user   on public.refund_requests(user_id);
create index if not exists idx_refund_requests_status on public.refund_requests(status);

-- ---------- 2. RLS ----------
-- Customers may create a request for their OWN order and read it back; they
-- can never decide it, and they cannot create one already marked approved or
-- on somebody else's order (the with check clause). Only admins may update —
-- which is what makes "an admin decides" a database rule, not a UI habit.
alter table public.refund_requests enable row level security;

drop policy if exists "own refund insert" on public.refund_requests;
create policy "own refund insert" on public.refund_requests for insert to authenticated
  with check (auth.uid() = user_id and status = 'requested');

drop policy if exists "own or admin refund read" on public.refund_requests;
create policy "own or admin refund read" on public.refund_requests for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admin decides refund" on public.refund_requests;
create policy "admin decides refund" on public.refund_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- No DELETE policy: a refund record is history. The admin can delete the
-- order, which cascades to this row — nothing else should be able to.

-- ---------- 3. GRANTS ----------
grant select, insert, update on public.refund_requests to authenticated;

-- ---------- 4. REALTIME ----------
-- Make the decision land live: the customer's page is usually open in another
-- browser (or another tab) when support approves the refund.
do $$
begin
  alter publication supabase_realtime add table public.refund_requests;
exception when duplicate_object then null; when undefined_object then null;
end $$;
