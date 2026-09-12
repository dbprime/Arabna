/* ======================= MAGAZINE ======================= */
import { t, L, icon, $, $$, go, back, renderHeader, toast, wireRoutes, emptyState, shareItem,
         query, sectionNote, sectionSlider, sponsoredRows, historyKey, esc,
         pickerBtn, setPickerValue, openDropdown } from '../ui.js';
import { ARTICLES, MAG_CATS, MINI_ADS, AD_SLOTS, NEWCOMER_PARTS } from '../data.js';
import { FIGURES } from '../figures.js';
import { SUPABASE_URL } from '../supabase-config.js';
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
    <!-- Six options — «الكل» plus five — is over the line: more than five
         is a dropdown, five or fewer are chips. Wrapping onto a second row
         was better than running off the edge, but a picker that names the
         chosen section in gold costs one line instead of two and inherits
         the history entry, so the back button closes it. -->
    <div class="ctl-row" id="magPick">
      ${pickerBtn({ id: 'ctlMag', label: t('lblSection'), value: cat === 'all' ? t('catAll') : t((MAG_CATS.find(c => c.id === cat) || {}).key || 'catAll'), wide: true })}
    </div>
    <div id="magDD"></div>
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
    /* ⚠️ THE SAME LIST THE TRACK DREW. `slidesFor` decides once whether
       the house slide is in the rotation, and the rotator is driven by
       the array it is handed — two decisions would draw a slide that is
       never shown. */
    const slides = S.slidesFor('magazine', ads);
    if (slides.length) startSlider(slides, '#secAds .slider', '#secTrack', '#secDots');
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
          <span class="m-body"><span class="m-name">${esc(L(ad.name))}</span><br><span class="m-tag">${esc(L(ad.tag))}</span></span>
          <span class="ad-label">${t('sponsored')}</span></button>`);
      }
    });
    $('#magList').innerHTML = list.length ? out.join('') : emptyState('newspaper', t('emptyDirTitle'), t('emptyDirSub'));
    wireRoutes($('#magList'));
  };
  paint();

  const magOptions = () => {
    const all = allArticles();
    return [{ id: 'all', label: t('catAll'), icon: 'newspaper', count: all.length }]
      .concat(MAG_CATS.map(c => ({ id: c.id, label: t(c.key), icon: c.icon || 'newspaper',
                                   count: all.filter(a => a.cat === c.id).length })));
  };
  const magBtn = $('#ctlMag');
  magBtn.addEventListener('click', () => openDropdown({
    host: $('#magDD'), anchor: magBtn, title: t('pickSection'),
    options: magOptions(), value: cat, unit: 'ddSec',
    onPick: (id) => {
      cat = id;
      setPickerValue('ctlMag', id === 'all' ? t('catAll') : t((MAG_CATS.find(c => c.id === id) || {}).key || 'catAll'));
      paint();
    },
  }));
  wireRoutes(root);
}

/* ------------------------------------------------------------
   675: THE BODY IS BLOCKS, AND `body` IS UNTOUCHED.

   An article carrying `blocks` is drawn here; one that does not is drawn
   by the single line this stands beside, character for character. The
   five seeds and every article already saved on a reader's own device go
   on working, and nothing had to be rewritten to ship this.

   ⚠️ `blocks` is ONE array for both languages, and each block carries
   `{ar, en}` inside it. `body` is two independent arrays, so writing the
   pictures into it would put a photograph under a different paragraph in
   each language after the first edit — and what is not translated, a
   photograph and a figure, is not written twice.

   ⚠️ EVERY STRING GOES THROUGH `esc()` — in `p`, `h`, `q`, `ul`, `note`
   and in the caption and the credit under a picture. That is what stops
   a tag being injected rather than printed, and it is the rule the line
   this replaces already kept.

   An unknown `t` draws a paragraph and a bare string in the array is read
   as one: whoever writes this data by hand will forget `{t:'p'}` once,
   and forgetting must not take a screen down.
   ------------------------------------------------------------ */

/** ⚠️ TWO SOURCES AND NO THIRD: a file in the repository, or a file in
    our own store. Escaping stops the attribute being broken; it does not
    stop a path we do not want. Every `src` is ours today and the admin
    writes them from the panel two files from now — so the guard is
    written today, not then.

    ⚠️ 690 — AND THE INLINED FORM OF THE FIRST SOURCE IS THE FIRST SOURCE.
    `tools/build_single.py` rewrites every quoted assets/… image literal in
    a module into a base64 `data:` URI, so the day an asset path first went
    through this guard the single-file build stopped drawing it: the cover
    fell to the icon branch and both picture blocks returned '', silently,
    on half the net and on the offline backup. A feature that works on one
    build and quietly does nothing on the other is a fault and not a test
    problem, and the fix belongs here rather than in the build, because
    excluding those three files from inlining is what would really cost
    something — the offline build's whole property is that it carries its
    pictures with it.

    ⚠️ AND THE SENTENCE ABOVE NAMES THAT LITERAL IN WORDS RATHER THAN IN
    QUOTES, BECAUSE THE FIRST DRAFT OF IT BROKE THE BUILD: the tool's own
    pattern matched the EXAMPLE inside this comment and went looking for a
    file called `assets/….jpg`. It is the twin of the rule the checks have
    paid for six times — a check must read the code and never the prose
    about the code — arriving from the build's side: a tool that rewrites
    source cannot tell a comment from a line, so an example written in the
    shape the tool rewrites is not an example, it is an instruction.

    ⚠️ AND THIS DOES NOT WEAKEN THE GUARD AGAINST ITS OWN HARM, which is an
    ORIGIN WE DID NOT CHOOSE: a base64 raster fetches nothing and reaches
    no host — it is the one shape of `src` that cannot phone home — and
    `img-src 'self' data: blob:` has permitted it in both policy files
    since before this. **`svg+xml` is refused on purpose**: SVG is the one
    image type that carries markup, and nothing in the app needs it here,
    so it costs nothing to keep out. What a `data:` value must never do is
    reach a ROW — a table carrying inlined images makes every read carry
    them (660) — and that is the writer's rule, enforced where writes are,
    never here. */
export function safeImgSrc(s) {
  if (typeof s !== 'string' || !s) return '';
  if (s.includes('..')) return '';
  if (s.startsWith('assets/')) return s;
  if (s.startsWith(SUPABASE_URL + '/')) return s;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
  return '';
}

export function blockHtml(b) {
  if (typeof b === 'string') return `<p>${esc(b)}</p>`;
  const x = () => esc(L(b.x));
  switch (b && b.t) {
    case 'h':  return `<h2 class="blk-h">${x()}</h2>`;
    case 'q':  return `<blockquote class="blk-q"><p>${x()}</p></blockquote>`;
    case 'ul': return `<ul class="blk-ul">${(b.x || []).map(i => `<li>${esc(L(i))}</li>`).join('')}</ul>`;
    case 'note': return `<aside class="blk-note"><b>${esc(L(b.k))}</b><p>${x()}</p></aside>`;
    case 'img': {
      const src = safeImgSrc(b.src);
      /* ⚠️ and the whole block goes, its caption with it: a caption under
         nothing is worse than nothing. */
      if (!src) return '';
      const cap = esc(L(b.cap || ''));
      const cr  = esc(L(b.credit || ''));
      return `<figure class="blk-img">
        <img src="${esc(src)}" alt="${cap}" loading="lazy" decoding="async" />
        ${cap || cr ? `<figcaption class="cap">${cap}${cr ? `<span class="credit">${cr}</span>` : ''}</figcaption>` : ''}
      </figure>`;
    }
    case 'fig': {
      const draw = FIGURES[b.key];
      if (!draw) return '';
      const cap = esc(L(b.cap || ''));
      return `<figure class="blk-fig"><div class="fig-box">${draw()}</div>${
        cap ? `<figcaption class="cap">${cap}</figcaption>` : ''}</figure>`;
    }
    default:   return `<p>${x()}</p>`;
  }
}

/** the cover, or '' — and '' is what keeps the icon branch alive */
function coverSrc(a) { return safeImgSrc(a && a.cover); }

function articleCard(a) {
  return `<div class="card mag-card" data-route="#/magazine/${a.id}">
    <div class="mag-thumb">${coverSrc(a)
      ? `<img src="${esc(coverSrc(a))}" alt="" loading="lazy" decoding="async" />`
      : icon(a.media === 'video' ? 'play' : (a.icon || 'newspaper'), 24)}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="badge badge-cat">${t(catKeyOf(a.cat))}</span>
        ${a.sponsored ? `<span class="badge badge-sponsored">${t('sponsoredStory')}</span>` : ''}
      </div>
      <div class="mag-title mt-8">${esc(L(a.title))}</div>
      <div class="mag-ex">${esc(L(a.excerpt))}</div>
      <div class="mag-meta"><span>${icon('clock', 13)} ${a.read} ${t('readTime')}</span><span>${esc(L(a.date))}</span></div>
    </div>
  </div>`;
}

export function ArticleScreen(root, params) {
  const a = allArticles().find(x => x.id === params[0]);
  if (!a) { toast(t('gone'), 'err'); go('#/magazine'); return; }
  renderHeader({ hidden: true });

  root.innerHTML = `
    <div class="article-hero${coverSrc(a) ? ' has-img' : ''}">
      ${coverSrc(a) ? `<img src="${esc(coverSrc(a))}" alt="" decoding="async" />` : ''}
      <button class="back-btn" id="bk">${icon(document.documentElement.dir === 'rtl' ? 'chevronR' : 'chevronL', 22)}</button>
      ${coverSrc(a) ? '' : icon(a.media === 'video' ? 'play' : (a.icon || 'newspaper'), 60)}
    </div>
    <div class="article-body">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="badge badge-cat">${t(catKeyOf(a.cat))}</span>
        ${a.sponsored ? `<span class="badge badge-sponsored">${t('sponsoredStory')} · ${esc(L(a.advertiser || ''))}</span>` : ''}
      </div>
      <h1>${esc(L(a.title))}</h1>
      <div class="mag-meta" style="margin-bottom:16px">
        <span>${t('by')} ${esc(L(a.author))}</span><span>·</span><span>${esc(L(a.date))}</span><span>·</span><span>${a.read} ${t('readTime')}</span>
      </div>
      ${a.blocks
        ? a.blocks.map(blockHtml).join('')
        : (L(a.body) || []).map(p => `<p>${esc(p)}</p>`).join('')}

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
