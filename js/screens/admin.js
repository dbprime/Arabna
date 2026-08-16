/* ======================= ADMIN BACK OFFICE (v1, internal) =======================
   Reachable only by typing #/admin — it is intentionally absent from the drawer
   and the profile screen. Credentials live in store.js (V.02: a real staff
   account behind Supabase row-level security). */
import { t, L, icon, $, $$, go, renderHeader, toast, wireRoutes, emptyState, fmtMoney, priceLabel } from '../ui.js';
import { MAG_CATS, ARTICLES, CATEGORIES } from '../data.js';
import * as S from '../store.js';

let unlocked = false;

export function AdminScreen(root) {
  renderHeader({ simple: true, title: t('adminPanel') });
  if (!unlocked) { lockView(root); return; }
  panelView(root);
}

function lockView(root) {
  root.innerHTML = `
    <div class="pad mt-20 center-col">
      <div class="empty-ico">${icon('lock', 33)}</div>
      <b style="font-size:17px">${t('adminPanel')}</b>
      <span class="muted fs-13">${S.state.lang === 'en' ? 'Internal staff access only — separate from consumer accounts.' : 'دخول داخلي لفريق عربنا فقط — منفصل عن حسابات المستخدمين.'}</span>
    </div>
    <div class="pad mt-16">
      <div class="field"><label class="label">${t('adminUser')}</label>
        <input class="input" id="aUser" autocomplete="off" /></div>
      <div class="field"><label class="label">${t('password')}</label>
        <input class="input" id="aPass" type="password" /></div>
      <div id="aErr"></div>
      <button class="btn btn-gold btn-block mt-8" id="aGo">${t('signIn')}</button>
    </div>`;

  const submit = () => {
    if (!S.checkAdmin($('#aUser').value.trim(), $('#aPass').value)) {
      $('#aErr').innerHTML = `<div class="err-msg">${icon('alert', 15)} ${t('adminLoginFail')}</div>`;
      $('#aPass').classList.add('input-err');
      return;
    }
    unlocked = true;
    go('#/admin');
  };
  $('#aGo').addEventListener('click', submit);
  $('#aPass').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

function panelView(root) {
  let tab = 'queue';

  const paintTabs = () => {
    const n = S.pendingCount();
    return `
      <div class="tabs" id="aTabs">
        <button class="tab ${tab === 'queue' ? 'active' : ''}" data-t="queue">${S.state.lang === 'en' ? 'Moderation' : 'المراجعة'}${n ? ` (${n})` : ''}</button>
        <button class="tab ${tab === 'mag' ? 'active' : ''}" data-t="mag">${t('magazineTitle')}</button>
        <button class="tab ${tab === 'ads' ? 'active' : ''}" data-t="ads">${t('advertiseWithUs')}</button>
        <button class="tab ${tab === 'dir' ? 'active' : ''}" data-t="dir">${t('directoryTitle')}</button>
      </div>`;
  };

  const paint = () => {
    root.innerHTML = paintTabs() + '<div id="aBody"></div>';
    const body = $('#aBody');
    if (tab === 'queue') body.innerHTML = queueHtml();
    else if (tab === 'mag') body.innerHTML = magHtml();
    else if (tab === 'ads') body.innerHTML = adsHtml();
    else body.innerHTML = dirHtml();

    wireRoutes(body);

    // --- listings waiting for a decision ---
    $$('#aBody [data-approve]').forEach(b => b.addEventListener('click', () => {
      S.approveClassified(b.dataset.approve);
      toast(t('itemApproved'), 'ok');
      paint();
    }));
    $$('#aBody [data-reject]').forEach(b => b.addEventListener('click', () => {
      S.rejectClassified(b.dataset.reject);
      toast(t('itemRejected'), 'ok');
      paint();
    }));
    // --- flags raised by the app (reports, free-section edits, scanned DMs) ---
    $$('#aBody [data-flagok]').forEach(b => b.addEventListener('click', () => {
      S.resolveFlag(b.dataset.flagok);
      toast(t('done'), 'ok');
      paint();
    }));
    $$('#aBody [data-flagdel]').forEach(b => b.addEventListener('click', () => {
      const f = S.state.flags.find(x => x.id === b.dataset.flagdel);
      if (f && f.kind !== 'message' && S.classifiedById(f.refId)) S.rejectClassified(f.refId);
      S.resolveFlag(b.dataset.flagdel);
      toast(t('itemRejected'), 'ok');
      paint();
    }));
    // --- seeded queue rows ---
    $$('#aBody [data-seedok]').forEach(b => b.addEventListener('click', () => {
      S.resolveSeedMod(b.dataset.seedok); toast(t('done'), 'ok'); paint();
    }));
    $$('#aBody [data-seeddel]').forEach(b => b.addEventListener('click', () => {
      S.resolveSeedMod(b.dataset.seeddel); toast(t('itemRejected'), 'ok'); paint();
    }));
    // --- paid ad orders ---
    $$('#aBody [data-adok]').forEach(b => b.addEventListener('click', () => {
      S.approveAd(b.dataset.adok); toast(t('done'), 'ok'); paint();
    }));

    const pub = $('#pubArt');
    if (pub) pub.addEventListener('click', () => {
      const title = $('#artTitle').value.trim();
      if (!title) { toast(t('required'), 'err'); return; }
      S.addArticle({
        cat: $('#artCat').value,
        sponsored: $('#artSpon').checked,
        advertiser: { ar: $('#artAdv').value, en: $('#artAdv').value },
        media: $('#artMedia').value,
        title: { ar: title, en: title },
        excerpt: { ar: $('#artEx').value, en: $('#artEx').value },
        date: { ar: 'اليوم', en: 'Today' },
        author: { ar: 'فريق عربنا', en: 'ARABNA Team' },
        body: { ar: [$('#artBody').value], en: [$('#artBody').value] },
      });
      toast(t('done'), 'ok');
      go('#/magazine');
    });

    $$('#aTabs .tab').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.t;
      paint();
    }));
  };
  paint();
}

/* ------------------------------ QUEUE ------------------------------ */
function queueHtml() {
  const pending = S.pendingListings();
  const flags = S.state.flags;
  const seeds = S.seedQueue();
  const total = pending.length + flags.length + seeds.length;

  if (!total) {
    return `<div class="pad mt-16">${emptyState('checkCircle', t('noPending'), t('noPendingSub'))}</div>`;
  }

  return `<div class="pad mt-16">
    <div class="list-note" style="margin:0 0 12px">${icon('shield', 18)}
      <span>${S.state.lang === 'en'
        ? 'Flagged content and user reports land here for a human decision — the automated scan scores risk, it never auto-rejects.'
        : 'المحتوى المشبوه وبلاغات المستخدمين تظهر هنا لقرار بشري — الفحص الآلي يعطي درجة خطورة فقط ولا يرفض تلقائياً.'}</span></div>

    <div class="stat-row" style="padding:0 0 12px">
      <div class="stat"><b>${pending.length}</b><span>${t('pendingReview')}</span></div>
      <div class="stat"><b>${flags.length}</b><span>${t('report')}</span></div>
      <div class="stat"><b>${total}</b><span>${t('total')}</span></div>
    </div>

    ${pending.map(c => `
      <div class="list-row">
        <span class="row-ico" style="overflow:hidden;padding:0">${c.photos && c.photos.length
          ? `<img src="${c.photos[c.mainPhoto || 0] || c.photos[0]}" style="width:100%;height:100%;object-fit:cover" alt="" />`
          : icon(c.icon || 'image', 24)}</span>
        <div class="row-main">
          <div class="row-title">${L(c.title)}
            <span class="badge badge-pending">${t('statusPending')}</span></div>
          <div class="row-sub gold"><span class="ltr">${priceLabel(c.price)}</span> · ${t(catKeyOf(c.cat))}</div>
          <div class="row-sub">${L(c.desc || '')}</div>
          <div class="row-sub">${icon('user', 13)} ${(S.state.user && S.state.user.name) || t('guest')} · ${(c.photos || []).length} ${t('photosCount')}</div>
          <div class="row-actions">
            <button class="mini-btn gold" data-approve="${c.id}">${icon('check', 15)} ${t('approve')}</button>
            <button class="mini-btn" data-reject="${c.id}">${icon('x', 15)} ${t('reject')}</button>
            <button class="mini-btn" data-route="#/marketplace/${c.id}">${icon('eye', 15)}</button>
          </div>
        </div>
      </div>`).join('')}

    ${flags.map(f => `
      <div class="list-row">
        <span class="row-ico" style="color:${f.risk === 'high' ? '#E79A9C' : 'var(--gold-bright)'}">${icon(f.kind === 'message' ? 'message' : 'alert', 24)}</span>
        <div class="row-main">
          <div class="row-title">${f.item ? L(f.item) : t(f.kind === 'message' ? 'messagesTitle' : 'report')}
            <span class="badge badge-free" style="color:#E79A9C;background:rgba(196,89,92,.14);border-color:rgba(196,89,92,.35)">${f.risk}</span></div>
          <div class="row-sub">${L(f.reason)}</div>
          <div class="row-actions">
            <button class="mini-btn gold" data-flagok="${f.id}">${icon('check', 15)} ${t('approve')}</button>
            <button class="mini-btn" data-flagdel="${f.id}">${icon('x', 15)} ${t('reject')}</button>
          </div>
        </div>
      </div>`).join('')}

    ${seeds.map(q => `
      <div class="list-row">
        <span class="row-ico" style="color:${q.risk === 'high' ? '#E79A9C' : 'var(--gold-bright)'}">${icon('alert', 24)}</span>
        <div class="row-main">
          <div class="row-title">${L(q.item)}
            <span class="badge ${q.risk === 'high' ? 'badge-free' : 'badge-sponsored'}" style="${q.risk === 'high' ? 'color:#E79A9C;background:rgba(196,89,92,.14);border-color:rgba(196,89,92,.35)' : ''}">${q.risk}</span></div>
          <div class="row-sub">${L(q.reason)}</div>
          <div class="row-actions">
            <button class="mini-btn gold" data-seedok="${q.id}">${icon('check', 15)} ${t('approve')}</button>
            <button class="mini-btn" data-seeddel="${q.id}">${icon('x', 15)} ${t('reject')}</button>
          </div>
        </div>
      </div>`).join('')}
  </div>`;
}

function catKeyOf(catId) {
  const map = { cars: 'filterCars', furniture: 'filterFurniture', realestate: 'filterRealEstate',
                jobs: 'filterJobs', pets: 'filterPets', handyman: 'filterHandyman',
                free: 'filterFree', other: 'filterOther' };
  return map[catId] || 'filterOther';
}

/* ----------------------------- MAGAZINE ----------------------------- */
function magHtml() {
  const all = S.state.extraArticles.concat(ARTICLES);
  return `<div class="pad mt-16">
    <div class="section-title">${S.state.lang === 'en' ? 'New article' : 'مقال جديد'}</div>
    <div class="field mt-12"><label class="label">${t('titleLabel')}</label><input class="input" id="artTitle" /></div>
    <div class="field"><label class="label">${t('category')}</label>
      <select class="select" id="artCat">${MAG_CATS.map(c => `<option value="${c.id}">${t(c.key)}</option>`).join('')}</select></div>
    <div class="field"><label class="label">${S.state.lang === 'en' ? 'Media' : 'الوسائط'}</label>
      <select class="select" id="artMedia"><option value="image">${t('photos')}</option><option value="video">${t('videos')}</option></select></div>
    <div class="field"><label class="label">${S.state.lang === 'en' ? 'Excerpt' : 'المقتطف'}</label><input class="input" id="artEx" /></div>
    <div class="field"><label class="label">${S.state.lang === 'en' ? 'Body' : 'نص المقال'}</label><textarea class="textarea" id="artBody"></textarea></div>
    <label class="setting-row" style="padding:8px 0;border:none">
      <input type="checkbox" id="artSpon" style="width:18px;height:18px;accent-color:#C6A15B" />
      <span class="s-txt"><b style="font-weight:500;font-size:12.5px">${t('sponsoredStory')}</b></span></label>
    <div class="field"><label class="label">${S.state.lang === 'en' ? 'Advertiser' : 'المعلن'} <span class="muted">(${t('optional')})</span></label><input class="input" id="artAdv" /></div>
    <button class="btn btn-gold btn-block" id="pubArt">${icon('send', 19)} ${S.state.lang === 'en' ? 'Publish' : 'نشر'}</button>

    <div class="section-title mt-20">${S.state.lang === 'en' ? 'Published' : 'المنشور'} (${all.length})</div>
    <div class="mt-12">
      ${all.slice(0, 6).map(a => `<div class="list-row" data-route="#/magazine/${a.id}">
        <span class="row-ico">${icon(a.icon || 'newspaper', 24)}</span>
        <div class="row-main"><div class="row-title">${L(a.title)}</div>
          <div class="row-sub">${L(a.date)} ${a.sponsored ? '· ' + t('sponsoredStory') : ''}</div></div></div>`).join('')}
    </div>
  </div>`;
}

function adsHtml() {
  const orders = S.state.myAds;
  return `<div class="pad mt-16">
    ${orders.length ? orders.map(o => `
      <div class="list-row">
        <span class="row-ico">${icon('megaphone', 24)}</span>
        <div class="row-main">
          <div class="row-title">${o.bizName}
            <span class="badge ${o.status === 'live' ? 'badge-verified' : 'badge-pending'}">${o.status === 'live' ? t('statusLive') : t('statusPending')}</span></div>
          <div class="row-sub">${t(o.product === 'slider' ? 'prodSlider' : o.product === 'mini' ? 'prodMini' : 'prodStory')} · ${fmtMoney(o.price)} · ${o.tagline || ''}</div>
          ${o.status !== 'live' ? `<div class="row-actions"><button class="mini-btn gold" data-adok="${o.id}">${icon('check', 15)} ${S.state.lang === 'en' ? 'Approve & go live' : 'اعتماد ونشر'}</button></div>` : ''}
        </div>
      </div>`).join('') : emptyState('megaphone', t('noPending'), t('adSubmittedSub'))}
  </div>`;
}

function dirHtml() {
  const all = S.allBusinesses();
  const paid = all.filter(b => S.businessPlan(b) === 'paid').length;
  return `<div class="pad mt-16">
    <div class="stat-row" style="padding:0">
      <div class="stat"><b>${all.length}</b><span>${t('directoryTitle')}</span></div>
      <div class="stat"><b>${paid}</b><span>${t('verified')}</span></div>
      <div class="stat"><b>${all.filter(b => !b.claimed).length}</b><span>${t('claimIt')}</span></div>
    </div>
    <div class="list-note mt-16" style="margin-inline:0">${icon('info', 18)}
      <span>${S.state.lang === 'en' ? 'Bulk import (CSV / PDF list) seeds unclaimed free listings — V.02 with the real database.' : 'الاستيراد الجماعي (من ملف PDF/CSV) يضيف الأنشطة كإدراج مجاني غير مُطالَب به — في V.02 مع قاعدة البيانات الحقيقية.'}</span></div>
    <button class="btn btn-ghost btn-block mt-12" disabled>${icon('file', 19)} ${S.state.lang === 'en' ? 'Import list' : 'استيراد قائمة'} — ${t('comingSoon')}</button>
    <div class="mt-16">
      ${CATEGORIES.slice(0, 6).map(c => `<div class="setting-row"><span class="s-txt"><b>${t(c.key)}</b></span>
        <span class="muted fs-12">${all.filter(b => b.cat === c.id).length}</span></div>`).join('')}
    </div>
  </div>`;
}
