/* The `<svg …>` printed as words under every sponsored business.

   Rai photographed it: on #/directory, under the name of each of the two
   rows we sell, the pin icon's own source code was printed as text.

   Every link in the chain was right and the result was wrong. `distLabel`
   returned HTML and said nothing about it in its name; `sponsoredRows`
   took it as a text field; `esc()` escaped it, CORRECTLY, and out came
   the markup. `esc()` is what stopped a user's text executing inside the
   admin panel one batch ago — deleting it from that row would have opened
   an injection hole in the one row that prints names people type. That is
   the fast-looking wrong answer, and this suite guards against it too.

   The rule the fault leaves behind: a function returning HTML ends its
   name in `Html`. Anything else returns text and may pass through esc(). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 130)); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 130)));

const go = async (h) => {
  if ((await page.evaluate(() => location.hash)) === h) {
    await page.evaluate(() => { location.hash = '#/home'; });
    await page.waitForTimeout(350);
  }
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(800);
};
const mods = () => page.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = { S: await load('./js/store.js', 'arabna/js/store.js'),
                   U: await load('./js/ui.js', 'arabna/js/ui.js') };
  }
  return true;
});
/** everything a reader can actually READ on the screen */
const seen = () => page.evaluate(() => document.querySelector('#app').innerText);
const sponSubs = () => page.evaluate(() => [...document.querySelectorAll('.spon .row-sub')]
  .map(x => x.textContent.replace(/\s+/g, ' ').trim()));
/* CHANGED in V.06.9: the rows the directory SELLS are no longer a `.spon`
   band above the results — every subscriber stands at the top of the
   results themselves, labelled there. So the row this suite was written
   about still exists on the very screen Rai photographed; only its class
   moved. The `.spon` reader stays for the marketplace, the magazine and
   events, which still draw a band. */
const dirSponSubs = () => page.evaluate(() => [...document.querySelectorAll('#dirList .list-row')]
  .filter(r => r.querySelector('.badge-sponsored'))
  .map(r => r.querySelector('.row-sub').textContent.replace(/\s+/g, ' ').trim()));
const dirSponIcons = () => page.evaluate(() => [...document.querySelectorAll('#dirList .list-row')]
  .filter(r => r.querySelector('.badge-sponsored'))
  .reduce((n, r) => n + r.querySelectorAll('.row-sub svg').length, 0));

await page.goto(BASE + '#/home'); await page.waitForTimeout(1000); await mods();

/* ======================================================================
   1 + 2 — the pin is drawn, in both languages
   ====================================================================== */
console.log('--- the sponsored row ---');
await go('#/directory');
ok('1.1 there are sponsored rows to measure', (await dirSponSubs()).length > 0, String((await dirSponSubs()).length));
ok('1.2 AR: the pin is an icon, not its source', !/<svg|viewBox|stroke-width/.test(await seen()),
   (await dirSponSubs()).join(' | '));
ok('1.3 AR: …and the icon really is drawn', await dirSponIcons() > 0);
ok('1.4 AR: the line reads as a place', (await dirSponSubs()).every(s => s.length > 0 && !s.includes('<')),
   (await dirSponSubs()).join(' | '));

await page.click('#hMenu'); await page.waitForTimeout(450);
await page.click('#drLang'); await page.waitForTimeout(700);
await go('#/directory');
ok('2.1 EN: the pin is an icon, not its source', !/<svg|viewBox|stroke-width/.test(await seen()),
   (await dirSponSubs()).join(' | '));
ok('2.2 EN: …and the icon really is drawn', await dirSponIcons() > 0);
await page.click('#hMenu'); await page.waitForTimeout(450);
await page.click('#drLang'); await page.waitForTimeout(700);

/* ======================================================================
   3 — not one `<svg` anywhere a reader can read it
   ====================================================================== */
console.log('--- the whole app ---');
for (const h of ['#/directory', '#/home', '#/marketplace', '#/events', '#/magazine', '#/prayer', '#/mass']) {
  await go(h);
  const t = await seen();
  ok(`3 ${h}: zero markup printed as words`, !/<svg|<span|viewBox|currentColor/.test(t),
     (t.match(/<[a-z]+[^>]{0,30}/) || [''])[0]);
}

/* ======================================================================
   4 — the three strips that were already right are untouched
   ====================================================================== */
console.log('--- the strips that were sound ---');
for (const [h, label] of [['#/marketplace', 'the price'], ['#/magazine', 'the advertiser'], ['#/events', 'the date']]) {
  await go(h);
  const subs = await sponSubs();
  /* events sells the pin to OTHER featured events, and the seed file
     carries one at a time — so an empty band there is the inventory, not
     a fault. What must never appear is markup. */
  ok(`4 ${h}: ${label} still reads as text`,
     subs.every(s => s && !s.includes('<')), subs.join(' | ') || 'nothing sold in this section today');
}

/* ======================================================================
   5 + 6 — a real distance, and a row with neither
   ====================================================================== */
console.log('--- distance, and the row with no place ---');
await go('#/directory');
await page.evaluate(() => {
  const S = window.__m.S;
  S.setUserLocation({ zip: '77081', city: 'Houston', state: 'TX' }, { lat: 29.7604, lng: -95.3698 });
  /* No listing carries coordinates yet — the standing data job — so the
     paid ones are given a point here. The code is what is under test. */
  S.everyBusiness().filter(b => S.isPaid(b)).forEach((b, i) => { b.lat = 29.76 + i * 0.02; b.lng = -95.37; });
  S.save();
});
await go('#/home'); await go('#/directory');
const withMiles = await dirSponSubs();
ok('5.1 the line becomes a distance in miles', withMiles.some(s => /\d/.test(s) && /ميل|mi/.test(s)), withMiles.join(' | '));
ok('5.2 …and the pin is still beside it', await dirSponIcons() > 0);
ok('5.3 …and it is still not markup', !/<svg/.test(await seen()));

/* a sponsored business with no city and no distance falls back to the
   category name — and must NOT carry a pin hanging on nothing */
const orphan = await page.evaluate(() => {
  const S = window.__m.S, U = window.__m.U;
  const b = S.everyBusiness().find(x => S.isPaid(x));
  const saved = { lat: b.lat, lng: b.lng, address: b.address, geo: S.state.geo };
  b.lat = null; b.lng = null; b.address = '';
  S.state.geo = null;
  const text = U.distText(b);
  Object.assign(b, { lat: saved.lat, lng: saved.lng, address: saved.address });
  S.state.geo = saved.geo;
  return text;
});
ok('6 with no city and no distance the text is empty, so no pin is drawn alone',
   orphan === '', JSON.stringify(orphan));

/* ======================================================================
   7 — and esc() was not touched, which is the point
   ====================================================================== */
console.log('--- esc() still binds ---');
const escaped = await page.evaluate(() => {
  const U = window.__m.U;
  const host = document.createElement('div');
  host.innerHTML = U.sponsoredRows([{ route: '#/x', title: 'Salon <b>Bold</b>', sub: 'Katy <i>x</i>', subIcon: 'mapPin' }]);
  return {
    title: host.querySelector('.row-title').textContent,
    bold: !!host.querySelector('.row-title b'),
    sub: host.querySelector('.row-sub').textContent.trim(),
    ital: !!host.querySelector('.row-sub i'),
    pin: !!host.querySelector('.row-sub svg'),
  };
});
ok('7.1 a name containing <b> prints as text', escaped.title.includes('<b>Bold</b>') && !escaped.bold, escaped.title);
ok('7.2 …and so does the sub', escaped.sub.includes('<i>x</i>') && !escaped.ital, escaped.sub);
ok('7.3 …while the row still draws its own icon', escaped.pin);
/* the field itself, not the word: the comment beside the row explains why
   there is no `subHtml`, and that sentence is not the hatch */
ok('7.4 there is no subHtml escape hatch', await page.evaluate(async () => {
  const src = await (await fetch('js/ui.js')).text().catch(() => '');
  return src ? !/r\.subHtml|subHtml\s*:/.test(src) : true;
}));

/* ======================================================================
   the rule itself: an HTML function says so in its name
   ====================================================================== */
console.log('--- the naming rule ---');
const names = await page.evaluate(() => {
  const U = window.__m.U;
  return { distText: typeof U.distText, distLabelHtml: typeof U.distLabelHtml,
           distLabel: typeof U.distLabel,
           bizBadgeHtml: typeof U.bizBadgeHtml, bizBadge: typeof U.bizBadge,
           openBadgeHtml: typeof U.openBadgeHtml, openBadge: typeof U.openBadge,
           openBadgeSlotHtml: typeof U.openBadgeSlotHtml,
           attrChipsHtml: typeof U.attrChipsHtml, attrChips: typeof U.attrChips,
           statusBadgeHtml: typeof U.statusBadgeHtml, statusBadge: typeof U.statusBadge };
});
ok('8.1 distText returns text and distLabelHtml returns markup',
   names.distText === 'function' && names.distLabelHtml === 'function' && names.distLabel === 'undefined');
ok('8.2 the four sisters say what they return too',
   names.bizBadgeHtml === 'function' && names.openBadgeHtml === 'function'
   && names.openBadgeSlotHtml === 'function' && names.attrChipsHtml === 'function'
   && names.statusBadgeHtml === 'function',
   JSON.stringify(names));
ok('8.3 …and none of the old names survives to be misused',
   names.bizBadge === 'undefined' && names.openBadge === 'undefined'
   && names.attrChips === 'undefined' && names.statusBadge === 'undefined');

await go('#/home');
ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
