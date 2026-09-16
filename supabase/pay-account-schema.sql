-- ============================================================
-- DISHDASH — PAYING-ACCOUNT SNAPSHOT (item 3)
-- ------------------------------------------------------------
-- Run this ONCE in the Supabase SQL Editor if your project was created before
-- item 3 shipped. Fresh projects already have the column in schema.sql.
-- Safe to re-run.
--
-- WHY
--   In the bank-transfer checkout the CUSTOMER verifies the account they are
--   paying FROM. The app validates the number with the REAL CBN NUBAN
--   check-digit rule and shows the account holder's name (a live provider via
--   the server seam when PAYSTACK_SECRET_KEY is set, otherwise a deterministic
--   demo resolver). The resulting snapshot is attached to the order so the
--   admin sees exactly what was checked before marking the payment Paid:
--
--     { "account": "0123456789", "bankCode": "058", "bank": "Guaranty Trust Bank (GTBank)",
--       "accountName": "Adaeze O. Okafor", "source": "demo", "at": "2026-09-16T10:00:00.000Z" }
--
--   "source" is either 'provider' (real name-enquiry) or 'demo' (simulated
--   name, shown as such to both the customer and the admin).
--
-- IF YOU SKIP THIS
--   Nothing breaks. store.js detects the missing column, retries the order
--   write without the field, and keeps ordering working — but in CLOUD mode
--   the admin then sees no account snapshot. Local mode always stores it.
-- ============================================================

alter table public.orders add column if not exists pay_account jsonb;

-- No policy changes needed: `orders` RLS is row-level, so the new column is
-- covered by the existing customer/admin policies.


-- Ask PostgREST to pick up the new column immediately instead of waiting for
-- its schema-cache refresh (harmless if unsupported).
notify pgrst, 'reload schema';
