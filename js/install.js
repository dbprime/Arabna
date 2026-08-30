/* ============================================================
   ARABNA — «أضِفه إلى شاشتك»: where the reader is standing
   ============================================================
   ⚠️ THIS FILE READS, IT NEVER GUESSES. Every answer below comes from
   something the browser states about itself — `display-mode`,
   `navigator.standalone`, the user-agent's own product tokens — and the
   two store links are constants an owner fills in, not a switch in the
   panel.

   ⚠️ AND WHY THIS IS NOT A NICETY. On iOS a web app gets NO
   notifications at all until it is on the home screen: in a Safari tab
   the count is zero however the app is written. Most of this community
   carries an iPhone, so adding the app is not a polish item — it is the
   switch that turns the strongest feature on, the day the alerts land.

   ⚠️ It imports nothing but the two constants. No DOM is touched here;
   drawing belongs to `ui.js` and to the screen. */

import { PLAY_URL, APPSTORE_URL } from './store.js';

const ua = () => (navigator.userAgent || '');

/** already on the home screen — the reader is INSIDE the installed app */
export function isStandalone() {
  try {
    if (window.matchMedia && matchMedia('(display-mode: standalone)').matches) return true;
  } catch (e) { /* an old browser simply says no */ }
  /* iOS never reported `display-mode` until 16.4 and still prefers this */
  return navigator.standalone === true;
}

export function isIos() {
  if (/iphone|ipad|ipod/i.test(ua())) return true;
  /* ⚠️ An iPad on iPadOS 13+ reports itself as a Mac. Without this line
     every iPad reader falls through to «nothing to show» — and an iPad
     is exactly the device somebody reads the directory on at home. */
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}

export function isAndroid() { return /android/i.test(ua()); }

/* ⚠️ A LIST OF NAMES, NOT A GUESS. Facebook and Instagram open links in
   their own in-app browser, and there «Add to Home Screen» does not
   exist — the reader has to open the page in the real browser first.
   That matters more here than anywhere: the likeliest way somebody in
   this community reaches the app is a tap on a link in a Facebook post,
   which is the one route where installing is impossible. Each token
   below is a product that publishes it in its own user-agent. */
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|GSA\//i;
export function inAppBrowser() { return false; }

/* ---------------- the native Android prompt ----------------
 * Chrome fires `beforeinstallprompt` and lets the page keep the event and
 * open the system dialog later. That is a real one-tap install.
 *
 * ⚠️ AND IT DOES NOT EXIST ON iOS, on purpose: Apple leaves adding to the
 * home screen to the reader, from the share sheet, and publishes no API
 * for it. So «install with one tap» on an iPhone is a button that does
 * nothing when pressed — and it is not built. */
let deferred = null;
let mounted = false;
export function mountInstallPrompt(onChange) {
  if (mounted) return;
  mounted = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();               // keep it, do not let Chrome spend it
    deferred = e;
    if (onChange) { try { onChange(); } catch (err) { /* never block */ } }
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    if (onChange) { try { onChange(); } catch (err) { /* never block */ } }
  });
}
export function canPromptNative() { return !!deferred; }
/** opens the browser's own install dialog; resolves to true if accepted */
export function promptInstall() {
  if (!deferred) return Promise.resolve(false);
  const e = deferred;
  deferred = null;                    // a captured event may be used once
  try {
    e.prompt();
    return e.userChoice.then(r => r && r.outcome === 'accepted').catch(() => false);
  } catch (err) { return Promise.resolve(false); }
}

/* ---------------- which road this reader actually has ----------------
 * ⚠️ IT DOES NOT DISAPPEAR THE DAY THE STORE OPENS — it CHANGES. The web
 * version stays after the store, and people keep arriving by link, so the
 * screen points at the best road available to the device in front of it.
 *
 *   installed  nothing at all, not one line
 *   appstore   iPhone, and APPSTORE_URL is filled in
 *   inapp      inside Facebook's or Instagram's browser — open it outside first
 *   ios        iPhone in the real browser — the three steps, with a picture
 *   play       Android, and PLAY_URL is filled in
 *   android    Android with no store link — the browser's own dialog
 *   none       a desktop, or a browser that offers no road: say nothing
 */
export function installMode() {
  if (isStandalone()) return 'installed';
  if (isIos()) {
    if (APPSTORE_URL) return 'appstore';
    if (inAppBrowser()) return 'inapp';
    return 'ios';
  }
  if (isAndroid()) {
    if (PLAY_URL) return 'play';
    if (inAppBrowser()) return 'inapp';
    return 'android';
  }
  if (canPromptNative()) return 'android';
  return 'none';
}

/** the browser the reader has to move to — a product name, never translated */
export function outerBrowser() { return isIos() ? 'Safari' : 'Chrome'; }

/* ⚠️ «none» and «installed» are the two the invite must never speak over:
   one has no road to offer, the other is already there — and inviting
   somebody who installed the app says the app does not know where it is. */
export function canInvite() {
  const m = installMode();
  return m !== 'installed' && m !== 'none';
}
