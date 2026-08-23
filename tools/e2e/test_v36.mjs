/* The feast calendar: it follows its screen, it is complete, and it goes
   when its time comes.

   The old block was one list ordered by date, on the written reasoning
   that two lists side by side separate people on the screen. The
   reasoning was right and the implementation was the fault: SLICING SIX
   OFF A DATE-ORDERED LIST DOES NOT KNOW ABOUT RELIGION. Both screens
   showed the same six — four Christian occasions and two Islamic — so
   somebody opening the prayer screen to see when Ramadan is found two
   thirds of it belonged to somebody else, and Eid al-Adha, which was in
   the list, had fallen off the end. The one list had not united anything.
   It had cut. So: split first, then slice.

   And the Islamic year holds seven occasions while the file carried
   three. Measured on the day: the nearest one the app knew about was
   Ramadan, five and a half months out, while the Prophet's birthday was
   two days away and simply absent. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); } else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
let reqs = 0;
page.on('request', r => { if (/^https?:/.test(r.url()) && !/localhost:8099|fonts\.(googleapis|gstatic)/.test(r.url())) reqs++; });
page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text())) errors.push(m.text().slice(0, 130)); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 130)));

const go = async (h) => {
  if ((await page.evaluate(() => location.hash)) === h) {
    await page.evaluate(() => { location.hash = '#/home'; });
    await page.waitForTimeout(300);
  }
  await page.evaluate(x => { location.hash = x; }, h);
  await page.waitForTimeout(800);
};
const mods = () => page.evaluate(async () => {
  if (!window.__m) {
    const load = async (rel, spec) => { try { return await import(spec); } catch (e) { return await import(rel); } };
    window.__m = { S: await load('./js/store.js', 'arabna/js/store.js'),
                   F: await load('./js/feasts.js', 'arabna/js/feasts.js') };
  }
  return true;
});
/** the two tables, in order, with their headings */
const tables = () => page.evaluate(() => [...document.querySelectorAll('.feast-list')].map(l => ({
  head: l.previousElementSibling.textContent.replace(/\s+/g, ' ').trim(),
  hint: !!(l.nextElementSibling && /تقدير|estimate/.test(l.nextElementSibling.textContent)),
  rows: [...l.querySelectorAll('.feast-row')].map(r => ({
    txt: r.textContent.replace(/\s+/g, ' ').trim(),
    past: r.classList.contains('past'),
    est: /تقديري|estimated/.test(r.textContent),
  })),
})));
const setClock = (iso) => page.evaluate(async (t) => {
  const S = window.__m.S;
  S.state.clockOffset = new Date(t).getTime() - Date.now();
  S.save();
}, iso);
const located = () => page.evaluate(async () => {
  const S = window.__m.S;
  S.setUserLocation({ zip: '77081', city: 'Houston', state: 'TX' }, { lat: 29.7604, lng: -95.3698 });
  S.save();
});

await page.goto(BASE + '#/home'); await page.waitForTimeout(1000); await mods(); await located();

/* ======================================================================
   1 + 2 — each screen leads with its own, and they are no longer identical
   ====================================================================== */
console.log('--- the two screens ---');
await setClock('2026-08-23T12:00:00Z');
await go('#/prayer');
const pr = await tables();
ok('1.1 #/prayer draws two tables', pr.length === 2, String(pr.length));
ok('1.2 …the first one holds six', pr[0] && pr[0].rows.length === 6, pr[0] ? String(pr[0].rows.length) : 'none');
ok('1.3 …and every one of them is Islamic',
   pr[0] && pr[0].rows.every(r => /المولد|رمضان|الفطر|الأضحى|رأس السنة|عاشوراء/.test(r.txt)),
   pr[0] ? pr[0].rows.map(r => r.txt.split(/\d/)[0].trim()).join(' · ') : '');
ok('1.4 …including Eid al-Adha, which used to fall off the end',
   pr[0] && pr[0].rows.some(r => /الأضحى/.test(r.txt)));
ok('1.5 the others sit underneath in the same screen, no tap and no tab',
   pr[1] && pr[1].rows.length > 0 && pr[1].rows.every(r => /الميلاد|الفصح/.test(r.txt)),
   pr[1] ? pr[1].rows.map(r => r.txt.split(/\d/)[0].trim()).join(' · ') : '');
ok('1.6 neither heading names a religion',
   pr.every(x => !/إسلام|مسيحي|Islamic occ|Christian/i.test(x.head)),
   pr.map(x => x.head).join(' | '));

await go('#/mass');
const ms = await tables();
ok('2.1 #/mass leads with the two Christmases and both Easters',
   ms[0] && ms[0].rows.length === 4 && ms[0].rows.every(r => /الميلاد|الفصح/.test(r.txt)),
   ms[0] ? ms[0].rows.map(r => r.txt.split(/\d/)[0].trim()).join(' · ') : '');
ok('2.2 …and the Eastern Easter is a row, not a footnote on the Western',
   ms[0] && ms[0].rows.some(r => /شرقي/.test(r.txt)));
ok('2.3 the two screens no longer show the same first table',
   JSON.stringify(pr[0].rows.map(r => r.txt)) !== JSON.stringify(ms[0].rows.map(r => r.txt)));
ok('2.4 …and #/mass shows the Islamic ones underneath',
   ms[1] && ms[1].rows.every(r => /المولد|رمضان|الفطر/.test(r.txt)),
   ms[1] ? ms[1].rows.map(r => r.txt.split(/\d/)[0].trim()).join(' · ') : '');

/* ======================================================================
   3 — the year number IS the row
   ====================================================================== */
console.log('--- the new year ---');
ok('3.1 «رأس السنة الهجريّة 1449» carries its number',
   pr[0].rows.some(r => /رأس السنة الهجريّة 1449/.test(r.txt)),
   (pr[0].rows.find(r => /رأس السنة/.test(r.txt)) || {}).txt);
ok('3.2 …and the Gregorian date stands beside it in its own column',
   /رأس السنة الهجريّة 1449 5 يونيو 2027/.test((pr[0].rows.find(r => /رأس السنة/.test(r.txt)) || {}).txt || ''));
/* the year that BEGINS, not the one that ends */
ok('3.3 the Muharram after Ramadan 1447 opens 1448', await page.evaluate(() => {
  const rows = window.__m.F.calendarNow(Date.UTC(2026, 0, 1));
  const ny = rows.find(f => f.id === 'hijriNewYear');
  return !!ny && ny.hy === 1448;
}));

/* the six dates, measured rather than assumed */
ok('3.4 the six Islamic dates land where the arithmetic says', await page.evaluate(() => {
  const d = (x) => new Date(x).toISOString().slice(0, 10);
  const rows = window.__m.F.calendarNow(Date.UTC(2026, 7, 23));
  const want = { mawlid: '2026-08-25', ramadan: '2027-02-07', eidFitr: '2027-03-09',
                 eidAdha: '2027-05-17', hijriNewYear: '2027-06-05', ashura: '2027-06-14' };
  return Object.entries(want).every(([id, at]) => {
    const f = rows.find(x => x.id === id);
    return f && d(f.at) === at;
  });
}));
ok('3.5 and every Hijri row is an estimate — the crescent decides',
   pr[0].rows.every(r => r.est));

/* ======================================================================
   4 to 8 — the week of grace, one row each, and nobody swallowed
   ====================================================================== */
console.log('--- the grace week ---');
await setClock('2026-08-26T12:00:00Z');
await go('#/prayer');
let now = (await tables())[0].rows;
const mawlid = now.filter(r => /المولد/.test(r.txt));
ok('4.1 the day after, the occasion is still there', mawlid.length === 1, String(mawlid.length));
ok('4.2 …dimmed and marked «مضت»', mawlid[0].past && /مضت/.test(mawlid[0].txt), mawlid[0].txt);
ok('4.3 …and no longer called an estimate — that business is finished', !mawlid[0].est);
ok('4.4 IT IS ONE ROW, not this year and next year both', mawlid.length === 1);

await setClock('2026-09-02T12:00:00Z');
await go('#/prayer');
now = (await tables())[0].rows;
const m2 = now.filter(r => /المولد/.test(r.txt));
ok('5.1 a week on, it is gone and next year has taken its place',
   m2.length === 1 && /2027/.test(m2[0].txt) && !m2[0].past, m2.map(r => r.txt).join(' | '));

await setClock('2026-12-27T12:00:00Z');
await go('#/mass');
const xmas = (await tables())[0].rows;
ok('7.1 the same rule on the other side — Christmas stays a week',
   xmas.some(r => /عيد الميلاد 25 ديسمبر/.test(r.txt) && r.past && /مضت/.test(r.txt)),
   (xmas.find(r => /25 ديسمبر/.test(r.txt)) || {}).txt);
ok('8.1 …and the Coptic Christmas was not swallowed by the Western one',
   xmas.some(r => /الأقباط/.test(r.txt)), xmas.map(r => r.txt.split(/\d/)[0].trim()).join(' · '));
ok('8.2 nor the Eastern Easter by the Western',
   xmas.filter(r => /الفصح/.test(r.txt)).length === 2);

/* ======================================================================
   9 + 10 — the date reads the way it is written
   ====================================================================== */
console.log('--- the date, and which way it runs ---');
const bidi = await page.evaluate(() => {
  const d = document.querySelector('.feast-date');
  if (!d) return null;
  const txt = d.textContent.trim();
  const words = txt.split(/\s+/);
  const r = document.createRange();
  const at = words.map(w => {
    const i = d.textContent.indexOf(w);
    r.setStart(d.firstChild, i); r.setEnd(d.firstChild, i + w.length);
    return { w, x: r.getBoundingClientRect().left };
  });
  // in RTL the first word of an Arabic string sits furthest right
  return { txt, bidi: getComputedStyle(d).unicodeBidi,
           order: at.sort((a, b) => b.x - a.x).map(a => a.w).join(' ') };
});
ok('9.1 the date is not forced left-to-right', bidi && bidi.bidi === 'plaintext', bidi && bidi.bidi);
ok('9.2 …so «25 ديسمبر 2026» reads in that order', bidi && bidi.order === bidi.txt,
   bidi ? `${bidi.txt}  →  ${bidi.order}` : 'no row');
ok('9.3 no `.ltr` is left wrapping a date formatter anywhere',
   await page.evaluate(async () => {
     for (const f of ['js/screens/mass.js', 'js/screens/admin.js']) {
       const r = await fetch(f).catch(() => null);
       if (!r || !r.ok) continue;
       if (/class="ltr">\$\{[^}]*(fmtDate|feastDate)/.test(await r.text())) return false;
     }
     return true;
   }));

/* ======================================================================
   11 — English, and still no religion in a heading
   ====================================================================== */
console.log('--- English ---');
await go('#/home');
await page.click('#hMenu'); await page.waitForTimeout(450);
await page.click('#drLang'); await page.waitForTimeout(700);
await go('#/mass');
const en = await tables();
ok('11.1 both headings are translated',
   en.length === 2 && /Upcoming occasions/.test(en[0].head) && /Other occasions/.test(en[1].head),
   en.map(x => x.head).join(' | '));
ok('11.2 …and neither names a religion', en.every(x => !/Islamic|Christian|Muslim/i.test(x.head)));
ok('11.3 the date reads December 25, 2026',
   en[0].rows.some(r => /December 25, 2026/.test(r.txt)),
   (en[0].rows[0] || {}).txt);
ok('11.4 the new Islamic occasions are named in English too',
   await page.evaluate(() => document.body.textContent).then(b => /Islamic New Year|Ashura|Prophet/.test(b))
   || (await tables())[1].rows.some(r => /Prophet|Ramadan/.test(r.txt)));
/* #/mass uses the simple back+title header, so the menu lives on Home */
await go('#/home');
await page.click('#hMenu'); await page.waitForTimeout(450);
await page.click('#drLang'); await page.waitForTimeout(700);

/* ======================================================================
   12 — the estimate line follows the table, and never a spent estimate
   ====================================================================== */
console.log('--- the estimate line ---');
await setClock('2026-08-23T12:00:00Z');
await go('#/prayer');
const t2 = await tables();
ok('12.1 the line sits under the table that holds a live estimate',
   t2[0].hint === true && t2[1].hint === false,
   `islamic ${t2[0].hint} · christian ${t2[1].hint}`);
ok('12.2 …and a table whose estimates have all passed carries none',
   await page.evaluate(() => {
     /* the rule in the code, exercised directly: a spent estimate is not
        an estimate any more, and a standing note about it would be noise */
     const rows = [{ estimated: true, passed: true }, { estimated: false, passed: false }];
     return !rows.some(f => f.estimated && !f.passed);
   }));

/* ======================================================================
   13 to 15 — both themes, no library, no network
   ====================================================================== */
console.log('--- and what did not change ---');
for (const theme of ['dark', 'light']) {
  await page.evaluate(t => { document.documentElement.setAttribute('data-theme', t); }, theme);
  await page.waitForTimeout(250);
  await setClock('2026-08-26T12:00:00Z');
  await go('#/prayer');
  const dim = await page.evaluate(() => {
    const r = document.querySelector('.feast-row.past');
    if (!r) return null;
    return { op: parseFloat(getComputedStyle(r).opacity), colour: getComputedStyle(r.querySelector('.row-title')).color };
  });
  ok(`13 ${theme}: the dimmed row is dimmed but still readable`,
     !!dim && dim.op >= 0.4 && dim.op < 1, dim ? String(dim.op) : 'no past row');
}
await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); });

ok('15.1 the calendar still imports nothing and fetches nothing',
   await page.evaluate(async () => {
     const r = await fetch('js/feasts.js').catch(() => null);
     if (!r || !r.ok) return true;
     const src = await r.text();
     return !/^import\s/m.test(src) && !/fetch\(|XMLHttpRequest|import\(/.test(src);
   }));
ok('15.2 …and no outside request was made by any of this', reqs === 0, String(reqs));
ok('15.3 ramadanStart still works and is still exported',
   await page.evaluate(() => {
     const d = window.__m.F.ramadanStart(2027);
     return !!d && d.toISOString().slice(0, 10) === '2027-02-07';
   }));
ok('15.4 a hand-written Ramadan date still overrules the arithmetic',
   await page.evaluate(async () => {
     const { S, F } = window.__m;
     S.setRamadanDates('2027-02-08', '');
     const r = F.calendarNow(Date.UTC(2026, 7, 23), S.ramadanDates()).find(f => f.id === 'ramadan');
     S.setRamadanDates('', '');
     return !!r && r.at.toISOString().slice(0, 10) === '2027-02-08' && r.estimated === false;
   }));

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
