/* ============================================================
   App state + persistence + auth/entitlement rules
   (V.02: swap the auth/payment functions for Supabase + Stripe;
    the rest of the app only ever calls these functions.)
   ============================================================ */

import { CLASSIFIEDS, BUSINESSES, NOTIFICATIONS, SLIDER_ADS, REVIEWS,
         MARKET_CATS, FREE_PRICE, EVENTS, VERIFY_BADGE_PRICE, blankEvent,
         ATTRIBUTES, ATTR_GROUPS, CATEGORIES, DAY_KEYS, attrById, attrInCat, attrIsQuick,
         isAllDay, week } from './data.js';

export { ATTRIBUTES, ATTR_GROUPS, DAY_KEYS, attrById, attrInCat, attrIsQuick, isAllDay, week };

export { blankEvent };

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
  location: { zip: '77036', city: 'Houston', state: 'TX' },
  radius: 5,
  user: null,               // { name, email, emailVerified, phone, phoneVerified }
  saved: [],                // ids of saved businesses / classifieds
  myListings: ['c1'],       // classifieds owned by the current user
  myBusinessId: null,       // claimed / added business id
  subscription: null,       // { businessId, since }
  myAds: [],                // purchased ad placements (pending review / live)
  notifPrefs: { messages: true, expiry: true, adLive: true, reviews: true },
  readNotifs: [],
  extraClassifieds: [],     // user-created listings
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
  mergedBusinesses: [],      // { keepId, dropId, when } — duplicates folded together
  seasons: { ramadan: false },   // seasonal attribute groups the owner has switched on
};

export const state = Object.assign({}, DEFAULTS, load() || {});

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
   V.02: replace with a real staff account in Supabase (row-level security +
   an `is_admin` claim). These constants exist only so the prototype panel is
   reachable at #/admin without shipping an open back office. */
export const ADMIN_USER = 'arabna.admin';
export const ADMIN_PASS = 'Arabna@2026!';

/** Current staff credentials — the shipped defaults until the owner changes them. */
export function adminCreds() {
  return state.adminAuth || { user: ADMIN_USER, pass: ADMIN_PASS };
}
/**
 * Username is compared case-insensitively and trimmed: iOS auto-capitalises
 * the first letter of a text field, which used to lock the owner out on an
 * iPhone. The password stays exactly as typed.
 */
export function checkAdmin(user, pass) {
  const c = adminCreds();
  return String(user || '').trim().toLowerCase() === c.user.toLowerCase() && pass === c.pass;
}
export function setAdminPass(newPass) {
  const c = adminCreds();
  state.adminAuth = { user: c.user, pass: newPass };
  save();
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
export function setSeason(season, on) {
  state.seasons = Object.assign({}, state.seasons, { [season]: !!on });
  save();
}

/** every attribute that applies to `cat` and is in season */
export function attrsForCat(cat) {
  return ATTRIBUTES.filter(a => attrInCat(a, cat) && seasonOn(a.season));
}
/** …grouped, in registry order, for the add form and the filter sheet */
export function attrGroupsForCat(cat) {
  const list = attrsForCat(cat);
  return ATTR_GROUPS
    .filter(g => seasonOn(g.season))
    .map(g => ({ group: g, attrs: list.filter(a => a.group === g.id) }))
    .filter(g => g.attrs.length);
}
/** the ones that earn a chip above the results */
export function quickAttrsForCat(cat) {
  return ATTRIBUTES.filter(a => attrIsQuick(a, cat) && seasonOn(a.season));
}
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
    .replace(/\u0629/g, '\u0647')
    .trim();
}

/** everything a business can be found by, both languages at once */
export function searchHaystack(biz) {
  const cat = CATEGORIES.find(c => c.id === biz.cat);
  const parts = [
    biz.name && biz.name.ar, biz.name && biz.name.en,
    biz.desc && biz.desc.ar, biz.desc && biz.desc.en,
    biz.address,
    ...(Array.isArray(biz.tags) ? biz.tags : []),
  ];
  if (cat) parts.push(catNames(cat.key));
  return normalize(parts.filter(Boolean).join(' '));
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
export function registerStrings(packs) { _packs = packs; }

export function matchesSearch(biz, term) {
  const q = normalize(term);
  if (!q) return true;
  const hay = searchHaystack(biz);
  // every word must appear somewhere — "مطعم حلال" should narrow, not widen
  return q.split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

/* ============================================================
   Duplicate businesses
   ------------------------------------------------------------
   300 shops are going in by hand, and then their owners will add
   themselves because they did not find their own listing. The phone
   number is the one field two records for the same shop almost
   always agree on, so it is the primary key for this check.
   ============================================================ */

/** last ten digits, Arabic-Indic numerals included */
export function phoneKey(phone) {
  const latin = String(phone || '').replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660));
  const digits = latin.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Existing records that look like the one being added.
 * @returns [{ biz, reason: 'phone'|'name' }]
 */
export function findDuplicates({ phone, name, address, id } = {}) {
  const key = phoneKey(phone);
  const nName = normalize(typeof name === 'string' ? name : (name && (name.ar || name.en)) || '');
  const nAddr = normalize(address).replace(/[.,]/g, '');
  const out = [];
  for (const b of allBusinesses()) {
    if (id && b.id === id) continue;
    if (key && key.length === 10 && phoneKey(b.phone) === key) { out.push({ biz: b, reason: 'phone' }); continue; }
    if (!nName) continue;
    const sameName = normalize(b.name.ar) === nName || normalize(b.name.en) === nName;
    const sameAddr = nAddr && normalize(b.address).replace(/[.,]/g, '') === nAddr;
    if (sameName && sameAddr) out.push({ biz: b, reason: 'name' });
  }
  return out;
}

/**
 * Fold `dropId` into `keepId`: reviews, saved flags, ownership and any
 * photos follow, then the duplicate is removed. Seed records cannot be
 * deleted from the file, so they are tombstoned instead.
 */
export function mergeBusinesses(keepId, dropId) {
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
  if (state.myBusinessId === dropId) state.myBusinessId = keepId;
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
export function allBusinesses() {
  const dropped = (state.mergedBusinesses || []).map(m => m.dropId);
  return state.extraBusinesses.concat(BUSINESSES)
    .filter(b => !dropped.includes(b.id))
    .map(b => {
      const edit = state.businessEdits && state.businessEdits[b.id];
      return edit ? Object.assign({}, b, edit) : b;
    });
}
export function businessById(id) { return allBusinesses().find(b => b.id === id); }

/**
 * Every listing the current viewer is allowed to see: everything published,
 * plus their own listings still waiting on the admin. A pending listing is
 * never visible to anyone else.
 */
export function allClassifieds() {
  const list = state.extraClassifieds.concat(CLASSIFIEDS);
  return list
    .filter(c => c.status !== 'rejected')
    .filter(c => c.status !== 'pending' || state.myListings.includes(c.id))
    .map(c => Object.assign({ status: 'live', photos: [] }, c, { boosted: state.boosted.includes(c.id) }));
}
export function classifiedById(id) { return allClassifieds().find(c => c.id === id); }

export function myActiveListings() {
  return allClassifieds().filter(c => state.myListings.includes(c.id));
}
export const MAX_ACTIVE_LISTINGS = 5;
export const MAX_PHOTOS = 5;

/* ---- per-section rules (Handyman = 1 listing / 14 days, Free = no price) ---- */
export function catRule(catId) {
  const c = MARKET_CATS.find(x => x.id === catId) || {};
  return {
    maxActive: c.maxActive || MAX_ACTIVE_LISTINGS,
    days: c.days || 30,
    freeOnly: !!c.freeOnly,
    upsell: !!c.upsell,
  };
}
/** how many of my active listings already sit in this section */
export function myActiveInCat(catId) {
  return myActiveListings().filter(c => c.cat === catId).length;
}
export { FREE_PRICE };

export function notifications() {
  return state.extraNotifs.concat(NOTIFICATIONS)
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

export function sliderAds() {
  const live = state.myAds.filter(a => a.product === 'slider' && a.status === 'live')
    .map(a => ({ id: a.id, kind: 'paid', name: { ar: a.bizName, en: a.bizName }, tag: { ar: a.tagline, en: a.tagline },
                 cta: { ar: a.ctaText, en: a.ctaText }, color: 'linear-gradient(135deg,#2F5D50,#14312B)', icon: 'megaphone', link: '#/home' }));
  return live.concat(SLIDER_ADS);
}

/* ---------------- entitlements ---------------- */
export function businessPlan(b) {
  if (state.subscription && state.subscription.businessId === b.id) return 'paid';
  return b.plan;
}
export function canSeeReviews(b) { return businessPlan(b) === 'paid'; }

/* ---------------- simulated backend calls ----------------
   Each of these is the exact seam where a real API goes in V.02. */

export const DEMO_CODE = '123456';

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

export function chargeCard(amount, description) {
  return new Promise(res => setTimeout(() => res({ ok: true, id: 'pay_' + Date.now(), amount, description }), 1400));
}

/* ---------------- mutations ---------------- */
export function signUp({ name, email, password }) {
  state.user = {
    name, email, password: password || '',
    emailVerified: false, phone: null, phoneVerified: false,
    joined: Date.now(),
    avatar: null,          // { url, status: 'pending' | 'live' }
    badge: null,           // { status: 'pending' | 'live', since }
  };
  save();
}
export function confirmEmail() {
  if (state.user) { state.user.emailVerified = true; save(); }
}
export function confirmPhone(phone) {
  if (state.user) { state.user.phone = phone; state.user.phoneVerified = true; save(); }
}
export function signOut() { state.user = null; save(); }

/** Editing the profile. Changing the phone number is the only thing that
    costs a re-verification — everything else keeps the verified state. */
export function updateProfile({ name, email, phone }) {
  const u = state.user;
  if (!u) return null;
  if (name) u.name = name;
  if (email) u.email = email;
  if (phone !== undefined && phone !== u.phone) {
    u.phone = phone;
    u.phoneVerified = false;
  }
  save();
  return u;
}

export function changePassword(current, next) {
  const u = state.user;
  if (!u) return { ok: false, reason: 'no-user' };
  // A password set before this field existed is accepted once, so nobody
  // gets locked out of their own prototype account.
  if (u.password && current !== u.password) return { ok: false, reason: 'wrong' };
  u.password = next;
  save();
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
export function rejectAvatar() {
  if (state.user) { state.user.avatar = null; save(); }
  pushNotif({ icon: 'alert', route: '#/profile',
    title: { ar: 'صورتك لم تُعتمد', en: 'Your photo was not approved' },
    body: { ar: 'الصورة خالفت شروط المحتوى وتم حذفها. تقدر ترفع صورة ثانية.',
            en: 'The photo broke the content rules and was removed. You can upload another.' } });
}
/** the avatar actually shown to other people */
export function visibleAvatar() {
  const a = state.user && state.user.avatar;
  return a && a.status === 'live' ? a.url : null;
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
export function boostClassified(id) {
  if (!state.boosted.includes(id)) state.boosted.push(id);
  save();
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
  return mine.concat(REVIEWS[bizId] || []);
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
    .concat(EVENTS.filter(e => !state.hiddenEvents.includes(e.id)))
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
export function addEvent(ev, status = 'pending') {
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
export function updateEvent(id, patch) {
  const own = state.extraEvents.find(e => e.id === id);
  if (own) Object.assign(own, patch);
  else state.eventEdits[id] = Object.assign({}, state.eventEdits[id], patch);
  save();
  return eventById(id);
}
export function deleteEvent(id) {
  const before = state.extraEvents.length;
  state.extraEvents = state.extraEvents.filter(e => e.id !== id);
  if (state.extraEvents.length === before && !state.hiddenEvents.includes(id)) {
    state.hiddenEvents.push(id);          // seed event → hide instead of mutating data.js
  }
  delete state.eventEdits[id];
  save();
}
export function approveEvent(id) {
  updateEvent(id, { status: 'live' });
  pushNotif({ icon: 'calendar', route: '#/events/' + id,
    title: { ar: 'تم اعتماد فعاليتك', en: 'Your event was approved' },
    body: { ar: 'فعاليتك صارت ظاهرة في قسم الفعاليات.', en: 'Your event is now listed in Events.' } });
}
export function rejectEvent(id, reason) {
  const why = String(reason || '').trim();
  pushNotif({ icon: 'alert', route: '#/events',
    title: { ar: 'فعاليتك لم تُعتمد', en: 'Your event was not approved' },
    body: why ? { ar: `سبب الرفض: ${why}`, en: `Reason: ${why}` }
              : { ar: 'ما قدرنا نعتمد الفعالية. راجع التفاصيل وأعد الإرسال.',
                  en: 'We could not approve the event. Check the details and submit again.' } });
  deleteEvent(id);
}
/** Featured = the paid "pin to the top" placement. */
export function featureEvent(id, on = true) { updateEvent(id, { featured: !!on }); }

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
       + (pendingAvatar() ? 1 : 0) + (pendingBadge() ? 1 : 0);
}

/* ====================== IN-APP MESSAGES ====================== */

export function messagesFor(listingId) {
  return state.messages.filter(m => m.listingId === listingId);
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
export function addBusiness(biz) {
  // a counter as well as the clock: two records added inside the same
  // millisecond must not share an id
  const id = 'ub' + Date.now() + '-' + (++bizSeq);
  const rec = Object.assign({ id, plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 0.5, claimed: true, photos: 0, videos: 0 }, biz);
  state.extraBusinesses.unshift(rec);
  state.myBusinessId = id;
  save();
  return rec;
}
export function claimBusiness(id) { state.myBusinessId = id; save(); }

export function subscribeBusiness(businessId) {
  state.subscription = { businessId, since: Date.now() };
  save();
}
export function cancelSubscription() { state.subscription = null; save(); }

export function addAdOrder(order) {
  const rec = Object.assign({ id: 'ad' + Date.now(), status: 'pending', created: Date.now() }, order);
  state.myAds.unshift(rec);
  save();
  return rec;
}
export function approveAd(id) {
  const a = state.myAds.find(x => x.id === id);
  if (a) a.status = 'live';
  save();
}

export function addArticle(a) {
  const rec = Object.assign({ id: 'ua' + Date.now(), read: 3, media: 'image', icon: 'newspaper', published: true }, a);
  state.extraArticles.unshift(rec);
  save();
  return rec;
}
