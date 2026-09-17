/* ============================================================
   DISHDASH — Store (application state + persistence)
   ------------------------------------------------------------
   Single module that owns localStorage persistence. The UI layer
   never touches storage directly. Swapping this for Supabase
   later only changes this file.
   ============================================================ */
'use strict';

window.DD_STORE = (function () {
  const D = window.DD_DATA;
  const P = 'dishdash_'; // storage prefix

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(P + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try { localStorage.setItem(P + key, JSON.stringify(value)); return true; }
    catch (e) {
      // Item 8: a failed write must not look like success — logged so a
      // silent no-save (e.g. a big photo overflowing the quota in offline
      // mode) can be diagnosed instead of mysteriously vanishing.
      console.error('[store] write failed for "' + key + '" (storage full or blocked):', e);
      return false;
    }
  }
  function remove(key) { localStorage.removeItem(P + key); }

  /* ---------------- Nigerian mobile numbers ----------------
     One rule for the whole app: a Nigerian mobile number is exactly 11
     digits beginning 070, 080, 081, 090 or 091. Customers habitually type
     the international form (+234 803 …) or drop the leading zero, so we
     accept those on input and normalise to local 11-digit form before
     anything is stored. Keeping this here — rather than in each page — means
     the register form, checkout, profile and the store's own writes can
     never drift apart.                                             */
  const NG_PHONE_PREFIXES = ['070', '080', '081', '090', '091'];
  const NG_PHONE_EXAMPLE = '0803 123 4567';
  // What a typed Nigerian number may contain: digits, the separators people
  // actually use, and an optional leading country-code plus. Anything else
  // means it isn't a phone number — we must not strip letters away and then
  // declare the leftovers valid ('0803 412 7788x' is a typo, not a number).
  const NG_PHONE_ALLOWED = /^\+?[\d\s().-]+$/;

  function normalizePhone(input) {
    let s = String(input == null ? '' : input).trim();
    if (!s || !NG_PHONE_ALLOWED.test(s)) return '';
    const intl = s.charAt(0) === '+';
    s = s.replace(/\D/g, '');           // drop spaces, dashes, brackets, dots
    if (!s) return '';
    // 234XXXXXXXXXX, with or without the plus -> strip the country code
    if (s.indexOf('234') === 0 && (intl || s.length === 13)) s = s.slice(3);
    // 8034127788 -> 08034127788 (leading zero omitted)
    if (s.length === 10 && s.charAt(0) !== '0') s = '0' + s;
    return s;
  }

  function isNgMobile(value) {
    return /^\d{11}$/.test(value) && NG_PHONE_PREFIXES.indexOf(value.slice(0, 3)) !== -1;
  }

  /* opts.required — a missing number is itself an error.
     Returns the normalised value on success so callers store exactly the
     form the app expects rather than whatever was typed.               */
  function validatePhone(input, opts) {
    const required = !!(opts && opts.required);
    const raw = String(input == null ? '' : input).trim();
    if (!raw) {
      return required
        ? { ok: false, value: '', error: 'Enter a phone number so the rider can reach you.' }
        : { ok: true, value: '', error: '' };
    }
    const value = normalizePhone(raw);
    if (!isNgMobile(value)) {
      return { ok: false, value: value, error: 'Enter an 11-digit Nigerian number starting with 070, 080, 081, 090 or 091 — e.g. ' + NG_PHONE_EXAMPLE + '.' };
    }
    return { ok: true, value: value, error: '' };
  }

  /* Best-effort canonical form for a stored number. Valid input becomes the
     11-digit local form; anything else is kept as typed rather than dropped,
     so an order never loses the only contact detail the customer gave. */
  function canonicalPhone(input) {
    const raw = String(input == null ? '' : input).trim();
    const check = validatePhone(raw, { required: false });
    return check.ok ? check.value : raw;
  }

  /* ---------------- users & session ---------------- */
  function users() {
    let list = read('users', null);
    if (!list) { write('users', D.SEED_USERS); list = D.SEED_USERS; }
    return list;
  }
  function saveUsers(list) { write('users', list); }

  function findByEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    return users().find(function (u) { return u.email.toLowerCase() === e; });
  }

  function registerUser(data) {
    // data: {name,email,phone,password}
    // `existing` lets the register page offer a link to the sign-in form instead
    // of leaving the customer on a page that will keep refusing them.
    if (findByEmail(data.email)) return { ok: false, existing: true, error: 'An account with this email already exists.' };
    const phone = validatePhone(data.phone, { required: false });
    if (!phone.ok) return { ok: false, error: phone.error };
    const list = users();
    const user = {
      id: 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: phone.value,
      password: data.password,
      role: 'customer',
      createdAt: new Date().toISOString(),
      // New accounts start unverified — the flag's presence is also what tells
      // the app the verification feature is live for this account.
      emailVerifiedAt: null,
      delivery: {
        name: data.name.trim(),
        phone: phone.value,
        address: (data.address || '').trim(),
        city: (data.city || '').trim(),
        note: (data.note || '').trim()
      }
    };
    list.push(user);
    saveUsers(list);
    setSession(user);
    return { ok: true, user: user };
  }

  function login(email, password) {
    const user = findByEmail(email);
    if (!user) return { ok: false, error: 'No account found for that email address.' };
    if (user.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' };
    setSession(user);
    return { ok: true, user: user };
  }

  function setSession(user) {
    write('session', { id: user.id, name: user.name, email: user.email, role: user.role });
  }
  function currentUser() {
    const s = read('session', null);
    if (!s) return null;
    // keep user object fresh (e.g. profile edits)
    const found = users().find(function (u) { return u.id === s.id; });
    return found || s;
  }
  function logout() { remove('session'); }
  function requireCustomer() {
    const u = currentUser();
    return u && u.role !== 'admin' ? u : null;
  }
  function requireAdmin() {
    const u = currentUser();
    return u && u.role === 'admin' ? u : null;
  }
  function updateUser(id, patch) {
    const list = users();
    const i = list.findIndex(function (u) { return u.id === id; });
    if (i < 0) return null;
    // Store the canonical 11-digit form, never raw input. An invalid number
    // is dropped from the patch rather than persisted, so a bad value can't
    // overwrite a good one (the forms validate first — this is the backstop).
    const next = Object.assign({}, patch);
    if (next.phone !== undefined) {
      const p = validatePhone(next.phone, { required: false });
      if (p.ok) next.phone = p.value; else delete next.phone;
    }
    if (next.delivery && next.delivery.phone !== undefined) {
      const p = validatePhone(next.delivery.phone, { required: false });
      next.delivery = Object.assign({}, next.delivery);
      if (p.ok) next.delivery.phone = p.value; else delete next.delivery.phone;
    }
    list[i] = Object.assign({}, list[i], next);
    saveUsers(list);
    if (currentUser() && currentUser().id === id) setSession(list[i]);
    return list[i];
  }

  /* ---------------- cart ---------------- */
  function getCartRaw() { return read('cart', []); }          // [{dishId, qty}]
  function saveCart(list) { write('cart', list); }
  function cartLines() {
    // merge stored quantities with live food data; line identity = dish + note
    return getCartRaw()
      .map(function (c) {
        const f = foods().find(function (x) { return x.id === Number(c.dishId); });
        return f ? { dish: f, qty: c.qty, note: normNote(c.note) } : null;
      })
      .filter(Boolean);
  }
  function normNote(n) {
    return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  function cartCount() { return cartLines().reduce(function (n, l) { return n + l.qty; }, 0); }
  function addToCart(dishId, qty, note) {
    const n = normNote(note);
    const list = getCartRaw();
    const hit = list.find(function (c) { return c.dishId === Number(dishId) && normNote(c.note) === n; });
    if (hit) hit.qty = Math.min(20, hit.qty + (qty || 1));
    else list.push({ dishId: Number(dishId), qty: qty || 1, note: n });
    saveCart(list);
    broadcast('cart');
  }
  function setCartQty(dishId, qty, note) {
    const n = normNote(note);
    let list = getCartRaw();
    if (qty <= 0) list = list.filter(function (c) { return !(c.dishId === Number(dishId) && normNote(c.note) === n); });
    else {
      const hit = list.find(function (c) { return c.dishId === Number(dishId) && normNote(c.note) === n; });
      if (hit) hit.qty = Math.min(20, qty);
    }
    saveCart(list);
    broadcast('cart');
  }
  function updateCartNote(dishId, oldNote, newNote) {
    const was = normNote(oldNote), now = normNote(newNote);
    const list = getCartRaw();
    const line = list.find(function (c) { return c.dishId === Number(dishId) && normNote(c.note) === was; });
    if (!line) return;
    // merging into an existing line of the same dish + note combines quantities
    const clash = list.find(function (c) { return c !== line && c.dishId === line.dishId && normNote(c.note) === now; });
    if (clash) {
      clash.qty = Math.min(20, clash.qty + line.qty);
      list.splice(list.indexOf(line), 1);
    } else {
      line.note = now;
    }
    saveCart(list);
    broadcast('cart');
  }
  function removeFromCart(dishId, note) {
    const n = normNote(note);
    saveCart(getCartRaw().filter(function (c) { return !(c.dishId === Number(dishId) && normNote(c.note) === n); }));
    broadcast('cart');
  }
  function clearCart() { saveCart([]); broadcast('cart'); }

  function cartSummary() {
    const lines = cartLines();
    const sub = lines.reduce(function (s, l) { return s + l.dish.price * l.qty; }, 0);
    const fee = sub >= D.CONFIG.freeDeliveryMin || sub === 0 ? 0 : D.CONFIG.deliveryFee;
    return {
      lines: lines, count: cartCount(), sub: sub,
      deliveryFee: fee, total: sub + fee,
      freeDeliveryMin: D.CONFIG.freeDeliveryMin,
      toFree: Math.max(0, D.CONFIG.freeDeliveryMin - sub)
    };
  }

  /* ---------------- favorites ---------------- */
  function favKey() {
    const u = currentUser();
    return u ? 'favs_' + u.id : 'favs_anon';
  }
  function getFavs() {
    const ids = read(favKey(), []);
    const catalog = foods();
    return ids.map(function (id) {
      return catalog.find(function (f) { return f.id === id; });
    }).filter(Boolean);
  }
  function isFav(dishId) { return getFavs().some(function (f) { return f.id === Number(dishId); }); }
  function toggleFav(dishId) {
    const key = favKey();
    let ids = read(key, []);
    const n = Number(dishId);
    if (ids.indexOf(n) !== -1) ids = ids.filter(function (x) { return x !== n; });
    else ids.unshift(n);
    write(key, ids);
    broadcast('favs');
    return isFav(n);
  }

  /* ---------------- orders ---------------- */
  function orders() {
    let list = read('orders', null);
    if (!list) { write('orders', D.SEED_ORDERS); list = D.SEED_ORDERS; }
    // auto-complete: app-placed orders whose ETA has passed flip to delivered.
    // Seeded demo history (source 'seed') is exempt so the demo pipeline stays intact.
    let changed = false;
    const now = Date.now();
    list.forEach(function (o) {
      if (o.source !== 'app' || o.status === 'delivered') return;
      const etaAt = Date.parse(o.placedAt) + (o.etaMin || D.CONFIG.avgDeliveryMin) * 60000;
      if (now >= etaAt) {
        o.status = 'delivered';
        o.statusHistory.push({ status: 'delivered', at: new Date(etaAt).toISOString() });
        changed = true;
      }
    });
    if (changed) saveOrders(list);
    return list;
  }
  function saveOrders(list) { write('orders', list); }

  /* ---------------- reviews (local mode) ---------------- */
  function reviews() { return read('reviews', D.SEED_REVIEWS || []); }
  function saveReviews(list) { write('reviews', list); }
  function foodReviews(foodId) {
    const list = reviews().filter(function (r) { return Number(r.foodId) === Number(foodId); });
    return list.sort(function (a, b) { return Date.parse(b.createdAt) - Date.parse(a.createdAt); });
  }
  function ratingSummary(foodId) {
    const list = reviews().filter(function (r) { return Number(r.foodId) === Number(foodId); });
    if (!list.length) return null;
    const avg = list.reduce(function (s, r) { return s + Number(r.rating); }, 0) / list.length;
    return { avg: Math.round(avg * 10) / 10, count: list.length };
  }
  function allRatingSummaries() {
    const map = {};
    reviews().forEach(function (r) {
      const k = Number(r.foodId);
      if (!map[k]) map[k] = { sum: 0, count: 0 };
      map[k].sum += Number(r.rating); map[k].count++;
    });
    const out = {};
    Object.keys(map).forEach(function (k) {
      out[k] = { avg: Math.round(map[k].sum / map[k].count * 10) / 10, count: map[k].count };
    });
    return out;
  }
  function isVerifiedBuyer(foodId) {
    const u = currentUser();
    if (!u) return false;
    // In cloud mode this is enforced server-side by RLS; locally we check
    // DELIVERED orders containing this dish. Order items store the dish on
    // it.dishId (cloud mapper normalises to foodId — cover both).
    return window.DD_STORE.orders().some(function (o) {
      return o.status === 'delivered' && (o.userId === u.id || String(o.userId) === String(u.id))
        && (o.items || []).some(function (it) {
          return Number(it.foodId || it.dishId || (it.dish && it.dish.id)) === Number(foodId);
        });
    });
  }
  function addReview(foodId, rating, title, body) {
    const u = currentUser();
    if (!u) return { ok: false, error: 'Sign in to write a review.' };
    const list = reviews();
    const existing = list.find(function (r) { return Number(r.foodId) === Number(foodId) && r.userId === u.id; });
    if (existing) return { ok: false, error: 'You already reviewed this dish.' };
    list.unshift({
      id: 'r-' + Date.now().toString(36), foodId: Number(foodId), userId: u.id,
      userName: u.name, rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      title: String(title || '').trim().slice(0, 80), body: String(body || '').trim().slice(0, 600),
      verified: isVerifiedBuyer(foodId), createdAt: new Date().toISOString()
    });
    saveReviews(list);
    broadcast('reviews');
    return { ok: true };
  }
  function updateReview(reviewId, rating, title, body) {
    const u = currentUser();
    if (!u) return { ok: false, error: 'Sign in to edit your review.' };
    const list = reviews();
    const i = list.findIndex(function (r) { return String(r.id) === String(reviewId); });
    if (i === -1) return { ok: false, error: 'That review no longer exists.' };
    if (String(list[i].userId) !== String(u.id)) return { ok: false, error: 'You can only edit your own review.' };
    list[i] = Object.assign({}, list[i], {
      rating: Math.min(5, Math.max(1, Number(rating) || list[i].rating)),
      title: String(title || '').trim().slice(0, 80),
      body: String(body || '').trim().slice(0, 600),
      editedAt: new Date().toISOString()
    });
    saveReviews(list);
    broadcast('reviews');
    return { ok: true, review: list[i] };
  }
  function deleteReview(reviewId) {
    const u = currentUser();
    if (!u) return { ok: false, error: 'Sign in to delete your review.' };
    const list = reviews();
    const i = list.findIndex(function (r) { return String(r.id) === String(reviewId); });
    if (i === -1) return { ok: false, error: 'That review no longer exists.' };
    if (String(list[i].userId) !== String(u.id)) return { ok: false, error: 'You can only delete your own review.' };
    list.splice(i, 1);
    saveReviews(list);
    broadcast('reviews');
    return { ok: true };
  }
  function feedbackSubmit(data) {
    const u = currentUser();
    const list = read('feedback', []);
    list.unshift({
      id: 'fb-' + Date.now().toString(36), userId: u ? u.id : null,
      name: (data.name || (u ? u.name : '')).trim(), email: (data.email || (u ? u.email : '')).trim(),
      rating: data.rating ? Math.min(5, Math.max(1, Number(data.rating))) : null,
      message: String(data.message || '').trim().slice(0, 1000),
      createdAt: new Date().toISOString()
    });
    write('feedback', list);
    return { ok: true };
  }

  /* ---------------- NUBAN account verification (item 3) ----------------
     Nigerian bank-account validation for the transfer flow. A NUBAN is a
     10-digit number: 3-digit bank code + 6-digit account serial + 1 check
     digit. Enforced here: digits only, exactly ten digits, and a real bank.
     Computed and REPORTED (not enforced): the CBN check digit — see
     nubanCheckDigit for why it warns instead of blocks.
     Name resolution is seam-based: a real provider via the server proxy if
     PAYSTACK_SECRET_KEY is exported, otherwise a deterministic demo
     resolver so the demo never depends on venue internet. */

  function nubanPrefixFor(bankCode) {
    const code = String(bankCode || '').trim();
    if (!/^\d{3}$/.test(code)) return null;   // only 3-digit NIP codes map to prefixes
    return code;                                  // 3-digit NIP code IS the prefix
  }

  /* The CBN NUBAN check digit, per the published rule: the 3-digit bank code
     followed by the first 9 digits of the account, weighted by the repeating
     series [3,7,3,3,7,3,3,7,3,3,7,3]; expected 10th digit is
     (10 - sum mod 10) mod 10.

     The result is REPORTED, not enforced. The public rule does not hold for
     every account, and wallet accounts (OPay/Kuda/Moniepoint) publish no
     prefix rule at all — hard-gating on it would reject legitimate numbers in
     front of an audience, which is worse than a cautious warning. What IS
     enforced are the things always true of a NUBAN: digits only, exactly ten
     digits, and a real bank selected. */
  function nubanCheckDigit(bankCode, digits) {
    const serial = String(bankCode) + String(digits).slice(0, 9);
    const weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(serial[i]) * weights[i];
    return (10 - (sum % 10)) % 10;
  }

  /* Returns { ok, error } on a hard failure, else { ok: true, checkDigit }
     where checkDigit is 'match' | 'mismatch' | 'n/a' (wallet provider). */
  function validateNuban(account, bankCode) {
    const digits = String(account || '').replace(/[\s-]/g, '');
    if (!/^\d+$/.test(digits)) return { ok: false, error: 'Account numbers contain digits only.' };
    if (digits.length !== 10) return { ok: false, error: 'A Nigerian account number is exactly 10 digits.' };
    const bank = D.NG_BANKS.find(function (b) { return b.code === String(bankCode).trim(); });
    if (!bank) return { ok: false, error: 'Choose the bank the account belongs to.' };
    const prefix = nubanPrefixFor(bankCode);
    if (!prefix) return { ok: true, checkDigit: 'n/a' };   // wallet providers: no public prefix rule
    const expected = nubanCheckDigit(prefix, digits);
    return { ok: true, checkDigit: expected === Number(digits[9]) ? 'match' : 'mismatch', expected: expected };
  }

  function demoAccountName(account, bankCode) {
    // Deterministic: same account+bank always resolves to the same name,
    // so the demo is repeatable on stage. Seeded hash picks first/last
    // names; the account's own digits shape the middle initial.
    const FIRST = ['Adaeze', 'Chinedu', 'Funmilayo', 'Ibrahim', 'Ngozi', 'Tunde', 'Aisha', 'Emeka', 'Halima', 'Yusuf', 'Bisi', 'Obinna'];
    const LAST = ['Okafor', 'Balogun', 'Eze', 'Abubakar', 'Adeyemi', 'Okonkwo', 'Lawal', 'Nwachukwu', 'Danjuma', 'Alabi'];
    const bank = D.NG_BANKS.find(function (b) { return b.code === String(bankCode).trim(); });
    let h = 0;
    const key = String(account) + '|' + String(bankCode);
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const name = FIRST[h % FIRST.length] + ' ' + String(account)[4] + '. ' + LAST[(h >> 3) % LAST.length];
    return (bank ? bank.name : 'Bank') + '::' + name; // internal marker format
  }

  async function resolveBankAccount(account, bankCode) {
    const v = validateNuban(account, bankCode);
    if (!v.ok) return { ok: false, error: v.error || 'Invalid account details.' };
    const bank = D.NG_BANKS.find(function (b) { return b.code === String(bankCode).trim(); });
    const digits = String(account).replace(/[^\d]/g, '');
    // 1) server-side provider seam
    try {
      const r = await fetch('/api/resolve-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_number: digits, bank_code: bank.code })
      });
      if (r.ok) {
        const j = await r.json().catch(function () { return null; });
        const name = j && j.data && (j.data.account_name || j.data.accountName);
        if (name) return { ok: true, accountName: name, bank: bank.name, source: 'provider' };
      }
      // 404 (static server without the seam) and 501 (no key) both fall through
    } catch (e) { /* file:// or offline — demo resolver still works */ }
    // 2) deterministic demo resolver
    const parts = demoAccountName(digits, bank.code).split('::');
    return { ok: true, accountName: parts[1], bank: bank.name, source: 'demo' };
  }

  /* ---------------- email verification (local mode) ----------------
     Mirrors the rules in supabase/verification-schema.sql so the demo behaves
     identically with or without Supabase: 10-minute expiry, five wrong
     attempts, single use, 60-second resend cooldown. In local mode there is
     no mail provider at all, so the code is surfaced to the page — that is
     the "simulated delivery" the README describes.                     */
  const VCODE_TTL = 600;            // seconds a code stays valid
  const VCODE_MAX_ATTEMPTS = 5;     // wrong guesses before it is burned
  const VCODE_COOLDOWN = 60;        // seconds between requests

  /* The flag column only exists once verification-schema.sql has been run
     (cloud) or for accounts created after this feature shipped (local).
     Whether it is present is how we tell "not verified" apart from "feature
     not installed" — an un-run migration must never lock people out. */
  function verificationInstalled(user) {
    return !!user && Object.prototype.hasOwnProperty.call(user, 'emailVerifiedAt');
  }

  function emailVerified(user) {
    // window.DD_STORE, not the local currentUser, so the cloud adapter's
    // overrides are respected in cloud mode.
    const u = user || window.DD_STORE.currentUser();
    if (!u) return false;
    if (u.role === 'admin') return true;   // admins never place orders
    /* u.emailConfirmed is Supabase's own confirmation stamp — but with
       "Confirm email" OFF it is true for EVERY account, auto-confirmed at
       sign-up, so trusting it here would make the in-app code flow dead on
       arrival in cloud mode. It is only authoritative in email-link mode,
       which is exactly what the mode flag tracks. */
    if (u.emailConfirmed && verificationMode() === 'link') return true;
    if (!verificationInstalled(u)) return true;
    return !!u.emailVerifiedAt;
  }

  function requestEmailCode() {
    const u = currentUser();
    if (!u) return { ok: false, error: 'Sign in to verify your email.' };
    const prev = read('vcode', null);
    if (prev && prev.userId === u.id && prev.createdAt) {
      const age = (Date.now() - Date.parse(prev.createdAt)) / 1000;
      if (age < VCODE_COOLDOWN) {
        return {
          ok: false,
          error: 'Please wait a moment before requesting another code.',
          retryAfter: Math.ceil(VCODE_COOLDOWN - age)
        };
      }
    }
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    write('vcode', {
      userId: u.id, code: code, attempts: 0, consumed: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + VCODE_TTL * 1000).toISOString()
    });
    return { ok: true, code: code, expiresIn: VCODE_TTL, cooldown: VCODE_COOLDOWN };
  }

  function confirmEmailCode(input) {
    const u = currentUser();
    if (!u) return { ok: false, error: 'Sign in to verify your email.' };
    const code = String(input == null ? '' : input).trim();
    if (!code) return { ok: false, error: 'Enter the 6-digit code.' };

    const rec = read('vcode', null);
    if (!rec || rec.userId !== u.id || rec.consumed) {
      return { ok: false, error: 'No active code — request a new one.' };
    }
    if (Date.parse(rec.expiresAt) <= Date.now()) {
      write('vcode', Object.assign({}, rec, { consumed: true }));
      return { ok: false, error: 'That code has expired. Request a new one.' };
    }
    if (rec.attempts >= VCODE_MAX_ATTEMPTS) {
      write('vcode', Object.assign({}, rec, { consumed: true }));
      return { ok: false, error: 'Too many incorrect attempts. Request a new code.' };
    }
    if (rec.code !== code) {
      const attempts = rec.attempts + 1;
      write('vcode', Object.assign({}, rec, { attempts: attempts }));
      return {
        ok: false,
        error: 'That code is not correct.',
        attemptsLeft: Math.max(0, VCODE_MAX_ATTEMPTS - attempts)
      };
    }

    write('vcode', Object.assign({}, rec, { consumed: true }));
    const list = users();
    const i = list.findIndex(function (x) { return x.id === u.id; });
    if (i >= 0) {
      list[i] = Object.assign({}, list[i], { emailVerifiedAt: new Date().toISOString() });
      saveUsers(list);
      setSession(list[i]);
      broadcast('auth');
    }
    return { ok: true };
  }

  /* The code the demo panel should be showing right now, if one is still
     live. Reloading the page asks for a new code, and the server's resend
     cooldown legitimately refuses for up to a minute — without this the panel
     would sit blank and a presenter would have nothing to type. */
  function lastDemoCode() {
    const u = currentUser();
    const rec = read('vcode', null);
    if (!u || !rec || rec.userId !== u.id || rec.consumed) return null;
    if (Date.parse(rec.expiresAt) <= Date.now()) return null;
    return { code: rec.code, expiresAt: rec.expiresAt };
  }

  /* Local mode has no mail provider, so the in-app code path is always what
     applies. Cloud mode detects the real thing in DD_STORE_SYNC. */
  function verificationMode() { return 'code'; }
  function markEmailVerified() {
    return { ok: false, error: 'Email links are only available in cloud mode.' };
  }
  function resendConfirmationEmail() {
    return { ok: false, error: 'Confirmation emails need Supabase (cloud mode) — in local mode use the in-app code.' };
  }
  /* Typed email codes are a real-mail feature too. */
  function confirmSignupOtp() {
    return { ok: false, error: 'The email code needs Supabase (cloud mode) — in local mode use the in-app code.' };
  }

  /* ---------------- promo codes ---------------- */
  function validatePromo(code, sub) {
    const key = String(code || '').trim().toUpperCase();
    if (!key) return { ok: false, error: 'Enter a promo code to apply it.' };
    const promo = D.PROMOS[key];
    if (!promo) return { ok: false, error: 'That promo code isn\'t valid. Double-check and try again.' };
    if (promo.minSub && sub < promo.minSub) {
      return { ok: false, error: 'This code needs an order of at least ' + D.naira(promo.minSub) + ' before it applies.' };
    }
    const discount = Math.round(promo.type === 'percent' ? sub * promo.value / 100 : Math.min(promo.value, sub));
    return { ok: true, code: key, promo: promo, discount: discount };
  }
  function sortOrders(list) {
    return list.slice().sort(function (a, b) { return Date.parse(b.placedAt) - Date.parse(a.placedAt); });
  }
  // NOTE: these read through the PUBLIC window.DD_STORE.orders() so the cloud
  // adapter can swap the data source — calling the closure-local orders()
  // would bypass it. Safe because these only run after the IIFE assigns it.
  function getOrder(id) {
    return window.DD_STORE.orders().find(function (o) { return o.id.toLowerCase() === String(id).toLowerCase(); }) || null;
  }
  function myOrders() {
    const u = currentUser();
    if (!u) return [];
    return sortOrders(window.DD_STORE.orders().filter(function (o) {
      return (o.userId === u.id) || (String(o.userId) === String(u.id));
    }));
  }

  function placeOrder(opts) {
    // opts: { delivery:{...}, pay, payStatus, payRef, lines, promo }  promo: {code, discount}
    const u = currentUser();
    const lines = opts.lines && opts.lines.length ? opts.lines : cartLines();
    const sub = lines.reduce(function (s, l) { return s + l.dish.price * l.qty; }, 0);
    const fee = sub >= D.CONFIG.freeDeliveryMin ? 0 : D.CONFIG.deliveryFee;
    const promo = opts.promo || null;
    const discount = promo ? Math.min(Math.max(0, Number(promo.discount) || 0), sub + fee) : 0;
    const now = new Date();
    const seq = read('orderSeq', 1009) + 1;
    write('orderSeq', seq);
    const order = {
      id: 'DD-' + seq,
      userId: u ? u.id : null,
      customer: {
        name: opts.delivery.name.trim(),
        phone: canonicalPhone(opts.delivery.phone),
        address: opts.delivery.address.trim(),
        city: opts.delivery.city.trim(),
        note: (opts.delivery.note || '').trim()
      },
      items: lines.map(function (l) {
        return { dishId: l.dish.id, name: l.dish.name, price: l.dish.price, qty: l.qty, img: l.dish.img, note: l.note || '' };
      }),
      sub: sub,
      deliveryFee: fee,
      discount: discount,
      promoCode: promo ? promo.code : null,
      total: sub + fee - discount,
      pay: opts.pay,                          // card | cod | bank_transfer
      payStatus: opts.payStatus || 'pending', // paid | pending | awaiting_verification
      payRef: opts.payRef || null,            // transfer reference (bank transfer only)
      payAccount: opts.payAccount || null,    // { account, bankCode, bank, accountName, source, at } (bank transfer)
      status: 'pending',
      statusHistory: [{ status: 'pending', at: now.toISOString() }],
      placedAt: now.toISOString(),
      etaMin: D.CONFIG.avgDeliveryMin,
      source: 'app'
    };
    const list = orders();
    list.push(order);
    saveOrders(list);
    clearCart();
    // remember delivery details for next checkout
    if (u) updateUser(u.id, { delivery: order.customer });
    broadcast('orders');
    return order;
  }

  // legacy orders (pre payment-upgrade) have no payStatus field — normalize
  // exactly like UI.payStatusOf so admin actions behave identically on them.
  function normPayStatus(o) {
    if (o.payStatus) return o.payStatus;
    if (o.pay === 'card') return 'paid';
    if (o.pay === 'bank_transfer' || o.pay === 'transfer') return 'awaiting_verification';
    return 'pending';
  }

  // admin-only: simulated bank-transfer verification. Flips the PAYMENT status
  // to 'paid' — deliberately does NOT touch order status or history.
  function verifyTransfer(orderId) {
    const list = orders();
    const o = list.find(function (x) { return x.id === orderId; });
    if (!o) return { ok: false, error: 'Order not found.' };
    if (o.pay !== 'bank_transfer' && o.pay !== 'transfer') return { ok: false, error: 'Only bank-transfer orders can be verified.' };
    if (normPayStatus(o) !== 'awaiting_verification') return { ok: false, error: 'This transfer is not awaiting verification.' };
    o.payStatus = 'paid';
    o.verifiedAt = new Date().toISOString();
    saveOrders(list);
    broadcast('orders');
    return { ok: true, order: o };
  }

  // admin-only: record cash collected for a COD order. Flips the PAYMENT status
  // to 'paid' — deliberately does NOT touch order status or history.
  function confirmPayment(orderId) {
    const list = orders();
    const o = list.find(function (x) { return x.id === orderId; });
    if (!o) return { ok: false, error: 'Order not found.' };
    if (o.pay !== 'cod') return { ok: false, error: 'Only cash-on-delivery orders need payment confirmation.' };
    if (normPayStatus(o) !== 'pending') return { ok: false, error: 'This payment is not pending.' };
    o.payStatus = 'paid';
    o.paidAt = new Date().toISOString();
    saveOrders(list);
    broadcast('orders');
    return { ok: true, order: o };
  }

  function statusIndex(order) {
    return D.STATUS_FLOW.findIndex(function (s) { return s.key === (order ? order.status : ''); });
  }
  function nextStatus(order) {
    const i = statusIndex(order);
    return i >= 0 && i < D.STATUS_FLOW.length - 1 ? D.STATUS_FLOW[i + 1].key : null;
  }
  function updateOrderStatus(orderId, statusKey) {
    const list = orders();
    const o = list.find(function (x) { return x.id === orderId; });
    if (!o) return null;
    if (o.status === 'delivered') return o;
    o.status = statusKey;
    o.statusHistory.push({ status: statusKey, at: new Date().toISOString() });
    saveOrders(list);
    broadcast('orders');
    return o;
  }

  /* ---------------- admin catalog CRUD ---------------- */
  // foodOverrides map:  { <id>: <food> }   (edits to base dishes + brand-new dishes whose id is > max base id)
  // foodDeleted array:  [ <baseId>, ... ]  (tombstones for removed base dishes)
  const BASE_MAX = Math.max.apply(null, D.FOODS.map(function (f) { return f.id; }));
  function isBaseFood(id) { return Number(id) <= BASE_MAX; }
  function isCustomFood(id) { return !D.FOODS.some(function (f) { return f.id === Number(id); }); }

  function foods() {
    const overrides = read('foodOverrides', null) || {};
    const deleted = read('foodDeleted', null) || [];
    const base = D.FOODS.filter(function (f) { return deleted.indexOf(f.id) === -1; })
      .map(function (f) { return overrides[f.id] || f; });
    const custom = Object.keys(overrides)
      .filter(function (id) { return isCustomFood(id); })
      .map(function (id) { return overrides[id]; });
    return base.concat(custom);
  }
  function saveFoodOverride(f) { // f is a full food object (edits existing)
    const overrides = read('foodOverrides', null) || {};
    overrides[Number(f.id)] = f;
    write('foodOverrides', overrides);
    const del = (read('foodDeleted', null) || []).filter(function (id) { return id !== Number(f.id); });
    write('foodDeleted', del);
    broadcast('foods');
  }
  function addFood(data) {
    const overrides = read('foodOverrides', null) || {};
    const used = Object.keys(overrides).map(Number).concat(D.FOODS.map(function (f) { return f.id; }));
    const id = Math.max.apply(null, used) + 1;
    const f = {
      id: id,
      cat: data.cat, name: data.name, price: Number(data.price),
      oldPrice: data.oldPrice ? Number(data.oldPrice) : null,
      rating: 4.5, reviews: 0, prep: Number(data.prep || 20),
      tag: data.tag || null, popular: !!data.popular, inStock: !!data.inStock,
      img: data.img,
      desc: data.desc
    };
    overrides[id] = f;
    write('foodOverrides', overrides);
    broadcast('foods');
    return f;
  }
  function deleteFoodOverride(id) {
    const n = Number(id);
    const overrides = read('foodOverrides', null) || {};
    if (overrides[n] !== undefined) delete overrides[n];
    write('foodOverrides', overrides);
    if (isBaseFood(n)) {
      const del = read('foodDeleted', null) || [];
      if (del.indexOf(n) === -1) del.push(n);
      write('foodDeleted', del);
    }
    broadcast('foods');
  }
  function toggleStock(id) {
    const f = foods().find(function (x) { return x.id === Number(id); });
    if (!f) return null;
    const next = Object.assign({}, f, { inStock: f.inStock === false });
    saveFoodOverride(next);
    return next;
  }
  function fullFoods() {
    return foods();
  }
  function categories() {
    const custom = read('categories', null) || {};
    const deleted = read('catDeleted', null) || [];
    const merged = D.CATEGORIES.filter(function (c) { return deleted.indexOf(c.id) === -1; })
      .map(function (c) { return custom[c.id] || c; });
    const extras = Object.keys(custom).filter(function (id) {
      return !D.CATEGORIES.some(function (c) { return c.id === id; });
    }).map(function (id) { return custom[id]; });
    return merged.concat(extras);
  }
  function saveCategories(list) {
    const map = {};
    list.forEach(function (c) { map[c.id] = c; });
    write('categories', map);
    broadcast('categories');
  }
  function deleteCategory(id) {
    const all = categories();
    const target = all.find(function (c) { return c.id === id; });
    if (!target) return false;
    const isBase = D.CATEGORIES.some(function (c) { return c.id === id; });
    if (isBase) {
      const del = read('catDeleted', null) || [];
      if (del.indexOf(id) === -1) del.push(id);
      write('catDeleted', del);
      // clean any base edit for it too
      const custom = read('categories', null) || {};
      if (custom[id] !== undefined) { delete custom[id]; write('categories', custom); }
    } else {
      saveCategories(all.filter(function (c) { return c.id !== id; }));
    }
    broadcast('categories');
    return true;
  }
  function catCount(id) {
    return foods().filter(function (f) { return f.cat === id; }).length;
  }

  /* ---------------- app-level event bus ---------------- */
  const listeners = {};
  function broadcast(topic) {
    (listeners[topic] || []).slice().forEach(function (fn) { fn(); });
    // notify other tabs/windows of the same origin
    try { localStorage.setItem(P + 'evt_' + topic, String(Date.now())); } catch (e) { /* noop */ }
  }
  function on(topic, fn) {
    if (!listeners[topic]) listeners[topic] = [];
    listeners[topic].push(fn);
    return function off() {
      listeners[topic] = (listeners[topic] || []).filter(function (f) { return f !== fn; });
    };
  }
  function seedIfEmpty(key, data) {
    if (!read(key, null)) write(key, data);
  }
  function hardReset() {
    Object.keys(localStorage).filter(function (k) { return k.indexOf(P) === 0; }).forEach(function (k) { localStorage.removeItem(k); });
    // re-seed
    seedIfEmpty('users', D.SEED_USERS);
    seedIfEmpty('orders', D.SEED_ORDERS);
    broadcast('reset');
  }

  function getCategory(id) {
    return categories().find(function (c) { return c.id === id; });
  }

  return {
    // users & auth
    users, registerUser, login, logout, currentUser, requireCustomer, requireAdmin,
    updateUser, findByEmail,
    // cart
    cartLines, cartCount, addToCart, setCartQty, updateCartNote, removeFromCart, clearCart, cartSummary,
    // favorites
    getFavs, isFav, toggleFav,
    // orders
    orders, sortOrders, getOrder, myOrders, placeOrder, updateOrderStatus, nextStatus, statusIndex,
    verifyTransfer, confirmPayment,
    // promo
    validatePromo,
    // phone
    normalizePhone, validatePhone, isNgMobile, canonicalPhone,
    // bank-account verification (item 3)
    validateNuban, resolveBankAccount,
    // verification
    emailVerified, verificationInstalled, requestEmailCode, confirmEmailCode,
    verificationMode, markEmailVerified, resendConfirmationEmail, confirmSignupOtp, lastDemoCode,
    // reviews & feedback
    reviews, foodReviews, ratingSummary, allRatingSummaries, isVerifiedBuyer, addReview, updateReview, deleteReview, feedbackSubmit,
    // admin catalog
    foods, fullFoods, addFood, saveFoodOverride, deleteFoodOverride, toggleStock,
    categories, saveCategories, deleteCategory, catCount, getCategory,
    // misc
    on, broadcast, hardReset
  };
})();

/* ============================================================
   DISHDASH — Supabase sync engine (optional add-on layer)
   ------------------------------------------------------------
   Sits ON TOP of the local store above without touching it. When
   assets/js/supabase-config.js has a URL + anon key:
     • auth        → Supabase Auth (real hashing, sessions cross-browser)
     • catalog     → foods / categories tables (admin edits, live)
     • orders      → orders table with live realtime updates
     • favorites   → favorites table per user
   When unconfigured — or when Supabase is unreachable — every page
   keeps working exactly as before on localStorage (mode: 'local').
   store.js stays the single integration point; pages don't change.
   ============================================================ */
window.DD_STORE_SYNC = (function () {
  const S = window.DD_STORE;
  // read lazily: supabase-config.js may load after this file
  function cfg() { return window.DD_SUPABASE_CONFIG || {}; }

  /* Which verification flow this project is in, remembered across pages.
       'code' — project auto-confirms, so we run the in-app code flow
       'link' — project emails a confirmation link; Supabase owns the truth
     Detected from how signUp responds (session vs no session), and also set
     when a sign-in reports an unconfirmed address. */
  const V_MODE_KEY = 'dishdash_vmode';
  function setVerificationMode(m) {
    try { if (m) localStorage.setItem(V_MODE_KEY, m); } catch (e) { /* noop */ }
  }
  function verificationMode() {
    try { return localStorage.getItem(V_MODE_KEY) || 'code'; } catch (e) { return 'code'; }
  }

  const state = {
    mode: 'local',            // 'local' | 'cloud'
    client: null,
    ready: false,
    connecting: false,
    settled: false,           // true once init() has finished (success OR fallback)
    lastError: '',
    pulled: { foods: false, cats: false },
    applying: false,          // true while applying a remote change (suppress echo push)
    unsub: []
  };

  /* ---------------- public status API ---------------- */
  function status() {
    return { mode: state.mode, ready: state.ready, connecting: state.connecting, settled: state.settled, error: state.lastError };
  }

  function configPresent() {
    const c = cfg();
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY);
  }

  /* Guard every network call with a deadline. Without this a flaky network (slow
     DNS, a captive portal, a dropped Wi-Fi) leaves the connection state stuck on
     "connecting" forever: the app never falls back to local mode, the offline
     banner never appears, and sign-in spins indefinitely.                     */
  function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
      Promise.resolve(promise).then(function (v) { clearTimeout(timer); return v; }),
      new Promise(function (_, reject) {
        timer = setTimeout(function () {
          reject(new Error((label || 'Request') + ' timed out'));
        }, ms);
      })
    ]);
  }

  /* Auth writes must never run against the local store while the cloud layer is
     still connecting. Otherwise a click during the (sometimes long) connect
     window signs in locally, the page navigates, and the cloud session that
     boots next disagrees — bouncing the user straight back to the login screen.
     authReady resolves once the cloud adapter is mounted, or once we have
     settled into local fallback, so every sign-in/out lands on whichever layer
     is actually authoritative.                                               */
  let authReadyResolve = null;
  const authReady = new Promise(function (res) { authReadyResolve = res; });
  function markAuthReady() { if (authReadyResolve) { authReadyResolve(); authReadyResolve = null; } }
  function whenAuthReady() { return authReady; }

  /* ---------------- mapping: app ⇄ db ---------------- */
  function toNum(v, dflt) { const n = Number(v); return isFinite(n) ? n : (dflt || 0); }

  function foodToDb(f) {
    return {
      id: Number(f.id), cat: f.cat, name: f.name, price: toNum(f.price),
      old_price: f.oldPrice == null ? null : toNum(f.oldPrice),
      rating: toNum(f.rating, 4.5), reviews: f.reviews | 0, prep: f.prep | 0,
      tag: f.tag || null, popular: !!f.popular,
      in_stock: f.inStock !== false, img: f.img || '', description: f.desc || ''
    };
  }
  function foodFromDb(r) {
    return {
      id: Number(r.id), cat: r.cat, name: r.name, price: toNum(r.price),
      oldPrice: r.old_price == null ? null : toNum(r.old_price),
      rating: toNum(r.rating, 4.5), reviews: r.reviews | 0, prep: r.prep | 0,
      tag: r.tag || null, popular: !!r.popular,
      inStock: r.in_stock !== false, img: r.img || '', desc: r.description || ''
    };
  }
  function catToDb(c) {
    return { id: c.id, name: c.name, emoji: c.emoji || '', img: c.img || '', sort: toNum(c.sort, 0) };
  }
  function catFromDb(r) {
    return { id: r.id, name: r.name, emoji: r.emoji || '', img: r.img || '', sort: toNum(r.sort, 0) };
  }
  function orderToDb(o) {
    return {
      id: o.id, user_id: o.userId || null,
      customer: {
        name: o.customer.name, phone: o.customer.phone, address: o.customer.address,
        city: o.customer.city, note: o.customer.note || ''
      },
      items: (o.items || []).map(function (it) {
        return { dishId: it.dishId, name: it.name, price: toNum(it.price), qty: toNum(it.qty, 1), img: it.img || '', note: it.note || '' };
      }),
      sub: toNum(o.sub), delivery_fee: toNum(o.deliveryFee), discount: toNum(o.discount),
      promo_code: o.promoCode || null, total: toNum(o.total),
      pay: o.pay, pay_status: o.payStatus || 'pending', pay_ref: o.payRef || null,
      pay_account: o.payAccount || null,
      verified_at: o.verifiedAt || null, paid_at: o.paidAt || null,
      status: o.status, status_history: o.statusHistory || [],
      rev: Date.now(),
      placed_at: o.placedAt || new Date().toISOString(),
      eta_min: toNum(o.etaMin, 35), source: o.source || 'app'
    };
  }
  function orderFromDb(r) {
    return {
      id: r.id, userId: r.user_id || null,
      customer: {
        name: r.customer && r.customer.name || '', phone: r.customer && r.customer.phone || '',
        address: r.customer && r.customer.address || '', city: r.customer && r.customer.city || '',
        note: (r.customer && r.customer.note) || ''
      },
      items: (r.items || []).map(function (it) {
        return { dishId: it.dishId, name: it.name, price: toNum(it.price), qty: toNum(it.qty, 1), img: it.img || '', note: it.note || '' };
      }),
      sub: toNum(r.sub), deliveryFee: toNum(r.delivery_fee), discount: toNum(r.discount),
      promoCode: r.promo_code || null, total: toNum(r.total),
      pay: r.pay, payStatus: r.pay_status || 'pending', payRef: r.pay_ref || null,
      payAccount: r.pay_account || null,
      verifiedAt: r.verified_at || null, paidAt: r.paid_at || null,
      status: r.status, statusHistory: r.status_history || [],
      placedAt: r.placed_at, etaMin: toNum(r.eta_min, 35), source: r.source || 'app'
    };
  }

  /* ---------------- shadow key (local cache of cloud rows) ----------------
     Kept under a DIFFERENT prefix than the local store's so the two never
     collide: cloud mode renders from here; local mode never reads it.     */
  const K = 'dishdash_cloud_';
  function shadowRead(key, fallback) {
    try { const raw = localStorage.getItem(K + key); return raw == null ? fallback : JSON.parse(raw); }
    catch (e) { return fallback; }
  }
  function shadowWrite(key, val) {
    try { localStorage.setItem(K + key, JSON.stringify(val)); } catch (e) { /* noop */ }
  }

  /* ---------------- init / connection ---------------- */
  async function init() {
    if (!configPresent()) return status();
    state.connecting = true;
    try {
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('Supabase client library not loaded (vendor/supabase.js missing).');
      }
      state.client = window.supabase.createClient(cfg().SUPABASE_URL, cfg().SUPABASE_ANON_KEY);
      const t0 = Date.now();
      const head = await withTimeout(
        state.client.from('foods').select('id').limit(1),
        10000, 'Connecting to the cloud database'
      );
      if (head.error) throw head.error;
      state.mode = 'cloud';
      state.lastError = '';
      await detectPayAccountColumn(state.client);
      await pullCatalog();
      await bridgeAuth();
      subscribeRealtime();
      state.ready = true;
    } catch (e) {
      state.mode = 'local';
      state.lastError = (e && e.message) || String(e);
      state.client = null;
    }
    state.connecting = false;
    state.settled = true;
    document.documentElement.dispatchEvent(new CustomEvent('dd:sync-ready'));
    // One-tick replay: pages register their change listeners at DOMContentLoaded,
    // which can land AFTER the boot pull's broadcast (slow probe, throttled tab).
    // Re-announcing after the current task guarantees every open page renders
    // the fresh cloud snapshot at least once. Re-rendering identical data is
    // cheap and idempotent.
    setTimeout(function () {
      try { S.broadcast('foods'); S.broadcast('categories'); S.broadcast('orders'); } catch (e) { /* noop */ }
    }, 0);
    return status();
  }

  /* ---------------- catalog pull (foods + categories) ---------------- */
  async function pullCatalog() {
    const c = state.client;
    const [foodsRes, catsRes] = await Promise.all([
      c.from('foods').select('*').order('id'),
      c.from('categories').select('*').order('sort')
    ]);
    if (foodsRes.error) throw foodsRes.error;
    if (catsRes.error) throw catsRes.error;
    const foods = foodsRes.data.map(foodFromDb);
    const cats = catsRes.data.map(catFromDb);
    shadowWrite('foods', foods);
    shadowWrite('cats', cats);
    state.pulled.foods = true;
    state.pulled.cats = true;
    S.broadcast('foods');
    S.broadcast('categories');
  }

  /* ---------------- auth bridge ----------------
     Maps the app's S.login / S.registerUser / S.currentUser onto
     Supabase Auth. Same shapes as the local versions: {ok, user|error}. */
  async function registerUser(data) {
    const c = state.client;
    const email = String(data.email || '').trim().toLowerCase();
    // same rule as the local store — never trust the caller (see DD_STORE.validatePhone)
    const phone = S.validatePhone(data.phone, { required: false });
    if (!phone.ok) return { ok: false, error: phone.error };
    let out;
    try {
      out = await withTimeout(c.auth.signUp({
        email: email,
        password: String(data.password || ''),
        options: { data: { name: data.name, phone: phone.value } }
      }), 15000, 'Creating your account');
    } catch (e) {
      return { ok: false, error: /timed out/i.test((e && e.message) || '')
        ? 'Registration is taking too long. Check your internet connection and try again.'
        : ((e && e.message) || 'Could not create your account. Please try again.') };
    }
    const created = out.data, error = out.error;
    if (error) {
      if (/already registered/i.test(error.message || '')) {
        return { ok: false, error: 'An account with this email already exists.' };
      }
      return { ok: false, error: error.message };
    }
    if (!created.user) return { ok: false, error: 'Registration failed — please try again.' };

    /* With "Confirm email" switched on, Supabase deliberately hides whether an
       address is already taken: it answers with a placeholder user whose
       identities array is empty and sends no mail at all. Unchecked, someone
       re-using an address waits forever for a confirmation that never comes. */
    if (Array.isArray(created.user.identities) && created.user.identities.length === 0) {
      return { ok: false, existing: true, error: 'An account with this email already exists.' };
    }

    /* No session means the project is configured to email a confirmation link
       before the account becomes usable. RLS blocks profile reads and writes
       until that link is opened, so hand back what we already know and let
       verify.html explain the inbox round-trip. */
    if (!created.session) {
      setVerificationMode('link');
      /* A previous account can still be signed in on this browser — a Supabase
         session survives closing the window. Leaving it live makes verify.html
         read the OLD account (already confirmed) and tell the customer they are
         "all set" for the wrong address, so sign it out here: the confirmation
         step must belong to the account just created. */
      try {
        const prev = await c.auth.getSession();
        if (prev && prev.data && prev.data.session) {
          await c.auth.signOut();
          shadowWrite('session', null);
        }
      } catch (e) { /* offline, or already gone — verify.html handles the rest */ }
      return {
        ok: true, pendingEmail: true, verificationMode: 'link',
        user: {
          id: created.user.id, name: String(data.name || '').trim(),
          email: email, role: 'customer', emailVerifiedAt: null
        }
      };
    }

    setVerificationMode('code');
    // the DB trigger creates the profile row; write back our delivery fields
    await c.from('profiles').update({
      phone: phone.value,
      delivery_name: data.name.trim(), delivery_phone: phone.value,
      delivery_address: (data.address || '').trim(), delivery_city: (data.city || '').trim(),
      delivery_note: (data.note || '').trim()
    }).eq('id', created.user.id);
    const fresh = await startSession(created.user.id);
    if (fresh && fresh.ok) fresh.verificationMode = 'code';
    return fresh;
  }

  async function login(email, password) {
    const c = state.client;
    let out;
    try {
      out = await withTimeout(c.auth.signInWithPassword({
        email: String(email || '').trim().toLowerCase(), password: String(password || '')
      }), 15000, 'Signing in');
    } catch (e) {
      return { ok: false, error: /timed out/i.test((e && e.message) || '')
        ? 'Sign-in is taking too long. Check your internet connection and try again.'
        : ((e && e.message) || 'Could not sign in. Please try again.') };
    }
    const res = out.data, error = out.error;
    if (error) {
      // An unconfirmed address only happens in email-link mode, and it is a
      // strong signal for verify.html to show the "check your inbox" panel.
      if (/email not confirmed/i.test(error.message || '')) {
        setVerificationMode('link');
        return {
          ok: false, pendingEmail: true, verificationMode: 'link',
          error: 'This email is not confirmed yet — enter the 6-digit code we emailed you, or send a fresh one.'
        };
      }
      const msg = /invalid login credentials/i.test(error.message || '')
        ? 'Incorrect email or password. Please try again.' : error.message;
      return { ok: false, error: msg };
    }
    const signed = await startSession(res.user.id);
    if (signed && signed.ok) signed.verificationMode = verificationMode();
    return signed;
  }

  async function startSession(authId) {
    const c = state.client;
    const { data: prof, error } = await c.from('profiles').select('*').eq('id', authId).single();
    if (error || !prof) {
      return { ok: false, error: 'Signed in, but the profile row is missing. Did you run supabase/schema.sql?' };
    }
    shadowWrite('session', profileToUser(prof));
    S.broadcast('auth');
    return { ok: true, user: profileToUser(prof) };
  }

  function profileToUser(p) {
    const user = {
      id: p.id, name: p.name || '', email: p.email || '', phone: p.phone || '',
      role: p.role || 'customer',
      createdAt: p.created_at || '',
      delivery: {
        name: p.delivery_name || p.name || '', phone: p.delivery_phone || p.phone || '',
        address: p.delivery_address || '', city: p.delivery_city || '', note: p.delivery_note || ''
      }
    };
    // Only present once verification-schema.sql has been run. Its absence is
    // how the app knows to leave everyone alone rather than block them.
    if (Object.prototype.hasOwnProperty.call(p, 'email_verified_at')) {
      user.emailVerifiedAt = p.email_verified_at || null;
    }
    return user;
  }

  async function currentUser() {
    if (state.mode !== 'cloud') return null;
    const c = state.client;
    const { data: sessionData } = await c.auth.getSession();
    const authUser = sessionData && sessionData.session && sessionData.session.user;
    const uid = authUser && authUser.id;
    if (!uid) { shadowWrite('session', null); return null; }
    const { data: prof } = await c.from('profiles').select('*').eq('id', uid).single();
    if (!prof) return null;
    const user = profileToUser(prof);
    // Email-link mode: Supabase itself is the authority on whether the address
    // was confirmed, so trust its stamp in addition to our own profile flag.
    user.emailConfirmed = !!(authUser.email_confirmed_at || authUser.confirmed_at);
    shadowWrite('session', user);
    return user;
  }

  async function logout() {
    if (state.client) { try { await state.client.auth.signOut(); } catch (e) { /* noop */ } }
    shadowWrite('session', null);
    S.broadcast('auth');
  }

  async function bridgeAuth() {
    // keep shadow session in sync with the real auth session on load
    await currentUser();
  }

  async function updateProfile(id, patch) {
    const c = state.client;
    const db = {};
    if (patch.name !== undefined) db.name = patch.name;
    if (patch.phone !== undefined) {
      const p = S.validatePhone(patch.phone, { required: false });
      if (p.ok) db.phone = p.value;
    }
    if (patch.delivery) {
      if (patch.delivery.name !== undefined) db.delivery_name = patch.delivery.name;
      if (patch.delivery.phone !== undefined) {
        const p = S.validatePhone(patch.delivery.phone, { required: false });
        if (p.ok) db.delivery_phone = p.value;
      }
      if (patch.delivery.address !== undefined) db.delivery_address = patch.delivery.address;
      if (patch.delivery.city !== undefined) db.delivery_city = patch.delivery.city;
      if (patch.delivery.note !== undefined) db.delivery_note = patch.delivery.note;
    }
    const { error } = await c.from('profiles').update(db).eq('id', id);
    if (error) return { ok: false, error: error.message };
    return startSession(id);
  }

  /* ---------------- reviews & feedback (cloud) ---------------- */
  async function pullReviews() {
    const { data, error } = await state.client
      .from('reviews')
      .select('id, food_id, rating, title, body, created_at, user_id, profiles(name)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    const list = (data || []).map(function (r) {
      return {
        id: r.id, foodId: r.food_id,
        userId: r.user_id,
        userName: (r.profiles && r.profiles.name) || 'Customer',
        rating: r.rating, title: r.title || '', body: r.body || '',
        verified: false, // filled per-dish below via order history check
        createdAt: r.created_at
      };
    });
    // verified flag: batch-check which reviewed dishes the reviewer ordered
    try {
      const u = await currentUser();
      if (u) {
        // order_items stores the dish on dish_id (see schema.sql)
        const { data: mine } = await state.client
          .from('order_items').select('dish_id, orders!inner(user_id,status)')
          .eq('orders.user_id', u.id).eq('orders.status', 'delivered');
        const bought = new Set((mine || []).map(function (x) { return Number(x.dish_id); }));
        list.forEach(function (r) { r.verified = r.userId === u.id && bought.has(Number(r.foodId)); });
      }
    } catch (e) { /* non-fatal */ }
    shadowWrite('reviews', list);
    S.broadcast('reviews');
    return list;
  }

  async function addReviewCloud(foodId, rating, title, body) {
    const c = state.client;
    const u = await currentUser();
    if (!u) return { ok: false, error: 'Sign in to write a review.' };
    const { error } = await c.from('reviews').insert({
      food_id: Number(foodId), user_id: u.id,
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      title: String(title || '').trim().slice(0, 80),
      body: String(body || '').trim().slice(0, 600)
    });
    if (error) {
      if (/duplicate key/i.test(error.message || '')) return { ok: false, error: 'You already reviewed this dish — you can edit your existing review instead.' };
      if (/Could not find the table|schema cache/i.test(error.message || '')) return { ok: false, error: 'Reviews are not enabled on the server yet — run supabase/reviews-schema.sql once.' };
      if (/row-level security|violates check constraint/i.test(error.message || '')) return { ok: false, error: 'Could not save your review. Please sign in again and retry.' };
      return { ok: false, error: error.message };
    }
    await pullReviews();
    return { ok: true };
  }

  async function updateReviewCloud(reviewId, rating, title, body) {
    const c = state.client;
    const u = await currentUser();
    if (!u) return { ok: false, error: 'Sign in to edit your review.' };
    const { error } = await c.from('reviews').update({
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      title: String(title || '').trim().slice(0, 80),
      body: String(body || '').trim().slice(0, 600)
    }).eq('id', reviewId).eq('user_id', u.id);
    if (error) {
      if (/Could not find the table|schema cache/i.test(error.message || '')) return { ok: false, error: 'Reviews are not enabled on the server yet — run supabase/reviews-schema.sql once.' };
      if (/row-level security|violates check constraint/i.test(error.message || '')) return { ok: false, error: 'Could not save your changes. Please sign in again and retry.' };
      return { ok: false, error: error.message };
    }
    await pullReviews();
    return { ok: true };
  }

  async function deleteReviewCloud(reviewId) {
    const c = state.client;
    const u = await currentUser();
    if (!u) return { ok: false, error: 'Sign in to delete your review.' };
    const { error } = await c.from('reviews').delete().eq('id', reviewId).eq('user_id', u.id);
    if (error) {
      if (/Could not find the table|schema cache/i.test(error.message || '')) return { ok: false, error: 'Reviews are not enabled on the server yet — run supabase/reviews-schema.sql once.' };
      return { ok: false, error: error.message };
    }
    await pullReviews();
    return { ok: true };
  }

  /* ---------------- email verification (cloud) --------------
     The rules live in Postgres (see supabase/verification-schema.sql); these
     are thin wrappers. `simulated` marks a response whose code is being
     shown in-app rather than emailed — verify.html labels it accordingly. */

  function rpcError(error, fallback) {
    const msg = (error && error.message) || '';
    /* PGRST202 = the function itself is missing (migration never ran).
       42883 = the function exists but crashed internally (e.g. a missing
       extension) — surfacing that as "run the migration" sent us chasing
       the wrong fix in live testing, so it gets the raw message instead. */
    if (error && error.code === 'PGRST202') {
      return 'Email verification is not enabled on the server yet — run supabase/verification-schema.sql once.';
    }
    return msg || fallback;
  }

  /* The server only ever stores a hash, so it cannot hand back a code it has
     already issued. Keeping the display copy here lets the demo panel survive
     a reload or a page change within the resend cooldown. */
  const V_CODE_KEY = 'dishdash_demo_code';
  function stashDemoCode(code, expiresIn) {
    try {
      localStorage.setItem(V_CODE_KEY, JSON.stringify({
        code: String(code),
        expiresAt: new Date(Date.now() + (Number(expiresIn) || 600) * 1000).toISOString()
      }));
    } catch (e) { /* noop */ }
  }
  function clearDemoCode() {
    try { localStorage.removeItem(V_CODE_KEY); } catch (e) { /* noop */ }
  }
  function lastDemoCode() {
    try {
      const rec = JSON.parse(localStorage.getItem(V_CODE_KEY) || 'null');
      if (!rec || !rec.code) return null;
      if (Date.parse(rec.expiresAt) <= Date.now()) return null;
      return rec;
    } catch (e) { return null; }
  }

  async function requestEmailCode() {
    const u = await currentUser();
    if (!u) return { ok: false, error: 'Sign in to verify your email.' };
    const { data, error } = await state.client.rpc('request_email_code');
    if (error) return { ok: false, error: rpcError(error, 'Could not create a verification code.') };
    const out = data || {};
    if (!out.ok) return out;
    out.simulated = true;   // the code is displayed in-app, never emailed
    if (out.code) stashDemoCode(out.code, out.expiresIn);
    return out;
  }

  async function confirmEmailCode(code) {
    const u = await currentUser();
    if (!u) return { ok: false, error: 'Sign in to verify your email.' };
    const { data, error } = await state.client.rpc('confirm_email_code', { p_code: String(code == null ? '' : code).trim() });
    if (error) return { ok: false, error: rpcError(error, 'Could not check that code.') };
    const out = data || {};
    if (out.ok) {
      clearDemoCode();
      await startSession(u.id);   // refresh the cached profile flag
    }
    return out;
  }

  /* Link mode: mirror Supabase's own confirmation onto the profile. The
     function refuses unless auth.users really has email_confirmed_at set. */
  /* Link mode only: ask Supabase to send the confirmation email again. Works
     without a session, because the link is opened while still signed out. */
  async function resendConfirmationEmail(email) {
    const target = String(email || '').trim().toLowerCase();
    if (!target) return { ok: false, error: 'Enter the email address you registered with.' };
    const { error } = await state.client.auth.resend({ type: 'signup', email: target });
    if (error) {
      if (/rate limit|too many|for security purposes/i.test(error.message || '')) {
        return { ok: false, error: 'Too many attempts — please wait a few minutes before resending.' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  /* How a failed code is explained — the raw GoTrue strings are all "token has
     expired or is invalid", which reads as if the customer mistyped when the
     code may simply be superseded by a newer email. */
  function friendlyOtpError(err) {
    const msg = (err && err.message) || '';
    if (/already confirmed|already been confirmed/i.test(msg)) {
      return 'This email is already confirmed — sign in instead.';
    }
    if (/rate limit|too many|for security purposes/i.test(msg)) {
      return 'Too many attempts — wait a minute, then request a fresh code.';
    }
    if (/expired|invalid/i.test(msg)) {
      return 'That code is not correct, or it has expired. Request a new one and use the newest email.';
    }
    return msg || 'Could not confirm that code. Please try again.';
  }

  /* Email-OTP mode: the customer types the 6-digit code from the confirmation
     email into the browser they registered in.

     This is the only confirmation path the app can finish by itself. A LINK is
     handed to the operating system's default browser — a choice no web page
     can influence — so the resulting session lands in that browser, while this
     one holds no session at all (link-mode sign-up issues none) and could
     never complete. A typed code has no such coupling.

     verifyOtp needs no session: the session arrives in the response body, so
     this runs straight from the signed-out "check your inbox" panel. */
  async function confirmSignupOtp(email, code) {
    const target = String(email || '').trim().toLowerCase();
    const token = String(code == null ? '' : code).trim();
    if (!target) return { ok: false, error: 'We need the email address you registered with.' };
    if (!/^\d{6}$/.test(token)) return { ok: false, error: 'Enter the 6-digit code from the email.' };

    /* Supabase documents type 'email' for this OTP in its own email-template
       guide and also accepts 'signup' for the same token; try both so a change
       on their side cannot strand the flow. A wrong type answers "invalid",
       indistinguishable from a wrong code — which is why both are attempted
       before the customer is told anything. */
    const types = ['email', 'signup'];
    let last = null;
    for (let i = 0; i < types.length; i++) {
      let out;
      try {
        out = await withTimeout(
          state.client.auth.verifyOtp({ email: target, token: token, type: types[i] }),
          15000, 'Checking the code');
      } catch (e) {
        last = { message: (e && e.message) || 'Could not check that code.' };
        continue;
      }
      if (!out.error && out.data && out.data.user) {
        const uid = out.data.user.id;
        if (!out.data.session) {
          /* Confirmed, but no session to hand back — the panel sends the
             customer to sign in rather than claiming they are logged in. */
          return { ok: true, email: target, signedIn: false };
        }
        await startSession(uid);            // pull the profile, refresh the shadow
        try { await markEmailVerified(); }  // mirror it onto our own flag
        catch (e) { /* best effort — the Supabase stamp is authoritative */ }
        return { ok: true, email: target, signedIn: true };
      }
      last = out.error || { message: 'That code did not check out.' };
    }
    return { ok: false, error: friendlyOtpError(last) };
  }

  async function markEmailVerified() {
    const { data, error } = await state.client.rpc('mark_email_verified');
    if (error) return { ok: false, error: rpcError(error, 'Could not record your confirmation.') };
    const out = data || {};
    if (out.ok) {
      const u = await currentUser();
      if (u) await startSession(u.id);
    }
    return out;
  }

  async function feedbackSubmitCloud(data) {
    const c = state.client;
    const u = await currentUser();
    const { error } = await c.from('feedback').insert({
      user_id: u ? u.id : null,
      name: (data.name || (u ? u.name : '')).trim(),
      email: (data.email || (u ? u.email : '')).trim(),
      rating: data.rating ? Math.min(5, Math.max(1, Number(data.rating))) : null,
      message: String(data.message || '').trim().slice(0, 1000)
    });    if (error) {
      if (/Could not find the table|schema cache/i.test(error.message || '')) return { ok: false, error: 'Feedback is not enabled on the server yet — run supabase/reviews-schema.sql once.' };
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }




  /* ---------------- orders ---------------- */
  async function pullUsers() {
    const { data, error } = await state.client.from('profiles').select('*').order('created_at');
    if (error) throw error;
    const users = (data || []).map(profileToUser);
    shadowWrite('users', users);
    S.broadcast('users');
    return users;
  }

  async function pullOrders() {
    const c = state.client;
    const u = await currentUser();
    let q = c.from('orders').select('*').order('placed_at', { ascending: false }).limit(500);
    // RLS already scopes this; the filter is a belt-and-braces for customers
    if (u && u.role !== 'admin') q = q.eq('user_id', u.id);
    const { data, error } = await q;
    if (error) throw error;
    const orders = (data || []).map(orderFromDb);
    shadowWrite('orders', orders);
    S.broadcast('orders');
    return orders;
  }

  /* The verified paying-account snapshot (item 3) is stored in a pay_account
     column. A project created before that migration lacks it, and Postgres
     would reject the WHOLE order — so an un-run migration must never be able
     to fail a customer's checkout. Same fail-safe idea as the
     email-verification flag: the column's existence is DETECTED up front,
     not discovered through a failed write, and a rejected write still retries
     without the field as a backstop. Run supabase/pay-account-schema.sql to
     keep snapshots in cloud mode; without it the order still places and the
     admin simply sees no account snapshot. */
  let payAccountColumn = null;   // null = not probed yet, then true/false

  /* PostgREST answers "column orders.pay_account does not exist" (42703) when
     the migration has not been run. Any other error is treated as "assume
     missing", which only costs the snapshot, never the order. */
  async function detectPayAccountColumn(c) {
    if (payAccountColumn !== null) return payAccountColumn;
    try {
      const { error } = await c.from('orders').select('pay_account').limit(1);
      payAccountColumn = !error;
    } catch (e) {
      payAccountColumn = false;
    }
    return payAccountColumn;
  }

  function withoutPayAccount(row) {
    if (payAccountColumn !== false) return row;
    const copy = Object.assign({}, row);
    delete copy.pay_account;
    return copy;
  }
  function isMissingPayAccountCol(error) {
    if (!error) return false;
    const text = String(error.message || '') + ' ' + String(error.details || '') + ' ' + String(error.hint || '');
    return /pay_account/.test(text);
  }

  async function placeOrder(order) {
    const c = state.client;
    const u = await currentUser();
    const row = orderToDb(order);
    row.user_id = u ? u.id : null;
    row.id = null; // let the DB sequence assign a globally unique DD-#### id
    let attempt = await c.from('orders').insert(withoutPayAccount(row)).select('id').single();
    if (isMissingPayAccountCol(attempt.error)) {
      payAccountColumn = false;        // backstop: probe said otherwise
      attempt = await c.from('orders').insert(withoutPayAccount(row)).select('id').single();
    }
    if (attempt.error) throw attempt.error;
    order.id = attempt.data.id;
    await pullOrders();
    return order;
  }

  async function updateOrder(order) {
    const c = state.client;
    let attempt = await c.from('orders').update(withoutPayAccount(orderToDb(order))).eq('id', order.id);
    if (isMissingPayAccountCol(attempt.error)) {
      payAccountColumn = false;
      attempt = await c.from('orders').update(withoutPayAccount(orderToDb(order))).eq('id', order.id);
    }
    if (attempt.error) throw attempt.error;
    await pullOrders();
  }

  /* ---------------- admin catalog writes ---------------- */
  async function upsertFood(f) {
    const { error } = await state.client.from('foods').upsert(foodToDb(f));
    if (error) throw error;
    await pullCatalog();
  }
  async function deleteFood(id) {
    const { error } = await state.client.from('foods').delete().eq('id', Number(id));
    if (error) throw error;
    await pullCatalog();
  }
  async function saveCategories(list) {
    const rows = list.map(catToDb);
    const { error } = await state.client.from('categories').upsert(rows);
    if (error) throw error;
    await pullCatalog();
  }
  async function deleteCategory(id) {
    const { error } = await state.client.from('categories').delete().eq('id', id);
    if (error) throw error;
    await pullCatalog();
  }

  /* ---------------- favorites ---------------- */
  async function toggleFav(foodId) {
    const c = state.client;
    const u = await currentUser();
    if (!u) return false;
    const n = Number(foodId);
    const { data: existing } = await c.from('favorites').select('food_id').eq('user_id', u.id).eq('food_id', n).maybeSingle();
    if (existing) {
      await c.from('favorites').delete().eq('user_id', u.id).eq('food_id', n);
    } else {
      const { error } = await c.from('favorites').insert({ user_id: u.id, food_id: n });
      if (error) throw error;
    }
    S.broadcast('favs');
    return !existing;
  }

  async function getFavIds() {
    const u = await currentUser();
    if (!u) return [];
    const { data } = await state.client.from('favorites').select('food_id').eq('user_id', u.id);
    return (data || []).map(function (r) { return Number(r.food_id); });
  }

  /* ---------------- realtime ---------------- */
  function subscribeRealtime() {
    const c = state.client;
    try {
      const ch = c.channel('dishdash-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, function () {
          if (!state.applying) pullOrders().catch(function () {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'foods' }, function () {
          if (!state.applying) pullCatalog().catch(function () {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, function () {
          if (!state.applying) pullCatalog().catch(function () {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, function () {
          if (!state.applying) {
            // A new customer just signed up (or edited their profile) in another
            // browser — refresh the admin's customer list live. Requires RLS to
            // allow the admin to read profiles (policy already grants this).
            pullUsers().then(function (list) {
              usersCache = list;
              S.broadcast('users');
            }).catch(function () {});
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, function () {
          if (!state.applying) pullReviews().catch(function () {});
        })
        .subscribe();
      state.unsub.push(function () { try { c.removeChannel(ch); } catch (e) { /* noop */ } });
    } catch (e) {
      // realtime unavailable — app still works, just without live pushes
    }
  }

  function teardown() {
    state.unsub.forEach(function (fn) { try { fn(); } catch (e) { /* noop */ } });
    state.unsub = [];
  }

  /* ---------------- setup helpers (used by setup-demo.html) ---------------- */
  async function promoteFirstAdmin(email) {
    const c = state.client;
    const { error } = await c.from('profiles').update({ role: 'admin' }).eq('email', String(email || '').toLowerCase());
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  return {
    init, status, configPresent,
    markAuthReady, whenAuthReady,
    registerUser, login, logout, currentUser, updateProfile,
    pullOrders, pullCatalog, pullUsers, placeOrder, updateOrder,
    pullReviews, addReviewCloud, updateReviewCloud, deleteReviewCloud, feedbackSubmitCloud,
    requestEmailCode, confirmEmailCode, markEmailVerified, resendConfirmationEmail, confirmSignupOtp, lastDemoCode,
    setVerificationMode, verificationMode,
    upsertFood, deleteFood, saveCategories, deleteCategory,
    foodToDb, foodFromDb,
    toggleFav, getFavIds,
    promoteFirstAdmin, teardown,
    _state: state,
    _shadow: { read: shadowRead, write: shadowWrite }
  };
})();

/* ============================================================
   Cloud-mode adapter — transparently swaps the local store's I/O
   for the sync layer when Supabase is configured and reachable.
   Pages keep calling S.* exactly as before. Reads come from the
   cloud shadow cache; writes go through the sync engine. In local
   mode nothing here activates.
   ============================================================ */
window.DD_CLOUD = (function () {
  const S = window.DD_STORE;
  const Y = window.DD_STORE_SYNC;

  /* A confirmation LINK comes back from the inbox with the session in the URL
     fragment (#access_token=…). supabase-js consumes it and clears the hash
     during init(), so it has to be read NOW, at script load — afterwards there
     is no trace of how the session arrived, which is why clicking the link used
     to look like nothing happened. Read-only; it changes no behaviour. */
  const LANDING_HASH = (function () {
    try { return String(window.location.hash || ''); } catch (e) { return ''; }
  })();

  function linkLanding() {
    if (!LANDING_HASH) return null;
    if (/error_code=|error_description=/.test(LANDING_HASH)) {
      return { error: true, expired: /otp_expired/.test(LANDING_HASH) };
    }
    if (/access_token=/.test(LANDING_HASH)) return { confirmed: true };
    return null;   // a normal #anchor, not an auth callback
  }

  let sessionCache = null;   // cloud session (null = signed out)
  let favsCache = [];        // cloud favorite food ids
  let usersCache = [];       // admin: profiles
  let installed = false;     // true once the cloud adapter has taken over the store

  function active() { return Y.status().mode === 'cloud'; }

  /* Optimistic session hint.
     Restoring a Supabase session is asynchronous, but page guards run
     synchronously on load and would otherwise bounce a signed-in user to
     the login page. We cache the last known {id,email,role} and serve it
     immediately; the real session replaces it a moment later. This is only
     a UI convenience — Supabase RLS still authorises every actual read and
     write, so a tampered hint can never expose or alter real data.        */
  const HINT = 'dishdash_session_hint';
  function hintRead() {
    try { const raw = localStorage.getItem(HINT); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function hintWrite(u) {
    try { if (u) localStorage.setItem(HINT, JSON.stringify(u)); else localStorage.removeItem(HINT); }
    catch (e) { /* noop */ }
  }
  function cloudUser() { return sessionCache || (Y.configPresent() ? hintRead() : null); }

  /* Synchronous pre-boot shim — runs when store.js loads, before any page
     script. Page guards run on DOMContentLoaded, long before the async
     cloud init resolves, so they must be hint-aware from the first call or
     every protected page bounces a signed-in user to the login screen.   */
  (function preinstall() {
    if (!Y.configPresent()) return;
    const baseCurrentUser = S.currentUser;
    S.currentUser = function () {
      // Cloud init is asynchronous, so during boot the cached hint is the only
      // thing we can trust — without it every guarded page would bounce a
      // signed-in user to the login screen.
      //
      // But once sync has SETTLED into local mode (no keys, offline copy, or the
      // cloud became unreachable) the local session is the real one. A leftover
      // hint from a previous cloud session must not override it, or the app
      // would keep reporting whoever last signed in online.
      const st = Y.status();
      if (st.settled && st.mode === 'local') return baseCurrentUser();
      return cloudUser() || baseCurrentUser();
    };
    S.requireAdmin = function () { const u = S.currentUser(); return u && u.role === 'admin' ? u : null; };
    S.requireCustomer = function () { const u = S.currentUser(); return u && u.role !== 'admin' ? u : null; };

    /* Hold the auth entry points back until the cloud layer is mounted. Once it
       is (installed === true) the calls below resolve to the cloud
       implementations that install() has already swapped in. */
    const base = { login: S.login, registerUser: S.registerUser, logout: S.logout };
    S.login = function (email, password) {
      return Y.whenAuthReady().then(function () {
        return installed ? S.login(email, password) : base.login(email, password);
      });
    };
    S.registerUser = function (data) {
      return Y.whenAuthReady().then(function () {
        return installed ? S.registerUser(data) : base.registerUser(data);
      });
    };
    S.logout = function () {
      return Y.whenAuthReady().then(function () {
        return installed ? S.logout() : base.logout();
      });
    };
  })();

  async function refreshSession() {
    sessionCache = await Y.currentUser();
    hintWrite(sessionCache);
    if (sessionCache) favsCache = await Y.getFavIds().catch(function () { return []; });
    else favsCache = [];
    // re-scope the order cache to the new session — otherwise a customer who
    // signs in after an admin on this device could read the admin's pulled
    // list (all orders) from the shared shadow cache
    await Y.pullOrders().catch(function () {});
    S.broadcast('auth');
    return sessionCache;
  }

  function install() {
    installed = true;
    /* ---------- reads: serve from the cloud shadow ---------- */
    S.foods = function () { return Y._shadow.read('foods', window.DD_DATA.FOODS); };
    S.categories = function () { return Y._shadow.read('cats', window.DD_DATA.CATEGORIES); };
    S.getCategory = function (id) { return S.categories().find(function (c) { return c.id === id; }) || null; };
    S.orders = function () { return Y._shadow.read('orders', []); };

    /* ---------- reviews & feedback ---------- */
    S.reviews = function () { return Y._shadow.read('reviews', []); };
    S.foodReviews = function (foodId) {
      return S.reviews()
        .filter(function (r) { return Number(r.foodId) === Number(foodId); })
        .sort(function (a, b) { return Date.parse(b.createdAt) - Date.parse(a.createdAt); });
    };
    S.ratingSummary = function (foodId) {
      const list = S.foodReviews(foodId);
      if (!list.length) return null;
      const avg = list.reduce(function (s, r) { return s + Number(r.rating); }, 0) / list.length;
      return { avg: Math.round(avg * 10) / 10, count: list.length };
    };
    S.allRatingSummaries = function () {
      const map = {};
      S.reviews().forEach(function (r) {
        const k = Number(r.foodId);
        if (!map[k]) map[k] = { sum: 0, count: 0 };
        map[k].sum += Number(r.rating); map[k].count++;
      });
      const out = {};
      Object.keys(map).forEach(function (k) {
        out[k] = { avg: Math.round(map[k].sum / map[k].count * 10) / 10, count: map[k].count };
      });
      return out;
    };
    S.isVerifiedBuyer = function (foodId) {
      const u = sessionCache;
      if (!u) return false;
      const delivered = Y._shadow.read('orders', []).filter(function (o) {
        return o.status === 'delivered' && String(o.userId) === String(u.id);
      });
      return delivered.some(function (o) {
        return (o.items || []).some(function (it) {
          return Number(it.foodId || it.dishId || (it.dish && it.dish.id)) === Number(foodId);
        });
      });
    };
    /* ---------- email verification ---------- */
    S.requestEmailCode = function () { return Y.requestEmailCode(); };
    S.confirmEmailCode = function (code) { return Y.confirmEmailCode(code); };
    S.markEmailVerified = function () { return Y.markEmailVerified(); };
    S.resendConfirmationEmail = function (email) { return Y.resendConfirmationEmail(email); };
    S.confirmSignupOtp = function (email, code) {
      return Y.confirmSignupOtp(email, code).then(function (res) {
        // a successful verifyOtp already established the session
        if (res.ok && res.signedIn) return refreshSession().then(function () { return res; });
        return res;
      });
    };
    S.lastDemoCode = function () { return Y.lastDemoCode(); };
    S.verificationMode = function () { return Y.verificationMode(); };

    S.addReview = function (foodId, rating, title, body) { return Y.addReviewCloud(foodId, rating, title, body); };
    S.updateReview = function (reviewId, rating, title, body) { return Y.updateReviewCloud(reviewId, rating, title, body); };
    S.deleteReview = function (reviewId) { return Y.deleteReviewCloud(reviewId); };
    S.feedbackSubmit = function (data) { return Y.feedbackSubmitCloud(data); };
    S.users = function () { return usersCache; };

    /* ---------- session ---------- */
    S.currentUser = cloudUser;
    S.login = function (email, password) { return Y.login(email, password).then(function (res) { if (res.ok) return refreshSession().then(function () { return res; }); return res; }); };
    S.registerUser = function (data) {
      return Y.registerUser(data).then(function (res) {
        // pendingEmail has no session yet (confirmation link mode) — refreshing
        // would only clear the cache we just populated from the response.
        if (res.ok && !res.pendingEmail) return refreshSession().then(function () { return res; });
        return res;
      });
    };
    S.logout = function () { sessionCache = null; favsCache = []; hintWrite(null); return Y.logout(); };
    S.updateUser = function (id, patch) { return Y.updateProfile(id, patch).then(function (res) { if (res.ok) return refreshSession().then(function () { return res.user; }); throw new Error(res.error); }); };

    /* ---------- favorites (optimistic) ---------- */
    S.getFavs = function () { return favsCache.map(function (id) { return S.foods().find(function (f) { return f.id === id; }); }).filter(Boolean); };
    S.isFav = function (id) { return favsCache.indexOf(Number(id)) !== -1; };
    S.toggleFav = function (id) {
      const n = Number(id);
      const i = favsCache.indexOf(n);
      if (i !== -1) favsCache.splice(i, 1); else favsCache.unshift(n);
      S.broadcast('favs');
      Y.toggleFav(n).then(function () { return Y.getFavIds(); }).then(function (ids) { favsCache = ids; S.broadcast('favs'); }).catch(function () {});
      return i === -1;
    };

    /* ---------- writes: push to cloud, pages await ---------- */
    S.placeOrder = function (opts) {
      // build the order exactly like the local store does, then push it
      const D = window.DD_DATA;
      const u = S.currentUser();
      const lines = opts.lines && opts.lines.length ? opts.lines : S.cartLines();
      const sub = lines.reduce(function (s, l) { return s + l.dish.price * l.qty; }, 0);
      const fee = sub >= D.CONFIG.freeDeliveryMin ? 0 : D.CONFIG.deliveryFee;
      const promo = opts.promo || null;
      const discount = promo ? Math.min(Math.max(0, Number(promo.discount) || 0), sub + fee) : 0;
      const now = new Date();
      const order = {
        id: '', // assigned by the database (global sequence — unique across browsers)
        userId: u ? u.id : null,
        customer: {
          name: opts.delivery.name.trim(), phone: S.canonicalPhone(opts.delivery.phone),
          address: opts.delivery.address.trim(), city: opts.delivery.city.trim(),
          note: (opts.delivery.note || '').trim()
        },
        items: lines.map(function (l) {
          return { dishId: l.dish.id, name: l.dish.name, price: l.dish.price, qty: l.qty, img: l.dish.img, note: l.note || '' };
        }),
        sub: sub, deliveryFee: fee, discount: discount,
        promoCode: promo ? promo.code : null,
        total: sub + fee - discount,
        pay: opts.pay, payStatus: opts.payStatus || 'pending', payRef: opts.payRef || null,
        payAccount: opts.payAccount || null,
        status: 'pending',
        statusHistory: [{ status: 'pending', at: now.toISOString() }],
        placedAt: now.toISOString(), etaMin: D.CONFIG.avgDeliveryMin, source: 'app'
      };
      return Y.placeOrder(order).then(function (o) { S.clearCart(); S.broadcast('orders'); return o; });
    };
    S.updateOrderStatus = function (orderId, statusKey) {
      const o = S.getOrder(orderId);
      if (!o) return Promise.resolve(null);
      if (o.status === 'delivered') return Promise.resolve(o);
      o.status = statusKey;
      o.statusHistory.push({ status: statusKey, at: new Date().toISOString() });
      return Y.updateOrder(o).then(function () { S.broadcast('orders'); return o; });
    };
    S.verifyTransfer = function (orderId) {
      const o = S.getOrder(orderId);
      if (!o) return Promise.resolve({ ok: false, error: 'Order not found.' });
      if (o.pay !== 'bank_transfer' && o.pay !== 'transfer') return Promise.resolve({ ok: false, error: 'Only bank-transfer orders can be verified.' });
      if ((o.payStatus || 'awaiting_verification') !== 'awaiting_verification') return Promise.resolve({ ok: false, error: 'This transfer is not awaiting verification.' });
      o.payStatus = 'paid'; o.verifiedAt = new Date().toISOString();
      return Y.updateOrder(o).then(function () { S.broadcast('orders'); return { ok: true, order: o }; });
    };
    S.confirmPayment = function (orderId) {
      const o = S.getOrder(orderId);
      if (!o) return Promise.resolve({ ok: false, error: 'Order not found.' });
      if (o.pay !== 'cod') return Promise.resolve({ ok: false, error: 'Only cash-on-delivery orders need payment confirmation.' });
      if ((o.payStatus || 'pending') !== 'pending') return Promise.resolve({ ok: false, error: 'This payment is not pending.' });
      o.payStatus = 'paid'; o.paidAt = new Date().toISOString();
      return Y.updateOrder(o).then(function () { S.broadcast('orders'); return { ok: true, order: o }; });
    };
    S.addFood = function (data) {
      // foods.id is a plain int primary key (no identity/default in Postgres),
      // so the client picks max+1 — same rule as the offline store. Insert with
      // .select().single() so the DB-normalized row comes back; on the rare
      // id race (two admin windows), re-pull and retry once, like placeOrder.
      const D = window.DD_DATA;
      const c = Y._state.client;
      function attempt() {
        const list = S.foods();
        const used = list.map(function (f) { return f.id; })
          .concat(D.FOODS.length ? D.FOODS.map(function (f) { return f.id; }) : [0]);
        const id = Math.max.apply(null, used) + 1;
        const f = {
          id: id, cat: data.cat, name: data.name, price: Number(data.price),
          oldPrice: data.oldPrice ? Number(data.oldPrice) : null,
          rating: 4.5, reviews: 0, prep: Number(data.prep || 20),
          tag: data.tag || null, popular: !!data.popular, inStock: !!data.inStock,
          img: data.img, desc: data.desc
        };
        const row = Y.foodToDb(f);
        return c.from('foods').insert(row).select().single()
          .then(function (res) {
            const { error, data: r2 } = res;
            if (error) throw error;
            return Y.foodFromDb(r2);
          });
      }
      return attempt()
        .catch(function (err) {
          if (err && err.code === '23505') return Y.pullCatalog().then(attempt);
          throw err;
        })
        .then(function (created) {
          return Y.pullCatalog().then(function () { return created; });
        });
    };
    S.saveFoodOverride = function (f) { return Y.upsertFood(f); };
    S.deleteFoodOverride = function (id) { return Y.deleteFood(id); };
    S.toggleStock = function (id) {
      const f = S.foods().find(function (x) { return x.id === Number(id); });
      if (!f) return Promise.resolve(null);
      return Y.upsertFood(Object.assign({}, f, { inStock: f.inStock === false })).then(function () { return f; });
    };
    S.saveCategories = function (list) { return Y.saveCategories(list); };
    S.deleteCategory = function (id) { return Y.deleteCategory(id); };
    S.catCount = function (id) { return S.foods().filter(function (f) { return f.cat === id; }).length; };
  }

  function installEventBridges() {
    // after a realtime pull, refresh session-bound caches too
    S.on('orders', function () {
      if (!active()) return;
      const u = sessionCache;
      if (u && u.role === 'admin') Y.pullUsers().then(function (list) { usersCache = list; }).catch(function () {});
    });
    // admin catalog pages need live users on load as well
    document.addEventListener('DOMContentLoaded', function () {
      if (!active()) return;
      const u = sessionCache;
      if (u && u.role === 'admin') Y.pullUsers().then(function (list) { usersCache = list; S.broadcast('users'); }).catch(function () {});
    });
  }

  function boot() {
    // Safety net: a slow or hung cloud restore must never hold the login gate
    // shut forever — release it after 12s no matter what happens.
    const guard = setTimeout(function () { Y.markAuthReady(); }, 12000);
    function release() { clearTimeout(guard); Y.markAuthReady(); }

    Y.init().then(function (st) {
      if (st.mode !== 'cloud') { release(); return; } // offline fallback: local auth wins
      install();
      installEventBridges();
      return refreshSession().then(function () {
        return Y.pullReviews().catch(function () {});
      }).then(function () {
        return Y.pullOrders().catch(function () {});
      }).then(release);
    }).catch(function () { release(); });
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { active: active, refreshSession: refreshSession, linkLanding: linkLanding };
})();

