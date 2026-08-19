/* ======================= MAGAZINE ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, toast, wireRoutes, emptyState, shareItem,
         query, sectionNote } from '../ui.js';
import { ARTICLES, MAG_CATS, MINI_ADS } from '../data.js';
import * as S from '../store.js';
import { catKeyOf } from './home.js';

function allArticles() { return S.withoutDemo(S.state.extraArticles.concat(ARTICLES)); }

export function MagazineScreen(root) {
  renderHeader({});
  // Arriving from a chip elsewhere in the app must land on that section, the
  // same way the directory and the marketplace already do.
  const q = query();
  let cat = q.cat || 'all';

  root.innerHTML = `
    <div class="tabs">
      <button class="tab" data-route="#/directory">${t('tabDirectory')}</button>
      <button class="tab active">${t('tabMagazine')}</button>
    </div>
    <div class="section-head" style="margin-top:14px">
      <div class="section-title">${t('magazineTitle')}<small>${t('magazineSub')}</small></div>
    </div>
    <div class="hscroll" id="magChips">
      <button class="chip ${cat === 'all' ? 'active' : ''}" data-cat="all">${t('catAll')}</button>
      ${MAG_CATS.map(c => `<button class="chip ${cat === c.id ? 'active' : ''}" data-cat="${c.id}">${t(c.key)}</button>`).join('')}
    </div>
    <div id="magNote"></div>
    <div class="pad mt-12" id="magList"></div>
    <div style="height:16px"></div>`;

  const paint = () => {
    const list = allArticles().filter(a => cat === 'all' || a.cat === cat);
    const sec = MAG_CATS.find(c => c.id === cat);
    $('#magNote').innerHTML = sectionNote(sec ? t(sec.key) : '', list.length);
    const out = [];
    list.forEach((a, i) => {
      out.push(articleCard(a));
      // native banner ad every 3 articles (same component language as the Home mini-ad)
      const ads = S.withoutDemo(MINI_ADS);
      if ((i + 1) % 3 === 0 && ads.length) {
        const ad = ads[Math.floor(i / 3) % ads.length];
        out.push(`<button class="mini-ad" style="margin:0 0 11px" data-route="${ad.link}">
          <span class="m-ico">${icon(ad.icon, 19)}</span>
          <span class="m-body"><span class="m-name">${L(ad.name)}</span><br><span class="m-tag">${L(ad.tag)}</span></span>
          <span class="ad-label">${t('sponsored')}</span></button>`);
      }
    });
    $('#magList').innerHTML = list.length ? out.join('') : emptyState('newspaper', t('emptyDirTitle'), t('emptyDirSub'));
    wireRoutes($('#magList'));
  };
  paint();

  // an active chip the user cannot see reads as "the filter did not apply"
  const activeChip = $('#magChips .chip.active');
  if (activeChip && cat !== 'all') activeChip.scrollIntoView({ inline: 'center', block: 'nearest' });

  $$('#magChips .chip').forEach(c => c.addEventListener('click', () => {
    cat = c.dataset.cat;
    $$('#magChips .chip').forEach(x => x.classList.toggle('active', x === c));
    paint();
  }));
  wireRoutes(root);
}

function articleCard(a) {
  return `<div class="card mag-card" data-route="#/magazine/${a.id}">
    <div class="mag-thumb">${icon(a.media === 'video' ? 'play' : (a.icon || 'newspaper'), 24)}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="badge badge-cat">${t(catKeyOf(a.cat))}</span>
        ${a.sponsored ? `<span class="badge badge-sponsored">${t('sponsoredStory')}</span>` : ''}
      </div>
      <div class="mag-title mt-8">${L(a.title)}</div>
      <div class="mag-ex">${L(a.excerpt)}</div>
      <div class="mag-meta"><span>${icon('clock', 13)} ${a.read} ${t('readTime')}</span><span>${L(a.date)}</span></div>
    </div>
  </div>`;
}

export function ArticleScreen(root, params) {
  const a = allArticles().find(x => x.id === params[0]);
  if (!a) { go('#/magazine'); return; }
  renderHeader({ hidden: true });

  root.innerHTML = `
    <div class="article-hero">
      <button class="back-btn" id="bk">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 22)}</button>
      ${icon(a.media === 'video' ? 'play' : (a.icon || 'newspaper'), 60)}
    </div>
    <div class="article-body">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="badge badge-cat">${t(catKeyOf(a.cat))}</span>
        ${a.sponsored ? `<span class="badge badge-sponsored">${t('sponsoredStory')} · ${L(a.advertiser || '')}</span>` : ''}
      </div>
      <h1>${L(a.title)}</h1>
      <div class="mag-meta" style="margin-bottom:16px">
        <span>${t('by')} ${L(a.author)}</span><span>·</span><span>${L(a.date)}</span><span>·</span><span>${a.read} ${t('readTime')}</span>
      </div>
      ${(L(a.body) || []).map(p => `<p>${p}</p>`).join('')}

      <button class="mini-ad" style="margin:6px 0 0" data-route="#/advertise">
        <span class="m-ico">${icon('megaphone', 19)}</span>
        <span class="m-body"><span class="m-name">${t('adCta')}</span><br><span class="m-tag">${t('adCtaSub')}</span></span>
        <span class="ad-label">${t('adLabel')}</span></button>

      <div class="action-grid mt-16">
        <button class="btn btn-ghost btn-sm" id="shareBtn">${icon('share', 18)} ${t('share')}</button>
        <button class="btn btn-ghost btn-sm" id="saveBtn">${icon('bookmark', 18)} ${t('save')}</button>
      </div>
    </div>`;

  $('#bk').addEventListener('click', () => back());
  $('#shareBtn').addEventListener('click', () => shareItem(L(a.title), location.href));
  $('#saveBtn').addEventListener('click', () => {
    if (!S.requireTier(1, location.hash, go)) return;
    S.toggleSaved(a.id); toast(S.isSaved(a.id) ? t('saved') : t('done'), 'ok');
  });
  wireRoutes(root);
}
