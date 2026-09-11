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
  ok('3.1b …and they are the two real ones',
     titles.some(t => t.includes('هيلكروفت')) && titles.some(t => t.includes('ليش هيوستن')),
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

ok('9.1 zero console errors across everything above', errors.length === 0,
   errors.slice(0, 3).join(' | ') || 'none');

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
