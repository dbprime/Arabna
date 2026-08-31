/* V.08.0 — the city's name is not replaced by the nearest centre.

   ⚠️ Rai's report: the screen said Sugar Land and he was not in it.

   The fault was HALF AN OLD FIX. `cityNameFor` kept the reverse lookup's
   answer only when the directory covered it, and threw it away otherwise,
   putting the nearest of the 24 centres in its place. So the very
   sentence its own comment condemns — «nobody says: the nearest city hall
   to me is Katy» — was still being carried out, on everybody living
   outside those 24. Measured beside Sugar Land: Rosenberg, Fresno,
   Sienna, Meadows Place and Alief are all off the list.

   ⚠️ And the condition chose nothing: where the city IS covered, both
   branches returned the same value. It was not picking between two names
   — it was picking when to throw the right one away. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };
const read = f => readFileSync(ROOT + f, 'utf8');

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message.slice(0, 120)));
page.on('console', m => { if (m.type() === 'error' &&
  !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.g/.test(m.text()))
  errors.push(m.text().slice(0, 120)); });
await page.route('**://fonts.g*/**', r => r.abort());
await page.goto(BASE + '#/home', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);

/* ⚠️ the single-file build hides the modules behind an importmap, so a
   relative import returns a SECOND instance with its own state */
const MODS = `(async () => {
  const g = async (p) => { try { return await import('arabna/' + p); } catch (e) { return await import('./' + p); } };
  return { H: await g('js/screens/home.js'), S: await g('js/store.js'), D: await g('js/data.js') };
})()`;

/* ============ 1 — the name, in all four shapes ============ */
console.log('--- the reverse lookup answered; its answer is the name ---');
{
  const r = await page.evaluate(m => eval(m).then(({ H, D }) => ({
    cities: D.CITY_POINTS.length,
    covered:   H.cityNameFor({ city: 'Richmond' },  { city: 'Katy' }),
    uncovered: H.cityNameFor({ city: 'Rosenberg' }, { city: 'Sugar Land' }),
    fresno:    H.cityNameFor({ city: 'Fresno' },    { city: 'Sugar Land' }),
    onlyNear:  H.cityNameFor(null,                  { city: 'Sugar Land' }),
    neither:   H.cityNameFor(null, null),
    offList: ['Rosenberg', 'Fresno', 'Sienna', 'Meadows Place', 'Alief']
      .filter(c => !D.CITY_POINTS.some(x => x.city === c)).length,
  })), MODS);
  /* ⚠️ A GUARD ON THE OLD FIX: this is the case that was repaired before,
     and this batch does not undo it. */
  ok('1.1 a covered city is kept', r.covered === 'Richmond', r.covered);
  /* ⚠️ THE FAULT ITSELF: this returned «Sugar Land». */
  ok('1.2 an UNCOVERED city is kept too', r.uncovered === 'Rosenberg', r.uncovered);
  ok('1.3 …and so is every other neighbour of Sugar Land', r.fresno === 'Fresno', r.fresno);
  ok('1.4 all five neighbours really are off the list', r.offList === 5, r.offList + ' of 5');
  /* ⚠️ a guard that `near` was not deleted: it is the last resort */
  ok('1.5 with no name at all, the nearest centre is used', r.onlyNear === 'Sugar Land', r.onlyNear);
  ok('1.6 with neither, an empty string — never undefined or null',
     r.neither === '' && typeof r.neither === 'string', JSON.stringify(r.neither));
  ok('1.7 the covered list is unchanged at 24 — coverage is a business decision, not a naming cure',
     r.cities === 24, String(r.cities));
}

/* ============ 2 — and the screen does not empty ============ */
console.log('--- fix the name and empty the directory: the thing this forbids ---');
{
  const count = async (city) => {
    await page.evaluate(async ([m, c]) => {
      const { S } = await eval(m);
      S.setUserLocation({ zip: '', city: c, state: 'TX' });
    }, [MODS, city]);
    await page.goto(BASE + '#/directory', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    return page.evaluate(() => document.querySelectorAll('#dirList [data-route^="#/directory/"]').length);
  };
  const covered = await count('Houston');
  const off = await count('Rosenberg');
  /* `state.area` defaults to 'all' and never filters by city, so an
     uncovered name changes nothing about what is listed */
  ok('2.1 an uncovered city lists exactly as a covered one does', off === covered && off > 0,
     `Rosenberg ${off} · Houston ${covered}`);
  /* ⚠️ COVERAGE IS A DIFFERENT QUESTION, and it stays different: the same
     point must give the same answer as before this batch. */
  /* ⚠️ `inRegion` is its own exported function — `nearestCity` returns
     `{city, miles}` or null and carries no such field. The first version
     of this check read a property that never existed, so it reported
     `false` for Houston: A CHECK THAT INVENTS ITS OWN API MEASURES
     NOTHING, and it fails in the direction that looks like a real fault. */
  const region = await page.evaluate(m => eval(m).then(({ S }) => ({
    houston: S.inRegion({ lat: 29.7604, lng: -95.3698 }),
    rosenberg: S.inRegion({ lat: 29.5572, lng: -95.8085 }),
    dallas: S.inRegion({ lat: 32.7767, lng: -96.7970 }),
  })), MODS);
  ok('2.2 inRegion is untouched — inside stays inside, far away stays out',
     region.houston === true && region.rosenberg === true && region.dallas === false,
     JSON.stringify(region));
}

/* ============ 3 — a hand-picked city is no longer frozen ============ */
console.log('--- Rai reversed V.04.0, and his argument is the stronger one ---');
{
  const home = read('js/screens/home.js');
  const code = home.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* ⚠️ The sheet is DELETED, not left dead. A function nobody calls reads
     two months later as a disabled feature and gets revived for no reason. */
  const gone = ['askToMove', 'moveAlreadyAsked', 'markMoveAsked', 'moveAsked'];
  const still = [];
  for (const f of ['js/screens/home.js', 'js/store.js', 'js/ui.js', 'js/app.js'])
    for (const g of gone) if (new RegExp(g).test(read(f))) still.push(f + ':' + g);
  ok('3.1 the sheet and its two functions are gone from js/', still.length === 0, still.join(', '));
  const i18n = read('js/i18n.js');
  ok('3.2 …and its four strings with them', !/locMoved/.test(i18n));
  ok('3.3 the city updates by itself and says so', /offerUndoMove\(/.test(code) &&
     /locUpdated/.test(home));
  ok('3.4 …with one undo, which gives back the «by hand» mark too',
     /t\('undo'\)/.test(home) && /S\.setUserLocation\(prev\)/.test(code));
  /* ⚠️ THE SAME THREE MILES, now governing the hand-picked city as well,
     so an errand across the road never overrides what somebody chose. */
  ok('3.5 …and the three miles govern it, so a walk down the road does not',
     /travelled < NAME_STALE_MI/.test(code) && /const NAME_STALE_MI = 3;/.test(code));
  ok('3.6 the distance is computed once, above the branch',
     (code.match(/const travelled = /g) || []).length === 1);
  /* the line must not sit on screen for the rest of the session */
  ok('3.7 the line is transient, not a demand', /ms: \d+/.test(code));
}

/* ============ 4 — the undo really restores both halves ============ */
console.log('--- picking a city by hand has always cleared the point ---');
{
  const r = await page.evaluate(m => eval(m).then(({ S }) => {
    S.setUserLocation({ zip: '', city: 'Houston', state: 'TX' });          // by hand
    const before = { city: S.userCity(), manual: S.cityIsManual() };
    const prev = S.state.location;
    S.setUserLocation({ zip: '', city: 'Rosenberg', state: 'TX' },         // from the device
                      { lat: 29.5572, lng: -95.8085 });
    const moved = { city: S.userCity(), manual: S.cityIsManual() };
    S.setUserLocation(prev);                                               // undo
    return { before, moved, after: { city: S.userCity(), manual: S.cityIsManual() } };
  }), MODS);
  ok('4.1 a hand-picked city is marked so', r.before.city === 'Houston' && r.before.manual === true);
  ok('4.2 the device updates it, and the mark goes with the point',
     r.moved.city === 'Rosenberg' && r.moved.manual === false, JSON.stringify(r.moved));
  ok('4.3 the undo gives back the city AND the mark',
     r.after.city === 'Houston' && r.after.manual === true, JSON.stringify(r.after));
}

ok('5.1 zero console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
