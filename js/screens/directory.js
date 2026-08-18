/* ======================= DIRECTORY + LISTING ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, openSheet, closeSheet, confirmSheet,
         toast, stars, wireRoutes, emptyState, query, openMaps, shareItem, fmtMoney,
         openFilterSheet, activeFilterCount, sectionNote,
         showsPrices, priceGate, wirePriceGates,
         openBadge, attrChips, fmtDay, fmtTime, bizBadge } from '../ui.js';
import { CATEGORIES, SUBSCRIPTION_PRICE, DAY_KEYS } from '../data.js';
import * as S from '../store.js';
import { catIcon } from './home.js';
import { mountPhotoPicker } from './marketplace.js';

/* ----------------------------- LIST ----------------------------- */
export function DirectoryScreen(root) {
  renderHeader({});
  const q = query();
  let cat = q.cat || 'all';
  let term = q.q || '';
  let filters = { cat, radius: S.state.radius, sort: 'newest', openNow: false, attrs: [] };

  root.innerHTML = `
    <div class="search-row">
      <div class="search-bar">${icon('search', 21)}<input id="dirSearch" placeholder="${t('searchDirectory')}" value="${term}" /></div>
      <button class="loc-chip" data-loc>${icon('mapPin', 17)}<span>${S.state.location.city}</span></button>
      <button class="filter-btn" id="dirFilter" aria-label="${t('filters')}">${icon('filter', 20)}<span id="fCount"></span></button>
    </div>

    <div class="hscroll mt-12" id="catChips">
      <button class="chip ${cat === 'all' ? 'active' : ''}" data-cat="all">${t('catAll')}</button>
      ${CATEGORIES.filter(c => !c.route).map(c => `<button class="chip ${cat === c.id ? 'active' : ''}" data-cat="${c.id}">${icon(c.icon, 15)} ${t(c.key)}</button>`).join('')}
    </div>

    <div class="hscroll mt-8" id="attrChips"></div>
    <div id="dirNote"></div>
    <div class="pad mt-12" id="dirList"></div>

    <div class="list-note" style="margin-bottom:18px">${icon('info', 18)}
      <span>${t('isThisYours')} <b class="gold" data-route="#/claim" style="cursor:pointer">${t('claimIt')}</b> · <b class="gold" data-route="#/add-business" style="cursor:pointer">${t('addBusiness')}</b></span>
    </div>`;

  /* The quick chips are generated from the attribute registry for whichever
     category is showing, so a new attribute needs no code here at all.
     "Open now" always leads: it is the question people ask most. */
  const paintChips = () => {
    const quick = S.quickAttrsForCat(cat);
    $('#attrChips').innerHTML =
      `<button class="chip ${filters.openNow ? 'active' : ''}" data-attr="__open">${icon('clock', 14)} ${t('filterOpenNow')}</button>`
      + quick.map(a => `<button class="chip ${filters.attrs.includes(a.id) ? 'active' : ''}" data-attr="${a.id}">
          ${icon(a.icon, 14)} ${t(a.key)}</button>`).join('');
    $('#attrChips').style.display = 'flex';
    $$('#attrChips .chip').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.attr;
      if (id === '__open') filters.openNow = !filters.openNow;
      else {
        const i = filters.attrs.indexOf(id);
        if (i >= 0) filters.attrs.splice(i, 1); else filters.attrs.push(id);
      }
      // chips combine rather than replace one another
      b.classList.toggle('active', id === '__open' ? filters.openNow : filters.attrs.includes(id));
      paint();
    }));
  };

  const paint = () => {
    const now = new Date();
    let list = S.allBusinesses()
      .filter(b => cat === 'all' || b.cat === cat)
      .filter(b => b.dist <= S.state.radius)
      .filter(b => S.matchesSearch(b, term))
      .filter(b => !filters.openNow || S.isOpenNow(b, now))
      .filter(b => S.matchesAttrs(b, filters.attrs));

    if (filters.sort === 'rated') {
      list.sort((a, b) => S.ratingFor(b).avg - S.ratingFor(a).avg);
    } else if (filters.sort === 'nearest') {
      list.sort((a, b) => a.dist - b.dist);
    } else if (filters.sort === 'open') {
      list.sort((a, b) => (S.isOpenNow(b, now) - S.isOpenNow(a, now)) || a.dist - b.dist);
    } else {
      list.sort((a, b) => (S.businessPlan(b) === 'paid') - (S.businessPlan(a) === 'paid') || a.dist - b.dist);
    }

    const sec = CATEGORIES.find(c => c.id === cat);
    $('#dirNote').innerHTML = sectionNote(sec ? t(sec.key) : '', list.length);

    const el = $('#dirList');
    const filtered = filters.openNow || filters.attrs.length || term;
    if (!list.length && filtered) {
      // a filtered dead end needs its own way out, not a radius suggestion
      el.innerHTML = emptyState('filter', t('noFilterResults'), t('noFilterResultsSub'));
      el.querySelector('.empty').insertAdjacentHTML('beforeend',
        `<button class="btn btn-gold" id="clrF">${t('clearFiltersBtn')}</button>`);
      el.querySelector('#clrF').addEventListener('click', () => {
        filters.openNow = false; filters.attrs = []; term = '';
        $('#dirSearch').value = '';
        paintChips(); paint();
      });
      const fc0 = $('#fCount');
      const n0 = activeFilterCount(filters);
      fc0.className = n0 ? 'f-count' : '';
      fc0.textContent = n0 || '';
      $('#dirFilter').classList.toggle('on', n0 > 0);
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
    if (!list.length) $$('#dirList .empty .btn').forEach(b => b.addEventListener('click', () => import('./home.js').then(m => m.openRadiusSheet())));

    const fc = $('#fCount');
    const n = activeFilterCount(filters);
    fc.className = n ? 'f-count' : '';
    fc.textContent = n || '';
    $('#dirFilter').classList.toggle('on', n > 0);
  };
  paintChips();
  paint();

  const activeChip = $('#catChips .chip.active');
  if (activeChip && cat !== 'all') activeChip.scrollIntoView({ inline: 'center', block: 'nearest' });

  $$('#catChips .chip').forEach(c => c.addEventListener('click', () => {
    cat = c.dataset.cat;
    $$('#catChips .chip').forEach(x => x.classList.toggle('active', x === c));
    // the quick chips belong to the category — drop any that no longer apply
    const valid = S.attrsForCat(cat === 'all' ? '*' : cat).map(a => a.id);
    filters.attrs = filters.attrs.filter(id => valid.includes(id));
    filters.cat = cat;
    paintChips();
    paint();
  }));
  $('#dirSearch').addEventListener('input', e => { term = e.target.value; paint(); });
  $('[data-loc]').addEventListener('click', () => import('./home.js').then(m => m.openLocationSheet()));
  $('#dirFilter').addEventListener('click', () => openFilterSheet({
    cats: CATEGORIES.filter(c => !c.route).map(c => ({ id: c.id, label: t(c.key) })),
    value: filters,
    withPrice: false,
    withAttrs: true,
    onApply: (v) => {
      filters = v; cat = v.cat;
      $$('#catChips .chip').forEach(x => x.classList.toggle('active', x.dataset.cat === cat));
      paintChips();
      paint();
    },
  }));
  wireRoutes(root);
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
        <span>${icon('mapPin', 13)} ${b.dist} ${t('miles')}</span>
        ${openBadge(b)}
      </div>
      <div class="row-actions">
        <button class="mini-btn gold" data-call="${b.phone}">${icon('phone', 15)} ${t('call')}</button>
      </div>
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

      <div class="action-grid">
        <button class="btn btn-gold" id="callBtn">${icon('phone', 20)} ${t('call')}</button>
        <button class="btn btn-ghost" id="mapBtn">${icon('navigation', 20)} ${t('directions')}</button>
      </div>

      <div class="info-row">${`<span class="i-ico">${icon('phone', 21)}</span>`}<div class="i-txt"><b class="ltr">${b.phone}</b><span>${t('phoneLabel')}</span></div></div>
      <div class="info-row">${`<span class="i-ico">${icon('mapPin', 21)}</span>`}<div class="i-txt"><b class="ltr">${b.address}</b><span>${t('address')} · ${b.dist} ${t('miles')} ${t('distanceAway')}</span></div></div>
      ${hoursBlock(b)}
      ${worshipBlock(b)}
      <div class="info-row">${`<span class="i-ico">${icon('bookmark', 21)}</span>`}<div class="i-txt"><b>${t(catKey(b.cat))}</b><span>${t('category')}</span></div></div>

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

    ${similarBlock(b, paid)}`;

  $('#bk').addEventListener('click', () => back());
  $('#callBtn').addEventListener('click', () => { location.href = 'tel:' + b.phone; });
  $('#mapBtn').addEventListener('click', () => openMaps(b.address));
  $('#shareBtn').addEventListener('click', () => shareItem(L(b.name), location.href));
  $('#repBtn').addEventListener('click', () => { S.reportItem(b.id); toast(t('reported'), 'ok'); });

  const sb = $('#saveBtn');
  const paintSave = () => { sb.innerHTML = icon('heart', 22); sb.style.color = S.isSaved(b.id) ? 'var(--gold-bright)' : ''; };
  paintSave();
  sb.addEventListener('click', () => {
    if (!S.requireTier(1, location.hash, go)) return;
    S.toggleSaved(b.id); paintSave();
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
  if (mine) {
    const verified = S.businessVerified(b);
    const vs = S.bizVerifyState(b.id);
    return `<div class="owner-box">
      <div class="owner-head">${icon('briefcase', 18)} <b>${t('youOwnThis')}</b></div>
      <div class="action-grid" style="margin:10px 0 0">
        <button class="btn btn-ghost btn-sm" data-route="#/business/edit/${b.id}">${icon('edit', 18)} ${t('editBusiness')}</button>
        <button class="btn btn-ghost btn-sm" data-route="#/business/photos/${b.id}">${icon('camera', 18)} ${t('managePhotos')}</button>
      </div>
      ${verified
        ? `<div class="ok-msg" style="text-align:center">${t('bizVerifiedOn')}</div>`
        : vs && vs.status === 'pending'
          ? `<div class="hint" style="text-align:center">${t('bizVerifyPending')}</div>`
          : paid
            ? `<button class="btn btn-outline-gold btn-block mt-8" id="verifyBtn">${icon('checkCircle', 19)} ${t('verifyBusiness')}</button>
               ${vs && vs.status === 'rejected' && vs.reason ? `<div class="err-msg">${icon('alert', 15)} ${vs.reason}</div>` : ''}`
            : `<div class="hint" style="text-align:center">${t('verifyNeedsPlan')}</div>`}
      ${!paid ? `<div class="upsell" style="margin:12px 0 0">
        <div class="upsell-txt"><b>${t('upgradeBanner')}</b><span>${showsPrices()
          ? fmtMoney(SUBSCRIPTION_PRICE) + ' ' + t('month') : t('pricesAfterSignup')}</span></div>
        <button class="btn btn-gold btn-sm" data-route="#/subscribe/${b.id}">${t('upgradeBtn')}</button>
      </div>` : ''}
    </div>`;
  }
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
          <div class="row-sub"><span>${icon('mapPin', 13)} ${x.dist} ${t('miles')}</span>${openBadge(x)}</div>
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
      <div class="field"><label class="label">${t('phoneLabel')}</label><input class="input" id="bPhone" inputmode="tel" placeholder="(713) 555-0000" /></div>
      <div class="field"><label class="label">${t('address')}</label><input class="input" id="bAddr" /></div>

      <div class="field"><label class="label">${t('keywords')}</label>
        <input class="input" id="bTags" placeholder="شاورما، مشاوي، shawarma" />
        <div class="hint">${t('keywordsHint')}</div></div>

      <div class="field"><label class="label">${t('hoursTitle')}</label>
        <div class="hrs-grid">${[0, 1, 2, 3, 4, 5, 6].map(dayRow).join('')}</div></div>

      <div class="field"><label class="label">${t('features')}</label>
        <div id="bAttrs"></div></div>

      <div class="field"><label class="label">${t('descLabel')} <span class="muted">(${t('optional')})</span></label><textarea class="textarea" id="bDesc"></textarea></div>
      <div id="bDup"></div>
      <button class="btn btn-gold btn-block" id="bSave">${t('addBusiness')}</button>
      <div class="hint" style="text-align:center;margin-top:10px">${t('lockedSub')}</div>
    </div>`;

  /* The checkboxes are generated from the registry for the chosen category —
     nothing about "halal" or "women only" is written here, so a new attribute
     appears in this form the moment it is added to data.js. */
  const paintAttrs = () => {
    $('#bAttrs').innerHTML = S.attrGroupsForCat(cat).map(g => `
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

  $('#bCat').addEventListener('change', (e) => {
    cat = e.target.value;
    const valid = S.attrsForCat(cat).map(a => a.id);
    picked = picked.filter(id => valid.includes(id));
    paintAttrs();
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

  const save = () => {
    const { name, nameAr, phone, address } = collect();
    const tags = $('#bTags').value.split(/[,\u060C\n]/).map(x => x.trim()).filter(Boolean);
    const rec = S.addBusiness({
      // Most shops here trade under an English name only. Rather than invent
      // an Arabic one, the English name stands in both fields.
      name: { ar: nameAr || name, en: name }, cat, phone, address,
      hours: readHours(), tags, attributes: picked.slice(),
      desc: { ar: $('#bDesc').value, en: $('#bDesc').value },
    });
    toast(t('done'), 'ok');
    go('#/directory/' + rec.id);
  };

  $('#bSave').addEventListener('click', () => {
    const { name, phone, address } = collect();
    if (!name || !phone || !address) { toast(t('required'), 'err'); return; }
    if (!S.requireTier(2, '#/add-business', go)) return;

    /* 300 shops go in by hand and their owners will add themselves later
       because they could not find their own listing. Catch it at the door. */
    const dups = S.findDuplicates({ phone, name, address });
    if (dups.length) { showDuplicate(dups, save); return; }
    save();
  });
}

/** the duplicate warning: name the match, and offer both honest answers */
function showDuplicate(dups, proceed) {
  const el = $('#bDup');
  el.innerHTML = `
    <div class="dup-warn">
      <div class="dup-head">${icon('alert', 18)} <b>${t('dupTitle')}</b></div>
      ${dups.slice(0, 3).map(d => `
        <div class="dup-row">
          <span class="row-ico">${icon(catIcon(d.biz.cat), 18)}</span>
          <div class="row-main">
            <div class="row-title">${L(d.biz.name)}</div>
            <div class="row-sub"><span class="ltr">${d.biz.address}</span></div>
            <div class="row-sub gold">${d.reason === 'phone' ? t('dupByPhone') : t('dupByName')}</div>
          </div>
          <button class="mini-btn" data-see="${d.biz.id}">${icon('eye', 15)}</button>
        </div>`).join('')}
      <button class="btn btn-ghost btn-block mt-8" id="dupCancel">${t('dupSame')}</button>
      <button class="btn btn-gold btn-block mt-8" id="dupGo">${t('dupDifferent')}</button>
    </div>`;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  $$('#bDup [data-see]').forEach(b => b.addEventListener('click', () => go('#/directory/' + b.dataset.see)));
  $('#dupCancel').addEventListener('click', () => { el.innerHTML = ''; go('#/directory'); });
  $('#dupGo').addEventListener('click', () => { el.innerHTML = ''; proceed(); });
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
    <div class="search-wrap"><div class="search-bar">${icon('search', 21)}<input id="clSearch" placeholder="${t('searchDirectory')}" /></div></div>
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
      <div class="field"><label class="label">${t('phoneLabel')}</label><input class="input" id="ePhone" inputmode="tel" value="${attr(b.phone)}" /></div>
      <div class="field"><label class="label">${t('address')}</label><input class="input" id="eAddr" value="${attr(b.address)}" /></div>
      <div class="field"><label class="label">${t('descLabel')}</label><textarea class="textarea" id="eDesc">${L(b.desc || '')}</textarea></div>
      <div class="field"><label class="label">${t('keywords')}</label>
        <input class="input" id="eTags" value="${attr((b.tags || []).join('، '))}" />
        <div class="hint">${t('keywordsHint')}</div></div>
      <div class="field"><label class="label">${t('features')}</label><div id="eAttrs"></div></div>
      <button class="btn btn-gold btn-block" id="eSave">${icon('check', 19)} ${t('saveChanges')}</button>
    </div>`;

  const paintAttrs = () => {
    $('#eAttrs').innerHTML = S.attrGroupsForCat(cat).map(g => `
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
export function SubscribeScreen(root, params) {
  renderHeader({ simple: true, title: t('subscription') });
  const bizId = params[0] || S.state.myBusinessId;
  const active = S.state.subscription && (!bizId || S.state.subscription.businessId === bizId);

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico" style="width:64px;height:64px">${icon('crown', 33)}</div>
      <b style="font-size:18px">${t('subTitle')}</b>
      <span class="muted fs-13">${t('subSub')}</span>
      ${showsPrices()
        ? `<div style="font-size:34px;font-weight:700;color:var(--gold-bright);margin:14px 0 2px">${fmtMoney(SUBSCRIPTION_PRICE)}<span style="font-size:14px;color:var(--muted)">${t('month')}</span></div>`
        : ''}
    </div>
    <div class="pad mt-16">
      ${[
        ['image', 'planPhotos', ''],
        ['play', 'planVideo', ''],
        ['checkCircle', 'planVerify', ''],
        ['trendingUp', 'planRank', ''],
        ['crown', 'planFeatured', ''],
        ['shield', 'planOnlyYours', 'planOnlyYoursSub'],
        ['trendingUp', 'planStats', ''],
        ['gift', 'planOffers', ''],
      ].map(([ico, key, sub]) => `
        <div class="info-row"><span class="i-ico">${icon(ico, 21)}</span>
          <div class="i-txt"><b>${t(key)}</b>${sub ? `<span>${t(sub)}</span>` : ''}</div></div>`).join('')}
      <div class="list-note" style="margin-inline:0">${icon('info', 18)}<span>${t('planFreeNote')}</span></div>
      ${!showsPrices()
        ? priceGate('#/subscribe' + (params[0] ? '/' + params[0] : ''), 'unlockPrice')
        : active
          ? `<div class="ok-msg mt-16" style="text-align:center">${t('subActive')}</div>
             <button class="btn btn-danger btn-block mt-12" id="cancelSub">${t('cancelSub')}</button>`
          : `<button class="btn btn-gold btn-block mt-16" id="subBtn">${icon('creditCard', 20)} ${t('subscribeNow')}</button>`}
      <div class="hint" style="text-align:center;margin-top:10px">${t('needPhoneSub')}</div>
    </div>`;

  wirePriceGates(root);

  const sb = $('#subBtn');
  if (sb) sb.addEventListener('click', async () => {
    if (!S.requireTier(2, location.hash, go)) return;
    if (!S.state.myBusinessId && !bizId) { go('#/claim'); return; }
    sb.innerHTML = `<span class="spinner"></span> ${t('paying')}`;
    await S.chargeCard(SUBSCRIPTION_PRICE, 'ARABNA business plan');
    S.subscribeBusiness(bizId || S.state.myBusinessId);
    toast(t('subActive'), 'ok');
    go('#/directory/' + (bizId || S.state.myBusinessId));
  });
  const cb = $('#cancelSub');
  if (cb) cb.addEventListener('click', () => confirmSheet({
    title: t('cancelSub'), sub: '', confirmText: t('confirm'), danger: true,
    onConfirm: () => { S.cancelSubscription(); toast(t('subCancelled'), 'ok'); go('#/profile'); }
  }));
}
