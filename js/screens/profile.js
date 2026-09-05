/* ======================= PROFILE & ACCOUNT SCREENS ======================= */
import { t, arCount, L, icon, $, $$, go, renderHeader, toast, wireRoutes, emptyState, confirmSheet,
         openSheet, closeSheet,
         fmtMoney, priceLabel, statusBadgeHtml, stars, logoSrc, shareItem,
         mapChoices, esc, bizBadgeHtml, avatarHtml, socialRowHtml, fmtPhone,
         installStepsHtml, appLink } from '../ui.js';
import { installMode, promptInstall, canPromptNative, mountInstallPrompt } from '../install.js';
import { SUBSCRIPTION_PRICE, CATEGORIES, APP_VERSION, PHONE_AUTH } from '../data.js';
import * as S from '../store.js';
import { catIcon } from './home.js';
import { openReviewSheet, fmtDate } from './directory.js';
import { mountPhotoPicker } from './marketplace.js';

/* ------------------------------ PROFILE ------------------------------
   This screen is the user's identity, not a second copy of the drawer.
   Everything that is listed in the drawer was removed from here; the three
   counters are the quick way in, and each one opens its own list. */
export function ProfileScreen(root) {
  renderHeader({});
  const u = S.isMember() ? S.state.user : null;
  const tierLabel = S.tier() === 2 ? t('tier2') : S.tier() === 1 ? t('tier1') : t('guest');

  /* --- signed out: one clear call to action, nothing pretending to be data --- */
  if (!u) {
    root.innerHTML = `
      <div class="pad mt-20 center-col">
        <div class="avatar" style="width:66px;height:66px;font-size:1.5rem">${icon('user', 31)}</div>
        <b style="font-size:1.125rem;margin-top:10px">${t('guest')}</b>
        <span class="muted fs-13">${t('needAccountSub')}</span>
        <button class="btn btn-gold mt-16" data-route="#/auth/signup">${t('signUp')}</button>
        <button class="btn btn-ghost btn-sm mt-8" data-route="#/auth/signin">${t('haveAccount')}</button>
      </div>`;
    wireRoutes(root);
    return;
  }

  const av = S.avatarView();
  const joined = u.joined ? new Date(u.joined).toLocaleDateString(
    S.state.lang === 'en' ? 'en-US' : 'ar-EG-u-nu-latn', { month: 'long', year: 'numeric' }) : '—';

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      ${av ? avatarHtml(av, 66) : `<div class="avatar" style="width:66px;height:66px;font-size:1.5rem">${esc(initialOf(u.name))}</div>`}
      <b style="font-size:1.125rem;margin-top:10px">${esc(u.name)}
        ${S.hasBadge() ? `<span class="badge-check" title="${t('verifiedBadge')}">${icon('check', 12)}</span>` : ''}</b>
      <span class="badge ${S.tier() === 2 ? 'badge-verified' : 'badge-free'} mt-8">${tierLabel}</span>
      ${u.avatar && u.avatar.status === 'pending' ? `<span class="hint">${t('photoPendingReview')}</span>` : ''}
    </div>

    <div class="pad mt-16">
      <div class="info-row"><span class="i-ico">${icon('mail', 21)}</span>
        <div class="i-txt"><b class="ltr">${esc(u.email)}</b><span>${t('email')}</span></div></div>
      ${/* ⚠️ Somebody who started changing their address and walked away had
           no way of knowing but to open the edit screen. Same condition and
           the SAME STRING the edit screen uses — no new key, and the two
           cannot drift apart. */''}
      ${S.pendingEmail() ? `<div class="hint" style="margin:-6px 0 10px">
        <span class="ink-danger">${t('emailPending').replace('{e}', esc(S.pendingEmail()))}</span>
        <button class="mini-btn mt-8" data-route="#/auth/email">${icon('mail', 15)} ${t('enterCode')}</button>
      </div>` : ''}

      <div class="info-row"><span class="i-ico">${icon('phone', 21)}</span>
        <div class="i-txt">
          <b class="ltr">${esc(u.phone ? fmtPhone(u.phone) : '—')}</b>
          <span>${u.phone
            ? (u.phoneVerified
                ? `<span class="ok-inline">${icon('check', 12)} ${t('verified')}</span>`
                /* ⚠️ «not verified» in red describes a shortcoming with no
                   way to repair it while the switch is off, so it is not
                   shown. The number itself stays: what is deferred is the
                   verification, never the number. */
                : PHONE_AUTH
                  ? `<span class="ink-danger">${t('phoneNotVerified')}</span>`
                  : `<span>${t('phoneVerifyLater')}</span>`)
            : t('phoneNumber')}</span>
        </div>
      </div>

      <div class="info-row"><span class="i-ico">${icon('calendar', 21)}</span>
        <div class="i-txt"><b>${joined}</b><span>${t('joinedOn')}</span></div></div>
    </div>

    ${/* ⚠️ THE VERIFIED NUMBER IS THE GATE ON EVERYTHING THAT EARNS: posting,
         contacting a seller, claiming a business, buying any advertisement.
         Somebody who reaches tier 2 is the only possible customer there is,
         so the step is named rather than left to be discovered.
         ⚠️ No badges, no points, no progress ring — a standing decision.
         ⚠️ And a finished step DISAPPEARS rather than standing struck
         through, and the whole block goes when the last one does. */''}
    ${(() => {
      const steps = [];
      /* ⚠️ And gated on the switch: otherwise a step that can never be
         finished stands in this list for ever, with a gold button pointing
         at a closed door — and a step that cannot be finished is worse
         than one struck through. If it is the last one the whole block
         goes, which the comment above already provides for. */
      if (PHONE_AUTH && !u.phoneVerified) steps.push([t('stepVerifyPhone'), '#/auth/phone', t('verifyBtn')]);
      if (!S.avatarView()) steps.push([t('stepAddPhoto'), '#/profile/edit', t('addBtn')]);
      if (!S.myBusinesses().length) steps.push([t('stepAddBusiness'), '#/claim', t('addBtn')]);
      if (!steps.length) return '';
      return `<div class="pad mt-16">
        <div class="dr-group-label">${t('completeAccount')}</div>
        ${steps.map(([label, route, cta]) => `<div class="list-note" style="margin-bottom:8px">${icon('shield', 18)}
          <span>${label}</span>
          <button class="mini-btn gold" data-route="${route}" style="margin-inline-start:auto">${cta}</button>
        </div>`).join('')}
      </div>`;
    })()}

    <div class="stat-row mt-16">
      <button class="stat" data-route="#/my-ads"><b>${S.myActiveListings().length}</b><span>${t('activeListings')}</span></button>
      <button class="stat" data-route="#/saved"><b>${S.state.saved.length}</b><span>${t('savedFav')}</span></button>
      <button class="stat" data-route="#/my-reviews"><b>${S.myReviews().length}</b><span>${t('myReviews')}</span></button>
    </div>

    <div class="pad mt-16">
      <div class="action-grid">
        <button class="btn btn-ghost btn-sm" data-route="#/profile/edit">${icon('edit', 18)} ${t('editProfile')}</button>
        <button class="btn btn-ghost btn-sm" data-route="#/profile/password">${icon('lock', 18)} ${t('changePassword')}</button>
      </div>
    </div>

    ${/* THE HUB. The drawer's «حسابي» group is deleted and its six rows stand
         here — the owner's decision: «بتشيل حسابي من تحت كامل ... وبعد الضغط على
         حسابي اللي فوق تفتحله شاشة فيها كل الخيارات اللي كانت تحت». They are
         read from ACCOUNT_LINKS so there is one list and not two menus. */''}
    <div class="pad mt-20">
      <div class="dr-group-label">${t('grpMyAccount')}</div>
      ${S.ACCOUNT_LINKS.map(l => {
        const sub = hubSub(l.key);
        return `<button class="list-row" data-route="${typeof l.route === 'function' ? l.route() : l.route}">
          <span class="row-ico">${icon(l.icon, 20)}</span>
          <div class="row-main"><div class="row-title">${t(l.key)}</div>
            ${sub ? `<div class="row-sub">${esc(sub)}</div>` : ''}</div>
        </button>`;
      }).join('')}
    </div>
    <div style="height:20px"></div>`;

  wireRoutes(root);
}

/* --------------------------- EDIT PROFILE --------------------------- */
export function EditProfileScreen(root) {
  // the badge fee is quoted here, so this screen is account holders only
  if (!S.requireTier(1, '#/profile/edit', go)) return;
  renderHeader({ simple: true, title: t('editProfile') });
  const u = S.state.user;

  root.innerHTML = `
    <div class="pad mt-16">
      <div class="field"><label class="label">${t('profilePhoto')}</label>
        ${/* THE READY-MADE MARKS COME FIRST, and that ordering is the item:
             they are instant, weigh three characters, and — unlike an upload —
             are never sent to the admin, because the picture is ours. */''}
        <div class="av-pick" id="avPick">
          ${S.AVATARS.map(a => `
            <button type="button" class="av-opt" data-preset="${a[0]}"
              aria-pressed="${u.avatar && u.avatar.kind === 'preset' && u.avatar.id === a[0]}"
              aria-label="${a[0]}"><span class="av-wrap">${S.avatarSvg(a[0])}</span></button>`).join('')}
        </div>
        <div class="hint">${t('avatarPresetHint')}</div>

        <div class="field mt-12"><label class="label">${t('avatarEmoji')}</label>
          ${/* ⚠️ 16 and not 4, and this is ONE item with the store's fix, not two:
      `maxlength` counts UTF-16 UNITS and a ZWJ family is eight of them, so
      fixing the function alone would leave the field refusing to accept one
      at all — and the test would go green on something the reader cannot
      do. 16 fits the longest single cluster, and the function trims to one
      regardless, so nothing leaks through. */''}
          <input class="input" id="avEmoji" maxlength="16" style="text-align:center;font-size:1.4rem"
            value="${u.avatar && u.avatar.kind === 'emoji' ? esc(u.avatar.ch) : ''}" placeholder="🌙" /></div>

        <div class="dr-group-label mt-12">${t('avatarUpload')}</div>
        <div id="avHost"></div>
        <div class="hint">${t('photoOptional')} · ${t('photoPendingReview')}</div>
      </div>

      <div class="field"><label class="label">${t('fullName')}</label>
        <input class="input" id="pName" value="${esc(u.name)}" />
        ${/* ⚠️ The same two rules sign-up uses, and the message UNDER ITS
             OWN FIELD as it is there — never a toast, which names no field
             and is gone before the reader looks up from the keyboard.
             «123» and «not-an-email» were both saved before this, and the
             screen then said «we sent a code to not-an-email». */''}
        <div class="field-err" id="e_pName"></div></div>
      <div class="field"><label class="label">${t('email')}</label>
        <input class="input" id="pEmail" type="email" value="${esc(u.email)}" />
        <div class="field-err" id="e_pEmail"></div>
        ${/* ⚠️ The rule is said BEFORE the typing, not after: somebody who
             knows a code is coming is not ambushed by a screen they did not
             ask for. */''}
        <div class="hint">${S.pendingEmail()
          ? `<span class="ink-danger">${t('emailPending').replace('{e}', esc(S.pendingEmail()))}</span>`
          : t('emailChangeNeedsCode')}</div>
        ${/* ⚠️ Drawn on the SAME condition that draws the line above, so the
             two can never say different things. */''}
        ${S.pendingEmail() ? `<button class="mini-btn" id="pCancelEmail">${icon('x', 15)} ${t('emailCancelChange')}</button>` : ''}</div>
      <div class="field"><label class="label">${t('phoneNumber')}</label>
        <input class="input" id="pPhone" inputmode="tel" value="${esc(u.phone || '')}" />
        ${/* ⚠️ This line was drawn ALWAYS, before the field was touched:
             «you changed your number, we need to verify the new one» on
             opening the screen. It is a RULE now, stated ahead of the
             typing; `phoneChangedReverify` stays exactly as it is, for the
             toast after a save, which is where it is true. */''}
        <div class="hint">${S.pendingPhone()
          ? `<span class="ink-danger">${t('phonePending').replace('{p}', esc(fmtPhone(S.pendingPhone())))}</span>`
          /* ⚠️ THE FOURTH SITE of the same class as the profile row, and it
             was reported before it was fixed. While the switch is off BOTH
             halves of this line were wrong: «موثَّق / غير موثَّق» describes
             a state with no way to change, and the rule beside it promised
             a code that no screen could ask for. What is true instead is
             the one thing the reader is about to do — change the number —
             and how it is confirmed now. */
          : PHONE_AUTH
            ? `${u.phoneVerified ? t('verified') : t('phoneNotVerified')} — ${t('phoneChangeRule')}`
            : t('phoneChangeRuleEmail')}</div>
        ${/* drawn on the SAME condition as the line, so the two cannot
             say different things — the shape the address already uses */''}
        ${S.pendingPhone() ? `<button class="mini-btn" id="pCancelPhone">${icon('x', 15)} ${t('phoneCancelChange')}</button>` : ''}</div>

      <button class="btn btn-gold btn-block mt-8" id="pSave">${icon('check', 19)} ${t('saveChanges')}</button>

      <div class="dr-group-label mt-20">${t('verifiedBadge')}</div>
      <div class="setting-row">
        <span class="s-txt"><b>${t('verifiedBadgeSub')}</b>
          <span>${S.hasBadge() ? t('badgeActive')
                : (u.badge && u.badge.status === 'pending') ? t('badgePending')
                : (S.VERIFY_BADGE_PRICE > 0 ? fmtMoney(S.VERIFY_BADGE_PRICE) + ' ' + t('month') : t('badgeFreeNow'))}</span></span>
        ${S.hasBadge() || (u.badge && u.badge.status === 'pending')
          ? `<span class="badge ${S.hasBadge() ? 'badge-verified' : 'badge-pending'}">${S.hasBadge() ? t('verified') : t('statusPending')}</span>`
          : `<button class="mini-btn gold" id="badgeBtn">${t('requestBadge')}</button>`}
      </div>
    </div>`;

  const pic = mountPhotoPicker($('#avHost'), (u.avatar && !u.avatar.kind) ? [u.avatar.url] : [], 0, 1);

  /* A pick takes effect at once and the three are exclusive: choosing one
     replaces the others, so the reader never has two marks half-chosen. */
  $$('#avPick .av-opt').forEach(btn => btn.addEventListener('click', () => {
    S.setAvatarPreset(btn.dataset.preset);
    $('#avEmoji').value = '';
    $$('#avPick .av-opt').forEach(o => o.setAttribute('aria-pressed', String(o === btn)));
    toast(t('profileSaved'), 'ok');
  }));
  const em = $('#avEmoji');
  em.addEventListener('change', () => {
    const v = em.value.trim();
    if (!v) { S.clearAvatar(); }
    else { S.setAvatarEmoji(v); em.value = [...v][0]; }
    $$('#avPick .av-opt').forEach(o => o.setAttribute('aria-pressed', 'false'));
  });

  /* the same shape sign-up uses: the message under its own field */
  const setErr = (id, msg) => {
    const box = $('#e_' + id), input = $('#' + id);
    if (box) box.textContent = msg || '';
    if (input) input.classList.toggle('input-err', !!msg);
    return !msg;
  };

  const cp = $('#pCancelPhone');
  if (cp) cp.addEventListener('click', () => {
    S.cancelPhoneChange();
    toast(t('phoneChangeCancelled'), 'ok');
    EditProfileScreen(root);
  });

  const cx = $('#pCancelEmail');
  if (cx) cx.addEventListener('click', () => {
    S.cancelEmailChange();
    toast(t('emailChangeCancelled'), 'ok');
    EditProfileScreen(root);
  });

  $('#pSave').addEventListener('click', async () => {
    const name = $('#pName').value.trim();
    const email = $('#pEmail').value.trim();
    const phone = $('#pPhone').value.trim();
    let fine = setErr('pName', !name ? t('required') : !S.validName(name) ? t('lettersOnly') : '');
    fine = setErr('pEmail', !email ? t('required') : !S.validEmail(email) ? t('badEmail') : '') && fine;
    if (!fine) return;

    const phoneChanged = phone !== (u.phone || '');
    const r = await S.updateProfile({ name, email, phone });

    // photo: only re-queue it when it actually changed
    /* ⚠️ Only the PHOTO half is touched here. Reading `u.avatar.url` on a
       preset gives undefined, so the old line would have cleared a mark the
       reader had just chosen the moment they pressed «حفظ». */
    const newPhoto = pic.photos[0] || '';
    const cur = S.state.user.avatar;
    const hadPhoto = cur && !cur.kind ? cur.url : '';
    if (newPhoto && newPhoto !== hadPhoto) S.setAvatar(newPhoto);
    else if (!newPhoto && hadPhoto) S.clearAvatar();

    if (!S.lastSaveOk) { toast(t('storageFull'), 'err'); return; }

    /* ⚠️ The email goes FIRST when both changed. The address is what a
       password reset and every notice travels to, so it is the one that
       must not be left half-changed — and the phone's own screen is one
       tap from the profile afterwards.
       ⚠️ And no new screen is built: `#/auth/email` already exists, with
       its resend timer, its ten-minute code life and «تصفّح الآن وأكمل
       لاحقاً». A second screen for the same thing is the duplication this
       project bans. */
    if (r && r.emailPending) {
      S.sendEmailCode(email);
      S.setPendingVerify('email', email);
      toast(t('emailChangeSent'), 'ok');
      go('#/auth/email');
      return;
    }
    /* ⚠️ The message says the NEW number is waiting on a code — not merely
       that «you changed your number», which was true of a change that had
       already taken effect and is no longer what happens. */
    const pend = r && r.phonePending;
    /* ⚠️ THE DEAD END THIS BATCH OPENED, AND NO SUITE COVERED IT.
       `updateProfile` parks the new number whatever the switch says, and
       the only thing that promotes it is `confirmPhone` — reached from
       `PhoneVerifyScreen`, which this same batch filtered out of `ROUTES`.
       So the number was parked FOR EVER: the old one stayed the account's,
       and the screen went on saying «بانتظار التأكيد» about a code nothing
       could ever send.
       The owner's decision: the confirmation moves from the mobile to the
       email — the code reaches the account's confirmed address and stands
       in for the SMS, on the SAME shape the email change already uses
       (`#/auth/email`, one screen, one code) rather than a new one.
       ⚠️ And the code confirms the CHANGE, never the NUMBER: see
       `confirmPhone`'s two roads in `store.js`. */
    if (pend && !PHONE_AUTH) {
      S.sendEmailCode(u.email);
      S.setPendingVerify('email', u.email);
      toast(t('phoneChangeSentEmail'), 'ok');
      go('#/auth/email');
      return;
    }
    toast(pend ? t('phoneChangeSent') : t('profileSaved'), pend ? 'ok' : 'ok');
    /* ⚠️ The most dangerous of the three and the best hidden: the number
       is a field people fill in today, and changing it is the one thing in
       the whole app that costs a re-verification. Without the switch here
       whoever changes their number is thrown at the closed screen, in the
       middle of a half-finished save. */
    go(pend && PHONE_AUTH ? '#/auth/phone' : '#/profile');
  });

  const bb = $('#badgeBtn');
  if (bb) bb.addEventListener('click', async () => {
    if (!S.requireTier(2, '#/profile/edit', go)) return;
    if (S.VERIFY_BADGE_PRICE > 0) {
      bb.innerHTML = `<span class="spinner"></span>`;
      await S.chargeCard(S.VERIFY_BADGE_PRICE, 'ARABNA verification badge');
      S.addReceipt({ kind: 'badge', amount: S.VERIFY_BADGE_PRICE, method: 'card',
                     description: t('verifiedBadge') });
    }
    S.requestBadge();
    toast(t('badgeRequested'), 'ok');
    go('#/profile/edit');
  });
  wireRoutes(root);
}

/* -------------------------- CHANGE PASSWORD -------------------------- */
export function ChangePasswordScreen(root) {
  if (!S.requireTier(1, '#/profile/password', go)) return;
  renderHeader({ simple: true, title: t('changePassword') });

  root.innerHTML = `
    <div class="pad mt-16">
      ${passwordField('cpCur', t('currentPassword'))}
      ${passwordField('cpNew', t('newPassword'))}
      ${/* This screen used to accept `length < 6` and nothing else, which
           made the sign-up rule worth nothing: register strong, change to
           123456 a minute later. It asks the same function now. */''}
      ${passwordChecklist('cpNew')}
      <div class="field-err" id="e_cpNew"></div>
      ${passwordField('cpConf', t('confirmPassword'))}
      <div id="cpErr"></div>
      <button class="btn btn-gold btn-block mt-8" id="cpSave">${icon('lock', 19)} ${t('changePassword')}</button>
    </div>`;

  wirePasswordToggles(root);
  const checkNew = wirePasswordField('cpNew', 'e_cpNew');

  $('#cpSave').addEventListener('click', async () => {
    const cur = $('#cpCur').value;
    const next = $('#cpNew').value;
    const conf = $('#cpConf').value;
    const err = $('#cpErr');
    err.innerHTML = '';

    if (checkNew()) return;                       // named under the field
    if (next === cur) { err.innerHTML = errMsg(t('pwSameAsOld')); return; }
    if (next !== conf) { err.innerHTML = errMsg(t('passwordsDontMatch')); return; }

    const res = await S.changePassword(cur, next);
    if (!res.ok) { err.innerHTML = errMsg(t('wrongPassword')); return; }
    toast(t('passwordChanged'), 'ok');
    go('#/profile');
  });
}

function errMsg(m) { return `<div class="err-msg">${icon('alert', 15)} ${m}</div>`; }

/** A password input with a working show / hide eye. */
export function passwordField(id, label) {
  return `<div class="field"><label class="label">${label}</label>
    <div class="pass-wrap">
      ${/* A hint to the system, never a command — no web app can force a
           phone's keyboard language (same limit as the maps sheet). What
           these DO stop is autocorrect and the capitalised first letter,
           both of which break a password silently. */''}
      <input class="input" id="${id}" type="password" autocomplete="off"
             lang="en" inputmode="text" autocapitalize="off"
             autocorrect="off" spellcheck="false" />
      <button type="button" class="pass-eye" data-eye="${id}" aria-label="${t('showPassword')}">${icon('eye', 19)}</button>
    </div></div>`;
}
/* ------------------------------------------------------------
   THE LIVE CHECKLIST

   «Like the big apps» means three behaviours together, not a red
   message on its own:

   1. Every condition is listed from the first moment and turns
      green AS IT IS MET, so nobody reaches the button without
      having satisfied them all — and therefore never sees red.
   2. Red does NOT appear on the first keystroke. Somebody who
      types `R` and is told the password is invalid feels they
      got it wrong before they started. Red waits until they
      leave the field or press the button, and clears the moment
      they type again.
   3. Nothing is hidden once satisfied — a list that shrinks
      under your fingers is a list that dances.

   «English only» is a grey hint ABOVE the list, not a condition
   in it: it is a door you are either through or not, and as a
   sixth green tick it would be permanently green for everybody
   typing Latin and would confuse whoever is not.
   ------------------------------------------------------------ */
/* ⚠️ `common` IS IN THIS LIST, and leaving it out was the fault. The rule
   existed and refused passwords, but the checklist showed only the other
   five — so a reader watched five ticks go green, tapped, and the button
   did nothing. A list that shows SOME of the conditions is worse than no
   list: it says «you are done» when you are not. Every condition the
   submit is allowed to refuse on has to be visible while typing. */
/** ⚠️ `u.name[0]` threw on an empty name and took the WHOLE SCREEN with
    it — «Cannot read properties of undefined», nothing rendered at all.
    And an empty name is reachable today, not in theory: the sign-in screen
    derives one from the address, and the edit form used to save a name the
    rule refuses.
    ⚠️ `[0]` is right here and is NOT `Intl.Segmenter`'s case: this is one
    character being DISPLAYED, while V.05.9's lesson was about STORING a
    whole emoji. A single Arabic letter is not a compound cluster. */
/**
 * What each hub row says about itself, under its own name.
 *
 * ⚠️ ZERO IS NEVER PRINTED. «0 رسالة» is noise in a row this narrow, and
 * its absence is the signal — the same rule that took the buyers' button
 * off a listing with no messages.
 * ⚠️ And every number here comes from a function that already existed;
 * this batch counts nothing new.
 */
function hubSub(key) {
  if (key === 'myBusiness') {
    const mine = S.myBusinesses();
    if (!mine.length) return '';
    const more = mine.length > 1 ? ' +' + (mine.length - 1) : '';
    const paid = S.businessPlan(mine[0]) === 'paid' ? ' · ' + t('planPaid') : '';
    return L(mine[0].name) + more + paid;
  }
  if (key === 'myMessages') {
    /* ⚠️ CONVERSATIONS, not «unread»: a message record carries no read
       state at all — measured, there is no such field — and a count the
       app does not have is a number invented on the screen. */
    const n = S.messageThreads().length;
    return n ? arCount(n, [t('conversation1'), t('conversation2'), t('conversation3'), t('conversation11')]) : '';
  }
  if (key === 'myRequests') {
    const n = S.pendingRequests();
    return n ? `${n} ${t('reqWaiting')}` : '';
  }
  if (key === 'subscription') {
    const sb = S.subscription();
    if (!sb) return '';
    if (sb.status === 'trial') return t('subTrial');
    return sb.currentPeriodEnd ? `${t('renewsOn')} ${fmtDate(sb.currentPeriodEnd)}` : '';
  }
  if (key === 'notifications') { const n = S.unreadCount(); return n ? String(n) : ''; }
  if (key === 'receipts')      { const n = S.receipts().length; return n ? String(n) : ''; }
  if (key === 'blockedTitle')  { const n = (S.state.blocked || []).length; return n ? String(n) : ''; }
  return '';
}

/* Hand the reader a file. The admin panel has its own copy of this and it
   is private to that module; duplicating six lines beats exporting a DOM
   helper out of a screen. */
function download(name, text, mime) {
  const blob = new Blob([text], { type: (mime || 'application/json') + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function initialOf(name) {
  return (String(name || '').trim()[0] || '?').toUpperCase();
}

const PW_ROWS = [
  ['len', 'pwReqLen'], ['upper', 'pwReqUpper'], ['lower', 'pwReqLower'],
  ['digit', 'pwReqDigit'], ['symbol', 'pwReqSymbol'],
  ['common', 'pwReqNotCommon'],
];

export function passwordChecklist(id) {
  return `<div class="pw-hint" id="${id}_latin">${t('pwLatinOnly')}</div>
    <ul class="pw-reqs" id="${id}_reqs" aria-live="polite">
      ${PW_ROWS.map(([k, key]) => `<li data-req="${k}">
        <span class="pw-dot">${icon('check', 13)}</span>${t(key)}</li>`).join('')}
    </ul>`;
}

/**
 * Paints the list and returns the reason a password is refused, or ''.
 * The caller decides WHEN to show that reason — the list is always live,
 * the red line is not.
 */
export function paintPasswordChecklist(id, value) {
  const c = S.passwordChecks(value);
  const host = $('#' + id + '_reqs');
  if (host) PW_ROWS.forEach(([k]) => {
    const li = host.querySelector(`[data-req="${k}"]`);
    if (li) li.classList.toggle('ok', !!c[k]);
  });
  const latin = $('#' + id + '_latin');
  if (latin) latin.classList.toggle('bad', value.length > 0 && !c.latin);

  if (!value) return '';
  // one thing at a time: telling somebody who typed Arabic that they also
  // need a capital letter adds confusion to confusion
  if (!c.latin) return t('pwLatinOnly');
  if (!c.common) return t('pwCommon');
  const missing = PW_ROWS.filter(([k]) => !c[k]).map(([, key]) => t(key));
  if (!missing.length) return '';
  const list = missing.length === 1 ? missing[0]
    : missing.slice(0, -1).join('، ') + (S.state.lang === 'en' ? ' and ' : '، و') + missing[missing.length - 1];
  return t('pwMissing').replace('{list}', list);
}

/** the three screens wire it the same way: live list, late red */
export function wirePasswordField(id, errId, onChange) {
  const input = $('#' + id);
  const err = () => $('#' + errId);
  if (!input) return () => '';
  let touched = false;
  const show = (msg) => {
    const box = err();
    if (box) box.textContent = msg || '';
    input.classList.toggle('input-err', !!msg);
  };
  const repaint = () => {
    const reason = paintPasswordChecklist(id, input.value);
    if (touched) show(reason); else show('');
    if (onChange) onChange(reason);
    return reason;
  };
  input.addEventListener('input', () => { touched = false; repaint(); });
  input.addEventListener('blur', () => { touched = true; repaint(); });
  repaint();
  /** called by the submit button: marks it touched and returns the reason */
  return () => { touched = true; return repaint(); };
}

export function wirePasswordToggles(root) {
  $$('[data-eye]', root).forEach(btn => btn.addEventListener('click', () => {
    const input = $('#' + btn.dataset.eye, root);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.classList.toggle('on', show);
    btn.setAttribute('aria-label', show ? t('hidePassword') : t('showPassword'));
  }));
}



/** Personal screens are for account holders only. If the session ended while
    one was open, send the user to the step they are missing instead of
    painting an empty list — and resume them here afterwards. */
function memberOnly(hash) { return S.requireTier(1, hash, go); }

/* ---------------------------- MY REQUESTS ----------------------------
   ⚠️ A WHOLE HOLE, not a missing subtitle. Somebody who pressed «هذا
   نشاطي» raised a record into the admin queue and then SAW NOTHING: no
   row, no status, not even an acknowledgement that it was sent. The
   notification when the decision comes is the only word there is, and a
   missed notification is the whole story missed.

   Measured before this: `state.claims` and `approvedClaims()` appear in
   `js/screens/` exactly ZERO times. The data was kept and no screen read
   it.

   ⚠️ And this builds NO new queue and no new admin screen — it READS the
   one that already exists. The verification badge joins it, so a person
   looks in one place for both.
   ⚠️ The admin's written reason reaches the reader VERBATIM, and is never
   reworded. (It is `307` that made a refusal ask for a reason at all;
   before it, this screen would have shown empty ones.) */
export function MyRequestsScreen(root) {
  if (!memberOnly('#/my-requests')) return;
  renderHeader({ simple: true, title: t('myRequests') });
  const rows = S.myRequests();

  root.innerHTML = !rows.length
    ? emptyState('clock', t('reqNone'), t('reqNoneSub'), t('directoryTitle'), '#/directory')
    : `<div class="pad mt-16">
        ${rows.map(r => {
          const biz = r.bizId ? S.businessById(r.bizId) : null;
          const name = r.kind === 'badge' ? t('reqBadge')
            : biz ? L(biz.name) : t('reqClaim');
          const badge = r.status === 'approved' ? 'badge-verified'
            : r.status === 'rejected' ? 'badge-free' : 'badge-pending';
          const word = r.status === 'approved' ? t('reqApproved')
            : r.status === 'rejected' ? t('reqRejected') : t('statusPending');
          /* approved and about a business: the row opens the page it won */
          const route = r.status === 'approved' && r.bizId ? `#/directory/${r.bizId}` : '';
          return `<div class="list-row"${route ? ` data-route="${esc(route)}"` : ''}>
            <span class="row-ico">${icon(r.kind === 'badge' ? 'shield' : 'briefcase', 20)}</span>
            <div class="row-main">
              <div class="row-title">${esc(name)} <span class="badge ${badge}">${word}</span></div>
              <div class="row-sub">${esc(r.kind === 'badge' ? t('reqBadge') : t('reqClaim'))}${
                r.when ? ' · ' + fmtDate(r.when) : ''}</div>
              ${r.status === 'rejected' && r.reason
                ? `<div class="err-msg">${icon('alert', 15)}<span>${esc(r.reason)}</span></div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  wireRoutes(root);
}

/* ------------------------------ SAVED ------------------------------ */
export function SavedScreen(root) {
  if (!memberOnly('#/saved')) return;
  renderHeader({ simple: true, title: t('savedFav') });
  const biz = S.allBusinesses().filter(b => S.isSaved(b.id));
  const cls = S.allClassifieds().filter(c => S.isSaved(c.id));

  root.innerHTML = (biz.length + cls.length) === 0
    ? emptyState('heart', t('emptySavedTitle'), t('emptySavedSub'), t('directoryTitle'), '#/directory')
    : `<div class="pad mt-16">
        ${biz.map(b => `<div class="list-row" data-route="#/directory/${b.id}">
            <span class="row-ico">${icon(catIcon(b.cat), 20)}</span>
            <div class="row-main"><div class="row-title">${esc(L(b.name))}</div>
              <div class="row-sub">${icon('mapPin', 13)} <span class="ltr">${esc(b.address)}</span></div></div></div>`).join('')}
        ${cls.map(c => `<div class="list-row" data-route="#/marketplace/${c.id}">
            <span class="row-ico">${icon(c.icon || 'image', 24)}</span>
            <div class="row-main"><div class="row-title">${esc(L(c.title))}</div>
              <div class="row-sub gold"><span class="ltr">${priceLabel(c.price)}</span></div></div></div>`).join('')}
      </div>`;
  wireRoutes(root);
}

/* ------------------------------ MY ADS ------------------------------ */
/**
 * What the advertiser is paying for, in numbers.
 *
 * Views, clicks and the rate between them are the only argument for
 * renewing, so the renew button sits next to them rather than on its own
 * screen. The bars are one per day, drawn in CSS: a chart library for
 * seven numbers would be the only dependency in the project.
 */
function adOrderCard(o) {
  const p = S.adProduct(o.product);
  const st = S.adStats(o.id);
  const days = S.adStatsByDay(o.id, 7);
  const peak = Math.max(1, ...days.map(d => d.i));
  const left = o.endsAt ? Math.max(0, Math.ceil((o.endsAt - S.now()) / 86400000)) : null;
  const ending = left !== null && left <= 1;

  return `<div class="q-card">
    <div class="q-head">
      <b>${esc(o.bizName)}</b>
      <span class="badge ${o.status === 'live' ? 'badge-verified' : o.status === 'rejected' ? 'badge-pending' : 'badge-pending'}">${
        o.status === 'live' ? t('statusLive') : o.status === 'rejected' ? t('statusRejected') : t('statusPending')}</span>
    </div>
    <div class="row-sub">${p ? t(p.nameKey) : o.product}${o.cat ? ' · ' + t(catKeyFor(o.cat)) : ''} · <span class="ltr">${fmtMoney(o.price)}</span></div>
    ${left !== null ? `<div class="row-sub ${ending ? 'gold' : ''}">${t('adEndsOn')}: ${fmtDate(o.endsAt)} · ${t('adDaysLeft').replace('{c}', arCount(left, t('plDay')))}</div>` : ''}
    ${o.reason ? `<div class="err-msg">${icon('alert', 15)} ${esc(o.reason)}</div>` : ''}

    <div class="stat-row" style="padding:10px 0 0">
      <div class="stat"><b>${st.impressions}</b><span>${t('adImpressions')}</span></div>
      <div class="stat"><b>${st.clicks}</b><span>${t('adClicks')}</span></div>
      <div class="stat"><b>${st.ctr.toFixed(1)}%</b><span>${t('adCtr')}</span></div>
    </div>

    <div class="spark" aria-hidden="true">
      ${days.map(d => `<span class="spark-bar" style="height:${Math.max(3, Math.round((d.i / peak) * 40))}px"
        title="${d.date}: ${d.i}"></span>`).join('')}
    </div>
    <div class="hint" style="text-align:center">${t('adLast7')}</div>

    <button class="btn btn-ghost btn-sm btn-block mt-8" data-adrenew="${o.id}">${icon('refresh', 16)} ${t('adRenew')}</button>
  </div>`;
}
function catKeyFor(id) {
  const c = CATEGORIES.find(x => x.id === id);
  return c ? c.key : 'catAll';
}

export function MyAdsScreen(root) {
  if (!memberOnly('#/my-ads')) return;
  renderHeader({ simple: true, title: t('myAds') });
  const mine = S.myActiveListings();
  const orders = S.state.myAds;

  root.innerHTML = `
    <div class="pad mt-16">
      ${mine.length ? mine.map(c => `
        <div class="list-row">
          <span class="row-ico" style="overflow:hidden;padding:0">${c.photos && c.photos.length
            ? `<img src="${esc(c.photos[c.mainPhoto || 0] || c.photos[0])}" style="width:100%;height:100%;object-fit:cover" alt="" />`
            : icon(c.icon || 'image', 24)}</span>
          <div class="row-main">
            <div class="row-title">${esc(L(c.title))} ${c.boosted ? `<span class="badge badge-boost">${t('boosted')}</span>` : ''} ${statusBadgeHtml(c, true)}</div>
            <div class="row-sub gold"><span class="ltr">${priceLabel(c.price)}</span> · ${t('expiresIn')} ${c.daysLeft} ${t('days')}</div>
            <div class="row-actions">
              <button class="mini-btn gold" data-route="#/boost/${c.id}">${icon('bolt', 15)} ${t('boost')}</button>
              <button class="mini-btn" data-route="#/post?edit=${c.id}">${icon('edit', 15)} ${t('edit')}</button>
              <button class="mini-btn" data-renew="${c.id}">${icon('refresh', 15)} ${t('renew')}</button>
              ${c.status === 'hidden'
                ? `<button class="mini-btn gold" data-unhide="${c.id}">${icon('eye', 15)} ${t('republish')}</button>`
                : `<button class="mini-btn" data-hide="${c.id}" aria-label="${t('hideListing')}">${icon('eye', 15)}</button>`}
              <!-- somebody who has just posted wants to send it to a
                   WhatsApp group now, not open it and hunt for a button -->
              <button class="mini-btn" data-share="${c.id}" aria-label="${t('share')}">${icon('share', 15)}</button>
              ${/* ⚠️ `bag` and a word, not a second eye: the eye two buttons
                   to the left is «أخفِ / أعِد نشر», which is correct and is
                   NOT touched. Two eyes in one row meaning two different
                   things is the fault, not the icon. */''}
              <button class="mini-btn" data-route="#/marketplace/${c.id}">${icon('bag', 15)} ${t('openListing')}</button>
            </div>
          </div>
        </div>`).join('') : emptyState('bag', t('emptyMyAdsTitle'), t('emptyMyAdsSub'), t('post'), '#/post')}

      ${orders.length ? `
        <div class="section-head" style="padding:0;margin:20px 0 10px"><div class="section-title">${t('advertiseWithUs')}</div></div>
        ${orders.map(o => adOrderCard(o)).join('')}` : ''}
    </div>`;

  $$('[data-adrenew]').forEach(b => b.addEventListener('click', () => {
    S.renewAd(b.dataset.adrenew); toast(t('adRenewed'), 'ok'); go('#/my-ads');
  }));
  $$('[data-renew]', root).forEach(b => b.addEventListener('click', () => {
    S.renewClassified(b.dataset.renew); toast(t('renewed'), 'ok'); go('#/my-ads');
  }));
  $$('[data-share]', root).forEach(b => b.addEventListener('click', () => {
    const c = S.classifiedById(b.dataset.share);
    if (!c) return;
    // the link somebody receives opens the listing itself
    const url = location.origin + location.pathname + '#/marketplace/' + c.id;
    shareItem(L(c.title), url);
  }));
  $$('[data-unhide]').forEach(b => b.addEventListener('click', () => {
    S.unhideClassified(b.dataset.unhide); toast(t('listingRepublished'), 'ok'); go('#/my-ads');
  }));
  $$('[data-hide]').forEach(b => b.addEventListener('click', () => {
    const c = S.classifiedById(b.dataset.hide);
    confirmSheet({
      title: t('hideListing'), sub: c ? L(c.title) : '', confirmText: t('hideListing'),
      onConfirm: () => { S.hideClassified(b.dataset.hide); toast(t('listingHidden'), 'ok'); go('#/my-ads'); }
    });
  }));
  wireRoutes(root);
}

/* ---------------------------- MY REVIEWS ---------------------------- */
export function MyReviewsScreen(root) {
  if (!memberOnly('#/my-reviews')) return;
  renderHeader({ simple: true, title: t('myReviews') });
  const mine = S.myReviews();

  root.innerHTML = mine.length
    ? `<div class="pad mt-16">${mine.map(r => {
        const b = S.businessById(r.bizId);
        return `<div class="card" style="padding:14px;margin-bottom:10px">
          ${/* ⚠️ THE EYE IS GONE FROM HERE. In this file alone the same
               drawing carried three meanings — «show the password», «hide
               / republish a listing», and «open the page» — and only the
               third was wrong: an eye over a business reads as VIEWS. It
               was a bare icon with no text and no `aria-label` either, so
               a screen reader said nothing at all about it.
               ⚠️ AND IT MOVES DOWN INTO THE BUTTON ROW. One button alone
               above the card and two below it read as two different
               groups, and they are actions on the same thing. */''}
          <div><b class="fs-13">${esc(b ? L(b.name) : r.bizId)}</b>
            <div class="fs-12 muted">${esc(L(r.when))} · ${stars(r.rating)}</div></div>
          <p class="fs-13 mt-8" style="margin:8px 0 0">${esc(L(r.text))}</p>
          <div class="row-actions mt-8">
            <button class="mini-btn" data-route="#/directory/${r.bizId}">${icon('building', 15)} ${t('bizPage')}</button>
            <button class="mini-btn gold" data-edit="${r.bizId}">${icon('edit', 15)} ${t('editReview')}</button>
            <button class="mini-btn" data-del="${r.id}">${icon('trash', 15)} ${t('delete')}</button>
          </div>
        </div>`;
      }).join('')}</div>`
    : emptyState('star', t('emptyRevTitle'), t('emptyRevSub'), t('directoryTitle'), '#/directory');

  $$('[data-edit]', root).forEach(b => b.addEventListener('click', () =>
    openReviewSheet(b.dataset.edit, () => go('#/my-reviews'))));
  $$('[data-del]').forEach(b => b.addEventListener('click', () => confirmSheet({
    title: t('delete'), sub: t('myReviews'), confirmText: t('delete'), danger: true,
    onConfirm: () => { S.deleteReview(b.dataset.del); toast(t('reviewDeleted'), 'ok'); go('#/my-reviews'); }
  })));
  wireRoutes(root);
}

/* --------------------------- MY BUSINESS --------------------------- */
/**
 * The subscriber's own numbers. The last line is the one that renews the
 * subscription — "340 people looked at your page this month" answers the
 * question every month's charge asks.
 */
function bizStatsBlock(b) {
  const st = S.bizStats(b.id);
  const arrow = (k) => {
    const d = st.delta(k);
    if (d === null || d === 0) return '';
    return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}%</span>`;
  };
  return `
    <div class="section-title mt-20">${t('bizStatsTitle')}<small>${t('bizStatsSub')}</small></div>
    <div class="stat-row" style="padding:0;grid-template-columns:repeat(2,1fr)">
      <div class="stat"><b>${st.cur.views}${arrow('views')}</b><span>${t('bizStatViews')}</span></div>
      <div class="stat"><b>${st.cur.calls}${arrow('calls')}</b><span>${t('bizStatCalls')}</span></div>
    </div>
    <div class="stat-row" style="padding:8px 0 0;grid-template-columns:repeat(3,1fr)">
      <div class="stat"><b>${st.cur.directions}</b><span>${t('bizStatDirections')}</span></div>
      <div class="stat"><b>${st.cur.saves}</b><span>${t('bizStatSaves')}</span></div>
      <div class="stat"><b>${st.reviews}</b><span>${t('bizStatReviews')}</span></div>
    </div>
    ${st.cur.views
      ? `<div class="list-note" style="margin-inline:0">${icon('trendingUp', 18)}
          <span>${t('bizStatsLine').replace('{c}', arCount(st.cur.views, t('plPerson')))}</span></div>`
      : `<div class="hint" style="margin-top:10px">${t('bizStatsEmpty')}</div>`}`;
}

export function MyBusinessScreen(root) {
  if (!memberOnly('#/my-business')) return;
  renderHeader({ simple: true, title: t('myBusiness') });
  /* PLURAL since V.05.4: `mine[0]` is the first element of the one list,
     not a second source of truth, so an account with one listing sees
     exactly what it saw before. */
  const mine = S.myBusinesses();
  const b = mine[0] || null;

  root.innerHTML = !b
    ? `${emptyState('briefcase', t('emptyBizTitle'), t('emptyBizSub'), t('addBusiness'), '#/add-business')}
       <div class="pad"><button class="btn btn-ghost btn-block" data-route="#/claim">${t('claimBusiness')}</button></div>`
    : `<div class="pad mt-16">
        <div class="list-row premium" data-route="#/directory/${b.id}">
          <span class="row-ico">${icon(catIcon(b.cat), 22)}</span>
          <div class="row-main">
            <div class="row-title">${esc(L(b.name))}
              ${bizBadgeHtml(b)}</div>
            <div class="row-sub">${icon('mapPin', 13)} <span class="ltr">${esc(b.address)}</span></div>
          </div>
        </div>
        ${S.businessPlan(b) === 'paid'
          ? `<div class="ok-msg" style="text-align:center">${t('subActive')}</div>
             ${bizStatsBlock(b)}
             <button class="btn btn-ghost btn-block mt-12" data-route="#/my-subscription">${t('mySubscription')}</button>`
          : `<div class="upsell" style="margin:14px 0">
               <div class="upsell-txt"><b>${S.planText(t('upgradeBanner'))}</b><span>${fmtMoney(SUBSCRIPTION_PRICE)} ${t('month')}</span></div>
               <button class="btn btn-gold btn-sm" data-route="#/subscribe/${b.id}">${t('upgradeBtn')}</button>
             </div>`}
        <button class="btn btn-ghost btn-block mt-8" data-route="#/advertise">${icon('megaphone', 19)} ${t('advertiseWithUs')}</button>
        ${/* The other branches. `esc()` on the name and the address is not
             decoration — the single-file build is served with
             'unsafe-inline', so esc is the only layer there. */''}
        ${mine.length > 1 ? mine.slice(1).map(x => `
          <div class="list-row" data-route="#/directory/${x.id}">
            <span class="row-ico">${icon(catIcon(x.cat), 22)}</span>
            <div class="row-main">
              <div class="row-title">${esc(L(x.name))}${bizBadgeHtml(x)}</div>
              <div class="row-sub">${icon('mapPin', 13)} <span class="ltr">${esc(x.address)}</span></div>
            </div>
          </div>`).join('') : ''}
        ${/* the owner's own wording: «زرّ للإضافة اليدويّة لأكثر من محلّ، توصلنا
             وننظر فيها». It goes to the EXISTING claim screen and the
             existing admin queue — no new screen, no invented review. */''}
        <button class="btn btn-ghost btn-block mt-8" data-route="#/claim">${icon('plus', 19)} ${t('claimAnother')}</button>
      </div>`;
  wireRoutes(root);
}

/* ------------------------------ SETTINGS ------------------------------ */
/**
 * ⚠️ NO `memberOnly` HERE, AND THAT IS THE ITEM.
 * The language, the appearance, the text size and the maps app are DEVICE
 * preferences, not account property: nothing about them reaches a server,
 * nothing follows the reader to another phone, and there is no identity to
 * ask for in exchange. Sending a visitor to `#/auth/signup` for them was
 * telling somebody who cannot read the screen to register in order to make
 * it bigger — and our oldest readers need the large text first and sign up
 * last. They do not register. They close the app.
 *
 * What genuinely belongs to an account — notifications, payment, the
 * subscription, receipts, the block list, deletion — is wrapped in
 * `isLoggedIn()` below and is not drawn at all for a visitor.
 */
export function SettingsScreen(root) {
  renderHeader({ simple: true, title: t('settings') });
  const p = S.state.notifPrefs;

  root.innerHTML = `
    <div class="mt-12">
      <div class="dr-group-label">${t('language')}</div>
      <div class="setting-row"><span class="s-txt"><b>${t('language')}</b><span>العربية / English</span></span>
        <button class="lang-pill" id="langBtn">${S.state.lang === 'ar' ? 'العربية' : 'English'}</button></div>

      <div class="dr-group-label">${t('appearance')}</div>
      <div class="theme-pick" id="themePick">
        ${['auto', 'light', 'dark'].map(m => `
          <button class="theme-opt ${S.themeMode() === m ? 'on' : ''}" data-theme-opt="${m}"
                  role="radio" aria-checked="${S.themeMode() === m}">
            <span class="tp-prev ${m}"><i></i><b></b></span>
            <span class="tp-name">${t(m === 'auto' ? 'themeAuto' : m === 'light' ? 'themeLight' : 'themeDark')}</span>
            <span class="tp-tick">${S.themeMode() === m ? icon('check', 16) : ''}</span>
          </button>`).join('')}
      </div>
      <div class="hint" style="padding:0 16px 4px">${t('themeAutoNote')}</div>

      <div class="dr-group-label">${t('fontSize')}</div>
      <div class="font-pick" id="fontPick" role="radiogroup" aria-label="${t('fontSize')}">
        ${S.FONT_SIZES.map((px, i) => `
          <button class="font-opt ${S.fontScale() === px ? 'on' : ''}" data-font="${px}"
                  role="radio" aria-checked="${S.fontScale() === px}">
            <span class="fo-a" style="font-size:${(px / 16).toFixed(5)}rem">A</span>
            <span class="fo-name">${t(['fontSmall', 'fontNormal', 'fontLarge', 'fontXLarge'][i])}</span>
          </button>`).join('')}
      </div>
      <!-- The sample is the whole point of the screen: four words named
           «كبير» tell nobody how large large is. It is a real row from the
           directory, at the size being offered, and it changes on the tap
           rather than after leaving the screen. -->
      <div class="font-sample" id="fontSample">${t('fontSample')}</div>
      <div class="hint" style="padding:0 16px 4px">${t('fontNote')}</div>

      ${/* A DEVICE PREFERENCE, so it stands with the other three and above
           the account block. «افتح فيه دائماً» is stored, so it has to be
           changeable — a preference you cannot undo is a trap, not a
           convenience. */''}
      <div class="dr-group-label">${t('mapsApp')}</div>
      <div class="setting-row">
        <span class="s-txt"><b>${t('mapsApp')}</b><span>${
          S.mapsApp() ? t('maps' + S.mapsApp()[0].toUpperCase() + S.mapsApp().slice(1)) : t('mapsAsk')
        }</span></span>
        <button class="mini-btn" id="mapsPref">${icon('navigation', 15)}</button>
      </div>

      ${/* ⚠️ THE PERMANENT HOME OF «أضِفه إلى شاشتك», and it is in the DEVICE
           block on purpose. Adding the app to a home screen is a fact
           about this phone, not about an account — the V.04.8 rule — and
           `#/profile` for a visitor is a sign-up screen, so putting the
           only door there would hide it from exactly the people who need
           it most: whoever has not signed up yet. The owner's file says «صفحةٌ
           في حسابي»; this is that screen, reached from the settings a
           visitor can already open. */''}
      <div class="dr-group-label">${t('instTitle')}</div>
      <div class="setting-row">
        <span class="s-txt"><b>${t('instSettingsRow')}</b><span>${t('instWhy2')}</span></span>
        <button class="mini-btn" data-route="#/install">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</button>
      </div>

      ${S.isLoggedIn() ? `
      <div class="dr-group-label">${t('notifPrefs')}</div>
      ${sw('messages', t('notifMessages'), p.messages)}
      ${sw('expiry', t('notifExpiry'), p.expiry)}
      ${sw('adLive', t('notifAdLive'), p.adLive)}
      ${sw('reviews', t('notifReviews'), p.reviews)}

      <div class="dr-group-label">${t('paymentMethods')}</div>
      ${/* ⚠️ One box that changes its action with the state, not two
           buttons: the card could be added and there was nothing anywhere
           that took it off again — and until this batch it survived even
           deleting the account. */''}
      <div class="setting-row"><span class="s-txt"><b>${esc(S.state.cardOnFile || t('noPayment'))}</b><span>Stripe</span></span>
        ${S.state.cardOnFile
          ? `<button class="mini-btn" id="delCard">${icon('trash', 15)} ${t('delete')}</button>`
          : `<button class="mini-btn gold" id="addCard">${icon('plus', 15)}</button>`}</div>

      <div class="dr-group-label">${t('subscription')}</div>
      ${(() => {
        // the row leads where the consent screen promised cancelling would be
        const sub = S.subscription();
        const label = sub ? t({ trialing: 'subStatusTrialing', active: 'subStatusActive',
                                canceled: 'subStatusCanceled', past_due: 'subStatusPastDue' }[sub.status])
                          : t('subTitle');
        const line = sub ? `${fmtMoney(sub.price)} ${sub.plan === 'yearly' ? t('year') : t('month')}`
                         : `${fmtMoney(SUBSCRIPTION_PRICE)} ${t('month')}`;
        return `<div class="setting-row"><span class="s-txt"><b>${label}</b><span>${line}</span></span>
          <button class="mini-btn" data-route="${S.subscriptionRoute()}">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</button></div>`;
      })()}

      ${/* Receipts sit here rather than in the drawer: they belong to
           anybody who has paid for anything, not only to a subscriber,
           and the «حسابي» group is already over the drawer's height. */''}
      <div class="setting-row">
        <span class="s-txt"><b>${t('receipts')}</b><span>${S.receipts().length || t('receiptsEmpty')}</span></span>
        <button class="mini-btn" data-route="#/receipts">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</button>
      </div>

      <div class="dr-group-label">${t('blockedTitle')}</div>
      <div class="setting-row">
        <span class="s-txt"><b>${t('blockedTitle')}</b><span>${S.blockedList().length
          ? S.blockedList().length : t('blockedNone')}</span></span>
        <button class="mini-btn" data-route="#/blocked">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</button>
      </div>

      ${/* ⚠️ THE PRIVACY PAGE PROMISES THIS IN SO MANY WORDS and there was
           no button for it anywhere. It is NOT the admin's backup: that
           one dumps the whole state, and the whole state carries the
           panel's password hash and its action log. */''}
      <div class="dr-group-label">${t('myData')}</div>
      <div class="setting-row">
        <span class="s-txt"><b>${t('downloadMyData')}</b><span>${t('downloadMyDataSub')}</span></span>
        <button class="mini-btn" id="dlData">${icon('file', 15)}</button>
      </div>

      ${/* ⚠️ A PLACE HELD, never half a feature invented. The row does not
           press and the sentence under it says why — and it is a <span>,
           not a disabled <a>: an anchor with no href stays in the tab order
           and a screen reader still calls it a link, promising what it
           cannot do. And the word is READ, not hovered: `title` never
           appears on a phone (the V.05.8 lesson).
           ⚠️ Nothing is invented around it: no device list, no last-seen
           date. */''}
      <div class="setting-row" style="opacity:.42">
        <span class="s-txt"><b>${t('signOutEverywhere')}</b><span>${t('worksWithServer')}</span></span>
        <span class="mini-btn" aria-disabled="true">${icon('lock', 15)}</span>
      </div>

      <div class="dr-group-label">${t('deleteAccount')}</div>
      <div class="setting-row" style="border:none">
        <span class="s-txt"><b>${t('deleteAccount')}</b><span>${t('deleteAccountSub')}</span></span>
        <button class="mini-btn ink-danger" id="delAcc">${icon('trash', 15)}</button>
      </div>
      ` : `
      ${/* The visitor is told what an account adds and what already works
           without one — never a blank where six sections used to be. */''}
      <div class="dr-group-label">${t('grpMyAccount')}</div>
      <div class="hint" style="padding:0 16px 12px">${t('settingsGuestNote')}</div>
      ${/* ⚠️ THE OFFSET IS ON A WRAPPER, NOT ON THE BUTTON. `.btn-block` is
             `width: 100%`, so an inline margin on the button itself asks for
             390 + 16 + 16 = 422 inside a 390 box. And `.app-main` carries
             `overflow-x: hidden`, so the surplus is CLIPPED rather than
             scrolled to — what is cut off cannot be reached at all, which is
             heavier than an overflow and not lighter.
             The hint one line above already did it the right way, as padding
             on its own container: two idioms for one job in adjacent lines.
             Measured before: [-16 … 374] in Arabic and [16 … 406] in English
             — the fault changes side with the language.
             ⚠️ And `.btn-block` in `app.css` is NOT touched: 120 elements in
             `js/` read that rule and exactly one carried an inline margin —
             this one. The fault was in the call that broke the pattern. */''}
      <div style="padding:0 16px 16px">
        <button class="btn btn-gold btn-block" data-route="#/auth/signup">${t('createAccount')}</button>
      </div>
      `}
      <div style="height:20px"></div>
    </div>`;

  $$('[data-theme-opt]').forEach(b => b.addEventListener('click', () => {
    import('../ui.js').then(m => {
      m.setTheme(b.dataset.themeOpt);
      // the choice is repainted in place: no reload, and no losing your spot
      $$('[data-theme-opt]').forEach(x => {
        const on = x === b;
        x.classList.toggle('on', on);
        x.setAttribute('aria-checked', on);
        x.querySelector('.tp-tick').innerHTML = on ? icon('check', 16) : '';
      });
    });
  }));

  $$('[data-font]').forEach(b => b.addEventListener('click', () => {
    const px = Number(b.dataset.font);
    import('../ui.js').then(m => {
      m.setFontScale(px);
      // repainted in place, like the theme: no reload and no losing your spot
      $$('[data-font]').forEach(x => {
        const on = x === b;
        x.classList.toggle('on', on);
        x.setAttribute('aria-checked', on);
      });
    });
  }));

  $$('.switch').forEach(s => s.addEventListener('click', () => {
    const k = s.dataset.k;
    S.state.notifPrefs[k] = !S.state.notifPrefs[k];
    S.save();
    s.classList.toggle('on', S.state.notifPrefs[k]);
  }));
  $('#langBtn').addEventListener('click', () => import('../ui.js').then(m => m.toggleLang()));
  /* ⚠️ THE ACCOUNT BLOCK IS NOT DRAWN FOR A VISITOR, so nothing may reach
     for it unguarded — `$('#addCard')` on a screen that never rendered one
     throws on `null` and takes the whole screen down. The guard is the same
     condition that drew them. */
  const card = $('#addCard');
  if (card) card.addEventListener('click', () => { S.state.cardOnFile = 'VISA •••• 4242'; S.save(); toast(t('done'), 'ok'); go('#/settings'); });
  const delCard = $('#delCard');
  if (delCard) delCard.addEventListener('click', () => confirmSheet({
    title: t('removeCard'),
    sub: t('removeCardAsk').replace('{card}', S.state.cardOnFile || ''),
    confirmText: t('delete'), danger: true,
    onConfirm: () => { S.state.cardOnFile = null; S.save(); toast(t('done'), 'ok'); go('#/settings'); },
  }));
  /* Deletion says what it takes with it and then actually takes it —
     signing out and calling it deleted would be a lie the stores ask
     about directly. */
  const mp = $('#mapsPref');
  if (mp) mp.addEventListener('click', () => openSheet(`
    <div class="sheet-title">${t('mapsApp')}</div>
    <div id="mapsPrefPick">
      <button class="pick-row ${!S.mapsApp() ? 'active' : ''}" data-app=""><span class="pick-dot"></span><span>${t('mapsAsk')}</span></button>
      ${mapChoices().map(a => `<button class="pick-row ${S.mapsApp() === a ? 'active' : ''}" data-app="${a}">
        <span class="pick-dot"></span><span>${t('maps' + a[0].toUpperCase() + a.slice(1))}</span></button>`).join('')}
    </div>
  `, (panel) => {
    panel.querySelectorAll('#mapsPrefPick .pick-row').forEach(b => b.addEventListener('click', () => {
      S.setMapsApp(b.dataset.app || null);
      closeSheet();
      go('#/settings');
    }));
  }));

  const dl = $('#dlData');
  if (dl) dl.addEventListener('click', () => {
    download('arabna-my-data-' + new Date().toISOString().slice(0, 10) + '.json', S.exportMyData());
    toast(t('done'), 'ok');
  });

  const del = $('#delAcc');
  if (del) del.addEventListener('click', () => {
    const d = S.deletionSummary();
    const lines = [
      [d.listings, t('myAds')], [d.reviews, t('myReviews')], [d.saved, t('saved')],
      [d.messages, t('messagesTitle')], [d.ads, t('advertiseWithUs')],
      [d.business, t('myBusiness')], [d.subscription, t('subscription')],
    ].filter(([n]) => n > 0);
    openSheet(`
      <div class="sheet-title">${t('deleteAccount')}</div>
      <div class="sheet-sub">${t('deleteWhatGoes')}</div>
      ${lines.length ? lines.map(([n, label]) => `
        <div class="setting-row" style="padding-inline:0">
          <span class="s-txt"><b>${label}</b></span><span class="muted">${n}</span></div>`).join('')
        : `<div class="hint">${t('deleteNothingElse')}</div>`}
      <div class="list-note" style="margin-inline:0">${icon('alert', 18)}<span>${t('deleteNoUndo')}</span></div>
      ${/* ⚠️ ABOVE the delete button, not below it: this is the last moment
           the data exists. */''}
      <button class="btn btn-ghost btn-block mt-12" id="delDl">${icon('file', 18)} ${t('downloadBeforeDelete')}</button>
      <button class="btn btn-danger btn-block mt-8" id="delGo">${t('delete')}</button>
      <button class="btn btn-plain btn-block mt-8" id="delNo">${t('cancel')}</button>
    `, (panel) => {
      panel.querySelector('#delGo').addEventListener('click', () => {
        S.deleteAccount();
        closeSheet();
        toast(t('deleteConfirm'), 'ok');
        go('#/home');
      });
      panel.querySelector('#delDl').addEventListener('click', () => {
        download('arabna-my-data-' + new Date().toISOString().slice(0, 10) + '.json', S.exportMyData());
        toast(t('done'), 'ok');
      });
      panel.querySelector('#delNo').addEventListener('click', () => closeSheet());
    });
  });
  wireRoutes(root);
}
function sw(key, label, on) {
  return `<div class="setting-row"><span class="s-txt"><b>${label}</b></span>
    <button class="switch ${on ? 'on' : ''}" data-k="${key}"></button></div>`;
}

/* --------------------------- NOTIFICATIONS --------------------------- */
/* --------------------------- ADD IT TO YOUR SCREEN ---------------------------
 * ⚠️ NO `memberOnly`, and that is the point. Adding the app to a home
 * screen is a fact about the phone, not about an account — and whoever
 * needs it most has not signed up yet.
 *
 * ⚠️ AND IT DOES NOT SELL A PROMISE. The reasons printed here are the ones
 * that are true today: full screen, faster, and — since `420` — the
 * directory works with no internet. THE ADHAN ALERT IS NOT NAMED, because
 * it is not built; somebody who adds the app for a notification that never
 * arrives has been sold a promise nobody kept. The reason is added the day
 * the alerts land, not before.
 */
export function InstallScreen(root) {
  renderHeader({ simple: true, title: t('instTitle') });
  /* the browser hands the event over whenever it likes, so the screen
     repaints itself if it arrives while the reader is standing here */
  mountInstallPrompt(() => { if (root.isConnected) InstallScreen(root); });
  const mode = installMode();

  root.innerHTML = `
    <div class="pad mt-16">
      ${mode === 'installed' ? '' : `<p class="fs-15" style="line-height:1.6">${t('instLine')}</p>
      <div class="mt-16">
        <div class="inst-step"><span class="is-n">${icon('check', 14)}</span><span class="is-t">${t('instWhy1')}</span></div>
        <div class="inst-step"><span class="is-n">${icon('check', 14)}</span><span class="is-t">${t('instWhy2')}</span></div>
        <div class="inst-step"><span class="is-n">${icon('check', 14)}</span><span class="is-t">${t('instWhy3')}</span></div>
      </div>`}
      <div class="mt-20">${installStepsHtml()}</div>
      <div style="height:20px"></div>
    </div>`;

  const goBtn = $('#instGo', root);
  if (goBtn) goBtn.addEventListener('click', () => {
    if (!canPromptNative()) return;
    promptInstall().then(() => InstallScreen(root));
  });
  const copy = $('#instCopy', root);
  /* ⚠️ The promise chain, never a bare try/catch around it: `writeText`
     returns a promise, so a rejection escapes the catch and the toast
     fires over an empty clipboard. That is the V.03.7 fault, and it is
     worst here — the reader pastes nothing into their own browser. */
  if (copy) copy.addEventListener('click', () => {
    const link = appLink();
    const ok = () => toast(t('linkCopied'), 'ok');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(ok).catch(() => prompt(t('instCopyLink'), link));
    } else { prompt(t('instCopyLink'), link); }
  });
  wireRoutes(root);
}

export function NotificationsScreen(root) {
  if (!memberOnly('#/notifications')) return;
  renderHeader({ simple: true, title: t('notifications') });
  const list = S.notifications();
  const unread = list.filter(n => n.unread);
  const read = list.filter(n => !n.unread);

  if (!list.length) {
    root.innerHTML = emptyState('bell', t('emptyNotifTitle2'), t('emptyNotifSub'));
    return;
  }

  const row = (n) => `
    <div class="notif-row ${n.unread ? 'unread' : ''}" data-notif="${n.id}"
         ${n.route ? `data-go="${n.route}"` : ''} style="cursor:pointer">
      <span class="notif-ico">${icon(n.icon, 20)}</span>
      <div class="notif-txt"><b>${esc(L(n.title))}</b><span>${esc(L(n.body))}</span>
        <div class="fs-12 muted mt-8">${esc(L(n.when))}</div></div>
      ${n.route ? `<span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 18)}</span>` : ''}
    </div>`;

  root.innerHTML = `
    ${unread.length ? `<div class="pad mt-12"><button class="btn btn-ghost btn-block btn-sm" id="readAll">
        ${icon('check', 17)} ${t('markAllRead')} (${unread.length})</button></div>` : ''}

    ${unread.length ? `<div class="notif-group-label">${t('notifNew')}</div>
      <div id="unreadTop">${unread.map(row).join('')}</div>` : ''}

    ${read.length ? `<div class="notif-group-label">${t('notifOlder')}</div>
      ${read.map(row).join('')}` : ''}
    <div style="height:18px"></div>`;

  // land on the first unread instead of the top of the page
  const first = $('#unreadTop .notif-row');
  if (first) requestAnimationFrame(() => first.scrollIntoView({ behavior: 'smooth', block: 'center' }));

  // a notification is read when it is opened — never all at once on render,
  // which would wipe the counter before the user saw anything.
  $$('[data-notif]').forEach(el => el.addEventListener('click', () => {
    S.markNotifRead(el.dataset.notif);
    // every notification leads somewhere; my-ads is the sane fallback
    go(el.dataset.go || '#/my-ads');
  }));

  const ra = $('#readAll');
  if (ra) ra.addEventListener('click', () => { S.markNotifsRead(); toast(t('done'), 'ok'); go('#/notifications'); });
  wireRoutes(root);
}

/* ------------------------------ STATIC ------------------------------ */
/**
 * The questions first, the way to reach a human second — most people who
 * open Help have one of ten questions, and reading an answer beats waiting
 * for a reply. One panel open at a time, the same idiom as the drawer.
 * The phone is gone from this screen on purpose; it is still published in
 * About and in both legal pages, where the app stores expect to find it.
 */
export function HelpScreen(root) {
  renderHeader({ simple: true, title: t('help') });
  const N = 12;
  root.innerHTML = `
    <div class="pad mt-16">
      <div class="section-title">${t('faqTitle')}</div>
      <div class="faq" id="faq">
        ${Array.from({ length: N }, (_, i) => i + 1).map(n => `
          <div class="faq-item" data-q="${n}">
            <button class="faq-head" aria-expanded="false" data-toggle="${n}">
              <span>${t('faqQ' + n)}</span>${icon('chevronD', 19, 'faq-arrow')}
            </button>
            <div class="faq-body"><div class="faq-body-inner"><p>${S.planText(t('faqA' + n))}</p></div></div>
          </div>`).join('')}
      </div>
    </div>

    <div class="legal-body">
      <h2>${t('contactUsTitle')}</h2>
      <p>${S.state.lang === 'en'
        ? 'If you did not find what you were looking for, get in touch.'
        : 'إذا لم تجد ما تبحث عنه، تواصل معنا.'}</p>
      <a class="contact-line" href="mailto:${S.SUPPORT_EMAIL}">${icon('mail', 18)}<span class="ltr">${S.SUPPORT_EMAIL}</span></a>
    </div>`;

  /* one open at a time: two open panels turn the list back into the wall
     of text the accordion was there to avoid */
  let open = 0;
  $$('#faq [data-toggle]').forEach(btn => btn.addEventListener('click', () => {
    const n = +btn.dataset.toggle;
    open = open === n ? 0 : n;
    $$('#faq .faq-item').forEach(it => {
      const on = +it.dataset.q === open;
      it.classList.toggle('open', on);
      it.querySelector('.faq-head').setAttribute('aria-expanded', String(on));
    });
  }));
}

/**
 * Who this person has blocked, and the way back. Apple wants the list to
 * exist and to be undoable; so does anyone who blocked the wrong seller.
 */
export function BlockedScreen(root) {
  if (!memberOnly('#/blocked')) return;
  renderHeader({ simple: true, title: t('blockedTitle') });

  const paint = () => {
    const list = S.blockedList();
    root.innerHTML = `<div class="pad mt-16">
      <div class="list-note" style="margin-inline:0">${icon('shield', 18)}<span>${t('blockedWhat')}</span></div>
      ${list.length ? list.map(b => `
        <div class="setting-row">
          <span class="s-txt"><b>${esc(b.label)}</b><span>${fmtDate(b.when)}</span></span>
          <button class="mini-btn gold" data-unblock="${b.key}">${t('unblock')}</button>
        </div>`).join('')
        : emptyState('shield', t('blockedNone'), t('blockedNoneSub'))}
    </div>`;
    $$('[data-unblock]').forEach(b => b.addEventListener('click', () => {
      S.unblockUser(b.dataset.unblock);
      toast(t('unblocked'), 'ok');
      paint();
    }));
  };
  paint();
}

export function AboutScreen(root) {
  renderHeader({ simple: true, title: t('about') });
  root.innerHTML = `
    <div class="pad mt-20 center-col">
      <img data-logo="stacked" src="${logoSrc('stacked')}" style="max-width:230px" alt="ARABNA عربنا" />
      ${/* ⚠️ RAI'S OWN WORDS, put into plain MSA and approved by him — the
           same rule the newcomer guide's text lives under. Nothing here is
           invented: the need, the two kinds of reader, Houston as the
           start and every American city as the aim are all his.
           ⚠️ And «Houston, Texas» stays in English inside the Arabic
           sentence — the standing rule that a place name is never
           translated. */''}
      <p class="fs-13 muted mt-16" style="max-width:300px;text-align:center">
        ${S.state.lang === 'en'
          ? 'ARABNA brings the Arab community in America together in one app: a business directory, a marketplace, prayer and mass times, a guide for newcomers, and a community magazine.'
          : 'عربنا يجمع الجالية العربية في أمريكا بتطبيق واحد: دليل أعمال، وسوق، ومواقيت الصلاة ومواعيد القداس، ودليل للواصل الجديد، ومجلة للمجتمع.'}
      </p>
      <p class="fs-13 muted mt-12" style="max-width:300px;text-align:center">
        ${S.state.lang === 'en'
          ? 'ARABNA grew out of what people actually need. An Arab in America — newly arrived or settled here for years — is always looking for the short, useful answer, and that is what this app is built on.'
          : 'نشأ عربنا من احتياجات الناس. فالعربيّ في أمريكا — واصلاً جديداً كان أو مقيماً منذ سنوات — يبحث دائماً عن المعلومة المختصرة المفيدة، وهذا ما يقوم عليه هذا البرنامج.'}
      </p>
      <p class="fs-13 muted mt-12" style="max-width:300px;text-align:center">
        ${S.state.lang === 'en'
          ? 'We started in Houston, Texas, and our aim is to reach every city in America.'
          : 'بدايتنا كانت من Houston, Texas، وهدفنا الانتشار في كلّ المدن الأمريكية.'}
      </p>
      <div class="contact-box mt-20">
        <div class="cb-title">${t('contactUsTitle')}</div>
        <div class="hint" style="margin-bottom:8px">${t('contactUsSub')}</div>
        ${/* ⚠️ The address is NOT written out here any more — the owner's
             decision: it is the first tile in the row below, beside the
             site and the four accounts, so the block reads as one row of
             icons instead of a line and then a row. It is still PUBLISHED
             in full on «الخصوصية» and «الشروط» and «المساعدة», which is
             where a legal page has to carry it. */''}
        ${S.SUPPORT_PHONE ? `<a class="contact-line" href="tel:${esc(S.SUPPORT_PHONE.replace(/[^0-9+]/g, ''))}">${icon('phone', 18)}<span class="ltr">${esc(S.SUPPORT_PHONE)}</span></a>` : ''}
        ${/* ⚠️ On «من نحن» ALONE. Not privacy, not terms: a legal page
             carries a published address for complaints, not marketing
             accounts, and a follow row above «طلبات إزالة المحتوى» reads
             wrong. And not in the drawer either — it is 112 over for a
             member and 195 for a visitor after 255, and another row adds
             to that; the owner's answer to question 4 was to leave it.
             ⚠️ The «سنرد خلال يومَي عمل» promise moved OUT of this block
             with this batch and is still published, unchanged, by
             `contactBlock` on «الخصوصية» و«الشروط» — a legal page has to
             carry it, and «من نحن» is not one. */''}
        ${socialRowHtml()}
      </div>
      <span class="muted fs-12 mt-16">${t('version')} ${APP_VERSION} · est. 2026</span>
    </div>`;
}

/** the same published address on every page that has to carry one */
function contactBlock(en) {
  /* No number means no line — never a `tel:` that rings nowhere. The same
     rule the directory already follows for a shop with no phone. */
  return `<p><a class="gold ltr" href="mailto:${esc(S.SUPPORT_EMAIL)}">${esc(S.SUPPORT_EMAIL)}</a>${
    S.SUPPORT_PHONE ? `<br><a class="gold ltr" href="tel:${esc(S.SUPPORT_PHONE.replace(/[^0-9+]/g, ''))}">${esc(S.SUPPORT_PHONE)}</a>` : ''}</p>
    <p>${en ? 'We answer complaints and content removal requests within two working days.'
            : 'نرد على الشكاوى وطلبات إزالة المحتوى خلال يومَي عمل.'}</p>`;
}

export function PrivacyScreen(root) {
  renderHeader({ simple: true, title: t('privacy') });
  const en = S.state.lang === 'en';
  root.innerHTML = `<div class="legal-body">
    <h2>${en ? '1. What we collect' : '1. البيانات التي نجمعها'}</h2>
    <p>${en ? 'Name, email address, mobile number (for verification), your listings and content, your location when you ask for distance-based results, and payment records processed by our payment provider.'
            : 'الاسم، البريد الإلكتروني، رقم الهاتف (للتحقق)، إعلاناتك ومحتواك، موقعك عند طلب نتائج مرتبة بالمسافة، وسجلات الدفع التي تُعالَج عبر مزوّد الدفع.'}</p>
    <h2>${en ? '2. Your location' : '2. موقعك'}</h2>
    <p>${en ? 'Your location is only requested at the moment you ask for something that needs it — sorting by what is nearest, filtering by distance, or setting your city. It is never requested when the app opens. The coordinates stay on your device, are used only to work out how far away a listing is, and are never sent to us or to anyone else. You can clear them at any time from the location sheet, and picking a city by hand needs no permission at all.'
            : 'لا نطلب موقعك إلا في اللحظة التي تطلب فيها شيئاً يحتاجه — الترتيب بالأقرب، أو الفلترة بالمسافة، أو تحديد مدينتك. ولا يُطلب أبداً عند فتح التطبيق. الإحداثيات تبقى على جهازك، وتُستعمل فقط لحساب بُعد النشاط عنك، ولا تُرسل إلينا ولا إلى أي جهة أخرى. يمكنك مسحها في أي وقت من نافذة الموقع، واختيار المدينة يدوياً لا يحتاج أي إذن.'}</p>
    <h2>${en ? '3. Why we collect it' : '3. سبب الجمع'}</h2>
    <p>${en ? 'To operate the directory and the marketplace, to verify real users, to prevent fraud and abuse, and to process paid placements and subscriptions.'
            : 'لتشغيل الدليل والسوق، والتحقق من أن المستخدمين حقيقيون، ومنع الاحتيال وسوء الاستخدام، ومعالجة الاشتراكات والإعلانات المدفوعة.'}</p>
    <h2>${en ? '4. Card data' : '4. بيانات البطاقة'}</h2>
    <p>${en ? 'We never store full card numbers. Payments are handled by a PCI-compliant provider.'
            : 'لا نخزّن أرقام البطاقات كاملة إطلاقاً. الدفع يتم عبر مزوّد متوافق مع معايير PCI.'}</p>
    <h2>${en ? '5. Automated message scanning' : '5. الفحص الآلي للرسائل'}</h2>
    <p>${t('legalScanBody')}</p>
    <h2>${en ? '6. Your rights' : '6. حقوقك'}</h2>
    <ul>
      <li>${en ? 'Request a copy of your data' : 'طلب نسخة من بياناتك'}</li>
      <li>${en ? 'Correct or delete your data (Settings → Delete account)' : 'تصحيح أو حذف بياناتك (الإعدادات ← حذف الحساب)'}</li>
      <li>${en ? 'Withdraw notification consent at any time' : 'إيقاف الإشعارات في أي وقت'}</li>
    </ul>
    <h2>${en ? '7. Age' : '7. العمر'}</h2>
    <p>${en ? 'ARABNA accounts require users to be 18 years or older.' : 'إنشاء حساب في عربنا يتطلب أن يكون عمرك 18 سنة أو أكثر.'}</p>
    <h2>${en ? '8. Contact' : '8. التواصل'}</h2>
    ${contactBlock(en)}
    <p class="muted fs-12">${en ? 'Draft v0.1 — must be reviewed by a lawyer before public launch.' : 'مسودة 0.1 — يجب مراجعتها من محامٍ قبل الإطلاق الرسمي.'}</p>
  </div>`;
}

export function TermsScreen(root) {
  renderHeader({ simple: true, title: t('terms') });
  const en = S.state.lang === 'en';
  root.innerHTML = `<div class="legal-body">
    <h2>${en ? '1. Accounts' : '1. الحسابات'}</h2>
    <p>${en ? 'You must be 18+ to create an account. Posting, messaging and advertising require a verified real mobile number; VOIP and landline numbers are not accepted.'
            : 'يجب أن يكون عمرك 18 سنة أو أكثر. النشر والتواصل والإعلان تتطلب رقم هاتف حقيقي مُتحقق منه؛ أرقام الإنترنت (VOIP) والأرقام الأرضية غير مقبولة.'}</p>
    <h2>${en ? '2. The Marketplace is for individuals' : '2. السوق للأفراد'}</h2>
    <p>${en ? 'The Marketplace is for person-to-person sales only, limited to 4 active listings per account, each expiring after 14 days. The Handyman & Services section allows one active listing for 14 days. The Free section is for items given away at no cost — listings that carry a price are removed or sent for review. Business advertising belongs in the Directory.'
            : 'السوق مخصص للبيع بين الأفراد فقط، بحد أقصى 4 إعلانات نشطة لكل حساب، وكل إعلان ينتهي بعد 14 يوماً. قسم خدمات وصيانة يسمح بإعلان واحد نشط لمدة 14 يوماً. قسم المجاني للأغراض التي تُعطى بلا مقابل، وأي إعلان يحمل سعراً يُحذف أو يُحال إلى الموافقة. الإعلانات التجارية مكانها الدليل.'}</p>
    <h2>${en ? '3. Contact stays in the app' : '3. التواصل داخل التطبيق'}</h2>
    <p>${t('legalScanBody')}</p>
    <h2>${en ? '4. Paid placements' : '4. الإعلانات المدفوعة'}</h2>
    <p>${en ? 'Paid ads and sponsored stories are reviewed before going live. ARABNA may decline content that is misleading, illegal or offensive; declined orders are refunded.'
            : 'الإعلانات المدفوعة والمقالات المدعومة تنتظر الموافقة قبل النشر. يحق لعربنا رفض أي محتوى مضلل أو مخالف أو مسيء، ويُرد المبلغ في هذه الحالة.'}</p>
    <h2>${en ? '5. Subscriptions' : '5. الاشتراكات'}</h2>
    <p>${en ? 'Business subscriptions renew monthly until cancelled. Cancelling stops future renewals; the current period is not prorated.'
            : 'اشتراك الأعمال يتجدد شهرياً حتى الإلغاء. الإلغاء يوقف التجديد القادم، ولا تُحتسب فترة جزئية للشهر الحالي.'}</p>
    <h2>${en ? '6. Content & conduct' : '6. المحتوى والسلوك'}</h2>
    <p>${en ? 'You are responsible for what you post. Fraud, harassment, illegal goods and impersonation are prohibited and result in removal and account suspension.'
            : 'أنت مسؤول عن كل ما تنشره. الاحتيال والتحرش والسلع غير القانونية وانتحال الشخصية ممنوعة وتؤدي إلى حذف المحتوى وإيقاف الحساب.'}</p>
    <h2>${en ? '7. Liability' : '7. المسؤولية'}</h2>
    <p>${en ? 'ARABNA is a listing platform and is not a party to transactions between users.'
            : 'عربنا منصة عرض ولا يُعد طرفاً في المعاملات التي تتم بين المستخدمين.'}</p>
    <h2>${en ? '8. Contact and content removal' : '8. التواصل وطلبات إزالة المحتوى'}</h2>
    ${contactBlock(en)}
    <p class="muted fs-12">${en ? 'Draft v0.1 — must be reviewed by a lawyer before public launch.' : 'مسودة 0.1 — يجب مراجعتها من محامٍ قبل الإطلاق الرسمي.'}</p>
  </div>`;
}
