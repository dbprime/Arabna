/* ============================================================
   App state + persistence + auth/entitlement rules
   (V.02: swap the auth/payment functions for Supabase + Stripe;
    the rest of the app only ever calls these functions.)
   ============================================================ */

import { CLASSIFIEDS, BUSINESSES, NOTIFICATIONS, SLIDER_ADS } from './data.js';

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
};

export const state = Object.assign({}, DEFAULTS, load() || {});

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

export function resetAll() {
  Object.assign(state, JSON.parse(JSON.stringify(DEFAULTS)));
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

/* ---------------- data accessors ---------------- */
export function allBusinesses() { return state.extraBusinesses.concat(BUSINESSES); }
export function businessById(id) { return allBusinesses().find(b => b.id === id); }

export function allClassifieds() {
  const list = state.extraClassifieds.concat(CLASSIFIEDS);
  return list.map(c => Object.assign({}, c, { boosted: state.boosted.includes(c.id) }));
}
export function classifiedById(id) { return allClassifieds().find(c => c.id === id); }

export function myActiveListings() {
  return allClassifieds().filter(c => state.myListings.includes(c.id));
}
export const MAX_ACTIVE_LISTINGS = 5;

export function notifications() {
  return NOTIFICATIONS.map(n => Object.assign({}, n, { unread: n.unread && !state.readNotifs.includes(n.id) }));
}
export function unreadCount() { return notifications().filter(n => n.unread).length; }
export function markNotifsRead() {
  NOTIFICATIONS.forEach(n => { if (!state.readNotifs.includes(n.id)) state.readNotifs.push(n.id); });
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
  const rec = Object.assign({ id, daysLeft: 30, boosted: false, when: { ar: 'الآن', en: 'now' } }, item);
  state.extraClassifieds.unshift(rec);
  state.myListings.push(id);
  save();
  return rec;
}
export function deleteClassified(id) {
  state.extraClassifieds = state.extraClassifieds.filter(c => c.id !== id);
  state.myListings = state.myListings.filter(x => x !== id);
  save();
}
export function renewClassified(id) {
  const c = state.extraClassifieds.find(x => x.id === id);
  if (c) c.daysLeft = 30;
  save();
}
export function boostClassified(id) {
  if (!state.boosted.includes(id)) state.boosted.push(id);
  save();
}
export function reportItem(id) {
  if (!state.reported.includes(id)) state.reported.push(id);
  save();
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
