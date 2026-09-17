'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function esc(s) { return UI.esc(s); }

  function guard() {
    if (!S.requireAdmin()) { UI.go('../login.html?next=admin/reports.html'); return false; }
    return true;
  }

  /* ============================================================
     Pure math layer — no DOM, so the harness can test it directly.
     Order times are stored as ISO/UTC strings; every HOUR binning
     converts to Africa/Lagos (UTC+1, no DST) first, or "peak hours"
     silently shift by an hour for anyone outside UTC.
     ============================================================ */
  const LAGOS_TZ = 'Africa/Lagos';

  const REPORT_RANGES = {
    all:    { label: 'All time' },
    7:      { label: 'Last 7 days',  days: 7 },
    30:     { label: 'Last 30 days', days: 30 },
    month:  { label: 'This month' }
  };

  function rangeStart(key, now) {
    const ref = now || Date.now();
    if (key === 'all') return 0;
    if (key === '7') return ref - 7 * 86400000;
    if (key === '30') return ref - 30 * 86400000;
    if (key === 'month') { const d = new Date(ref); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
    return 0;
  }

  /* Previous comparable window (for the vs-previous deltas). 'all' and
     'month' have no comparable previous window -> null, no arrow shown. */
  function rangeStartPrevious(key, now) {
    const ref = now || Date.now();
    if (key === '7') return ref - 14 * 86400000;
    if (key === '30') return ref - 60 * 86400000;
    return null;
  }

  function inRange(order, startMs, endMs) {
    const t = Date.parse(order.placedAt);
    if (isNaN(t)) return false;
    if (startMs && t < startMs) return false;
    if (endMs && t >= endMs) return false;
    return true;
  }

  /* Revenue counts PAID money only: card payments, admin-verified transfers,
     collected COD cash. 'awaiting_verification' and 'pending' are still
     promises, not money — counting them would flatter the report. */
  function isPaid(order) {
    return UI.payStatusOf(order) === 'paid';
  }

  function summarize(orders) {
    const paid = orders.filter(isPaid);
    const revenue = paid.reduce(function (s, o) { return s + Number(o.total || 0); }, 0);
    const items = orders.reduce(function (s, o) {
      return s + (o.items || []).reduce(function (n, it) { return n + (Number(it.qty) || 0); }, 0);
    }, 0);
    return {
      revenue: revenue,
      orders: orders.length,
      paidOrders: paid.length,
      items: items,
      /* AOV on ALL orders (paid or not): the average size of an order the
         business actually takes. Revenue/paidOrders would conflate two ideas. */
      aov: orders.length ? Math.round(revenue / orders.length) : 0
    };
  }

  function pctChange(current, previous) {
    if (previous === null || !previous) return null;      // no window, or nothing to compare
    return Math.round((current - previous) / previous * 100);
  }

  function revenueByMethod(orders) {
    const map = {};
    orders.filter(isPaid).forEach(function (o) {
      const key = o.pay === 'transfer' ? 'bank_transfer' : o.pay;
      if (!map[key]) map[key] = { key: key, label: UI.payMethodLabel(key), revenue: 0, count: 0 };
      map[key].revenue += Number(o.total || 0);
      map[key].count += 1;
    });
    const rows = Object.keys(map).map(function (k) { return map[k]; });
    const total = rows.reduce(function (s, r) { return s + r.revenue; }, 0) || 1;
    rows.forEach(function (r) { r.share = Math.round(r.revenue / total * 100); });
    return rows.sort(function (a, b) { return b.revenue - a.revenue; });
  }

  /* The hour of an order IN LAGOS, whatever the server's timezone is.
     'en-GB' keeps hour12 numeric; hour12:false would give '24' at midnight
     in some engines — hourCycle h23 is the explicit fix. */
  function lagosParts(iso) {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: LAGOS_TZ, hourCycle: 'h23',
      weekday: 'short', hour: 'numeric'
    }).formatToParts(d);
    const get = function (t) { const p = parts.find(function (x) { return x.type === t; }); return p ? p.value : null; };
    return { weekday: get('weekday'), hour: parseInt(get('hour'), 10) };
  }

  const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_FULL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

  function heatmap(orders) {
    const grid = {};
    DAY_ORDER.forEach(function (d) { grid[d] = {}; });
    orders.forEach(function (o) {
      const p = lagosParts(o.placedAt);
      if (!p.weekday || grid[p.weekday] === undefined || isNaN(p.hour)) return;
      grid[p.weekday][p.hour] = (grid[p.weekday][p.hour] || 0) + 1;
    });
    let max = 0, busiest = null;
    DAY_ORDER.forEach(function (d) {
      for (let h = 0; h < 24; h++) {
        const c = grid[d][h] || 0;
        if (c > max) { max = c; busiest = { day: d, hour: h, count: c }; }
      }
    });
    return { grid: grid, max: max, busiest: busiest };
  }

  /* CSV export. Excel/Browser refuse UTF-8 CSVs without a BOM, so the naira
     sign survives. Fields with commas, quotes or newlines get quoted, and
     embedded quotes double — RFC 4180. */
  function csvEscape(value) {
    const s = String(value == null ? '' : value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function ordersToCsv(orders) {
    const head = ['Order', 'Placed (Lagos)', 'Customer', 'Phone', 'City', 'Items', 'Subtotal', 'Delivery fee', 'Discount', 'Total', 'Payment method', 'Payment status', 'Order status'];
    const rows = orders.map(function (o) {
      const items = (o.items || []).map(function (it) { return it.qty + 'x ' + it.name + (it.note ? ' (' + it.note + ')' : ''); }).join('; ');
      return [
        o.id, lagosParts(o.placedAt) && new Date(o.placedAt).toLocaleString('en-GB', { timeZone: LAGOS_TZ }),
        o.customer.name, o.customer.phone, o.customer.city, items,
        o.sub, o.deliveryFee, o.discount, o.total,
        UI.payMethodLabel(o.pay), UI.payStatusOf(o), o.status
      ].map(csvEscape).join(',');
    });
    return '\uFEFF' + head.join(',') + '\n' + rows.join('\n');
  }

  /* ============================================================
     Rendering
     ============================================================ */
  const state = { range: '7' };

  const METHOD_COLORS = { card: '#6366F1', cod: '#10B981', bank_transfer: '#F59E0B' };
  /* white -> yellow -> orange -> red, for heat cells */
  function heatColor(count, max) {
    if (!count) return 'var(--bg-soft)';
    const t = max ? count / max : 0;
    if (t <= 0.25) return '#FDF3DB';
    if (t <= 0.5)  return '#FCE3A6';
    if (t <= 0.75) return '#F9B25C';
    return '#E8722E';
  }

  function deltaHTML(current, previous) {
    const pct = pctChange(current, previous);
    if (pct === null) return '';
    if (pct > 0) return '<span class="rpt-delta up">' + UI.ic('arrow-r') + '+' + pct + '% vs prev. period</span>';
    if (pct < 0) return '<span class="rpt-delta down">' + UI.ic('arrow-l') + pct + '% vs prev. period</span>';
    return '<span class="rpt-delta flat">=&nbsp; flat vs prev. period</span>';
  }

  function summaryCards(cur, prev) {
    const cards = [
      { ic: 'wallet', cls: 'si-rev', label: 'Revenue (paid)', val: D.naira(cur.revenue), delta: deltaHTML(cur.revenue, prev ? prev.revenue : null) },
      { ic: 'receipt', cls: 'si-order', label: 'Orders', val: String(cur.orders), delta: deltaHTML(cur.orders, prev ? prev.orders : null) },
      { ic: 'cal', cls: 'si-user', label: 'Average order value', val: D.naira(cur.aov), delta: deltaHTML(cur.aov, prev ? prev.aov : null) },
      { ic: 'bag', cls: 'si-food', label: 'Items sold', val: String(cur.items), delta: '' }
    ];
    return cards.map(function (c) {
      return '<div class="stat-card" data-reveal><span class="stat-ico ' + c.cls + '">' + UI.ic(c.ic) + '</span>'
        + '<div class="stat-body"><b>' + esc(c.label) + '</b><div class="val">' + esc(c.val) + '</div>'
        + '<div class="rpt-delta-row">' + c.delta + '</div></div></div>';
    }).join('');
  }

  function methodRows(rows) {
    if (!rows.length) return '<div class="empty-tbl">No paid orders in this period yet.</div>';
    return rows.map(function (r) {
      const color = METHOD_COLORS[r.key] || '#83766A';
      return '<div class="rpt-method">'
        + '<div class="rm-head"><span class="sw" style="background:' + color + '"></span>'
        + '<b>' + esc(r.label) + '</b><span class="rm-meta">' + r.count + ' order' + (r.count === 1 ? '' : 's') + ' · ' + r.share + '% of revenue</span>'
        + '<b class="rm-rev">' + D.naira(r.revenue) + '</b></div>'
        + '<div class="rm-track"><i style="width:' + r.share + '%;background:' + color + '"></i></div>'
        + '</div>';
    }).join('');
  }

  function heatmapHTML(hm) {
    const callout = hm.busiest
      ? 'Busiest: <b>' + esc(DAY_FULL[hm.busiest.day]) + ' ' + String(hm.busiest.hour).padStart(2, '0') + ':00</b> (' + hm.busiest.count + ' order' + (hm.busiest.count === 1 ? '' : 's') + ')'
      : 'No orders in this period yet.';
    let html = '<div class="cc-sub">Orders by weekday and hour — <b>local Lagos time</b></div>'
      + '<div class="rpt-callout">' + UI.ic('flame') + '<span>' + callout + '</span></div>'
      + '<div class="rpt-heat-wrap"><div class="rpt-heat" role="img" aria-label="Heatmap of order counts by weekday and hour">';
    html += '<div class="rh-corner"></div>';
    for (let h = 0; h < 24; h++) html += '<div class="rh-hour' + (h % 3 === 0 ? ' lab' : '') + '">' + (h % 3 === 0 ? String(h).padStart(2, '0') : '') + '</div>';
    DAY_ORDER.forEach(function (d) {
      html += '<div class="rh-day">' + d + '</div>';
      for (let h = 0; h < 24; h++) {
        const c = (hm.grid[d] && hm.grid[d][h]) || 0;
        html += '<div class="rh-cell" title="' + d + ' ' + String(h).padStart(2, '0') + ':00 — ' + c + ' order' + (c === 1 ? '' : 's') + '"'
          + ' style="background:' + heatColor(c, hm.max) + '">' + (c ? '<span>' + c + '</span>' : '') + '</div>';
      }
    });
    html += '</div>'
      + '<div class="rpt-heat-legend"><span>Less</span>'
      + ['var(--bg-soft)', '#FDF3DB', '#FCE3A6', '#F9B25C', '#E8722E'].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('')
      + '<span>More</span></div></div>';
    return html;
  }

  function render() {
    if (!guard()) return;
    // cancelled orders never happened as sales — keep them out of every
    // figure below (revenue, AOV, order counts, the peak-hours heatmap)
    const all = S.orders().filter(function (o) { return o.status !== 'cancelled'; });
    const now = Date.now();
    const start = rangeStart(state.range, now);
    const prevStart = rangeStartPrevious(state.range, now);

    const cur = summarize(all.filter(function (o) { return inRange(o, start, now); }));
    const prev = prevStart === null ? null : summarize(all.filter(function (o) { return inRange(o, prevStart, start); }));
    const methods = revenueByMethod(all.filter(function (o) { return inRange(o, start, now); }));
    const hm = heatmap(all.filter(function (o) { return inRange(o, start, now); }));

    const tabs = Object.keys(REPORT_RANGES).map(function (k) {
      return '<button class="atab' + (state.range === k ? ' active' : '') + '" data-range="' + k + '" aria-pressed="' + (state.range === k) + '">'
        + esc(REPORT_RANGES[k].label) + '</button>';
    }).join('');

    const root = document.getElementById('reportsRoot');
    root.innerHTML =
      '<div class="admin-tabs">' + tabs + '<button class="atab rpt-export" data-export>' + UI.ic('box') + 'Export CSV</button></div>'
      + '<div class="stat-grid">' + summaryCards(cur, prev) + '</div>'
      + '<div class="dash-grid">'
      + '<div class="chart-card"><h3>' + UI.ic('wallet') + ' Revenue by payment method</h3>'
      + '<div class="cc-sub">Paid money only — card payments, verified transfers and collected cash. '
      + cur.paidOrders + ' of ' + cur.orders + ' orders in this period are paid.</div>'
      + methodRows(methods) + '</div>'
      + '<div class="chart-card"><h3>' + UI.ic('clock') + ' Peak ordering hours</h3>'
      + heatmapHTML(hm) + '</div>'
      + '</div>'
      + '<p class="rpt-footnote">' + UI.ic('info') + '<span>Demo data note: revenue counts only orders whose payment has been '
      + 'marked paid (card at checkout, transfers verified by an admin, cash collected on delivery). '
      + 'Pending and awaiting-verification orders are shown in order counts but not in revenue, so the headline number is defensible.</span></p>';

    root.querySelectorAll('[data-range]').forEach(function (b) {
      b.addEventListener('click', function () { state.range = b.getAttribute('data-range'); render(); });
    });
    const exp = root.querySelector('[data-export]');
    if (exp) exp.addEventListener('click', function () { exportCsv(all, start, now); });

    UI.reveal(root);
  }

  function exportCsv(orders, start, endMs) {
    const rows = orders.filter(function (o) { return inRange(o, start, endMs); });
    if (!rows.length) { UI.toast('Nothing to export', 'No orders in this period.', 'info'); return; }
    const blob = new Blob([ordersToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dishdash-orders-' + REPORT_RANGES[state.range].label.toLowerCase().replace(/\s+/g, '-') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    UI.toast('CSV exported', rows.length + ' orders downloaded.', 'success');
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'dishdash_orders' || e.key === 'dishdash_session') render();
  });
  window.DD_STORE.on('orders', render);

  /* Harness hook: the pure math layer is exposed read-only for tests.
     Production pages never touch it. */
  window.DD_REPORTS_TEST = {
    REPORT_RANGES: REPORT_RANGES, rangeStart: rangeStart, rangeStartPrevious: rangeStartPrevious,
    inRange: inRange, isPaid: isPaid, summarize: summarize, pctChange: pctChange,
    revenueByMethod: revenueByMethod, lagosParts: lagosParts, heatmap: heatmap,
    csvEscape: csvEscape, ordersToCsv: ordersToCsv, heatColor: heatColor, LAGOS_TZ: LAGOS_TZ
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
