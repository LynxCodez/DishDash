'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function lineHTML(l) {
    const dish = l.dish;
    const cat = UI.catOf(dish.cat);
    const lineTotal = dish.price * l.qty;
    return '<div class="cart-item" data-cartline="' + dish.id + '" data-note="' + UI.esc(l.note || '') + '">'
      + '<a class="ci-img" href="food.html?id=' + dish.id + '" aria-label="' + UI.esc(dish.name) + '">'
      + '<span class="img-emoji" aria-hidden="true">' + cat.emoji + '</span>'
      + '<img src="' + D.img(dish.img, 300) + '" alt="" loading="lazy" onerror="this.remove()"></a>'
      + '<div class="ci-main">'
      + '<a class="ci-name" href="food.html?id=' + dish.id + '">' + UI.esc(dish.name) + '</a>'
      + '<span class="ci-cat">' + UI.esc(cat.name) + (dish.inStock === false ? ' · <span style="color:var(--err)">sold out — remove or reorder later</span>' : '') + '</span>'
      + '<div class="ci-noterow">'
      + (l.note
        ? '<span class="ci-note" data-editnote role="button" tabindex="0" title="Click to edit"><span aria-hidden="true">&#9998;</span> ' + UI.esc(l.note) + '</span>'
        : '<button class="cn-add" data-addnote type="button">+ Add note</button>')
      + '</div>'
      + '<div class="ci-unit">' + D.naira(dish.price) + ' <b>each</b></div>'
      + '</div>'
      + '<div class="ci-side">'
      + '<div class="ci-line">' + (dish.oldPrice ? '<span class="was">' + D.naira(dish.oldPrice) + '</span>' : '') + D.naira(lineTotal) + '</div>'
      + '<div style="display:flex;align-items:center;gap:12px">'
      + '<div class="qty-stepper" style="border-radius:11px">'
      + '<button data-qty="-1" aria-label="Decrease quantity of ' + UI.esc(dish.name) + '" style="width:36px;height:38px">' + UI.ic('minus') + '</button>'
      + '<span class="qty-val" style="min-width:26px;font-size:.92rem">' + l.qty + '</span>'
      + '<button data-qty="1" aria-label="Increase quantity of ' + UI.esc(dish.name) + '" style="width:36px;height:38px">' + UI.ic('plus') + '</button>'
      + '</div>'
      + '<button class="ci-remove" data-remove aria-label="Remove ' + UI.esc(dish.name) + ' from cart">' + UI.ic('trash') + 'Remove</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function summaryHTML(sum) {
    const freeDelivery = sum.sub >= sum.freeDeliveryMin;
    const pct = Math.min(100, (sum.sub / sum.freeDeliveryMin) * 100);
    return '<aside class="summary-card">'
      + '<h3>Order summary</h3>'
      + '<div class="meter-wrap">'
      + '<div class="meter-msg">' + UI.ic(freeDelivery ? 'check' : 'truck')
      + (freeDelivery ? '<span>You\'ve unlocked <b style="color:var(--acc-600)">free delivery!</b></span>'
        : '<span>Add <b style="color:var(--brand-600)">' + D.naira(sum.toFree) + '</b> more for free delivery</span>') + '</div>'
      + '<div class="meter"><i style="width:' + pct + '%"></i></div>'
      + '</div>'
      + '<div class="sum-row"><span>Subtotal (' + sum.count + ' item' + (sum.count === 1 ? '' : 's') + ')</span><b>' + D.naira(sum.sub) + '</b></div>'
      + '<div class="sum-row"><span>Delivery fee</span>'
      + (sum.deliveryFee === 0 ? '<b class="free">FREE</b>' : '<b>' + D.naira(sum.deliveryFee) + '</b>') + '</div>'
      + '<div class="sum-row total"><span>Total</span><b>' + D.naira(sum.total) + '</b></div>'
      + '<button class="btn btn-primary btn-lg btn-block" data-checkout>' + UI.ic('arrow-r') + 'Proceed to checkout</button>'
      + '<div class="sum-note">' + UI.ic('shield') + '<span>Payment is collected on delivery or securely at checkout. This is a <b>demo</b> — no real card is ever charged.</span></div>'
      + '</aside>';
  }

  function render() {
    const sum = S.cartSummary();
    const view = document.getElementById('cartView');
    document.getElementById('cartSub').textContent = sum.count
      ? sum.count + ' item' + (sum.count === 1 ? '' : 's') + ' in your cart'
      : 'Your cart is empty.';

    if (!sum.count) {
      view.innerHTML = '<div class="cart-layout" style="grid-template-columns:1fr">'
        + UI.emptyState({
          emoji: '🛒',
          title: 'Your cart is empty',
          msg: 'Looks like you haven\'t added anything yet. Explore the menu and find something delicious.',
          action: { href: 'menu.html', label: 'Browse the menu' }
        }) + '</div>';
      return;
    }

    view.innerHTML = '<div class="cart-layout">'
      + '<div class="cart-items">' + sum.lines.map(lineHTML).join('') + '</div>'
      + summaryHTML(sum)
      + '</div>'
      + '<a class="cont-shop" href="menu.html">' + UI.ic('arrow-l') + 'Continue shopping</a>';

    // qty + remove handlers
    view.querySelectorAll('[data-cartline]').forEach(function (row) {
      const dishId = row.getAttribute('data-cartline');
      const rowNote = row.getAttribute('data-note') || '';
      // note editing — click the note (or “Add note”) to swap in an input
      const noteTrigger = row.querySelector('[data-editnote]') || row.querySelector('[data-addnote]');
      if (noteTrigger) {
        function openEditor() {
          const holder = row.querySelector('.ci-noterow');
          if (!holder || holder.querySelector('input')) return;
          holder.innerHTML = '<input class="input ci-note-input" type="text" maxlength="120" value="' + UI.esc(rowNote) + '" placeholder="e.g. extra sauce, no onions" aria-label="Special instructions for this item">';
          const inp = holder.querySelector('input');
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
          let done = false;
          function commit() {
            if (done) return;
            done = true;
            S.updateCartNote(dishId, rowNote, inp.value);
            render();
          }
          inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') { done = true; render(); }
          });
          inp.addEventListener('blur', commit);
        }
        noteTrigger.addEventListener('click', openEditor);
        noteTrigger.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(); } });
      }
      row.querySelectorAll('[data-qty]').forEach(function (b) {
        b.addEventListener('click', function () {
          const line = S.cartLines().find(function (l) { return String(l.dish.id) === dishId && (l.note || '') === rowNote; });
          if (!line) return;
          const delta = Number(b.getAttribute('data-qty'));
          const next = line.qty + delta;
          if (next <= 0) {
            S.removeFromCart(dishId, rowNote);
            UI.toast('Removed from cart', 'Item removed.', 'info');
          } else {
            S.setCartQty(dishId, next, rowNote);
          }
          render();
        });
      });
      row.querySelector('[data-remove]').addEventListener('click', function () {
        const dish = S.foods().find(function (f) { return f.id === Number(dishId); });
        UI.confirmDialog({
          title: 'Remove this item?',
          msg: (dish ? dish.name : 'This item') + (rowNote ? ' · ' + rowNote : ''),
          okText: 'Remove',
          danger: true,
          icon: 'trash'
        }).then(function (yes) {
          if (yes) {
            S.removeFromCart(dishId, rowNote);
            UI.toast('Removed from cart', dish ? dish.name : '', 'info');
            render();
          }
        });
      });
    });
    view.querySelector('[data-checkout]').addEventListener('click', function () {
      const user = S.currentUser();
      if (!user) {
        UI.toast('Sign in to continue', 'You\'ll need an account to check out.', 'info');
        UI.go('login.html?next=checkout.html');
        return;
      }
      if (user.role === 'admin') {
        UI.toast('Customer account needed', 'Sign in with a customer account to place orders.', 'error');
        S.logout();
        setTimeout(function () { UI.go('login.html?next=checkout.html'); }, 1500);
        return;
      }
      UI.go('checkout.html');
    });
    UI.reveal(view);
  }

  // keep view in sync with storage changes (other tab removed item etc.)
  window.addEventListener('storage', function (e) {
    if (e.key === 'dishdash_cart') render();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
