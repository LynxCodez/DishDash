'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;
  const PER_PAGE = 9;

  const state = {
    q: (UI.getParam('q') || '').trim(),
    cat: UI.getParam('cat') || 'all',
    sort: UI.getParam('sort') || 'popular',
    onlyStock: false,
    page: 1
  };

  function filteredFoods() {
    const q = state.q.toLowerCase();
    let list = S.foods().filter(function (f) {
      const inCat = state.cat === 'all' || f.cat === state.cat;
      const inQ = !q || f.name.toLowerCase().indexOf(q) !== -1 || (f.desc || '').toLowerCase().indexOf(q) !== -1;
      const inStock = !state.onlyStock || f.inStock !== false;
      return inCat && inQ && inStock;
    });
    switch (state.sort) {
      case 'popular': list = list.slice().sort(function (a, b) { return (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || b.reviews - a.reviews; }); break;
      case 'rating': list = list.slice().sort(function (a, b) { return b.rating - a.rating; }); break;
      case 'price-asc': list = list.slice().sort(function (a, b) { return a.price - b.price; }); break;
      case 'price-desc': list = list.slice().sort(function (a, b) { return b.price - a.price; }); break;
      case 'name': list = list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }); break;
    }
    return list;
  }

  function renderChips() {
    const chips = document.getElementById('catChips');
    const counts = D.countByCat();
    const items = [{ id: 'all', name: 'All dishes', emoji: '🍽️' }].concat(D.CATEGORIES);
    chips.innerHTML = items.map(function (c) {
      const n = c.id === 'all' ? D.FOODS.length : (counts[c.id] || 0);
      return '<button class="chip' + (state.cat === c.id ? ' active' : '') + '" data-cat="' + c.id + '" role="tab" aria-selected="' + (state.cat === c.id) + '">'
        + '<span class="emo" aria-hidden="true">' + c.emoji + '</span>' + UI.esc(c.name) + ' <span style="opacity:.55;font-weight:650">(' + n + ')</span></button>';
    }).join('');
    chips.querySelectorAll('[data-cat]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.cat = b.getAttribute('data-cat');
        state.page = 1;
        renderChips();
        render();
        history.replaceState(null, '', 'menu.html' + (state.cat !== 'all' ? '?cat=' + state.cat : ''));
      });
    });
    const activeChip = chips.querySelector('.chip.active');
    if (activeChip) activeChip.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  function render() {
    const list = filteredFoods();
    const grid = document.getElementById('menuGrid');
    const meta = document.getElementById('resultsMeta');
    const empty = document.getElementById('menuEmpty');
    const pager = document.getElementById('pager');

    const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (state.page > totalPages) state.page = totalPages;

    meta.textContent = list.length
      ? 'Showing ' + Math.min(list.length, PER_PAGE) + ' of ' + list.length + (state.cat !== 'all' ? ' ' + (D.getCategory(state.cat) || {}).name + ' dishes' : ' dishes')
      : 'No dishes match your search';

    if (!list.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      empty.innerHTML = UI.emptyState({
        emoji: '🔍',
        title: 'Nothing here… yet',
        msg: state.q
          ? 'We couldn\'t find any dishes matching "' + state.q + '". Try a different search or clear your filters.'
          : 'No dishes in this category right now. Check back soon — new items are added weekly.',
        action: { href: 'menu.html', label: 'Clear all filters' }
      });
      pager.innerHTML = '';
      return;
    }

    empty.hidden = true;
    const start = (state.page - 1) * PER_PAGE;
    const slice = list.slice(start, start + PER_PAGE);
    grid.innerHTML = slice.map(UI.foodCardHTML).join('');
    pager.innerHTML = UI.paginationHTML(state.page, totalPages, null);
    UI.bindPagination(pager, function (p) {
      state.page = p;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    UI.reveal(grid);
  }

  function init() {
    document.getElementById('searchInput').value = state.q;

    const searchForm = document.getElementById('menuSearch');
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      state.q = document.getElementById('searchInput').value.trim();
      state.page = 1;
      render();
      history.replaceState(null, '', 'menu.html' + (state.q ? '?q=' + encodeURIComponent(state.q) : ''));
    });

    document.getElementById('sortSel').value = state.sort;
    document.getElementById('sortSel').addEventListener('change', function () {
      state.sort = this.value;
      state.page = 1;
      render();
    });

    const stockToggle = document.getElementById('stockToggle');
    stockToggle.addEventListener('click', function () {
      state.onlyStock = !state.onlyStock;
      stockToggle.classList.toggle('active', state.onlyStock);
      stockToggle.setAttribute('aria-checked', String(state.onlyStock));
      state.page = 1;
      render();
    });

    renderChips();
    render();
    UI.reveal(document);
    // Cloud boot fills the catalog after first paint — re-render when the
    // foods snapshot changes (admin adds/edits in another tab, first pull).
    if (S.on) S.on('foods', render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
