/* ============================================================
   test_v92 — 675: the article becomes an article
   ------------------------------------------------------------
   ⚠️ THE CONDITION THE WHOLE FILE WAS WRITTEN FOR, measured on the tree
   before a line was changed:

       ARTICLES                 5, and all five inside markDemo()
       showDemo (the default)   false, since 510
       state.extraArticles      [] on a device that added nothing
       withoutDemo(ARTICLES)    []

   **The magazine was empty for every visitor of arabna.app.** Block 3 is
   that sentence turned into an assertion, and it is the item this suite
   exists for; everything else is the machinery that makes it safe.

   TWO LAYERS, and they stand beside each other rather than instead:
   blocks 1–4 read the screen, blocks 5–8 read the code. A rendering check
   cannot see that a figure was written into the DATA rather than the
   registry, or that a colour literal crept into a drawing that has to
   work in both themes — and neither can be seen by a reader until the day
   it is wrong.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { STRINGS } from '../../js/i18n.js';
import { ARTICLES } from '../../js/data.js';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ comments stripped before any «does the code do X» check — the rule
   this project has paid for five times, and this batch's own comments
   name every shape it forbids, colour literals included. */
const strip = t => t.replace(/(^|[\s(,;{:=])\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');
const code = f => strip(read(f));

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};

/* `seed` is merged into the stored object BEFORE every load, and `demo`
   is passed explicitly rather than through `_demo.mjs`: this suite needs
   the invented data ON in one block and OFF in another, and a helper that
   wraps `newContext` cannot tell the two apart. */
const fresh = async ({ lang = 'ar', demo = false, articles = null } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  await ctx.route('**/*.supabase.co/**', r => r.abort());
  await ctx.addInitScript(([l, d, arts]) => { try {
    const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.lang = l;
    if (d) { s.showDemo = true; s.demoDefaultOff = true; }
    if (arts) s.extraArticles = arts;
    localStorage.setItem(k, JSON.stringify(s));
  } catch (e) {} }, [lang, demo, articles]);
  const p = await ctx.newPage(); wire(p);
  return { ctx, p };
};
const show = async (p, hash) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#app .screen, #app > *', { timeout: 9000 }).catch(() => {});
  await p.waitForTimeout(900);
};

/* a fixture article: every field the magazine reads, and nothing invented
   beyond `blocks`, which is what is under test */
const art = (id, blocks, extra = {}) => Object.assign({
  id, cat: 'community', sponsored: false, read: 3, media: 'image', icon: 'newspaper',
  author: { ar: 'اختبار', en: 'Test' }, date: { ar: '1 يناير 2026', en: 'Jan 1, 2026' },
  title: { ar: 'عنوان', en: 'Title' }, excerpt: { ar: 'مقتطف', en: 'Excerpt' },
  blocks,
}, extra);

/* ============================================================
   1) the blocks, and what an article without them still does
   ============================================================ */
{
  const { ctx, p } = await fresh({ demo: true });
  await show(p, '#/magazine/a1');
  const seed = ARTICLES.find(a => a.id === 'a1');
  const paras = await p.locator('.article-body > p').allTextContents();
  ok('1.1 an article with no `blocks` is drawn exactly as it was',
     paras.length === seed.body.ar.length && paras.every((t, i) => t === seed.body.ar[i]),
     paras.length + ' of ' + seed.body.ar.length);
  ok('1.1b …and not one block element appears on it',
     await p.locator('.article-body [class^="blk-"], .article-body .blk-q').count() === 0);
  await ctx.close();
}
{
  const blocks = [
    { t: 'p',  x: { ar: 'فقرة', en: 'para' } },
    { t: 'h',  x: { ar: 'عنوان فرعي', en: 'sub' } },
    { t: 'q',  x: { ar: 'اقتباس', en: 'quote' } },
    { t: 'ul', x: [{ ar: 'واحد', en: 'one' }, { ar: 'اثنان', en: 'two' }] },
    { t: 'note', k: { ar: 'صندوق', en: 'box' }, x: { ar: 'جانبي', en: 'aside' } },
    { t: 'img', src: 'assets/logo.png', cap: { ar: 'تعليق', en: 'cap' }, credit: { ar: 'نسبة', en: 'credit' } },
    { t: 'fig', key: 'houstonHousing', cap: { ar: 'رسم', en: 'figure' } },
    { t: 'zzz', x: { ar: 'نوع مجهول', en: 'unknown type' } },
    'نصٌّ عارٍ بلا نوع',
  ];
  const { ctx, p } = await fresh({ articles: [art('t1', blocks)] });
  await show(p, '#/magazine/t1');
  const n = s => p.locator('.article-body ' + s).count();
  ok('1.2 h', await n('h2.blk-h') === 1);
  ok('1.2 q', await n('blockquote.blk-q') === 1);
  ok('1.2 ul', await n('ul.blk-ul') === 1 && await n('ul.blk-ul li') === 2);
  ok('1.2 note', await n('aside.blk-note') === 1 && await n('aside.blk-note b') === 1);
  ok('1.2 img', await n('figure.blk-img img') === 1);
  ok('1.2 fig', await n('figure.blk-fig .fig-box svg') === 1);
  const texts = await p.locator('.article-body > p').allTextContents();
  ok('1.2b an unknown type draws a paragraph and does not throw',
     texts.includes('نوع مجهول'), JSON.stringify(texts));
  ok('1.3 a bare string in `blocks` is read as a paragraph',
     texts.includes('نصٌّ عارٍ بلا نوع'));
  ok('1.3b …and the screen is standing', (await p.locator('.article-body h1').count()) === 1);
  ok('1.4 the picture carries lazy loading, so the last one is not fetched for whoever never reaches it',
     await p.locator('figure.blk-img img[loading="lazy"]').count() === 1);
  await ctx.close();
}

/* ============================================================
   2) ⚠️ the safety rules, and they are the reason `fig` takes a KEY
   ============================================================ */
{
  const tag = '<b>x</b>';
  const blocks = [
    { t: 'p',  x: { ar: 'p' + tag, en: 'p' + tag } },
    { t: 'h',  x: { ar: 'h' + tag, en: 'h' + tag } },
    { t: 'q',  x: { ar: 'q' + tag, en: 'q' + tag } },
    { t: 'ul', x: [{ ar: 'u' + tag, en: 'u' + tag }] },
    { t: 'note', k: { ar: 'k' + tag, en: 'k' + tag }, x: { ar: 'n' + tag, en: 'n' + tag } },
    { t: 'img', src: 'assets/logo.png', cap: { ar: 'c' + tag, en: 'c' + tag }, credit: { ar: 'r' + tag, en: 'r' + tag } },
  ];
  const { ctx, p } = await fresh({ articles: [art('t2', blocks)] });
  await show(p, '#/magazine/t2');
  const body = p.locator('.article-body');
  /* ⚠️ `.blk-note b` is OUR OWN heading, drawn by the renderer — so the
     sweep asks for a `<b>` that is not the note's. A blanket count of
     `b` reported the fault it exists to prevent on a build that was
     right. */
  ok('2.1 no injected element survives anywhere in the body',
     await body.locator('b:not(.blk-note > b)').count() === 0,
     String(await body.locator('b:not(.blk-note > b)').count()));
  const txt = await body.innerText();
  ok('2.1b …and every one of the seven places prints the tag as words',
     ['p', 'h', 'q', 'u', 'n', 'c', 'r'].every(k => txt.includes(k + tag)),
     ['p', 'h', 'q', 'u', 'n', 'c', 'r'].filter(k => !txt.includes(k + tag)).join(',') || 'all seven');
  await ctx.close();
}
{
  const blocks = [
    { t: 'img', src: '../../etc/passwd',        cap: { ar: 'خارج المجلّد', en: 'escape' } },
    { t: 'img', src: 'https://evil.example/x.jpg', cap: { ar: 'مضيف غريب', en: 'foreign host' } },
    { t: 'img', src: '',                        cap: { ar: 'فارغ', en: 'empty' } },
    { t: 'fig', key: 'notAFigure',              cap: { ar: 'مفتاح مجهول', en: 'unknown key' } },
    { t: 'p',   x: { ar: 'آخر الكتل', en: 'last block' } },
  ];
  const { ctx, p } = await fresh({ articles: [art('t3', blocks)] });
  await show(p, '#/magazine/t3');
  const body = p.locator('.article-body');
  ok('2.2 a `src` that is neither ours nor in the repository draws nothing',
     await body.locator('figure.blk-img').count() === 0 && await body.locator('img').count() === 0);
  const txt = await body.innerText();
  ok('2.2b …and its caption goes with it: a caption under nothing is worse than nothing',
     !txt.includes('خارج المجلّد') && !txt.includes('مضيف غريب') && !txt.includes('فارغ'));
  ok('2.3 an unknown figure key draws nothing and does not throw',
     await body.locator('figure.blk-fig').count() === 0 && !txt.includes('مفتاح مجهول'));
  ok('2.3b …and the blocks after it are still drawn',
     txt.includes('آخر الكتل'));
  await ctx.close();
}

/* ============================================================
   3) ⚠️ THE ITEM THIS FILE EXISTS FOR
   ============================================================ */
{
  const { ctx, p } = await fresh({});          // the default: invented data OFF
  await show(p, '#/magazine');
  const titles = await p.locator('.mag-card .mag-title').allTextContents();
  ok('3.1 the magazine is NOT empty for a visitor with the invented data off',
     titles.length >= 2, 'real articles now: ' + titles.length);
  /* 685 REVERSED THE LETTERS, NOT THE SUBJECT. This asked «are the two
     cards the two real articles», and answered it by freezing the Arabic
     title — which `685` then rewrote by decision: «هيلكروفت» is `Hillcroft`
     in the Arabic text, and the vowel marks are gone. The subject is
     unchanged and is asserted at its own source: the card carries the
     route, and the route carries the id. A title is copy and moves; an id
     is a key and does not. */
  const routes = await p.locator('.mag-card').evaluateAll(
    els => els.map(e => e.getAttribute('data-route')));
  ok('3.1b …and they are the two real ones',
     routes.includes('#/magazine/r1') && routes.includes('#/magazine/r2'),
     routes.join(' | '));
  ok('3.1b2 …and the first still names the street, in English now',
     titles.some(t => t.includes('Hillcroft')) && !titles.some(t => t.includes('هيلكروفت')),
     titles.join(' | ').slice(0, 90));
  await show(p, '#/magazine/r1');
  ok('3.1c …and the first opens on its blocks',
     await p.locator('.article-body .blk-q').count() === 1 &&
     await p.locator('.article-body .blk-fig').count() === 1);
  await show(p, '#/magazine/r2');
  ok('3.1d …and the second carries its two figures',
     await p.locator('.article-body .fig-box svg').count() === 2);
  await ctx.close();
}
{
  /* ⚠️ DERIVED, never written: the count comes from `js/data.js` itself,
     so an article added or removed re-measures instead of going stale. */
  const real = ARTICLES.filter(a => !a.demo);
  ok('3.1e the real articles sit OUTSIDE markDemo — none carries `demo`',
     real.length === 2 && real.every(a => a.demo === undefined), 'real=' + real.length);
  ok('3.1f …and the five seeds are untouched and still demo',
     ARTICLES.filter(a => a.demo === true).length === 5);
  ok('3.1g …and not one of the five was converted to blocks',
     ARTICLES.filter(a => a.demo === true).every(a => a.blocks === undefined && Array.isArray(a.body.ar)));
}

/* ============================================================
   4) the figures draw in both languages, and every word is the pack's
   ============================================================ */
for (const lang of ['ar', 'en']) {
  const { ctx, p } = await fresh({ lang });
  await show(p, '#/magazine/r1');
  const pack = STRINGS[lang];
  const t1 = await p.locator('.fig-box svg text').allTextContents();
  ok('3.2 ' + lang + ' the timeline draws with the pack\'s own words',
     t1.includes(pack.figHcGap) && t1.includes(pack.figHcDroubi) && t1.includes(pack.figHcAnaheim),
     t1.length + ' texts');
  ok('3.2b ' + lang + ' …and the Western digits stay Western',
     t1.includes('1979') && t1.includes('2010') && !/[٠-٩]/.test(t1.join('')));
  await show(p, '#/magazine/r2');
  const t2 = await p.locator('.fig-box svg text').allTextContents();
  ok('3.2c ' + lang + ' the two bar figures draw',
     await p.locator('.fig-box svg').count() === 2 &&
     t2.includes(pack.figHoTitle) && t2.includes(pack.figUnTitle));
  ok('3.2d ' + lang + ' …and the census sliver keeps its real number',
     t2.includes('4,014') && t2.includes('~200,000'));
  /* ⚠️ THE TRAP THIS SUITE WAS WRITTEN AGAINST, and it bit while the
     batch was being built: `start` and `end` are the ends of the INLINE
     direction, not of the screen, so an anchor derived from the interface
     language pushed the value off the right edge of the drawing and laid
     the year column across its own axis — in Arabic alone. */
  const out = await p.evaluate(() => [...document.querySelectorAll('.fig-box svg')].flatMap(svg => {
    const w = svg.viewBox.baseVal.width;
    return [...svg.querySelectorAll('text')].map(t => { const b = t.getBBox();
      return (b.x < -0.5 || b.x + b.width > w + 0.5) ? t.textContent.slice(0, 24) : null; }).filter(Boolean);
  }));
  ok('3.3 ' + lang + ' no word is drawn outside the figure it belongs to',
     out.length === 0, out.join(' | ') || 'none');
  await ctx.close();
}

/* ============================================================
   5) the cover, and the icon branch that must survive it
   ============================================================ */
{
  const withCover = art('t4', [{ t: 'p', x: { ar: 'ن', en: 'n' } }], { cover: 'assets/logo.png' });
  const noCover   = art('t5', [{ t: 'p', x: { ar: 'ن', en: 'n' } }]);
  const { ctx, p } = await fresh({ articles: [withCover, noCover] });
  await show(p, '#/magazine');
  ok('4.1 the list card draws the cover as a picture',
     await p.locator('.mag-card[data-route="#/magazine/t4"] .mag-thumb img').count() === 1);
  ok('4.1b …and a card with no cover still draws its icon',
     await p.locator('.mag-card[data-route="#/magazine/t5"] .mag-thumb svg').count() === 1 &&
     await p.locator('.mag-card[data-route="#/magazine/t5"] .mag-thumb img').count() === 0);
  await show(p, '#/magazine/t4');
  ok('4.1c the hero draws the picture and marks itself',
     await p.locator('.article-hero.has-img img').count() === 1);
  /* ⚠️ GUARDED. An unguarded dereference here turns a failed 4.1c into a
     CRASH, and a crash loses every assertion after it — which is how a
     batch reports green while it is not. Measured: the tooth that removes
     the cover branch took the whole suite down at this line. */
  const cov = await p.evaluate(() => { const h = document.querySelector('.article-hero');
    const i = h && h.querySelector('img');
    if (!i) return { fit: 'NO IMG', w: -1, h: -1 };
    const r = h.getBoundingClientRect(), b = i.getBoundingClientRect();
    return { fit: getComputedStyle(i).objectFit, w: Math.round(b.width - r.width), h: Math.round(b.height - r.height) }; });
  ok('4.1d …and it fills the box rather than sitting in the grid centre',
     cov.fit === 'cover' && cov.w === 0 && cov.h === 0, JSON.stringify(cov));
  const grad = await p.evaluate(() => { const h = document.querySelector('.article-hero');
    const bk = document.querySelector('.back-btn');
    if (!h || !bk) return { content: 'NO HERO', z: '', backZ: '', backTop: -1 };
    const cs = getComputedStyle(h, '::before');
    return { content: cs.content, z: cs.zIndex, backZ: getComputedStyle(bk).zIndex,
             backTop: Math.round(bk.getBoundingClientRect().top - h.getBoundingClientRect().top) }; });
  ok('4.1e …and the gradient stands under the back button, which keeps its own 5',
     grad.z === '1' && grad.backZ === '5' && grad.backTop >= 0, JSON.stringify(grad));
  await show(p, '#/magazine/t5');
  ok('4.2 an article with no cover is what it was — an icon in a gradient',
     await p.locator('.article-hero img').count() === 0 &&
     await p.locator('.article-hero svg').count() >= 1 &&
     await p.locator('.article-hero.has-img').count() === 0);
  const noGrad = await p.evaluate(() => { const h = document.querySelector('.article-hero');
    return h ? getComputedStyle(h, '::before').content : 'NO HERO'; });
  ok('4.2b …and no gradient is laid over a gradient',
     noGrad === 'none' || noGrad === 'normal', String(noGrad));
  await ctx.close();
}
{
  /* the third place: the featured strip on Home.

     ⚠️ AND IT CANNOT BE MEASURED WITH A SEEDED FIXTURE, which is a finding
     rather than an obstacle: `home.js` builds that strip from `ARTICLES`
     directly and not from `allArticles()`, so nothing a device added ever
     reaches it. That is the sibling of `addArticle` being purely local,
     and it is written into `docs/الحالة.md` as an open fault rather than
     repaired here. So the cover is put on a REAL article at run time and
     the real render path is what is measured. */
  const { ctx, p } = await fresh({});
  await p.goto(BASE + '#/magazine', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  await p.evaluate(async () => {
    let d; try { d = await import('arabna/js/data.js'); } catch (e) { d = await import('./js/data.js'); }
    const a = d.ARTICLES.find(x => x.id === 'r1'); a.cover = 'assets/logo.png';
  });
  await show(p, '#/home');
  ok('4.1f the featured strip draws it too — the third of the three places',
     await p.locator('.story-card[data-route="#/magazine/r1"] .story-cover img').count() === 1);
  ok('4.1g …and a story with no cover keeps its icon there',
     await p.locator('.story-card[data-route="#/magazine/r2"] .story-cover svg').count() === 1 &&
     await p.locator('.story-card[data-route="#/magazine/r2"] .story-cover img').count() === 0);
  await ctx.close();
}

/* ============================================================
   6) ⚠️ the registry is closed, and a figure is never data
   ============================================================ */
{
  const fig = code('js/figures.js');
  const mag = code('js/screens/magazine.js');
  const data = code('js/data.js');
  ok('5.1 the drawings live in their own module and not in the magazine screen',
     /export const FIGURES/.test(fig) && !/<svg/.test(mag));
  ok('5.2 the article data carries a KEY and never a drawing',
     !/<svg/.test(data) && !/\bsvg\s*:/.test(data));
  ok('5.3 the renderer reaches the registry by key alone, and refuses an unknown one',
     /FIGURES\[b\.key\]/.test(mag) && /if\s*\(!draw\)\s*return\s*''/.test(mag));
  /* ⚠️ NOT a hand-written list of five tokens. The rule is «no NEW
     colour», and its measurement is that no literal colour value appears
     at all — a written list would go red the day the file's own §3.3 is
     followed and a sixth existing token is used. */
  const lits = (fig.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) || []);
  ok('5.4 not one colour literal in a drawing that has to work in both themes',
     lits.length === 0, lits.join(',') || 'none');
  ok('5.4b …and every colour it does use is a token already in the layer',
     (fig.match(/var\(--[a-z-]+\)/g) || []).every(v => /gold-bright|gold|surface-2|text-2|muted|line/.test(v)));
  const texts = fig.match(/<text[^>]*>/g) || [];
  ok('5.5 every `<text>` states its direction, or a Latin run inside an Arabic sentence reorders',
     texts.length > 0 && texts.every(x => /direction="/.test(x)), texts.length + ' text nodes');
  ok('5.6 not one word is written inside the SVG — every one comes from the pack',
     !/>[^<>{}]*[؀-ۿ][^<>]*</.test(fig.replace(/\/\*[\s\S]*?\*\//g, '')),
     'no Arabic literal in the markup');
  ok('5.7 the drawing imports the pack and nothing else',
     /^import \{ t \} from '\.\/i18n\.js';$/m.test(fig) &&
     (fig.match(/^import /gm) || []).length === 1);
}

/* ============================================================
   7) ⚠️ the guard on `src`, read in the code as well as on the screen
   ============================================================ */
{
  const mag = code('js/screens/magazine.js');
  ok('6.1 the guard admits two sources and no third',
     /includes\('\.\.'\)/.test(mag) && /startsWith\('assets\/'\)/.test(mag) &&
     /startsWith\(SUPABASE_URL/.test(mag));
  /* ⚠️ and the host is READ, never written twice: a second copy parts from
     the first the day the project moves. */
  ok('6.1b …and the host is imported, never typed into this screen',
     !/supabase\.co/.test(mag) && /from '\.\.\/supabase-config\.js'/.test(mag));
  ok('6.2 the cover goes through the same guard as a picture block',
     /function coverSrc\(a\)\s*\{\s*return safeImgSrc/.test(mag));
  /* ⚠️ the newcomer card carries a third `a.icon || 'newspaper'` of its
     own and has nothing to do with a cover, so the count is of the two
     COVER branches and not of the string. */
  const iconBranch = (mag.match(/icon\(a\.media === 'video' \? 'play' : \(a\.icon \|\| 'newspaper'\)/g) || []);
  ok('6.3 the icon branch is not deleted and not replaced',
     iconBranch.length === 2, iconBranch.length + ' of 2');
  ok('6.4 `body` is untouched — an article with no blocks still takes the old line',
     /L\(a\.body\) \|\| \[\]\)\.map\(p => `<p>\$\{esc\(p\)\}<\/p>`\)/.test(mag) &&
     /a\.blocks\s*\n?\s*\?\s*a\.blocks\.map\(blockHtml\)/.test(mag));
}

/* ============================================================
   8) the stylesheet — the rules that break silently
   ============================================================ */
{
  /* ⚠️ AND THE COMMENTS GO FIRST. This batch's own comments name
     `border-right` and `z-index` while explaining why neither is written —
     so a check reading the raw file reports the fault it exists to
     prevent. The rule this project has now paid for six times. */
  const css = read('styles/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  /* anchored on RULES and not on a comment marker, because the comments
     have just been stripped — and a slice that anchors on prose is a
     slice that empties the day the prose is edited. */
  const block = css.slice(css.indexOf('.blk-h'), css.indexOf('.detail-hero'));
  ok('7.1 the block is really in the stylesheet', block.length > 600, block.length + ' chars');
  const px = block.match(/font-size:\s*[\d.]+px/g) || [];
  /* ⚠️ the root is 106.25% — seventeen pixels — so a px size is 6.25%
     wrong on arrival and then refuses to grow for the first reader who
     enlarges their type. */
  ok('7.2 not one font size in pixels', px.length === 0, px.join(',') || 'none');
  ok('7.3 the pull-quote rule is logical, so it lands on the right side of an English screen',
     /\.blk-q\s*\{[^}]*border-inline-start/.test(block) && !/border-right/.test(block));
  ok('7.4 the list dot sits on the first line, not between two of them',
     /\.blk-ul li::before\s*\{[^}]*top:\s*\.85em/.test(block));
  ok('7.5 the gradient is drawn ONLY where there is a picture under it',
     /\.article-hero\.has-img::before/.test(block) && !/\.article-hero::before/.test(block));
  /* ⚠️ no `z-index` is written for the button here: it already carries 5,
     and a number written now would LOWER it rather than raise it. */
  const heroBlock = block.slice(block.indexOf('.article-hero.has-img::before'));
  ok('7.6 and no z-index is written for the back button',
     !/\.back-btn[^}]*z-index/.test(heroBlock));
}

/* ============================================================
   10) 685 — the street in English, the text unvocalised, and a
       compound Latin run that survives the paragraph it sits in
   ------------------------------------------------------------
   ⚠️ 10.4 IS THE ONE THAT COULD NOT BE WRITTEN AS A TEXT SEARCH, and
   that is the whole finding of the batch. `textContent` holds `24-a`
   in logical order WHATEVER the bidi algorithm does to it, so a check
   reading the string is green while the reader sees `a-24`. What is
   measured here is the GLYPH: the box of `24` against the box of `a`.
   ============================================================ */
{
  const HARAKAT = /[ً-ْٰ]/g;
  const nH = t => (t.match(HARAKAT) || []).length;

  const dataSrc = read('js/data.js');
  const L = dataSrc.split('\n');
  const a = L.findIndex(l => /id: 'r1'/.test(l)) - 1;
  const b = L.findIndex((l, i) => i > a && /^\]\);/.test(l));
  const arts = L.slice(a, b).join('\n');
  const rest = L.slice(0, a).concat(L.slice(b)).join('\n');

  ok('10.1 not one vowel mark left in the two real articles', nH(arts) === 0, nH(arts) + ' left');
  const FIG = Object.keys(STRINGS.ar).filter(k => /^fig/.test(k));
  const figH = FIG.reduce((n, k) => n + nH(STRINGS.ar[k]), 0);
  ok('10.2 …nor in the sixteen figure keys of the Arabic pack',
     FIG.length === 16 && figH === 0, FIG.length + ' keys, ' + figH + ' marks');

  ok('10.3 the street is written in English inside the Arabic text',
     !/هيلكروفت/.test(arts) && /Hillcroft/.test(arts),
     (arts.match(/Hillcroft/g) || []).length + '× Hillcroft');

  /* ⚠️ the thirty-one business descriptions are NOT in this batch's scope
     — a separate decision of the owner's — so they are asserted UNCHANGED
     rather than left unmeasured: a silent drift either way is the fault. */
  ok('10.3b …and the thirty-one business descriptions are untouched',
     (rest.match(/هيلكروفت/g) || []).length === 31,
     (rest.match(/هيلكروفت/g) || []).length + ' of 31');

  const { ctx, p } = await fresh({});
  await show(p, '#/magazine/r2');
  const runs = await p.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.querySelector('.article-body') || document.body,
                                        NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const i = n.textContent.indexOf('24-a');
      if (i < 0) continue;
      const box = (from, to) => { const r = document.createRange();
        r.setStart(n, from); r.setEnd(n, to); return r.getBoundingClientRect(); };
      out.push({ num: box(i, i + 2).left, letter: box(i + 3, i + 4).left });
    }
    return out;
  });
  ok('10.4 «24-a» is DRAWN in that order, not flipped to «a-24»',
     runs.length === 2 && runs.every(r => r.num < r.letter),
     runs.map(r => `24@${Math.round(r.num)} a@${Math.round(r.letter)}`).join(' · ') || 'no run found');
  await ctx.close();

  /* ⚠️ 10.5 guards the GUARD: the full net of 11 September caught the city
     and never once caught the street, because that list held cities alone. */
  const v26 = read('tools/e2e/test_v26.mjs');
  ok('10.5 the i18n guard knows the street, in both spellings',
     /STREET_AR\s*=\s*\[[^\]]*هيلكروفت[^\]]*هيلكرفت/.test(v26)
     && /CITY_AR\.concat\(STREET_AR\)/.test(v26));
  ok('10.5b …and it is not forced onto the business half, which has 31 honest uses',
     !/ok\('2\.1[\s\S]{0,400}STREET_AR/.test(v26));

  /* ⚠️ 10.6 IS THE GUARD OF THE WHOLE BATCH, not a footnote: the newcomer
     guide is a text the owner approved word by word, and a sweep that
     removes vowel marks is exactly the shape that would flatten it. */
  ok('10.6 the newcomer guide is untouched — every one of its marks still there',
     nH(read('tools/nc/nc-ar.json')) === 1689, nH(read('tools/nc/nc-ar.json')) + ' of 1689');
  ok('10.7 …and the rest of data.js did not move either',
     nH(rest) === 88, nH(rest) + ' of 88');
}

/* ============================================================
   11) 690 — THE THREE PHOTOGRAPHS, AND WHAT STILL HAS NONE
   ------------------------------------------------------------
   ⚠️ Block 4 above measures the cover machinery against a FIXTURE. This
   one measures the real files on the real records, which is a different
   question: `675` shipped the machinery with nothing behind it on
   purpose, so until today every one of those items could have been green
   over a magazine with no picture in it anywhere.

   ⚠️ AND NOTHING HERE IS ASSERTED ON A FILENAME. The single-file build
   inlines every image as a base64 `data:` URI — the V.04.7 lesson, paid
   for by `s v40` — so what is true of BOTH builds is the picture's own
   1200px, read off `naturalWidth` after it has decoded. A check on the
   `src` string would pass on one build and fail on the other.
   ============================================================ */
{
  const PIX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

  /* --- the files themselves, read from the bytes and never from the name --- */
  const jpegSize = (buf) => {           /* SOFn is the only frame that carries it */
    let i = 2;
    while (i < buf.length - 1) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      if (m === 0xD8 || m === 0xD9) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { w: 0, h: 0 };
  };
  const want = { 'hillcroft-droubis-cover.jpg': '1200x500',
                 'hillcroft-grocery.jpg': '1200x800',
                 'houston-acc.jpg': '1200x800' };
  const got = {};
  for (const f of Object.keys(want)) {
    try { const b = readFileSync(ROOT + 'assets/mag/' + f);
          const d = jpegSize(b); got[f] = d.w + 'x' + d.h; }
    catch (e) { got[f] = 'MISSING'; }
  }
  ok('11.1 the three photographs are in the repository at the sizes they were given',
     Object.keys(want).every(f => got[f] === want[f]), JSON.stringify(got));

  /* --- the records --- */
  const r1 = ARTICLES.find(a => a.id === 'r1');
  const r2 = ARTICLES.find(a => a.id === 'r2');
  ok('11.2 `r1` carries the cover, as a path this app will accept',
     r1.cover === 'assets/mag/hillcroft-droubis-cover.jpg' && !r1.cover.includes('..'),
     String(r1.cover));
  /* ⚠️ `r2` HAS NO COVER, AND THAT IS AN ASSERTION RATHER THAN A GAP: the
     photograph does not exist, and 675's rule is that a place with nothing
     in it shows the reader nothing at all. A stub would be the broken box. */
  ok('11.2b …and `r2` has none, so nothing was stubbed in to fill the hole',
     r2.cover === undefined, String(r2.cover));
  const imgs = a => a.blocks.filter(b => b.t === 'img');
  ok('11.2c one picture block in each article, and both point into assets/mag',
     imgs(r1).length === 1 && imgs(r2).length === 1 &&
     imgs(r1)[0].src === 'assets/mag/hillcroft-grocery.jpg' &&
     imgs(r2)[0].src === 'assets/mag/houston-acc.jpg',
     imgs(r1).length + ' + ' + imgs(r2).length);
  /* ⚠️ AND EACH SITS AFTER THE PARAGRAPH THAT EXPLAINS IT, never after the
     heading above it: a photograph placed before the line that identifies
     it is a picture the reader cannot place. */
  const after = (a) => { const i = a.blocks.findIndex(b => b.t === 'img');
    return { prev: a.blocks[i - 1] && a.blocks[i - 1].t, next: a.blocks[i + 1] && a.blocks[i + 1].t }; };
  ok('11.2d …after the paragraph, and before the heading that follows it',
     after(r1).prev === 'p' && after(r1).next === 'h' &&
     after(r2).prev === 'p' && after(r2).next === 'h',
     JSON.stringify([after(r1), after(r2)]));
  /* the caption follows the prose it stands in: 685 took every vowel mark
     out of these two articles, and a caption written with them would be
     the one line on the screen wearing them */
  const nHere = t => (t.match(/[ً-ْٰ]/g) || []).length;
  ok('11.2e …and the captions carry no vowel mark and no Latin-run to flip',
     nHere(JSON.stringify(imgs(r1).concat(imgs(r2)))) === 0);

  /* --- what the reader is actually shown, on either build --- */
  const { ctx, p } = await fresh({});
  await show(p, '#/magazine/r1');
  const hero = await p.evaluate(async () => {
    const i = document.querySelector('.article-hero img');
    if (!i) return { there: false };
    if (!i.complete) await i.decode().catch(() => {});
    return { there: true, nat: i.naturalWidth + 'x' + i.naturalHeight,
             marked: !!document.querySelector('.article-hero.has-img'),
             icon: document.querySelectorAll('.article-hero svg').length };
  });
  ok('11.3 the real cover is drawn on the article, and it is the real file',
     hero.there && hero.nat === '1200x500' && hero.marked, JSON.stringify(hero));

  const fig = await p.evaluate(async () => {
    const f = document.querySelector('.article-body figure.blk-img');
    if (!f) return { there: false };
    const i = f.querySelector('img');
    if (!i.complete) await i.decode().catch(() => {});
    return { there: true, nat: i.naturalWidth + 'x' + i.naturalHeight,
             lazy: i.getAttribute('loading'), alt: (i.getAttribute('alt') || '').length,
             cap: (f.querySelector('.cap') || {}).textContent || '',
             credit: (f.querySelector('.credit') || {}).textContent || '',
             wide: Math.round(i.getBoundingClientRect().width) };
  });
  /* ⚠️ 695 REVERSED THE CAPTION HALF OF THIS, and the reversal is named
     rather than the line softened: `690` wrote «the prices are written in
     Arabic» and the signs in the picture read BANANA $0.69/LB, so the
     owner's decision of 12 September deleted the caption and left the credit
     alone. What this item was ever about — the picture DRAWS, at its real
     size and its real width, with its credit under it — is unchanged and
     still asserted; that there is no caption text is block 13's own item,
     where it can be measured rather than assumed. */
  ok('11.4 the picture inside the article draws, at its real size, with its credit',
     fig.there && fig.nat === '1200x800'
     && fig.credit === 'تصوير: عربنا' && fig.wide > 300, JSON.stringify(fig).slice(0, 200));
  /* ⚠️ 3.3 of the spec, and it is asserted on the pictures the BLOCKS draw.
     Measured on the covers, deliberately not changed and written down so it
     is not read as an oversight: the card thumb and the hero carry `alt=""`
     because the title is printed beside them in both places — an empty alt
     is the right answer for an image whose meaning is in the adjacent text,
     not a lapse — and the hero carries no `loading="lazy"` because it is the
     first thing on the screen, and deferring the largest paint is a
     regression rather than a fix. */
  ok('11.4b …and it is lazy, and its alt is not empty',
     fig.lazy === 'lazy' && fig.alt > 10, fig.lazy + ' / alt ' + fig.alt);

  await show(p, '#/magazine/r2');
  const two = await p.evaluate(async () => {
    const i = document.querySelector('.article-body figure.blk-img img');
    if (i && !i.complete) await i.decode().catch(() => {});
    return { fig: i ? i.naturalWidth + 'x' + i.naturalHeight : 'none',
             cap: (document.querySelector('.blk-img .cap') || {}).textContent || '',
             heroImg: document.querySelectorAll('.article-hero img').length,
             heroIcon: document.querySelectorAll('.article-hero svg').length,
             marked: document.querySelectorAll('.article-hero.has-img').length };
  });
  ok('11.5 the second article draws its picture, and names the place in the caption',
     two.fig === '1200x800' && two.cap.includes('المركز الثقافي العربي'), JSON.stringify(two).slice(0, 160));
  /* the compatibility item: r2 opens exactly as it did before this batch */
  ok('11.5b …and with no cover it opens on the icon, marked as it always was',
     two.heroImg === 0 && two.heroIcon >= 1 && two.marked === 0, JSON.stringify(two).slice(0, 160));

  await show(p, '#/magazine');
  const cards = await p.evaluate(async () => {
    const out = [];
    for (const c of document.querySelectorAll('.mag-card')) {
      const i = c.querySelector('.mag-thumb img');
      if (i && !i.complete) await i.decode().catch(() => {});
      out.push([c.getAttribute('data-route'), i ? i.naturalWidth : 0]);
    }
    return out;
  });
  ok('11.6 the list card draws it too, and the one with no cover keeps its icon',
     cards.some(c => c[0] === '#/magazine/r1' && c[1] === 1200) &&
     cards.some(c => c[0] === '#/magazine/r2' && c[1] === 0), JSON.stringify(cards));

  await show(p, '#/home');
  const strip = await p.evaluate(async () => {
    const out = [];
    for (const s of document.querySelectorAll('.story-cover')) {
      const i = s.querySelector('img');
      if (i && !i.complete) await i.decode().catch(() => {});
      out.push(i ? i.naturalWidth : 0);
    }
    return out;
  });
  ok('11.6b …and so does the third place, the strip on Home',
     strip.includes(1200), JSON.stringify(strip));
  await ctx.close();
}

/* ------------------------------------------------------------
   ⚠️ THE GUARD, WIDENED BY EXACTLY ONE SHAPE — and measured in the page
   rather than in Node, because what runs on the single-file build is the
   INLINED copy of the module and that is the build the widening was for.
   ------------------------------------------------------------ */
{
  const PIX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
  const SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
  const cases = [
    ['g1', PIX,                                        1, 'a base64 raster, which is what our own build emits'],
    ['g2', SVG,                                        0, 'svg+xml — the one image type that carries markup'],
    ['g3', 'data:text/html;base64,PGgxPmhpPC9oMT4=',   0, 'not an image at all'],
    ['g4', 'http://127.0.0.1:1/evil.jpg',              0, 'an origin we did not choose'],
    ['g5', 'assets/../../etc/passwd',                  0, 'a walk out of assets/'],
  ];
  const { ctx, p } = await fresh({ articles: cases.map(([id, src]) =>
    art(id, [{ t: 'img', src, cap: { ar: 'ك', en: 'c' } }], { cover: src })) });
  const seen = [];
  for (const [id, , want, why] of cases) {
    await show(p, '#/magazine/' + id);
    const n = await p.evaluate(() => document.querySelectorAll('.article-hero img, .blk-img img').length);
    seen.push([id, n, want, why]);
  }
  ok('11.7 the guard takes the inlined form of our own file, and nothing else',
     seen.every(([, n, want]) => (want ? n === 2 : n === 0)),
     seen.map(([id, n, w, why]) => `${id}:${n}(want ${w ? 2 : 0}) ${why}`).join(' · '));
  await ctx.close();
}

/* ------------------------------------------------------------
   12) THE PICTURES ARE NOT IN THE INSTALL, AND THAT IS THE GUARD
   ⚠️ `tools/build_sw.py` excludes `assets/` on purpose (420: downloading
   four megabytes of somebody's mobile data before they ask is not caching)
   and the day a batch «fixes» that, a phone pays for three photographs it
   may never open. This is what stops it happening quietly.
   ------------------------------------------------------------ */
{
  const man = read('js/sw-manifest.js');
  ok('12.1 not one magazine photograph is in the precache list',
     !/assets\/mag/.test(man), (man.match(/assets\/mag/g) || []).length + ' matches');
  const files = (man.match(/^\s*'[^']+',/gm) || []).length;
  /* the number is a NUMBER on purpose: it moves with a decision, and a
     file walking into the install turns this red before anybody ships it */
  ok('12.2 …and the list is the 38 files it was, no heavier for this batch',
     files === 38, files + ' files');
  ok('12.3 …and the builder still excludes assets/ rather than listing them one by one',
     /assets/.test(code('tools/build_sw.py')));
}

/* ------------------------------------------------------------
   13) 695 — A CAPTION SAYS WHAT IS IN THE PICTURE, AND `alt` IS ITS OWN FIELD
   ⚠️ The first half of this cannot be a check and the file says so: an
   assertion can prove a caption is DRAWN and that it passes `esc()`; it
   cannot prove it is TRUE. `690` wrote that the grocery's prices «are
   written in Arabic» and the signs in that very file read
   BANANA $0.69/LB — read with the eye, on the picture, which is the only
   place that answer lives. What IS assertable is the decision that
   followed: the caption is gone, the credit stands alone, and the
   picture did not lose its description with it.
   ------------------------------------------------------------ */
{
  const { ctx, p } = await fresh({});
  await show(p, '#/magazine/r1');
  /* ⚠️ the figure is found by POSITION, never by its `src`: on the
     single-file build every asset is an inlined base64 URI, so a selector
     reading the filename matches nothing there and reports a fault on a
     build that is right. `r1` carries exactly one picture block, and the
     count is asserted rather than assumed. */
  const groc = await p.evaluate(() => {
    const all = document.querySelectorAll('.article-body figure.blk-img');
    const f = all[0];
    if (!f || all.length !== 1) return null;
    const cap = f.querySelector('.cap');
    const cr  = cap && cap.querySelector('.credit');
    const clone = cap && cap.cloneNode(true);
    if (clone && clone.querySelector('.credit')) clone.querySelector('.credit').remove();
    return { alt: f.querySelector('img').getAttribute('alt') || '',
             credit: cr ? cr.textContent.trim() : '',
             words: clone ? clone.textContent.trim() : null };
  });
  ok('13.1 the grocery picture carries no caption text — the credit line alone',
     !!groc && groc.words === '' && groc.credit.length > 0,
     JSON.stringify(groc && { words: groc.words, credit: groc.credit }));
  /* ⚠️ the item that WOULD have broken: deleting `cap` while `alt` read
     from it leaves a blind reader hearing «image» and nothing after it */
  ok('13.2 …and its `alt` is not empty', !!groc && groc.alt.length > 20,
     groc ? groc.alt.length + ' chars: ' + groc.alt : 'no figure');
  ok('13.3 …and `alt` is not the credit line filling the gap',
     !!groc && groc.alt !== groc.credit && !/عربنا|ARABNA/.test(groc.alt),
     groc ? groc.alt : '');

  /* the second picture: its caption was read against its picture today and
     stands, and `alt` is added BESIDE it rather than repeating it */
  await show(p, '#/magazine/r2');
  const seedCap = (() => {
    const a = ARTICLES.find(x => x.id === 'r2');
    const b = (a.blocks || []).find(x => x.t === 'img' && /houston-acc/.test(x.src || ''));
    return b ? b.cap.ar : null;
  })();
  const acc = await p.evaluate(() => {
    const all = document.querySelectorAll('.article-body figure.blk-img');
    const f = all[0];
    if (!f || all.length !== 1) return null;
    const clone = f.querySelector('.cap').cloneNode(true);
    if (clone.querySelector('.credit')) clone.querySelector('.credit').remove();
    return { words: clone.textContent.trim(), alt: f.querySelector('img').getAttribute('alt') || '' };
  });
  ok('13.4 the centre picture keeps its caption, letter for letter',
     !!acc && !!seedCap && acc.words === seedCap, acc ? acc.words : 'no figure');
  ok('13.5 …and its `alt` is a description, not that same sentence',
     !!acc && acc.alt.length > 20 && acc.alt !== acc.words, acc ? acc.alt : '');

  /* ⚠️ 2.2 in the file, and it is an ITEM rather than an omission: a cover
     is decoration beside a written headline, and repeating it in a blind
     reader's ear is noise, not service. ZERO change is what is asserted. */
  /* ⚠️ the hero is read on `r1` and not on `r2`: `r2` carries no cover at
     all (690 held four photographs back), so measuring it there would ask
     an element that does not exist and report `null` for a build that is
     perfectly right. */
  await show(p, '#/magazine/r1');
  const heroAlt = await p.evaluate(() => {
    const i = document.querySelector('.article-hero img');
    return i ? i.getAttribute('alt') : null;
  });
  await show(p, '#/magazine');
  const cardAlt = await p.evaluate(() => {
    const i = document.querySelector('.mag-thumb img');
    return i ? i.getAttribute('alt') : null;
  });
  await show(p, '#/home');
  const stripAlt = await p.evaluate(() => {
    const i = document.querySelector('.story-cover img');
    return i ? i.getAttribute('alt') : null;
  });
  ok('13.6 the three covers stay `alt=""` — hero, list card, strip on Home',
     heroAlt === '' && cardAlt === '' && stripAlt === '',
     JSON.stringify({ hero: heroAlt, card: cardAlt, strip: stripAlt }));
  await ctx.close();
}

/* the fall back, and the escaping — both on fixtures, never on the data:
   a block written today may carry no `alt`, and it must not lose its
   description for that */
{
  const nasty = 'x" onload="1 <b>bold</b>';
  const { ctx, p } = await fresh({ articles: [
    art('k1', [{ t: 'img', src: 'assets/logo.png', cap: { ar: 'تعليقٌ وحده', en: 'cap only' } }]),
    art('k2', [{ t: 'img', src: 'assets/logo.png', alt: { ar: nasty, en: nasty } }]),
  ] });
  await show(p, '#/magazine/k1');
  const fell = await p.evaluate(() => {
    const i = document.querySelector('.blk-img img');
    return i ? i.getAttribute('alt') : null;
  });
  ok('13.7 a block with no `alt` falls back to its caption', fell === 'تعليقٌ وحده', String(fell));

  await show(p, '#/magazine/k2');
  const esced = await p.evaluate(() => {
    const i = document.querySelector('.blk-img img');
    return { alt: i ? i.getAttribute('alt') : null,
             injected: document.querySelectorAll('.blk-img b').length };
  });
  ok('13.8 `alt` goes through esc() — a quote and a tag survive as text',
     esced.alt === nasty && esced.injected === 0, JSON.stringify(esced));
  await ctx.close();
}

/* ⚠️ and the structural half, because a behavioural check cannot see the
   two fields being merged again by a later hand */
{
  const mag = code('js/screens/magazine.js');
  ok('13.9 the markup reads `alt`, never the caption',
     /alt="\$\{alt\}"/.test(mag) && !/alt="\$\{cap\}"/.test(mag));
  ok('13.10 …and `alt` is built from b.alt first, with esc() around it',
     /const alt = esc\(L\(b\.alt \|\| b\.cap \|\| ''\)\)/.test(mag));
}

ok('9.1 zero console errors across everything above', errors.length === 0,
   errors.slice(0, 3).join(' | ') || 'none');

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
