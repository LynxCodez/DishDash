'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function esc(s) { return UI.esc(s); }

  function guard() {
    if (!S.requireAdmin()) { UI.go('../login.html?next=admin/users.html'); return false; }
    return true;
  }

  function customerStats() {
    const orders = S.orders();
    const map = {};
    orders.forEach(function (o) {
      if (!map[o.userId]) map[o.userId] = { orders: 0, spent: 0, last: null };
      map[o.userId].orders += 1;
      map[o.userId].spent += o.total;
      const t = Date.parse(o.placedAt);
      if (!map[o.userId].last || t > map[o.userId].last) map[o.userId].last = t;
    });
    return map;
  }

  function rowHTML(u, stats) {
    return '<tr>'
      + '<td><div class="user-cell"><span class="avatar avatar-sm">' + UI.initials(u.name) + '</span>'
      + '<span><span class="u-name">' + esc(u.name) + '</span><span class="td-sub">' + esc(u.email) + '</span></span></div></td>'
      + '<td data-label="Phone">' + esc(u.phone || '—') + '</td>'
      + '<td data-label="Joined" style="white-space:nowrap">' + UI.fmtDateShort(u.createdAt) + '<span class="td-sub">' + UI.timeAgo(u.createdAt) + '</span></td>'
      + '<td data-label="Orders">' + (stats ? stats.orders : 0) + '</td>'
      + '<td data-label="Total spent" class="text-strong">' + (stats ? D.naira(stats.spent) : D.naira(0)) + '</td>'
      + '<td data-label="Status"><span class="badge badge-acc">Active</span></td>'
      + '<td style="text-align:right"><div class="row-actions">'
      + '<button class="icon-act view" data-view="' + esc(u.id) + '" aria-label="View ' + esc(u.name) + '">' + UI.ic('eye') + '</button>'
      + '</div></td>'
      + '</tr>';
  }

  function render() {
    if (!guard()) return;
    const q = document.getElementById('userQ').value.trim().toLowerCase();
    const users = S.users().filter(function (u) { return u.role === 'customer'; });
    const stats = customerStats();
    const list = users.filter(function (u) {
      return !q || u.name.toLowerCase().indexOf(q) !== -1 || u.email.toLowerCase().indexOf(q) !== -1
        || (u.phone || '').toLowerCase().indexOf(q) !== -1;
    });
    const wrap = document.getElementById('usersWrap');
    document.getElementById('userCount').textContent = list.length + ' of ' + users.length + ' customers';

    if (!list.length) {
      wrap.innerHTML = '<div class="table-card">' + UI.emptyState({
        emoji: '👥',
        title: 'No customers found',
        msg: 'Customers who register on the sign-up page appear here automatically.',
        action: { href: 'users.html', label: 'Show all customers' }
      }) + '</div>';
      return;
    }
    wrap.innerHTML = '<div class="table-card"><div class="tbl-scroll"><table class="tbl">'
      + '<thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th>Orders</th><th>Total spent</th><th>Status</th><th style="text-align:right">View</th></tr></thead>'
      + '<tbody>' + list.map(function (u) { return rowHTML(u, stats[u.id]); }).join('') + '</tbody></table></div></div>';

    wrap.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        const u = users.find(function (x) { return x.id === b.getAttribute('data-view'); });
        openDetail(u, stats[u.id]);
      });
    });
  }

  function openDetail(u, st) {
    const theirOrders = S.sortOrders(S.orders().filter(function (o) { return String(o.userId) === String(u.id); })).slice(0, 3);
    const addr = u.delivery || {};
    const html = '<div class="detail-grid">'
      + '<div class="detail-col"><h4>' + UI.ic('user') + ' Account</h4>'
      + '<div class="kv"><b>Name</b><span>' + esc(u.name) + '</span></div>'
      + '<div class="kv"><b>Email</b><span>' + esc(u.email) + '</span></div>'
      + '<div class="kv"><b>Phone</b><span>' + esc(u.phone || '—') + '</span></div>'
      + '<div class="kv"><b>Joined</b><span>' + UI.fmtDate(u.createdAt) + '</span></div>'
      + '<div class="kv"><b>Orders</b><span>' + (st ? st.orders : 0) + '</span></div>'
      + '<div class="kv"><b>Total spent</b><span style="font-weight:800">' + (st ? D.naira(st.spent) : D.naira(0)) + '</span></div>'
      + '<h4 style="margin-top:16px">' + UI.ic('pin') + ' Saved address</h4>'
      + '<div class="kv"><b>Address</b><span>' + esc(addr.address ? addr.address + ', ' + addr.city : 'None saved') + '</span></div>'
      + '<div class="kv"><b>Note</b><span>' + esc(addr.note || '—') + '</span></div>'
      + '</div>'
      + '<div class="detail-col"><h4>' + UI.ic('receipt') + ' Recent orders</h4>'
      + (theirOrders.length
        ? '<div class="detail-items">' + theirOrders.map(function (o) {
          return '<a class="di-row" href="orders.html?open=' + esc(o.id) + '" style="cursor:pointer">'
            + '<span class="di-name">' + esc(o.id) + '</span>' + UI.statusBadge(o.status)
            + '<span class="di-price">' + D.naira(o.total) + '</span></a>';
        }).join('') + '</div>'
        : '<p class="text-muted" style="font-size:.9rem">This customer hasn\'t placed an order yet.</p>')
      + '</div></div>';
    UI.openModal(html, {
      title: esc(u.name),
      size: 'lg',
      foot: '<a class="btn btn-outline" href="orders.html"><svg class="ic" aria-hidden="true"><use href="#i-receipt"></use></svg> See all their orders</a>'
        + '<button class="btn btn-ghost" data-close>Close</button>'
    });
    document.querySelector('[data-close]').addEventListener('click', function () { document.querySelector('.modal-bg.open').close(); });
  }

  function init() {
    if (!guard()) return;
    document.getElementById('userSearch').addEventListener('submit', function (e) { e.preventDefault(); render(); });
    document.getElementById('userQ').addEventListener('input', UI.debounce(render, 250));
    render();
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'dishdash_session' || e.key === 'dishdash_users' || e.key === 'dishdash_orders') render();
  });

  // cloud mode: the store broadcasts 'users' after every profiles pull
  // (realtime or session change) — re-render so new signups appear unbidden
  if (S.on) S.on('users', function () { render(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
