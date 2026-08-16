/* ============================================================
   App state + persistence + auth/entitlement rules
   (V.02: swap the auth/payment functions for Supabase + Stripe;
    the rest of the app only ever calls these functions.)
   ============================================================ */

import { CLASSIFIEDS, BUSINESSES, NOTIFICATIONS, SLIDER_ADS, REVIEWS, MOD_QUEUE,
         MARKET_CATS, FREE_PRICE } from './data.js';

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
  resolvedMod: [],           // ids of seed moderation rows already actioned
  extraNotifs: [],           // notifications generated at runtime (approve / reject …)
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
export function checkAdmin(user, pass) { return user === ADMIN_USER && pass === ADMIN_PASS; }

/* ---------------- auth tiers ---------------- */
export function tier() {
  if (!state.user) return 0;
  if (state.user.phoneVerified) return 2;
  if (state.user.emailVerified) return 1;
  return 0;
}
export function isLoggedIn() { return tier() >= 1; }
export function isPhoneVerified() { return tier() >= 2; }

/* ---------------- pending intent (resume after signup) ---------------- */
let pendingIntent = null;
export function setPendingIntent(route, label) { pendingIntent = { route, label }; }
export function takePendingIntent() { const p = pendingIntent; pendingIntent = null; return p; }
export function peekPendingIntent() { return pendingIntent; }

/**
 * Gate an action behind a tier. Returns true if allowed.
 * If not allowed it stores the intent and sends the user to the right screen.
 */
export function requireTier(needed, route, go) {
  if (tier() >= needed) return true;
  setPendingIntent(route);
  if (tier() === 0) go('#/auth/signup');
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
export function allBusinesses() { return state.extraBusinesses.concat(BUSINESSES); }
export function businessById(id) { return allBusinesses().find(b => b.id === id); }

export function allClassifieds() {
  const list = state.extraClassifieds.concat(CLASSIFIEDS);
  return list
    .filter(c => c.status !== 'rejected')
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
export function signUp({ name, email }) {
  state.user = { name, email, emailVerified: false, phone: null, phoneVerified: false };
  save();
}
export function confirmEmail() {
  if (state.user) { state.user.emailVerified = true; save(); }
}
export function confirmPhone(phone) {
  if (state.user) { state.user.phone = phone; state.user.phoneVerified = true; save(); }
}
export function signOut() { state.user = null; save(); }

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
export function rejectClassified(id) {
  const c = state.extraClassifieds.find(x => x.id === id);
  if (!c) return;
  pushNotif({ icon: 'alert', route: '#/my-ads',
    title: { ar: 'إعلانك لم يُعتمد', en: 'Your listing was not approved' },
    body: { ar: 'إعلانك خالف شروط النشر وتم حذفه. تقدر تنشر إعلاناً جديداً مطابقاً للشروط.',
            en: 'Your listing broke the posting rules and was removed. You can post a new one that follows the rules.' } });
  deleteClassified(id);
}
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
/** seed rows the admin has already actioned stay out of the queue */
export function seedQueue() { return MOD_QUEUE.filter(q => !state.resolvedMod.includes(q.id)); }
export function resolveSeedMod(id) {
  if (!state.resolvedMod.includes(id)) state.resolvedMod.push(id);
  save();
}
/** listings still waiting on a human decision */
export function pendingListings() {
  return state.extraClassifieds.filter(c => c.status === 'pending');
}
export function pendingCount() {
  return pendingListings().length + state.flags.length + seedQueue().length;
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
  const clean = stripPhones(text, lang);
  const scan = scanMessage(text, listing);
  const msg = {
    id: 'm' + Date.now(), listingId, from: 'me', text: clean.text,
    offPlatform: OFF_PLATFORM.test(asciiDigits(String(text || ''))),
    when: { ar: 'الآن', en: 'just now' }, created: Date.now(),
  };
  state.messages.push(msg);
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

export function addBusiness(biz) {
  const id = 'ub' + Date.now();
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
