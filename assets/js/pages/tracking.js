'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function timelineHTML(order) {
    const idx = S.statusIndex(order);
    const reached = {};
    (order.statusHistory || []).forEach(function (h) {
      if (!reached[h.status]) reached[h.status] = h.at;
    });
    const etaMin = order.status === 'delivered' ? 0 : (order.etaMin || D.CONFIG.avgDeliveryMin);
    const etaAt = Date.parse(order.placedAt) + etaMin * 60000;
    const remaining = Math.round((etaAt - Date.now()) / 60000);
    const showEta = order.status !== 'delivered' && remaining > 0;
    return '<div class="timeline">' + D.STATUS_FLOW.map(function (st, i) {
      const done = i < idx || (order.status === 'delivered' && i <= idx);
      const isCurrent = i === idx && order.status !== 'delivered';
      const at = reached[st.key];
      const icon = done ? 'check' : ((UI.STATUS_ICON || {})[st.key] || 'clock');
      const tClass = done ? ' done' : (isCurrent ? ' current' : ' todo');
      let extra = '';
      if (isCurrent && showEta) {
        extra = '<div class="eta-strip" style="margin-top:12px;margin-bottom:0">'
          + '<span class="eta-ic">' + UI.ic('clock') + '</span>'
          + '<span><b>Arriving by ' + UI.etaClock(order.placedAt, etaMin) + '</b>'
          + '<span>' + (remaining >= 60 ? 'about ' + Math.round(remaining / 60) + 'h ' + (remaining % 60) + 'm to go' : (remaining > 1 ? 'about ' + remaining + ' minutes to go' : 'your rider is almost there')) + '</span></span></div>';
      }
      return '<div class="tl-step' + tClass + '" data-reveal>'
        + '<span class="tl-dot">' + UI.ic(icon) + '</span>'
        + '<div class="tl-body">'
        + '<div class="tl-title">' + UI.esc(st.label) + '</div>'
        + '<div class="tl-desc">' + UI.esc(st.desc) + '</div>'
        + (at ? '<span class="tl-time">' + UI.ic('clock') + UI.fmtDate(at) + '</span>' : '')
        + extra
        + '</div></div>';
    }).join('') + '</div>';
  }

  function render() {
    const view = document.getElementById('trackView');
    const id = UI.getParam('id');
    const order = id ? S.getOrder(id) : null;
    const user = S.currentUser();

    if (!order) {
      view.innerHTML = UI.emptyState({
        emoji: '📦',
        title: 'Order not found',
        msg: 'We couldn\'t find that order. Check the order number or sign in to the account it belongs to.',
        action: { href: 'orders.html', label: 'My orders' }
      });
      return;
    }
    if (!user || String(order.userId) !== String(user.id)) {
      view.innerHTML = UI.emptyState({
        emoji: '🔐',
        title: 'This order isn\'t yours',
        msg: 'Tracked orders are private to the account that placed them. Please sign in to continue.',
        action: { href: 'login.html?next=' + encodeURIComponent('tracking.html?id=' + order.id), label: 'Sign in' }
      });
      return;
    }
    const payLabel = UI.payMethodLabel(order.pay);

    view.innerHTML = '<div class="track-layout">'
      + '<div class="track-panel">'
      + '<div class="track-head">'
      + '<span class="or-id" style="font-size:1.1rem">Order ' + UI.esc(order.id) + '</span>'
      + UI.statusBadge(order.status)
      + '</div>'
      + timelineHTML(order)
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:22px">'
      + '<a class="btn btn-outline" href="orders.html">' + UI.ic('arrow-l') + 'All orders</a>'
      + (order.status !== 'delivered' ? '<button class="btn btn-ghost" data-support>Need help? Contact us</button>' : '<button class="btn btn-ghost" data-reorder>Order again</button>')
      + '</div>'
      + '</div>'

      + '<aside class="track-side">'
      + '<div class="summary-card" style="position:static;margin-bottom:18px">'
      + '<h3>Order summary</h3>'
      + '<div class="mini-items">' + order.items.map(function (it) {
        return '<div class="mi"><span>' + UI.esc(it.name) + ' × ' + it.qty
          + (it.note ? '<em class="mi-note">' + UI.esc(it.note) + '</em>' : '')
          + '</span><b>' + D.naira(it.price * it.qty) + '</b></div>';
      }).join('') + '</div>'
      + (order.discount > 0 ? '<div class="sum-row promo-row"><span>Promo ' + (order.promoCode ? UI.esc(order.promoCode) : 'discount') + '</span><b>&minus;' + D.naira(order.discount) + '</b></div>' : '')
      + '<div class="sum-row" style="margin-top:12px"><span>Total</span><b>' + D.naira(order.total) + '</b></div>'
      + '<div class="sum-row"><span>Payment</span><b style="font-weight:700;font-size:.9rem">' + payLabel + '</b></div>'
      + '<div class="sum-row"><span>Payment status</span><b>' + UI.payBadge(UI.payStatusOf(order)) + '</b></div>'
      + (order.payRef ? '<div class="sum-row"><span>Reference</span><b style="font-size:.85rem">' + UI.esc(order.payRef) + '</b></div>' : '')
      + '</div>'
      + '<div class="summary-card" style="position:static">'
      + '<h3>Delivery details</h3>'
      + '<div class="saved-addr">' + UI.ic('pin')
      + '<span><b>' + UI.esc(order.customer.name) + '</b>'
      + '<span style="color:var(--muted)">' + UI.esc(order.customer.phone) + '<br>' + UI.esc(order.customer.address) + ', ' + UI.esc(order.customer.city) + '</span>'
      + (order.customer.note ? '<br><span style="color:var(--muted)">Note: ' + UI.esc(order.customer.note) + '</span>' : '')
      + '</span></div>'
      + '<div class="sum-row"><span>Placed</span><b style="font-size:.85rem">' + UI.fmtDate(order.placedAt) + '</b></div>'
      + '</div></aside>'
      + '</div>';

    const support = view.querySelector('[data-support]');
    if (support) {
      support.addEventListener('click', function () {
        UI.toast('We\'re here to help', 'Call ' + D.CONFIG.supportPhone + ' or email ' + D.CONFIG.supportEmail + '.', 'info', 5000);
      });
    }
    const again = view.querySelector('[data-reorder]');
    if (again) {
      again.addEventListener('click', function () {
        order.items.forEach(function (it) { S.addToCart(it.dishId, it.qty); });
        UI.toast('Added to cart', 'Items from ' + order.id + ' added.', 'success');
        UI.cartUISync(true);
        setTimeout(function () { UI.go('cart.html'); }, 1200);
      });
    }
    UI.reveal(view);
  }

  // live updates: the admin console (other tab) may advance the status
  function reload() {
    if (document.visibilityState !== 'hidden') render();
  }
  window.addEventListener('storage', function (e) { if (e.key === 'dishdash_orders') reload(); });
  document.addEventListener('visibilitychange', reload);
  window.setInterval(reload, 30000); // 30s poll — ETA-driven auto-completion lands within one tick

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
  // cloud mode: order data may still be in flight at first paint — re-render when it lands
  window.DD_STORE.on('orders', reload);
})();
