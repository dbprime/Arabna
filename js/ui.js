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
      <button class="icon-btn" id="hMenu" aria-label="menu">${icon('menu', 24)}${S.unreadCount() ? '<span class="dot"></span>' : ''}</button>
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
   The drawer is exploration + language + policies only. Anything that belongs
   to the user personally lives on the profile screen, so no row appears twice.
   Groups are collapsed by default (one open at a time) and a collapsed group
   carries the sum of its children's badges — otherwise folding would hide the
   unread count entirely. */
let drawerSeq = 0;
let openGroup = null;          // remembered while the drawer is on screen

export function openDrawer() {
  drawerSeq++;
  const root = $('#drawer');
  const u = S.state.user;
  const tierLabel = S.tier() === 2 ? t('tier2') : S.tier() === 1 ? t('tier1') : t('guest');
  const chev = () => icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 19);

  /** unread badge, hidden at zero, capped at 9+ */
  const badge = (n) => n > 0 ? `<span class="dr-badge">${n > 9 ? '+9' : n}</span>` : '';

  const unread = S.unreadCount();
  const item = (ico, label, route, count = 0) =>
    `<button class="dr-item" data-route="${route}">${icon(ico, 22)}<span>${label}</span>
      ${badge(count)}<span class="chev">${chev()}</span></button>`;

  const group = (id, label, count, rows) => `
    <div class="dr-group ${openGroup === id ? 'open' : ''}" data-group="${id}">
      <button class="dr-item dr-head" data-toggle="${id}" aria-expanded="${openGroup === id}">
        ${icon('chevronD', 20, 'grp-arrow')}<span>${label}</span>
        ${badge(count)}
      </button>
      <div class="dr-sub"><div class="dr-sub-inner">${rows}</div></div>
    </div>`;

  const sections = [
    item('grid', t('allCategories'), '#/categories'),
    item('calendar', t('eventsTitle'), '#/events'),
    item('newspaper', t('magazineTitle'), '#/magazine'),
    item('bag', t('classifiedsTitle'), '#/marketplace'),
  ].join('');

  const account = [
    item('megaphone', t('advertiseWithUs'), '#/advertise'),
    item('bell', t('notifications'), '#/notifications', unread),
    item('user', t('navProfile'), '#/profile'),
  ].join('');

  const help = [
    item('settings', t('settings'), '#/settings'),
    item('help', t('help'), '#/help'),
    item('info', t('about'), '#/about'),
    item('shield', t('privacy'), '#/privacy'),
    item('file', t('terms'), '#/terms'),
  ].join('');

  root.innerHTML = `
    <div class="drawer-scrim" data-close></div>
    <aside class="drawer-panel">
      <div class="drawer-head">
        <img src="assets/logo-sm.png" alt="ARABNA" />
        <div style="font-weight:700">${u ? u.name : t('guest')}</div>
        <div class="drawer-user">${u ? u.email + ' · ' + tierLabel : t('needAccountSub')}</div>
        ${!u ? `<button class="btn btn-gold btn-sm mt-12" data-route="#/auth/signup" style="width:100%">${t('signUp')}</button>` : ''}
      </div>

      <button class="dr-item" id="drLang">${icon('globe', 22)}<span>${t('language')}</span>
        <span class="lang-pill" style="margin-inline-start:auto">${getLang() === 'ar' ? 'العربية' : 'English'}</span></button>

      ${group('sections', t('grpSections'), 0, sections)}
      ${group('account', t('grpAccount'), unread, account)}
      ${group('help', t('grpHelp'), 0, help)}

      ${u ? `<button class="dr-item" id="drOut" style="color:#E79A9C">${icon('logout', 22)}<span>${t('signOut')}</span></button>` : ''}
      <div style="padding:18px;text-align:center;color:var(--muted);font-size:11px">ARABNA · عربنا — ${t('version')} 0.1</div>
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

/**
 * One filter sheet for both listing screens.
 * @param {object} o
 * @param {Array}  o.cats     [{ id, label }] category options
 * @param {object} o.value    current { cat, radius, sort, priceMin, priceMax }
 * @param {boolean} o.withPrice show the price range (marketplace only)
 * @param {Function} o.onApply called with the new value
 */
export function openFilterSheet({ cats, value, withPrice, onApply }) {
  const v = Object.assign({ cat: 'all', radius: S.state.radius, sort: 'newest', priceMin: '', priceMax: '' }, value);
  const sorts = [['newest', t('sortNewest')], ['nearest', t('sortNearest')], ['rated', t('sortTopRated')]];

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
      onApply({ cat: 'all', radius: S.state.radius, sort: 'newest', priceMin: '', priceMax: '' });
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
