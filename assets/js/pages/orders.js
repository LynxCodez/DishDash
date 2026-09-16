'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  let activeTab = 'active';

  function orderRow(o) {
    const active = o.status !== 'delivered';
    return '<div class="order-row" data-reveal>'
      + '<div class="or-top">'
      + '<span class="or-id">' + UI.esc(o.id) + '</span>'
      + '<span class="or-date">' + UI.ic('cal') + UI.fmtDate(o.placedAt) + '</span>'
      + UI.statusBadge(o.status)
      + '</div>'
      + '<div class="or-items">'
      + o.items.map(function (it) {
        const liveDish = S.foods().find(function (f) { return f.id === it.dishId; });
        const cat = UI.catOf(liveDish ? liveDish.cat : '');
        return '<span class="or-item-chip"><span class="th">' + cat.emoji
          + '<img src="' + D.img(it.img, 80) + '" alt="" loading="lazy" onerror="this.remove()"></span>'
          + UI.esc(it.name) + ' × ' + it.qty + '</span>';
      }).join('')
      + '</div>'
      + '<div class="or-foot">'
      + '<span class="or-total"><small>Total</small>' + D.naira(o.total) + '</span>'
      + (active
        ? '<a class="btn btn-primary btn-sm" href="tracking.html?id=' + encodeURIComponent(o.id) + '">' + UI.ic('truck') + 'Track order</a>'
        : '<span class="badge badge-acc">' + UI.ic('check') + ' Delivered</span>')
      + '<button class="btn btn-outline btn-sm" data-details="' + UI.esc(o.id) + '">View details</button>'
      + '<button class="btn btn-ghost btn-sm" data-reorder="' + UI.esc(o.id) + '" aria-label="Order again">' + UI.ic('refresh') + 'Order again</button>'
      + '</div></div>';
  }

  function openDetails(o) {
    const payLabel = UI.payMethodLabel(o.pay);
    const html = '<div class="detail-grid">'
      + '<div class="detail-col"><h4>' + UI.ic('bag') + ' Items</h4>'
      + '<div class="detail-items">' + o.items.map(function (it) {
        return '<div class="di-row"><span class="di-th"><img src="' + D.img(it.img, 80) + '" alt="" onerror="this.remove()"></span>'
          + '<span class="di-name">' + UI.esc(it.name) + (it.note ? '<em class="di-note">' + UI.esc(it.note) + '</em>' : '') + '</span><span class="di-qty">× ' + it.qty + '</span>'
          + '<span class="di-price">' + D.naira(it.price * it.qty) + '</span></div>';
      }).join('') + '</div></div>'
      + '<div class="detail-col"><h4>' + UI.ic('pin') + ' Delivery</h4>'
      + '<div class="kv"><b>Name</b><span>' + UI.esc(o.customer.name) + '</span></div>'
      + '<div class="kv"><b>Address</b><span>' + UI.esc(o.customer.address) + ', ' + UI.esc(o.customer.city) + '</span></div>'
      + '<div class="kv"><b>Payment</b><span style="display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap">' + payLabel + UI.payBadge(UI.payStatusOf(o)) + '</span></div>'
      + (o.payRef ? '<div class="kv"><b>Reference</b><span><code style="background:var(--bg-soft);border:1px solid var(--line);border-radius:7px;padding:2px 8px;font-weight:800">' + UI.esc(o.payRef) + '</code></span></div>' : '')
      + '<div class="kv"><b>Placed</b><span>' + UI.fmtDate(o.placedAt) + '</span></div>'
      + (o.discount > 0 ? '<div class="kv"><b>Promo ' + (o.promoCode ? '(' + UI.esc(o.promoCode) + ')' : 'discount') + '</b><span>&minus;' + D.naira(o.discount) + '</span></div>' : '')
      + '<div class="kv"><b>Total</b><span style="font-weight:800">' + D.naira(o.total) + '</span></div>'
      + '</div></div>';
    UI.openModal(html, {
      title: 'Order ' + o.id,
      size: 'lg',
      foot: '<button class="btn btn-outline" data-print-receipt>' + UI.ic('receipt') + 'Print receipt</button>'
        + (o.status !== 'delivered'
          ? '<a class="btn btn-primary" href="tracking.html?id=' + encodeURIComponent(o.id) + '">' + UI.ic('truck') + 'Track this order</a>'
          : '<button class="btn btn-primary" data-order-again="' + UI.esc(o.id) + '">' + UI.ic('refresh') + ' Order again</button>')
    });
    const again = document.querySelector('[data-order-again]');
    if (again) again.addEventListener('click', function () { reorder(o); });
    const printBtn = document.querySelector('[data-print-receipt]');
    if (printBtn) printBtn.addEventListener('click', function () { UI.printReceipt(o); });
  }

  function reorder(o) {
    o.items.forEach(function (it) { S.addToCart(it.dishId, it.qty); });
    UI.toast('Added to cart', o.items.length + ' item' + (o.items.length === 1 ? '' : 's') + ' from ' + o.id + ' added.', 'success', 4200);
    UI.cartUISync(true);
    setTimeout(function () { UI.go('cart.html'); }, 1300);
  }

  function render() {
    const user = S.currentUser();
    const view = document.getElementById('ordersView');

    if (!user || user.role === 'admin') {
      view.innerHTML = '<div class="cart-layout" style="grid-template-columns:1fr">'
        + UI.emptyState({
          emoji: '🔐',
          title: 'Sign in to view your orders',
          msg: 'Your order history is tied to your account. Sign in to keep track.',
          action: { href: 'login.html?next=orders.html', label: 'Go to sign in' }
        }) + '</div>';
      return;
    }

    const mine = S.myOrders();
    if (!mine.length) {
      view.innerHTML = UI.emptyState({
        emoji: '🧾',
        title: 'No orders yet',
        msg: 'When you place your first order it will show up here, ready to track.',
        action: { href: 'menu.html', label: 'Start an order' }
      });
      return;
    }

    const active = mine.filter(function (o) { return o.status !== 'delivered'; });
    const past = mine.filter(function (o) { return o.status === 'delivered'; });
    const list = activeTab === 'active' ? active : past;

    view.innerHTML =
      '<div class="orders-tabs" role="tablist">'
      + '<button class="otab' + (activeTab === 'active' ? ' active' : '') + '" data-tab="active" role="tab" aria-selected="' + (activeTab === 'active') + '">Active orders <span class="n">' + active.length + '</span></button>'
      + '<button class="otab' + (activeTab === 'past' ? ' active' : '') + '" data-tab="past" role="tab" aria-selected="' + (activeTab === 'past') + '">Order history <span class="n">' + past.length + '</span></button>'
      + '</div>'
      + (list.length ? list.map(orderRow).join('')
        : UI.emptyState({
          emoji: activeTab === 'active' ? '🛵' : '🗂️',
          title: activeTab === 'active' ? 'No active orders' : 'No past orders yet',
          msg: activeTab === 'active'
            ? 'Nothing in the kitchen right now. When you order, you\'ll be able to track it here live.'
            : 'Once you complete orders they will appear here for easy re-ordering.',
          action: { href: 'menu.html', label: 'Browse the menu' }
        }));

    view.querySelectorAll('.otab').forEach(function (t) {
      t.addEventListener('click', function () {
        activeTab = t.getAttribute('data-tab');
        render();
      });
    });
    view.querySelectorAll('[data-details]').forEach(function (b) {
      b.addEventListener('click', function () { openDetails(S.getOrder(b.getAttribute('data-details'))); });
    });
    view.querySelectorAll('[data-reorder]').forEach(function (b) {
      b.addEventListener('click', function () {
        const o = S.getOrder(b.getAttribute('data-reorder'));
        if (o) UI.confirmDialog({
          title: 'Order again?',
          msg: 'We\'ll add every item from ' + o.id + ' back to your cart.',
          okText: 'Add to cart'
        }).then(function (yes) { if (yes) reorder(o); });
      });
    });
    UI.reveal(view);
  }

  // live: admin may advance statuses in another tab
  window.addEventListener('storage', function (e) {
    if (e.key === 'dishdash_orders' || e.key === 'dishdash_session') render();
  });
  window.DD_STORE.on('orders', render);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
