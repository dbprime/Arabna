/* ============================ HOME ============================ */
import { t, L, icon, $, $$, go, renderHeader, openSheet, closeSheet, toast, stars, wireRoutes,
         distLabelHtml, distText, cityChipLabel, mountAdRotator, esc,
         pickerBtn, setPickerValue, openDropdown, regionAllLabel, outsideBoxHtml, mountOutsideBox, catTileHtml,
         adShareBtn } from '../ui.js';
import { CATEGORIES, HOME_CATS, MINI_ADS, ARTICLES, ZIPS, CITY_SUGGESTIONS, AD_SLOTS,
         CITY_POINTS, SEARCH_HINTS, HINT_MS, HINT_FADE_MS } from '../data.js';
import * as S from '../store.js';
import { prayerBarHtml, mountPrayerBar, mountPrayerAsk,
         ramadanBarHtml, mountRamadanBar } from './prayer.js';
import { newcomerCardHtml } from './magazine.js';

let sliderStop = null;
let miniStop = null;

/** Home is a summary, not the list: six, and «عرض الكل» carries the rest. */
const HOME_OFFERS = 6;

/** the same one-liner three other screens keep locally */

/**
 * One offer, with the shop's name above it. The name is the half that
 * makes it worth tapping — «خصم 20%» on its own says nothing about who.
 */
export function offerTile({ offer, biz }) {
  const ends = endsLabel(offer);
  return `<button class="card offer-tile" data-route="#/directory/${biz.id}">
    <div class="offer-shop">${icon(catIcon(biz.cat), 15)}<b>${esc(L(biz.name))}</b></div>
    <div class="offer-text">${esc(offer.text)}</div>
    ${offer.price ? `<div class="offer-price ltr">${esc(offer.price)}</div>` : ''}
    <div class="offer-meta">${icon('clock', 15)}<span>${ends}</span></div>
  </button>`;
}

/**
 * «عرض الكل» behind the home strip. A plain list, soonest to run out at the
 * top, because an offer with two days left is the one worth acting on.
 */
export function OffersScreen(root) {
  renderHeader({ simple: true, title: t('offersTitle') });
  const live = S.allLiveOffers();
  root.innerHTML = !live.length
    ? `<div class="rev-empty" style="margin:40px 14px">
         <div class="rev-empty-ico">${icon('tag', 30)}</div>
         <b>${t('offersNone')}</b><span>${t('offersNoneSub')}</span></div>`
    : `<div class="pad mt-16">${live.map(x => `
        <div class="offer-card" data-route="#/directory/${x.biz.id}" style="cursor:pointer">
          <div class="offer-main">
            <div class="offer-shop">${icon(catIcon(x.biz.cat), 15)}<b>${esc(L(x.biz.name))}</b></div>
            <div class="offer-text">${esc(x.offer.text)}</div>
            ${x.offer.price ? `<div class="offer-price ltr">${esc(x.offer.price)}</div>` : ''}
            <div class="offer-meta">${icon('clock', 15)}<span>${endsLabel(x.offer)}</span></div>
          </div>
        </div>`).join('')}</div>`;
  wireRoutes(root);
}

/** «ينتهي اليوم» / «ينتهي غداً» / «ينتهي خلال N يوم» */
function endsLabel(offer) {
  const left = Math.ceil((offer.endsAt - S.now()) / 864e5);
  if (left <= 1) return t('offerEndsToday');
  if (left === 2) return t('offerEndsTomorrow');
  return `${t('offerEndsIn')} ${left - 1} ${t('offerDays')}`;
}

export function HomeScreen(root) {
  renderHeader({});

  const ads = S.sliderAds();
  const feat = S.allBusinesses().filter(b => S.businessPlan(b) === 'paid').slice(0, 6);
  const stories = S.withoutDemo(ARTICLES).slice(0, 3);
  const live = S.allLiveOffers();
  const offers = live.slice(0, HOME_OFFERS);
  const more = live.length > HOME_OFFERS;
  const loc = S.state.location;

  root.innerHTML = `
    <!-- The prayer bar. One line, and it is the whole hook: whoever opens
         the app to know when maghrib is has their answer before they have
         scrolled. It rides the existing minute ticker — there is one timer
         in this app and this does not add a second — and it never grows
         beyond a single line above the fold. -->
    ${prayerBarHtml()}

    <!-- Ramadan, and only during it: the same maghrib the engine already
         computed, wearing the name people use for it that month. -->
    ${ramadanBarHtml()}

    <!-- one row: what you want and where. They are the same question, and
         the second row was costing a whole band above the fold. The
         magnifier keeps its 22px in the stylesheet (flex 0 0 22px) — it was
         squeezed to ~13px the last time this row got crowded — and the
         chip ellipsises rather than wrapping or growing the row. -->
    <div class="search-row solo">
      <div class="search-bar big">
        ${icon('search', 22)}
        ${/* «ابحث عن» is fixed and only the word after it changes, so
             nothing in the line jumps, and the slot is as wide as the
             longest word so no width moves either. */''}
        <input id="homeSearch" placeholder="${t('searchFor')} ${hintWords()[0] || ''}" />
      </div>
      <button class="loc-chip ${loc.city ? '' : 'unset'}" id="locBtn">${icon('mapPin', 17)}<span>${cityChipLabel()}</span></button>
    </div>

    ${/* THE VISITOR ONLY. Somebody with an account has opened the app
         twenty times and knows what it is; a line explaining it to them
         every day steals the space they came for. `isMember()` already
         does exactly this in the drawer. */''}
    ${S.isMember() ? '' : `
      <div class="home-intro">
        <h1 class="home-headline">${S.userCity()
          ? esc(t('homeHeadline').replace('{c}', S.userCity()))
          : t('homeHeadlineNoCity')}</h1>
        <p class="home-subline">${t('homeSubline')}</p>
      </div>`}

    ${/* straight under the location chip, above the categories — the first
         thing a reader outside the covered areas needs to read, and
         nothing at all for everybody else */''}
    ${outsideBoxHtml()}

    ${/* ONE ROW OF SIX, and no heading over it. «التصنيفات» was a whole
         line naming what the pictures already say, and «عرض الكل» was a
         text button at the end of a row — so it became a square among its
         brothers instead. No sideways scroll: an option that runs off the
         edge is an option nobody has, and the end of that scroll is where
         gyms (1), realestate (6) and homeservices (3) would sit — the
         weakest sections, so burying them kills them. */''}
    <div class="section">
      <div class="cat-row" id="cats">
        ${HOME_CATS.map(id => CATEGORIES.find(c => c.id === id)).filter(Boolean).map(c => `
          <button class="cat-item" data-cat="${c.id}" ${c.route ? `data-dest="${c.route}"` : ''}>
            ${catTileHtml(c.id, 24)}
            <span class="cat-label">${t(c.shortKey || c.key)}</span>
          </button>`).join('')}
        ${/* the count is COMPUTED, never typed */''}
        <button class="cat-item" data-route="#/categories">
          <span class="cat-tile more">+${CATEGORIES.filter(c => !c.route).length - HOME_CATS.filter(id => CATEGORIES.some(c => c.id === id && !c.route)).length}</span>
          <span class="cat-label">${t('seeAll')}</span>
        </button>
      </div>
    </div>

    <!-- primary paid slider -->
    <div class="slider">
      <div class="slider-track" id="track">
        ${ads.map((a, i) => slideHtml(a, i)).join('')}
      </div>
      <div class="slider-dots" id="dots">${ads.map((_, i) => `<span class="dot-i ${i === 0 ? 'active' : ''}"></span>`).join('')}</div>
    </div>

    <!-- featured (directory subscribers) — hidden entirely when nobody
         has subscribed yet, rather than leaving a heading over a gap -->
    ${!feat.length ? '' : `<div class="section">
      <div class="section-head">
        <div class="section-title">${t('featured')}<small>${t('featuredSub')}</small></div>
        <button class="link-gold" data-route="#/directory">${t('seeAll')}</button>
      </div>
      <div class="hscroll">
        ${feat.map(b => `
          <div class="card feat-card" data-route="#/directory/${b.id}">
            <div class="feat-cover">${icon(catIcon(b.cat), 30)}
              ${b.verified ? `<span class="badge badge-verified" style="position:absolute;inset-block-start:8px;inset-inline-start:8px">${icon('check', 12)}${t('verified')}</span>` : ''}
            </div>
            <div class="feat-body">
              <div class="feat-name">${esc(L(b.name))}</div>
              <div class="feat-meta">${stars(b.rating)} <span>· ${b.reviewCount} ${t('reviews')}</span></div>
              ${distLabelHtml(b) ? `<div class="feat-meta">${distLabelHtml(b)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`}

    <!-- «عروض هذا الأسبوع» — content that changes every week is what
         brings somebody back, and it is the first thing the $29 buys that
         a shop owner can picture. Six at most; the rest are behind «عرض
         الكل». Nothing at all when nobody is running one, rather than a
         heading over a gap. -->
    ${!offers.length ? '' : `<div class="section">
      <div class="section-head">
        <div class="section-title">${t('offersTitle')}<small>${t('offersHomeSub')}</small></div>
        ${more ? `<button class="link-gold" data-route="#/offers">${t('seeAll')}</button>` : ''}
      </div>
      <div class="offer-strip">
        ${offers.map(x => offerTile(x)).join('')}
      </div>
    </div>`}

    <!-- cheaper mini ad — not rendered at all when there is nothing to
         put in it, so no empty box stands where a banner would be -->
    ${S.withoutDemo(MINI_ADS).length ? `<button class="mini-ad" id="miniAd"></button>
    <div class="mini-dots" id="miniDots"></div>` : ''}

    <!-- «وصلت هيوستن جديد؟» — a fixed card, never an article. A family
         that landed a month ago opens the app every day for weeks, and an
         article about them would be under three newer ones by then. -->
    <div class="pad">${newcomerCardHtml()}</div>

    <!-- magazine teaser -->
    ${!stories.length ? '' : `<div class="section">
      <div class="section-head">
        <div class="section-title">${t('topStories')}<small>${t('topStoriesSub')}</small></div>
        <button class="link-gold" data-route="#/magazine">${t('seeAll')}</button>
      </div>
      <div class="hscroll">
        ${stories.map(a => `
          <div class="card story-card" data-route="#/magazine/${a.id}">
            <div class="story-cover">${icon(a.icon, 31)}
              ${a.sponsored ? `<span class="badge badge-sponsored" style="position:absolute;inset-block-start:8px;inset-inline-start:8px">${t('sponsoredStory')}</span>` : ''}
            </div>
            <div class="feat-body">
              <span class="badge badge-cat">${t(catKeyOf(a.cat))}</span>
              <div class="feat-name mt-8" style="line-height:1.45">${esc(L(a.title))}</div>
              <div class="feat-meta">${icon('clock', 13)} ${a.read} ${t('readTime')}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`}

    <!-- house CTA -->
    <div class="upsell" data-route="#/advertise">
      <div class="tile-ico lg">${icon('megaphone', 24)}</div>
      <div class="upsell-txt"><b>${t('adCta')}</b><span>${t('adCtaSub')}</span></div>
      ${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 21)}
    </div>
    <div style="height:10px"></div>`;

  wireRoutes(root);
  startSlider(ads);
  startMiniAd();
  mountPrayerBar();
  mountPrayerAsk(root);
  mountRamadanBar(root);

  $('#homeSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') go('#/directory?q=' + encodeURIComponent(e.target.value));
  });
  mountSearchHint(root);
  $('#locBtn').addEventListener('click', openLocationSheet);
  mountOutsideBox(root);
  /* ⚠️ THE SIXTH TILE IS NOT A CATEGORY. «+16» carries `data-route` and no
     `data-cat`, so the category handler sent it to
     `#/directory?cat=undefined` — an empty directory reached by tapping
     the one tile that promises the whole list. It is skipped here and
     `wireRoutes` takes it, which is what its `data-route` is for. */
  $$('#cats .cat-item').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.route) return;
    go(b.dataset.dest || ('#/directory?cat=' + b.dataset.cat));
  }));
}

function slideHtml(a, i) {
  if (a.kind === 'house') {
    return `<div class="slide slide-house ${i === 0 ? 'active' : ''}" data-i="${i}" data-route="#/advertise">
      <div style="color:var(--gold);margin-bottom:6px">${icon('megaphone', 31)}</div>
      <div class="slide-title">${t('adCta')}</div>
      <div class="slide-sub" style="color:var(--text-2)">${t('adCtaSub')}</div>
      <div class="slide-cta cta-center">${icon('plus', 17)} ${t('continueAction')}</div>
    </div>`;
  }
  return `<div class="slide ${i === 0 ? 'active' : ''}" data-i="${i}" data-route="${a.link}" style="background:${a.color}">
    <span class="slide-badge">${t('sponsored')}</span>
    <div class="slide-title">${esc(L(a.name))}</div>
    <div class="slide-sub">${esc(L(a.tag))}</div>
    <div class="slide-cta">${esc(L(a.cta))} ${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</div>
    <div class="slide-icon">${icon(a.icon, 86)}</div>
    ${adShareBtn(L(a.name), a.link)}
  </div>`;
}


/* A word in the search box is a PROMISE, and a promise that opens on «no
   results» is worse than promising nothing — the same rule the filters
   follow. So the list is sieved against the real search at boot and
   anything returning zero never enters the rotation. */
let hintCache = null;
function hintWords() {
  if (hintCache) return hintCache;
  hintCache = SEARCH_HINTS.filter(w => {
    const r = S.searchBusinesses(S.allBusinesses(), w);
    return ((r && r.list) || r || []).length > 0;
  });
  return hintCache;
}

/* THE RULE IS NOT «no new timer» BUT «no timer running for no reason».
   (And the earlier claim that the app has one timer was wrong: there are
   four — the minute tick, the ad rotator, and the two resend counters in
   auth.js.) This one stops when the box is focused, when the page is
   hidden, and when Home is left; and a reader who asked for less motion
   gets one still word. */
/* Exported for the directory, which searches the same 514 businesses with
   the same words. NOT the marketplace: its sections are cars and furniture
   and jobs, and `SEARCH_HINTS` are trades. Rai's decision. */
export function mountSearchHint(root, sel = '#homeSearch') {
  const input = root.querySelector(sel);
  if (!input) return;
  const words = hintWords();
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (words.length < 2 || still) return;

  let i = 0, timer = null, stopped = false;
  input.style.setProperty('--hint-fade', HINT_FADE_MS + 'ms');
  const paint = () => {
    input.classList.add('hint-out');
    setTimeout(() => {
      i = (i + 1) % words.length;
      input.placeholder = `${t('searchFor')} ${words[i]}`;
      input.classList.remove('hint-out');
    }, HINT_FADE_MS);
  };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const start = () => {
    if (timer || stopped || document.hidden || document.activeElement === input) return;
    timer = setInterval(paint, HINT_MS + HINT_FADE_MS);
  };
  input.addEventListener('focus', stop);
  input.addEventListener('blur', start);
  const vis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', vis);
  /* …and it really stops when Home is left, rather than only in name */
  const off = () => {
    /* ⚠️ `sel`, never the literal: with '#homeSearch' hardcoded here the
       directory's own timer would keep running after the screen was left —
       and no timer runs without a reason. */
    if (root.isConnected && document.querySelector(sel) === input) return;
    stopped = true; stop();
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('hashchange', off);
  };
  window.addEventListener('hashchange', off);
  start();
}

export function startSlider(ads, hostSel = '.slider', trackSel = '#track', dotsSel = '#dots') {
  if (sliderStop) { sliderStop(); sliderStop = null; }
  const host = document.querySelector(hostSel);
  const track = document.querySelector(trackSel);
  if (!host || !track) return;

  const show = (a, idx) => {
    $$('.slide', track).forEach((sl, i) => sl.classList.toggle('active', i === idx));
    $$(dotsSel + ' .dot-i').forEach((d, i) => d.classList.toggle('active', i === idx));
  };
  let current = 0;
  sliderStop = mountAdRotator({
    host, items: ads, interval: 10000,
    paint: (a, idx) => { current = idx; show(a, idx); },
    onClick: (a) => { if (a && a.link) go(a.link); },
  });

  // manual swipe still works; the rotator keeps its own clock
  const swipe = (dx) => {
    if (Math.abs(dx) < 40) return;
    const next = (current + (dx > 0 ? -1 : 1) + ads.length) % ads.length;
    current = next; show(ads[next], next);
  };
  let x0 = null;
  track.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (x0 === null) return;
    swipe(e.changedTouches[0].clientX - x0);
    x0 = null;
  });
  let mx0 = null;
  track.addEventListener('mousedown', e => { mx0 = e.clientX; });
  track.addEventListener('mouseup', e => {
    if (mx0 === null) return;
    swipe(e.clientX - mx0);
    mx0 = null;
  });
}

/**
 * The mini banner. It always rotated, but with nothing to say so and at
 * 7 seconds — faster than the main slider above it, which is backwards.
 * The main one is above the fold and is looked at on opening; this one is
 * passed on the way down, and at 7s it could change its text under the
 * reader's eye. 16 seconds is read. The dots go BELOW the box: the box
 * stays 62px, and its smallness is what justifies its price.
 */
function startMiniAd() {
  if (miniStop) { miniStop(); miniStop = null; }
  const el = $('#miniAd');
  if (!el) return;
  const ads = S.withoutDemo(MINI_ADS).slice(0, AD_SLOTS.mini);
  if (!ads.length) return;
  const dots = $('#miniDots');
  if (dots) dots.innerHTML = ads.length > 1
    ? ads.map((_, i) => `<span class="dot-i ${i === 0 ? 'active' : ''}"></span>`).join('') : '';
  miniStop = mountAdRotator({
    host: el, items: ads, interval: 16000,
    paint: (a, i) => {
      el.innerHTML = `<span class="m-ico">${icon(a.icon, 19)}</span>
        <span class="m-body"><span class="m-name">${esc(L(a.name))}</span><br><span class="m-tag">${esc(L(a.tag))}</span></span>
        <span class="ad-label">${t('adLabel')}</span>${adShareBtn(L(a.name), a.link)}`;
      el.dataset.link = a.link;
      if (dots) [...dots.children].forEach((d, n) => d.classList.toggle('active', n === i));
    },
    onClick: (a) => go((a && a.link) || '#/directory'),
  });
}

/* ---------------------------------------------------------------
   ZIP lookup — works for ANY U.S. ZIP code.
   1. local table (instant, offline)
   2. Zippopotam.us public API (free, no key, covers all 41k+ ZIPs)
   returns: {city,state} found · null not found · undefined network error
   (V.02: swap for Google Geocoding or a Postgres zip table in Supabase)
---------------------------------------------------------------- */
const zipCache = {};

export async function lookupZip(zip) {
  if (ZIPS[zip]) return ZIPS[zip];
  if (zipCache[zip] !== undefined) return zipCache[zip];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.status === 404) { zipCache[zip] = null; return null; }
    if (!res.ok) return undefined;
    const j = await res.json();
    const p = j.places && j.places[0];
    if (!p) { zipCache[zip] = null; return null; }
    const out = {
      city: p['place name'],
      state: p['state abbreviation'],
      lat: parseFloat(p.latitude),
      lng: parseFloat(p.longitude),
    };
    zipCache[zip] = out;
    return out;
  } catch (e) {
    return undefined;
  }
}

/* ---------------------------------------------------------------
   Reverse geocoding — real device coordinates -> city / state / ZIP.
   NO default city is ever returned: if we cannot resolve the point
   the caller gets a typed error and shows it to the user.
   1. BigDataCloud reverse-geocode-client (free, keyless, CORS-open)
   2. OpenStreetMap Nominatim (fallback)
   3. the ZIP we got is normalised through lookupZip() so a coordinate
      result and a hand-typed ZIP always render the same city name.
   (V.02: swap both for Google Geocoding behind store.js)
---------------------------------------------------------------- */
const US_STATE_ABBR = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'district of columbia': 'DC',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL',
  'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA',
  'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR',
  'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA',
  'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'puerto rico': 'PR', 'guam': 'GU', 'u.s. virgin islands': 'VI', 'american samoa': 'AS',
  'northern mariana islands': 'MP',
};

const stateAbbr = (name = '') => {
  const s = String(name).trim();
  if (/^[A-Z]{2}$/.test(s)) return s;
  return US_STATE_ABBR[s.toLowerCase()] || '';
};

async function getJSON(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* BigDataCloud — city / principalSubdivision / postcode / countryCode */
async function rgBigDataCloud(lat, lng) {
  const j = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
  if (!j) return null;
  const country = (j.countryCode || '').toUpperCase();
  const city = j.city || j.locality || (j.localityInfo && j.localityInfo.administrative
    && (j.localityInfo.administrative.find(a => a.adminLevel === 8) || {}).name) || '';
  const state = stateAbbr((j.principalSubdivisionCode || '').replace(/^US-/, '') || j.principalSubdivision || '');
  const zip = /^\d{5}/.test(j.postcode || '') ? String(j.postcode).slice(0, 5) : '';
  if (!country && !city) return null;
  return { country, city, state, zip };
}

/* OpenStreetMap Nominatim — fallback */
async function rgNominatim(lat, lng) {
  const j = await getJSON(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`);
  if (!j || !j.address) return null;
  const a = j.address;
  const country = (a.country_code || '').toUpperCase();
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.county || '';
  const state = stateAbbr(a['ISO3166-2-lvl4'] ? a['ISO3166-2-lvl4'].replace(/^US-/, '') : a.state);
  const zip = /^\d{5}/.test(a.postcode || '') ? String(a.postcode).slice(0, 5) : '';
  if (!country && !city) return null;
  return { country, city, state, zip };
}

/**
 * Turn real device coordinates into a U.S. city / state / ZIP.
 * @returns {{zip:string,city:string,state:string,lat:number,lng:number}}
 *          on success, or { error: 'lookup' | 'outside' } — never a default city.
 */
export async function reverseGeocode(lat, lng) {
  const complete = (h) => h && h.city && h.state;

  /* Both providers at once, not one after the other. Each has an 8-second
     timeout, and asking them in turn made the worst case 16 seconds of a
     screen saying nothing at all — which is what «I pressed allow and
     nothing happened» actually was. In practice the second one was being
     called most of the time anyway, so this costs no real traffic. */
  const [a, b] = await Promise.all([
    rgBigDataCloud(lat, lng).catch(() => null),
    rgNominatim(lat, lng).catch(() => null),
  ]);
  if (a && a.country && a.country !== 'US') return { error: 'outside' };
  if (b && b.country && b.country !== 'US') return { error: 'outside' };

  // keep whichever field each of them actually resolved
  let hit = complete(a) && a.zip ? a : null;
  if (!hit) {
    hit = a ? {
      country: a.country || (b && b.country) || '',
      city: a.city || (b && b.city) || '',
      state: a.state || (b && b.state) || '',
      zip: a.zip || (b && b.zip) || '',
    } : b;
  }
  if (!hit) return { error: 'lookup' };

  let { city, state, zip } = hit;

  // A ZIP is the strongest signal — normalise it so the label matches
  // exactly what a hand-typed ZIP would produce.
  if (zip) {
    const z = await lookupZip(zip);
    if (z && z.city) { city = z.city; state = z.state || state; }
  }
  if (!city || !state) return { error: 'lookup' };
  return { zip, city, state, lat, lng };
}

/* ---------------- location ----------------
   Three ways in, one sheet: the device, the list of cities the directory
   actually covers, and any U.S. ZIP. The device is the only one of the
   three that yields a point, so it is the only one that ever produces a
   figure in miles — a city picked by hand tells us the area and nothing
   more, and the app says the area.
   ------------------------------------------------------------------- */

/**
 * The line that stands in front of the system dialog.
 *
 * iOS asks once. A reader who taps "don't allow" on a prompt that arrived
 * with no explanation has denied it permanently, and no later screen can
 * ask again — so nothing in this app calls the browser at launch, and
 * nothing calls it before this sheet has been answered.
 */
/**
 * @param why  an i18n key prefix for the reason THIS caller is asking.
 *             The prayer screen asks for a different thing than the
 *             directory does, and «لنعرض لك أقرب المحلات إليك» over a
 *             screen of prayer times is the app answering a question
 *             nobody asked.
 */
export function openGeoPrompt(onAllow, why) {
  openSheet(`
    <div class="sheet-title">${t(why ? why + 'Title' : 'geoAskTitle')}</div>
    <div class="sheet-sub">${t(why ? why + 'Body' : 'geoAskBody')}</div>
    <button class="btn btn-gold btn-block" id="geoYes">${icon('navigation', 19)} ${t('geoAllow')}</button>
    <button class="btn btn-ghost btn-block mt-8" id="geoNo">${t('geoNotNow')}</button>
    <div class="hint mt-12">${icon('info', 15)} ${t('locPrivacyLine')}</div>
  `, (panel) => {
    panel.querySelector('#geoYes').addEventListener('click', () => {
      S.markGeoAsked();
      closeSheet();
      onAllow();
    });
    panel.querySelector('#geoNo').addEventListener('click', () => closeSheet());
  });
}

/**
 * The device's position, turned into a city. Every ending is handled and
 * every one of them ends somewhere usable: on a refusal, a timeout, a
 * desktop with no GPS or a point outside the region, the reader still has
 * the city list and the ZIP box behind this.
 */
/* ------------------------------------------------------------
   TWO STAGES, AND THE FIRST ONE OWES NOTHING TO THE NETWORK

   Somebody allowed the location and nothing happened. He chose «Katy» by
   hand a moment later and the prayer times appeared at once — so the
   permission, the point, the calculation and the screen were all fine.

   What was wrong: the app HAD the coordinates and then threw them away
   because it could not find out the name of the town. `setUserLocation`
   lived inside `onOk`, and `onOk` only ran after `reverseGeocode()` — a
   call to somebody else's server. Fail that call and the point the device
   had just handed us was lost, along with the only thing prayer times
   actually need.

   Any of these is enough to fail it, and none of them is a fault in this
   app: an ad blocker (these three hosts look like trackers to one),
   Nominatim's rate limit on browser traffic, a weak cellular signal
   against an 8-second timeout, a school or office network filtering
   outside domains. It is why it failed for him and works for you.

   `prayer.js` says at the top of the file that everything on that screen
   is computed on the device and nothing is fetched, so it works with no
   signal at all. That was true, and then the screen was wired to the
   internet through the back door.

   THE RULE: prayer times need a POINT and a DATE and nothing else. The
   name of the city is the directory's business alone.

   So: the point is saved the moment it arrives, before any request goes
   out. The name is asked for afterwards, and failing to get it takes
   nothing away — `onOk` simply fires twice, once with the point and once
   with the name, and the second may never come.
   ------------------------------------------------------------ */
export function requestGeo({ onStep, onOk, onFail }) {
  const step = onStep || (() => {});
  const fail = onFail || (() => {});
  if (!navigator.geolocation) { S.setGeoPending(false); fail('geoUnsupported'); return; }
  step('locating');
  /* The screens read this to show «جارٍ تحديد موقعك…» in the place the
     times will take, so nobody is left looking at the button they just
     pressed. Cleared on every exit below, success or failure. */
  S.setGeoPending(true);
  // repaint straight away: the flag is useless if nothing redraws to read it
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;

      /* ——— stage one: the point, kept now ———
         Whatever name we end up with, this is already enough for the
         prayer times and for every distance in the directory. */
      S.setGeoPending(false);          // the point is here; the name is extra
      const prev = S.state.location || {};
      const keep = { zip: prev.zip || '', city: prev.city || '', state: prev.state || 'TX' };
      S.setUserLocation(keep, { lat: latitude, lng: longitude });
      onOk({ ...keep, lat: latitude, lng: longitude,
             inRegion: !!S.nearestCity({ lat: latitude, lng: longitude }), naming: true });

      /* ——— stage two: the name, which is an improvement, not a condition ——— */
      step('resolvingLocation');
      const r = await reverseGeocode(latitude, longitude);
      /* Being outside the United States is not a failure to NAME a place —
         it is a fact about the place, and the reader has to be told: the
         directory covers Houston and the times are computed anywhere, but
         «my city» cannot mean anything here. */
      if (r.error === 'outside') { fail('geoOutsideUs'); return; }
      /* …and a naming call that simply did not answer says nothing to
         anybody. No red message: from the reader's side nothing failed.
         The screen repaints because the point landed a moment ago. */
      if (r.error) { window.dispatchEvent(new HashChangeEvent('hashchange')); return; }
      /* The reverse lookup names the town it thinks the point is in, which
         may be a place the directory has never heard of. Snapping to the
         nearest city we actually cover keeps "my city" meaning something,
         and outside the region we keep the point (the miles are still
         real) but leave the city as the area.

         But the snap comes SECOND, not first. It used to run over the top
         of a perfectly good answer: 77407 resolves to Richmond, and the
         nearest city CENTRE to the north of that ZIP is Katy — 6.9 miles
         against Richmond's 9.1 — so a reader standing in Richmond was told
         they were in Katy. The arithmetic was right and the arithmetic was
         the mistake. Ask somebody where they live and they name their
         town; nobody says "the nearest city hall to me is Katy".

         So: if the ZIP's own city is one we cover, that IS the city, and
         nearestCity is only consulted when it is not. `inRegion` still
         comes from nearestCity — coverage is one question, the name is
         another. */
      const near = S.nearestCity({ lat: latitude, lng: longitude });
      // resolved once: saving it and reporting it are the same answer
      const named = { zip: r.zip || '', city: cityNameFor(r, near), state: r.state };
      S.setUserLocation(named, { lat: latitude, lng: longitude });
      onOk({ ...named, lat: latitude, lng: longitude, inRegion: !!near, naming: false });
    },
    (err) => {
      S.setGeoPending(false);
      // markGeoDenied ONLY on a real refusal (code 1): the flag is permanent
      // on iOS, and setting it on a network failure would silence the ask
      // for good.
      if (err && err.code === 1) { S.markGeoDenied(); fail('geoDenied'); }
      else if (err && err.code === 3) fail('geoTimeout');
      else fail('geoUnavailable');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

/** ask for the position wherever a distance is needed, then repaint */
/* ---------------------------------------------------------------
   The point goes stale the moment its owner drives away

   It was read once and never read again: whoever set their location in
   Katy and then moved to Sugar Land stayed in Katy for good, and every
   mile the app printed from then on was wrong.

   `watchPosition` is NOT the answer and must never be used here. It runs
   the radio continuously, it flattens the battery, and it makes an app
   feel like it is following you around — which is the one thing that gets
   it deleted.

   So the point is re-read when the reader comes BACK to the app, and only
   when all three are true at once:
     1. they granted the permission already (there is a point, and no refusal)
     2. what we hold is older than thirty minutes
     3. the page is actually visible
   Then one quiet `getCurrentPosition`, with no sheet, no prompt and no
   question. A failure is swallowed and the stored point stands.
   --------------------------------------------------------------- */
const GEO_STALE_MS = 30 * 60 * 1000;   // it succeeded: do not read again for half an hour
/* IT FAILED: try again in a minute and a half. The two were one number,
   and that is the whole fault — a failed attempt was stamped exactly like
   a successful one and shut the door for thirty minutes. Eight seconds is
   short for a device in motion, so the sequence ran: open, eight seconds,
   fail, silence, locked for half an hour · open again, locked, no attempt
   at all · open an hour later, works. That is «it works when it feels
   like it», precisely. */
const GEO_RETRY_MS = 90 * 1000;
/* How far the reader has to have travelled before the stored CITY NAME is
   treated as a claim rather than a fact. Under three miles you are almost
   certainly still in your own town, so a correct name is never wiped;
   above it the old name is an assertion about somewhere the reader is not. */
const NAME_STALE_MI = 3;
let lastQuietOk = 0;
/* Without this, `visibilitychange` opens an attempt on top of one that has
   not answered yet, every one of them counts as a failure, and the throttle
   grows — making the fault worse rather than better. */
let quietInFlight = false;
/* The FAILURE throttle is read from the stored trace, not from a variable.
   Module state dies with the page, so five opens inside a minute made five
   failed reads — measured — and the reader is closing and reopening the app
   precisely when it is failing. `geoFail.at` is already saved, so it is the
   one definition; a second copy in memory could only disagree with it. */
const lastFailAt = () => (S.geoFail() || {}).at || 0;

/** repaint the city chips in place — the new name is the whole signal */
/* The chip has FOUR states and only `cityChipLabel()` knows all of them:
   a hand-picked city, a city the device found («Houston · تلقائي»), a
   point whose name has not arrived («موقعك الحالي»), and nothing at all.
   This function had its own older two-state formula, so every quiet
   refresh repainted the chip into a shape the render path would never
   have drawn — and the honest «موقعك الحالي», which is exactly what a
   reader who has just moved and cannot be named should see, was the
   state it could not express. One definition, three screens. */
export function repaintCityChips() {
  const label = cityChipLabel();
  /* A reader who pressed the state suggestion HAS a location — «TX» is an
     answer, not a blank — so the chip must not keep the dashed «unset»
     look that means «we do not know where you are». */
  const known = !!(S.userCity() || S.userState() || S.state.geo);
  $$('.loc-chip').forEach(el => {
    const span = el.querySelector('span');
    if (span) span.textContent = label;
    el.classList.toggle('unset', !known);
  });
}

/**
 * Read the device again without asking anything. `force` is the location
 * sheet's «حدّث موقعي», which skips the staleness test but nothing else.
 */
/**
 * The three conditions, in one named place so they can be read and tested
 * rather than inferred from the middle of a function: the permission was
 * granted before and not refused, the stored point is older than
 * GEO_STALE_MS, and no attempt is already in flight. A FAILURE HAS ITS OWN
 * THROTTLE — ninety seconds, not thirty minutes — because a read that did
 * not answer tells us nothing about whether the next one will.
 */
export function shouldRefreshGeo(force = false) {
  if (document.visibilityState !== 'visible') return false;
  /* `geoGranted`, not `geo`. Gating on the POINT meant that choosing a
     city by hand — which clears the point on purpose — switched the quiet
     refresh off permanently, and the app froze on that city and never
     said so. Permission granted once is a different question from having
     a point right now, and the two were the same line. */
  if (!S.geoGranted() || S.state.geoDenied) return false;   // never granted, or refused
  if (force) return true;
  if (quietInFlight) return false;
  const g = S.state.geo;
  const t0 = S.now();
  if (g && g.at && t0 - g.at < GEO_STALE_MS) return false;
  if (t0 - lastQuietOk < GEO_STALE_MS) return false;
  if (t0 - lastFailAt() < GEO_RETRY_MS) return false;
  return true;
}

/**
 * What to CALL the place the reader is standing in.
 *
 * If you asked Rai where he lives he would say Richmond. Nobody says "the
 * nearest city centre to me is Katy" — and that is what 77407 was being
 * told, because the reverse lookup's own answer was thrown away and
 * replaced by the nearest of the 25 centres we cover. 77036 is the same
 * shape: the ZIP says Houston and the nearest centre is Bellaire.
 *
 * So: the resolved city wins whenever the directory covers it, and
 * nearestCity is consulted only when it does not. Coverage is a separate
 * question and still comes from nearestCity — see `inRegion`.
 */
export function cityNameFor(r, near) {
  const named = r && r.city && CITY_POINTS.some(c => c.city === r.city) ? r.city : null;
  return named || (near && near.city) || (r && r.city) || '';
}

export function refreshLocationQuietly(force = false) {
  if (!navigator.geolocation) return;
  if (!shouldRefreshGeo(force)) return;
  /* NO TIMESTAMP HERE. Stamping before the answer is what treated a
     failure exactly like a success. */
  quietInFlight = true;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      quietInFlight = false;
      lastQuietOk = S.now();
      S.clearGeoFail();          // the note never outlives the fault
      const { latitude, longitude } = pos.coords;
      const pt = { lat: latitude, lng: longitude };

      /* THE POINT IS SAVED BEFORE ANY NETWORK CALL. Throwing away a
         coordinate the device just handed us because a naming service did
         not answer is the V.03.8 fault living on in a second function:
         the distances in the directory and every prayer time on #/prayer
         are computed from `state.geo`, so somebody who moved and could not
         be named went on praying to the timetable of the city they left.
         The rule in CLAUDE.md is explicit — the times need a point and a
         date and nothing else, and the city name is the directory's
         business alone.

         Except for somebody who chose their city by hand: nothing moves
         for them until they say so. That is the V.04.0 decision and it is
         not reversed here — and note the ORDER, because `setUserLocation`
         writes `manual` from whether a point came with it, so calling it
         with one would erase the mark. */
      if (!S.cityIsManual()) {
        /* No stored point means nothing says the name has gone stale, and
           a name is only dropped when we can show the reader travelled.
           `Infinity` here would wipe a correct city on the first open
           after any state that lost its point. */
        const moved = S.state.geo ? S.haversine(S.state.geo, pt) : 0;
        /* and the old NAME is dropped when the point really travelled: a
           name for a place its owner has left is worse than no name, and
           the chip already knows how to say «موقعك الحالي» until one
           arrives. Three miles keeps you inside your own town on any
           ordinary errand, so a correct name is never wiped for it.
           `haversine` is local arithmetic — even this judgement needs no
           network. */
        S.setUserLocation(
          moved >= NAME_STALE_MI
            ? { zip: '', city: '', state: S.state.location.state }
            : S.state.location,
          pt);
        repaintCityChips();
      }

      const r = await reverseGeocode(latitude, longitude);
      if (!r || r.error) return;                  // silence: the point is already in
      const near = S.nearestCity(pt);
      const before = S.userCity();
      const city = cityNameFor(r, near);
      /* A CITY SOMEBODY TYPED IS NOT CHANGED BEHIND THEIR BACK. They may
         have picked Houston deliberately while sitting in Richmond, to
         look at Houston's shops — that is their right, and so is knowing
         that we noticed. A point that arrived on its own still updates in
         silence, exactly as before. */
      if (S.cityIsManual() && city && city !== before) {
        if (!S.moveAlreadyAsked()) {
          S.markMoveAsked();
          askToMove(city, { zip: r.zip || '', city, state: r.state }, pt);
        }
        return;
      }
      S.setUserLocation({ zip: r.zip || '', city, state: r.state }, pt);
      if (S.userCity() !== before) repaintCityChips();
    },
    (err) => {
      /* Still silent to the reader — but no longer silent to us. A fault
         that leaves no trace cannot be diagnosed, only guessed at, and
         that is what made this one take three reports to find. */
      quietInFlight = false;
      S.noteGeoFail(err && err.code);      // …and this is the throttle too
    },
    /* Coarse accuracy on purpose: we want a CITY NAME, not a car's
       position in a street. It arrives faster, it succeeds where the
       precise one fails, and it spares the battery of a device on the
       road. And twenty seconds rather than eight — somebody moving needs
       them, and somebody sitting at home answers in under a second
       anyway, so the number costs them nothing. */
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 }
  );
}

/**
 * «It looks like you are in Richmond — update your location?»
 *
 * Asked once per session and never again after a «no», because «leave it»
 * is an answer about this visit and not a setting to store. The refusal
 * is honoured even if the city really has changed.
 */
function askToMove(city, loc, geo) {
  openSheet(`
    <div class="sheet-title">${t('locMovedTitle').replace('{city}', esc(city))}</div>
    <div class="sheet-sub">${t('locMovedSub')}</div>
    <button class="btn btn-gold btn-block mt-12" id="mvYes">${t('locMovedYes')}</button>
    <button class="btn btn-ghost btn-block mt-8" id="mvNo">${t('locMovedNo').replace('{city}', esc(S.userCity()))}</button>
  `, (panel) => {
    panel.querySelector('#mvYes').addEventListener('click', () => {
      S.setUserLocation(loc, geo);
      closeSheet();
      repaintCityChips();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    panel.querySelector('#mvNo').addEventListener('click', () => closeSheet());
  });
}

/**
 * Mounted once at boot — the only listener this feature owns, and one
 * read at startup.
 *
 * `visibilitychange` DOES NOT FIRE WHEN THE APP OPENS. The page is born
 * visible, so there is no hidden→visible transition to hear; the event
 * only arrives when somebody returns to an app that was still running.
 * That is the whole of «sometimes it asks and sometimes it doesn't»:
 * warm return, one read — cold open, none at all. And closing the app,
 * travelling, and opening it again is the ordinary way a phone is used,
 * so the one case that most needed the refresh was the one case that
 * never got it.
 *
 * `shouldRefreshGeo` is untouched, so the conditions are exactly the same
 * ones a warm return already passed: granted before, not refused, the
 * stored point older than thirty minutes, the page visible. Nobody new is
 * asked anything, and somebody who never granted permission is not read
 * at startup either.
 */
export function mountGeoRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshLocationQuietly();
  });
  refreshLocationQuietly();
}

export function askForLocation(after, why) {
  openGeoPrompt(() => {
    toast(t('locating'));
    requestGeo({
      /* Called twice: once the moment the point lands, and again if the
         name arrives. The point is already saved by then — `requestGeo`
         does that before it asks anybody anything — so this only decides
         what to say and when to repaint. Nothing is announced twice. */
      onOk: (r) => {
        if (!r.naming) toast(`${t('locSetTo')}: ${r.city || regionAllLabel()}`, 'ok');
        if (after) after(); else window.dispatchEvent(new HashChangeEvent('hashchange'));
      },
      /* A refusal is not a dead end: the city list is one tap behind it.
         But this now fires ONLY on a real refusal or an unusable point —
         never because a naming server did not answer, which used to open
         the city list on top of a reader who had just said yes. */
      onFail: (key) => {
        toast(t(key), 'err');
        openLocationSheet();
      },
    });
  }, why);
}

/** the quiet trace, in the location sheet alone — and only while it is true */
function geoFailNoteHtml() {
  const f = S.geoFail();
  if (!f) return '';
  const mins = Math.max(1, Math.round((S.now() - f.at) / 60000));
  return `<div class="hint mt-8" style="opacity:.7">${t('geoFailNote')
    .replace('{n}', String(f.n)).replace('{m}', String(mins))}</div>`;
}

export function openLocationSheet() {
  const cities = S.directoryCities();
  const cur = S.userCity();
  openSheet(`
    <div class="sheet-title">${t('locationTitle')}</div>
    <div class="sheet-sub">${t('geoAskBody')}</div>

    <button class="btn btn-gold btn-block" id="geoBtn">${icon('navigation', 19)} ${t('useMyLocation')}</button>
    ${S.state.geo ? `<button class="btn btn-ghost btn-block mt-8" id="geoRefresh">${icon('navigation', 17)} ${t('refreshMyLocation')}</button>` : ''}
    ${/* IN THIS SHEET AND NOWHERE ELSE. Not on Home, not on the chip, not
         on any public screen: it is for us, not for the reader, and it is
         cleared by the first success. */''}
    ${geoFailNoteHtml()}
    <div id="zipMsg" class="mt-8"></div>

    <!-- Twenty-four city chips were a wall. The rule from the filter batch
         — more than five options is a dropdown, five or fewer are chips —
         had only ever been applied to the directory's top row, and this
         was the biggest place it had not reached.

         «استخدم موقعي الحالي» stays a full-width button above it on
         purpose: it is the fastest route for nine readers in ten, and
         burying it in a list to tidy the sheet would slow the majority for
         the minority. -->
    <div class="label mt-16">${t('pickCity')}</div>
    ${pickerBtn({ id: 'ctlCity', label: t('pickCity'), value: cur || regionAllLabel(), wide: true })}
    <div id="cityDD"></div>

    <div class="label mt-16">${t('zipOrCity')}</div>
    <div class="field">
      <input class="input" id="zipIn" inputmode="text" placeholder="${t('zipOrCity')}" value="${S.state.location.zip || ''}" />
      <div id="sugg" style="margin-top:8px"></div>
    </div>

    <div class="hint mt-12">${icon('info', 15)} ${t('locPrivacyLine')}</div>
    ${cur ? `<button class="btn btn-ghost btn-block mt-12" id="clrLoc">${t('clearLocation')}</button>` : ''}
    <div class="sheet-foot">
      <button class="btn btn-gold btn-block" id="applyLoc">${t('apply')}</button>
    </div>
  `, (panel) => {
    /* Nothing chosen inside this sheet carries a point: a city or a ZIP
       names an area, and only the device knows where the reader is. That
       is why the sheet never produces a distance and the button above it
       does. */
    let picked = { zip: S.state.location.zip || '', city: cur, state: S.state.location.state || 'TX' };

    const input = panel.querySelector('#zipIn');
    const msg = panel.querySelector('#zipMsg');
    const sugg = panel.querySelector('#sugg');
    let debounce = null;

    const markCity = (city) => setPickerValue('ctlCity', city || regionAllLabel());

    /* «Houston والمنطقة» rather than «كل المنطقة»: the old label answered
       no question — all of Texas? all of America? — while the app already
       had the right words and used them everywhere else. */
    const cityOptions = [{ id: '', label: regionAllLabel(), icon: 'globe', count: S.allBusinesses().length }]
      .concat(cities.map(c => ({ id: c.city, label: c.city, icon: 'mapPin', count: c.n })));
    const anchor = panel.querySelector('#ctlCity');
    anchor.addEventListener('click', () => openDropdown({
      host: panel.querySelector('#cityDD'),
      anchor,
      title: t('pickCity'),
      options: cityOptions,
      value: picked.city || '',
      unit: 'ddCity',
      onPick: (id) => {
        picked = { zip: '', city: id, state: 'TX' };
        input.value = ''; sugg.innerHTML = ''; msg.innerHTML = '';
        markCity(id);
      },
    }));

    input.addEventListener('input', () => {
      clearTimeout(debounce);
      const v = input.value.trim();
      debounce = setTimeout(async () => {
        sugg.innerHTML = ''; msg.innerHTML = ''; input.classList.remove('input-err');
        if (/^\d+$/.test(v)) {
          if (v.length !== 5) {
            if (v.length > 5) { input.classList.add('input-err'); msg.innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t('invalidZip')}</div>`; }
            return;
          }
          msg.innerHTML = `<div class="hint"><span class="spinner" style="display:inline-block;vertical-align:-3px"></span> ${t('checkingZip')}</div>`;
          const z = await lookupZip(v);           // any U.S. ZIP code
          if (input.value.trim() !== v) return;   // user kept typing
          if (z === undefined) { msg.innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t('zipOffline')}</div>`; return; }
          if (!z) { input.classList.add('input-err'); msg.innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t('invalidZip')}</div>`; return; }
          picked = { zip: v, city: z.city, state: z.state };
          markCity(z.city);
          msg.innerHTML = `<div class="ok-msg">${t('zipResolved')}: <b>${esc(z.city)}, ${z.state}</b></div>`;
        } else if (v.length >= 2) {
          const hits = CITY_SUGGESTIONS.filter(c => c.toLowerCase().includes(v.toLowerCase())).slice(0, 6);
          sugg.innerHTML = hits.map(h => `<button class="dr-item" style="padding:10px 8px;border-radius:10px" data-city="${h}">${icon('mapPin', 18)}<span>${h}</span></button>`).join('')
            || `<div class="hint">${t('emptyDirTitle')}</div>`;
          sugg.querySelectorAll('[data-city]').forEach(b => b.addEventListener('click', () => {
            const [city, st] = b.dataset.city.split(', ');
            picked = { zip: '', city, state: st };
            input.value = b.dataset.city; sugg.innerHTML = '';
            markCity(city);
            msg.innerHTML = `<div class="ok-msg">${t('zipResolved')}: <b>${esc(b.dataset.city)}</b></div>`;
          }));
        }
      }, 250);
    });

    /* --- the device: the only source that yields a point, and so the only
           one that will ever produce a distance in miles. The sheet steps
           out of the way and hands over to the same flow the "nearest"
           sort uses; one sheet can only replace another, so asking from
           inside this one would have left nothing behind it. --- */
    panel.querySelector('#geoBtn').addEventListener('click', () => {
      closeSheet();
      askForLocation();
    });

    /* «حدّث موقعي» — for somebody who has just arrived somewhere and does
       not want to wait for the thirty minutes. Permission is already
       granted, so there is nothing to ask: it reads and it closes. */
    const rf = panel.querySelector('#geoRefresh');
    if (rf) rf.addEventListener('click', () => {
      closeSheet();
      toast(t('locating'));
      refreshLocationQuietly(true);
    });

    const clr = panel.querySelector('#clrLoc');
    if (clr) clr.addEventListener('click', () => {
      S.clearUserLocation();
      closeSheet(); toast(t('locCleared'), 'ok');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    panel.querySelector('#applyLoc').addEventListener('click', () => {
      S.setUserLocation(picked);
      closeSheet();
      toast(`${t('locSetTo')}: ${picked.city || regionAllLabel()}`, 'ok');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  });
}

export function catIcon(catId) {
  const c = CATEGORIES.find(x => x.id === catId);
  return c ? c.icon : 'building';
}
export function catKeyOf(magCat) {
  return { community: 'magCommunity', business: 'magBusiness', culture: 'magCulture', immigration: 'magImmigration', events: 'magEvents' }[magCat] || 'magCommunity';
}
