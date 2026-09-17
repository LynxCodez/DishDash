/* ============================================================
   DISHDASH — UI layer
   ------------------------------------------------------------
   Shared chrome + components. jQuery is used here for the
   interaction layer (menus, drawers, toasts, modal transitions);
   application logic stays in plain vanilla JS.
   ============================================================ */
'use strict';

window.DD_UI = (function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;

  /* ------------------------------------------------------------
     0. Cloud sync (optional) — when supabase-config.js holds a URL
        + anon key, DD_CLOUD swaps in cloud-backed store reads and a
        status banner shows until the connection resolves. Without
        config the site runs 100% local and none of this activates.
  ------------------------------------------------------------ */
  function initCloudSync() {
    const Y = window.DD_STORE_SYNC;
    if (!Y || !Y.configPresent()) return;
    if (Y.status().connecting) banner();
    document.documentElement.addEventListener('dd:sync-ready', function () {
      const s2 = Y.status();
      if (s2.mode === 'cloud') {
        const el = document.getElementById('ddSyncBanner');
        if (el) el.remove();
      } else {
        banner(s2.error);
      }
    });
  }
  function banner(err) {
    if (document.getElementById('ddSyncBanner')) return;
    const div = document.createElement('div');
    div.id = 'ddSyncBanner';
    div.setAttribute('role', 'status');
    div.textContent = err
      ? '⚠ Cloud sync unavailable — running in local mode. (' + err + ')'
      : '◌ Connecting to DishDash cloud…';
    if (document.body) document.body.appendChild(div);
    else document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(div); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCloudSync);
  else initCloudSync();

  /* ------------------------------------------------------------
     1. Icon sprite (inline SVG symbols — feather-style strokes)
  ------------------------------------------------------------ */
  const SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">'
    + '<symbol id="i-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20.2" r="1.3"/><circle cx="18" cy="20.2" r="1.3"/><path d="M2.5 3.2h2.2l2.3 11.3a1.8 1.8 0 0 0 1.8 1.5h8.6a1.8 1.8 0 0 0 1.8-1.4L21 7.6H5.4"/></symbol>'
    + '<symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.4-4.4"/></symbol>'
    + '<symbol id="i-heart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12.9 12 20.2l-7.5-7.3a5.1 5.1 0 0 1-1.2-5.4 4.9 4.9 0 0 1 8.7-1L12 7l1-1.5a4.9 4.9 0 0 1 8.7 1 5.1 5.1 0 0 1-1.2 5.4Z"/></symbol>'
    + '<symbol id="i-heart-f" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 12.9 12 20.2l-7.5-7.3a5.1 5.1 0 0 1-1.2-5.4 4.9 4.9 0 0 1 8.7-1L12 7l1-1.5a4.9 4.9 0 0 1 8.7 1 5.1 5.1 0 0 1-1.2 5.4Z"/></symbol>'
    + '<symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></symbol>'
    + '<symbol id="i-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3.5 6.5 8.5 6.4 8.5-6.4"/></symbol>'
    + '<symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3h3l1.8 4.4-2.2 1.6a13.6 13.6 0 0 0 5.9 5.9l1.6-2.2 4.4 1.8v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3Z"/></symbol>'
    + '<symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 10.2c0 5.4-7 10.3-7 10.3s-7-4.9-7-10.3a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.6"/></symbol>'
    + '<symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></symbol>'
    + '<symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></symbol>'
    + '<symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></symbol>'
    + '<symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></symbol>'
    + '<symbol id="i-minus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></symbol>'
    + '<symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.5h17M8.5 6.5V4.8A1.3 1.3 0 0 1 9.8 3.5h4.4a1.3 1.3 0 0 1 1.3 1.3v1.7m3 1.7-.8 12a1.8 1.8 0 0 1-1.8 1.7H8.1a1.8 1.8 0 0 1-1.8-1.7l-.8-12"/><path d="M10 11v5.6M14 11v5.6"/></symbol>'
    + '<symbol id="i-chev-d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9.5 6 6 6-6"/></symbol>'
    + '<symbol id="i-chev-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 6 6 6-6 6"/></symbol>'
    + '<symbol id="i-chev-l" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6"/></symbol>'
    + '<symbol id="i-arrow-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12h15M13 5.5l6.5 6.5L13 18.5"/></symbol>'
    + '<symbol id="i-arrow-l" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12h-15M11 5.5 4.5 12 11 18.5"/></symbol>'
    + '<symbol id="i-logout" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4H6.8A1.8 1.8 0 0 0 5 5.8v12.4A1.8 1.8 0 0 0 6.8 20h7.7"/><path d="M16.5 8.5 20 12l-3.5 3.5M20 12H10.5"/></symbol>'
    + '<symbol id="i-box" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8.2-9-5.2-9 5.2v7.6l9 5.2 9-5.2Z"/><path d="M3.4 8.4 12 13.4l8.6-5M12 13.4v7.6"/></symbol>'
    + '<symbol id="i-tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12.6 3H5.8A1.8 1.8 0 0 0 4 4.8v6.8a1.8 1.8 0 0 0 .5 1.3l8 8a1.9 1.9 0 0 0 2.7 0l6.4-6.4a1.9 1.9 0 0 0 0-2.7l-8-8A1.8 1.8 0 0 0 12.6 3Z"/><circle cx="8.6" cy="8.6" r="1.3" fill="currentColor" stroke="none"/></symbol>'
    + '<symbol id="i-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m16.8 4.2 3 3L8 19l-4 1 1-4Z"/><path d="m14.5 6.5 3 3"/></symbol>'
    + '<symbol id="i-flame" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2.5-1.2-4.6-3-6.4-.5 1.4-1.6 2.3-2.5 2.9C13 9.6 13 7.3 11.5 5 8.5 7.4 8 9.8 8 11a6.4 6.4 0 0 0-.6 2.7A4.6 4.6 0 0 0 12 22Z" opacity=".25" fill="currentColor"/><path d="M12 22a7 7 0 0 0 7-7c0-2.5-1.2-4.6-3-6.4-.5 1.4-1.6 2.3-2.5 2.9C13 9.6 13 7.3 11.5 5 8.5 7.4 8 9.8 8 11a6.4 6.4 0 0 0-.6 2.7A4.6 4.6 0 0 0 12 22Z"/></symbol>'
    + '<symbol id="i-truck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h11v10H3a.5.5 0 0 1-.5-.5Z"/><path d="M15 9h3.2l3.3 3.4V15H15"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/></symbol>'
    + '<symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-3.4 8-10V5.5L12 2.5 4 5.5V12c0 6.6 8 10 8 10Z"/><path d="m9 11.5 2.2 2.2L15.5 9.5"/></symbol>'
    + '<symbol id="i-star" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.5l-5.8 3.1 1.1-6.4L2.6 9.6l6.5-.9Z"/></symbol>'
    + '<symbol id="i-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/></symbol>'
    + '<symbol id="i-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a15.8 15.8 0 0 1-2.3 3.2M6.5 6.6A15.4 15.4 0 0 0 2.5 12S6 18 12 18c1.5 0 2.8-.4 4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/></symbol>'
    + '<symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></symbol>'
    + '<symbol id="i-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5.5 15H4.8A1.8 1.8 0 0 1 3 13.2V4.8A1.8 1.8 0 0 1 4.8 3h8.4A1.8 1.8 0 0 1 15 4.8v.7"/></symbol>'
    + '<symbol id="i-wallet" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 9.5V8a2.5 2.5 0 0 1 2.5-2.5H21v4H3Z" opacity=".25" fill="currentColor"/><path d="M16.5 13.5h4.5"/></symbol>'
    + '<symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10.6 9-7.1 9 7.1V20a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 20Z"/><path d="M9.5 21.5v-6.4h5v6.4"/></symbol>'
    + '<symbol id="i-utensils" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2.5v6.4a1.9 1.9 0 0 0 1.9 1.9h.2V21.5M9.1 10.8V2.5"/><path d="M3.5 2.5c2.6 0 4.5 2 4.5 4.6M17.5 21.5V12a4.5 4.5 0 0 0-4.5-4.5c0 6 2.5 8.7 4.5 14Z" opacity=".85"/><path d="M17.5 3.2c0 4-1.5 6.8-4.5 8.8"/></symbol>'
    + '<symbol id="i-grid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/></symbol>'
    + '<symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M16 4.9a3.4 3.4 0 0 1 0 6.2M17.6 14.3a6.2 6.2 0 0 1 3.6 5.7"/></symbol>'
    + '<symbol id="i-receipt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2.8v18.4l2-1.6 2 1.6 2-1.6 2 1.6 2-1.6 2 1.6V2.8l-2 1.6-2-1.6-2 1.6-2-1.6-2 1.6Z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></symbol>'
    + '<symbol id="i-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V13M12 16.4v.1"/></symbol>'
    + '<symbol id="i-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11.2v5.3M12 7.4v.1"/></symbol>'
    + '<symbol id="i-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6L20 8.5"/><path d="M20 3.5v5h-5"/></symbol>'
    + '<symbol id="i-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M16 2.8V7M8 2.8V7M3.5 10.5h17"/></symbol>'
    + '<symbol id="i-bag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7.5V6a6 6 0 0 1 12 0v1.5"/><path d="M4.6 7.5h14.8a1.4 1.4 0 0 1 1.4 1.5l-.9 10a2 2 0 0 1-2 1.8H6.1a2 2 0 0 1-2-1.8l-.9-10A1.4 1.4 0 0 1 4.6 7.5Z"/><path d="M9.5 11v1.5a2.5 2.5 0 0 0 5 0V11"/></symbol>'
    + '</svg>';

  /* ------------------------------------------------------------
     2. Tiny utilities
  ------------------------------------------------------------ */
  const $ = window.jQuery;
  const esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  function ic(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }
  function fmtN(n) { return D.naira(n); }
  /* Live review summary for a dish (chip display). Returns null when the app
     has no reviews for it, so callers fall back to the seeded rating. */
  function ratingSummaryOf(foodId) {
    try {
      const fn = window.DD_STORE.ratingSummary;
      const s = fn ? fn(Number(foodId)) : null;
      return s && s.count > 0 ? s : null;
    } catch (e) { return null; }
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
  }
  function qs() { return new URLSearchParams(window.location.search); }
  function getParam(k) { return qs().get(k); }
  function isAdminPage() { return /\/admin\//.test(window.location.pathname) || document.body.classList.contains('admin-page'); }
  function isPage(which) { return document.body.getAttribute('data-page') === which; }
  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }
  function go(url) { window.location.href = url; }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(iso) {
    const d = new Date(iso);
    const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return day + ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fmtDateShort(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  function timeAgo(iso) {
    const diff = Date.now() - Date.parse(iso);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    const d = Math.floor(h / 24);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }
  function etaClock(iso, minutes) {
    const d = new Date(Date.parse(iso) + minutes * 60000);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /* ------------------------------------------------------------
     3. Logo mark + wordmark
  ------------------------------------------------------------ */
  function logoMark(cls) {
    return '<span class="logo-mark' + (cls || '') + '">'
      + '<svg viewBox="0 0 24 24" width="62%" height="62%" aria-hidden="true"><circle cx="12" cy="11" r="6.4" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="12" cy="11" r="1.9" fill="#fff"/><path d="M7.2 17.6c1 1 2.9 1.7 4.8 1.7s3.8-.7 4.8-1.7" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>'
      + '</span>';
  }
  function logoHTML(light) {
    return '<a class="logo" href="' + rootPath() + 'index.html" aria-label="DishDash — home">'
      + logoMark() + '<span class="logo-text' + (light ? ' light' : '') + '">Dish<em>Dash</em></span></a>';
  }
  function rootPath() {
    // prefix for links depending on folder depth (/admin/ etc)
    return isAdminPage() ? '../' : '';
  }

  /* ------------------------------------------------------------
     4. Food image with graceful fallback
  ------------------------------------------------------------ */
  function catOf(id) {
    return S.getCategory(id) || { id: id || '', emoji: '🍽️', name: 'Food' };
  }
  function imgCover(dish, cls) {
    const emoji = catOf(dish.cat).emoji;
    return '<div class="img-cover ' + (cls || '') + '" role="img" aria-label="' + esc(dish.name) + '">'
      + '<span class="img-emoji" aria-hidden="true">' + emoji + '</span>'
      + '<img src="' + D.img(dish.img, 600) + '" alt="' + esc(dish.name) + '" loading="lazy" decoding="async" onerror="this.remove()">'
      + '</div>';
  }

  /* ------------------------------------------------------------
     5. Star rating row
  ------------------------------------------------------------ */
  function starRow(rating, cls) {
    const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
    function five(fillCls) {
      let s = '';
      for (let i = 0; i < 5; i++) s += '<svg class="' + (fillCls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.5l-5.8 3.1 1.1-6.4L2.6 9.6l6.5-.9Z"/></svg>';
      return '<span class="st-row">' + s + '</span>';
    }
    return '<span class="stars ' + (cls || '') + '" role="img" aria-label="Rated ' + rating + ' out of 5">'
      + '<span class="st-gray">' + five('') + '</span>'
      + '<span class="st-fill" style="width:' + pct + '%">' + five('') + '</span>'
      + '</span>';
  }
  // note: gray base must sit under colored overlay; handled via .stars .st-fill with ::after? see CSS below override

  /* ------------------------------------------------------------
     6. Status helpers
  ------------------------------------------------------------ */
  const STATUS_ICON = { pending: 'clock', confirmed: 'check', preparing: 'flame', outfordelivery: 'truck', delivered: 'box' };
  function statusBadge(key) {
    const s = D.STATUS_FLOW.find(function (x) { return x.key === key; }) || { key: key, label: key };
    return '<span class="st-badge st-' + s.key + '">' + ic(STATUS_ICON[s.key] || 'clock') + esc(s.label) + '</span>';
  }
  function statusLabel(key) {
    const s = D.STATUS_FLOW.find(function (x) { return x.key === key; });
    return s ? s.label : key;
  }

  /* payment status — deliberately separate from order status.
     payStatusOf also maps orders saved before the payment upgrade
     (no payStatus field, old 'transfer' key) so old localStorage data
     keeps rendering correctly. */
  function payStatusOf(o) {
    if (o.payStatus) return o.payStatus;
    if (o.pay === 'card') return 'paid';
    if (o.pay === 'bank_transfer' || o.pay === 'transfer') return 'awaiting_verification';
    return 'pending';
  }
  function payMethodLabel(key) {
    if (key === 'transfer') return 'Bank transfer';
    const m = (D.PAY_METHODS || []).find(function (x) { return x.key === key; });
    return m ? m.label : (key || '—');
  }
  function payBadge(status) {
    const meta = D.PAY_STATUS[status] || { label: status || 'unknown' };
    const cls = status === 'awaiting_verification' ? 'pay-awaiting' : 'pay-' + status;
    const icon = status === 'paid' ? 'check' : 'clock';
    return '<span class="pay-badge ' + cls + '">' + ic(icon) + esc(meta.label) + '</span>';
  }

  /* ------------------------------------------------------------
     7. Food card component
  ------------------------------------------------------------ */
  function foodCardHTML(dish, o) {
    o = o || {};
    const cat = catOf(dish.cat);
    const favOn = S.isFav(dish.id);
    const tag = dish.tag;
    const out = dish.inStock === false;
    // Live rating chip: real review average when reviews exist, seeded number otherwise.
    const live = ratingSummaryOf(dish.id);
    const ratingChip = '<span class="fd-rating" title="'
      + (live ? live.count + ' customer review' + (live.count === 1 ? '' : 's') + ', average ' + live.avg.toFixed(1) + ' of 5'
             : 'Menu rating')
      + '">' + ic('star') + (live ? live.avg.toFixed(1) : dish.rating.toFixed(1))
      + (live ? '<span class="fd-rcount">(' + live.count + ')</span>' : '') + '</span>';
    const tagHTML = tag ? '<span class="badge badge-warn tag-food">' + esc(tag) + '</span>' : '';
    const priceHTML = '<span class="fd-price">'
      + '<span class="now">' + fmtN(dish.price) + '</span>'
      + (dish.oldPrice ? '<span class="was">' + fmtN(dish.oldPrice) + '</span>' : '')
      + '</span>';
    const favBtn = '<button class="fav-btn' + (favOn ? ' on' : '') + '" data-fav="' + dish.id + '" aria-pressed="' + favOn + '" aria-label="' + (favOn ? 'Remove ' : 'Save ') + esc(dish.name) + ' to favourites">'
      + ic(favOn ? 'heart-f' : 'heart') + '</button>';
    const addBtn = out
      ? '<button class="add-btn" disabled title="Currently unavailable"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
      : '<button class="add-btn" data-add="' + dish.id + '" aria-label="Add ' + esc(dish.name) + ' to cart">' + ic('plus') + '</button>';
    return '<article class="food-card' + (out ? ' is-out' : '') + '" data-reveal data-food-id="' + dish.id + '">'
      + '<div class="fd-media">' + tagHTML
      + '<span class="img-emoji" aria-hidden="true">' + cat.emoji + '</span>'
      + '<img src="' + D.img(dish.img, 560) + '" alt="' + esc(dish.name) + '" loading="lazy" decoding="async" onerror="this.remove()">'
      + (out ? '<span class="soldout-chip">' + ic('x') + ' Sold out</span>' : '')
      + favBtn
      + '</div>'
      + '<div class="fd-body">'
      + '<div class="fd-top"><a class="fd-name" href="' + rootPath() + 'food.html?id=' + dish.id + '">' + esc(dish.name) + '</a>' + ratingChip + '</div>'
      + '<p class="fd-desc">' + esc(dish.desc) + '</p>'
      + '<div class="fd-foot">' + priceHTML + addBtn + '</div>'
      + '</div></article>';
  }

  /* ------------------------------------------------------------
     8. Toast notifications
  ------------------------------------------------------------ */
  function toast(title, msg, type, dur, goTo) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'success') + (goTo ? ' t-link' : '');
    const icon = type === 'error' ? 'alert' : (type === 'info' ? 'info' : 'check');
    el.innerHTML = '<span class="t-ico">' + ic(icon) + '</span>'
      + '<div><b>' + esc(title) + '</b>' + (msg ? '<small>' + esc(msg) + '</small>' : '') + '</div>'
      + '<span class="t-prog"></span>';
    if (goTo) el.setAttribute('role', 'link');
    wrap.appendChild(el);
    requestAnimationFrame(function () {
      el.classList.add('in');
      const prog = el.querySelector('.t-prog');
      if (prog) {
        prog.style.transition = 'transform ' + (dur || 3400) + 'ms linear';
        requestAnimationFrame(function () { prog.style.transform = 'scaleX(0)'; });
      }
    });
    const t = setTimeout(function () { dismiss(el); }, dur || 3400);
    el.addEventListener('click', function () {
      clearTimeout(t); dismiss(el);
      if (goTo) setTimeout(function () { window.location.href = goTo; }, 180);
    });
    function dismiss(node) {
      node.classList.remove('in');
      node.style.transition = 'transform .25s ease, opacity .25s ease';
      setTimeout(function () { node.remove(); }, 260);
    }
  }

  /* ------------------------------------------------------------
     8b. Order status watcher (customer pages only)
     Polls the signed-in customer's orders and toasts when a status
     changes, so progress is visible without sitting on the tracker.
     First sight of an order is recorded silently (no toast spam on
     page load); later changes announce themselves.
  ------------------------------------------------------------ */
  function seenMap() {
    try { return JSON.parse(localStorage.getItem('dishdash_notified') || '{}') || {}; } catch (e) { return {}; }
  }
  function saveSeenMap(map) {
    // keep only the 40 most recent entries so the map can't grow unbounded
    const keep = Object.keys(map)
      .map(function (k) { return [k, map[k]]; })
      .sort(function (a, b) { return (b[1].at || 0) - (a[1].at || 0); })
      .slice(0, 40);
    const out = {};
    keep.forEach(function (e) { out[e[0]] = e[1]; });
    try { localStorage.setItem('dishdash_notified', JSON.stringify(out)); } catch (err) { /* storage full/blocked */ }
  }
  function startOrderWatch() {
    if (isAdminPage()) return;
    function tick() {
      const u = S.currentUser();
      if (!u || u.role === 'admin') return;
      const mine = S.orders().filter(function (o) { return o.userId === u.id; });
      const seen = seenMap();
      let changed = false;
      mine.forEach(function (o) {
        const prev = seen[o.id];
        if (!prev) {
          seen[o.id] = { status: o.status, at: Date.now() };
          changed = true;
        } else if (prev.status !== o.status) {
          seen[o.id] = { status: o.status, at: Date.now() };
          changed = true;
          const label = statusLabel(o.status);
          const type = o.status === 'delivered' ? 'success' : 'info';
          toast('Order ' + o.id + ' update', 'Your order is now ' + label + ' — tap to track.', type, 5200, 'tracking.html?id=' + o.id);
        }
      });
      if (changed) saveSeenMap(seen);
    }
    tick();
    setInterval(tick, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    S.on('orders', tick);
  }

  /* ------------------------------------------------------------
     9. Modal system
  ------------------------------------------------------------ */
  function openModal(html, opts) {
    opts = opts || {};
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.setAttribute('role', 'dialog');
    bg.setAttribute('aria-modal', 'true');
    bg.innerHTML = '<div class="modal' + (opts.size === 'lg' ? ' lg' : '') + '" role="document">'
      + (opts.hideHead ? '' : '<div class="modal-head"><h3>' + (opts.title || '') + '</h3><button class="modal-close" aria-label="Close dialog">' + ic('x') + '</button></div>')
      + '<div class="modal-body">' + html + '</div>'
      + (opts.foot ? '<div class="modal-foot">' + opts.foot + '</div>' : '')
      + '</div>';
    document.body.appendChild(bg);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { bg.classList.add('open'); });
    function close() {
      bg.classList.remove('open');
      document.body.style.overflow = '';
      if (bg._cleanupEsc) bg._cleanupEsc();
      setTimeout(function () { bg.remove(); }, 200);
    }
    bg.addEventListener('click', function (e) { if (e.target === bg && !opts.static) close(); });
    bg.querySelector('.modal-close').addEventListener('click', close);
    const escHandler = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escHandler);
    bg._cleanupEsc = function () { document.removeEventListener('keydown', escHandler); };
    bg._close = close;
    bg._onClose = function (fn) { bg._fn = fn; };
    const origClose = close;
    bg.close = function () {
      if (bg._fn) bg._fn();
      origClose();
    };
    if (typeof opts.onOpen === 'function') opts.onOpen(bg);
    bg.addEventListener('modal-close-event', function () {});
    return bg;
  }
  // replace esc key handler management: store close to remove listener
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      const icon = opts.icon || 'trash';
      const html = '<div class="modal-ico-err">' + ic(icon) + '</div>'
        + '<div class="modal-msg"><h3 style="font-size:1.15rem">' + esc(opts.title || 'Are you sure?') + '</h3>'
        + (opts.msg ? '<p>' + esc(opts.msg) + '</p>' : '')
        + (opts.detail ? '<p style="margin-top:8px"><b>' + esc(opts.detail) + '</b></p>' : '')
        + '</div>';
      const foot = '<button class="btn btn-ghost" data-cancel>Cancel</button>'
        + '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(opts.okText || 'Yes, continue') + '</button>';
      const modal = openModal(html, { title: 'Please confirm', foot: foot, static: true });
      modal.querySelector('[data-cancel]').addEventListener('click', function () { modal.close(); resolve(false); });
      modal.querySelector('[data-ok]').addEventListener('click', function () { modal.close(); resolve(true); });
    });
  }

  /* ------------------------------------------------------------
     10. Printable receipt (new window, self-contained)
  ------------------------------------------------------------ */
  function printReceipt(o) {
    if (!o) { toast('Nothing to print', 'That order could not be found.', 'error'); return; }
    const w = window.open('', '_blank', 'width=760,height=920');
    if (!w) { toast('Popup blocked', 'Allow pop-ups for DishDash to print your receipt.', 'error', 4200); return; }

    const etaMin = o.etaMin || D.CONFIG.avgDeliveryMin;
    const payStatus = payStatusOf(o);
    const payMeta = D.PAY_STATUS[payStatus] || { label: payStatus || '—' };
    const method = payMethodLabel(o.pay) + (o.pay === 'card' ? ' (simulated)' : '');
    const rows = o.items.map(function (it) {
      return '<tr><td class="it"><b>' + esc(it.name) + '</b>'
        + (it.note ? '<span class="it-note">' + esc(it.note) + '</span>' : '')
        + '</td><td class="q">&times; ' + it.qty + '</td>'
        + '<td class="amt">' + fmtN(it.price * it.qty) + '</td></tr>';
    }).join('');

    const html = '<!doctype html><html><head><meta charset="utf-8">'
      + '<title>DishDash receipt — ' + esc(o.id) + '</title>'
      + '<style>'
      + '*{box-sizing:border-box;margin:0;padding:0}'
      + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#241b15;background:#e8e4de;padding:28px 14px}'
      + '.sheet{max-width:640px;margin:0 auto;background:#fff;border-radius:18px;padding:34px 38px 26px;box-shadow:0 14px 40px rgba(36,27,21,.14);border:1px solid #efe9e1}'
      + '.no-print{max-width:640px;margin:0 auto 14px;display:flex;gap:10px;justify-content:flex-end}'
      + '.no-print button{border:0;border-radius:10px;padding:10px 18px;font-size:.92rem;font-weight:750;cursor:pointer;background:#1f1611;color:#fff;font-family:inherit}'
      + '.no-print button.ghost{background:#fff;color:#241b15;border:1px solid #d9d2c8}'
      + '.brand{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-bottom:16px;border-bottom:2px dashed #e2d9cd}'
      + '.brand .word{font-size:1.55rem;font-weight:900;letter-spacing:-.02em}'
      + '.brand .word .dash{color:#e65c24}'
      + '.brand .tag{font-size:.68rem;font-weight:800;letter-spacing:.16em;color:#b53d0e;background:#fdeee5;border:1px solid #f9dcc7;padding:5px 10px;border-radius:99px}'
      + '.head{padding:20px 0 4px;text-align:center}'
      + '.head h1{font-size:1.15rem;letter-spacing:-.01em}'
      + '.head p{color:#7d6f62;font-size:.9rem;margin-top:4px}'
      + '.idline{display:flex;justify-content:center;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}'
      + '.idline .oid{font-size:1.25rem;font-weight:900;letter-spacing:.01em;color:#241b15}'
      + '.chip{font-size:.72rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:5px 12px;border-radius:99px;border:1px solid #eadfc9;background:#fdf6e9;color:#8a6412}'
      + '.chip.pay{background:#eaf6ee;border-color:#d3ecdc;color:#127a3e}'
      + '.chip.pay.await{background:#fdf1e3;border-color:#f5ddbb;color:#a85c0c}'
      + '.meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:16px 0 4px;font-size:.82rem;color:#7d6f62}'
      + '.meta b{color:#3b2c22;font-weight:700}'
      + 'table{width:100%;border-collapse:collapse;margin-top:14px}'
      + 'th{font-size:.68rem;letter-spacing:.14em;color:#a08b79;text-transform:uppercase;text-align:left;padding:8px 6px;border-bottom:1px solid #efe8de}'
      + 'th.r,td.r{text-align:right}'
      + 'td{padding:10px 6px;border-bottom:1px dashed #f1ece3;font-size:.93rem}'
      + 'td.it b{font-weight:650}'
      + '.it-note{display:block;font-size:.78rem;color:#8a7a6d;font-style:italic;margin-top:2px}'
      + 'td.q{color:#8b7a6a;white-space:nowrap;width:1%;padding-right:8px}'
      + 'td.amt{text-align:right;font-weight:700;white-space:nowrap}'
      + '.sums{margin-left:auto;width:min(100%,320px);padding-top:6px}'
      + '.sums .r{display:flex;justify-content:space-between;padding:7px 6px;font-size:.92rem;color:#4a382c}'
      + '.sums .r b{font-weight:700}'
      + '.sums .r.total{margin-top:8px;border-top:2px solid #241b15;padding-top:12px;font-size:1.08rem;font-weight:900;color:#1f1611}'
      + '.sums .r.disc{color:#127a3e}'
      + '.sums .r .free{color:#127a3e;font-weight:800;font-size:.85rem}'
      + '.block{margin-top:20px;padding-top:16px;border-top:2px dashed #e2d9cd}'
      + '.block h3{font-size:.7rem;letter-spacing:.15em;color:#a08b79;text-transform:uppercase;margin-bottom:8px}'
      + '.kv{display:flex;justify-content:space-between;gap:18px;font-size:.9rem;padding:4px 0;color:#3b2c22}'
      + '.kv b{color:#241b15}'
      + '.kv span{text-align:right;color:#4a382c}'
      + '.cols{display:grid;grid-template-columns:1fr 1fr;gap:26px}'
      + '.note{margin-top:6px;font-size:.82rem;color:#8b7a6a}'
      + '.foot{margin-top:24px;padding-top:14px;border-top:2px dashed #e2d9cd;text-align:center;font-size:.8rem;color:#8b7a6a}'
      + '.foot .slogan{font-weight:800;color:#e65c24;letter-spacing:.02em;margin-bottom:4px}'
      + '.payline{font-size:.9rem}'
      + '@media(max-width:560px){.cols{grid-template-columns:1fr}.sheet{padding:24px 20px 20px}}'
      + '@media print{body{background:#fff;padding:0}.sheet{border:0;box-shadow:none;border-radius:0;padding:8px 4px 0}.no-print{display:none}}'
      + '</style></head><body>'
      + '<div class="no-print"><button onclick="window.print()">&#128424; Print / Save as PDF</button>'
      + '<button class="ghost" onclick="window.close()">Close</button></div>'
      + '<div class="sheet">'
      + '<div class="brand"><div class="word">Dish<span class="dash">Dash</span></div>'
      + '<span class="tag">Order receipt</span></div>'
      + '<div class="head"><h1>Thank you for ordering with DishDash!</h1>'
      + '<p>Here\'s your receipt for <b>' + esc(o.id) + '</b> &mdash; keep it for your records.</p></div>'
      + '<div class="idline"><span class="oid">' + esc(o.id) + '</span>'
      + '<span class="chip">' + esc(statusLabel(o.status)) + '</span>'
      + '<span class="chip pay' + (payStatus === 'awaiting_verification' ? ' await' : '') + '">' + esc(payMeta.label) + '</span></div>'
      + '<div class="meta"><span><b>Placed:</b> ' + esc(fmtDate(o.placedAt)) + '</span>'
      + '<span><b>Estimated delivery:</b> by ' + esc(etaClock(o.placedAt, etaMin)) + ' (avg ' + etaMin + ' min)</span></div>'
      + '<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<div class="sums">'
      + '<div class="r"><span>Subtotal</span><b>' + fmtN(o.sub) + '</b></div>'
      + '<div class="r"><span>Delivery fee</span><b>' + (o.deliveryFee === 0 ? '<span class="free">FREE</span>' : fmtN(o.deliveryFee)) + '</b></div>'
      + (o.discount > 0 ? '<div class="r disc"><span>Promo discount ' + (o.promoCode ? '(' + esc(o.promoCode) + ')' : '') + '</span><b>&minus;' + fmtN(o.discount) + '</b></div>' : '')
      + '<div class="r total"><span>Total</span><b>' + fmtN(o.total) + '</b></div>'
      + '</div>'
      + '<div class="cols">'
      + '<div class="block"><h3>Deliver to</h3>'
      + '<div class="kv"><b>Name</b><span>' + esc(o.customer.name) + '</span></div>'
      + '<div class="kv"><b>Phone</b><span>' + esc(o.customer.phone) + '</span></div>'
      + '<div class="kv"><b>Address</b><span>' + esc(o.customer.address) + ', ' + esc(o.customer.city) + '</span></div>'
      + (o.customer.note ? '<div class="note">Note: ' + esc(o.customer.note) + '</div>' : '')
      + '</div>'
      + '<div class="block"><h3>Payment</h3>'
      + '<div class="kv payline"><b>Method</b><span>' + esc(method) + '</span></div>'
      + '<div class="kv payline"><b>Status</b><span>' + esc(payMeta.label) + '</span></div>'
      + (o.payRef ? '<div class="kv payline"><b>Reference</b><span>' + esc(o.payRef) + '</span></div>' : '')
      + (o.verifiedAt ? '<div class="kv payline"><b>Verified</b><span>' + esc(fmtDate(o.verifiedAt)) + '</span></div>' : '')
      + '<div class="note">Simulated demo payment &mdash; no real money was moved.</div>'
      + '</div>'
      + '</div>'
      + '<div class="foot"><div class="slogan">DishDash &middot; Good food. Fast delivery.</div>'
      + 'DishDash Foods (Demo) &middot; Lagos, Nigeria &middot; hello@dishdash.ng &middot; +234 700 000 4747</div>'
      + '</div>'
      + '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});<\/script>'
      + '</body></html>';

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  /* ------------------------------------------------------------
     11. Cart UI sync (badge, FAB)
  ------------------------------------------------------------ */
  function cartUISync(bump) {
    const sum = S.cartSummary();
    const count = sum.count;
    // header badge
    document.querySelectorAll('[data-cart-count]').forEach(function (n) {
      n.textContent = count;
      n.style.display = count ? 'inline-flex' : 'none';
    });
    // header cart button total
    document.querySelectorAll('[data-cart-total]').forEach(function (n) {
      n.textContent = count ? fmtN(sum.total) : '';
      n.style.display = count ? '' : 'none';
    });
    // FAB
    const fab = document.querySelector('.cart-fab');
    if (fab) {
      const hide = count === 0 || isPage('cart') || isPage('checkout') || isPage('confirmation') || isAdminPage();
      fab.classList.toggle('hidden', hide);
      fab.querySelector('[data-fab-count]').textContent = count;
      fab.querySelector('[data-fab-total]').textContent = fmtN(sum.total);
      if (bump && count) {
        fab.classList.remove('up');
        void fab.offsetWidth;
        fab.classList.add('up');
      }
    }
    // bump the cart button
    if (bump) {
      document.querySelectorAll('[data-cart-btn]').forEach(function (btn) {
        btn.classList.remove('bump');
        void btn.offsetWidth;
        btn.classList.add('bump');
      });
    }
  }

  function refreshChrome() {
    const header = document.getElementById('ddHeader');
    const footer = document.getElementById('ddFooter');
    if (header) header.innerHTML = '';
    if (footer) footer.innerHTML = '';
    if (isAdminPage()) {
      if (document.getElementById('ddAdminSide')) renderAdminChrome();
    } else {
      renderChrome();
    }
    cartUISync(false);
  }

  /* ------------------------------------------------------------
     11. Chrome — customer header & footer
  ------------------------------------------------------------ */
  const NAV_LINKS = [
    { page: 'home', label: 'Home', icon: 'home', href: 'index.html' },
    { page: 'menu', label: 'Menu', icon: 'utensils', href: 'menu.html' },
    { page: 'favorites', label: 'Favourites', icon: 'heart', href: 'favorites.html' },
    { page: 'orders', label: 'Orders', icon: 'receipt', href: 'orders.html' }
  ];

  function currentNavPage() {
    const page = document.body.getAttribute('data-page');
    if (page) return page;
    const p = window.location.pathname.split('/').pop() || 'index.html';
    if (p === 'index.html' || p === '') return 'home';
    const m = p.match(/^(menu|favorites|favorites\.html|orders|food|cart|checkout|confirmation|tracking|profile|login|register|verify)\.html?$/);
    return m ? m[1] : '';
  }

  /* A standing reminder for a signed-in customer who has not confirmed their
     address. Pointless on the verification page itself, and never shown in the
     admin console — admins do not place orders. */
  function verifyBannerHTML() {
    const user = S.currentUser();
    if (!user) return '';
    if (isPage('verify') || isAdminPage()) return '';
    if (S.emailVerified(user)) return '';
    return '<div class="verify-banner" data-verify-banner role="status">'
      + ic('shield')
      + '<span><b>Confirm your email address.</b> Browse and fill your cart as normal — '
      + 'verifying is only needed before an order goes through.</span>'
      + '<a class="btn btn-primary btn-sm" href="' + rootPath() + 'verify.html">Verify now</a>'
      + '</div>';
  }

  function renderChrome() {
    const header = document.getElementById('ddHeader');
    const footer = document.getElementById('ddFooter');
    const rp = rootPath();
    const user = S.currentUser();
    const active = currentNavPage();
    const cartCount = S.cartCount();

    if (header) {
      const links = NAV_LINKS.map(function (l) {
        const activeClass = active === l.page ? ' active' : '';
        const extra = l.page === 'favorites' ? ' data-favlink' : '';
        return '<a class="nav-link' + activeClass + '" href="' + rp + l.href + '"' + extra + '>' + esc(l.label) + '</a>';
      }).join('');
      const adminLink = user && user.role === 'admin'
        ? '<a class="nav-link ' + (active === 'admin' ? 'active' : '') + '" href="' + rp + 'admin/index.html">Admin</a>' : '';

      const right = user
        ? '<div class="acct-wrap"><button class="btn-acct" data-acct aria-haspopup="true" aria-expanded="false">'
        + '<span class="avatar">' + initials(user.name) + '</span><span class="acct-name">' + esc(user.name.split(' ')[0]) + '</span>'
        + '<svg class="ic" style="color:var(--muted)" aria-hidden="true"><use href="#i-chev-d"></use></svg></button>'
        + '<div class="acct-menu">'
        + '<div class="am-head"><div class="am-name">' + esc(user.name) + '</div><div class="am-mail">' + esc(user.email) + '</div></div>'
        + '<a href="' + rp + 'profile.html"><span class="am-ic">' + ic('user') + '</span>My profile</a>'
        + '<a href="' + rp + 'favorites.html"><span class="am-ic">' + ic('heart') + '</span>Favourites</a>'
        + '<a href="' + rp + 'orders.html"><span class="am-ic">' + ic('receipt') + '</span>My orders</a>'
        + (user.role === 'admin' ? '<a href="' + rp + 'admin/index.html"><span class="am-ic">' + ic('grid') + '</span>Admin console</a>' : '')
        + '<div class="sep"></div>'
        + '<button data-logout class="danger"><span class="am-ic">' + ic('logout') + '</span>Sign out</button>'
        + '</div></div>'
        : '<a class="btn btn-primary btn-sm" href="' + rp + 'login.html">Sign in</a>';

      header.innerHTML =
        '<header class="site-header" id="siteHeader">'
        + '<a class="visually-hidden" href="#appMain">Skip to main content</a>'
        + '<div class="container nav-inner">'
        + logoHTML()
        + '<nav class="nav-links" aria-label="Main">' + links + adminLink + '</nav>'
        + '<div class="header-actions">'
        + right
        + '<button class="cart-btn" data-cart-btn onclick="window.location.href=\'' + rp + 'cart.html\'" aria-label="View cart">'
        + '<span class="c-ic">' + ic('cart')
        + '<span class="cart-count" data-cart-count style="display:' + (cartCount ? 'inline-flex' : 'none') + '">' + cartCount + '</span></span>'
        + '<span class="cart-total" data-cart-total style="display:' + (cartCount ? '' : 'none') + '">' + (cartCount ? fmtN(S.cartSummary().total) : '') + '</span>'
        + '</button>'
        + '<button class="burger-btn" data-burger aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>'
        + '</div></div></header>'
        + verifyBannerHTML()
        + '<div class="drawer-bg" data-drawer-bg></div>'
        + '<aside class="drawer" data-drawer aria-label="Mobile menu" role="dialog" aria-modal="true">'
        + '<div class="drawer-head">' + logoHTML() + '<button class="btn-icon" data-drawer-close aria-label="Close menu">' + ic('x') + '</button></div>'
        + '<div class="drawer-body"><nav class="drawer-nav">'
        + NAV_LINKS.map(function (l) {
          return '<a class="' + (active === l.page ? 'active' : '') + '" href="' + rp + l.href + '"><span class="d-ic">' + ic(l.icon) + '</span>' + esc(l.label) + '</a>';
        }).join('')
        + (user && user.role === 'admin' ? '<a class="' + (active === 'admin' ? 'active' : '') + '" href="' + rp + 'admin/index.html"><span class="d-ic">' + ic('grid') + '</span>Admin console</a>' : '')
        + '</nav></div>'
        + '<div class="drawer-foot">'
        + (user
          ? '<a class="btn btn-outline btn-sm" href="' + rp + 'profile.html">' + ic('user') + ' Profile</a><button class="btn btn-ghost btn-sm danger" data-logout style="color:var(--err)">' + ic('logout') + ' Sign out</button>'
          : '<a class="btn btn-primary btn-sm btn-block" href="' + rp + 'login.html">Sign in</a>')
        + '</div></aside>';
    }

    if (footer) {
      footer.innerHTML =
        '<footer class="site-footer"><div class="container f-inner">'
        + '<div class="f-grid">'
        + '<div class="f-brand">'
        + logoHTML(true)
        + '<p>Good food, fast delivery. Real meals cooked fresh and delivered hot across your city — from classic burgers to party-style jollof.</p>'
        + '<div class="f-social">'
        + '<a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram (opens in a new tab)"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".4" fill="currentColor"/></svg></a>'
        + '<a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter) (opens in a new tab)"><svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4l7.1 9.3L4.4 20h2.2l5.5-5.5L16.8 20H20l-7.4-9.7L18.9 4h-2.2l-5 5L7.2 4H4z"/></svg></a>'
        + '<a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook (opens in a new tab)"><svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7h2.6l.5-3h-3.1V9.1c0-.9.4-1.6 1.7-1.6h1.5V4.8c-.8-.1-1.7-.2-2.6-.2-2.6 0-4.1 1.5-4.1 4.4V11H7.4v3h2.6v7h3.5z"/></svg></a>'
        + '</div></div>'
        + '<div class="f-col"><h4>Explore</h4>'
        + '<a href="' + rp + 'index.html">Home</a><a href="' + rp + 'menu.html">Full menu</a>'
        + '<a href="' + rp + 'food.html?id=10">Today\'s specials</a><a href="' + rp + 'cart.html">View cart</a>'
        + '</div>'
        + '<div class="f-col"><h4>Account</h4>'
        + '<a href="' + rp + 'profile.html">My profile</a><a href="' + rp + 'orders.html">Order history</a>'
        + '<a href="' + rp + 'favorites.html">Favourites</a><a href="' + rp + 'login.html">Sign in</a>'
        + '</div>'
        + '<div class="f-col"><h4>Get in touch</h4>'
        + '<ul class="f-contact">'
        + '<li>' + ic('phone') + '<span><b style="color:#fff">' + D.CONFIG.supportPhone + '</b><br>Mon–Sun, 9am–10pm</span></li>'
        + '<li>' + ic('mail') + '<span>' + D.CONFIG.supportEmail + '</span></li>'
        + '<li>' + ic('pin') + '<span>Lagos, Nigeria — delivering city-wide</span></li>'
        + '</ul>'
        + '<button type="button" class="f-feedback" data-feedback>' + ic('mail') + ' Tell us how we\'re doing</button>'
        + '</div>'
        + '</div>'
        + '<div class="f-bottom"><span>© ' + new Date().getFullYear() + ' DishDash · Good food. Fast delivery.</span>'
        + '<span class="pay-txt">' + ic('shield') + ' Demo project — payments are simulated. No real charges.</span></div>'
        + '</div></footer>';
    }

    // FAB
    const hideFab = isPage('cart') || isPage('checkout') || isPage('confirmation') || isAdminPage();
    if (!document.querySelector('.cart-fab')) {
      const fab = document.createElement('div');
      fab.className = 'cart-fab' + (hideFab || cartCount === 0 ? ' hidden' : '');
      fab.setAttribute('role', 'button');
      fab.setAttribute('tabindex', '0');
      fab.innerHTML = '<span class="fab-ic">' + ic('cart') + '<span class="fab-count" data-fab-count>' + cartCount + '</span></span>'
        + '<span>View cart</span><span class="fab-total" data-fab-total>' + (cartCount ? fmtN(S.cartSummary().total) : '') + '</span>';
      fab.addEventListener('click', function () { go(rp + 'cart.html'); });
      fab.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(rp + 'cart.html'); });
      document.body.appendChild(fab);
    }
    bindChromeEvents();
  }

  function bindChromeEvents() {
    // header scroll shadow
    const header = document.getElementById('siteHeader');
    if (header) {
      const onScroll = debounce(function () {
        header.classList.toggle('scrolled', window.scrollY > 8);
      }, 40);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    // burger + drawer
    const burger = document.querySelector('[data-burger]');
    const drawer = document.querySelector('[data-drawer]');
    const dg = document.querySelector('[data-drawer-bg]');
    function closeDrawer() {
      if (!drawer) return;
      drawer.classList.remove('open');
      if (dg) dg.classList.remove('open');
      if (burger) burger.classList.remove('open');
      burger && burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    function openDrawer() {
      if (!drawer) return;
      drawer.classList.add('open');
      if (dg) dg.classList.add('open');
      burger && burger.classList.add('open');
      burger && burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    burger && burger.addEventListener('click', function () {
      drawer.classList.contains('open') ? closeDrawer() : openDrawer();
    });
    dg && dg.addEventListener('click', closeDrawer);
    document.querySelector('[data-drawer-close]') && document.querySelector('[data-drawer-close]').addEventListener('click', closeDrawer);
    drawer && drawer.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeDrawer); });

    // account dropdown
    const acct = document.querySelector('[data-acct]');
    const menu = document.querySelector('.acct-menu');
    function closeAcct() {
      if (menu) menu.classList.remove('open');
      acct && acct.setAttribute('aria-expanded', 'false');
    }
    acct && acct.addEventListener('click', function (e) {
      e.stopPropagation();
      menu && menu.classList.toggle('open');
      acct.setAttribute('aria-expanded', menu.classList.contains('open'));
    });
    document.addEventListener('click', function (e) {
      if (!(e.target.closest && e.target.closest('.acct-wrap'))) closeAcct();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAcct(); });

    // logout buttons (delegated — drawer + dropdown)
    document.querySelectorAll('[data-logout]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.logout();
        toast('Signed out', 'See you soon — your cart is still here.');
        refreshChrome();
        // Always land on the sign-in page: matches user expectations after an
        // explicit sign-out and avoids leaving an authenticated view on screen.
        go(rootPath() + 'login.html');
      });
    });
  }

  /* ------------------------------------------------------------
     12. Admin chrome (sidebar shell)
  ------------------------------------------------------------ */
  const ADMIN_NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: 'grid', href: 'index.html' },
    { key: 'reports', label: 'Reports', icon: 'cal', href: 'reports.html' },
    { key: 'foods', label: 'Food items', icon: 'utensils', href: 'foods.html' },
    { key: 'categories', label: 'Categories', icon: 'tag', href: 'categories.html' },
    { key: 'orders', label: 'Orders', icon: 'receipt', href: 'orders.html', badge: true },
    { key: 'users', label: 'Customers', icon: 'users', href: 'users.html' }
  ];
  function adminActiveKey() {
    const p = window.location.pathname.split('/').pop() || 'index.html';
    if (p === 'foods.html') return 'foods';
    if (p === 'categories.html') return 'categories';
    if (p === 'orders.html') return 'orders';
    if (p === 'users.html') return 'users';
    if (p === 'reports.html') return 'reports';
    return 'dashboard';
  }
  function renderAdminChrome() {
    const side = document.getElementById('ddAdminSide');
    const user = S.currentUser() || { name: 'Admin', email: '' };
    const active = adminActiveKey();
    const pending = S.orders().filter(function (o) { return o.status === 'pending'; }).length;
    if (side) {
      side.innerHTML =
        '<div class="side-brand">' + logoMark() + '<span class="logo-text">Dish<em>Dash</em></span></div>'
        + '<button class="side-close" data-side-close aria-label="Close menu" style="display:none">' + ic('x') + '</button>'
        + '<nav class="side-nav" aria-label="Admin">'
        + '<div class="side-label">Manage</div>'
        + ADMIN_NAV.map(function (n) {
          const activeClass = active === n.key ? ' active' : '';
          const badge = n.badge && pending ? '<span class="side-badge">' + pending + '</span>' : '';
          return '<a class="side-item' + activeClass + '" href="' + n.href + '"><span class="si-ic">' + ic(n.icon) + '</span>' + n.label + badge + '</a>';
        }).join('')
        + '<div class="side-label" style="margin-top:18px">Platform</div>'
        + '<a class="side-item" href="../index.html"><span class="si-ic">' + ic('home') + '</span>View customer site</a>'
        + '</nav>'
        + '<div class="side-foot">'
        + '<div class="side-admin"><span class="avatar green">' + initials(user.name) + '</span><span><b>' + esc(user.name) + '</b><span>' + esc(user.email) + '</span></span></div>'
        + '<a href="../login.html" data-logout><span class="sf-ic">' + ic('logout') + '</span>Sign out</a>'
        + '</div>';
      // mobile drawer behaviour for the sidebar
      const overlay = document.createElement('div');
      overlay.className = 'admin-overlay';
      document.body.appendChild(overlay);
      function openSide() {
        side.classList.add('open');
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
      }
      function closeSide() {
        side.classList.remove('open');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
      }
      document.querySelectorAll('[data-side-open]').forEach(function (b) { b.addEventListener('click', openSide); });
      side.querySelectorAll('.side-item, [data-side-close], [data-logout]').forEach(function (a) {
        a.addEventListener('click', function () {
          if (a.hasAttribute('data-logout')) S.logout();
          closeSide();
        });
      });
      overlay.addEventListener('click', closeSide);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSide(); });
    }
    bindChromeEvents();
  }

  /* ------------------------------------------------------------
     13. Page-level convenience renderers
  ------------------------------------------------------------ */
  function emptyState(opts) {
    return '<div class="empty-state">'
      + '<div class="empty-ico">' + (opts.emoji || '🍽️') + '</div>'
      + '<h3>' + esc(opts.title) + '</h3>'
      + '<p>' + esc(opts.msg || '') + '</p>'
      + (opts.action ? '<a class="btn btn-primary" href="' + opts.action.href + '">' + esc(opts.action.label) + '</a>' : '')
      + '</div>';
  }
  function loaderHTML() {
    return '<div class="loader-box"><div class="big-spinner"></div><span>Loading, please wait…</span></div>';
  }
  function paginationHTML(page, totalPages, onChange) {
    if (totalPages <= 1) return '';
    let h = '<div class="pager" aria-label="Pagination">'
      + '<button class="page-btn" data-pg="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="Previous page">' + ic('chev-l') + '</button>';
    for (let i = 1; i <= totalPages; i++) {
      h += '<button class="page-btn' + (i === page ? ' active' : '') + '" data-pg="' + i + '" aria-label="Page ' + i + '" aria-current="' + (i === page ? 'page' : 'false') + '">' + i + '</button>';
    }
    h += '<button class="page-btn" data-pg="' + (page + 1) + '" ' + (page >= totalPages ? 'disabled' : '') + ' aria-label="Next page">' + ic('chev-r') + '</button></div>';
    return h;
  }
  function bindPagination(root, fn) {
    root && root.querySelectorAll('[data-pg]').forEach(function (b) {
      b.addEventListener('click', function () { if (!b.disabled) fn(Number(b.getAttribute('data-pg'))); });
    });
  }
  function reveal(root) {
    const scope = root || document;
    const els = scope.querySelectorAll ? scope.querySelectorAll('[data-reveal]:not(.in)') : [];
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    els.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 12, 8) * 26 + 'ms';
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------
     14. Global delegated handlers (add-to-cart, favourites)
  ------------------------------------------------------------ */
  function handleAddClick(id, btn) {
    const dish = D.getFood(id);
    if (!dish || dish.inStock === false) { toast('Unavailable', 'This dish is currently sold out.', 'error'); return; }
    S.addToCart(dish.id, 1);
    cartUISync(true);
    // micro success animation on the button
    if (btn) {
      const icon = btn.querySelector('.ic');
      if (icon) {
        const old = btn.innerHTML;
        btn.innerHTML = ic('check') + '';
        btn.classList.add('done');
        setTimeout(function () { btn.innerHTML = old; btn.classList.remove('done'); }, 900);
      }
    }
    toast('Added to cart', dish.name + ' · ' + fmtN(dish.price));
  }

  function requireLoginForFav() {
    const user = S.currentUser();
    if (user && user.role !== 'admin') return true;
    toast(user ? 'Admin account' : 'Sign in required', 'Use a customer account to save favourites.', 'info', 3600);
    if (!user) setTimeout(function () { go('login.html?next=' + encodeURIComponent(window.location.pathname + window.location.search)); }, 1200);
    return false;
  }

  function handleFavClick(id, btn) {
    if (!requireLoginForFav()) return;
    const nowOn = S.toggleFav(id);
    const dish = D.getFood(id);
    // update this + any other matching buttons
    document.querySelectorAll('[data-fav="' + id + '"]').forEach(function (b) {
      b.classList.toggle('on', nowOn);
      b.setAttribute('aria-pressed', String(nowOn));
      const icEl = b.querySelector('svg');
      if (icEl) icEl.innerHTML = '<use href="#i-' + (nowOn ? 'heart-f' : 'heart') + '"></use>';
    });
    toast(nowOn ? 'Saved to favourites' : 'Removed from favourites', dish ? dish.name : '', nowOn ? 'success' : 'info');
    if (isPage('favorites') && !nowOn) {
      const card = btn.closest('.food-card');
      if (card) {
        card.style.transition = 'opacity .3s, transform .3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(.92)';
        setTimeout(function () {
          card.remove();
          if (typeof refreshFavoritesPage === 'function') refreshFavoritesPage();
        }, 320);
      }
    }
  }

  function bindGlobalDelegates() {
    document.addEventListener('click', function (e) {
      // Food card navigation: clicking anywhere on a card opens the item page.
      // Interactive controls inside (add-to-cart, favourite, links) keep their
      // own behaviour — the guard below excludes them.
      const card = e.target.closest ? e.target.closest('.food-card[data-food-id]') : null;
      if (card && !e.target.closest('a, button, [data-add], [data-fav]')) {
        window.location.href = rootPath() + 'food.html?id=' + card.getAttribute('data-food-id');
        return;
      }
      const add = e.target.closest ? e.target.closest('[data-add]') : null;
      if (add) { e.preventDefault(); handleAddClick(add.getAttribute('data-add'), add); return; }
      const fav = e.target.closest ? e.target.closest('[data-fav]') : null;
      if (fav) { e.preventDefault(); handleFavClick(fav.getAttribute('data-fav'), fav); return; }
      // promo copy buttons
      const copy = e.target.closest ? e.target.closest('[data-copycode]') : null;
      if (copy) {
        const code = copy.getAttribute('data-copycode');
        if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
        toast('Promo code copied', 'Use code ' + code + ' at checkout.', 'info');
        return;
      }
      // site feedback (“Tell us how we're doing”)
      if (e.target.closest('[data-feedback]')) { openFeedbackModal(); return; }
    });
    // cross-tab sync: another tab (e.g. the admin console) updated shared state
    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf('dishdash_') !== 0) return;
      // Chrome (badges / account state) refreshes for any relevant change
      if (/^(dishdash_cart|dishdash_session|dishdash_evt_|dishdash_orders)/.test(e.key)) {
        refreshChrome();
      }
      // live review chips: re-render whichever grid is on screen
      if (e.key === 'dishdash_evt_reviews' || e.key === 'dishdash_reviews') {
        rerenderFoodGrids();
      }
    });
  }

  /* ------------------------------------------------------------
     Site feedback modal — saves to Supabase (cloud) or localStorage
     (local mode). Demo-only: no emails are sent.
  ------------------------------------------------------------ */
  function starPickerHTML(name) {
    let h = '<div class="star-picker" role="radiogroup" aria-label="Your rating">';
    for (let i = 1; i <= 5; i++) {
      h += '<button type="button" class="sp-star" data-star="' + i + '" role="radio" aria-checked="false" aria-label="' + i + ' star' + (i > 1 ? 's' : '') + '">'
        + '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.5l-5.8 3.1 1.1-6.4L2.6 9.6l6.5-.9Z"/></svg></button>';
    }
    return h + '</div>';
  }

  function openFeedbackModal() {
    const S = window.DD_STORE;
    const u = S.currentUser ? S.currentUser() : null;
    const html = '<form id="fbForm" novalidate>'
      + '<p class="a-sub" style="margin-bottom:14px">Your feedback goes straight to the DishDash team. Good, bad, or hungry-for-more — we read every note.</p>'
      + (u ? '' : '<div class="field"><label for="fbName">Your name</label><input class="input" id="fbName" placeholder="e.g. Adaeze O." maxlength="60"><span class="err">Please tell us your name.</span></div>'
      +        '<div class="field"><label for="fbEmail">Email (optional)</label><input class="input" id="fbEmail" type="email" placeholder="you@example.com"><span class="err">That email doesn\'t look right.</span></div>')
      + '<div class="field"><label>How was your experience?</label>' + starPickerHTML('fb') + '</div>'
      + '<div class="field"><label for="fbMsg">Your message</label><textarea class="input" id="fbMsg" rows="4" maxlength="1000" placeholder="What did you love? What could be better?"></textarea><span class="err">Please write a short message (at least 10 characters).</span></div>'
      + '<div class="field err-box" id="fbErr" hidden style="display:none;color:var(--err);font-size:.88rem;font-weight:650"></div>'
      + '</form>';
    openModal(html, {
      title: 'Tell us how we\'re doing',
      foot: '<button class="btn btn-ghost" data-close>Cancel</button>'
        + '<button class="btn btn-primary" id="fbSend">Send feedback</button>',
      onOpen: function (bg) {
        bindStarPicker(bg.querySelector('.star-picker'));
        bg.querySelector('[data-close]').addEventListener('click', function () { bg.close(); });
        bg.querySelector('#fbSend').addEventListener('click', function () {
          const msg = bg.querySelector('#fbMsg');
          const rating = bg.querySelector('.sp-star.on') ? Number(bg.querySelector('.sp-star.on').getAttribute('data-star')) : 0;
          let ok = true;
          if (!u) {
            const nm = bg.querySelector('#fbName');
            if (!nm.value.trim() || nm.value.trim().length < 2) { nm.closest('.field').classList.add('invalid'); ok = false; }
            const em = bg.querySelector('#fbEmail');
            const ev = em.value.trim();
            if (ev && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ev)) { em.closest('.field').classList.add('invalid'); ok = false; }
          }
          if (msg.value.trim().length < 10) { msg.closest('.field').classList.add('invalid'); ok = false; }
          if (!rating) { toast('Pick a rating', 'Tap the stars to rate your experience.', 'info'); return; }
          if (!ok) return;
          const errBox = bg.querySelector('#fbErr');
          const btn = bg.querySelector('#fbSend');
          btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending…';
          Promise.resolve(S.feedbackSubmit({
            name: u ? '' : bg.querySelector('#fbName').value,
            email: u ? '' : (bg.querySelector('#fbEmail') || { value: '' }).value,
            rating: rating, message: msg.value
          })).then(function (res) {
            if (res && !res.ok) throw new Error(res.error || 'Could not send.');
            bg.close();
            toast('Thank you! 🙏', 'Your feedback is with the DishDash team.');
          }).catch(function (e2) {
            btn.disabled = false; btn.textContent = 'Send feedback';
            errBox.hidden = false; errBox.style.display = 'block';
            errBox.textContent = (e2 && e2.message) || 'Could not send right now — please try again.';
          });
        });
      }
    });
  }

  function bindStarPicker(root) {
    if (!root) return;
    root.querySelectorAll('.sp-star').forEach(function (b) {
      b.addEventListener('click', function () {
        const n = Number(b.getAttribute('data-star'));
        root.querySelectorAll('.sp-star').forEach(function (s) {
          const on = Number(s.getAttribute('data-star')) <= n;
          s.classList.toggle('on', on);
          s.setAttribute('aria-checked', String(Number(s.getAttribute('data-star')) === n));
        });
      });
    });
  }

  /* Re-paint the food grids on the current page so live rating chips stay
     truthful when reviews arrive from other browsers. Grids re-render through
     each page's own render() when it exposes one; otherwise innerHTML rebuild
     via the same card HTML (cheap, and preserves event delegation). */
  function rerenderFoodGrids() {
    ['menuGrid', 'trendGrid', 'favGrid', 'relatedGrid'].forEach(function (id) {
      const grid = document.getElementById(id);
      if (!grid || !grid.children.length) return;
      const cards = grid.querySelectorAll('.food-card[data-food-id]');
      if (!cards.length) return;
      cards.forEach(function (card) {
        const fid = Number(card.getAttribute('data-food-id'));
        const dish = (window.DD_DATA.getFood(fid)) || null;
        if (!dish) return;
        const fresh = document.createElement('div');
        fresh.innerHTML = foodCardHTML(dish);
        const next = fresh.firstElementChild;
        if (next) {
          next.classList.add('in');           // skip the reveal animation on repaint
          next.removeAttribute('data-reveal');
          card.replaceWith(next);
        }
      });
    });
  }

  /* ------------------------------------------------------------
     15. Init
  ------------------------------------------------------------ */

  /* ------------------------------------------------------------
     15. Init
  ------------------------------------------------------------ */
  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    document.body.insertAdjacentHTML('afterbegin', SPRITE);
    const noFrame = document.body.hasAttribute('data-noframe');
    const header = document.getElementById('ddHeader');
    const adminSide = document.getElementById('ddAdminSide');
    if (isAdminPage() && adminSide) {
      renderAdminChrome();
    } else if (header && !noFrame) {
      renderChrome();
    }
    cartUISync(false);
    bindGlobalDelegates();
    startOrderWatch();
    /* Confirmation links return from the inbox carrying the session in the URL
       and sign the customer in on whatever page they land on. Say so — the
       silent version looked like the click had done nothing at all. */
    if (window.DD_CLOUD && window.DD_CLOUD.linkLanding && window.DD_STORE_SYNC
        && window.DD_STORE_SYNC.whenAuthReady) {
      const landing = window.DD_CLOUD.linkLanding();
      if (landing) {
        // wait for the cloud layer: the fragment is only consumed during init
        window.DD_STORE_SYNC.whenAuthReady().then(function () {
          if (!window.DD_CLOUD.active()) return;
          if (landing.error) {
            toast('That confirmation link did not work',
              landing.expired
                ? 'It has expired or was already used. Send a new code from the verify page.'
                : 'Please request a fresh confirmation email.', 'error', 6500);
            return;
          }
          // Only claim success when a session really exists — an expired or
          // hand-edited fragment must not produce a cheerful lie.
          if (window.DD_STORE.currentUser()) {
            toast('Email confirmed 🎉', 'You are signed in — ordering is unlocked.');
          } else {
            toast('Confirmation link opened', 'Sign in to continue — or enter the code from the email.', 'info', 6000);
          }
        }).catch(function () { /* never block the page on a nicety */ });
      }
    }

    // live rating chips: repaint food grids when reviews change in-page (cloud realtime)
    if (window.DD_STORE.on) {
      window.DD_STORE.on('reviews', function () { rerenderFoodGrids(); });
      // session changed in THIS tab (cloud layer settling after boot, sign-in,
      // sign-out, profile save): repaint the header/footer + grids so the
      // account UI never keeps stale signed-in (or signed-out) state.
      window.DD_STORE.on('auth', function () { refreshChrome(); rerenderFoodGrids(); });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('pageshow', function () { cartUISync(false); });

  return {
    esc, ic, fmtN, initials, qs, getParam, go, debounce, catOf,
    fmtDate, fmtDateShort, fmtTime, timeAgo, etaClock,
    logoMark, logoHTML, rootPath,
    imgCover, starRow, statusBadge, statusLabel, payBadge, payMethodLabel, payStatusOf,
    foodCardHTML, emptyState, loaderHTML,
    paginationHTML, bindPagination, reveal,
    toast, openModal, confirmDialog,
    cartUISync, refreshChrome, isPage, isAdminPage, currentNavPage,
    printReceipt,
    confirm: confirmDialog,
    STATUS_ICON: STATUS_ICON
  };

  /* Global error boundaries — a failed cloud call or a bug in one page
     controller must never die silently in the console while someone is
     watching the demo. "Script error." cross-origin noise is ignored. */
  window.addEventListener('unhandledrejection', function (e) {
    const r = e && e.reason;
    toast('Something went wrong', (r && r.message) ? r.message : 'Unexpected error — please retry.', 'error', 5000);
  });
  window.addEventListener('error', function (e) {
    if (e && e.message && !/^Script error/i.test(e.message)) {
      toast('Something went wrong', e.message, 'error', 5000);
    }
  });
})();
