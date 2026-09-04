/* V.09.7 — holiday hours are DECLARED by the owner, never guessed.

   The owner asked how to handle official holidays: the directory holds
   shops that exist and shops that will, their holiday hours differ shop by
   shop, and a shop may well be shut — but nothing about that is knowable.
   His mechanism: one question (do your hours change on official holidays,
   yes/no), then a pick-list, then one shared answer for all of them —
   closed, or a single range — rather than a range per holiday.

   ⚠️ It is the pattern the project already runs on twice: the adhan is
   computed while the iqama and jumuah are the mosque's own to declare, and
   Ramadan is estimated while a written date beats the estimate. The weekly
   hours stay computed; the HOLIDAY hours become a declaration. And with no
   declaration nothing is assumed — not closed, not open.

   ⚠️ THE THIRD STATE IS THE POINT. `holidaysAffected` is true / false /
   undefined, and "not answered yet" is NOT "no": an unanswered business
   behaves exactly as it did before this batch and carries one soft note on
   its own page. All 514 listings are in that state today.

   ⚠️ Dates are not copied from memory. The two computed holidays (Labor
   Day, Thanksgiving) are re-derived here by an independent method and
   compared with what the app returns — a check that restated the app's own
   arithmetic would agree with any bug in it. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

/* ⚠️ never a relative path — run.sh runs from its own working directory. */
const ROOT = new URL('../../', import.meta.url).pathname;
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const SINGLE = /index-single-file/.test(BASE);
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
async function open(route, { lang = 'ar', edits = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(({ l, ed }) => {
    const K = 'arabna.v1'; let s = {};
    try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    s.lang = l; s.showDemo = true; s.demoDefaultOff = true;
    s.user = { email: 'a@b.c', emailVerified: true, tier: 2, name: 'x',
               phone: '7134669182', phoneVerified: true };
    s.myBusinessIds = ['b1'];
    if (ed) s.businessEdits = ed;
    localStorage.setItem(K, JSON.stringify(s));
  }, { l: lang, ed: edits });
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return { page, ctx };
}

/* one weekly-hours fixture, and one that is open around the clock */
const NINE_TO_FIVE = Array(7).fill([['09:00', '17:00']]);
const ALL_DAY = Array(7).fill([['00:00', '24:00']]);
/* a date that IS July 4th — a fixed civil holiday, so it is safe to name */
const ON_HOLIDAY = '2026-07-04T12:00:00';
const LATER_SAME_DAY = '2026-07-04T15:00:00';

const state = (page, biz, iso) => page.evaluate(async ({ b, at }) => {
  let S; try { S = await import('arabna/js/store.js'); } catch (e) { S = await import('./js/store.js'); }
  const st = S.openState(b, new Date(at));
  return st && { open: st.open, always: st.always, holiday: st.holiday };
}, { b: biz, at: iso });

/* ---------- 1) the four computed dates, cross-checked independently ---------- */
{
  const { page, ctx } = await open('#/home');
  const got = await page.evaluate(async (dates) => {
    let H; try { H = await import('arabna/js/holidays.js'); } catch (e) { H = await import('./js/holidays.js'); }
    const out = {};
    for (const [k, d] of Object.entries(dates)) out[k] = H.holidaysOn(new Date(d), null).map(x => x.id);
    return out;
  }, {
    newYear: '2026-01-01T12:00:00Z', july4: '2026-07-04T12:00:00Z',
    labor: '2026-09-07T12:00:00Z', thanks: '2026-11-26T12:00:00Z',
    christmas: '2026-12-25T12:00:00Z', ordinary: '2026-05-13T12:00:00Z',
  });
  ok('1.1a New Year is found', got.newYear.includes('newYear'), got.newYear.join(','));
  ok('1.1b July 4th is found', got.july4.includes('july4'), got.july4.join(','));
  ok('1.1c Christmas is found — the western date only', got.christmas.join(',') === 'christmas', got.christmas.join(','));
  ok('1.1d an ordinary day finds nothing', got.ordinary.length === 0, got.ordinary.join(',') || 'none');

  /* ⚠️ derived here by a different method than the app's, so a bug in one
     cannot be confirmed by the other: walk September and November and pick
     the first Monday / fourth Thursday by inspection. */
  const nth = (y, m, dow, n) => {
    let seen = 0;
    for (let d = 1; d <= 31; d++) {
      const dt = new Date(Date.UTC(y, m, d));
      if (dt.getUTCMonth() !== m) break;
      if (dt.getUTCDay() === dow && ++seen === n) return dt.toISOString().slice(0, 10);
    }
    return '';
  };
  ok('1.2a Labor Day is the first Monday of September', nth(2026, 8, 1, 1) === '2026-09-07' && got.labor.includes('laborDay'), nth(2026, 8, 1, 1));
  ok('1.2b Thanksgiving is the fourth Thursday of November', nth(2026, 10, 4, 4) === '2026-11-26' && got.thanks.includes('thanksgiving'), nth(2026, 10, 4, 4));

  /* the Coptic Christmas must NOT be in a civil holiday list */
  const jan7 = await page.evaluate(async () => {
    let H; try { H = await import('arabna/js/holidays.js'); } catch (e) { H = await import('./js/holidays.js'); }
    return H.holidaysOn(new Date('2027-01-07T12:00:00Z'), null).map(x => x.id);
  });
  ok('1.3 the Coptic Christmas is deliberately not a business holiday',
     !jan7.includes('christmas'), jan7.join(',') || 'none');

  /* the two religious ones are marked estimated — the feasts.js rule */
  const eid = await page.evaluate(async () => {
    let H; try { H = await import('arabna/js/holidays.js'); } catch (e) { H = await import('./js/holidays.js'); }
    let F; try { F = await import('arabna/js/feasts.js'); } catch (e) { F = await import('./js/feasts.js'); }
    const y = new Date(Date.UTC(2026, 0, 1)), z = new Date(Date.UTC(2027, 11, 31));
    const f = F.feastsBetween(y, z, null).find(x => x.id === 'eidFitr');
    return f ? H.holidaysOn(new Date(f.at), null) : [];
  });
  ok('1.4 Eid al-Fitr is read from feasts.js and carries «estimated»',
     eid.some(x => x.id === 'eidFitr' && x.estimated === true), JSON.stringify(eid));
  await ctx.close();
}

/* ---------- 2) an unanswered business behaves exactly as before ---------- */
{
  const { page, ctx } = await open('#/home');
  const plain = await state(page, { hours: NINE_TO_FIVE }, ON_HOLIDAY);
  ok('2.1 no declaration → holiday is null and the weekly hours rule',
     plain.open === true && plain.holiday === null, JSON.stringify(plain));

  const said_no = await state(page, { hours: NINE_TO_FIVE, holidaysAffected: false,
                                      holidaysObserved: [], holidayOverride: null }, ON_HOLIDAY);
  ok('2.2 an explicit «no» is identical to unanswered, in what the reader sees',
     said_no.open === plain.open && said_no.holiday === null, JSON.stringify(said_no));

  /* declared, but this holiday is not one of the picked ones */
  const other = await state(page, { hours: NINE_TO_FIVE, holidaysAffected: true,
                                    holidaysObserved: ['newYear'], holidayOverride: { mode: 'closed' } }, ON_HOLIDAY);
  ok('2.3 a holiday the owner did not pick changes nothing',
     other.open === true && other.holiday === null, JSON.stringify(other));
  await ctx.close();
}

/* ---------- 3) closed, and differs ---------- */
{
  const { page, ctx } = await open('#/home');
  const closed = await state(page, { hours: NINE_TO_FIVE, holidaysAffected: true,
                                     holidaysObserved: ['july4'], holidayOverride: { mode: 'closed' } }, ON_HOLIDAY);
  ok('3.1a «closed» shuts the day', closed.open === false, JSON.stringify(closed));
  ok('3.1b …and says which holiday, and that it is not an estimate',
     closed.holiday && closed.holiday.id === 'july4' && closed.holiday.mode === 'closed'
     && closed.holiday.estimated === false, JSON.stringify(closed.holiday));

  const biz = { hours: NINE_TO_FIVE, holidaysAffected: true, holidaysObserved: ['july4'],
                holidayOverride: { mode: 'differs', from: '11:00', to: '14:00' } };
  const inside = await state(page, biz, ON_HOLIDAY);
  const outside = await state(page, biz, LATER_SAME_DAY);
  ok('3.2a «differs» uses the declared range, not the weekly one — inside it',
     inside.open === true && inside.holiday.mode === 'differs', JSON.stringify(inside));
  /* ⚠️ 15:00 is INSIDE the weekly 09:00–17:00 and OUTSIDE the declared
     11:00–14:00 — so a pass here proves the declaration really replaced
     the weekly hours rather than being layered on top of them. */
  ok('3.2b …and closed outside it, though the weekly hours would be open',
     outside.open === false && outside.holiday.mode === 'differs', JSON.stringify(outside));

  /* item 7 of the spec: a declaration beats «open 24 hours» */
  const always = await state(page, { hours: ALL_DAY, holidaysAffected: true,
                                     holidaysObserved: ['july4'], holidayOverride: { mode: 'closed' } }, ON_HOLIDAY);
  ok('3.3 a declared closure beats «open 24 hours»',
     always.open === false && always.always === false, JSON.stringify(always));
  await ctx.close();
}

/* ---------- 4) the badge says it ---------- */
{
  const { page, ctx } = await open('#/home');
  const badges = await page.evaluate(async ({ h, at }) => {
    let U; try { U = await import('arabna/js/ui.js'); } catch (e) { U = await import('./js/ui.js'); }
    const mk = (extra) => U.openBadgeHtml(Object.assign({ hours: h }, extra), new Date(at));
    return {
      plain: mk({}),
      closed: mk({ holidaysAffected: true, holidaysObserved: ['july4'], holidayOverride: { mode: 'closed' } }),
      differs: mk({ holidaysAffected: true, holidaysObserved: ['july4'],
                    holidayOverride: { mode: 'differs', from: '11:00', to: '14:00' } }),
    };
  }, { h: NINE_TO_FIVE, at: ON_HOLIDAY });
  const words = await page.evaluate(async () => {
    let I; try { I = await import('arabna/js/i18n.js'); } catch (e) { I = await import('./js/i18n.js'); }
    return { closed: I.STRINGS.ar.holidayClosedToday, differs: I.STRINGS.ar.holidayDiffersToday,
             july4: I.STRINGS.ar.holidayJuly4 };
  });
  const strip = s => s.replace(/\{holiday\}/, '').trim();
  ok('4.1a the closed badge carries the holiday sentence',
     badges.closed.includes(strip(words.closed)), badges.closed.slice(0, 90));
  ok('4.1b …and names the holiday itself', badges.closed.includes(words.july4));
  ok('4.1c …and no token leaks', !badges.closed.includes('{holiday}'));
  ok('4.2a the «differs» badge warns without claiming closure',
     badges.differs.includes(strip(words.differs)) && !badges.differs.includes(strip(words.closed)),
     badges.differs.slice(0, 90));
  ok('4.3 an undeclared business gets no holiday wording at all',
     !badges.plain.includes(strip(words.closed)) && !badges.plain.includes(strip(words.differs)),
     badges.plain.slice(0, 60));
  await ctx.close();
}

/* ---------- 5) the soft note, on the detail page only ---------- */
for (const lang of ['ar', 'en']) {
  const { page, ctx } = await open('#/directory/b30', { lang });
  const note = await page.evaluate(async () => {
    let I; try { I = await import('arabna/js/i18n.js'); } catch (e) { I = await import('./js/i18n.js'); }
    const k = (document.documentElement.lang === 'en' ? I.STRINGS.en : I.STRINGS.ar).holidayUnknownNote;
    return { k, has: (document.body.textContent || '').includes(k) };
  });
  ok(`5.1 [${lang}] an unanswered business shows the disclaimer on its page`, note.has, note.k.slice(0, 40));
  await ctx.close();
}
{
  const { page, ctx } = await open('#/directory');
  const inList = await page.evaluate(async () => {
    let I; try { I = await import('arabna/js/i18n.js'); } catch (e) { I = await import('./js/i18n.js'); }
    return (document.querySelector('#dirList').textContent || '').includes(I.STRINGS.ar.holidayUnknownNote);
  });
  ok('5.2 …and never in the directory list — the page only', inList === false);
}
{
  /* answered either way → the note is gone */
  const edits = { b30: { holidaysAffected: false, holidaysObserved: [], holidayOverride: null } };
  const { page, ctx } = await open('#/directory/b30', { edits });
  const gone = await page.evaluate(async () => {
    let I; try { I = await import('arabna/js/i18n.js'); } catch (e) { I = await import('./js/i18n.js'); }
    return !(document.body.textContent || '').includes(I.STRINGS.ar.holidayUnknownNote);
  });
  ok('5.3 answering «no» removes the disclaimer — the third state is real', gone);
  await ctx.close();
}

/* ---------- 6) the edit form ---------- */
{
  const { page, ctx } = await open('#/business/edit/b1');
  const f = await page.evaluate(() => ({
    yes: !!document.querySelector('#eHolYes'),
    yesOn: document.querySelector('#eHolYes').classList.contains('active'),
    noOn: document.querySelector('#eHolNo').classList.contains('active'),
    moreHidden: document.querySelector('#eHolMore').hidden,
    chips: document.querySelectorAll('#eHolPick .chip').length,
  }));
  ok('6.1a the section is on the edit form', f.yes);
  ok('6.1b …with neither answer preselected when nothing was declared',
     f.yesOn === false && f.noOn === false, `yes=${f.yesOn} no=${f.noOn}`);
  ok('6.1c …and the pick list hidden', f.moreHidden === true);

  await page.click('#eHolYes'); await page.waitForTimeout(150);
  const after = await page.evaluate(async () => {
    let H; try { H = await import('arabna/js/holidays.js'); } catch (e) { H = await import('./js/holidays.js'); }
    return { hidden: document.querySelector('#eHolMore').hidden,
             chips: [...document.querySelectorAll('#eHolPick .chip')].map(c => c.dataset.h),
             ids: H.HOLIDAY_IDS };
  });
  ok('6.2a «yes» opens the pick list', after.hidden === false);
  /* ⚠️ derived from HOLIDAY_IDS, not a written list of seven */
  ok('6.2b …carrying every holiday, in the registry\'s own order',
     after.chips.join(',') === after.ids.join(','), after.chips.join(','));

  /* pick two, choose «differs», set a range, save */
  await page.click('#eHolPick .chip[data-h="july4"]');
  await page.click('#eHolPick .chip[data-h="thanksgiving"]');
  await page.click('#eHolDiffers'); await page.waitForTimeout(150);
  const rangeShown = await page.evaluate(() => document.querySelector('#eHolRange').hidden === false);
  ok('6.2c «differs» reveals the one shared range', rangeShown);
  await page.fill('#eHolFrom', '10:00');
  await page.fill('#eHolTo', '13:30');
  await page.click('#eSave'); await page.waitForTimeout(700);

  const saved = await page.evaluate(async () => {
    let S; try { S = await import('arabna/js/store.js'); } catch (e) { S = await import('./js/store.js'); }
    const b = S.businessById('b1');
    return { a: b.holidaysAffected, o: b.holidaysObserved, ov: b.holidayOverride };
  });
  ok('6.3a the declaration is saved exactly as picked',
     saved.a === true && (saved.o || []).slice().sort().join(',') === 'july4,thanksgiving',
     JSON.stringify(saved.o));
  ok('6.3b …with the one shared range, not one per holiday',
     saved.ov && saved.ov.mode === 'differs' && saved.ov.from === '10:00' && saved.ov.to === '13:30',
     JSON.stringify(saved.ov));
  await ctx.close();
}
{
  /* reopening redraws exactly what was saved */
  const edits = { b1: { holidaysAffected: true, holidaysObserved: ['july4', 'eidFitr'],
                        holidayOverride: { mode: 'differs', from: '10:00', to: '13:30' } } };
  const { page, ctx } = await open('#/business/edit/b1', { edits });
  const r = await page.evaluate(() => ({
    yesOn: document.querySelector('#eHolYes').classList.contains('active'),
    picked: [...document.querySelectorAll('#eHolPick .chip.active')].map(c => c.dataset.h).sort().join(','),
    differsOn: document.querySelector('#eHolDiffers').classList.contains('active'),
    from: document.querySelector('#eHolFrom').value, to: document.querySelector('#eHolTo').value,
    rangeShown: document.querySelector('#eHolRange').hidden === false,
  }));
  ok('6.4 reopening redraws every choice — nothing reset, nothing forgotten',
     r.yesOn && r.picked === 'eidFitr,july4' && r.differsOn && r.from === '10:00'
     && r.to === '13:30' && r.rangeShown, JSON.stringify(r));
  await ctx.close();
}
{
  /* «no» saves the explicit refusal */
  const { page, ctx } = await open('#/business/edit/b1');
  await page.click('#eHolNo'); await page.waitForTimeout(120);
  await page.click('#eSave'); await page.waitForTimeout(700);
  const saved = await page.evaluate(async () => {
    let S; try { S = await import('arabna/js/store.js'); } catch (e) { S = await import('./js/store.js'); }
    const b = S.businessById('b1');
    return { a: b.holidaysAffected, o: b.holidaysObserved, ov: b.holidayOverride };
  });
  ok('6.5 «no» is saved as an answer, not as silence',
     saved.a === false && Array.isArray(saved.o) && saved.o.length === 0 && saved.ov === null,
     JSON.stringify(saved));
  await ctx.close();
}
{
  /* ⚠️ the third state must survive a save that never touched the section */
  const { page, ctx } = await open('#/business/edit/b1');
  await page.fill('#eName', 'Renamed For Test');
  await page.click('#eSave'); await page.waitForTimeout(700);
  const saved = await page.evaluate(async () => {
    let S; try { S = await import('arabna/js/store.js'); } catch (e) { S = await import('./js/store.js'); }
    const b = S.businessById('b1');
    return { name: b.name.en, a: b.holidaysAffected,
             hasKey: Object.prototype.hasOwnProperty.call(b, 'holidaysAffected') };
  });
  ok('6.6a the unrelated edit really saved', saved.name === 'Renamed For Test', saved.name);
  ok('6.6b …and «unanswered» stayed unanswered — no field was invented',
     saved.a === undefined, String(saved.a));
  await ctx.close();
}

/* ---------- 7) the add form is untouched ---------- */
{
  const { page, ctx } = await open('#/business/add');
  const none = await page.evaluate(() =>
    document.querySelectorAll('#eHolNo, #eHolYes, #eHolPick').length);
  ok('7.1 the add form carries no holiday section at all', none === 0, String(none));
  await ctx.close();
}

/* ---------- 8) the documented limit, recorded rather than fixed ---------- */
{
  const { page, ctx } = await open('#/home');
  /* a business open 20:00–02:00; the day AFTER July 4 is declared closed,
     and at 00:30 on the 5th the span that began on the 4th is still running */
  const late = Array(7).fill([['20:00', '02:00']]);
  const st = await state(page, { hours: late, holidaysAffected: true,
                                 holidaysObserved: ['july4'], holidayOverride: { mode: 'closed' } },
                         '2026-07-05T00:30:00');
  ok('8.1 a holiday closes a DAY, not the tail of the night before — documented, not fixed',
     st.open === true, JSON.stringify(st));
  await ctx.close();
}

/* ---------- 9) the shape of the change, in the source ---------- */
if (!SINGLE) {
  const store = readFileSync(ROOT + 'js/store.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('9.1 holidayOverrideOn is NOT exported — every caller goes through openState',
     /function holidayOverrideOn/.test(store) && !/export function holidayOverrideOn/.test(store));
  ok('9.2 isOpenNow and closingSoon were not touched — they read openState',
     /export function isOpenNow[\s\S]{0,120}openState/.test(store)
     && /export function closingSoon[\s\S]{0,160}openState/.test(store));
  const feasts = readFileSync(ROOT + 'js/feasts.js', 'utf8');
  ok('9.3 feasts.js gained nothing — holidays.js imports from it',
     !/holiday/i.test(feasts.replace(/\/\*[\s\S]*?\*\//g, '')));
} else {
  for (const n of ['9.1', '9.2', '9.3']) ok(n + ' (source check, module build only)', true);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
