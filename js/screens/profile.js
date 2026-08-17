/* ======================= PROFILE & ACCOUNT SCREENS ======================= */
import { t, L, icon, $, $$, go, renderHeader, toast, wireRoutes, emptyState, confirmSheet,
         fmtMoney, priceLabel, statusBadge, stars } from '../ui.js';
import { SUBSCRIPTION_PRICE } from '../data.js';
import * as S from '../store.js';
import { catIcon } from './home.js';
import { openReviewSheet } from './directory.js';
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
        <div class="avatar" style="width:66px;height:66px;font-size:24px">${icon('user', 31)}</div>
        <b style="font-size:18px;margin-top:10px">${t('guest')}</b>
        <span class="muted fs-13">${t('needAccountSub')}</span>
        <button class="btn btn-gold mt-16" data-route="#/auth/signup">${t('signUp')}</button>
        <button class="btn btn-ghost btn-sm mt-8" data-route="#/auth/signin">${t('haveAccount')}</button>
      </div>`;
    wireRoutes(root);
    return;
  }

  const avatarUrl = S.visibleAvatar();
  const joined = u.joined ? new Date(u.joined).toLocaleDateString(
    S.state.lang === 'en' ? 'en-US' : 'ar-EG', { month: 'long', year: 'numeric' }) : '—';

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="avatar" style="width:66px;height:66px;font-size:24px;overflow:hidden">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover" />`
                    : u.name[0].toUpperCase()}
      </div>
      <b style="font-size:18px;margin-top:10px">${u.name}
        ${S.hasBadge() ? `<span class="badge-check" title="${t('verifiedBadge')}">${icon('check', 12)}</span>` : ''}</b>
      <span class="badge ${S.tier() === 2 ? 'badge-verified' : 'badge-free'} mt-8">${tierLabel}</span>
      ${u.avatar && u.avatar.status === 'pending' ? `<span class="hint">${t('photoPendingReview')}</span>` : ''}
    </div>

    <div class="pad mt-16">
      <div class="info-row"><span class="i-ico">${icon('mail', 21)}</span>
        <div class="i-txt"><b class="ltr">${u.email}</b><span>${t('email')}</span></div></div>

      <div class="info-row"><span class="i-ico">${icon('phone', 21)}</span>
        <div class="i-txt">
          <b class="ltr">${u.phone || '—'}</b>
          <span>${u.phone
            ? (u.phoneVerified
                ? `<span class="ok-inline">${icon('check', 12)} ${t('verified')}</span>`
                : `<span style="color:#E79A9C">${t('phoneNotVerified')}</span>`)
            : t('phoneNumber')}</span>
        </div>
      </div>

      <div class="info-row"><span class="i-ico">${icon('calendar', 21)}</span>
        <div class="i-txt"><b>${joined}</b><span>${t('joinedOn')}</span></div></div>
    </div>

    ${!u.phoneVerified ? `
    <div class="pad mt-16">
      <div class="list-note">${icon('shield', 18)}
        <span>${t('verifyPhoneToPost')}</span>
        <button class="mini-btn gold" data-route="#/auth/phone" style="margin-inline-start:auto">${t('verifyBtn')}</button>
      </div>
    </div>` : ''}

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
        <div id="avHost"></div>
        <div class="hint">${t('photoOptional')} · ${t('photoPendingReview')}</div>
      </div>

      <div class="field"><label class="label">${t('fullName')}</label>
        <input class="input" id="pName" value="${attr(u.name)}" /></div>
      <div class="field"><label class="label">${t('email')}</label>
        <input class="input" id="pEmail" type="email" value="${attr(u.email)}" /></div>
      <div class="field"><label class="label">${t('phoneNumber')}</label>
        <input class="input" id="pPhone" inputmode="tel" value="${attr(u.phone || '')}" />
        <div class="hint">${u.phoneVerified ? t('verified') : t('phoneNotVerified')} — ${t('phoneChangedReverify')}</div></div>

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

  const pic = mountPhotoPicker($('#avHost'), u.avatar ? [u.avatar.url] : [], 0, 1);

  $('#pSave').addEventListener('click', () => {
    const name = $('#pName').value.trim();
    const email = $('#pEmail').value.trim();
    const phone = $('#pPhone').value.trim();
    if (!name || !email) { toast(t('required'), 'err'); return; }

    const phoneChanged = phone !== (u.phone || '');
    S.updateProfile({ name, email, phone });

    // photo: only re-queue it when it actually changed
    const newPhoto = pic.photos[0] || '';
    const hadPhoto = u.avatar ? u.avatar.url : '';
    if (newPhoto && newPhoto !== hadPhoto) S.setAvatar(newPhoto);
    else if (!newPhoto && hadPhoto) { S.state.user.avatar = null; S.save(); }

    if (!S.lastSaveOk) { toast(t('storageFull'), 'err'); return; }
    toast(phoneChanged ? t('phoneChangedReverify') : t('profileSaved'), phoneChanged ? 'err' : 'ok');
    go(phoneChanged ? '#/auth/phone' : '#/profile');
  });

  const bb = $('#badgeBtn');
  if (bb) bb.addEventListener('click', async () => {
    if (!S.requireTier(2, '#/profile/edit', go)) return;
    if (S.VERIFY_BADGE_PRICE > 0) {
      bb.innerHTML = `<span class="spinner"></span>`;
      await S.chargeCard(S.VERIFY_BADGE_PRICE, 'ARABNA verification badge');
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
      ${passwordField('cpConf', t('confirmPassword'))}
      <div id="cpErr"></div>
      <button class="btn btn-gold btn-block mt-8" id="cpSave">${icon('lock', 19)} ${t('changePassword')}</button>
    </div>`;

  wirePasswordToggles(root);

  $('#cpSave').addEventListener('click', () => {
    const cur = $('#cpCur').value;
    const next = $('#cpNew').value;
    const conf = $('#cpConf').value;
    const err = $('#cpErr');
    err.innerHTML = '';

    if (next.length < 6) { err.innerHTML = errMsg(t('passwordTooShort')); return; }
    if (next !== conf) { err.innerHTML = errMsg(t('passwordsDontMatch')); return; }

    const res = S.changePassword(cur, next);
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
      <input class="input" id="${id}" type="password" autocomplete="off" />
      <button type="button" class="pass-eye" data-eye="${id}" aria-label="${t('showPassword')}">${icon('eye', 19)}</button>
    </div></div>`;
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

function attr(s) {
  return String(s == null ? '' : s)
    .replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    .replace(/"/g, '&quot;');
}


/** Personal screens are for account holders only. If the session ended while
    one was open, send the user to the step they are missing instead of
    painting an empty list — and resume them here afterwards. */
function memberOnly(hash) { return S.requireTier(1, hash, go); }

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
            <div class="row-main"><div class="row-title">${L(b.name)}</div>
              <div class="row-sub">${icon('mapPin', 13)} <span class="ltr">${b.address}</span></div></div></div>`).join('')}
        ${cls.map(c => `<div class="list-row" data-route="#/marketplace/${c.id}">
            <span class="row-ico">${icon(c.icon || 'image', 24)}</span>
            <div class="row-main"><div class="row-title">${L(c.title)}</div>
              <div class="row-sub gold"><span class="ltr">${priceLabel(c.price)}</span></div></div></div>`).join('')}
      </div>`;
  wireRoutes(root);
}

/* ------------------------------ MY ADS ------------------------------ */
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
            ? `<img src="${c.photos[c.mainPhoto || 0] || c.photos[0]}" style="width:100%;height:100%;object-fit:cover" alt="" />`
            : icon(c.icon || 'image', 24)}</span>
          <div class="row-main">
            <div class="row-title">${L(c.title)} ${c.boosted ? `<span class="badge badge-boost">${t('boosted')}</span>` : ''} ${statusBadge(c, true)}</div>
            <div class="row-sub gold"><span class="ltr">${priceLabel(c.price)}</span> · ${t('expiresIn')} ${c.daysLeft} ${t('days')}</div>
            <div class="row-actions">
              <button class="mini-btn gold" data-route="#/boost/${c.id}">${icon('bolt', 15)} ${t('boost')}</button>
              <button class="mini-btn" data-route="#/post?edit=${c.id}">${icon('edit', 15)} ${t('edit')}</button>
              <button class="mini-btn" data-renew="${c.id}">${icon('refresh', 15)} ${t('renew')}</button>
              <button class="mini-btn" data-del="${c.id}">${icon('trash', 15)}</button>
              <button class="mini-btn" data-route="#/marketplace/${c.id}">${icon('eye', 15)}</button>
            </div>
          </div>
        </div>`).join('') : emptyState('bag', t('emptyMyAdsTitle'), t('emptyMyAdsSub'), t('post'), '#/post')}

      ${orders.length ? `
        <div class="section-head" style="padding:0;margin:20px 0 10px"><div class="section-title">${t('advertiseWithUs')}</div></div>
        ${orders.map(o => `
          <div class="list-row">
            <span class="row-ico">${icon('megaphone', 24)}</span>
            <div class="row-main">
              <div class="row-title">${o.bizName}
                <span class="badge ${o.status === 'live' ? 'badge-verified' : 'badge-pending'}">${o.status === 'live' ? t('statusLive') : t('statusPending')}</span></div>
              <div class="row-sub">${t(o.product === 'slider' ? 'prodSlider' : o.product === 'mini' ? 'prodMini' : 'prodStory')} · ${fmtMoney(o.price)}</div>
            </div>
          </div>`).join('')}` : ''}
    </div>`;

  $$('[data-renew]').forEach(b => b.addEventListener('click', () => {
    S.renewClassified(b.dataset.renew); toast(t('renewed'), 'ok'); go('#/my-ads');
  }));
  $$('[data-del]').forEach(b => b.addEventListener('click', () => {
    const c = S.classifiedById(b.dataset.del);
    confirmSheet({
      title: t('delete'), sub: c ? L(c.title) : '', confirmText: t('delete'), danger: true,
      onConfirm: () => { S.deleteClassified(b.dataset.del); toast(t('done'), 'ok'); go('#/my-ads'); }
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
          <div class="row-between">
            <div><b class="fs-13">${b ? L(b.name) : r.bizId}</b>
              <div class="fs-12 muted">${L(r.when)} · ${stars(r.rating)}</div></div>
            <button class="mini-btn" data-route="#/directory/${r.bizId}">${icon('eye', 15)}</button>
          </div>
          <p class="fs-13 mt-8" style="margin:8px 0 0">${L(r.text)}</p>
          <div class="row-actions mt-8">
            <button class="mini-btn gold" data-edit="${r.bizId}">${icon('edit', 15)} ${t('editReview')}</button>
            <button class="mini-btn" data-del="${r.id}">${icon('trash', 15)} ${t('delete')}</button>
          </div>
        </div>`;
      }).join('')}</div>`
    : emptyState('star', t('emptyRevTitle'), t('emptyRevSub'), t('directoryTitle'), '#/directory');

  $$('[data-edit]').forEach(b => b.addEventListener('click', () =>
    openReviewSheet(b.dataset.edit, () => go('#/my-reviews'))));
  $$('[data-del]').forEach(b => b.addEventListener('click', () => confirmSheet({
    title: t('delete'), sub: t('myReviews'), confirmText: t('delete'), danger: true,
    onConfirm: () => { S.deleteReview(b.dataset.del); toast(t('reviewDeleted'), 'ok'); go('#/my-reviews'); }
  })));
  wireRoutes(root);
}

/* --------------------------- MY BUSINESS --------------------------- */
export function MyBusinessScreen(root) {
  if (!memberOnly('#/my-business')) return;
  renderHeader({ simple: true, title: t('myBusiness') });
  const b = S.state.myBusinessId ? S.businessById(S.state.myBusinessId) : null;

  root.innerHTML = !b
    ? `${emptyState('briefcase', t('emptyBizTitle'), t('emptyBizSub'), t('addBusiness'), '#/add-business')}
       <div class="pad"><button class="btn btn-ghost btn-block" data-route="#/claim">${t('claimBusiness')}</button></div>`
    : `<div class="pad mt-16">
        <div class="list-row premium" data-route="#/directory/${b.id}">
          <span class="row-ico">${icon(catIcon(b.cat), 22)}</span>
          <div class="row-main">
            <div class="row-title">${L(b.name)}
              <span class="badge ${S.businessPlan(b) === 'paid' ? 'badge-verified' : 'badge-free'}">${S.businessPlan(b) === 'paid' ? t('verified') : t('free')}</span></div>
            <div class="row-sub">${icon('mapPin', 13)} <span class="ltr">${b.address}</span></div>
          </div>
        </div>
        ${S.businessPlan(b) === 'paid'
          ? `<div class="ok-msg" style="text-align:center">${t('subActive')}</div>
             <button class="btn btn-ghost btn-block mt-12" data-route="#/subscribe/${b.id}">${t('subscription')}</button>`
          : `<div class="upsell" style="margin:14px 0">
               <div class="upsell-txt"><b>${t('upgradeBanner')}</b><span>${fmtMoney(SUBSCRIPTION_PRICE)} ${t('month')}</span></div>
               <button class="btn btn-gold btn-sm" data-route="#/subscribe/${b.id}">${t('upgradeBtn')}</button>
             </div>`}
        <button class="btn btn-ghost btn-block mt-8" data-route="#/advertise">${icon('megaphone', 19)} ${t('advertiseWithUs')}</button>
      </div>`;
  wireRoutes(root);
}

/* ------------------------------ SETTINGS ------------------------------ */
export function SettingsScreen(root) {
  if (!memberOnly('#/settings')) return;
  renderHeader({ simple: true, title: t('settings') });
  const p = S.state.notifPrefs;

  root.innerHTML = `
    <div class="mt-12">
      <div class="dr-group-label">${t('language')}</div>
      <div class="setting-row"><span class="s-txt"><b>${t('language')}</b><span>العربية / English</span></span>
        <button class="lang-pill" id="langBtn">${S.state.lang === 'ar' ? 'العربية' : 'English'}</button></div>

      <div class="dr-group-label">${t('notifPrefs')}</div>
      ${sw('messages', t('notifMessages'), p.messages)}
      ${sw('expiry', t('notifExpiry'), p.expiry)}
      ${sw('adLive', t('notifAdLive'), p.adLive)}
      ${sw('reviews', t('notifReviews'), p.reviews)}

      <div class="dr-group-label">${t('paymentMethods')}</div>
      <div class="setting-row"><span class="s-txt"><b>${S.state.cardOnFile || t('noPayment')}</b><span>Stripe</span></span>
        <button class="mini-btn gold" id="addCard">${icon('plus', 15)}</button></div>

      <div class="dr-group-label">${t('subscription')}</div>
      <div class="setting-row"><span class="s-txt"><b>${S.state.subscription ? t('subActive') : t('subTitle')}</b><span>${fmtMoney(SUBSCRIPTION_PRICE)} ${t('month')}</span></span>
        <button class="mini-btn" data-route="#/subscribe">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</button></div>

      <div class="dr-group-label">${t('deleteAccount')}</div>
      <div class="setting-row" style="border:none">
        <span class="s-txt"><b>${t('deleteAccount')}</b><span>${t('deleteAccountSub')}</span></span>
        <button class="mini-btn" id="delAcc" style="color:#E79A9C">${icon('trash', 15)}</button>
      </div>
      <div style="height:20px"></div>
    </div>`;

  $$('.switch').forEach(s => s.addEventListener('click', () => {
    const k = s.dataset.k;
    S.state.notifPrefs[k] = !S.state.notifPrefs[k];
    S.save();
    s.classList.toggle('on', S.state.notifPrefs[k]);
  }));
  $('#langBtn').addEventListener('click', () => import('../ui.js').then(m => m.toggleLang()));
  $('#addCard').addEventListener('click', () => { S.state.cardOnFile = 'VISA •••• 4242'; S.save(); toast(t('done'), 'ok'); go('#/settings'); });
  $('#delAcc').addEventListener('click', () => confirmSheet({
    title: t('deleteAccount'), sub: t('deleteAccountSub'), confirmText: t('delete'), danger: true,
    onConfirm: () => { S.signOut(); toast(t('deleteConfirm'), 'ok'); go('#/home'); }
  }));
  wireRoutes(root);
}
function sw(key, label, on) {
  return `<div class="setting-row"><span class="s-txt"><b>${label}</b></span>
    <button class="switch ${on ? 'on' : ''}" data-k="${key}"></button></div>`;
}

/* --------------------------- NOTIFICATIONS --------------------------- */
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
      <div class="notif-txt"><b>${L(n.title)}</b><span>${L(n.body)}</span>
        <div class="fs-12 muted mt-8">${L(n.when)}</div></div>
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
export function HelpScreen(root) {
  renderHeader({ simple: true, title: t('help') });
  root.innerHTML = `
    <div class="legal-body">
      <h2>${t('help')}</h2>
      <p>${S.state.lang === 'en'
        ? 'Questions, problems or business inquiries — reach the ARABNA team any time.'
        : 'أي سؤال أو مشكلة أو استفسار عن الإعلانات — تواصل مع فريق عربنا بأي وقت.'}</p>
      <div class="info-row"><span class="i-ico">${icon('mail', 21)}</span><div class="i-txt"><b>support@arabna.app</b><span>Email</span></div></div>
      <div class="info-row"><span class="i-ico">${icon('phone', 21)}</span><div class="i-txt"><b>(713) 555-0100</b><span>${t('phoneLabel')}</span></div></div>
    </div>`;
}

export function AboutScreen(root) {
  renderHeader({ simple: true, title: t('about') });
  root.innerHTML = `
    <div class="pad mt-20 center-col">
      <img src="assets/logo.png" style="max-width:230px" alt="ARABNA عربنا" />
      <p class="fs-13 muted mt-16" style="max-width:300px;text-align:center">
        ${S.state.lang === 'en'
          ? 'ARABNA brings the Arab community in America together in one app: a business directory, a marketplace, and a community magazine.'
          : 'عربنا يجمع الجالية العربية في أمريكا بتطبيق واحد: دليل أعمال، ماركت بليس، ومجلة للمجتمع.'}
      </p>
      <span class="muted fs-12 mt-16">${t('version')} 0.1 · est. 2026</span>
    </div>`;
}

export function PrivacyScreen(root) {
  renderHeader({ simple: true, title: t('privacy') });
  const en = S.state.lang === 'en';
  root.innerHTML = `<div class="legal-body">
    <h2>${en ? '1. What we collect' : '١. البيانات التي نجمعها'}</h2>
    <p>${en ? 'Name, email address, mobile number (for verification), your listings and content, approximate location when you use radius search, and payment records processed by our payment provider.'
            : 'الاسم، البريد الإلكتروني، رقم الجوال (للتحقق)، إعلاناتك ومحتواك، موقعك التقريبي عند استخدام البحث بالنطاق، وسجلات الدفع التي تُعالَج عبر مزوّد الدفع.'}</p>
    <h2>${en ? '2. Why we collect it' : '٢. سبب الجمع'}</h2>
    <p>${en ? 'To operate the directory and the marketplace, to verify real users, to prevent fraud and abuse, and to process paid placements and subscriptions.'
            : 'لتشغيل الدليل والماركت بليس، والتحقق من أن المستخدمين حقيقيون، ومنع الاحتيال وسوء الاستخدام، ومعالجة الاشتراكات والإعلانات المدفوعة.'}</p>
    <h2>${en ? '3. Card data' : '٣. بيانات البطاقة'}</h2>
    <p>${en ? 'We never store full card numbers. Payments are handled by a PCI-compliant provider.'
            : 'لا نخزّن أرقام البطاقات كاملة إطلاقاً. الدفع يتم عبر مزوّد متوافق مع معايير PCI.'}</p>
    <h2>${en ? '4. Automated message scanning' : '٤. الفحص الآلي للرسائل'}</h2>
    <p>${t('legalScanBody')}</p>
    <h2>${en ? '5. Your rights' : '٥. حقوقك'}</h2>
    <ul>
      <li>${en ? 'Request a copy of your data' : 'طلب نسخة من بياناتك'}</li>
      <li>${en ? 'Correct or delete your data (Settings → Delete account)' : 'تصحيح أو حذف بياناتك (الإعدادات ← حذف الحساب)'}</li>
      <li>${en ? 'Withdraw notification consent at any time' : 'إيقاف الإشعارات في أي وقت'}</li>
    </ul>
    <h2>${en ? '6. Age' : '٦. العمر'}</h2>
    <p>${en ? 'ARABNA accounts require users to be 18 years or older.' : 'إنشاء حساب في عربنا يتطلب أن يكون عمرك ١٨ سنة أو أكثر.'}</p>
    <h2>${en ? '7. Contact' : '٧. التواصل'}</h2>
    <p>privacy@arabna.app</p>
    <p class="muted fs-12">${en ? 'Draft v0.1 — must be reviewed by a lawyer before public launch.' : 'مسودة ٠.١ — يجب مراجعتها من محامٍ قبل الإطلاق الرسمي.'}</p>
  </div>`;
}

export function TermsScreen(root) {
  renderHeader({ simple: true, title: t('terms') });
  const en = S.state.lang === 'en';
  root.innerHTML = `<div class="legal-body">
    <h2>${en ? '1. Accounts' : '١. الحسابات'}</h2>
    <p>${en ? 'You must be 18+ to create an account. Posting, messaging and advertising require a verified real mobile number; VOIP and landline numbers are not accepted.'
            : 'يجب أن يكون عمرك ١٨ سنة أو أكثر. النشر والتواصل والإعلان تتطلب رقم جوال حقيقي مُتحقق منه؛ أرقام الإنترنت (VOIP) والأرقام الأرضية غير مقبولة.'}</p>
    <h2>${en ? '2. The Marketplace is for individuals' : '٢. الماركت بليس للأفراد'}</h2>
    <p>${en ? 'The Marketplace is for person-to-person sales only, limited to 5 active listings per account, each expiring after 30 days. The Handyman & Services section allows one active listing for 14 days. The Free section is for items given away at no cost — listings that carry a price are removed or sent for review. Business advertising belongs in the Directory.'
            : 'الماركت بليس مخصص للبيع بين الأفراد فقط، بحد أقصى ٥ إعلانات نشطة لكل حساب، وكل إعلان ينتهي بعد ٣٠ يوماً. قسم الهاندي مان والخدمات يسمح بإعلان واحد نشط لمدة ١٤ يوماً. قسم المجاني للأغراض التي تُعطى بلا مقابل، وأي إعلان يحمل سعراً يُحذف أو يُحال للمراجعة. الإعلانات التجارية مكانها الدليل.'}</p>
    <h2>${en ? '3. Contact stays in the app' : '٣. التواصل داخل التطبيق'}</h2>
    <p>${t('legalScanBody')}</p>
    <h2>${en ? '4. Paid placements' : '٤. الإعلانات المدفوعة'}</h2>
    <p>${en ? 'Paid ads and sponsored stories are reviewed before going live. ARABNA may decline content that is misleading, illegal or offensive; declined orders are refunded.'
            : 'الإعلانات المدفوعة والمقالات المدعومة تُراجَع قبل النشر. يحق لعربنا رفض أي محتوى مضلل أو مخالف أو مسيء، ويُرد المبلغ في هذه الحالة.'}</p>
    <h2>${en ? '5. Subscriptions' : '٥. الاشتراكات'}</h2>
    <p>${en ? 'Business subscriptions renew monthly until cancelled. Cancelling stops future renewals; the current period is not prorated.'
            : 'اشتراك الأعمال يتجدد شهرياً حتى الإلغاء. الإلغاء يوقف التجديد القادم، ولا تُحتسب فترة جزئية للشهر الحالي.'}</p>
    <h2>${en ? '6. Content & conduct' : '٦. المحتوى والسلوك'}</h2>
    <p>${en ? 'You are responsible for what you post. Fraud, harassment, illegal goods and impersonation are prohibited and result in removal and account suspension.'
            : 'أنت مسؤول عن كل ما تنشره. الاحتيال والتحرش والسلع غير القانونية وانتحال الشخصية ممنوعة وتؤدي إلى حذف المحتوى وإيقاف الحساب.'}</p>
    <h2>${en ? '7. Liability' : '٧. المسؤولية'}</h2>
    <p>${en ? 'ARABNA is a listing platform and is not a party to transactions between users.'
            : 'عربنا منصة عرض ولا يُعد طرفاً في المعاملات التي تتم بين المستخدمين.'}</p>
    <p class="muted fs-12">${en ? 'Draft v0.1 — must be reviewed by a lawyer before public launch.' : 'مسودة ٠.١ — يجب مراجعتها من محامٍ قبل الإطلاق الرسمي.'}</p>
  </div>`;
}
