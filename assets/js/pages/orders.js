'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  let activeTab = 'active';

  /* The refund block under an order row — why the money came (or did not come)
     back, in the customer's words and the support team's. */
  function refundNoteHTML(r) {
    if (!r) return '';
    const cls = r.status === 'approved' ? ' approved' : (r.status === 'rejected' ? ' rejected' : '');
    const icon = r.status === 'approved' ? 'refresh' : (r.status === 'rejected' ? 'x' : 'clock');
    const title = r.status === 'approved' ? 'Refunded ' + D.naira(r.amount)
      : (r.status === 'rejected' ? 'Refund declined' : 'Refund requested — awaiting review');
    const lines = [];
    if (r.status === 'requested') lines.push('You asked on ' + UI.fmtDate(r.requestedAt) + ' · ' + UI.esc(r.reason));
    else if (r.decidedAt) lines.push((r.status === 'approved' ? 'Support refunded ' + D.naira(r.amount) : 'Support declined this request')
      + ' on ' + UI.fmtDate(r.decidedAt) + ' · ' + UI.esc(r.note));
    return '<div class="refund-note' + cls + '">' + UI.ic(icon) + '<span><b>' + UI.esc(title) + '</b>'
      + '<span>' + lines.join('<br>') + '</span></span></div>';
  }

  /* The same story, laid out as key/value rows for the details dialog. */
  function refundDetailHTML(r) {
    if (!r) return '';
    return '<div class="refund-summary">' + UI.ic('refresh')
      + '<span><b>' + UI.esc((D.refundMeta(r.status) || {}).label || r.status) + '</b> — ' + D.naira(r.amount)
      + '<br>Requested ' + UI.fmtDate(r.requestedAt) + ' · ' + UI.esc(r.reason)
      + (r.decidedAt
        ? '<br>' + (r.status === 'approved' ? 'Approved' : 'Declined') + ' ' + UI.fmtDate(r.decidedAt)
          + (r.decidedBy ? ' by ' + UI.esc(r.decidedBy) : '') + (r.note ? ' · ' + UI.esc(r.note) : '')
        : '<br>Support has not decided yet.')
      + '</span></div>';
  }

  function orderRow(o) {
    const active = !UI.isTerminal(o.status);
    const info = S.cancelInfo(o);
    return '<div class="order-row' + (o.status === 'cancelled' ? ' is-cancelled' : '') + '" data-reveal>'
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
      + (o.status === 'cancelled'
        ? '<div class="cancel-note">' + UI.ic('x') + '<span><b>Cancelled</b><span>'
          + UI.esc(info ? info.reason : 'Cancelled') + ' · ' + (info && info.by === 'admin' ? 'by DishDash support' : 'by you')
          + (info && info.at ? ' · ' + UI.fmtDate(info.at) : '') + '</span></span></div>'
        : '')
      + refundNoteHTML(o.refund)
      + '<div class="or-foot">'
      + '<span class="or-total"><small>Total</small>' + D.naira(o.total) + '</span>'
      + UI.refundBadge(o.refund)
      + (o.status === 'cancelled'
        ? '<span class="badge badge-danger">' + UI.ic('x') + ' Cancelled</span>'
        : (o.status === 'delivered'
          ? '<span class="badge badge-acc">' + UI.ic('check') + ' Delivered</span>'
          : '<a class="btn btn-primary btn-sm" href="tracking.html?id=' + encodeURIComponent(o.id) + '">' + UI.ic('truck') + 'Track order</a>'))
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
      + refundDetailHTML(o.refund)
      + '</div></div>';
    const canCancel = !!S.canCancel(o, 'customer').ok;
    const canRefund = !!S.canRequestRefund(o).ok;
    const modal = UI.openModal(html, {
      title: 'Order ' + o.id,
      size: 'lg',
      foot: '<button class="btn btn-outline" data-print-receipt>' + UI.ic('receipt') + 'Print receipt</button>'
        + (canRefund
          ? '<button class="btn btn-outline" data-refund-order>' + UI.ic('refresh') + ' Request a refund</button>'
          : '')
        + (canCancel
          ? '<button class="btn btn-danger" data-cancel-order>' + UI.ic('x') + ' Cancel order</button>'
          : '')
        + (UI.isTerminal(o.status)
          ? '<button class="btn btn-primary" data-order-again="' + UI.esc(o.id) + '">' + UI.ic('refresh') + ' Order again</button>'
          : '<a class="btn btn-primary" href="tracking.html?id=' + encodeURIComponent(o.id) + '">' + UI.ic('truck') + ' Track this order</a>')
    });
    const again = modal.querySelector('[data-order-again]');
    if (again) again.addEventListener('click', function () { reorder(o); });
    const printBtn = modal.querySelector('[data-print-receipt]');
    if (printBtn) printBtn.addEventListener('click', function () { UI.printReceipt(o); });
    const refundBtn = modal.querySelector('[data-refund-order]');
    if (refundBtn) {
      refundBtn.addEventListener('click', function () {
        modal.close();
        UI.refundRequestFlow(o, render);
      });
    }
    const cancelBtn = modal.querySelector('[data-cancel-order]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        UI.promptDialog({
          title: 'Cancel order ' + o.id + '?',
          msg: 'Nothing has been cooked yet, so this is free to stop.',
          label: 'Why are you cancelling? (optional)',
          placeholder: 'e.g. ordered by mistake',
          danger: true,
          okText: 'Yes, cancel order',
          cancelText: 'Keep my order'
        }).then(function (reason) {
          if (reason === null) return;
          Promise.resolve(S.cancelOrder(o.id, reason, 'customer')).then(function (res) {
            if (res && res.ok) {
              modal.close();
              UI.toast('Order cancelled', o.id + ' was cancelled. Any promo code you used is available again.', 'success', 4600);
              render();
            } else {
              UI.toast('Could not cancel', (res && res.error) || 'Please try again.', 'error', 4600);
            }
          });
        });
      });
    }
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

    // cancelled orders are history, not active work — same rule as the store
    const active = mine.filter(function (o) { return !UI.isTerminal(o.status); });
    const past = mine.filter(function (o) { return UI.isTerminal(o.status); });
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
