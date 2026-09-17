'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  const state = { q: '', cat: 'all', stock: 'all' };

  /* ---------------- image processing (item 8) ----------------
     Chosen photo is downscaled client-side to a JPEG data-URL
     (max 900px long edge, ~0.8 quality, ≈80–150KB) so the value
     fits comfortably in localStorage (offline mode) and in one
     Postgres text column (cloud mode) without any storage bucket. */
  var UP = { maxEdge: 900, quality: 0.8, maxBytes: 5 * 1024 * 1024 };
  var ACCEPTED = { 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1, 'image/gif': 1 };

  function resizeToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Could not read that file.')); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { reject(new Error('That file does not look like an image.')); };
        im.onload = function () {
          var scale = Math.min(1, UP.maxEdge / Math.max(im.width, im.height));
          var w = Math.max(1, Math.round(im.width * scale));
          var h = Math.max(1, Math.round(im.height * scale));
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(im, 0, 0, w, h);
          try { resolve(cv.toDataURL('image/jpeg', UP.quality)); }
          catch (e) { reject(new Error('This browser could not process that image.')); }
        };
        im.src = String(fr.result);
      };
      fr.readAsDataURL(file);
    });
  }

  /* ---------------- guard & helpers ---------------- */
  function guard() {
    if (!S.requireAdmin()) { UI.go('../login.html?next=admin/foods.html'); return false; }
    return true;
  }

  function esc(s) { return UI.esc(s); }
  function liveCat(id) { return UI.catOf(id); }

  /* ---------------- list ---------------- */
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
  const FIELDS = ['mName', 'mPrice', 'mDesc', 'mImg'];

  function clearErrors(modal) {
    FIELDS.forEach(function (id) {
      const el = modal.querySelector('#' + id);
      if (el) el.classList.remove('is-invalid');
      const box = modal.querySelector('[data-err="' + id + '"]');
      if (box) box.textContent = '';
    });
  }

  function fieldError(modal, id, msg) {
    const el = modal.querySelector('#' + id);
    if (el) el.classList.add('is-invalid');
    const box = modal.querySelector('[data-err="' + id + '"]');
    if (box) box.textContent = msg;
  }

  function validate(modal, img) {
    clearErrors(modal);
    let bad = false, first = null;
    const name = modal.querySelector('#mName').value.trim();
    const price = Number(modal.querySelector('#mPrice').value);
    const desc = modal.querySelector('#mDesc').value.trim();

    if (name.length < 2) { fieldError(modal, 'mName', 'Give the dish a name (at least 2 characters).'); bad = true; first = first || 'mName'; }
    if (!price || price < 50) { fieldError(modal, 'mPrice', 'Enter a price of ₦50 or more.'); bad = true; first = first || 'mPrice'; }
    if (desc.length < 10) { fieldError(modal, 'mDesc', 'Write a short description (at least 10 characters).'); bad = true; first = first || 'mDesc'; }
    if (!img) { fieldError(modal, 'mImg', 'Add a photo — upload one or pick a preset below.'); bad = true; first = first || 'mImg'; }
    if (first) { try { modal.querySelector('#' + first).focus(); } catch (e) {} }
    return !bad;
  }

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
      + '<div class="field" style="grid-column:1/-1"><label for="mName">Dish name</label><input class="input" id="mName" value="' + esc(food ? food.name : '') + '" placeholder="e.g. Peppered Chicken & Fries"><span class="f-err" data-err="mName" role="alert"></span></div>'
      + '<div class="field"><label for="mCat">Category</label><select class="input" id="mCat">' + catOptions + '</select></div>'
      + '<div class="field"><label for="mPrice">Price (₦)</label><input class="input" id="mPrice" type="number" min="50" step="50" value="' + (food ? food.price : '') + '" placeholder="e.g. 5500"><span class="f-err" data-err="mPrice" role="alert"></span></div>'
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
      + '<textarea class="input" id="mDesc" rows="3" placeholder="A mouth-watering one or two line description…">' + esc(food ? food.desc : '') + '</textarea><span class="f-err" data-err="mDesc" role="alert"></span></div>'
      + '</div>'
      + '<div class="switch-row"><span class="sw-txt"><b>Available to order</b><span>Show this dish on the customer menu</span></span>'
      + '<input type="checkbox" class="switch" id="mStock" ' + (!food || food.inStock !== false ? 'checked' : '') + '></div>'
      + '<div class="switch-row"><span class="sw-txt"><b>Mark as popular</b><span>Features in "Trending right now" on the homepage</span></span>'
      + '<input type="checkbox" class="switch" id="mPopular" ' + (food && food.popular ? 'checked' : '') + '></div>'
      + '<div style="margin-top:14px"><label style="font-size:.86rem;font-weight:700;color:var(--ink-2)">Photo</label>'
      + '<div class="upload-box" id="mDrop" tabindex="0" role="button" aria-label="Upload a photo: click or drag an image here">'
      + '<svg class="ic" aria-hidden="true"><use href="#i-image"></use></svg>'
      + '<b>Drag a photo here, or click to browse</b>'
      + '<span class="up-hint">JPG, PNG, WebP or GIF · up to 5MB · auto-resized for the web</span>'
      + '<input type="file" id="mFile" accept="image/jpeg,image/png,image/webp,image/gif" hidden>'
      + '</div>'
      + '<div class="field" style="margin-top:10px"><label class="visually-hidden" for="mImg">Photo</label>'
      + '<input class="input" id="mImg" value="' + esc(food ? food.img : D.GALLERY[0].img) + '" placeholder="Photo — upload above or paste an Unsplash photo id" style="font-family:monospace;font-size:.85rem">'
      + '<span class="f-err" data-err="mImg" role="alert"></span></div>'
      + '<div class="preset-label">Or start from a preset</div>'
      + '<div class="preset-thumbs">' + galleryHTML + '</div>'
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

    /* ---- photo handling ---- */
    const imgInput = modal.querySelector('#mImg');
    const prevImg = modal.querySelector('#mPrevImg');
    const prevEmoji = modal.querySelector('#mPrev .img-emoji');
    const drop = modal.querySelector('#mDrop');
    const fileInput = modal.querySelector('#mFile');
    let lastError = '';

    function showUploadError(msg) {
      lastError = msg;
      fieldError(modal, 'mImg', msg);
      drop.classList.add('img-err');
      try { drop.focus(); } catch (e) {}
    }

    function updatePreview() {
      const id = imgInput.value.trim();
      const isData = id.slice(0, 5) === 'data:';
      if (id) {
        prevImg.style.display = '';
        prevImg.onerror = function () {
          prevImg.style.display = 'none';
          prevEmoji.style.display = '';
          if (!isData) showUploadError('That photo reference could not be loaded.');
        };
        prevImg.onload = function () {
          prevEmoji.style.display = 'none';
          if (lastError) { lastError = ''; clearErrors(modal); drop.classList.remove('img-err'); }
        };
        prevImg.src = isData ? id : D.img(id, 400);
      } else {
        prevImg.style.display = 'none';
        prevEmoji.style.display = '';
      }
      // emoji from chosen category
      const catId = modal.querySelector('#mCat').value;
      prevEmoji.textContent = (UI.catOf(catId) || {}).emoji || '🍽️';
    }

    function handleFile(file) {
      if (!file) return;
      if (!ACCEPTED[file.type]) { showUploadError('Please choose a JPG, PNG, WebP or GIF image.'); return; }
      if (file.size > UP.maxBytes) { showUploadError('That file is over 5MB — pick a smaller photo.'); return; }
      resizeToDataUrl(file).then(function (dataUrl) {
        imgInput.value = dataUrl;
        lastError = '';
        clearErrors(modal);
        drop.classList.remove('img-err');
        updatePreview();
        UI.toast('Photo ready', 'Resized and attached to the dish.');
      }).catch(function (err) {
        showUploadError(err && err.message ? err.message : 'Could not process that image.');
      });
    }

    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    fileInput.addEventListener('change', function () { handleFile(fileInput.files && fileInput.files[0]); fileInput.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.remove('drag'); });
    });
    drop.addEventListener('drop', function (e) {
      const dt = e.dataTransfer;
      const f = dt && dt.files && dt.files[0];
      if (f) handleFile(f);
      else {
        const url = dt && dt.getData && dt.getData('text/uri-list') || dt && dt.getData && dt.getData('text') || '';
        if (url && (url.indexOf('http') === 0 || url.indexOf('data:') === 0)) {
          imgInput.value = url.trim();
          updatePreview();
        }
      }
    });

    imgInput.addEventListener('input', updatePreview);
    modal.querySelector('#mCat').addEventListener('change', updatePreview);
    modal.querySelectorAll('[data-preset]').forEach(function (th) {
      th.addEventListener('click', function () {
        modal.querySelectorAll('.preset-th').forEach(function (x) { x.classList.remove('selected'); });
        th.classList.add('selected');
        imgInput.value = th.getAttribute('data-preset');
        lastError = '';
        clearErrors(modal);
        drop.classList.remove('img-err');
        updatePreview();
      });
    });

    /* ---- live error clearing ---- */
    ['mName', 'mPrice', 'mDesc'].forEach(function (id) {
      const el = modal.querySelector('#' + id);
      el.addEventListener('input', function () {
        el.classList.remove('is-invalid');
        const box = modal.querySelector('[data-err="' + id + '"]');
        if (box) box.textContent = '';
      });
    });

    /* ---- save ---- */
    modal.querySelector('[data-save]').addEventListener('click', function () {
      const name = modal.querySelector('#mName').value.trim();
      const price = Number(modal.querySelector('#mPrice').value);
      const cat = modal.querySelector('#mCat').value;
      const desc = modal.querySelector('#mDesc').value.trim();
      const img = imgInput.value.trim();
      const oldPrice = modal.querySelector('#mOld').value ? Number(modal.querySelector('#mOld').value) : null;
      const prep = Number(modal.querySelector('#mPrep').value);
      const tag = modal.querySelector('#mTag').value || null;
      if (!validate(modal, img)) {
        UI.toast('Almost there', 'Fix the highlighted fields, then save.', 'error');
        return;
      }
      const payload = {
        name: name, price: price, cat: cat, desc: desc, img: img,
        oldPrice: oldPrice, prep: prep, tag: tag,
        popular: modal.querySelector('#mPopular').checked,
        inStock: modal.querySelector('#mStock').checked
      };
      const btn = modal.querySelector('[data-save]');
      btn.disabled = true;
      const done = function (okMsg, okBody) {
        btn.disabled = false;
        UI.toast(okMsg, okBody);
        modal.close();
        render();
      };
      const fail = function (err) {
        btn.disabled = false;
        const msg = (err && err.message) ? err.message : 'Could not save — please try again.';
        UI.toast('Not saved', msg, 'error');
      };
      let p;
      if (isNew) p = Promise.resolve(S.addFood(payload)).then(function () { done('Dish added 🎉', name + ' is now live on the menu.'); });
      else p = Promise.resolve(S.saveFoodOverride(Object.assign({}, food, payload))).then(function () { done('Changes saved', name + ' was updated.'); });
      p.catch(fail);
    });

    updatePreview();
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
    // Cloud boot can finish after first paint — re-render when the fresh
    // catalog lands (also picks up edits made in another admin tab).
    if (S.on) S.on('foods', function () { render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
