/* ======================= DIRECTORY + LISTING ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, openSheet, closeSheet, confirmSheet,
         toast, stars, wireRoutes, emptyState, query, openMaps, shareItem, fmtMoney,
         openFilterSheet, activeFilterCount, sectionNote, replaceHash, goAfterDone,
         pickerBtn, setPickerValue, openDropdown, closeDropdown,
         showsPrices, priceGate, wirePriceGates,
         openBadgeHtml, openBadgeSlotHtml, onMinute, distLabelHtml, cityChipLabel, fmtMiles, attrChipsHtml, fmtDay, fmtTime, bizBadgeHtml,
         historyKey, esc, outsideBoxHtml, mountOutsideBox } from '../ui.js';
import { CATEGORIES, SUBSCRIPTION_PRICE, DAY_KEYS } from '../data.js';
import * as S from '../store.js';
import { catIcon, startSlider, repaintCityChips, mountSearchHint } from './home.js';
import { mountPhotoPicker } from './marketplace.js';
import { prayerTimes, fmtPrayer } from '../prayer.js';
import { openTimeFix } from './prayer.js';

/* ----------------------------- LIST ----------------------------- */
/* The card the reader came back from, so returning lands on the thing
   they were looking at rather than on a pixel that may now point
   somewhere else — the list can be a different length than it was. */
let lastOpened = '';

/* THE WINDOW THAT GROWS. Measured on a 4x-throttled processor — a mid
   range Android — `#/directory` painted in 4,327ms against 22ms for Home
   and under 200ms for the other six screens: twenty-four times the
   heaviest of them. One line did it, `el.innerHTML = rows.join('')`, and
   the page it built was 80,582px — about 107 screens drawn so a reader
   could look at one.

   Forty rows first, forty more each time the reader reaches the end. No
   library, no virtual scroll, and not one change to the shape of a row.

   And deliberately NOT a virtual scroll that measures row heights and
   paints the viewport: that shape assumes the whole list is already in
   hand, which is exactly what stops being true once the directory lives
   on a server. `growList` is the seam the server arrives through — the
   slice becomes a fetch and nothing else moves. */
const PAGE = 40;
let rowsAll = [];        // every row's HTML, built once per paint
let shown = 0;           // how many are on screen now
let io = null;           // the end-of-list watcher
let resume = 0;          // how many were drawn when a listing was opened

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
      area: q.area || S.state.area || 'all',
      featured: q.featured === '1',
      hasOffer: q.offer === '1',
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
    if (st.area && st.area !== 'all') p.push('area=' + encodeURIComponent(st.area));
    if (st.featured) p.push('featured=1');
    if (st.hasOffer) p.push('offer=1');
    replaceHash('#/directory' + (p.length ? '?' + p.join('&') : ''));
  };

  root.innerHTML = `
    <!-- The magnifier keeps its 22px and its own share of the row: it is
         flex: 0 0 auto, so the city chip beside it cannot squeeze it. -->
    <div class="search-row">
      <div class="search-bar big">${icon('search', 22)}
        <input id="dirSearch" placeholder="${t('searchExample')}" value="${esc(st.term)}" />
        <button class="search-clear" id="dirClear" hidden aria-label="${t('clear')}">${icon('x', 16)}</button>
      </div>
      <button class="loc-chip ${S.hasLocation() ? '' : 'unset'}" data-loc>${icon('mapPin', 17)}<span>${cityChipLabel()}</span></button>
    </div>

    <!-- One row that does not scroll sideways. It also says what is being
         filtered by without opening anything. -->
    <div class="ctl-row">
      ${pickerBtn({ id: 'ctlCat', label: t('lblCategory'), value: catLabel(st.cat) })}
      ${pickerBtn({ id: 'ctlSort', label: t('lblSort'), value: t(sortKey(st.sort)) })}
      <button class="filter-btn" id="dirFilter" aria-label="${t('filters')}">${icon('filter', 20)}<span id="fCount"></span></button>
    </div>
    <div id="ddHost"></div>

    <!-- V.02.7: the quick-chip row is gone. Every filter lives behind the
         ⚙ button and the two pickers now; what is *on* still shows below
         as removable pills, because that is state, not a control. -->
    <div id="pills"></div>
    <div id="catSlider"></div>
    <div id="dirNote"></div>
    ${/* above the first row, and the listings stay exactly where they are:
         somebody in Dallas visiting next month has every right to read
         them. The message explains, it does not block. */''}
    <div class="pad" id="outHost">${outsideBoxHtml()}</div>
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

  /* Every category in one vertical list, ordered by how much is in it, so
     the ones people actually want are at the top without any scrolling.
     "All" is always the first row. */
  const catOptions = () => {
    const counts = catCounts();
    return [{ id: 'all', label: t('catAll'), icon: 'grid', count: S.allBusinesses().length }]
      .concat(CATEGORIES.filter(c => !c.route)
        .map(c => ({ id: c.id, label: t(c.key), icon: c.icon, count: counts[c.id] || 0 }))
        .sort((a, b) => b.count - a.count));
  };

  const openCatDD = () => openDropdown({
    host: $('#ddHost'), anchor: $('#ctlCat'), title: t('pickCategory'), unit: 'ddCat',
    options: catOptions(), value: st.cat, onPick: setCat,
  });

  const openSortDD = () => openDropdown({
    host: $('#ddHost'), anchor: $('#ctlSort'), title: t('pickSort'), unit: 'dd',
    /* «الأقرب» is dropped outside the covered areas: there is no distance
       to sort by that would mean anything. The standing rule — never
       offer an option that leads nowhere. */
    options: ['newest', 'nearest', 'rated', 'open']
      .filter(id => id !== 'nearest' || S.inCoverage())
      .map(id => ({ id, label: t(sortKey(id)) })),
    value: st.sort,
    onPick: (v) => {
      if (v === 'nearest' && !S.state.geo) {
        import('./home.js').then(m => m.askForLocation(() => { st.sort = 'nearest'; applySort(); }));
        return;
      }
      st.sort = v; applySort();
    },
  });

  const applySort = () => {
    setPickerValue('ctlSort', t(sortKey(st.sort)));
    writeUrl(); paint();
  };

  const setCat = (id) => {
    st.cat = id;
    const valid = S.attrsForCat(id === 'all' ? '*' : id).map(a => a.id);
    st.attrs = st.attrs.filter(x => valid.includes(x));
    writeUrl();
    setPickerValue('ctlCat', catLabel(id));
    paint();
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
    if (st.area && st.area !== 'all') on.push({ k: '__area', label: areaLabel(st.area) });
    if (st.term) on.push({ k: '__term', label: '"' + st.term + '"' });
    if (st.featured) on.push({ k: '__featured', label: t('drFeatured') });
    if (st.hasOffer) on.push({ k: '__offer', label: t('offerHas') });

    host.innerHTML = on.length ? `<div class="pill-row">
      ${on.map(p => `<button class="pill" data-off="${esc(p.k)}">${esc(p.label)} ${icon('x', 13)}</button>`).join('')}
      ${on.length > 1 ? `<button class="pill clear" id="pillClear">${t('clearAll')}</button>` : ''}
    </div>` : '';

    $$('#pills [data-off]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.off;
      if (k === '__open') st.openNow = false;
      else if (k === '__offer') st.hasOffer = false;
      else if (k === '__featured') st.featured = false;
      else if (k === '__area') { st.area = 'all'; S.setArea('all'); }
      else if (k === '__sort') st.sort = 'newest';
      else if (k === '__term') { st.term = ''; $('#dirSearch').value = ''; }
      else st.attrs = st.attrs.filter(x => x !== k);
      writeUrl(); paint();
      setPickerValue('ctlSort', t(sortKey(st.sort)));
    }));
    const pc = $('#pillClear');
    if (pc) pc.addEventListener('click', () => {
      st.openNow = false; st.attrs = []; st.sort = 'newest'; st.term = ''; st.area = 'all';
      st.featured = false; st.hasOffer = false;
      S.setArea('all');
      $('#dirSearch').value = '';
      setPickerValue('ctlSort', t(sortKey(st.sort)));
      writeUrl(); paint();
    });
  };

  /* The category slider. When nobody has bought the slot the house fills
     it, exactly as it does on Home — and this is the best place in the app
     to sell it from: the restaurant owner browsing «مطاعم» is the buyer.
     On «الكل» there is no category to sell, so there is nothing here. */
  const paintCatSlider = () => {
    const host = $('#catSlider');
    if (!host) return;
    /* On «الكل» there is no one category to sell, but the section still
       reads the same way top to bottom, so the house slide stands there
       and invites them to pick the category they want to be at the top of. */
    if (st.cat === 'all') {
      host.innerHTML = `
        <div class="slider">
          <div class="slider-track">${catHouseHtml('')}</div>
        </div>`;
      wireRoutes(host);
      return;
    }
    const ads = S.catSliderAds(st.cat);
    if (!ads.length) {
      host.innerHTML = `
        <div class="slider">
          <div class="slider-track">${catHouseHtml(catLabel(st.cat))}</div>
        </div>`;
      wireRoutes(host);
      return;
    }
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
    /* A reader who chose a REGION gets that region's cities — all of them.
       They picked one name and got the suburbs behind it, which is the
       point: half the shops are not in the city proper. With no region
       chosen this is the whole directory, as before. */
    const region = S.userRegion();
    return (region ? S.businessesOfRegion(region) : S.allBusinesses())
      .filter(b => !st.featured || S.isPaid(b))
      .filter(b => st.cat === 'all' || b.cat === st.cat)
      .filter(b => S.inArea(b, st.area))
      .filter(b => !st.openNow || S.isOpenNow(b, now))
      .filter(b => !st.hasOffer || S.hasOffers(b))
      .filter(b => S.matchesAttrs(b, st.attrs));
  };

  const paint = () => {
    const now = new Date();
    const found = S.searchBusinesses(baseList(), st.term);
    let list = found.list.slice();

    /* Ordering, and what it falls back to. Nothing sorts on the old `dist`
       field any more: it was 0 on all 486 imported rows, so "nearest" put
       them in file order and called it distance. With a real point the list
       is genuinely nearest-first, with everything ungeocoded after it;
       without one the fallback is the rating, which is at least true. */
    const canRank = !!S.state.geo && S.anyGeocoded();
    if (st.sort === 'rated') list.sort((a, b) => S.ratingFor(b).avg - S.ratingFor(a).avg);
    else if (st.sort === 'nearest') list = S.byNearest(list);
    else if (st.sort === 'open') list = S.byNearest(list).sort((a, b) => S.isOpenNow(b, now) - S.isOpenNow(a, now));
    else if (found.mode !== 'loose') {
      /* Three fallbacks, in the order of how much they actually know:
         real miles when there is a point; otherwise the reader's own city
         first, because a city they chose is still true; then the rating,
         and a subscriber ahead of a free listing at the same rating —
         that is the ranking the $29 pays for, and it survives here
         without letting a paid shop in another city lead the screen. */
      /* ⚠️ `isPaid` is GONE from the end of this chain. It was the third
         tiebreak, behind a decimal rating that practically never ties, so
         it was a dead condition — and the subscribers no longer live in
         this list at all, they are lifted into their own layer below.
         Leaving it here would suggest it does something. */
      list = canRank ? S.byNearest(list)
        : list.sort((a, b) => (S.sameCity(b) - S.sameCity(a))
                           || (S.ratingFor(b).avg - S.ratingFor(a).avg));
    }

    /* ⚠️ THE SPONSORED STRIP ABOVE THE RESULTS IS GONE FROM THIS SCREEN,
       and it is the two-layer model that removed it. It drew two rows
       chosen by rotation out of the subscribers, with a third lifted under
       them — and every subscriber now stands at the top of the list
       anyway, so all three were the same shops twice on one screen. The
       comment that used to sit here said it in as many words: «one
       advertiser three times on one screen reads as a bug».
       ⚠️ `#sponRows` stays in events, the marketplace and the magazine —
       their pools are different and none of them was touched. */

    /* ⚠️ AND THE LOOSE SEARCH IS IN THE MODEL NOW. It used to be excluded
       from the ordering AND from the lift together, so the promise broke
       in the widest kind of search there is. Layer one applies to it; its
       layer two stays unordered, exactly as it was. */
    /* ⚠️ `336`: the sort the reader chose governs BOTH layers. `st.sort`
       is 'newest' when they have chosen nothing, and that default is not
       a choice — with it, `330`'s order stands exactly as it was. */
    /* ⚠️ `336`: the sort the reader chose governs BOTH layers. `st.sort` is
       'newest' when they have chosen nothing, and that default is not a
       choice — with it, `330`'s order stands exactly as it was.
       ⚠️ And «مفتوح الآن» passes its own key as the bucket: openness is
       what the reader asked to order by, so the subscription is a tiebreak
       inside it rather than a lift over it. «الأعلى تقييماً» and «الأقرب»
       pass none — their keys are decimals that never tie, so a tiebreak
       would never fire and the paid layer would vanish. */
    /* ⚠️ `337`: the two rows are filled by rotation, and the rotation turns
       on the HISTORY ENTRY — the same key `scrollMemory` uses. So the rows
       do not change under the reader while they look at them, Back brings
       the same two, and a fresh visit gives the next advertisers their
       turn. That is the version you can defend when a buyer asks how many
       times they ran. */
    const pin = S.paidFirst(list, st.sort !== 'newest',
      st.sort === 'open' ? (x) => S.isOpenNow(x, now) : null, historyKey());
    list = pin.list;
    const sponsored = new Set(pin.ids);

    /* THE STATE IS A PLACE TO GO, NOT A LIST. «TX» matches all 514
       addresses by construction, so answering it with 514 rows answers
       nothing — it is the «عربية» and «لحوم» trap, and the same rule
       applies: the word leaves the search and becomes a suggestion.
       The name «Texas» is different: it is in 38 real shop names, so
       those results stand and the suggestion sits above them. */
    const stSug = S.stateSuggestion(st.term);
    if (stSug && stSug.isCode) list = [];

    const sec = CATEGORIES.find(c => c.id === st.cat);
    $('#dirNote').innerHTML = sectionNote(sec ? t(sec.key) : '', list.length)
      + (stSug ? `
        <button class="state-suggest" id="stateGo" data-code="${esc(stSug.code)}">
          ${icon('mapPin', 18)}
          <span><b>${esc(stSug.name)}</b>
            <span>${esc(t('stateSuggestSub').replace('{s}', stSug.name))}</span></span>
        </button>` : '')
      + (stSug && stSug.isCode ? `
        <div class="near-miss">${icon('info', 15)} ${esc(t('stateCodeNote')
          .replace('{c}', stSug.code).replace('{s}', stSug.name))}</div>` : '')
      + (found.mode === 'loose' && !stSug
        ? `<div class="near-miss">${icon('info', 15)} ${t('nearMiss').replace('{q}', esc(st.term))}</div>` : '');
    const goState = $('#stateGo');
    if (goState) goState.addEventListener('click', () => {
      S.setUserState(goState.dataset.code);
      st.term = ''; const box = $('#dirSearch'); if (box) box.value = '';
      /* ⚠️ `paint()` REDRAWS THE RESULTS, NOT THE SEARCH ROW. The chip is
         part of the screen's own markup and is written once, so without
         this it went on saying «حدّد موقعك» over a directory that had just
         been set to the whole state. `repaintCityChips` is the single
         definition all three screens share. */
      writeUrl(); paint(); repaintCityChips(); renderHeader();
    });
    paintPills();
    paintCatSlider();

    const el = $('#dirList');
    /* HOW MANY RESULTS THERE ARE, as against how many are drawn. Since the
       window arrived, counting `.list-row` answers the second question
       while every question that matters — did the filter narrow it, is the
       whole directory here — asks the first. The screen already had the
       number and printed it in the section note only when a category was
       chosen; now it is always readable.

       SET BEFORE THE BRANCHES, because two of them return early. Written
       after the happy path it stayed stale on an empty search, which read
       as 514 results behind a screen saying there were none. */
    el.dataset.total = String(list.length);

    /* A SEARCH IS NOT A FILTER, and merging the two was the whole fault.
       Typing «sushi» with nothing else set produced «لا توجد نتائج بهذه
       الفلاتر · جرّب إزالة خيار أو اثنين» and a «امسح التصفية» button —
       asking the reader to undo choices they never made. The button did
       work (it cleared the word), which is why this reads as a wording
       bug and is really a dead end: the sentence sends you looking for a
       filter row that is empty.

       So the two states are separated. `filters` is what the reader
       actually chose; `st.term` is what they typed, and it is answered by
       naming the word back to them. */
    const filters = st.openNow || st.hasOffer || st.attrs.length || st.featured
      || (st.area && st.area !== 'all');
    const inSection = st.cat && st.cat !== 'all';
    /* ⚠️ AND «ما وجدنا شيئاً باسم TX» IS A LIE — there are 514 shops in
       Texas, and the suggestion two lines above says so. The state
       suggestion is the answer to that query, so the dead end does not
       also get to contradict it. */
    if (!list.length && (filters || st.term) && !(stSug && stSug.isCode)) {
      const title = st.term
        ? (filters ? t('noSearchInFilters') : t('noSearchTitle')).replace('{q}', esc(st.term))
        : t('noFilterResults');
      const sub = st.term && !filters ? t('noSearchSub') : t('noFilterResultsSub');
      // a dead end offers something to press, not just an apology
      el.innerHTML = emptyState('search', title, sub);
      const box = el.querySelector('.empty');
      if (found.suggestions.length) {
        box.insertAdjacentHTML('beforeend',
          `<div class="sugg-row">${found.suggestions.map(sg =>
            `<button class="pill sugg" data-sk="${sg.kind}" data-sv="${esc(sg.value)}">${esc(sg.label)} <span class="chip-n">${sg.count}</span></button>`).join('')}</div>`);
      }
      /* Searching inside one category and finding nothing has an obvious
         next move that is not «clear»: look everywhere. */
      if (st.term && inSection) {
        box.insertAdjacentHTML('beforeend',
          `<button class="btn btn-gold mt-8" id="allSec">${t('searchAllSections')}</button>`);
      }
      /* …and the clear button appears ONLY when there is something to
         clear. An option that does nothing is not an option — the same
         rule the picker row follows. */
      if (filters) {
        // …and it names what it will actually clear, which is not always both
        box.insertAdjacentHTML('beforeend', `<button class="btn ${st.term && inSection ? 'btn-ghost' : 'btn-gold'} mt-8" id="clrF">${t(st.term ? 'clearBothBtn' : 'clearFiltersBtn')}</button>`);
      }
      el.querySelectorAll('[data-sk]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.sk === 'cat') { st.term = ''; $('#dirSearch').value = ''; setCat(b.dataset.sv); }
        else { st.term = b.dataset.sv; $('#dirSearch').value = st.term; writeUrl(); paint(); }
      }));
      const all = el.querySelector('#allSec');
      if (all) all.addEventListener('click', () => setCat('all'));
      const clr = el.querySelector('#clrF');
      if (clr) clr.addEventListener('click', () => {
        st.openNow = false; st.attrs = []; st.term = ''; st.area = 'all';
        st.featured = false; st.hasOffer = false; S.setArea('all');
        $('#dirSearch').value = '';
        writeUrl(); paint();
      });
      paintFilterCount();
      return;
    }
    if (io) { io.disconnect(); io = null; }
    shown = 0; rowsAll = [];
    if (!list.length) {
      /* …and the same for the generic one: the suggestion above already
         told the reader what «TX» is and what to press. */
      el.innerHTML = (stSug && stSug.isCode) ? ''
        : emptyState('search', t('emptyDirTitle'), t('emptyDirSub'), t('setLocation'), '#/directory');
    } else {
      // the subscription upsell sits after the first five results, not above them
      rowsAll = list.map(b => rowHtml(b, sponsored.has(b.id)));
      if (rowsAll.length > 5) rowsAll.splice(5, 0, upsellHtml());
      else rowsAll.push(upsellHtml());

      el.innerHTML = '<div id="dirEnd" style="height:1px"></div>';
      /* 600px of margin so the next batch is drawn BEFORE the reader
         reaches the end — no gap and no wait. And a browser without
         IntersectionObserver draws the lot: slower, but working. Never
         half a screen because a feature is missing. */
      io = ('IntersectionObserver' in window)
        ? new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) growList(); },
                                   { root: $('#app'), rootMargin: '600px' })
        : null;
      /* The upsell card is not a result, so it does not eat one of the
         forty. Forty listings and the card: forty-one children. */
      const extra = rowsAll.length > list.length ? 1 : 0;
      growList(Math.max(PAGE + extra, resume));
      resume = 0;
      if (io) io.observe($('#dirEnd')); else growList(rowsAll.length);
    }
    wireRoutes(el);
    /* The per-row listeners live in `wireRows` now. Leaving the old sweeps
       here would give every row in the first batch a second one. */
    if (!list.length) $$('#dirList .empty .btn').forEach(b => b.addEventListener('click', () => import('./home.js').then(m => m.openLocationSheet())));

    paintFilterCount();
    flashReturn();
  };

  /* Only the NEW rows are wired; the old ones already are. Without the
     `rowWired` guard every batch hands each existing row another
     listener, and one tap opens the screen twice — a worse fault than the
     slowness this came to fix. */
  const wireRows = (nodes) => {
    nodes.forEach(n => {
      if (n.dataset.rowWired) return;
      n.dataset.rowWired = '1';
      n.querySelectorAll('[data-call]').forEach(b =>
        b.addEventListener('click', e => {
          e.stopPropagation();
          location.href = 'tel:' + b.dataset.call;
        }));
      const route = n.dataset.route || '';
      if (route.startsWith('#/directory/'))
        n.addEventListener('click', () => { lastOpened = route.split('/').pop(); resume = shown; });
    });
    wireRoutes($('#dirList'));      // guards itself with dataset.wired
  };

  /* Adds the next batch and returns how many it added — zero means the
     list is finished, which is what stops `flashReturn`'s loop. */
  const growList = (n = PAGE) => {
    const el = $('#dirList');
    if (!el || shown >= rowsAll.length) return 0;
    const to = Math.min(shown + n, rowsAll.length);
    const before = el.children.length;
    el.insertAdjacentHTML('beforeend', rowsAll.slice(shown, to).join(''));
    const added = Array.prototype.slice.call(el.children, before);
    wireRows(added);
    const grew = to - shown;
    shown = to;
    if (shown >= rowsAll.length && io) { io.disconnect(); io = null; }
    else if (io) { const sen = $('#dirEnd'); if (sen) el.appendChild(sen); }
    return grew;
  };

  const paintFilterCount = () => {
    const fc = $('#fCount');
    const n = activeFilterCount({ cat: st.cat, openNow: st.openNow, hasOffer: st.hasOffer,
                                  attrs: st.attrs, sort: st.sort, area: st.area });
    fc.className = n ? 'f-count' : '';
    fc.textContent = n || '';
    $('#dirFilter').classList.toggle('on', n > 0);
  };

  /* Coming back from a listing: put that card in the middle of the screen
     and blink it once. The saved pixel is right until the list changes
     length; the card is right either way. */
  const flashReturn = () => {
    if (!lastOpened) return;
    /* A forty-row window would otherwise break both halves of coming back:
       somebody who opened the 300th listing returns to a list that does
       not contain their row. So draw on until it does — `growList` returns
       zero when the list is finished, so this stops by itself even if the
       listing was deleted underneath us. */
    let row = $(`#dirList .list-row[data-route="#/directory/${lastOpened}"]`);
    while (!row && growList()) {
      row = $(`#dirList .list-row[data-route="#/directory/${lastOpened}"]`);
    }
    lastOpened = '';
    if (!row) return;
    requestAnimationFrame(() => {
      row.scrollIntoView({ block: 'center' });
      row.classList.add('flash');
      setTimeout(() => row.classList.remove('flash'), 1100);
    });
  };

  paint();

  mountOutsideBox(root, () => { const h = $('#outHost'); if (h) h.innerHTML = outsideBoxHtml(); mountOutsideBox(root); paint(); });
  $('#ctlCat').addEventListener('click', openCatDD);
  $('#ctlSort').addEventListener('click', openSortDD);

  /* The badges rewrite themselves every minute wherever they are; only the
     list has to be rebuilt, and only when "open now" is actually filtering
     it — otherwise the reader's place in a 139-row list would jump. */
  onMinute(root, () => { if (st.openNow) paint(); });

  const search = $('#dirSearch');
  const clear = $('#dirClear');
  const syncClear = () => { clear.hidden = !search.value; };
  syncClear();
  /* The same rotating hint Home has: the directory searches the same 514
     businesses with the same words, and a still box on the screen people
     actually search from was the odd one out. ⚠️ Mounted here and not in
     `paint()` — the search bar is drawn once and is not rebuilt by a
     filter, so a call inside `paint` would start a new timer on every tap. */
  mountSearchHint(root, '#dirSearch');
  /* What people look for is worth knowing, but not once per keystroke —
     that would record «م», «مط», «مطع» as three searches. It is recorded
     when the typing stops. */
  let searchTimer = null;
  search.addEventListener('input', e => {
    st.term = e.target.value;
    syncClear();
    writeUrl();
    paint();
    clearTimeout(searchTimer);
    const typed = st.term;
    searchTimer = setTimeout(() => { if (typed) S.recordSearch(typed); }, 900);
  });
  clear.addEventListener('click', () => {
    st.term = ''; search.value = ''; syncClear(); writeUrl(); paint();
  });

  $('[data-loc]').addEventListener('click', () => import('./home.js').then(m => m.openLocationSheet()));
  $('#dirFilter').addEventListener('click', () => openFilterSheet({
    cat: st.cat,
    value: { cat: st.cat, area: st.area, sort: st.sort, openNow: st.openNow,
             hasOffer: st.hasOffer, attrs: st.attrs.slice() },
    withPrice: false,
    withAttrs: true,
    withArea: true,
    countFor: (v) => S.searchBusinesses(S.allBusinesses()
      .filter(b => v.cat === 'all' || b.cat === v.cat)
      .filter(b => S.inArea(b, v.area))
      .filter(b => !v.openNow || S.isOpenNow(b, new Date()))
      .filter(b => !v.hasOffer || S.hasOffers(b))
      .filter(b => S.matchesAttrs(b, v.attrs)), st.term).list.length,
    onApply: (v) => {
      st.openNow = v.openNow; st.hasOffer = v.hasOffer; st.sort = v.sort;
      st.attrs = v.attrs.slice();
      st.area = v.area || 'all';
      S.setArea(st.area);
      setPickerValue('ctlSort', t(sortKey(st.sort)));
      writeUrl();
      paint();
    },
  }));
  wireRoutes(root);
}

/** what an area choice is called on its pill: a city, a radius, or nothing */
function areaLabel(area) {
  if (area === 'city') return S.userCity() || t('areaCity');
  return `${area} ${t('miles')}`;
}

/** what the category picker prints — the name, or "all" */
function catLabel(id) {
  if (!id || id === 'all') return t('catAll');
  const c = CATEGORIES.find(x => x.id === id);
  return c ? t(c.key) : t('catAll');
}

/** the i18n key for a sort id, for the pill that shows it */
function sortKey(id) {
  return { rated: 'sortTopRated', nearest: 'sortNearest', open: 'sortOpen' }[id] || 'sortNewest';
}

/* Slim card: icon · name + verified · rating/reviews/distance on one line ·
   call. The written phone duplicated the call button and "directions" now
   lives on the detail page, where the address is anyway. */
function rowHtml(b, sponsored) {
  // the tint marks a subscriber's row; "free" is never written on anyone.
  // A shop owner reading "free" on their own page hears "this one didn't pay",
  // and in the marketplace the same word means "costs nothing" — twice wrong.
  const paid = S.isPaid(b);
  const r = S.ratingFor(b);
  return `<div class="list-row ${paid ? 'premium' : ''}" data-route="#/directory/${b.id}">
    <span class="row-ico">${icon(catIcon(b.cat), 22)}</span>
    <div class="row-main">
      <div class="row-title">${esc(L(b.name))}${bizBadgeHtml(b)}${
        S.hasOffers(b) ? `<span class="badge-offer">${icon('tag', 11)}${t('offerHas')}</span>` : ''}${
        sponsored ? `<span class="badge badge-sponsored">${t('sponsored')}</span>` : ''}</div>
      <div class="row-sub">${r.count ? stars(r.avg) + `<span>· ${r.count} ${t('reviews')}</span> · ` : ''}
        ${distLabelHtml(b)}
        ${openBadgeSlotHtml(b)}
      </div>
      ${b.phone ? `<div class="row-actions">
        <button class="mini-btn gold" data-call="${esc(b.phone)}">${icon('phone', 15)} ${t('call')}</button>
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
      ${openBadgeSlotHtml(b)}
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

/**
 * A place of worship's times — and the distinction that governs the whole
 * block: **the adhan is computed, the iqama is the mosque's own decision.**
 *
 * ISGH prays jumuah at 1:30 and the mosque down the road at 2:00 and a
 * third holds two khutbahs. No API in the world has those numbers, because
 * they are not arithmetic. So the calculated times are printed under
 * «الأذان (حساب فلكي)» and whatever the mosque published under «الإقامة»,
 * and they are never mixed: confusing the two gets people to the mosque
 * late.
 *
 * And where the mosque has published nothing, the app says so. An invented
 * Friday time sends a man late to jumuah, and that is not forgivable —
 * the empty line is what creates the pressure to fill it.
 */
function worshipBlock(b) {
  const kind = S.worshipKind(b);
  if (!kind && !b.worship) return '';
  const w = b.worship || {};
  const mosque = kind ? kind === 'mosque' : w.kind !== 'church';
  const langLabel = w.lang === 'ar' ? t('langAr') : w.lang === 'en' ? t('langEn') : t('langBoth');
  const rows = [];

  if (mosque) {
    const p = S.prayerPoint();
    const times = p ? prayerTimes({
      lat: S.hasCoords(b) ? b.lat : p.lat, lng: S.hasCoords(b) ? b.lng : p.lng,
      method: S.prayerMethod(), asrShadow: S.asrShadow(),
    }) : null;
    if (times) {
      rows.push(`<div class="wor-head">${icon('mosque', 17)} ${t('prAdhanCalc')}</div>
        <div class="wor-grid">
          ${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map(k =>
            `<div class="wor-cell"><b>${t('pr' + k[0].toUpperCase() + k.slice(1))}</b>
             <span class="ltr">${fmtPrayer(times[k], S.state.lang)}</span></div>`).join('')}
        </div>`);
    }
  }

  if (w.prayers) {
    rows.push(`<div class="wor-head">${icon('clock', 17)} ${t('prIqama')}</div>
      <div class="wor-grid">
        ${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter(k => w.prayers[k]).map(k =>
          `<div class="wor-cell"><b>${t('pr' + k[0].toUpperCase() + k.slice(1))}</b><span class="ltr">${fmtTime(w.prayers[k])}</span></div>`).join('')}
      </div>`);
  } else if (mosque) {
    rows.push(`<div class="info-row"><span class="i-ico">${icon('clock', 21)}</span>
      <div class="i-txt"><b class="muted">${t('prNoIqama')}</b></div></div>`);
  }

  if (w.jumuah && w.jumuah.length) {
    rows.push(`<div class="info-row"><span class="i-ico">${icon('users', 21)}</span>
      <div class="i-txt"><b class="ltr">${w.jumuah.map(fmtTime).join(' · ')}</b><span>${t('jumuahTime')}</span></div></div>`);
  } else if (mosque) {
    rows.push(`<div class="info-row"><span class="i-ico">${icon('users', 21)}</span>
      <div class="i-txt"><b class="muted">${t('prNoJumuah')}</b></div></div>`);
  }

  if (w.mass && w.mass.length) {
    rows.push(`<div class="info-row"><span class="i-ico">${icon('landmark', 21)}</span>
      <div class="i-txt"><b>${w.mass.map(m => `${t(DAY_KEYS[m.day])} <span class="ltr">${fmtTime(m.time)}</span>`).join(' · ')}</b>
      <span>${t('massTimes')}</span></div></div>`);
  } else if (kind === 'church') {
    // the same rule as the mosque's: the blank is what gets it filled in
    rows.push(`<div class="info-row"><span class="i-ico">${icon('landmark', 21)}</span>
      <div class="i-txt"><b class="muted">${t('prNoMass')}</b></div></div>`);
  }
  if (w.lang) {
    rows.push(`<div class="info-row"><span class="i-ico">${icon('languages', 21)}</span>
      <div class="i-txt"><b>${langLabel}</b><span>${mosque ? t('sermonLang') : t('massLang')}</span></div></div>`);
  }

  /* The congregation corrects it. Every mosque has hundreds who go each
     Friday and one of them fixes a wrong time in half a minute; it goes to
     the review queue, never straight onto the page. */
  rows.push(`<button class="wor-fix" data-timefix="${b.id}">${icon('edit', 16)} ${t('prWrongTime')}</button>`);

  return `<div class="worship-block">${rows.join('')}</div>`;
}

/* ---------------------------------------------------------------
   The mosque enters its own Friday and iqama times

   This is the half no calculation can reach, and the whole reason the
   block above is split in two. A mosque WANTS this filled in — people
   knowing when its jumuah is serves the mosque, it is not a chore — and
   the claim flow already decides who is allowed to write it.

   Never a school, never a sect, never a label of our own. Whoever wants
   to declare an identity declares it themselves when they claim the page.
   --------------------------------------------------------------- */
const IQAMA_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

function worshipFields(b) {
  if (b.cat !== 'worship') return '';
  const w = b.worship || {};
  const j = w.jumuah || [];
  return `
    <div class="field"><label class="label">${t('prEditWorship')}</label>
      <div class="hint">${t('prCalcNote')}</div>
    </div>
    <div class="field"><label class="label">${t('jumuahTime')}</label>
      <div class="hours-row">
        <input class="input ltr" id="eJum1" dir="ltr" placeholder="13:30" value="${esc(j[0] || '')}" />
        <input class="input ltr" id="eJum2" dir="ltr" placeholder="${t('prJumuahTwo')}" value="${esc(j[1] || '')}" />
      </div>
    </div>
    <div class="field"><label class="label">${t('prIqama')}</label>
      ${IQAMA_KEYS.map(k => `<div class="hours-row">
        <span>${t('pr' + k[0].toUpperCase() + k.slice(1))}</span>
        <input class="input ltr" dir="ltr" data-iq="${k}" placeholder="—"
               value="${esc((w.prayers && w.prayers[k]) || '')}" />
      </div>`).join('')}
    </div>`;
}

function readWorshipFields(b) {
  /* `kind` is never written here: the place's own worshipKind attribute is
     the answer, and stamping a default would have this form deciding what
     a building is. */
  const w = Object.assign({}, b.worship || {});
  const jum = [$('#eJum1'), $('#eJum2')].map(el => (el && el.value.trim()) || '').filter(Boolean);
  const prayers = {};
  $$('[data-iq]').forEach(el => { if (el.value.trim()) prayers[el.dataset.iq] = el.value.trim(); });
  return Object.assign({}, w, {
    jumuah: jum,
    // an empty object would print an empty grid; no times means no block
    prayers: Object.keys(prayers).length ? prayers : null,
  });
}

/**
 * The unsold category slot. Its ground is ours (--surface-2/--bar) and so
 * follows the theme, therefore its ink is --text; the advertiser's slide
 * beside it has a fixed ground and takes --ad-cta. Mixing the two is the
 * fault fixed in ce0fc77 — do not.
 */
function catHouseHtml(catName) {
  return `<div class="slide slide-house active" data-route="#/advertise/catSlider">
    <div style="color:var(--gold);margin-bottom:6px">${icon('megaphone', 31)}</div>
    <div class="slide-title">${catName ? t('adCtaCat').replace('{cat}', catName) : t('adCta')}</div>
    <div class="slide-sub" style="color:var(--text-2)">${t('adCtaCatSub')}</div>
    <div class="slide-cta cta-center">${icon('plus', 17)} ${t('continueAction')}</div>
  </div>`;
}

/** one slide in a category slider — the same shape the home one uses */
function catSlideHtml(a, i) {
  return `<div class="slide ${i === 0 ? 'active' : ''}" style="background:${a.color}">
    <span class="slide-badge">${t('sponsored')}</span>
    <div class="slide-title">${esc(L(a.name))}</div>
    <div class="slide-sub">${esc(L(a.tag))}</div>
    <div class="slide-cta">${esc(L(a.cta))} ${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 15)}</div>
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
           <div class="i-txt"><b class="ltr">${esc(price)}</b><span>${t('entryPrice')}</span></div></div>`
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
          <div class="row-title">${esc(L(x.name))}${bizBadgeHtml(x)}</div>
          <div class="row-sub">${distLabelHtml(x)}${openBadgeSlotHtml(x)}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

/* ------------------------------------------------------------
   OFFERS — «عروض هذا الأسبوع»

   The block draws itself three different ways and the page never
   decides which: a reader sees whatever is live, the owner sees
   their own pending and rejected ones too, and a shop that has not
   subscribed sees what it is missing rather than nothing at all.
   That last one is the point — this is the first concrete thing
   the $29 buys that a grocer can picture.
   ------------------------------------------------------------ */

/** «ينتهي اليوم» / «ينتهي غداً» / «ينتهي خلال 6 يوم» */
function offerEndsLabel(o) {
  const left = Math.ceil((o.endsAt - S.now()) / 864e5);
  if (left <= 1) return t('offerEndsToday');
  if (left === 2) return t('offerEndsTomorrow');
  return `${t('offerEndsIn')} ${left - 1} ${t('offerDays')}`;
}

function offerCard(o, owner) {
  const flag = o.status === 'pending' ? t('offerPending')
             : o.status === 'rejected' ? t('offerRejected') : '';
  return `<div class="offer-card ${o.status}">
    <div class="offer-main">
      <div class="offer-text">${esc(o.text)}</div>
      ${o.price ? `<div class="offer-price ltr">${esc(o.price)}</div>` : ''}
      <div class="offer-meta">${icon('clock', 15)}<span>${offerEndsLabel(o)}</span>${
        flag ? `<span class="offer-flag">${flag}</span>` : ''}</div>
      ${owner && o.status === 'rejected' && o.reason
        ? `<div class="offer-why">${esc(o.reason)}</div>` : ''}
    </div>
    ${owner ? `<button class="icon-btn" data-deloffer="${o.id}" aria-label="${t('offerRemove')}">${icon('trash', 19)}</button>` : ''}
  </div>`;
}

function offersBlock(b, mine) {
  // a public park has no owner to sell to and no offers to run
  if (S.isNonCommercial(b)) return '';
  const subscribed = S.canPostOffers(b);
  const list = mine ? S.myOffersFor(b.id) : S.offersFor(b.id);

  /* The shop that has not subscribed: the owner is shown the door, and a
     reader is shown nothing at all — an empty «offers» heading on a page
     with no offers is the blank screen the project bans. */
  if (!subscribed) {
    return mine ? `<div class="offer-lock" data-route="#/subscribe">
      <span class="offer-lock-ico">${icon('tag', 22)}</span>
      <div><b>${t('offerLocked')}</b><span>${t('offerLockedSub')}</span></div>
      <span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 19)}</span>
    </div>` : '';
  }
  if (!list.length && !mine) return '';

  const left = S.MAX_OFFERS - S.activeOfferCount(b.id);
  return `<div class="section-head" style="padding:0;margin-top:20px">
      <div class="section-title">${t('offersTitle')}${
        mine ? `<small>${t('offerLeft')} ${left} ${t('offerLeftOf')}</small>` : ''}</div>
    </div>
    <div id="offerList">${list.length
      ? list.map(o => offerCard(o, mine)).join('')
      : `<div class="rev-empty"><div class="rev-empty-ico">${icon('tag', 28)}</div>
           <b>${t('offersNone')}</b><span>${t('offersNoneSub')}</span></div>`}</div>
    ${mine ? `<button class="btn ${list.length ? 'btn-ghost' : 'btn-gold'} btn-block mt-12" id="offerBtn"
        ${left <= 0 ? 'disabled' : ''}>${icon('plus', 19)} ${t('offerAdd')}</button>` : ''}`;
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
  /* The first approved photo is the header. The strip below carries what
     is left — printing the hero again as the first tile is the same photo
     twice on one screen. A business with none renders no gallery at all;
     that rule has not changed. */
  const strip = photos.filter(ph => ph.url !== S.heroPhoto(b));
  const hero = S.heroPhoto(b);
  const claim = S.claimFor(b.id);

  root.innerHTML = `
    <div class="detail-hero ${hero ? 'has-photo' : ''}">
      <button class="back-btn" id="bk">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 22)}</button>
      ${hero ? `<img class="hero-img" src="${esc(hero)}" alt="${esc(L(b.name))}" />`
             : `<div style="color:var(--gold-bright)">${icon(catIcon(b.cat), 54)}</div>`}
    </div>

    <div class="detail-body">
      <div class="row-between">
        <div>
          <div class="detail-title">${esc(L(b.name))}${bizBadgeHtml(b, true)}</div>
          <div class="row-sub">${rate.count
            ? stars(rate.avg) + `<span>· ${rate.count} ${t('reviews')}</span>`
            : `<span class="muted fs-12">${t('noReviewsYet')}</span>`}</div>
        </div>
        <div class="top-actions">
          <!-- share beside the heart. It used to sit at the very bottom of a
               page 3454px tall, which is the same as not having it. -->
          <button class="icon-btn" id="shareTop" aria-label="${t('share')}">${icon('share', 21)}</button>
          <button class="icon-btn" id="saveBtn" aria-label="${t('save')}">${icon('heart', 22)}</button>
        </div>
      </div>

      <p class="fs-13 muted mt-12">${esc(L(b.desc || ''))}</p>
      ${attrChipsHtml(b)}

      ${/* A button that cannot do anything is worse than no button: nine of
            these parks have no line at all, so the call button is removed
            rather than shown greyed out. The grid collapses to one column
            so the survivor is full width, not half of a missing pair. */''}
      <div class="action-grid" ${b.phone && b.address ? '' : 'style="grid-template-columns:1fr"'}>
        ${b.phone ? `<button class="btn btn-gold" id="callBtn">${icon('phone', 20)} ${t('call')}</button>` : ''}
        ${b.address ? `<button class="btn ${b.phone ? 'btn-ghost' : 'btn-gold'}" id="mapBtn">${icon('navigation', 20)} ${t('directions')}</button>` : ''}
      </div>

      ${b.phone
        ? `<div class="info-row"><span class="i-ico">${icon('phone', 21)}</span><div class="i-txt"><b class="ltr">${esc(b.phone)}</b><span>${t('phoneLabel')}</span></div></div>`
        : b.address
          ? `<div class="info-row"><span class="i-ico">${icon('phone', 21)}</span><div class="i-txt"><b class="muted">${t('noPhoneUseMap')}</b><span>${t('phoneLabel')}</span></div></div>`
          : ''}
      ${b.address
        ? `<div class="info-row"><span class="i-ico">${icon('mapPin', 21)}</span><div class="i-txt"><b class="ltr">${esc(b.address)}</b><span>${t('address')}${S.distanceTo(b) != null ? ` · ${fmtMiles(S.distanceTo(b))} ${t('miles')} ${t('distanceAway')}` : (S.cityOf(b) ? ` · ${S.cityOf(b)}` : '')}</span></div></div>`
        : ''}
      ${hoursBlock(b)}
      ${worshipBlock(b)}
      <div class="info-row">${`<span class="i-ico">${icon('bookmark', 21)}</span>`}<div class="i-txt"><b>${t(catKey(b.cat))}</b><span>${t('category')}</span></div></div>
      ${outingBlock(b)}

      ${strip.length ? `
        <div class="section-head" style="padding:0;margin-top:20px"><div class="section-title">${t('photos')}</div></div>
        <div class="photo-strip">
          ${strip.map(p => `<div class="photo-tile shot ${p.status === 'pending' ? 'pending' : ''}">
            <img src="${esc(p.url)}" alt="" loading="lazy" />
            ${p.status === 'pending' ? `<span class="shot-flag">${t('statusPending')}</span>` : ''}
          </div>`).join('')}
        </div>` : ''}
      ${mine ? `<button class="btn btn-ghost btn-block mt-12" data-route="#/business/photos/${b.id}">
        ${icon('camera', 19)} ${t('managePhotos')}</button>` : ''}

      ${offersBlock(b, mine)}

      <div class="section-head" style="padding:0;margin-top:20px">
        <div class="section-title">${t('reviewsTitle')}<small>${rate.count ? `${rate.avg} · ${rate.count} ${t('reviews')}` : t('noReviewsYet')}</small></div>
      </div>
      <div id="revList">
        ${revs.length ? revs.map(r => reviewHtml(r, mine)).join('') : reviewsEmpty()}
      </div>
      <button class="btn ${revs.length ? 'btn-ghost' : 'btn-gold'} btn-block mt-12" id="revBtn">
        ${icon('edit', 19)} ${myRev ? t('editReview') : t('writeReview')}</button>

      ${ownerBlock(b, mine, paid, claim)}

      <button class="btn btn-ghost btn-sm btn-block mt-16" id="repBtn">${icon('flag', 18)} ${t('report')}</button>
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
  $('#shareTop').addEventListener('click', () => shareItem(L(b.name), location.href));
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

  /* ⚠️ AFTER the reviews are in the DOM, never before: the button is drawn
     only when `scrollHeight` really exceeds the clamped box, and an
     unattached node measures zero. */
  mountReviewClamps(root);

  $$('[data-editrev]').forEach(btn => btn.addEventListener('click', () => {
    openReviewSheet(b.id, () => go('#/directory/' + b.id));
  }));
  $$('[data-delrev]').forEach(btn => btn.addEventListener('click', () => confirmSheet({
    title: t('delete'), sub: t('myReviewOn') + ' ' + L(b.name), confirmText: t('delete'), danger: true,
    onConfirm: () => { S.deleteReview(btn.dataset.delrev); toast(t('reviewDeleted'), 'ok'); go('#/directory/' + b.id); }
  })));

  $$('[data-timefix]').forEach(btn => btn.addEventListener('click', () => openTimeFix(btn.dataset.timefix)));

  const ofb = $('#offerBtn');
  if (ofb) ofb.addEventListener('click', () => openOfferSheet(b.id, () => go('#/directory/' + b.id)));
  $$('[data-deloffer]').forEach(btn => btn.addEventListener('click', () => confirmSheet({
    title: t('offerRemove'), sub: t('offersTitle'), confirmText: t('offerRemove'), danger: true,
    onConfirm: () => { S.removeOffer(b.id, btn.dataset.deloffer); toast(t('done'), 'ok'); go('#/directory/' + b.id); },
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
               ${vs && vs.status === 'rejected' && vs.reason ? `<div class="err-msg">${icon('alert', 15)} ${esc(vs.reason)}</div>` : ''}`
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
          <div class="row-title">${esc(L(x.name))}${bizBadgeHtml(x)}</div>
          <div class="row-sub">${distLabelHtml(x)}${openBadgeSlotHtml(x)}</div>
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
    <div class="field"><textarea class="textarea" id="rpTxt">${esc(existing ? existing.text : '')}</textarea></div>
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
      ${/* ⚠️ Today `r.user` is the name on this device, so the harm is
           small — and the day the server lands it is SOMEBODY ELSE'S name
           printed on your screen, which is this exact family of fault. A
           line is not deferred because its damage is.
           ⚠️ And the single letter is escaped too: one character carries no
           attack, but leaving one of the four out makes the rule an
           exception, and an exception is what gets forgotten.
           ⚠️ The review's own TEXT below is already escaped — the field
           somebody noticed and the field nobody did, in one card. */''}
      <span class="avatar">${esc((r.user || '?')[0])}</span>
      <div><b class="fs-13">${esc(r.user)}</b><div class="fs-12 muted">${esc(L(r.when))} · ${stars(r.rating)}</div></div>
    </div>
    ${/* ⚠️ CLAMPED TO TWO LINES, with «اقرأ المزيد» under it. An eight-line
         review filled the screen and the two reviews below it got one line
         each that nobody scrolled to. */''}
    <p class="rv-text clamped">${esc(L(r.text))}</p>
    ${reply ? `<div class="owner-reply">
      <div class="or-head">${icon('briefcase', 14)} ${t('ownerReply')}</div>
      <p>${esc(reply.text)}</p>
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
 * «اقرأ المزيد», wired once over whatever reviews are on the screen.
 *
 * ⚠️ THE BUTTON IS ONLY DRAWN WHEN THERE IS SOMETHING TO READ:
 * `scrollHeight` is measured against `clientHeight` while the text is
 * clamped, so a two-line review gets no button at all. A button that
 * opens two lines onto two lines is a small lie.
 *
 * ⚠️ AND THE OPEN/SHUT STATE LIVES ON THE PAGE, NOT IN `state`. Whatever
 * was opened stays open until the screen is left, and no storage key is
 * added for something that belongs to one moment.
 */
export function mountReviewClamps(root) {
  $$('.rv-text', root).forEach(p => {
    if (p.dataset.clampWired) return;
    p.dataset.clampWired = '1';
    /* a hair of tolerance: sub-pixel line heights make a clamped
       two-line paragraph measure one pixel over its own box */
    if (p.scrollHeight <= p.clientHeight + 2) { p.classList.remove('clamped'); return; }
    const btn = document.createElement('button');
    btn.className = 'rv-more';
    btn.type = 'button';
    btn.textContent = t('readMore');
    btn.addEventListener('click', () => {
      const open = p.classList.toggle('clamped') === false;
      btn.textContent = t(open ? 'readLess' : 'readMore');
    });
    p.insertAdjacentElement('afterend', btn);
  });
}

/**
 * Write or edit a review. Saves through the store, so the business page,
 * the rating average and "My reviews" all update from the same record.
 */
/**
 * Posting an offer. Three fields and one date, no photo — a picture needs
 * review and storage, and both are deferred. The end date is the only
 * required one besides the text, because an offer that does not end is the
 * failure this whole feature is built to avoid.
 */
export function openOfferSheet(bizId, onSaved) {
  const day = 864e5;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const soon = iso(S.now() + 7 * day);

  openSheet(`
    <div class="sheet-title">${t('offerAddTitle')}</div>
    <div class="field"><label class="label">${t('offerText')} *</label>
      <textarea class="textarea" id="ofTxt" placeholder="${t('offerTextPh')}"></textarea>
      <div class="field-err" id="ofTxtErr"></div></div>
    <div class="field"><label class="label">${t('offerPrice')}</label>
      <input class="input" id="ofPrice" placeholder="${t('offerPricePh')}" /></div>
    <div class="field"><label class="label">${t('offerEndsAt')} *</label>
      <input class="input" type="date" id="ofEnd" value="${soon}"
             min="${iso(S.now() + day)}" max="${iso(S.now() + S.MAX_OFFER_DAYS * day)}" />
      <div class="hint">${t('offerEndsHint')}</div>
      <div class="field-err" id="ofEndErr"></div></div>
    <button class="btn btn-gold btn-block" id="ofSend">${t('offerPost')}</button>
  `, (panel) => {
    const err = (id, msg) => { panel.querySelector(id).textContent = msg || ''; };
    panel.querySelector('#ofSend').addEventListener('click', () => {
      err('#ofTxtErr'); err('#ofEndErr');
      const txt = panel.querySelector('#ofTxt').value.trim();
      const price = panel.querySelector('#ofPrice').value.trim();
      const raw = panel.querySelector('#ofEnd').value;
      /* Read the date as the END of that day in local time. A bare
         yyyy-mm-dd parses as UTC midnight, which in Houston is the evening
         before — the offer would expire a day early, every time. */
      const parts = raw.split('-').map(Number);
      const end = parts.length === 3
        ? new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59).getTime() : 0;

      const r = S.addOffer(bizId, { text: txt, price, endsAt: end });
      if (r.error === 'noText') { err('#ofTxtErr', t('offerErrNoText')); return; }
      if (r.error === 'noEnd') { err('#ofEndErr', t('offerErrNoEnd')); return; }
      if (r.error === 'tooLong') { err('#ofEndErr', t('offerErrTooLong')); return; }
      if (r.error === 'tooMany') { toast(t('offerErrTooMany'), 'err'); return; }
      if (r.error) { toast(t('somethingWrong'), 'err'); return; }

      closeSheet();
      // say it out loud rather than letting them find it themselves later
      if (r.strippedPhone) toast(t('offerPhoneOut'), 'ok');
      else toast(t('offerSent'), 'ok');
      if (onSaved) onSaved();
    });
  });
}

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
      <textarea class="textarea" id="revTxt" placeholder="...">${esc(existing ? L(existing.text) : '')}</textarea></div>
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
  let cat = '';                 // chosen, not defaulted — it is required
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
      <div class="field"><label class="label">${t('nameEn')} <span class="req">*</span></label>
        <input class="input ltr" id="bName" dir="ltr" required /></div>
      <div class="field"><label class="label">${t('nameAr')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="bNameAr" />
        <div class="hint">${t('nameArHint')}</div></div>
      <div class="field"><label class="label">${t('category')} <span class="req">*</span></label>
        <select class="select" id="bCat">
          <option value="">${t('chooseCategory')}</option>
          ${CATEGORIES.filter(c => !c.route).map(c => `<option value="${c.id}">${t(c.key)}</option>`).join('')}
        </select></div>
      <div class="field"><label class="label">${t('phoneLabel')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="bPhone" inputmode="tel" placeholder="(713) 555-0000" />
        <div class="hint">${t('phoneOptionalHint')}</div></div>
      <!-- A plumber has no shopfront. Without a ZIP they never appear in
           «الأقرب» at all, so the address field is replaced by one rather
           than sitting there empty. -->
      <label class="consent-row">
        <input type="checkbox" id="bMobile" />
        <span><b>${t('mobileService')}</b><br><span class="muted fs-12">${t('mobileServiceHint')}</span></span>
      </label>
      <div class="field mt-12" id="bAddrField"><label class="label">${t('address')} <span class="muted">(${t('optional')})</span></label><input class="input" id="bAddr" /></div>
      <div class="field" id="bZipField" hidden><label class="label">${t('zipLabel')} <span class="req">*</span></label>
        <input class="input ltr" id="bZip" dir="ltr" inputmode="numeric" maxlength="5" placeholder="77036" /></div>

      <div class="field"><label class="label">${t('keywords')}</label>
        <input class="input" id="bTags" placeholder="شاورما، مشاوي، shawarma" />
        <div class="hint">${t('keywordsHint')}</div></div>

      <div class="field"><label class="label">${t('hoursTitle')}</label>
        <label class="consent-row" style="margin-bottom:10px">
          <input type="checkbox" id="b24" />
          <span><b>${t('open24Label')}</b></span>
        </label>
        <div class="hrs-grid" id="bHours">${[0, 1, 2, 3, 4, 5, 6].map(dayRow).join('')}</div></div>

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
  /* Each group is a box that opens, and it *stays* open: somebody adding
     a restaurant picks two or three from the same list, and a panel that
     shut on every tap would have to be reopened each time. What has been
     chosen shows as ✕ pills under the box, so the answer is visible with
     the box closed. Nothing about "halal" or "women only" is written here
     — the boxes are built from the registry, so a new speciality appears
     the day it is added to data.js. */
  let openGrp = '';
  const paintAttrs = () => {
    const groups = cat ? S.attrGroupsForCat(cat, { all: true }) : [];
    $('#bAttrs').innerHTML = groups.length ? groups.map(g => {
      const mine = g.attrs.filter(a => picked.includes(a.id));
      return `
      <div class="attr-box ${openGrp === g.group.id ? 'open' : ''}" data-grp="${g.group.id}">
        <button type="button" class="attr-head" data-grptoggle="${g.group.id}"
                aria-expanded="${openGrp === g.group.id}">
          <span>${t(g.group.key)} <span class="req">*</span></span>
          <span class="attr-count">${mine.length || ''}</span>
          ${icon('chevronD', 18, 'attr-arrow')}
        </button>
        <div class="attr-body"><div class="attr-body-inner">
          ${g.attrs.map(a => `<button type="button" class="chip ${picked.includes(a.id) ? 'active' : ''}" data-a="${a.id}">
            ${icon(a.icon, 14)} ${t(a.key)}</button>`).join('')}
        </div></div>
        ${mine.length ? `<div class="attr-chosen">${mine.map(a =>
          `<button type="button" class="pill" data-off-a="${a.id}">${t(a.key)} ${icon('x', 13)}</button>`).join('')}</div>` : ''}
      </div>`;
    }).join('') : `<div class="hint">${t('chooseCategory')}</div>`;

    $$('#bAttrs [data-grptoggle]').forEach(b => b.addEventListener('click', () => {
      openGrp = openGrp === b.dataset.grptoggle ? '' : b.dataset.grptoggle;
      paintAttrs();
    }));
    const toggle = (id) => {
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
      paintAttrs();
    };
    $$('#bAttrs .chip').forEach(b => b.addEventListener('click', () => toggle(b.dataset.a)));
    $$('#bAttrs [data-off-a]').forEach(b => b.addEventListener('click', () => toggle(b.dataset.offA)));
  };
  paintAttrs();

  /* the entry price is only a question for an outing — nobody asks a
     dentist what it costs to walk in */
  const paintEntry = () => { $('#bEntryField').hidden = cat !== 'outings'; };
  paintEntry();

  $('#bCat').addEventListener('change', (e) => {
    cat = e.target.value;
    const valid = cat ? S.attrsForCat(cat).map(a => a.id) : [];
    picked = picked.filter(id => valid.includes(id));
    paintAttrs();
    paintEntry();
    refreshSave();
  });

  /* The button is dead until the two things the importer also demands are
     there — the English name and the category. One list of required
     fields, not a second one invented for this screen. */
  function refreshSave() {
    const ok = !!$('#bName').value.trim() && !!$('#bCat').value;
    $('#bSave').disabled = !ok;
  }
  $('#bName').addEventListener('input', refreshSave);
  refreshSave();

  /* A mobile trade has no address to give, so the field is swapped rather
     than left blank; the ZIP is what puts them on the map later. */
  const mobileBox = $('#bMobile');
  mobileBox.addEventListener('change', () => {
    const on = mobileBox.checked;
    $('#bAddrField').hidden = on;
    $('#bZipField').hidden = !on;
    if (on) $('#bAddr').value = '';
  });

  /* Round the clock is one answer, not seven identical rows. */
  const box24 = $('#b24');
  box24.addEventListener('change', () => { $('#bHours').hidden = box24.checked; });

  /** the seven day rows → the canonical hours array */
  const readHours = () => box24.checked
    // the existing shape, not a new field: ['00:00','24:00'] is round the clock
    ? [0, 1, 2, 3, 4, 5, 6].map(() => [['00:00', '24:00']])
    : [0, 1, 2, 3, 4, 5, 6].map(i => {
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
    const mobile = $('#bMobile').checked;
    const rec = S.addBusiness({
      // Most shops here trade under an English name only. Rather than invent
      // an Arabic one, the English name stands in both fields.
      name: { ar: nameAr || name, en: name }, cat, phone,
      address: mobile ? '' : address,
      mobileService: mobile,
      zip: mobile ? $('#bZip').value.trim() : '',
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
    // the two the importer also demands, and nothing else invented here
    if (!name || !cat) { toast(t('required'), 'err'); refreshSave(); return; }

    /* The look-alike check runs FIRST, on the name and the phone alone.
       Their own shop is very often already here — they just could not find
       it — and making somebody fill eight speciality groups before telling
       them so is exactly backwards. Show them, and let them take it over. */
    const dups = S.findDuplicates({ phone, name, address, cat });
    if (dups.length) {
      openSimilarSheet(dups, (conf) => { if (finishChecks()) save(conf === 'certain'); });
      return;
    }
    if (!finishChecks()) return;
    if (!S.requireTier(2, '#/add-business', go)) return;
    save();
  });

  /** the rest of the form, checked only once this is really a new listing */
  function finishChecks() {
    if ($('#bMobile').checked && !/^\d{5}$/.test($('#bZip').value.trim())) {
      toast(t('zipRequired'), 'err');
      $('#bZip').classList.add('input-err');
      $('#bZip').focus();
      return false;
    }
    $('#bZip').classList.remove('input-err');

    /* One speciality from every group. An empty group is a listing nobody
       can filter to, and the button names the group rather than saying
       "something is missing" and leaving them to hunt. */
    const groups = S.attrGroupsForCat(cat, { all: true });
    const empty = groups.find(g => !g.attrs.some(a => picked.includes(a.id)));
    if (empty) {
      toast(t('pickOneFrom').replace('{g}', t(empty.group.key)), 'err');
      openGrp = empty.group.id;
      paintAttrs();
      const box = $(`.attr-box[data-grp="${empty.group.id}"]`);
      if (box) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    return S.requireTier(2, '#/add-business', go);
  }
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
        <div class="row-title">${esc(L(top.biz.name))}${bizBadgeHtml(top.biz)}</div>
        <div class="row-sub"><span>${t(catKey(top.biz.cat))}</span></div>
        ${top.biz.address ? `<div class="row-sub"><span class="ltr">${esc(top.biz.address)}</span></div>` : ''}
        ${top.biz.phone ? `<div class="row-sub"><span class="ltr">${esc(top.biz.phone)}</span></div>` : ''}
        <div class="row-sub gold">${why}</div>
      </div>
    </div>
    <button class="btn btn-ghost btn-sm btn-block" id="simOpen">${icon('eye', 17)} ${t('similarOpenPage')}</button>

    ${rest.length ? `<div class="hint mt-12">${t('similarAlso')}</div>
      ${rest.map(h => `<div class="list-row" style="margin-top:6px" data-sim="${h.biz.id}">
        <span class="row-ico">${icon(catIcon(h.biz.cat), 20)}</span>
        <div class="row-main"><div class="row-title">${esc(L(h.biz.name))}</div>
          <div class="row-sub"><span class="ltr">${esc(h.biz.address || '')}</span></div></div>
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
        <b style="font-size:1.0625rem">${t('claimPendingTitle')}</b>
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
        <div class="row-main"><div class="row-title">${esc(L(b.name))}</div>
          <div class="row-sub"><span class="ltr">${esc(b.address)}</span></div></div>
      </div>
      <div class="list-note" style="margin:0 0 14px">${icon('info', 18)}<span>${t('claimFormNote')}</span></div>
      ${/* Rai's decision (question 2): ONE account, and the business mark is
           added HERE — at the moment of pressing, which is the highest point
           of willingness there is. Not two kinds at sign-up, where nobody yet
           knows which they are and the question only costs registrations.
           ⚠️ And the FORM IS THE STEP: it already asks the name, the role,
           the phone and the proof, so a second «convert» screen would be the
           same four fields twice — the duplication this project bans. */''}
      ${S.isBusinessAccount() ? '' : `
      <div class="list-note" style="margin:0 0 14px">${icon('briefcase', 18)}
        <span><b>${t('toBusinessTitle')}</b><br>${t('toBusinessSub')}</span></div>`}

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
    /* the mark is added on SENDING, not on approval: somebody who sent a
       request and waited a week is not offered a «convert your account»
       note again every time they open another listing. Approval is the
       admin's decision; the mark describes what the reader did. */
    S.makeBusinessAccount();
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
          <div class="row-title">${esc(L(b.name))}</div>
          <div class="row-sub">${icon('mapPin', 13)} <span class="ltr">${esc(b.address)}</span></div>
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
/**
 * @param allowAdmin  only the EDIT screen sets this. The panel edits a
 *   listing through the owner's own form — two forms would be two shapes
 *   of the same data — but it must not reach `#/verify-business`, which is
 *   the owner *applying* for the gold badge. The admin reviews those
 *   applications in the panel; filing one on somebody's behalf is a
 *   different thing entirely.
 */
function ownerOnly(bizId, allowAdmin = false) {
  const ok = S.ownsBusiness(bizId) || (allowAdmin && S.adminUnlocked());
  if (!ok) { go('#/directory/' + bizId); return false; }
  return true;
}

export function BusinessEditScreen(root, params) {
  const b = S.businessById(params[0]);
  if (!b) { go('#/directory'); return; }
  if (!ownerOnly(b.id, true)) return;   // the admin panel edits through here
  renderHeader({ simple: true, title: t('editBusiness') });

  let picked = (b.attributes || []).slice();
  const cat = b.cat;

  root.innerHTML = `
    <div class="pad mt-16">
      ${/* adminUnlocked() is a login, not a mode that stays switched on and
           gets forgotten — so the danger was never that it lingers, it is
           not noticing you are in it. One line, and its presence is what
           stops somebody editing a shop believing it is their own. */''}
      ${S.adminEditing(b.id)
        ? `<div class="admin-as">${icon('shield', 17)}<span>${t('adminAsAdmin')}</span></div>` : ''}
      <div class="field"><label class="label">${t('nameEn')}</label>
        <input class="input ltr" id="eName" dir="ltr" value="${esc((b.name && b.name.en) || '')}" /></div>
      <div class="field"><label class="label">${t('nameAr')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="eNameAr" value="${esc((b.name && b.name.ar) || '')}" />
        <div class="hint">${t('nameArHint')}</div></div>
      <div class="field"><label class="label">${t('phoneLabel')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="ePhone" inputmode="tel" value="${esc(b.phone || '')}" />
        <div class="hint">${t('phoneOptionalHint')}</div></div>
      <div class="field"><label class="label">${t('address')} <span class="muted">(${t('optional')})</span></label>
        <input class="input" id="eAddr" value="${esc(b.address || '')}" /></div>
      <div class="field"><label class="label">${t('descLabel')}</label><textarea class="textarea" id="eDesc">${esc(L(b.desc || ''))}</textarea></div>
      <div class="field"><label class="label">${t('keywords')}</label>
        <input class="input" id="eTags" value="${esc((b.tags || []).join('، '))}" />
        <div class="hint">${t('keywordsHint')}</div></div>
      <div class="field"><label class="label">${t('features')}</label><div id="eAttrs"></div></div>
      ${cat === 'outings' ? `<div class="field"><label class="label">${t('entryPrice')} <span class="muted">(${t('optional')})</span></label>
        <input class="input ltr" id="eEntry" dir="ltr" value="${esc(b.entryPrice || '')}" placeholder="$12 / person" />
        <div class="hint">${t('entryPriceHint')}</div></div>` : ''}
      ${worshipFields(b)}
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
      ...(b.cat === 'worship' ? { worship: readWorshipFields(b) } : {}),
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
      <b style="font-size:1.0625rem">${t('bizVerifiedOn')}</b>
      <button class="btn btn-ghost mt-16" data-route="#/directory/${b.id}">${t('back')}</button></div>`;
    wireRoutes(root); return;
  }
  if (st && st.status === 'pending') {
    root.innerHTML = `<div class="pad mt-20 center-col">
      <div class="empty-ico">${icon('clock', 33)}</div>
      <b style="font-size:1.0625rem">${t('bizVerifyPendingTitle')}</b>
      <span class="muted fs-13">${t('bizVerifyPending')}</span>
      <button class="btn btn-ghost mt-16" data-route="#/directory/${b.id}">${t('back')}</button></div>`;
    wireRoutes(root); return;
  }
  if (!S.isPaid(b)) {
    root.innerHTML = `<div class="pad mt-20 center-col">
      <div class="empty-ico">${icon('lock', 33)}</div>
      <b style="font-size:1.0625rem">${t('verifyNeedsPlan')}</b>
      <button class="btn btn-gold mt-16" data-route="#/subscribe/${b.id}">${t('upgradeBtn')}</button></div>`;
    wireRoutes(root); return;
  }

  root.innerHTML = `
    <div class="pad mt-16">
      ${st && st.status === 'rejected' && st.reason
        ? `<div class="err-msg" style="margin-bottom:12px">${icon('alert', 15)} ${esc(st.reason)}</div>` : ''}
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

/* --------------------------- SUBSCRIBE --------------------------- */
/** a date the way a person reads it, in whichever language is on */
export function fmtDate(ms) {
  const d = new Date(ms);
  if (isNaN(d)) return '';
  const locale = S.state.lang === 'en' ? 'en-US' : 'ar-EG-u-nu-latn';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The plan. Monthly or yearly, the yearly price derived from the monthly
 * one, a fourteen-day trial said in plain words, and no card field
 * anywhere on this screen — that comes after the consent step.
 */
export function SubscribeScreen(root, params) {
  renderHeader({ simple: true, title: t('subscription') });
  const bizId = params[0] || S.primaryBusinessId();
  /* The photos and the badge were guarded and the payment path was not —
     not because the admin bypass leaked into it, but because nobody had
     ever put a guard here at all. `#/subscribe/b1` opened in full for a
     reader who owns nothing, and the id comes off the URL, so the
     subscription would be written against a shop belonging to somebody
     else. NO allowAdmin, deliberately: an admin edits data and never buys
     in another person's name — a paid subscription given by hand goes
     through the panel, where it leaves a receipt and a record of who
     took the money. */
  if (bizId && !ownerOnly(bizId)) return;
  const sub = S.subscription();
  const active = sub && S.subscriptionActive() && (!bizId || sub.businessId === bizId);
  let plan = 'monthly';

  const paint = () => {
    const price = S.planPrice(plan);
    root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico" style="width:64px;height:64px">${icon('crown', 33)}</div>
      <b style="font-size:1.125rem">${t('subTitle')}</b>
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
        <div style="font-size:2.125rem;font-weight:700;color:var(--gold-bright)">${fmtMoney(price)}<span style="font-size:.875rem;color:var(--muted)">${plan === 'yearly' ? t('year') : t('month')}</span></div>
        ${plan === 'yearly' ? `<span class="gold fs-13">${t('planSaveLine').replace('{x}', fmtMoney(S.yearlySaving()))}</span>` : ''}
      </div>
      <div class="list-note" style="margin-inline:0;margin-top:12px">${icon('gift', 18)}
        <span>${t(plan === 'yearly' ? 'trialBannerYear' : 'trialBanner').replace('{x}', fmtMoney(price))}</span></div>
    </div>` : ''}

    <div class="pad">
      ${[
        ['image', 'planPhotos', ''],
        ['play', 'planVideo', ''],
        /* Rai asked for the cold word «أهلية» to go, and it goes — but the
           meaning stays: paying is the precondition for applying, never
           the badge itself. Somebody reading «نشاط موثّق» beside $29
           expects the mark tomorrow, and when it does not come they have
           bought something they did not receive. «بعد المراجعة» is three
           words and it prevents all of that, so it is never dropped. */
        ['checkCircle', 'planVerify', 'planVerifySub'],
        /* ⚠️ the sub-line is not decoration: «الصفّان الأولان» without
           «بالتناوب» is «always first», which is not what is delivered
           once a category holds more than two subscribers. */
        ['trendingUp', 'planRank', 'planRankSub'],
        ['crown', 'planFeatured', ''],
        ['shield', 'planOnlyYours', 'planOnlyYoursSub'],
        ['trendingUp', 'planStats', ''],
        ['gift', 'planOffers', ''],
      ].map(([ico, key, sub2]) => `
        <div class="info-row"><span class="i-ico">${icon(ico, 21)}</span>
          <div class="i-txt"><b>${t(key)}${key === 'planVerify'
            ? `<span class="badge badge-bizverified mark" aria-hidden="true">${icon('shieldCheck', 12)}</span>` : ''}</b>${
            sub2 ? `<span>${t(sub2)}</span>` : ''}</div></div>`).join('')}
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
      if (!S.primaryBusinessId() && !bizId) { go('#/claim'); return; }
      // no card field on this screen: the consent step comes first, by law
      go('#/subscribe-consent/' + (bizId || S.primaryBusinessId()) + '?plan=' + plan);
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
  const bizId = params[0] || S.primaryBusinessId();
  if (bizId && !ownerOnly(bizId)) return;   // see SubscribeScreen
  const b = S.businessById(bizId);
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
    const started = S.startSubscription({
      businessId: bizId, plan, consentText,
      device: navigator.userAgent.slice(0, 120),
    });
    if (!started) { toast(t('somethingWrong'), 'err'); return; }
    /* The trial charges nothing, and the receipt still says so: a zero
       receipt is the record of when the agreement was accepted, and the
       first real charge gets its own. */
    S.addReceipt({
      kind: 'subscription', amount: 0, method: 'card', bizId,
      description: `${t('subscription')} — ${esc(L(b ? b.name : ''))}`,
      autoRenew: true,
      covers: { from: S.now(), to: started.currentPeriodEnd },
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
          ${biz ? `<div class="muted fs-13">${esc(L(biz.name))}</div>` : ''}
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
