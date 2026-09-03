/* V.04.7 — batch nine (ج): the visual identity, and the link when it is sent.

   Ten items, and the three that could silently rot are the ones measured
   hardest here:

   · the verified badge became a MARK in lists and a mark-and-word on the
     business page. The measurement that drove it: a name row carrying the
     pill was 60px against 28 — two lines where there was one — so the
     assertion is the row height on «مطبخ ومخبز سامي اللبناني», the
     longest Arabic name in the file, and not the presence of an element.

   · «TX» returned all 514 listings, because every address in the file ends
     «TX 77xxx». It is the «عربية» and «لحوم» trap, and the answer is the
     same: the word leaves the search. The CODE is answered with a
     suggestion alone; the NAME «Texas» is in 38 real shop names, so those
     stand with the suggestion above them.

   · the share marks sit INSIDE rows that navigate, so the test taps one
     and asserts the hash did not move. A share button that opens the
     advertiser instead is worse than no share button.

   Covers items 4 (the mark in the header), 6 (the rotating hint), 7 (the
   visitor headline), 8 (og tags, the ad share marks, the drawer row),
   9 (the badge) and 10 (the state, the chip, bidi). Items 1, 2, 3 and 5
   are measured by v37 and by the earlier commit's own probes. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { withDemoData } from './_demo.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const errors = [];
let ctx, page;

const asReader = async (state = {}, opts = {}) => {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({
    colorScheme: opts.theme === 'light' ? 'light' : 'dark',
    viewport: { width: 390, height: 844 },
  });
  await ctx.addInitScript(s => {
    localStorage.setItem('arabna.v1', JSON.stringify(s));
    Object.defineProperty(navigator, 'clipboard', { configurable: true,
      value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } });
  }, state);
  page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|ERR_ABORTED|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
};
const at = async (h) => { await page.goto(BASE + h, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200); };

/* ---------------- 1 · the share meta, and the image ---------------- */
console.log('--- 1 · the link when it is sent ---');
await asReader({});
await at('#/home');
const meta = await page.evaluate(() => {
  const g = (sel) => { const m = document.querySelector(sel); return m ? m.content : null; };
  return {
    title: g('meta[property="og:title"]'),
    desc: g('meta[property="og:description"]'),
    image: g('meta[property="og:image"]'),
    url: g('meta[property="og:url"]'),
    type: g('meta[property="og:type"]'),
    locale: g('meta[property="og:locale"]'),
    card: g('meta[name="twitter:card"]'),
  };
});
ok('1.1 og:title', meta.title === 'عربنا · ARABNA', meta.title);
ok('1.2 og:description names the sections', /مطاعم/.test(meta.desc || '') && /مواقيت الصلاة/.test(meta.desc || ''));
/* ⚠️ ABSOLUTE, not relative: the scraper fetches it from its own server,
   where a relative path resolves to nothing at all. */
ok('1.3 og:image is absolute', /^https:\/\/.+\/assets\/share-1200x630\.png$/.test(meta.image || ''), meta.image);
ok('1.4 og:url is absolute', /^https:\/\//.test(meta.url || ''), meta.url);
ok('1.5 og:type + locale', meta.type === 'website' && meta.locale === 'ar_AR');
ok('1.6 twitter:card is the large one', meta.card === 'summary_large_image');

/* the image is a real 1200×630 file and not a promise in a meta tag */
const img = await page.evaluate(async () => {
  const r = await fetch('assets/share-1200x630.png');
  if (!r.ok) return { ok: false };
  const blob = await r.blob();
  const bmp = await createImageBitmap(blob);
  return { ok: true, w: bmp.width, h: bmp.height, bytes: blob.size };
});
ok('1.7 the share image exists at 1200×630', img.ok && img.w === 1200 && img.h === 630,
  img.ok ? `${img.w}×${img.h}, ${Math.round(img.bytes / 1024)}KB` : 'missing');

/* ---------------- 2 · the share marks on what we sell ---------------- */
console.log('--- 2 · a share mark on every paid placement ---');
const marks = await page.evaluate(() => ({
  slider: document.querySelectorAll('.slide:not(.slide-house) .ad-share').length,
  mini: document.querySelectorAll('.mini-ad .ad-share').length,
  house: document.querySelectorAll('.slide-house .ad-share').length,
}));
ok('2.1 the main slider carries them', marks.slider > 0, String(marks.slider));
ok('2.2 the mini banner carries one', marks.mini === 1, String(marks.mini));
/* An unsold slot has no advertiser and nothing to send: the house slide is
   our own advertisement for advertising. */
ok('2.3 …and the house slide carries none', marks.house === 0, String(marks.house));

const before = await page.evaluate(() => location.hash);
await page.click('.slide.active .ad-share');
await page.waitForTimeout(500);
const tapped = await page.evaluate((h) => ({ same: location.hash === h, copied: window.__copied }), before);
/* ⚠️ THE MARK SITS INSIDE A ROW THAT NAVIGATES. */
ok('2.4 the tap does not open the advertiser', tapped.same);
ok('2.5 …it shares the advertiser\'s own link', /#\//.test(tapped.copied || ''), tapped.copied);

/* CHANGED in V.06.9: the DIRECTORY has no sponsored band any more — every
   subscriber leads the results themselves, so the band was the same shops
   twice on one screen. The share mark on a band row is unchanged and is
   asserted where a band still exists. */
await at('#/marketplace');
ok('2.6 the sponsored rows carry them', await page.evaluate(() =>
  document.querySelectorAll('.list-row.spon .ad-share').length > 0));

/* the drawer shares the APPLICATION — the one share in the app that is
   not «this thing I am standing on» */
await at('#/home');
await page.click('#hMenu'); await page.waitForTimeout(400);
await page.click('[data-toggle="help"]'); await page.waitForTimeout(400);
ok('2.7 «شارك عربنا مع صديق» is in the drawer', await page.evaluate(() => !!document.querySelector('#drShareApp')));
await page.click('#drShareApp'); await page.waitForTimeout(600);
ok('2.8 …and it shares the app, with no hash', await page.evaluate(() =>
  !!window.__copied && !/#/.test(window.__copied)), await page.evaluate(() => window.__copied));

/* ---------------- 3 · the badge: a mark in lists, a word on the page ---- */
console.log('--- 3 · the verified badge ---');
await asReader({ bizVerify: { b36: { status: 'verified' } } });
await at('#/directory?q=' + encodeURIComponent('سامي'));
const row = await page.evaluate(() => {
  const r = [...document.querySelectorAll('.list-row .row-title')]
    .find(x => /مطبخ ومخبز سامي/.test(x.textContent));
  if (!r) return null;
  const cs = getComputedStyle(r);
  return {
    h: Math.round(r.getBoundingClientRect().height),
    lines: Math.round(r.getBoundingClientRect().height / parseFloat(cs.lineHeight)),
    mark: !!r.querySelector('.badge-shield'),
    word: !!r.querySelector('.badge-bizverified'),
  };
});
ok('3.1 the mark alone in the list', row && row.mark && !row.word);
/* THE MEASUREMENT THE WHOLE ITEM CAME FROM: the pill made this row 60px
   against 28 — two lines where there was one. So the assertion is the
   height of the SAME row without the mark, not an absolute number: a
   fifty-character name is three lines with no badge at all, and the mark
   is only answerable for the line it adds. */
ok('3.2 …and the longest name is one line', row && row.lines === 1, row ? row.h + 'px' : 'no row');
const plain = await (async () => {
  await asReader({});
  await at('#/directory?q=' + encodeURIComponent('سامي'));
  return page.evaluate(() => {
    const r = [...document.querySelectorAll('.list-row .row-title')]
      .find(x => /مطبخ ومخبز سامي/.test(x.textContent));
    return r ? Math.round(r.getBoundingClientRect().height) : 0;
  });
})();
ok('3.2b …the mark costs no line at all', plain === (row && row.h), `${plain}px plain, ${row && row.h}px marked`);
await asReader({ bizVerify: { b36: { status: 'verified' } } });
await at('#/directory?q=' + encodeURIComponent('سامي'));
ok('3.3 no list row anywhere prints the word', await page.evaluate(() =>
  ![...document.querySelectorAll('.list-row')].some(r => r.querySelector('.badge-bizverified'))));

await at('#/directory/b36');
const detail = await page.evaluate(() => {
  const t = document.querySelector('.detail-title');
  const pill = t && t.querySelector('.badge-bizverified');
  return { word: pill ? pill.textContent.trim() : null,
    lines: t ? Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)) : 0,
    over: document.documentElement.scrollWidth > 390 };
});
ok('3.4 the business page carries the word', detail.word === 'نشاط موثّق', detail.word);
/* On the PAGE the word is afforded, and on the longest name in the file
   it takes a second line. That is the room being spent, which is the
   whole reason the word is here and not in the list — what must not
   happen is the title running off the edge. */
ok('3.5 …wrapping rather than overflowing', detail.lines <= 2 && !detail.over,
  `${detail.lines} lines`);

/* TWO SHAPES, NOT TWO COLOURS. A difference that is only colour is no
   difference at all to a reader who cannot see the colour. */
const shapes = await page.evaluate(() => {
  const biz = document.querySelector('.badge-bizverified svg path');
  return { bizIsShield: !!biz && /M12 22s8-4 8-10V5/.test(biz.getAttribute('d') || '') };
});
ok('3.6 the business mark is a shield', shapes.bizIsShield);
ok('3.7 …and the personal one is a circle', await page.evaluate(() => {
  const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } })
    .find(r => r.selectorText === '.badge-check');
  return !!css && css.style.borderRadius === '50%';
}));

/* the mark is a graphical object: 3:1 is the bar, in both themes */
for (const theme of ['dark', 'light']) {
  await asReader({ theme, bizVerify: { b36: { status: 'verified' } } }, { theme });
  await at('#/directory?q=' + encodeURIComponent('سامي'));
  const ratio = await page.evaluate(() => {
    const m = document.querySelector('.badge-shield');
    if (!m) return 0;
    const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    let el = m, bg = 'rgb(0, 0, 0)';
    while (el) { const c = getComputedStyle(el).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)/.test(c)) { bg = c; break; } el = el.parentElement; }
    const a = lum(getComputedStyle(m).color), b = lum(bg);
    return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
  });
  ok(`3.8 the mark clears 3:1 in ${theme}`, ratio >= 3, String(ratio));
}

/* ---------------- 4 · the state is pressed, never searched ------------- */
console.log('--- 4 · Texas ---');
await asReader({});
const q = async (term) => {
  await at('#/directory?q=' + encodeURIComponent(term));
  return page.evaluate(() => ({
    total: Number(document.querySelector('#dirList').dataset.total),
    sugg: !!document.querySelector('.state-suggest'),
    body: document.querySelector('#dirList').innerText.trim(),
  }));
};
const tx = await q('TX');
/* ⚠️ THE FAULT: «TX» is in all 514 addresses. */
ok('4.1 «TX» returns no list', tx.total === 0, String(tx.total));
ok('4.2 …it returns the suggestion instead', tx.sugg);
/* «ما وجدنا شيئاً باسم TX» is a lie — there are 514 shops in Texas, and
   the suggestion two lines above says so. */
ok('4.3 …and no dead end contradicting it', tx.body === '', tx.body.slice(0, 40));

const texas = await q('Texas');
ok('4.4 the NAME keeps its real matches', texas.total > 0 && texas.total < 100, String(texas.total));
ok('4.5 …with the suggestion above them', texas.sugg);
const arabic = await q('تكساس');
ok('4.6 «تكساس» behaves the same', arabic.sugg && arabic.total > 0 && arabic.total < 100, String(arabic.total));

/* nothing else moved */
const hou = await q('Houston');
ok('4.7 «Houston» is untouched', hou.total === 378 && !hou.sugg, String(hou.total));
const sug = await q('شوجر لاند');
ok('4.8 «شوجر لاند» still finds Sugar Land', sug.total === 32 && !sug.sugg, String(sug.total));

await at('#/directory?q=TX');
await page.click('#stateGo'); await page.waitForTimeout(800);
const pressed = await page.evaluate(() => ({
  chip: (document.querySelector('.loc-chip span') || {}).textContent,
  total: Number(document.querySelector('#dirList').dataset.total),
}));
ok('4.9 pressing it sets the chip to the abbreviation', pressed.chip === 'TX', pressed.chip);
ok('4.10 …and the whole directory is inside it', pressed.total === 514, String(pressed.total));

/* the chip prints the state beside a city ONLY when there is more than
   one — today there is not, and «Houston TX» 514 times is noise */
await asReader({ location: { city: 'Richmond', manual: true } });
await at('#/home');
ok('4.11 one state, so the chip is the city alone', await page.evaluate(() =>
  (document.querySelector('.loc-chip span') || {}).textContent === 'Richmond'));
/* …and the page's address line carries it anyway, because there is a
   Richmond in Virginia and another in California */
await at('#/directory/b70');
ok('4.12 the address line says «Richmond, TX»', await page.evaluate(() =>
  /Richmond,\s*TX/.test(document.body.innerText)));

/* ---------------- 5 · a Latin place name in an Arabic line ------------- */
console.log('--- 5 · direction ---');
const bidi = await page.evaluate(() => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const txt = n.nodeValue;
    if (!/[A-Za-z]{2,}/.test(txt) || !/[؀-ۿ]/.test(txt)) continue;
    const el = n.parentElement;
    if (!el || getComputedStyle(el).direction !== 'rtl') continue;
    let iso = false, a = el;
    while (a && a !== document.body) {
      if (/isolate|plaintext/.test(getComputedStyle(a).unicodeBidi)) { iso = true; break; }
      a = a.parentElement;
    }
    if (!iso) out.push(txt.trim().slice(0, 50));
  }
  return out;
});
ok('5.1 every mixed line is isolated', bidi.length === 0, bidi.slice(0, 2).join(' | '));

/* ---------------- 6 · the visitor's headline ---------------- */
console.log('--- 6 · the headline ---');
/* The Woodlands is the longest city name the directory covers, so it is
   the one the line has to survive. */
await asReader({ location: { city: 'The Woodlands', manual: true } });
await at('#/home');
const head = await page.evaluate(() => {
  const h = document.querySelector('.home-headline');
  if (!h) return null;
  return { text: h.textContent,
    lines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)),
    sub: !!document.querySelector('.home-subline') };
});
ok('6.1 the visitor sees it', !!head && /The Woodlands/.test(head.text), head && head.text);
ok('6.2 …on one line at 390', head && head.lines === 1, head ? String(head.lines) : 'none');
ok('6.3 …with the subline under it', head && head.sub);

await asReader({ location: { city: 'Houston', manual: true },
  user: { name: 'أحمد', email: 'a@b.c', emailVerified: true, joined: 1700000000000 } });
await at('#/home');
/* somebody with an account has opened the app twenty times and knows what
   it is; the line would be stealing the space they came for */
ok('6.4 a member does not', await page.evaluate(() => !document.querySelector('.home-headline')));

/* English is a different length and gets measured too */
await asReader({ location: { city: 'The Woodlands', manual: true }, lang: 'en' });
await at('#/home');
ok('6.5 …and one line in English', await page.evaluate(() => {
  const h = document.querySelector('.home-headline');
  return !!h && Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)) === 1;
}));

/* ---------------- 7 · the mark in the header ---------------- */
console.log('--- 7 · the logo ---');
await asReader({ theme: 'dark' });
await at('#/home');
const logo = await page.evaluate(() => {
  const i = document.querySelector('.app-header img[data-logo]');
  if (!i) return null;
  const r = i.getBoundingClientRect();
  return { kind: i.dataset.logo, src: i.getAttribute('src'),
    w: Math.round(r.width), h: Math.round(r.height) };
});
ok('7.1 the header carries the mark alone', logo && logo.kind === 'mark', logo && logo.kind);
ok('7.2 …at 65px tall', logo && logo.h === 65, logo ? `${logo.w}×${logo.h}` : 'none');
/* ⚠️ THE SINGLE-FILE BUILD INLINES EVERY IMAGE AS A DATA URI, so a
   filename assertion passes on one build and fails on the other. What is
   true of both is that the two themes must resolve to DIFFERENT bytes —
   the silver mark is unreadable on the ivory bar, which is the whole
   reason the inked pair exists — so that is what is asserted, with the
   filenames checked as well wherever they survive. */
const inline = logo.src.startsWith('data:');
ok('7.3 …the dark file in the dark theme',
  inline ? logo.src.length > 100 : (/mark\.png/.test(logo.src) && !/ink/.test(logo.src)),
  inline ? 'inlined, ' + logo.src.length + ' chars' : logo.src);
await asReader({ theme: 'light' }, { theme: 'light' });
await at('#/home');
const lightSrc = await page.evaluate(() =>
  document.querySelector('.app-header img[data-logo]').getAttribute('src'));
ok('7.4 …and a different one in the light theme',
  lightSrc !== logo.src && (inline ? lightSrc.startsWith('data:') : /mark-ink\.png/.test(lightSrc)),
  inline ? 'inlined, ' + lightSrc.length + ' chars' : lightSrc);

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
