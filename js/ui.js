/* ============================================================
   Shared UI primitives: toast, bottom sheet, drawer, header, nav
   ============================================================ */

import { icon, iconFilled } from './icons.js';
import { t, L, getLang, setLang } from './i18n.js';
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
export function openSheet(html, onMount, onClose) {
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
  setTimeout(() => { root.innerHTML = ''; }, 320);
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
    head.innerHTML = `
      <button class="icon-btn" id="hBack" aria-label="${t('back')}">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 24)}</button>
      <div class="h-title">${opts.title || ''}</div>
      <button class="icon-btn" id="hLang">${`<span style="font-size:11px;font-weight:700;color:var(--gold-bright)">${getLang() === 'ar' ? 'EN' : 'ع'}</span>`}</button>`;
    $('#hBack').addEventListener('click', () => opts.onBack ? opts.onBack() : back());
  } else {
    const unread = S.unreadCount();
    head.innerHTML = `
      <button class="icon-btn" id="hMenu" aria-label="menu">${icon('menu', 24)}</button>
      <img class="h-logo" src="assets/logo-sm.png" alt="ARABNA عربنا" />
      <button class="icon-btn" id="hLang" aria-label="language"><span style="font-size:11px;font-weight:700;color:var(--gold-bright)">${getLang() === 'ar' ? 'EN' : 'ع'}</span></button>
      <button class="icon-btn" id="hBell" aria-label="notifications">${icon('bell', 24)}${unread ? '<span class="dot"></span>' : ''}</button>`;
    $('#hMenu').addEventListener('click', openDrawer);
    $('#hBell').addEventListener('click', () => go('#/notifications'));
  }
  $('#hLang').addEventListener('click', toggleLang);
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
    { id: 'classifieds', label: t('navMarket'),  ico: 'bag',     route: '#/classifieds' },
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

/* ---------------- drawer ---------------- */
export function openDrawer() {
  const root = $('#drawer');
  const u = S.state.user;
  const tierLabel = S.tier() === 2 ? t('tier2') : S.tier() === 1 ? t('tier1') : t('guest');

  const item = (ico, label, route, extra = '') =>
    `<button class="dr-item" data-route="${route}">${icon(ico, 22)}<span>${label}</span>${extra}<span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 19)}</span></button>`;

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

      ${item('newspaper', t('magazineTitle'), '#/magazine')}
      ${item('briefcase', t('myBusiness'), '#/my-business')}
      ${item('bag', t('myAds'), '#/my-ads')}
      ${item('heart', t('savedFav'), '#/saved')}
      ${item('megaphone', t('advertiseWithUs'), '#/advertise')}

      <div class="dr-group-label">${t('settings')}</div>
      ${item('settings', t('settings'), '#/settings')}
      ${item('help', t('help'), '#/help')}
      ${item('info', t('about'), '#/about')}
      ${item('shield', t('privacy'), '#/privacy')}
      ${item('file', t('terms'), '#/terms')}
      ${item('lock', t('adminPanel'), '#/admin')}

      ${u ? `<button class="dr-item" id="drOut" style="color:#E79A9C">${icon('logout', 22)}<span>${t('signOut')}</span></button>` : ''}
      <div style="padding:18px;text-align:center;color:var(--muted);font-size:11px">ARABNA · عربنا — ${t('version')} 0.1</div>
    </aside>`;

  root.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => root.classList.add('open'));
  root.querySelector('[data-close]').addEventListener('click', closeDrawer);
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
  setTimeout(() => { root.innerHTML = ''; }, 340);
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
