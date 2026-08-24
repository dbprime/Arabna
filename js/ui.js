/* ============================================================
   Shared UI primitives: toast, bottom sheet, drawer, header, nav
   ============================================================ */

import { icon, iconFilled } from './icons.js';
import { t, L, arCount, getLang, setLang } from './i18n.js';
import { FREE_PRICE, APP_VERSION } from './data.js';
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
  /* MERGE, never replace. The drawer keeps its token on the same entry
     (see openDrawer), and stamping a bare { key } over it wiped the token
     before the drawer's own popstate handler could read it — so Back
     closed the drawer instead of reopening it. Anything else that puts a
     field on an entry is protected by the same line. */
  try { history.replaceState(Object.assign({}, st, { key }), ''); } catch (e) { /* file:// */ }
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
  // the same entry with a different URL — keep whatever else is on it
  history.replaceState(Object.assign({}, history.state, { key }), '', hash);
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
/**
 * @param multi   true → several may be chosen and the panel STAYS OPEN.
 *                `value` is then an array of ids and `onPick` is handed the
 *                new array each time. Somebody narrowing by two or three
 *                attributes should not have to reopen the list between
 *                each one — the same reason the add-business form's
 *                attribute boxes stay open.
 */
export function openDropdown({ host, anchor, title, options, value, unit, onPick, multi }) {
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
  const chosen = multi ? new Set(value || []) : null;
  const isOn = (id) => (multi ? chosen.has(id) : id === value);
  host.innerHTML = `
    <div class="dd-panel" role="listbox" aria-label="${title}" ${multi ? 'aria-multiselectable="true"' : ''}>
      <div class="dd-head"><span>${title}</span><span class="dd-total">${total} ${word}</span></div>
      <div class="dd-scroll">
        ${options.map(o => `
          <button class="dd-row ${isOn(o.id) ? 'selected' : ''}" type="button" role="option"
                  aria-selected="${isOn(o.id)}" data-v="${o.id}">
            ${o.icon ? icon(o.icon, 18) : '<span class="dd-nogap"></span>'}
            <span class="dd-name">${esc(o.label)}</span>
            ${/* the count is the most useful thing in the sheet: it says
                 what you will find BEFORE you press */''}
            ${o.count == null ? '' : `<span class="chip-n">${o.count}</span>`}
            <span class="dd-tick">${isOn(o.id) ? icon('check', 16) : ''}</span>
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
    const id = r.dataset.v;
    if (multi) {
      // stays open: two or three choices are one gesture, not three visits
      if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
      const on = chosen.has(id);
      r.classList.toggle('selected', on);
      r.setAttribute('aria-selected', String(on));
      r.querySelector('.dd-tick').innerHTML = on ? icon('check', 16) : '';
      onPick([...chosen]);
      return;
    }
    finish(false, () => onPick(id));
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
/**
 * The silver family in the lockup is a dark-background mark: 72% of its
 * pixels measured under 2:1 against the ivory bar. Transparency solved the
 * white box behind it, not the contrast — those are two different problems.
 * So the light theme gets its own copy with the silver re-inked to the
 * logo's own navy and the gold untouched (12.73 against 1.58).
 * Never `filter: invert` — that turns the gold blue.
 */
const LOGO = {
  stacked: { dark: 'assets/logo.png',    light: 'assets/logo-ink.png'    },
  wide:    { dark: 'assets/logo-sm.png', light: 'assets/logo-sm-ink.png' },
};
export function logoSrc(kind = 'stacked') { return LOGO[kind][resolvedTheme()]; }

export function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.setAttribute('data-theme', theme);
  // the mark is a file, not a symbol, so the attribute cannot repaint it.
  // Every logo on screen carries data-logo and is swapped here, so the flip
  // is immediate and not one screen late.
  document.querySelectorAll('img[data-logo]')
    .forEach(el => el.setAttribute('src', logoSrc(el.dataset.logo)));
  /* …and the header button, for the same reason: the attribute repaints
     what a symbol coloured, it cannot redraw what was content. */
  const btn = document.querySelector('[data-theme-icon]');
  if (btn) {
    btn.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon', 22);
    btn.setAttribute('aria-label', t(theme === 'dark' ? 'themeLight' : 'themeDark'));
  }
  const bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.setAttribute('content', BAR_COLOR[theme]);
  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  // iOS reads this at launch, so it is set correctly from boot as well
  if (status) status.setAttribute('content', theme === 'light' ? 'default' : 'black-translucent');
}

/**
 * The reader's own choice, on top of their device's.
 *
 * Written as a percentage for the same reason the stylesheet's base is:
 * a percentage on the root multiplies the reader's default font size
 * instead of replacing it, so somebody who enlarged the text on their
 * phone AND picked «كبير» here gets both. An absolute px would have
 * silently thrown the first of those away.
 *
 * Called before the first screen is drawn, like applyTheme — applying it
 * afterwards gives a flash of the old size on every launch.
 */
export function applyFontScale() {
  const px = S.fontScale();
  document.documentElement.style.fontSize = (px / 16 * 100) + '%';
}

export function setFontScale(px) {
  S.setFontScale(px);
  applyFontScale();
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

/* ============================================================
   The ad block that every section carries
   ------------------------------------------------------------
   Read top to bottom, each section is the same shape:

       slider          — rotates; the house slide when nothing is sold
       sponsored ×2    — labelled, from the chosen category
       the content

   Two sponsored rows and never three: a first screen that is all
   advertising teaches the reader to scroll past it, and a slot nobody
   looks at is a slot nobody renews. Scarcity is the thing being sold.
   ============================================================ */

/**
 * The slider markup for one section — an advertiser's slide when there is
 * one, the house's when there is not.
 *
 * The two are NOT interchangeable: an advertiser's ground is their own
 * colour and does not follow the theme, so its ink is fixed (`--ad-cta`);
 * the house slide sits on our own surface, which does follow, so its ink
 * must follow too (`--text`). Mixing them is the fault fixed in ce0fc77.
 */
export function sectionSlider(ads, { product, sectionName }) {
  if (ads && ads.length) {
    return `<div class="slider"><div class="slider-track" id="secTrack">
        ${ads.map((a, i) => `<div class="slide ${i === 0 ? 'active' : ''}" data-route="${esc(a.link || '#/home')}" style="background:${esc(a.color)}">
          <span class="slide-badge">${t('sponsored')}</span>
          <div class="slide-title">${L(a.name)}</div>
          <div class="slide-sub">${L(a.tag)}</div>
          <div class="slide-cta">${L(a.cta)} ${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</div>
          <div class="slide-icon">${icon(a.icon, 86)}</div>
        </div>`).join('')}
      </div>
      <div class="slider-dots" id="secDots">${ads.map((_, i) =>
        `<span class="dot-i ${i === 0 ? 'active' : ''}"></span>`).join('')}</div>
    </div>`;
  }
  /* Nothing sold. The house slide is how a shop owner learns the slot is
     for sale at all — without it the section reads as having no room for
     advertising, and nobody asks. */
  return `<div class="slider"><div class="slider-track">
      <div class="slide slide-house active" data-route="#/advertise/${product}">
        <div style="color:var(--gold);margin-bottom:6px">${icon('megaphone', 31)}</div>
        <div class="slide-title">${t('adCtaSection').replace('{sec}', sectionName)}</div>
        <div class="slide-sub" style="color:var(--text-2)">${t('adCtaSub')}</div>
        <div class="slide-cta cta-center">${icon('plus', 17)} ${t('continueAction')}</div>
      </div>
    </div></div>`;
}

/**
 * The two sponsored rows. Each `row` is `{ id, route, icon, img, title, sub }`.
 * Nothing is drawn when the pool is empty — an empty labelled band is worse
 * than no band.
 */
export function sponsoredRows(rows) {
  if (!rows || !rows.length) return '';
  return `<div class="spon-block">${rows.map(r => `
    <div class="list-row spon" data-route="${esc(r.route)}">
      ${r.img ? `<span class="row-ico shot"><img src="${esc(r.img)}" alt="" loading="lazy" /></span>`
              : `<span class="row-ico">${icon(r.icon || 'megaphone', 22)}</span>`}
      <div class="row-main">
        <div class="row-title">${esc(r.title)}<span class="badge badge-sponsored">${t('sponsored')}</span></div>
        ${/* the icon comes from the ROW, because an icon is not data. There
             is deliberately no `subHtml` field beside it: an unescaped
             field in a row that prints names people type is the same
             injection six months from now, by our own hand. */''}
        ${r.sub ? `<div class="row-sub">${r.subIcon ? icon(r.subIcon, 13) : ''} ${esc(r.sub)}</div>` : ''}
      </div>
      <span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 19)}</span>
    </div>`).join('')}</div>`;
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
      <div class="h-title">${esc(opts.title || '')}</div>
      <span class="h-spacer" aria-hidden="true"></span>`;
    $('#hBack').addEventListener('click', () => opts.onBack ? opts.onBack() : back());
  } else {
    /* menu on one side, the light/dark flip on the other. The button is
       44px and the spacer it replaces was 44px, so nothing moved; and the
       logo is absolutely placed on the middle of the header, so it never
       depended on what stands beside it. No direction code here — flex and
       `dir` swap the two corners by themselves, and an `if (rtl)` would
       only ever be right in one language. */
    const dark = resolvedTheme() === 'dark';
    head.innerHTML = `
      <button class="icon-btn" id="hMenu" aria-label="menu">${icon('menu', 24)}${S.isMember() && S.unreadCount() ? '<span class="dot"></span>' : ''}</button>
      <img class="h-logo" data-logo="stacked" src="${logoSrc('stacked')}" alt="ARABNA عربنا" />
      <button class="icon-btn" id="hTheme" data-theme-icon
        aria-label="${t(dark ? 'themeLight' : 'themeDark')}">${icon(dark ? 'sun' : 'moon', 22)}</button>`;
    $('#hMenu').addEventListener('click', openDrawer);
    /* No toast here, and the rule behind that: NOTHING confirms in words
       what the reader is watching happen. The whole screen just changed
       colour and the icon flipped sun ↔ moon — two confirmations already,
       without a word. The bar also stood over the logo, hiding ARABNA
       every single time somebody switched. What still earns a toast is
       what leaves no mark: «تم حفظ ملفك», «تم نسخ الرابط». */
    $('#hTheme').addEventListener('click', () => {
      setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
    });
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
    ? `<button class="nav-item nav-add" id="navAdd"><span class="nav-post">${icon('plus', 28)}</span><span>${esc(i.label)}</span></button>`
    : `<button class="nav-item ${active === i.id ? 'active' : ''}" data-route="${i.route}">${icon(i.ico, 25)}<span>${esc(i.label)}</span></button>`
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

/* ------------------------------------------------------------
   BACK, FROM INSIDE THE DRAWER

   The drawer records nothing in history: it is a layer painted
   over the screen and wiped, and the browser never hears about
   it. So «directory → drawer → cafés» left the history reading
   [directory, cafés], and Back went to the directory — right by
   the browser's reckoning and wrong by the reader's, who is
   still standing in the list they picked from and wants the row
   next to the one they chose. Worse, Back with the drawer OPEN
   left the screen entirely while the drawer was still, in their
   mind, in front of them.

   The dropdown panels already solve exactly this, with ONE
   history entry and a token in history.state, so the drawer uses
   the same mechanism rather than a second one — two things
   fighting over history is the bug that has been fixed three
   times in this project already.

   The whole file turns on the difference between two functions:

     closeDrawer()  ✕ · a tap outside · language · sign-out
                    → WINDS the entry back, as if it never opened
     hideDrawer()   choosing a route
                    → LEAVES it, so Back reopens the drawer with
                      its group still open

   `openGroup` already survives a close, so the group comes back
   open on its own — the entry was the only missing half.
   ------------------------------------------------------------ */
/* The entry carries the mark, not a variable. Setting `location.hash`
   fires a spec-mandated `popstate` with a null state BEFORE `hashchange`
   (the fragment-navigation algorithm does both, in that order) — so a
   handler that tore its own bookkeeping down on the first pop it saw
   destroyed the entry at the moment a route was picked, which is the one
   moment the entry has to survive. Reading `history.state.drawer` instead
   makes that stray pop harmless: it is not a drawer entry, so the drawer
   is hidden, and nothing else happens.

   The entry is stamped with the CURRENT key, so it is the same page as far
   as scroll memory is concerned and Back lands on the directory where it
   was left. */

/** does history currently sit on a drawer entry? */
export function drawerOwnsEntry() {
  try { return !!(history.state && history.state.drawer); }
  catch (e) { return false; }        // file://
}

/* One listener, mounted once, for the life of the app: decide by WHERE we
   are in history, never by whether the drawer looks open. */
function onDrawerPop() {
  if (drawerOwnsEntry()) openDrawer();
  else hideDrawer();
}
let drawerPopWired = false;

/** visual only: the panel goes, the history entry stays behind */
export function hideDrawer() {
  const root = $('#drawer');
  if (!root) return;
  root.classList.remove('open');
  root.setAttribute('aria-hidden', 'true');
  const seq = drawerSeq;
  setTimeout(() => { if (seq === drawerSeq) root.innerHTML = ''; }, 340);
}

export function openDrawer() {
  drawerSeq++;
  /* One open layer at a time. A dropdown hands its entry over instead of
     leaving a second one behind — 'abandon' forgets it without winding it,
     because the drawer is about to push its own. */
  if (openDD) openDD.close(true);

  if (!drawerPopWired) { window.addEventListener('popstate', onDrawerPop); drawerPopWired = true; }
  /* Never a second entry: reopening from a pop is already standing on one,
     and ten opens and closes must still be one Back. */
  if (!drawerOwnsEntry()) {
    try { history.pushState({ key: historyKey(), drawer: 1 }, ''); } catch (e) { /* file:// */ }
  }
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
  /* الدليل and السوق are permanent tabs in the bottom bar; listing them
     here as well made the drawer a second copy of the nav. «إعلانات
     مميّزة» takes their place — and only when there is something behind
     it. A row that opens an empty list reads as a broken app, so with no
     subscriber yet it says «قريباً» and does not navigate. */
  const anyFeatured = S.featuredBusinesses().length > 0;
  const sections = [
    /* Prayer times sit inside the sections group, not in the bottom bar:
       the bar has five slots and every one of them is spoken for. */
    item('moon', t('prayerTitle'), '#/prayer'),
    /* Directly under it and in the same group, in the same weight and the
       same font. «مواعيد القداس» and «مواقيت الصلاة» are two lines of one
       shape: putting this in another group would make it an appendix, and
       putting it above would reverse an order with no reason to reverse. */
    item('church', t('massTitle'), '#/mass'),
    item('compass', t('ncTitle'), '#/newcomer'),
    item('calendar', t('eventsTitle'), '#/events'),
    item('newspaper', t('magazineTitle'), '#/magazine'),
    anyFeatured
      ? item('crown', t('drFeatured'), '#/directory?featured=1')
      : `<button class="dr-item dr-soon" disabled aria-disabled="true">${icon('crown', 22)}
           <span>${t('drFeatured')}</span><span class="soon-tag">${t('soon')}</span></button>`,
    item('grid', t('allCategories'), '#/categories'),
  ].join('');

  const help = [
    item('help', t('help'), '#/help'),
    item('info', t('about'), '#/about'),
    item('shield', t('privacy'), '#/privacy'),
    item('file', t('terms'), '#/terms'),
  ].join('');

  /* The light/dark flip lives in the header corner now, not here: the same
     action in two places is the duplication banned everywhere else, and a
     corner is plainer than a drawer you have to open. */
  const head = member ? `
      <div class="drawer-head">
        <img data-logo="wide" src="${logoSrc('wide')}" alt="ARABNA" />
        <div style="font-weight:700">${esc(u.name)}</div>
        <div class="drawer-user">${esc(u.email)} · ${tierLabel}</div>
      </div>` : `
      <div class="drawer-head">
        <img data-logo="wide" src="${logoSrc('wide')}" alt="ARABNA" />
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
      <div class="dr-version">ARABNA · عربنا — ${t('version')} ${APP_VERSION}</div>
    </aside>`;

  root.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => root.classList.add('open'));
  root.querySelector('[data-close]').addEventListener('click', () => closeDrawer());

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

  /* hideDrawer, not closeDrawer: the entry stays, so Back lands on it and
     the drawer opens again with the same group expanded. */
  $$('#drawer [data-route]').forEach(b => b.addEventListener('click', () => { hideDrawer(); go(b.dataset.route); }));
  // nobody wants Back to return them to a drawer after switching language
  const dl = $('#drLang'); if (dl) dl.addEventListener('click', () => { closeDrawer(); toggleLang(); });
  const out = $('#drOut');
  if (out) out.addEventListener('click', () => {
    closeDrawer();
    confirmSheet({ title: t('signOut'), sub: '', confirmText: t('signOut'), danger: true, onConfirm: () => { S.signOut(); toast(t('done'), 'ok'); go('#/home'); } });
  });
}
/**
 * Closed on purpose — the ✕, a tap outside, the language, signing out.
 * The history entry is wound back, so Back goes on to wherever the reader
 * was before the drawer, and a drawer closed deliberately never reappears.
 *
 * Winding it back is what makes a deliberate close different from
 * picking a route: hideDrawer() leaves the entry, so Back reopens the
 * drawer with its group still expanded; closeDrawer() takes the entry
 * with it, so Back carries on past it.
 */
export function closeDrawer() {
  const ours = drawerOwnsEntry();
  hideDrawer();
  if (ours) { try { history.back(); } catch (e) { /* file:// */ } }
}

/* ---------------- small builders ---------------- */
/**
 * The one escape in the project. Everything else was five copies of it in
 * five screens plus a sixth in the admin panel that guarded the quote and
 * nothing else — so the protection existed and was not binding, and the
 * fifth screen written after them had none at all.
 *
 * THE RULE, and it is not a matter of judgement: **every value that was
 * not written in `i18n.js` goes through `esc()` before it reaches
 * `innerHTML`.** A name, an address, a description, a tag, a review and
 * its author, a search term, an offer, a price somebody typed, anything
 * off a form, anything off the URL. `t()` and `icon()` are ours and do
 * not; a number we computed does not.
 *
 * The apostrophe is escaped too, so the same function is safe inside a
 * single-quoted attribute as well as a double-quoted one — one function
 * that is right in every position beats two the caller has to choose
 * between.
 */
export function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
/**
 * "$49", and it stays "$49" inside Arabic text. The dollar sign is a
 * neutral character, so in an RTL run the bidi algorithm puts it after the
 * digits and the reader sees "49$". The two invisible isolate marks
 * (U+2066 … U+2069) fix that at the source, so no call site has to
 * remember a wrapper — and they cost nothing in English.
 */
export function fmtMoney(n) {
  const v = Number(n);
  return '\u2066$' + (isFinite(v) ? v : 0).toLocaleString('en-US') + '\u2069';
}

/** the same isolate for a price we did not format ourselves ("$14,500") */
export function ltr(txt) {
  const s = String(txt == null ? '' : txt);
  return s ? '\u2066' + s + '\u2069' : s;
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
/* The sheet's own picker ids carry an `f` prefix. The directory's top row
   already owns `#ctlSort`, and a second element with the same id meant
   `setPickerValue('ctlSort', …)` wrote the sheet's choice onto the row
   BEHIND the sheet and left the sheet's own button reading the old value.
   Two controls doing the same job may share a shape; they may not share
   an id. */
export function openFilterSheet({ cat, cats, value, withPrice, withAttrs, withArea, countFor, onApply }) {
  const v = Object.assign({ cat: cat || 'all', area: 'all', sort: 'newest',
                            priceMin: '', priceMax: '', openNow: false,
                            hasOffer: false, attrs: [] }, value);
  v.attrs = (v.attrs || []).slice();
  const sorts = [['newest', t('sortNewest')]]
    .concat(S.inCoverage() ? [['nearest', t('sortNearest')]] : [])
    .concat([['rated', t('sortTopRated')]])
    .concat(withAttrs ? [['open', t('sortOpen')]] : []);
  const catFor = () => (v.cat === 'all' ? '*' : v.cat);

  const counts = () => S.attrCountsFor(catFor());
  const offerCount = () => S.allBusinesses()
    .filter(b => (v.cat === 'all' || b.cat === v.cat) && S.hasOffers(b)).length;

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
    /* «كل المنطقة» answered no question — all of Texas? all of America?
       — and the app already had the right words, which
       reads «Houston والمنطقة» since V.03.3 and is used everywhere else.
       Two lines now explain the difference by themselves:
         Houston            376
         Houston والمنطقة   514 */
    const opts = [{ id: 'all', label: regionAllLabel() }];
    if (S.hasLocation()) opts.push({ id: 'city', label: S.userCity() || t('areaCity') });
    if (S.radiusUsable()) [5, 10, 25, 50].forEach(r => opts.push({ id: String(r), label: `${r} ${t('miles')}` }));
    return opts.map(o => Object.assign(o, { n: pool.filter(b => S.inArea(b, o.id)).length }));
  };

  const areaLabel = () => {
    const o = areaOptions().find(x => x.id === String(v.area));
    return o ? o.label : regionAllLabel();
  };
  const areaHtml = () => `
    <div class="label mt-16">${t('areaTitle')}</div>
    ${pickerBtn({ id: 'fCtlArea', label: t('areaTitle'), value: areaLabel(), wide: true })}
    <div id="fDdArea"></div>
    ${S.hasLocation() ? '' : `<button class="btn btn-ghost btn-sm btn-block mt-8" id="fLoc">${icon('navigation', 16)} ${t('setLocation')}</button>`}`;

  const attrSets = () => {
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

    /* Sixteen options across five headed groups was two screens of
       scrolling. They collapse into two multi-select pickers — the
       shortcut list, and everything else — each staying open while the
       reader picks and each carrying the per-option count, which is the
       most useful thing on the sheet. */
    const rest2 = rest.reduce((all, g) => all.concat(g.attrs), []);
    const opt = (a) => ({ id: a.id, label: t(a.key), icon: a.icon, count: c[a.id] || 0 });
    return { top: top.map(opt), rest: rest2.map(opt) };
  };

  const attrCounts = () => attrSets();
  let sets = { top: [], rest: [] };
  const chosenLabel = (ids, pool) => {
    const n = ids.filter(id => pool.some(o => o.id === id)).length;
    if (!n) return t('attrPickNone');
    if (n === 1) {
      const one = pool.find(o => o.id === ids.find(i => pool.some(x => x.id === i)));
      return one ? one.label : t('attrPickNone');
    }
    return t('attrPickN').replace('{n}', n);
  };
  const attrHtml = () => {
    sets = attrCounts();
    return `
      ${sets.top.length ? `<div class="label mt-16">${t('mostUsed')}</div>
        ${pickerBtn({ id: 'fCtlTop', label: t('mostUsed'), value: chosenLabel(v.attrs, sets.top), wide: true })}
        <div id="fDdTop"></div>` : ''}
      ${sets.rest.length ? `<div class="label mt-16">${t('moreFilters')}</div>
        ${pickerBtn({ id: 'fCtlRest', label: t('moreFilters'), value: chosenLabel(v.attrs, sets.rest), wide: true })}
        <div id="fDdRest"></div>` : ''}`;
  };

  openSheet(`
    <div class="sheet-title">${t('filters')}</div>

    ${withArea ? areaHtml() : ''}

    <div class="label mt-16">${t('sortBy')}</div>
    ${pickerBtn({ id: 'fCtlSort', label: t('sortBy'),
                  value: (sorts.find(x => x[0] === v.sort) || sorts[0])[1], wide: true })}
    <div id="fDdSort"></div>

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
        ${/* offered only when somebody is actually running one — the standing
             rule that a filter never returns nothing */''}
        ${offerCount() ? `<button class="chip ${v.hasOffer ? 'active' : ''}" id="fHasOffer">${icon('tag', 14)} ${t('offerHas')} <span class="chip-n">${offerCount()}</span></button>` : ''}
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
      apply.textContent = n === 0 ? t('noResultsTryLess')
        : t('showNResults').replace('{c}', arCount(n, t('plResult')));
    };

    if (withArea) {
      const aBtn = panel.querySelector('#fCtlArea');
      aBtn.addEventListener('click', () => openDropdown({
        host: panel.querySelector('#fDdArea'), anchor: aBtn, title: t('areaTitle'),
        options: areaOptions().map(o => ({ id: o.id, label: o.label, icon: 'mapPin', count: o.n })),
        value: String(v.area), unit: 'ddCity',
        onPick: (id) => { v.area = id; setPickerValue('fCtlArea', areaLabel()); refresh(); },
      }));
      const loc = panel.querySelector('#fLoc');
      // no location yet: the way to get one is here, not a dead option
      if (loc) loc.addEventListener('click', () => {
        closeSheet();
        import('./screens/home.js').then(m => m.openLocationSheet());
      });
    }

    const sBtn = panel.querySelector('#fCtlSort');
    sBtn.addEventListener('click', () => openDropdown({
      host: panel.querySelector('#fDdSort'), anchor: sBtn, title: t('sortBy'),
      options: sorts.map(([id, lbl]) => ({ id, label: lbl, icon: 'filter' })),
      value: v.sort, unit: 'dd',
      onPick: (id) => {
        /* "Nearest" is the moment the app actually needs a location, so that
           is where it asks for one — not at launch, where iOS spends the one
           question it allows on somebody who has not seen the app yet. */
        if (id === 'nearest' && !S.state.geo) {
          closeSheet();
          import('./screens/home.js').then(m => m.askForLocation(() => {
            // the sort they asked for is applied once the point arrives, so
            // allowing does not leave them back where they started
            if (withArea) S.setArea(v.area);
            onApply(Object.assign({}, v, { sort: 'nearest' }));
          }));
          return;
        }
        v.sort = id;
        setPickerValue('fCtlSort', (sorts.find(x => x[0] === id) || sorts[0])[1]);
        refresh();
      },
    }));

    if (withAttrs) {
      const on = panel.querySelector('#fOpenNow');
      on.addEventListener('click', () => {
        v.openNow = !v.openNow;
        on.classList.toggle('active', v.openNow);
        refresh();
      });
      const off = panel.querySelector('#fHasOffer');
      if (off) off.addEventListener('click', () => {
        v.hasOffer = !v.hasOffer;
        off.classList.toggle('active', v.hasOffer);
        refresh();
      });

      // attributes are multi-select and combine; picking two narrows the list
      /* Two multi-select pickers, each staying open while the reader
         chooses — attributes combine, and picking three should be one
         gesture rather than three visits to the same list. */
      const wireAttr = (btnId, hostId, pool, titleKey) => {
        const btn = panel.querySelector('#' + btnId);
        if (!btn) return;
        btn.addEventListener('click', () => openDropdown({
          host: panel.querySelector('#' + hostId), anchor: btn, title: t(titleKey),
          options: pool(), value: v.attrs.slice(), unit: 'ddAttr', multi: true,
          onPick: (ids) => {
            // keep whatever is chosen in the OTHER picker's pool untouched
            const mine = new Set(pool().map(o => o.id));
            v.attrs = v.attrs.filter(a => !mine.has(a)).concat(ids.filter(a => mine.has(a)));
            setPickerValue(btnId, chosenLabel(v.attrs, pool()));
            refresh();
          },
        }));
      };
      wireAttr('fCtlTop', 'fDdTop', () => sets.top, 'mostUsed');
      wireAttr('fCtlRest', 'fDdRest', () => sets.rest, 'moreFilters');
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
                openNow: false, hasOffer: false, attrs: [] });
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
  /* …and neither is the sort, for exactly the same reason: it has its own
     picker printing the chosen value in gold, and ordering 514 results
     differently is not filtering them. Choosing «الأعلى تقييماً» made the
     badge read 1 over a list that had not lost a single row. */
  if (v.priceMin) n++;
  if (v.priceMax) n++;
  if (v.openNow) n++;
  if (v.hasOffer) n++;
  if (v.area && v.area !== 'all') n++;
  n += (v.attrs || []).length;
  return n;
}

/** Price as shown to the user — Free-section listings never show a number. */
export function priceLabel(price) {
  return price === FREE_PRICE ? t('priceFree') : (price ? ltr(price) : '');
}

/**
 * Status pill for a marketplace listing.
 * Pending always shows; "published" only on the owner's own screens.
 */
export function statusBadgeHtml(c, showLive = false) {
  if (!c) return '';
  if (c.status === 'pending') return `<span class="badge badge-pending">${icon('clock', 12)}${t('statusPending')}</span>`;
  // hidden is the owner's own doing, so it is marked plainly, not as an error
  if (c.status === 'hidden') return `<span class="badge badge-free">${icon('eye', 12)}${t('statusHidden')}</span>`;
  if (showLive) return `<span class="badge badge-verified">${icon('check', 12)}${t('statusLive')}</span>`;
  return '';
}

/** query params from the hash: #/directory?cat=cars → { cat: 'cars' } */
/* ============================================================
   Opening hours — display
   ============================================================ */

/**
 * "17:30" → "5:30 م" / "5:30pm". Storage stays 24-hour; only the label
 * changes. The digits are Latin in both languages: the address, the phone
 * and the price on the same screen are Latin already, so an Arabic-Indic
 * clock beside them reads as a typo rather than as a translation.
 */
export function fmtTime(hhmm) {
  const [H, M] = String(hhmm).split(':').map(Number);
  if (H === 24 || (H === 0 && M === 0)) return getLang() === 'ar' ? '12:00 ص' : '12:00am';
  const suffix = H < 12 ? t('am') : t('pm');
  const h12 = H % 12 === 0 ? 12 : H % 12;
  const body = `${h12}:${String(M).padStart(2, '0')}`;
  return getLang() === 'ar' ? `${body} ${suffix}` : `${body}${suffix}`;
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
export function distLabelHtml(biz) {
  const d = S.distanceTo(biz);
  if (d != null) return `<span>${icon('mapPin', 13)} ${fmtMiles(d)} ${t('miles')}</span>`;
  const city = S.cityOf(biz);
  return city ? `<span>${icon('mapPin', 13)} ${city}</span>` : '';
}

/**
 * The same answer as plain text — «3.2 ميل» or «Houston», not one tag.
 *
 * THE RULE, and the fault that wrote it: a function returning HTML ends
 * its name in `Html`; anything else returns text and may pass through
 * `esc()` safely. `distLabel` returned markup, said nothing about it in
 * its name, and was handed to `sponsoredRows` as a text field — where
 * `esc()` correctly escaped it and printed `<svg …>` under the name of
 * every sponsored business on the most-opened screen in the app.
 *
 * Every link in that chain was right and the result was wrong, so the
 * fix is the name and the shape, never `esc()`. Deleting the escape from
 * that row would have opened an injection hole in the one row that
 * prints names people type — the fast-looking wrong answer.
 */
export function distText(biz) {
  const d = S.distanceTo(biz);
  if (d != null) return `${fmtMiles(d)} ${t('miles')}`;
  return S.cityOf(biz) || '';
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
/**
 * Three states, not two. A point can arrive without a name — the device
 * gives coordinates, the naming server may never answer — and in that
 * case «حدّد موقعك» is wrong: the location IS set, every distance and
 * every prayer time is being computed from it. «موقعك الحالي» says
 * exactly what is true. No invented city name, and no «unknown».
 */
/**
 * Four states, and the fourth is new. A city the device found and a city
 * the reader typed both read «Houston», so nothing on screen said which
 * one is live and which is pinned — and a pinned city is precisely the
 * one that will not follow you. «Houston · تلقائي» says it follows.
 */
/**
 * FOR SOMEBODY WHO OPENED THE APP FROM OUTSIDE THE COVERED AREAS.
 *
 * Measured with the point in Beebe, Arkansas — about 450 miles out:
 * `#/prayer` and `#/mass` each said so in a line, and Home and the
 * directory said nothing at all. So the reader saw their own town on the
 * chip and a directory entirely of somewhere else, with no sentence
 * saying why. It gets worse the day coordinates land: «450 ميلاً» under
 * every name is a true number and a meaningless one.
 *
 * NOT ONE AREA IS NAMED IN THIS TEXT. With one region the sentence would
 * read; with three it nags; with six nobody reads it — and a message that
 * grows every time the project succeeds is wrong from the start. The
 * names live in a sheet that opens, never in the sentence. Its length
 * never changes.
 *
 * And it never hides or empties the directory. Somebody in Dallas
 * visiting Houston next month has every right to read it. THE MESSAGE
 * EXPLAINS; IT DOES NOT BLOCK.
 */
export function outsideBoxHtml() {
  if (S.inCoverage()) return '';
  return `<div class="outside-box" id="outBox">
    <div class="outside-head">${icon('mapPin', 18)}<b>${t('outsideTitle')}</b></div>
    <div class="outside-body">${t('outsideBody')}</div>
    <button class="outside-btn" id="outPick">${t('pickRegion')}
      ${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 16)}</button>
  </div>`;
}

export function mountOutsideBox(root, after) {
  const btn = (root || document).querySelector('#outPick');
  if (btn) btn.addEventListener('click', () => openRegionSheet(after));
}

/**
 * The areas, and nothing else.
 *
 * NO CITY IN THIS SHEET, no arrow, no list beneath a name — Rai's second
 * correction, and the reason is exact: somebody outside Houston does not
 * know Katy from Sugar Land, and twenty-five suburbs mean nothing to them.
 * The existing city sheet stays exactly as it is for readers inside the
 * coverage; this is a second sheet with a second purpose. That one picks a
 * city, this one picks a whole area.
 */
export function openRegionSheet(after) {
  const regions = S.regionsWithCounts();
  openSheet(`
    <div class="sheet-title">${t('regionsTitle')}</div>
    <div class="sheet-sub">${t('regionsSub')}</div>
    <div class="list mt-12">
      ${regions.map(r => `
        <button class="list-row" data-region="${esc(r.id)}">
          <span class="row-ico">${icon('mapPin', 20)}</span>
          <span class="row-main"><span class="row-title">${esc(r.name)}</span></span>
          <span class="chip-n">${arCount(r.n, t('plBiz'))}</span>
        </button>`).join('')}
    </div>
  `, (panel) => {
    panel.querySelectorAll('[data-region]').forEach(b => b.addEventListener('click', () => {
      S.setUserRegion(b.dataset.region);
      closeSheet();
      if (typeof after === 'function') after();
      else window.dispatchEvent(new HashChangeEvent('hashchange'));
    }));
  });
}

/** «Houston والمنطقة» — built from the region, never typed with a city in it */
export function regionAllLabel() {
  return t('regionAll').replace('{r}', S.regionNameOf(S.currentRegion()));
}

export function cityChipLabel() {
  const c = S.userCity();
  /* THE CITY NAME ALONE. How we arrived at it — by hand or from the device
     — is internal: `askToMove` and `shouldRefreshGeo` read it, and it is
     not printed on a button in the header. `cityIsManual()` is untouched
     and still does its work; it simply no longer writes itself on screen. */
  if (c) return c;
  return S.state.geo ? t('locNameUnknown') : t('setLocation');
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
    if (b) el.innerHTML = openBadgeHtml(b, now);
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
export function openBadgeSlotHtml(biz, now = new Date()) {
  return `<span data-openbadge="${biz.id}">${openBadgeHtml(biz, now)}</span>`;
}

export function openBadgeHtml(biz, now = new Date()) {
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
export function bizBadgeHtml(b) {
  if (!S.businessVerified(b)) return '';
  return `<span class="badge badge-bizverified" title="${t('bizVerified')}">${icon('checkCircle', 12)}${t('bizVerified')}</span>`;
}

/** the attribute pills shown under a business description */
export function attrChipsHtml(biz) {
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
/* ============================================================
   DIRECTIONS — ask once, then never again
   ------------------------------------------------------------
   It used to decide for the owner of the phone: anything Apple
   opened Apple Maps, even for somebody who has used Google Maps
   every day of their life.

   And the thing to know before designing this: NO WEB APP CAN
   SEE WHAT IS INSTALLED on a phone. The platforms forbid it —
   otherwise any website could read your app list. So there is
   nothing to detect. Offer the choice and let the owner decide.

   All three are WEB links, never app schemes: a web link opens
   the app when it is there and the site when it is not, while
   `waze://` on a phone without Waze gives a white screen.

   The address goes as text, never coordinates: a street address
   opens the right business card, a point opens a spot in space.
   ============================================================ */
export const MAP_APPS = ['google', 'apple', 'waze'];

export function mapUrl(app, address) {
  const q = encodeURIComponent(address);
  if (app === 'apple') return `https://maps.apple.com/?q=${q}`;
  if (app === 'waze') return `https://waze.com/ul?q=${q}&navigate=yes`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Apple Maps is not offered on Android: an option that cannot work is
    worse than one option fewer. Waze is offered everywhere — its presence
    cannot be known, and the link degrades to the website. */
export function mapChoices() {
  const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  return MAP_APPS.filter(a => a !== 'apple' || isApple);
}

export function openMaps(address) {
  const saved = S.mapsApp();
  if (saved) { window.open(mapUrl(saved, address), '_blank'); return; }
  openMapSheet(address);
}

export function openMapSheet(address) {
  const apps = mapChoices();
  let pick = apps[0];                       // Google first, and preselected
  openSheet(`
    <div class="sheet-title">${t('mapsOpenIn')}</div>
    <div id="mapPick">
      ${apps.map(a => `<button class="pick-row ${a === pick ? 'active' : ''}" data-app="${a}">
        <span class="pick-dot"></span><span>${t('maps' + a[0].toUpperCase() + a.slice(1))}</span>
      </button>`).join('')}
    </div>
    <label class="consent-row" style="margin-top:10px">
      <input type="checkbox" id="mapAlways" />
      <span>${t('mapsAlways')}</span>
    </label>
    <div class="sheet-foot">
      <button class="btn btn-gold btn-block" id="mapGo">${t('directions')}</button>
    </div>
  `, (panel) => {
    panel.querySelectorAll('#mapPick .pick-row').forEach(b => b.addEventListener('click', () => {
      pick = b.dataset.app;
      panel.querySelectorAll('#mapPick .pick-row').forEach(x => x.classList.toggle('active', x === b));
    }));
    panel.querySelector('#mapGo').addEventListener('click', () => {
      if (panel.querySelector('#mapAlways').checked) S.setMapsApp(pick);
      closeSheet();
      window.open(mapUrl(pick, address), '_blank');
    });
  });
}

/**
 * Share, and say only what actually happened.
 *
 * `clipboard.writeText` returns a PROMISE, so the `try/catch` around it
 * caught nothing — the rejection escaped as an uncaught error — and the
 * toast sat outside any `then`, so «تم نسخ الرابط» appeared whether the
 * clipboard had been written or not. On a desktop browser without
 * `navigator.share`, or on any page that is not a secure context, the
 * reader was told the link was copied and pasted nothing.
 *
 * A share button that lies is worse than one that is missing: the reader
 * finds out in somebody else's chat window.
 *
 * The last resort is not an apology — it is the link, selected, so it can
 * be copied by hand. That is the project's rule about dead ends.
 */
export function shareItem(title, url) {
  if (navigator.share) { navigator.share({ title, url }).catch(() => {}); return; }
  if (!navigator.clipboard || !navigator.clipboard.writeText) { promptCopy(url); return; }
  navigator.clipboard.writeText(url)
    .then(() => toast(t('linkCopied'), 'ok'))
    .catch(() => promptCopy(url));
}

/** the link itself, selected and ready — never a toast about a failure */
function promptCopy(url) {
  openSheet(`
    <div class="sheet-title">${t('copyTitle')}</div>
    <div class="sheet-sub">${t('copySub')}</div>
    <input class="input ltr mt-12" id="cpUrl" readonly value="${esc(url)}" />
    <button class="btn btn-ghost btn-block mt-12" data-close>${t('close')}</button>
  `, (panel) => {
    const el = panel.querySelector('#cpUrl');
    if (el) { el.focus(); el.select(); }
    panel.querySelector('[data-close]').addEventListener('click', closeSheet);
  });
}

export { L, t, arCount, icon };
