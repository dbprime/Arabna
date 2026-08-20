/* ============================================================
   ARABNA — router / bootstrap
   ============================================================ */

import { setLang, bothPacks } from './i18n.js';
import { state, registerStrings, runReminders, runSubscriptionCycle } from './store.js';
import { $, renderHeader, renderNav, hideNav, closeSheet, closeDrawer, closeDropdown,
         mountScrollMemory, restoreScroll, historyKey, markShown, startClock,
         applyTheme, mountThemeWatch } from './ui.js';

import { HomeScreen, mountGeoRefresh } from './screens/home.js';
import { CategoriesScreen } from './screens/categories.js';
import { EventsScreen, EventScreen, EventFormScreen } from './screens/events.js';
import { DirectoryScreen, ListingScreen, AddBusinessScreen, ClaimScreen, SubscribeScreen,
         SubscribeConsentScreen, MySubscriptionScreen,
         BusinessEditScreen, BusinessPhotosScreen, BusinessVerifyScreen } from './screens/directory.js';
import { MarketplaceScreen, ListingDetailScreen, PostScreen, BoostScreen, MessagesScreen } from './screens/marketplace.js';
import { MagazineScreen, ArticleScreen } from './screens/magazine.js';
import { ProfileScreen, EditProfileScreen, ChangePasswordScreen, SavedScreen, MyAdsScreen,
         MyBusinessScreen, MyReviewsScreen, SettingsScreen, NotificationsScreen,
         HelpScreen, AboutScreen, PrivacyScreen, TermsScreen, BlockedScreen } from './screens/profile.js';
import { SignUpScreen, SignInScreen, EmailVerifyScreen, PhoneVerifyScreen, ForgotScreen } from './screens/auth.js';
import { AdvertiseScreen } from './screens/advertise.js';
import { PrayerScreen } from './screens/prayer.js';
import { AdminScreen } from './screens/admin.js';

const ROUTES = [
  { re: /^#\/home$/,              screen: HomeScreen,        nav: 'home' },
  { re: /^#\/categories$/,        screen: CategoriesScreen,  nav: 'home' },
  { re: /^#\/prayer$/,            screen: PrayerScreen,      nav: 'home' },
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
  { re: /^#\/subscribe(?:\/(.+))?$/, screen: SubscribeScreen, nav: 'directory' },
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
  { re: /^#\/my-business$/,       screen: MyBusinessScreen,  nav: 'profile' },
  { re: /^#\/settings$/,          screen: SettingsScreen,    nav: 'profile' },
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
  { re: /^#\/admin$/,             screen: AdminScreen,       nav: null },
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
  closeDrawer();
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
  mountThemeWatch();
  mountScrollMemory();
  startClock();
  mountGeoRefresh();
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

window.addEventListener('DOMContentLoaded', () => {
  setLang(state.lang || 'ar');
  catchUp();
  location.hash = firstRoute();
  render();
});

// If DOM is already parsed (module executes after parsing), render immediately.
if (document.readyState !== 'loading') {
  setLang(state.lang || 'ar');
  catchUp();
  location.hash = firstRoute();
  render();
}

export { render, renderHeader };
