/* V.08.6 — the advertise page described a place that was not the place,
   and a second that was not the second.

   ⚠️ `#/advertise` is the one screen where we describe our product to
   somebody about to pay, and a wrong description there is a promise sold
   and not kept — `337`'s rule.

   Measured on Home at 390 before this batch: the categories row ends at
   367 and the mini banner sits at 892 — 525px apart, more than a screen,
   140px under the fold — while the copy said «تحت التصنيفات مباشرة». The
   copy said «every 7 seconds» while Home rotated it every 16: the 7 was
   `mountAdRotator`'s default, written into the text the day the call still
   took it. And the phone wireframe was inverted in two products.

   THE RULE: whatever this page says about a place or a time is READ from
   the app and never written in a text that can part from it.

   ⚠️ Nothing here is a written number. The rotation times are imported
   from `js/data.js` — the same constants Home rotates by — and the pixel
   positions are read from the screen. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

/* the constants Home rotates by — read from the source, so a change there
   is a change here with no second copy */
const data = readFileSync(ROOT + 'js/data.js', 'utf8');
const num = (k) => Number(new RegExp(k + '\\s*=\\s*(\\d+)').exec(data)[1]);
const AD_S = num('AD_ROTATE_MS') / 1000, MINI_S = num('MINI_ROTATE_MS') / 1000;

const browser = await chromium.launch();
async function open(route, lang = 'ar', extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(({ l, extra }) => {
    const K = 'arabna.v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    Object.assign(s, { lang: l, showDemo: true, demoDefaultOff: true,
      user: { email: 'a@b.c', emailVerified: true, tier: 1, name: 'x' } }, extra);
    localStorage.setItem(K, JSON.stringify(s));
  }, { l: lang, extra });
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  return { page, ctx };
}
/* the OPEN package's own block: the card whose button is aria-expanded */
const readPkg = (page, prod) => page.evaluate((prod) => {
  const btn = document.querySelector(`.price-card[data-p="${prod}"][aria-expanded="true"]`);
  const card = btn && btn.closest('.ad-more') ? btn.closest('.ad-more') : btn && btn.parentElement;
  const inner = card && (card.querySelector('.ad-more-inner') || card);
  if (!inner) return null;
  const ph = inner.querySelector('.ph');
  return {
    rows: ph ? [...ph.children].map(e => e.className.replace('ph-row', '').trim()) : [],
    pts: [...inner.querySelectorAll('.ad-points li')].map(li => li.innerText.trim()),
    where: (inner.querySelector('.ad-where') || {}).innerText || '',
    desc: (inner.querySelector('.price-desc, .pkg-desc') || {}).innerText || '',
    all: inner.innerText,
  };
}, prod);

/* ============ 1 — the two places, read from the screen ============ */
let homeBefore;
{
  const { page, ctx } = await open('#/home');
  homeBefore = await page.evaluate(() => {
    const main = document.querySelector('.app-main'); const m = main.getBoundingClientRect();
    const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect();
      return { y: Math.round(r.top - m.top + main.scrollTop), end: Math.round(r.bottom - m.top + main.scrollTop) }; };
    return { cats: box('.cat-row'), slider: box('.slider'), mini: box('.mini-ad'), vh: Math.round(m.height) };
  });
  const gap = homeBefore.mini.y - homeBefore.cats.end;
  /* ⚠️ WHAT IS TRUE, NOT WHAT THE FILE'S TEST LINE SAID. `505`'s §0 measured
     the gap at 525px — «more than half a screen» — and the mini banner «140
     below the fold»; its test item then asked for «more than a whole
     screen», which the same numbers refute (525 against a 752 content
     height). The measurement wins: the banner is BELOW THE FOLD, and the
     gap is more than half the screen — either alone makes «directly under
     the categories» false. */
  ok('1.1 on Home the mini banner is below the fold, more than half a screen under the categories',
     homeBefore.mini.y > homeBefore.vh && gap > homeBefore.vh / 2,
     `categories end ${homeBefore.cats.end} · mini at ${homeBefore.mini.y} · gap ${gap} · content height ${homeBefore.vh}`);
  ok('1.2 …and the slider starts where the categories end', homeBefore.slider.y === homeBefore.cats.end,
     `${homeBefore.slider.y} / ${homeBefore.cats.end}`);
  await ctx.close();
}

/* ============ 2–5 — the copy, both languages ============ */
for (const lang of ['ar', 'en']) {
  const { page, ctx } = await open('#/advertise/mini', lang);
  const mini = await readPkg(page, 'mini');
  const pageText = await page.evaluate(() => document.querySelector('#app').innerText);
  ok(`2.1 [${lang}] nothing on the page says the mini banner is under the categories`,
     !/تحت التصنيفات|تحت الفئات|under the categories|below categories/i.test(pageText));
  ok(`3.1 [${lang}] no «مباشرة» / «directly» in the mini banner's copy`,
     !!mini && !/مباشرة|directly/i.test(mini.all), mini ? mini.where : 'no open package');
  ok(`4.1 [${lang}] the mini banner's place names the Offers section`,
     !!mini && /قسم العروض|Offers section/.test(mini.where), mini ? mini.where : '—');
  /* ⚠️ THE NUMBER ON SCREEN IS COMPARED WITH THE CONSTANT, never with a
     figure typed here. */
  const rot = mini && mini.pts.find(p => /يتناوب|Rotates/.test(p));
  ok(`5.1 [${lang}] the mini rotation on screen equals MINI_ROTATE_MS`,
     !!rot && new RegExp('\\b' + MINI_S + '\\b').test(rot), String(rot));
  /* ⚠️ 6/7 — THE MAGAZINE PLACEMENT IS NOT MENTIONED, and this is the
     half that can be measured today. `505` gates it on `sectionOpen`,
     which `365` builds — and `365` has not landed (the queue put `505`
     ahead of it by the owner's decision). Without the gate, naming the
     magazine while it holds no real article is the very promise this
     batch exists to stop, so the safe half is asserted: silence. When
     `365` lands, its own suite asserts the open/closed pair. */
  ok(`7.1 [${lang}] the magazine placement is not promised while nothing gates it`,
     !!mini && !/المجلة|magazine/i.test(mini.where + ' ' + mini.pts.join(' ')), mini ? mini.where : '—');
  /* ============ 9 — the mini wireframe: lit row LAST ============ */
  const rows = mini ? mini.rows.filter(r => r !== 'ph-nav') : [];
  ok(`9.1 [${lang}] in the mini wireframe the lit row is the last row`,
     rows.length > 0 && rows[rows.length - 1] === 'ph-ad' && rows.indexOf('ph-cats') < rows.indexOf('ph-ad'),
     rows.join(' > '));
  await ctx.close();

  const s = await open('#/advertise/slider', lang);
  const sl = await readPkg(s.page, 'slider');
  const rotS = sl && sl.pts.find(p => /يتناوب|Rotates/.test(p));
  ok(`5.2 [${lang}] the slider rotation on screen equals AD_ROTATE_MS`,
     !!rotS && new RegExp('\\b' + AD_S + '\\b').test(rotS), String(rotS));
  ok(`5.3 [${lang}] the slider's first point no longer claims «first thing everyone sees»`,
     !!sl && !/أول ما يراه|first thing/i.test(sl.pts[0] || ''), sl ? sl.pts[0] : '—');
  /* ============ 8 — the slider wireframe: categories BEFORE the lit row ============ */
  const rs = sl ? sl.rows.filter(r => r !== 'ph-nav') : [];
  ok(`8.1 [${lang}] in the slider wireframe the categories row comes before the lit row`,
     rs.includes('ph-cats') && rs.includes('ph-ad') && rs.indexOf('ph-cats') < rs.indexOf('ph-ad'), rs.join(' > '));
  await s.ctx.close();
}

/* ============ 10 — no placement moved ============ */
/* ⚠️ «Before» cannot be a frozen number here. What «did not move» means
   structurally is the order and the seams: the slider still starts on the
   categories' last pixel, and the mini banner is still under the slider. */
{
  const { page, ctx } = await open('#/home');
  const after = await page.evaluate(() => {
    const main = document.querySelector('.app-main'); const m = main.getBoundingClientRect();
    const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { y: Math.round(r.top - m.top + main.scrollTop), end: Math.round(r.bottom - m.top + main.scrollTop) }; };
    return { cats: box('.cat-row'), slider: box('.slider'), mini: box('.mini-ad') };
  });
  ok('10.1 the slider and the mini banner stand where they stood',
     after.slider.y === homeBefore.slider.y && after.mini.y === homeBefore.mini.y && after.slider.y === after.cats.end && after.mini.y > after.slider.end,
     `slider ${after.slider.y} · mini ${after.mini.y}`);
  await ctx.close();
}

/* ============ the source: no written rotation number in the copy ============ */
{
  const i18n = readFileSync(ROOT + 'js/i18n.js', 'utf8');
  ok('5.4 no rotation number is written in the packs — {n} everywhere',
     !/\b(7|10|16)\s*(ثوانٍ|ثانية|seconds)\b/.test(i18n) && /كل \{n\}/.test(i18n) && /every \{n\}/.test(i18n));
  const home = readFileSync(ROOT + 'js/screens/home.js', 'utf8');
  ok('5.5 Home rotates by the same constants the page reads',
     /interval: AD_ROTATE_MS/.test(home) && /interval: MINI_ROTATE_MS/.test(home) && !/interval: \d+/.test(home));
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
