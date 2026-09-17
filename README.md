# 🍔 DishDash — Good food. Fast delivery.

A responsive **online food ordering & delivery management platform**: customers
discover food, order, pay (simulated) and track deliveries; administrators
manage the menu, categories, orders and customers.

Built as a traditional **multi-page HTML5 / CSS3 / Vanilla JavaScript**
application with **jQuery** for UI interactions — no frontend framework — with
a pluggable data layer that runs on **localStorage** (no setup, works offline)
or **Supabase** (auth + Postgres + realtime).

## Run locally

```bash
node server.js          # or: npm run dev   →  http://localhost:5173
```

No dependencies, no build step. jQuery is vendored under `assets/js/vendor/`.
Photos load from Unsplash with emoji/gradient fallbacks when offline.

**Data mode:** by default the app runs on localStorage so the demo works with
zero setup. To go live with Supabase, paste your project URL + anon key into
`assets/js/supabase-config.js` — the same `store.js` API keeps working and
auth, orders, reviews etc. sync to Postgres with realtime across browsers.
See `supabase/schema.sql` (core) and `supabase/reviews-schema.sql`
(reviews + feedback), or run the `setup-demo.html` wizard.

## Demo accounts

| Role     | Email               | Password  |
|----------|---------------------|-----------|
| Customer | demo@dishdash.ng    | demo1234  |
| Admin    | admin@dishdash.ng   | admin123  |

Use the “demo account” buttons on the sign-in page for one-click access.

## Start the demo (one double-click)

`start-demo.bat` starts the server, waits for it to answer, then opens **Chrome**
as the customer and **Edge** as the admin. Both windows share one live Supabase
dataset, so an order placed in Chrome appears in Edge instantly.

Each browser runs from **its own profile folder** (`demo-profile\chrome`,
`demo-profile\edge`), which is what makes a presentation reproducible:

- **nothing autofills** — no saved password for `localhost:5173` is offered
- **no account leaks between runs** — the launcher adds `?fresh=1`, and the page
  signs out whatever the previous run left behind before showing the form
- **your everyday Chrome/Edge is untouched** — your bookmarks, extensions and
  personal tabs never end up on screen

Delete the `demo-profile` folder any time to hand yourself a factory-clean demo
browser. It is gitignored (it is browser cache, never committed). If you would
rather demo in your normal browser profile, drop `?fresh=1` from a line in the
`.bat` — the bar described below still lets you switch accounts by hand.

### Why a leftover account can appear at all

A Supabase session lives in the browser's `localStorage` and **outlives the
window**: closing Chrome does not sign anyone out, so a second run would open
already signed in as whoever used it last. Two mechanisms cover that:

- **`?fresh=1`** signs out and sweeps every session key before painting the form.
  It clears all three namespaces — the local store's session, the cloud layer's
  optimistic hint, and the cloud layer's cached profile — so a later boot that
  falls back to local mode (no venue Wi-Fi) cannot resurrect a ghost account
  either.
- **While any session is live**, `login.html` and `register.html` show a
  **“Signed in as …”** bar with **Continue** and **Sign out**, so nobody is left
  staring at a blank form that keeps refusing the account they are trying to
  create.

### Where each role lands after signing in

- An **admin** always lands in the admin console (`admin/index.html`) — including
  when the URL asked for a customer page.
- A **customer** lands on whatever `?next=` asked for, **unless** it points into
  `admin/`; then they land on their own home instead of bouncing
  admin → login → admin forever.

## Pages

**Customer** — Home · Menu (search/filter/sort/pagination) · Dish detail
(menu story + **reviews**) · Cart · Checkout (delivery info + simulated
payment) · Order confirmation (printable receipt) · Orders · Order tracking · Favourites ·
Profile · **Verify email** · Sign in · Register

**Admin** (`/admin/`) — Dashboard (stats, 7-day chart, status donut, top
dishes) · Food items (CRUD + availability) · Categories (CRUD) · Orders
(status pipeline) · Customers

Both sides run in any modern browser (Chrome, Edge, Firefox, Safari) — no
browser-specific APIs, no build step.

## Architecture

```
dishdash/
├── index.html … register.html      customer pages (one HTML per route)
├── admin/                          admin console pages
├── verify.html                     email verification (see below)
└── assets/
    ├── css/style.css, admin.css    design system (tokens, components)
    ├── img/favicon.svg
    └── js/
        ├── vendor/jquery-3.7.1.min.js
        ├── data.js                 sample data only (foods, categories, seeds)
        ├── store.js                state + persistence (THE data boundary —
        │                           localStorage locally, Supabase in cloud
        │                           mode, same API for both)
        ├── supabase-config.js      Supabase URL + anon key (cloud mode)
        ├── ui.js                   shared chrome, cards, toasts, modals
        └── pages/, admin/          per-page logic

supabase/
├── schema.sql                core tables (profiles, foods, orders, RLS triggers)
├── reviews-schema.sql        reviews + feedback + RLS + realtime
├── verification-schema.sql   email verification (codes, RPCs, guard trigger)
├── pay-account-schema.sql    verified paying-account snapshot on orders
├── promo-schema.sql          one-time promo redemption, per account
├── cancel-schema.sql         RLS policy letting a customer cancel their own order
└── (open setup-demo.html to seed everything from the browser)
```

Every migration above is **optional and idempotent**: each one is detected at
boot and skipped if absent, so running none of them still gives a working demo
(local mode, per-browser enforcement) and running all of them gives the full
cloud behaviour. `cancel-schema.sql` is the only one whose absence a *customer
action* can notice — see its section in `SETUP-SUPABASE.md`.

Layering rules:

- **data.js** — pure seed content (Nigerian menu with ₦ prices, seed orders).
- **store.js** — owns persistence (localStorage `dishdash_*` locally, or
  Supabase Postgres + realtime when `supabase-config.js` is filled in),
  auth sessions, cart, favourites, orders, reviews, feedback, email
  verification, the Nigerian phone-number rule (below) and admin CRUD.
  Pages never touch storage directly, so the data layer is swappable inside
  this one module. In cloud mode it syncs across browsers via Supabase
  realtime (orders, reviews).
- **ui.js** — shared components & chrome; jQuery drives the interaction layer
  (menus, drawers, toasts, modal transitions, animations); the rest is vanilla.
- **pages/** — thin per-page controllers.

## Reviews & feedback

- **Food reviews** — every dish detail page shows customer reviews and a
  live rating chip (average + count) on menu cards. Signed-in customers can
  write **one review per dish** (rating 1–5, title, body). Their own review
  carries **Edit** and **Delete** controls on the review itself: Edit reopens
  the same form prefilled and saves in place, Delete asks for confirmation
  first. Both actions are re-checked against the current session by the store,
  so a stale button can never touch another customer's review. A reviewer who
  has a **delivered** order containing the dish gets a “Verified order” badge,
  computed at read time — no manual flagging.
- **Site feedback** — the “Tell us how we're doing” button (page footer)
  opens a modal that saves name/email/rating/message to the feedback inbox.
  It works for signed-in *and* anonymous visitors.
- **Storage** — fully implemented in both modes: localStorage under
  `dishdash_reviews` / `dishdash_feedback`, and Postgres tables
  `public.reviews` / `public.feedback` with row-level security (public
  read, owner insert/update/delete, admin moderate) and realtime. Run
  `supabase/reviews-schema.sql` once in the Supabase SQL Editor to enable
  the cloud path; in local mode everything works out of the box.
- **Not built yet** — there is no admin moderation *screen*. The database
  already permits it (`admin moderates reviews`, `admin reads feedback`), but
  the admin console has no reviews/feedback inbox, so moderation today means
  the Supabase dashboard.

## Email verification

A new account can browse and fill a cart immediately, but **cannot place an order
until its email address is confirmed**. Verification state is read from the
profile, and the ordering gate lives in the one place every payment method
funnels through, so it cannot be side-stepped by choosing a different method.

**Two delivery modes, detected automatically.** Both are supported and the app
picks the right one from how Supabase responds to a sign-up — there is no flag to
set and no code change between them:

| Project setting | Mode | What happens |
|---|---|---|
| "Confirm email" **OFF** | in-app code | A 6-digit code is generated and shown in a labelled **Demo inbox** panel on `verify.html`. **Nothing is emailed.** |
| "Confirm email" **ON** | email code (link also honoured) | Supabase sends a real email carrying a **6-digit code** plus a link. The customer **types the code into `verify.html`**, which confirms the address and signs them in — no browser hand-off. Needs the one-time email-template edit in `SETUP-SUPABASE.md` → Step 5. |

**Why the code is the primary path, not the link.** A link in an email is opened
by the operating system's **default browser** — a choice no web page can
influence. In a setup where the demo runs in its own browser profile
(`start-demo.bat`), clicking the link therefore confirms the account *and drops
the session into the wrong browser*, while the browser the customer actually
registered in holds no session at all (link-mode sign-up issues none) and cannot
finish. A code typed into the open page has no such coupling. The link still
works — open it in the same browser and `verify.html` notices by itself — so both
routes stay functional, and `SETUP-SUPABASE.md` carries the exact template that
makes the email include the code.

**The link is acknowledged, never silent.** When a confirmation link *is* used,
Supabase returns the session in the URL fragment and signs the customer in on
whichever page it lands on. The app snapshots that fragment before supabase-js
consumes it, so it can say *"Email confirmed — ordering is unlocked"* instead of
appearing to do nothing; an expired link gets the opposite toast. The success
message only appears when a session really exists, so a stale or hand-edited
fragment cannot produce a cheerful lie.

**The verification logic is real, even in demo mode.** The code is generated in
Postgres, stored only as a SHA-256 hash, expires after 10 minutes, allows five
wrong attempts before being burned, is single-use, and enforces a 60-second
resend cooldown — all server-side, so the rules hold regardless of what the
browser does. `verification_codes` has RLS enabled with no policies at all, so
no client can read it; only the `SECURITY DEFINER` functions touch it. A guard
trigger mirrors the existing `protect_role_change()` pattern so a customer cannot
write their own `email_verified_at` through the (broad) "update own profile"
policy.

**What is deliberately not real:** in the in-app (demo) mode no email or SMS is
sent — the code is displayed in the app, so it demonstrates the *flow* —
generation, expiry, attempt limits, the gate — but not ownership of the inbox.
With "Confirm email" ON and custom SMTP configured, the email/OTP route proves
ownership for real. Describe the demo mode as *simulated delivery, real
verification logic*.

**The typed code is verified by Supabase, not by us.** `verifyOtp({ email,
 token, type })` needs no session, so it runs straight from the signed-out "check
your inbox" screen and returns the session in its response body. Both accepted
types (`email`, the one Supabase documents for this OTP, then `signup`) are
tried, because a wrong type is reported with the same "invalid" message as a
wrong code — a failure of the first cannot be mistaken for a failure of the
customer. If a code is confirmed but no session comes back, the page says so and
sends the customer to sign in rather than pretending they are logged in.

**Re-using an address is detected, not silently swallowed.** With “Confirm
email” ON, Supabase deliberately hides whether an address is already registered:
it answers with a placeholder user (empty `identities`) and sends no mail at all.
Left unchecked you would wait forever for a confirmation that never arrives — so
the app detects that shape and says *“An account with this email already exists”*
with a **Sign in instead** link. (Verified against the live project: the anon-key
sign-up probe returns `identities: []` with no session.)

**Existing accounts are grandfathered.** `verification-schema.sql` marks every
account that already exists as verified, and `data.js` does the same for the
seeded demo users, so `demo@dishdash.ng` and the other demo logins keep ordering
exactly as before. Admins are exempt from the gate. Verification is therefore
demonstrated on a **freshly registered** account.

**It fails safe if the SQL is not run.** The feature keys off whether the
`email_verified_at` column exists: absent means "not installed", and everyone is
left unblocked rather than locked out of a working app.

To enable it, run `supabase/verification-schema.sql` once (see
`SETUP-SUPABASE.md` → Step 5, which also covers the Gmail/SMTP route for real
emails).

## Bank-account verification (transfers)

The bank-transfer checkout asks the customer to confirm the account they are
paying **from**, the way a real transfer app does before it accepts a payment:

1. Pick the bank from the CBN/NIP list (`NG_BANKS` in `data.js` — 23 everyday
   banks and wallet providers with their real institution codes).
2. Type the 10-digit account number. The field shows a live `7/10 digits` count
   while typing and only turns red on blur, so a short number is never a
   mystery.
3. The number is validated and the account holder's name is resolved and shown
   as proof *before* "I've Made the Transfer" unlocks. That button starts
   disabled, and `confirmTransfer` re-checks the verified snapshot on click, so
   the gate cannot be side-stepped by re-rendering the panel.

The resolved snapshot — account, bank, holder name, how it was checked, and
when — is stored on the order and quoted in the admin's **Verify Payment**
dialog, so "verify" is a decision about something the admin can actually see.

**What is real and what is simulated.** The number format and the check digit
are the real public CBN NUBAN rule. Name resolution is **simulated by default**:
a deterministic resolver derives a stable name from the account digits, so the
same account always resolves to the same name on stage and the demo never
depends on venue internet. Real name-enquiry (NIBSS/Paystack-style) needs a
licensed provider — Paystack's free test keys only resolve its own fake
accounts, and live keys need a registered business. So `server.js` carries a
~40-line seam: export `PAYSTACK_SECRET_KEY` and `/api/resolve-account` proxies
to the provider; without it the endpoint answers `501` and the client uses the
demo resolver. The key never reaches the browser.

**The check digit is reported, not enforced.** It does not hold for every
account, and wallet providers (OPay/Kuda/Moniepoint) publish no prefix rule at
all, so hard-gating on it would reject legitimate numbers in front of an
audience. What *is* enforced is what is always true of a NUBAN: digits only,
exactly ten of them, and a real bank selected. A check-digit mismatch shows an
amber caution instead of a refusal. The UI labels every outcome honestly —
"passed the CBN NUBAN check-digit test", "check digit did not match", or
"mobile-money wallet — no public rule".

**In cloud mode** the snapshot lives in `orders.pay_account`; a project created
before this feature needs `supabase/pay-account-schema.sql` run once (Step 6 of
`SETUP-SUPABASE.md`). The app probes for that column at boot and drops the field
when it is absent rather than failing the order, so checkout can never break on
an un-run migration — the admin simply sees no account snapshot until it is run.

## Reports (admin)

`admin/reports.html` is the analytics deep-dive (the dashboard stays the
at-a-glance view). Every block recomputes from the same period filter —
All time / Last 7 days / Last 30 days / This month.

- **Revenue counts paid money only.** Card payments, admin-verified transfers,
  and collected COD cash count toward revenue; `awaiting_verification` and
  `pending` orders appear in order counts but not in the revenue number. The
  page states this on-screen so the headline figure is defensible in a Q&A.
- **Average order value is revenue ÷ *all* orders in the period** (paid or
  not) — the average size of an order the business actually takes. The 7- and
  30-day views also show a vs-previous-period delta; All time and This month
  have no comparable previous window, so no arrow is shown there.
- **The heatmap bins order times in Nigerian local time (`Africa/Lagos`),
  not UTC.** Orders are stored as ISO/UTC timestamps; binning them by server
  hour would silently shift every "peak" by an hour. `lagosParts()` in
  `reports.js` converts via `Intl.DateTimeFormat` with an explicit timezone —
  an order placed 23:30 UTC on a Wednesday lands in Thursday 00:30, correctly.
- **Export CSV** downloads the filtered orders (BOM-prefixed so Excel reads
  the ₦ sign; fields quoted per RFC 4180 when they contain commas or quotes).

The maths layer (`summarize`, `revenueByMethod`, `heatmap`, `lagosParts`,
`csvEscape` …) is pure and DOM-free, exposed read-only as `window.DD_REPORTS_TEST`
so it can be asserted without a browser.

## Homepage hero backdrop

The hero sits on three photographs (fine-dining scene, food spread, shared
table — Unsplash IDs verified live before shipping) that **crossfade every
6.5 s over 2.4 s**. The pieces, all in `index.html` + `style.css` section 9:

- `.hero-bg-slide` ×3 — full-bleed `background-image` divs, `opacity 0→1`;
  the rotation script lives in `home.js`.
- `.hero-bg-tint` — a left→right cream wash (94%→18% opacity) so the
  headline/search side stays fully readable while the photo breathes on the
  right, echoing the darkened-hero pattern of the reference sites but in
  DishDash's palette. Below 1020 px the text spans full width, so the tint
  switches to a stronger uniform top→bottom wash.
- `.hero-bg-fade` — the bottom 44% of the hero is a transparent→`--bg`
  gradient, so scrolling past the photo never meets a hard edge.

Layer order inside `.hero`: photo slides `z-0` → orange glows (`.hero::before`)
`z-1` → content (`.hero-inner`) `z-2`.

Guard rails in the `home.js` rotation: the timer is held at module level so
the foods-broadcast re-init can't stack intervals; ticks are skipped while
the tab is hidden; and the global `prefers-reduced-motion` rule already
flattens all transitions, so no motion runs for those users. If Unsplash is
unreachable the slides are transparent and the hero degrades to the original
cream look — the emoji fallbacks in the foreground collage are untouched.

### Cinematic variant (the same hero, shot at night)

A button in the bottom-left of the hero switches between the bright classic
look above and a **dark cinematic** one: the photo dims toward a deep warm
black, the headline flips to warm white, the search bar and proof chips turn
to glass, and the bottom fade grows to 58% so the dark band still melts into
the cream page instead of ending in a hard line. The crossfade also gains a
slow Ken Burns push (15 s, `heroKenBurns`) on whichever slide is showing.

- **It is a hero variant, not a theme.** Only `.hero` changes — no other page
  or component is touched, so nothing else in the site can regress.
- **Defaults:** the visitor's stored choice wins; with nothing stored it
  follows `prefers-color-scheme: dark`. So the hero matches the machine.
- **The toggle flips whatever is actually showing**, not the stored value —
  otherwise the first click on a dark-OS machine (where the visible state came
  from the OS, not from storage) would contradict its own label.
- Applied before first paint (`home.js` runs at the end of `<body>`, after the
  hero markup), so a dark-OS visitor never sees a cream flash.

## Dish management & images (admin)

The add/edit dish form (`admin/foods.js`) takes a real photo instead of a
stock-photo ID: **drag & drop or click to upload** (JPG/PNG/WebP/GIF up to
5 MB), or pick from the preset thumbnails, or paste/drag an image URL. The
file is **resized client-side** (max 900 px, JPEG quality 0.72 — a phone
photo lands around 15–40 KB) and stored as a data-URL in `foods.img`, which
is a plain text column in both local mode and Supabase — no storage bucket,
no schema change.

Everything on the site renders dish images through one function, `D.img()`
in `data.js`. It now **passes through** `data:` and full `http(s)` URLs and
only builds an Unsplash URL for a bare photo ID, so uploaded thumbnails flow
to the menu, dish page, home page, favourites, cart and admin tables with no
per-page changes.

Other pieces worth knowing:

- **Inline per-field errors** (name/price/description/image) replace the old
  single toast, and clear as the user fixes each field.
- **Local-mode quota guard:** `localStorage` fills up silently at ~5 MB;
  `write()` in `store.js` now reports "Storage is full" instead of pretending
  the photo saved. Cloud mode has no such limit.
- **Cloud add-id rule:** `foods.id` is a plain int primary key with no
  Postgres default, so the client picks `max(id)+1` (same rule as offline
  mode). A duplicate-id race (two admin consoles saving at once, `23505`)
  re-pulls the catalog and retries once — the same pattern `placeOrder` uses.
- **Live refresh:** customer pages (menu, dish detail, home, favourites) and
  the admin foods table re-render when the `foods` snapshot changes. Pages
  register listeners at `DOMContentLoaded`, which can fire *after* the cloud
  boot's first pull, so the cloud layer replays one broadcast after it
  settles — a fresh dish appears on an already-open menu tab without a
  manual reload.

## Phone numbers

One rule, defined once in `store.js` as `validatePhone` and used by every form
that collects a number — register, checkout, and both profile fields — so the
rule can never drift between pages:

- **Exactly 11 digits**, beginning `070`, `080`, `081`, `090` or `091`.
- Spaces, dashes, dots and brackets are ignored, so `0803 412 7788` and
  `(0803) 412-7788` both work.
- The international form is **accepted and normalised** — `+234 803 412 7788`
  becomes `08034127788`. This matters in practice: the seed and demo accounts
  store their numbers in `+234 …` form, so a stricter rule would have made the
  demo customer unable to check out. A missing leading zero (`8034127788`) is
  also accepted.
- Anything else — a landline or unassigned prefix (`020`, `030`, `060`), the
  wrong length, letters, or a stray extension — is rejected with an inline
  message that names the accepted prefixes.

The store normalises the number on the way in (`registerUser`, profile
updates, and the customer block of every order), so the canonical 11-digit
form is what actually lands in storage rather than whatever was typed.

## Feature status

| # | Feature | State |
|---|---------|-------|
| 1 | Fixed 11-digit Nigerian phone (070/080/081/090/091) | **Done** — one rule in `store.js`, enforced on all four entry points and on write |
| 2 | Email verification before ordering | **Done** — in-app code mode, plus real emailed 6-digit codes (Supabase `verifyOtp`, browser-independent) with the link still honoured; server-side rules; run `verification-schema.sql` once |
| 3 | Real bank-account number verification | **Done** — real NUBAN check-digit validation, 23-bank CBN/NIP list, resolved-name proof before the transfer can be submitted, admin sees the snapshot. Verified end-to-end in cloud mode (`pay-account-schema.sql` applied) |
| 4 | Customer reviews & feedback | **Done** (customer-facing); admin moderation screen not built |
| 5 | Reports system | **Done** — admin **Reports** page: period filter (7/30 days, month, all), revenue/orders/AOV/items cards with vs-previous deltas, revenue by payment method (paid money only), 7×24 peak-hours heatmap in Lagos time, CSV export |
| 6 | Works in any modern browser | In place by design — no browser-specific APIs; spot-checked, not exhaustively tested |
| 7 | Browsable homepage when signed out / after logout | Mostly done — one known papercut: the footer's Account column still shows "Sign in" while a session is active |
| — | Demo launcher & session hygiene | **Done** — isolated demo browser profiles, `?fresh=1` clean start, “Signed in as …” switch-account bar, role-aware landing, stale-session sweep |
| 8 | Improved dish-adding flow incl. images/thumbnails | **Done** — drag-drop/click upload with client-side resize to a web thumbnail, data-URL stored in `foods.img` (both modes), `D.img()` passthrough for any URL, inline per-field errors, local quota guard; add/edit/delete verified end-to-end in cloud mode |
| — | Homepage hero photo backdrop w/ crossfade + scroll fade | **Done** — 3 verified Unsplash photos crossfading 2.4s every 6.5s, cream tint for text contrast, bottom melt into page bg; reduced-motion safe; degrades to cream hero offline |
| — | Order cancellation (customer while pending, admin refuse) | **Done** — off-flow `cancelled` terminal status with a recorded reason + actor; customer button while pending, admin refuse at any point before delivery; cancelling releases any promo code the order had spent. Run `cancel-schema.sql` for cloud mode |
| — | One-time promo codes | **Done** — `DISHWELCOME` is one use per account and first-order-only; `FAST10` stays repeatable; cancel the order and the code comes back. Run `promo-schema.sql` for cross-device enforcement |
| — | Dark cinematic hero variant | **Done** — toggleable night-time treatment of the hero (glass chrome, Ken Burns crossfade, 58% melt), remembered per browser and following the OS dark-mode setting by default |
| — | Bulk admin actions (advance many orders at once) | Not started |
| — | Push-notification simulation on status change | Not started |
| — | Admin analytics: revenue by method, AOV, peak-hours heatmap | **Done** — all three shipped with the Reports page (item 5) |

## Order lifecycle

`Pending → Confirmed → Preparing → Out for Delivery → Delivered`

Administrators advance orders in the admin console; the customer’s tracking
page updates live — across tabs in local mode, and across browsers/devices in
cloud mode via Supabase realtime.

### Cancellation

`cancelled` is a **terminal, off-flow** state — deliberately *not* a member of
`DD_DATA.STATUS_FLOW`. The flow array is the happy path: the tracking timeline
renders one step per entry, the admin “Next ▸” action walks it, and
`nextStatus()` reads its length. Hanging `cancelled` off the end would make
“delivered → cancelled” a legal advance. Every lookup goes through
`D.statusMeta(key)` and every “is this still open?” question through
`UI.isTerminal(key)`, so one new terminal state can never be forgotten in a
single page.

- **A customer** may cancel while the order is still `pending` — nothing has
  been cooked and no rider is out, so it is still free to stop.
- **An admin** may cancel at any point before delivery (a refusal), and is
  asked for a reason.
- The **reason and the actor** are stored inside `statusHistory`
  (`{status:'cancelled', by:'customer'|'admin', reason}`). That column is
  already `jsonb` and already mapped both ways by `orderToDb`/`orderFromDb`, so
  cancellation needed **no schema change** and the reason survives the round
  trip through Postgres — verified live.
- The customer sees a red banner and a red timeline step explaining *why*,
  rather than their order silently disappearing. On the tracking timeline the
  steps the order actually reached stay ticked and the rest stay untouched.
- **A cancelled order is not a sale.** Both order lists, the dashboard revenue
  and order counts, the reports page and its peak-hours heatmap all exclude it.
  The dashboard surfaces the count separately so cancellations stay visible.
- Cancelling **releases any promo code** the order had spent (see below).

## Promo codes (one-time)

Codes live in `DD_DATA.PROMOS` with two flags: `once` (one redemption per
account) and `firstOrderOnly`. `DISHWELCOME` is ₦1,500 off, `once: true`,
`firstOrderOnly: true`; `FAST10` is 10% over ₦5,000 and repeatable on purpose,
so the difference is demonstrable side by side.

The rules are implemented **once**, in `DD_DATA.checkPromo(code, sub, isUsed,
hasOrders)` — messaging and money math together — and each store hands it the
predicates for its own backend. That way a code can never behave differently
online and offline.

- **Redemption is recorded, not inferred.** A code is spent when the order is
  actually placed — not when it is typed into the field — and cancelling the
  order that spent it deletes the record, so nobody burns a welcome code on an
  order that never happened.
- **Cloud mode** stores the durable record in `promo_redemptions` (unique on
  `user_id, code` — the constraint *is* the rule), so a code spent on a phone is
  spent on the laptop. **Local mode** keeps the same record in localStorage.
  Both are always written, keyed to the real account id via `setPromoOwner`, so
  two accounts sharing one browser never contaminate each other (which matters
  in the demo, where they do).
- The checkout hint is honest: a code this account has already spent is shown
  struck through with “already used on this account”.

## Security notes (demo)

- Payments are **simulated** — no real card data is collected or stored.

**In cloud mode** (a project URL + anon key are present in
`supabase-config.js`), authentication goes through Supabase Auth, so the anon
key sitting in the file is expected, not a leak: it is a public client
identifier and is useless on its own. What actually protects the data is
row-level security — `schema.sql` and `reviews-schema.sql` enable RLS on every
table, grant customers access only to their own rows, and gate all writes to
the catalog and other users' orders behind the `is_admin()` check. Do not
commit a **service-role** key: that one bypasses RLS entirely.

Role escalation is guarded in the database, not the UI —
`protect_role_change()` rejects any `profiles.role` mutation that is not
performed by an existing admin. The single exception is bootstrap: while no
admin exists yet, one user may claim the role, which is what makes the
one-click demo setup work (see `SETUP-SUPABASE.md`).

**In local mode** (the zero-setup fallback with no key configured) everything
lives in browser localStorage: no server, no network calls, and passwords are
stored in plaintext so the demo works offline. That is fine for a prototype on
your own machine and is not safe to expose publicly as-is.
