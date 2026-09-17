'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  // Held at module level so the foods-broadcast re-init can never stack a
  // second rotation interval on top of the first.
  let heroTimer = null;

  /* ---------------- hero variant (cinematic / classic) ----------------
     Purely presentational, so the choice is remembered per browser with the
     OS dark-mode setting as the default when nothing has been chosen yet.
     Applied FIRST, before init(), and never on a timer: this script sits at
     the end of <body> after the hero markup, so the class lands before the
     first paint and a dark-OS visitor never sees a cream flash. */
  const HERO_KEY = 'dishdash_hero_variant';
  function heroStored() {
    try { return localStorage.getItem(HERO_KEY); } catch (e) { return null; }
  }
  function heroVariant() {
    const s = heroStored();
    if (s === 'cinematic' || s === 'classic') return s;
    try {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'cinematic' : 'classic';
    } catch (e) { return 'classic'; }
  }
  function applyHeroVariant(v) {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const cinematic = v === 'cinematic';
    hero.classList.toggle('is-cinematic', cinematic);
    const btn = hero.querySelector('[data-hero-variant]');
    if (!btn) return;
    btn.setAttribute('aria-pressed', cinematic ? 'true' : 'false');
    btn.setAttribute('aria-label', cinematic
      ? 'Hero lighting: dark cinematic. Switch to the bright classic hero.'
      : 'Hero lighting: bright classic. Switch to the dark cinematic hero.');
    btn.setAttribute('title', btn.getAttribute('aria-label'));
    const label = btn.querySelector('[data-hv-label]');
    if (label) label.textContent = cinematic ? 'Classic' : 'Cinematic';
    // showing the icon for the look you are NOT in, so the button reads as
    // "switch to…" rather than a status indicator
    const use = btn.querySelector('use');
    if (use) use.setAttribute('href', cinematic ? '#i-sun' : '#i-moon');
  }
  function wireHeroVariant() {
    const btn = document.querySelector('[data-hero-variant]');
    if (!btn || btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', function () {
      // Flip the look that is ACTUALLY showing, not the stored one. When no
      // choice has been stored yet the visible state comes from the OS
      // dark-mode preference, so deciding from heroStored() would make the
      // first click a no-op that contradicts the button's own label.
      const hero = document.querySelector('.hero');
      const showing = hero && hero.classList.contains('is-cinematic') ? 'cinematic' : 'classic';
      const next = showing === 'cinematic' ? 'classic' : 'cinematic';
      try { localStorage.setItem(HERO_KEY, next); } catch (e) { /* private mode */ }
      applyHeroVariant(next);
    });
  }
  applyHeroVariant(heroVariant());
  wireHeroVariant();

  function init() {
    // stats
    document.querySelectorAll('[data-dish-count]').forEach(function (n) { n.textContent = S.foods().length; });

    // category tiles
    const catGrid = document.getElementById('catGrid');
    if (catGrid) {
      const live = S.foods();
      const counts = {};
      live.forEach(function (f) { counts[f.cat] = (counts[f.cat] || 0) + 1; });
      catGrid.innerHTML = S.categories().map(function (c) {
        const emojiWrap = '<span class="c-ico"><span class="img-emoji" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:30px">' + c.emoji + '</span>'
          + '<img src="' + D.img(c.img, 240) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>';
        return '<a class="cat-card" href="menu.html?cat=' + c.id + '" data-reveal aria-label="' + UI.esc(c.name) + ' — ' + (counts[c.id] || 0) + ' dishes">'
          + emojiWrap
          + '<span><span class="c-name">' + UI.esc(c.name) + '</span><br><span class="c-count">' + (counts[c.id] || 0) + ' dishes</span></span>'
          + '</a>';
      }).join('');
    }

    // trending
    const trendGrid = document.getElementById('trendGrid');
    if (trendGrid) {
      const trending = S.foods().filter(function (f) { return f.popular && f.inStock !== false; }).slice(0, 8);
      trendGrid.innerHTML = trending.map(UI.foodCardHTML).join('');
    }

    // hero search
    const form = document.getElementById('homeSearch');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const q = form.querySelector('input').value.trim();
        UI.go('menu.html' + (q ? '?q=' + encodeURIComponent(q) : ''));
      });
    }
    // the hero variant may have been applied before this node existed in a
    // cache edge case; re-asserting is idempotent and keeps the button honest
    applyHeroVariant(heroVariant());
    wireHeroVariant();

    UI.reveal(document);
    UI.cartUISync(false);

    // Hero photo crossfade: rotate the backdrop every 6.5s. The previous
    // slide is only hidden after the 2.4s fade completes, so the two are
    // briefly blended — never a flash of empty background. Skips ticks while
    // the tab is hidden (background throttling makes timers unreliable anyway)
    // and does not run at all under prefers-reduced-motion.
    const slides = document.querySelectorAll('.hero-bg-slide');
    if (slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !heroTimer) {
      let cur = 0;
      heroTimer = setInterval(function () {
        if (document.hidden) return;
        const prev = slides[cur];
        cur = (cur + 1) % slides.length;
        slides[cur].classList.add('is-on');
        setTimeout(function () { prev.classList.remove('is-on'); }, 2600);
      }, 6500);
    }
    // Re-render stats/categories/trending when the cloud catalog lands after
    // first paint (or an admin edits the menu in another tab).
    if (S.on) S.on('foods', init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
