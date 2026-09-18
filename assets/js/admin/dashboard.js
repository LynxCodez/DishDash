'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function esc(s) { return UI.esc(s); }

  function guard() {
    if (!S.requireAdmin()) {
      UI.go('../login.html?next=admin/index.html');
      return false;
    }
    return true;
  }

  function stats() {
    const raw = S.orders();
    /* A cancelled order is not a sale. It must not inflate revenue, order
       counts or the live list — the same rule the reports page and both
       order lists apply. Cancellations are surfaced as their own number so
       they stay visible instead of quietly vanishing. */
    const orders = raw.filter(function (o) { return o.status !== 'cancelled'; });
    const users = S.users();
    /* Refunded money is NOT revenue: the customer got the order price back, so
       it leaves the revenue figure and is surfaced as its own number instead.
       (payStatusOf derives 'refunded' from the order's refund record.) */
    const notRefunded = orders.filter(function (o) { return UI.payStatusOf(o) !== 'refunded'; });
    const revenue = notRefunded.reduce(function (s, o) { return s + o.total; }, 0);
    const customers = users.filter(function (u) { return u.role === 'customer'; });
    const refunds = S.refundTotals ? S.refundTotals(orders) : { count: 0, amount: 0, pending: 0 };
    return {
      orders: orders, notRefunded: notRefunded, revenue: revenue, customers: customers,
      foods: S.foods().length,
      cancelled: raw.length - orders.length,
      refunds: refunds,
      pending: orders.filter(function (o) { return o.status === 'pending'; }),
      live: orders.filter(function (o) { return o.status !== 'delivered'; })
    };
  }

  function weekBars(orders) {
    // anchor = latest order date so the demo chart always has shape
    const anchor = orders.reduce(function (m, o) { return Math.max(m, Date.parse(o.placedAt)); }, Date.now());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = orders.filter(function (o) { return Date.parse(o.placedAt) >= d.getTime() && Date.parse(o.placedAt) < d.getTime() + 86400000; });
      days.push({
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        day: d.getDate(),
        count: dayOrders.length,
        revenue: dayOrders.reduce(function (s, o) { return s + o.total; }, 0)
      });
    }
    return days;
  }

  function statusDistribution(orders) {
    const map = {};
    orders.forEach(function (o) { map[o.status] = (map[o.status] || 0) + 1; });
    return D.STATUS_FLOW.map(function (st) { return { key: st.key, label: st.label, count: map[st.key] || 0 }; });
  }

  function topDishes(orders) {
    const map = {};
    orders.forEach(function (o) {
      o.items.forEach(function (it) {
        if (!map[it.dishId]) map[it.dishId] = { name: it.name, qty: 0, rev: 0, img: it.img };
        map[it.dishId].qty += it.qty;
        map[it.dishId].rev += it.qty * it.price;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);
  }

  const STATUS_COLORS = { pending: '#9A5B00', confirmed: '#0C5C99', preparing: '#6A3DC4', outfordelivery: '#0E6E64', delivered: '#0A633F' };

  function render() {
    if (!guard()) return;
    const st = stats();
    const root = document.getElementById('dashRoot');
    const users = st.customers;

    const weekCount = weekBars(st.orders).reduce(function (s, d) { return s + d.count; }, 0);
    const weekRev = weekBars(st.notRefunded).reduce(function (s, d) { return s + d.revenue; }, 0);
    const pendingStr = st.pending.length
      ? '<div class="pending-strip"><span class="ps-ic">' + UI.ic('clock') + '</span>'
      + '<span><b>' + st.pending.length + ' order' + (st.pending.length === 1 ? '' : 's') + ' waiting for confirmation</b><span style="display:block">Head to Orders to review and move them forward.</span></span>'
      + '<a class="btn btn-primary btn-sm" href="orders.html?status=pending">Review now</a></div>'
      : '<div class="pending-strip"><span class="ps-ic" style="background:rgba(23,156,99,.2);color:#6FCFA4">' + UI.ic('check') + '</span>'
      + '<span><b>All caught up</b><span style="display:block">No orders are waiting for confirmation.</span></span></div>';

    // stats
    const statCards = [
      { ic: 'wallet', cls: 'si-rev', label: 'Total revenue', val: D.naira(st.revenue), sub: weekRev > 0 ? '₦' + weekRev.toLocaleString() + ' in last 7 days' : 'Includes all orders (demo)' },
      { ic: 'receipt', cls: 'si-order', label: 'Total orders', val: String(st.orders.length), sub: weekCount + ' in last 7 days' },
      { ic: 'users', cls: 'si-user', label: 'Customers', val: String(users.length), sub: 'registered accounts' },
      { ic: 'utensils', cls: 'si-food', label: 'Food items', val: String(st.foods), sub: 'on the live menu' },
      st.cancelled
        ? { ic: 'x', cls: 'si-cancel', label: 'Cancelled', val: String(st.cancelled), sub: 'excluded from revenue' }
        : null,
      st.refunds.count
        ? { ic: 'refresh', cls: 'si-cancel', label: 'Refunded', val: D.naira(st.refunds.amount), sub: st.refunds.count + ' order' + (st.refunds.count === 1 ? '' : 's') + ' removed from revenue' }
        : null,
      st.refunds.pending
        ? { ic: 'clock', cls: 'si-pend', label: 'Refund requests', val: String(st.refunds.pending), sub: 'waiting for your decision' }
        : null
    ].filter(Boolean).map(function (c) {
      return '<div class="stat-card" data-reveal><span class="stat-ico ' + c.cls + '">' + UI.ic(c.ic) + '</span>'
        + '<div class="stat-body"><b>' + c.label + '</b><div class="val">' + c.val + '</div><div class="delta" style="color:var(--muted);font-weight:650">' + esc(c.sub) + '</div></div></div>';
    }).join('');

    // bars
    const bars = weekBars(st.orders);
    const maxCount = Math.max.apply(null, bars.map(function (b) { return b.count; }).concat([1]));
    const barHTML = bars.map(function (b) {
      const pct = Math.round((b.count / maxCount) * 100);
      return '<div class="bar-col"><span class="b-val">' + b.count + '</span>'
        + '<div class="bar-track"><i class="bar-fill" data-h="0" style="height:0" data-pct="' + (pct || 2) + '"></i></div>'
        + '<span class="b-day">' + b.label + ' ' + b.day + '</span></div>';
    }).join('');

    // donut
    const dist = statusDistribution(st.orders);
    const total = st.orders.length || 1;
    let acc = 0;
    const stops = dist.map(function (d) {
      const from = acc;
      acc += d.count / total * 100;
      return from + '% ' + acc + '%';
    });
    const donutGrad = 'conic-gradient(' + dist.map(function (d, i) {
      return STATUS_COLORS[d.key] + ' ' + stops[i];
    }).join(',') + ')';
    const donutLegend = dist.map(function (d) {
      return '<div class="dl-row"><span class="sw" style="background:' + STATUS_COLORS[d.key] + '"></span>' + esc(d.label)
        + '<b>' + d.count + '</b></div>';
    }).join('');

    // top dishes
    const td = topDishes(st.orders);
    const tdHTML = td.map(function (t, i) {
      return '<div class="td-row"><span class="td-rank">' + (i + 1) + '</span>'
        + '<span class="td-th"><img src="' + D.img(t.img, 120) + '" alt="" loading="lazy" onerror="this.remove()"></span>'
        + '<span class="td-name">' + esc(t.name) + '</span>'
        + '<span class="td-qty">' + t.qty + ' sold</span>'
        + '<span class="td-rev">' + D.naira(t.rev) + '</span></div>';
    }).join('');

    // recent orders
    const recent = S.sortOrders(st.orders).slice(0, 6);
    const recentHTML = recent.length
      ? '<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Total</th><th>Status</th><th style="text-align:right">Action</th></tr></thead><tbody>'
      + recent.map(function (o) {
        return '<tr>'
          + '<td class="td-strong">' + esc(o.id) + '</td>'
          + '<td><div class="user-cell"><span class="avatar avatar-sm green">' + UI.initials(o.customer.name) + '</span><span class="u-name">' + esc(o.customer.name) + '</span></div></td>'
          + '<td style="white-space:nowrap">' + UI.fmtDateShort(o.placedAt) + '<span class="td-sub">' + UI.timeAgo(o.placedAt) + '</span></td>'
          + '<td class="text-strong">' + D.naira(o.total) + '</td>'
          + '<td>' + UI.statusBadge(o.status) + '</td>'
          + '<td style="text-align:right"><a class="btn btn-ghost btn-sm" href="orders.html?open=' + esc(o.id) + '">View</a></td>'
          + '</tr>';
      }).join('')
      + '</tbody></table></div>'
      : '<div class="empty-tbl">No orders yet — share the menu with your customers!</div>';

    root.innerHTML = pendingStr
      + '<div class="stat-grid">' + statCards + '</div>'
      + '<div class="dash-grid">'
      + '<div class="chart-card"><h3>' + UI.ic('receipt') + ' Orders — last 7 days</h3>'
      + '<div class="cc-sub">Daily order volume</div><div class="bars">' + barHTML + '</div></div>'
      + '<div class="chart-card"><h3>' + UI.ic('grid') + ' Orders by status</h3>'
      + '<div class="cc-sub">Current pipeline (all time)</div>'
      + '<div class="donut-wrap"><div class="donut" style="--p1:' + stops[0] + ';background:' + donutGrad + '"><div class="donut-center"><b>' + st.orders.length + '</b><span>Orders</span></div></div>'
      + '<div class="donut-legend">' + donutLegend + '</div></div></div>'
      + '</div>'
      + '<div class="dash-grid">'
      + '<div class="chart-card"><h3>' + UI.ic('flame') + ' Top dishes</h3>'
      + '<div class="cc-sub">Best sellers by quantity sold</div>'
      + (tdHTML || '<div class="empty-tbl">No sales yet</div>')
      + '</div>'
      + '<div class="table-card"><div style="padding:18px 20px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px"><h3 style="font-size:1rem">Recent orders</h3>'
      + '<a class="btn btn-ghost btn-sm" href="orders.html">View all</a></div>'
      + recentHTML + '</div>'
      + '</div>';

    // animate bars
    requestAnimationFrame(function () {
      root.querySelectorAll('.bar-fill').forEach(function (el) {
        el.style.height = el.getAttribute('data-pct') + '%';
      });
    });
    UI.reveal(root);
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'dishdash_orders' || e.key === 'dishdash_session' || e.key.indexOf('dishdash_food') === 0) render();
  });

  /* Cloud-mode correctness: this page renders at DOMContentLoaded, which is
     BEFORE the async cloud boot swaps the store's reads. So the first paint
     used to show the LOCAL store's numbers (seed orders, seed dish count) and
     nothing ever corrected them — the admin's headline figures were simply
     wrong until they navigated away and back. Subscribing to the store's own
     change topics fixes that at the source: the boot pull broadcasts, and the
     one-tick replay in store.js guarantees at least one post-boot render for
     listeners that registered late. */
  ['orders', 'users', 'foods', 'categories'].forEach(function (topic) {
    if (window.DD_STORE.on) window.DD_STORE.on(topic, render);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
