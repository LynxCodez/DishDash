'use strict';

(function () {
  const D = window.DD_DATA;
  const S = window.DD_STORE;
  const UI = window.DD_UI;
  const $ = window.jQuery;

  /* ------------------------------------------------------------
     Payment simulation (demo only)
     - No real gateway. No card data is ever stored — values are
       read for validation, then discarded.
     - payment status is kept separate from order status:
         card          -> paid
         cod           -> pending
         bank_transfer -> awaiting_verification  (admin flips to paid)
  ------------------------------------------------------------ */

  let promo = null;          // { code, discount } once applied
  let pay = 'card';          // selected method
  let transferRef = null;    // generated once per transfer-panel render
  let transferAccount = null;// verified snapshot of the paying account (item 3)
  let tfSeq = 0;             // guards out-of-order resolution responses
  let placing = false;       // guards double submits

  const DEMO_CARD_HINT = 'Try 4242 4242 4242 4242 · any future expiry · any CVV';

  /* ---------- small helpers ---------- */

  function luhnOk(num) {
    const s = String(num || '').replace(/\D/g, '');
    if (s.length < 15 || s.length > 16) return false;
    let sum = 0, alt = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let n = parseInt(s[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }
  function expiryOk(v) {
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(v || '').trim());
    if (!m) return false;
    const mm = parseInt(m[1], 10), yy = parseInt(m[2], 10);
    if (mm < 1 || mm > 12) return false;
    const now = new Date();
    const exp = new Date(2000 + yy, mm, 1); // first day after expiry month
    return exp > now;
  }

  function totals() {
    const sum = S.cartSummary();
    const fee = sum.sub >= D.CONFIG.freeDeliveryMin ? 0 : D.CONFIG.deliveryFee;
    const discount = promo ? promo.discount : 0;
    return { sub: sum.sub, fee: fee, discount: discount, total: sum.sub + fee - discount };
  }
  function makeTransferRef() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r = '';
    for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return 'DD-' + r;
  }

  function miniItemsHTML(lines) {
    return '<div class="mini-items">' + lines.map(function (l) {
      return '<div class="mi"><span>' + UI.esc(l.dish.name) + ' × ' + l.qty
        + (l.note ? '<em class="mi-note">' + UI.esc(l.note) + '</em>' : '')
        + '</span><b>' + D.naira(l.dish.price * l.qty) + '</b></div>';
    }).join('') + '</div>';
  }

  /* ---------- summary (unchanged behaviour, CTA jumps to payment) ---------- */

  function renderSummary() {
    const inner = document.getElementById('summaryInner');
    if (!inner) return;
    const t = totals();
    const sum = S.cartSummary();
    inner.innerHTML =
      '<h3>Order summary</h3>'
      + miniItemsHTML(sum.lines)
      + '<div class="promo-area">'
      + (promo
        ? '<div class="promo-applied">'
          + '<span class="promo-tag">' + UI.ic('tag') + UI.esc(promo.code) + '</span>'
          + '<span class="promo-saved">' + UI.ic('check') + '&minus;' + D.naira(promo.discount) + ' off this order</span>'
          + '<button class="promo-remove" data-promo-remove type="button" aria-label="Remove promo code">' + UI.ic('x') + '</button>'
          + '</div>'
        : '<div class="promo-form">'
          + '<label class="promo-label" for="promoInput">' + UI.ic('tag') + 'Have a promo code?</label>'
          + '<div class="promo-row-in">'
          + '<input class="input" id="promoInput" placeholder="e.g. DISHWELCOME" autocomplete="off" autocapitalize="characters" spellcheck="false">'
          + '<button class="btn btn-outline" data-promo-apply type="button">Apply</button>'
          + '</div>'
          + '<p class="promo-hint">Try <b>DISHWELCOME</b> for &nbsp;' + D.naira(1500) + ' off, or <b>FAST10</b> for 10% off orders over &nbsp;' + D.naira(5000) + '.</p>'
          + '</div>')
      + '</div>'
      + '<div style="margin-top:12px">'
      + '<div class="sum-row"><span>Subtotal</span><b>' + D.naira(t.sub) + '</b></div>'
      + '<div class="sum-row"><span>Delivery fee</span><b>' + (t.fee === 0 ? '<span class="free">FREE</span>' : D.naira(t.fee)) + '</b></div>'
      + (t.discount > 0 ? '<div class="sum-row promo-row"><span>Promo discount (' + UI.esc(promo.code) + ')</span><b>&minus;' + D.naira(t.discount) + '</b></div>' : '')
      + '<div class="sum-row total"><span>Total to pay</span><b>' + D.naira(t.total) + '</b></div>'
      + '</div>'
      + '<button class="btn btn-primary btn-lg btn-block" data-goto-pay>' + UI.ic('wallet') + 'Continue to payment</button>'
      + '<p style="font-size:.8rem;color:var(--muted);margin-top:12px;text-align:center">Estimated delivery: <b>' + UI.etaClock(new Date().toISOString(), D.CONFIG.avgDeliveryMin) + '</b>. Demo checkout — no real charges.</p>'
      + '<a class="cont-shop" href="cart.html" style="justify-content:center;width:100%">' + UI.ic('arrow-l') + 'Back to cart</a>';
  }

  function applyPromo() {
    const input = document.getElementById('promoInput');
    const code = input ? input.value : '';
    const res = S.validatePromo(code, S.cartSummary().sub);
    if (!res.ok) {
      const row = input ? input.closest('.promo-row-in') : null;
      if (row) {
        $(row).addClass('shake-err');
        setTimeout(function () { $(row).removeClass('shake-err'); }, 420);
      }
      UI.toast('Promo code problem', res.error, 'error');
      if (input) input.focus();
      return;
    }
    promo = { code: res.code, discount: res.discount };
    renderSummary();
    UI.toast('Promo applied 🎉', res.code + ': ' + res.promo.desc + ' — &minus;' + D.naira(res.discount), 'success', 3800);
  }

  /* ---------- method-specific payment panels ---------- */

  function deliverySnapshot() {
    const f = document.getElementById('deliveryForm');
    if (!f) return null;
    return {
      name: f.fName.value.trim(), phone: f.fPhone.value.trim(),
      address: f.fAddr.value.trim(), city: f.fCity.value.trim(), note: f.fNote.value.trim()
    };
  }

  function deliveryLine() {
    const d = deliverySnapshot();
    if (!d) return '';
    return UI.esc(d.name) + ' · ' + UI.esc(d.phone) + '<br>' + UI.esc(d.address) + ', ' + UI.esc(d.city);
  }

  function cardPanelHTML(t) {
    return '<div class="pay-panel" data-panel="card">'
      + '<div class="card-visual" aria-hidden="true">'
      + '<span class="cv-chip"></span>'
      + '<span class="cv-num" data-cv-num>•••• •••• •••• ••••</span>'
      + '<div class="cv-bottom"><span class="cv-name" data-cv-name>CARDHOLDER NAME</span>'
      + '<span class="cv-brand">DEMO CARD</span></div>'
      + '</div>'
      + '<div class="field"><label for="cardName">Cardholder name</label>'
      + '<input class="input" id="cardName" autocomplete="cc-name" placeholder="Name as printed on card">'
      + '<span class="err">Enter the cardholder name (min. 3 characters).</span></div>'
      + '<div class="field"><label for="cardNumber">Card number</label>'
      + '<div class="input-affix"><span class="affix-ic">' + UI.ic('wallet') + '</span>'
      + '<input class="input" id="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000"></div>'
      + '<span class="err">Enter a valid demo card number (try ' + DEMO_CARD_HINT.split('·')[0].trim() + ').</span></div>'
      + '<div class="card-row-2">'
      + '<div class="field"><label for="cardExpiry">Expiry date</label>'
      + '<input class="input" id="cardExpiry" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY">'
      + '<span class="err">Use a valid future date (MM/YY).</span></div>'
      + '<div class="field"><label for="cardCvv">CVV</label>'
      + '<input class="input" id="cardCvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" type="password" maxlength="4">'
      + '<span class="err">3–4 digits.</span></div>'
      + '</div>'
      + '<button class="btn btn-primary btn-lg btn-block" data-pay-card>' + UI.ic('shield') + 'Pay ' + D.naira(t.total) + '</button>'
      + '<p class="pay-demo-note">' + UI.ic('info') + '<span><b>Demo payment</b> — no real transaction will occur. ' + DEMO_CARD_HINT + '. Nothing you type here is saved.</span></p>'
      + '</div>';
  }

  function codPanelHTML(t) {
    return '<div class="pay-panel" data-panel="cod">'
      + '<div class="cod-hero"><span class="cod-emoji" aria-hidden="true">💵</span>'
      + '<div><b>Pay ' + D.naira(t.total) + ' when your food arrives</b>'
      + '<span>Have the exact amount ready if you can — riders carry limited change.</span></div></div>'
      + '<div class="kv"><b>Order total</b><span>' + D.naira(t.total) + '</span></div>'
      + '<div class="kv"><b>Amount to pay</b><span style="font-weight:800">' + D.naira(t.total) + ' (cash, on delivery)</span></div>'
      + '<div class="kv"><b>Deliver to</b><span style="font-size:.88rem">' + (deliveryLine() || '—') + '</span></div>'
      + '<p class="pay-demo-note">' + UI.ic('info') + '<span>Payment is made <b>upon delivery</b> — nothing is charged now. Your order is confirmed immediately and marked <b>payment pending</b> until the rider collects the cash.</span></p>'
      + '<button class="btn btn-primary btn-lg btn-block" data-pay-cod>' + UI.ic('check') + 'Confirm Order</button>'
      + '</div>';
  }

  /* The customer confirms the account they are paying FROM, the way a real
     transfer flow does before it accepts a payment: pick the bank, type the
     NUBAN, and the app shows the holder's name. The check-digit test is the
     real CBN NUBAN rule; the name comes from the provider seam when a live
     key is configured, otherwise the deterministic demo resolver. */
  function acctVerifyHTML() {
    return '<div class="acct-verify" id="acctVerify">'
      + '<div class="acct-head">' + UI.ic('shield') + '<b>Confirm the account you are paying from</b></div>'
      + '<p class="acct-sub">Enter the account the transfer was sent from. We validate the number with the real NUBAN rule and show the account holder\u2019s name, so the admin can check it when verifying your payment.</p>'
      + '<div class="field"><label for="tfBank">Your bank</label>'
      + '<select class="input" id="tfBank"><option value="">Select your bank\u2026</option>'
      + D.NG_BANKS.map(function (b) {
        return '<option value="' + UI.esc(b.code) + '">' + UI.esc(b.name) + '</option>';
      }).join('')
      + '</select><span class="err" id="tfBankErr">Choose the bank that holds the account.</span></div>'
      + '<div class="field"><label for="tfAcct">Account number</label>'
      + '<div class="input-affix"><span class="affix-ic">' + UI.ic('wallet') + '</span>'
      + '<input class="input" id="tfAcct" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="10-digit NUBAN" aria-describedby="tfAcctCount tfAcctErr"></div>'
      + '<span class="acct-count" id="tfAcctCount" aria-live="polite"></span>'
      + '<span class="err" id="tfAcctErr">Enter the 10-digit account number.</span></div>'
      + '<div id="tfProof" hidden></div>'
      + '</div>';
  }

  function transferPanelHTML(t) {
    if (!transferRef) transferRef = makeTransferRef();
    const b = D.DEMO_BANK;
    return '<div class="pay-panel" data-panel="transfer">'
      + '<p class="transfer-warn">' + UI.ic('alert') + '<span><b>Simulation only.</b> ' + UI.esc(b.note) + '</span></p>'
      + '<div class="bank-card">'
      + '<div class="kv"><b>Bank name</b><span>' + UI.esc(b.bank) + '</span></div>'
      + '<div class="kv"><b>Account name</b><span>' + UI.esc(b.accountName) + '</span></div>'
      + '<div class="kv"><b>Account no.</b><span style="font-weight:800;letter-spacing:.06em">' + UI.esc(b.accountNumber) + '</span></div>'
      + '<div class="kv"><b>Amount</b><span style="font-weight:800">' + D.naira(t.total) + '</span></div>'
      + '<div class="kv"><b>Reference</b><span class="pay-ref"><code>' + transferRef + '</code>'
      + '<button class="promo-remove" data-copy-ref type="button" aria-label="Copy reference">' + UI.ic('copy') + '</button></span></div>'
      + '</div>'
      + acctVerifyHTML()
      + '<p class="pay-demo-note">' + UI.ic('info') + '<span>Use the <b>exact amount</b> and reference above. After you confirm, your order is created and its payment will sit as <b>awaiting verification</b> until an admin verifies it \u2014 they will see the account check below.</span></p>'
      + '<button class="btn btn-primary btn-lg btn-block" data-pay-transfer disabled>' + UI.ic('check') + 'I\u2019ve Made the Transfer</button>'
      + '<p class="acct-gate" id="tfGate">' + UI.ic('shield') + ' Confirm your account above to continue.</p>'
      + '</div>';
  }

  function panelFor(method, t) {
    if (method === 'card') return cardPanelHTML(t);
    if (method === 'cod') return codPanelHTML(t);
    return transferPanelHTML(t);
  }

  function setPanel($view, method) {
    pay = method;
    const t = totals();
    const $panel = $view.find('#payPanel');
    /* Swap the panel immediately and let the panel's own CSS animation
       (panelIn) play. A jQuery fadeOut callback is a timer, and browsers
       throttle those in a backgrounded tab — the payment area would sit
       empty (or invisible) until the tab was focused again. The CSS
       animation cannot stall that way. */
    $panel.stop(true, true).css('opacity', '').show().html(panelFor(method, t));
    bindPanel($view, method);
  }

  /* ---------- panel behaviour (card live-format, submits) ---------- */

  function bindPanel($view, method) {
    const $panel = $view.find('#payPanel');

    if (method === 'card') {
      const $num = $panel.find('#cardNumber');
      $num.on('input', function () {
        const v = this.value.replace(/\D/g, '').slice(0, 16);
        this.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
        $panel.find('[data-cv-num]').text(padCard(this.value));
      });
      $panel.find('#cardName').on('input', function () {
        $panel.find('[data-cv-name]').text((this.value || 'CARDHOLDER NAME').toUpperCase());
      });
      $panel.find('#cardExpiry').on('input', function () {
        let v = this.value.replace(/\D/g, '').slice(0, 4);
        if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
        this.value = v;
      });
      $panel.find('#cardCvv').on('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 4);
      });
      $panel.find('[data-pay-card]').on('click', function () { payByCard($view, $(this)); });
    }

    if (method === 'cod') {
      $panel.find('[data-pay-cod]').on('click', function () { confirmCod($view, $(this)); });
    }

    if (method === 'bank_transfer') {
      $panel.find('[data-copy-ref]').on('click', function () {
        copyText(transferRef);
        UI.toast('Reference copied', transferRef + ' is on your clipboard.', 'info', 2600);
      });
      bindAccountVerify($panel);
      $panel.find('[data-pay-transfer]').on('click', function () { confirmTransfer($view, $(this)); });
    }
  }

  /* ---------- paying-account verification (NUBAN) ---------- */

  function tfBank($panel) { return $panel.find('#tfBank').val() || ''; }
  function tfDigits($panel) { return String($panel.find('#tfAcct').val() || '').replace(/\D/g, ''); }
  function tfBankName($panel) {
    const b = D.NG_BANKS.find(function (x) { return x.code === tfBank($panel); });
    return b ? b.name : 'your bank';
  }

  /* Any edit to bank/number invalidates the previous verification — the
     snapshot must describe exactly what is on screen right now. */
  function tfClear($panel) {
    transferAccount = null;
    tfSeq++;
    $panel.find('#tfProof').attr('hidden', true).empty();
    $panel.find('#tfAcct').closest('.field').removeClass('invalid');
    $panel.find('#tfBank').closest('.field').removeClass('invalid');
    tfGate($panel, false);
  }

  function tfGate($panel, on) {
    $panel.find('[data-pay-transfer]').prop('disabled', !on);
    $panel.find('#tfGate').prop('hidden', !!on);
  }

  function tfProofBusy($panel, busy) {
    const $proof = $panel.find('#tfProof');
    if (!busy) { $proof.attr('hidden', true).empty(); return; }
    $proof.removeAttr('hidden').html('<div class="acct-proof is-busy">'
      + '<span class="ap-ic"><span class="spinner"></span></span>'
      + '<div><div class="ap-name">Checking account\u2026</div>'
      + '<div class="ap-sub">Validating this NUBAN against ' + UI.esc(tfBankName($panel)) + '</div></div></div>');
  }

  function tfProofHTML(a, checkDigit) {
    const provider = a.source === 'provider';
    const warn = checkDigit === 'mismatch';
    const note = checkDigit === 'match'
      ? 'This number passed the CBN NUBAN check-digit test.'
      : checkDigit === 'n/a'
        ? 'Mobile-money wallets publish no NUBAN check-digit rule, so only the format was validated.'
        : 'The check digit did not match the standard pattern \u2014 double-check the number before you transfer.';
    return '<div class="acct-proof' + (warn ? ' is-warn' : '') + '">'
      + '<span class="ap-ic">' + UI.ic(warn ? 'alert' : 'check') + '</span>'
      + '<div><div class="ap-name">' + UI.esc(a.accountName) + '</div>'
      + '<div class="ap-sub">' + UI.esc(a.bank) + ' \u00b7 ' + UI.esc(a.account) + '</div>'
      + '<span class="ap-src ' + (provider ? 'provider' : 'demo') + '">' + UI.ic(provider ? 'check' : 'info')
      + (provider ? 'Name confirmed by bank provider' : 'Demo resolution \u2014 the name is simulated') + '</span>'
      + '<div class="acct-note' + (warn ? ' warn' : '') + '">' + UI.ic(warn ? 'alert' : 'shield') + '<span>' + note + '</span></div>'
      + '</div></div>';
  }

  /* A live count, not a nag: while typing you see "7/10 digits", and the field
     only turns red on blur. Without this the button is disabled with no reply
     to a 9-digit typo, and the reason is invisible until the count is right. */
  function tfCount($panel, len) {
    const $c = $panel.find('#tfAcctCount');
    if (!len) { $c.text('').removeClass('is-bad'); return; }
    $c.text(len + '/10 digits').toggleClass('is-bad', len !== 10);
  }

  function bindAccountVerify($panel) {
    const rerun = UI.debounce(function () { resolvePayingAccount($panel); }, 350);
    $panel.find('#tfBank').on('change', function () {
      tfClear($panel);
      if (tfDigits($panel).length === 10) resolvePayingAccount($panel);
    });
    $panel.find('#tfAcct').on('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 10);
      tfClear($panel);
      tfCount($panel, this.value.length);
      if (this.value.length === 10) rerun();
    }).on('blur', function () {
      const len = tfDigits($panel).length;
      if (len > 0 && len !== 10) {
        $panel.find('#tfAcct').closest('.field').addClass('invalid');
        $panel.find('#tfAcctErr').text('A Nigerian account number is exactly 10 digits \u2014 that is ' + len + '.');
      }
    });
  }

  function resolvePayingAccount($panel) {
    const bank = tfBank($panel);
    const digits = tfDigits($panel);
    if (!bank) {
      $panel.find('#tfBank').closest('.field').addClass('invalid');
      return;
    }
    if (digits.length !== 10) {
      $panel.find('#tfAcct').closest('.field').addClass('invalid');
      return;
    }
    const seq = ++tfSeq;
    tfProofBusy($panel, true);
    Promise.resolve(S.resolveBankAccount(digits, bank)).then(function (res) {
      if (seq !== tfSeq) return;                  // a newer keystroke already won
      tfProofBusy($panel, false);
      if (!res || !res.ok) {
        transferAccount = null;
        tfGate($panel, false);
        $panel.find('#tfAcct').closest('.field').addClass('invalid');
        $panel.find('#tfAcctErr').text((res && res.error) || 'That account number could not be verified.');
        return;
      }
      const v = S.validateNuban(digits, bank);
      transferAccount = {
        account: digits, bankCode: bank, bank: res.bank || tfBankName($panel),
        accountName: res.accountName, source: res.source, at: new Date().toISOString()
      };
      $panel.find('#tfProof').removeAttr('hidden').html(tfProofHTML(transferAccount, v && v.checkDigit));
      tfGate($panel, true);
    }).catch(function () {
      if (seq !== tfSeq) return;
      tfProofBusy($panel, false);
      transferAccount = null;
      tfGate($panel, false);
      $panel.find('#tfAcct').closest('.field').addClass('invalid');
      $panel.find('#tfAcctErr').text('Could not verify that account \u2014 please try again.');
    });
  }

  function padCard(v) {
    const digits = v.replace(/\D/g, '');
    if (!digits) return '•••• •••• •••• ••••';
    let out = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    while (out.replace(/\s/g, '').length < 16) {
      const n = out.replace(/\s/g, '').length;
      out += n % 4 === 0 && n !== 0 ? ' •' : '•';
    }
    return out;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  /* ---------- shared submit plumbing ---------- */

  function validateDeliveryNow() {
    const f = document.getElementById('deliveryForm');
    // `msg` lets us replace the generic hint with the specific reason — the
    // number rule (prefix + length) can't be guessed from a red border alone.
    function mark(input, on, msg) {
      const field = input.closest('.field');
      field.classList.toggle('invalid', on);
      const el = field.querySelector('.err');
      if (on && el && msg) el.textContent = msg;
    }
    f.querySelectorAll('.field.invalid').forEach(function (x) { x.classList.remove('invalid'); });
    const vals = deliverySnapshot();
    const phone = S.validatePhone(vals.phone, { required: true });
    let ok = true;
    if (vals.name.length < 3) { mark(f.fName, true); ok = false; }
    if (!phone.ok) { mark(f.fPhone, true, phone.error); ok = false; }
    if (!ok) {
      $(f).addClass('shake-err');
      setTimeout(function () { $(f).removeClass('shake-err'); }, 420);
      UI.toast('Check your details', 'A few delivery fields need attention before you can order.', 'error');
      const firstBad = f.querySelector('.field.invalid input, .field.invalid textarea');
      if (firstBad) firstBad.focus();
    }
    return ok;
  }

  function processingBtn($btn, label) {
    $btn.prop('disabled', true).addClass('btn-loading');
    $btn.data('orig', $btn.html());
    $btn.html('<span class="spinner"></span> ' + label);
  }
  function restoreBtn($btn) {
    $btn.prop('disabled', false).removeClass('btn-loading');
    $btn.html($btn.data('orig'));
  }

  /* placeOrder returns a plain object in local mode and a Promise in cloud
     mode — Promise.resolve() handles both, so the id is always available.
     On failure we stay on the page and say so instead of navigating to a
     confirmation screen for an order that was never created.            */
  function finishOrder(opts, $btn) {
    // The one place every payment path funnels through, so the verification
    // rule cannot be side-stepped by picking a different method.
    if (!S.emailVerified(S.currentUser())) {
      if ($btn && $btn.length) restoreBtn($btn);
      UI.toast('Confirm your email first',
        'Ordering unlocks as soon as you verify your address.', 'info', 5000);
      setTimeout(function () {
        UI.go('verify.html?next=' + encodeURIComponent('checkout.html'));
      }, 1300);
      return;
    }
    placing = true;
    return Promise.resolve(
      S.placeOrder(Object.assign({ delivery: deliverySnapshot(), promo: promo }, opts))
    ).then(function (order) {
      UI.toast('Order placed 🎉', 'Order ' + order.id + ' confirmed — thank you!');
      UI.go('confirmation.html?id=' + encodeURIComponent(order.id));
    }).catch(function (err) {
      placing = false;
      if ($btn && $btn.length) restoreBtn($btn);
      UI.toast('Could not place the order', (err && err.message) || 'Something went wrong — no order was created.', 'error', 4600);
    });
  }

  /* ---------- method flows ---------- */

  function payByCard($view, $btn) {
    if (placing) return;
    if (!validateDeliveryNow()) return;
    const $panel = $view.find('#payPanel');
    const name = $panel.find('#cardName').val().trim();
    const num = $panel.find('#cardNumber').val();
    const exp = $panel.find('#cardExpiry').val();
    const cvv = $panel.find('#cardCvv').val();

    function flag(id, bad) { $panel.find('#' + id).closest('.field').toggleClass('invalid', bad); }
    let ok = true;
    if (name.length < 3) { flag('cardName', true); ok = false; }
    if (!luhnOk(num)) { flag('cardNumber', true); ok = false; }
    if (!expiryOk(exp)) { flag('cardExpiry', true); ok = false; }
    if (!/^\d{3,4}$/.test(cvv)) { flag('cardCvv', true); ok = false; }
    if (!ok) {
      $panel.addClass('shake-err');
      setTimeout(function () { $panel.removeClass('shake-err'); }, 420);
      UI.toast('Check the card details', 'One or more demo card fields are invalid — no order was created.', 'error');
      return;
    }

    processingBtn($btn, 'Processing Payment…');
    $panel.find('.pay-panel-inputs, input, button').not($btn).prop('disabled', true);
    setTimeout(function () {
      // success state inside the panel
      $panel.find('.pay-panel').length; // noop guard
      $btn.closest('.pay-panel').addClass('pay-success');
      $btn.html('<span class="pay-ok-ic">' + UI.ic('check') + '</span> Payment approved');
      setTimeout(function () {
        finishOrder({ pay: 'card', payStatus: 'paid' }, $btn);
      }, 850);
    }, 1800);
  }

  function confirmCod($view, $btn) {
    if (placing) return;
    if (!validateDeliveryNow()) return;
    processingBtn($btn, 'Confirming…');
    setTimeout(function () {
      finishOrder({ pay: 'cod', payStatus: 'pending' }, $btn);
    }, 800);
  }

  function confirmTransfer($view, $btn) {
    if (placing) return;
    if (!validateDeliveryNow()) return;
    const $panel = $view.find('#payPanel');
    // Belt-and-braces: the button stays disabled until verified, but this
    // state check is what actually enforces it (a re-render could enable it).
    if (!transferAccount
      || transferAccount.account !== tfDigits($panel)
      || transferAccount.bankCode !== tfBank($panel)) {
      if (!tfBank($panel)) $panel.find('#tfBank').closest('.field').addClass('invalid');
      $panel.find('#tfAcct').closest('.field').addClass('invalid');
      $panel.addClass('shake-err');
      setTimeout(function () { $panel.removeClass('shake-err'); }, 420);
      UI.toast('Confirm your account first',
        'We could not match a verified account to this transfer \u2014 check the account section above.', 'error', 4600);
      return;
    }
    processingBtn($btn, 'Submitting for verification…');
    setTimeout(function () {
      finishOrder({
        pay: 'bank_transfer', payStatus: 'awaiting_verification',
        payRef: transferRef, payAccount: transferAccount
      }, $btn);
    }, 1400);
  }

  /* ---------- main render ---------- */

  function render() {
    const user = S.currentUser();
    const view = document.getElementById('checkoutView');
    const sum = S.cartSummary();

    if (!user || user.role === 'admin') {
      S.logout();
      view.innerHTML = '<div class="cart-layout" style="grid-template-columns:1fr">'
        + UI.emptyState({
          emoji: '🔐',
          title: 'Sign in to check out',
          msg: 'Please sign in with your customer account to continue with your order.',
          action: { href: 'login.html?next=checkout.html', label: 'Go to sign in' }
        }) + '</div>';
      return;
    }
    if (!sum.count) {
      view.innerHTML = '<div class="cart-layout" style="grid-template-columns:1fr">'
        + UI.emptyState({
          emoji: '🛒',
          title: 'Nothing to check out',
          msg: 'Your cart is empty — add a few dishes first.',
          action: { href: 'menu.html', label: 'Browse the menu' }
        }) + '</div>';
      return;
    }

    const d = user.delivery || {};
    const t = totals();

    // Stated up front rather than only at the Pay button — the customer can
    // fill the whole form in, they just cannot finalise until verified.
    const verifyNotice = S.emailVerified(user) ? ''
      : '<div class="verify-banner" role="status">' + UI.ic('shield')
        + '<span><b>Confirm your email to place this order.</b> Fill everything in as normal — '
        + 'we will only ask you to verify before it goes through.</span>'
        + '<a class="btn btn-primary btn-sm" href="verify.html?next='
        + encodeURIComponent('checkout.html') + '">Verify now</a></div>';

    view.innerHTML = verifyNotice
      + '<div class="checkout-layout">'
      + '<div>'
      + '<form id="deliveryForm" novalidate>'
      + '<section class="panel" aria-label="Delivery information">'
      + '<div class="panel-head"><span class="panel-num">1</span><h2>Delivery information</h2><span class="sub">Where should we bring it?</span></div>'
      + '<div class="form-2col">'
      + '<div class="field"><label for="fName">Full name <span class="req">*</span></label><input class="input" id="fName" name="name" autocomplete="name" value="' + UI.esc(d.name || '') + '" placeholder="e.g. Ayo Balogun"></div>'
      + '<div class="field"><label for="fPhone">Phone number <span class="req">*</span></label><div class="input-affix"><span class="affix-ic">' + UI.ic('phone') + '</span><input class="input" id="fPhone" name="phone" autocomplete="tel" inputmode="tel" value="' + UI.esc(d.phone || '') + '" placeholder="e.g. 0803 123 4567"></div><span class="err">Enter an 11-digit Nigerian number starting with 070, 080, 081, 090 or 091 — e.g. 0803 123 4567.</span></div>'
      + '<div class="field"><label for="fAddr">Delivery address <span class="req">*</span></label><textarea class="input" id="fAddr" name="address" rows="2" autocomplete="street-address" placeholder="House number, street, estate / area">' + UI.esc(d.address || '') + '</textarea></div>'
      + '<div class="field"><label for="fCity">City <span class="req">*</span></label><input class="input" id="fCity" name="city" value="' + UI.esc(d.city || '') + '" placeholder="e.g. Lagos"></div>'
      + '<div class="field" style="grid-column:1/-1"><label for="fNote">Delivery instructions <span style="color:var(--faint);font-weight:600">(optional)</span></label><input class="input" id="fNote" name="note" value="' + UI.esc(d.note || '') + '" placeholder="e.g. Ring the bell twice, gate code…"></div>'
      + '</div></section>'
      + '</form>'

      + '<section class="panel" aria-label="Payment method">'
      + '<div class="panel-head"><span class="panel-num">2</span><h2>Payment method</h2><span class="sub">How would you like to pay?</span></div>'
      + '<div class="pay-stack" id="payStack">'
      + D.PAY_METHODS.map(function (m, i) {
        return '<label class="pay-card' + (i === 0 ? ' active' : '') + '">'
          + '<input type="radio" name="pay" value="' + m.key + '" ' + (i === 0 ? 'checked' : '') + '>'
          + '<span class="pay-ico">' + m.emoji + '</span>'
          + '<span class="pay-txt"><b>' + m.label + '</b><span>' + m.sub + '</span></span>'
          + '<span class="pay-radio" aria-hidden="true"></span>'
          + '</label>';
      }).join('')
      + '</div>'
      + '<div id="payPanel" class="pay-panel-wrap">' + cardPanelHTML(t) + '</div>'
      + '</section>'
      + '</div>'

      + '<aside class="summary-card" style="position:sticky;top:96px" id="summaryCard">'
      + '<div id="summaryInner"></div>'
      + '</aside>'
      + '</div>';

    renderSummary();

    const $view = $(view);
    bindPanel($view, 'card');

    // method switching (jQuery transitions)
    $view.find('#payStack input[name=pay]').on('change', function () {
      $view.find('.pay-card').removeClass('active');
      $(this).closest('.pay-card').addClass('active');
      setPanel($view, this.value);
    });

    // delegated handlers on the summary (survive re-renders)
    $view.find('#summaryCard').on('click', function (e) {
      const $t = $(e.target);
      if ($t.closest('[data-promo-apply]').length) { applyPromo(); return; }
      if ($t.closest('[data-promo-remove]').length) {
        promo = null;
        renderSummary();
        UI.toast('Promo removed', 'The discount was removed from this order.', 'info', 2800);
        return;
      }
      if ($t.closest('[data-goto-pay]').length) {
        document.querySelector('[aria-label="Payment method"]').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    $view.find('#summaryCard').on('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'promoInput') {
        e.preventDefault();
        applyPromo();
      }
    });

    UI.reveal(view);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();