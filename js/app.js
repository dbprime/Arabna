/* ============================================================
   ARABNA — router / bootstrap
   ============================================================ */

import { setLang, bothPacks } from './i18n.js';
import { state, registerStrings, runReminders, runSubscriptionCycle,
         liveGreeting, markGreetingSeen, noteVisit, requestPersistence } from './store.js';
import { $, renderHeader, renderNav, hideNav, closeSheet, hideDrawer, drawerOwnsEntry, closeDropdown,
         mountScrollMemory, restoreScroll, historyKey, markShown, startClock, mountAdShare,
         applyTheme, applyFontScale, mountThemeWatch, openGreeting, sheetOpen,
         mountServiceWorker, mountInstallInvite, hideInstallInvite } from './ui.js';

import { OffersScreen, HomeScreen, mountGeoRefresh } from './screens/home.js';
import { CategoriesScreen } from './screens/categories.js';
import { EventsScreen, EventScreen, EventFormScreen } from './screens/events.js';
import { DirectoryScreen, ListingScreen, AddBusinessScreen, ClaimScreen, SubscribeScreen,
         SubscribeConsentScreen, MySubscriptionScreen,
         BusinessEditScreen, BusinessPhotosScreen, BusinessVerifyScreen } from './screens/directory.js';
import { MarketplaceScreen, ListingDetailScreen, PostScreen, BoostScreen, MessagesScreen } from './screens/marketplace.js';
import { NewcomerScreen, MagazineScreen, ArticleScreen } from './screens/magazine.js';
import { ReceiptsScreen, ReceiptScreen } from './screens/receipts.js';
import { ProfileScreen, EditProfileScreen, ChangePasswordScreen, SavedScreen, MyAdsScreen, MyRequestsScreen,
         MyBusinessScreen, MyReviewsScreen, SettingsScreen, NotificationsScreen, InstallScreen,
         HelpScreen, AboutScreen, PrivacyScreen, TermsScreen, BlockedScreen } from './screens/profile.js';
import { SignUpScreen, SignInScreen, EmailVerifyScreen, PhoneVerifyScreen, ForgotScreen } from './screens/auth.js';
import { AdvertiseScreen } from './screens/advertise.js';
import { PrayerScreen } from './screens/prayer.js';
import { MassScreen } from './screens/mass.js';
import { mountInstallPrompt } from './install.js';

/* One module, fetched once and remembered. The panel repaints itself by
   re-entering the route, so this must not re-fetch on every paint. */
let adminMod = null;
function adminLazy(root, params) {
  if (adminMod) { adminMod.AdminScreen(root, params); return; }
  import('./screens/admin.js').then(m => {
    adminMod = m;
    /* `root.isConnected` and not just the hash. `render()` replaces the
       whole view on every navigation, so a second entry into `#/admin`
       while the first import is still in flight leaves this callback
       holding a DETACHED node — and the panel's own `$('#aGo')` queries
       the document, finds nothing, and throws on null. The hash would
       still read `#/admin` in exactly that case, so it cannot be the
       test. Painting into a node nobody is looking at is the bug; the
       live render has already drawn the real one. */
    if (root.isConnected && (location.hash || '').split('?')[0] === '#/admin') {
      m.AdminScreen(root, params);
    }
  });
}

const ROUTES = [
  { re: /^#\/home$/,              screen: HomeScreen,        nav: 'home' },
  { re: /^#\/categories$/,        screen: CategoriesScreen,  nav: 'home' },
  { re: /^#\/prayer$/,            screen: PrayerScreen,      nav: 'home' },
  { re: /^#\/mass$/,              screen: MassScreen,        nav: 'home' },
  { re: /^#\/offers$/,            screen: OffersScreen,      nav: 'home' },
  { re: /^#\/events$/,            screen: EventsScreen,      nav: 'home' },
  { re: /^#\/events\/propose$/,   screen: EventFormScreen,   nav: 'home' },
  { re: /^#\/events\/edit\/(.+)$/, screen: EventFormScreen, nav: null },
  { re: /^#\/events\/(.+)$/,      screen: EventScreen,       nav: 'home' },
  { re: /^#\/directory$/,         screen: DirectoryScreen,   nav: 'directory' },
  { re: /^#\/directory\/(.+)$/,   screen: ListingScreen,     nav: 'directory' },
  { re: /^#\/add-business$/,      screen: AddBusinessScreen, nav: 'directory' },
  { re: /^#\/claim$/,             screen: ClaimScreen,       nav: 'directory' },
  { re: /^#\/claim\/(.+)$/,       screen: ClaimScreen,       nav: 'directory' },
  { re: /^#\/business\/edit\/(.+)$/,   screen: BusinessEditScreen,   nav: 'directory' },
  { re: /^#\/business\/photos\/(.+)$/, screen: BusinessPhotosScreen, nav: 'directory' },
  { re: /^#\/verify-business\/(.+)$/,  screen: BusinessVerifyScreen, nav: 'directory' },
  { re: /^#\/subscribe-consent\/([^?]+)/, screen: SubscribeConsentScreen, nav: null },
  { re: /^#\/my-subscription$/,   screen: MySubscriptionScreen, nav: 'profile' },
  { re: /^#\/receipts$/,          screen: ReceiptsScreen,    nav: 'profile' },
  { re: /^#\/receipt\/(.+)$/,     screen: ReceiptScreen,     nav: 'profile' },
  { re: /^#\/subscribe(?:\/(.+))?$/, screen: SubscribeScreen, nav: 'directory' },
  { re: /^#\/newcomer$/,          screen: NewcomerScreen,    nav: 'directory' },
  { re: /^#\/magazine$/,          screen: MagazineScreen,    nav: 'directory' },
  { re: /^#\/magazine\/(.+)$/,    screen: ArticleScreen,     nav: 'directory' },
  { re: /^#\/marketplace$/,       screen: MarketplaceScreen, nav: 'classifieds' },
  { re: /^#\/marketplace\/(.+)$/, screen: ListingDetailScreen, nav: 'classifieds' },
  // old links kept alive so nothing that was already shared breaks
  { re: /^#\/classifieds$/,       screen: MarketplaceScreen, nav: 'classifieds' },
  { re: /^#\/classifieds\/(.+)$/, screen: ListingDetailScreen, nav: 'classifieds' },
  { re: /^#\/post$/,              screen: PostScreen,        nav: 'classifieds' },
  { re: /^#\/boost\/(.+)$/,       screen: BoostScreen,       nav: 'classifieds' },
  { re: /^#\/messages$/,          screen: MessagesScreen,    nav: 'classifieds' },
  { re: /^#\/messages\/(.+)$/,    screen: MessagesScreen,    nav: 'classifieds' },
  { re: /^#\/profile$/,           screen: ProfileScreen,     nav: 'profile' },
  { re: /^#\/profile\/edit$/,     screen: EditProfileScreen, nav: 'profile' },
  { re: /^#\/profile\/password$/, screen: ChangePasswordScreen, nav: 'profile' },
  { re: /^#\/saved$/,             screen: SavedScreen,       nav: 'profile' },
  { re: /^#\/my-ads$/,            screen: MyAdsScreen,       nav: 'profile' },
  { re: /^#\/my-reviews$/,        screen: MyReviewsScreen,   nav: 'profile' },
  { re: /^#\/my-requests$/,       screen: MyRequestsScreen,  nav: 'profile' },
  { re: /^#\/my-business$/,       screen: MyBusinessScreen,  nav: 'profile' },
  { re: /^#\/settings$/,          screen: SettingsScreen,    nav: 'profile' },
  { re: /^#\/install$/,           screen: InstallScreen,     nav: 'profile' },
  { re: /^#\/blocked$/,           screen: BlockedScreen,     nav: 'profile' },
  { re: /^#\/notifications$/,     screen: NotificationsScreen, nav: 'home' },
  { re: /^#\/help$/,              screen: HelpScreen,        nav: 'profile' },
  { re: /^#\/about$/,             screen: AboutScreen,       nav: 'profile' },
  { re: /^#\/privacy$/,           screen: PrivacyScreen,     nav: 'profile' },
  { re: /^#\/terms$/,             screen: TermsScreen,       nav: 'profile' },
  { re: /^#\/auth\/signup$/,      screen: SignUpScreen,      nav: null },
  { re: /^#\/auth\/signin$/,      screen: SignInScreen,      nav: null },
  { re: /^#\/auth\/email$/,       screen: EmailVerifyScreen, nav: null },
  { re: /^#\/auth\/phone$/,       screen: PhoneVerifyScreen, nav: null },
  { re: /^#\/auth\/forgot$/,      screen: ForgotScreen,      nav: null },
  { re: /^#\/advertise(?:\/(.+))?$/, screen: AdvertiseScreen, nav: 'home' },
  /* Loaded only when somebody asks for it. A static import put 80 KB of
     back office into the first paint of every reader in the community,
     and the panel is reached by typing `#/admin` and knowing a password.
     A dynamic import needs no build step and no dependency — every
     browser that runs modules runs this. */
  { re: /^#\/admin$/,             screen: adminLazy,         nav: null },
];

/* Screens that must always open at the top: a form, a sign-up step, or
   anything reached straight after finishing something. Restoring a
   half-scrolled form is disorienting rather than helpful. */
const ALWAYS_TOP = /^#\/(auth|post|advertise|subscribe|subscribe-consent|events\/propose|events\/edit|business\/edit|add-business|claim|boost|profile\/edit|profile\/password)/;

function render() {
  const full = location.hash || '#/home';
  const hash = full.split('?')[0];
  const app = $('#app');
  closeSheet();
  /* Hide, never close: closing winds the drawer's history entry back, and
     picking a route from the drawer deliberately leaves that entry behind
     so Back returns to the list. And when the pop LANDS on that entry the
     drawer has just reopened itself — render must not wipe it. */
  if (!drawerOwnsEntry()) hideDrawer();
  closeDropdown(true);   // the navigation owns the history, not the panel

  let match = null, params = [];
  for (const r of ROUTES) {
    const m = hash.match(r.re);
    if (m) { match = r; params = m.slice(1); break; }
  }
  if (!match) { location.hash = '#/home'; return; }

  app.innerHTML = '';
  const view = document.createElement('div');
  view.className = 'screen';
  app.appendChild(view);
  app.scrollTop = 0;

  if (match.nav) renderNav(match.nav); else hideNav();
  match.screen(view, params);

  // …and the incoming one gets back whatever it had, unless it is a screen
  // that has to start at the top
  const key = historyKey();
  markShown(key);
  if (!ALWAYS_TOP.test(hash)) restoreScroll(key);
  /* ⚠️ Not on the boot paint: `boot()` runs the greeting first and calls
     this itself afterwards, so a card and a strip never arrive together. */
  if (booted) inviteIfDue(hash);
}

window.addEventListener('hashchange', render);
registerStrings(bothPacks());

/* Anything the passage of time has made due — a trial ending, a renewal
   taken, an ad finishing tomorrow, a saved event arriving. There is no
   server to push these, so they are worked out once at boot from what the
   clock says, and each one carries a one-shot key. */
function catchUp() {
  try { runSubscriptionCycle(); runReminders(); } catch (e) { /* never block boot */ }
  applyTheme();          // before anything is drawn, so there is no flash
  applyFontScale();      // …and the same for the size, for the same reason
  mountThemeWatch();
  mountScrollMemory();
  mountAdShare();
  startClock();
  mountGeoRefresh();
  /* ⚠️ Inside `catchUp`'s own try, and last: a service worker that fails
     to register must never stop the app opening. */
  mountServiceWorker();
  /* ⚠️ ONE LAUNCH, COUNTED ONCE, and before anything is drawn — the
     invite is deliberately not shown on the first one. */
  try { noteVisit(); } catch (e) { /* never block boot */ }
  /* ⚠️ Asked for, and nothing is built on the answer — see the note in
     store.js. Apple's tracking prevention still clears a Safari tab's
     storage after seven idle days; the real answer there is `425`. */
  requestPersistence();
  /* Chrome fires `beforeinstallprompt` early and only once, so the
     listener has to be standing before the first screen is painted. */
  mountInstallPrompt();
}

/* ---------------- the greeting ---------------------------------------
 * One card at the first launch inside its own dates, once per device.
 *
 * ⚠️ IT RUNS AFTER `render()`, NOT INSIDE `catchUp()`, and this is the one
 * place this batch departs from its own file. `render()` calls
 * `closeSheet()` as its first act — on the boot paint as much as on any
 * navigation — so a card opened before it would be wiped before anybody
 * saw it. Measured, not reasoned about. The appearance is already settled
 * by then (`applyTheme` and `applyFontScale` ran in `catchUp`), which is
 * what the file's «directly after applyTheme» was protecting.
 *
 * ⚠️ And it is given the route the app is ABOUT to show rather than
 * reading `location.hash` for itself: at boot the hash may still be empty
 * and `firstRoute()` is the only thing that knows where the app is going.
 */
/* ⚠️ NOT ON AN AUTH SCREEN and not on its own page: somebody one field
   from finishing a sign-up does not need a second thing to read, and an
   invitation printed on top of the page it opens is the app talking over
   itself. */
const NO_INVITE = /^#\/(auth|install)/;
const BIZ_PAGE = /^#\/directory\/[^/]+$/;
function inviteIfDue(route) {
  try {
    const hash = (route || location.hash || '#/home').split('?')[0];
    if (NO_INVITE.test(hash)) { hideInstallInvite(); return; }
    /* ⚠️ A greeting card is standing: never two things in one launch, and
       the greeting is the one that expires by a date. */
    if (sheetOpen()) return;
    const greet = $('#greet');
    if (greet && greet.classList.contains('open')) return;
    mountInstallInvite(BIZ_PAGE.test(hash));
  } catch (e) { /* an invite must never stop the app opening */ }
}

const NO_GREET = /^#\/auth\//;
function greetIfDue(route) {
  try {
    /* A sign-up stopped one step from finished resumes on the code
       screen; a card over it costs somebody a step they were about to
       finish. */
    if (NO_GREET.test(route || '')) return;
    /* ⚠️ Never two things in one launch. The greeting is not cancelled
       when something else is standing there — it is POSTPONED, and it
       comes back on the next launch, because it ends by a date and
       nothing replaces it. */
    if (sheetOpen()) return;
    const g = liveGreeting();
    if (!g) return;
    openGreeting(g, () => markGreetingSeen(g.id));
  } catch (e) { /* a broken greeting must never stop the app opening */ }
}

/**
 * A sign-up that got as far as the code screen resumes there. Closing the
 * app one step from finished and being dropped back at an empty form is
 * the commonest reason somebody never comes back.
 */
function firstRoute() {
  if (location.hash) return location.hash;
  const pv = state.pendingVerify;
  if (pv && state.user && !state.user.emailVerified && pv.kind === 'email') return '#/auth/email';
  return '#/home';
}

let bootRan = false;
let booted = false;
function boot() {
  /* ⚠️ TWO ENTRY POINTS, ONE BOOT — and it had been running TWICE since
     the router was written. A module script is deferred: it executes
     after parsing, so `readyState` is already past 'loading' and the
     line at the foot of this file calls `boot()` — and then
     `DOMContentLoaded` fires and calls it again. Everything it did was
     idempotent, so nothing looked wrong; the launch counter added in
     `425` is what made it visible, reading 2 on a first visit and
     spending the invite before anybody had returned. */
  if (bootRan) return;
  bootRan = true;
  setLang(state.lang || 'ar');
  catchUp();
  const route = firstRoute();
  location.hash = route;
  render();
  greetIfDue(route);
  /* after the greeting, and only then: whichever of the two is standing,
     the reader meets one thing on a launch and not two */
  inviteIfDue(route);
  booted = true;
}

window.addEventListener('DOMContentLoaded', boot);

// If DOM is already parsed (module executes after parsing), render immediately.
if (document.readyState !== 'loading') boot();

export { render, renderHeader };
