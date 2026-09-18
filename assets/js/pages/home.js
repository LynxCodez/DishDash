'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  // Held at module level so the foods-broadcast re-init can never stack a
  // second rotation interval on top of the first.
  let heroTimer = null;

  /* NB: there was a "cinematic" (dark) hero variant here between 2026-09-17 and
     2026-09-18. The owner rejected it — the copy was hard to read over the dark
     treatment and it broke the gradient word in the headline — so the hero is
     single-column with the bright treatment only. Do not re-add a dark hero
     unless the owner asks for one. */

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
