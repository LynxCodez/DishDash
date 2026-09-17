'use strict';

(function () {
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  function fieldOf(id) { return document.getElementById(id).closest('.field'); }
  function setErr(id, on) { fieldOf(id).classList.toggle('invalid', on); }
  // the .err span is a static hint in the markup; overwrite it with the
  // specific reason so the customer knows what to fix (e.g. which prefixes
  // are accepted) instead of a generic "invalid number".
  function setErrMsg(id, msg) {
    const field = fieldOf(id);
    const el = field.querySelector('.err');
    if (el && msg) el.textContent = msg;
    field.classList.add('invalid');
  }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function roleHome(user) {
    return user && user.role === 'admin' ? 'admin/index.html' : 'index.html';
  }

  /* Where to send someone once they are signed in.
     The landing page must never fight the account's role. The demo launcher
     used to hand the admin window a ?next=admin/... URL, so a *customer*
     signing in there bounced admin → login → admin forever, while an admin
     opening the customer link was dumped on the shop side. The role decides
     first and ?next is only honoured inside the area that role can use.   */
  function nextUrl(user) {
    const next = UI.getParam('next');
    const home = roleHome(user);
    // in-app relative paths only: no http(s)://, no //host, no ".." traversal
    if (!next || next.indexOf('..') !== -1 || /^([a-z]+:)?\/\//i.test(next)) return home;
    const wantsAdmin = next.indexOf('admin/') === 0;
    if (user && user.role === 'admin') return wantsAdmin ? next : home;
    return wantsAdmin ? home : next;
  }

  /* ---------------- session housekeeping ----------------
     A Supabase session lives in the browser's localStorage and OUTLIVES the
     window — closing Chrome does not sign anyone out — so the next launch of
     the demo opened already signed in as whoever used it last, with no way to
     tell or to switch. Two mechanisms close that hole for good:
       • ?fresh=1 (what the launcher passes) signs out before showing the form
       • the banner below makes a live session visible and switchable by hand  */
  function authReady() {
    return window.DD_STORE_SYNC && window.DD_STORE_SYNC.whenAuthReady
      ? Promise.resolve(window.DD_STORE_SYNC.whenAuthReady()).catch(function () {})
      : Promise.resolve();
  }

  function dropFreshParam() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('fresh');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch (e) { /* older browser: the flag stays in the URL, which is harmless */ }
  }

  /* Every place this app can remember an account, in one list: the local
     store's own session, the cloud layer's optimistic hint, and the cloud
     layer's cached profile. S.logout() clears whichever layer is live but not
     the other layer's key — so signing out here sweeps all three. Without it a
     boot that falls back to local mode (no Wi-Fi at the venue, say) can
     resurrect the previous account straight out of a cache. */
  const SESSION_KEYS = ['dishdash_session', 'dishdash_session_hint', 'dishdash_cloud_session'];
  function wipeSessionCaches() {
    SESSION_KEYS.forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) { /* storage blocked */ }
    });
  }

  function signOut() {
    wipeSessionCaches();
    // Runs after the cloud layer settles, so this clears whichever layer is
    // authoritative (the Supabase session, or the local session in local mode).
    return Promise.resolve(S.logout());
  }

  function clearStaleSession() {
    if (!UI.getParam('fresh')) return Promise.resolve(false);
    dropFreshParam();
    return signOut()
      .then(function () { return true; })
      .catch(function () { return false; });
  }

  /* The visible "you are still signed in" row. It sits above the form so the
     page can never look like a blank sign-in screen while an account is active
     — and switching accounts becomes one click instead of a hidden menu.     */
  function mountSessionBanner(form) {
    if (!form || !form.parentNode) return;
    let el = null;

    function paint() {
      const u = S.currentUser();
      if (!u) {
        if (el) { el.hidden = true; el.innerHTML = ''; }
        return;
      }
      if (!el) {
        el = document.createElement('div');
        el.id = 'sessionBanner';
        el.className = 'session-banner';
        form.parentNode.insertBefore(el, form);
      }
      el.hidden = false;
      el.innerHTML =
        '<span class="sb-ic">' + UI.ic('user') + '</span>'
        + '<div class="sb-txt"><b>Signed in as ' + UI.esc(u.name || 'your account') + '</b>'
        +   '<span>' + UI.esc(u.email || '') + '</span></div>'
        + '<div class="sb-act">'
        +   '<a class="btn btn-outline btn-sm" href="' + UI.esc(nextUrl(u)) + '">Continue</a>'
        +   '<button type="button" class="btn btn-ghost btn-sm" id="sbOut" style="color:var(--err)">Sign out</button>'
        + '</div>';

      const out = el.querySelector('#sbOut');
      out.addEventListener('click', function () {
        out.disabled = true;
        out.textContent = 'Signing out…';
        signOut()
          .then(function () {
            UI.toast('Signed out', 'Sign in with a different account whenever you are ready.');
            paint();
          })
          .catch(function (e) {
            out.disabled = false;
            out.textContent = 'Sign out';
            UI.toast('Could not sign out', (e && e.message) || 'Please try again.', 'error');
          });
      });
    }

    paint();
    if (S.on) S.on('auth', paint);
  }

  function bindEye() {
    document.querySelectorAll('[data-eye]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const input = document.getElementById(btn.getAttribute('data-eye'));
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.querySelector('use').setAttribute('href', '#i-' + (show ? 'eye-off' : 'eye'));
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  /* ---------------- LOGIN ---------------- */
  function initLogin() {
    bindEye();
    const form = document.getElementById('loginForm');
    const errBox = document.getElementById('loginErr');
    const btn = document.getElementById('loginBtn');

    function clearErrors() {
      errBox.hidden = true;
      errBox.style.display = 'none';
      errBox.textContent = '';
      setErr('liEmail', false);
      setErr('liPass', false);
    }
    function showError(msg) {
      errBox.hidden = false;
      errBox.style.display = 'block';
      errBox.textContent = msg;
      form.classList.add('shake-err');
      setTimeout(function () { form.classList.remove('shake-err'); }, 400);
    }
    function busy() {
      btn.disabled = true;
      btn.classList.add('btn-loading');
      btn.innerHTML = '<span class="spinner"></span> Signing in…';
    }
    function idle() {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      btn.innerHTML = 'Sign in';
    }

    // The single sign-in path used by the form AND the demo buttons:
    // S.login is sync in local mode and a Promise in cloud (Supabase) mode,
    // so Promise.resolve handles both. On success we redirect; on failure we
    // surface the error and hand the form back to the user.
    function submitLogin(email, password) {
      clearErrors();
      return Promise.resolve(S.login(email, password))
        .then(function (res) {
          if (!res || !res.ok) {
            idle();
            const msg = (res && res.error) || 'Could not sign in. Please try again.';
            showError(msg);
            UI.toast('Sign in failed', msg, 'error');
            // Email-link mode: the address exists but was never confirmed, so
            // send them somewhere they can resend instead of leaving them stuck
            // on a sign-in form that will keep saying no.
            if (res && res.pendingEmail) {
              setTimeout(function () {
                UI.go('verify.html?email=' + encodeURIComponent(email));
              }, 1600);
            }
            return false;
          }
          const first = (res.user.name || '').split(' ')[0];
          UI.toast('Welcome back' + (first ? ', ' + first : '') + '! 👋', "You're signed in.");
          UI.go(nextUrl(res.user));
          return true;
        })
        .catch(function (e) {
          idle();
          const msg = (e && e.message) || 'Could not sign in. Check your connection and try again.';
          showError(msg);
          UI.toast('Sign in failed', msg, 'error');
          return false;
        });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const email = form.email.value.trim();
      const pass = form.password.value;
      let ok = true;
      if (!isEmail(email)) { setErr('liEmail', true); ok = false; }
      if (!pass) { setErr('liPass', true); ok = false; }
      if (!ok) {
        errBox.hidden = true;
        errBox.style.display = 'none';
        form.classList.add('shake-err');
        setTimeout(function () { form.classList.remove('shake-err'); }, 400);
        return;
      }
      busy();
      // brief pause so the loading state reads as real work, not a flicker
      setTimeout(function () { submitLogin(email, pass); }, 650);
    });

    // demo quick fill + sign in
    document.querySelectorAll('[data-quick]').forEach(function (b) {
      b.addEventListener('click', function () {
        const email = b.getAttribute('data-quick');
        const pass = email.indexOf('admin') === 0 ? 'admin123' : 'demo1234';
        form.email.value = email;
        form.password.value = pass;
        busy();
        setTimeout(function () { submitLogin(email, pass); }, 400);
      });
    });

    // Security: never pre-fill credentials on a shared device. After signing
    // out the user lands here — leaving their email (and worse, a recoverable
    // password) in the form would expose the account to the next person at
    // the keyboard. The browser's own password manager is the right tool for
    // convenience; the form starts empty every time.
  }

  /* ---------------- REGISTER ---------------- */
  function initRegister() {
    bindEye();
    const form = document.getElementById('regForm');
    const errBox = document.getElementById('regErr');
    const meter = document.getElementById('pwMeter');

    // live password strength
    const pass = document.getElementById('rgPass');
    pass.addEventListener('input', function () {
      const v = pass.value;
      let score = 0;
      if (v.length >= 6) score++;
      if (v.length >= 10) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/\d/.test(v) || /[^A-Za-z0-9]/.test(v)) score++;
      const pct = Math.min(100, score * 25);
      meter.style.width = pct + '%';
      meter.style.background = score <= 1 ? 'var(--err)' : (score <= 2 ? 'var(--amber)' : 'var(--acc-500)');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errBox.hidden = true;
      errBox.style.display = 'none';
      const name = document.getElementById('rgName').value.trim();
      const email = document.getElementById('rgEmail').value.trim();
      const phoneCheck = S.validatePhone(document.getElementById('rgPhone').value, { required: false });
      const address = document.getElementById('rgAddr').value.trim();
      const city = document.getElementById('rgCity').value.trim();
      const note = document.getElementById('rgNote').value.trim();
      const p1 = document.getElementById('rgPass').value;
      const p2 = document.getElementById('rgPass2').value;

      let ok = true;
      if (name.length < 3) { setErr('rgName', true); ok = false; }
      if (!isEmail(email)) { setErr('rgEmail', true); ok = false; }
      if (!phoneCheck.ok) { setErrMsg('rgPhone', phoneCheck.error); ok = false; }
      if (address.length < 8) { setErr('rgAddr', true); ok = false; }
      if (!city) { setErr('rgCity', true); ok = false; }
      if (p1.length < 6) { setErr('rgPass', true); ok = false; }
      if (p2 !== p1) { setErr('rgPass2', true); ok = false; }

      if (!ok) {
        form.classList.add('shake-err');
        setTimeout(function () { form.classList.remove('shake-err'); }, 400);
        return;
      }
      const btn = document.getElementById('regBtn');
      btn.disabled = true;
      btn.classList.add('btn-loading');
      btn.innerHTML = '<span class="spinner"></span> Creating your account…';

      setTimeout(function () {
        Promise.resolve(S.registerUser({ name: name, email: email, phone: phoneCheck.value, password: p1, address: address, city: city, note: note }))
          .then(function (res) {
            if (!res.ok) {
              errBox.hidden = false;
              errBox.style.display = 'block';
              // An address that is already registered is the one failure the
              // customer can actually act on, so point them at the sign-in form
              // rather than leaving them on a page that will keep refusing.
              errBox.innerHTML = UI.esc(res.error)
                + (res.existing
                  ? ' <a href="login.html" style="font-weight:800;text-decoration:underline">Sign in instead</a>'
                  : '');
              errBox.style.color = 'var(--err)';
              setErr('rgEmail', true);
              btn.disabled = false;
              btn.classList.remove('btn-loading');
              btn.innerHTML = 'Create account';
              UI.toast('Could not register', res.error, 'error');
              return;
            }
            // Email-confirmation mode: sign-up returns no session, so there is
            // nothing signed in yet — verify.html asks for the emailed 6-digit
            // code (typed here, so no browser hand-off).
            if (res.pendingEmail) {
              UI.toast('Account created 🎉', 'One step left — confirm your email address.');
              setTimeout(function () {
                UI.go('verify.html?email=' + encodeURIComponent(res.user.email));
              }, 900);
              return;
            }
            UI.toast('Account created 🎉', 'Welcome to DishDash, ' + res.user.name.split(' ')[0] + '!');
            setTimeout(function () { UI.go('verify.html'); }, 900);
          })
          .catch(function (e) {
            const msg = (e && e.message) || 'Could not create your account. Check your connection and try again.';
            errBox.hidden = false;
            errBox.style.display = 'block';
            errBox.textContent = msg;
            errBox.style.color = 'var(--err)';
            btn.disabled = false;
            btn.classList.remove('btn-loading');
            btn.innerHTML = 'Create account';
            UI.toast('Could not register', msg, 'error');
          });
      }, 700);
    });
  }

  function init() {
    const page = document.body.getAttribute('data-page');
    const formId = page === 'login' ? 'loginForm' : (page === 'register' ? 'regForm' : '');
    const form = formId ? document.getElementById(formId) : null;

    // Bind the form synchronously first: housekeeping below waits for the cloud
    // layer to settle, and a slow connection must never leave the sign-in
    // button unresponsive.
    if (page === 'login') initLogin();
    else if (page === 'register') initRegister();

    if (form) {
      authReady()
        .then(clearStaleSession)
        .then(function () { mountSessionBanner(form); })
        .catch(function () { mountSessionBanner(form); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
