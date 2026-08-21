/* ======================= MAGAZINE ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, toast, wireRoutes, emptyState, shareItem,
         query, sectionNote, sectionSlider, sponsoredRows, historyKey } from '../ui.js';
import { ARTICLES, MAG_CATS, MINI_ADS, AD_SLOTS, NEWCOMER_PARTS } from '../data.js';
import * as S from '../store.js';
import { catKeyOf, startSlider } from './home.js';

function allArticles() { return S.withoutDemo(S.state.extraArticles.concat(ARTICLES)); }

/* ------------------------------------------------------------
   THE NEWCOMER'S GUIDE

   Pinned at the head of the magazine rather than filed as an
   article: an article sinks under the next one, and the family
   this is written for is arriving every week. It is the drawer's
   own accordion idiom — one part open at a time, so eight
   headings stay a list instead of becoming a wall.

   Every part carries a working button even while its copy is a
   placeholder. That is the half that is useful today, and it is
   the half that makes the guide a doorway rather than a post.
   ------------------------------------------------------------ */
export function newcomerCardHtml() {
  return `<button class="nc-card" data-route="#/newcomer">
    <span class="nc-card-ico">${icon('compass', 24)}</span>
    <span class="nc-card-txt">
      <b>${t('ncCardTitle')}</b>
      <span>${t('ncCardSub')}</span>
    </span>
    <span class="chev">${icon(document.documentElement.dir === 'rtl' ? 'chevronL' : 'chevronR', 19)}</span>
  </button>`;
}

/** the i18n key from the id, the way the attribute registry does it */
const ncKey = (id, suffix) => 'nc' + id[0].toUpperCase() + id.slice(1) + suffix;

export function NewcomerScreen(root) {
  renderHeader({ simple: true, title: t('ncTitle') });
  root.innerHTML = `
    <div class="pad mt-16">
      <div class="section-title">${t('ncTitle')}<small>${t('ncSub')}</small></div>
      <div class="faq mt-12" id="ncList">
        ${NEWCOMER_PARTS.map(p => `
          <div class="faq-item" data-q="${p.id}">
            <button class="faq-head" aria-expanded="false" data-toggle="${p.id}">
              <span class="nc-head">${icon(p.icon, 19)} ${t(ncKey(p.id, 'Title'))}</span>
              ${icon('chevronD', 19, 'faq-arrow')}
            </button>
            <div class="faq-body"><div class="faq-body-inner">
              <p>${t('ncSoon')}</p>
              <button class="btn btn-gold btn-sm btn-block mt-8" data-route="${p.route}">
                ${icon('search', 17)} ${t('ncFind')}: ${t(ncKey(p.id, 'Find'))}</button>
            </div></div>
          </div>`).join('')}
      </div>
    </div>
    <div style="height:16px"></div>`;

  /* one open at a time — the same rule as the drawer and the FAQ */
  let open = '';
  $$('#ncList [data-toggle]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.toggle;
    open = open === id ? '' : id;
    $$('#ncList .faq-item').forEach(it => {
      const on = it.dataset.q === open;
      it.classList.toggle('open', on);
      it.querySelector('.faq-head').setAttribute('aria-expanded', String(on));
    });
  }));
  wireRoutes(root);
}

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
    ${/* Pinned above the chips, so it is never filtered away and never
         sinks under the newest article. */''}
    <div class="pad">${newcomerCardHtml()}</div>
    <!-- six short chips: they wrap onto a second line rather than run off
         the edge. Same rule as everywhere else — an option nobody can see
         is an option nobody has. -->
    <div class="chip-wrap" id="magChips">
      <button class="chip ${cat === 'all' ? 'active' : ''}" data-cat="all">${t('catAll')}</button>
      ${MAG_CATS.map(c => `<button class="chip ${cat === c.id ? 'active' : ''}" data-cat="${c.id}">${t(c.key)}</button>`).join('')}
    </div>
    <!-- slider · two sponsored · the articles -->
    <div id="secAds"></div>
    <div id="sponRows"></div>

    <div id="magNote"></div>
    <div class="pad mt-12" id="magList"></div>
    <div style="height:16px"></div>`;

  /* The sponsored stories move to the top and are labelled there. They
     still appear in their place in the list — this is the shop window, not
     a replacement for the shelf. */
  const paintAds = (sec, list) => {
    const key = historyKey();
    const ads = S.rotate(S.sectionAds('magazine'), AD_SLOTS.magazine, key);
    $('#secAds').innerHTML = sectionSlider(ads, {
      product: 'magazine',
      sectionName: sec ? t(sec.key) : t('magazineTitle'),
    });
    if (ads.length) startSlider(ads, '#secAds .slider', '#secTrack', '#secDots');
    wireRoutes($('#secAds'));

    const shown = ads.map(a => a.id);
    const rows = S.rotate(list.filter(a => a.sponsored), 2, key, shown).map(a => ({
      id: a.id,
      route: '#/magazine/' + a.id,
      icon: a.icon || 'newspaper',
      title: L(a.title),
      sub: L(a.advertiser || '') || L(a.excerpt || ''),
    }));
    $('#sponRows').innerHTML = sponsoredRows(rows);
    wireRoutes($('#sponRows'));
  };

  const paint = () => {
    const list = allArticles().filter(a => cat === 'all' || a.cat === cat);
    const sec = MAG_CATS.find(c => c.id === cat);
    paintAds(sec, list);
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
