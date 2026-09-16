'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

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
    // promo quick-fill chips on hero? none

    UI.reveal(document);
    UI.cartUISync(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
