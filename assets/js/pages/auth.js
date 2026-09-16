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

  function nextUrl(user) {
    const next = UI.getParam('next');
    if (next && next.indexOf('http') !== 0) return next;
    return user.role === 'admin' ? 'admin/index.html' : 'index.html';
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
              errBox.textContent = res.error;
              errBox.style.color = 'var(--err)';
              setErr('rgEmail', true);
              btn.disabled = false;
              btn.classList.remove('btn-loading');
              btn.innerHTML = 'Create account';
              UI.toast('Could not register', res.error, 'error');
              return;
            }
            // Email-link mode: sign-up returns no session, so there is nothing
            // signed in yet — verify.html walks them through the inbox step.
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
    if (page === 'login') initLogin();
    else if (page === 'register') initRegister();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
