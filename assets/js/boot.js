/* ============================================================
   DISHDASH — boot loader (page loading spinner)
   ------------------------------------------------------------
   Loaded from <head> on every page, BEFORE the stylesheets resolve,
   so it can put something sensible on screen during the gap where a
   multi-page site would otherwise show a white flash of unstyled
   HTML.

   Two deliberate choices:

   1. It is self-contained (its own CSS, injected inline) so it does
      not depend on style.css having been fetched yet, and it costs no
      extra network request. It picks up the real page colours from
      the CSS custom properties as soon as those land.
   2. It releases on DOMContentLoaded, NOT on window load. `load`
      waits for every Unsplash dish photo; a spinner that hangs
      around while the images stream in makes a fast site feel slow.
      The overlay's job is to cover the parse, not the photography.

   In cloud mode it also waits (briefly) for the store to settle, so
   the first paint of an admin page is the real data rather than an
   empty table that fills in a moment later.
   ============================================================ */
'use strict';

(function () {
  var CLOUD_GRACE = 2500;   // ms to wait for the cloud snapshot after parse
  var HARD_CAP = 6000;      // absolute ceiling — never trap the page

  // Admin pages sit on a different background (body.admin-page in admin.css),
  // and boot.js runs before that stylesheet has applied, so pick it up here.
  var isAdmin = /\/admin\//.test(location.pathname);
  var bg = isAdmin ? '#F6F1EA' : '#FAF6F0';
  var brand = isAdmin ? '#E8542A' : '#E8542A';

  var css = ''
    + '#ddLoader{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;'
    + 'justify-content:center;background:' + bg + ';transition:opacity .32s ease}'
    + '#ddLoader.is-off{opacity:0;pointer-events:none}'
    + '#ddLoader .dd-loader-in{display:flex;flex-direction:column;align-items:center;gap:14px;'
    + 'animation:dd-loader-in .3s ease .18s both}'
    + '#ddLoader .dd-loader-ring{width:44px;height:44px;border-radius:50%;'
    + 'border:3.5px solid rgba(232,84,42,.16);border-top-color:' + brand + ';'
    + 'animation:dd-loader-spin .8s linear infinite}'
    + '#ddLoader .dd-loader-txt{font-family:"Plus Jakarta Sans",system-ui,-apple-system,sans-serif;'
    + 'font-size:.82rem;font-weight:650;letter-spacing:.01em;color:#8A7C70}'
    + '@keyframes dd-loader-spin{to{transform:rotate(360deg)}}'
    + '@keyframes dd-loader-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'
    + '@keyframes dd-loader-pulse{50%{opacity:.3}}'
    + '@media (prefers-reduced-motion:reduce){'
    + '#ddLoader .dd-loader-ring{animation:dd-loader-pulse 1.3s ease-in-out infinite}'
    + '#ddLoader .dd-loader-in{animation:none}}';

  var style = document.createElement('style');
  style.id = 'ddLoaderStyle';
  style.textContent = css;

  var overlay = document.createElement('div');
  overlay.id = 'ddLoader';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-label', 'Loading DishDash');
  overlay.innerHTML = '<div class="dd-loader-in">'
    + '<span class="dd-loader-ring" aria-hidden="true"></span>'
    + '<span class="dd-loader-txt">Setting the table&hellip;</span>'
    + '</div>';

  (document.head || document.documentElement).appendChild(style);
  (document.documentElement).appendChild(overlay);

  var done = false;
  var parsed = false;

  function cloudConfigured() {
    var c = window.DD_SUPABASE_CONFIG;
    return !!(c && c.SUPABASE_URL && c.SUPABASE_ANON_KEY);
  }

  function hide() {
    if (done) return;
    done = true;
    overlay.className = 'is-off';
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (style.parentNode) style.parentNode.removeChild(style);
    }, 340);
  }

  /* Cloud round-trips can still be in flight when the HTML is parsed. Hold the
     overlay for them, but only briefly — past that the cached snapshot the
     store already has is better than a spinner. */
  function releaseWhenReady() {
    if (!parsed) return;
    if (!cloudConfigured()) return hide();
    var Y = window.DD_STORE_SYNC;
    if (Y && Y.status().settled) return hide();
    setTimeout(hide, CLOUD_GRACE);
  }

  document.addEventListener('DOMContentLoaded', function () {
    parsed = true;
    releaseWhenReady();
  });
  document.documentElement.addEventListener('dd:sync-ready', function () {
    if (parsed) hide();
  });

  // Belt and braces: a script error, a hung request or a browser that never
  // fires one of the events above must not leave the visitor staring at it.
  setTimeout(function () { parsed = true; hide(); }, HARD_CAP);
})();
