/* V.10.7 — 642: four real events, and a section that was empty for everybody.
 *
 * ⚠️ THE ITEM IS THE FIRST BLOCK. Measured on `main` before this batch:
 * `EVENTS` held three records, all three inside `markDemo`, and the
 * invented data has been switched off by default since 510 — so
 * `withoutDemo()` dropped all three and `extraEvents` is empty on a device
 * that added nothing. **The events section showed a visitor nothing at
 * all.** Four events measured from their organisers' own pages now sit
 * OUTSIDE `markDemo`, so they are what a visitor sees with the default
 * state and no key touched.
 *
 * ⚠️ AND ONE LINE OF CODE, WHICH THE MEASUREMENT MADE BIGGER THAN THE SPEC
 * EXPECTED. Two organisers have announced no doors, so those records carry
 * a DATE with no time. `new Date('2026-10-17')` is UTC midnight, which in
 * Houston is **16 October at 7:00 pm** — the app printed the day BEFORE
 * the festival, and `eventIsPast` hid a festival that was still running.
 * `eventStamp()` reads a bare date as LOCAL midnight, and an `endsAt` as
 * the END of the day it names; `eventIsAllDay()` is what stops an hour
 * nobody announced being printed beside it.
 *
 * Blocks: 1 the section fills · 2 none is demo · 3 no example.com ·
 * 4 the order · 5 no invented hour, and no shifted day · 6 both languages ·
 * 7 the price is the organiser's whole wording · 8 the shape ·
 * 9 bidi · 10 the version and the console.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/supabase\.co|fonts\.googleapis/.test((m.location() && m.location().url) || '') &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};
/* ⚠️ Houston's own timezone, and it is the point of block 5: a bare date
   read as UTC lands on the previous evening for every reader there. */
const fresh = async (lang) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
                                         timezoneId: 'America/Chicago' });
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  if (lang) await ctx.addInitScript(l => {
    try { const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}'); s.lang = l;
      localStorage.setItem('arabna.v1', JSON.stringify(s)); } catch (e) {}
  }, lang);
  const p = await ctx.newPage(); wire(p);
  return { ctx, p };
};
const open = async (p, hash = '#/events', wait = 1400) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(wait);
  await p.evaluate(async () => {
    /* `arabna/js/…` first: on the single-file build a relative path fetches
       the file again and hands back a second instance with its own state. */
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    window.__D = await import('arabna/js/data.js').catch(() => import('./js/data.js'));
  });
};
const cards = p => p.evaluate(() => [...document.querySelectorAll('.ev-card')].map(c => ({
  when: (c.querySelector('.ev-when') || {}).textContent?.trim() || '',
  title: (c.querySelector('.ev-title') || {}).textContent?.trim() || '',
  meta: (c.querySelector('.ev-meta') || {}).textContent?.trim() || '',
})));

const REAL = ['e4', 'e5', 'e6', 'e7'];

/* ===== 1. the section fills, for a visitor, with nothing seeded ===== */
console.log('--- 1. the section is not empty any more ---');
const A = await fresh();
await open(A.p);
{
  const st = await A.p.evaluate(() => ({
    showDemo: window.__S.showDemo(),
    extras: window.__S.state.extraEvents.length,
    upcoming: window.__S.upcomingEvents().map(e => e.id),
  }));
  ok('1.1 the invented data really is off — the default state, nothing seeded',
     st.showDemo === false && st.extras === 0, `showDemo ${st.showDemo} · extraEvents ${st.extras}`);
  /* THE ITEM: before this batch the same measurement returned zero. */
  ok('1.2 a visitor sees four events, not none', st.upcoming.length === 4, st.upcoming.join(' '));
  ok('1.3 and they are the four real ones',
     REAL.every(id => st.upcoming.includes(id)), st.upcoming.join(' '));
  const c = await cards(A.p);
  ok('1.4 four cards are drawn on the screen itself', c.length === 4, String(c.length));
  /* ⚠️ `.empty` and not `.empty-state`: written the second way this item
     was green with the section EMPTY, which is a check measuring nothing
     — worse than a red one. `emptyState()` in ui.js builds `.empty`. */
  ok('1.5 the designed empty state is not drawn', await A.p.evaluate(() =>
     !document.querySelector('#app .empty')));
}

/* ===== 2. not one of them is demo ===== */
console.log('--- 2. outside markDemo, and it is structural ---');
{
  const d = await A.p.evaluate(() => ({
    real: window.__D.EVENTS.filter(e => !e.demo).map(e => e.id),
    demo: window.__D.EVENTS.filter(e => e.demo).map(e => e.id),
  }));
  ok('2.1 exactly the four carry no demo flag',
     JSON.stringify(d.real) === JSON.stringify(REAL), d.real.join(' '));
  ok('2.2 the three seeds keep theirs — none was deleted here',
     JSON.stringify(d.demo) === JSON.stringify(['e1', 'e2', 'e3']), d.demo.join(' '));
  /* ⚠️ the structural half: writing them INSIDE `markDemo([…])` turns this
     red on its own, before any screen is opened. */
  const src = read('js/data.js');
  const block = (src.match(/export const EVENTS = markDemo\(\[([\s\S]*?)\n\]\)/) || [])[1] || '';
  ok('2.3 no real id is inside the markDemo array',
     REAL.every(id => !block.includes(`id: '${id}'`)), 'seed block length ' + block.length);
  ok('2.4 …and all four are in the concat that follows',
     /\]\)\.concat\(\[/.test(src) && REAL.every(id =>
       src.indexOf(`id: '${id}'`) > src.indexOf(').concat([')));
}

/* ===== 3. nothing points at example.com ===== */
console.log('--- 3. real links only ---');
{
  const links = await A.p.evaluate(() => window.__D.EVENTS.filter(e => !e.demo)
    .map(e => [e.id, e.ticketUrl, e.sourceUrl].join(' ')));
  ok('3.1 no example.com anywhere in the four',
     !links.some(l => /example\.com/.test(l)), links.filter(l => /example\.com/.test(l)).join(' | '));
  ok('3.2 every one carries a ticket link and a source', await A.p.evaluate(() =>
     window.__D.EVENTS.filter(e => !e.demo).every(e =>
       /^https:\/\//.test(e.ticketUrl) && /^https:\/\//.test(e.sourceUrl))));
  ok('3.3 and says it was entered by hand', await A.p.evaluate(() =>
     window.__D.EVENTS.filter(e => !e.demo).every(e => e.source === 'manual')));
}

/* ===== 4. the order is the date, soonest first ===== */
console.log('--- 4. the order ---');
{
  const order = await A.p.evaluate(() => window.__S.upcomingEvents().map(e => e.id));
  ok('4.1 Palestinian 10 Oct · Lebanese 17 · Mediterranean 23 · Arts 21 Nov',
     JSON.stringify(order) === JSON.stringify(['e7', 'e4', 'e5', 'e6']), order.join(' '));
  const c = await cards(A.p);
  ok('4.2 the cards on the screen are in that order',
     /الفلسطيني/.test(c[0].title) && /اللبناني/.test(c[1].title)
     && /المتوسّطي/.test(c[2].title) && /الفنون/.test(c[3].title),
     c.map(x => x.title.slice(0, 12)).join(' | '));
  ok('4.3 none of them repeats — nothing is spawned for a year that has not come',
     await A.p.evaluate(() => window.__D.EVENTS.filter(e => !e.demo).every(e => !e.repeat)));
  ok('4.4 none is featured — the pin is sold, and nobody bought it',
     await A.p.evaluate(() => window.__D.EVENTS.filter(e => !e.demo).every(e => e.featured === false)));
}

/* ===== 5. no hour is invented, and no day is lost ===== */
console.log('--- 5. a date with no hour ---');
{
  const c = await cards(A.p);
  const pal = c[0], leb = c[1], med = c[2];
  /* ⚠️ the day, first: read as UTC this card said «16 أكتوبر · 7:00 م». */
  ok('5.1 the Lebanese card says 17 October, not the evening before',
     /17/.test(leb.when) && !/16/.test(leb.when), leb.when);
  ok('5.2 the Palestinian card says 10 October, not the 9th',
     /10/.test(pal.when) && !/\b9\b/.test(pal.when), pal.when);
  ok('5.3 neither prints an hour', !/\d{1,2}:\d{2}/.test(leb.when + pal.when),
     leb.when + ' | ' + pal.when);
  ok('5.4 and no midnight is printed anywhere on the list',
     !/12:00|00:00/.test(c.map(x => x.when).join(' ')), c.map(x => x.when).join(' | '));
  ok('5.5 an event that DID announce its hour still prints it',
     /11:00/.test(med.when), med.when);

  await open(A.p, '#/events/e4', 900);
  const det = await A.p.evaluate(() => [...document.querySelectorAll('.info-row')]
    .map(r => r.textContent.replace(/\s+/g, ' ').trim()).join(' || '));
  ok('5.6 the detail page prints the two days and no hour',
     /17/.test(det) && /18/.test(det) && !/\d{1,2}:\d{2}/.test(det.split('||')[0]),
     det.split('||')[0]);

  /* the same rule inside the store: a festival is over when its LAST day
     is over, never when that day begins. */
  const past = await A.p.evaluate(() => {
    const S = window.__S, D = window.__D;
    const e = D.EVENTS.find(x => x.id === 'e4');
    const start = D.eventStamp('2026-10-18');           // the 18th, at midnight
    const noon  = D.eventStamp('2026-10-18T12:00');
    const after = D.eventStamp('2026-10-19');
    return { atStart: S.eventIsPast(e, start), atNoon: S.eventIsPast(e, noon),
             next: S.eventIsPast(e, after),
             allDay: D.eventIsAllDay('2026-10-17'), timed: D.eventIsAllDay('2026-10-23T11:00') };
  });
  ok('5.7 it is still running on the morning of its last day', past.atStart === false);
  ok('5.8 …and at midday on it', past.atNoon === false);
  ok('5.9 and it is over the day after', past.next === true);
  ok('5.10 the all-day test reads the shape of the string',
     past.allDay === true && past.timed === false);
  /* ⚠️ structural: `Date.parse` back in either display function brings the
     day shift with it, so the two readers are named. */
  const ev = read('js/screens/events.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('5.11 neither display function parses an event date by hand',
     !/new Date\(iso\)/.test(ev) && (ev.match(/eventStamp\(iso\)/g) || []).length === 2,
     (ev.match(/eventStamp\(iso\)/g) || []).length + ' uses');
  const st = read('js/store.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('5.12 and neither does the store',
     /eventStamp\(end, true\)/.test(st) && /eventStamp\(a\.startsAt\)/.test(st)
     && !/Date\.parse\(e\.startsAt\)/.test(st));
}

/* ===== 6. every text field in both languages ===== */
console.log('--- 6. both languages ---');
{
  const bad = await A.p.evaluate(() => {
    const out = [];
    const AR = /[؀-ۿ]/;
    window.__D.EVENTS.filter(e => !e.demo).forEach(e => {
      ['title', 'venue', 'desc', 'organizer'].forEach(f => {
        const v = e[f] || {};
        if (!v.ar || !v.en) out.push(`${e.id}.${f} empty side`);
        else if (!AR.test(v.ar)) out.push(`${e.id}.${f}.ar has no Arabic`);
        else if (v.ar === v.en) out.push(`${e.id}.${f} ar === en`);
      });
      if (e.city !== 'Houston, TX') out.push(`${e.id}.city ${e.city}`);
    });
    return out;
  });
  ok('6.1 no empty side, no English standing in the Arabic slot, and one city',
     bad.length === 0, bad.slice(0, 3).join(' | '));

  const B = await fresh('en');
  await open(B.p);
  const c = await cards(B.p);
  ok('6.2 the English list draws the same four', c.length === 4, String(c.length));
  ok('6.3 …in the same order, in English',
     /Palestinian/.test(c[0].title) && /Lebanese/.test(c[1].title)
     && /Mediterranean/.test(c[2].title) && /Islamic Arts/.test(c[3].title),
     c.map(x => x.title.slice(0, 14)).join(' | '));
  ok('6.4 and the all-day one prints no hour in English either',
     !/\d{1,2}:\d{2}/.test(c[0].when + c[1].when) && /10/.test(c[0].when),
     c[0].when + ' | ' + c[1].when);
  await B.ctx.close();
}

/* ===== 7. the price is the organiser's own wording, whole ===== */
console.log('--- 7. the price is text, not a number ---');
{
  const d = await A.p.evaluate(() => Object.fromEntries(
    window.__D.EVENTS.filter(e => !e.demo).map(e => [e.id, { ar: e.desc.ar, en: e.desc.en }])));
  /* ⚠️ the tooth: nobody reduced a compound price to a single figure. */
  ok('7.1 the Lebanese ticket line keeps all five of its figures',
     ['$25', '$10', '$150', '$270'].every(x => d.e4.ar.includes(x))
     && /VIP/.test(d.e4.ar) && /العاشرة/.test(d.e4.ar));
  ok('7.2 the Mediterranean line keeps the gate and the hour it turns on',
     d.e5.ar.includes('$5') && d.e5.ar.includes('$10') && /الخامسة/.test(d.e5.ar));
  ok('7.3 the Palestinian line says «from $5» and where the rest is',
     /تبدأ من/.test(d.e7.ar) && d.e7.ar.includes('$5') && /بوّابة الدفع/.test(d.e7.ar));
  ok('7.4 the arts festival says which half is free and does not price the other',
     /مجّاني/.test(d.e6.ar) && /بتذكرة/.test(d.e6.ar) && !/\$/.test(d.e6.ar), d.e6.ar.slice(0, 40));
  ok('7.5 the two with no announced hour say so, and neither invents one',
     /لم يعلنها المنظّم/.test(d.e4.ar) && /لم يعلنها المنظّم/.test(d.e7.ar));
  ok('7.6 the English side carries the same figures',
     ['$25', '$10', '$150', '$270'].every(x => d.e4.en.includes(x))
     && d.e5.en.includes('$5') && d.e7.en.includes('$5'));
  ok('7.7 each address is written where the reader can read it',
     /2811 Travis St/.test(d.e4.ar) && /5311 Mercer St/.test(d.e5.ar)
     && /2323 Allen Pkwy/.test(d.e6.ar) && /105-B Sabine St/.test(d.e7.ar));
  /* no claim words — the FTC rule the descriptions live under */
  const all = Object.values(d).map(x => x.ar + ' ' + x.en).join(' ');
  ok('7.8 no claim words anywhere in the four',
     !/(الأفضل|الأشهر|الأرخص|\bbest\b|\bcheapest\b)/i.test(all));
}

/* ===== 8. bidi: a price and a street inside an Arabic line ===== */
console.log('--- 8. direction ---');
{
  await open(A.p, '#/events/e4', 900);
  const b = await A.p.evaluate(() => {
    const el = [...document.querySelectorAll('.detail-body p')].find(x => /التذاكر/.test(x.textContent));
    if (!el) return null;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const n = w.nextNode();
    const txt = n.textContent, rg = document.createRange();
    const box = (a, len) => { rg.setStart(n, a); rg.setEnd(n, a + len);
      const r = rg.getBoundingClientRect(); return Math.round(r.x); };
    const i = txt.indexOf('$25');
    /* the whole-page rule v40 asserts, applied to this screen */
    const mixed = []; const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let m;
    while ((m = w2.nextNode())) { const s = m.nodeValue;
      if (!/[A-Za-z]{2,}/.test(s) || !/[؀-ۿ]/.test(s)) continue;
      const e = m.parentElement; if (!e || getComputedStyle(e).direction !== 'rtl') continue;
      let iso = false, a = e;
      while (a && a !== document.body) {
        if (/isolate|plaintext/.test(getComputedStyle(a).unicodeBidi)) { iso = true; break; }
        a = a.parentElement; }
      if (!iso) mixed.push(s.trim().slice(0, 50)); }
    return { dollar: box(i, 1), digits: box(i + 1, 2), mixed,
             overflow: document.documentElement.scrollWidth };
  });
  /* ⚠️ measured before the isolate went in: the `$` sat 18px to the RIGHT
     of its own digits, which is «25$» on the screen — V.02.7's fault. */
  ok('8.1 the dollar sign stands to the LEFT of its digits',
     b && b.dollar < b.digits, b ? `$ at ${b.dollar} · digits at ${b.digits}` : 'no paragraph');
  ok('8.2 no mixed line on this page is left without an isolate',
     b && b.mixed.length === 0, (b && b.mixed.slice(0, 2).join(' | ')) || '');
  ok('8.3 and the page does not scroll sideways', b && b.overflow === 390, String(b && b.overflow));
  ok('8.4 the isolate is in the DATA, so it survives every screen', await A.p.evaluate(() =>
     window.__D.EVENTS.filter(e => !e.demo).every(e =>
       !/\$/.test(e.desc.ar) || e.desc.ar.includes('⁦'))));
}

/* ===== 9. the version, and the console ===== */
console.log('--- 9. the carriers ---');
{
  const v = (read('js/data.js').match(/APP_VERSION = '([^']+)'/) || [])[1];
  const sw = (read('js/sw-manifest.js').match(/'([0-9.]+)'/) || [])[1];
  const cl = (read('CLAUDE.md').match(/Current version: \*\*V\.(\d+)\.(\d+)/) || []);
  const clv = cl.length ? `0.${parseInt(cl[1], 10)}.${parseInt(cl[2], 10)}` : '';
  ok('9.1 data.js, sw-manifest.js and CLAUDE.md carry one version',
     !!v && v === sw && v === clv, `${v} · ${sw} · ${clv}`);
  ok('9.2 zero console errors across every scene', errors.length === 0, errors.slice(0, 3).join(' | '));
}

await A.ctx.close();
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
