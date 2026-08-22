/* Post-batch-four fixes — six items:
   1 back restores the scroll · 2 no option twice in the filter sheet ·
   3 the footer never covers the last group · 4 the radius control ·
   5 the open/closed badge keeps time · 6 location, distance and the cities */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|fonts\.googleapis/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]));

const go = async (h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(450); };
const txt = () => page.textContent('#app');
const ls = () => page.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1') || '{}'));
const S = (fn, arg) => page.evaluate(async ([f, a]) => {
  // the single-file build carries the same module under an importmap name
  let M;
  try { M = await import('arabna/js/store.js'); } catch (e) { M = await import('/js/store.js'); }
  return (new Function('S', 'a', 'return (' + f + ')(S, a)'))(M, a);
}, [fn.toString(), arg]);

/* geolocation is stubbed rather than granted: the point of the sixth fix is
   *when* the browser is asked, so the test has to be able to count the calls */
const stubGeo = async (mode = 'ok', coords = { latitude: 29.7604, longitude: -95.3698 }) => {
  await page.addInitScript(([m, c]) => {
    window.__geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(okCb, errCb) {
          window.__geoCalls++;
          if (m === 'ok') setTimeout(() => okCb({ coords: c }), 30);
          else if (m === 'denied') setTimeout(() => errCb({ code: 1, message: 'denied' }), 30);
          else setTimeout(() => errCb({ code: 3, message: 'timeout' }), 30);
        },
      },
    });
    // the reverse lookup goes over the network; the test owns the answer
    const realFetch = window.fetch;
    window.fetch = (u, o) => {
      const s = String(u);
      if (s.includes('bigdatacloud')) return Promise.resolve(new Response(JSON.stringify(
        { countryCode: 'US', city: 'Houston', principalSubdivisionCode: 'US-TX', postcode: '77036' }),
        { headers: { 'content-type': 'application/json' } }));
      if (s.includes('zippopotam')) return Promise.resolve(new Response(JSON.stringify(
        { places: [{ 'place name': 'Houston', 'state abbreviation': 'TX' }] }),
        { headers: { 'content-type': 'application/json' } }));
      return realFetch(u, o);
    };
  }, [mode, coords]);
};

await stubGeo('ok');
await page.goto(BASE);
await page.waitForTimeout(700);

/* ============ 1 — back restores the position ============ */
await go('#/directory');
await page.waitForTimeout(400);
await page.evaluate(() => { document.getElementById('app').scrollTop = 1400; });
await page.waitForTimeout(260);
const savedAt = await page.evaluate(() => document.getElementById('app').scrollTop);
const firstRow = await page.getAttribute('#dirList .list-row[data-route^="#/directory/"]', 'data-route');
await go(firstRow);
const afterOpen = await page.evaluate(() => document.getElementById('app').scrollTop);
await page.goBack(); await page.waitForTimeout(700);
const restored = await page.evaluate(() => document.getElementById('app').scrollTop);
ok('1.1 the directory scrolled', savedAt > 1000, String(savedAt));
ok('1.2 the listing opens at the top', afterOpen < 60, String(afterOpen));
ok('1.3 back restores the position', Math.abs(restored - savedAt) < 120, restored + ' vs ' + savedAt);
ok('1.4 the scroll is not filed under the wrong key', restored > 1000, String(restored));

/* ============ 2 — no option twice in the filter sheet ============ */
await go('#/directory?cat=restaurants');
await page.click('#dirFilter'); await page.waitForTimeout(450);
const ids = await page.evaluate(() => [...document.querySelectorAll('.sheet-panel [data-a]')].map(b => b.dataset.a));
const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
ok('2.1 the sheet offers options', ids.length > 4, ids.length + ' options');
ok('2.2 no option appears twice', dupes.length === 0, dupes.join(',') || 'none');
const topIds = await page.evaluate(() => {
  const lab = [...document.querySelectorAll('.sheet-panel .label')].find(l => /الأكثر|Most used/.test(l.textContent));
  return lab ? [...lab.nextElementSibling.querySelectorAll('[data-a]')].map(b => b.dataset.a) : [];
});
ok('2.3 "most used" is not a copy of the groups', topIds.length > 0 && topIds.every(id => ids.filter(x => x === id).length === 1), topIds.join(','));
ok('2.4 an attribute on 85% of the category does not lead it', !topIds.includes('arabicSpoken'), topIds[0] || '');

/* ============ 3 — the footer never covers the last group ============ */
const geom = await page.evaluate(() => {
  const panel = document.querySelector('.sheet-panel');
  const body = panel.querySelector('.sheet-body');
  const foot = panel.querySelector('.sheet-foot');
  const groups = [...body.querySelectorAll('.attr-pick')];
  const last = groups[groups.length - 1];
  body.scrollTop = body.scrollHeight;
  return {
    footIsSibling: foot.parentElement === panel,
    footInBody: !!body.querySelector('.sheet-foot'),
    column: getComputedStyle(panel).flexDirection,
    bodyScrolls: getComputedStyle(body).overflowY,
    lastBottom: last.getBoundingClientRect().bottom,
    footTop: foot.getBoundingClientRect().top,
  };
});
ok('3.1 the footer is a sibling of the body', geom.footIsSibling && !geom.footInBody);
ok('3.2 the panel is a column', geom.column === 'column', geom.column);
ok('3.3 the body is the only thing that scrolls', geom.bodyScrolls === 'auto' || geom.bodyScrolls === 'scroll', geom.bodyScrolls);
ok('3.4 the last group clears the footer', geom.lastBottom <= geom.footTop + 1, Math.round(geom.lastBottom) + ' vs ' + Math.round(geom.footTop));

/* ============ 4 — the radius control ============ */
const areaOpts = await page.evaluate(() => [...document.querySelectorAll('#fArea .chip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
ok('4.1 the radius slider is gone from the directory', await page.evaluate(() => !document.querySelector('#fRad')));
ok('4.2 the area is a set of options', areaOpts.length >= 1, areaOpts.join(' | '));
ok('4.3 every option carries its count', areaOpts.every(o => /\d/.test(o)), areaOpts[0]);
ok('4.4 no mile option while nothing is geocoded', !areaOpts.some(o => /ميل|mi/.test(o)), areaOpts.join(' | '));
ok('4.5 the way to get a location is in the sheet', await page.evaluate(() => !!document.querySelector('#fLoc')));
await page.evaluate(() => document.querySelector('.sheet-scrim, [data-close]')?.click());
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

/* ============ 5 — the open/closed badge keeps time ============ */
await page.clock.install({ time: new Date('2026-08-19T21:40:00-05:00') });
await page.goto(BASE); await page.waitForTimeout(600);
await go('#/directory?cat=restaurants');
await page.waitForTimeout(400);
const badgeBefore = await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-openbadge]')].find(x => x.textContent.trim());
  return b ? { id: b.dataset.openbadge, text: b.textContent.trim() } : null;
});
await page.evaluate(() => { document.getElementById('app').scrollTop = 600; });
await page.clock.fastForward('13:35:00');
await page.waitForTimeout(500);
const after = await page.evaluate((id) => {
  const b = document.querySelector(`[data-openbadge="${id}"]`);
  return { text: b ? b.textContent.trim() : null, scroll: document.getElementById('app').scrollTop };
}, badgeBefore && badgeBefore.id);
ok('5.1 there is a live badge', !!badgeBefore, badgeBefore && badgeBefore.text);
ok('5.2 it rewrites itself as the hours pass', after.text !== (badgeBefore && badgeBefore.text), (badgeBefore && badgeBefore.text) + ' -> ' + after.text);
ok('5.3 the list is not rebuilt under the reader', Math.abs(after.scroll - 600) < 40, String(after.scroll));
const tickStops = await page.evaluate(async () => {
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('focus'));
  await new Promise(r => setTimeout(r, 120));
  return !!document.querySelector('[data-openbadge]');
});
ok('5.4 focus and visibility recompute without error', tickStops);

/* ============ 6 — location ============ */
await page.clock.runFor(0);
await page.goto(BASE); await page.waitForTimeout(700);

/* a. the chip starts empty, everywhere */
const homeChip = (await page.textContent('#locBtn')).trim();
const homeCls = await page.evaluate(() => document.querySelector('#locBtn').className);
ok('6.1 the home chip asks instead of guessing', homeChip === 'حدّد موقعك', homeChip);
ok('6.2 it is marked as unset', /unset/.test(homeCls), homeCls);
await go('#/directory');
ok('6.3 the directory chip is the same', (await page.textContent('[data-loc]')).trim() === 'حدّد موقعك');
await go('#/marketplace');
ok('6.4 the marketplace chip is the same', (await page.textContent('[data-loc]')).trim() === 'حدّد موقعك');

/* b. nothing asks the browser at launch */
ok('6.5 no location request at launch', await page.evaluate(() => window.__geoCalls) === 0);

/* c. the pre-prompt stands in front of the system dialog */
await go('#/directory');
await page.click('[data-loc]'); await page.waitForTimeout(450);
await page.click('#geoBtn'); await page.waitForTimeout(400);
const promptText = await page.textContent('.sheet-panel');
ok('6.6 a line of our own comes first', /لنعرض لك أقرب المحلات/.test(promptText));
ok('6.7 it offers both answers', await page.evaluate(() => !!document.querySelector('#geoYes') && !!document.querySelector('#geoNo')));
ok('6.8 the browser has still not been asked', await page.evaluate(() => window.__geoCalls) === 0);
await page.click('#geoNo'); await page.waitForTimeout(350);
ok('6.9 "not now" asks nothing at all', await page.evaluate(() => window.__geoCalls) === 0);

/* d. the city list, with real counts */
await page.click('[data-loc]'); await page.waitForTimeout(450);
const cityChips = await page.evaluate(() => [...document.querySelectorAll('#cityPick .chip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
ok('6.10 every city the directory covers is listed', cityChips.length >= 24, cityChips.length + ' options');
ok('6.11 the whole area is the first choice', /كل المنطقة 514/.test(cityChips[0]), cityChips[0]);
ok('6.12 Houston carries its real count', cityChips.some(c => /^Houston 376$/.test(c)), cityChips[1]);
ok('6.13 Katy carries its real count', cityChips.some(c => /^Katy 39$/.test(c)));
ok('6.14 the privacy line is on the sheet', /موقعك يبقى على جهازك/.test(await page.textContent('.sheet-panel')));

/* e. a city picked by hand: no permission, no miles, own city first */
await page.evaluate(() => [...document.querySelectorAll('#cityPick .chip')].find(x => x.dataset.city === 'Katy').click());
await page.click('#applyLoc'); await page.waitForTimeout(600);
ok('6.15 picking a city needs no permission', await page.evaluate(() => window.__geoCalls) === 0);
ok('6.16 the chip now names the city', (await page.textContent('[data-loc]')).trim() === 'Katy');
const st1 = await ls();
ok('6.17 the choice is saved', st1.location.city === 'Katy' && st1.geo === null, JSON.stringify(st1.location));
/* the sponsored row is pinned above the ordering on purpose (6.40), so
   what is being checked here is the order of everything under it */
const top3 = await page.evaluate(() => [...document.querySelectorAll('#dirList .list-row')]
  .filter(r => !r.querySelector('.badge-sponsored')).slice(0, 3)
  .map(r => r.textContent.replace(/\s+/g, ' ').trim()));
ok('6.18 the reader\'s own city leads the list', top3.every(r => /Katy/.test(r)), top3[0].slice(0, 40));
ok('6.19 no invented miles anywhere', !/\d+(\.\d)?\s*ميل/.test(await txt()));
ok('6.20 the area name stands where the distance would', /Katy/.test(top3[0]));

/* f. the area filter, and what it degrades to */
await page.click('#dirFilter'); await page.waitForTimeout(450);
const opts2 = await page.evaluate(() => [...document.querySelectorAll('#fArea .chip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
ok('6.21 the area offers "my city" once there is one', opts2.some(o => /^Katy 39$/.test(o)), opts2.join(' | '));
ok('6.22 still no mile option — nothing is geocoded', !opts2.some(o => /ميل/.test(o)), opts2.join(' | '));
await page.evaluate(() => document.querySelector('#fArea .chip[data-ar="city"]').click());
await page.waitForTimeout(200);
const applyLbl = (await page.textContent('#fApply')).trim();
ok('6.23 the button counts the result before it is applied', /39/.test(applyLbl), applyLbl);
await page.click('#fApply'); await page.waitForTimeout(600);
ok('6.24 the filter really filters', await page.evaluate(() => document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]').length) === 39);
ok('6.25 it shows as a removable pill', /Katy/.test(await page.textContent('#pills')));
ok('6.26 and it lives in the link', /area=city/.test(await page.evaluate(() => location.hash)));

/* g. the device: the only source of a real distance */
await page.evaluate(() => [...document.querySelectorAll('#pills [data-off]')].forEach(p => p.click()));
await page.waitForTimeout(300);
await page.click('[data-loc]'); await page.waitForTimeout(400);
await page.click('#geoBtn'); await page.waitForTimeout(300);
ok('6.26b the sheet hands over rather than stacking', await page.evaluate(() => !!document.querySelector('#geoYes')));
await page.click('#geoYes'); await page.waitForTimeout(1400);
ok('6.27 "allow" is what reaches the browser', await page.evaluate(() => window.__geoCalls) === 1);
const st2 = await ls();
ok('6.28 the point is kept', st2.geo && Math.abs(st2.geo.lat - 29.7604) < 0.01, JSON.stringify(st2.geo));
ok('6.29 it is snapped to a city the directory covers', st2.location.city === 'Houston', st2.location.city);
ok('6.30 the chip names it', (await page.textContent('[data-loc]')).trim() === 'Houston');

/* a listing given coordinates, the way geocoding will deliver them */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.businessEdits = Object.assign({}, s.businessEdits, {
    b30: { lat: 29.7100, lng: -95.5200 },     // ~7 mi from downtown
  });
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.goto(BASE); await page.waitForTimeout(600);
await go('#/directory');
const b30row = await page.evaluate(() => {
  const r = document.querySelector('#dirList .list-row[data-route="#/directory/b30"]');
  return r ? r.textContent.replace(/\s+/g, ' ').trim() : null;
});
ok('6.31 a geocoded listing shows real miles', b30row && /\d+(\.\d)?\s*ميل/.test(b30row), (b30row || '').slice(0, 60));
const others = await page.evaluate(() => [...document.querySelectorAll('#dirList .list-row')]
  .filter(r => r.dataset.route !== '#/directory/b30').slice(0, 5).map(r => r.textContent.replace(/\s+/g, ' ').trim()));
ok('6.32 the rest still show their area, never a number', others.every(r => !/\d+(\.\d)?\s*ميل/.test(r)), others[0].slice(0, 50));
const dist = await S((S) => S.distanceTo(S.businessById('b30')));
ok('6.33 the distance is a Haversine mile figure', dist > 5 && dist < 12, String(Math.round(dist * 10) / 10));
ok('6.34 an ungeocoded listing has no distance at all', await S((S) => S.distanceTo(S.businessById('b31'))) === null);
await page.click('#dirFilter'); await page.waitForTimeout(450);
const opts3 = await page.evaluate(() => [...document.querySelectorAll('#fArea .chip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
ok('6.35 the mile options appear on their own', opts3.some(o => /^5 ميل/.test(o)), opts3.join(' | '));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
const nearFirst = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  return s;
});
await go('#/directory?sort=nearest');
const ordered = await page.evaluate(() => [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')]
  .map(r => ({ id: r.dataset.route, ad: !!r.querySelector('.badge-sponsored') })));
const firstOrganic = ordered.find(r => !r.ad);
ok('6.36 "nearest" puts the only measured listing first', firstOrganic.id === '#/directory/b30', firstOrganic.id);
ok('6.36b anything above it is the one labelled ad', ordered.indexOf(firstOrganic) <= 1 && ordered.filter(r => r.ad).length <= 1);

/* h. the sponsored slot: Greater Houston, and what it may not hide */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.location = { zip: '', city: 'Houston', state: 'TX' };
  s.geo = null;                       // a city named by hand: areas, no miles
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.goto(BASE); await page.waitForTimeout(500);
await go('#/directory');
const lead = await page.evaluate(() => {
  const r = document.querySelector('#dirList .list-row');
  return r ? r.textContent.replace(/\s+/g, ' ').trim() : '';
});
ok('6.37 a paid listing in the reader\'s city leads', /إعلان مموّل/.test(lead), lead.slice(0, 50));
ok('6.38 it is labelled, and keeps its area line', /إعلان مموّل/.test(lead) && /Houston|ميل/.test(lead));
ok('6.39 only one place is sold at the top', await page.evaluate(() => document.querySelectorAll('#dirList .badge-sponsored').length) === 1);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.location = { zip: '', city: 'Katy', state: 'TX' }; s.geo = null;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.goto(BASE); await page.waitForTimeout(500);
await go('#/directory');
/* the scope Rai settled on: Greater Houston, not Texas. A Houston
   advertiser is worth showing to a reader in Katy — and worth nothing to
   one in Dallas. */
ok('6.40 a Houston advertiser reaches a reader in Katy', await page.evaluate(() => document.querySelectorAll('#dirList .badge-sponsored').length) === 1);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.location = { zip: '', city: 'Dallas', state: 'TX' }; s.geo = null;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.goto(BASE); await page.waitForTimeout(500);
await go('#/directory');
ok('6.40b and nobody in Dallas', await page.evaluate(() => document.querySelectorAll('#dirList .badge-sponsored').length) === 0);
ok('6.40c the coverage rule is the region, not the city', await S((S) => S.inCoverage()) === false);

/* i. a refusal still leaves a usable screen */
const ctx2 = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const p2 = await ctx2.newPage();
const errs2 = [];
p2.on('pageerror', e => errs2.push(e.message));
await p2.addInitScript(() => {
  window.__geoCalls = 0;
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition(okCb, errCb) { window.__geoCalls++; setTimeout(() => errCb({ code: 1 }), 30); } } });
});
await p2.goto(BASE); await p2.waitForTimeout(600);
await p2.evaluate(() => { location.hash = '#/directory'; }); await p2.waitForTimeout(500);
await p2.click('[data-loc]'); await p2.waitForTimeout(400);
await p2.click('#geoBtn'); await p2.waitForTimeout(250);
await p2.click('#geoYes'); await p2.waitForTimeout(900);
const denyPanel = await p2.textContent('body');
ok('6.41 a refusal says what happened', /رفض إذن الموقع/.test(denyPanel));
ok('6.42 the city list is still right there', await p2.evaluate(() => document.querySelectorAll('#cityPick .chip').length) >= 24);
ok('6.43 the refusal is remembered', (await p2.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')).geoDenied)) === true);
ok('6.44 nothing crashed on the way', errs2.length === 0, errs2.join(' | '));
await ctx2.close();

/* j. the admin queue for the missing coordinates */
await page.goto(BASE); await page.waitForTimeout(500);
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
  await page.fill('#aUser', 'arabna.admin'); await page.fill('#aPass', 'Arabna@2026!');
  await page.click('#aGo'); await page.waitForTimeout(700);
}
await page.evaluate(() => { document.querySelector('#aTabs .tab[data-t="dir"]').click(); });
await page.waitForTimeout(700);
const adminTxt = await txt();
ok('6.45 the admin panel names the queue', /بانتظار الإحداثيات/.test(adminTxt));
// one listing was given coordinates above, so the queue is 513 of 514
ok('6.46 it counts what is still waiting', /513/.test(adminTxt.slice(adminTxt.indexOf('بانتظار الإحداثيات'), adminTxt.indexOf('بانتظار الإحداثيات') + 300))
   && /1 \/ 514/.test(adminTxt.replace(/\s+/g, ' ')));
ok('6.47 the addresses can be exported', await page.evaluate(() => !!document.querySelector('#geoExport') && !document.querySelector('#geoExport').disabled));
const dl = await Promise.all([page.waitForEvent('download'), page.click('#geoExport')]).then(r => r[0]).catch(() => null);
if (dl) {
  const path = await dl.path();
  const { readFileSync } = await import('fs');
  const csv = readFileSync(path, 'utf8').trim().split('\n');
  ok('6.48 the file holds every waiting address', csv.length === 514, csv.length + ' lines (513 waiting + header)');
  ok('6.49 with the id and the address', /^id,name,address$/.test(csv[0]) && csv[1].split(',').length >= 3, csv[1].slice(0, 60));
} else { ok('6.48 the file holds every waiting address', false, 'no download'); ok('6.49 with the id and the address', false, 'no download'); }

/* k. a moved shop never keeps the old point */
const moved = await S((S) => {
  S.applyBusinessEdit('b30', { address: '9999 Somewhere Else Rd, Katy, TX 77450' });
  const b = S.businessById('b30');
  return { lat: b.lat, lng: b.lng, needsGeo: b.needsGeo, dist: S.distanceTo(b) };
});
ok('6.50 an address change clears the coordinates', moved.lat === null && moved.lng === null, JSON.stringify(moved));
ok('6.51 and puts the listing back in the queue', moved.needsGeo === true);
ok('6.52 so it stops claiming a distance', moved.dist === null);

/* l. the rules underneath */
ok('6.53 a distance needs both points', await S((S) => S.distanceTo({ id: 'x', lat: 29.7, lng: -95.4 }) === null || !S.state.geo));
ok('6.54 the city comes out of the address', await S((S) => S.cityOf({ address: '1234 Fry Rd, Katy, TX 77450' })) === 'Katy');
ok('6.55 every listing yields a city', await S((S) => S.allBusinesses().filter(b => !S.cityOf(b)).length) === 0);
ok('6.56 Houston to Katy is about 27 miles', Math.abs(await S((S) => S.haversine({ lat: 29.7604, lng: -95.3698 }, { lat: 29.7858, lng: -95.8245 })) - 27) < 3);
ok('6.57 Dallas is outside the region we cover', await S((S) => S.nearestCity({ lat: 32.7767, lng: -96.797 })) === null);
ok('6.58 a Katy point is named Katy', (await S((S) => S.nearestCity({ lat: 29.7858, lng: -95.8245 }))).city === 'Katy');

/* m. the same, in English */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('arabna.v1'));
  s.lang = 'en'; s.location = { zip: '', city: '', state: 'TX' }; s.geo = null;
  localStorage.setItem('arabna.v1', JSON.stringify(s));
});
await page.goto(BASE); await page.waitForTimeout(600);
/* V.02.4 shortened the English label so it stops being truncated once the
   chip shares the search row: "Set location", not "Set your location". */
ok('6.59 English asks the same way', (await page.textContent('#locBtn')).trim() === 'Set location',
   (await page.textContent('#locBtn')).trim());
await go('#/directory');
await page.click('[data-loc]'); await page.waitForTimeout(400);
const enPanel = await page.textContent('.sheet-panel');
ok('6.60 the English sheet is complete', /Or pick your city/.test(enPanel) && /Houston/.test(enPanel) && /stays on your device/.test(enPanel));
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
await go('#/privacy');
ok('6.61 the privacy page discloses it (en)', /only requested at the moment/.test(await txt()));
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('arabna.v1')); s.lang = 'ar'; localStorage.setItem('arabna.v1', JSON.stringify(s)); });
await page.goto(BASE); await page.waitForTimeout(500);
await go('#/privacy');
ok('6.62 and in Arabic', /لا نطلب موقعك إلا في اللحظة/.test(await txt()));

ok('99 no console errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
