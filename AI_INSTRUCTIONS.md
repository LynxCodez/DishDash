# AI_INSTRUCTIONS.md — handoff notes for DishDash

Read this before touching anything. It is the fast path to not breaking the
project, and it documents the traps that already cost real debugging time.

---

## 1. What this is

A **multi-page, framework-free** food-ordering web app: HTML + CSS + vanilla
JavaScript, with **jQuery (vendored)** only for UI interactions. It runs
entirely from `node server.js` (port **5173**, zero npm dependencies). The
data layer is pluggable:

- **Local mode** — no config, everything in `localStorage` under `dishdash_*`.
  Works offline. Passwords stored in plaintext (deliberate, demo-only).
- **Cloud mode** — if `assets/js/supabase-config.js` has a URL + anon key,
  the same store API transparently uses Supabase (Auth + Postgres + RLS +
  realtime). This project's copy points at a **live Supabase project**.

**The single most important rule: `assets/js/store.js` is the only data
boundary.** Pages never touch `localStorage`, `fetch`, or the Supabase client
directly. Every feature ships twice inside store.js — a local implementation
and a cloud one in the sync adapter that overrides store methods
(`S.requestEmailCode = ...`) when a client exists — and the two must stay in
parity. If you add a feature in one mode only, the other mode silently
regresses.

## 2. How to run / verify changes

```bash
node server.js            # → http://localhost:5173
node --check <file.js>    # the project has NO test framework and NO linter
```

There is no `npm test`. The established verification pattern is:

1. `node --check` every JS file you touched.
2. Write a **throwaway harness** (a `.js` file at the repo root, deleted
   after use) that loads the real `data.js` + `store.js` in local mode and
   asserts behaviour — this has caught several real bugs.
3. Browser-test through `http://localhost:5173` (the app must be served;
   `file://` breaks the pages).
4. **Never write test data to the live Supabase project** without asking.
   Read-only probes with the anon key via `curl` are fine
   (`/rest/v1/<table>?select=...`, `/rest/v1/rpc/<fn>`).
5. Test **cloud-mode code paths without touching any database** by stubbing the
   client: `store.js` exposes `window.DD_STORE_SYNC` (with `init()`, `status()`,
   `placeOrder()`, `_state`) and reads `window.supabase.createClient`, so a VM
   harness can supply a fake client that returns real PostgREST error shapes
   (`PGRST204` "could not find the 'x' column", `42703` "column does not
   exist") and assert what the app sends. This is how the missing-column
   behaviour below was proven without a single live write.
7. The demo is launched with **`start-demo.bat`** (double-click). It starts the
   server, opens Chrome as the customer and Edge as the admin — each in an
   isolated `demo-profile\<browser>` folder and each starting signed out
   (`login.html?fresh=1`). Prefer it for walkthroughs: it removes the two things
   that make a browser test lie to you, a leftover session and autofilled
   credentials. `demo-profile/` is gitignored; deleting it gives a
   factory-clean browser.
8. ⚠️ **Do NOT blank `supabase-config.js` to force local mode.** It is the one
   file in this project that holds a value the AI cannot regenerate (the anon
   key), and on 2026-09-16 blanking it for a walkthrough **destroyed the key**
   — the owner had to re-paste it from the Supabase dashboard. If you must
   switch modes, do it with a byte-exact copy (`cp` to a sibling file first —
   never retype the key from memory), or better, use the stub-client harness in
   point 5. (There is now a git repo with a GitHub remote — `baseline 21d89c5`
   — so `git diff`/`git checkout` can rescue you, but never rely on that for a
   value that was never committed.)
9. **Browser-preview traps that will waste an hour if you don't know them**
   (learned the hard way on 2026-09-17):
   - **A URL change that alters only the `#hash` does NOT reload the page** in
     the preview webview. You will then inspect a stale document and draw
     completely wrong conclusions (a feature looked broken for ~8 probes).
     Always change the **path or query** to force a real load — on a throwaway
     probe page, bump `?v=`; on a real page, add `?r=2`.
   - Timers are **throttled** while the preview tab is unfocused (`setInterval`
     collapses toward 1/s), so a tick-loop that measures how long a toast stays
     on screen reports nonsense. Use a single `setTimeout` and check one moment,
     or better, assert on a marker the code sets rather than on elapsed time.
   - To test a page state that needs a *signed-in* or *pending* session, copy the
     page to a throwaway probe (`.html` at the repo root, deleted after) and stub
     `DD_STORE.currentUser` **from inside `whenAuthReady().then(...)`** —
     `install()` re-assigns `currentUser` when the cloud adapter mounts, so a
     stub applied earlier is silently overwritten. Real verify.js, real code
     path, no database writes.
10. **Believe computed styles when they surprise you — and check your own
   probe first.** On 2026-09-17 `getComputedStyle(grad).backgroundClip` read
   `border-box` for a gradient-text rule while `CSS.supports` said `text` was
   supported, so it was written off here as a webview artifact. It was NOT: a
   later rule was using the `background` shorthand and resetting the clip, and
   the "control probe" written to confirm that was itself invalid because it
   also put `background:` after the clip longhands. The next day the same
   webview read `text` correctly once the offending rule was deleted. **Lesson:
   a surprising computed value means "find the rule that wins the cascade", not
   "the tool is lying" — and a control probe is only a control if it is correct.**
   (`preview_screenshot` failing with "produced no frames" is a genuine
   webview-freeze symptom; that one is the tool.)
11. **Proving an RLS-dependent mutation needs a real write — make it a
   disposable one.** The rule is still "don't leave data behind", not
   "never write": what caught the customer-cancellation bug was placing a
   clearly-labelled test order, cancelling it, re-pulling it from Postgres, and
   then deleting it with the admin's `admin deletes orders` policy. Record the
   row counts BEFORE and AFTER (here 13 orders → 14 → back to 13) and state the
   cleanup in the report. A stubbed client can never prove an RLS policy.
   Related: the customer session in cloud mode is the only way to exercise the
   customer-side order paths, and the seed credentials are in `data.js`
   (`demo@dishdash.ng` / `demo1234`, `admin@dishdash.ng` / `admin123`).
   Two more shapes worth knowing: a deleted credential/fixture can be recreated,
   and a stale demo password will surface as an ordinary login failure.
12. **`orders.status` has no CHECK constraint**, and the customer's order row is
   written with `orderToDb`, so `status_history` (jsonb) carries every
   cancellation reason and actor through Postgres untouched. Adding a column
   for it would have been wasted work — check whether an existing jsonb column
   already maps what you need before writing a migration.

## 3. Supabase: what the AI can and cannot do

- There is **no CLI, no psql, no service key** in this repo. The anon key in
  `supabase-config.js` is public by design (RLS is the protection) — you can
  use it for REST probes, but you **cannot run DDL**.
- The SQL files under `supabase/` are applied by **the human pasting them
  into the Supabase SQL Editor**. If you edit a `.sql` file, tell the user it
  must be **re-pasted** — Postgres functions are snapshotted at creation, so
  editing the file does nothing to a database that already ran the old
  version. This bit us once: a runtime crash (`digest() missing`) lived only
  in the DB while the file looked correct.
- Three SQL files exist and are idempotent/re-runnable:
  - `supabase/schema.sql` — core tables, RLS, `protect_role_change()`
    trigger, realtime publications.
  - `supabase/reviews-schema.sql` — reviews + feedback + RLS.
  - `supabase/verification-schema.sql` — email verification (codes table,
    `request_email_code()` / `confirm_email_code(text)` /
    `mark_email_verified()` RPCs, `protect_verification_flag()` trigger).
  - `supabase/pay-account-schema.sql` — item 3: adds `orders.pay_account`
    (jsonb) for the customer's verified paying-account snapshot.

- **`supabase-config.js` holds the only two values in this repo that an AI
  cannot regenerate** (project URL + anon key). Cloud mode needs both; with an
  empty key the app silently runs local mode. On 2026-09-16 a walkthrough
  blanked that file and destroyed the key, and the owner had to re-paste it from
  the dashboard — read section 2, point 6 before you touch it. It is restored
  and verified (a read-only `curl` to `/rest/v1/foods` returns 200 with it).

## 4. Facts that will bite you if you skip them

**Sessions outlive the browser window — this is what breaks demo runs.**
- A Supabase session is persisted in `localStorage`, so closing Chrome does
  **not** sign anyone out. A second run of the demo opens already signed in as
  whoever used it last, which is exactly how the owner got stuck unable to
  register a fresh account.
- Three keys can each hold an account and `S.logout()` only clears the layer
  that is live: `dishdash_session` (local store), `dishdash_session_hint`
  (cloud optimistic hint), `dishdash_cloud_session` (cloud profile cache).
  Anything that claims to "sign out" must clear **all three** — see
  `SESSION_KEYS` / `wipeSessionCaches()` in `pages/auth.js`. A leftover
  `dishdash_session` resurrects a ghost local user on any boot that falls back
  to local mode (no venue Wi-Fi).
- **`?fresh=1` on `login.html` is the contract the launcher relies on:** wait
  for the cloud layer to settle, sign out, sweep those keys, strip the flag with
  `history.replaceState`, then paint. Do not reorder that work after the banner
  or make it fire on every load.
- A pre-filled email/password on the sign-in form is the **browser's password
  manager**, never the app (`auth.js` deliberately leaves the form empty). The
  only reliable fix is not using that browser profile — hence
  `demo-profile\chrome` / `demo-profile\edge` in `start-demo.bat`. Do not add
  `autocomplete="off"` hacks and call it solved.
- **Landing must be role-aware.** `nextUrl()` in `auth.js` honours `?next=` only
  inside the area the role can use: admins always land on `admin/index.html`,
  customers never land in `admin/`. Before this, the launcher's admin URL sent a
  customer into admin → login → admin forever.
- **Registering while an account is already signed in:** in link mode Supabase
  returns no session, so the *previous* account stays live and `verify.html`
  would read it (already confirmed) and show "you are all set" for the wrong
  address. The cloud `registerUser` therefore signs the old session out, and
  `verify.js` prefers a `?email=` that differs from the live session. Keep both —
  either alone still leaves a confusing screen.
- **`identities: []` means "email already registered"** when "Confirm email" is
  ON. Supabase returns a *placeholder* user (and sends nothing) to prevent
  account enumeration; the app checks `created.user.identities.length === 0` and
  answers with a "Sign in instead" link. Proven live with an anon-key
  `POST /auth/v1/signup` probe.

**Email verification (`store.js`).**
- **A used confirmation link must be acknowledged, not silent.** Supabase
  returns the session in the URL **fragment** (`#access_token=…`), and
  supabase-js consumes and clears it during `init()`. So `DD_CLOUD.linkLanding()`
  snapshots `location.hash` **at script load**, before that happens, and
  `ui.js` toasts the outcome after `whenAuthReady()`: "Email confirmed 🎉" only
  when a session genuinely exists, "That confirmation link did not work" for an
  expired one. Before this, clicking the link looked like it had done nothing —
  the exact complaint that started this work. Don't read the hash later; it is
  gone by then, and don't claim success from the fragment alone.
- **The emailed confirmation is a TYPED 6-DIGIT CODE, not a link** (link mode
  still honours the link, but the code is the primary path). Reason, learned the
  hard way: a link in an email is opened by the OS **default browser**, which no
  web page can influence. In the `start-demo.bat` setup the link therefore
  confirmed the account *and* landed the session in the user's everyday browser,
  while the demo-profile browser held no session at all (link-mode sign-up issues
  none) and had no way to finish. Do not "simplify" this back to a link-only flow.
- `confirmSignupOtp(email, code)` lives in the **cloud sync module** (not the
  page) and calls `auth.verifyOtp()`, which needs NO session — the session comes
  back in the response body, so it works from the signed-out "check your inbox"
  screen. It tries `type: 'email'` (the type Supabase documents for this OTP,
  with `{{ .Token }}` in the Confirm-signup template) and then `type: 'signup'`,
  because a wrong type and a wrong code produce the SAME "invalid" error — the
  fallback is the only way to be sure. A failed verify does not consume the
  token, so the retry is safe. If `data.user` comes back with no session the
  function returns `{ ok: true, signedIn: false }` and the page sends the
  customer to sign in rather than claiming they are logged in.
- **The code only exists if the Supabase template is edited** (Authentication →
  Email Templates → Confirm signup must contain `{{ .Token }}`). Servers, not
  code, decide this; `SETUP-SUPABASE.md` Step 5 carries the exact snippet. If a
  correct code is ever rejected in the field, the first thing to check is the
  template, the second is whether the newest email was used (codes are
  single-use and expire).
- `emailVerified()` intentionally trusts Supabase's `emailConfirmed` **only
  in email-link mode**. With "Confirm email" OFF (this project's setting),
  Supabase auto-confirms every sign-up — trusting that stamp in code mode
  made the entire in-app code flow dead on arrival in cloud mode. If you
  "simplify" that conditional back, you resurrect a live bug.
- Mode is auto-detected from how `signUp` answers (session ⇒ code mode, no
  session ⇒ link mode) and cached in `localStorage` (`dishdash_vmode`).
- Demo codes are stashed in `localStorage` (`dishdash_demo_code`) because the
  DB stores only a hash — the demo panel must survive a reload mid-cooldown.
- Postgres hashing uses **`encode(sha256(convert_to(x,'UTF8')), 'hex')`**, not
  pgcrypto `digest()` — the extension is not installed and this file must have
  zero extension dependencies. Core `sha256()` RETURNS `bytea`, NOT hex text;
  omitting `encode(..., 'hex')` breaks confirm_email_code with
  "operator does not exist: text <> bytea" (bit us once — don't repeat it).
- `verification_codes` has RLS with **no policies**: deliberately unreadable
  by any client. Don't "fix" that.
- Error codes matter: `PGRST202` = RPC missing (say "run the SQL");
  `42883` = RPC exists but crashed (surface the raw message — it is a code
  bug, not a setup step).
- Seed/demo accounts are **grandfathered as verified** (in the SQL migration
  and in `data.js`) so `demo@dishdash.ng` can always order. New accounts
  cannot order until verified; the gate lives in checkout's single
  `finishOrder` funnel, not per payment method.

**Bank-account verification / transfers (item 3).**
- Lives in `store.js` (`nubanCheckDigit`, `validateNuban`, `resolveBankAccount`),
  the transfer panel in `pages/checkout.js`, and the admin snapshot in
  `admin/orders.js` (`payingAccountHTML`).
- **Enforced:** digits only, exactly 10 digits, and a bank from `D.NG_BANKS`.
  **Reported, not enforced:** the CBN check digit — it does not hold for every
  account and no wallet provider (OPay/Kuda/Moniepoint) has a public prefix
  rule, so a hard gate would reject real numbers on stage. `validateNuban`
  returns `checkDigit: 'match' | 'mismatch' | 'n/a'` and the UI shows a green
  confirmation, an amber caution, or "wallet — no public rule".
  **Do not turn the mismatch into a hard failure** — that is a deliberate
  safety choice, not an oversight.
- Name resolution is **simulated by default** (deterministic from account +
  bank code so it repeats on stage). The provider seam is
  `POST /api/resolve-account` in `server.js`: **501 when
  `PAYSTACK_SECRET_KEY` is unset** (client falls back to the demo resolver),
  otherwise a server-side provider call. The secret never reaches the browser,
  and `resolveBankAccount` must keep working with the endpoint absent
  (`fetch` rejected / 404 on a static host) — the offline demo depends on it.
- The snapshot `{account, bankCode, bank, accountName, source, at}` is stored on
  the order as `payAccount` and quoted in the admin's Verify Payment dialog.
- **Cloud column detection (keep this pattern):** `detectPayAccountColumn()`
  probes `orders.pay_account` once at boot (`postgres` answers 42703 when the
  migration has not run) and `withoutPayAccount()` strips the field from writes
  when absent, with a retry-on-`PGRST204` backstop. Same fail-safe idea as the
  email-verification flag: an un-run migration must never fail a customer's
  order. Don't "simplify" it into a plain write.
- **`setPanel` in checkout.js must render synchronously.** The payment panels
  are swapped with `$panel.html(...)` + the CSS `panelIn` animation, *not* a
  jQuery fade — fade callbacks are timers, and browsers throttle those in a
  backgrounded tab, which left the payment area blank until refocus. The CSS
  animation cannot stall that way.
- The transfer CTA starts **disabled** and `confirmTransfer` re-verifies the
  snapshot against the live inputs before submitting, so re-rendering the panel
  cannot unlock it.

**Credentials / backups.** Before temporarily editing any file that contains a
value only the owner can provide (`supabase-config.js` today), make a byte-exact
copy first and compare `md5sum` after restoring. Losing that anon key cost the
owner a manual dashboard round-trip (section 2, point 6).

**Phone numbers.** One rule, `validatePhone`/`normalizePhone` in store.js:
exactly 11 digits starting 070/080/081/090/091; `+234` and missing-leading-
zero forms are accepted and normalised to `0803...`. This matters because
seed accounts store `+234 803 412 7788` — a stricter rule locks the demo
customer out of checkout. Enforced on register, checkout, both profile
fields, and on every write path (orders store the canonical form).

**Auth/roles.** Roles are guarded by the `protect_role_change()` trigger:
only an existing admin may change roles, except the one-time bootstrap
window (no admin exists) that the setup wizard relies on. Never move role
logic to the client.

**Reviews.** One review per customer per dish (DB-enforced duplicate error
must map to a friendly "edit your existing review" message); owner-only
edit/delete re-checked in the store, not just hidden in the UI. "Verified
order" badge is computed from delivered orders at read time.

**Realtime.** In cloud mode, orders/reviews sync across browsers via
Supabase realtime; in local mode, cross-tab via the `storage` event. Pages
that show live data should listen to both paths the way `orders.js` does.

**Foods `id` is a plain int PK with NO Postgres default.** The
`generated always as identity` column in schema.sql is `order_items.id`, not
`foods` — do not confuse them (it cost an hour once). `addFood` therefore
computes `max(id)+1` client-side in BOTH modes; never insert into `foods`
without an explicit id, and never delete `row.id` "to let the DB assign it"
(→ `23502 not-null`). Insert with `.select().single()` so the normalised row
comes back. A `23505` duplicate (two admin consoles racing) re-pulls the
catalog and retries once — mirror the `placeOrder` pattern.

**Page render vs cloud boot race.** Controllers render at
`DOMContentLoaded`, but the boot `pullCatalog` can finish later; its
broadcast then hits zero listeners, and pages show a stale snapshot (this
made a brand-new dish invisible on menu/admin until reload). Two-part
contract: (a) data-showing pages register `S.on('foods', render)` (menu,
food detail, home, favourites, admin foods do); (b) the cloud `init()`
replays one `setTimeout(…, 0)` broadcast for foods/categories/orders after
it settles, guaranteeing every open page re-renders at least once with the
fresh snapshot. New pages showing catalog data should follow (a).

**Dish images.** `foods.img` is plain text; the form resizes uploads
client-side (≤900 px, JPEG q0.72, ~15–40 KB) and stores a data-URL — no
storage bucket, no schema. `D.img()` in data.js passes through `data:` and
`http(s)` URLs and only prefixes bare IDs with the Unsplash URL — every
consumer (menu, food, home, favourites, cart, admin) already routes through
it, so image handling changes belong in `D.img()` + the form, not per page.
Local-mode `write()` reports "Storage is full" on QuotaExceededError instead
of silently dropping the write — keep that guard when touching store.js.

**Hero backdrop (index.html).** Layer contract inside `.hero`, bottom-up:
`.hero-bg` (z-0: three `.hero-bg-slide` photo divs + `.hero-bg-tint` +
`.hero-bg-fade`) → `.hero::before` glows (z-1) → `.hero-inner` content
(z-2). The rotation lives in `home.js` behind three guards: module-level
`heroTimer` (the foods-broadcast re-init must not stack intervals), a
`document.hidden` tick-skip, and the global reduced-motion rule. The bottom
44% `.hero-bg-fade` must always end exactly at `var(--bg)` — that is what
makes the photo melt into the page with no seam. Any new hero photo must be
curl-checked for HTTP 200 BEFORE being committed (a dead Unsplash ID just
silently shows nothing). If all photos fail, the hero degrades to the plain
cream gradient — by design, do not "fix" that with a placeholder photo.

**The hero is single-column, left-aligned and bright-only.** `.hero-inner` is a
block holding `.hero-copy` alone, over the photo backdrop. **Put the width cap
on `.hero-copy`, never on `.hero-inner`**: `.hero-inner` is also a `.container`
(`max-width:1200px; margin:0 auto`), so capping that element narrows it and its
own auto margins then CENTRE the narrowed box — the hero silently drifted to
the middle of wide screens that way, and the owner noticed before any test did.
The right shape is a full-width container with a max-width child pinned left. The
right-hand photo collage (`.hm-main` / `.hm-f1` / `.hm-f2`), the floating stat
chips (`.float-chip`) and the `@keyframes floaty`/`spin` they used were all
REMOVED on the owner's request on 2026-09-18; "Free delivery on orders above
₦20,000" now lives in the `.hero-proof` row as a fourth `.proof` item. Do not
re-add the collage or those chips. A **dark "cinematic" hero variant**
(`.hero.is-cinematic`, applied by `home.js` from a stored preference) was also
built and then **rejected by the owner** — the copy was hard to read — so it
is gone entirely; the hero is bright-only and `home.js` no longer touches the
hero's styling at all. If you resurrect any of it from git history, read the
gradient-text rule below first: the variant's own rules caused a real bug.

**Gradient text must use `background-image`, never the `background` shorthand.**
`.hero h1 .grad` (and `.auth-brand h1 .grad`) depend on
`background-clip: text` + `color: transparent`. The `background` SHORTHAND
resets `background-clip` back to its initial `border-box`, so any later rule
that writes `background: linear-gradient(...)` on that selector silently turns
the word into a solid gradient RECTANGLE over invisible text — which is
exactly what happened to the word "delivered" in the cinematic variant. Use the
longhand, and if gradient text ever looks like a coloured bar, check for a
shorthand override before touching anything else.

**Terminal order states are off-flow.** `cancelled` is NOT in
`DD_DATA.STATUS_FLOW` (that array is the happy path: the tracking timeline
renders one step per entry, `nextStatus()` reads its length, and the admin
"Next ▸" walks it — appending `cancelled` would make "delivered → cancelled"
a legal advance). Use `D.statusMeta(key)` for any status lookup and
`UI.isTerminal(key)` for "is this order closed?" — never a bare
`status === 'delivered'` test, and never a `.find()` against STATUS_FLOW, or
cancelled orders will silently fall out of a page. The cancellation reason and
actor live inside `statusHistory` entries, which is ALREADY a mapped jsonb
column, so cancellation needed no schema change — keep it that way.

**A 0-row UPDATE is not an error in PostgREST.** An update that RLS filters
out matches zero rows and still answers 200 with `error: null`. That is how a
missing policy becomes a silent lie: customer cancellation appeared to work
while the row stayed `pending`. `updateOrder` therefore ends with
`.select('id')` and throws when nothing came back, and every caller of it
(`cancelOrder`, `updateOrderStatus`, `verifyTransfer`, `confirmPayment`) has a
catch that rolls the optimistic change back and reports the failure. Keep both
halves: **always ask for the affected rows back after a write**, and never let
a caller toast success for a write that returned none. The matching migration
is `supabase/cancel-schema.sql` (a customer may flip their OWN `pending` order
to `cancelled` and nothing else).

**Promo codes are ALL one-time, and that is a policy, not a per-code flag.**
`DD_DATA.PROMO_POLICY = { oncePerAccount: true }` is read by `checkPromo`, so
every code — including any added later — is single-use per account
unconditionally. Do **not** reintroduce a per-code `once` flag: the whole point
is that a new code cannot be added without inheriting the limit. Only
economics vary per code (`type`, `value`, `minSub`) plus the optional extra
`firstOrderOnly` (DISHWELCOME).

**Promo rules live once, in `DD_DATA.checkPromo`.** Both stores call it with
their own predicates (`isUsed`, `hasOrders`) so a code cannot behave
differently online and offline. A code is spent when the ORDER IS PLACED, not
when it is typed, and cancelling releases it. Redemption is keyed per account —
`setPromoOwner` overrides the owner in cloud mode, because the local session is
unused there and the record would otherwise be keyed `guest`, letting one
account's redemption block the next account on a shared browser (which is
exactly the demo setup). Cloud persistence is `supabase/promo-schema.sql` and
is optional: a missing table is detected and the app degrades to the per-browser
record instead of failing checkout.

## 5. Conventions

- Vanilla JS, ES5-ish style, no modules, no transpile: each page's controller
  lives in `assets/js/pages/*.js` (or `assets/js/admin/*.js`) and is included
  by its HTML file. Shared chrome/components in `ui.js` (`UI.toast`,
  `UI.confirm`, `UI.go`, `UI.ic`, `UI.esc`, `UI.statusBadge`, …) — reuse
  those instead of adding new dialog/notify mechanisms.
- CSS is one design system in `assets/css/style.css` (+ `admin.css`), token
  variables in `:root`. Before adding classes, grep for collisions — prefix
  features (`vf-`, `rv-`) instead of generic names.
- Seed content only in `data.js`. No hardcoded food/user data anywhere else.
- **Public pages are public on purpose.** `faq.html` and `terms.html` are
  customer-facing help pages (no sign-in, no role) reached from the footer's
  **Help** column on every customer page. Their controllers
  (`assets/js/pages/faq.js`, `pages/terms.js`) only *enhance* static HTML —
  the FAQ is built from native `<details>` elements so it still reads with JS
  off, and the terms document is plain markup. Do not convert either into a
  JS-rendered page: the whole point is that a policy/help page survives a
  broken script. Contact details and the copyright year are filled from
  `DD_DATA.CONFIG`/`Date` so they cannot drift.
- The footer grid is **five columns** (`1.55fr .9fr .9fr .9fr 1.3fr`, → `1fr 1fr 1fr` under 1160px, `1fr 1fr` under 720px) since the Help column was
  added. Adding a sixth needs a grid change, not a new class.
- jQuery is vendored at `assets/js/vendor/jquery-3.7.1.min.js`; don't add CDNs
  or npm packages (the demo must run offline).
- Images: `data.js` `img()` handles data-URLs, any http(s) URL, and Unsplash
  IDs (see section 4). Emoji/gradient fallbacks and `onerror="this.remove()"`
  stay in place. Uploaded photos are data-URLs produced by the admin form's
  client-side resize — do not convert them to external hosting for the demo.
- **Standing rule from the owner (do not skip):** after every significant
  change, update `README.md`, `SETUP-SUPABASE.md` AND this file in the same
  pass — before reporting the work as done. The project is handed between
  AI assistants and IDEs, so stale docs directly cause the next AI to
  misconfigure or break things. `README.md` doubles as the feature ledger
  ("Feature status"); new Supabase errors belong in the SETUP
  troubleshooting table; new traps belong in section 4 here.

## 6. Known gaps / roadmap (matches README "Feature status")

- Item 3 — **real bank-account verification**: DONE and **verified live
  end-to-end in cloud mode** — order placed with the snapshot, read back raw
  from the `orders` table, admin verified the payment, and the snapshot
  SURVIVED the update (orderToDb/orderFromDb round-trip it correctly; don't
  drop `pay_account` from either). The `orders.pay_account` migration was
  applied 2026-09-16. Fresh projects get the column from `schema.sql`; older
  ones need `pay-account-schema.sql`.
- Item 5 — **reports system**: DONE (`admin/reports.html` +
  `assets/js/admin/reports.js`, sidebar entry in `ui.js` ADMIN_NAV). Two
  deliberate rules — don't "fix" either:
  1. **Revenue = paid money only.** `isPaid()` gates every revenue sum:
     card `paid`, transfer `paid`, COD `paid`. Awaiting/pending orders count
     in order totals but never in revenue. Counting them flatters the report
     and would be indefensible in a demo Q&A.
  2. **All hour binning converts to `Africa/Lagos` first** (`lagosParts()`
     with `Intl.DateTimeFormat`, `hourCycle: 'h23'`). `placedAt` is ISO/UTC;
     using `getHours()` would shift every peak by an hour. 23:30 UTC Wednesday
     MUST bin as Thursday 00: Lagos.
  - AOV = revenue ÷ ALL orders in the period (not ÷ paid orders) — the
    average size of an order taken. Only 7d/30d show vs-previous deltas;
    all-time and this-month have no comparable window (`pctChange` returns
    null, no arrow renders).
  - The maths layer is pure/DOM-free and exposed as `window.DD_REPORTS_TEST`
    for harness testing (60 assertions written 2026-09-16, all passing).
    Don't entangle it with the render functions.
  - CSV export: BOM prefix (₦ in Excel), RFC-4180 quoting, filename from the
    period label.

**Git/GitHub.** The project is connected to
`https://github.com/LynxCodez/DishDash` (branch `main`, public repo). History
begins at the owner's `.gitignore`/`LICENSE` commit, then the verified
baseline (items 1–4). **Commit after every significant change and push** —
that history is the restore point this project never had before 2026-09-16.
`supabase-config.js` (anon key) is committed deliberately: the anon key is a
public client identifier and RLS is the protection; the service_role key
exists nowhere in the repo. Git identity is repo-local:
`LynxCodez <LynxCodez@users.noreply.github.com>`. Credential helper is
`manager` (GCM 2.7.3) — the first push pops a GitHub login on the owner's
screen; later pushes reuse the stored credential.
- Item 8 — **dish-adding flow + image/thumbnail upload**: DONE and
  verified live (2026-09-17, cloud mode): drag-drop/click upload with
  client-side resize → data-URL in `foods.img`, `D.img()` passthrough, inline
  field errors, local quota guard, cloud add/edit/delete + menu render all
  proven in the browser. See section 4 ("Foods `id`" and "Dish images").
- **Help pages (FAQs + terms)**: DONE (2026-09-18) — `faq.html` (21
  questions, six topics, live search, one-open accordion, deep links, contact
  card from `DD_DATA.CONFIG`) and `terms.html` (13 numbered sections, sticky
  scroll-spy index, real-vs-simulated table). Linked from the footer Help
  column. Contracts to preserve: the section/anchor ids are shareable demo
  links (`faq.html#cancel-order`, `terms.html#privacy`) — keep them stable;
  the FAQ stays native-`<details>` static HTML; the legal copy must stay
  honest that payments, delivery and the bank account are simulated.
- Admin **review/feedback moderation screen**: DB permits it, no UI.
- Admin analytics: revenue by payment method, AOV, peak-hours heatmap —
  DONE (shipped with the Reports page).
- **Order cancellation**: DONE and verified live in cloud mode (2026-09-17) —
  customer cancel while `pending`, admin refuse at any point before delivery,
  reason + actor in `statusHistory`, terminal states final, cancelled orders
  excluded from revenue/order counts/heatmap. See section 4 for the off-flow
  status contract and the 0-row-UPDATE trap. **`cancel-schema.sql` must be run
  for the customer path in cloud mode** — without the policy the write is
  filtered out (the app now reports that loudly instead of faking success).
- **One-time promo codes**: DONE — **updated 2026-09-18 at the owner's
  request: every code is now single-use per account**, enforced globally by
  `DD_DATA.PROMO_POLICY` so codes added later inherit it too (`FAST10` was
  repeatable before this and is not any more — its docs and the FAQ/terms copy
  were corrected in the same pass). `DISHWELCOME` additionally stays
  first-order-only. Spent on order placement, released on cancellation.
  `promo-schema.sql` is optional (degrades to per-browser enforcement). Rules
  live once in `DD_DATA.checkPromo`; see section 4.
- **Homepage hero**: DONE — single-column copy over the crossfading photo
  backdrop, four proof items (35 min / dishes / rating / free delivery). The
  right-hand collage, the floating stat chips and the dark "cinematic"
  variant were all **removed at the owner's request on 2026-09-18** after the
  variant shipped and read poorly. Do not re-add any of them; see section 4 for
  the gradient-text trap the variant caused.
- Backlog from an external review, triaged & real (remaining): bulk admin
  actions (advance many orders), push-notification simulation on status change,
  XSS audit (ensure UI.esc on every user-generated render), loading states
  for first cloud fetch. Rejected as stale: print receipt (exists), i18n
  (owner has not asked). **Dark mode: the owner does not want one.** A hero-only
  dark variant was offered, built, and rejected as hard to read — so neither a
  site-wide dark mode nor a dark hero should be built without being asked again.
- Footer Account column shows "Sign in" even while signed in (`ui.js`,
  header/drawer are session-aware, footer is not).
- Seed order dates in data.js are anchored to **Date.now()** (not a fixed
  timestamp), so the dashboard's 7-day chart always covers "the last seven
  days". Don't "stabilise" it back to a constant — a checkout re-opened
  months later would show an empty chart.
- ui.js installs **global error boundaries** (unhandledrejection + error →
  toast). Expected failures return {ok:false} objects and never reach it;
  if a toast fires during normal use, treat it as a real bug.
- ui.js already ships **UI.printReceipt** (wired into confirmation + orders
  pages) — an external review suggested "building" it; it exists.
- An external AI review (Sept 2026) also claimed date-anchoring and error
  handlers were "already fixed" — both were actually still broken and have
  NOW been fixed for real. Verify claims against code, not against reviews.
- Cloud-mode verification flow: **verified live and confirmed working by the
  owner.** It took two SQL re-pastes to get there (see the sha256 and
  digest() notes in section 4). If confirm/request ever fails with
  "function digest(text, unknown) does not exist" or "operator does not
  exist: text <> bytea", the database is running an OLD function version —
  re-paste the current `verification-schema.sql`, then request a FRESH code
  (codes minted by an old function have hashes in the wrong format).

## 7. Housekeeping

- `server.js` is a tiny static server with no deps — extend it only if a new
  MIME type or route genuinely needs it.
- `setup-demo.html` is the one-click wizard: it seeds Supabase and signs seed
  users in, which is why the SQL deliberately keeps "Confirm email" OFF.
  If that setting is turned ON for real email links, newly wizard-created
  users will need confirmation first — the app handles it (typed code or link),
  the wizard's instant sign-in does not.
- Before reporting an email-verification change as done, re-read this:
  the emailed code path can only be *proved* end to end with a real inbox. What
  IS provable without one — and should be, every time — is that the page renders
  both link-mode panels, that a wrong code reaches `POST /auth/v1/verify` (expect
  two 403s, one per attempted type) and maps to the friendly inline error, and
  that nothing throws. A throwaway probe page that stubs `DD_STORE.currentUser`
  after `whenAuthReady()` is the cheapest way to reach the signed-in panel.
- The live Supabase project may contain throwaway test accounts
  (`live.test.dd@gmail.com` etc.) from verification testing — safe for the
  user to delete from the Supabase dashboard (Authentication → Users).
