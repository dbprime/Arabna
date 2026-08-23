/* «I moved to another city and the app is still in the first one» — and
   the three that came after the churches file.

   Half the location report was already fixed in V.04.0. What was left is
   two functions, and both are the same mistake in different clothes: the
   app knew where the reader was and did not act on it.

   1. `visibilitychange` does not fire when an app OPENS — the page is born
      visible, so there is no hidden→visible transition. It fires when you
      return to an app that was still running. So a warm return refreshed
      and a cold open never did, which is exactly «sometimes it asks and
      sometimes it doesn't» — and closing the app, travelling and opening
      it again is the ordinary way a phone is used.

   2. The point the device handed us was thrown away when the naming
      service did not answer. Distances and every prayer time are computed
      from `state.geo`, so somebody who moved and could not be named went
      on praying to the timetable of the city they left. That is the V.03.8
      rule living on in a second function: the times need a point and a
      date and nothing else. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const errors = [];
let ctx, page;

const KATY = { lat: 29.7858, lng: -95.8244 };
const SUGAR = { lat: 29.6197, lng: -95.6349 };

/* Every geolocation call is counted, and the naming services can be cut
   off independently — the two halves of the report are exactly "did it
   ask the device" and "did it keep the answer when nobody named it". */
const fresh = async ({ blockNaming = false } = {}) => {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
  if (blockNaming) {
    await ctx.route(/bigdatacloud|nominatim|zippopotam/i, r => r.abort());
  }
  await ctx.addInitScript((pt) => {
    window.__geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (okc) => {
          window.__geoCalls++;
          setTimeout(() => okc({ coords: { latitude: pt.lat, longitude: pt.lng } }), 30);
        },
        watchPosition: () => { throw new Error('watchPosition must never be used'); },
      },
    });
  }, SUGAR);
  page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|ERR_ABORTED|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 130)); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 130)));
};

/* the state the whole report is about: a three-hour-old point in Katy,
   the device in Sugar Land, permission granted long ago */
const seed = async (o = {}) => {
  await page.addInitScript((arg) => {
    const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    s.location = { zip: '', city: 'Katy', state: 'TX', manual: !!arg.manual };
    s.geo = arg.manual ? null : { lat: arg.lat, lng: arg.lng, at: Date.now() - arg.ageMs };
    s.geoGranted = arg.granted;
    s.geoDenied = !!arg.denied;
    s.prayerBar = true; s.prayerBarAsked = true;
    localStorage.setItem('arabna.v1', JSON.stringify(s));
  }, Object.assign({ lat: KATY.lat, lng: KATY.lng, ageMs: 3 * 3600e3, granted: true, manual: false, denied: false }, o));
};
const open = async (hash = '#/home') => { await page.goto(BASE + hash); await page.waitForTimeout(1400); };
const calls = () => page.evaluate(() => window.__geoCalls);
const geo = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}'); return s.geo || null; });
const loc = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}'); return s.location || null; });
const chip = () => page.evaluate(() => { const c = document.querySelector('.loc-chip span'); return c ? c.textContent.trim() : null; });
const near = (g, p) => !!g && Math.abs(g.lat - p.lat) < 0.02 && Math.abs(g.lng - p.lng) < 0.02;

/* ======================================================================
   1 — the cold open reads the device at last
   ====================================================================== */
console.log('--- 1) the cold open ---');
await fresh(); await seed(); await open();
const coldCalls = await calls();
ok('1.1 a cold open asks the device once', coldCalls === 1, String(coldCalls));
ok('1.2 …and the stored point becomes the new one', near(await geo(), SUGAR), JSON.stringify(await geo()));

/* ======================================================================
   2 — the warm return still behaves exactly as it did
   ====================================================================== */
console.log('--- 2) the warm return ---');
/* Start from a FRESH stored point, so the cold open correctly declines to
   read and leaves `lastQuietTry` untouched — the thirty minutes throttles
   the attempt as well as the point, which is what makes "open, close, open
   inside two minutes" one read and not two. Then age the point and return
   to the app. */
await fresh(); await seed({ ageMs: 2 * 60e3 }); await open();
ok('2.0 …and the cold open correctly declined this time', (await calls()) === 0, String(await calls()));
await page.evaluate(async () => {
  const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
  S.state.geo = { lat: 29.7858, lng: -95.8244, at: Date.now() - 3 * 3600e3 };
  S.save();
});
const beforeWarm = await calls();
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(900);
ok('2.1 a warm return still reads once', (await calls()) - beforeWarm === 1, String((await calls()) - beforeWarm));

/* ======================================================================
   3 — thirty minutes governs opens the way it governs returns
   ====================================================================== */
console.log('--- 3) the thirty minutes ---');
await fresh(); await seed({ ageMs: 2 * 60e3 });   // two minutes old
await open();
ok('3.1 a fresh point is not read again on open', (await calls()) === 0, String(await calls()));
ok('3.2 …and the point is left alone', near(await geo(), KATY), JSON.stringify(await geo()));

/* ======================================================================
   4 — the naming services are down, and the point is kept anyway
   ====================================================================== */
console.log('--- 4) the name did not arrive ---');
await fresh({ blockNaming: true }); await seed(); await open();
ok('4.1 the device is still read', (await calls()) === 1, String(await calls()));
ok('4.2 THE POINT IS KEPT even with no name', near(await geo(), SUGAR), JSON.stringify(await geo()));
ok('4.3 the stale name is dropped rather than left as a claim',
   (await loc()).city === '', JSON.stringify(await loc()));
ok('4.4 …and the chip says «موقعك الحالي»', (await chip()) === 'موقعك الحالي', await chip());
/* the reason it matters: both of these read state.geo, not the name */
await page.evaluate(() => { location.hash = '#/prayer'; }); await page.waitForTimeout(900);
ok('4.5 #/prayer computes from the new place, not the old one',
   await page.evaluate(async () => {
     const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
     const p = S.prayerPoint();
     return !!p && Math.abs(p.lng + 95.6349) < 0.02;
   }));

/* ======================================================================
   5 — under three miles the correct name is never wiped
   ====================================================================== */
console.log('--- 5) a short hop keeps the name ---');
await fresh({ blockNaming: true });
/* the stored point is ~1.2 miles from the device's */
await seed({ lat: SUGAR.lat + 0.017, lng: SUGAR.lng });
await open();
ok('5.1 the device was read', (await calls()) === 1, String(await calls()));
ok('5.2 …and the name survives a hop inside the same town',
   (await loc()).city === 'Katy', JSON.stringify(await loc()));

/* ======================================================================
   6 + 7 — a hand-picked city is still nobody's business but its owner's
   ====================================================================== */
console.log('--- 6) the hand-picked city ---');
await fresh(); await seed({ manual: true });
await open();
ok('6.1 a hand-picked city is not moved by a cold open',
   (await loc()).city === 'Katy' && (await loc()).manual === true, JSON.stringify(await loc()));
ok('6.2 …and its point is not written behind their back', (await geo()) === null, JSON.stringify(await geo()));

/* ======================================================================
   7 — clearing the location is a decision, and it has to survive an open
   ====================================================================== */
console.log('--- 7) «امسح الموقع» stays cleared ---');
await fresh(); await seed(); await open();
ok('7.0 the cold open gave us a city to clear', near(await geo(), SUGAR));
await page.evaluate(async () => {
  const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
  S.clearUserLocation();
});
await open();
ok('7.1 a cleared location is not silently refilled',
   (await loc()).city === '' && (await geo()) === null, JSON.stringify(await loc()));
ok('7.2 …and the permission itself is not revoked — iOS is asked once',
   await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}'); return s.geoGranted === true; }));

/* ======================================================================
   the upgrade path: `manual` did not exist before V.04.0
   ====================================================================== */
console.log('--- the reader upgrading from an older build ---');
await fresh();
await page.addInitScript(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
  // a city with no point beside it and no word on where it came from
  s.location = { zip: '', city: 'Katy', state: 'TX' };
  s.geo = null; s.geoGranted = true; s.geoDenied = false;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await open();
ok('8.1 a legacy city with no point is read as hand-picked',
   (await loc()).manual === true, JSON.stringify(await loc()));
ok('8.2 …so a cold open does not overwrite it', (await loc()).city === 'Katy');

/* ======================================================================
   8 + 9 + 10 — the limits the whole feature exists to protect
   ====================================================================== */
console.log('--- 9) refused, and never granted ---');
await fresh(); await seed({ denied: true }); await open();
ok('9.1 a refusal is never read at startup', (await calls()) === 0, String(await calls()));
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(700);
ok('9.2 …nor on a return', (await calls()) === 0, String(await calls()));

await fresh();
await page.addInitScript(() => localStorage.removeItem('arabna.v1'));
await open();
ok('10.1 somebody who never granted is not read at startup', (await calls()) === 0, String(await calls()));
ok('10.2 …and is not asked anything either',
   await page.evaluate(() => !document.querySelector('.sheet-panel')));

/* ======================================================================
   13 — and no extra network call when the condition does not hold
   ====================================================================== */
console.log('--- 13) watchPosition is still banned ---');
ok('13.1 no watchPosition call anywhere in the source', await page.evaluate(async () => {
  for (const f of ['js/screens/home.js', 'js/store.js', 'js/ui.js']) {
    const r = await fetch(f).catch(() => null);
    if (!r || !r.ok) continue;
    // the word appears in the comment forbidding it — look for a CALL
    if (/geolocation\.watchPosition\s*\(/.test(await r.text())) return false;
  }
  return true;
}));

/* ======================================================================
   the churches file: the sentence, the version, and the announced dates
   ====================================================================== */
console.log('--- #/mass asks in its own words ---');
await fresh();
await page.addInitScript(() => localStorage.removeItem('arabna.v1'));
await open('#/mass');
const massTxt = await page.evaluate(() => document.querySelector('#app').textContent.replace(/\s+/g, ' '));
ok('B1.1 #/mass names the churches, not the prayer times', /الكنائس القريبة منك/.test(massTxt)
   && !/لتظهر مواقيت الصلاة/.test(massTxt), (massTxt.match(/حدّد موقعك[^ ]* [^·]{0,40}/) || [''])[0].trim());
await page.evaluate(() => { location.hash = '#/prayer'; }); await page.waitForTimeout(900);
ok('B2.1 #/prayer keeps its own sentence, unchanged',
   /لتظهر مواقيت الصلاة/.test(await page.evaluate(() => document.querySelector('#app').textContent)));

console.log('--- the version number agrees with itself ---');
const vShown = await page.evaluate(async () => {
  const D = await (import('arabna/js/data.js').catch(() => import('./js/data.js')));
  return D.APP_VERSION;
});
/* This is the guard behind the rule the churches file asked for: the
   number has now drifted twice, both times because raising it was a step
   AFTER the batch instead of part of it. «V.04.1» is `0.4.1`. */
const inDoc = await page.evaluate(async () => {
  const r = await fetch('CLAUDE.md').catch(() => null);
  if (!r || !r.ok) return null;
  const m = /Current version: \*\*V\.(\d+)\.(\d+)/.exec(await r.text());
  return m ? `0.${Number(m[1])}.${Number(m[2])}` : 'unparsed';
});
ok('B3.1 APP_VERSION matches the version at the top of CLAUDE.md',
   inDoc === null || inDoc === vShown, `data.js ${vShown} · CLAUDE.md ${inDoc}`);
await page.evaluate(() => { location.hash = '#/home'; }); await page.waitForTimeout(700);
const drawerV = await page.evaluate(async () => {
  const m = document.querySelector('#hMenu');
  if (m) m.click();
  await new Promise(r => setTimeout(r, 500));
  const el = document.querySelector('.dr-version');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
});
ok('B3.2 …and it is what the drawer prints', drawerV.includes(vShown), drawerV);
await page.keyboard.press('Escape'); await page.waitForTimeout(400);

console.log('--- the hand beats the arithmetic ---');
const feastRow = () => page.evaluate(() => {
  const r = [...document.querySelectorAll('.feast-row')]
    .find(x => /رمضان/.test(x.querySelector('.row-title').textContent));
  return r ? { at: r.querySelector('.ltr').textContent.trim(), est: !!r.querySelector('.feast-est') } : null;
});
const eidRow = () => page.evaluate(() => {
  const r = [...document.querySelectorAll('.feast-row')]
    .find(x => /الفطر/.test(x.querySelector('.row-title').textContent));
  return r ? { at: r.querySelector('.ltr').textContent.trim(), est: !!r.querySelector('.feast-est') } : null;
});
await page.evaluate(() => { location.hash = '#/mass'; }); await page.waitForTimeout(900);
const beforeRam = await feastRow();
ok('B4.1 with nothing written, Ramadan is computed and says «تقديري»',
   !!beforeRam && beforeRam.est === true, JSON.stringify(beforeRam));

const setDates = async (from, eid) => page.evaluate(async (a) => {
  const S = await (import('arabna/js/store.js').catch(() => import('./js/store.js')));
  S.setRamadanDates(a[0], a[1]);
}, [from, eid]);
/* a date inside the window the block shows */
const year = new Date().getUTCFullYear() + (new Date().getUTCMonth() > 1 ? 1 : 0);
await setDates(`${year}-02-08`, `${year}-03-10`);
await page.evaluate(() => { location.hash = '#/prayer'; }); await page.waitForTimeout(400);
await page.evaluate(() => { location.hash = '#/mass'; }); await page.waitForTimeout(900);
const withRam = await feastRow(), withEid = await eidRow();
ok('B4.2 a written date is printed as given', !!withRam && /8/.test(withRam.at), JSON.stringify(withRam));
ok('B4.3 …and «تقديري» is dropped from it', !!withRam && withRam.est === false, JSON.stringify(withRam));
ok('B4.4 a written Eid is settled too', !!withEid && withEid.est === false, JSON.stringify(withEid));
ok('B4.5 …but Adha stays an estimate, because nobody wrote it',
   await page.evaluate(() => {
     const r = [...document.querySelectorAll('.feast-row')]
       .find(x => /الأضحى/.test(x.querySelector('.row-title').textContent));
     return !r || !!r.querySelector('.feast-est');
   }));

await setDates('', '');
await page.evaluate(() => { location.hash = '#/prayer'; }); await page.waitForTimeout(400);
await page.evaluate(() => { location.hash = '#/mass'; }); await page.waitForTimeout(900);
const cleared = await feastRow();
ok('B5.1 clearing the dates brings the estimate back',
   !!cleared && cleared.est === true && cleared.at === beforeRam.at, JSON.stringify(cleared));

ok('B6.1 the calendar still imports nothing and fetches nothing',
   await page.evaluate(async () => {
     const r = await fetch('js/feasts.js').catch(() => null);
     if (!r || !r.ok) return true;
     const src = await r.text();
     return !/^import\s/m.test(src) && !/fetch\(|XMLHttpRequest|import\(/.test(src);
   }));

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
