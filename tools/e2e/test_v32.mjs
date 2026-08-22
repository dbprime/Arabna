/* V.03.9 — batch nine (أ): the churches and the mass times.

   Rai asked for a churches section in the drawer, «so a Christian feels
   there is something here for him», and asked what to put in it.

   The answer this suite guards: the feast calendar is COMPUTED, not
   stored — Easter is arithmetic exactly as the prayer times are — and it
   prints BOTH Easters by name. In 2027 they fall thirty-five days apart,
   so an app showing one date is wrong for half the people reading it. */
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

const mods = () => page.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = { S: await load('./js/store.js', 'arabna/js/store.js'),
                   F: await load('./js/feasts.js', 'arabna/js/feasts.js') };
  }
  return true;
});
/* Setting the hash to what it already is fires no `hashchange`, so the
   screen never repaints and the next section measures the previous one.
   Bounce through Home first — it has bitten this harness twice. */
const go = async (h) => {
  if ((await page.evaluate(() => location.hash)) === h) {
    await page.evaluate(() => { location.hash = '#/home'; });
    await page.waitForTimeout(350);
  }
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(700);
};
const txt = () => page.evaluate(() => document.querySelector('#app').textContent.replace(/\s+/g, ' '));

await page.goto(BASE + '#/home'); await page.waitForTimeout(900); await mods();

/* ======================================================================
   1 — the drawer: two lines of one shape
   ====================================================================== */
console.log('--- the drawer ---');
await page.click('#hMenu'); await page.waitForTimeout(500);
await page.evaluate(() => { const h = [...document.querySelectorAll('.dr-head')].find(x => /تصنيفات/.test(x.textContent)); if (h) h.click(); });
await page.waitForTimeout(400);
const rows = await page.evaluate(() => [...document.querySelectorAll('.dr-group.open .dr-item')]
  .map(b => ({ txt: b.textContent.replace(/\s+/g, ' ').trim(), size: getComputedStyle(b).fontSize, weight: getComputedStyle(b).fontWeight, route: b.dataset.route })));
const iPrayer = rows.findIndex(r => /مواقيت الصلاة/.test(r.txt));
const iMass = rows.findIndex(r => /مواعيد القداس/.test(r.txt));
ok('1.1 «مواعيد القداس» is in the drawer', iMass > -1);
ok('1.2 …directly under «مواقيت الصلاة»', iPrayer > -1 && iMass === iPrayer + 1, `${iPrayer} then ${iMass}`);
ok('1.3 …in the same size and the same weight',
   iMass > -1 && rows[iMass].size === rows[iPrayer].size && rows[iMass].weight === rows[iPrayer].weight,
   iMass > -1 ? `${rows[iMass].size}/${rows[iMass].weight}` : 'n/a');
ok('1.4 …and it goes to #/mass', iMass > -1 && rows[iMass].route === '#/mass');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);

/* ======================================================================
   2 — the nearest churches, by distance and by nothing else
   ====================================================================== */
console.log('--- the churches ---');
await page.evaluate(() => {
  const S = window.__m.S;
  S.setUserLocation({ zip: '77081', city: 'Houston', state: 'TX' }, { lat: 29.7604, lng: -95.3698 });
  /* None of the 514 listings carries coordinates yet — that is the
     standing data job — so the ORDERING can only be measured by giving
     three churches real points. The code is what is under test. */
  const c = S.everyBusiness().filter(x => S.isChurch(x));
  if (c[0]) { c[0].lat = 29.90; c[0].lng = -95.60; }
  if (c[1]) { c[1].lat = 29.77; c[1].lng = -95.39; }
  if (c[2]) { c[2].lat = 29.82; c[2].lng = -95.45; }
  S.save();
});
await go('#/mass');
ok('2.1 Houston shows the nearby-churches block', /كنائس قريبة/.test(await txt()));
const miles = await page.evaluate(() => [...document.querySelectorAll('.list-row[data-route^="#/directory/"] .feast-at')]
  .map(e => parseFloat(e.textContent)).filter(n => !isNaN(n)));
ok('2.2 …ordered nearest first', miles.length >= 2 && miles.every((v, i) => i === 0 || v >= miles[i - 1]),
   miles.join(' · '));
ok('2.3 every row is a church, never a mosque', await page.evaluate(() => {
  const S = window.__m.S;
  return [...document.querySelectorAll('.list-row[data-route^="#/directory/"]')]
    .every(r => { const b = S.businessById(r.dataset.route.split('/').pop()); return b && S.isChurch(b); });
}));
ok('2.4 a church with nothing published says so, and invents no time',
   /غير متوفّرة — اتصل بالكنيسة/.test(await txt()));
ok('2.5 the honesty line stands, like the prayer screen\'s',
   /المواعيد من الكنائس نفسها/.test(await txt()));
/* no advertising surface anywhere on this screen */
ok('2.6 nothing sponsored is sold on it', await page.evaluate(() =>
  !document.querySelector('#app .slider, #app .spon, #app .mini-ad, #app .badge-sponsored')));

/* ======================================================================
   3 — outside the region, hidden rather than empty
   ====================================================================== */
console.log('--- outside Houston ---');
await page.evaluate(() => {
  const S = window.__m.S;
  S.setUserLocation({ zip: '', city: '', state: 'TX' }, { lat: 32.7767, lng: -96.7970 });   // Dallas
  S.save();
});
await go('#/mass');
ok('3.1 Dallas hides the churches block', !/كنائس قريبة/.test(await txt()));
ok('3.2 …and says why, once', /الدليل يغطّي/.test(await txt()));
ok('3.3 …while the calendar still works, because it is arithmetic',
   (await page.evaluate(() => document.querySelectorAll('.feast-row').length)) > 0);

/* ======================================================================
   4 — the calendar: two Easters, two Christmases, and what is not certain
   ====================================================================== */
console.log('--- the calendar ---');
const F = (y, m, d) => Date.UTC(y, m, d);
const easters = await page.evaluate(() => {
  const F = window.__m.F;
  const iso = (d) => d.toISOString().slice(0, 10);
  const out = {};
  for (let y = 2026; y <= 2035; y++) out[y] = [iso(F.easterWestern(y)), iso(F.easterEastern(y))];
  return out;
});
ok('4.1 2027: western Easter is 28 March and eastern is 2 May — thirty-five days apart',
   easters[2027][0] === '2027-03-28' && easters[2027][1] === '2027-05-02', easters[2027].join(' / '));
ok('4.2 2026 · 2029 · 2030 are the seven-day years',
   easters[2026].join() === '2026-04-05,2026-04-12'
   && easters[2029].join() === '2029-04-01,2029-04-08'
   && easters[2030].join() === '2030-04-21,2030-04-28');
ok('4.3 2028 they fall on the same day', easters[2028][0] === easters[2028][1], easters[2028][0]);
ok('4.4 …and that year prints ONE row, with no tradition attached to it',
   await page.evaluate(() => {
     const e = window.__m.F.upcomingFeasts(8, Date.UTC(2028, 3, 1)).filter(f => f.id === 'easter');
     return e[0] && e[0].tradition === '' && e.filter(f => f.at.getUTCFullYear() === 2028).length === 1;
   }));
ok('4.5 2026–2035: no Easter falls outside March–May, and nothing throws',
   await page.evaluate(() => {
     const F = window.__m.F;
     for (let y = 2026; y <= 2035; y++) {
       for (const d of [F.easterWestern(y), F.easterEastern(y)]) {
         if (isNaN(d) || d.getUTCMonth() < 2 || d.getUTCMonth() > 4) return false;
       }
     }
     return true;
   }));
/* the movable feasts are derived, not tabulated */
ok('4.6 Palm Sunday and Good Friday derive from Easter by subtraction',
   await page.evaluate(() => {
     const F = window.__m.F;
     const all = F.feastsBetween(Date.UTC(2027, 0, 1), Date.UTC(2027, 11, 31));
     const e = all.find(f => f.id === 'easter' && f.tradition === 'west');
     const p = all.find(f => f.id === 'palm' && f.tradition === 'west');
     const g = all.find(f => f.id === 'goodFri' && f.tradition === 'west');
     return (e.at - p.at) / 86400000 === 7 && (e.at - g.at) / 86400000 === 2;
   }));

const shown = await page.evaluate(() => [...document.querySelectorAll('.feast-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
ok('4.7 Christmas is two lines, and the Coptic one is named',
   shown.some(r => /عيد الميلاد/.test(r) && !/الأقباط/.test(r)) && shown.some(r => /عيد الميلاد \(الأقباط\)/.test(r)),
   shown.filter(r => /الميلاد/.test(r)).join(' | '));
ok('4.8 Ramadan carries «تقديري»', shown.some(r => /رمضان/.test(r) && /تقديري/.test(r)),
   shown.find(r => /رمضان/.test(r)) || 'not shown');
ok('4.9 …and Easter and Christmas do NOT — they are certain',
   shown.filter(r => /الفصح|الميلاد/.test(r)).every(r => !/تقديري/.test(r)));
ok('4.10 the estimate note names who announces it',
   /الإعلان النهائي من المراكز الإسلامية المحلية/.test(await txt()));
ok('4.11 the list runs in date order, not religion by religion',
   await page.evaluate(() => {
     const F = window.__m.F;
     const l = F.upcomingFeasts(6);
     return l.every((f, i) => i === 0 || f.at >= l[i - 1].at);
   }));
ok('4.12 …and it really mixes the two, rather than grouping them',
   await page.evaluate(() => {
     const l = window.__m.F.upcomingFeasts(6);
     const kinds = l.map(f => f.tradition === 'islam' ? 'i' : 'c').join('');
     return /i/.test(kinds) && /c/.test(kinds);
   }));

/* ======================================================================
   5 — one component, on both screens
   ====================================================================== */
console.log('--- shared, not copied ---');
const onMass = await page.evaluate(() => document.querySelectorAll('.feast-row').length);
await go('#/prayer');
const onPrayer = await page.evaluate(() => document.querySelectorAll('.feast-row').length);
ok('5.1 the same calendar appears on #/prayer', onPrayer > 0 && onPrayer === onMass, `${onMass} / ${onPrayer}`);
ok('5.2 …from one definition, not a second copy', await page.evaluate(async () => {
  const src = await (await fetch('js/screens/prayer.js')).text().catch(() => '');
  if (!src) return true;                       // inlined in the single-file build
  return /import \{ feastsBlockHtml \} from '\.\/mass\.js'/.test(src)
      && !/easterWestern|easterEastern/.test(src);
}));

/* ======================================================================
   6 — the two rules that do not bend
   ====================================================================== */
console.log('--- the rules ---');
ok('6.1 no denomination is ever assigned by us', await page.evaluate(async () => {
  const S = window.__m.S;
  /* «قبطية» may appear only where it is already in the registered name or
     in an attribute the owner declared. Nothing in our own copy adds it. */
  const src = await (await fetch('js/screens/mass.js')).text().catch(() => '');
  return src ? !/قبطي|أنطاك|ملكي|Coptic|Antiochian|Melkite/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')) : true;
}));
ok('6.2 there is no denomination field in any form we show',
   await page.evaluate(async () => {
     for (const f of ['js/screens/directory.js', 'js/screens/mass.js']) {
       const src = await (await fetch(f)).text().catch(() => '');
       if (src && /name="denomination"|id="denom|data-denom/.test(src)) return false;
     }
     return true;
   }));
ok('6.3 the calendar needs no network at all', await page.evaluate(async () => {
  const src = await (await fetch('js/feasts.js')).text().catch(() => '');
  return src ? !/fetch\(|XMLHttpRequest|import\(/.test(src) : true;
}));

await go('#/home');
ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
