/* ======================= PROFILE & ACCOUNT SCREENS ======================= */
import { t, L, icon, $, $$, go, renderHeader, toast, wireRoutes, emptyState, confirmSheet,
         openSheet, closeSheet,
         fmtMoney, priceLabel, statusBadge, stars, logoSrc } from '../ui.js';
import { SUBSCRIPTION_PRICE, CATEGORIES } from '../data.js';
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
    S.state.lang === 'en' ? 'en-US' : 'ar-EG-u-nu-latn', { month: 'long', year: 'numeric' }) : '—';

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
                : `<span class="ink-danger">${t('phoneNotVerified')}</span>`)
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
      <b>${o.bizName}</b>
      <span class="badge ${o.status === 'live' ? 'badge-verified' : o.status === 'rejected' ? 'badge-pending' : 'badge-pending'}">${
        o.status === 'live' ? t('statusLive') : o.status === 'rejected' ? t('statusRejected') : t('statusPending')}</span>
    </div>
    <div class="row-sub">${p ? t(p.nameKey) : o.product}${o.cat ? ' · ' + t(catKeyFor(o.cat)) : ''} · <span class="ltr">${fmtMoney(o.price)}</span></div>
    ${left !== null ? `<div class="row-sub ${ending ? 'gold' : ''}">${t('adEndsOn')}: ${fmtDate(o.endsAt)} · ${t('adDaysLeft').replace('{n}', left)}</div>` : ''}
    ${o.reason ? `<div class="err-msg">${icon('alert', 15)} ${o.reason}</div>` : ''}

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
        ${orders.map(o => adOrderCard(o)).join('')}` : ''}
    </div>`;

  $$('[data-adrenew]').forEach(b => b.addEventListener('click', () => {
    S.renewAd(b.dataset.adrenew); toast(t('adRenewed'), 'ok'); go('#/my-ads');
  }));
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
          <span>${t('bizStatsLine').replace('{n}', st.cur.views)}</span></div>`
      : `<div class="hint" style="margin-top:10px">${t('bizStatsEmpty')}</div>`}`;
}

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
              ${S.businessVerified(b) ? `<span class="badge badge-bizverified">${icon('checkCircle', 12)}${t('bizVerified')}</span>` : ''}</div>
            <div class="row-sub">${icon('mapPin', 13)} <span class="ltr">${b.address}</span></div>
          </div>
        </div>
        ${S.businessPlan(b) === 'paid'
          ? `<div class="ok-msg" style="text-align:center">${t('subActive')}</div>
             ${bizStatsBlock(b)}
             <button class="btn btn-ghost btn-block mt-12" data-route="#/my-subscription">${t('mySubscription')}</button>`
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

      <div class="dr-group-label">${t('notifPrefs')}</div>
      ${sw('messages', t('notifMessages'), p.messages)}
      ${sw('expiry', t('notifExpiry'), p.expiry)}
      ${sw('adLive', t('notifAdLive'), p.adLive)}
      ${sw('reviews', t('notifReviews'), p.reviews)}

      <div class="dr-group-label">${t('paymentMethods')}</div>
      <div class="setting-row"><span class="s-txt"><b>${S.state.cardOnFile || t('noPayment')}</b><span>Stripe</span></span>
        <button class="mini-btn gold" id="addCard">${icon('plus', 15)}</button></div>

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
          <button class="mini-btn" data-route="${sub ? '#/my-subscription' : '#/subscribe'}">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</button></div>`;
      })()}

      <div class="dr-group-label">${t('blockedTitle')}</div>
      <div class="setting-row">
        <span class="s-txt"><b>${t('blockedTitle')}</b><span>${S.blockedList().length
          ? S.blockedList().length : t('blockedNone')}</span></span>
        <button class="mini-btn" data-route="#/blocked">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</button>
      </div>

      <div class="dr-group-label">${t('deleteAccount')}</div>
      <div class="setting-row" style="border:none">
        <span class="s-txt"><b>${t('deleteAccount')}</b><span>${t('deleteAccountSub')}</span></span>
        <button class="mini-btn ink-danger" id="delAcc">${icon('trash', 15)}</button>
      </div>
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

  $$('.switch').forEach(s => s.addEventListener('click', () => {
    const k = s.dataset.k;
    S.state.notifPrefs[k] = !S.state.notifPrefs[k];
    S.save();
    s.classList.toggle('on', S.state.notifPrefs[k]);
  }));
  $('#langBtn').addEventListener('click', () => import('../ui.js').then(m => m.toggleLang()));
  $('#addCard').addEventListener('click', () => { S.state.cardOnFile = 'VISA •••• 4242'; S.save(); toast(t('done'), 'ok'); go('#/settings'); });
  /* Deletion says what it takes with it and then actually takes it —
     signing out and calling it deleted would be a lie the stores ask
     about directly. */
  $('#delAcc').addEventListener('click', () => {
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
      <button class="btn btn-danger btn-block mt-12" id="delGo">${t('delete')}</button>
      <button class="btn btn-plain btn-block mt-8" id="delNo">${t('cancel')}</button>
    `, (panel) => {
      panel.querySelector('#delGo').addEventListener('click', () => {
        S.deleteAccount();
        closeSheet();
        toast(t('deleteConfirm'), 'ok');
        go('#/home');
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
/**
 * The questions first, the way to reach a human second — most people who
 * open Help have one of ten questions, and reading an answer beats waiting
 * for a reply. One panel open at a time, the same idiom as the drawer.
 * The phone is gone from this screen on purpose; it is still published in
 * About and in both legal pages, where the app stores expect to find it.
 */
export function HelpScreen(root) {
  renderHeader({ simple: true, title: t('help') });
  const N = 10;
  root.innerHTML = `
    <div class="pad mt-16">
      <div class="section-title">${t('faqTitle')}</div>
      <div class="faq" id="faq">
        ${Array.from({ length: N }, (_, i) => i + 1).map(n => `
          <div class="faq-item" data-q="${n}">
            <button class="faq-head" aria-expanded="false" data-toggle="${n}">
              <span>${t('faqQ' + n)}</span>${icon('chevronD', 19, 'faq-arrow')}
            </button>
            <div class="faq-body"><div class="faq-body-inner"><p>${t('faqA' + n)}</p></div></div>
          </div>`).join('')}
      </div>
      <div class="hint" style="margin-top:10px">${t('faqNote')}</div>
    </div>

    <div class="legal-body">
      <h2>${t('contactUsTitle')}</h2>
      <p>${S.state.lang === 'en'
        ? 'Anything the answers above do not cover — write to the ARABNA team any time.'
        : 'أي شيء لا تغطّيه الإجابات أعلاه — راسل فريق عربنا في أي وقت.'}</p>
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
          <span class="s-txt"><b>${b.label}</b><span>${fmtDate(b.when)}</span></span>
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
      <p class="fs-13 muted mt-16" style="max-width:300px;text-align:center">
        ${S.state.lang === 'en'
          ? 'ARABNA brings the Arab community in America together in one app: a business directory, a marketplace, and a community magazine.'
          : 'عربنا يجمع الجالية العربية في أمريكا بتطبيق واحد: دليل أعمال، ماركت بليس، ومجلة للمجتمع.'}
      </p>
      <div class="contact-box mt-20">
        <div class="cb-title">${t('contactUsTitle')}</div>
        <div class="hint" style="margin-bottom:8px">${t('contactUsSub')}</div>
        <a class="contact-line" href="mailto:${S.SUPPORT_EMAIL}">${icon('mail', 18)}<span class="ltr">${S.SUPPORT_EMAIL}</span></a>
        <a class="contact-line" href="tel:${S.SUPPORT_PHONE.replace(/[^0-9+]/g, '')}">${icon('phone', 18)}<span class="ltr">${S.SUPPORT_PHONE}</span></a>
      </div>
      <span class="muted fs-12 mt-16">${t('version')} 0.1 · est. 2026</span>
    </div>`;
}

/** the same published address on every page that has to carry one */
function contactBlock(en) {
  return `<p><a class="gold ltr" href="mailto:${S.SUPPORT_EMAIL}">${S.SUPPORT_EMAIL}</a><br>
    <a class="gold ltr" href="tel:${S.SUPPORT_PHONE.replace(/[^0-9+]/g, '')}">${S.SUPPORT_PHONE}</a></p>
    <p>${en ? 'We answer complaints and content removal requests within two working days.'
            : 'نرد على الشكاوى وطلبات إزالة المحتوى خلال يومَي عمل.'}</p>`;
}

export function PrivacyScreen(root) {
  renderHeader({ simple: true, title: t('privacy') });
  const en = S.state.lang === 'en';
  root.innerHTML = `<div class="legal-body">
    <h2>${en ? '1. What we collect' : '1. البيانات التي نجمعها'}</h2>
    <p>${en ? 'Name, email address, mobile number (for verification), your listings and content, your location when you ask for distance-based results, and payment records processed by our payment provider.'
            : 'الاسم، البريد الإلكتروني، رقم الجوال (للتحقق)، إعلاناتك ومحتواك، موقعك عند طلب نتائج مرتبة بالمسافة، وسجلات الدفع التي تُعالَج عبر مزوّد الدفع.'}</p>
    <h2>${en ? '2. Your location' : '2. موقعك'}</h2>
    <p>${en ? 'Your location is only requested at the moment you ask for something that needs it — sorting by what is nearest, filtering by distance, or setting your city. It is never requested when the app opens. The coordinates stay on your device, are used only to work out how far away a listing is, and are never sent to us or to anyone else. You can clear them at any time from the location sheet, and picking a city by hand needs no permission at all.'
            : 'لا نطلب موقعك إلا في اللحظة التي تطلب فيها شيئاً يحتاجه — الترتيب بالأقرب، أو الفلترة بالمسافة، أو تحديد مدينتك. ولا يُطلب أبداً عند فتح التطبيق. الإحداثيات تبقى على جهازك، وتُستعمل فقط لحساب بُعد النشاط عنك، ولا تُرسل إلينا ولا إلى أي جهة أخرى. تقدر تمسحها في أي وقت من نافذة الموقع، واختيار المدينة يدوياً لا يحتاج أي إذن.'}</p>
    <h2>${en ? '3. Why we collect it' : '3. سبب الجمع'}</h2>
    <p>${en ? 'To operate the directory and the marketplace, to verify real users, to prevent fraud and abuse, and to process paid placements and subscriptions.'
            : 'لتشغيل الدليل والماركت بليس، والتحقق من أن المستخدمين حقيقيون، ومنع الاحتيال وسوء الاستخدام، ومعالجة الاشتراكات والإعلانات المدفوعة.'}</p>
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
            : 'يجب أن يكون عمرك 18 سنة أو أكثر. النشر والتواصل والإعلان تتطلب رقم جوال حقيقي مُتحقق منه؛ أرقام الإنترنت (VOIP) والأرقام الأرضية غير مقبولة.'}</p>
    <h2>${en ? '2. The Marketplace is for individuals' : '2. الماركت بليس للأفراد'}</h2>
    <p>${en ? 'The Marketplace is for person-to-person sales only, limited to 5 active listings per account, each expiring after 30 days. The Handyman & Services section allows one active listing for 14 days. The Free section is for items given away at no cost — listings that carry a price are removed or sent for review. Business advertising belongs in the Directory.'
            : 'الماركت بليس مخصص للبيع بين الأفراد فقط، بحد أقصى 5 إعلانات نشطة لكل حساب، وكل إعلان ينتهي بعد 30 يوماً. قسم الهاندي مان والخدمات يسمح بإعلان واحد نشط لمدة 14 يوماً. قسم المجاني للأغراض التي تُعطى بلا مقابل، وأي إعلان يحمل سعراً يُحذف أو يُحال للمراجعة. الإعلانات التجارية مكانها الدليل.'}</p>
    <h2>${en ? '3. Contact stays in the app' : '3. التواصل داخل التطبيق'}</h2>
    <p>${t('legalScanBody')}</p>
    <h2>${en ? '4. Paid placements' : '4. الإعلانات المدفوعة'}</h2>
    <p>${en ? 'Paid ads and sponsored stories are reviewed before going live. ARABNA may decline content that is misleading, illegal or offensive; declined orders are refunded.'
            : 'الإعلانات المدفوعة والمقالات المدعومة تُراجَع قبل النشر. يحق لعربنا رفض أي محتوى مضلل أو مخالف أو مسيء، ويُرد المبلغ في هذه الحالة.'}</p>
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
