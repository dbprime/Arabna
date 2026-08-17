/* ======================= MARKETPLACE ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, confirmSheet, toast, wireRoutes,
         emptyState, query, shareItem, fmtMoney, priceLabel, statusBadge,
         openSheet, closeSheet, openFilterSheet, activeFilterCount, sectionNote,
         showsPrices } from '../ui.js';
import { MARKET_CATS, BOOST_PRICES, FREE_PRICE, SUBSCRIPTION_PRICE } from '../data.js';
import { getLang } from '../i18n.js';
import * as S from '../store.js';

/* ----------------------------- LIST ----------------------------- */
export function MarketplaceScreen(root) {
  renderHeader({});
  const q = query();
  let cat = q.cat || 'all';
  let term = '';
  const highlight = q.new || '';          // listing just published → pin it on top
  let filters = { cat, radius: S.state.radius, sort: 'newest', priceMin: '', priceMax: '' };

  /** "$14,500" / "45/hr" → 14500 so a price range can compare them */
  const priceNum = (p) => {
    if (!p || p === FREE_PRICE) return 0;
    const n = parseFloat(String(p).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  root.innerHTML = `
    <div class="search-row">
      <div class="search-bar">${icon('search', 21)}<input id="clSearch" placeholder="${t('searchClassifieds')}" /></div>
      <button class="loc-chip" data-loc>${icon('mapPin', 17)}<span>${S.state.location.city}</span></button>
      <button class="filter-btn" id="mkFilter" aria-label="${t('filters')}">${icon('filter', 20)}<span id="fCount"></span></button>
    </div>

    <div class="section-head" style="margin-top:14px">
      <div class="section-title">${t('classifiedsTitle')}
        <button class="info-dot" id="rulesBtn" aria-label="${t('marketRules')}">${icon('info', 15)}</button>
      </div>
    </div>

    <div class="hscroll" id="clChips">
      <button class="chip ${cat === 'all' ? 'active' : ''}" data-cat="all">${t('catAll')}</button>
      ${MARKET_CATS.map(c => `<button class="chip ${cat === c.id ? 'active' : ''}" data-cat="${c.id}">${icon(c.icon, 15)} ${t(c.key)}</button>`).join('')}
    </div>

    <div id="secNote"></div>
    <div id="catNote"></div>
    <div class="mt-12" id="clGrid"></div>
    <div style="height:16px"></div>`;

  const paintNote = () => {
    const el = $('#catNote');
    if (cat === 'free') {
      el.innerHTML = `<div class="list-note">${icon('gift', 18)}<span>${t('freeRule')}</span></div>`;
    } else if (cat === 'handyman') {
      el.innerHTML = `<div class="list-note">${icon('hammer', 18)}<span>${t('handymanRule')}</span></div>
        <div class="upsell" data-route="#/subscribe">
          <div style="width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:rgba(198,161,91,.2);color:var(--gold-bright)">${icon('crown', 22)}</div>
          <div class="upsell-txt"><b>${t('handymanUpsell')}</b><span>${showsPrices()
            ? fmtMoney(SUBSCRIPTION_PRICE) + ' ' + t('month') : t('pricesAfterSignup')}</span></div>
          <span class="btn btn-gold btn-sm">${t('upgradeBtn')}</span>
        </div>`;
      wireRoutes(el);
    } else {
      el.innerHTML = '';          // account rules live behind the (i) button now
    }
  };

  const paint = () => {
    // Deliberately NOT filtered by distance — a listing must never disappear
    // from its owner's view because of a radius setting.
    const list = S.allClassifieds()
      .filter(c => cat === 'all' || c.cat === cat)
      .filter(c => !term || L(c.title).toLowerCase().includes(term.toLowerCase())
                         || L(c.desc || '').toLowerCase().includes(term.toLowerCase()))
      .filter(c => !filters.priceMin || priceNum(c.price) >= Number(filters.priceMin))
      .filter(c => !filters.priceMax || priceNum(c.price) <= Number(filters.priceMax))
      .sort((a, b) => (b.id === highlight) - (a.id === highlight)
                   || (b.boosted === true) - (a.boosted === true)
                   || (filters.sort === 'rated' ? (b.boosted === true) - (a.boosted === true) : 0)
                   || (b.created || 0) - (a.created || 0));

    const section = MARKET_CATS.find(c => c.id === cat);
    $('#secNote').innerHTML = sectionNote(section ? t(section.key) : '', list.length);
    $('#clGrid').innerHTML = list.length
      ? `<div class="grid2">${list.map(c => cardHtml(c, c.id === highlight)).join('')}</div>`
      // every section has its own designed empty state, not one generic message
      : emptyState(
          section ? section.icon : 'bag',
          section ? t(section.emptyKey) : t('emptyClTitle'),
          section ? t(section.emptyKey + 'Sub') : t('emptyClSub'),
          t('post'),
          section ? `#/post?cat=${section.id}` : '#/post');
    wireRoutes($('#clGrid'));

    const fc = $('#fCount');
    const n = activeFilterCount(filters);
    fc.className = n ? 'f-count' : '';
    fc.textContent = n || '';
    $('#mkFilter').classList.toggle('on', n > 0);
  };

  paintNote();
  paint();

  // arriving straight at a section (drawer / categories screen) — bring its chip into view
  const activeChip = $('#clChips .chip.active');
  if (activeChip && cat !== 'all') activeChip.scrollIntoView({ inline: 'center', block: 'nearest' });

  $$('#clChips .chip').forEach(c => c.addEventListener('click', () => {
    cat = c.dataset.cat;
    $$('#clChips .chip').forEach(x => x.classList.toggle('active', x === c));
    paintNote();
    paint();
  }));
  $('#clSearch').addEventListener('input', e => { term = e.target.value; paint(); });
  $('[data-loc]').addEventListener('click', () => import('./home.js').then(m => m.openLocationSheet()));
  $('#rulesBtn').addEventListener('click', () => openSheet(`
    <div class="sheet-title">${t('marketRules')}</div>
    <div class="sheet-sub">${t('classifiedsSub')}</div>
    <div class="list-note" style="margin-inline:0">${icon('info', 18)}<span>${t('classifiedsNote')}</span></div>
    <div class="list-note" style="margin-inline:0">${icon('hammer', 18)}<span>${t('handymanRule')}</span></div>
    <div class="list-note" style="margin-inline:0">${icon('gift', 18)}<span>${t('freeRule')}</span></div>
    <button class="btn btn-ghost btn-block mt-12" data-close>${t('close')}</button>
  `, (panel) => panel.querySelector('[data-close]').addEventListener('click', closeSheet)));
  $('#mkFilter').addEventListener('click', () => openFilterSheet({
    cats: MARKET_CATS.map(c => ({ id: c.id, label: t(c.key) })),
    value: filters,
    withPrice: true,
    onApply: (v) => {
      filters = v; cat = v.cat;
      $$('#clChips .chip').forEach(x => x.classList.toggle('active', x.dataset.cat === cat));
      paintNote(); paint();
    },
  }));
  wireRoutes(root);
}

function thumb(c) {
  return c.photos && c.photos.length
    ? `<img src="${c.photos[c.mainPhoto || 0] || c.photos[0]}" alt="${L(c.title)}" loading="lazy" />`
    : icon(c.icon || 'image', 35);
}

function cardHtml(c, isNew) {
  return `<div class="cl-card ${c.boosted ? 'boosted' : ''}" data-route="#/marketplace/${c.id}"
               style="${isNew ? 'outline:2px solid var(--gold);outline-offset:2px' : ''}">
    <div class="cl-img">${thumb(c)}
      ${c.boosted ? `<span class="badge badge-boost" style="position:absolute;inset-block-start:7px;inset-inline-start:7px">${icon('bolt', 12)}${t('boosted')}</span>` : ''}
    </div>
    <div class="cl-body">
      <div class="cl-price">${priceLabel(c.price)}</div>
      <div class="cl-title">${L(c.title)}</div>
      <div class="cl-meta"><span>${icon('mapPin', 12)} <span class="ltr">${c.city}</span></span><span>${L(c.when)}</span></div>
      ${statusBadge(c)}
    </div>
  </div>`;
}

/* --------------------------- DETAIL --------------------------- */
export function ListingDetailScreen(root, params) {
  const c = S.classifiedById(params[0]);
  if (!c) { go('#/marketplace'); return; }
  renderHeader({ hidden: true });
  const mine = S.state.myListings.includes(c.id);
  const photos = c.photos || [];

  root.innerHTML = `
    <div class="detail-hero" style="height:${photos.length ? '0' : '200px'};${photos.length ? 'display:none' : ''}">
      <button class="back-btn" id="bk">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 22)}</button>
      <div style="color:#6B77A0">${icon(c.icon || 'image', 66)}</div>
      ${c.boosted ? `<span class="badge badge-boost" style="position:absolute;inset-block-end:12px;inset-inline-start:14px">${icon('bolt', 13)}${t('boosted')}</span>` : ''}
    </div>

    ${photos.length ? `
      <div style="position:relative;padding-top:14px">
        <button class="back-btn" id="bk2" style="position:absolute;inset-block-start:22px;inset-inline-start:20px;z-index:3">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 22)}</button>
        <div class="cl-gallery">${photos.map(p => `<img src="${p}" alt="${L(c.title)}" />`).join('')}</div>
      </div>` : ''}

    <div class="detail-body">
      <div class="row-between">
        <div>
          <div class="cl-price" style="font-size:24px">${priceLabel(c.price)}</div>
          <div class="detail-title" style="font-size:17px">${L(c.title)}</div>
          <div class="mt-8">${statusBadge(c, mine)}</div>
        </div>
        <button class="icon-btn" id="saveBtn">${icon('heart', 22)}</button>
      </div>
      <div class="row-sub mt-8">${icon('mapPin', 14)} <span class="ltr">${c.city}</span> · ${icon('clock', 14)} ${L(c.when)}</div>
      <p class="fs-13 muted mt-12" style="white-space:pre-wrap">${L(c.desc || '')}</p>

      ${c.status === 'pending' ? `<div class="list-note" style="margin-inline:0">${icon('clock', 18)}<span>${t('pendingNote')}</span></div>` : ''}
      ${c.cat === 'free' ? `<div class="list-note" style="margin-inline:0">${icon('gift', 18)}<span>${t('freeRule')}</span></div>` : ''}

      <div class="info-row"><span class="i-ico">${icon('clock', 21)}</span>
        <div class="i-txt"><b>${t('expiresIn')} ${c.daysLeft} ${t('days')}</b><span>${c.cat === 'handyman' ? t('handymanRule') : t('classifiedsNote')}</span></div></div>

      ${mine ? `
        <div class="action-grid mt-16">
          <button class="btn btn-gold" data-route="#/boost/${c.id}">${icon('bolt', 19)} ${t('boost')}</button>
          <button class="btn btn-ghost" data-route="#/post?edit=${c.id}">${icon('edit', 19)} ${t('editListing')}</button>
        </div>
        <div class="action-grid mt-8">
          <button class="btn btn-ghost" id="renewBtn">${icon('refresh', 19)} ${t('renew')}</button>
          <button class="btn btn-ghost" data-route="#/messages/${c.id}">${icon('message', 19)} ${t('messagesTitle')}</button>
        </div>
        <button class="btn btn-danger btn-block mt-8" id="delBtn">${icon('trash', 19)} ${t('delete')}</button>
      ` : `
        <button class="btn btn-gold btn-block mt-16" data-route="#/messages/${c.id}">${icon('message', 20)} ${t('contactSeller')}</button>
        <div class="hint" style="text-align:center">${t('inAppOnly')}</div>
        <div class="action-grid mt-12">
          <button class="btn btn-ghost btn-sm" id="shareBtn">${icon('share', 18)} ${t('share')}</button>
          <button class="btn btn-ghost btn-sm" id="repBtn">${icon('flag', 18)} ${t('report')}</button>
        </div>`}
    </div>`;

  const bk = $('#bk') || $('#bk2');
  if (bk) bk.addEventListener('click', () => back());
  const bk2 = $('#bk2'); if (bk2 && bk2 !== bk) bk2.addEventListener('click', () => back());

  const sb = $('#saveBtn');
  const paintSave = () => { sb.style.color = S.isSaved(c.id) ? 'var(--gold-bright)' : ''; };
  paintSave();
  sb.addEventListener('click', () => {
    if (!S.requireTier(1, location.hash, go)) return;
    S.toggleSaved(c.id); paintSave(); toast(S.isSaved(c.id) ? t('saved') : t('done'), 'ok');
  });

  const rp = $('#repBtn');
  if (rp) rp.addEventListener('click', () => { S.reportItem(c.id, c.title); toast(t('reported'), 'ok'); });
  const sh = $('#shareBtn');
  if (sh) sh.addEventListener('click', () => shareItem(L(c.title), location.href));
  const rn = $('#renewBtn');
  if (rn) rn.addEventListener('click', () => {
    S.renewClassified(c.id);
    toast(t('renewed'), 'ok');
    go('#/marketplace/' + c.id);
  });
  const dl = $('#delBtn');
  if (dl) dl.addEventListener('click', () => confirmSheet({
    title: t('delete'), sub: L(c.title), confirmText: t('delete'), danger: true,
    onConfirm: () => { S.deleteClassified(c.id); toast(t('done'), 'ok'); go('#/marketplace'); }
  }));
  wireRoutes(root);
}

/* ======================= PHOTO PICKER =======================
   Real device picker → canvas downscale to 1200px → data URL.
   Kept here (not in store.js) because it is pure UI plumbing;
   V.02 uploads the same blob to Cloudflare R2 instead. */

const MAX_SIDE = 1200;
const MAX_BYTES = 10 * 1024 * 1024;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) { reject('type'); return; }
    if (file.size > MAX_BYTES) { reject('size'); return; }
    const reader = new FileReader();
    reader.onerror = () => reject('read');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject('read');
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(cv.toDataURL('image/jpeg', 0.72)); }
        catch (e) { reject('read'); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Mount the photo picker into `host`.
 * @returns {{ photos: string[], main: number }} live state object
 */
export function mountPhotoPicker(host, initial = [], initialMain = 0, limit = S.MAX_PHOTOS) {
  const box = { photos: initial.slice(), main: initialMain };

  host.innerHTML = `
    <div class="photo-strip" id="phStrip"></div>
    <input type="file" id="phInput" accept="image/*" ${limit > 1 ? 'multiple' : ''} hidden />
    <div class="hint" id="phHint">${t('maxPhotos')}</div>`;

  const strip = host.querySelector('#phStrip');
  const input = host.querySelector('#phInput');
  const hint = host.querySelector('#phHint');

  const paint = () => {
    strip.innerHTML = `
      ${box.photos.map((src, i) => `
        <div class="ph-thumb ${i === box.main ? 'is-main' : ''}">
          <img src="${src}" alt="" />
          <button class="ph-x" data-del="${i}" aria-label="${t('delete')}">${icon('x', 14)}</button>
          <button class="ph-main" data-main="${i}">${i === box.main ? t('mainPhoto') : t('setMain')}</button>
        </div>`).join('')}
      ${box.photos.length < limit
        ? `<button class="photo-tile" id="addPhoto">${icon('camera', 24)}<span class="fs-12 muted" style="margin-top:4px">${t('addPhotos')}</span></button>`
        : ''}`;
    hint.textContent = `${box.photos.length}/${limit} ${t('photosCount')}`;

    const add = strip.querySelector('#addPhoto');
    if (add) add.addEventListener('click', () => input.click());
    strip.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.del;
      box.photos.splice(i, 1);
      if (box.main >= box.photos.length) box.main = Math.max(0, box.photos.length - 1);
      else if (i < box.main) box.main--;
      paint();
    }));
    strip.querySelectorAll('[data-main]').forEach(b => b.addEventListener('click', () => {
      box.main = +b.dataset.main; paint();
    }));
  };
  paint();

  input.addEventListener('change', async () => {
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    const room = limit - box.photos.length;
    if (room <= 0) { toast(t('maxPhotos'), 'err'); return; }

    hint.innerHTML = `<span class="spinner" style="display:inline-block;vertical-align:-3px"></span> ${t('compressing')}`;
    for (const f of files.slice(0, room)) {
      try {
        box.photos.push(await compressImage(f));
      } catch (err) {
        toast(err === 'type' ? t('notAnImage') : err === 'size' ? t('fileTooLarge') : t('photoFailed'), 'err');
      }
    }
    if (files.length > room) toast(t('maxPhotos'), 'err');
    paint();
  });

  return box;
}

/* --------------------------- POST / EDIT --------------------------- */
const BIZ_KEYWORDS = ['توصيل يومي', 'أسعار جملة', 'جملة', 'wholesale', 'delivery available', 'daily delivery', 'bulk'];

export function PostScreen(root) {
  const q = query();
  const editId = q.edit || '';
  const editing = editId ? S.classifiedById(editId) : null;
  renderHeader({ simple: true, title: editing ? t('editListing') : t('postTitle') });

  // A draft parked before a verification detour comes back with everything
  // the user had typed and every photo they had picked.
  const draft = !editing ? S.takeDraft() : null;

  if (!S.isLoggedIn()) {
    if (draft) S.saveDraft(draft);          // keep it for the trip through verification
    // requireTier routes to signup / email / phone depending on what is
    // actually missing — an existing account is never sent back to signup.
    S.requireTier(1, location.hash, go);
    return;
  }

  const startCat = editing ? editing.cat
    : (draft && draft.cat) || q.cat || MARKET_CATS[0].id;

  root.innerHTML = `
    <div class="pad mt-16">
      <div class="list-note" style="margin:0 0 14px" id="limitNote"></div>

      <div class="field"><label class="label">${t('category')}</label>
        <select class="select" id="pCat">${MARKET_CATS.map(c =>
          `<option value="${c.id}" ${c.id === startCat ? 'selected' : ''}>${t(c.key)}</option>`).join('')}</select></div>
      <div class="field"><label class="label">${t('titleLabel')}</label>
        <input class="input" id="pTitle" value="${escapeAttr(editing ? L(editing.title) : (draft && draft.title) || '')}" /></div>
      <div class="field" id="priceField"><label class="label">${t('priceLabel')}</label>
        <input class="input" id="pPrice" inputmode="decimal" placeholder="$"
               value="${escapeAttr(editing ? (editing.price !== FREE_PRICE ? editing.price : '') : (draft && draft.price) || '')}" /></div>
      <div class="field"><label class="label">${t('cityLabel')}</label>
        <input class="input" id="pCity" value="${escapeAttr(editing ? editing.city : (draft && draft.city) || (S.state.location.city + ', ' + S.state.location.state))}" /></div>
      <div class="field"><label class="label">${t('descLabel')}</label>
        <textarea class="textarea" id="pDesc">${escapeHtml(editing ? L(editing.desc || '') : (draft && draft.desc) || '')}</textarea></div>

      <div class="field"><label class="label">${t('photosLabel')}</label><div id="phHost"></div></div>

      <div class="list-note" style="margin:0 0 14px">${icon('shield', 18)}<span>${t('phoneStripped')}</span></div>

      <button class="btn btn-gold btn-block mt-16" id="pubBtn">${icon('send', 19)} ${editing ? t('saveChanges') : t('publish')}</button>
      <div class="hint" style="text-align:center;margin-top:10px">${t('needPhoneSub')}</div>
    </div>`;

  const pics = mountPhotoPicker($('#phHost'),
    editing ? (editing.photos || []) : (draft && draft.photos) || [],
    editing ? (editing.mainPhoto || 0) : (draft && draft.mainPhoto) || 0);
  const catSel = $('#pCat');
  const priceIn = $('#pPrice');

  const paintCatRules = () => {
    const cat = catSel.value;
    const rule = S.catRule(cat);
    const used = S.myActiveInCat(cat) - (editing && editing.cat === cat ? 1 : 0);

    if (rule.freeOnly) {
      priceIn.value = t('priceFree');
      priceIn.disabled = true;
      priceIn.classList.remove('input-err');
    } else if (priceIn.disabled) {
      priceIn.disabled = false;
      priceIn.value = editing && editing.price !== FREE_PRICE ? editing.price : '';
    }

    $('#limitNote').innerHTML = `${icon('info', 18)}<span>${
      rule.freeOnly ? t('freeRule')
      : cat === 'handyman' ? t('handymanRule')
      : t('classifiedsNote')} — <b class="gold">${used}/${rule.maxActive}</b></span>`;
  };
  paintCatRules();
  catSel.addEventListener('change', paintCatRules);

  $('#pubBtn').addEventListener('click', () => {
    const cat = catSel.value;
    const rule = S.catRule(cat);
    const lang = getLang();

    const rawTitle = $('#pTitle').value.trim();
    const rawDesc = $('#pDesc').value.trim();
    const rawPrice = priceIn.value.trim();

    if (!rawTitle) { toast(t('required'), 'err'); return; }
    if (!rule.freeOnly && !rawPrice) { toast(t('required'), 'err'); return; }

    // Free section, new listing: refuse outright before anything is stored.
    // An *edit* that adds a price is not refused — it is published back into
    // the review queue by updateClassified() so a human sees what changed.
    if (!editing && rule.freeOnly && S.violatesFreeRule(rawTitle + ' ' + rawDesc)) {
      toast(t('freeViolation'), 'err');
      $('#pTitle').classList.add('input-err');
      return;
    }
    $('#pTitle').classList.remove('input-err');

    // Section limit (Handyman = 1, everything else = 5)
    const used = S.myActiveInCat(cat) - (editing && editing.cat === cat ? 1 : 0);
    if (used >= rule.maxActive) {
      toast(cat === 'handyman' || rule.maxActive !== S.MAX_ACTIVE_LISTINGS ? t('catLimitReached') : t('limitReached'), 'err');
      return;
    }
    if (!editing && S.myActiveListings().length >= S.MAX_ACTIVE_LISTINGS && rule.maxActive === S.MAX_ACTIVE_LISTINGS) {
      toast(t('limitReached'), 'err'); return;
    }
    // Park the entire draft — text *and* compressed photos — before any
    // redirect, then resume automatically once verification is done.
    if (S.tier() < 2) {
      S.saveDraft({ cat, title: rawTitle, price: rawPrice, city: $('#pCity').value.trim(),
                    desc: rawDesc, photos: pics.photos, mainPhoto: pics.main });
      if (!S.lastSaveOk) toast(t('storageFull'), 'err');
      S.requireTier(2, '#/post', go);
      return;
    }

    // Phone numbers never make it into stored content.
    const title = S.stripPhones(rawTitle, lang);
    const desc = S.stripPhones(rawDesc, lang);
    if (title.removed || desc.removed) toast(t('phoneStripped'), 'err');

    const price = rule.freeOnly ? FREE_PRICE
      : (rawPrice.startsWith('$') ? rawPrice : '$' + rawPrice);
    const flagged = BIZ_KEYWORDS.some(k => (rawTitle + ' ' + rawDesc).toLowerCase().includes(k.toLowerCase()));

    const payload = {
      cat,
      title: { ar: title.text, en: title.text },
      price,
      city: $('#pCity').value.trim(),
      desc: { ar: desc.text, en: desc.text },
      photos: pics.photos,
      mainPhoto: pics.main,
      icon: (MARKET_CATS.find(c => c.id === cat) || {}).icon || 'image',
      flagged,
    };

    if (editing) {
      const res = S.updateClassified(editing.id, payload);
      if (!S.lastSaveOk) { toast(t('storageFull'), 'err'); return; }
      toast(res.flagged ? t('freeFlagged') : t('listingUpdated'), res.flagged ? 'err' : 'ok');
      go('#/marketplace/' + editing.id);
      return;
    }

    const rec = S.addClassified(payload);
    if (!rec) { toast(t('storageFull'), 'err'); return; }
    if (flagged) {
      S.addFlag({ kind: 'listing', refId: rec.id, risk: 'high', item: rec.title,
        reason: { ar: 'لغة تجارية في إعلان شخصي', en: 'Business language in a personal listing' } });
      toast(t('businessDetected'), 'err');
    } else {
      toast(t('done'), 'ok');
    }
    // straight to the section it belongs to, with the new listing pinned on top
    go(`#/marketplace?cat=${rec.cat}&new=${rec.id}`);
  });

  // Came back from verification with a rescued draft and now have the tier —
  // finish the publish the user already asked for instead of making them
  // press the button a second time.
  if (draft && S.tier() >= 2 && draft.title) {
    toast(t('resumedAction'), 'ok');
    setTimeout(() => { const b = $('#pubBtn'); if (b) b.click(); }, 80);
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/* --------------------------- MESSAGES --------------------------- */
export function MessagesScreen(root, params) {
  const listingId = params[0];
  // Messages belong to an account: a session that ended mid-thread resumes here.
  if (!S.requireTier(1, location.hash, go)) return;

  if (!listingId) { threadListView(root); return; }

  const c = S.classifiedById(listingId);
  if (!c) { go('#/marketplace'); return; }
  renderHeader({ simple: true, title: t('messagesTitle') });

  if (!S.requireTier(2, location.hash, go)) return;

  root.innerHTML = `
    <div class="list-row" data-route="#/marketplace/${c.id}" style="margin:14px">
      <span class="row-ico">${icon(c.icon || 'image', 22)}</span>
      <div class="row-main"><div class="row-title">${L(c.title)}</div>
        <div class="row-sub gold"><span class="ltr">${priceLabel(c.price)}</span></div></div>
    </div>
    <div class="list-note">${icon('shield', 18)}<span>${t('scanNotice')}</span></div>
    <div class="msg-list" id="msgList"></div>
    <div class="msg-bar">
      <textarea class="textarea" id="msgIn" rows="1" placeholder="${t('messagePlaceholder')}"></textarea>
      <button class="btn btn-gold" id="msgSend" style="height:48px;padding:0 16px">${icon('send', 19)}</button>
    </div>`;

  const paint = () => {
    const list = S.messagesFor(listingId);
    $('#msgList').innerHTML = list.length
      ? list.map(m => `<div class="msg ${m.from === 'me' ? 'me' : 'them'}">${escapeHtml(m.text)}
          <div class="msg-when">${L(m.when)}</div></div>`).join('')
      : `<div class="hint" style="text-align:center">${t('emptyMsgSub')}</div>`;
    const box = $('#msgList');
    box.scrollTop = box.scrollHeight;
  };
  paint();

  $('#msgSend').addEventListener('click', () => {
    const input = $('#msgIn');
    const text = input.value.trim();
    if (!text) { toast(t('required'), 'err'); return; }
    const res = S.sendMessage(listingId, text, getLang());
    input.value = '';
    paint();
    // Tell the sender exactly what was removed and why.
    if (res.removed) toast(t('contactRemoved'), 'err');
    else if (res.flagged) toast(t('scanFlagged'), 'err');
    else toast(t('messageSent'), 'ok');
  });
  wireRoutes(root);
}

function threadListView(root) {
  renderHeader({ simple: true, title: t('myMessages') });
  const threads = S.messageThreads();
  root.innerHTML = threads.length
    ? `<div class="pad mt-16">${threads.map(th => {
        const c = S.classifiedById(th.listingId);
        if (!c) return '';
        return `<div class="list-row" data-route="#/messages/${th.listingId}">
          <span class="row-ico">${icon(c.icon || 'image', 22)}</span>
          <div class="row-main">
            <div class="row-title">${L(c.title)}</div>
            <div class="row-sub">${th.count} · ${t('messagesTitle')}</div>
          </div></div>`;
      }).join('')}</div>`
    : emptyState('message', t('emptyMsgTitle'), t('emptyMsgSub'), t('classifiedsTitle'), '#/marketplace');
  wireRoutes(root);
}

/* ----------------------------- BOOST ----------------------------- */
export function BoostScreen(root, params) {
  const c = S.classifiedById(params[0]);
  if (!c) { go('#/marketplace'); return; }
  // boost prices are our prices — never rendered for a visitor, not even
  // by typing the route
  if (!S.requireTier(1, location.hash, go)) return;
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
    await S.chargeCard(sel.price, 'Marketplace boost');
    S.boostClassified(c.id);
    toast(t('done'), 'ok');
    go('#/marketplace/' + c.id);
  });
}
