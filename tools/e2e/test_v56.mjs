/* V.07.9 — a response carrying a redirect does not open an app.

   ⚠️ A FATAL FAULT, LIVE ON THE PUBLISHED BUILD: the app added to an
   iPhone's home screen did not open at all — a white screen and
   «Response served by service worker has redirections». The owner saw it on
   his own phone.

   Three lines in three files made it together:
     manifest.json  start_url = './index.html#/home'
     vercel.json    "cleanUrls": true   → /index.html answers 308 → /
     sw.js          cached 'index.html' and served it for every navigation

   ⚠️ AND WHY ONE TRY NEVER FINDS IT: a service worker does not answer
   until it has cached. The first visit goes to the network and works;
   the visit after it comes from the poisoned cache. So it passes the
   first check and fails at the reader.

   ⚠️ AND THIS SUITE BUILDS ITS OWN HOST THAT REDIRECTS. On a plain
   static server the fault does not exist — which is exactly why it went
   unfound. The rule it leaves: MEASURE WHAT THE SPECIFICATION SAYS, NOT
   WHAT ONE BROWSER TOLERATES. Chromium is lenient on some paths and
   WebKit is not; the reading that settles it is `response.redirected` on
   the cached row, and it says `true` where «does the page open» says
   yes. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const read = f => readFileSync(ROOT + f, 'utf8');

/* ⚠️ ITS OWN HOST, because a server that does not redirect cannot produce
   the fault. `clean: true` reproduces Vercel's `cleanUrls` exactly:
   /index.html answers 308 to /. */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function host(port, clean) {
  const srv = createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (clean && /(^|\/)index\.html$/.test(p)) {
      res.writeHead(308, { Location: p.replace(/index\.html$/, '') });
      return res.end();
    }
    let f = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); } catch (_) { /* */ }
    try {
      const body = await readFile(f);
      res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
      res.end(body);
    } catch (_) { res.writeHead(404); res.end('nope'); }
  });
  /* ⚠️ PORT 0 — THE KERNEL PICKS IT, AND THERE IS NO NUMBER TO COLLIDE.
     `run.sh` runs the two builds AT THE SAME TIME, so a written port made
     the second run die with EADDRINUSE — a CRASH, which reads as a red
     that has nothing to do with what this suite guards. It survived one
     full net only because the two runs happened to drift apart. Same
     family as `test_v36`'s written-in port: a number typed into a check
     is a fault waiting for the day the timing changes. */
  return new Promise(r => srv.listen(0, () => r(srv)));
}
const portOf = srv => srv.address().port;

/* register, wait for the worker, then read the cache itself */
async function probe(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(base + '/index.html#/home', { waitUntil: 'domcontentloaded' });
  /* the app registers on https only — deliberately, so the net's own
     suites are never served stale files — so the probe registers it */
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(2500);
  const cache = await page.evaluate(async () => {
    const rows = [];
    for (const n of await caches.keys()) {
      const c = await caches.open(n);
      for (const req of await c.keys()) {
        const res = await c.match(req);
        rows.push({ url: new URL(req.url).pathname, redirected: !!(res && res.redirected) });
      }
    }
    const idx = await caches.match('index.html');
    return { rows, shell: idx ? { redirected: idx.redirected } : null };
  });
  /* ⚠️ THE SECOND NAVIGATION IS THE TEST. The first always comes from the
     network, which is the whole reason this class hides. */
  let nav2 = 'threw';
  try {
    await page.goto(base + '/index.html#/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    nav2 = await page.evaluate(() => ((document.querySelector('#app') || document.body).innerText || '').trim().length);
  } catch (e) { nav2 = 'threw: ' + e.message.slice(0, 60); }
  await ctx.close();
  return { cache, nav2 };
}

const browser = await chromium.launch();

/* ============ 1 — on a host that redirects, which is production ============ */
console.log('--- the host redirects, exactly as cleanUrls did ---');
{
  const srv = await host(0, true);
  const r = await probe(browser, 'http://localhost:' + portOf(srv));
  const bad = r.cache.rows.filter(x => x.redirected);
  /* ⚠️ THE ONE CHECK THAT WOULD HAVE CAUGHT THIS ON DAY ONE. */
  ok('1.1 no cached row carries a redirect', bad.length === 0,
     bad.map(x => x.url).join(', ') || r.cache.rows.length + ' rows read');
  ok('1.2 the offline shell is clean too',
     r.cache.shell && r.cache.shell.redirected === false, JSON.stringify(r.cache.shell));
  /* the app draws well over a hundred characters on `#/home` */
  ok('1.3 the SECOND navigation opens the app', typeof r.nav2 === 'number' && r.nav2 > 200, String(r.nav2));
  srv.close();
}

/* ============ 2 — and on a host that does not, to prove the difference ============ */
console.log('--- the same tree on a plain server: this is why it went unfound ---');
{
  const srv = await host(0, false);
  const r = await probe(browser, 'http://localhost:' + portOf(srv));
  ok('2.1 everything passes here — the host is the difference',
     r.cache.rows.filter(x => x.redirected).length === 0 &&
     typeof r.nav2 === 'number' && r.nav2 > 200, String(r.nav2));
  srv.close();
}

/* ============ 3 — the three layers, read from the files ============ */
console.log('--- three layers, and not one of them is enough alone ---');
{
  const vercel = JSON.parse(read('vercel.json'));
  ok('3.1 cleanUrls is gone from vercel.json', !('cleanUrls' in vercel));
  ok('3.2 …and trailingSlash is untouched — it has nothing to do with this',
     vercel.trailingSlash === false);
  const sw = read('sw.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('3.3 the guard exists', /const noRedirect = /.test(sw));
  /* ⚠️ BOTH ENDS: guarding the store alone leaves caches already on
     readers' phones poisoned; guarding the answer alone lets it pile up */
  /* every mention minus the one that declares it. ⚠️ Counting
     `noRedirect(` and subtracting one was wrong: the declaration is an
     arrow — `const noRedirect = (res) =>` — so it never matched that
     pattern, and one real call site was subtracted instead. */
  const uses = (sw.match(/noRedirect/g) || []).length - 1;
  ok('3.4 …and it is applied at the store AND at the answer', uses >= 4, uses + ' call sites');
  ok('3.5 …including the offline shell, the exact spot it landed',
     /caches\.match\('index\.html'\)\.then\(noRedirect\)/.test(sw));
  /* the cache name carries the version, and activate deletes every other
     name — so raising APP_VERSION is what erases the poisoned cache */
  /* ⚠️ MY OWN FAULT, AND IT WENT RED ON THE VERY NEXT BATCH. This pinned
     the literal `0.7.9` into the suite, so `490` raising the version to
     `0.8.0` turned it red while nothing was wrong. A check on a mechanism
     must measure the MECHANISM: the cache name carries whatever version
     `js/data.js` holds, and `activate` deletes every other name — that is
     what makes raising the number the eraser, whatever the number is.
     ⚠️ A frozen literal in a check is a red scheduled for a future date. */
  const ver = /APP_VERSION\s*=\s*'([^']+)'/.exec(read('js/data.js'));
  const swman = /SW_VERSION = '([^']+)'/.exec(read('js/sw-manifest.js'));
  ok('3.6 the version is the eraser, and it is read from data.js — not frozen here',
     /const CACHE = 'arabna-' \+ self\.SW_VERSION;/.test(sw) &&
     /caches\.keys\(\)/.test(sw) && /k !== CACHE/.test(sw) &&
     !!ver && !!swman && ver[1] === swman[1],
     ver && swman ? ver[1] + ' == ' + swman[1] : 'unreadable');
}

/* ============ 4 — and what must NOT be touched ============ */
console.log('--- start_url is identity, not a path ---');
{
  const man = JSON.parse(read('manifest.json'));
  /* ⚠️ Changing `start_url` looks like the shortest fix and is the wrong
     one: with no `id` in the manifest, the app's identity is DERIVED from
     `start_url` — so changing it makes the phone treat this as a
     different app, and whoever installed it keeps a dead icon for ever
     and never receives an update. The cure is deleting the redirect, not
     moving the target. */
  ok('4.1 start_url is unchanged, to the character', man.start_url === './index.html#/home', man.start_url);
  ok('4.2 …and there is still no id, which is why 4.1 matters',
     !('id' in man), 'id' in man ? 'id present' : 'no id');
  const sw = read('sw.js');
  /* ⚠️ REVERSED IN V.08.8 (`550`): two network-only hosts, and Nominatim gone
     — disabled in production under Schedule E-08. */
  ok('4.3 the two network-only hosts are present, and Nominatim is gone',
     /api\.zippopotam\.us/.test(sw) && /api\.bigdatacloud\.net/.test(sw) && !/nominatim/i.test(sw));
  ok('4.4 …and the new version still waits for the reader to press',
     !/self\.skipWaiting\(\)/.test(sw.split("addEventListener('install'")[1].split("addEventListener('activate'")[0]));
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
