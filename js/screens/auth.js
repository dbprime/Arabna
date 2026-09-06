/* ======================= AUTH & VERIFICATION ======================= */
import { t, arCount, icon, $, $$, go, back, renderHeader, toast, wireRoutes, logoSrc,
         openSheet, closeSheet, esc } from '../ui.js';
import * as S from '../store.js';
import { PHONE_AUTH } from '../data.js';
import { passwordField, passwordChecklist, wirePasswordField,
         wirePasswordToggles, TermsScreen, PrivacyScreen } from './profile.js';

/* Errors sit under the field they belong to. An alert names no field and is
   gone before the reader has looked away from the keyboard.
   ⚠️ Module-level rather than inside one screen: the forgot-password screen
   is the second caller in this file, and a helper copied for a second
   caller is a helper with two versions two batches later. */
const setErr = (id, msg) => {
  const box = $('#e_' + id), input = $('#' + id);
  if (box) box.textContent = msg || '';
  if (input) input.classList.toggle('input-err', !!msg);
  return !msg;
};

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

      ${passwordField('sPass', t('password') + ' *', 'new-password')}
      ${/* The list replaces the strength meter. «ضعيفة / متوسّطة / قوية»
           measures nothing once the rule is absolute — a password is
           accepted or it is not — while the list says WHICH condition is
           still missing, live, as it is typed. */''}
      ${passwordChecklist('sPass')}
      <div class="field-err" id="e_sPass"></div>

      ${passwordField('sPass2', t('confirmPassword') + ' *', 'new-password')}
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
      ${/* one box for both ticks: they are refused together and the reader
           needs one sentence, not two identical ones */''}
      <div class="field-err" id="e_agree"></div>

      <button class="btn btn-gold btn-block mt-12" id="suBtn">${t('createAccount')}</button>
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/signin">${t('haveAccount')}</button>
    </div>`;

  wirePasswordToggles(root);

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
    /* ⚠️ EVERY OTHER refusal on this screen puts a red message under its
       own field and leaves it there; «empty» alone took a toast that names
       no field and is gone in 2.8 seconds. The difference was never in
       importance — it was in PLACE. `field-err` already exists and `310`
       applied it to the other boxes, so nothing new is written here. */
    const boxErr = setErr('agree', (!$('#agree1').checked || !$('#agree2').checked) ? t('required') : '');
    if (!boxErr) return;

    e.target.innerHTML = `<span class="spinner"></span>`;
    /* ⚠️ The server's refusal is printed under the email field and the
       button is given back. Before the live connection there was nothing
       that could refuse, so nothing read a return value. */
    const err = await S.signUp({ name: first + ' ' + last, email, password: pass, phone });
    if (err) {
      e.target.innerHTML = t('createAccount');
      setErr('email', t('signUpFailed'));
      return;
    }
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
      ${/* ⚠️ `username` on the field BEFORE the password, or a manager has
           nothing to bind the saved password to — the pair is what makes it
           offer the right one back. Measured: it carried no description at
           all, which §6.2's last paragraph asks to be checked and filled. */''}
      <div class="field"><label class="label">${t('email')}</label>
        <input class="input" id="iEmail" type="email" autocomplete="username" inputmode="email" /></div>
      ${passwordField('iPass', t('password'), 'current-password')}
      <button class="btn btn-gold btn-block" id="siBtn">${t('signIn')}</button>
      ${/* ⚠️ THE «قريباً» TAG IS GONE. It sat on the button leading to the very
           screen item 4 rebuilt — the same fault, surviving one step up the
           road: a promise that the thing does not work, over a thing that
           now does. */''}
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/forgot">${t('forgotPassword')}</button>
      <button class="btn btn-ghost btn-block mt-8" data-route="#/auth/signup">${t('noAccount')}</button>
    </div>`;

  wirePasswordToggles(root);
  $('#siBtn').addEventListener('click', async () => {
    const email = $('#iEmail').value.trim();
    const pass = $('#iPass').value;
    if (!email) { toast(t('required'), 'err'); return; }
    /* ⚠️ THIS WAS `signUp` FOLLOWED BY `confirmEmail`, and it was not a
       sign-in at all: any address and any password — an empty one included
       — created an account and confirmed it on the spot, overwriting an
       existing one's name, verified number and tier without a word. And
       `475` had turned that from a door into an account into a door into a
       PERMISSION, because a confirmed address is tier two while phone
       verification is off. The password is checked by the server now, and
       a wrong one is refused. */
    const err = await S.signInWithPassword(email, pass);
    if (err) { toast(t('wrongCredentials'), 'err'); return; }
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
      <b style="font-size:1.0625rem">${t('forgotTitle')}</b>
      <span class="muted fs-13" style="text-align:center">${t('forgotBody')}</span>
    </div>
    <div class="pad mt-16">
      <div class="field"><label class="label">${t('email')}</label>
        <input class="input" id="fgEmail" type="email" inputmode="email" autocomplete="email" />
        <div class="field-err" id="e_fgEmail"></div></div>
      <button class="btn btn-gold btn-block mt-8" id="fgGo">${t('sendCode')}</button>
      <button class="btn btn-plain btn-block mt-8" data-route="#/auth/signin">${t('signIn')}</button>
    </div>`;

  $('#fgGo').addEventListener('click', async (e) => {
    const email = $('#fgEmail').value.trim();
    if (!setErr('fgEmail', !email ? t('required') : !S.validEmail(email) ? t('badEmail') : '')) return;
    e.target.innerHTML = `<span class="spinner"></span>`;
    const r = await S.requestPasswordReset(email);
    e.target.textContent = t('sendCode');
    /* ⚠️ ONLY A TRANSPORT FAILURE IS REPORTED. Whether the address is
       registered is never answered — see `requestPasswordReset`. */
    if (!r.ok) { toast(r.message || t('sendFailed'), 'err'); return; }
    /* ⚠️ THE SAME SENTENCE WHETHER THE ACCOUNT EXISTS OR NOT. A screen that
       says «no account with this email» is an instrument for discovering
       who is registered here, run against a list of addresses. */
    toast(t('forgotNeutral'), 'ok');
    S.setPendingVerify('recovery', email);
    go('#/auth/email');
  });
  wireRoutes(root);
}

/** The last step of a reset: a session already exists, opened by the code.
    ⚠️ It guards itself on that session rather than on a route flag — an
    address-bar value is a request, never a permission. */
export function NewPasswordScreen(root) {
  if (!S.state.user) { go('#/auth/forgot'); return; }
  renderHeader({ simple: true, title: t('setNewPassword') });
  root.innerHTML = `
    <div class="pad mt-16">
      <div class="list-note" style="margin-inline:0">${icon('info', 18)}<span>${t('setNewPasswordSub')}</span></div>
      ${passwordField('npNew', t('newPassword'), 'new-password')}
      ${passwordChecklist('npNew')}
      <div class="field-err" id="e_npNew"></div>
      ${passwordField('npConf', t('confirmPassword'), 'new-password')}
      <div id="npErr"></div>
      <button class="btn btn-gold btn-block mt-8" id="npSave">${icon('lock', 19)} ${t('setNewPassword')}</button>
    </div>`;
  wirePasswordToggles(root);
  const checkNew = wirePasswordField('npNew', 'e_npNew');
  $('#npSave').addEventListener('click', async (e) => {
    const next = $('#npNew').value, conf = $('#npConf').value;
    const err = $('#npErr');
    err.innerHTML = '';
    if (checkNew()) return;
    if (next !== conf) { err.innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t('passwordsDontMatch')}</div>`; return; }
    e.target.innerHTML = `<span class="spinner"></span>`;
    const r = await S.completePasswordReset(next);
    if (!r.ok) {
      e.target.innerHTML = `${icon('lock', 19)} ${t('setNewPassword')}`;
      err.innerHTML = `<div class="err-msg">${icon('alert', 15)} ${r.message || t('pwServerRefused')}</div>`;
      return;
    }
    S.clearPendingVerify();
    toast(t('passwordChanged'), 'ok');
    go('#/home');
  });
  wireRoutes(root);
}

/* ------------------------ EMAIL VERIFICATION ------------------------ */
/* ⚠️ THE DEMO-CODE CARD IS GONE FROM THIS SCREEN, AND ONLY FROM THIS ONE.
   The email code is checked by Supabase now, so a card printing the fixed
   demo digits over a «fill demo code» button would show a number that is
   refused the instant it is submitted — a screen lying to the reader at the
   exact moment they are looking at it. It stays on the PHONE screen, where
   the code really is simulated (`sendSmsCode` still answers with it and
   `confirmPhone` still compares it in the page): the card belongs to
   whatever is still a prototype, and to nothing else.

   ⚠️ AND THE NOTE LIVES HERE RATHER THAN AT THE PLACE IT DESCRIBES,
   because that place is inside a template literal — where an HTML comment
   is part of the string, and one backtick in it ends the template. That is
   the V.09.9 fault in another costume — an ordinary block comment there,
   never a second interpolation — and it cost this batch its first gate: the
   parse error took down `auth.js` and, through the import graph, `app.js`
   with it — every screen blank. */
export function EmailVerifyScreen(root) {
  renderHeader({ simple: true, title: t('verifyEmail') });
  /* the address the code was sent to — the NEW one while a change waits,
     because printing the old address over a code sent to the new one is
     the app telling the reader something untrue at the exact moment they
     are checking their inbox. */
  const pv = S.pendingVerify();
  /* ⚠️ RECOVERY IS THE ONE ROAD WITH NOBODY SIGNED IN, so the address cannot
     be read off the account — it is the one the reader typed, carried on the
     pending record. Reading `state.user` here would print an empty address
     over a code that really was sent. */
  const recovery = !!(pv && pv.kind === 'recovery');
  const email = recovery ? (pv.target || '')
    : (S.pendingEmail() || (S.state.user ? S.state.user.email : ''));

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico">${icon('mail', 33)}</div>
      <b style="font-size:1.0625rem">${t('checkYourEmail')}</b>
      <span class="muted fs-13">${recovery ? t('recoverySub') : t('verifyEmailSub')} <b class="gold ltr">${esc(email)}</b></span>
      ${/* ⚠️ While phone verification is switched off a parked number is
           confirmed by THIS code, so the screen says so — and says the
           whole truth: it confirms the CHANGE and does not verify the
           number. Borrowing a word that says «توثيق» here would be the
           app claiming a message reached a phone that nothing called. */''}
      ${!PHONE_AUTH && S.pendingPhone()
        ? `<span class="muted fs-13 mt-8">${t('emailCodeConfirmsPhone')}</span>` : ''}
    </div>
    <div class="pad mt-16">
      ${otpRow('e')}
      <!-- the demo-code card is deliberately absent here; see the note
           above this function -->
      ${pv && pv.expired ? `<div class="err-msg">${icon('alert', 15)} ${t('codeExpired')}</div>` : ''}
      <button class="btn btn-gold btn-block mt-16" id="vBtn">${t('verifyBtn')}</button>
      <button class="btn btn-ghost btn-block mt-8" id="rsBtn" disabled>${t('resendNow')}</button>
      <!-- nobody is thrown out for not having the code to hand: they can
           read the app now and finish this when the email arrives -->
      <button class="btn btn-plain btn-block mt-8" id="guestBtn">${t('browseAsGuest')}</button>
    </div>`;

  wireOtp('e');
  /* no `wireDemoFill('e')` — the card it wires is gone from this screen */

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
    /* ⚠️ THE ORDER IS THE ITEM. The counter used to be reset and the green
       line shown BEFORE anything was known, so a reader whom nothing had
       reached was locked out of the button for 45 seconds and told it had
       worked. Nothing is claimed until the server has answered. */
    const r = recovery ? await S.sendRecoveryCode(email) : await S.sendEmailCode(email);
    if (!r || !r.ok) { toast((r && r.message) || t('sendFailed'), 'err'); return; }
    S.touchPendingVerify();
    toast(t('sendCode'), 'ok');
    if (!timer) timer = setInterval(tick, 1000);
    tick();
  });
  $('#guestBtn').addEventListener('click', () => go('#/home'));

  $('#vBtn').addEventListener('click', async () => {
    if (S.pendingVerify() && S.pendingVerify().expired) { toast(t('codeExpired'), 'err'); return; }
    /* ⚠️ THE CODE IS NO LONGER COMPARED HERE. It was measured against a
       fixed `DEMO_CODE` in the page — a prototype affordance, and the one
       thing that must not survive a live server: whoever can read the file
       knows the code. The six digits go to Supabase and it decides. */
    /* ⚠️ RECOVERY IS CONFIRMED BY ITS OWN FUNCTION AND ITS OWN TYPE. Sharing
       `confirmEmail` would mean one function promoting an address AND opening
       a reset session, and the promotion living in exactly one place is what
       keeps a code from ever doing more than it was sent for. */
    if (recovery) {
      const rerr = await S.confirmRecovery(email, otpValue('e'));
      if (rerr) { toast(t('wrongCode'), 'err'); return; }
      go('#/auth/new-password');
      return;
    }
    const err = await S.confirmEmail(otpValue('e'));
    if (err) { toast(t('wrongCode'), 'err'); return; }
    /* ⚠️ A SECOND CALL, not a branch inside `confirmEmail`. Each promotion
       stays in the one function that is never reached without a correct
       code, and neither writes the other's fields — which is what keeps a
       number confirmed by email from ever reading as one verified by SMS. */
    if (!PHONE_AUTH && S.pendingPhone()) S.confirmPhone(null, 'email');
    S.clearPendingVerify();
    toast(t('emailVerified'), 'ok');
    const p = S.peekPendingIntent();
    // Only continue into phone verification when the pending action really
    // needs tier 2. Reading ad prices needs tier 1, and #/advertise is the
    // same route either way — so the intent carries the tier, not the URL.
    /* ⚠️ And gated on the switch: while phone verification is off, tier 2
       was just earned by this very email, so the reader carries on to
       what they were going to in the first place — not to another screen. */
    if (PHONE_AUTH && p && (p.tier || 2) >= 2) { go('#/auth/phone'); return; }
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
    if (!phone) {
      /* the same rule as the sign-up boxes above: «empty» was the one
         refusal on this screen that took a toast instead of a line */
      $('#phIn').classList.add('input-err');
      msg.innerHTML = `<div class="err-msg">${icon('alert', 15)}<span>${t('required')}</span></div>`;
      return;
    }
    /* The number was given at sign-up. Re-typing it is the check that the
       person holds the account — and the message names only the last three
       digits, which is enough to jog a memory and not enough to leak one. */
    /* ⚠️ THE PENDING NUMBER FIRST. This line compared only against the
       number ON FILE, so somebody who saved a typo could not verify their
       REAL number — they had to retype the mistake. The error locked
       itself in, and that is the whole of item 8: without this line the
       parked number is decoration. */
    const onFile = S.pendingPhone() || (S.state.user && S.state.user.phone);
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
    /* the SMS road names itself — the two are never told apart by a default */
    S.confirmPhone($('#phIn').value.trim(), 'phone');
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
    ${/* ⚠️ `one-time-code` ON THE FIRST BOX ALONE, and the reason is what the
         system does with it: it fills the WHOLE code into one field and
         leaves the spreading to the page. Six boxes all carrying the same
         description make it put one digit in each — or give up. So the
         description goes on the first and the spreading is ours.
         ⚠️ And its absence was the one gap in a row of careful neighbours:
         given-name · family-name · email · tel — and then nothing on the
         only field where a suggestion has real work to do. */''}
    ${Array.from({ length: 6 }).map((_, i) => `<input class="otp-box" inputmode="numeric" maxlength="1" data-i="${i}"${
      i === 0 ? ' autocomplete="one-time-code" name="one-time-code"' : ''} />`).join('')}
  </div>`;
}
function wireOtp(ns) {
  const boxes = $$(`#otp-${ns} .otp-box`);
  /* ⚠️ ONE SPREADER, CALLED FROM TWO DOORS. It already existed inside the
     paste handler; what it lacked was a second caller. When the system
     fills the suggested code it arrives as SIX CHARACTERS IN THE FIRST
     BOX — and the `slice(0, 1)` below would cut it to one digit, so the
     suggestion would look broken while working perfectly. */
  const spread = (raw) => {
    const txt = String(raw || '').replace(/\D/g, '').slice(0, 6);
    if (!txt.length) return false;
    boxes.forEach((x, k) => { x.value = txt[k] || ''; });
    boxes[Math.min(txt.length, 5)].focus();
    return true;
  };
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      /* the autofilled code lands whole in the first box */
      if (i === 0 && b.value.replace(/\D/g, '').length > 1 && spread(b.value)) return;
      b.value = b.value.replace(/\D/g, '').slice(0, 1);
      if (b.value && i < boxes.length - 1) boxes[i + 1].focus();
    });
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
    });
    b.addEventListener('paste', (e) => {
      const txt = (e.clipboardData.getData('text') || '');
      if (/\d/.test(txt)) { e.preventDefault(); spread(txt); }
    });
  });
  if (boxes[0]) boxes[0].focus();
}
function otpValue(ns) { return $$(`#otp-${ns} .otp-box`).map(b => b.value).join(''); }
