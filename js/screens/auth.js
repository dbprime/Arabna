/* ======================= AUTH & VERIFICATION ======================= */
import { t, icon, $, $$, go, back, renderHeader, toast, wireRoutes } from '../ui.js';
import * as S from '../store.js';

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
      <img src="assets/logo-sm.png" style="height:56px" alt="ARABNA" />
      <b style="font-size:17px;margin-top:12px">${t('needAccount')}</b>
      <span class="muted fs-13">${t('needAccountSub')}</span>
    </div>
    ${pending ? `<div class="list-note">${icon('info', 18)}<span>${t('resumedAction')}</span></div>` : ''}
    <div class="pad mt-16">
      <div class="field"><label class="label">${t('fullName')}</label><input class="input" id="sName" /></div>
      <div class="field"><label class="label">${t('email')}</label><input class="input" id="sEmail" type="email" inputmode="email" placeholder="name@email.com" /></div>
      <div class="field"><label class="label">${t('password')}</label><input class="input" id="sPass" type="password" /></div>

      <label class="setting-row" style="padding:8px 0;border:none;cursor:pointer">
        <input type="checkbox" id="agree1" style="width:18px;height:18px;accent-color:#C6A15B" />
        <span class="s-txt"><b style="font-weight:500;font-size:12.5px">${t('agreeTo')}
          <a class="gold" href="#/terms">${t('terms')}</a> ${t('and')}
          <a class="gold" href="#/privacy">${t('privacy')}</a></b></span>
      </label>
      <label class="setting-row" style="padding:8px 0;border:none;cursor:pointer">
        <input type="checkbox" id="agree2" style="width:18px;height:18px;accent-color:#C6A15B" />
        <span class="s-txt"><b style="font-weight:500;font-size:12.5px">${t('age18')}</b></span>
      </label>

      <button class="btn btn-gold btn-block mt-12" id="suBtn">${t('createAccount')}</button>
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/signin">${t('haveAccount')}</button>
    </div>`;

  $('#suBtn').addEventListener('click', async (e) => {
    const name = $('#sName').value.trim();
    const email = $('#sEmail').value.trim();
    const pass = $('#sPass').value;
    if (!name || !email || !pass) { toast(t('required'), 'err'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast(t('required'), 'err'); return; }
    if (!$('#agree1').checked || !$('#agree2').checked) { toast(t('required'), 'err'); return; }

    e.target.innerHTML = `<span class="spinner"></span>`;
    S.signUp({ name, email });
    await S.sendEmailCode(email);
    go('#/auth/email');
  });
  wireRoutes(root);
}

/* ---------------------------- SIGN IN ---------------------------- */
export function SignInScreen(root) {
  renderHeader({ simple: true, title: t('signIn') });
  root.innerHTML = `
    <div class="pad mt-16 center-col"><img src="assets/logo-sm.png" style="height:56px" alt="ARABNA" /></div>
    <div class="pad mt-16">
      <div class="field"><label class="label">${t('email')}</label><input class="input" id="iEmail" type="email" /></div>
      <div class="field"><label class="label">${t('password')}</label><input class="input" id="iPass" type="password" /></div>
      <button class="btn btn-gold btn-block" id="siBtn">${t('signIn')}</button>
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/forgot">${t('forgotPassword')}</button>
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/signup">${t('noAccount')}</button>
    </div>`;

  $('#siBtn').addEventListener('click', () => {
    const email = $('#iEmail').value.trim();
    if (!email) { toast(t('required'), 'err'); return; }
    S.signUp({ name: email.split('@')[0], email });
    S.confirmEmail();
    toast(t('done'), 'ok');
    afterAuth();
  });
  wireRoutes(root);
}

export function ForgotScreen(root) {
  renderHeader({ simple: true, title: t('forgotPassword') });
  root.innerHTML = `
    <div class="pad mt-16">
      <div class="field"><label class="label">${t('email')}</label><input class="input" id="fEmail" type="email" /></div>
      <button class="btn btn-gold btn-block" id="fBtn">${t('sendCode')}</button>
    </div>`;
  $('#fBtn').addEventListener('click', () => { toast(t('resetSent'), 'ok'); go('#/auth/signin'); });
}

/* ------------------------ EMAIL VERIFICATION ------------------------ */
export function EmailVerifyScreen(root) {
  renderHeader({ simple: true, title: t('verifyEmail') });
  const email = S.state.user ? S.state.user.email : '';

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico">${icon('mail', 33)}</div>
      <b style="font-size:17px">${t('verifyEmail')}</b>
      <span class="muted fs-13">${t('verifyEmailSub')} <b class="gold">${email}</b></span>
    </div>
    <div class="pad mt-16">
      ${otpRow('e')}
      <div class="hint" style="text-align:center">${t('demoCode')} <b class="gold">${S.DEMO_CODE}</b></div>
      <button class="btn btn-gold btn-block mt-16" id="vBtn">${t('verifyBtn')}</button>
      <button class="btn btn-ghost btn-block mt-8" id="rsBtn">${t('resendCode')}</button>
    </div>`;

  wireOtp('e');
  $('#rsBtn').addEventListener('click', async () => { await S.sendEmailCode(email); toast(t('sendCode'), 'ok'); });
  $('#vBtn').addEventListener('click', () => {
    if (otpValue('e') !== S.DEMO_CODE) { toast(t('wrongCode'), 'err'); return; }
    S.confirmEmail();
    toast(t('emailVerified'), 'ok');
    const p = S.peekPendingIntent();
    // if the pending action needs phone verification, continue straight into it
    if (p && needsPhone(p.route)) { go('#/auth/phone'); return; }
    afterAuth();
  });
}

function needsPhone(route) {
  return /#\/(post|advertise|boost|subscribe|add-business|claim)/.test(route || '');
}

/* ------------------------ PHONE VERIFICATION ------------------------ */
export function PhoneVerifyScreen(root) {
  renderHeader({ simple: true, title: t('verifyPhone') });

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico">${icon('phone', 33)}</div>
      <b style="font-size:17px">${t('needPhone')}</b>
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
      <div class="hint" style="text-align:center">${t('demoCode')} <b class="gold">${S.DEMO_CODE}</b></div>
      <button class="btn btn-gold btn-block mt-16" id="vBtn">${t('verifyBtn')}</button>
      <button class="btn btn-ghost btn-block mt-8" id="backBtn">${t('back')}</button>
    </div>`;

  const msg = $('#phMsg');

  $('#sendBtn').addEventListener('click', async (e) => {
    const phone = $('#phIn').value.trim();
    if (!phone) { toast(t('required'), 'err'); return; }
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
