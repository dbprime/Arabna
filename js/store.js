/* ============================================================
   App state + persistence + auth/entitlement rules
   (V.02: swap the auth/payment functions for Supabase + Stripe;
    the rest of the app only ever calls these functions.)
   ============================================================ */

import { CLASSIFIEDS, BUSINESSES, NOTIFICATIONS, SLIDER_ADS, REVIEWS,
         MARKET_CATS, FREE_PRICE, EVENTS, VERIFY_BADGE_PRICE, blankEvent,
         ATTRIBUTES, ATTR_GROUPS, CATEGORIES, DAY_KEYS, CHIP_MIN, EVENT_TYPES,
         attrById, attrInCat, isAllDay, week, nextOccurrence } from './data.js';

export { ATTRIBUTES, ATTR_GROUPS, DAY_KEYS, CHIP_MIN, EVENT_TYPES,
         attrById, attrInCat, isAllDay, week, nextOccurrence };

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
  bizPhotos: {},             // { bizId: [{ url, status, when }] } — reviewed like avatars
  bizVerify: {},             // { bizId: { status, ref, reason } } — never derived from plan
  claims: [],                // ownership requests awaiting an admin decision
  reviewReplies: {},         // { reviewId: { text, when } } — the owner's answer
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

/** chips above the results: only once CHIP_MIN businesses share the attribute */
export function quickAttrsForCat(cat) {
  const counts = attrCounts(cat);
  return attrsForCat(cat)
    .filter(a => (counts[a.id] || 0) >= CHIP_MIN)
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
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
  if (state.subscription && state.subscription.businessId === b.id) return 'paid';
  return b.plan;
}
export const PLAN_LIMITS = {
  free: { photos: 3, videos: 0 },
  paid: { photos: Infinity, videos: 3 },
};
export function planLimits(b) { return PLAN_LIMITS[businessPlan(b)] || PLAN_LIMITS.free; }

/** Reviews are free for everyone, on every listing. */
export function canSeeReviews() { return true; }

/** Paying does not verify anybody — see businessVerified(). */
export function isPaid(b) { return businessPlan(b) === 'paid'; }

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
export function rejectBizPhoto(bizId, url) {
  const list = bizPhotos(bizId).filter(p => p.url !== url);
  state.bizPhotos = Object.assign({}, state.bizPhotos, { [bizId]: list });
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
export function ownsBusiness(bizId) {
  return !!bizId && state.myBusinessId === bizId;
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
  const c = (state.claims || []).find(x => x.id === id);
  if (!c) return;
  c.status = 'approved'; c.decided = Date.now();
  state.myBusinessId = c.bizId;                 // ownership lands only here
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
export function applyBusinessEdit(bizId, patch) {
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
export function isNonCommercial(b) { return !!(b && b.nonCommercial); }
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
  return (halal.length ? halal : pool)
    .sort((x, y) => Math.abs(x.dist - b.dist) - Math.abs(y.dist - b.dist))
    .slice(0, n);
}

export function similarTo(b, n = 4) {
  return allBusinesses()
    .filter(x => x.id !== b.id && x.cat === b.cat)
    .sort((x, y) => Math.abs(x.dist - b.dist) - Math.abs(y.dist - b.dist))
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
       + (pendingAvatar() ? 1 : 0) + (pendingBadge() ? 1 : 0)
       + pendingClaims().length + pendingBizPhotos().length + pendingBizVerify().length;
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
/** Kept as the single entry point, but it now raises a request rather than
    handing the page over: ownership is an admin decision. */
export function claimBusiness(id, details) { return requestClaim(id, details); }

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
    ['Cedar Grove Park', 'حديقة السرو', 'outings', '(713) 555-0605',
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
  if (!table.length) return { header: [], rows: [], counts: { ok: 0, bad: 0, dup: 0, warn: 0 }, fatal: 'empty' };

  const header = table[0].map(h => h.trim().toLowerCase());
  // The English name is the required one. Most Arab-owned shops in Houston
  // trade under an English name — Abdallah's, Fadi's, Dimassi's — and it is
  // the name on the shopfront that people search for. Inventing an Arabic
  // one for them would be worse than having none.
  const missing = ['name_en', 'category', 'phone', 'address'].filter(c => !header.includes(c));
  if (missing.length) return { header, rows: [], counts: { ok: 0, bad: 0, dup: 0, warn: 0 }, fatal: 'columns', missing };

  const col = (r, name) => {
    const i = header.indexOf(name);
    return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim();
  };
  const catIds = CATEGORIES.filter(c => !c.route).map(c => c.id);
  const attrIds = ATTRIBUTES.map(a => a.id);
  const seenPhones = {};
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
    if (!phone) errors.push({ field: 'phone', code: 'required' });
    else if (phoneKey(phone).length !== 10) errors.push({ field: 'phone', code: 'badPhone', got: phone });
    if (!address) errors.push({ field: 'address', code: 'required' });

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

    // duplicates: inside the file first, then against what is already listed
    let dupOf = null;
    const key = phoneKey(phone);
    if (key.length === 10) {
      if (seenPhones[key]) dupOf = { kind: 'file', line: seenPhones[key] };
      else {
        seenPhones[key] = i + 1;
        const hit = findDuplicates({ phone, name: nameEn, address })[0];
        if (hit) dupOf = { kind: 'directory', name: hit.biz.name, id: hit.biz.id, reason: hit.reason };
      }
    }

    rows.push({
      line: i + 1, raw, errors, warnings, dupOf, include: !errors.length && !dupOf,
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
      ok: rows.filter(r => !r.errors.length && !r.dupOf).length,
      bad: rows.filter(r => r.errors.length).length,
      dup: rows.filter(r => !r.errors.length && r.dupOf).length,
      // a subset of `ok`: how many of the rows that will import carry a note.
      // Duplicates are counted under `dup` alone, never twice.
      warn: rows.filter(r => !r.errors.length && !r.dupOf && r.warnings.length).length,
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
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 0, claimed: false,${b.nonCommercial ? '\n    nonCommercial: true,' : ''}${b.entryPrice ? '\n    entryPrice: ' + q(b.entryPrice) + ',' : ''}
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
export function exportBackup() {
  return JSON.stringify({
    app: 'ARABNA', version: 'V.02.1', exportedAt: new Date().toISOString(),
    seedCounts: { businesses: BUSINESSES.length, events: EVENTS.length },
    state,
  }, null, 2);
}
