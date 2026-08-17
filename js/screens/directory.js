/* ======================= DIRECTORY + LISTING ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, openSheet, closeSheet, confirmSheet,
         toast, stars, wireRoutes, emptyState, query, openMaps, shareItem, fmtMoney,
         openFilterSheet, activeFilterCount } from '../ui.js';
import { CATEGORIES, SUBSCRIPTION_PRICE } from '../data.js';
import * as S from '../store.js';
import { catIcon } from './home.js';

/* ----------------------------- LIST ----------------------------- */
export function DirectoryScreen(root) {
  renderHeader({});
  const q = query();
  let cat = q.cat || 'all';
  let term = q.q || '';
  let filters = { cat, radius: S.state.radius, sort: 'newest' };

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

    <div class="pad mt-12" id="dirList"></div>

    <div class="list-note" style="margin-bottom:18px">${icon('info', 18)}
      <span>${t('isThisYours')} <b class="gold" data-route="#/claim" style="cursor:pointer">${t('claimIt')}</b> · <b class="gold" data-route="#/add-business" style="cursor:pointer">${t('addBusiness')}</b></span>
    </div>`;

  const paint = () => {
    let list = S.allBusinesses()
      .filter(b => cat === 'all' || b.cat === cat)
      .filter(b => b.dist <= S.state.radius)
      .filter(b => !term || L(b.name).toLowerCase().includes(term.toLowerCase()) || L(b.desc || '').toLowerCase().includes(term.toLowerCase()));

    if (filters.sort === 'rated') {
      list.sort((a, b) => S.ratingFor(b).avg - S.ratingFor(a).avg);
    } else if (filters.sort === 'nearest') {
      list.sort((a, b) => a.dist - b.dist);
    } else {
      list.sort((a, b) => (S.businessPlan(b) === 'paid') - (S.businessPlan(a) === 'paid') || a.dist - b.dist);
    }

    const el = $('#dirList');
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
  paint();

  const activeChip = $('#catChips .chip.active');
  if (activeChip && cat !== 'all') activeChip.scrollIntoView({ inline: 'center', block: 'nearest' });

  $$('#catChips .chip').forEach(c => c.addEventListener('click', () => {
    cat = c.dataset.cat;
    $$('#catChips .chip').forEach(x => x.classList.toggle('active', x === c));
    paint();
  }));
  $('#dirSearch').addEventListener('input', e => { term = e.target.value; paint(); });
  $('[data-loc]').addEventListener('click', () => import('./home.js').then(m => m.openLocationSheet()));
  $('#dirFilter').addEventListener('click', () => openFilterSheet({
    cats: CATEGORIES.filter(c => !c.route).map(c => ({ id: c.id, label: t(c.key) })),
    value: filters,
    withPrice: false,
    onApply: (v) => {
      filters = v; cat = v.cat;
      $$('#catChips .chip').forEach(x => x.classList.toggle('active', x.dataset.cat === cat));
      paint();
    },
  }));
  wireRoutes(root);
}

/* Slim card: icon · name + verified · rating/reviews/distance on one line ·
   call. The written phone duplicated the call button and "directions" now
   lives on the detail page, where the address is anyway. */
function rowHtml(b) {
  const paid = S.businessPlan(b) === 'paid';
  const r = S.ratingFor(b);
  return `<div class="list-row ${paid ? 'premium' : ''}" data-route="#/directory/${b.id}">
    <span class="row-ico">${icon(catIcon(b.cat), 22)}</span>
    <div class="row-main">
      <div class="row-title">${L(b.name)}
        ${paid ? `<span class="badge badge-verified">${icon('check', 12)}${t('verified')}</span>` : `<span class="badge badge-free">${t('free')}</span>`}
      </div>
      <div class="row-sub">${paid && r.count ? stars(r.avg) + `<span>· ${r.count} ${t('reviews')}</span> · ` : ''}
        <span>${icon('mapPin', 13)} ${b.dist} ${t('miles')}</span>
      </div>
      <div class="row-actions">
        <button class="mini-btn gold" data-call="${b.phone}">${icon('phone', 15)} ${t('call')}</button>
      </div>
    </div>
  </div>`;
}

/** the $29 subscription upsell, sized like a business row */
function upsellHtml() {
  return `<div class="list-row" data-route="#/subscribe" style="border-color:var(--line)">
    <span class="row-ico" style="color:var(--gold-bright)">${icon('crown', 22)}</span>
    <div class="row-main">
      <div class="row-title">${t('upgradeBanner')}</div>
      <div class="row-sub gold"><span class="ltr">${fmtMoney(SUBSCRIPTION_PRICE)}</span> ${t('month')}</div>
    </div>
    <span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 19)}</span>
  </div>`;
}

/* --------------------------- DETAIL --------------------------- */
export function ListingScreen(root, params) {
  const b = S.businessById(params[0]);
  if (!b) { go('#/directory'); return; }
  renderHeader({ hidden: true });

  const paid = S.businessPlan(b) === 'paid';
  const revs = S.reviewsFor(b.id);
  const rate = S.ratingFor(b);
  const myRev = S.myReviewFor(b.id);
  const mine = S.state.myBusinessId === b.id;

  root.innerHTML = `
    <div class="detail-hero">
      <button class="back-btn" id="bk">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 22)}</button>
      <div style="color:var(--gold-bright)">${icon(catIcon(b.cat), 54)}</div>
      ${paid ? `<span class="badge badge-verified" style="position:absolute;inset-block-end:12px;inset-inline-start:14px">${icon('check', 13)}${t('verified')}</span>` : ''}
    </div>

    <div class="detail-body">
      <div class="row-between">
        <div>
          <div class="detail-title">${L(b.name)}</div>
          <div class="row-sub">${paid && rate.count ? stars(rate.avg) + `<span>· ${rate.count} ${t('reviews')}</span>` : `<span class="badge badge-free">${t('free')}</span>`}</div>
        </div>
        <button class="icon-btn" id="saveBtn">${icon('heart', 22)}</button>
      </div>

      <p class="fs-13 muted mt-12">${L(b.desc || '')}</p>

      <div class="action-grid">
        <button class="btn btn-gold" id="callBtn">${icon('phone', 20)} ${t('call')}</button>
        <button class="btn btn-ghost" id="mapBtn">${icon('navigation', 20)} ${t('directions')}</button>
      </div>

      <div class="info-row">${`<span class="i-ico">${icon('phone', 21)}</span>`}<div class="i-txt"><b class="ltr">${b.phone}</b><span>${t('phoneLabel')}</span></div></div>
      <div class="info-row">${`<span class="i-ico">${icon('mapPin', 21)}</span>`}<div class="i-txt"><b class="ltr">${b.address}</b><span>${t('address')} · ${b.dist} ${t('miles')} ${t('distanceAway')}</span></div></div>
      <div class="info-row">${`<span class="i-ico">${icon('clock', 21)}</span>`}<div class="i-txt"><b>${L(b.hours || '')}</b><span>${t('hours')}</span></div></div>
      <div class="info-row">${`<span class="i-ico">${icon('bookmark', 21)}</span>`}<div class="i-txt"><b>${t(catKey(b.cat))}</b><span>${t('category')}</span></div></div>

      <div class="section-head" style="padding:0;margin-top:20px"><div class="section-title">${t('photos')} · ${t('videos')}</div></div>
      ${paid ? `
        <div class="photo-strip">
          ${Array.from({ length: b.photos || 3 }).map(() => `<div class="photo-tile">${icon('image', 24)}</div>`).join('')}
          ${Array.from({ length: b.videos || 0 }).map(() => `<div class="photo-tile">${icon('play', 24)}</div>`).join('')}
        </div>
        <div class="hint">${t('photosLimit')} · ${t('videoLimit')}</div>`
      : lockedBlock(t('lockedPhotos'))}

      <div class="section-head" style="padding:0;margin-top:20px">
        <div class="section-title">${t('reviewsTitle')}<small>${rate.count ? `${rate.avg} · ${rate.count} ${t('reviews')}` : t('noReviewsYet')}</small></div>
      </div>
      ${paid ? `
        <div id="revList">
          ${revs.length ? revs.map(r => reviewHtml(r)).join('')
                        : `<div class="hint">${t('noReviewsYet')} — ${t('beFirstReview')}</div>`}
        </div>
        <button class="btn btn-ghost btn-block mt-12" id="revBtn">${icon('edit', 19)} ${myRev ? t('editReview') : t('writeReview')}</button>`
      : lockedBlock(t('lockedReviews'), t('reviewsPaidOnly'))}

      ${!paid ? `
        <div class="upsell" style="margin:18px 0 0">
          <div class="upsell-txt"><b>${mine ? t('upgradeBanner') : t('isThisYours')}</b><span>${mine ? SUBSCRIPTION_PRICE + '$ ' + t('month') : t('claimIt')}</span></div>
          <button class="btn btn-gold btn-sm" data-route="${mine ? '#/subscribe/' + b.id : '#/claim'}">${mine ? t('upgradeBtn') : t('claimIt')}</button>
        </div>` : ''}

      <div class="action-grid mt-16">
        <button class="btn btn-ghost btn-sm" id="shareBtn">${icon('share', 18)} ${t('share')}</button>
        <button class="btn btn-ghost btn-sm" id="repBtn">${icon('flag', 18)} ${t('report')}</button>
      </div>
    </div>`;

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

  $$('[data-editrev]').forEach(btn => btn.addEventListener('click', () => {
    openReviewSheet(b.id, () => go('#/directory/' + b.id));
  }));
  $$('[data-delrev]').forEach(btn => btn.addEventListener('click', () => confirmSheet({
    title: t('delete'), sub: t('myReviewOn') + ' ' + L(b.name), confirmText: t('delete'), danger: true,
    onConfirm: () => { S.deleteReview(btn.dataset.delrev); toast(t('reviewDeleted'), 'ok'); go('#/directory/' + b.id); }
  })));

  wireRoutes(root);
}

function lockedBlock(title, sub) {
  return `<div class="locked mt-12">
    <div class="lk-ico">${icon('lock', 31)}</div>
    <b>${title}</b><span>${sub || t('lockedSub')}</span>
    <button class="btn btn-outline-gold btn-sm" data-route="#/subscribe">${t('upgradeBtn')}</button>
  </div>`;
}

/** One review card. Mine gets edit / delete controls. */
export function reviewHtml(r) {
  return `<div class="review" data-rev="${r.id || ''}">
    <div class="review-head">
      <span class="avatar">${(r.user || '?')[0]}</span>
      <div><b class="fs-13">${r.user}</b><div class="fs-12 muted">${L(r.when)} · ${stars(r.rating)}</div></div>
    </div>
    <p>${L(r.text)}</p>
    ${r.mine ? `<div class="row-actions">
      <button class="mini-btn gold" data-editrev="${r.id}">${icon('edit', 15)} ${t('edit')}</button>
      <button class="mini-btn" data-delrev="${r.id}">${icon('trash', 15)} ${t('delete')}</button>
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
  root.innerHTML = `
    <div class="pad mt-16">
      <div class="list-note" style="margin:0 0 14px">${icon('info', 18)}<span>${t('needPhoneSub')}</span></div>
      <div class="field"><label class="label">${t('adBizName')}</label><input class="input" id="bName" /></div>
      <div class="field"><label class="label">${t('category')}</label>
        <select class="select" id="bCat">${CATEGORIES.map(c => `<option value="${c.id}">${t(c.key)}</option>`).join('')}</select></div>
      <div class="field"><label class="label">${t('phoneLabel')}</label><input class="input" id="bPhone" inputmode="tel" placeholder="(713) 555-0000" /></div>
      <div class="field"><label class="label">${t('address')}</label><input class="input" id="bAddr" /></div>
      <div class="field"><label class="label">${t('hours')} <span class="muted">(${t('optional')})</span></label><input class="input" id="bHours" /></div>
      <div class="field"><label class="label">${t('descLabel')} <span class="muted">(${t('optional')})</span></label><textarea class="textarea" id="bDesc"></textarea></div>
      <button class="btn btn-gold btn-block" id="bSave">${t('addBusiness')}</button>
      <div class="hint" style="text-align:center;margin-top:10px">${t('lockedSub')}</div>
    </div>`;

  $('#bSave').addEventListener('click', () => {
    const name = $('#bName').value.trim();
    const phone = $('#bPhone').value.trim();
    const addr = $('#bAddr').value.trim();
    if (!name || !phone || !addr) { toast(t('required'), 'err'); return; }
    if (!S.requireTier(2, '#/add-business', go)) return;
    const rec = S.addBusiness({
      name: { ar: name, en: name }, cat: $('#bCat').value, phone, address: addr,
      hours: { ar: $('#bHours').value, en: $('#bHours').value },
      desc: { ar: $('#bDesc').value, en: $('#bDesc').value },
    });
    toast(t('done'), 'ok');
    go('#/directory/' + rec.id);
  });
}

export function ClaimScreen(root) {
  renderHeader({ simple: true, title: t('claimBusiness') });
  const unclaimed = S.allBusinesses().filter(b => !b.claimed);
  root.innerHTML = `
    <div class="search-wrap"><div class="search-bar">${icon('search', 21)}<input id="clSearch" placeholder="${t('searchDirectory')}" /></div></div>
    <div class="list-note">${icon('info', 18)}<span>${t('needPhoneSub')}</span></div>
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
    $$('#clList [data-claim]').forEach(btn => btn.addEventListener('click', () => {
      if (!S.requireTier(2, '#/claim', go)) return;
      S.claimBusiness(btn.dataset.claim);
      toast(t('done'), 'ok');
      go('#/directory/' + btn.dataset.claim);
    }));
  };
  paint();
  $('#clSearch').addEventListener('input', e => paint(e.target.value));
  wireRoutes(root);
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
      <div style="font-size:34px;font-weight:700;color:var(--gold-bright);margin:14px 0 2px">${fmtMoney(SUBSCRIPTION_PRICE)}<span style="font-size:14px;color:var(--muted)">${t('month')}</span></div>
    </div>
    <div class="pad mt-16">
      ${[t('reviewsTitle'), t('photosLimit'), t('videoLimit'), t('verified'), t('featured')].map(f => `
        <div class="info-row"><span class="i-ico">${icon('checkCircle', 21)}</span><div class="i-txt"><b>${f}</b></div></div>`).join('')}
      ${active
        ? `<div class="ok-msg mt-16" style="text-align:center">${t('subActive')}</div>
           <button class="btn btn-danger btn-block mt-12" id="cancelSub">${t('cancelSub')}</button>`
        : `<button class="btn btn-gold btn-block mt-16" id="subBtn">${icon('creditCard', 20)} ${t('subscribeNow')}</button>`}
      <div class="hint" style="text-align:center;margin-top:10px">${t('needPhoneSub')}</div>
    </div>`;

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
