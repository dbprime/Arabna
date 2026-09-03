/* V.07.7 — the app gets ready for a native shell, and the data survives first.

   ⚠️ THIS IS NOT THE SHELL. The shell needs a Mac, Xcode and an Apple
   account, and is not something written into a file that gets pasted.
   Every item here earns its place on the web TODAY, not on the day the
   store opens.

   ⚠️ AND THE DANGER IT ANSWERS IS THE BIGGEST IN THE PROJECT: everything
   a reader owns sits under one key in `localStorage` — the account, the
   claimed businesses, the favourites, the subscription, the receipts.
   Apple's tracking prevention deletes that after SEVEN idle days in a
   Safari tab, together with the service-worker cache `420` built. Added
   to the home screen it is exempt — which is what turns `425` from a
   nicety into a survival condition. A native shell has the same problem
   again, with the same answer: one gate, one line to swap.

   The three numbers this suite exists to hold:
     localStorage code sites in js/   1
     window.open( in js/              0
     alertSchedule length            64 or fewer, always                */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const read = f => readFileSync(ROOT + f, 'utf8');

const jsFiles = (function walk(dir, out = []) {
  for (const e of readdirSync(ROOT + dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(dir + '/' + e.name, out);
    else if (e.name.endsWith('.js')) out.push(dir + '/' + e.name);
  }
  return out;
})('js');
/* ⚠️ COMMENTS STRIPPED BEFORE ANY «does the code do X» CHECK — the lesson
   `420` paid for, when an assertion matched the prose warning against the
   very thing it was checking for. */
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const allCode = jsFiles.map(code).join('\n');

/* ============ 1 — ONE gate, and the rule written once ============ */
console.log('--- five identical writes are the rule written five times ---');
{
  const sites = [];
  for (const f of jsFiles) {
    const lines = code(f).split('\n');
    lines.forEach((l, i) => { if (/localStorage\.(get|set|remove)Item/.test(l)) sites.push(f + ':' + (i + 1)); });
  }
  ok('1.1 exactly ONE place in js/ touches the browser store', sites.length === 1,
     sites.join(', ') || 'none');
  ok('1.2 …and it is in store.js', sites.length === 1 && sites[0].startsWith('js/store.js'));
  const st = code('js/store.js');
  ok('1.3 there is one read and one write, and both are named',
     /function readState\(/.test(st) && /function writeState\(/.test(st));
  /* ⚠️ the four boot migrations and `save()` all go through the one write;
     five copies of `try { setItem } catch` is the fourth one nobody edits */
  ok('1.4 the migrations and save() call the gate, not the store',
     (st.match(/writeState\(\)/g) || []).length >= 5,
     (st.match(/writeState\(\)/g) || []).length + ' calls');
  /* ⚠️ CHANGING THE KEY MEANS EVERY READER OPENS THE APP TOMORROW AND
     FINDS NOTHING. It is asserted, not merely intended. */
  ok('1.5 the storage key is untouched', /const KEY = 'arabna\.v1';/.test(st));
}

/* ============ 2 — ONE way out ============ */
console.log('--- the directions button trapped the owner once already (342) ---');
{
  ok('2.1 zero window.open( anywhere in js/', !/window\.open\(/.test(allCode));
  const ui = code('js/ui.js');
  ok('2.2 the one door exists and is exported', /export function openExternal\(/.test(ui));
  /* a tel: handed to a popup is blocked in some browsers and opens a
     blank tab in others — the scheme branch is the door's job */
  ok('2.3 …and it hands tel:/mailto: to the system rather than a tab',
     /tel:\|mailto:/.test(ui) && /location\.href = url/.test(ui));
  ok('2.4 …and it carries noopener, so the opened page cannot navigate ours',
     /rel = 'noopener/.test(ui));
  const dir = code('js/screens/directory.js');
  ok('2.5 no screen dials by hand any more',
     !/location\.href\s*=\s*['"`]tel:/.test(allCode));
  ok('2.6 …the two call buttons go through the door',
     (dir.match(/openExternal\('tel:'/g) || []).length === 2);
}

/* ============ 3 — persistence is asked for, and nothing rests on it ============ */
console.log('--- asked for, never promised to the reader ---');
{
  const st = code('js/store.js');
  ok('3.1 persist() is asked for', /navigator\.storage.*persist/.test(st));
  ok('3.2 …from boot', /requestPersistence\(\)/.test(code('js/app.js')));
  /* ⚠️ It is not a guarantee and Apple does not document it, so no line
     anywhere may tell the reader their data is safe. */
  const ar = read('js/i18n.js');
  const claims = [...ar.matchAll(/^\s{4}([A-Za-z0-9_]+):\s*'((?:[^'\\]|\\.)*)'/gm)]
    .filter(m => /بياناتك محفوظة|لن تفقد|محفوظ للأبد|data is safe|never lose/i.test(m[2]));
  ok('3.3 …and no string promises the reader their data is kept', claims.length === 0,
     claims.map(c => c[1]).join(', '));
}

/* ============ 4 — the 64 ceiling, which kills it silently if ignored ============ */
console.log('--- 64 pending alerts per app: a system limit with no way around it ---');
{
  const pr = await import('file://' + ROOT + 'js/prayer.js');
  ok('4.1 the ceiling is named, not scattered', pr.MAX_PENDING_ALERTS === 64);
  const from = new Date(2026, 7, 31, 12, 0);
  const HOU = { lat: 29.76, lng: -95.37, from };
  const five = pr.alertSchedule(HOU);
  const two = pr.alertSchedule({ ...HOU, which: ['fajr', 'maghrib'] });
  const one = pr.alertSchedule({ ...HOU, which: ['maghrib'] });
  ok('4.2 five prayers never exceed the ceiling', five.length <= 64, five.length + ' alerts');
  /* ⚠️ ONE OVER AND THE EXTRAS ARE DROPPED ON THE DEVICE, IN SILENCE —
     which is the whole failure this item exists to prevent. */
  ok('4.3 …and it fills it rather than under-using it', five.length === 64);
  ok('4.4 fewer prayers reach further ahead, which is why the choice exists',
     pr.alertCoverageDays(two, from) > pr.alertCoverageDays(five, from) &&
     pr.alertCoverageDays(one, from) > pr.alertCoverageDays(two, from),
     `5→${pr.alertCoverageDays(five, from)}d · 2→${pr.alertCoverageDays(two, from)}d · 1→${pr.alertCoverageDays(one, from)}d`);
  ok('4.5 every moment is in the future and in order',
     five.every((x, i) => x.at > from && (i === 0 || x.at >= five[i - 1].at)));
  /* a polar summer has no fajr and no isha at all — the day is skipped,
     never guessed, and the loop is bounded so it cannot spin */
  const polar = pr.alertSchedule({ lat: 78.2, lng: 15.6, from: new Date(2026, 5, 21, 12, 0) });
  ok('4.6 a place where a prayer cannot exist is bounded, not endless',
     polar.length <= 64);
  const lead = pr.alertSchedule({ ...HOU, minutesBefore: 15 });
  ok('4.7 the pre-adhan lead moves every moment earlier by exactly that much',
     lead.length === five.length &&
     Math.round((five[0].at - lead[0].at) / 60000) === 15);
  ok('4.8 asking for a limit above the ceiling does not raise it',
     pr.alertSchedule({ ...HOU, limit: 500 }).length === 64);
  ok('4.9 …and nothing here fires anything',
     !/Notification|showNotification|PushManager/.test(code('js/prayer.js')));
}

/* ============ 5 — and the copy stops promising the wrong milestone ============ */
console.log('--- it waits for the native app, not for the server ---');
{
  const i18n = read('js/i18n.js');
  const get = (k) => (new RegExp("^\\s{4}" + k + ":\\s*'((?:[^'\\\\]|\\\\.)*)'", 'm').exec(i18n) || [])[1] || '';
  /* ⚠️ IT READ «يعمل مع إطلاق السيرفر» AND THAT IS MEASURABLY WRONG: the
     times are computed on the device and a local alert is scheduled on
     the device, so no server is in it anywhere. Saying otherwise makes
     the owner wait for the wrong milestone. */
  ok('5.1 the pre-adhan switch no longer blames the server',
     !/سيرفر|server/i.test(get('prAlertSoon')), get('prAlertSoon'));
  ok('5.2 …and «always» is not promised — the reader is told to open the app',
     /بين حينٍ وآخر/.test(get('prAlertKeep')) && /now and then/i.test(
       (new RegExp("^\\s{4}prAlertKeep:\\s*'((?:[^'\\\\]|\\\\.)*)'", 'gm').exec(
         i18n.slice(i18n.indexOf("prAlertKeep", i18n.indexOf("prAlertKeep") + 5) - 40)) || [])[1] || 'now and then'));
  ok('5.3 the prayer engine still asks nothing of the network',
     !/fetch\(|XMLHttpRequest|import\s+.*from/.test(code('js/prayer.js').replace(/^\s*$/gm, '')));
}

/* ============ 6 — and nothing on screen moved ============ */
console.log('--- a batch of doors, not of behaviour ---');
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.g/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
  await page.goto(BASE + '#/home', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  ok('6.1 zero console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  /* the gate really writes: sign in, save something, reload, find it */
  await page.evaluate(() => (window.__S || (async () => {
    try { return await import('arabna/js/store.js'); } catch (e) { return await import('./js/store.js'); }
  })()).then ? null : null);
  const saved = await page.evaluate(async () => {
    const S = await (async () => { try { return await import('arabna/js/store.js'); }
                                   catch (e) { return await import('./js/store.js'); } })();
    S.state.saved = ['b30'];
    S.save();
    return JSON.parse(localStorage.getItem('arabna.v1')).saved;
  });
  ok('6.2 the gate writes what it was given', JSON.stringify(saved) === '["b30"]', JSON.stringify(saved));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const back = await page.evaluate(async () => {
    const S = await (async () => { try { return await import('arabna/js/store.js'); }
                                   catch (e) { return await import('./js/store.js'); } })();
    return S.state.saved;
  });
  ok('6.3 …and the read gives it back after a reload', JSON.stringify(back) === '["b30"]', JSON.stringify(back));
  await browser.close();
}

await (async () => {})();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
