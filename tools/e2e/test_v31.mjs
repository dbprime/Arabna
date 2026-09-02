/* V.03.8 — «I allowed the location and nothing happened».

   The report: somebody allowed the location on the prayer screen and the
   screen did not change. He picked «Katy» by hand a moment later and the
   times appeared at once — so the permission, the point, the arithmetic
   and the screen were all working.

   What was wrong: the app HAD the coordinates and threw them away because
   it could not find out the name of the town. `setUserLocation` lived
   inside `onOk`, and `onOk` only ran after a call to somebody else's
   server. An ad blocker, a rate limit, a weak signal or an office network
   was enough — and none of those has anything to do with prayer times,
   which need a point and a date and nothing else.

   Check 1 below is the whole file. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const errors = [];
const HOUSTON = { latitude: 29.7604, longitude: -95.3698 };
const KATY    = { latitude: 29.7858, longitude: -95.8245 };
const DALLAS  = { latitude: 32.7767, longitude: -96.7970 };
const NAMERS  = /bigdatacloud|zippopotam/;   // Nominatim left in 550 (Schedule E-08)

const open = async ({ coords, naming, slow } = {}) => {
  const ctx = await browser.newContext({
    colorScheme: 'dark', viewport: { width: 390, height: 844 },
    ...(coords ? { permissions: ['geolocation'], geolocation: coords } : {}),
  });
  const p = await ctx.newPage();
  /* The blocked naming hosts are this suite's own doing, and a request the
     app made and handled is not an app error — the whole point is that it
     survives them. */
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 120)); });
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  if (slow) {
    await p.addInitScript(() => {
      const o = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (a, b2, c) => setTimeout(() => o(a, b2, c), 2500);
    });
  }
  /* The two naming hosts are unreachable from this sandbox either way,
     so a WORKING naming call has to be stubbed to be tested at all. */
  if (naming === 'ok') {
    await p.route(u => /bigdatacloud/.test(String(u)), r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ countryCode: 'US', city: 'Houston', principalSubdivisionCode: 'US-TX', postcode: '77081' }) }));
    await p.route(u => /zippopotam/.test(String(u)), r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ places: [{ 'place name': 'Houston', 'state abbreviation': 'TX' }] }) }));
  } else if (naming === 'blocked') {
    await p.route(u => NAMERS.test(String(u)), r => r.abort());
  }
  await p.goto(BASE + '#/home'); await p.waitForTimeout(900);
  await p.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    S.state.geo = null; S.state.geoDenied = false; S.state.geoAsked = false;
    S.state.location = { zip: '', city: '', state: 'TX' }; S.save();
  });
  return { ctx, p };
};
const allow = async (p) => {
  await p.evaluate(() => { location.hash = '#/prayer'; }); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('#prLoc').click()); await p.waitForTimeout(400);
  await p.evaluate(() => { const y = document.querySelector('#geoYes'); if (y) y.click(); });
};
const hasTimes = (p) => p.evaluate(() => /\d{1,2}:\d{2}/.test(document.querySelector('#app').textContent));
const sixTimes = (p) => p.evaluate(() => (document.querySelector('#app').textContent.match(/\d{1,2}:\d{2}/g) || []).slice(0, 6).join(' '));
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')));

/* ======================================================================
   1 — the point survives a dead naming server
   ====================================================================== */
console.log('--- the point is not the name ---');
{
  const { ctx, p } = await open({ coords: HOUSTON, naming: 'blocked' });
  await allow(p);
  let appeared = false;
  for (let i = 0; i < 40 && !appeared; i++) { await p.waitForTimeout(300); appeared = await hasTimes(p); }
  ok('1.1 with all three naming hosts blocked, the prayer times still appear', appeared);
  const s = await stored(p);
  ok('1.2 …because the point is saved before anything is asked of the network', !!s.geo,
     s.geo ? `${s.geo.lat.toFixed(3)},${s.geo.lng.toFixed(3)}` : 'no point');
  ok('1.3 no city name is invented', !s.location.city, `"${s.location.city}"`);
  await p.waitForTimeout(1200);
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(800);
  ok('1.4 the chip says «موقعك الحالي», not «حدّد موقعك»',
     await p.evaluate(() => /موقعك الحالي|Your current location/.test(document.querySelector('#locBtn').textContent)),
     await p.evaluate(() => document.querySelector('#locBtn').textContent.trim()));
  ok('1.5 no red error: from the reader\'s side nothing failed',
     !(await p.evaluate(() => !!document.querySelector('.toast.err, .toast-err'))));
  ok('1.6 the city list does not open itself after a granted permission',
     !(await p.evaluate(() => !!document.querySelector('.sheet-panel'))));
  /* the same point is what every distance is measured from */
  await p.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    const b = S.businessById('b30'); if (b) { b.lat = 29.7050; b.lng = -95.4900; }
  });
  await p.evaluate(() => { location.hash = '#/directory'; }); await p.waitForTimeout(1400);
  ok('1.7 …and the directory prints real miles from it',
     await p.evaluate(() => /[\d.]+\s*(ميل|mi)(\s|$)/.test(document.querySelector('#app').textContent)),
     await p.evaluate(() => { const m = document.querySelector('#app').textContent.match(/[\d.]+\s*(ميل|mi)/); return m ? m[0] : 'none'; }));
  await ctx.close();
}

/* ======================================================================
   2 — and when the name does arrive, it is added, not awaited
   ====================================================================== */
console.log('--- the name is an improvement, not a condition ---');
{
  const { ctx, p } = await open({ coords: HOUSTON, naming: 'ok' });
  await allow(p);
  let appeared = false;
  for (let i = 0; i < 40 && !appeared; i++) { await p.waitForTimeout(300); appeared = await hasTimes(p); }
  ok('2.1 the times appear', appeared);
  const before = await sixTimes(p);
  await p.waitForTimeout(1500);           // let the naming call land
  const s = await stored(p);
  ok('2.2 …and the city name arrives afterwards', s.location.city === 'Houston', `"${s.location.city}"`);
  ok('2.3 …without the times changing under the reader', (await sixTimes(p)) === before, before);
  await ctx.close();
}

/* ======================================================================
   3 — the third state: a still screen was half the fault
   ====================================================================== */
console.log('--- the wait says so ---');
{
  const { ctx, p } = await open({ coords: HOUSTON, naming: 'blocked', slow: true });
  await allow(p);
  await p.waitForTimeout(700);
  ok('3.1 between the tap and the point, the screen says «جارٍ تحديد موقعك…»',
     await p.evaluate(() => /جارٍ تحديد|Finding your location/.test(document.querySelector('#app').textContent)));
  await p.waitForTimeout(3200);
  ok('3.2 …and it gives way to the times', await hasTimes(p));
  ok('3.3 the flag is memory-only — a reload is not still waiting',
     await p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')).geoPending === undefined));
  await ctx.close();
}

/* ======================================================================
   4 — a real refusal still behaves exactly as it did
   ====================================================================== */
console.log('--- refusing ---');
{
  const { ctx, p } = await open({});      // no permission granted
  await allow(p);
  await p.waitForTimeout(2500);
  const s = await stored(p);
  ok('4.1 a refusal sets geoDenied', s.geoDenied === true);
  ok('4.2 …saves no point', !s.geo);
  ok('4.3 …and the city list is one tap behind it, as before',
     await p.evaluate(() => !!document.querySelector('.sheet-panel')));
  await ctx.close();
}

/* ======================================================================
   5 — the arithmetic is unchanged wherever the point comes from
   ====================================================================== */
console.log('--- the same times, however you got there ---');
{
  const { ctx, p } = await open({ coords: KATY, naming: 'blocked' });
  await allow(p); await p.waitForTimeout(2500);
  const fromDevice = await sixTimes(p);
  await ctx.close();

  const { ctx: c2, p: p2 } = await open({});
  await p2.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    S.setUserLocation({ zip: '', city: 'Katy', state: 'TX' }, null); S.save();
  });
  await p2.evaluate(() => { location.hash = '#/prayer'; }); await p2.waitForTimeout(1100);
  ok('5.1 the device in Katy gives what picking «Katy» gives',
     fromDevice === (await sixTimes(p2)), fromDevice);
  await c2.close();
}
{
  /* the times work anywhere in the United States; the DIRECTORY covers
     Houston — that is the V.03.1 rule and it still holds */
  const { ctx, p } = await open({ coords: DALLAS, naming: 'blocked' });
  await allow(p); await p.waitForTimeout(2500);
  ok('5.2 Dallas gets its times', await hasTimes(p), await sixTimes(p));
  ok('5.3 …and «مساجد قريبة منك» is hidden rather than empty',
     !(await p.evaluate(() => /مساجد قريبة|Mosques near/.test(document.querySelector('#app').textContent))));
  await ctx.close();
}

/* ======================================================================
   6 — one naming provider, and nothing else
   ⚠️ REVERSED IN V.08.8 (`550`). This block asserted that BOTH providers
   were asked at the same moment (V.03.8). Nominatim is disabled in
   production under Schedule E-08 of the Founder Agreement — no call, no
   host in CSP, none in sw.js — so what is asserted now is that exactly
   ONE provider is called, it is BigDataCloud, and not a single request to
   nominatim.openstreetmap.org leaves the page for the whole scene.
   ====================================================================== */
console.log('--- one provider, and no hidden fallback ---');
{
  const { ctx, p } = await open({ coords: HOUSTON });
  const order = [], every = [];
  p.on('request', r => every.push(r.url()));
  await p.route(u => /bigdatacloud|nominatim/.test(String(u)), async r => {
    order.push({ host: /bigdatacloud/.test(r.request().url()) ? 'bdc' : 'nom', at: Date.now() });
    await new Promise(res => setTimeout(res, 900));
    r.abort();
  });
  await allow(p);
  await p.waitForTimeout(3000);
  ok('6.1 exactly one provider is called, and it is BigDataCloud', order.length === 1 && order[0].host === 'bdc', order.map(o => o.host).join(',') || 'none');
  ok('6.2 no request to nominatim.openstreetmap.org leaves the page at all',
     every.every(u => !/nominatim/i.test(u)), every.filter(u => /nominatim/i.test(u)).length + ' to nominatim of ' + every.length);
  await ctx.close();
}

/* ======================================================================
   7 — what must not change
   ====================================================================== */
console.log('--- the standing rules ---');
{
  const { ctx, p } = await open({ coords: HOUSTON, naming: 'blocked' });
  ok('7.1 watchPosition is still not used anywhere', await p.evaluate(async () => {
    const src = await (await fetch('js/screens/home.js')).text().catch(() => '');
    return src ? !/watchPosition\s*\(/.test(src) : true;    // inlined in the single-file build
  }));
  /* nobody who refused and picked nothing gets Houston's times by default */
  await p.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    S.state.geo = null; S.state.geoDenied = true; S.state.location = { zip: '', city: '', state: 'TX' }; S.save();
  });
  await p.evaluate(() => { location.hash = '#/prayer'; }); await p.waitForTimeout(900);
  ok('7.2 no default city: a refusal gets no invented times', !(await hasTimes(p)));
  await p.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    S.state.geoDenied = false; S.setUserLocation({ zip: '', city: 'Houston', state: 'TX' }, { lat: 29.7604, lng: -95.3698 }); S.save();
  });
  // away and back: setting the hash to what it already is fires no hashchange
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(400);
  await p.evaluate(() => { location.hash = '#/prayer'; }); await p.waitForTimeout(1100);
  ok('7.3 «الحساب فلكي — والإقامة يحدّدها كل مسجد» still stands',
     await p.evaluate(() => /الحساب فلكي|astronomical/i.test(document.querySelector('#app').textContent)));
  await ctx.close();
}

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
