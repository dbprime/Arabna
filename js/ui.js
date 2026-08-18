/* ============================================================
   Shared UI primitives: toast, bottom sheet, drawer, header, nav
   ============================================================ */

import { icon, iconFilled } from './icons.js';
import { t, L, getLang, setLang } from './i18n.js';
import { FREE_PRICE } from './data.js';
import * as S from './store.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
export function back() {
  if (history.length > 1) history.back(); else go('#/home');
}

/* ---------------- toast ---------------- */
export function toast(msg, kind = '') {
  const root = $('#toast');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = (kind === 'ok' ? icon('checkCircle', 19) : kind === 'err' ? icon('alert', 19) : icon('info', 19)) + `<span>${msg}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; }, 2400);
  setTimeout(() => el.remove(), 2750);
}

/* ---------------- bottom sheet ---------------- */
let sheetOnClose = null;
let sheetSeq = 0;
export function openSheet(html, onMount, onClose) {
  sheetSeq++;
  const root = $('#sheet');
  root.innerHTML = `<div class="sheet-scrim" data-close></div>
    <div class="sheet-panel"><div class="sheet-grip"></div>${html}</div>`;
  root.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => root.classList.add('open'));
  sheetOnClose = onClose || null;
  root.querySelector('[data-close]').addEventListener('click', closeSheet);
  if (onMount) onMount(root.querySelector('.sheet-panel'));
}
export function closeSheet() {
  const root = $('#sheet');
  root.classList.remove('open');
  root.setAttribute('aria-hidden', 'true');
  const seq = sheetSeq;
  setTimeout(() => { if (seq === sheetSeq) root.innerHTML = ''; }, 320);
  if (sheetOnClose) { const f = sheetOnClose; sheetOnClose = null; f(); }
}

export function confirmSheet({ title, sub, confirmText, danger, onConfirm }) {
  openSheet(`
    <div class="sheet-title">${title}</div>
    <div class="sheet-sub">${sub || ''}</div>
    <button class="btn ${danger ? 'btn-danger' : 'btn-gold'} btn-block" id="cfmYes">${confirmText || t('confirm')}</button>
    <button class="btn btn-ghost btn-block mt-8" data-close>${t('cancel')}</button>
  `, (panel) => {
    panel.querySelector('#cfmYes').addEventListener('click', () => { closeSheet(); onConfirm && onConfirm(); });
    panel.querySelector('[data-close]').addEventListener('click', closeSheet);
  });
}

/* ---------------- header ---------------- */
export function renderHeader(opts = {}) {
  const head = $('#appHeader');
  if (opts.hidden) { head.style.display = 'none'; return; }
  head.style.display = 'flex';

  if (opts.simple) {
    // back + title only — language moved into the drawer
    head.innerHTML = `
      <button class="icon-btn" id="hBack" aria-label="${t('back')}">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 24)}</button>
      <div class="h-title">${opts.title || ''}</div>
      <span class="h-spacer" aria-hidden="true"></span>`;
    $('#hBack').addEventListener('click', () => opts.onBack ? opts.onBack() : back());
  } else {
    // menu + logo only. The spacer opposite the menu button keeps the logo
    // optically centred instead of crowded against a stack of icons.
    head.innerHTML = `
      <button class="icon-btn" id="hMenu" aria-label="menu">${icon('menu', 24)}${S.isMember() && S.unreadCount() ? '<span class="dot"></span>' : ''}</button>
      <img class="h-logo" src="assets/logo-sm.png" alt="ARABNA عربنا" />
      <span class="h-spacer" aria-hidden="true"></span>`;
    $('#hMenu').addEventListener('click', openDrawer);
  }
}

export function toggleLang() {
  const next = getLang() === 'ar' ? 'en' : 'ar';
  setLang(next);
  S.state.lang = next;
  S.save();
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/* ---------------- bottom nav ---------------- */
export function renderNav(active) {
  const nav = $('#bottomNav');
  const items = [
    { id: 'home',        label: t('navHome'),    ico: 'home',    route: '#/home' },
    { id: 'directory',   label: t('navExplore'), ico: 'compass', route: '#/directory' },
    { id: 'post',        label: '',              ico: 'plus',    route: '#/post', center: true },
    { id: 'classifieds', label: t('navMarket'),  ico: 'bag',     route: '#/marketplace' },
    { id: 'profile',     label: t('navProfile'), ico: 'user',    route: '#/profile' },
  ];
  nav.innerHTML = items.map(i => i.center
    ? `<button class="nav-item" data-route="${i.route}"><span class="nav-post">${icon('plus', 28)}</span></button>`
    : `<button class="nav-item ${active === i.id ? 'active' : ''}" data-route="${i.route}">${icon(i.ico, 25)}<span>${i.label}</span></button>`
  ).join('');
  $$('#bottomNav .nav-item').forEach(b => b.addEventListener('click', () => go(b.dataset.route)));
  nav.style.display = 'grid';
}
export function hideNav() { $('#bottomNav').style.display = 'none'; }

/* ---------------- drawer ----------------
   The drawer is the app's full index, built in two versions from the single
   source of truth in store.js (`isMember`). A visitor never sees an account
   tool: the rows are removed from the tree, not greyed out, so no tap can
   bounce them into a sign-up screen. A group head only opens its group — it
   never navigates — and every leaf lands on its own destination, so nothing
   that lives in this list is repeated as a row inside a screen. */
let drawerSeq = 0;
let openGroup = null;          // remembered while the drawer is on screen

export function openDrawer() {
  drawerSeq++;
  const root = $('#drawer');
  const member = S.isMember();
  const u = S.state.user;
  const tierLabel = S.tier() === 2 ? t('tier2') : S.tier() === 1 ? t('tier1') : t('guest');
  /** unread badge, hidden at zero, capped at 9+ */
  const badge = (n) => n > 0 ? `<span class="dr-badge">${n > 9 ? '+9' : n}</span>` : '';

  const unread = S.unreadCount();
  /** `accent` marks the one row allowed to keep the gold icon. */
  const item = (ico, label, route, count = 0, accent = false) =>
    `<button class="dr-item ${accent ? 'dr-accent' : ''}" data-route="${route}">${icon(ico, 22)}<span>${label}</span>
      ${badge(count)}</button>`;

  // A group head carries no route: it toggles its own group and nothing else.
  const group = (id, label, rows) => `
    <div class="dr-group ${openGroup === id ? 'open' : ''}" data-group="${id}">
      <button class="dr-item dr-head" data-toggle="${id}" aria-expanded="${openGroup === id}">
        ${icon('chevronD', 20, 'grp-arrow')}<span>${label}</span>
      </button>
      <div class="dr-sub"><div class="dr-sub-inner">${rows}</div></div>
    </div>`;

  const account = [
    item('briefcase', t('myBusiness'), '#/my-business'),
    item('bag', t('myAds'), '#/my-ads'),
    item('star', t('myReviews'), '#/my-reviews'),
    item('message', t('myMessages'), '#/messages'),
    item('heart', t('savedFav'), '#/saved'),
    item('crown', t('subscription'), '#/subscribe'),
    item('settings', t('settings'), '#/settings'),
  ].join('');

  // Home is deliberately absent: the app opens on it and it holds a permanent
  // tab in the bottom bar, so listing it here made the drawer read like a
  // website menu. Directory stays — it is a destination people look for.
  const sections = [
    item('compass', t('navExplore'), '#/directory'),
    item('bag', t('classifiedsTitle'), '#/marketplace'),
    item('calendar', t('eventsTitle'), '#/events'),
    item('newspaper', t('magazineTitle'), '#/magazine'),
    item('grid', t('allCategories'), '#/categories'),
  ].join('');

  const help = [
    item('help', t('help'), '#/help'),
    item('info', t('about'), '#/about'),
    item('shield', t('privacy'), '#/privacy'),
    item('file', t('terms'), '#/terms'),
  ].join('');

  const head = member ? `
      <div class="drawer-head">
        <img src="assets/logo-sm.png" alt="ARABNA" />
        <div style="font-weight:700">${u.name}</div>
        <div class="drawer-user">${u.email} · ${tierLabel}</div>
      </div>` : `
      <div class="drawer-head">
        <img src="assets/logo-sm.png" alt="ARABNA" />
        <div style="font-weight:700">${t('guest')}</div>
      </div>
      <div class="dr-invite">
        <b>${t('joinTitle')}</b>
        <span>${t('joinSub')}</span>
        <button class="btn btn-gold btn-sm" data-route="#/auth/signup">${t('signUp')}</button>
        <button class="dr-invite-link" data-route="#/auth/signin">${t('haveAccount')}</button>
      </div>`;

  const langRow = `
      <button class="dr-item" id="drLang">${icon('globe', 22)}<span>${t('language')}</span>
        <span class="lang-pill" style="margin-inline-start:auto">${getLang() === 'ar' ? 'العربية' : 'English'}</span></button>`;

  root.innerHTML = `
    <div class="drawer-scrim" data-close></div>
    <aside class="drawer-panel">
      ${head}
      ${langRow}
      ${member ? item('bell', t('notifications'), '#/notifications', unread) : ''}
      ${member ? group('account', t('grpMyAccount'), account) : ''}
      ${group('sections', t('grpSections'), sections)}
      ${item('megaphone', t('advertiseWithUs'), '#/advertise', 0, true)}
      ${group('help', t('grpHelp'), help)}
      ${member ? `<button class="dr-item" id="drOut" style="color:#E79A9C">${icon('logout', 22)}<span>${t('signOut')}</span></button>` : ''}
      <div class="dr-version">ARABNA · عربنا — ${t('version')} 0.1</div>
    </aside>`;

  root.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => root.classList.add('open'));
  root.querySelector('[data-close]').addEventListener('click', closeDrawer);

  // accordion: opening one group closes the others
  $$('#drawer [data-toggle]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.toggle;
    openGroup = openGroup === id ? null : id;
    $$('#drawer .dr-group').forEach(g => {
      const on = g.dataset.group === openGroup;
      g.classList.toggle('open', on);
      g.querySelector('.dr-head').setAttribute('aria-expanded', String(on));
    });
  }));

  $$('#drawer [data-route]').forEach(b => b.addEventListener('click', () => { closeDrawer(); go(b.dataset.route); }));
  const dl = $('#drLang'); if (dl) dl.addEventListener('click', () => { closeDrawer(); toggleLang(); });
  const out = $('#drOut');
  if (out) out.addEventListener('click', () => {
    closeDrawer();
    confirmSheet({ title: t('signOut'), sub: '', confirmText: t('signOut'), danger: true, onConfirm: () => { S.signOut(); toast(t('done'), 'ok'); go('#/home'); } });
  });
}
export function closeDrawer() {
  const root = $('#drawer');
  root.classList.remove('open');
  root.setAttribute('aria-hidden', 'true');
  // Only wipe the markup if the drawer was not reopened during the animation —
  // otherwise a close that overlaps an open leaves an empty panel behind.
  const seq = drawerSeq;
  setTimeout(() => { if (seq === drawerSeq) root.innerHTML = ''; }, 340);
}

/* ---------------- small builders ---------------- */
export function emptyState(ico, title, sub, ctaLabel, ctaRoute) {
  return `<div class="empty">
    <div class="empty-ico">${icon(ico, 35)}</div>
    <b>${title}</b><span>${sub}</span>
    ${ctaLabel ? `<button class="btn btn-gold" data-route="${ctaRoute}">${ctaLabel}</button>` : ''}
  </div>`;
}

export function stars(rating) {
  const full = Math.round(rating);
  let s = '';
  for (let i = 0; i < 5; i++) {
    s += i < full
      ? `<span>${iconFilled('star', 13)}</span>`
      : `<span style="opacity:.28">${icon('star', 13)}</span>`;
  }
  return `<span class="stars">${s}<b style="margin-inline-start:3px">${rating.toFixed(1)}</b></span>`;
}

export function wireRoutes(root) {
  $$('[data-route]', root).forEach(b => {
    if (b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('click', (e) => { e.stopPropagation(); go(b.dataset.route); });
  });
}

export function fmtMoney(n) { return '$' + n.toLocaleString('en-US'); }

/* ---------------- commercial prices are for account holders ----------------
   What ARABNA charges — ad placements, the directory subscription, boosts,
   the verification badge — is shown only to a signed-in user. The prices of
   things people sell to each other are content, not our pricing, and are
   never hidden: a marketplace with no prices is a blank screen.
   The gate always keeps the visitor on the same screen and brings them back
   to it, so nothing about the flow changes except whether numbers appear. */
export const showsPrices = () => S.isMember();

/**
 * The line + button that stands where a price would be.
 * @param {string} returnRoute where to resume after signing up
 * @param {string} labelKey    'unlockPrices' (plural) or 'unlockPrice'
 */
export function priceGate(returnRoute, labelKey = 'unlockPrices') {
  return `<div class="price-gate">
    <span>${icon('lock', 16)} ${t('pricesAfterSignup')}</span>
    <button class="btn btn-gold btn-block" data-pricegate="${returnRoute}">${t(labelKey)}</button>
  </div>`;
}

/** Wire every gate inside `root`: remember the intent, then resume here. */
export function wirePriceGates(root) {
  $$('[data-pricegate]', root).forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    S.requireTier(1, b.dataset.pricegate, go);
  }));
}

/**
 * One filter sheet for both listing screens.
 * @param {object} o
 * @param {Array}  o.cats     [{ id, label }] category options
 * @param {object} o.value    current { cat, radius, sort, priceMin, priceMax }
 * @param {boolean} o.withPrice show the price range (marketplace only)
 * @param {Function} o.onApply called with the new value
 */
/**
 * The one filter surface for both listing screens.
 * `withAttrs` turns on the directory extras — open-now, "open first" and the
 * attribute groups, which are generated from the registry for whichever
 * category is selected. Nothing about attributes is written here by hand, so
 * a new one is a line in data.js and appears in this sheet on its own.
 */
export function openFilterSheet({ cats, value, withPrice, withAttrs, onApply }) {
  const v = Object.assign({ cat: 'all', radius: S.state.radius, sort: 'newest',
                            priceMin: '', priceMax: '', openNow: false, attrs: [] }, value);
  v.attrs = (v.attrs || []).slice();
  const sorts = [['newest', t('sortNewest')], ['nearest', t('sortNearest')], ['rated', t('sortTopRated')]]
    .concat(withAttrs ? [['open', t('sortOpen')]] : []);

  const attrHtml = () => S.attrGroupsForCat(v.cat === 'all' ? '*' : v.cat).map(g => `
    <div class="label mt-16">${t(g.group.key)}</div>
    <div class="attr-pick" data-grp="${g.group.id}">
      ${g.attrs.map(a => `<button class="chip ${v.attrs.includes(a.id) ? 'active' : ''}" data-a="${a.id}">
        ${icon(a.icon, 14)} ${t(a.key)}</button>`).join('')}
    </div>`).join('');

  openSheet(`
    <div class="sheet-title">${t('filters')}</div>

    <div class="label">${t('category')}</div>
    <div class="hscroll" style="padding:0" id="fCats">
      <button class="chip ${v.cat === 'all' ? 'active' : ''}" data-c="all">${t('catAll')}</button>
      ${cats.map(c => `<button class="chip ${v.cat === c.id ? 'active' : ''}" data-c="${c.id}">${c.label}</button>`).join('')}
    </div>

    <div class="label mt-16">${t('radius')}</div>
    <div class="hscroll" style="padding:0" id="fRad">
      ${[5, 10, 25, 50, 100].map(r => `<button class="chip ${v.radius === r ? 'active' : ''}" data-r="${r}">${r} ${t('miles')}</button>`).join('')}
    </div>

    <div class="label mt-16">${t('sortBy')}</div>
    <div class="hscroll" style="padding:0" id="fSort">
      ${sorts.map(([id, lbl]) => `<button class="chip ${v.sort === id ? 'active' : ''}" data-s="${id}">${lbl}</button>`).join('')}
    </div>

    ${withPrice ? `
      <div class="label mt-16">${t('priceRange')}</div>
      <div class="action-grid">
        <input class="input" id="fMin" inputmode="decimal" placeholder="${t('priceFrom')}" value="${v.priceMin}" />
        <input class="input" id="fMax" inputmode="decimal" placeholder="${t('priceTo')}" value="${v.priceMax}" />
      </div>` : ''}

    ${withAttrs ? `
      <div class="label mt-16">${t('hoursTitle')}</div>
      <div class="attr-pick">
        <button class="chip ${v.openNow ? 'active' : ''}" id="fOpenNow">${icon('clock', 14)} ${t('filterOpenNow')}</button>
      </div>
      <div id="fAttrs">${attrHtml()}</div>` : ''}

    <button class="btn btn-gold btn-block mt-16" id="fApply">${t('applyFilters')}</button>
    <button class="btn btn-ghost btn-block mt-8" id="fClear">${t('clearFilters')}</button>
  `, (panel) => {
    const pick = (sel, attr, key, cast = (x) => x) => {
      panel.querySelectorAll(`${sel} .chip`).forEach(b => b.addEventListener('click', () => {
        v[key] = cast(b.dataset[attr]);
        panel.querySelectorAll(`${sel} .chip`).forEach(x => x.classList.toggle('active', x === b));
      }));
    };
    pick('#fCats', 'c', 'cat');
    pick('#fRad', 'r', 'radius', Number);
    pick('#fSort', 's', 'sort');

    if (withAttrs) {
      const on = panel.querySelector('#fOpenNow');
      on.addEventListener('click', () => { v.openNow = !v.openNow; on.classList.toggle('active', v.openNow); });

      // attributes are multi-select and combine; picking two narrows the list
      const wireAttrs = () => panel.querySelectorAll('#fAttrs .chip').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.dataset.a;
          const i = v.attrs.indexOf(id);
          if (i >= 0) v.attrs.splice(i, 1); else v.attrs.push(id);
          b.classList.toggle('active', v.attrs.includes(id));
        });
      });
      wireAttrs();

      // changing the category changes which attributes exist: rebuild them,
      // and drop any selection that no longer applies
      panel.querySelectorAll('#fCats .chip').forEach(b => b.addEventListener('click', () => {
        const valid = S.attrsForCat(v.cat === 'all' ? '*' : v.cat).map(a => a.id);
        v.attrs = v.attrs.filter(id => valid.includes(id));
        panel.querySelector('#fAttrs').innerHTML = attrHtml();
        wireAttrs();
      }));
    }

    panel.querySelector('#fApply').addEventListener('click', () => {
      if (withPrice) {
        v.priceMin = panel.querySelector('#fMin').value.trim();
        v.priceMax = panel.querySelector('#fMax').value.trim();
      }
      S.state.radius = v.radius; S.save();
      closeSheet();
      onApply(v);
    });
    panel.querySelector('#fClear').addEventListener('click', () => {
      closeSheet();
      onApply({ cat: 'all', radius: S.state.radius, sort: 'newest', priceMin: '', priceMax: '',
                openNow: false, attrs: [] });
      toast(t('filtersCleared'), 'ok');
    });
  });
}

/** how many filters are away from their default — shown on the filter button */
export function activeFilterCount(v) {
  if (!v) return 0;
  let n = 0;
  if (v.cat && v.cat !== 'all') n++;
  if (v.sort && v.sort !== 'newest') n++;
  if (v.priceMin) n++;
  if (v.priceMax) n++;
  if (v.openNow) n++;
  n += (v.attrs || []).length;
  return n;
}

/** Price as shown to the user — Free-section listings never show a number. */
export function priceLabel(price) {
  return price === FREE_PRICE ? t('priceFree') : (price || '');
}

/**
 * Status pill for a marketplace listing.
 * Pending always shows; "published" only on the owner's own screens.
 */
export function statusBadge(c, showLive = false) {
  if (!c) return '';
  if (c.status === 'pending') return `<span class="badge badge-pending">${icon('clock', 12)}${t('statusPending')}</span>`;
  if (showLive) return `<span class="badge badge-verified">${icon('check', 12)}${t('statusLive')}</span>`;
  return '';
}

/** query params from the hash: #/directory?cat=cars → { cat: 'cars' } */
/* ============================================================
   Opening hours — display
   ============================================================ */

/** "17:30" → "٥:٣٠ م" / "5:30pm". Storage stays 24-hour; only the label changes. */
export function fmtTime(hhmm) {
  const [H, M] = String(hhmm).split(':').map(Number);
  if (H === 24 || (H === 0 && M === 0)) return getLang() === 'ar' ? '١٢:٠٠ ص' : '12:00am';
  const suffix = H < 12 ? t('am') : t('pm');
  const h12 = H % 12 === 0 ? 12 : H % 12;
  const body = `${h12}:${String(M).padStart(2, '0')}`;
  const num = getLang() === 'ar' ? body.replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) : body;
  return getLang() === 'ar' ? `${num} ${suffix}` : `${num}${suffix}`;
}

/** one day's spans as text, or "closed" */
export function fmtDay(spans) {
  if (!spans || !spans.length) return t('closedToday');
  if (S.isAllDay(spans)) return t('open24');
  return spans.map(([o, c]) => `${fmtTime(o)} – ${fmtTime(c)}`).join(' · ');
}

/**
 * The open/closed pill. Says what the user actually needs next: closing time
 * when it is about to shut, opening time when it is closed.
 * Returns '' when the business carries no hours — better nothing than a guess.
 */
/**
 * How far away, or nothing at all. The 486 real listings came in through
 * the importer with no coordinates yet, so their distance is unknown —
 * and "0 mi" on every row would be a number the app invented. Geocoding
 * fills these in at V.02; until then the line is simply absent, the same
 * way a missing phone number leaves no call button.
 */
export function distLabel(biz) {
  const d = biz && biz.dist;
  return d ? `<span>${icon('mapPin', 13)} ${d} ${t('miles')}</span>` : '';
}

export function openBadge(biz, now = new Date()) {
  const st = S.openState(biz, now);
  if (!st) return '';
  if (st.always) return `<span class="open-pill open">${icon('clock', 12)}${t('open24')}</span>`;
  if (st.open) {
    const soon = st.minsToClose !== null && st.minsToClose <= 60;
    return `<span class="open-pill ${soon ? 'soon' : 'open'}">${icon('clock', 12)}${
      soon ? t('closesSoon') : t('openNow')}</span>`;
  }
  // name the day only when it is not today — "opens Monday 9am" vs "opens 9am"
  const day = st.opensToday ? '' : t(S.DAY_KEYS[st.opensDay]) + ' ';
  const when = st.opensAt ? `${t('opensAt')} ${day}${fmtTime(st.opensAt)}` : t('closedNow');
  return `<span class="open-pill closed">${icon('clock', 12)}${when.trim()}</span>`;
}

/**
 * The gold "verified business" mark. Deliberately not the blue one on a
 * personal account: two different things, so two different names, shapes
 * and colours — one word for both and nobody could tell them apart.
 * It reads `businessVerified`, which is an explicit decision and is never
 * inferred from whether the shop pays us.
 */
export function bizBadge(b) {
  if (!S.businessVerified(b)) return '';
  return `<span class="badge badge-bizverified" title="${t('bizVerified')}">${icon('checkCircle', 12)}${t('bizVerified')}</span>`;
}

/** the attribute pills shown under a business description */
export function attrChips(biz) {
  const list = (biz.attributes || [])
    .map(id => S.attrById(id))
    .filter(a => a && S.seasonOn(a.season));
  if (!list.length) return '';
  return `<div class="attr-chips">${list.map(a =>
    `<span class="attr-chip">${icon(a.icon, 14)}${t(a.key)}</span>`).join('')}</div>`;
}

/**
 * One line above the results naming the section the user is looking at.
 * Without it a pre-filtered arrival looks like the whole list, just shorter.
 * Returns '' for the unfiltered view — there is no section to name.
 */
export function sectionNote(label, count) {
  if (!label) return '';
  return `<div class="sec-note"><b>${label}</b><span>${count} ${t('resultsWord')}</span></div>`;
}

export function query() {
  const q = (location.hash.split('?')[1] || '');
  const out = {};
  q.split('&').filter(Boolean).forEach(pair => {
    const [k, v] = pair.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return out;
}

/** open native maps app for an address */
export function openMaps(address) {
  const q = encodeURIComponent(address);
  const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  window.open(isApple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
}

export function shareItem(title, url) {
  if (navigator.share) navigator.share({ title, url }).catch(() => {});
  else { try { navigator.clipboard.writeText(url); } catch (e) {} toast(getLang() === 'ar' ? 'تم نسخ الرابط' : 'Link copied', 'ok'); }
}

export { L, t, icon };
