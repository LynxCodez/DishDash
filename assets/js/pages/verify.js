'use strict';

/* ============================================================
   VERIFY EMAIL
   ------------------------------------------------------------
   One page, both verification modes:

   • in-app code  — the project auto-confirms, so we mint a 6-digit
                    code and show it in a clearly-labelled demo
                    inbox. No email is sent to anyone.
   • email link   — the project sends a real confirmation email;
                    we explain the inbox round-trip, offer a resend,
                    and notice when the customer comes back confirmed.

   The mode is decided in store.js from how Supabase answers a sign-up;
   this page only presents it.
   ============================================================ */

(function () {
  const S = window.DD_STORE;
  const UI = window.DD_UI;

  const view = document.getElementById('verifyView');
  if (!view) return;

  let tick = null;          // countdown interval
  let deadline = 0;         // when the shown code expires (epoch ms)
  let resendAt = 0;         // earliest next request (epoch ms)
  let attemptsLeft = null;  // wrong guesses remaining on the live code
  let liveCode = '';        // demo-inbox display copy

  const two = function (n) { return (n < 10 ? '0' : '') + n; };
  function mmss(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return two(Math.floor(s / 60)) + ':' + two(s % 60);
  }
  function nextUrl() {
    const next = UI.getParam('next');
    if (next && next.indexOf('http') !== 0) return next;
    return 'index.html';
  }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function goHome(msg) {
    UI.toast('Email verified 🎉', msg || 'You can order now — enjoy!');
    setTimeout(function () { UI.go(nextUrl()); }, 900);
  }

  /* ------------------------------------------------------------
     Signed out, waiting on a confirmation link. Reached right
     after registering in email-link mode (there is no session
     until the link is opened), which is why it cannot use RPCs.
  ------------------------------------------------------------ */
  function renderAwaitLink(email) {
    stopTick();
    view.innerHTML =
      '<div class="verify-wrap">'
      + '<div class="verify-card">'
      +   '<div class="vf-ico vf-ico-mail">' + UI.ic('mail') + '</div>'
      +   '<h1>Check your inbox</h1>'
      +   '<p class="lead">We sent a confirmation link'
      +     (email ? ' to <b>' + UI.esc(email) + '</b>' : '') + '. '
      +     'Open it and you will be signed in with ordering unlocked.</p>'
      +   '<div class="vf-note">' + UI.ic('info')
      +     '<span>Nothing arrived? Check the spam folder first — confirmation mail often lands there. '
      +     'You can also resend it below.</span></div>'
      +   '<div class="vf-actions">'
      +     '<button class="btn btn-primary btn-lg" id="vfResend">Resend the email</button>'
      +     '<a class="btn btn-outline btn-lg" href="login.html">Back to sign in</a>'
      +   '</div>'
      + '</div></div>';

    const btn = document.getElementById('vfResend');
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Sending…';
      Promise.resolve(S.resendConfirmationEmail(email))
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || 'Could not resend.');
          UI.toast('Email sent', 'Give it a minute, then check your inbox and spam folder.');
        })
        .catch(function (e) {
          UI.toast('Could not resend', (e && e.message) || 'Please try again.', 'error', 4200);
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = 'Resend the email';
        });
    });
  }

  /* ------------------------------------------------------------
     Signed in, email-link mode: the link has not been opened yet.
     Poll gently so the page notices when it is.
  ------------------------------------------------------------ */
  function renderLinkPanel(user) {
    view.innerHTML =
      '<div class="verify-wrap">'
      + '<div class="verify-card">'
      +   '<div class="vf-ico vf-ico-mail">' + UI.ic('mail') + '</div>'
      +   '<h1>One click to go</h1>'
      +   '<p class="lead">We sent a confirmation link to <b>' + UI.esc(user.email) + '</b>. '
      +     'Open it, then come back to this tab — we will pick it up automatically.</p>'
      +   '<div class="vf-note">' + UI.ic('info')
      +     '<span>Ordering stays locked until your address is confirmed. Resend if it never arrived.</span></div>'
      +   '<div class="vf-actions">'
      +     '<button class="btn btn-primary btn-lg" id="vfCheck">I have confirmed — continue</button>'
      +     '<button class="btn btn-outline btn-lg" id="vfResend">Resend the email</button>'
      +   '</div>'
      + '</div></div>';

    const check = document.getElementById('vfCheck');
    function finish() {
      check.disabled = true;
      check.innerHTML = '<span class="spinner"></span> Checking…';
      Promise.resolve(S.markEmailVerified())
        .then(function (res) {
          if (res && res.ok) { stopTick(); goHome('Your email is confirmed.'); return; }
          UI.toast('Not confirmed yet', (res && res.error) || 'Open the link in your inbox first.', 'info', 4200);
        })
        .catch(function (e) {
          UI.toast('Could not check', (e && e.message) || 'Please try again.', 'error');
        })
        .then(function () {
          check.disabled = false;
          check.textContent = 'I have confirmed — continue';
        });
    }
    check.addEventListener('click', finish);

    const resend = document.getElementById('vfResend');
    resend.addEventListener('click', function () {
      resend.disabled = true;
      Promise.resolve(S.resendConfirmationEmail(user.email))
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || 'Could not resend.');
          UI.toast('Email sent', 'Check your inbox and spam folder.');
        })
        .catch(function (e) { UI.toast('Could not resend', (e && e.message) || 'Try again.', 'error'); })
        .then(function () { resend.disabled = false; });
    });

    /* Notice the moment the link is opened in another tab: re-read the auth
       session every few seconds, and immediately when this tab regains focus. */
    if (window.DD_CLOUD && window.DD_CLOUD.refreshSession) {
      const poll = function () {
        window.DD_CLOUD.refreshSession().then(function () {
          const u = S.currentUser();
          if (u && S.emailVerified(u)) { stopTick(); goHome('Your email is confirmed.'); }
          else if (u && u.emailConfirmed) { finish(); }
        }).catch(function () {});
      };
      stopTick();
      tick = setInterval(poll, 6000);
      window.addEventListener('focus', poll);
    }
  }

  /* ------------------------------------------------------------
     Signed in, in-app code mode: the demo inbox.
  ------------------------------------------------------------ */
  function renderCodePanel(user) {
    view.innerHTML =
      '<div class="verify-wrap">'
      + '<div class="verify-card">'
      +   '<div class="vf-ico vf-ico-shield">' + UI.ic('shield') + '</div>'
      +   '<h1>Confirm your email</h1>'
      +   '<p class="lead">Enter the 6-digit code we generated for <b>' + UI.esc(user.email) + '</b>. '
      +     'Ordering unlocks as soon as it checks out.</p>'

      +   '<div class="vf-inbox" id="vfInbox">'
      +     '<div class="vf-inbox-head">' + UI.ic('mail')
      +       '<b>Demo inbox</b><span class="vf-inbox-tag">simulated delivery</span></div>'
      +     '<div class="vf-inbox-body"><span class="vf-inbox-label">DishDash verification code</span>'
      +       '<span class="vf-inbox-code" id="vfCode">••••••</span>'
      +       '<span class="vf-inbox-expiry" id="vfExpiry">—</span></div>'
      +     '<p class="vf-inbox-foot">This project has no mail server, so the code is shown here instead of '
      +       'being emailed. In a live deployment the same code is delivered to your inbox and never '
      +       'reaches the browser.</p>'
      +   '</div>'

      +   '<form id="vfForm" novalidate>'
      +     '<div class="field">'
      +       '<label for="vfInput">6-digit code</label>'
      +       '<input class="input vf-input" id="vfInput" inputmode="numeric" autocomplete="one-time-code"'
      +         ' maxlength="6" placeholder="••••••" aria-describedby="vfErr">'
      +       '<span class="err" id="vfErr">Enter the 6-digit code.</span>'
      +     '</div>'
      +     '<button class="btn btn-primary btn-lg btn-block" type="submit" id="vfSubmit">Verify and continue</button>'
      +   '</form>'

      +   '<div class="vf-secondary">'
      +     '<span id="vfAttempts" class="vf-hint"></span>'
      +     '<button class="btn btn-ghost btn-sm" type="button" id="vfResend">Send a new code</button>'
      +   '</div>'
      + '</div></div>';

    const form = document.getElementById('vfForm');
    const input = document.getElementById('vfInput');
    const field = input.closest('.field');
    const errEl = document.getElementById('vfErr');
    const submit = document.getElementById('vfSubmit');
    const resend = document.getElementById('vfResend');
    const attemptsEl = document.getElementById('vfAttempts');

    function showError(msg) {
      errEl.textContent = msg;
      field.classList.add('invalid');
      form.classList.add('shake-err');
      setTimeout(function () { form.classList.remove('shake-err'); }, 420);
    }
    function clearError() { field.classList.remove('invalid'); }

    // digits only, and submit as soon as six are in — typing on a phone should
    // not require reaching for a button.
    input.addEventListener('input', function () {
      const clean = input.value.replace(/\D/g, '').slice(0, 6);
      if (clean !== input.value) input.value = clean;
      clearError();
      if (clean.length === 6) form.requestSubmit();
    });

    if (attemptsLeft !== null && attemptsLeft <= 2) {
      attemptsEl.textContent = attemptsLeft + ' attempt' + (attemptsLeft === 1 ? '' : 's') + ' left on this code.';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const code = input.value.trim();
      if (code.length !== 6) { showError('Enter the 6-digit code.'); return; }
      submit.disabled = true;
      submit.innerHTML = '<span class="spinner"></span> Checking…';
      Promise.resolve(S.confirmEmailCode(code))
        .then(function (res) {
          if (res && res.ok) { stopTick(); input.value = ''; goHome('Your email is confirmed.'); return; }
          const msg = (res && res.error) || 'That code is not correct.';
          if (res && typeof res.attemptsLeft === 'number') attemptsLeft = res.attemptsLeft;
          showError(msg);
          // Clear it: the field auto-submits on the sixth digit, so leaving a
          // full wrong value in place would swallow the next keystroke.
          input.value = '';
          input.focus();
          if (attemptsEl && typeof res.attemptsLeft === 'number') {
            attemptsEl.textContent = res.attemptsLeft > 0
              ? res.attemptsLeft + ' attempt' + (res.attemptsLeft === 1 ? '' : 's') + ' left on this code.'
              : 'Request a new code to try again.';
          }
        })
        .catch(function (e) {
          showError((e && e.message) || 'Could not check that code. Please try again.');
        })
        .then(function () {
          submit.disabled = false;
          submit.textContent = 'Verify and continue';
        });
    });

    resend.addEventListener('click', function () { requestCode(true); });
    requestCode(false);
  }

  /* ------------------------------------------------------------
     Request (or re-request) a code and paint the demo inbox.
  ------------------------------------------------------------ */
  function requestCode(manual) {
    const codeEl = document.getElementById('vfCode');
    const expiryEl = document.getElementById('vfExpiry');
    const resend = document.getElementById('vfResend');
    const inbox = document.getElementById('vfInbox');
    if (manual && resend) { resend.disabled = true; resend.textContent = 'Sending…'; }

    return Promise.resolve(S.requestEmailCode())
      .then(function (res) {
        if (manual && resend) { resend.disabled = false; resend.textContent = 'Send a new code'; }
        if (!res || !res.ok) {
          // A live code already exists but the resend cooldown refused a new
          // one. Show the code that is still valid rather than a blank panel —
          // the server only keeps a hash, so this display copy is the only
          // way the panel can survive a reload.
          const cached = S.lastDemoCode ? S.lastDemoCode() : null;
          if (cached && cached.code) {
            liveCode = cached.code;
            attemptsLeft = null;
            deadline = Date.parse(cached.expiresAt);
            resendAt = Date.now() + (Number(res && res.retryAfter) || 0) * 1000;
            if (codeEl) codeEl.textContent = liveCode;
            startTick();
            return res;
          }
          // cooldown is the common, benign case — show it in place. Any
          // other failure (e.g. the SQL never ran) must NOT be silent: on
          // first load there is no user action to attach the error to, so
          // it goes into the inbox line and a toast.
          const msg = (res && res.error) || 'Could not create a code.';
          if (codeEl) codeEl.textContent = liveCode || '••••••';
          if (expiryEl) {
            expiryEl.textContent = (res && res.retryAfter)
              ? 'You can request another code in ' + res.retryAfter + 's.'
              : msg;
          }
          if (!(res && res.retryAfter)) {
            UI.toast('Verification code unavailable', msg, 'error', 6000);
          }
          if (manual) {
            const field = document.getElementById('vfInput');
            if (field) {
              const errEl = document.getElementById('vfErr');
              if (errEl) errEl.textContent = msg;
              field.closest('.field').classList.add('invalid');
            }
            UI.toast('Could not send a code', msg, 'error', 4200);
          }
          return res;
        }

        liveCode = res.code || '';
        attemptsLeft = null;
        deadline = Date.now() + (Number(res.expiresIn) || 600) * 1000;
        resendAt = Date.now() + (Number(res.cooldown) || 60) * 1000;
        if (codeEl) codeEl.textContent = liveCode;
        if (inbox) {
          inbox.classList.remove('pulse');
          void inbox.offsetWidth;          // restart the animation
          inbox.classList.add('pulse');
        }
        if (manual) UI.toast('New code generated', 'The demo inbox above has been refreshed.');
        startTick();
        return res;
      })
      .catch(function (e) {
        if (manual && resend) { resend.disabled = false; resend.textContent = 'Send a new code'; }
        UI.toast('Could not create a code', (e && e.message) || 'Please try again.', 'error');
      });
  }

  function startTick() {
    stopTick();
    const expiryEl = document.getElementById('vfExpiry');
    const resend = document.getElementById('vfResend');
    const paint = function () {
      const now = Date.now();
      if (expiryEl) {
        expiryEl.textContent = deadline > now
          ? 'Expires in ' + mmss(deadline - now) + ' · single use'
          : 'This code has expired — request a new one.';
      }
      if (resend) {
        const wait = resendAt - now;
        if (wait > 0) {
          resend.disabled = true;
          resend.textContent = 'New code in ' + Math.ceil(wait / 1000) + 's';
        } else {
          resend.disabled = false;
          resend.textContent = 'Send a new code';
        }
      }
      if (deadline <= now && resendAt <= now) stopTick();
    };
    paint();
    tick = setInterval(paint, 1000);
  }

  /* ------------------------------------------------------------ */
  function renderAlreadyVerified(user) {
    stopTick();
    view.innerHTML =
      '<div class="verify-wrap"><div class="verify-card">'
      + '<div class="vf-ico vf-ico-ok">' + UI.ic('check') + '</div>'
      + '<h1>You are all set</h1>'
      + '<p class="lead"><b>' + UI.esc(user.email) + '</b> is already confirmed. Nothing else to do.</p>'
      + '<div class="vf-actions"><a class="btn btn-primary btn-lg" href="' + UI.esc(nextUrl()) + '">Continue</a>'
      + '<a class="btn btn-outline btn-lg" href="menu.html">Browse the menu</a></div>'
      + '</div></div>';
  }

  function renderNeedSignIn() {
    stopTick();
    view.innerHTML =
      '<div class="verify-wrap"><div class="verify-card">'
      + '<div class="vf-ico vf-ico-shield">' + UI.ic('shield') + '</div>'
      + '<h1>Sign in to verify</h1>'
      + '<p class="lead">Verification belongs to an account, so sign in first and we will bring you straight back here.</p>'
      + '<div class="vf-actions"><a class="btn btn-primary btn-lg" href="login.html?next='
      + encodeURIComponent('verify.html') + '">Go to sign in</a>'
      + '<a class="btn btn-outline btn-lg" href="register.html">Create an account</a></div>'
      + '</div></div>';
  }

  /* The auth session may arrive asynchronously — and in email-link mode it can
     appear from the URL when the customer returns from their inbox. */
  function render() {
    const user = S.currentUser();
    const pendingEmail = UI.getParam('email');

    if (!user) {
      if (pendingEmail) renderAwaitLink(pendingEmail);
      else renderNeedSignIn();
      return;
    }
    if (S.emailVerified(user)) { renderAlreadyVerified(user); return; }
    // 'link' mode needs a real inbox; anything else is the in-app demo code.
    if (S.verificationMode() === 'link') { renderLinkPanel(user); return; }
    renderCodePanel(user);
  }

  // Wait for the cloud adapter to settle before deciding, otherwise a
  // signed-in customer can be shown "sign in" during the connect window.
  function boot() {
    const settle = window.DD_STORE_SYNC && window.DD_STORE_SYNC.whenAuthReady
      ? window.DD_STORE_SYNC.whenAuthReady()
      : Promise.resolve();
    Promise.resolve(settle).then(function () {
      const refresh = window.DD_CLOUD && window.DD_CLOUD.refreshSession
        ? window.DD_CLOUD.refreshSession().catch(function () {})
        : Promise.resolve();
      return Promise.resolve(refresh).then(render);
    }).catch(render);

    if (S.on) S.on('auth', function () { /* re-render is handled per-panel */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
