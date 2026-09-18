'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function timelineHTML(order) {
    const cancelled = order.status === 'cancelled';
    const info = S.cancelInfo(order);
    /* A cancelled order has no current status on the happy path — read the
       FURTHEST step it actually reached out of its history instead, so the
       timeline freezes where fulfilment really stopped. */
    const idx = cancelled
      ? (order.statusHistory || []).reduce(function (far, h) {
        const i = D.STATUS_FLOW.findIndex(function (s) { return s.key === h.status; });
        return i > far ? i : far;
      }, 0)
      : S.statusIndex(order);
    const reached = {};
    (order.statusHistory || []).forEach(function (h) {
      if (!reached[h.status]) reached[h.status] = h.at;
    });
    const etaMin = order.status === 'delivered' ? 0 : (order.etaMin || D.CONFIG.avgDeliveryMin);
    const etaAt = Date.parse(order.placedAt) + etaMin * 60000;
    const remaining = Math.round((etaAt - Date.now()) / 60000);
    const showEta = !cancelled && order.status !== 'delivered' && remaining > 0;
    return '<div class="timeline">' + D.STATUS_FLOW.map(function (st, i) {
      // cancelled: mark exactly what the order actually reached, not a
      // position on a journey it never finished
      const done = cancelled ? !!reached[st.key] : (i < idx || (order.status === 'delivered' && i <= idx));
      const isCurrent = !cancelled && i === idx && order.status !== 'delivered';
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
    }).join('')
      + (cancelled
        ? '<div class="tl-step cancelled" data-reveal>'
          + '<span class="tl-dot">' + UI.ic('x') + '</span>'
          + '<div class="tl-body"><div class="tl-title">' + UI.esc(D.CANCELLED.label) + '</div>'
          + '<div class="tl-desc">' + UI.esc(info ? info.reason : D.CANCELLED.desc)
          + (info ? ' — ' + (info.by === 'admin' ? 'cancelled by DishDash support' : 'cancelled by you') : '') + '</div>'
          + (info && info.at ? '<span class="tl-time">' + UI.ic('clock') + UI.fmtDate(info.at) + '</span>' : '')
          + '</div></div>'
        : '')
      + '</div>';
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
    const info = S.cancelInfo(order);
    const canCancel = !!S.canCancel(order, 'customer').ok;
    const refund = order.refund || null;
    const canRefund = !!S.canRequestRefund(order).ok;
    /* Refund state, spelled out: what was asked for, what support decided, and
       that the money is (or is not) coming back. Terminal orders only — the
       request button carries the same rule through canRequestRefund(). */
    const refundNote = (function () {
      const r = order.refund;
      if (!r) return '';
      const cls = r.status === 'approved' ? ' approved' : (r.status === 'rejected' ? ' rejected' : '');
      const icon = r.status === 'approved' ? 'refresh' : (r.status === 'rejected' ? 'x' : 'clock');
      const title = r.status === 'approved' ? 'Refunded ' + D.naira(r.amount)
        : (r.status === 'rejected' ? 'Refund declined' : 'Refund requested — awaiting review');
      const detail = r.status === 'requested'
        ? 'Asked on ' + UI.fmtDate(r.requestedAt) + ' · ' + UI.esc(r.reason) + ' Support usually decides the same day.'
        : (r.status === 'approved'
          ? 'Approved on ' + UI.fmtDate(r.decidedAt) + (r.decidedBy ? ' by ' + UI.esc(r.decidedBy) : '')
          : 'Declined on ' + UI.fmtDate(r.decidedAt) + ' · ' + UI.esc(r.note));
      return '<div class="refund-note' + cls + '">' + UI.ic(icon) + '<span><b>' + UI.esc(title) + '</b><span>' + detail + '</span></span></div>';
    })();
    const cancelNote = order.status === 'cancelled' && info
      ? '<div class="cancel-note">' + UI.ic('x')
        + '<span><b>This order was cancelled</b>'
        + '<span>' + UI.esc(info.reason) + ' · ' + (info.by === 'admin' ? 'by DishDash support' : 'by you')
        + (info.at ? ' · ' + UI.fmtDate(info.at) : '') + '</span></span></div>'
      : '';

    view.innerHTML = '<div class="track-layout">'
      + '<div class="track-panel">'
      + '<div class="track-head">'
      + '<span class="or-id" style="font-size:1.1rem">Order ' + UI.esc(order.id) + '</span>'
      + UI.statusBadge(order.status)
      + '</div>'
      + timelineHTML(order)
      + cancelNote
      + refundNote
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:22px">'
      + '<a class="btn btn-outline" href="orders.html">' + UI.ic('arrow-l') + 'All orders</a>'
      + (canRefund ? '<button class="btn btn-outline" data-refund-order>' + UI.ic('refresh') + 'Request a refund</button>' : '')
      + (canCancel ? '<button class="btn btn-danger" data-cancel-order>' + UI.ic('x') + 'Cancel order</button>' : '')
      + (UI.isTerminal(order.status)
        ? '<button class="btn btn-ghost" data-reorder>' + UI.ic('refresh') + 'Order again</button>'
        : '<button class="btn btn-ghost" data-support>Need help? Contact us</button>')
      + '</div>'
      + (canCancel ? '<p class="promo-hint" style="margin-top:12px">' + UI.ic('info') + ' You can cancel free of charge while the order is still pending. Once the kitchen starts cooking it is final.</p>' : '')
      + (canRefund ? '<p class="promo-hint" style="margin-top:12px">' + UI.ic('info') + ' Something wrong with a paid order? You can ask for a refund once it is delivered or cancelled.</p>' : '')
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
      + (refund ? '<div class="sum-row"><span>Refund</span><b>' + UI.refundBadge(refund) + '</b></div>' : '')
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

    const refundBtn = view.querySelector('[data-refund-order]');
    if (refundBtn) {
      refundBtn.addEventListener('click', function () { UI.refundRequestFlow(order, render); });
    }
    const support = view.querySelector('[data-support]');
    if (support) {
      support.addEventListener('click', function () {
        UI.toast('We\'re here to help', 'Call ' + D.CONFIG.supportPhone + ' or email ' + D.CONFIG.supportEmail + '.', 'info', 5000);
      });
    }
    const cancelBtn = view.querySelector('[data-cancel-order]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        UI.promptDialog({
          title: 'Cancel order ' + order.id + '?',
          msg: 'Nothing has been cooked yet, so this is free to stop.',
          label: 'Why are you cancelling? (optional)',
          placeholder: 'e.g. ordered by mistake',
          danger: true,
          okText: 'Yes, cancel order',
          cancelText: 'Keep my order'
        }).then(function (reason) {
          if (reason === null) return;   // backed out
          Promise.resolve(S.cancelOrder(order.id, reason, 'customer')).then(function (res) {
            if (res && res.ok) {
              UI.toast('Order cancelled', order.id + ' was cancelled. Any promo code you used is available again.', 'success', 4600);
              render();
            } else {
              UI.toast('Could not cancel', (res && res.error) || 'Please try again.', 'error', 4600);
            }
          });
        });
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
