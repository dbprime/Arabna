/* ============================ HOME ============================ */
import { t, L, icon, $, $$, go, renderHeader, openSheet, closeSheet, toast, stars, wireRoutes } from '../ui.js';
import { CATEGORIES, MINI_ADS, ARTICLES, ZIPS, CITY_SUGGESTIONS } from '../data.js';
import * as S from '../store.js';

let sliderTimer = null;
let miniTimer = null;

export function HomeScreen(root) {
  renderHeader({});

  const ads = S.sliderAds();
  const feat = S.allBusinesses().filter(b => S.businessPlan(b) === 'paid').slice(0, 6);
  const stories = ARTICLES.slice(0, 3);
  const loc = S.state.location;

  root.innerHTML = `
    <!-- search + location -->
    <div class="search-wrap">
      <div class="search-bar">
        ${icon('search', 21)}
        <input id="homeSearch" placeholder="${t('searchPlaceholder')}" />
      </div>
      <div class="loc-bar">
        <button class="loc-chip" id="locBtn">${icon('mapPin', 17)}<span>${loc.city}, ${loc.state}</span></button>
        <button class="radius-chip" id="radBtn">${S.state.radius} ${t('miles')}${icon('chevronD', 15)}</button>
      </div>
    </div>

    <!-- primary paid slider -->
    <div class="slider">
      <div class="slider-track" id="track">
        ${ads.map((a, i) => slideHtml(a, i)).join('')}
      </div>
      <div class="slider-dots" id="dots">${ads.map((_, i) => `<span class="dot-i ${i === 0 ? 'active' : ''}"></span>`).join('')}</div>
    </div>

    <!-- categories -->
    <div class="section">
      <div class="section-head"><div class="section-title">${t('categories')}</div>
        <button class="link-gold" data-route="#/directory">${t('seeAll')}</button></div>
      <div class="hscroll" id="cats">
        ${CATEGORIES.map(c => `
          <button class="cat-item" data-cat="${c.id}">
            <span class="cat-circle">${icon(c.icon, 26)}</span>
            <span class="cat-label">${t(c.key)}</span>
          </button>`).join('')}
      </div>
    </div>

    <!-- cheaper mini ad -->
    <button class="mini-ad" id="miniAd"></button>

    <!-- featured (directory subscribers) -->
    <div class="section">
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
              <div class="feat-meta">${icon('mapPin', 13)} ${b.dist} ${t('miles')}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <!-- magazine teaser -->
    <div class="section">
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
    </div>

    <!-- house CTA -->
    <div class="upsell" data-route="#/advertise">
      <div style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(198,161,91,.18);color:var(--gold-bright)">${icon('megaphone', 24)}</div>
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
  $('#radBtn').addEventListener('click', openRadiusSheet);
  $$('#cats .cat-item').forEach(b => b.addEventListener('click', () => go('#/directory?cat=' + b.dataset.cat)));
}

function slideHtml(a, i) {
  if (a.kind === 'house') {
    return `<div class="slide slide-house ${i === 0 ? 'active' : ''}" data-i="${i}" data-route="#/advertise">
      <div style="color:var(--gold);margin-bottom:6px">${icon('megaphone', 31)}</div>
      <div class="slide-title">${t('adCta')}</div>
      <div class="slide-sub" style="color:var(--muted)">${t('adCtaSub')}</div>
      <div class="slide-cta" style="align-self:center;background:linear-gradient(145deg,#E4C77E,#C6A15B)">${icon('plus', 17)} ${t('continueAction')}</div>
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

function startSlider(ads) {
  clearInterval(sliderTimer);
  const track = $('#track');
  if (!track) return;
  let idx = 0;
  const show = (n) => {
    idx = (n + ads.length) % ads.length;
    $$('.slide', track).forEach((s, i) => s.classList.toggle('active', i === idx));
    $$('#dots .dot-i').forEach((d, i) => d.classList.toggle('active', i === idx));
  };
  sliderTimer = setInterval(() => show(idx + 1), 10000);   // auto-advance: 10s

  // manual swipe
  let x0 = null;
  track.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) { show(idx + (dx > 0 ? -1 : 1)); clearInterval(sliderTimer); sliderTimer = setInterval(() => show(idx + 1), 10000); }
    x0 = null;
  });
  let mx0 = null;
  track.addEventListener('mousedown', e => { mx0 = e.clientX; });
  track.addEventListener('mouseup', e => {
    if (mx0 === null) return;
    const dx = e.clientX - mx0;
    if (Math.abs(dx) > 40) show(idx + (dx > 0 ? -1 : 1));
    mx0 = null;
  });
}

function startMiniAd() {
  clearInterval(miniTimer);
  const el = $('#miniAd');
  if (!el) return;
  let i = 0;
  const paint = () => {
    const a = MINI_ADS[i % MINI_ADS.length];
    el.innerHTML = `<span class="m-ico">${icon(a.icon, 19)}</span>
      <span><span class="m-name">${L(a.name)}</span><br><span class="m-tag">${L(a.tag)}</span></span>
      <span class="ad-label">${t('adLabel')}</span>`;
    el.dataset.link = a.link;
  };
  paint();
  miniTimer = setInterval(() => { i++; paint(); }, 7000);
  el.addEventListener('click', () => go(el.dataset.link || '#/directory'));
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

/* ---------------- location sheet (ZIP + city autocomplete) ---------------- */
export function openLocationSheet() {
  openSheet(`
    <div class="sheet-title">${t('locationTitle')}</div>
    <div class="sheet-sub">${t('locationSub')}</div>
    <div class="field">
      <input class="input" id="zipIn" inputmode="text" placeholder="${t('zipOrCity')}" value="${S.state.location.zip || ''}" />
      <div id="zipMsg"></div>
      <div id="sugg" style="margin-top:8px"></div>
    </div>
    <button class="btn btn-ghost btn-block" id="geoBtn">${icon('navigation', 19)} ${t('useMyLocation')}</button>
    <div class="label mt-16">${t('radius')}</div>
    <div class="hscroll" style="padding:0" id="radRow">
      ${[5, 10, 25, 50, 100].map(r => `<button class="chip ${S.state.radius === r ? 'active' : ''}" data-r="${r}">${r} ${t('miles')}</button>`).join('')}
    </div>
    <button class="btn btn-gold btn-block mt-16" id="applyLoc">${t('apply')}</button>
  `, (panel) => {
    let picked = Object.assign({}, S.state.location);
    let radius = S.state.radius;

    const input = panel.querySelector('#zipIn');
    const msg = panel.querySelector('#zipMsg');
    const sugg = panel.querySelector('#sugg');
    let debounce = null;

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
          msg.innerHTML = `<div class="ok-msg">${t('zipResolved')}: <b>${z.city}, ${z.state}</b></div>`;
        } else if (v.length >= 2) {
          const hits = CITY_SUGGESTIONS.filter(c => c.toLowerCase().includes(v.toLowerCase())).slice(0, 6);
          sugg.innerHTML = hits.map(h => `<button class="dr-item" style="padding:10px 8px;border-radius:10px" data-city="${h}">${icon('mapPin', 18)}<span>${h}</span></button>`).join('')
            || `<div class="hint">${t('emptyDirTitle')}</div>`;
          sugg.querySelectorAll('[data-city]').forEach(b => b.addEventListener('click', () => {
            const [city, st] = b.dataset.city.split(', ');
            picked = { zip: '', city, state: st };
            input.value = b.dataset.city; sugg.innerHTML = '';
            msg.innerHTML = `<div class="ok-msg">${t('zipResolved')}: <b>${b.dataset.city}</b></div>`;
          }));
        }
      }, 250);
    });

    /* --- use my current location: real device coordinates, no default city --- */
    const geoBtn = panel.querySelector('#geoBtn');
    let geoBusy = false;

    const geoFail = (key) => {
      geoBusy = false;
      input.classList.remove('input-err');
      sugg.innerHTML = '';
      msg.innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t(key)}</div>`;
      geoBtn.disabled = false;
      geoBtn.innerHTML = `${icon('navigation', 19)} ${t('retryLocation')}`;
    };

    geoBtn.addEventListener('click', () => {
      if (geoBusy) return;
      if (!navigator.geolocation) { geoFail('geoUnsupported'); return; }

      geoBusy = true;
      geoBtn.disabled = true;
      geoBtn.innerHTML = `<span class="spinner"></span> ${t('locating')}`;
      sugg.innerHTML = '';
      input.classList.remove('input-err');
      msg.innerHTML = '';

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          geoBtn.innerHTML = `<span class="spinner"></span> ${t('resolvingLocation')}`;
          msg.innerHTML = `<div class="hint"><span class="spinner" style="display:inline-block;vertical-align:-3px"></span> ${t('resolvingLocation')}</div>`;

          const r = await reverseGeocode(latitude, longitude);
          if (!panel.isConnected) return;               // sheet closed meanwhile
          if (r.error === 'outside') { geoFail('geoOutsideUs'); return; }
          if (r.error) { geoFail('geoLookupFailed'); return; }

          picked = { zip: r.zip || '', city: r.city, state: r.state, lat: r.lat, lng: r.lng };
          const label = `${r.city}, ${r.state}`;
          input.value = r.zip || label;
          msg.innerHTML = `<div class="ok-msg">${t('zipResolved')}: <b>${label}${r.zip ? ` ${r.zip}` : ''}</b></div>`;
          geoBusy = false;
          geoBtn.disabled = false;
          geoBtn.innerHTML = `${icon('check', 19)} ${t('done')}`;
        },
        (err) => {
          if (err && err.code === 1) geoFail('geoDenied');
          else if (err && err.code === 3) geoFail('geoTimeout');
          else geoFail('geoUnavailable');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });

    panel.querySelectorAll('#radRow .chip').forEach(c => c.addEventListener('click', () => {
      radius = +c.dataset.r;
      panel.querySelectorAll('#radRow .chip').forEach(x => x.classList.toggle('active', x === c));
    }));

    panel.querySelector('#applyLoc').addEventListener('click', () => {
      S.state.location = picked; S.state.radius = radius; S.save();
      closeSheet(); toast(`${picked.city}, ${picked.state} · ${radius} ${t('miles')}`, 'ok');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  });
}

export function openRadiusSheet() {
  openSheet(`
    <div class="sheet-title">${t('radius')}</div>
    <div class="sheet-sub">${t('locationSub')}</div>
    ${[5, 10, 25, 50, 100].map(r => `
      <button class="price-card ${S.state.radius === r ? 'selected' : ''}" data-r="${r}">
        <span class="price-radio"></span>
        <span><span class="price-name">${r} ${t('miles')}</span></span>
      </button>`).join('')}
  `, (panel) => {
    panel.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => {
      S.state.radius = +b.dataset.r; S.save(); closeSheet();
      toast(`${t('radius')}: ${b.dataset.r} ${t('miles')}`, 'ok');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }));
  });
}

export function catIcon(catId) {
  const c = CATEGORIES.find(x => x.id === catId);
  return c ? c.icon : 'building';
}
export function catKeyOf(magCat) {
  return { community: 'magCommunity', business: 'magBusiness', culture: 'magCulture', immigration: 'magImmigration', events: 'magEvents' }[magCat] || 'magCommunity';
}
