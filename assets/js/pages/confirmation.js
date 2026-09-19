'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function render() {
    const wrap = document.getElementById('confirmWrap');
    const id = UI.getParam('id');
    const order = id ? S.getOrder(id) : null;
    if (!order) {
      wrap.innerHTML = UI.emptyState({
        emoji: '🔍',
        title: 'Order not found',
        msg: 'We couldn\'t find that order. It may belong to another account.',
        action: { href: 'menu.html', label: 'Back to the menu' }
      });
      return;
    }
    const payLabel = UI.payMethodLabel(order.pay) + (order.pay === 'card' ? ' (simulated)' : '');
    /* Right after checkout this is the promise made at checkout (status is
       'pending'); if the order has since moved on, it shows the stage's own
       estimate — the same rule the tracking page uses. */
    const eta = D.etaFor(order);

    wrap.innerHTML = '<div class="confirm-wrap">'
      + '<div class="big-check">' + UI.ic('check') + '</div>'
      + '<span class="eyebrow" style="justify-content:center">Order confirmed — thank you!</span>'
      + '<h1>Your food is on the way to the kitchen.</h1>'
      + '<p class="lead">We\'ve received your order and will start preparing it right away. You can follow every step below.</p>'
      + '<div class="order-no">' + UI.ic('receipt') + 'Order ' + UI.esc(order.id) + '</div>'
      + '<div class="eta-strip">'
      + '<span class="eta-ic">' + UI.ic('clock') + '</span>'
      + '<span><b>' + (eta ? 'Estimated delivery by ' + UI.clockAt(eta.at) : 'This order was cancelled') + '</b>'
      + '<span>' + (eta ? 'About ' + eta.minutes + ' minutes from order' : 'See My orders for the full history') + '</span></span>'
      + '<a class="btn btn-primary" href="tracking.html?id=' + encodeURIComponent(order.id) + '">' + UI.ic('truck') + 'Track order</a>'
      + '</div>'
      + '<div class="confirm-card" style="text-align:left">'
      + '<h3>' + UI.ic('bag') + ' Order summary — ' + UI.esc(order.id) + '</h3>'
      + '<div class="mini-items">'
      + order.items.map(function (it) {
        return '<div class="mi"><span>' + UI.esc(it.name) + ' × ' + it.qty
          + (it.note ? '<em class="mi-note">' + UI.esc(it.note) + '</em>' : '')
          + '</span><b>' + D.naira(it.price * it.qty) + '</b></div>';
      }).join('')
      + '</div>'
      + '<div style="margin-top:14px">'
      + '<div class="sum-row"><span>Subtotal</span><b>' + D.naira(order.sub) + '</b></div>'
      + '<div class="sum-row"><span>Delivery fee</span><b>' + (order.deliveryFee === 0 ? '<span class="free">FREE</span>' : D.naira(order.deliveryFee)) + '</b></div>'
      + (order.discount > 0 ? '<div class="sum-row promo-row"><span>Promo discount ' + (order.promoCode ? '(' + UI.esc(order.promoCode) + ')' : '') + '</span><b>&minus;' + D.naira(order.discount) + '</b></div>' : '')
      + '<div class="sum-row total"><span>Total</span><b>' + D.naira(order.total) + '</b></div>'
      + '</div>'
      + '</div>'
      + '<div class="confirm-card">'
      + '<h3>' + UI.ic('pin') + ' Delivering to</h3>'
      + '<div class="kv" style="font-size:.95rem"><b>Name</b><span>' + UI.esc(order.customer.name) + '</span></div>'
      + '<div class="kv"><b>Phone</b><span>' + UI.esc(order.customer.phone) + '</span></div>'
      + '<div class="kv"><b>Address</b><span>' + UI.esc(order.customer.address) + ', ' + UI.esc(order.customer.city) + '</span></div>'
      + (order.customer.note ? '<div class="kv"><b>Note</b><span>' + UI.esc(order.customer.note) + '</span></div>' : '')
      + '<div class="kv"><b>Payment</b><span style="display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap">' + payLabel + UI.payBadge(UI.payStatusOf(order)) + '</span></div>'
      + (order.payRef ? '<div class="kv"><b>Reference</b><span><code style="background:var(--bg-soft);border:1px solid var(--line);border-radius:7px;padding:2px 8px;font-weight:800">' + UI.esc(order.payRef) + '</code></span></div>' : '')
      + '</div>'
      + '<div class="confirm-ctas">'
      + '<a class="btn btn-primary btn-lg" href="tracking.html?id=' + encodeURIComponent(order.id) + '">' + UI.ic('truck') + 'Track your order</a>'
      + '<button class="btn btn-outline btn-lg" data-print-receipt>' + UI.ic('receipt') + 'Print receipt</button>'
      + '<a class="btn btn-ghost btn-lg" href="menu.html">' + UI.ic('utensils') + 'Keep browsing</a>'
      + '</div>'
      + '</div>';
    const printBtn = wrap.querySelector('[data-print-receipt]');
    if (printBtn) printBtn.addEventListener('click', function () { UI.printReceipt(order); });
    UI.reveal(wrap);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  // cloud mode: data may still be in flight at first paint — re-render when it lands
  window.DD_STORE.on('orders', render);
})();
