import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
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

/* V.03.1 — batch seven (a): the location, and the prayer times
   Rebuilt after a container reset. Every reference value below is the one
   CLAUDE.md records for this batch. */

const setLoc = async (city, lat, lng, at) => {
  await page.evaluate(([c, la, ln, a]) => {
    const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    s.geo = { lat: la, lng: ln, at: a };
    s.location = { city: c, lat: la, lng: ln, inRegion: true };
    s.radius = 100;
    localStorage.setItem('arabna.v1', JSON.stringify(s));
  }, [city, lat, lng, at]);
  await page.reload(); await page.waitForTimeout(800);
  await mods();
};

await page.goto(BASE); await page.waitForTimeout(800);
await mods();

/* ---- 1. the ZIP names the city; nearestCity only fills a gap ---- */
console.log('--- the ZIP wins ---');
/* 77036 is the same shape as Rai's 77407 and is in the offline table: the
   ZIP resolves to Houston while the nearest covered centre is Bellaire. */
ok('1.1 the resolved city wins when the directory covers it',
   await page.evaluate(() => {
     const { H, D } = window.__m;
     const z = D.ZIPS['77036'];
     const near = window.__m.S.nearestCity({ lat: z.lat, lng: z.lng });
     return z.city === 'Houston' && near.city !== 'Houston'
         && H.cityNameFor(z, near) === 'Houston';
   }));
ok('1.2 …and nearestCity is consulted only when it does not',
   await page.evaluate(() => {
     const H = window.__m.H;
     return H.cityNameFor({ city: 'Nowhere' }, { city: 'Katy' }) === 'Katy'
         && H.cityNameFor({ city: 'Nowhere' }, null) === 'Nowhere';
   }));
ok('1.3 both places resolve it through the one function', await page.evaluate(async () => {
  const src = await (await fetch('/js/screens/home.js')).text();
  // one definition, two call sites, and no second copy of the rule
  return (src.match(/cityNameFor\(/g) || []).length === 3
      && (src.match(/CITY_POINTS\.some/g) || []).length === 1;
}));
ok('1.4 inRegion still comes from nearestCity — coverage is not the name',
   await page.evaluate(async () => {
     const src = await (await fetch('js/screens/home.js')).text();
     return /inRegion:\s*!!near/.test(src);
   }));

/* ---- 2. the quiet refresh, and no tracking ---- */
console.log('--- the quiet refresh ---');
/* The single-file build serves one HTML document, but the source files are
   still on the same origin, so fetching them checks the real source either
   way. A build that could not reach them would fail loudly here. */
ok('2.1 watchPosition is never used, anywhere', await page.evaluate(async () => {
  for (const f of ['js/screens/home.js', 'js/app.js', 'js/store.js', 'js/ui.js']) {
    const r = await fetch('/' + f);
    if (!r.ok) return false;
    // the word appears in the comment forbidding it — look for a CALL
    if (/watchPosition\s*\(/.test(await r.text())) return false;
  }
  return true;
}));
/* V.04.0 split one flag into two: "the permission was granted once" and
   "we hold a point now" are different facts, because choosing a city by
   hand deliberately clears the point — and gating the quiet refresh on the
   POINT is what froze Rai's city on Houston for good. So the fixture has
   to say both, as the real flow does. */
const stale = (mins) => page.evaluate((m) => {
  const { H, S } = window.__m;
  S.state.geo = { lat: 29.76, lng: -95.37, at: Date.now() - m * 60000 };
  S.state.geoDenied = false;
  S.state.geoGranted = true;
  return H.shouldRefreshGeo();
}, mins);
const five = await stale(5), hour = await stale(60);
ok('2.2 a point five minutes old is not read again', five === false, String(five));
ok('2.3 …one an hour old is', hour === true, String(hour));
ok('2.4 a refusal is never asked again', await page.evaluate(() => {
  const { H, S } = window.__m;
  S.state.geo = { lat: 29.76, lng: -95.37, at: Date.now() - 3600000 };
  S.state.geoGranted = true;
  S.state.geoDenied = true;
  return H.shouldRefreshGeo() === false;
}));
/* V.04.0: "never granted" is `geoGranted === false` now, not "there is no
   point" — the two were one flag and separating them is the batch. The
   limit itself is unchanged and is the one the whole thing exists to
   protect: a reader who never allowed it is never read and never asked. */
ok('2.5 somebody who never granted it is never asked either', await page.evaluate(() => {
  const { H, S } = window.__m;
  S.state.geo = null; S.state.geoDenied = false; S.state.geoGranted = false;
  return H.shouldRefreshGeo() === false;
}));

/* ---- 3. the arithmetic ---- */
console.log('--- the arithmetic ---');
const times = (o) => page.evaluate((x) => {
  const P = window.__m.P;
  const t = P.prayerTimes({
    lat: 29.7604, lng: -95.3698,
    date: new Date(x.y, x.m - 1, x.d, 12, 0, 0),
    tzOffsetMinutes: x.tz, method: x.method, asrShadow: x.asr || 1,
  });
  const hhmm = (v) => v == null ? '—'
    : String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(Math.round(v % 60)).padStart(2, '0');
  return { fajr: hhmm(t.fajr), sunrise: hhmm(t.sunrise), dhuhr: hhmm(t.dhuhr),
           asr: hhmm(t.asr), maghrib: hhmm(t.maghrib), isha: hhmm(t.isha) };
}, o);
const near = (a, b) => {
  const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number);
  return Math.abs((ah * 60 + am) - (bh * 60 + bm)) <= 1;
};
const aug = await times({ y: 2026, m: 8, d: 20, tz: -300, method: 'isna' });
ok('3.1 20 Aug · ISNA · fajr 05:43', near(aug.fajr, '05:43'), aug.fajr);
ok('3.2 …sunrise 06:52', near(aug.sunrise, '06:52'), aug.sunrise);
ok('3.3 …dhuhr 13:25', near(aug.dhuhr, '13:25'), aug.dhuhr);
ok('3.4 …asr 17:01', near(aug.asr, '17:01'), aug.asr);
ok('3.5 …maghrib 19:58', near(aug.maghrib, '19:58'), aug.maghrib);
ok('3.6 …isha 21:07', near(aug.isha, '21:07'), aug.isha);
const jaf = await times({ y: 2026, m: 8, d: 20, tz: -300, method: 'jafari' });
ok('3.7 jafari puts maghrib at 20:13, four degrees under', near(jaf.maghrib, '20:13'), jaf.maghrib);
ok('3.8 …and fajr at 05:38', near(jaf.fajr, '05:38'), jaf.fajr);
const hanafi = await times({ y: 2026, m: 8, d: 20, tz: -300, method: 'isna', asr: 2 });
ok('3.9 the hanafi asr is 18:05', near(hanafi.asr, '18:05'), hanafi.asr);
const dec = await times({ y: 2026, m: 12, d: 21, tz: -360, method: 'isna' });
ok('3.10 21 Dec · fajr 06:02', near(dec.fajr, '06:02'), dec.fajr);
ok('3.11 …maghrib 17:26', near(dec.maghrib, '17:26'), dec.maghrib);
ok('3.12 …isha 18:37', near(dec.isha, '18:37'), dec.isha);
ok('3.13 the order holds every day of the year, in every method', await page.evaluate(() => {
  const P = window.__m.P;
  for (const method of ['isna', 'mwl', 'makkah', 'jafari']) {
    for (const asr of [1, 2]) {
      for (let d = 0; d < 365; d += 1) {
        const date = new Date(2026, 0, 1 + d, 12);
        const t = P.prayerTimes({ lat: 29.7604, lng: -95.3698, date, tzOffsetMinutes: -360, method, asrShadow: asr });
        const seq = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha];
        if (seq.some(v => v == null)) continue;
        for (let i = 1; i < seq.length; i++) if (seq[i] <= seq[i - 1]) return false;
      }
    }
  }
  return true;
}));
ok('3.14 a time that cannot exist is null, never an invented number',
   await page.evaluate(() => {
     const P = window.__m.P;
     const t = P.prayerTimes({ lat: 69.65, lng: 18.96, date: new Date(2026, 5, 21, 12),
                               tzOffsetMinutes: 120, method: 'isna', asrShadow: 1 });
     return t.fajr === null || t.isha === null;
   }));
ok('3.15 no library and no network — the file imports nothing',
   await page.evaluate(async () => {
     const src = await (await fetch('/js/prayer.js')).text();
     return !/^import /m.test(src) && !/fetch\(/.test(src);
   }));
ok('3.16 …and starts no timer of its own', await page.evaluate(async () => {
  const a = await (await fetch('/js/prayer.js')).text();
  const b = await (await fetch('/js/screens/prayer.js')).text();
  return !/setInterval/.test(a) && !/setInterval/.test(b);
}));

/* ---- 4. where it shows ---- */
console.log('--- the four placements ---');
await setLoc('Houston', 29.7604, -95.3698, Date.now());
await go('#/home');
/* V.04.0: the bar is asked for once, with a card, on the very first open —
   hiding it by default means nobody finds it, and showing it forever to
   somebody who does not want it is the other failure. Answer it, as every
   real reader has by their second open, and then measure the bar. */
await page.evaluate(() => { const b = document.querySelector('#prAskYes'); if (b) b.click(); });
await page.waitForTimeout(600);
await go('#/prayer'); await go('#/home');
ok('4.1 one line under the header', await page.locator('.pr-bar').count() === 1);
ok('4.2 …and it is one line, not a band',
   await page.evaluate(() => Math.round(document.querySelector('.pr-bar').getBoundingClientRect().height)) <= 56,
   await page.evaluate(() => Math.round(document.querySelector('.pr-bar').getBoundingClientRect().height)) + 'px');
ok('4.3 it opens the full screen', await page.getAttribute('.pr-bar', 'data-route') === '#/prayer');
await go('#/prayer');
ok('4.4 five prayers and the sunrise between them',
   await page.locator('.pr-row').count() >= 6, String(await page.locator('.pr-row').count()));
/* V.03.9: this asserted `=== 1` unconditionally and was therefore
   time-of-day dependent — it fails every evening after isha, when the
   next prayer is TOMORROW's fajr and the screen deliberately marks no
   row (`!nx.tomorrow`). Marking today's fajr, hours after it passed,
   would be the actual bug. The invariant is: exactly one row when the
   next prayer is today, none when it is tomorrow's — and the card above
   says «غداً» either way. Nothing in this batch touched that path; the
   check had simply never run late enough in the day. */
{
  const tomorrow = /غد|Tomorrow/i.test(await page.textContent('.pr-next'));
  const marked = await page.locator('.pr-row.next').count();
  ok('4.5 the next one is picked out — and only when it is today\'s',
     tomorrow ? marked === 0 : marked === 1,
     (tomorrow ? "tomorrow's fajr, " : 'today, ') + marked + ' marked');
}
ok('4.6 the standing line: the calculation is astronomical, the iqama is not',
   /حساب فلكي|astronomical/.test(await txt()));
ok('4.7 a drawer row, not a sixth tab — the bar still holds five',
   await page.evaluate(() => document.querySelectorAll('.nav-item').length) === 5,
   String(await page.evaluate(() => document.querySelectorAll('.nav-item').length)));

/* outside the region the times work and the directory says so */
await setLoc('Dallas', 32.7767, -96.7970, Date.now());
await go('#/prayer');
ok('4.8 out of coverage the times still work', await page.locator('.pr-row').count() >= 6);
ok('4.9 …«mosques near you» is hidden, never empty',
   await page.locator('.pr-mosques .list-row').count() === 0);
/* V.04.5 REVERSED the wording deliberately. The line used to name
   Houston; it says «مناطق محدَّدة» now, because a sentence that lists the
   covered areas grows every time one opens — it reads with one, nags with
   three and is skipped with six. The names live in a sheet that opens.
   What this check was really guarding is unchanged and is what it asserts
   now: the reader out of coverage is TOLD, in a line, rather than left to
   wonder. */
ok('4.10 …and one honest line says the coverage is limited',
   /مناطق محدَّدة|certain areas/.test(await txt()),
   ((await txt()).match(/.{0,20}(مناطق محدَّدة|certain areas).{0,20}/) || [''])[0]);

/* ---- 5. the mosque's own times ---- */
console.log('--- jumuah and iqama ---');
await setLoc('Houston', 29.7604, -95.3698, Date.now());
ok('5.1 every place of worship now says which it is', await page.evaluate(() => {
  const { S } = window.__m;
  const w = S.allBusinesses().filter(b => b.cat === 'worship');
  return w.length > 0 && w.every(b => S.worshipKind(b) !== null);
}));
const kinds = await page.evaluate(() => {
  const { S } = window.__m;
  const w = S.allBusinesses().filter(b => b.cat === 'worship');
  return { m: w.filter(b => S.worshipKind(b) === 'mosque').length,
           c: w.filter(b => S.worshipKind(b) === 'church').length };
});
ok('5.2 23 mosques', kinds.m === 23, String(kinds.m));
ok('5.3 12 churches', kinds.c === 12, String(kinds.c));
ok('5.4 the kind is read from the record, never guessed from the name',
   await page.evaluate(async () => {
     const src = await (await fetch('/js/store.js')).text();
     const fn = src.slice(src.indexOf('export function worshipKind'), src.indexOf('export function isMosque'));
     return !/name/.test(fn);
   }));
await go('#/directory/b11');
ok('5.5 the adhan and the iqama are two separate headings',
   /الأذان|Adhan/.test(await txt()) && /الإقامة|Iqama/.test(await txt()));
await go('#/directory/b218');
ok('5.6 where nothing is published it says so and invents no time',
   /غير متوفّر|not published/.test(await txt()));
await go('#/directory/b11');
ok('5.7 anyone can offer a correction', await page.locator('[data-timefix]').count() >= 1);
await page.locator('[data-timefix]').first().click(); await page.waitForTimeout(500);
await page.fill('#wfIn', 'الجمعة 1:45');
await page.click('#wfGo'); await page.waitForTimeout(700);
ok('5.8 …it goes to the review queue',
   await page.evaluate(() => window.__m.S.pendingWorshipFixes().length === 1));
ok('5.9 …and it does NOT change the listing', await page.evaluate(() => {
  const b = window.__m.S.businessById('b11');
  return !/1:45/.test(JSON.stringify(b.worship || {}));
}));

await go('#/home');
ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
