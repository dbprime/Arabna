/* ============================================================
   Shared UI primitives: toast, bottom sheet, drawer, header, nav
   ============================================================ */

import { icon, iconFilled } from './icons.js';
import { t, L, getLang, setLang } from './i18n.js';
import { FREE_PRICE } from './data.js';
import * as S from './store.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ============================================================
   Where you were
   ------------------------------------------------------------
   Scroll memory keyed to the *history entry*, not to the route. Two
   visits to #/directory are two different places to have been, and a
   map keyed by route would confuse them; `history.state.key` cannot.
   Back and forward then both work with no extra code, and so do the
   Android back button and the iOS edge swipe.

   The map lives in memory only. Opening the app fresh should start at
   the top — that is what people expect, and it is also what stops the
   map growing without limit.
   ============================================================ */
const scrollMemory = new Map();
let historySeq = 0;
/* The entry whose content is on screen right now. It is deliberately not
   read from `history.state` at save time: by the moment `hashchange`
   fires the browser has already moved to the new entry, so saving against
   it would file the old page's position under the new page's key — and
   then "back" would restore the position of the screen you just left. */
let shownKey = null;
/* True from the instant we decide to navigate until the new screen is on
   screen. The browser zeroes `#app.scrollTop` while the old screen is
   still the "shown" one, and that `scroll` event arrives *before*
   `hashchange` — so without this gate the listener writes a 0 over the
   position we are about to need. */
let navigating = false;

/** the key of the history entry currently showing */
export function historyKey() {
  const st = history.state;
  if (st && st.key) return st.key;
  const key = 'h' + (++historySeq);
  try { history.replaceState({ key }, ''); } catch (e) { /* file:// */ }
  return key;
}

/**
 * Record the position *while it changes*, not when we navigate.
 *
 * Navigating is always too late: by the time `hashchange` reaches us the
 * browser has already reset the container's scrollTop, so saving then
 * wrote a zero over the value that had been correct a moment earlier —
 * which is exactly what "back returns to the top" was. One passive
 * listener, throttled to a frame, mounted once at boot.
 */
export function mountScrollMemory() {
  const app = $('#app');
  if (!app || app.dataset.scrollWired) return;
  app.dataset.scrollWired = '1';
  let ticking = false;
  app.addEventListener('scroll', () => {
    if (navigating || ticking) return;    // the browser's reset is not the reader scrolling
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (shownKey) scrollMemory.set(shownKey, app.scrollTop);
    });
  }, { passive: true });
}

/** called once the new screen is on screen, so later saves land correctly */
export function markShown(key) { shownKey = key || historyKey(); navigating = false; }

/** put it back, after the new screen has actually been laid out */
export function restoreScroll(key) {
  const app = $('#app');
  if (!app) return;
  const y = scrollMemory.get(key);
  if (!y) { app.scrollTop = 0; return; }
  // two frames: one for the paint, one for anything that measured itself
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const max = Math.max(0, app.scrollHeight - app.clientHeight);
    app.scrollTop = Math.min(y, max);
  }));
}

/** a screen that finished something starts at the top, whatever was saved */
export function forgetScroll(key) { scrollMemory.delete(key || historyKey()); }

export function go(hash) {
  /* Save first, then shut the listener up. Going forward is the path that
     matters: the screen being left is the one we want to come back to, and
     `go()` is the only moment we control — everything after it (the
     container's reset, then `hashchange`) is the browser's. Coming back is
     not a problem: there the browser zeroes the *departing* screen, and
     that zero is filed under that screen's own key. */
  const app = $('#app');
  if (app && shownKey) scrollMemory.set(shownKey, app.scrollTop);
  navigating = true;

  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else {
    location.hash = hash;
    // a brand-new entry: give it its own key so its own scroll is its own
    try { history.replaceState({ key: 'h' + (++historySeq) }, ''); } catch (e) { /* file:// */ }
  }
}

/**
 * Replace where we are without adding a history entry. Filter changes use
 * this: pushing one per filter would make the back button undo them one at
 * a time and never leave the screen.
 */
export function replaceHash(hash) {
  if (location.hash === hash) return;
  const key = historyKey();
  history.replaceState({ key }, '', hash);
}

/**
 * Go somewhere and take the screen we were on out of the history.
 * Used after something is finished — a listing published, an ad paid
 * for, a subscription started. Pressing back should not put a person
 * inside a payment screen they have already completed.
 */
export function goAfterDone(hash) {
  navigating = true;
  forgetScroll();
  const key = 'h' + (++historySeq);
  history.replaceState({ key }, '', hash);
  shownKey = key;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function back() {
  navigating = true;
  if (history.length > 1) history.back(); else go('#/home');
}

/* ============================================================
   The picker row and its drop-down
   ------------------------------------------------------------
   Every choice in this app used to live in a row that scrolled
   sideways, and **an option you cannot see does not exist**. The
   category row was cut off at the edge, and the button that opened
   "all categories" sat at the far end of it — you had to scroll to
   find the thing that saves you from scrolling.

   So: nothing a person chooses from scrolls sideways any more. The
   choice comes down vertically, which is the direction people already
   scroll and the one that hides nothing. Sideways scrolling stays where
   it is *display* rather than choice — a shop's photos, "featured this
   week", the story cards.

   The panel opens **below its button and pushes the page down** instead
   of covering it: a reader keeps sight of what they were looking at, and
   on a small screen an overlay that covers the results is how you lose
   your place.
   ============================================================ */

let openDD = null;          // { close } — one panel at a time, ever
let ddSeq = 0;
/* The history entry stands for "a panel is open", not for one particular
   panel: switching from the category list to the sort list is still one
   thing the back button should undo, and pushing a second entry (or
   winding the first one off mid-switch) turned that into a fight the
   reader lost. */
let ddToken = null;

/** the button: a small label, the chosen value in gold, and a chevron */
export function pickerBtn({ id, label, value, wide }) {
  return `<button class="ctl ${wide ? 'wide' : ''}" id="${id}" type="button"
      aria-haspopup="listbox" aria-expanded="false">
    <span class="ctl-txt"><span class="ctl-k">${label}</span><span class="ctl-v">${value}</span></span>
    ${icon('chevronD', 16)}
  </button>`;
}

/** update a picker's printed value without rebuilding the row */
export function setPickerValue(id, value) {
  const el = $(`#${id} .ctl-v`);
  if (el) el.textContent = value;
}

/**
 * @param keepHistory  true when the caller is itself navigating: the panel's
 *                     own history entry is then left alone, because winding
 *                     it back in the middle of somebody else's navigation
 *                     is how you end up two screens from where you meant.
 */
export function closeDropdown(keepHistory) { if (openDD) openDD.close(keepHistory); }

/**
 * Open the list under a picker.
 *
 * @param host      the element the panel is drawn into (in the flow, so it pushes)
 * @param anchor    the button that opened it
 * @param title     "choose a category"
 * @param options   [{ id, label, icon, count }] — already ordered
 * @param value     the chosen id
 * @param onPick    (id) => void; the panel closes itself first
 */
export function openDropdown({ host, anchor, title, options, value, unit, onPick }) {
  if (openDD && openDD.anchor === anchor) { openDD.close(); return; }
  if (openDD) openDD.adopt();              // a switch, not a close-and-reopen
  if (!host || !anchor) return;

  const total = options.length;
  /* «22 تصنيف» · «4 أنواع» · "22 categories". Arabic counts three to ten
     with the plural and eleven upwards with the singular, and English does
     the opposite of neither — so the caller names the thing and the rule
     lives in one place. */
  const u = unit || 'dd';
  const word = S.state.lang === 'en'
    ? t(total === 1 ? u + 'One' : u + 'Few')
    : t(total >= 3 && total <= 10 ? u + 'Few' : u + 'One');
  host.innerHTML = `
    <div class="dd-panel" role="listbox" aria-label="${title}">
      <div class="dd-head"><span>${title}</span><span class="dd-total">${total} ${word}</span></div>
      <div class="dd-scroll">
        ${options.map(o => `
          <button class="dd-row ${o.id === value ? 'selected' : ''}" type="button" role="option"
                  aria-selected="${o.id === value}" data-v="${o.id}">
            ${o.icon ? icon(o.icon, 18) : '<span class="dd-nogap"></span>'}
            <span class="dd-name">${o.label}</span>
            ${o.count == null ? '' : `<span class="chip-n">${o.count}</span>`}
            <span class="dd-tick">${o.id === value ? icon('check', 16) : ''}</span>
          </button>`).join('')}
      </div>
    </div>`;
  anchor.setAttribute('aria-expanded', 'true');
  anchor.classList.add('open');

  const rows = $$('.dd-row', host);
  const panel = host.querySelector('.dd-panel');

  /* A history entry of its own, so the device back button closes the panel
     instead of leaving the screen — the panel is a place the reader went
     to, and back should undo exactly that. The URL does not change, so the
     router never re-renders and the reader's scroll position is untouched. */
  if (!ddToken) {
    ddToken = 'dd' + (++ddSeq);
    try { history.pushState({ key: historyKey(), dd: ddToken }, ''); } catch (e) { /* file:// */ }
  }
  const token = ddToken;

  /* Anything that has to happen *after* the panel's history entry is gone
     waits for the pop. Doing it the other way round cost a whole bug: the
     pick rewrote the URL, and the back() that was already in flight then
     wound that rewrite straight back off again. */
  let pending = null;

  /**
   * @param mode  undefined → wind the history entry back
   *              'adopt'   → another picker is opening; leave it for them
   *              'abandon' → we are navigating away; forget it, do not touch it
   */
  const finish = (fromHistory, cb, mode) => {
    if (openDD !== api) { if (cb) cb(); return; }
    openDD = null;
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    host.innerHTML = '';
    anchor.setAttribute('aria-expanded', 'false');
    anchor.classList.remove('open');
    window.removeEventListener('popstate', onPop);

    if (fromHistory || mode === 'abandon') ddToken = null;
    else if (mode !== 'adopt') {
      let ours = false;
      try { ours = ddToken && history.state && history.state.dd === token; } catch (e) { /* file:// */ }
      if (ours) {
        ddToken = null;
        pending = cb || null;
        window.addEventListener('popstate', onPop);   // the pick waits for the pop
        history.back();
        return;
      }
    }
    if (cb) cb();
  };

  const onPop = () => {
    window.removeEventListener('popstate', onPop);
    const cb = pending; pending = null;
    ddToken = null;
    finish(true);
    if (cb) cb();
  };

  /* The first tap outside only closes the panel — it does not also press
     whatever is under it. Anything else and one tap both closes the list
     and opens a shop the reader never meant to open. */
  const onDown = (e) => {
    if (panel.contains(e.target) || anchor.contains(e.target)) return;
    // tapping the other picker swaps the lists; it is one open panel either
    // way, so the history entry passes over rather than being rebuilt
    const other = e.target.closest && e.target.closest('[aria-haspopup="listbox"]');
    if (other) { finish(false, null, 'adopt'); return; }
    finish(false);
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', swallow, true), 400);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); anchor.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = rows.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (i < 0 ? 0 : Math.min(i + 1, rows.length - 1))
                                       : (i < 0 ? rows.length - 1 : Math.max(i - 1, 0));
    rows[next] && rows[next].focus();
  };

  const api = {
    anchor,
    close: (keepHistory) => finish(false, null, keepHistory ? 'abandon' : undefined),
    adopt: () => finish(false, null, 'adopt'),
  };
  openDD = api;

  window.addEventListener('popstate', onPop);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);

  rows.forEach(r => r.addEventListener('click', () => {
    const v = r.dataset.v;
    finish(false, () => onPick(v));
  }));

  // the chosen row is brought into view inside the panel, never the page
  const sel = host.querySelector('.dd-row.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

/* ============================================================
   Light and dark
   ------------------------------------------------------------
   Three states: follow the device, light, dark. The choice is a
   `data-theme` attribute on <html> and nothing else — every colour in
   the app is a symbol, so one attribute repaints all of it with no
   reload and no re-render.
   ============================================================ */

const BAR_COLOR = { dark: '#131F39', light: '#FFFDF8' };

/** what is actually on screen right now, after resolving 'auto' */
export function resolvedTheme() {
  const mode = S.themeMode();
  if (mode === 'light' || mode === 'dark') return mode;
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
    ? 'light' : 'dark';
}

/**
 * The system chrome has to follow too. Without these two lines the
 * iPhone keeps a black status bar over an ivory app — the same fault we
 * fixed for the installed header, in a different place.
 */
export function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.setAttribute('data-theme', theme);
  const bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.setAttribute('content', BAR_COLOR[theme]);
  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  // iOS reads this at launch, so it is set correctly from boot as well
  if (status) status.setAttribute('content', theme === 'light' ? 'default' : 'black-translucent');
}

export function setTheme(mode) {
  S.setThemeMode(mode);
  applyTheme();
}

/** in 'auto', follow the device while the app is open — night mode on a
    schedule should not need the app closed and opened again */
export function mountThemeWatch() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const onChange = () => { if (S.themeMode() === 'auto') applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
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
/**
 * A bottom sheet. If the markup contains a `.sheet-foot`, it is lifted out
 * of the scrolling body and becomes its sibling.
 *
 * `position: sticky` was not enough: it pins to the bottom of its own
 * container, and that container was taller than the screen, so on a real
 * phone the last group of filters sat *underneath* the apply button and
 * could not be reached. A flex column with a scrolling body and a footer
 * beside it cannot do that.
 */
export function openSheet(html, onMount, onClose) {
  closeDropdown();          // one surface at a time
  sheetSeq++;
  const root = $('#sheet');
  root.innerHTML = `<div class="sheet-scrim" data-close></div>
    <div class="sheet-panel"><div class="sheet-grip"></div>
      <div class="sheet-body">${html}</div>
    </div>`;
  const panel = root.querySelector('.sheet-panel');
  const foot = panel.querySelector('.sheet-foot');
  if (foot) panel.appendChild(foot);          // out of the scroll, into the column
  root.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => root.classList.add('open'));
  sheetOnClose = onClose || null;
  root.querySelector('[data-close]').addEventListener('click', closeSheet);
  if (onMount) onMount(panel);
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
/**
 * What "+" offers.
 *
 * It used to be a symbol with no label that went straight to the
 * marketplace post form, which then demanded an account — so a visitor
 * pressed something unnamed and was thrown into a sign-up screen without
 * ever learning what they had been stopped from doing. Now it is labelled
 * «أضف», and pressing it says in words what can be created. There are
 * four creatable things in this app and the button used to hide the one
 * that matters most commercially: adding a business.
 */
export function openAddSheet() {
  const rows = [
    { route: '#/post', ico: 'bag', title: t('addSell'), sub: t('addSellSub') },
    { route: '#/add-business', ico: 'briefcase', title: t('addBiz'), sub: t('addBizSub') },
    { route: '#/events/propose', ico: 'calendar', title: t('addSuggestEvent'), sub: t('addSuggestEventSub') },
  ];
  openSheet(`
    <div class="sheet-title">${t('addWhat')}</div>
    ${rows.map(r => `<button class="add-row" data-go="${r.route}">
      <span class="a-ico">${icon(r.ico, 21)}</span>
      <span class="a-txt"><b>${r.title}</b><span>${r.sub}</span></span>
      <span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 18)}</span>
    </button>`).join('')}
    <button class="add-row secondary" data-go="#/advertise">
      <span class="a-ico">${icon('megaphone', 19)}</span>
      <span class="a-txt"><b>${t('advertiseWithUs')}</b></span>
      <span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 18)}</span>
    </button>
  `, (panel) => {
    panel.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
      closeSheet();
      go(b.dataset.go);
    }));
  });
}

export function renderNav(active) {
  const nav = $('#bottomNav');
  const items = [
    { id: 'home',        label: t('navHome'),    ico: 'home',    route: '#/home' },
    { id: 'directory',   label: t('navExplore'), ico: 'compass', route: '#/directory' },
    // named like every other tab, and it opens a choice rather than a screen
    { id: 'post',        label: t('navAdd'),     ico: 'plus',    route: '',      center: true },
    { id: 'classifieds', label: t('navMarket'),  ico: 'bag',     route: '#/marketplace' },
    { id: 'profile',     label: t('navProfile'), ico: 'user',    route: '#/profile' },
  ];
  nav.innerHTML = items.map(i => i.center
    ? `<button class="nav-item nav-add" id="navAdd"><span class="nav-post">${icon('plus', 28)}</span><span>${i.label}</span></button>`
    : `<button class="nav-item ${active === i.id ? 'active' : ''}" data-route="${i.route}">${icon(i.ico, 25)}<span>${i.label}</span></button>`
  ).join('');
  $$('#bottomNav .nav-item[data-route]').forEach(b => b.addEventListener('click', () => go(b.dataset.route)));
  $('#navAdd').addEventListener('click', openAddSheet);
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

  /* Reaching Settings to turn the lights down is too far for something
     people do at night, one-handed, in bed. It sits in the head rather
     than in a row of its own: the drawer's rule is that it never scrolls,
     and an eighth row broke that the moment a group was open. */
  const dark = resolvedTheme() === 'dark';
  const themeBtn = `<button class="dr-theme-btn" id="drTheme"
        aria-label="${t(dark ? 'themeLight' : 'themeDark')}">${icon(dark ? 'sun' : 'moon', 20)}</button>`;

  const head = member ? `
      <div class="drawer-head">
        ${themeBtn}
        <img src="assets/logo-sm.png" alt="ARABNA" />
        <div style="font-weight:700">${u.name}</div>
        <div class="drawer-user">${u.email} · ${tierLabel}</div>
      </div>` : `
      <div class="drawer-head">
        ${themeBtn}
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
        <span class="lang-pill dr-end">${getLang() === 'ar' ? 'العربية' : 'English'}</span></button>`;


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
      ${member ? `<button class="dr-item ink-danger" id="drOut">${icon('logout', 22)}<span>${t('signOut')}</span></button>` : ''}
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
  const dt = $('#drTheme');
  if (dt) dt.addEventListener('click', () => {
    setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
    closeDrawer();
    toast(t(resolvedTheme() === 'dark' ? 'themeDarkOn' : 'themeLightOn'), 'ok');
  });
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

/* Tolerates a missing amount rather than throwing: one order row with no
   price should not take the whole admin panel down with it. */
export function fmtMoney(n) {
  const v = Number(n);
  return '$' + (isFinite(v) ? v : 0).toLocaleString('en-US');
}

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
 * The one filter surface for both listing screens.
 *
 * Rebuilt in the fourth batch against what the screen actually did wrong:
 *  - the category row repeated the chips sitting behind the sheet, so it
 *    is gone; the grid button on the directory does that job now;
 *  - every group wraps, because a filter that scrolls sideways off the
 *    edge is a filter nobody knows is there;
 *  - each option carries its count, so nothing leads to zero results;
 *  - options with no listings behind them are not offered at all — 185 of
 *    the 342 attributes are empty in some categories;
 *  - the most-used handful come first, before the named groups;
 *  - the radius became the area group: the whole area or the reader's
 *    own city, with mile options the day coordinates exist;
 *  - and the footer is pinned, with a live count on the button, because
 *    it used to be cut off below the fold.
 *
 * `withAttrs` turns on the directory extras. Nothing about any specific
 * attribute is written here: they are generated from the registry, so a
 * new one is a line in data.js and appears here on its own.
 */
export function openFilterSheet({ cat, cats, value, withPrice, withAttrs, withArea, countFor, onApply }) {
  const v = Object.assign({ cat: cat || 'all', area: 'all', sort: 'newest',
                            priceMin: '', priceMax: '', openNow: false, attrs: [] }, value);
  v.attrs = (v.attrs || []).slice();
  const sorts = [['newest', t('sortNewest')], ['nearest', t('sortNearest')], ['rated', t('sortTopRated')]]
    .concat(withAttrs ? [['open', t('sortOpen')]] : []);
  const catFor = () => (v.cat === 'all' ? '*' : v.cat);

  const counts = () => S.attrCountsFor(catFor());

  /* ---- where, not how far ----
     The radius used to be a slider from 5 to 100 miles that filtered
     nothing at all: no listing has coordinates yet, so every setting
     returned the same list. What a reader can actually be given today is
     the whole area or their own city, each with the number of listings
     behind it; the mile options appear by themselves on the day both
     halves exist — a point for the reader and geocoded listings to
     measure against. */
  const areaOptions = () => {
    const pool = S.allBusinesses().filter(b => v.cat === 'all' || b.cat === v.cat);
    const opts = [{ id: 'all', label: t('areaAll') }];
    if (S.hasLocation()) opts.push({ id: 'city', label: S.userCity() || t('areaCity') });
    if (S.radiusUsable()) [5, 10, 25, 50].forEach(r => opts.push({ id: String(r), label: `${r} ${t('miles')}` }));
    return opts.map(o => Object.assign(o, { n: pool.filter(b => S.inArea(b, o.id)).length }));
  };

  const areaHtml = () => `
    <div class="row-between">
      <span class="label" style="margin:0">${t('areaTitle')}</span>
    </div>
    <div class="attr-pick" id="fArea">
      ${areaOptions().map(o => `<button class="chip ${String(v.area) === o.id ? 'active' : ''}" data-ar="${o.id}">
        ${o.label} <span class="chip-n">${o.n}</span></button>`).join('')}
    </div>
    ${S.hasLocation() ? '' : `<button class="btn btn-ghost btn-sm btn-block mt-8" id="fLoc">${icon('navigation', 16)} ${t('setLocation')}</button>`}`;

  /** one option, with how many listings stand behind it */
  const chip = (a, n) => `<button class="chip ${v.attrs.includes(a.id) ? 'active' : ''}" data-a="${a.id}">
    ${icon(a.icon, 14)} ${t(a.key)} <span class="chip-n">${n}</span></button>`;

  const attrHtml = () => {
    const c = counts();
    const pool = S.categorySize(catFor());
    const ceiling = Math.max(1, Math.floor(pool * S.CHIP_MAX_SHARE));
    const groups = S.attrGroupsForCat(catFor())
      .map(g => ({ group: g.group, attrs: g.attrs.filter(a => (c[a.id] || 0) > 0) }))
      .filter(g => g.attrs.length);

    /* "Most used" is a shortcut to the top of this list, not a second copy
       of it: whatever appears here is taken out of the group it belongs to,
       or the same option shows twice in one sheet. The same 60% rule as the
       quick chips applies — something 85% of the category carries narrows
       nothing, so it is left in its own group instead of leading this one. */
    const top = groups.reduce((all, g) => all.concat(g.attrs), [])
      .filter(a => (c[a.id] || 0) <= ceiling)
      .sort((a, b) => (c[b.id] || 0) - (c[a.id] || 0))
      .slice(0, 6);
    const inTop = new Set(top.map(a => a.id));

    const rest = groups
      .map(g => ({ group: g.group, attrs: g.attrs.filter(a => !inTop.has(a.id)) }))
      .filter(g => g.attrs.length);

    // a group holding one option does not need a heading of its own;
    // a title over a single chip cost two lines and said nothing
    const singles = rest.filter(g => g.attrs.length === 1).reduce((all, g) => all.concat(g.attrs), []);
    const named = rest.filter(g => g.attrs.length > 1);

    return `
      ${top.length ? `<div class="label mt-16">${t('mostUsed')}</div>
        <div class="attr-pick">${top.map(a => chip(a, c[a.id] || 0)).join('')}</div>` : ''}
      ${named.map(g => `
        <div class="label mt-16">${t(g.group.key)}</div>
        <div class="attr-pick" data-grp="${g.group.id}">
          ${g.attrs.map(a => chip(a, c[a.id] || 0)).join('')}
        </div>`).join('')}
      ${singles.length ? `<div class="label mt-16">${t('moreFilters')}</div>
        <div class="attr-pick">${singles.map(a => chip(a, c[a.id] || 0)).join('')}</div>` : ''}`;
  };

  openSheet(`
    <div class="sheet-title">${t('filters')}</div>

    ${withArea ? areaHtml() : ''}

    <div class="label mt-16">${t('sortBy')}</div>
    <div class="attr-pick" id="fSort">
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

    <div class="sheet-foot">
      <button class="btn btn-ghost btn-sm" id="fClear">${t('clearAll')}</button>
      <button class="btn btn-gold" id="fApply">${t('applyFilters')}</button>
    </div>
  `, (panel) => {
    const apply = panel.querySelector('#fApply');

    /* The number on the button is worked out from the choices as they are
       made, so nobody applies a filter and discovers zero. */
    const refresh = () => {
      if (!countFor) { apply.textContent = t('applyFilters'); return; }
      const n = countFor(v);
      apply.disabled = n === 0;
      apply.textContent = n === 0 ? t('noResultsTryLess') : t('showNResults').replace('{n}', n);
    };

    if (withArea) {
      panel.querySelectorAll('#fArea .chip').forEach(b => b.addEventListener('click', () => {
        v.area = b.dataset.ar;
        panel.querySelectorAll('#fArea .chip').forEach(x => x.classList.toggle('active', x === b));
        refresh();
      }));
      const loc = panel.querySelector('#fLoc');
      // no location yet: the way to get one is here, not a dead option
      if (loc) loc.addEventListener('click', () => {
        closeSheet();
        import('./screens/home.js').then(m => m.openLocationSheet());
      });
    }

    panel.querySelectorAll('#fSort .chip').forEach(b => b.addEventListener('click', () => {
      /* "Nearest" is the moment the app actually needs a location, so that
         is where it asks for one — not at launch, where iOS spends the one
         question it allows on somebody who has not seen the app yet. */
      if (b.dataset.s === 'nearest' && !S.state.geo) {
        closeSheet();
        import('./screens/home.js').then(m => m.askForLocation(() => {
          // the sort they asked for is applied once the point arrives, so
          // allowing does not leave them back where they started
          if (withArea) S.setArea(v.area);
          onApply(Object.assign({}, v, { sort: 'nearest' }));
        }));
        return;
      }
      v.sort = b.dataset.s;
      panel.querySelectorAll('#fSort .chip').forEach(x => x.classList.toggle('active', x === b));
      refresh();
    }));

    if (withAttrs) {
      const on = panel.querySelector('#fOpenNow');
      on.addEventListener('click', () => {
        v.openNow = !v.openNow;
        on.classList.toggle('active', v.openNow);
        refresh();
      });

      // attributes are multi-select and combine; picking two narrows the list
      panel.querySelectorAll('#fAttrs .chip').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.a;
        const i = v.attrs.indexOf(id);
        if (i >= 0) v.attrs.splice(i, 1); else v.attrs.push(id);
        panel.querySelectorAll(`#fAttrs .chip[data-a="${id}"]`)
          .forEach(x => x.classList.toggle('active', v.attrs.includes(id)));
        refresh();
      }));
    }

    refresh();

    apply.addEventListener('click', () => {
      if (withPrice) {
        v.priceMin = panel.querySelector('#fMin').value.trim();
        v.priceMax = panel.querySelector('#fMax').value.trim();
      }
      if (withArea) S.setArea(v.area);
      closeSheet();
      onApply(v);
    });
    panel.querySelector('#fClear').addEventListener('click', () => {
      closeSheet();
      if (withArea) S.setArea('all');
      onApply({ cat: v.cat, area: 'all', sort: 'newest', priceMin: '', priceMax: '',
                openNow: false, attrs: [] });
      toast(t('filtersCleared'), 'ok');
    });
  });
}

/** how many filters are away from their default — shown on the filter button */
export function activeFilterCount(v) {
  if (!v) return 0;
  let n = 0;
  /* The category is not counted: it has a control of its own now, printed
     on the row where the reader can already see it. A badge that repeats
     what is written beside it teaches nobody anything. */
  if (v.sort && v.sort !== 'newest') n++;
  if (v.priceMin) n++;
  if (v.priceMax) n++;
  if (v.openNow) n++;
  if (v.area && v.area !== 'all') n++;
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
 * How far away — and the one rule the whole thing rests on: **a figure in
 * miles is printed only when both points exist**, the reader's and the
 * listing's. Anything else is the area name.
 *
 * The old line read `biz.dist`, a number typed into the seed file and left
 * at 0 on all 486 imported rows. It was identical for every reader in
 * every city, which made it not a distance at all. Geocoding the addresses
 * is a data job done outside the app; until a listing has coordinates it
 * says where it is, not how far, and the moment they arrive this line
 * turns into miles by itself.
 */
export function distLabel(biz) {
  const d = S.distanceTo(biz);
  if (d != null) return `<span>${icon('mapPin', 13)} ${fmtMiles(d)} ${t('miles')}</span>`;
  const city = S.cityOf(biz);
  return city ? `<span>${icon('mapPin', 13)} ${city}</span>` : '';
}

/** 0.4 · 3.2 · 14 — a tenth of a mile matters up close and nowhere else */
export function fmtMiles(d) {
  return d < 10 ? String(Math.round(d * 10) / 10) : String(Math.round(d));
}

/**
 * The city chip. Empty until we know: a chip reading "Houston" to somebody
 * standing in Katy is the app telling them something false before they have
 * touched anything, so before there is a location it is a button asking for
 * one.
 */
export function cityChipLabel() {
  return S.userCity() || t('setLocation');
}

/**
 * A rotating ad surface that only rotates while it can actually be seen.
 *
 * The reason is commercial, not technical: an impression we sell has to be
 * an impression that happened. A banner cycling behind a scrolled page, or
 * in a backgrounded tab, inflates the number we invoice against and buys
 * us an advertiser who does not renew. So the timer runs on
 * IntersectionObserver and stops on `visibilitychange`, and a view is only
 * counted once the placement has held still on screen for a full second.
 *
 * @returns a stop() function — call it when the screen is replaced
 */
export function mountAdRotator({ host, items, interval = 7000, paint, onClick }) {
  if (!host || !items || !items.length) return () => {};
  let i = 0, timer = null, visible = false, pending = null, alive = true;

  const countable = (item) => item && item.orderId;   // house ads are not sold

  const armImpression = () => {
    clearTimeout(pending);
    const item = items[i];
    if (!countable(item)) return;
    pending = setTimeout(() => {
      if (alive && visible && document.visibilityState === 'visible') S.recordImpression(item.orderId);
    }, 1000);
  };

  const show = (n) => {
    i = (n + items.length) % items.length;
    paint(items[i], i);
    armImpression();
  };

  const start = () => {
    if (timer || items.length < 2) { armImpression(); return; }
    timer = setInterval(() => show(i + 1), interval);
    armImpression();
  };
  const stop = () => { clearInterval(timer); timer = null; clearTimeout(pending); };

  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        visible = entries.some(e => e.isIntersecting);
        if (visible && document.visibilityState === 'visible') start(); else stop();
      }, { threshold: 0.5 })
    : null;

  const onVis = () => {
    if (document.visibilityState === 'visible' && visible) start(); else stop();
  };
  document.addEventListener('visibilitychange', onVis);

  if (io) io.observe(host); else { visible = true; start(); }
  paint(items[0], 0);

  if (onClick) host.addEventListener('click', (e) => {
    const item = items[i];
    if (countable(item)) S.recordClick(item.orderId);
    onClick(item, e);
  });

  return () => {
    alive = false;
    stop();
    if (io) io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
  };
}

/* ============================================================
   "Open now" has to stay true
   ------------------------------------------------------------
   The badge used to be computed once when the screen was drawn and
   never again. A phone left in a pocket for an hour showed "closes
   within the hour" on a shop that had already shut — and a wrong
   "open now" sends somebody to a locked door, which is the fastest
   way to lose their trust in the whole directory.

   One ticker, one minute, and it repaints the badges only: repainting
   the list would move the scroll position out from under the reader.
   It stops while the page is hidden and catches up the moment it comes
   back, because "in a pocket for two hours" is the normal case.
   ============================================================ */
const minuteSubs = [];
let minuteTimer = null;

/** re-run `fn` every minute for as long as `el` is still on the page */
export function onMinute(el, fn) {
  minuteSubs.push({ el, fn });
}

/** rewrite every open/closed badge in place, wherever it is */
export function refreshOpenBadges() {
  const now = new Date();
  $$('[data-openbadge]').forEach(el => {
    const b = S.businessById(el.dataset.openbadge);
    if (b) el.innerHTML = openBadge(b, now);
  });
}

function minuteTick() {
  if (document.visibilityState !== 'visible') return;
  refreshOpenBadges();
  for (let i = minuteSubs.length - 1; i >= 0; i--) {
    const sub = minuteSubs[i];
    if (!sub.el || !document.contains(sub.el)) { minuteSubs.splice(i, 1); continue; }
    try { sub.fn(); } catch (e) { /* one screen must not stop the rest */ }
  }
}

export function startClock() {
  if (minuteTimer) return;
  minuteTimer = setInterval(minuteTick, 60000);
  // the two moments a stale badge is most likely to be looked at
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') minuteTick();
  });
  window.addEventListener('focus', minuteTick);
}

/** a badge that can be rewritten later without touching the row around it */
export function openBadgeSlot(biz, now = new Date()) {
  return `<span data-openbadge="${biz.id}">${openBadge(biz, now)}</span>`;
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
