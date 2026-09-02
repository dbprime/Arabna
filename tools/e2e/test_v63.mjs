/* V.08.8 — Nominatim is disabled in production: no call, no host in CSP,
   none in sw.js. Schedule E-08 of the Founder Agreement.

   ⚠️ «Disabled» means: no code calls it AND no host permits it. A function
   behind a switch is one line from coming back unnoticed; a host removed
   from `connect-src` means the browser itself refuses it should that line
   ever be written. The evidence for the lawyer is the second.

   Measured before this batch: `reverseGeocode` asked BigDataCloud and
   Nominatim together at every location fix, and the silent refresh on
   return to the foreground reached Nominatim too. BigDataCloud stays
   alone — its policy is written for exactly this use: the device's own
   coordinates, from the client, no key, no attribution. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ THE CODE, NEVER THE PROSE ABOUT THE CODE — the `test_v53` rule. The
   comments that explain WHY Nominatim is gone have to name it, and a
   check that read them would go red on its own guard. */
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/* ============ 1 — the source ============ */
{
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + e.name + '/') : e.name.endsWith('.js') ? [d + e.name] : []);
  const files = [...walk(ROOT + 'js/').map(f => f.slice(ROOT.length)), 'index.html', 'vercel.json', 'sw.js'];
  const hits = files.filter(f => /nominatim/i.test(strip(read(f))));
  ok('1.1 no nominatim in the code of js/, index.html, vercel.json, sw.js (comments stripped)', hits.length === 0, hits.join(', ') || '0 files');
  const csp = (f) => (/connect-src ([^;"]*)/.exec(read(f)) || [])[1];
  ok('1.2 connect-src is identical in index.html and vercel.json, and carries no such host',
     !!csp('index.html') && csp('index.html') === csp('vercel.json') && !/nominatim/i.test(csp('index.html')), csp('index.html'));
}

const HOUSTON = { latitude: 29.7604, longitude: -95.3698 };
const browser = await chromium.launch();
async function scene({ bdc = 'ok', state = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: HOUSTON, permissions: ['geolocation'] });
  await ctx.addInitScript((st) => {
    const K = 'arabna.v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    Object.assign(s, { lang: 'ar', showDemo: false, demoDefaultOff: true }, st);
    localStorage.setItem(K, JSON.stringify(s));
  }, state);
  const page = await ctx.newPage();
  const every = [];
  page.on('request', r => every.push(r.url()));
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.route(u => /bigdatacloud/.test(String(u)), r => bdc === 'ok'
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ countryCode: 'US', city: 'Houston', principalSubdivisionCode: 'US-TX', postcode: '77081' }) })
    : r.abort());
  await page.route(u => /zippopotam/.test(String(u)), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [{ 'place name': 'Houston', 'state abbreviation': 'TX' }] }) }));
  await page.route(u => /nominatim/i.test(String(u)), r => r.abort());   // if it were ever asked, it would show in `every`
  await page.goto(BASE + '#/home', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800);
  return { page, ctx, every };
}
/* the same door v31 uses: the prayer screen's own location button, then
   the app's «سماح» line in front of the system dialog */
const allow = async (page) => {
  await page.evaluate(() => { location.hash = '#/prayer'; }); await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('#prLoc').click()); await page.waitForTimeout(400);
  await page.evaluate(() => { const y = document.querySelector('#geoYes'); if (y) y.click(); });
  await page.waitForTimeout(2500);
};
const nom = (every) => every.filter(u => /nominatim/i.test(u)).length;
const bdcN = (every) => every.filter(u => /bigdatacloud/.test(u)).length;

/* ============ 2 — a location fix, provider answering ============ */
{
  const { page, ctx, every } = await scene({ bdc: 'ok' });
  await allow(page);
  const city = await page.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    return (S.state.location || {}).city || '';
  });
  ok('2.1 a location fix sends zero requests to nominatim.openstreetmap.org', nom(every) === 0, `${nom(every)} of ${every.length} · bdc ${bdcN(every)}`);
  ok('2.2 …and the city arrives from BigDataCloud alone', city === 'Houston' && bdcN(every) >= 1, city || '(no city)');
  await ctx.close();
}
/* ============ 3 — BigDataCloud down: no hidden fallback ============ */
{
  const { page, ctx, every } = await scene({ bdc: 'down' });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await allow(page);
  const r = await page.evaluate(async () => {
    const S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    return { city: (S.state.location || {}).city || '', geo: !!(S.state.geo && S.state.geo.lat) };
  });
  ok('3.1 with BigDataCloud down: no city, no page error, and the point is kept', r.city === '' && errs.length === 0 && r.geo, `city '${r.city}' · geo ${r.geo} · errors ${errs.length}`);
  ok('3.2 …and still zero requests to nominatim — no hidden fallback', nom(every) === 0, `${nom(every)} to nominatim`);
  await ctx.close();
}
/* ============ 4 — the silent refresh ============ */
{
  const stale = Date.now() - 31 * 60 * 1000;
  const { ctx, every } = await scene({ bdc: 'ok', state: { geoGranted: true, geo: { lat: 29.7, lng: -95.3, at: stale }, location: { city: 'Katy', state: 'TX', manual: false, zip: '' } } });
  await new Promise(r => setTimeout(r, 2500));
  ok('4.1 the silent refresh on a cold open asks BigDataCloud once and nominatim never', bdcN(every) === 1 && nom(every) === 0, `bdc ${bdcN(every)} · nominatim ${nom(every)}`);
  await ctx.close();
}
/* ============ 6 — the CSP the page actually runs under ============ */
{
  const { page, ctx } = await scene({ bdc: 'ok' });
  const meta = await page.evaluate(() => { const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]'); return m ? m.getAttribute('content') : ''; });
  ok('6.1 the live CSP meta carries no nominatim host — read from the document', !!meta && !/nominatim/i.test(meta) && /api\.bigdatacloud\.net/.test(meta));
  await ctx.close();
}
/* ============ 5 — the single-file build ============ */
{
  const one = read('index-single-file.html');
  const cspOne = (/connect-src ([^;"]*)/.exec(one) || [])[1] || '';
  ok('5.1 the single-file build carries the same connect-src, without the host', !!cspOne && !/nominatim/i.test(cspOne) && /bigdatacloud/.test(cspOne), cspOne);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
