/* ======================= DIRECTORY + LISTING ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, openSheet, closeSheet, confirmSheet,
         toast, stars, wireRoutes, emptyState, query, openMaps, shareItem, fmtMoney,
         openFilterSheet, activeFilterCount, sectionNote, replaceHash, goAfterDone,
         showsPrices, priceGate, wirePriceGates,
         openBadge, distLabel, attrChips, fmtDay, fmtTime, bizBadge } from '../ui.js';
import { CATEGORIES, SUBSCRIPTION_PRICE, DAY_KEYS } from '../data.js';
import * as S from '../store.js';
import { catIcon, startSlider } from './home.js';
import { mountPhotoPicker } from './marketplace.js';

/* ----------------------------- LIST ----------------------------- */
/* The card the reader came back from, so returning lands on the thing
   they were looking at rather than on a pixel that may now point
   somewhere else — the list can be a different length than it was. */
let lastOpened = '';

export function DirectoryScreen(root) {
  renderHeader({});

  /* ---- the whole state of this screen lives in the URL ----
     Two reasons. Leaving the screen used to destroy it: search, filters
     and position were local variables, so coming back from the fortieth
     listing started again from nothing — unusable in a directory of 486.
     And a URL that carries the state is a link somebody can send: "halal
     restaurants open now" becomes a message, which is marketing we get
     for free. */
  const readUrl = () => {
    const q = query();
    return {
      cat: q.cat || 'all',
      term: q.q || '',
      openNow: q.open === '1',
      sort: q.sort || 'newest',
      attrs: (q.attrs || '').split(',').filter(Boolean),
      radius: +q.radius || S.state.radius,
    };
  };
  let st = readUrl();

  /**
   * Written with replaceState, never pushState: one history entry per
   * filter would turn the back button into an undo stack and the reader
   * would never get out of the directory.
   */
  const writeUrl = () => {
    const p = [];
    if (st.cat !== 'all') p.push('cat=' + encodeURIComponent(st.cat));
    if (st.term) p.push('q=' + encodeURIComponent(st.term));
    if (st.openNow) p.push('open=1');
    if (st.sort !== 'newest') p.push('sort=' + st.sort);
    if (st.attrs.length) p.push('attrs=' + st.attrs.join(','));
    replaceHash('#/directory' + (p.length ? '?' + p.join('&') : ''));
  };

  root.innerHTML = `
    <!-- the search gets its own full-width row: sharing one with the city
         chip and the filter button squeezed the magnifier down to 13px,
         which is the same as not having one -->
    <div class="search-row solo">
      <div class="search-bar big">${icon('search', 22)}
        <input id="dirSearch" placeholder="${t('searchExample')}" value="${attr(st.term)}" />
        <button class="search-clear" id="dirClear" hidden aria-label="${t('clear')}">${icon('x', 16)}</button>
      </div>
    </div>
    <div class="search-row sub">
      <button class="loc-chip" data-loc>${icon('mapPin', 17)}<span>${S.state.location.city}</span></button>
      <button class="filter-btn" id="dirFilter" aria-label="${t('filters')}">${icon('filter', 20)}<span id="fCount"></span></button>
    </div>

    <div class="hscroll mt-12" id="catChips"></div>
    <div class="hscroll mt-8" id="attrChips"></div>
    <div id="pills"></div>
    <div id="catSlider"></div>
    <div id="dirNote"></div>
    <div class="pad mt-12" id="dirList"></div>

    <div class="list-note" style="margin-bottom:18px">${icon('info', 18)}
      <span>${t('isThisYours')} <b class="gold" data-route="#/claim" style="cursor:pointer">${t('claimIt')}</b> · <b class="gold" data-route="#/add-business" style="cursor:pointer">${t('addBusiness')}</b></span>
    </div>`;

  /** how many listings each category holds, for the chips and the sheet */
  const catCounts = () => {
    const out = {};
    S.allBusinesses().forEach(b => { out[b.cat] = (out[b.cat] || 0) + 1; });
    return out;
  };

  const paintCatChips = () => {
    const counts = catCounts();
    const cats = CATEGORIES.filter(c => !c.route);
    $('#catChips').innerHTML =
      `<button class="chip ${st.cat === 'all' ? 'active' : ''}" data-cat="all">${t('catAll')}
         <span class="chip-n">${S.allBusinesses().length}</span></button>`
      + cats.map(c => `<button class="chip ${st.cat === c.id ? 'active' : ''}" data-cat="${c.id}">
          ${icon(c.icon, 15)} ${t(c.key)} <span class="chip-n">${counts[c.id] || 0}</span></button>`).join('')
      + `<button class="chip chip-grid" id="catGrid" aria-label="${t('allCategories')}">${icon('grid', 16)}</button>`;

    $$('#catChips .chip[data-cat]').forEach(c => c.addEventListener('click', () => {
      setCat(c.dataset.cat);
    }));
    $('#catGrid').addEventListener('click', openCatSheet);

    const active = $('#catChips .chip.active');
    if (active && st.cat !== 'all') active.scrollIntoView({ inline: 'center', block: 'nearest' });
  };

  const setCat = (id) => {
    st.cat = id;
    const valid = S.attrsForCat(id === 'all' ? '*' : id).map(a => a.id);
    st.attrs = st.attrs.filter(x => valid.includes(x));
    writeUrl();
    paintCatChips(); paintChips(); paint();
  };

  /** every category at once, three to a row, with its real count */
  const openCatSheet = () => {
    const counts = catCounts();
    openSheet(`
      <div class="sheet-title">${t('allCategories')}</div>
      <div class="cat-box">
        <button class="cat-box-cell ${st.cat === 'all' ? 'active' : ''}" data-c="all">
          <span class="cc-ico">${icon('grid', 22)}</span>
          <span class="cc-label">${t('catAll')}</span>
          <span class="cc-count">${S.allBusinesses().length}</span></button>
        ${CATEGORIES.filter(c => !c.route).map(c => `
          <button class="cat-box-cell ${st.cat === c.id ? 'active' : ''}" data-c="${c.id}">
            <span class="cc-ico">${icon(c.icon, 22)}</span>
            <span class="cc-label">${t(c.key)}</span>
            <span class="cc-count">${counts[c.id] || 0}</span></button>`).join('')}
      </div>
    `, (panel) => {
      panel.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
        closeSheet();
        setCat(b.dataset.c);
      }));
    });
  };

  /* Quick chips belong to a category. On "all" they were a second row of
     options nobody could act on, so there are none until a category is
     picked, and never more than five. */
  const paintChips = () => {
    const host = $('#attrChips');
    if (st.cat === 'all') {
      host.innerHTML = `<button class="chip ${st.openNow ? 'active' : ''}" data-attr="__open">${icon('clock', 14)} ${t('filterOpenNow')}</button>`;
    } else {
      const quick = S.quickAttrsForCat(st.cat, 5);
      host.innerHTML =
        `<button class="chip ${st.openNow ? 'active' : ''}" data-attr="__open">${icon('clock', 14)} ${t('filterOpenNow')}</button>`
        + quick.map(a => `<button class="chip ${st.attrs.includes(a.id) ? 'active' : ''}" data-attr="${a.id}">
            ${icon(a.icon, 14)} ${t(a.key)}</button>`).join('');
    }
    $$('#attrChips .chip').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.attr;
      if (id === '__open') st.openNow = !st.openNow;
      else {
        const i = st.attrs.indexOf(id);
        if (i >= 0) st.attrs.splice(i, 1); else st.attrs.push(id);
      }
      b.classList.toggle('active', id === '__open' ? st.openNow : st.attrs.includes(id));
      writeUrl();
      paint();
    }));
  };

  /* Every filter that is on, as a chip with an ✕. Without this the reader
     sees three results and no reason why. */
  const paintPills = () => {
    const host = $('#pills');
    const on = [];
    if (st.openNow) on.push({ k: '__open', label: t('filterOpenNow') });
    st.attrs.forEach(id => {
      const a = S.attrById(id);
      if (a) on.push({ k: id, label: t(a.key) });
    });
    if (st.sort !== 'newest') on.push({ k: '__sort', label: t(sortKey(st.sort)) });
    if (st.term) on.push({ k: '__term', label: '"' + st.term + '"' });

    host.innerHTML = on.length ? `<div class="pill-row">
      ${on.map(p => `<button class="pill" data-off="${p.k}">${p.label} ${icon('x', 13)}</button>`).join('')}
      ${on.length > 1 ? `<button class="pill clear" id="pillClear">${t('clearAll')}</button>` : ''}
    </div>` : '';

    $$('#pills [data-off]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.off;
      if (k === '__open') st.openNow = false;
      else if (k === '__sort') st.sort = 'newest';
      else if (k === '__term') { st.term = ''; $('#dirSearch').value = ''; }
      else st.attrs = st.attrs.filter(x => x !== k);
      writeUrl(); paintChips(); paint();
    }));
    const pc = $('#pillClear');
    if (pc) pc.addEventListener('click', () => {
      st.openNow = false; st.attrs = []; st.sort = 'newest'; st.term = '';
      $('#dirSearch').value = '';
      writeUrl(); paintChips(); paint();
    });
  };

  /* The category slider: only drawn when somebody has actually bought
     the slot for this category. An empty placeholder here would push the
     results down the screen for nothing. */
  const paintCatSlider = () => {
    const host = $('#catSlider');
    if (!host) return;
    const ads = st.cat === 'all' ? [] : S.catSliderAds(st.cat);
    if (!ads.length) { host.innerHTML = ''; return; }
    host.innerHTML = `
      <div class="slider">
        <div class="slider-track" id="catTrack">${ads.map((a, i) => catSlideHtml(a, i)).join('')}</div>
        <div class="slider-dots" id="catDots">${ads.map((_, i) => `<span class="dot-i ${i === 0 ? 'active' : ''}"></span>`).join('')}</div>
      </div>`;
    startSlider(ads, '#catSlider .slider', '#catTrack', '#catDots');
  };

  /** the list before the search is applied — the sheet counts against this */
  const baseList = () => {
    const now = new Date();
    return S.allBusinesses()
      .filter(b => st.cat === 'all' || b.cat === st.cat)
      .filter(b => !b.dist || b.dist <= S.state.radius)
      .filter(b => !st.openNow || S.isOpenNow(b, now))
      .filter(b => S.matchesAttrs(b, st.attrs));
  };

  const paint = () => {
    const now = new Date();
    const found = S.searchBusinesses(baseList(), st.term);
    let list = found.list.slice();

    if (st.sort === 'rated') list.sort((a, b) => S.ratingFor(b).avg - S.ratingFor(a).avg);
    else if (st.sort === 'nearest') list.sort((a, b) => a.dist - b.dist);
    else if (st.sort === 'open') list.sort((a, b) => (S.isOpenNow(b, now) - S.isOpenNow(a, now)) || a.dist - b.dist);
    else if (found.mode !== 'loose') list.sort((a, b) => (S.businessPlan(b) === 'paid') - (S.businessPlan(a) === 'paid') || a.dist - b.dist);

    const sec = CATEGORIES.find(c => c.id === st.cat);
    $('#dirNote').innerHTML = sectionNote(sec ? t(sec.key) : '', list.length)
      + (found.mode === 'loose'
        ? `<div class="near-miss">${icon('info', 15)} ${t('nearMiss').replace('{q}', attr(st.term))}</div>` : '');
    paintPills();
    paintCatSlider();

    const el = $('#dirList');
    const filtered = st.openNow || st.attrs.length || st.term;
    if (!list.length && filtered) {
      // a dead end offers something to press, not just an apology
      el.innerHTML = emptyState('filter', t('noFilterResults'), t('noFilterResultsSub'));
      const box = el.querySelector('.empty');
      if (found.suggestions.length) {
        box.insertAdjacentHTML('beforeend',
          `<div class="sugg-row">${found.suggestions.map(sg =>
            `<button class="pill sugg" data-sk="${sg.kind}" data-sv="${attr(sg.value)}">${sg.label} <span class="chip-n">${sg.count}</span></button>`).join('')}</div>`);
      }
      box.insertAdjacentHTML('beforeend', `<button class="btn btn-gold mt-8" id="clrF">${t('clearFiltersBtn')}</button>`);
      el.querySelectorAll('[data-sk]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.sk === 'cat') { st.term = ''; $('#dirSearch').value = ''; setCat(b.dataset.sv); }
        else { st.term = b.dataset.sv; $('#dirSearch').value = st.term; writeUrl(); paint(); }
      }));
      el.querySelector('#clrF').addEventListener('click', () => {
        st.openNow = false; st.attrs = []; st.term = '';
        $('#dirSearch').value = '';
        writeUrl(); paintChips(); paint();
      });
      paintFilterCount();
      return;
    }
    if (!list.length) {
      el.innerHTML = emptyState('search', t('emptyDirTitle'), t('emptyDirSub'), t('radius'), '#/directory');
    } else {
      // the subscription upsell sits after the first five results, not above them
      const rows = list.map(rowHtml);
      if (rows.length > 5) rows.splice(5, 0, upsellHtml());
      else rows.push(upsellHtml());
      el.innerHTML = rows.join('');
    }
    wireRoutes(el);
    $$('#dirList [data-call]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); location.href = 'tel:' + b.dataset.call; }));
    $$('#dirList .list-row[data-route^="#/directory/"]').forEach(r =>
      r.addEventListener('click', () => { lastOpened = r.dataset.route.split('/').pop(); }));
    if (!list.length) $$('#dirList .empty .btn').forEach(b => b.addEventListener('click', () => import('./home.js').then(m => m.openRadiusSheet())));

    paintFilterCount();
    flashReturn();
  };

  const paintFilterCount = () => {
    const fc = $('#fCount');
    const n = activeFilterCount({ cat: st.cat, openNow: st.openNow, attrs: st.attrs, sort: st.sort });
    fc.className = n ? 'f-count' : '';
    fc.textContent = n || '';
    $('#dirFilter').classList.toggle('on', n > 0);
  };

  /* Coming back from a listing: put that card in the middle of the screen
     and blink it once. The saved pixel is right until the list changes
     length; the card is right either way. */
  const flashReturn = () => {
    if (!lastOpened) return;
    const row = $(`#dirList .list-row[data-route="#/directory/${lastOpened}"]`);
    lastOpened = '';
    if (!row) return;
    requestAnimationFrame(() => {
      row.scrollIntoView({ block: 'center' });
      row.classList.add('flash');
      setTimeout(() => row.classList.remove('flash'), 1100);
    });
  };

  paintCatChips();
  paintChips();
  paint();

  const search = $('#dirSearch');
  const clear = $('#dirClear');
  const syncClear = () => { clear.hidden = !search.value; };
  syncClear();
  search.addEventListener('input', e => {
    st.term = e.target.value;
    syncClear();
    writeUrl();
    paint();
  });
  clear.addEventListener('click', () => {
    st.term = ''; search.value = ''; syncClear(); writeUrl(); paint();
  });

  $('[data-loc]').addEventListener('click', () => import('./home.js').then(m => m.openLocationSheet()));
  $('#dirFilter').addEventListener('click', () => openFilterSheet({
    cat: st.cat,
    value: { cat: st.cat, radius: S.state.radius, sort: st.sort, openNow: st.openNow, attrs: st.attrs.slice() },
    withPrice: false,
    withAttrs: true,
    countFor: (v) => S.searchBusinesses(S.allBusinesses()
      .filter(b => v.cat === 'all' || b.cat === v.cat)
      .filter(b => !b.dist || b.dist <= v.radius)
      .filter(b => !v.openNow || S.isOpenNow(b, new Date()))
      .filter(b => S.matchesAttrs(b, v.attrs)), st.term).list.length,
    onApply: (v) => {
      st.openNow = v.openNow; st.sort = v.sort; st.attrs = v.attrs.slice();
      S.setRadius(v.radius);
      writeUrl();
      paintChips(); paint();
    },
  }));
  wireRoutes(root);
}

/** the i18n key for a sort id, for the pill that shows it */
function sortKey(id) {
  return { rated: 'sortTopRated', nearest: 'sortNearest', open: 'sortOpen' }[id] || 'sortNewest';
}

/* Slim card: icon · name + verified · rating/reviews/distance on one line ·
   call. The written phone duplicated the call button and "directions" now
   lives on the detail page, where the address is anyway. */
function rowHtml(b) {
  // the tint marks a subscriber's row; "free" is never written on anyone.
  // A shop owner reading "free" on their own page hears "this one didn't pay",
  // and in the marketplace the same word means "costs nothing" — twice wrong.
  const paid = S.isPaid(b);
  const r = S.ratingFor(b);
  return `<div class="list-row ${paid ? 'premium' : ''}" data-route="#/directory/${b.id}">
    <span class="row-ico">${icon(catIcon(b.cat), 22)}</span>
    <div class="row-main">
      <div class="row-title">${L(b.name)}${bizBadge(b)}</div>
      <div class="row-sub">${r.count ? stars(r.avg) + `<span>· ${r.count} ${t('reviews')}</span> · ` : ''}
        ${distLabel(b)}
        ${openBadge(b)}
      </div>
      ${b.phone ? `<div class="row-actions">
        <button class="mini-btn gold" data-call="${b.phone}">${icon('phone', 15)} ${t('call')}</button>
      </div>` : ''}
    </div>
  </div>`;
}

/**
 * The week, with today picked out and the live open/closed pill above it.
 * A row of prose could not answer "are they open now", which is the only
 * question most people have.
 */
function hoursBlock(b) {
  if (!Array.isArray(b.hours) || b.hours.length !== 7) {
    return `<div class="info-row"><span class="i-ico">${icon('clock', 21)}</span>
      <div class="i-txt"><b>${t('noHours')}</b><span>${t('hoursTitle')}</span></div></div>`;
  }
  const today = new Date().getDay();
  return `<div class="hours-block">
    <div class="hours-head">
      <span class="i-ico">${icon('clock', 21)}</span>
      <b>${t('hoursTitle')}</b>
      ${openBadge(b)}
    </div>
    <div class="hours-week">
      ${b.hours.map((spans, i) => `
        <div class="hours-row ${i === today ? 'today' : ''}">
          <span>${t(DAY_KEYS[i])}</span>
          <span class="${spans && spans.length ? 'ltr' : 'muted'}">${fmtDay(spans)}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

/** prayer, Jumuah or mass times — only ever rendered for a place of worship */
function worshipBlock(b) {
  const w = b.worship;
  if (!w) return '';
  const langLabel = w.lang === 'ar' ? t('langAr') : w.lang === 'en' ? t('langEn') : t('langBoth');
  const rows = [];

  if (w.prayers) {
    rows.push(`<div class="wor-head">${icon('moon', 17)} ${t('prayerTimes')}</div>
      <div class="wor-grid">
        ${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter(k => w.prayers[k]).map(k =>
          `<div class="wor-cell"><b>${t('pr' + k[0].toUpperCase() + k.slice(1))}</b><span class="ltr">${fmtTime(w.prayers[k])}</span></div>`).join('')}
      </div>`);
  }
  if (w.jumuah && w.jumuah.length) {
    rows.push(`<div class="info-row"><span class="i-ico">${icon('users', 21)}</span>
      <div class="i-txt"><b class="ltr">${w.jumuah.map(fmtTime).join(' · ')}</b><span>${t('jumuahTime')}</span></div></div>`);
  }
  if (w.mass && w.mass.length) {
    rows.push(`<div class="info-row"><span class="i-ico">${icon('landmark', 21)}</span>
      <div class="i-txt"><b>${w.mass.map(m => `${t(DAY_KEYS[m.day])} <span class="ltr">${fmtTime(m.time)}</span>`).join(' · ')}</b>
      <span>${t('massTimes')}</span></div></div>`);
  }
  rows.push(`<div class="info-row"><span class="i-ico">${icon('languages', 21)}</span>
    <div class="i-txt"><b>${langLabel}</b><span>${w.kind === 'church' ? t('massLang') : t('sermonLang')}</span></div></div>`);

  return `<div class="worship-block">${rows.join('')}</div>`;
}

/** one slide in a category slider — the same shape the home one uses */
function catSlideHtml(a, i) {
  return `<div class="slide ${i === 0 ? 'active' : ''}" style="background:${a.color}">
    <span class="slide-badge">${t('sponsored')}</span>
    <div class="slide-title">${L(a.name)}</div>
    <div class="slide-sub">${L(a.tag)}</div>
    <div class="slide-cta">${L(a.cta)} ${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</div>
    <div class="slide-icon">${icon(a.icon, 86)}</div>
  </div>`;
}

/**
 * The entry price and the warning that has to sit beside it. Many of these
 * places are seasonal and half of them change their gate price between
 * spring and summer, so the app never claims to know today's number: it
 * prints roughly what it costs and tells you to check.
 */
function outingBlock(b) {
  if (b.cat !== 'outings') return '';
  // The price row appears only when there is something to pay: the
  // "free entry" attribute already says so in the chip row above, and
  // printing it twice is the duplication banned everywhere else.
  const free = S.hasAttr(b, 'outFreeEntry');
  const price = String(b.entryPrice || '').trim();
  return `${!free && price
      ? `<div class="info-row"><span class="i-ico">${icon('ticket', 21)}</span>
           <div class="i-txt"><b class="ltr">${attr(price)}</b><span>${t('entryPrice')}</span></div></div>`
      : ''}
    <div class="list-note" style="margin-inline:0">${icon('alert', 18)}<span>${t('outingsWarn')}</span></div>`;
}

/**
 * Halal restaurants near an outing, at the foot of the page. A family on a
 * day out has to eat, and the question comes up every single time. It costs
 * us nothing and hands the restaurants in the directory another doorway;
 * the order is by distance, never by who paid.
 */
function halalNearbyBlock(b) {
  if (b.cat !== 'outings') return '';
  const list = S.nearbyHalal(b, 3);
  if (!list.length) return '';
  return `<div class="similar">
    <div class="section-head" style="padding:0 14px"><div class="section-title">${t('nearbyHalal')}
      <small>${t('nearbyHalalSub')}</small></div></div>
    <div class="pad">
      ${list.map(x => `<div class="list-row" data-route="#/directory/${x.id}">
        <span class="row-ico">${icon(catIcon(x.cat), 20)}</span>
        <div class="row-main">
          <div class="row-title">${L(x.name)}${bizBadge(x)}</div>
          <div class="row-sub">${distLabel(x)}${openBadge(x)}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

/** the subscription upsell, sized like a business row.
    A visitor gets the same offer with the number replaced by the gate. */
function upsellHtml() {
  return `<div class="list-row" data-route="#/subscribe" style="border-color:var(--line)">
    <span class="row-ico" style="color:var(--gold-bright)">${icon('crown', 22)}</span>
    <div class="row-main">
      <div class="row-title">${t('upgradeBanner')}</div>
      <div class="row-sub gold">${showsPrices()
        ? `<span class="ltr">${fmtMoney(SUBSCRIPTION_PRICE)}</span> ${t('month')}`
        : t('pricesAfterSignup')}</div>
    </div>
    <span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 19)}</span>
  </div>`;
}

/* --------------------------- DETAIL --------------------------- */
export function ListingScreen(root, params) {
  const b = S.businessById(params[0]);
  if (!b) { go('#/directory'); return; }
  renderHeader({ hidden: true });

  const paid = S.isPaid(b);
  const revs = S.reviewsFor(b.id);
  const rate = S.ratingFor(b);
  const myRev = S.myReviewFor(b.id);
  const mine = S.ownsBusiness(b.id);
  const photos = S.visiblePhotos(b);
  const hero = S.heroPhoto(b);
  const claim = S.claimFor(b.id);

  root.innerHTML = `
    <div class="detail-hero ${hero ? 'has-photo' : ''}">
      <button class="back-btn" id="bk">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 22)}</button>
      ${hero ? `<img class="hero-img" src="${hero}" alt="${L(b.name)}" />`
             : `<div style="color:var(--gold-bright)">${icon(catIcon(b.cat), 54)}</div>`}
    </div>

    <div class="detail-body">
      <div class="row-between">
        <div>
          <div class="detail-title">${L(b.name)}${bizBadge(b)}</div>
          <div class="row-sub">${rate.count
            ? stars(rate.avg) + `<span>· ${rate.count} ${t('reviews')}</span>`
            : `<span class="muted fs-12">${t('noReviewsYet')}</span>`}</div>
        </div>
        <button class="icon-btn" id="saveBtn">${icon('heart', 22)}</button>
      </div>

      <p class="fs-13 muted mt-12">${L(b.desc || '')}</p>
      ${attrChips(b)}

      ${/* A button that cannot do anything is worse than no button: nine of
            these parks have no line at all, so the call button is removed
            rather than shown greyed out. The grid collapses to one column
            so the survivor is full width, not half of a missing pair. */''}
      <div class="action-grid" ${b.phone && b.address ? '' : 'style="grid-template-columns:1fr"'}>
        ${b.phone ? `<button class="btn btn-gold" id="callBtn">${icon('phone', 20)} ${t('call')}</button>` : ''}
        ${b.address ? `<button class="btn ${b.phone ? 'btn-ghost' : 'btn-gold'}" id="mapBtn">${icon('navigation', 20)} ${t('directions')}</button>` : ''}
      </div>

      ${b.phone
        ? `<div class="info-row"><span class="i-ico">${icon('phone', 21)}</span><div class="i-txt"><b class="ltr">${b.phone}</b><span>${t('phoneLabel')}</span></div></div>`
        : b.address
          ? `<div class="info-row"><span class="i-ico">${icon('phone', 21)}</span><div class="i-txt"><b class="muted">${t('noPhoneUseMap')}</b><span>${t('phoneLabel')}</span></div></div>`
          : ''}
      ${b.address
        ? `<div class="info-row"><span class="i-ico">${icon('mapPin', 21)}</span><div class="i-txt"><b class="ltr">${b.address}</b><span>${t('address')}${b.dist ? ` · ${b.dist} ${t('miles')} ${t('distanceAway')}` : ''}</span></div></div>`
        : ''}
      ${hoursBlock(b)}
      ${worshipBlock(b)}
      <div class="info-row">${`<span class="i-ico">${icon('bookmark', 21)}</span>`}<div class="i-txt"><b>${t(catKey(b.cat))}</b><span>${t('category')}</span></div></div>
      ${outingBlock(b)}

      ${photos.length ? `
        <div class="section-head" style="padding:0;margin-top:20px"><div class="section-title">${t('photos')}</div></div>
        <div class="photo-strip">
          ${photos.map(p => `<div class="photo-tile shot ${p.status === 'pending' ? 'pending' : ''}">
            <img src="${p.url}" alt="" loading="lazy" />
            ${p.status === 'pending' ? `<span class="shot-flag">${t('statusPending')}</span>` : ''}
          </div>`).join('')}
        </div>` : ''}
      ${mine ? `<button class="btn btn-ghost btn-block mt-12" data-route="#/business/photos/${b.id}">
        ${icon('camera', 19)} ${t('managePhotos')}</button>` : ''}

      <div class="section-head" style="padding:0;margin-top:20px">
        <div class="section-title">${t('reviewsTitle')}<small>${rate.count ? `${rate.avg} · ${rate.count} ${t('reviews')}` : t('noReviewsYet')}</small></div>
      </div>
      <div id="revList">
        ${revs.length ? revs.map(r => reviewHtml(r, mine)).join('') : reviewsEmpty()}
      </div>
      <button class="btn ${revs.length ? 'btn-ghost' : 'btn-gold'} btn-block mt-12" id="revBtn">
        ${icon('edit', 19)} ${myRev ? t('editReview') : t('writeReview')}</button>

      ${ownerBlock(b, mine, paid, claim)}

      <div class="action-grid mt-16">
        <button class="btn btn-ghost btn-sm" id="shareBtn">${icon('share', 18)} ${t('share')}</button>
        <button class="btn btn-ghost btn-sm" id="repBtn">${icon('flag', 18)} ${t('report')}</button>
      </div>
    </div>

    ${halalNearbyBlock(b)}
    ${similarBlock(b, paid)}`;

  $('#bk').addEventListener('click', () => back());
  // the page was opened — the number the subscriber is shown next month
  S.recordBizView(b.id);

  const callBtn = $('#callBtn');
  if (callBtn) callBtn.addEventListener('click', () => {
    S.recordBizCall(b.id);
    location.href = 'tel:' + b.phone;
  });
  const mapBtn = $('#mapBtn');
  if (mapBtn) mapBtn.addEventListener('click', () => {
    S.recordBizDirections(b.id);
    openMaps(b.address);
  });
  $('#shareBtn').addEventListener('click', () => shareItem(L(b.name), location.href));
  $('#repBtn').addEventListener('click', () => { S.reportItem(b.id); toast(t('reported'), 'ok'); });

  const sb = $('#saveBtn');
  const paintSave = () => { sb.innerHTML = icon('heart', 22); sb.style.color = S.isSaved(b.id) ? 'var(--gold-bright)' : ''; };
  paintSave();
  sb.addEventListener('click', () => {
    if (!S.requireTier(1, location.hash, go)) return;
    S.toggleSaved(b.id);
    if (S.isSaved(b.id)) S.recordBizSave(b.id);
    paintSave();
    toast(S.isSaved(b.id) ? t('saved') : t('done'), 'ok');
  });

  const rv = $('#revBtn');
  if (rv) rv.addEventListener('click', () => {
    if (!S.requireTier(1, location.hash, go)) return;
    openReviewSheet(b.id, () => go('#/directory/' + b.id));
  });

  const cl = $('#claimBtn');
  if (cl) cl.addEventListener('click', () => go('#/claim/' + b.id));

  const vf = $('#verifyBtn');
  if (vf) vf.addEventListener('click', () => go('#/verify-business/' + b.id));

  // the owner answering a review, in place
  $$('[data-reply]').forEach(btn => btn.addEventListener('click', () =>
    openReplySheet(btn.dataset.reply, () => go('#/directory/' + b.id))));
  $$('[data-delreply]').forEach(btn => btn.addEventListener('click', () => confirmSheet({
    title: t('delete'), sub: t('ownerReply'), confirmText: t('delete'), danger: true,
    onConfirm: () => { S.deleteReply(btn.dataset.delreply); toast(t('done'), 'ok'); go('#/directory/' + b.id); },
  })));

  $$('[data-editrev]').forEach(btn => btn.addEventListener('click', () => {
    openReviewSheet(b.id, () => go('#/directory/' + b.id));
  }));
  $$('[data-delrev]').forEach(btn => btn.addEventListener('click', () => confirmSheet({
    title: t('delete'), sub: t('myReviewOn') + ' ' + L(b.name), confirmText: t('delete'), danger: true,
    onConfirm: () => { S.deleteReview(btn.dataset.delrev); toast(t('reviewDeleted'), 'ok'); go('#/directory/' + b.id); }
  })));

  wireRoutes(root);
}

/** No reviews yet is a designed state, not a blank gap. */
function reviewsEmpty() {
  return `<div class="rev-empty">
    <div class="rev-empty-ico">${icon('star', 30)}</div>
    <b>${t('noReviewsYet')}</b>
    <span>${t('beFirstReview')}</span>
  </div>`;
}

/**
 * The owner's own controls, and the claim invitation for everyone else.
 * The claim button lives here because almost every shop owner arrives at
 * their own page from a link or a search, never from a claim screen.
 */
function ownerBlock(b, mine, paid, claim) {
  /* A city park has no owner to claim it and nobody to sell a subscription
     to. Leaving those on would read as a plain bug on the page of a place
     everybody knows is public — so the commercial half goes, while whoever
     entered the record keeps the controls that maintain it. */
  const publicPlace = S.isNonCommercial(b);
  const publicNote = `<div class="list-note" style="margin-inline:0">${icon('landmark', 18)}<span>${t('nonCommercialNote')}</span></div>`;
  if (mine) {
    const verified = S.businessVerified(b);
    const vs = S.bizVerifyState(b.id);
    return `<div class="owner-box">
      <div class="owner-head">${icon('briefcase', 18)} <b>${t('youOwnThis')}</b></div>
      <div class="action-grid" style="margin:10px 0 0">
        <button class="btn btn-ghost btn-sm" data-route="#/business/edit/${b.id}">${icon('edit', 18)} ${t('editBusiness')}</button>
        <button class="btn btn-ghost btn-sm" data-route="#/business/photos/${b.id}">${icon('camera', 18)} ${t('managePhotos')}</button>
      </div>
      ${publicPlace ? '' : verified
        ? `<div class="ok-msg" style="text-align:center">${t('bizVerifiedOn')}</div>`
        : vs && vs.status === 'pending'
          ? `<div class="hint" style="text-align:center">${t('bizVerifyPending')}</div>`
          : paid
            ? `<button class="btn btn-outline-gold btn-block mt-8" id="verifyBtn">${icon('checkCircle', 19)} ${t('verifyBusiness')}</button>
               ${vs && vs.status === 'rejected' && vs.reason ? `<div class="err-msg">${icon('alert', 15)} ${vs.reason}</div>` : ''}`
            : `<div class="hint" style="text-align:center">${t('verifyNeedsPlan')}</div>`}
      ${publicPlace ? publicNote : !paid ? `<div class="upsell" style="margin:12px 0 0">
        <div class="upsell-txt"><b>${t('upgradeBanner')}</b><span>${showsPrices()
          ? fmtMoney(SUBSCRIPTION_PRICE) + ' ' + t('month') : t('pricesAfterSignup')}</span></div>
        <button class="btn btn-gold btn-sm" data-route="#/subscribe/${b.id}">${t('upgradeBtn')}</button>
      </div>` : ''}
    </div>`;
  }
  if (publicPlace) return publicNote;
  if (claim && claim.status === 'pending') {
    return `<div class="list-note" style="margin-inline:0">${icon('clock', 18)}<span>${t('claimPending')}</span></div>`;
  }
  if (b.claimed) return '';
  return `<div class="claim-box">
    <div class="claim-txt"><b>${t('isThisYours')}</b><span>${t('claimSub')}</span></div>
    <button class="btn btn-gold btn-block mt-8" id="claimBtn">${icon('briefcase', 19)} ${t('claimThis')}</button>
  </div>`;
}

/**
 * Nearby shops of the same kind, at the very foot of a free page and never
 * on a subscriber's. These are plain suggestions: no one can buy a slot on
 * a competitor's page. Houston's community is small and its shop owners talk
 * to each other; "pay to bury your rival" would cost more than it earns.
 */
function similarBlock(b, paid) {
  if (paid) return '';
  const list = S.similarTo(b, 4);
  if (!list.length) return '';
  return `<div class="similar">
    <div class="section-head" style="padding:0 14px"><div class="section-title">${t('similarNearby')}
      <small>${t('similarSub')}</small></div></div>
    <div class="pad">
      ${list.map(x => `<div class="list-row" data-route="#/directory/${x.id}">
        <span class="row-ico">${icon(catIcon(x.cat), 20)}</span>
        <div class="row-main">
          <div class="row-title">${L(x.name)}${bizBadge(x)}</div>
          <div class="row-sub">${distLabel(x)}${openBadge(x)}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

/** the owner answering one review */
export function openReplySheet(reviewId, onSaved) {
  const existing = S.replyFor(reviewId);
  openSheet(`
    <div class="sheet-title">${t('ownerReply')}</div>
    <div class="sheet-sub">${t('ownerReplySub')}</div>
    <div class="field"><textarea class="textarea" id="rpTxt">${existing ? existing.text : ''}</textarea></div>
    <button class="btn btn-gold btn-block" id="rpSend">${t('send')}</button>
  `, (panel) => {
    panel.querySelector('#rpSend').addEventListener('click', () => {
      const txt = panel.querySelector('#rpTxt').value.trim();
      if (!txt) { toast(t('required'), 'err'); return; }
      S.replyToReview(reviewId, txt);
      closeSheet();
      toast(t('done'), 'ok');
      if (onSaved) onSaved();
    });
  });
}

function lockedBlock(title, sub) {
  return `<div class="locked mt-12">
    <div class="lk-ico">${icon('lock', 31)}</div>
    <b>${title}</b><span>${sub || t('lockedSub')}</span>
    <button class="btn btn-outline-gold btn-sm" data-route="#/subscribe">${t('upgradeBtn')}</button>
  </div>`;
}

/** One review card. Mine gets edit / delete; the owner gets a reply. */
export function reviewHtml(r, isOwner = false) {
  const reply = r.id ? S.replyFor(r.id) : null;
  return `<div class="review" data-rev="${r.id || ''}">
    <div class="review-head">
      <span class="avatar">${(r.user || '?')[0]}</span>
      <div><b class="fs-13">${r.user}</b><div class="fs-12 muted">${L(r.when)} · ${stars(r.rating)}</div></div>
    </div>
    <p>${L(r.text)}</p>
    ${reply ? `<div class="owner-reply">
      <div class="or-head">${icon('briefcase', 14)} ${t('ownerReply')}</div>
      <p>${reply.text}</p>
      ${isOwner ? `<div class="row-actions">
        <button class="mini-btn" data-reply="${r.id}">${icon('edit', 15)} ${t('edit')}</button>
        <button class="mini-btn" data-delreply="${r.id}">${icon('trash', 15)}</button>
      </div>` : ''}
    </div>` : ''}
    ${r.mine ? `<div class="row-actions">
      <button class="mini-btn gold" data-editrev="${r.id}">${icon('edit', 15)} ${t('edit')}</button>
      <button class="mini-btn" data-delrev="${r.id}">${icon('trash', 15)} ${t('delete')}</button>
    </div>` : ''}
    ${isOwner && !reply && r.id ? `<div class="row-actions">
      <button class="mini-btn gold" data-reply="${r.id}">${icon('message', 15)} ${t('replyToReview')}</button>
    </div>` : ''}
  </div>`;
}

/**
 * Write or edit a review. Saves through the store, so the business page,
 * the rating average and "My reviews" all update from the same record.
 */
export function openReviewSheet(bizId, onSaved) {
  const existing = S.myReviewFor(bizId);
  let rating = existing ? existing.rating : 5;

  openSheet(`
    <div class="sheet-title">${existing ? t('editReview') : t('writeReview')}</div>
    <div class="sheet-sub">${t('yourRating')}</div>
    <div id="rateRow" style="display:flex;gap:8px;justify-content:center;margin-bottom:14px">
      ${[1, 2, 3, 4, 5].map(i => `<button data-s="${i}" style="color:var(--gold-bright)">${icon('star', 33)}</button>`).join('')}
    </div>
    <div class="field"><label class="label">${t('yourReview')}</label>
      <textarea class="textarea" id="revTxt" placeholder="...">${existing ? L(existing.text) : ''}</textarea></div>
    <button class="btn btn-gold btn-block" id="revSend">${t('submitReview')}</button>
  `, (panel) => {
    const paint = () => panel.querySelectorAll('#rateRow button')
      .forEach(b => b.style.opacity = (+b.dataset.s <= rating) ? '1' : '.25');
    paint();
    panel.querySelectorAll('#rateRow button').forEach(b =>
      b.addEventListener('click', () => { rating = +b.dataset.s; paint(); }));

    panel.querySelector('#revSend').addEventListener('click', () => {
      const txt = panel.querySelector('#revTxt').value.trim();
      if (!txt) { toast(t('required'), 'err'); return; }
      S.addReview(bizId, rating, txt);
      closeSheet();
      toast(existing ? t('reviewUpdated') : t('reviewThanks'), 'ok');
      if (onSaved) onSaved();
    });
  });
}

function catKey(id) {
  const c = CATEGORIES.find(x => x.id === id);
  return c ? c.key : 'catAll';
}

/* --------------------- ADD / CLAIM BUSINESS --------------------- */
export function AddBusinessScreen(root) {
  renderHeader({ simple: true, title: t('addBusiness') });
  let cat = CATEGORIES.filter(c => !c.route)[0].id;
  let picked = [];

  const dayRow = (i) => `
    <div class="hrs-row" data-day="${i}">
      <label class="hrs-day"><input type="checkbox" data-open="${i}" checked /> <span>${t(DAY_KEYS[i])}</span></label>
      <input class="input hrs-t" type="time" data-from="${i}" value="09:00" />
      <span class="hrs-dash">–</span>
      <input class="input hrs-t" type="time" data-to="${i}" value="18:00" />
    </div>`;

  root.innerHTML = `
    <div class="pad mt-16">
      <div class="list-note" style="margin:0 0 14px">${icon('info', 18)}<span>${t('needPhoneSub')}</span></div>
      <div class="field"><label class="label">${t('nameEn')}</label><input class="input ltr" id="bName" dir="ltr" /></div>
      <div class="field"><label class="label">${t('nameAr')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="bNameAr" />
        <div class="hint">${t('nameArHint')}</div></div>
      <div class="field"><label class="label">${t('category')}</label>
        <select class="select" id="bCat">${CATEGORIES.filter(c => !c.route).map(c => `<option value="${c.id}">${t(c.key)}</option>`).join('')}</select></div>
      <div class="field"><label class="label">${t('phoneLabel')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="bPhone" inputmode="tel" placeholder="(713) 555-0000" />
        <div class="hint">${t('phoneOptionalHint')}</div></div>
      <div class="field"><label class="label">${t('address')} <span class="muted">(${t('optional')})</span></label><input class="input" id="bAddr" /></div>

      <div class="field"><label class="label">${t('keywords')}</label>
        <input class="input" id="bTags" placeholder="شاورما، مشاوي، shawarma" />
        <div class="hint">${t('keywordsHint')}</div></div>

      <div class="field"><label class="label">${t('hoursTitle')}</label>
        <div class="hrs-grid">${[0, 1, 2, 3, 4, 5, 6].map(dayRow).join('')}</div></div>

      <div class="field"><label class="label">${t('features')}</label>
        <div id="bAttrs"></div></div>

      <div class="field" id="bEntryField" hidden><label class="label">${t('entryPrice')} <span class="muted">(${t('optional')})</span></label>
        <input class="input ltr" id="bEntry" dir="ltr" placeholder="$12 / person" />
        <div class="hint">${t('entryPriceHint')}</div></div>

      <label class="consent-row mt-12">
        <input type="checkbox" id="bNonComm" />
        <span><b>${t('nonCommercial')}</b><br><span class="muted fs-12">${t('nonCommercialHint')}</span></span>
      </label>

      <div class="field mt-12"><label class="label">${t('descLabel')} <span class="muted">(${t('optional')})</span></label><textarea class="textarea" id="bDesc"></textarea></div>
      <div id="bDup"></div>
      <button class="btn btn-gold btn-block" id="bSave">${t('addBusiness')}</button>
      <div class="hint" style="text-align:center;margin-top:10px">${t('lockedSub')}</div>
    </div>`;

  /* The checkboxes are generated from the registry for the chosen category —
     nothing about "halal" or "women only" is written here, so a new attribute
     appears in this form the moment it is added to data.js. */
  const paintAttrs = () => {
    $('#bAttrs').innerHTML = S.attrGroupsForCat(cat, { all: true }).map(g => `
      <div class="attr-group">
        <div class="attr-group-label">${t(g.group.key)}</div>
        <div class="attr-pick">
          ${g.attrs.map(a => `<button type="button" class="chip ${picked.includes(a.id) ? 'active' : ''}" data-a="${a.id}">
            ${icon(a.icon, 14)} ${t(a.key)}</button>`).join('')}
        </div>
      </div>`).join('') || `<div class="hint">${t('noHours')}</div>`;
    $$('#bAttrs .chip').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.a;
      const attr = S.attrById(id);
      const i = picked.indexOf(id);
      if (i >= 0) picked.splice(i, 1);
      else {
        // an exclusive group holds one answer: halal or not, cards or cash
        if (attr && attr.exclusive) {
          picked = picked.filter(x => {
            const o = S.attrById(x);
            return !(o && o.exclusive && o.group === attr.group);
          });
        }
        picked.push(id);
      }
      $$('#bAttrs .chip').forEach(x => x.classList.toggle('active', picked.includes(x.dataset.a)));
    }));
  };
  paintAttrs();

  /* the entry price is only a question for an outing — nobody asks a
     dentist what it costs to walk in */
  const paintEntry = () => { $('#bEntryField').hidden = cat !== 'outings'; };
  paintEntry();

  $('#bCat').addEventListener('change', (e) => {
    cat = e.target.value;
    const valid = S.attrsForCat(cat).map(a => a.id);
    picked = picked.filter(id => valid.includes(id));
    paintAttrs();
    paintEntry();
  });

  /** the seven day rows → the canonical hours array */
  const readHours = () => [0, 1, 2, 3, 4, 5, 6].map(i => {
    if (!$(`[data-open="${i}"]`).checked) return null;
    const from = $(`[data-from="${i}"]`).value || '09:00';
    const to = $(`[data-to="${i}"]`).value || '18:00';
    return [[from, to]];
  });

  const collect = () => ({
    name: $('#bName').value.trim(),
    nameAr: $('#bNameAr').value.trim(),
    phone: $('#bPhone').value.trim(),
    address: $('#bAddr').value.trim(),
  });

  const save = (pendingReview = false) => {
    const { name, nameAr, phone, address } = collect();
    const tags = $('#bTags').value.split(/[,\u060C\n]/).map(x => x.trim()).filter(Boolean);
    const rec = S.addBusiness({
      // Most shops here trade under an English name only. Rather than invent
      // an Arabic one, the English name stands in both fields.
      name: { ar: nameAr || name, en: name }, cat, phone, address,
      hours: readHours(), tags, attributes: picked.slice(),
      nonCommercial: $('#bNonComm').checked,
      entryPrice: cat === 'outings' ? $('#bEntry').value.trim() : '',
      desc: { ar: $('#bDesc').value, en: $('#bDesc').value },
    }, { pendingReview });
    toast(pendingReview ? t('bizHeldForReview') : t('done'), 'ok');
    go('#/directory/' + rec.id);
  };

  $('#bSave').addEventListener('click', () => {
    const { name, phone, address } = collect();
    // the name is the only thing a listing cannot do without
    if (!name) { toast(t('required'), 'err'); return; }
    if (!S.requireTier(2, '#/add-business', go)) return;

    /* Their own shop is very often already here — they just could not
       find it. Show them, and let them take it over instead. */
    const dups = S.findDuplicates({ phone, name, address, cat });
    if (dups.length) {
      openSimilarSheet(dups, (conf) => save(conf === 'certain'));
      return;
    }
    save();
  });
}

/**
 * What happens when a listing looks like one we already have.
 *
 * It never says "duplicate" and it never refuses. Somebody typing their
 * own shop's name into an app is the most valuable moment we get: the
 * screen shows them the page that already exists and offers to hand it
 * over. A blocked form turns that person away; this turns them into an
 * ownership claim, which is the whole commercial point.
 *
 * @param hits      findDuplicates() output, strongest first
 * @param onProceed (confidence) => void — they say it is a different shop
 */
export function openSimilarSheet(hits, onProceed) {
  const top = hits[0];
  const rest = hits.slice(1, 3);
  const conf = top.confidence;
  const why = { phone: t('dupByPhone'), nameAddress: t('dupByNameAddress'),
                nameZip: t('dupByNameZip'), name: t('dupByName'),
                address: t('dupByAddress') }[top.reason] || t('dupByName');
  const hero = S.heroPhoto(top.biz);

  openSheet(`
    <div class="sheet-title">${t('similarFoundTitle')}</div>
    <div class="sheet-sub">${t('similarFoundSub')}</div>

    <div class="sim-card">
      ${hero ? `<img class="sim-photo" src="${hero}" alt="" />`
             : `<span class="sim-ico">${icon(catIcon(top.biz.cat), 26)}</span>`}
      <div class="sim-main">
        <div class="row-title">${L(top.biz.name)}${bizBadge(top.biz)}</div>
        <div class="row-sub"><span>${t(catKey(top.biz.cat))}</span></div>
        ${top.biz.address ? `<div class="row-sub"><span class="ltr">${top.biz.address}</span></div>` : ''}
        ${top.biz.phone ? `<div class="row-sub"><span class="ltr">${top.biz.phone}</span></div>` : ''}
        <div class="row-sub gold">${why}</div>
      </div>
    </div>
    <button class="btn btn-ghost btn-sm btn-block" id="simOpen">${icon('eye', 17)} ${t('similarOpenPage')}</button>

    ${rest.length ? `<div class="hint mt-12">${t('similarAlso')}</div>
      ${rest.map(h => `<div class="list-row" style="margin-top:6px" data-sim="${h.biz.id}">
        <span class="row-ico">${icon(catIcon(h.biz.cat), 20)}</span>
        <div class="row-main"><div class="row-title">${L(h.biz.name)}</div>
          <div class="row-sub"><span class="ltr">${h.biz.address || ''}</span></div></div>
      </div>`).join('')}` : ''}

    <button class="btn btn-gold btn-block mt-16" id="simClaim">${icon('briefcase', 19)} ${t('similarMine')}</button>
    <button class="btn btn-ghost btn-block mt-8" id="simDiff">${t('similarDifferent')}</button>
    ${conf === 'certain' ? `<div class="hint" style="text-align:center;margin-top:6px">${t('similarReviewNote')}</div>` : ''}
    <button class="btn btn-plain btn-block mt-8" id="simBack">${t('back')}</button>
  `, (panel) => {
    panel.querySelector('#simOpen').addEventListener('click', () => {
      closeSheet(); go('#/directory/' + top.biz.id);
    });
    panel.querySelectorAll('[data-sim]').forEach(r => r.addEventListener('click', () => {
      closeSheet(); go('#/directory/' + r.dataset.sim);
    }));
    panel.querySelector('#simClaim').addEventListener('click', () => {
      closeSheet(); go('#/claim/' + top.biz.id);
    });
    panel.querySelector('#simDiff').addEventListener('click', () => {
      closeSheet(); onProceed(conf);
    });
    panel.querySelector('#simBack').addEventListener('click', () => closeSheet());
  });
}

/**
 * Claiming is a request now, not a tap. Ownership of a page carries the
 * right to edit it, answer reviews and take money, so a person has to say
 * who they are and an admin has to agree.
 */
export function ClaimScreen(root, params) {
  const bizId = params && params[0];
  if (!bizId) { pickBusinessToClaim(root); return; }

  const b = S.businessById(bizId);
  if (!b) { go('#/claim'); return; }
  renderHeader({ simple: true, title: t('claimBusiness') });

  const existing = S.claimFor(bizId);
  if (existing && existing.status === 'pending') {
    root.innerHTML = `
      <div class="pad mt-20 center-col">
        <div class="empty-ico">${icon('clock', 33)}</div>
        <b style="font-size:17px">${t('claimPendingTitle')}</b>
        <span class="muted fs-13">${t('claimPending')}</span>
        <button class="btn btn-ghost mt-16" data-route="#/directory/${bizId}">${t('back')}</button>
      </div>`;
    wireRoutes(root);
    return;
  }

  root.innerHTML = `
    <div class="pad mt-16">
      <div class="list-row" style="margin-bottom:14px">
        <span class="row-ico">${icon(catIcon(b.cat), 20)}</span>
        <div class="row-main"><div class="row-title">${L(b.name)}</div>
          <div class="row-sub"><span class="ltr">${b.address}</span></div></div>
      </div>
      <div class="list-note" style="margin:0 0 14px">${icon('info', 18)}<span>${t('claimFormNote')}</span></div>

      <div class="field"><label class="label">${t('claimYourName')}</label><input class="input" id="cName" /></div>
      <div class="field"><label class="label">${t('claimRole')}</label>
        <select class="select" id="cRole">
          <option value="owner">${t('roleOwner')}</option>
          <option value="manager">${t('roleManager')}</option>
          <option value="staff">${t('roleStaff')}</option>
        </select></div>
      <div class="field"><label class="label">${t('claimPhone')}</label>
        <input class="input" id="cPhone" inputmode="tel" placeholder="(713) 555-0000" /></div>
      <div class="field"><label class="label">${t('claimProof')}</label>
        <textarea class="textarea" id="cProof" placeholder="${t('claimProofHint')}"></textarea>
        <div class="hint">${t('claimProofHint2')}</div></div>

      <button class="btn btn-gold btn-block" id="cSend">${icon('send', 19)} ${t('claimSend')}</button>
    </div>`;

  $('#cSend').addEventListener('click', () => {
    const name = $('#cName').value.trim();
    const phone = $('#cPhone').value.trim();
    if (!name || !phone) { toast(t('required'), 'err'); return; }
    // a real mobile is the same bar as posting or paying
    if (!S.requireTier(2, '#/claim/' + bizId, go)) return;
    S.requestClaim(bizId, { name, phone, role: $('#cRole').value, proof: $('#cProof').value.trim() });
    toast(t('claimSent'), 'ok');
    go('#/directory/' + bizId);
  });
  wireRoutes(root);
}

/** the old list, kept as a way in for anyone who arrives without an id */
function pickBusinessToClaim(root) {
  renderHeader({ simple: true, title: t('claimBusiness') });
  const unclaimed = S.allBusinesses().filter(b => !b.claimed);
  root.innerHTML = `
    <div class="search-row solo mt-12"><div class="search-bar big">${icon('search', 22)}<input id="clSearch" placeholder="${t('searchExample')}" /></div></div>
    <div class="list-note">${icon('info', 18)}<span>${t('claimFormNote')}</span></div>
    <div class="pad mt-12" id="clList"></div>
    <div class="pad"><button class="btn btn-ghost btn-block" data-route="#/add-business">${icon('plus', 19)} ${t('addBusiness')}</button></div>`;

  const paint = (term = '') => {
    const list = unclaimed.filter(b => !term || L(b.name).toLowerCase().includes(term.toLowerCase()));
    $('#clList').innerHTML = list.length ? list.map(b => `
      <div class="list-row">
        <span class="row-ico">${icon(catIcon(b.cat), 20)}</span>
        <div class="row-main">
          <div class="row-title">${L(b.name)}</div>
          <div class="row-sub">${icon('mapPin', 13)} <span class="ltr">${b.address}</span></div>
          <div class="row-actions"><button class="mini-btn gold" data-claim="${b.id}">${icon('check', 15)} ${t('claimIt')}</button></div>
        </div>
      </div>`).join('') : emptyState('search', t('emptyDirTitle'), t('emptyDirSub'));
    $$('#clList [data-claim]').forEach(btn =>
      btn.addEventListener('click', () => go('#/claim/' + btn.dataset.claim)));
  };
  paint();
  $('#clSearch').addEventListener('input', e => paint(e.target.value));
  wireRoutes(root);
}

/* ------------------- OWNER: EDIT + PHOTOS + VERIFY ------------------- */

/** only the approved owner may open these */
function ownerOnly(bizId) {
  if (!S.ownsBusiness(bizId)) { go('#/directory/' + bizId); return false; }
  return true;
}

export function BusinessEditScreen(root, params) {
  const b = S.businessById(params[0]);
  if (!b) { go('#/directory'); return; }
  if (!ownerOnly(b.id)) return;
  renderHeader({ simple: true, title: t('editBusiness') });

  let picked = (b.attributes || []).slice();
  const cat = b.cat;

  root.innerHTML = `
    <div class="pad mt-16">
      <div class="field"><label class="label">${t('nameEn')}</label>
        <input class="input ltr" id="eName" dir="ltr" value="${attr((b.name && b.name.en) || '')}" /></div>
      <div class="field"><label class="label">${t('nameAr')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="eNameAr" value="${attr((b.name && b.name.ar) || '')}" />
        <div class="hint">${t('nameArHint')}</div></div>
      <div class="field"><label class="label">${t('phoneLabel')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="ePhone" inputmode="tel" value="${attr(b.phone || '')}" />
        <div class="hint">${t('phoneOptionalHint')}</div></div>
      <div class="field"><label class="label">${t('address')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="eAddr" value="${attr(b.address || '')}" /></div>
      <div class="field"><label class="label">${t('descLabel')}</label><textarea class="textarea" id="eDesc">${L(b.desc || '')}</textarea></div>
      <div class="field"><label class="label">${t('keywords')}</label>
        <input class="input" id="eTags" value="${attr((b.tags || []).join('، '))}" />
        <div class="hint">${t('keywordsHint')}</div></div>
      <div class="field"><label class="label">${t('features')}</label><div id="eAttrs"></div></div>
      ${cat === 'outings' ? `<div class="field"><label class="label">${t('entryPrice')} <span class="muted">(${t('optional')})</span></label>
        <input class="input ltr" id="eEntry" dir="ltr" value="${attr(b.entryPrice || '')}" placeholder="$12 / person" />
        <div class="hint">${t('entryPriceHint')}</div></div>` : ''}
      <label class="consent-row" style="margin:4px 0 16px">
        <input type="checkbox" id="eNonComm" ${b.nonCommercial ? 'checked' : ''} />
        <span><b>${t('nonCommercial')}</b><br><span class="muted fs-12">${t('nonCommercialHint')}</span></span>
      </label>
      <button class="btn btn-gold btn-block" id="eSave">${icon('check', 19)} ${t('saveChanges')}</button>
    </div>`;

  const paintAttrs = () => {
    $('#eAttrs').innerHTML = S.attrGroupsForCat(cat, { all: true }).map(g => `
      <div class="attr-group">
        <div class="attr-group-label">${t(g.group.key)}</div>
        <div class="attr-pick">
          ${g.attrs.map(a => `<button type="button" class="chip ${picked.includes(a.id) ? 'active' : ''}" data-a="${a.id}">
            ${icon(a.icon, 14)} ${t(a.key)}</button>`).join('')}
        </div>
      </div>`).join('');
    $$('#eAttrs .chip').forEach(x => x.addEventListener('click', () => {
      const id = x.dataset.a, a = S.attrById(id), i = picked.indexOf(id);
      if (i >= 0) picked.splice(i, 1);
      else {
        if (a && a.exclusive) picked = picked.filter(o => {
          const oa = S.attrById(o); return !(oa && oa.exclusive && oa.group === a.group);
        });
        picked.push(id);
      }
      $$('#eAttrs .chip').forEach(y => y.classList.toggle('active', picked.includes(y.dataset.a)));
    }));
  };
  paintAttrs();

  $('#eSave').addEventListener('click', () => {
    const name = $('#eName').value.trim();
    const nameAr = $('#eNameAr').value.trim();
    if (!name) { toast(t('required'), 'err'); return; }
    S.applyBusinessEdit(b.id, {
      name: { ar: nameAr || name, en: name },
      phone: $('#ePhone').value.trim(),
      address: $('#eAddr').value.trim(),
      desc: { ar: $('#eDesc').value, en: $('#eDesc').value },
      tags: $('#eTags').value.split(/[,\u060C\n]/).map(x => x.trim()).filter(Boolean),
      attributes: picked.slice(),
      nonCommercial: $('#eNonComm').checked,
      entryPrice: cat === 'outings' ? $('#eEntry').value.trim() : (b.entryPrice || ''),
    });
    toast(t('done'), 'ok');
    go('#/directory/' + b.id);
  });
}

/**
 * Photos, through the same compression path the marketplace uses.
 * A free listing holds three; a subscriber is unlimited. Every upload
 * waits on the admin, exactly like a profile picture.
 */
export function BusinessPhotosScreen(root, params) {
  const b = S.businessById(params[0]);
  if (!b) { go('#/directory'); return; }
  if (!ownerOnly(b.id)) return;
  renderHeader({ simple: true, title: t('managePhotos') });

  const limits = S.planLimits(b);
  const max = limits.photos === Infinity ? 20 : limits.photos;
  const current = S.bizPhotos(b.id);

  root.innerHTML = `
    <div class="pad mt-16">
      <div class="list-note" style="margin:0 0 14px">${icon('info', 18)}<span>${t('photosReviewNote')}</span></div>
      <div class="hint" style="margin-bottom:10px">${limits.photos === Infinity
        ? t('photosUnlimited') : t('photosFreeLimit')}</div>
      <div id="phHost"></div>
      <button class="btn btn-gold btn-block mt-12" id="phSave">${icon('check', 19)} ${t('saveChanges')}</button>
      ${limits.photos !== Infinity ? `<div class="upsell" style="margin:14px 0 0">
        <div class="upsell-txt"><b>${t('photosUpsell')}</b><span>${showsPrices()
          ? fmtMoney(SUBSCRIPTION_PRICE) + ' ' + t('month') : t('pricesAfterSignup')}</span></div>
        <button class="btn btn-gold btn-sm" data-route="#/subscribe/${b.id}">${t('upgradeBtn')}</button>
      </div>` : ''}
    </div>`;

  const pic = mountPhotoPicker($('#phHost'), current.map(p => p.url), 0, max);
  $('#phSave').addEventListener('click', () => {
    S.setBizPhotos(b.id, pic.photos);
    if (!S.lastSaveOk) { toast(t('storageFull'), 'err'); return; }
    toast(t('photosQueued'), 'ok');
    go('#/directory/' + b.id);
  });
  wireRoutes(root);
}

/**
 * Business verification. The flow is real; the provider is not wired yet.
 * Consent is asked separately and before anything is captured — that is a
 * legal requirement rather than a design preference: Texas CUBI wants prior
 * consent and destruction within a year, and Illinois allows private suits.
 * When Stripe Identity goes in, the documents are uploaded *to them*; this
 * app receives a pass/fail and a reference and stores nothing else.
 */
export function BusinessVerifyScreen(root, params) {
  const b = S.businessById(params[0]);
  if (!b) { go('#/directory'); return; }
  if (!ownerOnly(b.id)) return;
  renderHeader({ simple: true, title: t('verifyBusiness') });

  const st = S.bizVerifyState(b.id);
  if (S.businessVerified(b)) {
    root.innerHTML = `<div class="pad mt-20 center-col">
      <div class="empty-ico" style="color:var(--gold-bright)">${icon('checkCircle', 33)}</div>
      <b style="font-size:17px">${t('bizVerifiedOn')}</b>
      <button class="btn btn-ghost mt-16" data-route="#/directory/${b.id}">${t('back')}</button></div>`;
    wireRoutes(root); return;
  }
  if (st && st.status === 'pending') {
    root.innerHTML = `<div class="pad mt-20 center-col">
      <div class="empty-ico">${icon('clock', 33)}</div>
      <b style="font-size:17px">${t('bizVerifyPendingTitle')}</b>
      <span class="muted fs-13">${t('bizVerifyPending')}</span>
      <button class="btn btn-ghost mt-16" data-route="#/directory/${b.id}">${t('back')}</button></div>`;
    wireRoutes(root); return;
  }
  if (!S.isPaid(b)) {
    root.innerHTML = `<div class="pad mt-20 center-col">
      <div class="empty-ico">${icon('lock', 33)}</div>
      <b style="font-size:17px">${t('verifyNeedsPlan')}</b>
      <button class="btn btn-gold mt-16" data-route="#/subscribe/${b.id}">${t('upgradeBtn')}</button></div>`;
    wireRoutes(root); return;
  }

  root.innerHTML = `
    <div class="pad mt-16">
      ${st && st.status === 'rejected' && st.reason
        ? `<div class="err-msg" style="margin-bottom:12px">${icon('alert', 15)} ${st.reason}</div>` : ''}
      <div class="section-title">${t('verifySteps')}</div>
      <div class="mt-12">
        ${[['file', 'verifyStep1'], ['camera', 'verifyStep2'], ['clock', 'verifyStep3']].map(([ico, key], i) => `
          <div class="info-row"><span class="i-ico">${icon(ico, 21)}</span>
            <div class="i-txt"><b>${i + 1}. ${t(key)}</b></div></div>`).join('')}
      </div>

      <div class="privacy-box mt-16">
        <div class="pb-head">${icon('shield', 18)} <b>${t('verifyPrivacyTitle')}</b></div>
        <p>${t('verifyPrivacyBody')}</p>
      </div>

      <label class="consent-row mt-16">
        <input type="checkbox" id="vConsent" />
        <span>${t('verifyConsent')}</span>
      </label>

      <button class="btn btn-gold btn-block mt-12" id="vStart" disabled>${icon('checkCircle', 19)} ${t('verifyStart')}</button>
      <div class="hint" style="text-align:center;margin-top:10px">${t('verifyDemoNote')}</div>
    </div>`;

  const box = $('#vConsent'), btn = $('#vStart');
  // the button stays dead until consent is given, deliberately
  box.addEventListener('change', () => { btn.disabled = !box.checked; });
  btn.addEventListener('click', async () => {
    if (!box.checked) return;
    btn.innerHTML = `<span class="spinner"></span> ${t('loading')}`;
    const res = await S.runIdentityCheck();
    S.requestBizVerify(b.id, res.ref);
    toast(t('verifySent'), 'ok');
    go('#/directory/' + b.id);
  });
  wireRoutes(root);
}

function attr(v) {
  return String(v == null ? '' : v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/"/g, '&quot;');
}

/* --------------------------- SUBSCRIBE --------------------------- */
/** a date the way a person reads it, in whichever language is on */
export function fmtDate(ms) {
  const d = new Date(ms);
  if (isNaN(d)) return '';
  const locale = S.state.lang === 'en' ? 'en-US' : 'ar-EG';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The plan. Monthly or yearly, the yearly price derived from the monthly
 * one, a fourteen-day trial said in plain words, and no card field
 * anywhere on this screen — that comes after the consent step.
 */
export function SubscribeScreen(root, params) {
  renderHeader({ simple: true, title: t('subscription') });
  const bizId = params[0] || S.state.myBusinessId;
  const sub = S.subscription();
  const active = sub && S.subscriptionActive() && (!bizId || sub.businessId === bizId);
  let plan = 'monthly';

  const paint = () => {
    const price = S.planPrice(plan);
    root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico" style="width:64px;height:64px">${icon('crown', 33)}</div>
      <b style="font-size:18px">${t('subTitle')}</b>
      <span class="muted fs-13">${t('subSub')}</span>
    </div>

    ${showsPrices() && !active ? `
    <div class="pad">
      <div class="seg" id="planSeg">
        <button class="seg-btn ${plan === 'monthly' ? 'active' : ''}" data-plan="monthly">${t('planMonthly')}</button>
        <button class="seg-btn ${plan === 'yearly' ? 'active' : ''}" data-plan="yearly">${t('planYearly')}
          <span class="seg-tag">${t('planYearlyOff')}</span></button>
      </div>
      <div class="center-col mt-12">
        <div style="font-size:34px;font-weight:700;color:var(--gold-bright)">${fmtMoney(price)}<span style="font-size:14px;color:var(--muted)">${plan === 'yearly' ? t('year') : t('month')}</span></div>
        ${plan === 'yearly' ? `<span class="gold fs-13">${t('planSaveLine').replace('{x}', fmtMoney(S.yearlySaving()))}</span>` : ''}
      </div>
      <div class="list-note" style="margin-inline:0;margin-top:12px">${icon('gift', 18)}
        <span>${t(plan === 'yearly' ? 'trialBannerYear' : 'trialBanner').replace('{x}', fmtMoney(price))}</span></div>
    </div>` : ''}

    <div class="pad">
      ${[
        ['image', 'planPhotos', ''],
        ['play', 'planVideo', ''],
        ['checkCircle', 'planVerify', ''],
        ['trendingUp', 'planRank', ''],
        ['crown', 'planFeatured', ''],
        ['shield', 'planOnlyYours', 'planOnlyYoursSub'],
        ['trendingUp', 'planStats', ''],
        ['gift', 'planOffers', ''],
      ].map(([ico, key, sub2]) => `
        <div class="info-row"><span class="i-ico">${icon(ico, 21)}</span>
          <div class="i-txt"><b>${t(key)}</b>${sub2 ? `<span>${t(sub2)}</span>` : ''}</div></div>`).join('')}
      <div class="list-note" style="margin-inline:0">${icon('info', 18)}<span>${t('planFreeNote')}</span></div>
      ${!showsPrices()
        ? priceGate('#/subscribe' + (params[0] ? '/' + params[0] : ''), 'unlockPrice')
        : active
          ? `<div class="ok-msg mt-16" style="text-align:center">${t('subActive')}</div>
             <button class="btn btn-ghost btn-block mt-12" data-route="#/my-subscription">${icon('creditCard', 19)} ${t('mySubscription')}</button>`
          : `<button class="btn btn-gold btn-block mt-16" id="subBtn">${icon('gift', 20)} ${t('startTrial')}</button>`}
      <div class="hint" style="text-align:center;margin-top:10px">${t('needPhoneSub')}</div>
    </div>`;

    wirePriceGates(root);
    wireRoutes(root);
    $$('#planSeg .seg-btn').forEach(b => b.addEventListener('click', () => { plan = b.dataset.plan; paint(); }));

    const sb = $('#subBtn');
    if (sb) sb.addEventListener('click', () => {
      if (!S.requireTier(2, location.hash, go)) return;
      if (!S.state.myBusinessId && !bizId) { go('#/claim'); return; }
      // no card field on this screen: the consent step comes first, by law
      go('#/subscribe-consent/' + (bizId || S.state.myBusinessId) + '?plan=' + plan);
    });
  };
  paint();
}

/**
 * The consent step. It stands between the plan and any card field on
 * purpose: the amount, the cycle, the exact first-charge date, the fact
 * that it renews itself and the words to cancel it all have to be read
 * before the opt-in, and the opt-in cannot be pre-ticked. This is the
 * screen a chargeback or a regulator asks to see.
 */
export function SubscribeConsentScreen(root, params) {
  renderHeader({ simple: true, title: t('consentTitle') });
  const bizId = params[0] || S.state.myBusinessId;
  const plan = (query().plan === 'yearly') ? 'yearly' : 'monthly';
  const price = S.planPrice(plan);
  const firstCharge = S.now() + S.TRIAL_DAYS * 86400000;
  const cycle = t(plan === 'yearly' ? 'planYearly' : 'planMonthly');

  // stored word for word: the wording may change, and what matters later
  // is what this person actually read
  const consentText = [
    `${t('consentAmount')}: ${fmtMoney(price)} / ${cycle}`,
    `${t('consentFirstCharge')}: ${fmtDate(firstCharge)}`,
    t('consentAuto'),
    t('consentHowCancel'),
    t('consentCheck'),
  ].join('\n');

  root.innerHTML = `
    <div class="pad mt-16">
      <div class="sheet-sub" style="margin-bottom:12px">${t('consentSub')}</div>
      <div class="consent-box">
        <div class="info-row"><span class="i-ico">${icon('creditCard', 21)}</span>
          <div class="i-txt"><b class="ltr">${fmtMoney(price)}</b><span>${t('consentAmount')}</span></div></div>
        <div class="info-row"><span class="i-ico">${icon('refresh', 21)}</span>
          <div class="i-txt"><b>${cycle}</b><span>${t('consentCycle')}</span></div></div>
        <div class="info-row"><span class="i-ico">${icon('calendar', 21)}</span>
          <div class="i-txt"><b>${fmtDate(firstCharge)}</b><span>${t('consentFirstCharge')}</span></div></div>
        <p class="fs-13" style="margin:10px 2px 0">${t('consentAuto')}</p>
        <p class="fs-13" style="margin:6px 2px 0">${t('consentHowCancel')}</p>
      </div>

      <label class="consent-row mt-16">
        <input type="checkbox" id="subConsent" />
        <span>${t('consentCheck')}</span>
      </label>

      <button class="btn btn-gold btn-block mt-16" id="consentGo" disabled>
        ${icon('creditCard', 20)} ${t('consentContinue')}</button>
      <button class="btn btn-plain btn-block mt-8" id="consentBack">${t('back')}</button>
    </div>`;

  const box = $('#subConsent'), btn = $('#consentGo');
  // deliberately never pre-ticked, and the button is dead until it is
  box.addEventListener('change', () => { btn.disabled = !box.checked; });
  $('#consentBack').addEventListener('click', () => back());

  btn.addEventListener('click', async () => {
    if (!box.checked) return;
    btn.innerHTML = `<span class="spinner"></span> ${t('paying')}`;
    await S.chargeCard(0, 'ARABNA business plan — trial');
    S.startSubscription({
      businessId: bizId, plan, consentText,
      device: navigator.userAgent.slice(0, 120),
    });
    toast(t('subActive'), 'ok');
    goAfterDone('#/my-subscription');
  });
}

/**
 * My subscription. Cancelling is one button and one confirmation, in the
 * same place the consent screen said it would be — anything longer is the
 * pattern the rules were written against.
 */
export function MySubscriptionScreen(root) {
  renderHeader({ simple: true, title: t('mySubscription') });

  const paint = () => {
    const sub = S.subscription();
    if (!sub) {
      root.innerHTML = `<div class="pad mt-16">
        ${emptyState('creditCard', t('subNone'), t('subNoneSub'))}
        <button class="btn btn-gold btn-block mt-12" data-route="#/subscribe">${t('subscribeNow')}</button>
      </div>`;
      wireRoutes(root);
      return;
    }
    const statusKey = { trialing: 'subStatusTrialing', active: 'subStatusActive',
                        canceled: 'subStatusCanceled', past_due: 'subStatusPastDue' }[sub.status];
    const biz = S.businessById(sub.businessId);
    const ended = sub.status === 'canceled';

    root.innerHTML = `
      <div class="pad mt-16">
        <div class="sub-hero">
          <span class="sub-status ${sub.status}">${t(statusKey)}</span>
          <div class="sub-amount ltr">${fmtMoney(sub.price)}<span>${sub.plan === 'yearly' ? t('year') : t('month')}</span></div>
          ${biz ? `<div class="muted fs-13">${L(biz.name)}</div>` : ''}
        </div>

        ${!ended ? `<div class="info-row"><span class="i-ico">${icon('calendar', 21)}</span>
          <div class="i-txt"><b>${fmtDate(sub.currentPeriodEnd)}</b>
            <span>${sub.status === 'trialing' ? t('subTrialEnds') : t('subNextCharge')}</span></div></div>` : ''}
        ${sub.card ? `<div class="info-row"><span class="i-ico">${icon('creditCard', 21)}</span>
          <div class="i-txt"><b class="ltr">•••• ${sub.card.last4}</b><span>${t('subCardLast4')}</span></div></div>` : ''}

        ${sub.cancelAtPeriodEnd && !ended ? `
          <div class="list-note" style="margin-inline:0">${icon('info', 18)}
            <span>${t('subCancelKeep').replace('{x}', fmtDate(sub.currentPeriodEnd))}</span></div>
          <button class="btn btn-gold btn-block mt-8" id="subResume">${icon('refresh', 19)} ${t('subUndoCancel')}</button>` : ''}

        <div class="section-title mt-20">${t('subInvoices')}</div>
        ${(sub.invoices || []).length
          ? sub.invoices.slice().reverse().map(v => `
              <div class="setting-row" style="padding-inline:0">
                <span class="s-txt"><b>${fmtDate(v.date)}</b><span>${t('subStatusActive')}</span></span>
                <span class="gold ltr">${fmtMoney(v.amount)}</span>
              </div>`).join('')
          : `<div class="hint">${t('subNoInvoices')}</div>`}

        ${!ended ? `
          <div class="section-title mt-20">${t('subChangePlan')}</div>
          <div class="seg" id="subPlanSeg">
            <button class="seg-btn ${sub.plan === 'monthly' ? 'active' : ''}" data-plan="monthly">${t('planMonthly')} · ${fmtMoney(S.planPrice('monthly'))}</button>
            <button class="seg-btn ${sub.plan === 'yearly' ? 'active' : ''}" data-plan="yearly">${t('planYearly')} · ${fmtMoney(S.planPrice('yearly'))}</button>
          </div>
          <button class="btn btn-ghost btn-block mt-12" id="subCard">${icon('creditCard', 19)} ${t('subUpdateCard')}</button>
          ${!sub.cancelAtPeriodEnd
            ? `<button class="btn btn-danger btn-block mt-8" id="subCancel">${t('cancelSub')}</button>` : ''}` : ''}
      </div>`;

    wireRoutes(root);
    $$('#subPlanSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
      S.changeSubscriptionPlan(b.dataset.plan); toast(t('done'), 'ok'); paint();
    }));
    const res = $('#subResume');
    if (res) res.addEventListener('click', () => { S.resumeSubscription(); toast(t('subResumed'), 'ok'); paint(); });
    const card = $('#subCard');
    if (card) card.addEventListener('click', () => openSheet(`
      <div class="sheet-title">${t('subUpdateCard')}</div>
      <div class="field"><label class="label">${t('subCardLast4')}</label>
        <input class="input ltr" id="cardIn" inputmode="numeric" maxlength="4" placeholder="4242" /></div>
      <button class="btn btn-gold btn-block" id="cardGo">${t('saveChanges')}</button>
    `, (panel) => {
      panel.querySelector('#cardGo').addEventListener('click', () => {
        S.updateSubscriptionCard(panel.querySelector('#cardIn').value);
        closeSheet(); toast(t('subCardUpdated'), 'ok'); paint();
      });
    }));
    // one button, one confirmation — no phone call, no second screen
    const can = $('#subCancel');
    if (can) can.addEventListener('click', () => confirmSheet({
      title: t('cancelSub'), sub: t('subCancelConfirm'), confirmText: t('confirm'), danger: true,
      onConfirm: () => { S.cancelSubscription(); toast(t('subCancelled'), 'ok'); paint(); },
    }));
  };
  paint();
}
