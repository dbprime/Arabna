/* ======================= AUTH & VERIFICATION ======================= */
import { t, arCount, icon, $, $$, go, back, renderHeader, toast, wireRoutes, logoSrc,
         openSheet, closeSheet, esc } from '../ui.js';
import * as S from '../store.js';
import { passwordField, passwordChecklist, wirePasswordField,
         wirePasswordToggles, TermsScreen, PrivacyScreen } from './profile.js';

function afterAuth() {
  const p = S.takePendingIntent();
  if (p && p.route) { toast(t('resumedAction'), 'ok'); go(p.route); }
  else go('#/home');
}

/* ---------------------------- SIGN UP ---------------------------- */
export function SignUpScreen(root) {
  renderHeader({ simple: true, title: t('signUp') });
  const pending = S.peekPendingIntent();

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <img data-logo="wide" src="${logoSrc('wide')}" style="height:56px" alt="ARABNA" />
      <b style="font-size:1.0625rem;margin-top:12px">${t('needAccount')}</b>
      <span class="muted fs-13">${t('needAccountSub')}</span>
    </div>
    ${pending ? `<div class="list-note">${icon('info', 18)}<span>${t('resumedAction')}</span></div>` : ''}
    <div class="pad mt-16">
      <!-- two fields, because a directory sorts and greets by first name -->
      <div class="two-col">
        <div class="field"><label class="label">${t('firstName')} <span class="req">*</span></label>
          <input class="input" id="sFirst" autocomplete="given-name" />
          <div class="field-err" id="e_sFirst"></div></div>
        <div class="field"><label class="label">${t('lastName')} <span class="req">*</span></label>
          <input class="input" id="sLast" autocomplete="family-name" />
          <div class="field-err" id="e_sLast"></div></div>
      </div>

      <div class="field"><label class="label">${t('email')} <span class="req">*</span></label>
        <input class="input ltr" id="sEmail" dir="ltr" type="email" inputmode="email" placeholder="name@email.com" autocomplete="email" />
        <div class="field-err" id="e_sEmail"></div></div>

      <!-- the phone is taken here and stored unverified: asking for it at
           the moment somebody is trying to publish is the worst possible
           time. The code is asked for then, not now. -->
      <div class="field"><label class="label">${t('phoneNumber')} <span class="muted">(${t('optional')})</span></label>
        <input class="input ltr" id="sPhone" dir="ltr" inputmode="tel" placeholder="(713) 555-0000" autocomplete="tel" />
        <div class="hint">${t('phoneLater')}</div></div>

      ${passwordField('sPass', t('password') + ' *')}
      ${/* The list replaces the strength meter. «ضعيفة / متوسّطة / قوية»
           measures nothing once the rule is absolute — a password is
           accepted or it is not — while the list says WHICH condition is
           still missing, live, as it is typed. */''}
      ${passwordChecklist('sPass')}
      <div class="field-err" id="e_sPass"></div>

      ${passwordField('sPass2', t('confirmPassword') + ' *')}
      <div class="field-err" id="e_sPass2"></div>

      <label class="setting-row" style="padding:8px 0;border:none;cursor:pointer">
        <input type="checkbox" id="agree1" class="check-gold" />
        <span class="s-txt"><b style="font-weight:500;font-size:.78125rem">${t('agreeTo')}
          <button type="button" class="gold link-inline" data-legal="terms">${t('terms')}</button> ${t('and')}
          <button type="button" class="gold link-inline" data-legal="privacy">${t('privacy')}</button></b></span>
      </label>
      <label class="setting-row" style="padding:8px 0;border:none;cursor:pointer">
        <input type="checkbox" id="agree2" class="check-gold" />
        <span class="s-txt"><b style="font-weight:500;font-size:.78125rem">${t('age18')}</b></span>
      </label>

      <button class="btn btn-gold btn-block mt-12" id="suBtn">${t('createAccount')}</button>
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/signin">${t('haveAccount')}</button>
    </div>`;

  wirePasswordToggles(root);

  /* Errors sit under the field they belong to. An alert names no field and
     is gone before the reader has looked away from the keyboard. */
  const setErr = (id, msg) => {
    const box = $('#e_' + id), input = $('#' + id);
    if (box) box.textContent = msg || '';
    if (input) input.classList.toggle('input-err', !!msg);
    return !msg;
  };

  // live list, and red only once they have left the field or pressed go
  const checkPass = wirePasswordField('sPass', 'e_sPass');

  /* The terms open over the screen and close back onto the same line with
     everything still typed. The old link navigated away and lost the lot. */
  $$('[data-legal]').forEach(b => b.addEventListener('click', (ev) => {
    ev.preventDefault();
    openSheet(`
      <div class="sheet-title">${b.dataset.legal === 'terms' ? t('terms') : t('privacy')}</div>
      <div class="sheet-body legal-body" style="padding-inline:0">${legalText(b.dataset.legal)}</div>
      <div class="sheet-foot"><button class="btn btn-ghost btn-block" data-close>${t('close')}</button></div>
    `, (panel) => panel.querySelector('[data-close]').addEventListener('click', closeSheet));
  }));

  $('#suBtn').addEventListener('click', async (e) => {
    const first = $('#sFirst').value.trim();
    const last = $('#sLast').value.trim();
    const email = $('#sEmail').value.trim();
    const phone = $('#sPhone').value.trim();
    const pass = $('#sPass').value;
    const pass2 = $('#sPass2').value;

    let ok = true;
    ok = setErr('sFirst', !first ? t('required') : !S.validName(first) ? t('lettersOnly') : '') && ok;
    ok = setErr('sLast', !last ? t('required') : !S.validName(last) ? t('lettersOnly') : '') && ok;
    ok = setErr('sEmail', !email ? t('required') : !S.validEmail(email) ? t('badEmail') : '') && ok;
    // the checklist names the missing condition; «غير صالحة» names none
    // setErr returns true only when there is no message
    ok = (pass ? !checkPass() : setErr('sPass', t('required'))) && ok;
    ok = setErr('sPass2', !pass2 ? t('required') : pass2 !== pass ? t('passwordsDontMatch') : '') && ok;
    if (!ok) { $('.input-err') && $('.input-err').focus(); return; }
    if (!$('#agree1').checked || !$('#agree2').checked) { toast(t('required'), 'err'); return; }

    e.target.innerHTML = `<span class="spinner"></span>`;
    await S.signUp({ name: first + ' ' + last, email, password: pass, phone });
    await S.sendEmailCode(email);
    S.setPendingVerify('email', email);
    go('#/auth/email');
  });
  wireRoutes(root);
}

/**
 * The legal pages, harvested into a sheet instead of navigated to.
 * Both screens set the app header as their first act, so it is put back
 * afterwards — otherwise reading the terms leaves «الشروط» written across
 * the top of the sign-up form.
 */
function legalText(which) {
  const host = document.createElement('div');
  (which === 'terms' ? TermsScreen : PrivacyScreen)(host);
  renderHeader({ simple: true, title: t('signUp') });
  const body = host.querySelector('.legal-body');
  return body ? body.innerHTML : '';
}

/* ---------------------------- SIGN IN ---------------------------- */
export function SignInScreen(root) {
  renderHeader({ simple: true, title: t('signIn') });
  root.innerHTML = `
    <div class="pad mt-16 center-col"><img data-logo="wide" src="${logoSrc('wide')}" style="height:56px" alt="ARABNA" /></div>
    <div class="pad mt-16">
      <div class="field"><label class="label">${t('email')}</label><input class="input" id="iEmail" type="email" /></div>
      ${passwordField('iPass', t('password'))}
      <button class="btn btn-gold btn-block" id="siBtn">${t('signIn')}</button>
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/forgot">${t('forgotPassword')}
        <span class="soon-tag">${t('soon')}</span></button>
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/signup">${t('noAccount')}</button>
    </div>`;

  wirePasswordToggles(root);
  $('#siBtn').addEventListener('click', async () => {
    const email = $('#iEmail').value.trim();
    const pass = $('#iPass').value;
    if (!email) { toast(t('required'), 'err'); return; }
    await S.signUp({ name: email.split('@')[0], email, password: pass });
    S.confirmEmail();
    toast(t('done'), 'ok');
    afterAuth();
  });
  wireRoutes(root);
}

/**
 * There is no server account to reset against yet — `signOut()` clears the
 * only record there is — so a form here would take an email and do nothing,
 * which is the one outcome the project bans. It says so instead, and gives
 * the two doors that actually open.
 */
export function ForgotScreen(root) {
  renderHeader({ simple: true, title: t('forgotPassword') });
  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico">${icon('lock', 33)}</div>
      <b style="font-size:1.0625rem">${t('forgotSoonTitle')}</b>
      <span class="muted fs-13" style="text-align:center">${t('forgotSoonBody')}</span>
    </div>
    <div class="pad mt-16">
      <div class="list-note" style="margin-inline:0">${icon('info', 18)}<span>${t('forgotSoonHelp')}</span></div>
      <button class="btn btn-gold btn-block mt-12" data-route="#/auth/signup">${t('signUp')}</button>
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/signin">${t('signIn')}</button>
    </div>`;
  wireRoutes(root);
}

/* ------------------------ EMAIL VERIFICATION ------------------------ */
export function EmailVerifyScreen(root) {
  renderHeader({ simple: true, title: t('verifyEmail') });
  /* the address the code was sent to — the NEW one while a change waits,
     because printing the old address over a code sent to the new one is
     the app telling the reader something untrue at the exact moment they
     are checking their inbox. */
  const email = S.pendingEmail() || (S.state.user ? S.state.user.email : '');
  const pv = S.pendingVerify();

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico">${icon('mail', 33)}</div>
      <b style="font-size:1.0625rem">${t('checkYourEmail')}</b>
      <span class="muted fs-13">${t('verifyEmailSub')} <b class="gold ltr">${email}</b></span>
    </div>
    <div class="pad mt-16">
      ${otpRow('e')}
      ${demoCodeCard('e')}
      ${pv && pv.expired ? `<div class="err-msg">${icon('alert', 15)} ${t('codeExpired')}</div>` : ''}
      <button class="btn btn-gold btn-block mt-16" id="vBtn">${t('verifyBtn')}</button>
      <button class="btn btn-ghost btn-block mt-8" id="rsBtn" disabled>${t('resendNow')}</button>
      <!-- nobody is thrown out for not having the code to hand: they can
           read the app now and finish this when the email arrives -->
      <button class="btn btn-plain btn-block mt-8" id="guestBtn">${t('browseAsGuest')}</button>
    </div>`;

  wireOtp('e');
  wireDemoFill('e');

  /* A resend button that works instantly invites ten of them. The counter
     starts from when the code was actually sent, so coming back to this
     screen later finds it already available rather than restarting. */
  const rs = $('#rsBtn');
  let timer = null;
  const tick = () => {
    // the screen can be navigated away from mid-count; the interval has to
    // notice that its button is gone rather than throwing every second
    if (!document.body.contains(rs)) { clearInterval(timer); timer = null; return; }
    const sent = (S.pendingVerify() || {}).sentAt || 0;
    const left = Math.max(0, 45 - Math.floor((Date.now() - sent) / 1000));
    if (left > 0) {
      rs.disabled = true;
      rs.textContent = t('resendIn').replace('{c}', arCount(left, t('plSecond')));
    } else {
      rs.disabled = false;
      rs.textContent = t('resendNow');
      if (timer) { clearInterval(timer); timer = null; }
    }
  };
  tick();
  timer = setInterval(tick, 1000);

  rs.addEventListener('click', async () => {
    await S.sendEmailCode(email);
    S.touchPendingVerify();
    toast(t('sendCode'), 'ok');
    if (!timer) timer = setInterval(tick, 1000);
    tick();
  });
  $('#guestBtn').addEventListener('click', () => go('#/home'));

  $('#vBtn').addEventListener('click', () => {
    if (S.pendingVerify() && S.pendingVerify().expired) { toast(t('codeExpired'), 'err'); return; }
    if (otpValue('e') !== S.DEMO_CODE) { toast(t('wrongCode'), 'err'); return; }
    S.confirmEmail();
    S.clearPendingVerify();
    toast(t('emailVerified'), 'ok');
    const p = S.peekPendingIntent();
    // Only continue into phone verification when the pending action really
    // needs tier 2. Reading ad prices needs tier 1, and #/advertise is the
    // same route either way — so the intent carries the tier, not the URL.
    if (p && (p.tier || 2) >= 2) { go('#/auth/phone'); return; }
    afterAuth();
  });
}

/* ------------------------ PHONE VERIFICATION ------------------------ */
export function PhoneVerifyScreen(root) {
  renderHeader({ simple: true, title: t('verifyPhone') });

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico">${icon('phone', 33)}</div>
      <b style="font-size:1.0625rem">${t('needPhone')}</b>
      <span class="muted fs-13">${t('verifyPhoneSub')}</span>
    </div>
    <div class="pad mt-16" id="step1">
      <div class="field">
        <label class="label">${t('phoneNumber')}</label>
        <input class="input" id="phIn" inputmode="tel" placeholder="(713) 000-0000" />
        <div id="phMsg"></div>
      </div>
      <button class="btn btn-gold btn-block" id="sendBtn">${t('sendCode')}</button>
      <div class="hint" style="text-align:center;margin-top:10px">${t('needPhoneSub')}</div>
    </div>
    <div class="pad mt-16" id="step2" style="display:none">
      ${otpRow('p')}
      ${demoCodeCard('p')}
      <button class="btn btn-gold btn-block mt-16" id="vBtn">${t('verifyBtn')}</button>
      <button class="btn btn-ghost btn-block mt-8" id="backBtn">${t('back')}</button>
    </div>`;

  const msg = $('#phMsg');

  $('#sendBtn').addEventListener('click', async (e) => {
    const phone = $('#phIn').value.trim();
    if (!phone) { toast(t('required'), 'err'); return; }
    /* The number was given at sign-up. Re-typing it is the check that the
       person holds the account — and the message names only the last three
       digits, which is enough to jog a memory and not enough to leak one. */
    const onFile = S.state.user && S.state.user.phone;
    if (onFile && !S.samePhone(onFile, phone)) {
      $('#phIn').classList.add('input-err');
      /* ⚠️ `.err-msg` is `display:flex; gap:5px`, so a bare text node and a
         `<span>` beside it become TWO flex items with five pixels between
         them: «ينتهي بـ 123» instead of «ينتهي بـ123», and the ـ is a
         joiner that means the two touch. Text and tag go in ONE span, so
         the flex row is the icon and the sentence — which is also what
         keeps any tag put in an `.err-msg` in future from coming apart. */
      msg.innerHTML = `<div class="err-msg">${icon('alert', 15)}<span>${
        t('phoneMismatch').replace('{last}', '<span class="ltr">' + esc(S.phoneTail()) + '</span>')}</span></div>`;
      return;
    }
    const btn = e.target;
    btn.innerHTML = `<span class="spinner"></span> ${t('checkingLine')}`;
    msg.innerHTML = '';

    const look = await S.lookupLineType(phone);     // ← Twilio Lookup seam
    btn.innerHTML = t('sendCode');

    if (!look.ok) {
      $('#phIn').classList.add('input-err');
      msg.innerHTML = `<div class="err-msg">${icon('alert', 15)} ${look.type === 'voip' ? t('voipRejected') : look.type === 'landline' ? t('landlineRejected') : t('required')}</div>`;
      return;
    }
    $('#phIn').classList.remove('input-err');
    await S.sendSmsCode(phone);
    $('#step1').style.display = 'none';
    $('#step2').style.display = 'block';
    wireOtp('p');
    wireDemoFill('p');
  });

  $('#vBtn').addEventListener('click', () => {
    if (otpValue('p') !== S.DEMO_CODE) { toast(t('wrongCode'), 'err'); return; }
    S.confirmPhone($('#phIn').value.trim());
    toast(t('phoneVerified'), 'ok');
    afterAuth();
  });
  $('#backBtn').addEventListener('click', () => { $('#step2').style.display = 'none'; $('#step1').style.display = 'block'; });
}

/* ------------------------------ OTP ------------------------------ */
/** Prototype helper: the demo code, shown large, with a one-tap fill button. */
function demoCodeCard(ns) {
  return `
    <div class="card mt-16" style="padding:14px;text-align:center;border:1px dashed var(--gold)">
      <div class="fs-12 muted">${t('demoCodeIs')}</div>
      <div class="ltr" style="font-size:2.125rem;font-weight:700;letter-spacing:8px;color:var(--gold-bright);line-height:1.3">${S.DEMO_CODE}</div>
      <button class="btn btn-outline-gold btn-sm mt-8" data-fill="${ns}" style="width:100%">${icon('edit', 17)} ${t('fillDemoCode')}</button>
    </div>`;
}
function wireDemoFill(ns) {
  const btn = $(`[data-fill="${ns}"]`);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const boxes = $$(`#otp-${ns} .otp-box`);
    boxes.forEach((b, i) => { b.value = S.DEMO_CODE[i] || ''; });
    if (boxes[boxes.length - 1]) boxes[boxes.length - 1].focus();
  });
}

function otpRow(ns) {
  return `<div class="otp-row" id="otp-${ns}">
    ${Array.from({ length: 6 }).map((_, i) => `<input class="otp-box" inputmode="numeric" maxlength="1" data-i="${i}" />`).join('')}
  </div>`;
}
function wireOtp(ns) {
  const boxes = $$(`#otp-${ns} .otp-box`);
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      b.value = b.value.replace(/\D/g, '').slice(0, 1);
      if (b.value && i < boxes.length - 1) boxes[i + 1].focus();
    });
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
    });
    b.addEventListener('paste', (e) => {
      const txt = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (txt.length) { e.preventDefault(); boxes.forEach((x, k) => x.value = txt[k] || ''); boxes[Math.min(txt.length, 5)].focus(); }
    });
  });
  if (boxes[0]) boxes[0].focus();
}
function otpValue(ns) { return $$(`#otp-${ns} .otp-box`).map(b => b.value).join(''); }
