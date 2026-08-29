/* ============================================================
   App state + persistence + auth/entitlement rules
   (V.02: swap the auth/payment functions for Supabase + Stripe;
    the rest of the app only ever calls these functions.)
   ============================================================ */

import { CLASSIFIEDS, BUSINESSES, NOTIFICATIONS, SLIDER_ADS, MINI_ADS, ARTICLES, REVIEWS,
         MARKET_CATS, FREE_PRICE, EVENTS, VERIFY_BADGE_PRICE, blankEvent,
         ATTRIBUTES, ATTR_GROUPS, CATEGORIES, DAY_KEYS, CHIP_MIN, CHIP_MAX_SHARE, EVENT_TYPES,
         GENERIC_WORDS, NAME_SIM_MIN, STREET_WORDS, SUBSCRIPTION_PRICE, AD_CARD_COLOR,
         CITY_POINTS, REGIONS, REGION_RADIUS_MI, STATE_SUGGEST,
         AD_PRODUCTS, AD_SLOTS,
         attrById, attrInCat, isAllDay, week, nextOccurrence } from './data.js';
import { expandQuery, hayMatches, catMatches, squash } from './synonyms.js';

export { ATTRIBUTES, ATTR_GROUPS, DAY_KEYS, CHIP_MIN, CHIP_MAX_SHARE, EVENT_TYPES,
         attrById, attrInCat, isAllDay, week, nextOccurrence };

export { blankEvent };

import { avatarSvg, AVATARS } from './avatars.js';
export { AVATARS, avatarSvg };

const KEY = 'arabna.v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* private mode / disabled storage → memory only */ }
  return null;
}

const DEFAULTS = {
  lang: 'ar',
  /* 'auto' follows the device, which is what somebody who schedules night
     mode on their phone already expects the app to do. */
  theme: 'auto',                 // 'auto' | 'light' | 'dark'
  fontScale: 17,                 // the base in px — 16 · 17 · 19 · 21
  /* No city until the person tells us or the device does. A city written
     in advance lies to everyone who is not in it — and 138 of the 514
     listings are not in Houston. */
  location: { zip: '', city: '', state: 'TX' },
  geo: null,                 // { lat, lng, at } — the user's own point, never sent anywhere
  geoAsked: false,           // the pre-prompt has been shown once
  geoDenied: false,          // …and refused: iOS will not ask again, so neither do we
  /* Permission was granted ONCE, and this survives a hand-picked city.
     `state.geo` cannot stand in for it: choosing a city by hand clears the
     point on purpose (it belonged to somewhere the reader has left), so
     the quiet refresh — gated on `!geo` — switched itself off for good and
     froze the app on that city without saying so. Rai sat in Richmond and
     the app said Houston, for exactly this reason. */
  geoGranted: false,
  area: 'all',          // 'all' · 'city' · a number of miles
  user: null,               // { name, email, emailVerified, phone, phoneVerified }
  saved: [],                // ids of saved businesses / classifieds
  /* EMPTY, and this is not a style preference. It read `['c1']` — a value
     put in to try something and left there for eight batches — so a
     visitor who had never signed up owned a seed listing: the owner's
     buttons on `#/marketplace/c1` instead of «تواصل مع البائع», an edit
     form full of somebody else's text, and a quota already reading 1/4
     before they had typed a character. And hiding it really wrote to
     `hiddenListings`.

     THE RULE, and it belongs in CLAUDE.md: **the default state in this
     file is a brand-new visitor, never a test seat.** Any id written into
     it is a bug waiting for somebody's first launch. */
  myListings: [],           // classifieds owned by the current user
  /* PLURAL since V.05.4. One account can own several listings — Rai's
     question about a restaurant with three branches, each with its own
     phone number, was the case that exposed it. The singular field let
     `approveClaim` REPLACE, so approving a second branch silently dropped
     the first while still marking it `claimed: true` — leaving it locked,
     ownerless, and unclaimable by anybody. */
  myBusinessIds: [],        // claimed / added business ids
  subscription: null,       // { businessId, since }
  myAds: [],                // purchased ad placements (pending review / live)
  notifPrefs: { messages: true, expiry: true, adLive: true, reviews: true },
  readNotifs: [],
  extraClassifieds: [],     // user-created listings
  hiddenListings: [],       // «أخفِ الإعلان» — hidden, not erased
  pendingVerify: null,      // the code screen survives closing the app
  extraBusinesses: [],      // user-created business listings
  extraArticles: [],        // admin-created articles
  boosted: ['c1'],
  reported: [],
  cardOnFile: null,
  reviews: [],               // user-written reviews { id, bizId, rating, text, when }
  messages: [],              // in-app marketplace messages { id, listingId, from, text, when }
  flags: [],                 // moderation items raised by the app { id, kind, refId, reason, risk }
  extraNotifs: [],           // notifications generated at runtime (approve / reject …)
  extraEvents: [],           // events added by the admin or proposed by organizers
  hiddenEvents: [],          // seed events the admin deleted
  eventEdits: {},            // admin edits applied on top of a seed event
  draft: null,               // half-finished listing kept across a verification detour
  adminAuth: null,           // { user, pass } once the owner changes the defaults
  businessEdits: {},         // admin edits layered on top of a seed business
  bizPhotos: {},             // { bizId: [{ url, status, when }] } — reviewed like avatars
  bizVerify: {},             // { bizId: { status, ref, reason } } — never derived from plan
  claims: [],                // ownership requests awaiting an admin decision
  reviewReplies: {},         // { reviewId: { text, when } } — the owner's answer
  mergedBusinesses: [],      // { keepId, dropId, when } — duplicates folded together
  removedBusinesses: [],     // ids the admin deleted; seeds live in data.js so
                             // the removal is recorded rather than spliced out
  myPendingBusinesses: [],   // listings this device added over a certain duplicate match
  clockOffset: 0,            // the admin test panel's fake clock, in ms — demo only
  adWaitlist: [],            // { id, product, cat, name, phone, when, preferred } when a placement is full
  adStats: {},               // { adId: { impressions, clicks, days: { 'YYYY-MM-DD': {i,c} } } }
  bizStats: {},              // { bizId: { months: { 'YYYY-MM': { views, calls, directions, saves } } } }
  blocked: [],               // { key, label, when } — people this user has blocked
  savedEvents: [],           // event ids the user asked to be reminded about
  reminded: {},              // one-shot keys, so a reminder is never sent twice
  showDemo: true,            // the invented prototype data is visible until the owner hides it
  demoPurged: false,         // …or erased for good, which the switch cannot undo
  seasons: { ramadan: false },   // seasonal attribute groups the owner has switched on
  /* The two dates only a human can know. Ramadan begins when the crescent
     is sighted, not when a table says so, and the calendar's own figure is
     labelled «تقديري» for exactly that reason. The moment Rai writes the
     announced date the estimate has no business standing beside it. Empty
     strings, ISO 'YYYY-MM-DD' when set. */
  ramadanDates: { from: '', eid: '' },
  /* THE GREETING IS GENERAL, and the word `greeting` is chosen for that
     reason: Eid al-Fitr, Eid al-Adha, the Hijri new year, Easter,
     Independence Day, a new section opening, the launch itself. ⚠️ NO
     OCCASION IS EVER NAMED IN THE CODE — the moment one is, the tool
     becomes «the Eid card» and the next occasion needs a second one.
     { id, title, body, from, to, cta, off } — the dates are 'YYYY-MM-DD'. */
  greetings: [],
  /* ⚠️ AND THE TWO DO NOT BELONG IN THE SAME PLACE. `greetings` is the
     panel's work and survives a sign-out with the rest of the operator's
     keys; `seenGreetings` is this DEVICE's own trace — it is not carried
     across accounts and it is not in `exportMyData`, because what a
     phone has already displayed says nothing about the person holding
     it. */
  seenGreetings: [],
  /* The calculation method is a SETTING, never a constant. Houston holds a
     large Iraqi and Lebanese Shia community whose times genuinely differ,
     and one fixed set of times tells them the app is not for them. */
  prayer: { method: 'isna', asr: 1 },
  worshipFixes: [],          // «الوقت غير صحيح؟» — one line from a regular, for the admin
  offers: {},                // { bizId: [{ id, text, price, endsAt, status, when, reason }] }
  adminLog: [],              // { at, bizId, field, from, to } — the panel's hand, never the owner's
  receipts: [],              // every amount taken, card or cash; survives deleteAccount
  mapsApp: null,             // 'google' · 'apple' · 'waze' · null = ask each time
};

/* ⚠️ A DEEP COPY, and the shallow one was the fault. `Object.assign({}, …)`
   copies references, so on a device with nothing saved yet — the FIRST
   session of every new user — `state.saved` IS `DEFAULTS.saved`, and the
   first `push` writes into the defaults themselves. `signOut` then deep
   copies defaults that are no longer default, and clears nothing.
   ⚠️ It disappears after one reload, because `load()` returns fresh
   objects from `JSON.parse` — which is why no suite ever saw it, and why a
   manual check that seeds localStorage and reloads never sees it either.
   ⚠️ And the keys that survived were not random: what is edited IN PLACE
   survived (`saved`, `reviews`, `messages`, `readNotifs`, `notifPrefs`)
   and what is reassigned was cleared, so signing out LOOKED like it worked.
   `DEFAULTS` is pure data, so the JSON round-trip is correct here, and it
   is the same one `signOut` already uses — one pattern, not two. */
export const state = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), load() || {});

/* Changing the default is not enough: anybody who opened the app before
   this fix has `["c1"]` written into their own localStorage, and it
   survives every update. So it is cleared once, at boot, for whoever has
   no account — because somebody with no account owns nothing, by
   definition. `signUp` clears it too: it survived the sign-up as well,
   and a brand-new account was starting life owning a stranger's car. */
if (!state.user && state.myListings && state.myListings.length) {
  state.myListings = [];
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* memory only */ }
}

/* `location.manual` did not exist before V.04.0, so a reader upgrading
   carries a city with no word on where it came from — and the whole of
   this batch turns on that question. The answer is already in their data:
   `setUserLocation` only ever stores a point when the DEVICE supplied one,
   so a saved city with no point beside it was typed or picked by hand.
   Inferring it once at boot beats guessing on every read, and guessing
   wrong here wipes a city somebody chose deliberately. */
if (state.location && state.location.city && state.location.manual === undefined) {
  state.location = Object.assign({}, state.location, { manual: !state.geo });
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* memory only */ }
}

/* THE THEME IS NOT REMEMBERED ACROSS LAUNCHES — Rai's decision.
   ⚠️ This REVERSES half of V.04.8: the tap still pins light or dark, and
   Settings still offers the three, but every launch starts from the
   device again. His reason is the one that matters: a phone that dims
   itself at night should dim the app with it, and a choice made once at
   noon should not outlive the day.
   The header button and the Settings screen are untouched — the change is
   only in what SURVIVES a launch, exactly like the ownership rule of 225:
   what is written here decides, and no screen has to remember it.
   ⚠️ And it heals existing devices by itself: a phone carrying a pinned
   theme from an old tap has it cleared on the first launch after this
   lands, so nothing is asked of its owner. */
if (state.theme && state.theme !== 'auto') {
  state.theme = 'auto';
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* memory only */ }
}

/* V.05.3 and older wrote a single `myBusinessId`. That key is still in
   every existing device's localStorage, and changing DEFAULTS does not
   touch it — so without this the owner of a claimed page loses it the
   moment this lands. Fold it in once, then drop it: same shape as the
   two migrations above, and it runs at most once per device.
   ⚠️ `!== undefined`, never `if (state.myBusinessId)`: a key sitting there
   as `null` — which is most devices — has to be removed too, or it stays
   in their storage for ever and the migration never finishes. Same rule
   as `occFirst` in V.04.9. */
if (state.myBusinessId !== undefined) {
  const ids = Array.isArray(state.myBusinessIds) ? state.myBusinessIds.slice() : [];
  if (state.myBusinessId && !ids.includes(state.myBusinessId)) ids.push(state.myBusinessId);
  state.myBusinessIds = ids;
  delete state.myBusinessId;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* memory only */ }
}

/** Last write result — false when the browser refused (quota full, private mode). */
export let lastSaveOk = true;

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    lastSaveOk = true;
  } catch (e) {
    // Photos are stored as data URLs, so a big listing can exhaust the quota.
    // Callers check lastSaveOk and tell the user instead of losing data quietly.
    lastSaveOk = false;
  }
  return lastSaveOk;
}

export function resetAll() {
  Object.assign(state, JSON.parse(JSON.stringify(DEFAULTS)));
  save();
}

/* ---------------- staff access ----------------
   THE PASSWORD IS NOT IN THIS FILE, and it never will be again.

   It used to be: `ADMIN_USER` and `ADMIN_PASS` were two exported constants
   in a module the browser downloads, which means they were published, not
   stored. Any reader of the deployed app had them. They are gone, and
   nothing replaced them in the file — instead the panel is CLAIMED on
   first use: the first time `#/admin` is opened on a device that has no
   staff password yet, the screen asks the owner to set one, and from then
   on it asks for it.

   What is kept is a salted SHA-256 of it and nothing else — the exact
   `pwSalt` / `pwHash` path the app already uses for a user's own password
   (`setUserPassword`). This was the one place that had been left out of it.

   That first-run screen is also the honest shape of what this is while
   there is no server: an admin password on a phone unlocks the panel over
   THAT phone's own localStorage, which holds that phone's own data. With
   Supabase, staff access becomes a claim on an account and this whole
   block goes.

   `state.adminAuth` = { user, salt, hash }. No plaintext, ever. */

/* Whether the admin panel is unlocked in THIS session. Memory only and
   never saved: a reload must ask for the password again. The edit screen
   reads it so the panel's ✎ can open the very same form the owner uses —
   a second form would be a second shape of the same data. */
let adminSession = false;
export function adminUnlocked() { return adminSession; }
export function setAdminUnlocked(on) { adminSession = !!on; }

/** has a staff password been set on this device yet? */
export function adminIsSet() {
  const a = state.adminAuth;
  return !!(a && a.user && a.hash);
}
/** the staff username, for the line that prints it. Never the password. */
export function adminUser() { return (state.adminAuth && state.adminAuth.user) || ''; }

/**
 * Hashing needs `crypto.subtle`, which a browser only exposes in a secure
 * context — https, or localhost. Opened straight off the disk there is
 * none, so rather than storing something weaker and calling it a password,
 * the panel says so and stays shut.
 */
export function adminCanSet() { return !!PW_SUBTLE(); }

/**
 * Set (or change) the staff password. The username is stored as typed;
 * only its comparison is case-insensitive.
 */
export async function setAdminPass(newPass, user) {
  const name = String(user == null ? adminUser() : user).trim();
  const pw = String(newPass || '');
  if (!name || !pw) return false;
  const salt = randomSalt();
  const hash = await hashPassword(pw, salt);
  if (!hash) return false;              // no subtle crypto: store nothing
  state.adminAuth = { user: name, salt, hash };
  save();
  return true;
}

/**
 * Username is compared case-insensitively and trimmed: iOS auto-capitalises
 * the first letter of a text field, which used to lock the owner out on an
 * iPhone. The password stays exactly as typed.
 *
 * Async now, because a hash comparison is. It refuses when nothing has been
 * set — an unset panel is claimed, not guessed into.
 */
export async function checkAdmin(user, pass) {
  const a = state.adminAuth;
  if (!a || !a.user || !a.hash) return false;
  if (String(user || '').trim().toLowerCase() !== String(a.user).toLowerCase()) return false;
  return (await hashPassword(String(pass || ''), a.salt || '')) === a.hash;
}

/* ---------------- auth tiers ---------------- */
export function tier() {
  if (!state.user) return 0;
  if (state.user.phoneVerified) return 2;
  if (state.user.emailVerified) return 1;
  return 0;
}
export function isLoggedIn() { return tier() >= 1; }
export function isPhoneVerified() { return tier() >= 2; }

/**
 * The single source of truth for "account holder vs. visitor".
 * Every screen, the drawer and the nav ask this — no screen decides for
 * itself, so they can never disagree about who is signed in.
 */
export const isMember = () => tier() >= 1;

/* ---------------- pending intent (resume after signup) ---------------- */
let pendingIntent = null;
/* The intent remembers which tier the action actually needed. Guessing that
   from the route stopped working once #/advertise became browsable at tier 1:
   the route is the same whether the user wants to read prices or to pay. */
export function setPendingIntent(route, label, tier = 2) { pendingIntent = { route, label, tier }; }
export function takePendingIntent() { const p = pendingIntent; pendingIntent = null; return p; }
export function peekPendingIntent() { return pendingIntent; }

/**
 * Gate an action behind a tier. Returns true if allowed.
 * If not allowed it stores the intent and sends the user to the right screen.
 */
/* ============================================================
   Personal account or business account
   ------------------------------------------------------------
   Rai's decision (question 2): ONE account with a flag added at the
   moment somebody presses «هذا نشاطي» — not two kinds chosen at sign-up,
   where nobody yet knows which they are and the question only costs
   registrations.

   ⚠️ And the honest part: the gate he asked for EXISTS ALREADY and is
   stronger than a flag — `requireTier(2)` plus a name, a role, a phone
   and written proof. What the flag buys is not the gate; it is the
   ADMIN'S SIGNAL: `approvedClaims()` says how many claims this account
   has had approved before, and an account with a record is the one that
   reviews fastest. That is the axis — never the name of the business.
   ============================================================ */
export function accountKind() {
  return (state.user && state.user.accountKind) || 'personal';
}
export function isBusinessAccount() { return accountKind() === 'business'; }
export function makeBusinessAccount() {
  if (!state.user) return null;
  if (state.user.accountKind !== 'business') {
    state.user.accountKind = 'business';
    state.user.businessSince = now();
    save();
  }
  return state.user;
}
/** how many of this account's claims an admin has approved before */
export function approvedClaims() {
  return (state.claims || []).filter(c => c.status === 'approved').length;
}

export function requireTier(needed, route, go) {
  if (tier() >= needed) return true;
  setPendingIntent(route, undefined, needed);
  // Someone who already has an account must never be sent back to "create
  // account" — they only need to finish the step they are missing.
  if (!state.user) go('#/auth/signup');
  else if (!state.user.emailVerified) go('#/auth/email');
  else go('#/auth/phone');
  return false;
}

/* ---------------- saved / favorites ---------------- */
export function isSaved(id) { return state.saved.includes(id); }
export function toggleSaved(id) {
  const i = state.saved.indexOf(id);
  if (i >= 0) state.saved.splice(i, 1); else state.saved.push(id);
  save();
  return isSaved(id);
}

/* ============================================================
   Content safety — marketplace only, never the business directory
   (a business listing is *supposed* to publish its phone number).
   ============================================================ */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
/** Arabic-Indic → ASCII, 1:1 so string indexes stay aligned. */
function asciiDigits(s) {
  return s.replace(/[٠-٩۰-۹]/g, ch => {
    const i = AR_DIGITS.indexOf(ch);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(ch));
  });
}

/* A phone-ish run: digits with the usual separators, 7+ digits total.
   Prices ($14,500), years (2019) and "62k miles" stay untouched because
   commas and letters are not part of the run. */
const PHONE_RUN = /\+?\d[\d\s().\-]{5,}\d/g;
export const PHONE_PLACEHOLDER = { ar: '[رقم محذوف]', en: '[number removed]' };

/* Numbers written as words — "seven one three four..." — and the Arabic
   equivalents. Seven or more in a row is a phone number being smuggled out. */
const WORD_DIGITS = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9,
  'صفر': 0, 'واحد': 1, 'اثنين': 2, 'اثنان': 2, 'ثلاثة': 3, 'ثلاثه': 3,
  'أربعة': 4, 'اربعة': 4, 'اربعه': 4, 'خمسة': 5, 'خمسه': 5, 'ستة': 6, 'سته': 6,
  'سبعة': 7, 'سبعه': 7, 'ثمانية': 8, 'ثمانيه': 8, 'تسعة': 9, 'تسعه': 9,
};
const WORD_RE = new RegExp(
  '\\b(?:' + Object.keys(WORD_DIGITS).join('|') + ')\\b(?:[\\s,.\\-]+\\b(?:' +
  Object.keys(WORD_DIGITS).join('|') + ')\\b){6,}', 'gi');

/* Emails, including the spelled-out dodge ("rami dot elby at gmail dot com").
   The match is anchored on a real TLD so ordinary prose containing the word
   "at" is left alone — without that anchor, "email me at rami…" matched from
   the wrong word and only half the address was removed. */
const TLD = '(?:com|net|org|edu|gov|mil|io|co|info|biz|app|me|sa|ae|eg|jo|kw|qa|bh|om|lb|sy|iq|ma|tn|dz|ly|ps|tr|uk|ca|de|fr|es|it|nl|se|no|dk|au|in|pk)';
const SEP_DOT = '(?:\\.|\\(dot\\)|\\[dot\\]|\\bdot\\b)';
const SEP_AT = '(?:@|\\(at\\)|\\[at\\]|\\bat\\b)';
const EMAIL_RE = new RegExp(
  '[A-Za-z0-9._%+-]+' +
  '(?:\\s*' + SEP_DOT + '\\s*[A-Za-z0-9_%+-]+)*' +
  '\\s*' + SEP_AT + '\\s*' +
  '[A-Za-z0-9-]+(?:\\s*' + SEP_DOT + '\\s*[A-Za-z0-9-]+)*' +
  '\\s*' + SEP_DOT + '\\s*' + TLD + '\\b', 'gi');

/* WhatsApp links and mentions. No \b around the Arabic words — JS word
   boundaries are ASCII-only and would never fire on Arabic script. */
const WHATSAPP_RE = /(?:https?:\/\/)?(?:api\.|chat\.)?wa\.me\/\S*|(?:https?:\/\/)?(?:chat\.)?whatsapp\.com\/\S*|\bwhatsapp\b\S*|واتس\s?اب\S*|واتساب\S*/gi;

/** true when the text contains something that looks like a phone number */
export function hasPhone(text) {
  const s = asciiDigits(String(text || ''));
  PHONE_RUN.lastIndex = 0;
  let m;
  while ((m = PHONE_RUN.exec(s))) {
    if ((m[0].replace(/\D/g, '') || '').length >= 7) return true;
  }
  return false;
}

/**
 * Replace every phone number with the placeholder.
 * @returns {{ text: string, removed: number }}
 */
export function stripPhones(text, lang = 'ar') {
  const src = String(text || '');
  const scan = asciiDigits(src);          // same length → same indexes
  const holder = PHONE_PLACEHOLDER[lang === 'en' ? 'en' : 'ar'];
  let out = '', last = 0, removed = 0, m;
  PHONE_RUN.lastIndex = 0;
  while ((m = PHONE_RUN.exec(scan))) {
    if ((m[0].replace(/\D/g, '') || '').length < 7) continue;
    out += src.slice(last, m.index) + holder;
    last = m.index + m[0].length;
    removed++;
  }
  out += src.slice(last);
  return { text: out, removed };
}

/**
 * The full scrub applied to private messages: digits in any form, digits
 * spelled out as words, email addresses, and WhatsApp links — all replaced
 * with the same placeholder so the sender can see exactly what was removed.
 * @returns {{ text: string, removed: number, kinds: string[] }}
 */
export function scrubContact(text, lang = 'ar') {
  const holder = PHONE_PLACEHOLDER[lang === 'en' ? 'en' : 'ar'];
  const kinds = [];
  let removed = 0;

  // Order matters: links and addresses are removed whole *before* the digit
  // pass, otherwise stripping the digits out of "wa.me/17135550100" first
  // would leave a half-link for the link pattern to mangle.
  let out = String(text || '');
  out = out.replace(WHATSAPP_RE, () => { removed++; kinds.push('whatsapp'); return holder; });
  out = out.replace(EMAIL_RE, () => { removed++; kinds.push('email'); return holder; });

  const digits = stripPhones(out, lang);
  out = digits.text;
  if (digits.removed) { removed += digits.removed; kinds.push('phone'); }

  out = out.replace(WORD_RE, () => { removed++; if (!kinds.includes('phone')) kinds.push('phone'); return holder; });

  return { text: out, removed, kinds: kinds.filter((k, i) => kinds.indexOf(k) === i) };
}

/* ---- "Free stuff" section: no prices, no selling ---- */
const PRICE_WORDS = /(سعر|بسعر|للبيع|مساومة|قابل للتفاوض|price|for sale|selling|obo|negotiable|best offer)/i;
const MONEY_RE = /(\$\s*\d|\d+\s*(\$|dollars?|dolar|دولار|درهم|ريال))/i;

/**
 * Does this text break the Free-section rule?
 * @returns {boolean}
 */
export function violatesFreeRule(text) {
  const s = asciiDigits(String(text || ''));
  return PRICE_WORDS.test(s) || MONEY_RE.test(s);
}

/* ---- automated message scanning (no human reads the message) ---- */
const OFF_PLATFORM = /(zelle|cash\s?app|venmo|paypal|western union|wire transfer|gift card|بطاقة هدايا|زيلي|كاش اب|فودافون كاش|حوالة|تحويل بنكي|ويسترن يونيون|خارج التطبيق|برة التطبيق)/i;

/**
 * Scan one outgoing message. Runs entirely on-device in V.01; in V.02 this is
 * the same call against the moderation service. Never blocks the message —
 * it only decides whether the thread goes to the review queue.
 * @returns {{ flagged: boolean, reason: string|null }}
 */
export function scanMessage(text, listing) {
  const s = asciiDigits(String(text || ''));

  // selling something that was posted in the Free section
  if (listing && listing.cat === 'free' && (violatesFreeRule(s) || OFF_PLATFORM.test(s))) {
    return { flagged: true, reason: 'free-item-sale' };
  }
  // repeated off-platform payment requests in the same thread
  if (OFF_PLATFORM.test(s)) {
    const prior = state.messages.filter(
      m => m.listingId === (listing && listing.id) && m.from === 'me' && m.offPlatform
    ).length;
    if (prior >= 1) return { flagged: true, reason: 'off-platform-payment' };
  }
  return { flagged: false, reason: null };
}

/* ---------------- data accessors ---------------- */
/* ============================================================
   Opening hours: is it open right now?
   ------------------------------------------------------------
   Everything is computed in the viewer's own local time. The case
   that catches naive implementations is the shop that closes after
   midnight: at 00:30 on Saturday it is *Friday's* span that is still
   running, so yesterday has to be inspected as well as today.
   ============================================================ */

const MINS = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** every span of `day` as absolute minutes relative to the start of today */
function spansOn(hours, dayIndex, dayOffset) {
  const spans = hours && hours[dayIndex];
  if (!spans || !spans.length) return [];
  return spans.map(([o, c]) => {
    let start = MINS(o), end = MINS(c);
    if (end <= start) end += 1440;          // runs past midnight
    return { start: start + dayOffset * 1440, end: end + dayOffset * 1440 };
  });
}

/**
 * @returns {null|{open:boolean, always:boolean, minsToClose:number|null,
 *                 closesAt:string|null, opensAt:string|null, opensDay:number|null,
 *                 opensToday:boolean}}
 * null when the business carries no structured hours at all.
 */
export function openState(biz, now = new Date()) {
  const hours = biz && biz.hours;
  if (!Array.isArray(hours) || hours.length !== 7) return null;

  const today = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // yesterday first, so a span that began before midnight is seen
  for (const offset of [-1, 0]) {
    const day = (today + offset + 7) % 7;
    for (const sp of spansOn(hours, day, offset)) {
      if (nowMins >= sp.start && nowMins < sp.end) {
        const always = isAllDay(hours[day]) && isAllDay(hours[(day + 1) % 7]);
        return {
          open: true,
          always,
          minsToClose: always ? null : sp.end - nowMins,
          closesAt: always ? null : fmtMins(sp.end % 1440),
          opensAt: null, opensDay: null, opensToday: false,
        };
      }
    }
  }

  // closed: find the next opening within the coming week
  for (let offset = 0; offset < 8; offset++) {
    const day = (today + offset) % 7;
    for (const sp of spansOn(hours, day, offset).sort((a, b) => a.start - b.start)) {
      if (sp.start > nowMins) {
        return {
          open: false, always: false, minsToClose: null, closesAt: null,
          opensAt: fmtMins(sp.start % 1440),
          opensDay: day,
          opensToday: offset === 0,
        };
      }
    }
  }
  return { open: false, always: false, minsToClose: null, closesAt: null,
           opensAt: null, opensDay: null, opensToday: false };
}

function fmtMins(m) {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

export function isOpenNow(biz, now = new Date()) {
  const st = openState(biz, now);
  return !!(st && st.open);
}

/** open, but for less than an hour — worth a quiet warning, never a lie */
export function closingSoon(biz, now = new Date()) {
  const st = openState(biz, now);
  return !!(st && st.open && !st.always && st.minsToClose !== null && st.minsToClose <= 60);
}

/* ============================================================
   Attributes
   ============================================================ */

/** the seasonal groups the owner has switched on (admin → settings) */
export function seasonOn(season) {
  return !season || !!(state.seasons && state.seasons[season]);
}
/**
 * How many live listings actually carry a seasonal speciality. The switch
 * works; the data is what is missing, and a switch that opens onto nothing
 * reads as broken. The panel prints this number beside it so the owner can
 * see what is wanted rather than guess.
 */
export function seasonCount(season) {
  const ids = ATTRIBUTES.filter(a => a.season === season).map(a => a.id);
  if (!ids.length) return 0;
  return allBusinesses().filter(b => (b.attributes || []).some(id => ids.includes(id))).length;
}

/**
 * THE HAND BEATS THE ARITHMETIC, AND THE ARITHMETIC FILLS THE GAP.
 *
 * No date written → the computed one, carrying «تقديري».
 * A date written  → that date, and the word is dropped.
 *
 * And a computed number is never "corrected" by another computed number.
 * Moving 7 February to 8 February would be swapping one guess for another
 * when the difference comes from the crescent and not from the table; the
 * right answer is for a person to write the announced date, at which point
 * the whole estimate falls away.
 */
export function ramadanDates() {
  const d = state.ramadanDates || {};
  return { from: d.from || '', eid: d.eid || '' };
}
export function setRamadanDates(from, eid) {
  state.ramadanDates = { from: (from || '').trim(), eid: (eid || '').trim() };
  save();
}

/* ---------------- greetings ------------------------------------------
 * One tool for every occasion. A card at the first launch inside its own
 * dates, once per device, and it ends by itself.
 */

/**
 * ⚠️ THE DAY KEY IS BUILT FROM THE LOCAL DATE, NEVER FROM `toISOString()`.
 * That call returns UTC: a reader in Houston opening the app at 19:00 on
 * 22 March reads 23 March there, so a greeting whose last day is the 22nd
 * would vanish five hours early — and one starting on the 23rd would
 * appear five hours before its day. The comparison is then a STRING
 * compare, which is correct because 'YYYY-MM-DD' sorts in date order, and
 * it is what keeps the whole question out of timezone arithmetic.
 *
 * It reads `now()` and not `Date.now()`, so the panel's test clock winds
 * the greetings forward with everything else that is dated.
 */
export function todayKey(ms) {
  const d = new Date(ms == null ? now() : ms);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function greetings() { return state.greetings || []; }
export function greetingById(id) { return greetings().find(g => g.id === id) || null; }
export function greetingSeen(id) { return (state.seenGreetings || []).includes(id); }

/** live = switched on, inside its dates, and not yet seen on this device */
export function liveGreeting(day) {
  const k = day || todayKey();
  return greetings().find(g => !g.off && g.from <= k && k <= g.to && !greetingSeen(g.id)) || null;
}

/** the same window, ignoring whether it has been seen — what the panel shows */
export function greetingState(g, day) {
  const k = day || todayKey();
  if (g.off) return 'off';
  if (k < g.from) return 'soon';
  if (k > g.to) return 'over';
  return 'live';
}

export function markGreetingSeen(id) {
  if (!id || greetingSeen(id)) return;
  state.seenGreetings = (state.seenGreetings || []).concat(id);
  save();
}

/**
 * ⚠️ ONE LIVE AT A TIME, and the refusal names the other one. Two
 * overlapping greetings are two cards stacked on one launch, and the
 * second would never be read. Two windows overlap when each starts before
 * the other ends — the string compare of the day keys again.
 */
export function greetingClash(from, to, ignoreId) {
  return greetings().find(g => g.id !== ignoreId && from <= g.to && g.from <= to) || null;
}

/**
 * Add or update. Returns { ok } or { ok: false, err, clash } — the panel
 * puts the reason under the field that caused it, never in a toast.
 */
export function saveGreeting(g) {
  const title = (g.title || '').trim();
  const body = (g.body || '').trim();
  const from = (g.from || '').trim();
  const to = (g.to || '').trim();
  if (!title) return { ok: false, err: 'title' };
  if (!body) return { ok: false, err: 'body' };
  if (!from) return { ok: false, err: 'from' };
  if (!to) return { ok: false, err: 'to' };
  if (to < from) return { ok: false, err: 'order' };
  const clash = greetingClash(from, to, g.id);
  if (clash) return { ok: false, err: 'clash', clash };
  const rec = {
    id: g.id || 'g' + Date.now().toString(36),
    title, body, from, to,
    cta: g.cta && g.cta.label && g.cta.route ? { label: g.cta.label, route: g.cta.route } : null,
    off: !!g.off,
  };
  const list = greetings().slice();
  const i = list.findIndex(x => x.id === rec.id);
  if (i < 0) list.push(rec); else list[i] = rec;
  state.greetings = list;
  /* ⚠️ the log line BEFORE the save, or it is never written to disk —
     `logAdminAction` builds the row and leaves the persisting to its
     caller, the way every other action in this file does. */
  logAdminAction(rec.title, i < 0 ? 'greetAdd' : 'greetEdit');
  save();
  return { ok: true, greeting: rec };
}

export function deleteGreeting(id) {
  const g = greetingById(id);
  state.greetings = greetings().filter(x => x.id !== id);
  if (g) logAdminAction(g.title, 'greetDelete');
  save();
}

/** ⚠️ Immediate, and that is the point: a typo in something everybody
    sees once has to stop NOW, not on the day its window ends. */
export function setGreetingOff(id, off) {
  const g = greetingById(id);
  if (!g) return;
  g.off = !!off;
  logAdminAction(g.title, off ? 'greetOff' : 'greetOn');
  save();
}

export function setSeason(season, on) {
  state.seasons = Object.assign({}, state.seasons, { [season]: !!on });
  save();
}

/* ---------------- the order of the two blocks on #/prayer and #/mass ----
 * Occasions first is Rai's decision after the `pm.html` walkthrough, and
 * it is deliberately reversible from the panel: mass times will arrive
 * from the churches themselves, and when they do the answer changes — so
 * the order flips with a tap rather than a batch and a session and a wait.
 *
 * TWO SWITCHES, NOT ONE, because the two reasons are different: the mass
 * is the only one that will change. One switch would force both screens
 * to move together to fix one of them.
 *
 * ⚠️ `=== undefined`, NEVER `!v`. A switch turned off on purpose holds
 * `false`, and reading it with `!v` sends it back to the default on every
 * open — a switch that is turned off and will not stay off.
 */
export function occFirst(screen) {
  const v = state.occFirst && state.occFirst[screen];
  return v === undefined ? true : !!v;
}
export function setOccFirst(screen, on) {
  state.occFirst = Object.assign({}, state.occFirst, { [screen]: !!on });
  save();
}

/* ------------------------------------------------------------
   Three layers, one rule: an attribute is offered where it has
   enough content to be worth offering. Nothing is hand-listed, so
   a speciality appears on its own the day the data arrives.
   ------------------------------------------------------------ */

/** every attribute defined for `cat` and in season — the add/edit form */
export function attrsForCat(cat) {
  return ATTRIBUTES.filter(a => attrInCat(a, cat) && seasonOn(a.season));
}

/** how many listed businesses in `cat` actually carry each attribute */
export function attrCounts(cat) {
  const pool = allBusinesses().filter(b => cat === 'all' || cat === '*' || b.cat === cat);
  const out = {};
  pool.forEach(b => (b.attributes || []).forEach(id => { out[id] = (out[id] || 0) + 1; }));
  return out;
}

/** the filter sheet: anything with at least one business behind it */
export function filterAttrsForCat(cat) {
  const counts = attrCounts(cat);
  return attrsForCat(cat).filter(a => (counts[a.id] || 0) >= 1);
}

/** …grouped, in registry order. `all` shows every defined attribute. */
export function attrGroupsForCat(cat, { all = false } = {}) {
  const list = all ? attrsForCat(cat) : filterAttrsForCat(cat);
  return ATTR_GROUPS
    .filter(g => seasonOn(g.season))
    .map(g => ({ group: g, attrs: list.filter(a => a.group === g.id) }))
    .filter(g => g.attrs.length);
}

/**
 * Chips above the results. An attribute earns one by being carried by at
 * least CHIP_MIN businesses in the category — and by fewer than
 * CHIP_MAX_SHARE of them, because something almost everyone has narrows
 * nothing and only costs the row its best slot.
 */
export function quickAttrsForCat(cat, limit = 0) {
  const counts = attrCounts(cat);
  const pool = allBusinesses().filter(b => cat === 'all' || cat === '*' || b.cat === cat).length;
  const ceiling = Math.max(CHIP_MIN, Math.floor(pool * CHIP_MAX_SHARE));
  const out = attrsForCat(cat)
    .filter(a => (counts[a.id] || 0) >= CHIP_MIN && (counts[a.id] || 0) <= ceiling)
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  return limit ? out.slice(0, limit) : out;
}

/* ============================================================
   Where things are
   ------------------------------------------------------------
   A distance needs two points. The device can give us the user's;
   the listings have none yet — geocoding the 514 addresses is a data
   job done outside the app. Until a listing has coordinates, the app
   shows the area it is in and never a number: one invented mile
   undoes the trust the whole directory runs on.
   ============================================================ */

/** the city out of "…, Katy, TX 77450" — works on all 514 */
const cityCache = new Map();
/* Four steps and no slider: a slider invites a value nobody chose and
   there is no right answer between 17 and 19. «عادي» is 17 — the base the
   stylesheet declares — so a reader who never opens this screen is never
   moved.

   This is deliberately IN ADDITION to the device's own text setting, not
   instead of it: every size is a `rem`, so the phone's setting already
   comes through by itself, and the two multiply. Somebody who enlarged
   their phone AND picks «كبير» here gets both, which is correct — they
   know their own eyes better than we do. */
export const FONT_SIZES = [16, 17, 19, 21];
export const FONT_DEFAULT = 17;
export function fontScale() {
  const n = Number(state.fontScale);
  return FONT_SIZES.includes(n) ? n : FONT_DEFAULT;
}
export function setFontScale(px) {
  const n = Number(px);
  state.fontScale = FONT_SIZES.includes(n) ? n : FONT_DEFAULT;
  save();
}

/* ---------------- the wait between «سماح» and the point ----------------
   Memory only, never saved: a reload is not still waiting for anything.
   It lives here rather than in a screen because the prayer bar on Home
   and the `#/prayer` screen must not disagree about whether a request is
   in flight, and `render()` rebuilds both from scratch. */
let geoInFlight = false;
export function geoPending() { return geoInFlight; }
export function setGeoPending(on) { geoInFlight = !!on; }

export function themeMode() { return state.theme || 'auto'; }
export function setThemeMode(mode) {
  state.theme = (mode === 'light' || mode === 'dark') ? mode : 'auto';
  save();
}

export function cityOf(biz) {
  if (!biz) return '';
  if (biz.city) return biz.city;
  const addr = String(biz.address || '');
  if (cityCache.has(addr)) return cityCache.get(addr);
  /* "…, Katy, TX 77450" is the normal shape; two rows carry only
     "Katy, TX 77449 (…)" with no street before it, so the city is also
     accepted at the very start of the address. */
  const m = addr.match(/,\s*([^,]+?),\s*[A-Z]{2}\b/) || addr.match(/^\s*([A-Za-z .'-]+?),\s*[A-Z]{2}\b/);
  const city = m ? m[1].trim() : '';
  cityCache.set(addr, city);
  return city;
}

/* ============================================================
   PRAYER — the settings, the point, and the mosques nearby
   ============================================================ */

/** 'isna' · 'mwl' · 'makkah' · 'jafari' — a setting, never a constant */
export function prayerMethod() { return (state.prayer && state.prayer.method) || 'isna'; }
export function setPrayerMethod(m) {
  state.prayer = Object.assign({ method: 'isna', asr: 1 }, state.prayer, { method: m });
  save();
}
/** 1 = the majority, 2 = Hanafi */
export function asrShadow() { return (state.prayer && state.prayer.asr) === 2 ? 2 : 1; }

/* ---------------- the bar on Home: asked, not assumed ----------------
   Rai asked for a hide switch, defaulted to HIDDEN, out of consideration
   for Christian readers. The intent is right and the default costs more
   than it saves:

   Free, useful content is what brings people back, and the times are the
   strongest of it. Hidden by default nobody sees it, and a feature built
   over a whole batch sits in Settings unread.

   And «hidden by default» is us ASSUMING the reader is bothered. An Arab
   Christian is not bothered by prayer times existing — at most they do
   not concern him. Somebody who is ASKED feels the app respects them;
   somebody who finds a thing hidden feels the app is not theirs.

   So: one neutral card, once. `null` = not asked yet. Whatever the answer,
   it is never asked again, and `#/prayer` stays in the drawer either way
   — this is about the strip on Home and nothing else. */
export function prayerBarPref() {
  const v = state.prayer && state.prayer.homeBar;
  return v === undefined ? null : !!v;
}
export function setPrayerBarPref(on) {
  state.prayer = Object.assign({ method: 'isna', asr: 1 }, state.prayer, { homeBar: !!on });
  save();
}
export function prayerBarAsked() { return prayerBarPref() !== null; }

/** Pre-adhan alert: the switch exists, the delivery does not — see below. */
/**
 * Somebody suggesting a mosque or a church they know. It enters the same
 * review queue every user-entered business does, and it is born:
 *   · `cat: 'worship'` — set from the door they came through, never
 *     chosen by the sender and therefore never wrong;
 *   · NON-COMMERCIAL, by the category rule in `isNonCommercial`;
 *   · with NO service times of any kind. A stranger adds the place; only
 *     its own people add its times, after claiming the page.
 */
export function suggestWorship({ name, address, phone, kind }) {
  const rec = {
    id: 'u' + Date.now(),
    name: { ar: name, en: name },
    cat: 'worship',
    phone: String(phone || '').trim(),
    address: String(address || '').trim(),
    desc: { ar: '', en: '' },
    hours: [null, null, null, null, null, null, null],
    tags: [], attributes: [],
    plan: 'free', verified: false, rating: 0, reviewCount: 0,
    claimed: false, photos: 0, videos: 0,
    needsGeo: true,
    status: 'pending',
    suggested: true,
    worshipHint: kind === 'church' ? 'church' : 'mosque',
  };
  state.extraBusinesses = state.extraBusinesses || [];
  state.extraBusinesses.unshift(rec);
  save();
  return rec;
}

export function prayerAlert() { return !!(state.prayer && state.prayer.alert); }
export function setPrayerAlert(on) {
  state.prayer = Object.assign({ method: 'isna', asr: 1 }, state.prayer, { alert: !!on });
  save();
}
export function setAsrShadow(n) {
  state.prayer = Object.assign({ method: 'isna', asr: 1 }, state.prayer, { asr: n === 2 ? 2 : 1 });
  save();
}

/**
 * The point the times are computed from.
 *
 * The device's own position when there is one; otherwise the centre of the
 * city the reader picked by hand, which is accurate to well under the
 * minute we print. Nothing at all when neither exists — and then the app
 * asks for a location instead of computing from a city it invented.
 */
export function prayerPoint() {
  if (state.geo && isFinite(state.geo.lat) && isFinite(state.geo.lng)) {
    return { lat: state.geo.lat, lng: state.geo.lng, source: 'device' };
  }
  const city = userCity();
  const hit = city && CITY_POINTS.find(c => c.city === city);
  return hit ? { lat: hit.lat, lng: hit.lng, source: 'city' } : null;
}

/**
 * The mosques nearest the reader. Empty outside the region we cover — the
 * times work anywhere in the United States, the DIRECTORY does not, and a
 * "mosques near you" list with nothing in it reads as a broken app rather
 * than as an honest boundary.
 */
export function nearbyMosques(n = 5) {
  if (!inCoverage()) return [];
  const list = allBusinesses().filter(isMosque);
  const withD = list.map(b => ({ b, d: distanceTo(b) }));
  const known = withD.filter(x => x.d !== null).sort((a, b) => a.d - b.d);
  const rest = withD.filter(x => x.d === null)
    .sort((a, b) => (sameCity(b.b) ? 1 : 0) - (sameCity(a.b) ? 1 : 0)
                 || (b.b.rating || 0) - (a.b.rating || 0));
  return known.concat(rest).slice(0, n).map(x => x.b);
}

/**
 * Mosque or church, read from the record's OWN declared kind — never
 * guessed from its name and never assigned by us. The 33 imported places
 * of worship carried no kind at all until V.03.1, so the app could not
 * tell a masjid from a parish and showed neither the adhan nor the honest
 * blank; the fix was the data, not the code.
 */
const MOSQUE_KINDS = ['wkMosque', 'wkMusalla', 'wkIslamicCenter'];
export function worshipKind(biz) {
  if (!biz || biz.cat !== 'worship') return null;
  const attrs = biz.attributes || [];
  if (attrs.some(a => MOSQUE_KINDS.includes(a))) return 'mosque';
  if (attrs.some(a => a.indexOf('wk') === 0)) return 'church';
  const w = biz.worship;
  return w && w.kind ? (w.kind === 'church' ? 'church' : 'mosque') : null;
}
export function isMosque(biz) { return worshipKind(biz) === 'mosque'; }
export function isChurch(biz) { return worshipKind(biz) === 'church'; }

/**
 * The churches nearest the reader — the same component as `nearbyMosques`
 * and deliberately not a second one.
 *
 * ORDERED BY DISTANCE AND BY NOTHING ELSE. Not the biggest, not the
 * oldest, not the most viewed, and no placement in here is for sale. A
 * place of worship is the one surface in this app where a ranking anybody
 * could buy would cost more trust than the whole directory earns.
 */
export function nearbyChurches(n = 5) {
  if (!inCoverage()) return [];
  const withD = allBusinesses().filter(isChurch).map(b => ({ b, d: distanceTo(b) }));
  const known = withD.filter(x => x.d !== null).sort((a, b) => a.d - b.d);
  const rest = withD.filter(x => x.d === null)
    .sort((a, b) => (sameCity(b.b) ? 1 : 0) - (sameCity(a.b) ? 1 : 0));
  return known.concat(rest).slice(0, n).map(x => x.b);
}

/**
 * What a church has actually published about its services — never a time
 * we worked out for it. The same rule that stopped us inventing a jumuah
 * for a mosque: a blank is what creates the pressure that fills it, and an
 * invented mass time sends somebody to a locked door.
 */
export function servicesFor(biz) {
  const own = (state.bizEdits && state.bizEdits[biz && biz.id]) || {};
  const sv = own.services || (biz && biz.services) || null;
  if (!sv) return null;
  const sunday = (sv.sunday || []).filter(Boolean);
  const weekday = (sv.weekday || []).filter(Boolean);
  if (!sunday.length && !weekday.length && !(sv.note && (sv.note.ar || sv.note.en))) return null;
  return { sunday, weekday, note: sv.note || { ar: '', en: '' } };
}

/** the jumuah / iqama a place of worship has actually published */
export function worshipOf(biz) { return (biz && biz.worship) || null; }

/**
 * The mosque's own times, entered by whoever claimed it. They are NOT
 * computed and never can be: ISGH prays jumuah at 1:30 and the mosque
 * down the road at 2:00, and that is a decision, not astronomy.
 */
export function saveWorshipTimes(bizId, worship) {
  const before = businessById(bizId);
  applyBusinessEdit(bizId, { worship: Object.assign({}, (before && before.worship) || {}, worship) });
}

/**
 * «الوقت غير صحيح؟ صحّحه» — every mosque has hundreds who go each Friday,
 * and one of them fixes it in half a minute. It goes to the admin queue,
 * never straight onto the listing.
 */
export function reportWorshipTime(bizId, text) {
  const line = String(text || '').trim();
  if (!line) return null;
  const item = { id: 'wf' + Date.now(), bizId, text: line, when: now(), status: 'pending' };
  state.worshipFixes = (state.worshipFixes || []).concat(item);
  save();
  return item;
}
export function pendingWorshipFixes() {
  return (state.worshipFixes || []).filter(f => f.status === 'pending');
}
export function resolveWorshipFix(id) {
  state.worshipFixes = (state.worshipFixes || [])
    .map(f => f.id === id ? Object.assign({}, f, { status: 'done' }) : f);
  save();
}

/** every city the directory actually covers, with how many listings each holds */
export function directoryCities() {
  const counts = new Map();
  allBusinesses().forEach(b => {
    const c = cityOf(b);
    if (!c) return;
    counts.set(c, (counts.get(c) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([city, n]) => ({ city, n }))
    .sort((a, b) => b.n - a.n || a.city.localeCompare(b.city));
}

/** the user's chosen or detected city, '' when we do not know yet */
/* The name the reader is standing under. A hand-picked REGION has no city
   of its own — that is deliberate, so the directory keeps the suburbs —
   but the chip still has to say something true, and the region's name is
   exactly what they chose. */
export function userCity() {
  const l = state.location || {};
  return l.city || (l.region ? regionNameOf(l.region) : '');
}
export function hasLocation() { return !!userCity(); }

/**
 * @param geo  the device's point, or null when the reader picked the city
 *             themselves. That difference is recorded as `location.manual`
 *             and decides whether the city may later change behind their
 *             back: a point that arrives on its own may update in silence,
 *             a city somebody typed may not.
 */
export function setUserLocation(loc, geo) {
  const fromDevice = !!(geo && isFinite(geo.lat) && isFinite(geo.lng));
  state.location = Object.assign({ zip: '', city: '', state: 'TX' }, loc, { manual: !fromDevice });
  if (fromDevice) state.geoGranted = true;
  /* A hand-picked city carries no point of its own, and the point we had
     belonged to wherever the reader was before. Keeping it would compute
     miles from a place they have left, which is worse than no miles. */
  state.geo = (geo && isFinite(geo.lat) && isFinite(geo.lng))
    ? { lat: geo.lat, lng: geo.lng, at: now() }
    : null;
  save();
}
export function clearUserLocation() {
  /* `manual: true` — clearing is a decision, exactly like picking a city
     by hand, and it has to survive the next cold open. Without it the
     quiet refresh would put a city straight back and «امسح الموقع» would
     read as a button that does nothing. The permission itself is NOT
     revoked (iOS asks once, and we do not spend that question twice), so
     the reader is offered the new city rather than given it. */
  state.location = { zip: '', city: '', state: 'TX', manual: true };
  state.geo = null;
  save();
}
/**
 * The last failed location read — FOR DIAGNOSIS, and shown on no public
 * screen. A fault that leaves no trace is not diagnosed, it is guessed at:
 * the silent refresh failed silently for months and neither Rai could know
 * it had nor could anybody prove it. The reader is not frightened with a
 * fault they can do nothing about; we simply stop guessing.
 */
export function noteGeoFail(code) {
  state.geoFail = { code: code || 0, at: now(), n: ((state.geoFail || {}).n || 0) + 1 };
  save();
}
export function geoFail() { return state.geoFail || null; }
/** cleared by the first success, so the note never outlives the fault */
export function clearGeoFail() { if (state.geoFail) { delete state.geoFail; save(); } }

/** did the reader choose this city by hand? */
export function cityIsManual() { return !!(state.location && state.location.manual); }
export function geoGranted() { return !!state.geoGranted; }
/* Asked once per session and never again after a «no» — memory only,
   because «leave it» is an answer about this visit, not a setting. */
let moveAsked = false;
export function moveAlreadyAsked() { return moveAsked; }
export function markMoveAsked() { moveAsked = true; }

export function markGeoAsked() { state.geoAsked = true; save(); }
export function markGeoDenied() { state.geoDenied = true; save(); }

/** miles between two points */
export function haversine(a, b) {
  const R = 3958.8;                       // earth radius in miles
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** does this listing have a real position of its own? */
export function hasCoords(biz) {
  return !!(biz && isFinite(biz.lat) && isFinite(biz.lng) && (biz.lat || biz.lng));
}

/**
 * Real miles, or null. Null whenever either point is missing — which is
 * every listing today, because none of them has been geocoded yet. The
 * caller shows the area name instead; it never guesses.
 */
export function distanceTo(biz) {
  if (!state.geo || !hasCoords(biz)) return null;
  /* «450 ميلاً» under every name is not information, it is noise — and
     ordering by nearest between two shops 449 and 451 miles away is an
     ordering that means nothing. Somebody outside the covered areas gets
     the area name instead, which is what `distLabel` already does with a
     null. (A reader who picked a region by hand has no point at all —
     `setUserRegion` clears it — so this never reaches them.) */
  if (!inCoverage()) return null;
  return haversine(state.geo, { lat: biz.lat, lng: biz.lng });
}

/**
 * Which of the directory's cities a point is in — or the nearest one, if
 * it is still inside the region we cover. Outside that, nothing: we would
 * rather say "the whole area" than name a city an hour away.
 */
export function nearestCity(point) {
  if (!point || !isFinite(point.lat) || !isFinite(point.lng)) return null;
  let best = null;
  CITY_POINTS.forEach(c => {
    const d = haversine(point, c);
    if (!best || d < best.miles) best = { city: c.city, miles: d };
  });
  return best && best.miles <= REGION_RADIUS_MI ? best : null;
}

/** everything the app covers, whichever city the reader is in */
export function inRegion(point) { return !!nearestCity(point); }

/** is this listing in the city the reader is in? */
export function sameCity(biz) {
  const c = userCity();
  return !!c && cityOf(biz) === c;
}

/** has anything in the directory been geocoded yet? */
export function anyGeocoded() { return allBusinesses().some(hasCoords); }

/**
 * Can a radius filter anything at all? Only when both halves exist: a
 * point for the reader and at least one listing with coordinates of its
 * own. Until then the sheet offers "my city / the whole area" instead —
 * a mile figure nobody can compute is not a filter, it is a dead option.
 */
export function radiusUsable() { return !!state.geo && anyGeocoded(); }

/** which listings a chosen area keeps. Unknown positions are never dropped:
    we do not know they are far, and guessing them away empties the screen. */
export function inArea(biz, area) {
  if (!area || area === 'all') return true;
  if (area === 'city') return sameCity(biz);
  const d = distanceTo(biz);
  return d == null ? true : d <= Number(area);
}
export function setArea(v) { state.area = v || 'all'; save(); }

/**
 * Nearest first, with everything whose distance we do not know after it —
 * never slipped in at a guessed position. Order inside each half is kept.
 */
export function byNearest(list) {
  const known = [], unknown = [];
  list.forEach(b => {
    const d = distanceTo(b);
    if (d == null) unknown.push(b); else known.push({ b, d });
  });
  known.sort((x, y) => x.d - y.d);
  return known.map(x => x.b).concat(unknown);
}

/**
 * Is the reader inside the area a Houston advertiser is worth paying for?
 * Greater Houston — the cities the directory covers — and not Texas: an
 * advertiser in Houston is worth showing to somebody in Katy and worth
 * nothing to somebody in Dallas. An unknown location rules nothing out.
 */
export function inCoverage() {
  if (state.geo) return !!nearestCity(state.geo);
  /* A region chosen by hand IS coverage — that is the whole point of
     choosing one, and it carries no point of its own to snap. */
  if (state.location && state.location.region) return true;
  const c = userCity();
  if (!c) return true;
  return CITY_POINTS.some(p => p.city === c) || directoryCities().some(x => x.city === c);
}

/**
 * A WHOLE REGION, not a city.
 *
 * And `city` is deliberately NOT written here — that difference is what
 * makes the whole thing work. Writing `city: 'Houston'` would show the
 * reader the businesses of the city of Houston alone and drop half the
 * directory on the floor, because half the shops are in the suburbs and
 * not in the city. So the region id is stored, the filter reads it, and
 * everything else follows behind.
 */
export function setUserRegion(id) {
  state.location = { zip: '', city: '', state: 'TX', region: id, manual: true };
  state.geo = null;                 // chosen by hand, so there is no point with it
  save();
}
/** the region the reader picked by hand, or '' */
export function userRegion() {
  return (state.location && state.location.region) || '';
}
/** every listing of one region — all of its cities */
export function businessesOfRegion(id) {
  const cities = new Set(CITY_POINTS.filter(c => c.region === id).map(c => c.city));
  return allBusinesses().filter(b => cities.has(cityOf(b)));
}
/* ---------------- the state ---------------- */
/**
 * How many states the directory actually covers. Today one, so the code
 * is never printed beside a city: «Houston TX» five hundred times is
 * noise. The field is in the data now and the display turns itself on the
 * day a second state arrives — there is no later change to make.
 */
export function statesCovered() {
  return new Set(REGIONS.map(r => r.state).filter(Boolean)).size;
}
/** the state code a city sits in, or '' */
export function stateCodeFor(city) {
  const c = CITY_POINTS.find(x => x.city === city);
  const r = c && REGIONS.find(x => x.id === c.region);
  return (r && r.state) || '';
}
/**
 * A reader who pressed the state suggestion — and it is `stateOnly` that
 * says so, never `location.state`.
 *
 * ⚠️ `state: 'TX'` IS A DEFAULT WRITTEN BY EVERY LOCATION WRITER (four of
 * them), so reading it as «this reader chose a state» made the chip say
 * «TX» to somebody whose point had simply not been named yet — and that
 * is the V.03.8 rule inverted: a point with no name says «موقعك الحالي»,
 * never an invented place. v31 caught it.
 */
export function userState() {
  const l = state.location || {};
  return (l.stateOnly && !l.city && !l.region && l.state) ? l.state : '';
}
/** press the suggestion: the whole state, which is every city in it */
export function setUserState(code) {
  state.location = { zip: '', city: '', state: code, region: '', manual: true, stateOnly: true };
  state.geo = null;
  save();
}
/**
 * A whole query that names a state. NEVER a search term — see the note on
 * `STATE_SUGGEST` in `data.js`: the code is in all 514 addresses, so
 * matching it loosely returns the directory and answers nothing.
 * `isCode` separates the two halves: a code carries no information and its
 * results are suppressed; a name is in real shop names and its results
 * stand, with the suggestion above them.
 */
export function stateSuggestion(term) {
  const q = normalize(String(term || '').trim());
  if (!q) return null;
  for (const st of STATE_SUGGEST) {
    if (normalize(st.code) === q) return { code: st.code, name: st.name, isCode: true };
    if (normalize(st.name) === q || st.words.some(w => normalize(w) === q)) {
      return { code: st.code, name: st.name, isCode: false };
    }
  }
  return null;
}

/** the regions on offer, each with what stands behind it */
export function regionsWithCounts() {
  return REGIONS.map(r => ({ id: r.id, name: r.name, n: businessesOfRegion(r.id).length }));
}
/**
 * WHICH region the reader belongs to — their own choice, else the region
 * of the city they are in, else the first one, which is right while there
 * is only one and stays honest when there are several. The WORDS are
 * built in `ui.js`, because the store does not read i18n.
 */
export function currentRegion() {
  const l = state.location || {};
  if (l.region) return l.region;
  const byCity = CITY_POINTS.find(c => c.city === l.city);
  if (byCity) return byCity.region;
  const near = state.geo && nearestCity(state.geo);
  const byGeo = near && CITY_POINTS.find(c => c.city === near.city);
  if (byGeo) return byGeo.region;
  return (REGIONS[0] && REGIONS[0].id) || '';
}

/** the name of a region id — never translated, it is a place */
export function regionNameOf(id) {
  const r = REGIONS.find(x => x.id === id);
  return r ? r.name : '';
}

/**
 * TWO LAYERS, not a chain of tiebreaks — Rai's decision: «whoever pays is
 * always on top, and among them by how near they are to the reader».
 *
 * The chain this replaces did not deliver that, and the four reasons were
 * all in the code: `pinSponsored` lifted exactly ONE row however many had
 * paid; `isPaid` was the THIRD tiebreak, behind a decimal rating that
 * practically never ties, so it was a dead condition; a new subscriber
 * with no ratings yet sank below every free listing that had one; and the
 * day coordinates arrive the order becomes pure distance with `isPaid` not
 * in it at all — so a subscriber's position would get WORSE as the data
 * got better. Measured on V.06.3: three subscribers landed at 8, 9 and 10,
 * under five free listings and under the upgrade card.
 *
 *   layer one   every active subscription, ordered by distance
 *   layer two   everything else, in the order the caller already built
 *
 * ⚠️ Inside layer one: real miles first for whoever has coordinates, then
 * the rest — the reader's own city, then the rating. A subscriber with no
 * coordinates SINKS INSIDE THE LAYER RATHER THAN LEAVING IT. They paid.
 * That is `byNearest`'s own rule: the unknown comes after the known and is
 * never dropped.
 *
 * ⚠️ Layer one applies INSIDE THE COVERAGE ONLY. A reader in Dallas gets
 * no Houston subscriber lifted for them — the money bought the readers of
 * this region. That gate was `pinSponsored`'s and is carried over, not
 * dropped.
 *
 * ⚠️ MEASURED, and said before anything is built on it: 0 of 514 listings
 * have coordinates today, so the «nearest» half computes nothing yet and
 * layer one falls entirely to its fallback. That is correct and intended;
 * the decision completes itself the day the coordinates batch lands.
 *
 * ⚠️ And every row of layer one keeps its «إعلان مموّل» mark and its full
 * distance line. THE MONEY BUYS THE POSITION, NOT THE RIGHT TO HIDE THE
 * DISTANCE — a directory that sells the top without saying so loses trust
 * worth more than the subscription.
 */
export function paidFirst(list) {
  if (!inCoverage()) return { list, ids: [] };
  const paid = list.filter(isPaid);
  if (!paid.length) return { list, ids: [] };

  const known = [], unknown = [];
  paid.forEach(b => {
    const d = distanceTo(b);
    if (d == null) unknown.push(b); else known.push({ b, d });
  });
  known.sort((x, y) => x.d - y.d);
  /* ⚠️ Verification is a tiebreak INSIDE a layer, never a jump over one.
     «Verified above subscribed» was decided on the old single list; in a
     two-layer model a subscriber is a layer above, so the two decisions
     cannot both hold literally. This is the reading that keeps both: a
     verified shop leads an unverified one IN ITS OWN SITUATION. */
  unknown.sort((a, b) => (sameCity(b) - sameCity(a))
                      || (businessVerified(b) - businessVerified(a))
                      || (ratingFor(b).avg - ratingFor(a).avg));
  const top = known.map(x => x.b).concat(unknown);

  const ids = top.map(b => b.id);
  const seen = new Set(ids);
  return { list: top.concat(list.filter(b => !seen.has(b.id))), ids };
}

/** listings still waiting for coordinates — the admin queue and its export */
export function needsGeoList() {
  return everyBusiness().filter(b => !hasCoords(b));
}
export function geoQueueCsv() {
  const rows = needsGeoList().map(b => [b.id, (b.name && (b.name.en || b.name.ar)) || '', b.address || '']);
  const cell = (v) => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  return 'id,name,address\n' + rows.map(r => r.map(cell).join(',')).join('\n') + '\n';
}

/** how many listings a category holds — the denominator for CHIP_MAX_SHARE */
export function categorySize(cat) {
  return allBusinesses().filter(b => cat === 'all' || cat === '*' || b.cat === cat).length;
}

/** how many businesses in this category carry each attribute — for the sheet */
export function attrCountsFor(cat) { return attrCounts(cat); }
export function hasAttr(biz, id) {
  return Array.isArray(biz && biz.attributes) && biz.attributes.includes(id);
}
/** every selected attribute must be present — chips combine, they do not widen */
export function matchesAttrs(biz, ids) {
  if (!ids || !ids.length) return true;
  return ids.every(id => hasAttr(biz, id));
}

/* ============================================================
   Search
   ------------------------------------------------------------
   Name and description alone missed anyone who typed what they
   actually wanted — "شاورما", "أسنان", "tow". Keywords and the
   category name join the haystack, and both languages are always
   searched whatever the interface is set to, because people type
   in whichever one is under their thumb.
   ============================================================ */

/** strip case, tatweel, diacritics and alef/ya/ta-marbuta variants */
export function normalize(str) {
  return String(str == null ? '' : str)
    .toLowerCase()
    .replace(/[\u0640]/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .trim();
}

/* The haystack is read once per listing per search, and the filter sheet
   asks for a count per option — about ninety searches in one tap. Once the
   attribute labels went in, rebuilding it every time cost 260ms to open
   that sheet. Unedited listings are the same object every call, so the
   cache hits on all of them; an edited one is a fresh object and simply
   misses, which is correct rather than stale. */
let haystackCache = new WeakMap();

let squashCache = new WeakMap();
let catCache = new WeakMap();

/** the same text with every separator removed — see synonyms.js */
export function squashedHaystack(biz) {
  if (!squashCache.has(biz)) searchHaystack(biz);
  return squashCache.get(biz) || '';
}

/** everything a business can be found by, both languages at once — its own
    words only: the category name is a label and is held apart, below */
export function searchHaystack(biz) {
  const hit = haystackCache.get(biz);
  if (hit !== undefined) return hit;
  const cat = CATEGORIES.find(c => c.id === biz.cat);
  const parts = [
    biz.name && biz.name.ar, biz.name && biz.name.en,
    biz.desc && biz.desc.ar, biz.desc && biz.desc.en,
    biz.address,
    ...(Array.isArray(biz.tags) ? biz.tags : []),
    /* 342 specialities, at least one on every listing, and the search
       could not reach a single one: «مواقف» returned nothing while 130
       listings carried the parking attribute. */
    ...(Array.isArray(biz.attributes) ? biz.attributes.map(attrLabel) : []),
  ];
  const hay = normalize(parts.filter(Boolean).join(' '));
  haystackCache.set(biz, hay);
  squashCache.set(biz, squash(hay));
  catCache.set(biz, normalize(cat ? catNames(cat.key) : ''));
  return hay;
}

/** the category name, kept apart from the record's own words because it is
    matched by a different rule — see catMatches() in synonyms.js */
export function catHaystack(biz) {
  if (!catCache.has(biz)) searchHaystack(biz);
  return catCache.get(biz) || '';
}

/** one expanded word against one listing: its own text, or its category name */
function answers(biz, entry) {
  return hayMatches(searchHaystack(biz), entry, squashedHaystack(biz))
      || catMatches(catHaystack(biz), entry);
}

/** both translations of one attribute id — the key is derived from the id
    exactly as the registry derives it, so the two cannot drift */
function attrLabel(id) {
  try {
    const packs = i18nPacks();
    const k = 'attr' + id[0].toUpperCase() + id.slice(1);
    return [packs.ar[k], packs.en[k]].filter(Boolean).join(' ');
  } catch (e) { return ''; }
}

/** both translations of a category key, so either language finds it */
function catNames(key) {
  try {
    const packs = i18nPacks();
    return [packs.ar[key], packs.en[key]].filter(Boolean).join(' ');
  } catch (e) { return ''; }
}
let _packs = null;
function i18nPacks() {
  if (!_packs) _packs = { ar: {}, en: {} };
  return _packs;
}
/** i18n hands its tables over at boot; store must not import a screen module */
export function registerStrings(packs) {
  _packs = packs;
  // every cached string was built from the old pack — all three go together
  haystackCache = new WeakMap();
  squashCache = new WeakMap();
  catCache = new WeakMap();
}

export function matchesSearch(biz, term) {
  const q = normalize(term);
  if (!q) return true;
  // every word must appear somewhere — "مطعم حلال" should narrow, not widen.
  // The filter sheet uses this too, so it reads the dictionary as the
  // search does and the two can never disagree.
  return expandQuery(term, normalize).every(p => answers(biz, p));
}

/** how many of the typed words, dictionary included, this listing matches */
function wordHits(biz, parts) {
  return parts.reduce((n, p) => n + (answers(biz, p) ? 1 : 0), 0);
}

/**
 * Search in three stages, because "every word must match" was throwing
 * away the answer. Typing «صالون فلوريدا» returned nothing while
 * "Florida Beauty Salon" sat in the directory: one extra word zeroed the
 * result. So:
 *
 *   1. all the words — if anything matches, that is the answer;
 *   2. otherwise any word, best first, and the screen says plainly that
 *      this is not what was asked for;
 *   3. otherwise nothing, and the caller offers the longest word and the
 *      matching category names as buttons that do work.
 *
 * @returns { list, mode: 'all'|'exact'|'loose'|'none', suggestions }
 */
export function searchBusinesses(list, term) {
  const q = normalize(term);
  if (!q) return { list, mode: 'all', suggestions: [] };
  const words = q.split(/\s+/).filter(Boolean);
  /* what the reader typed, plus every word that means the same thing to
     somebody searching. The three stages are unchanged — the dictionary
     makes the first one succeed more often, it does not replace it. */
  const parts = expandQuery(term, normalize);

  const exact = list.filter(b => {
    return parts.every(p => answers(b, p));
  });
  if (exact.length) return { list: exact, mode: 'exact', suggestions: [] };

  const loose = list
    .map(b => ({ b, n: wordHits(b, parts) }))
    .filter(x => x.n > 0)
    .sort((x, y) => y.n - x.n)
    .map(x => x.b);
  if (loose.length) return { list: loose, mode: 'loose', suggestions: [] };

  /* Nothing at all. A bare "no results" is a dead end; the longest word
     the person typed, and any category whose name is close, are things
     they can actually press. */
  const longest = words.slice().sort((a, b) => b.length - a.length)[0] || '';
  const suggestions = [];
  if (longest) {
    const n = list.filter(b => searchHaystack(b).includes(longest)).length;
    if (n) suggestions.push({ kind: 'term', value: longest, label: longest, count: n });
  }
  CATEGORIES.filter(c => !c.route).forEach(c => {
    const name = catName(c);
    if (!name) return;
    if (words.some(w => name.includes(w) || w.includes(name))) {
      const n = list.filter(b => b.cat === c.id).length;
      if (n) suggestions.push({ kind: 'cat', value: c.id, label: catLabel(c), count: n });
    }
  });
  return { list: [], mode: 'none', suggestions: suggestions.slice(0, 4) };
}
function catName(c) {
  const packs = i18nPacks();
  return normalize([packs.ar[c.key], packs.en[c.key]].filter(Boolean).join(' '));
}
function catLabel(c) {
  const packs = i18nPacks();
  return (packs[state.lang] && packs[state.lang][c.key]) || c.id;
}

/* ============================================================
   Duplicate businesses
   ------------------------------------------------------------
   300 shops are going in by hand, and then their owners will add
   themselves because they did not find their own listing. The phone
   number is the one field two records for the same shop almost
   always agree on, so it is the primary key for this check.
   ============================================================ */

/**
 * What is left of a business name once everything anybody might write
 * differently is taken away: punctuation, the Arabic definite article,
 * and the word for the trade itself. "Al-Aseel Restaurant & Grill LLC"
 * and "مطعم الأصيل" both come out as "aseel"/"اصيل" — the part that
 * actually names the place.
 */
export function nameKey(name) {
  const raw = typeof name === 'string' ? name : (name && (name.en || name.ar)) || '';
  const flat = normalize(raw)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')       // punctuation and symbols become gaps
    .trim();
  const words = flat.split(/\s+/)
    .map(w => /^ال\p{L}{2,}/u.test(w) ? w.slice(2) : w)   // ال- off the front
    .filter(Boolean)
    // the article again, this time as its own word: "ال", and the
    // transliterations "al"/"el" that start half the shop names here
    .filter(w => !['ال', 'al', 'el'].includes(w))
    .filter(w => !GENERIC_WORDS.includes(w));
  // sorted, so word order never decides whether two names are the same
  return words.sort().join(' ');
}

/**
 * Dice coefficient over letter bigrams — enough to tell a typo or a
 * plural from a different shop, and small enough to need no library.
 */
export function similarity(a, b) {
  const A = String(a || ''), B = String(b || '');
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return A === B ? 1 : 0;
  const grams = (s2) => {
    const m = new Map();
    for (let i = 0; i < s2.length - 1; i++) {
      const g = s2.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const ga = grams(A), gb = grams(B);
  let hits = 0, total = 0;
  ga.forEach(n => { total += n; });
  gb.forEach((n, g) => { total += n; hits += Math.min(n, ga.get(g) || 0); });
  return (2 * hits) / total;
}

/** every word of the shorter name appears in the longer one */
function containsAllWords(a, b) {
  const wa = String(a || '').split(/\s+/).filter(Boolean);
  const wb = String(b || '').split(/\s+/).filter(Boolean);
  if (!wa.length || !wb.length) return false;
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return short.every(w => long.includes(w));
}

/** two names are "the same name" by either test */
export function sameName(a, b) {
  const ka = nameKey(a), kb = nameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (containsAllWords(ka, kb)) return true;
  return similarity(ka, kb) >= NAME_SIM_MIN;
}

/**
 * An address reduced to what identifies the building: house number,
 * street with its spelling folded, and the ZIP. The unit number is
 * deliberately dropped from the *key* — the same shop is written with
 * and without it — while the data keeps it for display.
 * @returns { key, house, zip, street }
 */
export function addressKey(address) {
  const raw = normalize(address).replace(/[.,]/g, ' ');
  const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/);
  const zip = zipMatch ? zipMatch[1] : '';
  // the unit goes, including a trailing letter — "Suite 100 E" and
  // "#100" are the same door written two ways
  let body = raw
    .replace(/\b(ste|suite|unit|apt|apartment)\s*[\w-]+(\s+[a-z]\b)?/g, ' ')
    .replace(/#\s*[\w-]+/g, ' ');
  const houseMatch = body.match(/\b(\d{1,6})\b/);
  const house = houseMatch ? houseMatch[1] : '';
  const words = body.split(/\s+/).filter(Boolean)
    .map(w => STREET_WORDS[w] || w)
    .filter(w => w !== zip && w !== house)
    .filter(w => !/^\d{5}$/.test(w));
  const street = words.join(' ');
  return { key: [house, street, zip].filter(Boolean).join(' '), house, zip, street };
}

/** last ten digits, Arabic-Indic numerals included */
export function phoneKey(phone) {
  const latin = String(phone || '').replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660));
  const digits = latin.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Existing records that look like the one being added, each with how
 * sure we are. Nothing here refuses anything — the caller shows the
 * match and lets the person say which of the two it is.
 *
 * A missing phone is never a match. If it were, the eleven listings
 * with no published number would all duplicate each other.
 *
 * @returns [{ biz, reason, confidence, score }] — certain first
 */
/**
 * The admin's directory search: name in both languages, phone, address, id.
 * The phone matches on the last ten digits through `phoneKey()` — the very
 * rule `findDuplicates()` uses, so the two can never disagree — and the
 * text goes through `normalize()`, so «الاصيل» finds «الأصيل».
 *
 * An id is matched first and alone, and the rest is ranked rather than
 * mixed: whole phone · name · partial phone · address.
 */
const ID_RE = /^b\d+$/i;

export function adminSearchBusinesses(list, term) {
  const raw = String(term || '').trim();
  const q = normalize(raw);
  if (!q) return list;

  /* A business id is never a name, an address or a phone number, so it is
     matched alone and returned alone. «b281» used to take the three-digit
     phone rule with it — and 281 is Houston's area code — so the one row
     asked for came back buried in 145. Zero results here is a true and
     useful answer: no business carries that id. */
  if (ID_RE.test(raw)) {
    const hit = list.find(b => String(b.id).toLowerCase() === raw.toLowerCase());
    return hit ? [hit] : [];
  }

  const digits = raw.replace(/\D/g, '');
  const pk = digits.length >= 10 ? phoneKey(raw) : '';

  /* everything else is ranked rather than mixed: whoever typed a name
     wants the name first, and the address matches come after it */
  const tier = (b) => {
    if (pk && phoneKey(b.phone) === pk) return 0;
    const nm = normalize([b.name && b.name.ar, b.name && b.name.en]
      .filter(Boolean).join(' '));
    if (nm.includes(q)) return 1;
    // a short run of digits still matches anywhere in the number
    if (digits.length >= 3 && phoneKey(b.phone).includes(digits)) return 2;
    if (normalize(b.address || '').includes(q)) return 3;
    return 9;
  };

  // Array#sort is stable, so equals keep the order of the file
  return list.map(b => [b, tier(b)]).filter(([, t]) => t < 9)
    .sort((a, c) => a[1] - c[1]).map(([b]) => b);
}

export function findDuplicates({ phone, name, address, cat, id } = {}) {
  const key = phoneKey(phone);
  const inName = typeof name === 'string' ? name : (name && (name.en || name.ar)) || '';
  const nk = nameKey(inName);
  const ak = addressKey(address);
  const RANK = { certain: 0, likely: 1, weak: 2 };
  const out = [];

  for (const b of everyBusiness()) {
    if (id && b.id === id) continue;

    if (key.length === 10 && phoneKey(b.phone) === key) {
      out.push({ biz: b, reason: 'phone', confidence: 'certain', score: 1 });
      continue;
    }

    const bothNames = [b.name && b.name.en, b.name && b.name.ar].filter(Boolean);
    const nameHit = nk && bothNames.some(n => sameName(inName, n));
    const score = nk ? Math.max(0, ...bothNames.map(n => similarity(nk, nameKey(n)))) : 0;
    const bk = addressKey(b.address);
    const sameAddress = !!(ak.key && bk.key && ak.key === bk.key);
    const sameZip = !!(ak.zip && bk.zip && ak.zip === bk.zip);

    if (nameHit && sameAddress) out.push({ biz: b, reason: 'nameAddress', confidence: 'certain', score });
    else if (nameHit && sameZip) out.push({ biz: b, reason: 'nameZip', confidence: 'likely', score });
    else if (nameHit && cat && b.cat === cat) out.push({ biz: b, reason: 'name', confidence: 'weak', score });
    else if (sameAddress && !nameHit) out.push({ biz: b, reason: 'address', confidence: 'weak', score });
  }

  return out.sort((x, y) => RANK[x.confidence] - RANK[y.confidence] || y.score - x.score);
}

/** the strongest confidence in a result list, or '' when there is none */
export function topConfidence(hits) {
  if (!hits || !hits.length) return '';
  return hits[0].confidence;
}

/**
 * Every pair in the directory that looks like one shop entered twice.
 * After 486 records went in from two files this is a button the owner
 * actually needs, not a theoretical one.
 * @returns [{ a, b, reason, confidence, score }]
 */
export function scanDirectoryDuplicates() {
  const list = everyBusiness();
  const seen = new Set();
  const pairs = [];
  for (const b of list) {
    const hits = findDuplicates({
      phone: b.phone, name: b.name, address: b.address, cat: b.cat, id: b.id,
    }).filter(h => h.confidence !== 'weak');
    for (const h of hits) {
      const key = [b.id, h.biz.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a: b, b: h.biz, reason: h.reason, confidence: h.confidence, score: h.score });
    }
  }
  const RANK = { certain: 0, likely: 1, weak: 2 };
  return pairs.sort((x, y) => RANK[x.confidence] - RANK[y.confidence] || y.score - x.score);
}

/**
 * Fold `dropId` into `keepId`: reviews, saved flags, ownership and any
 * photos follow, then the duplicate is removed. Seed records cannot be
 * deleted from the file, so they are tombstoned instead.
 */
export function mergeBusinesses(keepId, dropId) {
  logAdminAction(keepId, 'merge', dropId, keepId);
  if (!keepId || !dropId || keepId === dropId) return false;
  const keep = businessById(keepId), drop = businessById(dropId);
  if (!keep || !drop) return false;

  // reviews
  const moved = (state.reviews || []).filter(r => r.bizId === dropId);
  moved.forEach(r => { r.bizId = keepId; });

  // favourites: the kept record inherits the star
  if (state.saved.includes(dropId)) {
    state.saved = state.saved.filter(x => x !== dropId);
    if (!state.saved.includes(keepId)) state.saved.push(keepId);
  }
  /* the survivor inherits, and never twice: the account may already own it */
  if ((state.myBusinessIds || []).includes(dropId)) {
    state.myBusinessIds = state.myBusinessIds.filter(x => x !== dropId);
    if (!state.myBusinessIds.includes(keepId)) state.myBusinessIds.push(keepId);
  }
  if (state.subscription && state.subscription.businessId === dropId) state.subscription.businessId = keepId;

  // anything the duplicate knew that the survivor did not
  const target = state.extraBusinesses.find(b => b.id === keepId) || keep;
  target.attributes = Array.from(new Set([].concat(keep.attributes || [], drop.attributes || [])));
  target.tags = Array.from(new Set([].concat(keep.tags || [], drop.tags || [])));
  if (!target.phone && drop.phone) target.phone = drop.phone;
  if (state.extraBusinesses.find(b => b.id === keepId)) {
    // the survivor is a user record — keep the merged fields on it
  } else {
    // the survivor is a seed record: layer the merge on top of it
    state.businessEdits = Object.assign({}, state.businessEdits, {
      [keepId]: { attributes: target.attributes, tags: target.tags },
    });
  }

  state.extraBusinesses = state.extraBusinesses.filter(b => b.id !== dropId);
  state.mergedBusinesses = (state.mergedBusinesses || []).concat([{ keepId, dropId, when: Date.now() }]);
  save();
  return true;
}

/**
 * Seed records plus user records, with admin edits layered on top and any
 * record folded into a duplicate removed. The seed file stays a clean import
 * target — nothing is ever written back into it.
 */
/* ============================================================
   Demo data
   ------------------------------------------------------------
   Everything invented for the prototype carries `demo: true`. One
   switch hides the lot; one button erases it. Without this the owner
   would be hunting Al Sham Restaurant through 486 real listings on
   launch day, and something invented would certainly be left behind.
   ============================================================ */

/** is the prototype data currently part of the app? */

export function showDemo() { return !state.demoPurged && state.showDemo !== false; }
export function setShowDemo(on) { state.showDemo = !!on; save(); }

/** drop the invented records from any list, when they are switched off */
export function withoutDemo(list) {
  return showDemo() ? list : list.filter(x => !(x && x.demo));
}

/** how much invented data there is, counted from the seed file itself */
export function demoCounts() {
  return {
    businesses: BUSINESSES.filter(b => b.demo).length,
    reviews: Object.values(REVIEWS).reduce((n, l) => n + l.filter(r => r.demo).length, 0),
    ads: SLIDER_ADS.filter(a => a.demo).length + MINI_ADS.filter(a => a.demo).length,
    listings: CLASSIFIEDS.filter(c => c.demo).length,
    events: EVENTS.filter(e => e.demo).length,
    articles: ARTICLES.filter(a => a.demo).length,
    notifications: NOTIFICATIONS.filter(n => n.demo).length,
  };
}
export function demoTotal() {
  return Object.values(demoCounts()).reduce((a, b) => a + b, 0);
}

/**
 * Erase it. The seed arrays live in a deployed file, so what this can
 * honestly do is take them out of the app for good and cut every thread
 * that pointed at them — and it says so. Deleting the arrays themselves
 * from `data.js` is the last step before launch and belongs in the repo,
 * not in localStorage.
 */
export function purgeDemoData() {
  logAdminAction('—', 'purgeDemoData', '', '');
  const demoIds = BUSINESSES.filter(b => b.demo).map(b => b.id);
  state.demoPurged = true;
  state.showDemo = false;
  state.saved = (state.saved || []).filter(id => !demoIds.includes(id));
  state.myBusinessIds = (state.myBusinessIds || []).filter(id => !demoIds.includes(id));
  if (state.subscription && demoIds.includes(state.subscription.businessId)) state.subscription = null;
  state.extraNotifs = (state.extraNotifs || []).filter(n => !n.demo);
  save();
}

/**
 * Every record there is, published or not — the admin queues, the
 * duplicate scan and the merge tool need the ones nobody else sees.
 * Screens call `allBusinesses()` instead.
 */
export function everyBusiness() {
  const dropped = (state.mergedBusinesses || []).map(m => m.dropId)
    .concat(state.removedBusinesses || []);
  return withoutDemo(state.extraBusinesses.concat(BUSINESSES))
    .filter(b => !dropped.includes(b.id))
    .map(b => {
      const edit = state.businessEdits && state.businessEdits[b.id];
      return edit ? Object.assign({}, b, edit) : b;
    });
}

/**
 * What the directory shows. A listing held for review after a certain
 * duplicate match is visible to whoever entered it and to nobody else,
 * exactly like a pending marketplace ad.
 */
export function allBusinesses() {
  return everyBusiness().filter(b =>
    b.status !== 'pendingReview' || (state.myPendingBusinesses || []).includes(b.id));
}

/** listings this device entered that are still waiting on the admin */
export function myPendingBusinesses() {
  return everyBusiness().filter(b => b.status === 'pendingReview'
    && (state.myPendingBusinesses || []).includes(b.id));
}

/** the admin queue: everything held for review, whoever entered it */
export function pendingBusinesses() {
  return everyBusiness().filter(b => b.status === 'pendingReview');
}

export function approvePendingBusiness(id) {
  logAdminAction(id, 'approveBusiness', '', '');
  applyBusinessEdit(id, { status: 'live' });
  notifyKeys('bizOkTitle', 'bizOkBody', '#/directory/' + id, 'checkCircle');
  save();
}
export function rejectPendingBusiness(id, reason) {
  logAdminAction(id, 'rejectBusiness', '', reason || '');
  applyBusinessEdit(id, { status: 'rejected' });
  notifyKeys('bizNoTitle', 'bizNoBody', '#/directory', 'alert', reason);
  save();
}
export function businessById(id) { return allBusinesses().find(b => b.id === id); }

/**
 * Every listing the current viewer is allowed to see: everything published,
 * plus their own listings still waiting on the admin. A pending listing is
 * never visible to anyone else.
 */
export function allClassifieds() {
  const list = withoutDemo(state.extraClassifieds.concat(CLASSIFIEDS));
  return list
    .filter(c => !isBlocked(c))
    .filter(c => c.status !== 'rejected')
    /* Hidden is not deleted. The owner still sees it under «إعلاناتي» and
       can put it back while its 14 days last; everyone else stops seeing
       it the moment they press the button. */
    .filter(c => !isHidden(c) || state.myListings.includes(c.id))
    .filter(c => c.status !== 'pending' || state.myListings.includes(c.id))
    .map(c => Object.assign({ status: 'live', photos: [] }, c, {
      boosted: state.boosted.includes(c.id),
      status: isHidden(c) ? 'hidden' : (c.status || 'live'),
    }));
}
export function classifiedById(id) { return allClassifieds().find(c => c.id === id); }

export function myActiveListings() {
  return allClassifieds().filter(c => state.myListings.includes(c.id));
}
/* Four active listings, fourteen days each. The numbers live here and
   nowhere else: a screen that carries its own copy is a second source of
   truth, and the two drift. Handyman keeps its own stricter rule below. */
export const MAX_ACTIVE_LISTINGS = 4;
export const LISTING_DAYS = 14;

/* ---------------- what a listing may contain ----------------
   The form accepted `-500`, `999999999999` and `abc` as prices and
   published all three, and a 300-character title as well. None of them is
   a mistake the reader made — they are values the form never asked about.

   The limits live here and not in the screen for the usual reason: the
   admin's own add form, the importer and whatever the server batch adds
   must all agree, and three copies of a number is three numbers.

   Every message NAMES what is accepted. «قيمة غير صالحة» tells somebody
   who typed 999999999999 nothing at all about what to type instead. */
export const LISTING_TITLE_MIN = 3;
export const LISTING_TITLE_MAX = 80;     // what the card's row actually fits
export const LISTING_DESC_MAX = 2000;
export const LISTING_PRICE_MAX = 500000;

/** Arabic-Indic digits, the dollar sign, spaces and thousands separators
    are all things people really type; none of them makes a price invalid. */
function priceDigits(raw) {
  return String(raw == null ? '' : raw)
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[$\s,\u066C\u066B]/g, (c) => c === '\u066B' ? '.' : '')
    .trim();
}

/**
 * @returns {{ok:boolean, value:number, free:boolean, why:string}}
 *          `why` is an i18n key, never a sentence.
 */
export function checkListingPrice(raw) {
  const v = priceDigits(raw);
  if (!v) return { ok: false, value: 0, free: false, why: 'priceRequired' };
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return { ok: false, value: 0, free: false, why: 'priceNotNumber' };
  const n = Number(v);
  if (!isFinite(n) || n < 0) return { ok: false, value: 0, free: false, why: 'priceNotNumber' };
  if (n > LISTING_PRICE_MAX) return { ok: false, value: n, free: false, why: 'priceTooBig' };
  // «0» is not a cheap price, it is «مجاني», and it says so rather than
  // printing "$0" — which reads like a mistake in the listing.
  return { ok: true, value: n, free: n === 0, why: '' };
}

export function checkListingTitle(raw) {
  const v = String(raw == null ? '' : raw).trim();
  if (v.length < LISTING_TITLE_MIN) return { ok: false, why: 'titleTooShort' };
  if (v.length > LISTING_TITLE_MAX) return { ok: false, why: 'titleTooLong' };
  return { ok: true, why: '' };
}

export function checkListingDesc(raw) {
  const v = String(raw == null ? '' : raw).trim();
  if (v.length > LISTING_DESC_MAX) return { ok: false, why: 'descTooLong' };
  return { ok: true, why: '' };
}
export const MAX_PHOTOS = 5;

/* ---- per-section rules (Handyman = 1 listing / 14 days, Free = no price) ---- */
export function catRule(catId) {
  const c = MARKET_CATS.find(x => x.id === catId) || {};
  return {
    maxActive: c.maxActive || MAX_ACTIVE_LISTINGS,
    days: c.days || LISTING_DAYS,
    freeOnly: !!c.freeOnly,
    upsell: !!c.upsell,
  };
}
/** how many of my active listings already sit in this section */
export function myActiveInCat(catId) {
  return myActiveListings().filter(c => c.cat === catId && !isHidden(c)).length;
}
export { FREE_PRICE };

export function notifications() {
  return withoutDemo(state.extraNotifs.concat(NOTIFICATIONS))
    .map(n => Object.assign({}, n, { unread: n.unread && !state.readNotifs.includes(n.id) }));
}
export function unreadCount() { return notifications().filter(n => n.unread).length; }
export function markNotifsRead() {
  notifications().forEach(n => { if (!state.readNotifs.includes(n.id)) state.readNotifs.push(n.id); });
  save();
}
/** Mark one notification read — opening the screen must not clear them all. */
export function markNotifRead(id) {
  if (!state.readNotifs.includes(id)) { state.readNotifs.push(id); save(); }
}

/** Raise a notification for the listing owner (approve / reject / message). */
export function pushNotif({ icon = 'bell', title, body, route }) {
  state.extraNotifs.unshift({
    id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
    icon, unread: true, title, body, route,
    when: { ar: 'الآن', en: 'just now' },
  });
  save();
}

/** a purchased order rendered as a slide; `orderId` is what the counters key on */
function orderAsSlide(a) {
  return {
    id: a.id, orderId: a.id, kind: 'paid',
    name: { ar: a.bizName, en: a.bizName },
    tag: { ar: a.tagline, en: a.tagline },
    cta: { ar: a.ctaText, en: a.ctaText },
    color: AD_CARD_COLOR, icon: 'megaphone',
    link: a.link || '#/home',
  };
}

export function sliderAds() {
  const t = now();
  const live = (state.myAds || [])
    .filter(a => a.product === 'slider' && a.status === 'live' && (!a.endsAt || a.endsAt > t))
    .map(orderAsSlide);
  return live.concat(withoutDemo(SLIDER_ADS));
}

/** every live order for one placement, as slides */
export function sectionAds(product) {
  const t = now();
  return (state.myAds || [])
    .filter(a => a.product === product && a.status === 'live' && (!a.endsAt || a.endsAt > t))
    .map(orderAsSlide);
}

/* ------------------------------------------------------------
   Rotation that is fair, and that survives Back
   ------------------------------------------------------------
   Rai asked for the sponsored rows to change every time, and plain
   randomness gets that wrong twice.

   It breaks Back. Scroll the directory, open a shop, come back, and the
   order beneath you has changed — the pixel we saved belongs to a page
   that no longer exists. Back has been fixed three times; an advertisement
   does not get to break it again. So the seed is chosen ONCE per visit and
   filed under the history entry, exactly as scrollMemory is: a new visit
   is a new order, and Back is the same order.

   And it is not fair. With four advertisers, real randomness hands one of
   them four impressions and another none on the same day — and all four
   paid the same. So it is a round robin from a random start: it looks
   different on every visit, and the distribution is even by construction.
   That is the version you can put in a contract and defend when an
   advertiser asks how many times they ran.
   ------------------------------------------------------------ */
const visitSeeds = new Map();
let rotBase = null, rotSeen = 0;

/**
 * The visit's place in the rotation. The FIRST visit of a session starts
 * somewhere random — so it looks different every time the app is opened —
 * and every visit after it advances by one. A fresh random number per
 * visit would look the same to a reader and be measurably unfair to the
 * advertisers: over twenty opens it gives one of four buyers nine
 * impressions and another seven. Advancing gives them ten each.
 * Memory only: a new launch starts somewhere new.
 */
export function visitSeed(key) {
  if (!key) return 0;
  if (!visitSeeds.has(key)) {
    if (rotBase === null) rotBase = Math.floor(Math.random() * 1e6);
    visitSeeds.set(key, rotBase + rotSeen);
    rotSeen += 1;
  }
  return visitSeeds.get(key);
}

/**
 * `n` items from `pool`, taken in order from a per-visit starting point.
 * @param pool  everything eligible
 * @param n     how many to show
 * @param key   the history entry — the same one scrollMemory uses
 * @param skip  ids already shown elsewhere on this screen
 */
export function rotate(pool, n, key, skip = []) {
  const avoid = new Set(skip);
  const list = pool.filter(x => !avoid.has(x.id));
  if (!list.length || n <= 0) return [];
  const start = visitSeed(key) % list.length;
  const out = [];
  for (let i = 0; i < Math.min(n, list.length); i++) out.push(list[(start + i) % list.length]);
  return out;
}

/**
 * The slider that sits at the top of one category. Cheaper than the home
 * one and better targeted — a restaurant would rather reach someone who
 * is already looking at restaurants than everyone who opens the app.
 * A section with nothing sold shows the house slide instead, which is how
 * a shop owner learns the slot is for sale at all.
 */
export function catSliderAds(cat) {
  const t = now();
  return (state.myAds || [])
    .filter(a => a.product === 'catSlider' && a.cat === cat && a.status === 'live' && (!a.endsAt || a.endsAt > t))
    .map(orderAsSlide);
}

/* ============================================================
   Entitlements
   ------------------------------------------------------------
   What the subscription buys, in one table. Reviews are NOT on
   it: if twenty of three hundred shops subscribe, gating reviews
   leaves 93% of the directory empty and nobody has a reason to
   open the app at all — and with no users nobody pays either.
   Reviews are the content that makes the app worth opening, not
   a feature to sell.
   ============================================================ */
export function businessPlan(b) {
  if (state.subscription && state.subscription.businessId === b.id && subscriptionActive()) return 'paid';
  return b.plan;
}
export const PLAN_LIMITS = {
  free: { photos: 3, videos: 0, offers: false },
  paid: { photos: Infinity, videos: 3, offers: true },
};
export function planLimits(b) { return PLAN_LIMITS[businessPlan(b)] || PLAN_LIMITS.free; }

/* ------------------------------------------------------------
   OFFERS — the thing the $29 was already promising

   «العروض» has been in the subscription's column since V.01.8 and
   was never built. It earns its place twice over: content that
   changes every week is what brings somebody back, and it is the
   first concrete reason a grocer has to pay — one post reaches the
   whole community for less than a single boosted photo elsewhere.

   Four rules, and every one of them is here rather than in a
   screen, so a second surface cannot disagree with the first:

   1. It ENDS BY ITSELF. `endsAt` is required and capped at
      MAX_OFFER_DAYS. A stale offer is worse than none — somebody
      drives out and is turned away at the counter.
   2. THREE at a time. Without a cap the page becomes a circular.
   3. It is REVIEWED like any other user content. A price claim
      published unread is our liability, not the shop's.
   4. NO PHONE NUMBER in the text — `stripPhones` already exists
      and this is exactly what it is for.
   ------------------------------------------------------------ */
export const MAX_OFFERS = 3;
export const MAX_OFFER_DAYS = 30;

/** the subscription's own column — never read `plan` in a screen */
export function canPostOffers(b) { return !!planLimits(b).offers; }

/** every offer ever posted for this business, expired ones included */
function allOffersFor(bizId) {
  return ((state.offers || {})[bizId] || []).slice();
}

/** live to a reader: approved, and not yet run out */
export function offersFor(bizId) {
  const t = now();
  return allOffersFor(bizId).filter(o => o.status === 'live' && o.endsAt > t);
}

/** what the owner sees: pending and rejected too, but never an expired one */
export function myOffersFor(bizId) {
  const t = now();
  return allOffersFor(bizId).filter(o => o.status !== 'expired' && o.endsAt > t);
}

/** the cap counts what is standing — pending included, or four could queue */
export function activeOfferCount(bizId) {
  return myOffersFor(bizId).filter(o => o.status !== 'rejected').length;
}

export function hasOffers(b) { return !!b && offersFor(b.id).length > 0; }

/** every live offer in the app, soonest to run out first */
export function allLiveOffers() {
  const out = [];
  Object.keys(state.offers || {}).forEach(bizId => {
    const b = businessById(bizId);
    if (!b) return;
    offersFor(bizId).forEach(o => out.push({ offer: o, biz: b }));
  });
  return out.sort((a, c) => a.offer.endsAt - c.offer.endsAt);
}

/**
 * Post one. Returns `{ error }` rather than throwing, because every caller
 * is a form that has to say why.
 */
export function addOffer(bizId, { text, price, endsAt }) {
  const b = businessById(bizId);
  if (!b) return { error: 'noBiz' };
  if (!canPostOffers(b)) return { error: 'notSubscribed' };
  if (activeOfferCount(bizId) >= MAX_OFFERS) return { error: 'tooMany' };

  // stripPhones returns { text, removed } — the count is what tells the
  // owner a number was taken out rather than leaving them to spot it
  const scrubbed = stripPhones(String(text || '').trim());
  const body = scrubbed.text;
  if (!body) return { error: 'noText' };

  const t = now();
  const cap = t + MAX_OFFER_DAYS * 864e5;
  const end = Number(endsAt) || 0;
  if (!end || end <= t) return { error: 'noEnd' };
  if (end > cap) return { error: 'tooLong' };

  const item = { id: 'of' + t + Math.floor(Math.random() * 1e3), bizId,
                 text: body, price: stripPhones(String(price || '').trim()).text,
                 endsAt: end, status: 'pending', when: t };
  state.offers = Object.assign({}, state.offers, { [bizId]: allOffersFor(bizId).concat(item) });
  save();
  return { offer: item, strippedPhone: scrubbed.removed > 0 };
}

function patchOffer(bizId, id, patch) {
  state.offers = Object.assign({}, state.offers, {
    [bizId]: allOffersFor(bizId).map(o => o.id === id ? Object.assign({}, o, patch) : o),
  });
  save();
}

export function removeOffer(bizId, id) {
  state.offers = Object.assign({}, state.offers, {
    [bizId]: allOffersFor(bizId).filter(o => o.id !== id),
  });
  save();
}

/** the admin queue */
export function pendingOffers() {
  const t = now();
  const out = [];
  Object.keys(state.offers || {}).forEach(bizId => {
    const b = businessById(bizId);
    allOffersFor(bizId).forEach(o => {
      if (o.status === 'pending' && o.endsAt > t) out.push({ offer: o, biz: b });
    });
  });
  return out.sort((a, c) => a.offer.when - c.offer.when);
}

export function approveOffer(bizId, id) {
  patchOffer(bizId, id, { status: 'live' });
  const b = businessById(bizId);
  notifyKeys('offerOkTitle', 'offerOkBody', '#/directory/' + bizId, 'tag',
             b ? L(b.name) : '');
}
export function rejectOffer(bizId, id, reason) {
  patchOffer(bizId, id, { status: 'rejected', reason: String(reason || '') });
  notifyKeys('offerNoTitle', 'offerNoBody', '#/directory/' + bizId, 'alert', reason);
}

/** Reviews are free for everyone, on every listing. */
export function canSeeReviews() { return true; }

/** Paying does not verify anybody — see businessVerified(). */
export function isPaid(b) { return businessPlan(b) === 'paid'; }

/** the subscribers, for «إعلانات مميّزة». Empty once the demo seeds go, and
    the drawer reads that and says «قريباً» instead of opening a void. */
export function featuredBusinesses() { return allBusinesses().filter(isPaid); }

/* ============================================================
   Verification — deliberately not a consequence of paying
   ------------------------------------------------------------
   A badge that means "this shop paid us" is worth nothing, and
   the whole directory rests on being trusted. `verified` is its
   own field, set only by the review flow below. Subscribing is a
   precondition for *applying*, never a way of being granted it.
   Two different badges on purpose: a gold one for a business,
   a blue one for a person. Same word for both and nobody would
   know which is which.
   ============================================================ */
export function bizVerifyState(bizId) {
  return (state.bizVerify && state.bizVerify[bizId]) || null;
}
/** the gold badge: an explicit, reviewed decision — never derived from plan */
export function businessVerified(b) {
  if (!b) return false;
  const st = bizVerifyState(b.id);
  if (st) return st.status === 'verified';
  return b.verified === true;
}
/** only a subscriber may even start the process */
export function canRequestBizVerify(b) {
  const st = bizVerifyState(b.id);
  return isPaid(b) && !businessVerified(b) && (!st || st.status === 'rejected');
}
export function requestBizVerify(bizId, ref) {
  state.bizVerify = Object.assign({}, state.bizVerify, {
    // Only ever a result and a reference. No identity image, no face scan is
    // taken or stored here — the provider holds those in V.02 and hands back
    // pass/fail, which is what state biometric law is built around.
    [bizId]: { status: 'pending', ref: ref || '', when: Date.now(), reason: '' },
  });
  save();
}
export function approveBizVerify(bizId) {
  const cur = bizVerifyState(bizId) || {};
  state.bizVerify = Object.assign({}, state.bizVerify, {
    [bizId]: Object.assign({}, cur, { status: 'verified', reason: '', decided: Date.now() }),
  });
  notifyKeys('bizVerifyOkTitle', 'bizVerifyOkBody', '#/directory/' + bizId, 'checkCircle');
  save();
}
export function rejectBizVerify(bizId, reason) {
  const cur = bizVerifyState(bizId) || {};
  state.bizVerify = Object.assign({}, state.bizVerify, {
    [bizId]: Object.assign({}, cur, { status: 'rejected', reason: reason || '', decided: Date.now() }),
  });
  notifyKeys('bizVerifyNoTitle', 'bizVerifyNoBody', '#/directory/' + bizId, 'alert', reason);
  save();
}
export function pendingBizVerify() {
  return Object.entries(state.bizVerify || {})
    .filter(([, v]) => v.status === 'pending')
    .map(([bizId, v]) => ({ bizId, ...v }));
}

/* ============================================================
   Business photos — the thing the $29 actually sells
   ------------------------------------------------------------
   Stored per business, each with its own review status, exactly
   like a profile photo. A free listing may hold three; a
   subscriber is unlimited and may add video. Nothing is ever
   invented: a business with no photos renders no gallery, rather
   than the placeholder squares that used to stand in for a
   feature that did not exist.
   ============================================================ */
export function bizPhotos(bizId) {
  return ((state.bizPhotos && state.bizPhotos[bizId]) || []).slice();
}
/** what a visitor sees; the owner also sees their own pending ones */
export function visiblePhotos(b) {
  const own = ownsBusiness(b.id);
  return bizPhotos(b.id).filter(p => p.status === 'approved' || (own && p.status === 'pending'));
}
export function heroPhoto(b) {
  const list = visiblePhotos(b).filter(p => p.status === 'approved');
  return list.length ? list[0].url : '';
}
export function setBizPhotos(bizId, urls) {
  const before = bizPhotos(bizId);
  const next = urls.map(url => {
    const old = before.find(p => p.url === url);
    return old || { url, status: 'pending', when: Date.now() };
  });
  state.bizPhotos = Object.assign({}, state.bizPhotos, { [bizId]: next });
  save();
  return next;
}
export function approveBizPhoto(bizId, url) {
  const list = bizPhotos(bizId).map(p => p.url === url ? Object.assign({}, p, { status: 'approved' }) : p);
  state.bizPhotos = Object.assign({}, state.bizPhotos, { [bizId]: list });
  save();
}
export function rejectBizPhoto(bizId, url, reason) {
  logAdminAction(bizId, 'rejectPhoto', '', reason || '');
  const list = bizPhotos(bizId).filter(p => p.url !== url);
  state.bizPhotos = Object.assign({}, state.bizPhotos, { [bizId]: list });
  /* ⚠️ This one sent NOTHING at all — the photo simply vanished from the
     owner's page with no word. A silent removal reads as the app losing
     the picture, which is worse than a refusal. */
  const why = String(reason || '').trim();
  pushNotif({ icon: 'alert', route: `#/directory/${bizId}`,
    title: { ar: 'صورة نشاطك لم تُعتمد', en: 'A photo on your listing was not approved' },
    body: why
      ? { ar: `سبب الرفض: ${why}`, en: `Reason: ${why}` }
      : { ar: 'الصورة خالفت شروط المحتوى وتم حذفها. تقدر ترفع صورة ثانية.',
          en: 'The photo broke the content rules and was removed. You can upload another.' } });
  save();
}
export function pendingBizPhotos() {
  const out = [];
  Object.entries(state.bizPhotos || {}).forEach(([bizId, list]) =>
    list.filter(p => p.status === 'pending').forEach(p => out.push({ bizId, ...p })));
  return out;
}

/* ============================================================
   Owning a business page
   ------------------------------------------------------------
   Claiming used to hand the page over on a tap. It now raises a
   request the admin decides on, and the owner is told either way.
   ============================================================ */
/* Ownership is an account's, not a device's. Without the login test this
   returned true while `isLoggedIn()` returned false — and that single
   disagreement opened the owner's edit form to somebody with no account. */
/* ============================================================
   The account hub
   ------------------------------------------------------------
   The six rows that used to be the drawer's «حسابي» group. They live in
   ONE list so the hub and anything built on it later cannot drift into
   two menus saying different things — the same reason ATTRIBUTES is a
   registry and not a set of fields.
   ============================================================ */
/** Where the subscription row goes — ONE definition, because the settings
    screen already branched correctly and the hub's row was a fixed string,
    so a subscriber tapping «الاشتراك» in one place landed on the sales page
    and in the other on their own subscription. Two conditions written twice
    are two conditions that part company two batches later. */
export function subscriptionRoute() {
  return subscription() ? '#/my-subscription' : '#/subscribe';
}

/** How many requests of this account's are still waiting on the admin —
    a claim, or the verification badge. Read off the queues that already
    exist: no new queue, and no new admin screen. */
export function pendingRequests() {
  if (!isLoggedIn()) return 0;
  const claims = (state.claims || []).filter(c => c.status === 'pending').length;
  const u = state.user;
  return claims + (u && u.badge && u.badge.status === 'pending' ? 1 : 0);
}

/** every request this account has made, newest first, claims and badge alike */
export function myRequests() {
  if (!isLoggedIn()) return [];
  const rows = (state.claims || []).map(c => ({
    kind: 'claim', id: c.id, bizId: c.bizId, status: c.status,
    when: c.when, reason: c.reason || '',
  }));
  const b = state.user && state.user.badge;
  if (b && b.status) {
    rows.push({ kind: 'badge', id: 'badge', bizId: null, status: b.status,
                when: b.when || 0, reason: b.reason || '' });
  }
  return rows.sort((a, z) => (z.when || 0) - (a.when || 0));
}

/**
 * The account hub's rows — icon, label and destination, and nothing else.
 *
 * ⚠️ The SUBTITLE is built in the screen, not here: it needs `L()` for a
 * name and `fmtDate()` for a date, and `store.js` must not import `i18n`
 * or `ui` — the arrow points one way and has since V.02.1.
 *
 * ⚠️ AND THREE ROWS LEFT THIS LIST. «إعلاناتي», «المفضّلة» and «تقييماتي»
 * are the three counters at the top of the very same screen, ten lines
 * above — the reader met them twice. The counters stay and the rows go,
 * because a counter carries a number and a row carries nothing, and the
 * number is what makes tapping a decision.
 */
export const ACCOUNT_LINKS = [
  { icon: 'briefcase', key: 'myBusiness',    route: '#/my-business' },
  { icon: 'message',   key: 'myMessages',    route: '#/messages' },
  { icon: 'clock',     key: 'myRequests',    route: '#/my-requests' },
  { icon: 'crown',     key: 'subscription',  route: subscriptionRoute },
  { icon: 'bell',      key: 'notifications', route: '#/notifications' },
  { icon: 'file',      key: 'receipts',      route: '#/receipts' },
  { icon: 'shield',    key: 'blockedTitle',  route: '#/blocked' },
];

export function ownsBusiness(bizId) {
  return isLoggedIn() && !!bizId && (state.myBusinessIds || []).includes(bizId);
}
/** every listing this account owns, records not ids, newest claim last */
export function myBusinesses() {
  if (!isLoggedIn()) return [];
  return (state.myBusinessIds || []).map(id => businessById(id)).filter(Boolean);
}
/* The screens that still speak of "my business" in the singular read this.
   It is NOT a second source of truth — it is the first element of the one
   list — and it keeps a one-business account behaving exactly as before. */
export function primaryBusinessId() {
  return (state.myBusinessIds || [])[0] || null;
}
export function claimFor(bizId) {
  return (state.claims || []).find(c => c.bizId === bizId) || null;
}
export function requestClaim(bizId, details) {
  const existing = claimFor(bizId);
  if (existing && existing.status === 'pending') return existing;
  const rec = Object.assign({
    id: 'cl' + Date.now() + '-' + ((state.claims || []).length + 1),
    bizId, status: 'pending', when: Date.now(), reason: '',
  }, details || {});
  state.claims = (state.claims || []).filter(c => c.bizId !== bizId).concat([rec]);
  save();
  return rec;
}
export function approveClaim(id) {
  logAdminAction(id, 'approveClaim', '', '');
  const c = (state.claims || []).find(x => x.id === id);
  if (!c) return;
  c.status = 'approved'; c.decided = Date.now();
  /* ADD, never replace. The old line dropped whatever the account already
     owned — and because the line below still marks the listing `claimed`,
     the dropped one became unclaimable by anybody, including its owner. */
  state.myBusinessIds = state.myBusinessIds || [];
  if (!state.myBusinessIds.includes(c.bizId)) state.myBusinessIds.push(c.bizId);
  const biz = businessById(c.bizId);
  if (biz) applyBusinessEdit(c.bizId, { claimed: true });
  notifyKeys('claimOkTitle', 'claimOkBody', '#/directory/' + c.bizId, 'checkCircle');
  save();
}
export function rejectClaim(id, reason) {
  const c = (state.claims || []).find(x => x.id === id);
  if (!c) return;
  c.status = 'rejected'; c.reason = reason || ''; c.decided = Date.now();
  notifyKeys('claimNoTitle', 'claimNoBody', '#/directory/' + c.bizId, 'alert', reason);
  save();
}
export function pendingClaims() { return (state.claims || []).filter(c => c.status === 'pending'); }

/** layer an edit on top of a record, seed or user-created alike */
/* ------------------------------------------------------------
   WHO CHANGED THIS

   An admin edits a shop from the same screen its owner uses —
   that is the right design, and it means the two writes are
   indistinguishable afterwards. So the day an owner rings up and
   asks who changed their phone number, there is no answer: not
   whether it was them, the panel, or an import.

   One line per field, and only when the person writing is the
   admin and NOT the owner. The owner editing their own page
   records nothing — this is a trace of our hand, not theirs.
   ------------------------------------------------------------ */
export const ADMIN_LOG_MAX = 500;

/** the panel is open and this is somebody else's shop */
export function adminEditing(bizId) {
  return adminUnlocked() && !ownsBusiness(bizId);
}

/** a value short enough to read in a list, whatever its shape */
function logValue(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.slice(0, 60);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v).slice(0, 60); } catch (e) { return ''; }
}

/* The edit form submits every field it holds, so a record that simply had
   no `nonCommercial` before comes back as undefined → false. That is the
   form filling a gap, not the admin changing anything, and a log full of
   it teaches nobody anything. */
const emptyish = (v) => v == null || v === '' || v === false;

function recordAdminEdit(bizId, patch) {
  const before = businessById(bizId) || {};
  const rows = Object.keys(patch)
    .filter(f => !(before[f] === undefined && emptyish(patch[f])))
    .map(field => ({ at: now(), bizId, field,
                     from: logValue(before[field]), to: logValue(patch[field]) }))
    .filter(r => r.from !== r.to);
  if (!rows.length) return;
  state.adminLog = (state.adminLog || []).concat(rows).slice(-ADMIN_LOG_MAX);
}

/**
 * ⚠️ The log was built to answer «who changed my phone number?» and it
 * recorded FIELD EDITS AND NOTHING ELSE — so «who deleted the event?» and
 * «who merged the two shops?» had no answer at all, which is the same
 * question it exists for. One line per action in the SAME log, never a
 * second one: two logs is two places to look and one of them goes stale.
 *
 * The shape is unchanged — `{at, bizId, field, from, to}` — with `field`
 * carrying the action's name. It is written in `store.js` and not in the
 * panel, for the V.03.3 reason: a record kept by a screen is missing the
 * moment anything that is not that screen does the same thing.
 */
export function logAdminAction(subject, action, from, to) {
  state.adminLog = (state.adminLog || [])
    .concat([{ at: now(), bizId: subject || '—', field: action,
               from: logValue(from), to: logValue(to) }])
    .slice(-ADMIN_LOG_MAX);
}

/** newest first, for the panel */
export function adminLog(limit = 50) {
  return (state.adminLog || []).slice().reverse().slice(0, limit);
}

export function applyBusinessEdit(bizId, patch) {
  // the caller's own keys, before the address rule adds any of its own
  if (patch && adminEditing(bizId)) recordAdminEdit(bizId, patch);
  /* A shop that moved and kept the coordinates of where it used to be is
     worse than one with none: it looks right and is wrong. */
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'address')) {
    const before = businessById(bizId);
    if (before && String(before.address || '') !== String(patch.address || '')) {
      patch = Object.assign({}, patch, { lat: null, lng: null, needsGeo: true });
    }
  }
  const own = state.extraBusinesses.find(b => b.id === bizId);
  if (own) Object.assign(own, patch);
  else state.businessEdits = Object.assign({}, state.businessEdits, {
    [bizId]: Object.assign({}, state.businessEdits[bizId] || {}, patch),
  });
  save();
}

/* ---------------- owner replies to a review ---------------- */
export function replyFor(reviewId) {
  return (state.reviewReplies && state.reviewReplies[reviewId]) || null;
}
export function replyToReview(reviewId, text) {
  state.reviewReplies = Object.assign({}, state.reviewReplies, {
    [reviewId]: { text, when: Date.now() },
  });
  save();
}
export function deleteReply(reviewId) {
  const next = Object.assign({}, state.reviewReplies);
  delete next[reviewId];
  state.reviewReplies = next;
  save();
}

/**
 * Nearby businesses in the same category, for the foot of a free page.
 * Plain suggestions, never sold: this community is small and its owners
 * talk to each other, so "pay to bury your rivals" would cost more in
 * reputation than it could ever earn.
 */
/**
 * A city park is not a business. Without this flag Hermann Park would carry
 * "is this yours? claim it" and an "upgrade your page" card, which reads as a
 * plain bug. The ticketed half of the outings category — trampolines, museums,
 * water parks — are real businesses and real advertisers, so they keep every
 * button; the flag is only for the places nobody owns.
 */
/**
 * A place of worship is non-commercial BY ITS CATEGORY, not by a switch
 * somebody has to remember to flip — and the switch was forgotten on all
 * thirty-five of them.
 *
 * What the owner of a mosque saw the moment they claimed their page:
 * «رقّي صفحة نشاطك — صور، فيديو، وتقييمات المستخدمين · $29 شهرياً».
 * That is not an interface slip, it is an insult, and it would have
 * greeted the very first imam who claimed his masjid.
 *
 * Deriving it from `cat === 'worship'` means it cannot be forgotten again
 * — including on every mosque and church added from here on. The manual
 * `nonCommercial` flag stays for what the category cannot tell us: the
 * parks, preserves and libraries among the outings, where 28 records
 * carry it correctly and are untouched by this.
 */
export function isNonCommercial(b) {
  return !!(b && (b.nonCommercial || b.cat === 'worship'));
}
export function setNonCommercial(bizId, on) { applyBusinessEdit(bizId, { nonCommercial: !!on }); }

/**
 * Halal restaurants near an outing. A family heading out has to eat, and this
 * costs us nothing while giving every restaurant in the directory — paying or
 * not — somewhere else to be seen. Sorted by how close they are to the place
 * being looked at, never by who paid.
 */
export function nearbyHalal(b, n = 3) {
  const pool = allBusinesses().filter(x => x.cat === 'restaurants' && x.id !== b.id);
  const halal = pool.filter(x => hasAttr(x, 'halalMeat'));
  return nearAnchor(halal.length ? halal : pool, b, n);
}

export function similarTo(b, n = 4) {
  return nearAnchor(allBusinesses().filter(x => x.id !== b.id && x.cat === b.cat), b, n);
}

/**
 * The n places closest to a given listing. Real miles when both ends carry
 * coordinates; otherwise the ones in the same city come first. It never
 * subtracts one `dist` from another — that field was the same invented
 * number on every imported row, so the order it produced meant nothing.
 */
function nearAnchor(list, anchor, n) {
  const miles = (x) => (hasCoords(x) && hasCoords(anchor))
    ? haversine({ lat: x.lat, lng: x.lng }, { lat: anchor.lat, lng: anchor.lng })
    : null;
  const tier = (x) => miles(x) != null ? 0 : (cityOf(x) && cityOf(x) === cityOf(anchor) ? 1 : 2);
  return list.slice()
    .sort((x, y) => (tier(x) - tier(y)) || ((miles(x) || 0) - (miles(y) || 0)))
    .slice(0, n);
}

/** A notification built from i18n keys, so the owner reads it in whichever
    language they open the app in — not the one the admin happened to use. */
function notifyKeys(titleKey, bodyKey, route, ico, extra) {
  const packs = i18nPacks();
  const line = (key, lang) => (packs[lang] && packs[lang][key]) || key;
  const suffix = (lang) => extra ? ' — ' + extra : '';
  pushNotif({
    icon: ico || 'bell', route,
    title: { ar: line(titleKey, 'ar'), en: line(titleKey, 'en') },
    body: { ar: line(bodyKey, 'ar') + suffix('ar'), en: line(bodyKey, 'en') + suffix('en') },
  });
}

/* ---------------- simulated backend calls ----------------
   Each of these is the exact seam where a real API goes in V.02. */

export const DEMO_CODE = '123456';

/**
 * The identity-check seam. In V.02 this hands off to Stripe Identity: the
 * person uploads their document and selfie *to the provider*, and all that
 * comes back here is a verdict and a reference. No identity image and no
 * face template is ever received or stored by this app — the architecture
 * is built that way from the start, because biometric data carries strict
 * state-law duties and the cheapest way to meet them is never to hold any.
 */
export function runIdentityCheck() {
  return new Promise(res => setTimeout(() =>
    res({ ok: true, ref: 'demo_' + Date.now().toString(36) }), 900));
}

export function sendEmailCode(email) {
  return new Promise(res => setTimeout(() => res({ ok: true, code: DEMO_CODE }), 700));
}

/** Twilio Lookup stand-in: rejects VOIP + landline patterns. */
export function lookupLineType(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return new Promise(res => setTimeout(() => {
    if (digits.length < 10) return res({ ok: false, type: 'invalid' });
    // prototype rule: numbers starting 555 / 800 / 888 = voip-ish, 713-2xx = landline
    if (/^(555|800|888|877|866)/.test(digits)) return res({ ok: false, type: 'voip' });
    if (/^\d{3}2\d{2}/.test(digits) && digits[3] === '2') return res({ ok: false, type: 'landline' });
    return res({ ok: true, type: 'mobile' });
  }, 900));
}

export function sendSmsCode(phone) {
  return new Promise(res => setTimeout(() => res({ ok: true, code: DEMO_CODE }), 700));
}

/* ============================================================
   chargeCard — a stand-in, and the three rules that replace it
   ------------------------------------------------------------
   It says `ok: true` to anything. There is no gateway, no card and no
   money, so today that is honest: it is a simulation and the whole app
   knows it. Measured for the record — with no card on file at all it
   still produced a receipt reading { status:'paid', method:'card',
   amount:5 }.

   Acceptable now. NOT acceptable the moment the first dollar moves, and
   these are written here rather than in a note somewhere because this is
   the function the server batch replaces:

   1. NO CHARGE WITHOUT A PAYMENT METHOD. `cardOnFile` is checked BEFORE
      the call, not after it. None of the four call sites checks today.
   2. NO `paid` RECEIPT WITHOUT THE GATEWAY SAYING SO. `addReceipt` is
      called on the gateway's confirmation, never on our own optimism —
      a receipt is the piece of paper that settles a dispute, and one
      written before the money moved settles it the wrong way.
   3. THE AMOUNT IS COMPUTED ON THE SERVER. It is passed in from the page
      here, and whoever can edit the page can edit the number. The page
      may say WHICH product; only the server may say what it costs.

   The prices themselves already live in one place (`AD_PRODUCTS`,
   `BOOST_PRICES`, `SUBSCRIPTION_PRICE`), which is what makes rule 3 a
   move rather than a rewrite.
   ============================================================ */
export function chargeCard(amount, description) {
  return new Promise(res => setTimeout(() => res({ ok: true, id: 'pay_' + Date.now(), amount, description }), 1400));
}

/* ============================================================
   RECEIPTS — a transaction number for every amount taken
   ------------------------------------------------------------
   A receipt is not a courtesy. It is the piece of paper that
   settles «I paid» against «no you didn't», and it is what makes
   a shop owner handing over $29 feel they dealt with a company
   rather than with somebody they know.

   `inv1` · `inv2` · `inv3` was wrong, and not because it is
   ugly: a sequential number PUBLISHES THE SIZE OF THE BUSINESS.
   An advertiser reading `inv3` knows they are the third customer
   since it opened, and in a small community that talks to itself
   that is not a thing to hand out.

   The alphabet drops 0/O and 1/I/L. The number is read down a
   phone and typed into a message, and one ambiguous character
   turns half those calls into "no, it isn't there".
   ============================================================ */
const RCPT_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0 O 1 I L
export const RECEIPT_PREFIX = 'ARB';

function receiptCode() {
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += RCPT_ALPHABET[Math.floor(Math.random() * RCPT_ALPHABET.length)];
  }
  return out;
}

/** unique before it is issued — a duplicate receipt number is a nightmare */
export function newReceiptNumber() {
  const yy = String(new Date(now()).getFullYear()).slice(-2);
  const taken = new Set((state.receipts || []).map(r => r.id));
  for (let i = 0; i < 200; i++) {
    const id = `${RECEIPT_PREFIX}-${yy}-${receiptCode()}`;
    if (!taken.has(id)) return id;
  }
  return `${RECEIPT_PREFIX}-${yy}-${receiptCode()}${receiptCode()}`;
}

/**
 * Issue one. `kind` is what was bought, `method` how it was paid
 * ('card' | 'cash' | 'check' | 'transfer'), and `covers` the period the
 * money bought — «I paid and got nothing» ends at a line saying what the
 * amount covered.
 */
export function addReceipt({ kind, description, amount, method = 'card',
                             bizId = null, refId = null, covers = null,
                             receivedBy = '', reference = '', autoRenew = false,
                             refundOf = null }) {
  const u = state.user || {};
  const item = {
    id: newReceiptNumber(),
    at: now(),
    kind, description,
    amount: Number(amount) || 0,
    tax: 0,                       // a line, not a missing line — see below
    method, bizId, refId, covers,
    receivedBy, reference, autoRenew, refundOf,
    buyer: { name: u.name || '', email: u.email || '' },
    status: refundOf ? 'refunded' : 'paid',
  };
  state.receipts = (state.receipts || []).concat(item);
  save();
  return item;
}

/** newest first */
/* Signed out, the record is not readable — but it is not erased either.
   `#/receipts` and `#/my-subscription` stay OPEN on purpose (test v38,
   1.1b): a page that sells is open and the gate stands at the payment, so
   a visitor must meet a designed empty state. The leak was never a missing
   route guard — it was the data answering to nobody. */
export function receipts() {
  if (!isLoggedIn()) return [];
  return (state.receipts || []).slice().sort((a, b) => b.at - a.at);
}
export function receiptById(id) {
  if (!isLoggedIn()) return null;
  return (state.receipts || []).find(r => r.id === id) || null;
}

/**
 * A refund is a SECOND receipt with a negative amount pointing at the
 * first. Editing an issued receipt is the definition of cooking the books,
 * so the original is never touched and both appear in the list.
 */
export function refundReceipt(id, reason = '') {
  const src = receiptById(id);
  if (!src || src.refundOf) return null;
  return addReceipt({
    kind: 'refund',
    description: reason || src.description,
    amount: -Math.abs(src.amount),
    method: src.method, bizId: src.bizId, refId: src.refId,
    receivedBy: src.receivedBy, refundOf: src.id,
  });
}

/** the two totals kept apart, or the revenue figure never matches the bank */
export function receiptTotals(fromMs = 0) {
  const rows = (state.receipts || []).filter(r => r.at >= fromMs);
  const sum = (f) => rows.filter(f).reduce((n, r) => n + r.amount, 0);
  return {
    card: sum(r => r.method === 'card'),
    cash: sum(r => r.method !== 'card'),
    all: sum(() => true),
    count: rows.length,
  };
}

/* ---------------- mutations ---------------- */
/* ---- what the sign-up screen checks, kept beside the account itself so
        the same rules answer the profile screen and a future server ---- */
export const PW_MIN = 8;
/** letters, spaces, apostrophes and hyphens — never a digit or a symbol */
export function validName(v) {
  return /^[\p{L}][\p{L}\s'’-]*$/u.test(String(v || '').trim());
}
export function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(v || '').trim());
}
/* ------------------------------------------------------------
   THE PASSWORD RULE — one function, and the three screens ask it

   There were three different rules. Sign-up demanded 8 + a letter
   + a digit; the CHANGE screen demanded `length < 6` and nothing
   else, and the admin panel the same. So anybody could register
   with a strong password and change it to `123456` a minute
   later — which makes a rule on the sign-up screen worth exactly
   nothing. Every check now comes back here.

   ENGLISH ONLY, and not as a preference:
   · Arabic has no capital letters, so «an uppercase letter» is a
     condition nobody could ever satisfy — a wall with no door.
   · ا · أ · إ · آ look identical and are four different
     characters; ه and ة; ي and ى; and the harakat are invisible
     entirely. Keyboards disagree about which they emit, so the
     same word typed on another phone is a different string. The
     owner is locked out while reading their correct password off
     the screen, and nobody — not them, not us — can see why.
   · Arabic-Indic digits are not digits to /\d/, so `Rami٢٠٢٦$`
     would be refused for «missing a number» with four of them
     on screen.
   ------------------------------------------------------------ */

/* Classic weak words. The leet substitutions are normalised FIRST and
   then searched as a substring — otherwise stripping symbols turns
   `P@ssw0rd!` into `pssw0rd`, which does not match `password` and sails
   straight through. */
const PW_LEET = { '@': 'a', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' };
const pwLeet = (v) => String(v || '').toLowerCase()
  .split('').map(c => PW_LEET[c] || c).join('').replace(/[^a-z]/g, '');
const pwPlain = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const PW_ALWAYS = ['password', 'qwerty', 'letmein', 'iloveyou', 'welcome',
                   'abcdef', 'monkey', 'dragon', 'football', 'sunshine',
                   'admin', 'master'];
/* The first things anybody signing up for an app called ARABNA in Houston
   will reach for. Matched WHOLE, not as a substring: `Houston2026$` is
   refused (the city and some digits), `Elby#Katy77` is fine (a real name
   as well). Using `includes` here would refuse every password that
   happens to contain a city, which is too much. */
const PW_BRAND = ['arabna', 'houston', 'texas', 'katy', 'sugarland'];

export function isCommonPassword(v) {
  if (PW_ALWAYS.some(w => pwLeet(v).includes(w))) return true;
  const p = pwPlain(v), letters = p.replace(/[0-9]/g, '');
  if (PW_BRAND.includes(letters)) return true;
  if (/^(.)\1+$/.test(p)) return true;                    // aaaaaaaa
  if (/(012|123|234|345|456|567|678|789|987|876|765|654|543|432|321|210)/.test(p)) return true;
  return false;
}

/** every condition on its own, because the screen shows them one by one */
export function passwordChecks(v) {
  const p = String(v || '');
  return {
    latin:  p.length > 0 && /^[\x20-\x7E]+$/.test(p),
    len:    p.length >= PW_MIN,
    upper:  /[A-Z]/.test(p),
    lower:  /[a-z]/.test(p),
    digit:  /\d/.test(p),
    // any character that is not a letter, a digit or a space. Never a
    // fixed list: somebody typing «؟» deserves to pass.
    symbol: /[^A-Za-z0-9\s]/.test(p),
    common: p.length > 0 && !isCommonPassword(p),
  };
}
export function passwordOk(v) {
  return Object.values(passwordChecks(v)).every(Boolean);
}

/* ---- the verification step is remembered, so closing the app returns to
        it instead of to an empty form ---- */
export const CODE_TTL_MS = 10 * 60 * 1000;
export function setPendingVerify(kind, target) {
  state.pendingVerify = { kind, target, sentAt: now() };
  save();
}
export function pendingVerify() {
  const pv = state.pendingVerify;
  if (!pv) return null;
  return Object.assign({}, pv, { expired: now() - pv.sentAt > CODE_TTL_MS });
}
export function clearPendingVerify() { state.pendingVerify = null; save(); }
export function touchPendingVerify() {
  if (state.pendingVerify) { state.pendingVerify.sentAt = now(); save(); }
}

/** the last three digits of the number on file, and nothing more */
export function phoneTail() {
  /* ⚠️ The PENDING number first: without it the message names the tail of
     the OLD number while asking for the new one — the very message `315`
     had just repaired. */
  const n = pendingPhone() || (state.user && state.user.phone) || '';
  return String(n).replace(/\D/g, '').slice(-3);
}
/** the same person, however they punctuated it */
export function samePhone(a, b) {
  const n = (x) => String(x || '').replace(/\D/g, '').slice(-10);
  return !!n(a) && n(a) === n(b);
}

/* ------------------------------------------------------------
   THE PASSWORD IS NEVER WRITTEN DOWN

   It used to go into localStorage as typed, readable by anyone
   who opened the console. The danger was never really this app —
   there is no server and the account lives on its owner's own
   device, so whoever reaches the storage has reached the account
   already. The danger is that most people reuse one password
   everywhere, so what we were keeping in the clear was very
   likely the key to their email.

   A rule about the SHAPE of a password does nothing about this:
   thirty characters stored in the clear are as exposed as `1234`.
   So the word itself is not kept at all — only a SHA-256 of it
   with a random salt, which is enough for the one thing this
   build needs (does the old one match?) and useless to a reader.

   crypto.subtle needs a secure context. On localhost and on
   Vercel it is there; opened from a file:// URL it is not, and
   then nothing is stored rather than the word in the clear.
   ------------------------------------------------------------ */
const PW_SUBTLE = () => (typeof crypto !== 'undefined' && crypto.subtle) || null;

function randomSalt() {
  const b = new Uint8Array(16);
  (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? crypto.getRandomValues(b)
    : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(pw, salt) {
  const sub = PW_SUBTLE();
  if (!sub || !pw) return '';
  const bytes = new TextEncoder().encode(salt + '\u0000' + pw);
  const digest = await sub.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function setUserPassword(pw) {
  if (!state.user) return;
  const salt = randomSalt();
  const hash = await hashPassword(pw, salt);
  if (hash) { state.user.pwSalt = salt; state.user.pwHash = hash; }
  delete state.user.password;          // nothing readable is left behind
  save();
}

/** true when there is nothing to check against, as before */
export async function checkUserPassword(pw) {
  const u = state.user;
  if (!u || !u.pwHash) return true;
  return (await hashPassword(pw, u.pwSalt || '')) === u.pwHash;
}

export async function signUp({ name, email, password, phone }) {
  state.user = {
    name, email,
    // collected at sign-up and stored unverified; the code is asked for at
    // the first action that actually needs it
    emailVerified: false, phone: phone || null, phoneVerified: false,
    joined: Date.now(),
    avatar: null,          // { url, status: 'pending' | 'live' }
    badge: null,           // { status: 'pending' | 'live', since }
  };
  /* A new account owns nothing. The boot cleanup above only runs while
     there is no user, so a device that still carried the old `['c1']`
     kept it the moment somebody signed up — and their first «إعلاناتي»
     showed a stranger's car, editable. */
  state.myListings = [];
  save();
  await setUserPassword(password || '');
}
export function confirmEmail() {
  if (!state.user) return;
  /* a change waiting on this very code is promoted here, and ONLY here —
     this is the one function that is never called without a correct code,
     and a promotion anywhere else would undo the whole guard. */
  if (state.user.pendingEmail) {
    state.user.email = state.user.pendingEmail;
    delete state.user.pendingEmail;
  }
  state.user.emailVerified = true;
  save();
}
/** the number waiting on a code, or null — never shown as the account's */
export function pendingPhone() {
  return (state.user && state.user.pendingPhone) || null;
}
export function cancelPhoneChange() {
  if (state.user) { delete state.user.pendingPhone; save(); }
}
export function confirmPhone(phone) {
  if (!state.user) return;
  /* the promotion lives here and ONLY here, exactly as `confirmEmail`'s
     does: this is the one function never called without a correct code. */
  state.user.phone = phone || state.user.pendingPhone || state.user.phone;
  state.user.phoneVerified = true;
  delete state.user.pendingPhone;
  save();
}
/* What survives signing out: the device's own preferences, the admin
   panel's work (it is unlocked by a device password, not by an account),
   and the receipts — an accounting record, which is why they already
   survive `deleteAccount`.
   EVERYTHING ELSE goes back to DEFAULTS. The list is what STAYS, never
   what goes: a key added tomorrow then defaults to being cleared, and
   that is the safe direction to be wrong in. Being wrong the other way is
   what this file exists for. */
const KEEPS_ON_SIGN_OUT = new Set([
  // the device's own — 195 established these are not account property
  'lang', 'theme', 'fontScale', 'location', 'geo', 'geoAsked', 'geoDenied',
  'geoGranted', 'area', 'mapsApp',
  // the admin panel's, and the operator's: not a reader's to lose
  'adminAuth', 'adminLog', 'businessEdits', 'extraArticles', 'extraEvents',
  'hiddenEvents', 'eventEdits', 'bizPhotos', 'bizVerify', 'mergedBusinesses',
  'removedBusinesses', 'adWaitlist', 'adStats', 'bizStats', 'clockOffset',
  'showDemo', 'demoPurged', 'seasons', 'ramadanDates', 'greetings', 'prayer',
  'worshipFixes', 'offers', 'flags',
  // an accounting record — unreadable while signed out, never erased
  'receipts',
]);

/* `state.user = null` alone left every owned thing behind: a visitor on
   the same phone read the previous account's receipts ($29 · ARB-26-5UQQ4)
   and CANCELLED its subscription — measured on V.05.0, not supposed. */
export function signOut() {
  const fresh = JSON.parse(JSON.stringify(DEFAULTS));
  for (const k of Object.keys(DEFAULTS)) {
    if (!KEEPS_ON_SIGN_OUT.has(k)) state[k] = fresh[k];
  }
  save();
}

/** Editing the profile. Changing the phone number is the only thing that
    costs a re-verification — everything else keeps the verified state. */
/* ⚠️ THE EMAIL IS NOT WRITTEN HERE, and that is the item.
   Before V.05.7 this line was `u.email = email` with NOTHING clearing
   `emailVerified` — so a new address inherited a «verified» mark it had
   never earned, and whoever reached the account for one minute could
   change the address and lock its owner out. The phone had always been
   done correctly; the email was the one exception in the whole file.

   And the obvious fix — write the address and clear the flag — has a
   second fault of its own: a typo would drop the account to tier 0 with
   an address nobody can receive a code at, and there is no way back.
   So the NEW address is held aside until a code confirms it, the OLD one
   keeps working meanwhile, and an abandoned change costs nothing. */
export function updateProfile({ name, email, phone }) {
  const u = state.user;
  if (!u) return null;
  if (name) u.name = name;
  let emailPending = false;
  /* ⚠️ `email !== u.email`: without it a «change» is parked every time
     «حفظ» is pressed even when the field was never touched, and a code is
     demanded for an address that did not move. */
  if (email && email !== u.email) {
    u.pendingEmail = email;
    emailPending = true;
  /* ⚠️ AND UNDOING IT CANCELS IT. The pending address was written and never
     cleared, so a typo waited for ever: retyping the real address left the
     wrong one parked, and any later visit to the code screen with the right
     code would have moved the account ONTO it. `cancelEmailChange` has
     existed since V.05.7 and nothing in the project called it. */
  } else if (email === u.email) {
    delete u.pendingEmail;
  }
  /* ⚠️ THE NUMBER IS PARKED LIKE THE ADDRESS, and Rai's decision here is
     the same argument written for the email: a typo DROPS THE ACCOUNT OUT
     OF TIER 2, and with it posting, contacting a seller, claiming a
     business and buying any advertisement.
     ⚠️ And the fault is narrower than it looks, which makes it worse:
     `#/auth/phone` checks the typed number against the one ON FILE, so
     somebody who saved a typo COULD NOT VERIFY THEIR REAL NUMBER — they
     had to retype the mistake. The error locked itself in. */
  let phonePending = false;
  if (phone !== undefined && phone !== u.phone) {
    if (!phone) {
      /* ⚠️ Emptying the field is a REMOVAL, not a change waiting on a
         code: there is nothing to verify, so dropping the mark is right. */
      u.phone = '';
      u.phoneVerified = false;
      delete u.pendingPhone;
    } else {
      u.pendingPhone = phone;
      phonePending = true;
    }
  } else if (phone !== undefined && phone === u.phone) {
    delete u.pendingPhone;              // undoing it cancels it
  }
  save();
  return Object.assign({}, u, { emailPending, phonePending });
}
/** the address waiting on a code, or null — never shown as the account's */
export function pendingEmail() {
  return (state.user && state.user.pendingEmail) || null;
}
export function cancelEmailChange() {
  if (state.user) { delete state.user.pendingEmail; save(); }
}

export async function changePassword(current, next) {
  const u = state.user;
  if (!u) return { ok: false, reason: 'no-user' };
  /* An account made before the hash existed carries the old plain field.
     Accept it once and replace it — nobody is locked out of their own
     account by a change in how we store it, and the plain copy goes. */
  if (u.password) {
    if (current !== u.password) return { ok: false, reason: 'wrong' };
  } else if (!(await checkUserPassword(current))) {
    return { ok: false, reason: 'wrong' };
  }
  await setUserPassword(next);
  return { ok: true };
}

/* ---- profile photo (moderated) ---- */
export function setAvatar(dataUrl) {
  if (!state.user) return null;
  state.user.avatar = { url: dataUrl, status: 'pending' };
  save();
  return state.user.avatar;
}
export function approveAvatar() {
  if (state.user && state.user.avatar) { state.user.avatar.status = 'live'; save(); }
  pushNotif({ icon: 'checkCircle', route: '#/profile',
    title: { ar: 'تم اعتماد صورتك', en: 'Your photo was approved' },
    body: { ar: 'صورة ملفك الشخصي صارت ظاهرة.', en: 'Your profile photo is now visible.' } });
}
export function rejectAvatar(reason) {
  logAdminAction('—', 'rejectAvatar', '', reason || '');
  if (state.user) { state.user.avatar = null; save(); }
  /* One report can be malicious, and the person on the other end is owed
     the sentence that explains it — the same rule the marketplace queue
     has followed since V.02.9. The written reason replaces the general
     line rather than sitting beside it. */
  const why = String(reason || '').trim();
  pushNotif({ icon: 'alert', route: '#/profile',
    title: { ar: 'صورتك لم تُعتمد', en: 'Your photo was not approved' },
    body: why
      ? { ar: `سبب الرفض: ${why}`, en: `Reason: ${why}` }
      : { ar: 'الصورة خالفت شروط المحتوى وتم حذفها. تقدر ترفع صورة ثانية.',
          en: 'The photo broke the content rules and was removed. You can upload another.' } });
}
/* ---- the ready-made marks and the emoji ----
   Rai's decision, reversing my recommendation: the pictures live in
   `js/avatars.js` ONCE and the reader stores only the id. And the gain
   neither of us saw during the discussion is the larger one — an
   UPLOADED photo waits for the admin, and OUR OWN picture never does.
   So the shape carries a `kind` and the review belongs to `photo` alone. */
export function setAvatarPreset(id) {
  if (!state.user || !avatarSvg(id)) return null;
  state.user.avatar = { kind: 'preset', id };
  save();
  return state.user.avatar;
}
export function setAvatarEmoji(ch) {
  if (!state.user) return null;
  /* ⚠️ ONE GRAPHEME CLUSTER, not one code point — and that is the difference
     that was cutting the flags in half. The spread `[...s][0]` takes the
     first CODE POINT, and a Saudi flag is two of them (a pair of regional
     indicators), so out came a single letter no font draws as a flag. The
     same way a thumb loses its skin tone and a family becomes one man.
     ⚠️ And the comment that stood here named this very fault — «an emoji is
     two or more units and [0] cuts it in half» — and then did a smaller
     version of it. Measured on the running app before the fix:
       U+1F1F8 U+1F1E6  ->  U+1F1F8        the Saudi flag, halved
       U+1F44D U+1F3FD  ->  U+1F44D        the skin tone dropped
     `Intl.Segmenter` is the only correct tool for this, and the fallback
     keeps an older browser working rather than throwing.
     ⚠️ The old rule is unchanged: ONE, however much was pasted. */
  const s = String(ch || '');
  let one = '';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const it = new Intl.Segmenter('ar', { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next();
    one = it.done ? '' : it.value.segment;
  } else {
    one = [...s][0] || '';
  }
  if (!one) return null;
  state.user.avatar = { kind: 'emoji', ch: one };
  save();
  return state.user.avatar;
}
export function clearAvatar() {
  if (state.user) { state.user.avatar = null; save(); }
}
/** what the profile actually draws — never a URL for the two that are not one */
export function avatarView() {
  const a = state.user && state.user.avatar;
  if (!a) return null;
  if (a.kind === 'preset') return avatarSvg(a.id) ? { kind: 'preset', id: a.id } : null;
  if (a.kind === 'emoji') return { kind: 'emoji', ch: a.ch };
  return a.status === 'live' ? { kind: 'photo', url: a.url } : null;
}
/** the avatar actually shown to other people — the photo half, unchanged.
    ⚠️ `!a.kind` is the line that matters: this is read from places that
    expect a URL, and the id of a drawing is not one. */
export function visibleAvatar() {
  const a = state.user && state.user.avatar;
  return a && !a.kind && a.status === 'live' ? a.url : null;
}

/* ---- paid verification badge ---- */
export { VERIFY_BADGE_PRICE };
export function requestBadge() {
  if (!state.user) return null;
  state.user.badge = { status: 'pending', since: Date.now() };
  save();
  return state.user.badge;
}
export function approveBadge() {
  if (state.user && state.user.badge) { state.user.badge.status = 'live'; save(); }
  pushNotif({ icon: 'checkCircle', route: '#/profile',
    title: { ar: 'تم توثيق حسابك', en: 'Your account is verified' },
    body: { ar: 'صارت علامة التوثيق الزرقاء ظاهرة بجانب اسمك.', en: 'The blue verification badge now shows next to your name.' } });
}
export function rejectBadge() {
  if (state.user) { state.user.badge = null; save(); }
  pushNotif({ icon: 'alert', route: '#/profile',
    title: { ar: 'طلب التوثيق لم يُقبل', en: 'Verification request declined' },
    body: { ar: 'ما قدرنا نوثّق الحساب حالياً. تقدر تقدّم الطلب مرة ثانية.',
            en: 'We could not verify the account right now. You can request again.' } });
}
export function hasBadge() {
  return !!(state.user && state.user.badge && state.user.badge.status === 'live');
}

export function addClassified(item) {
  const id = 'u' + Date.now();
  const rule = catRule(item.cat);
  const rec = Object.assign({
    id, daysLeft: rule.days, boosted: false, photos: [], owner: 'me',
    status: 'pending', created: Date.now(), when: { ar: 'الآن', en: 'now' },
  }, item);
  state.extraClassifieds.unshift(rec);
  state.myListings.push(id);
  if (!save()) {
    // Storage refused the write — undo it so the listing does not appear now
    // and silently disappear on the next reload.
    state.extraClassifieds.shift();
    state.myListings.pop();
    save();
    return null;
  }
  return rec;
}

/**
 * Edit one of my listings. A Free-section listing that gains a price is
 * pushed back into the review queue instead of silently going live.
 * @returns {{ rec: object, flagged: boolean }}
 */
export function updateClassified(id, patch) {
  /* Somebody else's listing is not yours to rewrite — and rewriting it is
     worse than reading it, because the listing keeps its owner's name and
     their phone conversations while carrying your words. */
  if (!ownsListing(id)) return { rec: null, flagged: false };
  const c = state.extraClassifieds.find(x => x.id === id);
  if (!c) return { rec: null, flagged: false };
  Object.assign(c, patch);

  let flagged = false;
  if (c.cat === 'free') {
    const blob = [c.title && c.title.ar, c.title && c.title.en,
                  c.desc && c.desc.ar, c.desc && c.desc.en,
                  c.price === FREE_PRICE ? '' : c.price].filter(Boolean).join(' ');
    if (violatesFreeRule(blob)) {
      c.status = 'pending';
      flagged = true;
      addFlag({
        kind: 'listing', refId: c.id, risk: 'high',
        reason: { ar: 'إعلان في قسم المجاني عُدّل ليضيف سعراً', en: 'Free-section listing edited to add a price' },
        item: c.title,
      });
    }
  }
  save();
  return { rec: c, flagged };
}

/**
 * «أخفِ الإعلان» — off every list but the owner's, and reversible.
 * It is kept as its own list rather than a field on the record, so it works
 * for a seed listing somebody owns as well as for one they typed.
 */
export function hideClassified(id) {
  if (!id) return false;
  state.hiddenListings = state.hiddenListings || [];
  if (!state.hiddenListings.includes(id)) state.hiddenListings.push(id);
  save();
  return true;
}
/** …and back again, as long as the listing still has days on it */
export function unhideClassified(id) {
  state.hiddenListings = (state.hiddenListings || []).filter(x => x !== id);
  save();
  return true;
}
export function isHidden(c) {
  const id = typeof c === 'string' ? c : (c && c.id);
  return (state.hiddenListings || []).includes(id);
}

/** what counts against the four: a hidden listing frees its slot */
export function activeListingCount() {
  return myActiveListings().filter(c => !isHidden(c)).length;
}

export function deleteClassified(id) {
  state.extraClassifieds = state.extraClassifieds.filter(c => c.id !== id);
  state.myListings = state.myListings.filter(x => x !== id);
  state.messages = state.messages.filter(m => m.listingId !== id);
  state.flags = state.flags.filter(f => f.refId !== id);
  save();
}
export function renewClassified(id) {
  const c = state.extraClassifieds.find(x => x.id === id);
  if (c) c.daysLeft = catRule(c.cat).days;
  save();
}

/* ---- moderation decisions (admin panel) ---- */
export function approveClassified(id) {
  logAdminAction(id, 'approveListing', '', '');
  const c = state.extraClassifieds.find(x => x.id === id);
  if (!c) return;
  c.status = 'live';
  state.flags = state.flags.filter(f => f.refId !== id);
  pushNotif({ icon: 'checkCircle', route: '#/marketplace/' + id,
    title: { ar: 'إعلانك صار منشوراً', en: 'Your listing is published' },
    body: { ar: 'اعتُمد إعلانك وصار ظاهراً لكل المستخدمين.', en: 'Your listing was approved and is now visible to everyone.' } });
  save();
}
/**
 * Reject a listing. The reason the admin types is delivered to the owner,
 * so a rejection is never silent.
 */
export function rejectClassified(id, reason) {
  logAdminAction(id, 'rejectListing', '', reason || '');
  const c = state.extraClassifieds.find(x => x.id === id);
  if (!c) return;
  const why = String(reason || '').trim();
  pushNotif({ icon: 'alert', route: '#/my-ads',
    title: { ar: 'إعلانك لم يُعتمد', en: 'Your listing was not approved' },
    body: why
      ? { ar: `سبب الرفض: ${why}`, en: `Reason: ${why}` }
      : { ar: 'إعلانك خالف شروط النشر وتم حذفه. تقدر تنشر إعلاناً جديداً مطابقاً للشروط.',
          en: 'Your listing broke the posting rules and was removed. You can post a new one that follows the rules.' } });
  deleteClassified(id);
}

/* ---- draft rescue ----
   A half-filled post (text *and* compressed photos) survives the detour
   through email / phone verification, so nothing is retyped or re-picked. */
export function saveDraft(draft) { state.draft = draft; save(); return lastSaveOk; }
export function takeDraft() { const d = state.draft; state.draft = null; save(); return d; }
export function peekDraft() { return state.draft; }
/** the single definition of "this listing is mine" */
export function ownsListing(id) { return !!id && state.myListings.includes(id); }

/**
 * Boosting somebody else's listing pins THEIR advertisement to the top of
 * the marketplace and writes the receipt in YOUR name. The screen guard
 * below stops the screen; this stops everything else — the console today,
 * an API call the day there is a server. That is the V.03.3 lesson about
 * `startSubscription`, and this is the same shape of hole in the same
 * kind of place.
 */
export function boostClassified(id) {
  if (!ownsListing(id)) return false;
  if (!state.boosted.includes(id)) state.boosted.push(id);
  save();
  return true;
}
export function reportItem(id, label) {
  if (!state.reported.includes(id)) state.reported.push(id);
  addFlag({
    kind: 'report', refId: id, risk: 'medium',
    reason: { ar: 'بلاغ من مستخدم', en: 'User report' },
    item: label || { ar: id, en: id },
  });
  save();
}

/* ============================ REVIEWS ============================ */

/** every review shown on a business page: seeded ones + ones written here */
export function reviewsFor(bizId) {
  const mine = state.reviews.filter(r => r.bizId === bizId);
  return mine.concat(withoutDemo(REVIEWS[bizId] || []).filter(r => !isBlocked(r)));
}
/** my own review of a business, if I wrote one */
export function myReviewFor(bizId) { return state.reviews.find(r => r.bizId === bizId) || null; }
export function myReviews() { return state.reviews.slice(); }

/**
 * Live rating for a business: the seeded aggregate plus every review
 * written in-app, so the average and the count move together.
 */
export function ratingFor(b) {
  const mine = state.reviews.filter(r => r.bizId === b.id);
  const baseCount = b.reviewCount || 0;
  const baseSum = (b.rating || 0) * baseCount;
  const count = baseCount + mine.length;
  if (!count) return { avg: 0, count: 0 };
  const sum = baseSum + mine.reduce((a, r) => a + r.rating, 0);
  return { avg: Math.round((sum / count) * 10) / 10, count };
}

export function addReview(bizId, rating, text) {
  const existing = myReviewFor(bizId);
  if (existing) return updateReview(existing.id, rating, text);
  const rec = {
    id: 'r' + Date.now(), bizId, rating, mine: true,
    user: (state.user && state.user.name) || 'أنا',
    text: { ar: text, en: text },
    when: { ar: 'الآن', en: 'just now' },
    created: Date.now(),
  };
  state.reviews.unshift(rec);
  // the owner hears about it — this is the notification shop owners open
  if ((state.myBusinessIds || []).includes(bizId)) {
    const stars = '★'.repeat(rating);
    notifyKeys('revNewTitle', 'revNewBody', '#/directory/' + bizId, 'star', stars);
  }
  save();
  return rec;
}
export function updateReview(id, rating, text) {
  const r = state.reviews.find(x => x.id === id);
  if (!r) return null;
  r.rating = rating;
  r.text = { ar: text, en: text };
  r.when = { ar: 'عُدّلت الآن', en: 'edited just now' };
  save();
  return r;
}
export function deleteReview(id) {
  state.reviews = state.reviews.filter(x => x.id !== id);
  save();
}

/* ============================ EVENTS ============================
   Seed events live in data.js; admin edits are layered on top so the
   seed file stays a clean import target for V.02. */

function mergeEvent(e) {
  const patch = state.eventEdits[e.id];
  return patch ? Object.assign({}, e, patch) : e;
}

/** Has this event already finished? (endsAt, or the start when there is no end) */
export function eventIsPast(e, now = Date.now()) {
  const end = e.endsAt || e.startsAt;
  if (!end) return false;
  const ts = Date.parse(end);
  return !isNaN(ts) && ts < now;
}

/** Every event the admin can see, newest edits applied, deleted ones removed. */
export function allEvents() {
  return state.extraEvents
    .concat(withoutDemo(EVENTS).filter(e => !state.hiddenEvents.includes(e.id)))
    .map(mergeEvent);
}

/**
 * What the public sees: approved events that have not finished yet,
 * soonest first, with any featured (paid) event pinned on top.
 */
export function upcomingEvents() {
  return allEvents()
    .filter(e => e.status === 'live')
    .filter(e => !eventIsPast(e))
    .sort((a, b) => (b.featured === true) - (a.featured === true)
                 || (Date.parse(a.startsAt) || 0) - (Date.parse(b.startsAt) || 0));
}
export function eventById(id) { return allEvents().find(e => e.id === id) || null; }
export function pendingEvents() { return allEvents().filter(e => e.status === 'pending'); }

/**
 * Add an event. `status` decides the path: the admin creates them live,
 * an organizer proposes them and they wait for approval.
 */
/**
 * An event is the proposer's if it is in their own `extraEvents`. There is
 * no server and no author id yet, so that IS the ownership record — see
 * `personKey()`, the same stand-in the rest of the app uses.
 */
export function ownsEvent(id) {
  return !!id && state.extraEvents.some(e => e.id === id);
}

/**
 * `status` is a decision, not a parameter the caller may assert: 'live'
 * publishes to everybody and `featured` is the $99/week pin. Only an
 * unlocked panel may set either, so the screen cannot grant itself the
 * right by reading a flag off the URL — which is exactly what
 * `?admin=1` was doing.
 */
export function addEvent(ev, status = 'pending') {
  if (status !== 'pending' && !adminSession) status = 'pending';
  if (ev && ev.featured && !adminSession) ev = Object.assign({}, ev, { featured: false });
  const rec = Object.assign({}, ev, {
    id: 'ev' + Date.now(),
    status,
    source: ev.source || 'manual',
    externalId: ev.externalId || '',
    sourceUrl: ev.sourceUrl || '',
    created: Date.now(),
  });
  state.extraEvents.unshift(rec);
  if (!save()) { state.extraEvents.shift(); save(); return null; }
  return rec;
}
/**
 * The admin edits through the organiser's own form — one form, one shape of
 * data — so the panel passes `admin`, and nobody else may. Written here and
 * not only on the screen: a guard on a screen is bypassed by anything that
 * is not that screen.
 */
export function updateEvent(id, patch, admin = false) {
  if (!admin && !ownsEvent(id)) return null;
  if (!admin && patch && 'featured' in patch) { patch = Object.assign({}, patch); delete patch.featured; }
  const own = state.extraEvents.find(e => e.id === id);
  if (own) Object.assign(own, patch);
  else state.eventEdits[id] = Object.assign({}, state.eventEdits[id], patch);
  save();
  return eventById(id);
}
export function deleteEvent(id) {
  const ev = eventById(id);
  logAdminAction(id, 'deleteEvent', ev ? (ev.title && (ev.title.ar || ev.title.en)) || '' : '', '');
  const before = state.extraEvents.length;
  state.extraEvents = state.extraEvents.filter(e => e.id !== id);
  if (state.extraEvents.length === before && !state.hiddenEvents.includes(id)) {
    state.hiddenEvents.push(id);          // seed event → hide instead of mutating data.js
  }
  delete state.eventEdits[id];
  save();
}
export function approveEvent(id) {
  logAdminAction(id, 'approveEvent', '', '');
  updateEvent(id, { status: 'live' }, true);
  pushNotif({ icon: 'calendar', route: '#/events/' + id,
    title: { ar: 'تم اعتماد فعاليتك', en: 'Your event was approved' },
    body: { ar: 'فعاليتك صارت ظاهرة في قسم الفعاليات.', en: 'Your event is now listed in Events.' } });
}
export function rejectEvent(id, reason) {
  logAdminAction(id, 'rejectEvent', '', reason || '');
  const why = String(reason || '').trim();
  pushNotif({ icon: 'alert', route: '#/events',
    title: { ar: 'فعاليتك لم تُعتمد', en: 'Your event was not approved' },
    body: why ? { ar: `سبب الرفض: ${why}`, en: `Reason: ${why}` }
              : { ar: 'ما قدرنا نعتمد الفعالية. راجع التفاصيل وأعد الإرسال.',
                  en: 'We could not approve the event. Check the details and submit again.' } });
  deleteEvent(id);
}
/** Featured = the paid "pin to the top" placement. */
export function featureEvent(id, on = true) { updateEvent(id, { featured: !!on }, true); }

/* ========================= MODERATION QUEUE ========================= */

export function addFlag({ kind, refId, reason, risk = 'medium', item }) {
  if (state.flags.some(f => f.refId === refId && f.kind === kind)) return;
  state.flags.unshift({ id: 'f' + Date.now() + Math.random().toString(36).slice(2, 5),
                        kind, refId, reason, risk, item: item || null, created: Date.now() });
  save();
}
export function resolveFlag(id) {
  state.flags = state.flags.filter(f => f.id !== id);
  save();
}
/** listings still waiting on a human decision */
export function pendingListings() {
  return state.extraClassifieds.filter(c => c.status === 'pending');
}

/**
 * EVERY listing the panel can act on, whatever its state. Approving one
 * used to remove it from the panel for good, so a report arriving two days
 * later had nowhere to be opened — which is the whole reason this exists.
 * Seeded listings are included: a report can land on one of those too.
 */
export function adminListings() {
  const seen = new Set();
  const all = (state.extraClassifieds || []).concat(CLASSIFIEDS)
    .filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
    .map(c => Object.assign({ status: 'live' }, c));
  return all.map(c => Object.assign({}, c, {
    status: isHidden(c.id) ? 'hidden' : c.status,
    reports: reportCount(c.id),
  }));
}

/** how many open reports point at this thing */
export function reportCount(refId) {
  return (state.flags || []).filter(f => f.refId === refId).length;
}

/**
 * The admin takes a listing down. Not a delete: most cases are a breach
 * that can be fixed, and an erased listing takes its messages and its
 * remaining days with it. The owner is told, and told why.
 */
export function adminHideListing(id, reason) {
  logAdminAction(id, 'hideListing', '', reason || '');
  // the same list «أخفِ الإعلان» uses, so it works on a seed listing too
  hideClassified(id);
  (state.flags || []).filter(f => f.refId === id).forEach(f => resolveFlag(f.id));
  pushNotif({
    icon: 'shield',
    title: strOf('adminHiddenTitle'),
    body: reason || strOf('adminHiddenBody'),
    route: '#/my-ads',
  });
  save();
  return true;
}

/** …and the permanent one, which asks for a reason and delivers it */
export function adminDeleteListing(id, reason) {
  logAdminAction(id, 'deleteListing', '', reason || '');
  pushNotif({
    icon: 'alert',
    title: strOf('adminRemovedTitle'),
    body: reason || strOf('adminRemovedBody'),
    route: '#/my-ads',
  });
  deleteClassified(id);
  (state.flags || []).filter(f => f.refId === id).forEach(f => resolveFlag(f.id));
  return true;
}

/** a free-text notice from the panel to whoever owns the listing */
export function adminNotify(id, text) {
  const c = classifiedById(id);
  pushNotif({
    icon: 'bell',
    title: strOf('adminNoticeTitle'),
    body: text,
    route: c ? '#/marketplace/' + id : '#/my-ads',
  });
  return true;
}

/** one i18n string, in the reader's language, without importing i18n */
function strOf(key) {
  const packs = i18nPacks();
  const lang = state.lang === 'en' ? 'en' : 'ar';
  return (packs[lang] && packs[lang][key]) || (packs.ar && packs.ar[key]) || key;
}
/** profile photo waiting on review */
export function pendingAvatar() {
  const a = state.user && state.user.avatar;
  return a && a.status === 'pending' ? a : null;
}
/** verification badge waiting on review */
export function pendingBadge() {
  const b = state.user && state.user.badge;
  return b && b.status === 'pending' ? b : null;
}
export function pendingCount() {
  return pendingListings().length + pendingEvents().length + state.flags.length
       + (pendingAvatar() ? 1 : 0) + (pendingBadge() ? 1 : 0)
       + pendingClaims().length + pendingBizPhotos().length + pendingBizVerify().length
       + pendingOffers().length + pendingWorshipFixes().length;
}

/* ====================== IN-APP MESSAGES ====================== */

export function messagesFor(listingId) {
  return state.messages.filter(m => m.listingId === listingId);
}

/** what the owner's button counts: messages from buyers, not their own */
export function buyerMessageCount(listingId) {
  return state.messages.filter(m => m.listingId === listingId && m.from !== 'me').length;
}
export function messageThreads() {
  const seen = {};
  state.messages.forEach(m => { seen[m.listingId] = (seen[m.listingId] || 0) + 1; });
  return Object.keys(seen).map(id => ({ listingId: id, count: seen[id] }));
}

/**
 * Send a marketplace message. Phone numbers are stripped before the message
 * is stored, and the text is run through the automated scan.
 * @returns {{ msg: object, removed: number, flagged: boolean }}
 */
export function sendMessage(listingId, text, lang = 'ar') {
  const listing = classifiedById(listingId);
  const clean = scrubContact(text, lang);
  const scan = scanMessage(text, listing);
  const msg = {
    id: 'm' + Date.now(), listingId, from: 'me', text: clean.text,
    offPlatform: OFF_PLATFORM.test(asciiDigits(String(text || ''))),
    scrubbed: clean.removed,
    when: { ar: 'الآن', en: 'just now' }, created: Date.now(),
  };
  state.messages.push(msg);

  // the seller is told, on the listing the message is about
  if (listing && !state.myListings.includes(listingId)) {
    notifyKeys('msgNewTitle', 'msgNewBody', '#/messages/' + listingId, 'message');
  }

  // Repeated attempts to hand out contact details get their own report.
  if (clean.removed) {
    const attempts = state.messages.filter(m => m.from === 'me' && m.scrubbed).length;
    if (attempts >= 2) {
      addFlag({
        kind: 'contact-attempts', refId: 'contact-' + listingId, risk: 'medium',
        reason: { ar: `تكرار محاولة تبادل وسيلة تواصل خارج التطبيق (${attempts} مرات)`,
                  en: `Repeated attempts to share off-app contact details (${attempts} times)` },
        item: listing ? listing.title : null,
      });
    }
  }
  if (scan.flagged) {
    addFlag({
      kind: 'message', refId: msg.id, risk: 'high',
      reason: scan.reason === 'free-item-sale'
        ? { ar: 'محاولة بيع غرض منشور في قسم المجاني', en: 'Trying to sell an item posted in the Free section' }
        : { ar: 'تكرار طلب الدفع خارج التطبيق', en: 'Repeated request to pay outside the app' },
      item: listing ? listing.title : null,
    });
  }
  save();
  return { msg, removed: clean.removed, flagged: scan.flagged };
}

let bizSeq = 0;
/**
 * Delete a listing from the directory. A user-added one goes out of
 * `extraBusinesses`; a seed cannot, because it lives in `data.js` and is
 * shipped to everyone — so the removal is recorded and `everyBusiness()`
 * filters it. Either way the reviews, favourites and photos that hung off
 * it go too, or they would attach to whatever takes the id next.
 */
export function deleteBusiness(id) {
  logAdminAction(id, 'deleteBusiness', '', '');
  if (!id) return false;
  const wasExtra = (state.extraBusinesses || []).some(b => b.id === id);
  state.extraBusinesses = (state.extraBusinesses || []).filter(b => b.id !== id);
  if (!wasExtra && !(state.removedBusinesses || []).includes(id)) {
    state.removedBusinesses = (state.removedBusinesses || []).concat(id);
  }
  if (state.businessEdits) delete state.businessEdits[id];
  if (state.bizPhotos) delete state.bizPhotos[id];
  if (state.bizVerify) delete state.bizVerify[id];
  state.saved = (state.saved || []).filter(x => x !== id);
  state.reviews = (state.reviews || []).filter(r => r.bizId !== id);
  state.myBusinessIds = (state.myBusinessIds || []).filter(x => x !== id);
  save();
  return true;
}

export function addBusiness(biz, { pendingReview = false } = {}) {
  // a counter as well as the clock: two records added inside the same
  // millisecond must not share an id
  const id = 'ub' + Date.now() + '-' + (++bizSeq);
  const rec = Object.assign({ id, plan: 'free', verified: false, rating: 0, reviewCount: 0, needsGeo: true, claimed: true, photos: 0, videos: 0 }, biz);
  if (pendingReview) {
    // added over a certain duplicate match: the person said it is a
    // different shop, and an admin decides who is right. It shows on
    // their own device immediately and to nobody else.
    rec.status = 'pendingReview';
    state.myPendingBusinesses = (state.myPendingBusinesses || []).concat(id);
  }
  state.extraBusinesses.unshift(rec);
  if (!pendingReview) {
    state.myBusinessIds = state.myBusinessIds || [];
    state.myBusinessIds.push(id);
  }
  save();
  return rec;
}
/** Kept as the single entry point, but it now raises a request rather than
    handing the page over: ownership is an admin decision. */
export function claimBusiness(id, details) { return requestClaim(id, details); }

/* ============================================================
   Subscription and auto-renewal
   ------------------------------------------------------------
   Most of the shape of this is a legal requirement, not a design
   choice: a negative-option subscription in the US has to state the
   amount, the cycle and the first charge date before any card field,
   take an affirmative opt-in that is not pre-ticked, keep what the
   person actually agreed to, and let them out in as few steps as they
   got in. Everything below exists to satisfy that, and Stripe replaces
   only the charging.
   ============================================================ */

export const TRIAL_DAYS = 14;
export const YEARLY_DISCOUNT = 0.15;
const DAY_MS = 86400000;

/** the yearly price, derived from the monthly one so the two cannot drift */
export function planPrice(plan) {
  return plan === 'yearly'
    ? Math.round(SUBSCRIPTION_PRICE * 12 * (1 - YEARLY_DISCOUNT))
    : SUBSCRIPTION_PRICE;
}
/** what a year up front saves against paying monthly */
export function yearlySaving() {
  return SUBSCRIPTION_PRICE * 12 - planPrice('yearly');
}

/**
 * The clock everything dated reads. It is the real one plus whatever the
 * admin test panel has wound forward, so a trial ending and a renewal can
 * be watched happening without a server. The offset ships with the demo
 * data and goes with it.
 */
export function now() { return Date.now() + (state.clockOffset || 0); }
export function advanceClock(days) {
  state.clockOffset = (state.clockOffset || 0) + days * DAY_MS;
  runSubscriptionCycle();
  runReminders();
  save();
}
export function resetClock() { state.clockOffset = 0; save(); }
export function clockDaysAhead() { return Math.round((state.clockOffset || 0) / DAY_MS); }

/**
 * Start a subscription. `consentText` is stored verbatim, not as a link:
 * the wording can change later and what matters is what this person read.
 */
export function startSubscription({ businessId, plan = 'monthly', consentText = '', device = '' }) {
  /* The screen guard is a courtesy to the reader; THIS is the rule.
     A guard that lives on a screen is bypassed by anything that is not
     that screen — the console today, an API call the day there is a
     server — and this record is not a row in a table: it is what lifts
     one shop above another in the directory. So the check is written
     once, here, where every caller has to pass it. */
  if (businessId && !ownsBusiness(businessId)) return null;
  const t0 = now();
  const price = planPrice(plan);
  state.subscription = {
    businessId, plan, price,
    status: 'trialing',
    startedAt: t0,
    trialEndsAt: t0 + TRIAL_DAYS * DAY_MS,
    currentPeriodEnd: t0 + TRIAL_DAYS * DAY_MS,
    cancelAtPeriodEnd: false,
    consent: { text: consentText, acceptedAt: t0, device, amount: price, cycle: plan },
    invoices: [],
    notified: {},
  };
  save();
  return state.subscription;
}

/** one period forward from `from`, by the plan's cycle */
function periodEnd(from, plan) {
  return plan === 'yearly' ? from + 365 * DAY_MS : from + 30 * DAY_MS;
}

/**
 * Move the subscription to wherever the clock now is: end the trial, take
 * the renewals that fell due, and send the notices the law expects before
 * each one. Called on every read, so no timer has to be running.
 */
export function runSubscriptionCycle() {
  const sub = state.subscription;
  if (!sub || sub.status === 'canceled') return sub;
  const t = now();
  sub.notified = sub.notified || {};
  let changed = false;

  /* The reminders have a lower bound only. Real time arrives a second at a
     time and would land inside any window, but the admin test clock jumps a
     week at once — and a notice the law expects must not be skipped because
     the tester moved fast. */
  if (sub.status === 'trialing' && !sub.notified.trialEnding
      && t >= sub.trialEndsAt - 2 * DAY_MS) {
    notifyKeys('subTrialEndTitle', 'subTrialEndBody', '#/my-subscription', 'clock');
    sub.notified.trialEnding = true; changed = true;
  }
  // "renews in three days — $29"
  if (sub.status === 'active' && !sub.notified['renew' + sub.currentPeriodEnd]
      && t >= sub.currentPeriodEnd - 3 * DAY_MS) {
    notifyKeys('subRenewSoonTitle', 'subRenewSoonBody', '#/my-subscription', 'creditCard',
               fmtAmount(sub.price));
    sub.notified['renew' + sub.currentPeriodEnd] = true; changed = true;
  }

  // every period the clock has passed
  let guard = 0;
  while (t >= sub.currentPeriodEnd && guard++ < 200) {
    if (sub.cancelAtPeriodEnd) {
      sub.status = 'canceled';
      sub.endedAt = sub.currentPeriodEnd;
      notifyKeys('subEndedTitle', 'subEndedBody', '#/my-subscription', 'alert');
      changed = true;
      break;
    }
    /* The invoice row stays for the subscription screen's own history;
       the RECEIPT is the document, and it carries the number. */
    const rec = addReceipt({
      kind: 'subscription', amount: sub.price, method: sub.method || 'card',
      bizId: sub.businessId, autoRenew: sub.autoRenew !== false,
      description: strOf('subscription'),
      covers: { from: sub.currentPeriodEnd, to: periodEnd(sub.currentPeriodEnd, sub.plan) },
    });
    sub.invoices = (sub.invoices || []).concat([{
      id: rec.id,
      date: sub.currentPeriodEnd, amount: sub.price, status: 'paid',
    }]);
    const wasTrial = sub.status === 'trialing';
    sub.status = 'active';
    sub.currentPeriodEnd = periodEnd(sub.currentPeriodEnd, sub.plan);
    notifyKeys(wasTrial ? 'subStartedTitle' : 'subRenewedTitle',
               wasTrial ? 'subStartedBody' : 'subRenewedBody',
               '#/my-subscription', 'creditCard', fmtAmount(sub.price));
    changed = true;
  }
  if (changed) save();
  return sub;
}
function fmtAmount(n) { return '\u2066$' + n + '\u2069'; }

/** the live record, rolled forward to today */
/* Same rule as `receipts()`: the screen stays open, the data does not
   answer to somebody with no account. This is where the visitor's
   «إلغاء الاشتراك» button was coming from. */
export function subscription() { return isLoggedIn() ? runSubscriptionCycle() : null; }

/** cancelling keeps the service to the end of what was paid for */
export function cancelSubscription() {
  const sub = state.subscription;
  if (!sub) return null;
  sub.cancelAtPeriodEnd = true;
  save();
  return sub;
}
export function resumeSubscription() {
  const sub = state.subscription;
  if (!sub) return null;
  sub.cancelAtPeriodEnd = false;
  save();
  return sub;
}
export function changeSubscriptionPlan(plan) {
  const sub = state.subscription;
  if (!sub || sub.plan === plan) return sub;
  sub.plan = plan;
  sub.price = planPrice(plan);
  save();
  return sub;
}
/** the card is simulated; what matters is that the screen exists */
export function updateSubscriptionCard(last4) {
  const sub = state.subscription;
  if (!sub) return null;
  sub.card = { last4: String(last4 || '').slice(-4) };
  save();
  return sub;
}

/** does the subscription entitle this business to the paid plan right now? */
export function subscriptionActive() {
  const sub = subscription();
  return !!sub && (sub.status === 'trialing' || sub.status === 'active');
}

/** kept as the old entry point; the trial-less path is not used any more */
export function subscribeBusiness(businessId) {
  return startSubscription({ businessId, plan: 'monthly' });
}

/* ============================================================
   Ad inventory
   ------------------------------------------------------------
   A placement is a finite thing. Selling more of it than exists is
   how an ad surface stops working for everyone on it, so the count
   is enforced here and shown to the buyer before they choose.
   ============================================================ */

export function adProduct(id) { return AD_PRODUCTS.find(p => p.id === id) || null; }

/** how many of this placement exist at once (per category where that applies) */
export function adCapacity(productId) { return AD_SLOTS[productId] || 0; }

/** the orders occupying a placement right now */
export function adsRunning(productId, cat) {
  const t = now();
  return (state.myAds || [])
    .filter(a => a.product === productId)
    .filter(a => !cat || a.cat === cat)
    .filter(a => a.status === 'live' || a.status === 'pending')
    .filter(a => !a.endsAt || a.endsAt > t);
}

export function adSlotsLeft(productId, cat) {
  return Math.max(0, adCapacity(productId) - adsRunning(productId, cat).length);
}

/**
 * When the next slot frees up — read off the running orders rather than
 * typed in by hand, so it cannot be wrong.
 */
export function adNextFreeAt(productId, cat) {
  const running = adsRunning(productId, cat)
    .map(a => a.endsAt || 0)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (adSlotsLeft(productId, cat) > 0) return null;
  return running.length ? running[0] : null;
}

/* ============================================================
   THE CASH ORDER — issued from the panel, and never renewed
   ------------------------------------------------------------
   «Somebody I know wants an ad and wants to pay cash — how do we
   skip the card?» We do not skip anything: there is NO «skip
   payment» button on any screen a user can reach, and no «paid
   in cash» box anybody can tick for themselves. A button like
   that gets found, one day, by somebody.

   The money is handed over, then the order is issued from the
   panel in that person's name. Which gives the second rule:

   A CASH ORDER DOES NOT RENEW. A card subscription renews
   itself; cash does not. Create it like an ordinary one and you
   end up with a subscriber whose month ran out long ago and
   whose page still says «subscribed» — while nothing was
   collected. So it is a closed period that ends by itself, with
   a warning to the panel a week before, and its receipt says
   «ends on», never «renews automatically».
   ============================================================ */
export const CASH_WARN_DAYS = 7;
export const CASH_METHODS = ['cash', 'check', 'transfer'];

/**
 * Take money by hand and put it on the books. Issues the receipt, so the
 * buyer walks away with a transaction number like any card payer.
 */
export function addCashOrder({ kind, bizId = null, product = '', cat = '',
                               days = 30, amount = 0, method = 'cash',
                               receivedBy = '', reference = '', note = '',
                               bizName = '', tagline = '', ctaText = '' }) {
  if (!CASH_METHODS.includes(method)) return null;
  /* ⚠️ Money handed over in person is the one action that leaves no trace
     anywhere else — no card statement, no gateway record — so who issued it
     and for how much belongs in the log beside everything else. */
  logAdminAction(bizId || '—', 'cashOrder', receivedBy || '', String(amount || 0));
  const t0 = now();
  const endsAt = t0 + (Number(days) || 30) * DAY_MS;
  const receipt = addReceipt({
    kind: kind === 'subscription' ? 'subscription' : 'ad',
    description: note || product || strOf(kind === 'subscription' ? 'subscription' : 'kindAd'),
    amount: Number(amount) || 0,
    method, bizId, receivedBy, reference,
    autoRenew: false,                      // cash never renews
    covers: { from: t0, to: endsAt },
  });

  if (kind === 'subscription') {
    /* Written straight in rather than through startSubscription(): that
       one guards on ownership, which is right for somebody buying their
       own and wrong for the panel entering a payment it just took. */
    state.subscription = {
      businessId: bizId, plan: 'monthly', price: Number(amount) || 0,
      status: 'active', startedAt: t0,
      trialEndsAt: t0, currentPeriodEnd: endsAt,
      cancelAtPeriodEnd: true,             // it ends, it does not roll on
      autoRenew: false, method,
      cash: { receivedBy, reference, note, receiptId: receipt.id },
      consent: { text: strOf('cashConsentNote'), acceptedAt: t0, device: 'panel',
                 amount: Number(amount) || 0, cycle: 'cash' },
      invoices: [{ id: receipt.id, date: t0, amount: Number(amount) || 0, status: 'paid' }],
      notified: {},
    };
  } else {
    state.myAds.unshift({
      id: 'ad' + t0 + '-' + (state.myAds || []).length,
      product, cat, duration: 'cash', price: Number(amount) || 0,
      status: 'live', created: t0, startsAt: t0, endsAt,
      method, cash: { receivedBy, reference, note, receiptId: receipt.id },
      bizName, tagline, ctaText,
    });
  }
  save();
  return { receipt, endsAt };
}

/** what the panel must chase: a cash order about to run out, or run out */
export function cashDue() {
  const t0 = now(), soon = t0 + CASH_WARN_DAYS * DAY_MS;
  const out = [];
  const sub = state.subscription;
  if (sub && sub.autoRenew === false && sub.currentPeriodEnd <= soon) {
    const b = sub.businessId ? businessById(sub.businessId) : null;
    out.push({ kind: 'subscription', name: b ? L(b.name) : (sub.businessId || ''),
               endsAt: sub.currentPeriodEnd, expired: sub.currentPeriodEnd <= t0 });
  }
  (state.myAds || []).forEach(a => {
    if (a.method && a.method !== 'card' && a.endsAt <= soon) {
      out.push({ kind: 'ad', name: a.bizName || a.product || a.id,
                 endsAt: a.endsAt, expired: a.endsAt <= t0 });
    }
  });
  return out.sort((x, y) => x.endsAt - y.endsAt);
}

export function addAdOrder(order) {
  const p = adProduct(order.product);
  const t = now();
  const rec = Object.assign({
    id: 'ad' + t + '-' + (state.myAds || []).length,
    status: 'pending', created: t,
    startsAt: t,
    endsAt: t + ((p && p.days) || 7) * 86400000,
  }, order);
  state.myAds.unshift(rec);
  save();
  return rec;
}
export function approveAd(id) {
  logAdminAction(id, 'approveAd', '', '');
  const a = state.myAds.find(x => x.id === id);
  if (a) {
    a.status = 'live';
    notifyKeys('adLiveTitle', 'adLiveBody', '#/my-ads', 'checkCircle');
  }
  save();
}
export function rejectAd(id, reason) {
  logAdminAction(id, 'rejectAd', '', reason || '');
  const a = state.myAds.find(x => x.id === id);
  if (a) {
    a.status = 'rejected';
    a.reason = reason || '';
    notifyKeys('adNoTitle', 'adNoBody', '#/my-ads', 'alert', reason);
  }
  save();
}
/** one more period of the same placement, starting when the current one ends */
export function renewAd(id) {
  const a = state.myAds.find(x => x.id === id);
  if (!a) return null;
  const p = adProduct(a.product);
  const from = Math.max(a.endsAt || 0, now());
  a.endsAt = from + ((p && p.days) || 7) * 86400000;
  a.status = 'live';
  save();
  return a;
}

/* ---- the waiting list, so a full placement does not lose the buyer ---- */
export function joinAdWaitlist({ product, cat, name, phone, preferred }) {
  const rec = { id: 'wl' + now() + '-' + (state.adWaitlist || []).length,
                product, cat: cat || '', name, phone, preferred: preferred || '', when: now() };
  state.adWaitlist = (state.adWaitlist || []).concat([rec]);
  save();
  return rec;
}
export function adWaitlist() { return (state.adWaitlist || []).slice().reverse(); }
export function removeFromWaitlist(id) {
  state.adWaitlist = (state.adWaitlist || []).filter(w => w.id !== id);
  save();
}

/* ============================================================
   Blocking
   ------------------------------------------------------------
   Apple requires four things of any app carrying user content:
   filtering, a report button, published contact details, and a way to
   block an abusive user. The first two existed; this is the third, and
   it has to take effect immediately with no moderator in the loop —
   that is the part the review guidelines are explicit about.

   Identity in this prototype is thin: a listing's owner and a review's
   author are the handles we have. `personKey` is the one place that
   decides what "the same person" means, so real user ids replace it in
   V.02 without touching anything else.
   ============================================================ */

/**
 * What deleting an account takes with it, counted before it is done so
 * the screen can say it out loud rather than asking for a blind yes.
 */
export function deletionSummary() {
  return {
    listings: (state.myListings || []).length,
    reviews: (state.reviews || []).length,
    saved: (state.saved || []).length,
    messages: (state.messages || []).length,
    ads: (state.myAds || []).length,
    business: (state.myBusinessIds || []).length,
    subscription: state.subscription ? 1 : 0,
  };
}

/**
 * A real deletion, not a sign-out. Everything the person put into this
 * device goes: their listings, reviews, messages, favourites, ad orders,
 * subscription and any page they owned.
 */
export function deleteAccount() {
  const mine = state.myListings || [];
  state.extraClassifieds = (state.extraClassifieds || []).filter(c => !mine.includes(c.id));
  state.messages = (state.messages || []).filter(m => !mine.includes(m.listingId) && m.from !== 'me');

  /* ⚠️ DELETING AN ACCOUNT LEFT MORE BEHIND THAN SIGNING OUT OF ONE.
     `signOut` was rebuilt in V.05.2 around a list of what STAYS, so every
     key added afterwards is cleared by default; this one still named what
     it cleared, one by one, and fell behind — measured: the CARD ON FILE
     survived a deletion while an ordinary sign-out removes it, and so did
     `hiddenListings`, `notifPrefs`, `readNotifs` and `pendingVerify`.
     So it calls the SAME function rather than a copy of it, and the order
     below is binding: `receipts` is in the keep-list, so the reset does
     not touch them and the identity is stripped AFTER it. Reversed, the
     names would come back. */
  signOut();

  state.myListings = [];
  state.extraBusinesses = (state.extraBusinesses || []).filter(b => !b.claimed);

  /* The receipts stay, stripped of who paid.
     Deleting an account is an app-store requirement and the user's right,
     so the answer is not to refuse it — it is to separate the person from
     the transaction. Wiping the financial record means that somebody who
     subscribed and then deleted their account leaves NO TRACE THAT MONEY
     WAS TAKEN: not for the accountant, not for the bank if they dispute
     the charge, not for any audit. Every company that takes money does
     this, and the privacy page says so. */
  state.receipts = (state.receipts || []).map(r => Object.assign({}, r, {
    buyer: { name: '', email: '' }, anonymized: true,
  }));

  state.user = null;
  save();
}

/* Published contact details. The stores want a real address for
   complaints and takedown requests, visible in the app rather than
   behind a form. One constant, used by About and both legal pages. */
/** which maps app to open directions in — null means ask */
export function mapsApp() { return state.mapsApp || null; }
export function setMapsApp(app) { state.mapsApp = app || null; save(); }

export const SUPPORT_EMAIL = 'support@arabna.app';
/* EMPTY UNTIL THERE IS A REAL ONE, and that is deliberate.
   It read `(713) 555-0199`. 555 is the reserved fictional exchange, so
   every page that carried it published a `tel:` link that rings nowhere —
   to somebody reporting harassment or asking for their listing to be taken
   down. `lookupLineType()` does not catch it either: that function reads
   the AREA code and 713 is a real one, which is why the app's own rule
   against invented numbers never fired here.
   An email is published on all the same pages and satisfies what the app
   stores ask for. Put a working number in this one line and it reappears
   everywhere by itself; leave it empty and no dead link is printed. */
export const SUPPORT_PHONE = '';

export function personKey(x) {
  if (!x) return '';
  if (typeof x === 'string') return x;
  if (x.userKey) return x.userKey;
  if (x.owner && x.owner !== 'me') return 'u:' + x.owner;
  if (x.user) return 'u:' + x.user;
  if (x.listingId) return 'seller:' + x.listingId;
  if (x.id) return 'seller:' + x.id;
  return '';
}

export function blockedList() { return (state.blocked || []).slice(); }
export function isBlocked(keyOrObj) {
  const key = personKey(keyOrObj);
  return !!key && (state.blocked || []).some(b => b.key === key);
}
export function blockUser(keyOrObj, label) {
  const key = personKey(keyOrObj);
  if (!key || isBlocked(key)) return false;
  state.blocked = (state.blocked || []).concat([{ key, label: label || key, when: now() }]);
  save();
  return true;
}
export function unblockUser(key) {
  state.blocked = (state.blocked || []).filter(b => b.key !== key);
  save();
}

/* ---- events a person asked to be reminded about ---- */
export function isEventSaved(id) { return (state.savedEvents || []).includes(id); }
export function toggleSavedEvent(id) {
  const list = state.savedEvents || [];
  state.savedEvents = list.includes(id) ? list.filter(x => x !== id) : list.concat([id]);
  save();
  return isEventSaved(id);
}
export function savedEvents() {
  return allEvents().filter(e => isEventSaved(e.id));
}

/**
 * Everything that is due to be said today. Notifications in this app were
 * seed data until now: `pushNotif` existed and nothing called it. These
 * are the time-based ones — the rest fire from the action itself.
 *
 * Each reminder writes a one-shot key, so re-opening the app does not send
 * it again.
 */
export function runReminders() {
  const t = now();
  const DAY = 86400000;
  state.reminded = state.reminded || {};
  const once = (key, fn) => {
    if (state.reminded[key]) return;
    state.reminded[key] = t;
    fn();
  };

  // an ad that finishes tomorrow, with a renew button waiting at the route
  (state.myAds || []).forEach(a => {
    if (!a.endsAt || a.status !== 'live') return;
    if (t >= a.endsAt - DAY && t < a.endsAt) {
      once('adEnd:' + a.id + ':' + a.endsAt,
           () => notifyKeys('adEndingTitle', 'adEndingBody', '#/my-ads', 'clock', a.bizName));
    }
  });

  // an event they asked to be reminded about, the day before
  savedEvents().forEach(e => {
    const at = Date.parse(e.startsAt);
    if (!at) return;
    if (t >= at - DAY && t < at) {
      once('ev:' + e.id + ':' + at,
           () => notifyKeys('evTomorrowTitle', 'evTomorrowBody', '#/events/' + e.id, 'calendar', L(e.title)));
    }
  });

  save();
}
/** the current language's side of a bilingual field, for a notification suffix */
function L(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v[state.lang] || v.ar || v.en || '';
}

/* ============================================================
   What a subscriber is actually getting
   ------------------------------------------------------------
   "340 people looked at your page this month" is the sentence that
   renews a subscription. The numbers are counted on this device for
   now and become central in V.02; the screens are built against the
   same shape either way.
   ============================================================ */
const monthKey = (t) => new Date(t).toISOString().slice(0, 7);

function bumpBiz(bizId, field) {
  if (!bizId) return;
  const all = state.bizStats[bizId] || { months: {} };
  const k = monthKey(now());
  all.months[k] = all.months[k] || { views: 0, calls: 0, directions: 0, saves: 0 };
  all.months[k][field]++;
  state.bizStats = Object.assign({}, state.bizStats, { [bizId]: all });
  save();
}
export function recordBizView(bizId) { bumpBiz(bizId, 'views'); }
export function recordBizCall(bizId) { bumpBiz(bizId, 'calls'); }
export function recordBizDirections(bizId) { bumpBiz(bizId, 'directions'); }
export function recordBizSave(bizId) { bumpBiz(bizId, 'saves'); }

/** this month and the one before it, so the page can say which way it is going */
export function bizStats(bizId) {
  const all = state.bizStats[bizId] || { months: {} };
  const t = now();
  const thisKey = monthKey(t);
  const prevDate = new Date(t); prevDate.setMonth(prevDate.getMonth() - 1);
  const prevKey = monthKey(prevDate.getTime());
  const zero = { views: 0, calls: 0, directions: 0, saves: 0 };
  const cur = Object.assign({}, zero, all.months[thisKey] || {});
  const prev = Object.assign({}, zero, all.months[prevKey] || {});
  const reviews = (state.reviews || []).filter(r => r.bizId === bizId
    && monthKey(r.when || t) === thisKey).length;
  const delta = (k) => prev[k] ? Math.round(((cur[k] - prev[k]) / prev[k]) * 100) : null;
  return { cur, prev, reviews, delta };
}

/* ---- what the advertiser is actually buying: eyes on the thing ---- */
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);

/** counted only once the placement has genuinely been on screen */
export function recordImpression(adId) {
  if (!adId) return;
  const st = state.adStats[adId] || { impressions: 0, clicks: 0, days: {} };
  const k = dayKey(now());
  st.impressions++;
  st.days[k] = st.days[k] || { i: 0, c: 0 };
  st.days[k].i++;
  state.adStats = Object.assign({}, state.adStats, { [adId]: st });
  save();
}
export function recordClick(adId) {
  if (!adId) return;
  const st = state.adStats[adId] || { impressions: 0, clicks: 0, days: {} };
  const k = dayKey(now());
  st.clicks++;
  st.days[k] = st.days[k] || { i: 0, c: 0 };
  st.days[k].c++;
  state.adStats = Object.assign({}, state.adStats, { [adId]: st });
  save();
}
export function adStats(adId) {
  const st = state.adStats[adId] || { impressions: 0, clicks: 0, days: {} };
  const ctr = st.impressions ? (st.clicks / st.impressions) * 100 : 0;
  return Object.assign({}, st, { ctr });
}
/** the last `n` days, oldest first — enough for a bar per day */
export function adStatsByDay(adId, n = 7) {
  const st = state.adStats[adId] || { days: {} };
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = dayKey(now() - k * 86400000);
    out.push(Object.assign({ date: d }, st.days[d] || { i: 0, c: 0 }));
  }
  return out;
}

/* ============================================================
   What the panel can honestly count
   ------------------------------------------------------------
   Every figure here is computed from the data itself, never from a stored
   counter that could drift. What has no source yet — anything that needs
   other people's devices to report in — is not given a zero and not given
   an invented number: the screen says so instead.
   ============================================================ */

/** the whole directory, marketplace, events, magazine and ad inventory */
export function adminCounts() {
  const biz = allBusinesses();
  const mkt = adminListings();
  const evs = allEvents();
  const arts = withoutDemo((state.extraArticles || []).concat(ARTICLES));
  const t = now();
  return {
    directory: {
      total: biz.length,
      verified: biz.filter(b => businessVerified(b)).length,
      paid: biz.filter(isPaid).length,
      noPhone: biz.filter(b => !b.phone).length,
      needsGeo: needsGeoList().length,
    },
    market: {
      live: mkt.filter(c => (c.status || 'live') === 'live').length,
      pending: mkt.filter(c => c.status === 'pending').length,
      hidden: mkt.filter(c => c.status === 'hidden').length,
      expired: mkt.filter(c => c.daysLeft === 0).length,
    },
    events: {
      upcoming: evs.filter(e => !eventIsPast(e) && e.status !== 'pending').length,
      pending: evs.filter(e => e.status === 'pending').length,
      past: evs.filter(e => eventIsPast(e)).length,
    },
    magazine: {
      total: arts.length,
      published: arts.filter(a => a.published !== false).length,
      drafts: arts.filter(a => a.published === false).length,
    },
    ads: AD_PRODUCTS.map(p => ({
      id: p.id,
      sold: (state.myAds || []).filter(a => a.product === p.id && a.status === 'live' && (!a.endsAt || a.endsAt > t)).length,
      left: adSlotsLeft(p.id),
      capacity: adCapacity(p.id),
      waiting: (state.adWaitlist || []).filter(w => w.product === p.id).length,
    })),
  };
}

/** the ten most-viewed businesses this month, from what this device saw */
export function topViewedBusinesses(n = 10) {
  const key = monthKey(now());
  return Object.entries(state.bizStats || {})
    .map(([id, st]) => ({ id, views: ((st.months || {})[key] || {}).views || 0 }))
    .filter(x => x.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, n)
    .map(x => ({ biz: businessById(x.id), views: x.views }))
    .filter(x => x.biz);
}

/**
 * What people search for. The NORMALIZED term is stored, not the raw one,
 * or «مطعم» and «مطاعم» become two rows saying the same thing.
 */
export function recordSearch(term) {
  const q = normalize(term || '').trim();
  if (q.length < 2) return;
  state.searchStats = state.searchStats || {};
  state.searchStats[q] = (state.searchStats[q] || 0) + 1;
  save();
}
export function topSearches(n = 10) {
  return Object.entries(state.searchStats || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([term, count]) => ({ term, count }));
}

/**
 * The categories with the least behind them — the most commercially useful
 * list on the screen. It says where there is not enough content to be worth
 * opening, which is exactly where a subscription needs selling.
 */
export function thinnestCategories(n = 5) {
  const biz = allBusinesses();
  return CATEGORIES.filter(c => !c.route)
    .map(c => ({ cat: c, count: biz.filter(b => b.cat === c.id).length }))
    .sort((a, b) => a.count - b.count)
    .slice(0, n);
}

/** every ad order's impressions per day, summed — the panel's own chart */
export function impressionsByDay(n = 30) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = dayKey(now() - k * 86400000);
    let i = 0, c = 0;
    Object.values(state.adStats || {}).forEach(st => {
      const day = (st.days || {})[d];
      if (day) { i += day.i || 0; c += day.c || 0; }
    });
    out.push({ date: d, i, c });
  }
  return out;
}

export function addArticle(a) {
  const rec = Object.assign({ id: 'ua' + Date.now(), read: 3, media: 'image', icon: 'newspaper', published: true }, a);
  state.extraArticles.unshift(rec);
  save();
  return rec;
}


/* ============================================================
   Yearly events
   ------------------------------------------------------------
   A festival repeats but its details do not: the hall changes, the
   price changes, the line-up changes. So the app never republishes
   last year's event — it tells the admin the date is coming round
   and offers a *draft* copy to bring up to date first.
   ============================================================ */

/** how many days ahead an admin is warned that a yearly event is due */
export const REPEAT_LEAD_DAYS = 60;

/** repeating events whose next edition is due and not yet drafted */
export function dueRepeats(now = Date.now()) {
  return allEvents()
    .filter(e => e.repeat && e.repeat.kind)
    .map(e => ({ ev: e, nextAt: nextOccurrence(e.startsAt, e.repeat.kind) }))
    .filter(({ ev, nextAt }) => {
      if (!nextAt) return false;
      const year = new Date(nextAt).getFullYear();
      if ((ev.repeat.spawned || []).includes(year)) return false;
      const days = (new Date(nextAt).getTime() - now) / 86400000;
      // only once this year's edition is behind us and the next is near
      return days > 0 && days <= REPEAT_LEAD_DAYS;
    });
}

/** copy a repeating event into next year as a DRAFT for the admin to update */
export function spawnRepeat(eventId) {
  const src = eventById(eventId);
  if (!src || !src.repeat) return null;
  const nextAt = nextOccurrence(src.startsAt, src.repeat.kind);
  if (!nextAt) return null;
  const year = new Date(nextAt).getFullYear();

  const copy = Object.assign({}, src, {
    id: 'ev' + Date.now() + '-' + year,
    // a draft, never live: the venue and the price have to be checked first
    status: 'pending',
    startsAt: nextAt,
    endsAt: src.endsAt ? nextOccurrence(src.endsAt, src.repeat.kind) : '',
    featured: false,
    repeat: { kind: src.repeat.kind, spawned: [] },
  });
  state.extraEvents = [copy].concat(state.extraEvents);

  // remember that this year has been handled, on the original
  const stamp = { spawned: ((src.repeat.spawned) || []).concat([year]), kind: src.repeat.kind };
  if (state.extraEvents.some(e => e.id === src.id)) {
    const own = state.extraEvents.find(e => e.id === src.id);
    own.repeat = stamp;
  } else {
    state.eventEdits = Object.assign({}, state.eventEdits, {
      [src.id]: Object.assign({}, state.eventEdits[src.id] || {}, { repeat: stamp }),
    });
  }
  save();
  return copy;
}

/* ============================================================
   Bulk import and backup
   ------------------------------------------------------------
   The constraint that shapes this: seed businesses live in
   js/data.js, i.e. in the deployed code, so every user sees them.
   Anything added from inside the app lands in the owner's own
   localStorage and nobody else ever sees it. Importing straight
   into state would therefore publish nothing at all.

   So the import is three steps: read and check the file, show
   exactly what is wrong with which row, then emit the text of a
   BUSINESSES array to paste into data.js and push. In V.02 the
   same screen writes to the database and step three disappears.
   ============================================================ */

/* name_en first because it is the required one; name_ar may be left blank */
export const CSV_COLUMNS = [
  'name_en', 'name_ar', 'category', 'phone', 'address',
  'desc_ar', 'desc_en', 'tags', 'attributes',
  'hours_sun', 'hours_mon', 'hours_tue', 'hours_wed', 'hours_thu', 'hours_fri', 'hours_sat',
  // both optional: `noncommercial` is 1 / yes / true for a public place,
  // `entry_price` is free text because "about $12" is the honest answer
  'noncommercial', 'entry_price',
];

/** A sample file with the right columns and one filled row. */
export function sampleCsv() {
  const rows = [
    // both names, a late Friday, several specialities
    ['Al Nakheel Restaurant', 'مطعم النخيل', 'restaurants', '(713) 555-0101',
     '123 Hillcroft Ave, Houston, TX 77081', 'مشاوي ومقبلات', 'Grills and mezze',
     'مشاوي;كباب;grill;kebab', 'cuisLebanese;dishGrill;halalMeat;noAlcohol;delivery',
     '11:00-23:00', '11:00-23:00', '11:00-23:00', '11:00-23:00', '11:00-23:00', '11:00-02:00', 'closed',
     '', ''],
    // English name only, which is how most shops here actually trade
    ["Abdallah's Bakery", '', 'sweets', '(713) 555-0102',
     '456 Westheimer Rd, Houston, TX 77042', '', 'Knafeh and Arabic sweets',
     'كنافة;بقلاوة;knafeh;baklava', 'swKnafeh;swBaklava;halalMeat',
     '09:00-21:00', '09:00-21:00', '09:00-21:00', '09:00-21:00', '09:00-21:00', '09:00-22:00', '09:00-22:00',
     '', ''],
    // a city park: free, nobody owns it, so `noncommercial` is set and the
    // claim / subscribe / upgrade invitations never appear on its page
    // no phone on purpose: a city park has no direct line, and the row must
    // still import — it publishes with directions and no call button
    ['Cedar Grove Park', 'حديقة السرو', 'outings', '',
     '2200 Braeswood Blvd, Houston, TX 77030', '', 'City park with BBQ pits and a playground',
     'حديقة;شواء;park;bbq', 'outPark;outFreeEntry;outOwnFood;outBbq;outShaded;outFreeParking;outOutdoor',
     '06:00-23:00', '06:00-23:00', '06:00-23:00', '06:00-23:00', '06:00-23:00', '06:00-23:00', '06:00-23:00',
     '1', ''],
    // a ticketed indoor place in the same category: a real business, so it is
    // left commercial and carries an entry price instead
    ['Sky High Trampoline', '', 'outings', '(281) 555-0616',
     '3300 Gessner Rd, Houston, TX 77063', '', 'Indoor trampoline park',
     'ترامبولين;trampoline', 'outTrampoline;outIndoor;outTicketed;outBirthdays;outIndoorPlay',
     '10:00-20:00', '10:00-20:00', '10:00-20:00', '10:00-20:00', '10:00-21:00', '10:00-22:00', '10:00-22:00',
     '', '$18 / hour'],
  ];
  return CSV_COLUMNS.join(',') + '\n'
       + rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
}
function csvCell(v) {
  const s2 = String(v == null ? '' : v);
  return /[",\n]/.test(s2) ? '"' + s2.replace(/"/g, '""') + '"' : s2;
}

/** a small RFC-4180 reader: quoted fields, doubled quotes, CRLF */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  const src = String(text || '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

/** 'closed' | '' | '24h' | '11:00-23:00' | '09:00-14:00|17:00-22:00' */
function parseHoursCell(v) {
  const raw = String(v || '').trim().toLowerCase();
  if (!raw || raw === 'closed' || raw === 'مغلق') return { ok: true, value: null };
  if (raw === '24h') return { ok: true, value: [['00:00', '24:00']] };
  const spans = [];
  for (const part of raw.split('|')) {
    const m = part.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) return { ok: false };
    spans.push([pad(m[1]), pad(m[2])]);
  }
  return { ok: true, value: spans };
}
const pad = (t) => { const [h, m] = t.split(':'); return String(h).padStart(2, '0') + ':' + m; };

/**
 * Read a CSV into rows tagged ok / error / duplicate.
 * Duplicates are checked against the directory *and* within the file itself,
 * because the same shop appears twice in a hand-made list more often than not.
 * @returns { header, rows: [{ line, raw, biz, errors, dupOf }], counts }
 */
export function parseBusinessCsv(text) {
  const table = parseCsv(text);
  if (!table.length) return { header: [], rows: [], counts: { ok: 0, bad: 0, dup: 0, warn: 0, noPhone: 0 }, fatal: 'empty' };

  const header = table[0].map(h => h.trim().toLowerCase());
  // Only two columns have to be there. The English name is the required one
  // — most Arab-owned shops in Houston trade under an English name, and it
  // is the name on the shopfront that people search for — and the category
  // decides where the listing lives. A phone or an address that is missing
  // is a fact about the place, not a fault in the file: nine city parks and
  // preserves here have no direct line at all.
  const missing = ['name_en', 'category'].filter(c => !header.includes(c));
  if (missing.length) return { header, rows: [], counts: { ok: 0, bad: 0, dup: 0, warn: 0, noPhone: 0 }, fatal: 'columns', missing };

  const col = (r, name) => {
    const i = header.indexOf(name);
    return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim();
  };
  const catIds = CATEGORIES.filter(c => !c.route).map(c => c.id);
  const attrIds = ATTRIBUTES.map(a => a.id);
  const seenPhones = {};
  const seenNameAddr = {};
  const rows = [];

  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    // Two lists, and the difference matters: an error stops the row, a warning
    // does not. Treating both as errors made a perfectly good file of 413 shops
    // look like a total failure.
    const errors = [];
    const warnings = [];
    const nameEn = col(raw, 'name_en');
    const nameAr = col(raw, 'name_ar') || nameEn;
    const cat = col(raw, 'category');
    const phone = col(raw, 'phone');
    const address = col(raw, 'address');

    if (!nameEn) errors.push({ field: 'name_en', code: 'required' });
    if (!col(raw, 'name_ar') && nameEn) warnings.push({ field: 'name_ar', code: 'noNameAr' });
    if (!cat) errors.push({ field: 'category', code: 'required' });
    else if (!catIds.includes(cat)) errors.push({ field: 'category', code: 'unknown', got: cat });
    // an unknown category is fatal on purpose: guessing where a shop belongs
    // would put it somewhere nobody looks. The preview prints the valid ids.
    // A missing phone is a warning: a park is useful without one — name,
    // address, map, hours, category and specialities are all still there,
    // and whoever wants a park wants its location, not its number. A phone
    // that is *present but unusable* is still an error: that is a typo.
    if (!phone) warnings.push({ field: 'phone', code: 'noPhone' });
    else if (phoneKey(phone).length !== 10) errors.push({ field: 'phone', code: 'badPhone', got: phone });
    if (!address) warnings.push({ field: 'address', code: 'noAddress' });

    const hours = [];
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach(d => {
      const parsed = parseHoursCell(col(raw, 'hours_' + d));
      if (!parsed.ok) errors.push({ field: 'hours_' + d, code: 'badHours', got: col(raw, 'hours_' + d) });
      hours.push(parsed.ok ? parsed.value : null);
    });

    // A public place is not a business: the column is optional, absent or
    // empty means an ordinary commercial listing.
    const ncRaw = col(raw, 'noncommercial').toLowerCase();
    const nonCommercial = ['1', 'yes', 'true', 'y', 'نعم'].includes(ncRaw);
    const entryPrice = col(raw, 'entry_price');

    if (hours.every(d => d === null)) warnings.push({ field: 'hours', code: 'noHours' });
    if (!col(raw, 'desc_ar') && !col(raw, 'desc_en')) warnings.push({ field: 'desc', code: 'noDesc' });

    const tags = col(raw, 'tags').split(/[;,\u060C]/).map(x => x.trim()).filter(Boolean);
    const rawAttrs = col(raw, 'attributes').split(/[;,\u060C]/).map(x => x.trim()).filter(Boolean);
    // An attribute this build has not defined yet is dropped with a note, not
    // treated as a fault: new ones keep arriving, and one unknown id must never
    // cost the whole file.
    const unknownAttrs = rawAttrs.filter(a => !attrIds.includes(a));
    const attributes = rawAttrs.filter(a => attrIds.includes(a));
    if (unknownAttrs.length) warnings.push({ field: 'attributes', code: 'unknownAttr', got: unknownAttrs.join(' · ') });

    /* Duplicates: the phone is the first key, but it is no longer always
       there. Without one, name + address decides — and the absence of a
       phone is never itself a match, or every listing without a number
       would duplicate every other one. */
    let dupOf = null;
    const key = phoneKey(phone);
    const naKey = (normalize(nameEn) + '|' + normalize(address).replace(/[.,]/g, '')).trim();
    let seenAt = null;
    if (key.length === 10) seenAt = seenPhones[key] || null;
    else if (nameEn && address) seenAt = seenNameAddr[naKey] || null;

    if (seenAt) dupOf = { kind: 'file', line: seenAt, confidence: 'certain' };
    else {
      if (key.length === 10) seenPhones[key] = i + 1;
      else if (nameEn && address) seenNameAddr[naKey] = i + 1;
      // the same check the add form runs, so one rule governs both doors.
      // A weak match is a note in the preview, not an exclusion: a file of
      // 412 shops must not lose rows to a name that merely rhymes.
      const hit = findDuplicates({ phone, name: nameEn, address, cat })[0];
      if (hit) dupOf = { kind: 'directory', name: hit.biz.name, id: hit.biz.id,
                         reason: hit.reason, confidence: hit.confidence };
    }

    // only a certain or likely match holds a row back by default
    const blocking = !!dupOf && dupOf.confidence !== 'weak';
    rows.push({
      line: i + 1, raw, errors, warnings, dupOf, include: !errors.length && !blocking,
      biz: {
        name: { ar: nameAr, en: nameEn }, cat, phone, address,
        desc: { ar: col(raw, 'desc_ar'), en: col(raw, 'desc_en') || col(raw, 'desc_ar') },
        hours, tags, attributes,
        nonCommercial, entryPrice,
      },
    });
  }

  return {
    header, rows,
    validCats: catIds,
    counts: {
      // "ok" means it will import — a weak look-alike is a note, not a stop
      ok: rows.filter(r => !r.errors.length && !(r.dupOf && r.dupOf.confidence !== 'weak')).length,
      bad: rows.filter(r => r.errors.length).length,
      dup: rows.filter(r => !r.errors.length && r.dupOf && r.dupOf.confidence !== 'weak').length,
      // a subset of `ok`: how many of the rows that will import carry a note.
      // Duplicates are counted under `dup` alone, never twice.
      warn: rows.filter(r => !r.errors.length && !(r.dupOf && r.dupOf.confidence !== 'weak')
        && (r.warnings.length || r.dupOf)).length,
      // …and how many of those will publish with no call button at all, which
      // is the one the operator actually wants to know before pressing go
      noPhone: rows.filter(r => !r.errors.length && !(r.dupOf && r.dupOf.confidence !== 'weak')
        && r.warnings.some(w => w.code === 'noPhone')).length,
    },
  };
}

/** the text of a BUSINESSES entry, ready to paste into js/data.js */
export function toDataFile(list, startIndex = 1) {
  const q = (v) => JSON.stringify(v == null ? '' : v);
  const hoursLine = (h) => '[' + h.map(d => d === null ? 'null'
    : '[' + d.map(sp => '[' + q(sp[0]) + ', ' + q(sp[1]) + ']').join(', ') + ']').join(', ') + ']';
  const body = list.map((b, i) => `  {
    id: ${q('b' + (startIndex + i))}, name: { ar: ${q(b.name.ar)}, en: ${q(b.name.en)} }, cat: ${q(b.cat)},
    phone: ${q(b.phone)}, address: ${q(b.address)},
    hours: ${hoursLine(b.hours)},
    tags: [${(b.tags || []).map(q).join(', ')}],
    attributes: [${(b.attributes || []).map(q).join(', ')}],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, needsGeo: true, claimed: false,${b.nonCommercial ? '\n    nonCommercial: true,' : ''}${b.entryPrice ? '\n    entryPrice: ' + q(b.entryPrice) + ',' : ''}
    desc: { ar: ${q(b.desc.ar)}, en: ${q(b.desc.en)} },
    photos: 0, videos: 0,
  },`).join('\n');
  return `/* Generated by the ARABNA admin importer — paste inside BUSINESSES in js/data.js.\n`
       + `   ${list.length} record(s). Check the ids do not collide with the ones already there. */\n`
       + body + '\n';
}

/**
 * Everything the owner has entered, as one JSON file. After 300 shops go in
 * by hand this is a company asset, and one mistake could erase weeks.
 */
/**
 * The reader's OWN copy of their data — the privacy page promises it in so
 * many words, and there was no button anywhere in the app for it.
 *
 * ⚠️ AND IT IS NOT `exportBackup()`. That one dumps the whole state, and
 * the whole state carries the ADMIN PANEL'S PASSWORD HASH AND SALT and its
 * action log. An operator's backup and a person's copy of their own data
 * are two different documents, and handing out the first as the second
 * publishes a credential.
 * ⚠️ So this names what it INCLUDES, never what it excludes: a key added
 * to the state tomorrow is left out by default, which is the safe
 * direction — the same shape as `KEEPS_ON_SIGN_OUT`, for the same reason.
 */
export function exportMyData() {
  const u = state.user || {};
  /* the password's own trace never leaves, in either form */
  const { pwHash, pwSalt, ...person } = u;
  return JSON.stringify({
    app: 'ARABNA', exportedAt: new Date().toISOString(),
    profile: person,
    listings: (state.extraClassifieds || []).filter(c => (state.myListings || []).includes(c.id)),
    reviews: state.reviews || [],
    saved: state.saved || [],
    savedEvents: state.savedEvents || [],
    messages: state.messages || [],
    receipts: state.receipts || [],
    subscription: state.subscription || null,
    ads: state.myAds || [],
    requests: state.claims || [],
    businesses: state.myBusinessIds || [],
    blocked: state.blocked || [],
    notifications: state.extraNotifs || [],
  }, null, 2);
}

export function exportBackup() {
  return JSON.stringify({
    app: 'ARABNA', version: 'V.02.1', exportedAt: new Date().toISOString(),
    seedCounts: { businesses: BUSINESSES.length, events: EVENTS.length },
    state,
  }, null, 2);
}
