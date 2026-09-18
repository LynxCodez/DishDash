'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  const state = { q: '', tab: 'all' };
  function refundsOf(list) {
    return list.filter(function (o) { return !!o.refund; });
  }

  /* Tab keys = the happy-path flow plus the off-flow terminal state, which is
     NOT part of DD_DATA.STATUS_FLOW (see the note by CANCELLED in data.js). */
  /* A refunds tab is not an order STATUS — it is a payment-side queue, so it
     sits beside the status tabs and filters on the order's refund record.
     Declared BEFORE TAB_KEYS: a const used in a const's initialiser must
     already be initialised, or the whole IIFE dies in the temporal dead zone. */
  const REFUND_TAB = 'refunds';

  const TAB_KEYS = ['all']
    .concat(D.STATUS_FLOW.map(function (s) { return s.key; }))
    .concat([D.CANCELLED.key])
    .concat([REFUND_TAB]);
  function tabLabel(t) {
    if (t === 'all') return 'All orders';
    if (t === REFUND_TAB) return 'Refunds';
    const m = D.statusMeta(t);
    return m ? m.label : t;
  }

  function guard() {
    if (!S.requireAdmin()) { UI.go('../login.html?next=admin/orders.html'); return false; }
    return true;
  }
  function esc(s) { return UI.esc(s); }

  function rowHTML(o) {
    const itemsLabel = o.items.reduce(function (n, it) { return n + it.qty; }, 0) + ' items';
    return '<tr>'
      + '<td class="td-strong">' + esc(o.id) + '</td>'
      + '<td><div class="user-cell"><span class="avatar avatar-sm green">' + UI.initials(o.customer.name) + '</span>'
      + '<span><span class="u-name">' + esc(o.customer.name) + '</span><span class="td-sub">' + esc(o.customer.phone) + '</span></span></div></td>'
      + '<td data-label="Placed" style="white-space:nowrap">' + UI.fmtDateShort(o.placedAt) + '<span class="td-sub">' + UI.timeAgo(o.placedAt) + '</span></td>'
      + '<td data-label="Items">' + itemsLabel + '<span class="td-sub">' + esc(o.customer.city) + '</span></td>'
      + '<td data-label="Total" class="text-strong">' + D.naira(o.total) + '</td>'
      + '<td data-label="Status">' + UI.statusBadge(o.status) + '</td>'
      + '<td data-label="Payment"><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">'
      + '<span style="font-size:.84rem;font-weight:700">' + esc(UI.payMethodLabel(o.pay)) + '</span>'
      + UI.payBadge(UI.payStatusOf(o))
      // An approved refund already reads "Refunded" in the pay badge; the chip
      // is for the two states that need someone to act or to remember.
      + (o.refund && o.refund.status !== 'approved' ? UI.refundBadge(o.refund) : '')
      + '</div></td>'
      + '<td style="text-align:right"><div class="row-actions">'
      + '<button class="icon-act view" data-view="' + esc(o.id) + '" aria-label="View order ' + esc(o.id) + '">' + UI.ic('eye') + '</button>'
      + (UI.isTerminal(o.status) ? '' : '<button class="icon-act" data-next="' + esc(o.id) + '" aria-label="Advance ' + esc(o.id) + '" style="color:var(--brand-700);font-size:.8rem;font-weight:800;padding:0 6px">Next ▸</button>')
      + (UI.isTerminal(o.status) ? '' : '<button class="icon-act" data-refuse="' + esc(o.id) + '" aria-label="Cancel order ' + esc(o.id) + '" style="color:var(--err)">' + UI.ic('x') + '</button>')
      + '</div></td>'
      + '</tr>';
  }

  function filtered() {
    const q = state.q.toLowerCase();
    return S.sortOrders(S.orders()).filter(function (o) {
      const inTab = state.tab === 'all' || (state.tab === REFUND_TAB ? !!o.refund : o.status === state.tab);
      const inQ = !q || o.id.toLowerCase().indexOf(q) !== -1 || o.customer.name.toLowerCase().indexOf(q) !== -1
        || o.customer.phone.toLowerCase().indexOf(q) !== -1;
      return inTab && inQ;
    });
  }

  function render() {
    if (!guard()) return;
    const all = S.sortOrders(S.orders());
    const counts = {};
    all.forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; });
    counts[REFUND_TAB] = refundsOf(all).length;
    const list = filtered();
    const wrap = document.getElementById('ordersWrap');
    document.getElementById('orderCount').textContent = list.length + ' of ' + all.length + ' orders';

    const tabs = TAB_KEYS.map(function (t) {
      const label = tabLabel(t);
      const n = t === 'all' ? all.length : (counts[t] || 0);
      const active = state.tab === t;
      return '<button class="atab' + (active ? ' active' : '') + '" data-tab="' + t + '" aria-pressed="' + active + '">' + esc(label) + ' <span class="n">' + n + '</span></button>';
    }).join('');

    if (!list.length) {
      wrap.innerHTML = '<div class="admin-tabs">' + tabs + '</div>'
        + '<div class="table-card">' + UI.emptyState({
          emoji: '🧾',
          title: 'No orders here',
          msg: state.tab === 'all' ? 'Orders placed on the customer site will appear in this list.' : 'There are no ' + tabLabel(state.tab).toLowerCase() + ' orders right now.',
          action: { href: 'orders.html', label: 'Show all orders' }
        }) + '</div>';
    } else {
      wrap.innerHTML = '<div class="admin-tabs">' + tabs + '</div>'
        + '<div class="table-card"><div class="tbl-scroll"><table class="tbl">'
        + '<thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Items</th><th>Total</th><th>Status</th><th>Payment</th><th style="text-align:right">Actions</th></tr></thead>'
        + '<tbody>' + list.map(rowHTML).join('') + '</tbody></table></div></div>';
    }

    wrap.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tab = b.getAttribute('data-tab');
        history.replaceState(null, '', 'orders.html' + (state.tab !== 'all' ? '?status=' + state.tab : ''));
        render();
      });
    });
    wrap.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { openDetail(S.getOrder(b.getAttribute('data-view'))); });
    });
    wrap.querySelectorAll('[data-next]').forEach(function (b) {
      b.addEventListener('click', function () { advance(S.getOrder(b.getAttribute('data-next'))); });
    });
    wrap.querySelectorAll('[data-refuse]').forEach(function (b) {
      b.addEventListener('click', function () { refuse(S.getOrder(b.getAttribute('data-refuse'))); });
    });
  }

  /* The snapshot of the account the CUSTOMER verified when submitting the
     transfer (item 3). The admin should see what was actually checked — the
     holder name and whose check (provider vs demo) produced it — not just
     that a number was typed. */
  function payingAccountHTML(o, compact) {
    const a = o.payAccount;
    if (!a) return '';
    const src = a.source === 'provider' ? 'Provider name-enquiry' : 'Demo resolution (name simulated)';
    const when = a.at ? ' · ' + UI.fmtDate(a.at) : '';
    if (compact) {
      return esc(a.accountName || 'unknown') + ' — ' + esc(a.bank || '') + ' · ' + esc(a.account || '');
    }
    return '<div class="kv"><b>From a/c</b><span><b style="font-weight:800">' + esc(a.accountName || '')
      + '</b><br>' + esc(a.bank || '') + ' · ' + esc(a.account || '') + '</span></div>'
      + '<div class="kv"><b>Account check</b><span>' + esc(src) + esc(when) + '</span></div>';
  }

  /* Refund block for the admin detail panel: what the customer asked for, what
     was decided, and what it does to the money. */
  function refundAdminHTML(r) {
    if (!r) return '';
    const m = D.refundMeta(r.status) || { label: r.status };
    return '<h4 style="margin-top:16px">' + UI.ic('refresh') + ' Refund</h4>'
      + '<div class="kv"><b>Status</b><span>' + UI.refundBadge(r) + '</span></div>'
      + '<div class="kv"><b>Amount</b><span><b style="font-weight:800">' + D.naira(r.amount) + '</b> (full order total)</span></div>'
      + '<div class="kv"><b>Requested</b><span>' + UI.fmtDate(r.requestedAt) + '</span></div>'
      + '<div class="kv"><b>Customer said</b><span>' + esc(r.reason) + '</span></div>'
      + (r.decidedAt
        ? '<div class="kv"><b>Decided</b><span>' + esc(m.label) + ' ' + UI.fmtDate(r.decidedAt)
          + (r.decidedBy ? ' by ' + esc(r.decidedBy) : '') + '</span></div>'
          + (r.note ? '<div class="kv"><b>Note</b><span>' + esc(r.note) + '</span></div>' : '')
        : '<div class="kv"><b>Decision</b><span>Waiting — approve or decline below.</span></div>');
  }

  function openDetail(o) {
    if (!o) { UI.toast('Order not found', 'That order no longer exists — the list has been refreshed.', 'error'); render(); return; }
    const next = S.nextStatus(o);
    const payStatus = UI.payStatusOf(o);
    const canVerify = o.pay === 'bank_transfer' && payStatus === 'awaiting_verification';
    const canConfirmCod = o.pay === 'cod' && payStatus === 'pending';
    const history = (o.statusHistory || []).slice().sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
    const html = '<div class="detail-grid">'
      + '<div class="detail-col"><h4>' + UI.ic('bag') + ' Items</h4>'
      + '<div class="detail-items">' + o.items.map(function (it) {
        return '<div class="di-row"><span class="di-th"><img src="' + D.img(it.img, 100) + '" alt="" onerror="this.remove()"></span>'
          + '<span class="di-name">' + esc(it.name) + (it.note ? '<em class="di-note">' + esc(it.note) + '</em>' : '') + '</span><span class="di-qty">× ' + it.qty + '</span>'
          + '<span class="di-price">' + D.naira(it.price * it.qty) + '</span></div>';
      }).join('') + '</div>'
      + '<div class="sum-row total" style="margin-top:10px"><span>Total</span><b>' + D.naira(o.total) + '</b></div></div>'
      + '<div class="detail-col">'
      + '<h4>' + UI.ic('user') + ' Customer &amp; delivery</h4>'
      + '<div class="kv"><b>Name</b><span>' + esc(o.customer.name) + '</span></div>'
      + '<div class="kv"><b>Phone</b><span>' + esc(o.customer.phone) + '</span></div>'
      + '<div class="kv"><b>Address</b><span>' + esc(o.customer.address) + ', ' + esc(o.customer.city) + '</span></div>'
      + (o.customer.note ? '<div class="kv"><b>Note</b><span>' + esc(o.customer.note) + '</span></div>' : '')
      + '<h4 style="margin-top:16px">' + UI.ic('wallet') + ' Payment</h4>'
      + '<div class="kv"><b>Method</b><span>' + esc(UI.payMethodLabel(o.pay)) + '</span></div>'
      + '<div class="kv"><b>Status</b><span>' + UI.payBadge(payStatus) + '</span></div>'
      + (o.payRef ? '<div class="kv"><b>Reference</b><span><code style="background:var(--bg-soft);border:1px solid var(--line);border-radius:7px;padding:2px 8px;font-weight:800">' + esc(o.payRef) + '</code></span></div>' : '')
      + payingAccountHTML(o, false)
      + (o.verifiedAt ? '<div class="kv"><b>Verified</b><span>' + UI.fmtDate(o.verifiedAt) + '</span></div>' : '')
      + (o.paidAt && o.pay === 'cod' ? '<div class="kv"><b>Collected</b><span>' + UI.fmtDate(o.paidAt) + '</span></div>' : '')
      + (o.pay === 'bank_transfer' ? '<p style="font-size:.78rem;color:var(--muted);margin-top:6px">Academic demo: the destination account is simulated, but the customer\u2019s account number was checked with the real CBN NUBAN rule.</p>' : '')
      + refundAdminHTML(o.refund)
      + '<div class="kv"><b>Placed</b><span>' + UI.fmtDate(o.placedAt) + '</span></div>'
      + '<h4 style="margin-top:16px">' + UI.ic('clock') + ' Status timeline</h4>'
      + '<div class="detail-items">' + history.map(function (h) {
        const who = h.status === 'cancelled'
          ? '<em class="di-note">' + esc(h.reason || 'No reason given') + ' · ' + (h.by === 'admin' ? 'DishDash support' : 'customer') + '</em>'
          : '';
        return '<div class="di-row" style="border:0;padding:5px 0"><span class="di-name" style="font-weight:750">' + UI.statusLabel(h.status) + who + '</span><span class="di-qty" style="margin-left:auto;color:var(--muted);font-size:.8rem">' + UI.fmtDate(h.at) + '</span></div>';
      }).join('') + '</div>'
      + '</div></div>';

    const refund = o.refund || null;
    const awaitingRefund = !!refund && refund.status === 'requested';
    const canCancel = !!S.canCancel(o, 'admin').ok;
    const terminalBadge = o.status === 'cancelled'
      ? '<span class="badge badge-danger" style="font-size:.88rem">' + UI.ic('x') + ' Cancelled</span>'
      : '<span class="badge badge-acc" style="font-size:.88rem">' + UI.ic('check') + ' Order complete</span>';
    const foot = '<button class="btn btn-ghost" data-cancel>Close</button>'
      + (awaitingRefund
        ? '<button class="btn btn-danger" data-refund-no>' + UI.ic('x') + ' Decline refund</button>'
          + '<button class="btn btn-primary" data-refund-yes>' + UI.ic('check') + ' Approve refund</button>'
        : '')
      + (canVerify
        ? '<button class="btn btn-primary" data-verify>' + UI.ic('shield') + ' Verify Payment</button>'
        : '')
      + (canConfirmCod
        ? '<button class="btn btn-primary" data-confirm-pay>' + UI.ic('check') + ' Confirm payment</button>'
        : '')
      + (canCancel
        ? '<button class="btn btn-danger" data-refuse>' + UI.ic('x') + ' Cancel order</button>'
        : '')
      + (next
        ? '<button class="btn btn-primary" data-adv>' + UI.ic('arrow-r') + ' Advance to ' + esc((D.STATUS_FLOW.find(function (s) { return s.key === next; }) || {}).label) + '</button>'
        : terminalBadge);

    const modal = UI.openModal(html, { title: 'Order ' + o.id, size: 'lg', foot: foot });
    modal.querySelector('[data-cancel]').addEventListener('click', function () { modal.close(); });
    const ver = modal.querySelector('[data-verify]');
    if (ver) {
      ver.addEventListener('click', function () {
        UI.confirmDialog({
          title: 'Verify transfer for ' + o.id + '?',
          msg: 'This marks the payment as Paid. The order status is NOT changed — fulfilment continues separately.',
          detail: o.payAccount ? 'Paying account the customer verified: ' + payingAccountHTML(o, true) : null,
          okText: 'Yes, mark as paid'
        }).then(function (yes) {
          if (!yes) return;
          Promise.resolve(S.verifyTransfer(o.id)).then(function (res) {
            if (res && res.ok) {
              UI.toast('Payment verified', o.id + ' is now marked paid.', 'success');
              modal.close();
              render();
            } else {
              UI.toast('Could not verify', (res && res.error) || 'Please try again.', 'error');
            }
          });
        });
      });
    }
    const cfp = modal.querySelector('[data-confirm-pay]');
    if (cfp) {
      cfp.addEventListener('click', function () {
        UI.confirmDialog({
          title: 'Confirm payment for ' + o.id + '?',
          msg: 'This records the cash as collected and marks the payment Paid. The order status is NOT changed.',
          okText: 'Yes, mark as paid'
        }).then(function (yes) {
          if (!yes) return;
          Promise.resolve(S.confirmPayment(o.id)).then(function (res) {
            if (res && res.ok) {
              UI.toast('Payment confirmed', o.id + ' cash collection recorded.', 'success');
              modal.close();
              render();
            } else {
              UI.toast('Could not confirm payment', (res && res.error) || 'Please try again.', 'error');
            }
          });
        });
      });
    }
    const ry = modal.querySelector('[data-refund-yes]');
    if (ry) {
      ry.addEventListener('click', function () {
        const r = o.refund || {};
        UI.promptDialog({
          title: 'Refund ' + D.naira(r.amount || o.total) + ' on ' + o.id + '?',
          msg: 'The full order total goes back to the customer. A decision is final — it cannot be re-opened or asked for again.',
          label: 'Note for the record (optional)',
          placeholder: 'e.g. rider confirmed the bag was damaged',
          okText: 'Yes, refund it',
          cancelText: 'Not yet'
        }).then(function (note) {
          if (note === null) return;
          Promise.resolve(S.decideRefund(o.id, true, note)).then(function (res) {
            if (res && res.ok) {
              UI.toast('Refund approved', o.id + ' — ' + D.naira((res.refund && res.refund.amount) || o.total) + ' refunded and removed from revenue.', 'success', 5200);
              modal.close();
              render();
            } else {
              UI.toast('Could not refund', (res && res.error) || 'Please try again.', 'error', 5200);
            }
          });
        });
      });
    }
    const rn = modal.querySelector('[data-refund-no]');
    if (rn) {
      rn.addEventListener('click', function () {
        UI.promptDialog({
          title: 'Decline the refund on ' + o.id + '?',
          msg: 'The customer keeps paying for this order and sees your reason. This cannot be undone.',
          label: 'Why is it declined? (shown to the customer)',
          placeholder: 'e.g. order was delivered on time and signed for',
          danger: true,
          okText: 'Decline refund',
          cancelText: 'Keep it open'
        }).then(function (note) {
          if (note === null) return;
          Promise.resolve(S.decideRefund(o.id, false, note)).then(function (res) {
            if (res && res.ok) {
              UI.toast('Refund declined', o.id + ' stays paid — the customer sees your reason.', 'info', 5200);
              modal.close();
              render();
            } else {
              UI.toast('Could not decline', (res && res.error) || 'Please try again.', 'error', 5200);
            }
          });
        });
      });
    }
    const rf = modal.querySelector('[data-refuse]');
    if (rf) {
      rf.addEventListener('click', function () {
        modal.close();
        refuse(o);
      });
    }
    const adv = modal.querySelector('[data-adv]');
    if (adv) {
      adv.addEventListener('click', function () {
        const nextLabel = (D.STATUS_FLOW.find(function (s) { return s.key === next; }) || {}).label;
        UI.confirmDialog({
          title: 'Advance order to "' + nextLabel + '"?',
          msg: 'This updates the customer\'s live tracking view.',
          okText: 'Yes, advance'
        }).then(function (yes) {
          if (yes) {
            Promise.resolve(S.updateOrderStatus(o.id, next)).then(function () {
              UI.toast('Order advanced', o.id + ' is now ' + nextLabel.toLowerCase() + '.');
              modal.close();
              render();
            });
          }
        });
      });
    }
  }

  /* Admin-side cancellation — a refusal. Allowed at any point before delivery
     (a customer can only stop their own order while it is still pending), and
     the reason is recorded on the order so the customer sees WHY in their
     tracking view rather than a silent disappearance. */
  function refuse(o) {
    if (!o) { UI.toast('Order not found', 'That order no longer exists — the list has been refreshed.', 'error'); render(); return; }
    const gate = S.canCancel(o, 'admin');
    if (!gate.ok) { UI.toast('Cannot cancel', gate.error, 'error'); return; }
    const isLive = o.status !== 'pending';
    UI.promptDialog({
      title: 'Cancel order ' + o.id + '?',
      msg: isLive
        ? 'This order is already ' + UI.statusLabel(o.status).toLowerCase() + '. Cancelling it stops fulfilment, and the customer will see your reason in their tracking view.'
        : 'The customer will see your reason in their tracking view.',
      label: 'Reason (shown to the customer)',
      placeholder: 'e.g. item out of stock, address outside our delivery zone',
      danger: true,
      okText: 'Yes, cancel order',
      cancelText: 'Keep order'
    }).then(function (reason) {
      if (reason === null) return;
      Promise.resolve(S.cancelOrder(o.id, reason, 'admin')).then(function (res) {
        if (res && res.ok) {
          UI.toast('Order cancelled', o.id + ' was cancelled and the customer notified.', 'success', 4200);
          render();
        } else {
          UI.toast('Could not cancel', (res && res.error) || 'Please try again.', 'error', 4200);
        }
      });
    });
  }

  function advance(o) {
    if (!o) { UI.toast('Order not found', 'That order no longer exists — the list has been refreshed.', 'error'); render(); return; }
    if (UI.isTerminal(o.status)) { UI.toast('Order is closed', UI.statusLabel(o.status) + ' orders cannot be advanced.', 'info'); return; }
    const next = S.nextStatus(o);
    if (!next) return;
    const nextLabel = (D.STATUS_FLOW.find(function (s) { return s.key === next; }) || {}).label;
    UI.confirmDialog({
      title: o.id + ' → ' + nextLabel + '?',
      msg: 'Quick action — the customer will see this change in their tracking view.',
      okText: 'Advance'
    }).then(function (yes) {
      if (yes) {
        Promise.resolve(S.updateOrderStatus(o.id, next)).then(function () {
          UI.toast('Order advanced', o.id + ' is now ' + nextLabel.toLowerCase() + '.');
          render();
        });
      }
    });
  }

  function init() {
    if (!guard()) return;
    state.tab = UI.getParam('status') || 'all';
    const q = UI.getParam('open');
    document.getElementById('orderSearch').addEventListener('submit', function (e) { e.preventDefault(); state.q = document.getElementById('orderQ').value.trim(); render(); });
    document.getElementById('orderQ').addEventListener('input', UI.debounce(function () { state.q = this.value.trim(); render(); }, 250));
    render();
    if (q) {
      const o = S.getOrder(q);
      if (o) openDetail(o);
    }
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'dishdash_orders' || e.key === 'dishdash_session') render();
  });
  window.DD_STORE.on('orders', render);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
