'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  // Inline field errors. The .err span lives in the markup and only shows
  // while its .field carries .invalid, so we set the reason then flag it.
  function markPhone(id, msg) {
    const input = document.getElementById(id);
    if (!input) return;
    const field = input.closest('.field');
    const el = field.querySelector('.err');
    if (el && msg) el.textContent = msg;
    field.classList.add('invalid');
    input.focus();
  }
  function clearFieldErrors() {
    document.querySelectorAll('.field.invalid').forEach(function (x) { x.classList.remove('invalid'); });
  }

  /* Verification state, shown where the email address itself is shown. */
  function verificationRow(user) {
    if (S.emailVerified(user)) {
      return '<div class="vv-row ok">' + UI.ic('check')
        + '<span><b>Email verified</b>'
        + (user.emailVerifiedAt
          ? '<span class="vv-when">Confirmed ' + UI.fmtDate(user.emailVerifiedAt) + '</span>'
          : '<span class="vv-when">This account was confirmed before verification shipped.</span>')
        + '</span></div>';
    }
    return '<div class="vv-row todo">' + UI.ic('shield')
      + '<span><b>Email not verified</b><span class="vv-when">Browsing is unaffected — '
      + 'ordering stays locked until you confirm.</span></span>'
      + '<a class="btn btn-primary btn-sm" href="verify.html?next=profile.html">Verify now</a></div>';
  }

  function render() {
    const user = S.currentUser();
    const view = document.getElementById('profileView');

    if (!user || user.role === 'admin') {
      view.innerHTML = '<div class="cart-layout" style="grid-template-columns:1fr">'
        + UI.emptyState({
          emoji: '🔐',
          title: 'Sign in to view your profile',
          msg: 'Manage your account details, saved addresses and preferences.',
          action: { href: 'login.html?next=profile.html', label: 'Go to sign in' }
        }) + '</div>';
      return;
    }

    const orders = S.myOrders();
    const favCount = S.getFavs().length;
    const d = user.delivery || {};
    const joined = UI.fmtDate(user.createdAt);

    view.innerHTML =
      '<div class="profile-head" data-reveal>'
      + '<span class="avatar">' + UI.initials(user.name) + '</span>'
      + '<div class="ph-info">'
      + '<h1>' + UI.esc(user.name) + '</h1>'
      + '<p>' + UI.ic('mail') + UI.esc(user.email) + ' · joined ' + joined + '</p>'
      + '</div>'
      + '<div class="ph-meta">'
      + '<span class="stat-pill"><b>' + orders.length + '</b><span>Orders</span></span>'
      + '<span class="stat-pill"><b>' + favCount + '</b><span>Favourites</span></span>'
      + '<span class="stat-pill"><b>★ ' + '4.8' + '</b><span>Avg rating</span></span>'
      + '</div>'
      + '</div>'

      + '<div class="profile-grid">'

      + '<div class="panel">'
      + '<div class="panel-head"><span class="panel-num">1</span><h2>Personal information</h2></div>'
      + '<form id="infoForm" novalidate>'
      + '<div class="field"><label for="pName">Full name</label><input class="input" id="pName" value="' + UI.esc(user.name) + '"></div>'
      + '<div class="field"><label for="pPhone">Phone number</label><div class="input-affix"><span class="affix-ic">' + UI.ic('phone') + '</span><input class="input" id="pPhone" autocomplete="tel" inputmode="tel" value="' + UI.esc(user.phone || '') + '"></div><span class="err">Enter an 11-digit Nigerian number starting with 070, 080, 081, 090 or 091 — e.g. 0803 123 4567.</span></div>'
      + '<div class="field"><label for="pEmail">Email address</label><input class="input" id="pEmail" value="' + UI.esc(user.email) + '" disabled style="background:var(--bg-soft);color:var(--muted)"></div>'
      + verificationRow(user)
      + '<button class="btn btn-primary" type="submit">' + UI.ic('check') + 'Save changes</button>'
      + '</form>'
      + '</div>'

      + '<div class="panel">'
      + '<div class="panel-head"><span class="panel-num">2</span><h2>Delivery address</h2><span class="sub">Saved for faster checkout</span></div>'
      + '<div class="saved-addr" style="margin-bottom:18px">' + UI.ic('pin')
      + '<span>' + (d.address
        ? '<b>' + UI.esc(d.name || user.name) + '</b><span style="color:var(--muted)">' + UI.esc(d.address) + ', ' + UI.esc(d.city) + '<br>' + UI.esc(d.phone || '') + '</span>'
        : '<span style="color:var(--muted)">No saved address yet — add one below and it will pre-fill at checkout.</span>')
      + '</span></div>'
      + '<form id="addrForm" novalidate>'
      + '<div class="field"><label for="aName">Recipient name</label><input class="input" id="aName" value="' + UI.esc(d.name || user.name) + '"></div>'
      + '<div class="field"><label for="aPhone">Recipient phone</label><div class="input-affix"><span class="affix-ic">' + UI.ic('phone') + '</span><input class="input" id="aPhone" autocomplete="tel" inputmode="tel" value="' + UI.esc(d.phone || '') + '"></div><span class="err">Enter an 11-digit Nigerian number starting with 070, 080, 081, 090 or 091 — e.g. 0803 123 4567.</span></div>'
      + '<div class="field"><label for="aAddr">Street address</label><textarea class="input" id="aAddr" rows="2">' + UI.esc(d.address || '') + '</textarea></div>'
      + '<div class="field"><label for="aCity">City</label><input class="input" id="aCity" value="' + UI.esc(d.city || '') + '"></div>'
      + '<div class="field"><label for="aNote">Delivery note <span style="color:var(--faint);font-weight:600">(optional)</span></label><input class="input" id="aNote" value="' + UI.esc(d.note || '') + '"></div>'
      + '<button class="btn btn-primary" type="submit">' + UI.ic('check') + 'Save address</button>'
      + '</form>'
      + '</div>'

      + '<div class="panel" style="grid-column:1/-1">'
      + '<div class="panel-head"><span class="panel-num">3</span><h2>Quick links</h2></div>'
      + '<div style="display:flex;gap:11px;flex-wrap:wrap">'
      + '<a class="btn btn-outline" href="orders.html">' + UI.ic('receipt') + 'Order history</a>'
      + '<a class="btn btn-outline" href="favorites.html">' + UI.ic('heart') + 'Favourites</a>'
      + '<a class="btn btn-outline" href="menu.html">' + UI.ic('utensils') + 'Order food</a>'
      + '<button class="btn btn-danger" id="logoutBtn">' + UI.ic('logout') + 'Sign out</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // handlers
    document.getElementById('infoForm').addEventListener('submit', function (e) {
      e.preventDefault();
      clearFieldErrors();
      const name = document.getElementById('pName').value.trim();
      const phone = S.validatePhone(document.getElementById('pPhone').value, { required: false });
      let bad = false;
      if (name.length < 2) { bad = true; }
      if (!phone.ok) { markPhone('pPhone', phone.error); bad = true; }
      if (bad) {
        UI.toast('Check your details', phone.ok ? 'Please enter your full name.' : phone.error, 'error');
        return;
      }
      Promise.resolve(S.updateUser(user.id, { name: name, phone: phone.value })).then(function () {
        UI.toast('Profile updated', 'Your personal details were saved.');
        UI.refreshChrome();
        render();
      }).catch(function (e) {
        UI.toast('Could not save', (e && e.message) || 'Please try again.', 'error');
      });
    });
    document.getElementById('addrForm').addEventListener('submit', function (e) {
      e.preventDefault();
      clearFieldErrors();
      // A saved address is only useful if the rider can reach someone, so the
      // recipient number is required here — checkout will ask for one anyway.
      const phone = S.validatePhone(document.getElementById('aPhone').value, { required: true });
      const delivery = {
        name: document.getElementById('aName').value.trim() || user.name,
        phone: phone.value,
        address: document.getElementById('aAddr').value.trim(),
        city: document.getElementById('aCity').value.trim(),
        note: document.getElementById('aNote').value.trim()
      };
      if (!phone.ok) { markPhone('aPhone', phone.error); }
      if (!delivery.address || !delivery.city) {
        UI.toast('Address incomplete', 'Street address and city are required.', 'error');
        return;
      }
      if (!phone.ok) {
        UI.toast('Check the phone number', phone.error, 'error');
        return;
      }
      Promise.resolve(S.updateUser(user.id, { delivery: delivery })).then(function () {
        UI.toast('Address saved', 'Your delivery address is ready for next checkout.');
        render();
      }).catch(function (e) {
        UI.toast('Could not save address', (e && e.message) || 'Please try again.', 'error');
      });
    });
    document.getElementById('logoutBtn').addEventListener('click', function () {
      S.logout();
      UI.toast('Signed out', 'See you soon!');
      UI.go('index.html');
    });
    UI.reveal(view);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
