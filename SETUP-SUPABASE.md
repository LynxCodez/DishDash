# DishDash ↔ Supabase setup (one-time, ~10 minutes)

This makes every browser share **one live dataset**: place an order in Chrome and it
appears in Firefox's admin console instantly (and, later, on any device). It uses your
existing project files — no rebuild, no frameworks. **Without this setup nothing
changes**: the site keeps running 100% offline on localStorage, exactly as before.

---

## What you need

- A free [Supabase](https://supabase.com) account and one new project (any name, e.g. `dishdash`).

## Step 1 — Create the database (2 min)

1. Open your project → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, copy **all** of it, paste, **Run**.
   This creates the 6 tables, security policies, triggers and the menu/catalog seed.

## Step 2 — Allow instant sign-up (1 min)

**Authentication → Providers → Email**: turn **OFF** "Confirm email"
(for the demo we want sign-in without an inbox round-trip).

This setting is also what selects the app's verification flow — with it OFF you
get the in-app code, and with it ON you get a real emailed link. See
[Email verification](#step-5--email-verification-1-min) below to choose.

## Step 3 — Paste your two keys (1 min)

**Project Settings → API** → copy the **Project URL** and the **anon public** key into
`assets/js/supabase-config.js`:

```js
window.DD_SUPABASE_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ…'
};
```

> The **anon key is designed to be public** — all real protection comes from the
> Row Level Security policies you ran in Step 1. **Never** use the `service_role`
> key in frontend code.

## Step 4 — One-click demo setup (2 min)

Serve the folder (opening the file directly can block network calls):

```
node server.js      →  http://localhost:5173
```

Open **http://localhost:5173/setup-demo.html** and click top-to-bottom:

1. **Test connection** — verifies schema + keys
2. **Create demo accounts** — the 6 DishDash demo users via Supabase Auth
   (admin password `admin123`, customers `demo1234`)
3. **Promote to admin** — makes `admin@dishdash.ng` the administrator
4. **Seed demo data** — copies the demo orders (DD-1001 → DD-1010) + favourites so
   every browser sees the same history

All steps are safe to re-run.

> **Important:** editing a `.sql` file does NOT change your database. Postgres
> functions are snapshotted when created, so after any fix to a SQL file here you
> must re-paste and re-run it in the SQL Editor. The app and the file can both be
> correct while the database still runs the old, broken version.

## Step 5 — Email verification (1 min)

Open **SQL Editor → New query**, paste **`supabase/verification-schema.sql`**,
and **Run**. Like `schema.sql`, it is safe to re-run.

It adds a `profiles.email_verified_at` column and **grandfathers every account
that already exists as verified** — so your demo accounts keep working exactly as
they do today, and verification is demonstrated on a freshly registered one.

> Running this is what turns the feature on. If you skip it, the app detects the
> missing column and leaves everyone unblocked, so nothing breaks — but there is
> then no verification to show.

### Choosing how the code is delivered

The app supports both and picks automatically — no code change either way:

| "Confirm email" | What the customer experiences |
|---|---|
| **OFF** (default) | A 6-digit code appears in a labelled **Demo inbox** panel on `verify.html`. Nothing is emailed, so it works offline, for any address, as often as you like. |
| **ON** | A real confirmation email is sent to whatever address was entered, carrying a **6-digit code** you type into `verify.html` (and a link). Requires custom SMTP **and** the template edit below. |

### Make the email carry a code (do this if "Confirm email" is ON)

The app asks the customer to **type a 6-digit code** into `verify.html`. Supabase's
default template only contains a link, so until you add the code the email says
"follow this link" while the page asks for a code.

**Authentication → Email Templates → Confirm signup** — replace the body with:

```html
<h2>Confirm your DishDash email</h2>
<p>Enter this code on the verification page to switch ordering on:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
<p>Or use this link: <a href="{{ .ConfirmationURL }}">confirm my email</a></p>
<p>If you didn't sign up for DishDash, ignore this message.</p>
```

`{{ .Token }}` is the 6-digit OTP and `{{ .ConfirmationURL }}` the link; keeping
both means either route works. The code expires (default 1 hour) and is
single-use.

> **Why a code and not just the link?** A link is opened by the operating
> system's default browser. If you demonstrate in a dedicated demo browser
> profile (`start-demo.bat`), the link confirms the account but drops the session
> into your everyday browser instead. A code typed into the page already open in
> front of you has no such problem.

For the real-email path, Supabase's built-in mail service only delivers to
**your own organisation's team addresses** and is capped at ~2 emails/hour, so
configure your own sender first: **Authentication → SMTP Settings**. A Gmail
address works without owning a domain — enable 2-Step Verification, create an
**App Password**, and use host `smtp.gmail.com`, port `587`, that address as the
sender, and the app password as the password. Also set **Authentication → URL
Configuration → Site URL** to `http://localhost:5173`, or the link in the email
will point somewhere that does not exist.

To go back to the self-contained demo, turn "Confirm email" back **OFF**.

## Step 6 — Paying-account snapshots (30 sec)

Open **SQL Editor → New query**, paste **`supabase/pay-account-schema.sql`**, and
**Run**. It adds one nullable column (`orders.pay_account`) and is safe to
re-run. Fresh projects already have the column from `schema.sql`.

It stores the snapshot of the account the customer verified when submitting a
bank transfer, so the admin sees the holder name and how it was checked in the
**Verify Payment** dialog.

> **Skipping this does not break checkout.** At boot the app probes for the
> column; if it is missing, cloud order writes simply drop the field. Ordering,
> tracking and admin verification all keep working — you just lose the account
> snapshot in cloud mode. (Local mode always stores it.)

## Step 7 — The cross-browser demo 🎉

**Easiest path:** double-click `start-demo.bat`. It starts the server, waits for
it, then opens Chrome as the customer and Edge as the admin — each in its own
profile folder and each starting signed out, so the demo is repeatable. Sign in
on both windows and continue below.

Or do it by hand:

- **Browser A** (e.g. Chrome): open `http://localhost:5173/`, sign in as
  `demo@dishdash.ng` / `demo1234`, place a COD order.
- **Browser B** (e.g. Firefox): open `http://localhost:5173/admin/`, sign in as
  `admin@dishdash.ng` / `admin123`. An admin sign-in always lands on the console,
  wherever you signed in from. The order is already there — advance it through
  Confirmed → Preparing → Out for Delivery → Delivered, click **Confirm payment**.
- Watch browser A: the customer's order page and status toasts update **live**.
  No refresh needed anywhere.

Sessions also cross browsers now (Supabase Auth), and no passwords or card data are
stored in the browser. A session **survives closing the window**, so if you land on
a signed-in page you did not expect, use the **“Signed in as …” → Sign out** bar on
the sign-in page, or open `login.html?fresh=1` for a guaranteed clean start.

---

## How it works (for the write-up)

- `store.js` stays the single data API; a cloud adapter (`DD_CLOUD`, same file)
  swaps its I/O only when keys are configured — pages don't change.
- Cloud reads are served from a synced cache; writes push to Supabase; a
  **Realtime** subscription pulls changes from other browsers instantly.
- If the connection ever drops (e.g. venue Wi-Fi), the app **falls back to local
  mode automatically** and a small banner explains what happened — a deliberate
  defense-day safety net.
- Security: customers can only read/write **their own** orders and favourites;
  only admins can edit the menu or advance orders; no client can self-promote to
  admin (a one-time bootstrap exception lets the first admin claim the role).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Banner "running in local mode" | Check the two keys in `supabase-config.js`; check internet |
| Setup page: "relation does not exist" | Step 1 not run (or run in the wrong project) |
| Login: "profile row is missing" | Step 1 trigger missing — re-run schema.sql |
| "Only admins can change roles" on promote | An admin already exists; sign in as admin@dishdash.ng instead |
| Orders appear only after refresh | Realtime blocked — check the SQL ran the publication lines (end of schema.sql) |
| Nobody is asked to verify their email | `verification-schema.sql` not run — see Step 5 |
| "Email verification is not enabled on the server yet" | Same as above — the RPC functions are missing |
| "function digest(text, unknown) does not exist" | The database has functions from an older file version — re-paste and run the CURRENT `verification-schema.sql` |
| "operator does not exist: text <> bytea" | Same — older file version in the DB. Re-paste, then click "Send a new code" on the verify page (codes minted by the old function have invalid hashes) |
| Confirmation email never arrives | Built-in SMTP only reaches your own team's addresses; configure custom SMTP (Step 5) |
| Email link lands on a dead page | Set Site URL to `http://localhost:5173` and demo on that exact port |
| The email has only a link, but the page asks for a 6-digit code | The Confirm-signup template was not edited — paste the snippet in Step 5 (or just click the link in the same browser) |
| Clicking the email link opens your everyday browser, not the demo one | Expected: Windows opens links in the default browser, which no web page can choose. Type the code instead, or copy the link's address and paste it into the demo browser |
| A correct 6-digit code is rejected | Codes expire (default 1 hour) and are single-use; only the newest email works. Click **Send a new code** and use that one |
| Demo account can no longer order | Should not happen — accounts are grandfathered. Check the Step 5 migration actually ran |
| Admin's Verify Payment dialog shows no paying-account details | Step 6 not run — the `orders.pay_account` column is missing, so cloud mode drops the snapshot by design |
| Demo starts already signed in as the previous account | Expected: a Supabase session outlives the window. `start-demo.bat` opens `login.html?fresh=1` (clean start); otherwise use **Sign out** in the “Signed in as …” bar |
| Sign-in form arrives pre-filled with someone's email and password | Browser password manager autofill for `localhost:5173`, not the app. It never pre-fills. `start-demo.bat` avoids it by using isolated `demo-profile\` browsers |
| Registering an address that already exists seems to succeed but no email arrives | Fixed in-app: cloud mode detects Supabase's placeholder user (empty `identities`) and offers a **Sign in instead** link |
| "Paying account" never resolves / "Could not verify that account" | The account number or bank selection is wrong — a NUBAN is exactly 10 digits for the bank you picked |
| Check digit says "did not match" on a real account | Expected for some accounts and all wallet providers; it is a caution, not a gate. The transfer still proceeds |
