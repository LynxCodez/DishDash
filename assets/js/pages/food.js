'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function renderDetail(dish) {
    const cat = UI.catOf(dish.cat);
    const area = document.getElementById('detailArea');
    const out = dish.inStock === false;
    const favOn = S.isFav(dish.id);

    document.title = dish.name + ' — DishDash';
    document.getElementById('crumbs').innerHTML =
      '<a href="index.html">Home</a>'
      + '<svg class="ic" aria-hidden="true"><use href="#i-chev-r"></use></svg>'
      + '<a href="menu.html">Menu</a>'
      + '<svg class="ic" aria-hidden="true"><use href="#i-chev-r"></use></svg>'
      + '<a href="menu.html?cat=' + dish.cat + '">' + UI.esc(cat.name) + '</a>'
      + '<svg class="ic" aria-hidden="true"><use href="#i-chev-r"></use></svg>'
      + '<span aria-current="page">' + UI.esc(dish.name) + '</span>';

    area.innerHTML =
      '<div class="detail-layout">'
      + '<div class="detail-media" data-reveal>'
      + '<span class="img-emoji" aria-hidden="true">' + cat.emoji + '</span>'
      + '<img src="' + D.img(dish.img, 900) + '" alt="' + UI.esc(dish.name) + '" onerror="this.remove()">'
      + (dish.tag ? '<span class="badge badge-warn tag-food">' + UI.esc(dish.tag) + '</span>' : '')
      + '</div>'
      + '<div class="detail-info" data-reveal>'
      + '<a class="d-cat" href="menu.html?cat=' + dish.cat + '">' + cat.emoji + ' ' + UI.esc(cat.name) + '</a>'
      + '<h1>' + UI.esc(dish.name) + '</h1>'
      + '<div class="d-meta">'
      + '<span class="stars" role="img" aria-label="Rated ' + dish.rating + ' out of 5">' + starInline(dish.rating) + '</span>'
      + '<span class="fd-rating">' + UI.ic('star') + dish.rating.toFixed(1) + '</span>'
      + '<span style="color:var(--muted);font-size:.9rem;font-weight:650" id="dReviewMeta">' + dish.reviews.toLocaleString() + ' reviews</span>'
      + '<span class="badge ' + (out ? 'badge-danger' : 'badge-acc') + '">' + (out ? 'Currently unavailable' : 'Available now') + '</span>'
      + '</div>'
      + '<div class="d-price"><span class="now">' + D.naira(dish.price) + '</span>'
      + (dish.oldPrice ? '<span class="was">' + D.naira(dish.oldPrice) + '</span>' : '')
      + '</div>'
      + '<p class="d-desc">' + UI.esc(dish.desc) + '</p>'
      + '<div class="d-facts">'
      + '<span class="fact">' + UI.ic('clock') + 'Ready in ~' + dish.prep + ' min</span>'
      + '<span class="fact">' + UI.ic('truck') + 'Hot delivery</span>'
      + '<span class="fact">' + UI.ic('shield') + 'Quality checked</span>'
      + '</div>'
      + (out
        ? '<div class="d-stock-note">' + UI.ic('alert') + '<span><b>Sold out for now.</b> This dish is temporarily unavailable — check back shortly or explore similar dishes below.</span></div>'
        : '<div class="buy-note">'
        + '<label for="dishNote">Any special requests? <small>(optional)</small></label>'
        + '<input class="input" id="dishNote" type="text" maxlength="120" placeholder="e.g. extra sauce, no onions" autocomplete="off">'
        + '</div>'
        + '<div class="buy-row">'
        + '<div class="qty-stepper" aria-label="Quantity">'
        + '<button data-qty="-1" aria-label="Decrease quantity">' + UI.ic('minus') + '</button>'
        + '<span class="qty-val" data-qty-val>1</span>'
        + '<button data-qty="1" aria-label="Increase quantity">' + UI.ic('plus') + '</button>'
        + '</div>'
        + '<button class="btn btn-primary btn-lg" data-addbig id="bigAdd">' + UI.ic('cart') + '<span>Add to cart</span></button>'
        + '</div>'
        + '<div class="d-actions-row">'
        + '<button class="link-fav' + (favOn ? ' on' : '') + '" data-favbig id="favBig" aria-pressed="' + favOn + '">'
        + UI.ic(favOn ? 'heart-f' : 'heart') + '<span>' + (favOn ? 'Saved to favourites' : 'Save to favourites') + '</span></button>'
        + '<a class="cont-shop" href="cart.html">View cart &amp; checkout ' + UI.ic('arrow-r') + '</a>'
        + '</div>')
      + '</div></div>';

    // actions
    if (!out) {
      let qty = 1;
      const val = area.querySelector('[data-qty-val]');
      area.querySelectorAll('[data-qty]').forEach(function (b) {
        b.addEventListener('click', function () {
          qty = Math.max(1, Math.min(20, qty + Number(b.getAttribute('data-qty'))));
          val.textContent = qty;
        });
      });
      const bigAdd = document.getElementById('bigAdd');
      bigAdd.addEventListener('click', function () {
        // reuse the standard add handler animation via UI internals is private; do it here
        const noteInput = document.getElementById('dishNote');
        const note = noteInput ? noteInput.value : '';
        S.addToCart(dish.id, qty, note);
        if (noteInput) noteInput.value = '';
        UI.cartUISync(true);
        const span = bigAdd.querySelector('span');
        const old = span.textContent;
        span.textContent = 'Added ✓';
        bigAdd.style.background = 'linear-gradient(180deg,var(--acc-500),var(--acc-700))';
        UI.toast('Added to cart', qty + ' × ' + dish.name + ' · ' + D.naira(dish.price * qty));
        setTimeout(function () {
          span.textContent = old;
          bigAdd.style.background = '';
        }, 1100);
      });
      const favBig = document.getElementById('favBig');
      favBig.addEventListener('click', function () {
        const user = S.currentUser();
        if (!user || user.role === 'admin') {
          UI.toast('Sign in required', 'Use a customer account to save favourites.', 'info');
          if (!user) setTimeout(function () { UI.go('login.html?next=food.html?id=' + dish.id); }, 1300);
          return;
        }
        const on = S.toggleFav(dish.id);
        favBig.classList.toggle('on', on);
        favBig.setAttribute('aria-pressed', String(on));
        favBig.querySelector('svg').innerHTML = '<use href="#i-' + (on ? 'heart-f' : 'heart') + '"></use>';
        favBig.querySelector('span').textContent = on ? 'Saved to favourites' : 'Save to favourites';
        UI.toast(on ? 'Saved to favourites' : 'Removed from favourites', dish.name, on ? 'success' : 'info');
      });
    }
    // related
    const live = S.foods();
    const related = live.filter(function (f) { return f.cat === dish.cat && f.id !== dish.id; }).slice(0, 4);
    const extra = related.length < 4
      ? live.filter(function (f) { return f.cat !== dish.cat && f.popular; }).slice(0, 4 - related.length)
      : [];
    const relGrid = document.getElementById('relatedGrid');
    if (relGrid) {
      const items = related.concat(extra);
      relGrid.innerHTML = items.map(UI.foodCardHTML).join('');
      if (!items.length) {
        const sec = relGrid.closest('section');
        if (sec) sec.style.display = 'none';
      }
    }
    UI.reveal(document);

    renderReviews(dish);
  }

  /* ------------------------------------------------------------
     REVIEWS — list + write form. Everyone reads; signed-in
     customers write (one review per dish). In cloud mode the
     server enforces the verified-buyer rule; locally we check
     delivered orders the same way.
  ------------------------------------------------------------ */
  function renderReviews(dish) {
    const sec = document.getElementById('reviewsSection');
    if (!sec) return;
    const list = (S.foodReviews ? S.foodReviews(dish.id) : []);
    const live = S.ratingSummary ? S.ratingSummary(dish.id) : null;
    const u = S.currentUser ? S.currentUser() : null;
    const canReview = u && u.role !== 'admin' && !list.some(function (r) { return String(r.userId) === String(u.id); });

    // header meta: live count when we have real reviews, else the seeded count
    const metaEl = document.getElementById('dReviewMeta');
    if (metaEl) metaEl.textContent = live
      ? live.count + ' customer review' + (live.count === 1 ? '' : 's') + ' · ' + live.avg.toFixed(1) + ' avg'
      : dish.reviews.toLocaleString() + ' menu reviews';

    let h = '<div class="rv-head">'
      + '<h2>' + UI.ic('star') + ' Reviews'
      + (live ? ' <span class="rv-avg">' + live.avg.toFixed(1) + '</span><span class="rv-count">' + live.count + '</span>' : '')
      + '</h2>'
      + (canReview ? '<button class="btn btn-outline btn-sm" id="rvWrite">Write a review</button>' : '')
      + '</div>';

    if (!u) {
      h += '<div class="rv-cta">'
        + '<p>Ordered this dish? <a href="login.html?next=' + encodeURIComponent('food.html?id=' + dish.id) + '">Sign in</a> to leave a review.</p>'
        + '</div>';
    } else if (u.role !== 'admin' && !canReview) {
      h += '<p class="rv-note">You already reviewed this dish — thanks for sharing! 💛</p>';
    }

    h += list.length
      ? '<div class="rv-list">' + list.map(function (r) { return reviewRow(r, u); }).join('') + '</div>'
      : '<div class="rv-empty">No customer reviews yet — be the first to tell Lagos how this dish tastes.</div>';

    sec.innerHTML = h;

    const writeBtn = document.getElementById('rvWrite');
    if (writeBtn) writeBtn.addEventListener('click', function () { openReviewForm(dish); });

    // own-review controls (rendered only on the reviewer's own row)
    sec.querySelectorAll('[data-rv-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        const id = b.getAttribute('data-rv-edit');
        const mine = list.find(function (r) { return String(r.id) === id; });
        if (mine) openReviewForm(dish, mine);
      });
    });
    sec.querySelectorAll('[data-rv-del]').forEach(function (b) {
      b.addEventListener('click', function () { deleteOwnReview(dish, b.getAttribute('data-rv-del'), b); });
    });
  }

  /* Remove the signed-in customer's own review after an explicit confirm —
     the store re-checks ownership, so a stale button can never delete
     someone else's words. */
  function deleteOwnReview(dish, reviewId, btn) {
    const S = window.DD_STORE;
    UI.confirm({
      title: 'Delete your review?',
      msg: 'This removes your rating and comments for ' + dish.name + '. You can write a new review afterwards.',
      okText: 'Delete review',
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
      Promise.resolve(S.deleteReview(reviewId))
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || 'Could not delete.');
          UI.toast('Review deleted', 'You can write a new review any time.');
          renderReviews(dish);
        })
        .catch(function (e) {
          if (btn) { btn.disabled = false; btn.textContent = 'Delete'; }
          UI.toast('Could not delete', (e && e.message) || 'Please try again.', 'error');
        });
    });
  }

  function reviewRow(r, me) {
    const mine = me && String(r.userId) === String(me.id);
    const d = new Date(r.createdAt);
    const when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return '<article class="rv-row' + (mine ? ' mine' : '') + '">'
      + '<div class="rv-ava" aria-hidden="true">' + UI.initials(r.userName || 'C') + '</div>'
      + '<div class="rv-body">'
      + '<div class="rv-top"><b>' + UI.esc(r.userName || 'Customer') + '</b>'
      + (r.verified ? '<span class="rv-verified">' + UI.ic('check') + ' Verified order</span>' : '')
      + (mine ? '<span class="rv-you">You</span>' : '')
      + '<span class="rv-when">' + when + '</span>'
      + (mine ? '<span class="rv-acts">'
        + '<button type="button" class="rv-act" data-rv-edit="' + UI.esc(r.id) + '">Edit</button>'
        + '<button type="button" class="rv-act rv-act-danger" data-rv-del="' + UI.esc(r.id) + '">Delete</button>'
        + '</span>' : '')
      + '</div>'
      + '<div class="rv-stars" role="img" aria-label="' + r.rating + ' of 5 stars">' + starInline(r.rating) + '</div>'
      + (r.title ? '<div class="rv-title">' + UI.esc(r.title) + '</div>' : '')
      + (r.body ? '<p class="rv-text">' + UI.esc(r.body) + '</p>' : '')
      + '</div></article>';
  }

  // One form for both writing and editing — `existing` is the caller's own
  // review row when they hit Edit, absent when they hit "Write a review".
  function openReviewForm(dish, existing) {
    const S = window.DD_STORE;
    const editing = !!existing;
    const html = '<form id="rvForm" novalidate>'
      + '<p class="a-sub" style="margin-bottom:12px">' + (editing
        ? 'Update your review of <b>' + UI.esc(dish.name) + '</b>. Your edited review appears instantly for everyone.'
        : 'How was <b>' + UI.esc(dish.name) + '</b>? Your review shows your first name and appears instantly for everyone.') + '</p>'
      + '<div class="field"><label>Your rating</label>' + starPicker(editing ? existing.rating : 0) + '</div>'
      + '<div class="field"><label for="rvTitle">Headline <small>(optional)</small></label><input class="input" id="rvTitle" maxlength="80" placeholder="Sum it up in a few words" value="' + (editing ? UI.esc(existing.title || '') : '') + '"></div>'
      + '<div class="field"><label for="rvBody">Your review</label><textarea class="input" id="rvBody" rows="4" maxlength="600" placeholder="What did you think? Taste, portions, delivery…">' + (editing ? UI.esc(existing.body || '') : '') + '</textarea><span class="err">Please write at least 10 characters.</span></div>'
      + '<div class="field err-box" id="rvErr" hidden style="display:none;color:var(--err);font-size:.88rem;font-weight:650"></div>'
      + '</form>';
    const bg = UI.openModal(html, {
      title: editing ? 'Edit your review' : 'Review ' + UI.esc(dish.name),
      foot: '<button class="btn btn-ghost" data-close2>Cancel</button><button class="btn btn-primary" id="rvSend">' + (editing ? 'Save changes' : 'Post review') + '</button>',
      onOpen: function (bg) {
        bindPicker(bg.querySelector('.star-picker'));
        bg.querySelector('[data-close2]').addEventListener('click', function () { bg.close(); });
        bg.querySelector('#rvSend').addEventListener('click', function () {
          const rating = Number((bg.querySelector('.sp-star.on') || {}).getAttribute && (bg.querySelector('.sp-star.on') || {}).getAttribute('data-star')) || 0;
          const body = bg.querySelector('#rvBody');
          let ok = true;
          if (!rating) { UI.toast('Pick a rating', 'Tap the stars first.', 'info'); return; }
          if (body.value.trim().length < 10) { body.closest('.field').classList.add('invalid'); ok = false; }
          if (!ok) return;
          const errBox = bg.querySelector('#rvErr');
          const btn = bg.querySelector('#rvSend');
          const title = bg.querySelector('#rvTitle').value;
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner"></span> ' + (editing ? 'Saving…' : 'Posting…');
          const call = editing
            ? S.updateReview(existing.id, rating, title, body.value)
            : S.addReview(dish.id, rating, title, body.value);
          Promise.resolve(call)
            .then(function (res) {
              if (!res || !res.ok) throw new Error((res && res.error) || 'Could not save.');
              bg.close();
              UI.toast(editing ? 'Review updated ⭐' : 'Review posted ⭐',
                editing ? 'Your changes are live.' : 'Thanks for helping other food lovers!');
              if (typeof renderReviews === 'function') renderReviews(dish);
            })
            .catch(function (e) {
              btn.disabled = false; btn.textContent = editing ? 'Save changes' : 'Post review';
              errBox.hidden = false; errBox.style.display = 'block';
              errBox.textContent = (e && e.message) || 'Could not save right now — try again.';
            });
        });
      }
    });
  }

  function starPicker(value) {
    const preset = Math.min(5, Math.max(0, Number(value) || 0));
    let h = '<div class="star-picker" role="radiogroup" aria-label="Your rating">';
    for (let i = 1; i <= 5; i++) {
      h += '<button type="button" class="sp-star' + (preset && i <= preset ? ' on' : '') + '" data-star="' + i + '" role="radio" aria-checked="' + (i === preset ? 'true' : 'false') + '" aria-label="' + i + ' star' + (i > 1 ? 's' : '') + '">'
        + '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.5l-5.8 3.1 1.1-6.4L2.6 9.6l6.5-.9Z"/></svg></button>';
    }
    return h + '</div>';
  }
  function bindPicker(root) {
    if (!root) return;
    root.querySelectorAll('.sp-star').forEach(function (b) {
      b.addEventListener('click', function () {
        const n = Number(b.getAttribute('data-star'));
        root.querySelectorAll('.sp-star').forEach(function (s) {
          const on = Number(s.getAttribute('data-star')) <= n;
          s.classList.toggle('on', on);
          s.setAttribute('aria-checked', String(Number(s.getAttribute('data-star')) === n));
        });
      });
    });
  }

  function starInline(r) {
    // filled amber stars for the detail header
    let s = '';
    const full = Math.round(r);
    for (let i = 0; i < 5; i++) {
      s += '<svg class="ic" style="color:' + (i < full ? '#F5A31B' : '#E9DECF') + ';width:15px;height:15px" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.5l-5.8 3.1 1.1-6.4L2.6 9.6l6.5-.9Z"/></svg>';
    }
    return s;
  }

  function init() {
    const id = UI.getParam('id');
    const dish = id ? S.foods().find(function (f) { return f.id === Number(id); }) : null;
    const area = document.getElementById('detailArea');
    if (!dish) {
      area.innerHTML = UI.emptyState({
        emoji: '🤔',
        title: 'Dish not found',
        msg: 'We couldn\'t find that dish. It may have been removed from the menu.',
        action: { href: 'menu.html', label: 'Browse the menu' }
      });
      UI.reveal(area);
      return;
    }
    current = dish;
    renderDetail(dish);
  }

  // The dish currently on screen — set once init() resolves it. Declared out
  // here because the live listeners below must re-render the section when
  // reviews arrive from another browser (cloud realtime) or when the sign-in
  // state changes after first paint (cloud boot settling / sign in / sign out).
  let current = null;

  if (S.on) {
    S.on('reviews', function () { if (current) renderReviews(current); });
    S.on('auth', function () { if (current) renderReviews(current); });
    // A brand-new dish (added in the admin console) has no cached detail —
    // re-resolve and render once the fresh catalog lands.
    S.on('foods', function () {
      if (current) return;
      const dish = UI.getParam('id') ? S.foods().find(function (f) { return f.id === Number(UI.getParam('id')); }) : null;
      if (dish) { current = dish; renderDetail(dish); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
