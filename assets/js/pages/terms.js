/* ============================================================
   DISHDASH — Terms & conditions page
   ------------------------------------------------------------
   The document is plain HTML so it reads correctly with JS off.
   This controller only:
     · fills the contact details + year from DD_DATA.CONFIG, so
       they can never drift from the rest of the app
     · highlights the section you are reading in the side index
   ============================================================ */
'use strict';

(function () {
  const UI = window.DD_UI;
  const D = window.DD_DATA;

  function fillContact() {
    const c = (D && D.CONFIG) || {};
    const phone = document.getElementById('tcPhone');
    const email = document.getElementById('tcEmail');
    const year = document.getElementById('legalYear');
    if (phone && c.supportPhone) phone.textContent = c.supportPhone;
    if (email && c.supportEmail) email.textContent = c.supportEmail;
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /* Scroll-spy: the section whose heading is nearest the top of the viewport
     wins, so the index always points at what is actually on screen. */
  function bindScrollSpy() {
    const nav = document.getElementById('legalNav');
    const body = document.getElementById('legalBody');
    if (!nav || !body || !('IntersectionObserver' in window)) return;

    const links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    const sections = links
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);
    if (!sections.length) return;

    const byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

    const spy = new IntersectionObserver(function (entries) {
      // pick the entry closest to the top band of the viewport
      const visible = entries.filter(function (e) { return e.isIntersecting; });
      if (!visible.length) return;
      visible.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      const id = visible[0].target.id;
      links.forEach(function (a) { a.classList.remove('current'); });
      if (byId[id]) byId[id].classList.add('current');
    }, { rootMargin: '-104px 0px -70% 0px', threshold: 0 });

    sections.forEach(function (s) { spy.observe(s); });
  }

  function init() {
    if (!UI || !D) return;
    fillContact();
    bindScrollSpy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
