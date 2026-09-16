'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  const state = { q: '', cat: 'all', stock: 'all' };

  function guard() {
    if (!S.requireAdmin()) { UI.go('../login.html?next=admin/foods.html'); return false; }
    return true;
  }

  function esc(s) { return UI.esc(s); }
  function liveCat(id) { return UI.catOf(id); }

  function rowHTML(f) {
    const cat = liveCat(f.cat);
    const out = f.inStock === false;
    return '<tr>'
      + '<td><div class="food-cell">'
      + '<span class="f-th">' + cat.emoji + '<img src="' + D.img(f.img, 160) + '" alt="" loading="lazy" onerror="this.remove()"></span>'
      + '<span><span class="f-name">' + esc(f.name) + '</span><span class="td-sub">' + esc((f.desc || '').slice(0, 54)) + (f.desc && f.desc.length > 54 ? '…' : '') + '</span></span>'
      + '</div></td>'
      + '<td data-label="Category">' + esc(cat.name) + '</td>'
      + '<td data-label="Price"><span class="text-strong">' + D.naira(f.price) + '</span>' + (f.oldPrice ? '<span class="td-sub" style="text-decoration:line-through">' + D.naira(f.oldPrice) + '</span>' : '') + '</td>'
      + '<td data-label="Rating"><span class="badge badge-acc" style="font-size:.78rem">★ ' + f.rating.toFixed(1) + '</span><span class="td-sub">' + f.reviews + ' reviews</span></td>'
      + '<td data-label="Availability">'
      + '<label class="switch-row" style="padding:0;border:0;margin:0;justify-content:flex-start;gap:10px">'
      + '<input type="checkbox" class="switch" data-stock="' + f.id + '" ' + (!out ? 'checked' : '') + ' aria-label="' + (out ? 'Make available' : 'Mark sold out') + ': ' + esc(f.name) + '">'
      + '<span class="' + (out ? 'stock-pill out' : 'stock-pill in') + '" data-stockpill="' + f.id + '">' + (out ? 'Sold out' : 'In stock') + '</span>'
      + '</label></td>'
      + '<td data-label="Popular">' + (f.popular ? '<span class="badge badge-warn">🔥 Popular</span>' : '<span class="badge badge-soft">—</span>') + '</td>'
      + '<td style="text-align:right"><div class="row-actions">'
      + '<button class="icon-act edit" data-edit="' + f.id + '" aria-label="Edit ' + esc(f.name) + '">' + UI.ic('pen') + '</button>'
      + '<button class="icon-act del" data-del="' + f.id + '" aria-label="Delete ' + esc(f.name) + '">' + UI.ic('trash') + '</button>'
      + '</div></td>'
      + '</tr>';
  }

  function filtered() {
    const q = state.q.toLowerCase();
    return S.foods().filter(function (f) {
      const inCat = state.cat === 'all' || f.cat === state.cat;
      const inQ = !q || f.name.toLowerCase().indexOf(q) !== -1 || (f.desc || '').toLowerCase().indexOf(q) !== -1;
      const inStock = state.stock === 'all' || (state.stock === 'in' ? f.inStock !== false : f.inStock === false);
      return inCat && inQ && inStock;
    });
  }

  function render() {
    if (!guard()) return;
    const list = filtered();
    const wrap = document.getElementById('foodsWrap');
    document.getElementById('foodCount').textContent = list.length + ' of ' + S.foods().length + ' items';

    if (!list.length) {
      wrap.innerHTML = '<div class="table-card">' + UI.emptyState({
        emoji: '🍽️',
        title: 'No food items match',
        msg: 'Try clearing the search or filters, or add a brand new dish to the menu.',
        action: { href: 'foods.html', label: 'Clear filters' }
      }) + '</div>';
      return;
    }
    wrap.innerHTML = '<div class="table-card"><div class="tbl-scroll"><table class="tbl">'
      + '<thead><tr><th>Dish</th><th>Category</th><th>Price</th><th>Rating</th><th>Availability</th><th>Popular</th><th style="text-align:right">Actions</th></tr></thead>'
      + '<tbody>' + list.map(rowHTML).join('') + '</tbody></table></div></div>';

    // stock toggle
    wrap.querySelectorAll('[data-stock]').forEach(function (sw) {
      sw.addEventListener('change', function () {
        const id = Number(sw.getAttribute('data-stock'));
        const f = S.foods().find(function (x) { return x.id === id; });
        if (!f) return;
        Promise.resolve(S.toggleStock(id)).then(function () {
          const fresh = S.foods().find(function (x) { return x.id === id; }) || f;
          const nowOut = fresh.inStock === false;
          UI.toast(nowOut ? 'Marked sold out' : 'Back in stock', f.name, nowOut ? 'info' : 'success');
          render();
        });
      });
    });
    // edit / delete
    wrap.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        const f = S.foods().find(function (x) { return x.id === Number(b.getAttribute('data-edit')); });
        openForm(f);
      });
    });
    wrap.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        const f = S.foods().find(function (x) { return x.id === Number(b.getAttribute('data-del')); });
        UI.confirmDialog({
          title: 'Delete "' + f.name + '"?',
          msg: 'This removes the dish from the menu everywhere. Orders that already include it keep their own records.',
          okText: 'Delete dish',
          danger: true,
          icon: 'trash'
        }).then(function (yes) {
          if (yes) {
            Promise.resolve(S.deleteFoodOverride(f.id)).then(function () {
              UI.toast('Dish deleted', f.name + ' was removed from the menu.');
              render();
            });
          }
        });
      });
    });
  }

  /* ---------------- add / edit modal ---------------- */
  function openForm(food) {
    const isNew = !food;
    const cats = S.categories();
    const catOptions = cats.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (food && food.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');

    const galleryHTML = D.GALLERY.map(function (g) {
      const sel = food && food.img === g.img ? ' selected' : '';
      return '<button type="button" class="preset-th' + sel + '" data-preset="' + g.img + '" data-emoji="' + g.e + '" aria-label="Use this image">'
        + '<span class="pe">' + g.e + '</span>'
        + '<img src="' + D.img(g.img, 160) + '" alt="" loading="lazy" onerror="this.remove()">'
        + '<span class="tick">' + UI.ic('check') + '</span></button>';
    }).join('');

    const curEmoji = food ? (liveCat(food.cat) || {}).emoji : '🍽️';
    const html =
      '<div class="form-grid-2">'
      + '<div class="field" style="grid-column:1/-1"><label for="mName">Dish name</label><input class="input" id="mName" value="' + esc(food ? food.name : '') + '" placeholder="e.g. Peppered Chicken & Fries"></div>'
      + '<div class="field"><label for="mCat">Category</label><select class="input" id="mCat">' + catOptions + '</select></div>'
      + '<div class="field"><label for="mPrice">Price (₦)</label><input class="input" id="mPrice" type="number" min="50" step="50" value="' + (food ? food.price : '') + '" placeholder="e.g. 5500"></div>'
      + '<div class="field"><label for="mOld">Was price (₦) <span style="color:var(--faint);font-weight:600">(optional)</span></label><input class="input" id="mOld" type="number" min="0" step="50" value="' + (food && food.oldPrice ? food.oldPrice : '') + '" placeholder="Sale badge"></div>'
      + '<div class="field"><label for="mPrep">Prep time (min)</label><select class="input" id="mPrep">'
      + [5, 10, 15, 20, 25, 30, 35, 40].map(function (p) {
        return '<option value="' + p + '"' + (food && food.prep === p ? ' selected' : (food && !food.prep && p === 20 ? ' selected' : '')) + '>' + p + ' min</option>';
      }).join('') + '</select></div>'
      + '<div class="field" style="grid-column:1/-1"><label for="mTag">Badge <span style="color:var(--faint);font-weight:600">(optional)</span></label>'
      + '<select class="input" id="mTag">'
      + ['', 'Bestseller', 'New', 'Spicy', 'Local favourite'].map(function (t) {
        return '<option value="' + esc(t) + '"' + (food && food.tag === t ? ' selected' : '') + '>' + (t || 'No badge') + '</option>';
      }).join('') + '</select></div>'
      + '<div class="field" style="grid-column:1/-1"><label for="mDesc">Description</label>'
      + '<textarea class="input" id="mDesc" rows="3" placeholder="A mouth-watering one or two line description…">' + esc(food ? food.desc : '') + '</textarea></div>'
      + '</div>'
      + '<div class="switch-row"><span class="sw-txt"><b>Available to order</b><span>Show this dish on the customer menu</span></span>'
      + '<input type="checkbox" class="switch" id="mStock" ' + (!food || food.inStock !== false ? 'checked' : '') + '></div>'
      + '<div class="switch-row"><span class="sw-txt"><b>Mark as popular</b><span>Features in "Trending right now" on the homepage</span></span>'
      + '<input type="checkbox" class="switch" id="mPopular" ' + (food && food.popular ? 'checked' : '') + '></div>'
      + '<div style="margin-top:14px"><label style="font-size:.86rem;font-weight:700;color:var(--ink-2)">Photo <span style="color:var(--faint);font-weight:600">— pick a preset or paste an Unsplash photo id</span></label>'
      + '<div class="preset-thumbs">' + galleryHTML + '</div>'
      + '<div class="field" style="margin-top:10px"><label class="visually-hidden" for="mImg">Image photo id</label>'
      + '<input class="input" id="mImg" value="' + esc(food ? food.img : D.GALLERY[0].img) + '" placeholder="photo-…" style="font-family:monospace;font-size:.85rem"></div>'
      + '<div class="img-preview" id="mPrev"><span class="img-emoji">' + curEmoji + '</span>'
      + '<img id="mPrevImg" src="' + (food ? D.img(food.img, 400) : D.img(D.GALLERY[0].img, 400)) + '" alt="Preview" onerror="this.remove()"></div>'
      + '</div>';

    const modal = UI.openModal(html, {
      title: isNew ? 'Add new food' : 'Edit ' + food.name,
      size: 'lg',
      foot: '<button class="btn btn-ghost" data-cancel>Cancel</button>'
        + '<button class="btn btn-primary" data-save>' + (isNew ? 'Add to menu' : 'Save changes') + '</button>'
    });
    modal.querySelector('[data-cancel]').addEventListener('click', function () { modal.close(); });

    // image preview + preset selection
    const imgInput = modal.querySelector('#mImg');
    const prevImg = modal.querySelector('#mPrevImg');
    const prevEmoji = modal.querySelector('#mPrev .img-emoji');
    function updatePreview() {
      const id = imgInput.value.trim();
      if (id) {
        prevImg.src = D.img(id, 400);
        prevImg.style.display = '';
        prevImg.onerror = function () { prevImg.remove(); };
      } else {
        prevImg.style.display = 'none';
      }
      // emoji from chosen category
      const catId = modal.querySelector('#mCat').value;
      prevEmoji.textContent = (UI.catOf(catId) || {}).emoji || '🍽️';
    }
    imgInput.addEventListener('input', updatePreview);
    modal.querySelector('#mCat').addEventListener('change', updatePreview);
    modal.querySelectorAll('[data-preset]').forEach(function (th) {
      th.addEventListener('click', function () {
        modal.querySelectorAll('.preset-th').forEach(function (x) { x.classList.remove('selected'); });
        th.classList.add('selected');
        imgInput.value = th.getAttribute('data-preset');
        updatePreview();
      });
    });

    modal.querySelector('[data-save]').addEventListener('click', function () {
      const name = modal.querySelector('#mName').value.trim();
      const price = Number(modal.querySelector('#mPrice').value);
      const cat = modal.querySelector('#mCat').value;
      const desc = modal.querySelector('#mDesc').value.trim();
      const img = imgInput.value.trim();
      const oldPrice = modal.querySelector('#mOld').value ? Number(modal.querySelector('#mOld').value) : null;
      const prep = Number(modal.querySelector('#mPrep').value);
      const tag = modal.querySelector('#mTag').value || null;
      let bad = false;
      if (name.length < 2) bad = true;
      if (!price || price < 50) bad = true;
      if (desc.length < 10) bad = true;
      if (!img) bad = true;
      if (bad) {
        UI.toast('Missing details', 'Name, price (₦50+), description and a photo are required.', 'error');
        return;
      }
      if (isNew) {
        Promise.resolve(S.addFood({ name: name, price: price, cat: cat, desc: desc, img: img, oldPrice: oldPrice, prep: prep, tag: tag, popular: modal.querySelector('#mPopular').checked, inStock: modal.querySelector('#mStock').checked })).then(function () {
          UI.toast('Dish added 🎉', name + ' is now live on the menu.');
          render();
        });
      } else {
        Promise.resolve(S.saveFoodOverride(Object.assign({}, food, {
          name: name, price: price, cat: cat, desc: desc, img: img,
          oldPrice: oldPrice, prep: prep, tag: tag,
          popular: modal.querySelector('#mPopular').checked,
          inStock: modal.querySelector('#mStock').checked
        }))).then(function () {
          UI.toast('Changes saved', name + ' was updated.');
          render();
        });
      }
      modal.close();
    });
  }

  function init() {
    if (!guard()) return;
    // category filter options
    const catSel = document.getElementById('catFilter');
    catSel.innerHTML = '<option value="all">All categories</option>' + S.categories().map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
    }).join('');

    document.getElementById('foodSearch').addEventListener('submit', function (e) { e.preventDefault(); state.q = document.getElementById('foodQ').value.trim(); render(); });
    document.getElementById('foodQ').addEventListener('input', UI.debounce(function () { state.q = this.value.trim(); render(); }, 250));
    catSel.addEventListener('change', function () { state.cat = this.value; render(); });
    document.getElementById('stockFilter').addEventListener('change', function () { state.stock = this.value; render(); });
    document.getElementById('addFoodBtn').addEventListener('click', function () { openForm(null); });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
