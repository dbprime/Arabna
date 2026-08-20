/* ============================ HOME ============================ */
import { t, L, icon, $, $$, go, renderHeader, openSheet, closeSheet, toast, stars, wireRoutes,
         distLabel, cityChipLabel, mountAdRotator } from '../ui.js';
import { CATEGORIES, HOME_CATS, MINI_ADS, ARTICLES, ZIPS, CITY_SUGGESTIONS } from '../data.js';
import * as S from '../store.js';

let sliderStop = null;
let miniStop = null;

export function HomeScreen(root) {
  renderHeader({});

  const ads = S.sliderAds();
  const feat = S.allBusinesses().filter(b => S.businessPlan(b) === 'paid').slice(0, 6);
  const stories = S.withoutDemo(ARTICLES).slice(0, 3);
  const loc = S.state.location;

  root.innerHTML = `
    <!-- one row: what you want and where. They are the same question, and
         the second row was costing a whole band above the fold. The
         magnifier keeps its 22px in the stylesheet (flex 0 0 22px) — it was
         squeezed to ~13px the last time this row got crowded — and the
         chip ellipsises rather than wrapping or growing the row. -->
    <div class="search-row solo">
      <div class="search-bar big">
        ${icon('search', 22)}
        <input id="homeSearch" placeholder="${t('searchExample')}" />
      </div>
      <button class="loc-chip ${loc.city ? '' : 'unset'}" id="locBtn">${icon('mapPin', 17)}<span>${cityChipLabel()}</span></button>
    </div>

    <!-- categories — home is a summary: 5 max, the rest live on #/categories -->
    <div class="section">
      <div class="section-head"><div class="section-title">${t('categories')}</div>
        <button class="link-gold" data-route="#/categories">${t('seeAll')}</button></div>
      <div class="hscroll" id="cats">
        ${HOME_CATS.map(id => CATEGORIES.find(c => c.id === id)).filter(Boolean).map(c => `
          <button class="cat-item" data-cat="${c.id}" ${c.route ? `data-dest="${c.route}"` : ''}>
            <span class="cat-circle">${icon(c.icon, 24)}</span>
            <span class="cat-label">${t(c.shortKey || c.key)}</span>
          </button>`).join('')}
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
              <div class="feat-name">${L(b.name)}</div>
              <div class="feat-meta">${stars(b.rating)} <span>· ${b.reviewCount} ${t('reviews')}</span></div>
              ${distLabel(b) ? `<div class="feat-meta">${distLabel(b)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`}

    <!-- cheaper mini ad — not rendered at all when there is nothing to
         put in it, so no empty box stands where a banner would be -->
    ${S.withoutDemo(MINI_ADS).length ? `<button class="mini-ad" id="miniAd"></button>` : ''}

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
              <div class="feat-name mt-8" style="line-height:1.45">${L(a.title)}</div>
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

  $('#homeSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') go('#/directory?q=' + encodeURIComponent(e.target.value));
  });
  $('#locBtn').addEventListener('click', openLocationSheet);
  $$('#cats .cat-item').forEach(b => b.addEventListener('click', () =>
    go(b.dataset.dest || ('#/directory?cat=' + b.dataset.cat))));
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
    <div class="slide-title">${L(a.name)}</div>
    <div class="slide-sub">${L(a.tag)}</div>
    <div class="slide-cta">${L(a.cta)} ${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</div>
    <div class="slide-icon">${icon(a.icon, 86)}</div>
  </div>`;
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

function startMiniAd() {
  if (miniStop) { miniStop(); miniStop = null; }
  const el = $('#miniAd');
  if (!el) return;
  const ads = S.withoutDemo(MINI_ADS);
  if (!ads.length) return;
  miniStop = mountAdRotator({
    host: el, items: ads, interval: 7000,
    paint: (a) => {
      el.innerHTML = `<span class="m-ico">${icon(a.icon, 19)}</span>
        <span class="m-body"><span class="m-name">${L(a.name)}</span><br><span class="m-tag">${L(a.tag)}</span></span>
        <span class="ad-label">${t('adLabel')}</span>`;
      el.dataset.link = a.link;
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

  let hit = await rgBigDataCloud(lat, lng);
  if (hit && hit.country && hit.country !== 'US') return { error: 'outside' };

  // Second provider whenever the first one is missing or incomplete —
  // then keep whichever field each of them actually resolved.
  if (!complete(hit) || !hit.zip) {
    const alt = await rgNominatim(lat, lng);
    if (alt && alt.country && alt.country !== 'US') return { error: 'outside' };
    if (alt) hit = hit ? {
      country: hit.country || alt.country,
      city: hit.city || alt.city,
      state: hit.state || alt.state,
      zip: hit.zip || alt.zip,
    } : alt;
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
export function openGeoPrompt(onAllow) {
  openSheet(`
    <div class="sheet-title">${t('geoAskTitle')}</div>
    <div class="sheet-sub">${t('geoAskBody')}</div>
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
export function requestGeo({ onStep, onOk, onFail }) {
  const step = onStep || (() => {});
  const fail = onFail || (() => {});
  if (!navigator.geolocation) { fail('geoUnsupported'); return; }
  step('locating');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      step('resolvingLocation');
      const r = await reverseGeocode(latitude, longitude);
      if (r.error === 'outside') { fail('geoOutsideUs'); return; }
      if (r.error) { fail('geoLookupFailed'); return; }
      /* The reverse lookup names the town it thinks the point is in, which
         may be a place the directory has never heard of. Snapping to the
         nearest city we actually cover keeps "my city" meaning something,
         and outside the region we keep the point (the miles are still
         real) but leave the city as the area. */
      const near = S.nearestCity({ lat: latitude, lng: longitude });
      onOk({ zip: r.zip || '', city: (near && near.city) || r.city, state: r.state,
             lat: latitude, lng: longitude, inRegion: !!near });
    },
    (err) => {
      if (err && err.code === 1) { S.markGeoDenied(); fail('geoDenied'); }
      else if (err && err.code === 3) fail('geoTimeout');
      else fail('geoUnavailable');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

/** ask for the position wherever a distance is needed, then repaint */
export function askForLocation(after) {
  openGeoPrompt(() => {
    toast(t('locating'));
    requestGeo({
      onOk: (r) => {
        S.setUserLocation({ zip: r.zip, city: r.city, state: r.state }, { lat: r.lat, lng: r.lng });
        toast(`${t('locSetTo')}: ${r.city || t('regionName')}`, 'ok');
        if (after) after(); else window.dispatchEvent(new HashChangeEvent('hashchange'));
      },
      onFail: (key) => {
        // a refusal is not a dead end: the city list is one tap behind it
        toast(t(key), 'err');
        openLocationSheet();
      },
    });
  });
}

export function openLocationSheet() {
  const cities = S.directoryCities();
  const cur = S.userCity();
  openSheet(`
    <div class="sheet-title">${t('locationTitle')}</div>
    <div class="sheet-sub">${t('geoAskBody')}</div>

    <button class="btn btn-gold btn-block" id="geoBtn">${icon('navigation', 19)} ${t('useMyLocation')}</button>
    <div id="zipMsg" class="mt-8"></div>

    <div class="label mt-16">${t('pickCity')}</div>
    <div class="attr-pick" id="cityPick">
      <button class="chip ${!cur ? 'active' : ''}" data-city="">${t('areaAll')}
        <span class="chip-n">${S.allBusinesses().length}</span></button>
      ${cities.map(c => `<button class="chip ${cur === c.city ? 'active' : ''}" data-city="${c.city}">
        ${c.city} <span class="chip-n">${c.n}</span></button>`).join('')}
    </div>

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

    const markCity = (city) => {
      panel.querySelectorAll('#cityPick .chip')
        .forEach(x => x.classList.toggle('active', (x.dataset.city || '') === (city || '')));
    };

    panel.querySelectorAll('#cityPick .chip').forEach(b => b.addEventListener('click', () => {
      picked = { zip: '', city: b.dataset.city, state: 'TX' };
      input.value = ''; sugg.innerHTML = ''; msg.innerHTML = '';
      markCity(b.dataset.city);
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
          msg.innerHTML = `<div class="ok-msg">${t('zipResolved')}: <b>${z.city}, ${z.state}</b></div>`;
        } else if (v.length >= 2) {
          const hits = CITY_SUGGESTIONS.filter(c => c.toLowerCase().includes(v.toLowerCase())).slice(0, 6);
          sugg.innerHTML = hits.map(h => `<button class="dr-item" style="padding:10px 8px;border-radius:10px" data-city="${h}">${icon('mapPin', 18)}<span>${h}</span></button>`).join('')
            || `<div class="hint">${t('emptyDirTitle')}</div>`;
          sugg.querySelectorAll('[data-city]').forEach(b => b.addEventListener('click', () => {
            const [city, st] = b.dataset.city.split(', ');
            picked = { zip: '', city, state: st };
            input.value = b.dataset.city; sugg.innerHTML = '';
            markCity(city);
            msg.innerHTML = `<div class="ok-msg">${t('zipResolved')}: <b>${b.dataset.city}</b></div>`;
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

    const clr = panel.querySelector('#clrLoc');
    if (clr) clr.addEventListener('click', () => {
      S.clearUserLocation();
      closeSheet(); toast(t('locCleared'), 'ok');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    panel.querySelector('#applyLoc').addEventListener('click', () => {
      S.setUserLocation(picked);
      closeSheet();
      toast(`${t('locSetTo')}: ${picked.city || t('regionName')}`, 'ok');
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
