/* ======================= ADMIN BACK OFFICE (v1, internal) ======================= */
import { t, L, icon, $, $$, go, renderHeader, toast, wireRoutes, emptyState, fmtMoney } from '../ui.js';
import { MOD_QUEUE, MAG_CATS, ARTICLES, CATEGORIES } from '../data.js';
import * as S from '../store.js';

const ADMIN_PASS = 'arabna2026';
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
      <div class="field"><label class="label">${t('password')}</label><input class="input" id="aPass" type="password" placeholder="arabna2026" /></div>
      <button class="btn btn-gold btn-block" id="aGo">${t('signIn')}</button>
      <div class="hint" style="text-align:center;margin-top:10px">DEMO: arabna2026</div>
    </div>`;
  $('#aGo').addEventListener('click', () => {
    if ($('#aPass').value !== ADMIN_PASS) { toast(t('wrongCode'), 'err'); return; }
    unlocked = true;
    go('#/admin');
  });
}

function panelView(root) {
  let tab = 'queue';

  root.innerHTML = `
    <div class="tabs" id="aTabs">
      <button class="tab active" data-t="queue">${S.state.lang === 'en' ? 'Moderation' : 'المراجعة'}</button>
      <button class="tab" data-t="mag">${t('magazineTitle')}</button>
      <button class="tab" data-t="ads">${t('advertiseWithUs')}</button>
      <button class="tab" data-t="dir">${t('directoryTitle')}</button>
    </div>
    <div id="aBody"></div>`;

  const paint = () => {
    const body = $('#aBody');
    if (tab === 'queue') body.innerHTML = queueHtml();
    else if (tab === 'mag') body.innerHTML = magHtml();
    else if (tab === 'ads') body.innerHTML = adsHtml();
    else body.innerHTML = dirHtml();

    wireRoutes(body);

    $$('#aBody [data-approve]').forEach(b => b.addEventListener('click', () => { toast(t('done'), 'ok'); b.closest('.list-row').style.opacity = '.4'; }));
    $$('#aBody [data-reject]').forEach(b => b.addEventListener('click', () => { toast(t('done'), 'ok'); b.closest('.list-row').style.opacity = '.4'; }));
    $$('#aBody [data-adok]').forEach(b => b.addEventListener('click', () => { S.approveAd(b.dataset.adok); toast(t('done'), 'ok'); paint(); }));

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
  };
  paint();

  $$('#aTabs .tab').forEach(b => b.addEventListener('click', () => {
    tab = b.dataset.t;
    $$('#aTabs .tab').forEach(x => x.classList.toggle('active', x === b));
    paint();
  }));
}

function queueHtml() {
  const reported = S.state.reported;
  return `<div class="pad mt-16">
    <div class="list-note" style="margin:0 0 12px">${icon('shield', 18)}
      <span>${S.state.lang === 'en' ? 'Flagged content and user reports land here for a human decision — AI scores risk, it never auto-rejects.' : 'المحتوى المشبوه وبلاغات المستخدمين تظهر هنا لقرار بشري — الذكاء الاصطناعي يعطي درجة خطورة فقط ولا يرفض تلقائياً.'}</span></div>
    ${MOD_QUEUE.map(q => `
      <div class="list-row">
        <span class="row-ico" style="color:${q.risk === 'high' ? '#E79A9C' : 'var(--gold-bright)'}">${icon('alert', 24)}</span>
        <div class="row-main">
          <div class="row-title">${L(q.item)}
            <span class="badge ${q.risk === 'high' ? 'badge-free' : 'badge-sponsored'}" style="${q.risk === 'high' ? 'color:#E79A9C;background:rgba(196,89,92,.14);border-color:rgba(196,89,92,.35)' : ''}">${q.risk}</span></div>
          <div class="row-sub">${L(q.reason)}</div>
          <div class="row-actions">
            <button class="mini-btn gold" data-approve="${q.id}">${icon('check', 15)} ${t('confirm')}</button>
            <button class="mini-btn" data-reject="${q.id}">${icon('x', 15)} ${t('delete')}</button>
          </div>
        </div>
      </div>`).join('')}
    ${reported.length ? `<div class="hint">${S.state.lang === 'en' ? 'User reports' : 'بلاغات المستخدمين'}: ${reported.length}</div>` : ''}
  </div>`;
}

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
            <span class="badge ${o.status === 'live' ? 'badge-verified' : 'badge-free'}">${o.status}</span></div>
          <div class="row-sub">${t(o.product === 'slider' ? 'prodSlider' : o.product === 'mini' ? 'prodMini' : 'prodStory')} · ${fmtMoney(o.price)} · ${o.tagline || ''}</div>
          ${o.status !== 'live' ? `<div class="row-actions"><button class="mini-btn gold" data-adok="${o.id}">${icon('check', 15)} ${S.state.lang === 'en' ? 'Approve & go live' : 'اعتماد ونشر'}</button></div>` : ''}
        </div>
      </div>`).join('') : emptyState('megaphone', t('emptyNotifTitle'), t('adSubmittedSub'))}
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
    <button class="btn btn-ghost btn-block mt-12" onclick="void 0" id="imp">${icon('file', 19)} ${S.state.lang === 'en' ? 'Import list' : 'استيراد قائمة'}</button>
    <div class="mt-16">
      ${CATEGORIES.slice(0, 6).map(c => `<div class="setting-row"><span class="s-txt"><b>${t(c.key)}</b></span>
        <span class="muted fs-12">${all.filter(b => b.cat === c.id).length}</span></div>`).join('')}
    </div>
  </div>`;
}
