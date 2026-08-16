/* ======================= CLASSIFIEDS ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, openSheet, closeSheet, confirmSheet,
         toast, wireRoutes, emptyState, query, shareItem, fmtMoney } from '../ui.js';
import { CLASSIFIED_CATS, BOOST_PRICES } from '../data.js';
import * as S from '../store.js';

export function ClassifiedsScreen(root) {
  renderHeader({});
  const q = query();
  let cat = q.cat || 'all';
  let term = '';

  root.innerHTML = `
    <div class="search-wrap">
      <div class="search-bar">${icon('search', 21)}<input id="clSearch" placeholder="${t('searchClassifieds')}" /></div>
      <div class="loc-bar">
        <button class="loc-chip" data-loc>${icon('mapPin', 17)}<span>${S.state.location.city}, ${S.state.location.state}</span></button>
        <button class="radius-chip" data-rad>${S.state.radius} ${t('miles')}${icon('chevronD', 15)}</button>
      </div>
    </div>

    <div class="section-head" style="margin-top:14px">
      <div class="section-title">${t('classifiedsTitle')}<small>${t('classifiedsSub')}</small></div>
      <button class="link-gold" data-route="#/post">${icon('plus', 17)} ${t('post')}</button>
    </div>

    <div class="hscroll" id="clChips">
      <button class="chip ${cat === 'all' ? 'active' : ''}" data-cat="all">${t('catAll')}</button>
      ${CLASSIFIED_CATS.map(c => `<button class="chip ${cat === c.id ? 'active' : ''}" data-cat="${c.id}">${icon(c.icon, 15)} ${t(c.key)}</button>`).join('')}
    </div>

    <div class="list-note">${icon('info', 18)}<span>${t('classifiedsNote')}</span></div>

    <div class="mt-12" id="clGrid"></div>
    <div style="height:16px"></div>`;

  const paint = () => {
    const list = S.allClassifieds()
      .filter(c => cat === 'all' || c.cat === cat)
      .filter(c => !term || L(c.title).toLowerCase().includes(term.toLowerCase()))
      .sort((a, b) => (b.boosted === true) - (a.boosted === true));

    $('#clGrid').innerHTML = list.length
      ? `<div class="grid2">${list.map(cardHtml).join('')}</div>`
      : emptyState('bag', t('emptyClTitle'), t('emptyClSub'), t('post'), '#/post');
    wireRoutes($('#clGrid'));
  };
  paint();

  $$('#clChips .chip').forEach(c => c.addEventListener('click', () => {
    cat = c.dataset.cat;
    $$('#clChips .chip').forEach(x => x.classList.toggle('active', x === c));
    paint();
  }));
  $('#clSearch').addEventListener('input', e => { term = e.target.value; paint(); });
  $('[data-loc]').addEventListener('click', () => import('./home.js').then(m => m.openLocationSheet()));
  $('[data-rad]').addEventListener('click', () => import('./home.js').then(m => m.openRadiusSheet()));
  wireRoutes(root);
}

function cardHtml(c) {
  return `<div class="cl-card ${c.boosted ? 'boosted' : ''}" data-route="#/classifieds/${c.id}">
    <div class="cl-img">${icon(c.icon || 'image', 35)}
      ${c.boosted ? `<span class="badge badge-boost" style="position:absolute;inset-block-start:7px;inset-inline-start:7px">${icon('bolt', 12)}${t('boosted')}</span>` : ''}
    </div>
    <div class="cl-body">
      <div class="cl-price">${c.price}</div>
      <div class="cl-title">${L(c.title)}</div>
      <div class="cl-meta"><span>${icon('mapPin', 12)} <span class="ltr">${c.city}</span></span><span>${L(c.when)}</span></div>
    </div>
  </div>`;
}

/* --------------------------- DETAIL --------------------------- */
export function ClassifiedScreen(root, params) {
  const c = S.classifiedById(params[0]);
  if (!c) { go('#/classifieds'); return; }
  renderHeader({ hidden: true });
  const mine = S.state.myListings.includes(c.id);

  root.innerHTML = `
    <div class="detail-hero" style="height:200px">
      <button class="back-btn" id="bk">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 22)}</button>
      <div style="color:#6B77A0">${icon(c.icon || 'image', 66)}</div>
      ${c.boosted ? `<span class="badge badge-boost" style="position:absolute;inset-block-end:12px;inset-inline-start:14px">${icon('bolt', 13)}${t('boosted')}</span>` : ''}
    </div>
    <div class="detail-body">
      <div class="row-between">
        <div>
          <div class="cl-price" style="font-size:24px">${c.price}</div>
          <div class="detail-title" style="font-size:17px">${L(c.title)}</div>
        </div>
        <button class="icon-btn" id="saveBtn">${icon('heart', 22)}</button>
      </div>
      <div class="row-sub mt-8">${icon('mapPin', 14)} <span class="ltr">${c.city}</span> · ${icon('clock', 14)} ${L(c.when)}</div>
      <p class="fs-13 muted mt-12">${L(c.desc || '')}</p>

      <div class="info-row"><span class="i-ico">${icon('clock', 21)}</span>
        <div class="i-txt"><b>${t('expiresIn')} ${c.daysLeft} ${t('days')}</b><span>${t('classifiedsNote')}</span></div></div>

      ${mine ? `
        <div class="action-grid mt-16">
          <button class="btn btn-gold" data-route="#/boost/${c.id}">${icon('bolt', 19)} ${t('boost')}</button>
          <button class="btn btn-ghost" id="renewBtn">${icon('refresh', 19)} ${t('renew')}</button>
        </div>
        <button class="btn btn-danger btn-block mt-8" id="delBtn">${icon('trash', 19)} ${t('delete')}</button>
      ` : `
        <button class="btn btn-gold btn-block mt-16" id="contactBtn">${icon('phone', 20)} ${t('contactSeller')}</button>
        <div class="action-grid mt-12">
          <button class="btn btn-ghost btn-sm" id="shareBtn">${icon('share', 18)} ${t('share')}</button>
          <button class="btn btn-ghost btn-sm" id="repBtn">${icon('flag', 18)} ${t('report')}</button>
        </div>`}
    </div>`;

  $('#bk').addEventListener('click', () => back());
  const sb = $('#saveBtn');
  const paintSave = () => { sb.style.color = S.isSaved(c.id) ? 'var(--gold-bright)' : ''; };
  paintSave();
  sb.addEventListener('click', () => {
    if (!S.requireTier(1, location.hash, go)) return;
    S.toggleSaved(c.id); paintSave(); toast(S.isSaved(c.id) ? t('saved') : t('done'), 'ok');
  });

  const cb = $('#contactBtn');
  if (cb) cb.addEventListener('click', () => {
    if (!S.requireTier(2, location.hash, go)) return;
    openSheet(`<div class="sheet-title">${t('contactSeller')}</div>
      <div class="sheet-sub">${L(c.title)}</div>
      <button class="btn btn-gold btn-block" id="callS">${icon('phone', 19)} (713) 555-0199</button>
      <button class="btn btn-ghost btn-block mt-8" id="msgS">${icon('send', 19)} ${t('comingSoon')}</button>`,
      (p) => {
        p.querySelector('#callS').addEventListener('click', () => { location.href = 'tel:7135550199'; });
        p.querySelector('#msgS').addEventListener('click', () => { closeSheet(); toast(t('comingSoon')); });
      });
  });

  const rp = $('#repBtn');
  if (rp) rp.addEventListener('click', () => { S.reportItem(c.id); toast(t('reported'), 'ok'); });
  const sh = $('#shareBtn');
  if (sh) sh.addEventListener('click', () => shareItem(L(c.title), location.href));
  const rn = $('#renewBtn');
  if (rn) rn.addEventListener('click', () => { S.renewClassified(c.id); toast(t('renewed'), 'ok'); go('#/classifieds/' + c.id); });
  const dl = $('#delBtn');
  if (dl) dl.addEventListener('click', () => confirmSheet({
    title: t('delete'), sub: L(c.title), confirmText: t('delete'), danger: true,
    onConfirm: () => { S.deleteClassified(c.id); toast(t('done'), 'ok'); go('#/classifieds'); }
  }));
  wireRoutes(root);
}

/* ----------------------------- POST ----------------------------- */
const BIZ_KEYWORDS = ['توصيل يومي', 'أسعار جملة', 'جملة', 'wholesale', 'delivery available', 'daily delivery', 'bulk'];

export function PostScreen(root) {
  renderHeader({ simple: true, title: t('postTitle') });

  if (!S.isLoggedIn()) { S.setPendingIntent('#/post'); go('#/auth/signup'); return; }

  const active = S.myActiveListings().length;
  root.innerHTML = `
    <div class="pad mt-16">
      <div class="list-note" style="margin:0 0 14px">${icon('info', 18)}
        <span>${t('classifiedsNote')} — <b class="gold">${active}/${S.MAX_ACTIVE_LISTINGS}</b></span></div>

      <div class="field"><label class="label">${t('category')}</label>
        <select class="select" id="pCat">${CLASSIFIED_CATS.map(c => `<option value="${c.id}">${t(c.key)}</option>`).join('')}</select></div>
      <div class="field"><label class="label">${t('titleLabel')}</label><input class="input" id="pTitle" /></div>
      <div class="field"><label class="label">${t('priceLabel')}</label><input class="input" id="pPrice" inputmode="decimal" placeholder="$" /></div>
      <div class="field"><label class="label">${t('cityLabel')}</label><input class="input" id="pCity" value="${S.state.location.city}, ${S.state.location.state}" /></div>
      <div class="field"><label class="label">${t('descLabel')}</label><textarea class="textarea" id="pDesc"></textarea></div>
      <div class="field"><label class="label">${t('photosLabel')}</label>
        <div class="photo-strip">
          <button class="photo-tile" id="addPhoto">${icon('camera', 24)}</button>
          <div class="photo-tile">${icon('image', 24)}</div>
          <div class="photo-tile">${icon('image', 24)}</div>
        </div></div>

      <button class="btn btn-gold btn-block mt-16" id="pubBtn">${icon('send', 19)} ${t('publish')}</button>
      <div class="hint" style="text-align:center;margin-top:10px">${t('needPhoneSub')}</div>
    </div>`;

  $('#addPhoto').addEventListener('click', () => toast(t('comingSoon')));

  $('#pubBtn').addEventListener('click', () => {
    const title = $('#pTitle').value.trim();
    const price = $('#pPrice').value.trim();
    if (!title || !price) { toast(t('required'), 'err'); return; }
    if (S.myActiveListings().length >= S.MAX_ACTIVE_LISTINGS) { toast(t('limitReached'), 'err'); return; }
    if (!S.requireTier(2, '#/post', go)) return;

    const desc = $('#pDesc').value;
    const flagged = BIZ_KEYWORDS.some(k => (title + ' ' + desc).toLowerCase().includes(k.toLowerCase()));

    const rec = S.addClassified({
      cat: $('#pCat').value,
      title: { ar: title, en: title },
      price: price.startsWith('$') ? price : '$' + price,
      city: $('#pCity').value,
      desc: { ar: desc, en: desc },
      icon: (CLASSIFIED_CATS.find(c => c.id === $('#pCat').value) || {}).icon || 'image',
      flagged,
    });
    if (flagged) toast(t('businessDetected'), 'err');
    else toast(t('done'), 'ok');
    go('#/classifieds/' + rec.id);
  });
}

/* ----------------------------- BOOST ----------------------------- */
export function BoostScreen(root, params) {
  const c = S.classifiedById(params[0]);
  if (!c) { go('#/classifieds'); return; }
  renderHeader({ simple: true, title: t('boost') });
  let sel = BOOST_PRICES[1];

  root.innerHTML = `
    <div class="pad mt-16 center-col">
      <div class="empty-ico" style="width:60px;height:60px">${icon('bolt', 31)}</div>
      <b style="font-size:17px">${t('boost')}</b>
      <span class="muted fs-13">${t('boostDesc')}</span>
    </div>
    <div class="pad mt-16" id="opts">
      ${BOOST_PRICES.map(p => `
        <button class="price-card ${p.id === sel.id ? 'selected' : ''}" data-id="${p.id}">
          <span class="price-radio"></span>
          <span><span class="price-name">${p.days} ${t('days')}</span>
          <span class="price-desc">${t('boostDesc')}</span></span>
          <span class="price-amt">${fmtMoney(p.price)}</span>
        </button>`).join('')}
      <button class="btn btn-gold btn-block mt-12" id="payBtn">${icon('creditCard', 20)} ${t('payNow')}</button>
    </div>`;

  $$('#opts .price-card').forEach(b => b.addEventListener('click', () => {
    sel = BOOST_PRICES.find(p => p.id === b.dataset.id);
    $$('#opts .price-card').forEach(x => x.classList.toggle('selected', x === b));
  }));

  $('#payBtn').addEventListener('click', async (e) => {
    if (!S.requireTier(2, location.hash, go)) return;
    e.target.innerHTML = `<span class="spinner"></span> ${t('paying')}`;
    await S.chargeCard(sel.price, 'Classified boost');
    S.boostClassified(c.id);
    toast(t('done'), 'ok');
    go('#/classifieds/' + c.id);
  });
}
