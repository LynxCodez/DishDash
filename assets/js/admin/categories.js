'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function esc(s) { return UI.esc(s); }

  const EMOJIS = ['🍔', '🍕', '🍗', '🍛', '🍝', '🍟', '🍰', '🥤', '🥗', '🌮', '🌯', '🥟', '🍜', '🥩', '🍩', '🥧', '🍦', '☕', '🍹', '🥪', '🍳', '🦐', '🥑', '🍲'];

  function guard() {
    if (!S.requireAdmin()) { UI.go('../login.html?next=admin/categories.html'); return false; }
    return true;
  }

  function cardHTML(c) {
    const count = S.catCount(c.id);
    return '<div class="food-card" style="padding:20px" data-reveal>'
      + '<div style="display:flex;align-items:flex-start;gap:14px">'
      + '<span class="c-ico" style="width:54px;height:54px;flex:none;position:relative;overflow:hidden;border-radius:16px;background:var(--bg-soft);display:flex;align-items:center;justify-content:center;font-size:1.7rem">'
      + c.emoji + (c.img ? '<img src="' + D.img(c.img, 200) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.remove()">' : '')
      + '</span>'
      + '<div style="flex:1;min-width:0">'
      + '<b style="font-size:1.02rem;display:block">' + esc(c.name) + '</b>'
      + '<span style="font-size:.82rem;color:var(--muted)">' + count + ' dish' + (count === 1 ? '' : 'es') + ' · id: ' + esc(c.id) + '</span>'
      + '</div></div>'
      + '<div class="row-actions" style="justify-content:flex-end;margin-top:14px">'
      + '<button class="icon-act edit" data-edit="' + esc(c.id) + '" aria-label="Edit ' + esc(c.name) + '">' + UI.ic('pen') + '</button>'
      + '<button class="icon-act del" data-del="' + esc(c.id) + '" aria-label="Delete ' + esc(c.name) + '">' + UI.ic('trash') + '</button>'
      + '</div></div>';
  }

  function render() {
    if (!guard()) return;
    const cats = S.categories();
    const grid = document.getElementById('catsGrid');
    document.getElementById('catCount').textContent = cats.length + ' categories · they power menu filters and the homepage';
    if (!cats.length) {
      grid.innerHTML = UI.emptyState({
        emoji: '🏷️',
        title: 'No categories yet',
        msg: 'Create your first category to start organising the menu.',
        action: { href: '#', label: 'Add category' }
      });
      return;
    }
    grid.innerHTML = cats.map(cardHTML).join('');

    grid.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        const c = cats.find(function (x) { return x.id === b.getAttribute('data-edit'); });
        openForm(c);
      });
    });
    grid.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        const c = cats.find(function (x) { return x.id === b.getAttribute('data-del'); });
        const count = S.catCount(c.id);
        if (count > 0) {
          UI.toast('Category in use', 'Move or delete the ' + count + ' dish(es) in "' + c.name + '" first.', 'error', 4200);
          return;
        }
        UI.confirmDialog({
          title: 'Delete "' + c.name + '"?',
          msg: 'This removes the category from the menu everywhere.',
          okText: 'Delete category',
          danger: true,
          icon: 'trash'
        }).then(function (yes) {
          if (yes) {
            Promise.resolve(S.deleteCategory(c.id)).then(function () {
              UI.toast('Category deleted', c.name + ' was removed.');
              render();
            });
          }
        });
      });
    });
    UI.reveal(grid);
  }

  function openForm(cat) {
    const isNew = !cat;
    const emojiRow = EMOJIS.map(function (e) {
      return '<button type="button" class="preset-th" data-emo="' + e + '" aria-label="Use ' + e + ' emoji" style="aspect-ratio:1/1"><span class="pe" style="font-size:26px">' + e + '</span><span class="tick">' + UI.ic('check') + '</span></button>';
    }).join('');
    const html =
      '<div class="field"><label for="cName">Category name</label>'
      + '<input class="input" id="cName" value="' + esc(cat ? cat.name : '') + '" placeholder="e.g. Grills"></div>'
      + '<div class="field"><label for="cId">Slug (shown in the URL, letters only)</label>'
      + '<input class="input" id="cId" value="' + esc(cat ? cat.id : '') + '" placeholder="e.g. grills"' + (cat ? ' disabled style="background:var(--bg-soft)"' : '') + '></div>'
      + '<div><label style="font-size:.86rem;font-weight:700;color:var(--ink-2)">Emoji icon</label>'
      + '<div class="preset-thumbs" style="grid-template-columns:repeat(auto-fill,minmax(42px,1fr));max-height:190px;overflow:auto">' + emojiRow + '</div></div>'
      + '<p class="form-hint" style="margin-top:10px">' + UI.ic('info') + ' Customers will see this category on the homepage and menu filters.</p>';

    const modal = UI.openModal(html, {
      title: isNew ? 'Add category' : 'Edit ' + (cat ? cat.name : ''),
      foot: '<button class="btn btn-ghost" data-cancel>Cancel</button>'
        + '<button class="btn btn-primary" data-save>' + (isNew ? 'Create category' : 'Save changes') + '</button>'
    });
    modal.querySelector('[data-cancel]').addEventListener('click', function () { modal.close(); });
    let emoji = cat ? cat.emoji : EMOJIS[0];
    modal.querySelectorAll('[data-emo]').forEach(function (b) {
      b.classList.toggle('selected', b.getAttribute('data-emo') === emoji);
      b.addEventListener('click', function () {
        modal.querySelectorAll('[data-emo]').forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
        emoji = b.getAttribute('data-emo');
      });
    });

    modal.querySelector('[data-save]').addEventListener('click', function () {
      const name = modal.querySelector('#cName').value.trim();
      let id = modal.querySelector('#cId').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!name || !emoji) { UI.toast('Missing details', 'Name and emoji are required.', 'error'); return; }
      if (isNew) {
        if (!id) id = name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'cat' + Date.now();
        if (S.categories().some(function (c) { return c.id === id; })) {
          UI.toast('Slug already exists', 'Choose a different slug for this category.', 'error');
          return;
        }
        const list = S.categories();
        list.push({ id: id, name: name, emoji: emoji, img: null });
        Promise.resolve(S.saveCategories(list)).then(function () {
          UI.toast('Category added', name + ' is ready for dishes.');
          render();
        });
      } else {
        const list = S.categories();
        const target = list.find(function (c) { return c.id === cat.id; });
        if (target) {
          target.name = name;
          target.emoji = emoji;
          Promise.resolve(S.saveCategories(list)).then(function () {
            UI.toast('Category updated', name + ' was saved.');
            render();
          });
        }
      }
      modal.close();
    });
  }

  function init() {
    if (!guard()) return;
    document.getElementById('addCatBtn').addEventListener('click', function () { openForm(null); });
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
