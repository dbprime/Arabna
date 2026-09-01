/* V.04.5 — the word «تلقائي», and the reader who is 450 miles away.

   Rai opened the app and his chip said `Beebe`. Measured before writing
   anything, with the point in Beebe, Arkansas: `#/prayer` and `#/mass`
   each explained themselves in a line, and Home and the directory said
   nothing at all — so the reader saw their own town on the chip above a
   directory entirely of somewhere else.

   The message names no area, and that is the design and not a shortcut:
   with one region a list reads, with three it nags, with six nobody reads
   it — and a sentence that grows every time the project succeeds is wrong
   from the start. Its length never changes; the names are in a sheet. */
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
const BEEBE = [35.0754, -91.8829];
const HOUSTON = [29.7604, -95.3698];

const asReader = async (geo, city, lang = 'ar') => {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(a => localStorage.setItem('arabna.v1', JSON.stringify({
    lang: a[3], geoGranted: true,
    geo: a[0] ? { lat: a[0][0], lng: a[0][1], at: Date.now() } : null,
    location: { zip: '', city: a[1], state: a[2] },
  })), [geo, city, city === 'Beebe' ? 'AR' : 'TX', lang]);
  page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|ERR_ABORTED|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
};
const at = async (h) => { await page.goto(BASE + h, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200); };
const boxText = () => page.evaluate(() => { const b = document.querySelector('.outside-box'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : null; });
const chip = () => page.evaluate(() => { const c = document.querySelector('#locBtn, [data-loc]'); return c ? c.textContent.replace(/\s+/g, ' ').trim() : null; });
const sorts = (sel, host) => page.evaluate(async (a) => {
  document.querySelector(a[0]).click();
  await new Promise(r => setTimeout(r, 400));
  return [...document.querySelectorAll(a[1] + ' .dd-row')].map(r => r.dataset.v);
}, [sel, host]);

/* ======================================================================
   the chip: the city, and nothing about where it came from
   ====================================================================== */
console.log('--- 015: the word is off the chip ---');
await asReader(HOUSTON, 'Houston');
await at('#/home');
ok('1 a device-found city prints its name alone', (await chip()) === 'Houston', await chip());
ok('2 …and a hand-picked one reads exactly the same', await page.evaluate(async () => {
  const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
  S.setUserLocation({ zip: '', city: 'Katy', state: 'TX' });   // by hand, no point
  S.save();
  location.hash = '#/directory';
  await new Promise(r => setTimeout(r, 700));
  location.hash = '#/home';
  await new Promise(r => setTimeout(r, 800));
  const c = document.querySelector('#locBtn').textContent.replace(/\s+/g, ' ').trim();
  return c === 'Katy';
}), await chip());
ok('3 the distinction still lives in the data', await page.evaluate(async () => {
  const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
  return S.cityIsManual() === true;
}));
ok('6 `locAuto` is gone from both packs', await page.evaluate(async () => {
  const I = await (import('arabna/js/i18n.js').catch(() => import('./js/i18n.js')));
  const p = I.bothPacks();
  return p.ar.locAuto === undefined && p.en.locAuto === undefined;
}));

/* ======================================================================
   1 to 3 — the box, and it names nothing
   ====================================================================== */
console.log('--- 025: outside the covered areas ---');
await asReader(BEEBE, 'Beebe');
await at('#/home');
const home = await boxText();
ok('1.1 the box is on Home', !!home, home ? home.slice(0, 40) : 'none');
ok('1.2 …with the title, the body and the button', !!home
   && /خارج مناطق التغطية/.test(home) && /تعمل أينما كنت/.test(home) && /اختر منطقة/.test(home));
ok('1.3 …and the chip still names their own town', (await chip()) === 'Beebe', await chip());
await at('#/directory');
ok('2.1 the box is above the first row of the directory', !!(await boxText()));
ok('2.2 …AND THE LISTINGS ARE ALL STILL THERE — it explains, it does not block',
   await page.evaluate(() => +document.querySelector('#dirList').dataset.total) === 514,
   String(await page.evaluate(() => +document.querySelector('#dirList').dataset.total)));
ok('3.1 not one area is named in the box', !/Houston|Katy|Dallas|Sugar/.test(await boxText()));
for (const h of ['#/prayer', '#/mass']) {
  await at(h);
  ok(`3.2 ${h} names no area either`,
     !/Houston|Katy|Sugar/.test(await page.evaluate(() => document.querySelector('#app').textContent)));
}

/* ======================================================================
   4 to 6 — the sheet, and what one tap does
   ====================================================================== */
console.log('--- the region sheet ---');
await at('#/home');
await page.evaluate(() => document.querySelector('#outPick').click());
await page.waitForTimeout(700);
const rows = await page.evaluate(() => [...document.querySelectorAll('.sheet-panel [data-region]')]
  .map(r => r.textContent.replace(/\s+/g, ' ').trim()));
ok('4.1 one row: the area and what stands behind it', rows.length === 1 && /Houston/.test(rows[0]) && /\d/.test(rows[0]), rows.join(' | '));
ok('4.2 NO CITY in this sheet, and no arrow',
   await page.evaluate(() => !/Katy|Sugar Land|Spring|Cypress/.test(document.querySelector('.sheet-panel').textContent)));
await page.evaluate(() => document.querySelector('.sheet-panel [data-region]').click());
await page.waitForTimeout(900);
ok('5.1 the sheet closes', await page.evaluate(() => !document.querySelector('.sheet-panel')));
ok('5.2 …the box goes', (await boxText()) === null);
ok('5.3 …and the chip says the area, alone', (await chip()) === 'Houston', await chip());
await at('#/directory');
ok('6.1 THE DECIDING ONE: one area chosen, all its cities delivered',
   await page.evaluate(async () => {
     const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
     const cities = new Set(S.businessesOfRegion('hou').map(b => S.cityOf(b)));
     return cities.has('Katy') && cities.has('Sugar Land') && cities.has('Spring');
   }));
ok('6.2 …and none of them was chosen by hand',
   await page.evaluate(async () => {
     const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
     return S.state.location.city === '' && S.state.location.region === 'hou';
   }));

/* ======================================================================
   7 + 12 — inside the coverage nothing moved
   ====================================================================== */
console.log('--- inside the coverage ---');
await asReader(HOUSTON, 'Houston');
await at('#/home');
ok('12.1 no box on Home', (await boxText()) === null);
await at('#/directory');
ok('12.2 no box on the directory', (await boxText()) === null);
ok('7.1 the ordinary city sheet is unchanged — 24 cities and a picker',
   await page.evaluate(async () => {
     /* the directory's chip is `[data-loc]`; `#locBtn` is Home's */
     const c0 = document.querySelector('#locBtn, [data-loc]');
     if (!c0) return false;
     c0.click();
     await new Promise(r => setTimeout(r, 500));
     const c = document.querySelector('#ctlCity');
     if (!c) return false;
     c.click();
     await new Promise(r => setTimeout(r, 450));
     return document.querySelectorAll('#cityDD .dd-row').length >= 24;
   }));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

/* ======================================================================
   6 (§6) — distance and «الأقرب» are for people who are here
   ====================================================================== */
console.log('--- distance ---');
await at('#/directory');
ok('§6.1 inside: «الأقرب» is offered', (await sorts('#ctlSort', '#ddHost')).includes('nearest'));
await asReader(BEEBE, 'Beebe');
await at('#/directory');
ok('§6.2 outside: «الأقرب» is not offered in the row picker',
   !(await sorts('#ctlSort', '#ddHost')).includes('nearest'), (await sorts('#ctlSort', '#ddHost')).join(','));
await at('#/directory');
ok('§6.3 …nor in the filter sheet', await page.evaluate(async () => {
  document.querySelector('#dirFilter').click();
  await new Promise(r => setTimeout(r, 600));
  document.querySelector('#fCtlSort').click();
  await new Promise(r => setTimeout(r, 400));
  return ![...document.querySelectorAll('#fDdSort .dd-row')].map(r => r.dataset.v).includes('nearest');
}));
ok('§6.4 …and no distance is computed at 450 miles', await page.evaluate(async () => {
  const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
  const biz = S.everyBusiness().find(b => b.lat);
  return S.distanceTo(biz) === null;
}));

/* ======================================================================
   10 + 11 — the name is out of the text, and out of every condition
   ====================================================================== */
console.log('--- no city typed into anything ---');
ok('10 no covered-area name is written into a coverage string',
   await page.evaluate(async () => {
     const I = await (import('arabna/js/i18n.js').catch(() => import('./js/i18n.js')));
     const p = I.bothPacks();
     const keys = ['massOutside', 'prOutside', 'outsideTitle', 'outsideBody', 'regionsTitle', 'regionsSub', 'pickRegion'];
     return keys.every(k => !/Houston|Katy|Dallas/.test((p.ar[k] || '') + (p.en[k] || '')));
   }));
ok('10b …and `regionAll` carries a placeholder, not a city',
   await page.evaluate(async () => {
     const I = await (import('arabna/js/i18n.js').catch(() => import('./js/i18n.js')));
     const p = I.bothPacks();
     return /\{r\}/.test(p.ar.regionAll) && /\{r\}/.test(p.en.regionAll)
       && p.ar.regionName === undefined && p.en.regionName === undefined;
   }));
ok('11 no `if` on a city name anywhere in js/', await page.evaluate(async () => {
  for (const f of ['js/store.js', 'js/ui.js', 'js/screens/home.js', 'js/screens/directory.js']) {
    const r = await fetch(f).catch(() => null);
    if (!r || !r.ok) continue;
    const src = await r.text();
    // a comparison against a literal city name — the thing that gets forgotten
    if (/[=!]==\s*'(Houston|Katy|Sugar Land|Dallas)'/.test(src)) return false;
  }
  return true;
}));

/* ======================================================================
   8 + 9 — a second area costs nothing
   ====================================================================== */
console.log('--- opening a second area ---');
ok('8/9 the data alone decides who is covered', await page.evaluate(async () => {
  const D = await (import('arabna/js/data.js').catch(() => import('./js/data.js')));
  const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
  const before = S.regionsWithCounts().length;
  D.REGIONS.push({ id: 'tst', name: 'Testville' });
  D.CITY_POINTS.push({ city: 'Testville', region: 'tst', lat: 35.0754, lng: -91.8829 });
  const after = S.regionsWithCounts().length;
  const nowCovered = S.inCoverage();          // the Beebe point is beside Testville
  D.REGIONS.pop(); D.CITY_POINTS.pop();
  return after === before + 1 && nowCovered;
}));

/* ======================================================================
   13 — English, and the area names are not translated
   ====================================================================== */
console.log('--- English ---');
await asReader(BEEBE, 'Beebe', 'en');
await at('#/home');
const en = await boxText();
ok('13.1 the message is translated', !!en && /outside the covered areas/i.test(en), en ? en.slice(0, 40) : 'none');
await page.evaluate(() => document.querySelector('#outPick').click());
await page.waitForTimeout(700);
ok('13.2 …and the area name is not', await page.evaluate(() =>
  /Houston/.test(document.querySelector('.sheet-panel').textContent)));

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
