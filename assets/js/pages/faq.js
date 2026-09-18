/* ============================================================
   DISHDASH — FAQ page
   ------------------------------------------------------------
   The questions themselves are plain HTML: native <details>
   elements, so the page is readable and usable with JavaScript
   switched off or a screen reader. This controller only layers
   the niceties on top:

     · live search across every question + answer
     · one answer open at a time (less wall of text)
     · deep links — faq.html#cancel-order opens that answer
     · the "Still stuck?" contact card, built from DD_DATA.CONFIG
       so the phone and email can never drift from the rest of the app
   ============================================================ */
'use strict';

(function () {
  const UI = window.DD_UI;
  const D = window.DD_DATA;

  function items() {
    return Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
  }
  function groups() {
    return Array.prototype.slice.call(document.querySelectorAll('.faq-group'));
  }
  function textOf(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /* ---------- contact card ---------- */
  function renderContact() {
    const list = document.getElementById('faqContact');
    if (!list) return;
    const c = D.CONFIG || {};
    list.innerHTML =
      '<li>' + UI.ic('phone') + '<span><b>' + UI.esc(c.supportPhone || '') + '</b><br>Monday–Sunday, 9am–10pm</span></li>'
      + '<li>' + UI.ic('mail') + '<span>' + UI.esc(c.supportEmail || '') + '</span></li>'
      + '<li>' + UI.ic('pin') + '<span>Lagos, Nigeria — delivering city-wide</span></li>';
  }

  /* ---------- one answer at a time ---------- */
  function bindAccordion() {
    items().forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (!item.open) return;
        items().forEach(function (other) {
          if (other !== item && other.open) other.open = false;
        });
      });
    });
  }

  /* ---------- search ---------- */
  function bindSearch() {
    const input = document.getElementById('faqSearch');
    if (!input) return;
    const empty = document.getElementById('faqEmpty');
    const emptyTerm = document.getElementById('faqEmptyTerm');
    const count = document.getElementById('faqCount');
    const all = items();
    // Snapshot every question's searchable text once, so typing only compares
    // strings instead of walking the DOM on each keystroke.
    const rows = all.map(function (el) { return { el: el, text: textOf(el) }; });

    const apply = UI.debounce(function () {
      const q = String(input.value || '').trim().toLowerCase();
      let shown = 0;
      rows.forEach(function (row) {
        const hit = !q || row.text.indexOf(q) !== -1;
        row.el.hidden = !hit;
        if (hit) shown++;
      });
      groups().forEach(function (g) {
        g.hidden = !g.querySelector('.faq-item:not([hidden])');
      });
      if (empty) empty.hidden = !(q && shown === 0);
      if (emptyTerm) emptyTerm.textContent = '“' + input.value.trim() + '”';
      if (count) {
        count.textContent = q
          ? (shown === 1 ? '1 question matches' : shown + ' questions match')
          : all.length + ' questions';
      }
    }, 130);

    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = document.querySelector('.faq-item:not([hidden])');
      if (!first) return;
      first.open = true;
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    apply();
  }

  /* ---------- deep links (#how-to-order, #promos …) ---------- */
  function openFromHash() {
    const id = decodeURIComponent(String(window.location.hash || '').replace(/^#/, ''));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    if (target.classList.contains('faq-item')) {
      target.hidden = false;
      target.open = true;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init() {
    if (!UI || !D) return;                    // data/ui failed to load — leave the static page alone
    renderContact();
    bindAccordion();
    bindSearch();
    if (window.location.hash) setTimeout(openFromHash, 120);
    window.addEventListener('hashchange', openFromHash);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
