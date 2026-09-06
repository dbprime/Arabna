/* V.02.1c — the 486 real Houston listings, merged into the seed file */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { withDemoData } from './_demo.mjs';

import { unlockAdmin } from './_admin.mjs';
/* V.02.7 removed the quick-chip row: «مفتوح الآن» and the specialities are
   reached through the ⚙ sheet now. These do through the sheet exactly what
   a tap on the old chip did, so the behaviour under test is unchanged and
   only the doorway moved. */
const viaSheet = async (page, fn) => {
  await page.click('#dirFilter'); await page.waitForTimeout(520);
  await fn();
  await page.click('#fApply'); await page.waitForTimeout(520);
};
const toggleOpenNow = (page) => viaSheet(page, () => page.click('#fOpenNow'));
/* V.04.0 reversed the sheet's SHAPE, not its contents: five headed groups
   of chips became two multi-select pickers, so an attribute is a row
   inside `#fDdTop` or `#fDdRest` rather than a chip in the sheet body.
   Which attributes are offered, and that picking one bites, are unchanged
   and are still what these two helpers measure. */
const attrHosts = [['#fCtlTop', '#fDdTop'], ['#fCtlRest', '#fDdRest']];
const toggleAttr = (page, id) => viaSheet(page, async () => {
  for (const [btn, host] of attrHosts) {
    if (!(await page.locator(btn).count())) continue;
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(380);
    const hit = await page.evaluate(a => {
      const r = document.querySelector(a[0] + ' .dd-row[data-v="' + a[1] + '"]');
      if (r) { r.click(); return true; }
      return false;
    }, [host, id]);
    await page.waitForTimeout(300);
    /* the multi-select STAYS OPEN by design — picking three attributes is
       one gesture — so the panel has to be shut before the sheet's own
       footer can be pressed. Leaving it open made #fApply unclickable and
       the suite time out rather than fail. */
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(250);
    if (hit) return;
  }
});
/** the ids the sheet offers for the current category */
const sheetAttrIds = async (page) => {
  await page.click('#dirFilter'); await page.waitForTimeout(520);
  const ids = [];
  for (const [btn, host] of attrHosts) {
    if (!(await page.locator(btn).count())) continue;
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(380);
    ids.push(...await page.evaluate(h => [...document.querySelectorAll(h + ' .dd-row')].map(r => r.dataset.v), host));
    await page.evaluate(b => document.querySelector(b).click(), btn);
    await page.waitForTimeout(250);
  }
  await page.click('#fApply'); await page.waitForTimeout(520);
  return ids;
};
const activeAttrPills = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#pills [data-off]')].map(b => b.dataset.off));


const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

const go = async (h) => {
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(110);
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(360);
};
/* V.04.4: the directory paints forty rows and grows as the reader
   scrolls. Where a check asks HOW MANY results there are, it reads
   `#dirList` `data-total`, which the screen publishes. Where it asks
   WHICH — is Hermann Park in the list — the rows have to be painted, so
   this drives the real mechanism rather than going around it. */
const drawAll = async (page) => {
  let last = -1;
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(() => {
      const s = document.querySelector('#dirEnd');
      if (s) s.scrollIntoView();
      return document.querySelectorAll('#dirList .list-row').length;
    });
    if (n === last) break;
    last = n;
    await page.waitForTimeout(140);
  }
  await page.evaluate(() => { const a = document.querySelector('#app'); if (a) a.scrollTop = 0; });
  await page.waitForTimeout(120);
};
const txt = () => page.textContent('#app');
const rows = async () => {
  await drawAll(page);
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]'))
      .map(r => r.querySelector('.row-title').textContent.trim()));
};

await page.goto(BASE); await page.waitForTimeout(900);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(900);

/* ======================================================================
   PART 1 — the merge itself
   ====================================================================== */
console.log('--- the merged file ---');
await go('#/directory');
const all = await rows();
/* 514 since b321 (Cafe Mawal) closed for good and was deleted */
ok('the directory holds every listing', all.length === 514, all.length + ' rows');

/* ids have to be unique or two listings share a page */
ok('no two listings share an id', await page.evaluate(() => {
  const ids = Array.from(document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]'))
    .map(r => r.dataset.route);
  return new Set(ids).size === ids.length;
}));

/* the seed shops are still there — they go before launch, not now */
for (const seed of ['مطعم الشام', 'فرن بيروت', 'عيادة النور الطبية'])
  ok('the development seed survives: ' + seed, all.some(x => x.includes(seed)));

/* and the real ones arrived */
/* Abdallah's reads «عبد الله» in Arabic now — the owner settled the 179 guessed
   names and 25 of them took an Arabic one */
for (const real of ['عبد الله', 'Arabisca', 'Hermann Park', 'Houston Zoo'])
  ok('the imported listing is there: ' + real, all.some(x => x.includes(real)));

/* ======================================================================
   PART 2 — every category has something in it
   ====================================================================== */
console.log('--- content per category ---');
const CATS = ['restaurants', 'grocery', 'worship', 'cafe', 'beauty', 'shopping', 'community',
  'education', 'sweets', 'finance', 'occasions', 'doctors', 'auto', 'homegoods', 'lawyers',
  'travel', 'electronics', 'realestate', 'homeservices', 'gyms', 'outings'];
const counts = {};
for (const c of CATS) {
  await go('#/directory?cat=' + c);
  counts[c] = (await rows()).length;
  ok('the category is not empty: ' + c, counts[c] > 0, String(counts[c]));
}
ok('the biggest category is restaurants', counts.restaurants >= 130, String(counts.restaurants));
ok('outings arrived in full', counts.outings >= 70, String(counts.outings));
ok('every category adds up to the whole directory',
   CATS.reduce((s, c) => s + counts[c], 0) === all.length,
   CATS.reduce((s, c) => s + counts[c], 0) + ' vs ' + all.length);

/* ======================================================================
   PART 3 — the flags survived the import
   ====================================================================== */
console.log('--- flags ---');
await go('#/directory/b442');                       // Hermann Park
let body = await txt();
ok('a public park opens', body.includes('Hermann Park'));
ok('…carries its non-commercial mark', body.includes('مكان عام'));
ok('…offers no claim button', await page.locator('#claimBtn').count() === 0);
ok('…and no subscription anywhere on the page',
   await page.evaluate(() => !document.querySelector('[data-route^="#/subscribe"]')));
ok('…keeps the standing warning', body.includes('الأسعار والأوقات تتغيّر'));
ok('…and ends with halal restaurants nearby', body.includes('مطاعم حلال قريبة'));

await go('#/admin');
/* V.03.6 — nothing ships a staff password any more, so a device is
   CLAIMED before it can be logged into. This is the fixture doing what
   the owner does once on the first run; the route is re-entered because
   the setup screen is already on screen by the time we get here. */
await unlockAdmin(page);
await page.click('[data-t="dir"]'); await page.waitForTimeout(500);
/* V.04.0: `isNonCommercial` derives from the category, so the 35 places of
   worship joined the 28 free outings — a mosque has nobody to sell $29 to,
   and that was the bug the batch opened with. The invariant is that the 28
   outings are still all there and nothing else lost the flag. */
ok('the admin panel lists the public places — 28 outings and 35 places of worship',
   await page.locator('#aBody [data-ncoff]').count() === 63,
   String(await page.locator('#aBody [data-ncoff]').count()));

/* a ticketed place in the same category is an ordinary business */
await go('#/directory?cat=outings');
await drawAll(page);
const zoo = await page.evaluate(() => {
  const r = Array.from(document.querySelectorAll('#dirList .list-row'))
    .find(x => x.textContent.includes('Houston Zoo'));
  return r ? r.dataset.route : null;
});
ok('the zoo is in the list', !!zoo, zoo || '');
await go(zoo);
body = await txt();
ok('a ticketed place keeps its claim button', await page.locator('#claimBtn').count() === 1);
// the owner writes the price the way it reads in Arabic — "تذاكر (~26$ للبالغ)" —
// so the check is that the row is there with a number in it, not a $-first format
ok('…and prints an entry price under its own label',
   body.includes('سعر الدخول التقريبي') && /\d/.test(body.split('سعر الدخول التقريبي')[0].slice(-40)),
   (body.match(/[^\s]{0,20}سعر الدخول التقريبي/) || [''])[0]);

/* ======================================================================
   PART 4 — listings with no phone number
   ====================================================================== */
console.log('--- the phoneless eleven ---');
await go('#/directory?cat=outings');
await drawAll(page);
const noCall = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]'))
    .filter(r => !r.querySelector('[data-call]'))
    .map(r => r.querySelector('.row-title').textContent.trim()));
ok('the parks with no published number carry no call button',
   noCall.length >= 8, noCall.length + ': ' + noCall.slice(0, 4).join(' · '));
const withCall = await page.evaluate(() =>
  document.querySelectorAll('#dirList .list-row [data-call]').length);
ok('…while the rest of the category still calls', withCall >= 60, String(withCall));

/* ======================================================================
   PART 5 — the three layers, now that there is real content behind them
   ====================================================================== */
console.log('--- three layers on real data ---');
await go('#/directory?cat=outings');
/* V.02.7: the quick row is gone but its rule is not — it is read from the
   store, and the filtering itself is done through the sheet. */
const outChips = await page.evaluate(async () => {
  const s = await import('./js/store.js').catch(() => null);
  return s ? s.quickAttrsForCat('outings', 5).map(a => a.id) : [];
});
ok('specialities that cleared CHIP_MIN are still the top five',
   outChips.length === 5, outChips.length + ' quick');
ok('"outside food allowed" is one of them', outChips.includes('outOwnFood'), outChips.slice(0, 8).join(' '));
await toggleAttr(page, 'outOwnFood');
await page.waitForTimeout(300);
const ownFood = await rows();
ok('a chip actually narrows the real list',
   ownFood.length > 0 && ownFood.length < counts.outings,
   ownFood.length + ' of ' + counts.outings);

await go('#/directory?cat=restaurants');
const restChips = await page.evaluate(async () => {
  const st = await import('./js/store.js').catch(() => null);
  return st ? st.quickAttrsForCat('restaurants', 5).map(a => a.id) : [];
});
ok('restaurants show only the few specialities that earned a chip',
   restChips.length > 0 && restChips.length <= 5, restChips.join(' '));

/* ======================================================================
   PART 6 — search across the real file
   ====================================================================== */
console.log('--- search ---');
const searchFor = async (term) => {
  await go('#/directory');
  await page.fill('#dirSearch', term);
  await page.waitForTimeout(520);
  return rows();
};
ok('a real shop is findable by name', (await searchFor('Dimassi')).length >= 1, (await rows()).join(' | '));
ok('an Arabic keyword reaches the real file', (await searchFor('مشاوي')).length >= 3, String((await rows()).length));
ok('a place name finds the outing', (await searchFor('Kemah')).length >= 1, (await rows()).join(' | '));
/* V.02.6: «زربيان» is a dictionary word now and finds the mandi houses */
ok('a word nobody uses still finds nothing', (await searchFor('زرافة')).length === 0);

/* ======================================================================
   PART 7 — the rest of the app still opens
   ====================================================================== */
console.log('--- the walk ---');
for (const r of ['#/home', '#/categories', '#/marketplace', '#/events', '#/magazine',
                 '#/advertise', '#/profile', '#/saved', '#/directory/b30', '#/directory/b515']) {
  await go(r);
  ok('opens with content: ' + r, (await txt()).trim().length > 40, String((await txt()).trim().length));
}

await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(700);
await go('#/directory?cat=outings');
ok('EN: the real listings render left-to-right', await page.evaluate(() => document.documentElement.dir === 'ltr'));
ok('EN: a real outing is named', (await txt()).includes('Hermann Park'));
await go('#/home');
await page.evaluate(() => document.querySelector('#hMenu').click()); await page.waitForTimeout(430);
await page.click('#drLang'); await page.waitForTimeout(600);
ok('back to Arabic', await page.evaluate(() => document.documentElement.dir === 'rtl'));

const real = errors.filter(e => !/favicon|ERR_CONNECTION_RESET|Failed to load resource/i.test(e));
ok('no console errors anywhere in the walk', real.length === 0, real.slice(0, 4).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
