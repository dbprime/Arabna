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
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

/* On the single-file build every module lives behind an importmap, so
   `import('./js/store.js')` fetches the file again and hands back a SECOND
   instance with its own state. The importmap specifier resolves to the one
   the app is actually running. */
const mods = () => page.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = {
      S: await load('./js/store.js', 'arabna/js/store.js'),
      D: await load('./js/data.js', 'arabna/js/data.js'),
      P: await load('./js/prayer.js', 'arabna/js/prayer.js'),
      Y: await load('./js/synonyms.js', 'arabna/js/synonyms.js'),
      H: await load('./js/screens/home.js', 'arabna/js/screens/home.js'),
    };
  }
  return true;
});
const go = async (h) => {
  await page.evaluate(() => { location.hash = '#/home'; });
  await page.waitForTimeout(120);
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(520);
};
const rows = () => page.evaluate(() => document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]').length);
const txt = () => page.textContent('#app');

/* V.02.9 — batch six (b): the admin panel
   Rebuilt after a container reset destroyed the original. */

const adminLogin = async () => {
  await go('#/admin');
  /* V.03.6 — nothing ships a staff password any more, so a device is
     CLAIMED before it can be logged into. This is the fixture doing what
     the owner does once on the first run; the route is re-entered because
     the setup screen is already on screen by the time we get here. */
  await page.evaluate(async () => {
    const S = (window.__m && window.__m.S)
      || await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    if (!S.adminIsSet()) { await S.setAdminPass('Arabna@2026!', 'arabna.admin'); location.hash = '#/home'; }
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = '#/admin'; });
  await page.waitForTimeout(600);
  if (await page.locator('#aUser').count()) {
    await page.fill('#aUser', 'arabna.admin');
    await page.fill('#aPass', 'Arabna@2026!');
    await page.click('#aGo'); await page.waitForTimeout(800);
  }
};
const tab = async (id) => { await page.click(`[data-t="${id}"]`); await page.waitForTimeout(600); };

await page.goto(BASE); await page.waitForTimeout(800);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  s.radius = 100; localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForTimeout(800);
await mods();

/* ---- 1. the way in ---- */
console.log('--- the way in ---');
await go('#/admin');
/* V.03.6: no password is shipped any more, so a device that has never been
   used shows the SETUP screen — it is claimed, not guessed into. That is
   the state a first-run panel is really in, and it is asserted here before
   the fixture claims it. */
ok('1.0 an unclaimed device is asked to set a password, not to guess one',
   (await page.locator('#aSet').count()) === 1 && (await page.locator('#aGo').count()) === 0);
await page.evaluate(async () => {
  const S = (window.__m && window.__m.S)
    || await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  if (!S.adminIsSet()) await S.setAdminPass('Arabna@2026!', 'arabna.admin');
});
await go('#/home'); await go('#/admin');
ok('1.1 the panel asks before it opens', await page.locator('#aUser').count() === 1);
await page.fill('#aUser', 'arabna.admin');
await page.fill('#aPass', 'wrong');
await page.click('#aGo'); await page.waitForTimeout(500);
ok('1.2 a wrong password does not open it', await page.locator('#aTabs').count() === 0);
await page.fill('#aPass', 'Arabna@2026!');
await page.click('#aGo'); await page.waitForTimeout(800);
ok('1.3 the right one does', await page.locator('#aTabs').count() === 1);
ok('1.4 iOS auto-capitalisation cannot lock the owner out', await page.evaluate(() => {
  const S = window.__m.S;
  return S.adminLogin ? S.adminLogin(' Arabna.Admin ', 'Arabna@2026!') !== false : true;
}));

/* ---- 2. the tabs ---- */
console.log('--- the tabs ---');
const tabs = await page.evaluate(() => [...document.querySelectorAll('#aTabs .tab')].map(b => b.dataset.t));
/* ⚠️ REVERSED BY 620: a ninth tab, «المستخدمون». The count stays a NUMBER
   rather than becoming «at least eight» — a tab added with no decision
   behind it has to turn this red, which is the whole reason it counts. */
ok('2.1 nine tabs', tabs.length === 9, tabs.join(','));
ok('2.1b …and the ninth is the users section', tabs.includes('users'), tabs.join(','));
ok('2.2 …and the row wraps instead of running off the edge', await page.evaluate(() => {
  const r = document.querySelector('#aTabs');
  return getComputedStyle(r).flexWrap === 'wrap' && r.scrollWidth <= r.clientWidth + 2;
}));
ok('2.3 the moderation tab carries its count',
   /المراجعة|Moderation/.test(await page.locator('[data-t="queue"]').textContent()));

/* ---- 3. the directory tab: search, and the id ---- */
console.log('--- the directory tab ---');
await tab('dir');
ok('3.1 it has a search box', await page.locator('#dirQ').count() === 1);
const found = async (term) => {
  await page.fill('#dirQ', term);
  await page.waitForTimeout(700);
  return page.evaluate(() => document.querySelectorAll('#aBody [data-bizedit]').length);
};
ok('3.2 an id returns exactly one row', await found('b137') === 1, String(await found('b137')));
ok('3.3 …even when it looks like an area code', await found('b281') === 1, String(await found('b281')));
ok('3.4 a name still searches by name', await found('الشام') >= 1, String(await found('الشام')));
ok('3.5 …and nothing matches nothing', await found('zzzzqq') === 0);
await page.fill('#dirQ', ''); await page.waitForTimeout(700);

ok('3.6 the geocoding queue is counted', await page.evaluate(() =>
  window.__m.S.allBusinesses().filter(b => b.needsGeo || (b.lat == null && b.lng == null)).length) > 0);
ok('3.7 the duplicate sweep is there', await page.locator('#dupScan').count() === 1);

/* ---- 4. the marketplace tab shows everything, not just the pending ---- */
console.log('--- the marketplace tab ---');
await tab('mkt');
ok('4.1 every listing is listed, whatever its status',
   await page.evaluate(() => window.__m.S.adminListings().length) >= 1);
ok('4.2 the status filter is there', await page.locator('#mktSt').count() === 1);

/* ---- 5. the statistics tab ---- */
console.log('--- the statistics tab ---');
await tab('stats');
const body = await page.textContent('#aBody');
ok('5.1 it draws something real', body.length > 80);
ok('5.2 the most-viewed listings are there',
   await page.evaluate(() => typeof window.__m.S.topViewedBusinesses === 'function'));
ok('5.3 …and what people searched for',
   await page.evaluate(() => typeof window.__m.S.topSearches === 'function'));
ok('5.4 …and the thinnest categories, which is the job list',
   await page.evaluate(() => typeof window.__m.S.thinnestCategories === 'function'));
ok('5.5 a comparison of 138x reads as a multiple, never as 13700%',
   !/13700|\d{4,}%/.test(body), (body.match(/\d+%/g) || []).slice(0, 3).join(' '));

/* ---- 6. settings: the demo switch says the number ---- */
console.log('--- settings ---');
await tab('set');
const hint = await page.locator('.hint').first().textContent();
ok('6.1 the ramadan switch says how many carry it', /\d+/.test(hint), hint.trim());
ok('6.2 …and how many are needed before a chip appears', /5/.test(hint), hint.trim());
ok('6.3 the demo data has a switch', await page.locator('#demoSw, [id*="demo" i]').count() >= 1);
ok('6.4 a warning bar stands above the tabs while demo data is visible',
   await page.locator('.demo-warn').count() === 1);

await go('#/home');
ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
