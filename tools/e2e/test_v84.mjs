/* V.10.9 — 649: the events reach the server, so adding one needs no batch.
 *
 * ⚠️ THE FAULT WAS A MISSING WIRE, NOT A MISSING IDEA. Measured on `main`
 * before this batch: the form (`events.js`), the panel (`admin.js`), the
 * table (`0001` line 246) and its policies (`0002` line 168) were all
 * built and complete — and `from('events')` appeared in the whole of `js/`
 * ZERO times. So an event the admin added from his phone was seen by
 * nobody, an organiser's proposal landed on their own device while the
 * screen said «your proposal arrived», and the $99 «featured» pin reached
 * no reader at all.
 *
 * ⚠️ AND IT IS THE THIRD TIME: `hidden` (645 §10) and `city` (645 §8) were
 * the same shape. Block 7 is the rule that comes out of it, counted.
 *
 *   1  the wire exists, and the reader declares its own order
 *   2  an admin's event reaches a SECOND device
 *   3  an organiser proposes, and the panel really sees it
 *   4  the server refuses what the screen would not send
 *   5  every box a human fills has a column, and the value arrives
 *   6  the day is the day — all-day stays all-day, and 17 October reads 17
 *   7  every table in `0001` has a writer or a named line
 *   8  the pin, the place in the calendar, and the stable tail
 *   9  a network failure keeps the seeds and empties nothing
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';
import { unlockAdmin } from './_admin.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
const MIG = ROOT + 'supabase/migrations/';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ comments stripped before any «does the code do X» check — the rule
   this project has now paid for four times, and this batch's own migration
   NAMES `place` and `midnight` in comments explaining why neither is used. */
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const code = f => strip(read(f));
const sqlAll = () => readdirSync(MIG).filter(n => n.endsWith('.sql')).sort()
  .map(n => readFileSync(MIG + n, 'utf8')).join('\n');
const sqlCode = () => sqlAll().replace(/--[^\n]*/g, '');

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/supabase\.co|fonts\.googleapis/.test((m.location() && m.location().url) || '') &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};
const fresh = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  const db = await mockSupabase(ctx, opts);
  await ctx.addInitScript(() => { try {
    const k = 'arabna.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}');
    s.lang = 'ar'; localStorage.setItem(k, JSON.stringify(s));
  } catch (e) {} });
  const p = await ctx.newPage(); wire(p);
  return { ctx, p, db };
};
const prime = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
});
const open = async (p, hash = '#/home', wait = 1100) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(wait);
  await prime(p);
};
const member = async (p, email) => p.evaluate(async ([em, c]) => {
  const S = window.__S;
  const err = await S.signUp({ name: 'Member ' + em, email: em, password: 'Qx7#mVzt2026', phone: '' });
  if (err) throw new Error(err);
  if (!S.state.user.emailVerified) { const e2 = await S.confirmEmail(c); if (e2) throw new Error(e2); }
  return S.state.user.id;
}, [email, MOCK_CODE]);

/** one event payload, the shape the form builds */
const EV = (over = {}) => Object.assign({
  title: { ar: 'مهرجانُ الجالية', en: 'Community festival' },
  type: 'festival',
  concert: null,
  repeat: null,
  startsAt: '2027-05-20T16:00',
  endsAt: '2027-05-20T22:00',
  venue: { ar: 'قاعةُ الجالية', en: 'Community Hall' },
  city: 'Houston, TX',
  organizer: { ar: 'المركزُ الثقافيّ', en: 'Cultural Center' },
  ticketUrl: 'https://example.org/tickets',
  desc: { ar: 'وصفٌ قصير', en: 'A short description' },
  photo: '',
  featured: false,
  icon: 'sparkles',
}, over);

/* ============================================================
   1 — the wire exists, and the reader declares its own order
   ============================================================ */
console.log('--- 1: the wire ---');
{
  const st = code('js/store.js');
  const froms = (st.match(/sb\.from\('events'\)/g) || []).length;
  ok('1.1 the events table is reached from the app at all — it was ZERO', froms > 0, String(froms));

  const reg = [...st.matchAll(/makeLiveReader\('([a-z_]+)'/g)].map(m => m[1]);
  ok('1.2 …through the one factory, by the name it is handed',
     reg.includes('events'), reg.join(' · '));

  /* ⚠️ NOT `created_at`, which is the factory's fallback: ordered by it, a
     FEATURED event with a distant date falls onto a later page and never
     floats — the $99 pin, paid for and invisible. */
  const ord = /makeLiveReader\('events',\s*\{[\s\S]*?order:\s*\[([\s\S]*?)\]\s*,?\s*\}/.exec(st);
  const ordTxt = ord ? ord[1].replace(/\s+/g, ' ') : '';
  ok('1.3 …and it declares featured-first, then soonest — never created_at',
     /'featured'[\s\S]*ascending:\s*false/.test(ordTxt) &&
     /'starts_at'[\s\S]*ascending:\s*true/.test(ordTxt), ordTxt.slice(0, 90));

  ok('1.4 no reader writes `.eq(\'status\', …)` on top of RLS (630)',
     !/sb\.from\([^)]*\)[^;]*\.eq\('status'/.test(st));

  ok('1.5 `allEvents()` stays synchronous — twenty call sites gain no await',
     /export function allEvents\(\)/.test(st) && !/export async function allEvents/.test(st));

  const sql = sqlCode();
  const cols = ['type', 'city', 'ticket_url', 'photo', 'featured', 'organizer_ar', 'organizer_en',
                'venue_ar', 'venue_en', 'concert', 'repeat', 'source', 'external_id',
                'source_url', 'all_day'];
  const missing = cols.filter(c => !new RegExp('alter table public\\.events add column if not exists ' + c + '\\b').test(sql));
  ok('1.6 the fifteen columns are added by a migration', missing.length === 0, missing.join(', '));

  /* ⚠️ handed over for the SQL editor, which drops both characters — and
     scoped to THIS batch's file rather than the whole folder: `0005` is
     known to carry `||` and was run as a `concat` copy, which the state
     file records. A check over every migration would demand rewriting a
     file that has already been executed. */
  const mine = readFileSync(MIG + '0010_events_columns.sql', 'utf8').replace(/--[^\n]*/g, '');
  ok('1.7 this batch’s migration carries no `||` and no `*` in what is executed',
     !/\|\|/.test(mine) && !/\*/.test(mine));

  /* «deletion is a mark, not a wipe» — the row stays and the list drops it */
  ok('1.8 no `for delete` policy on events, and none is opened',
     !/on public\.events for delete/i.test(sql) &&
     /status: 'deleted'/.test(st));
}

/* ============================================================
   2 — an admin's event reaches a SECOND device
   ============================================================ */
console.log('--- 2: it leaves the phone that typed it ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await unlockAdmin(p);
  await prime(p);
  const made = await p.evaluate(async (ev) => {
    const rec = await window.__S.addEvent(ev, 'live');
    return rec ? { id: rec.id, n: window.__S.allEvents().length } : null;
  }, EV());
  ok('2.1 the admin adds an event and it is accepted', !!made, made ? made.id : 'null');
  ok('2.2 …a row really exists on the server', (db.events || []).length === 1,
     String((db.events || []).length));
  /* ⚠️ 648's rule: a record with a table takes its id from the table */
  /* ⚠️ guarded, and that is not caution: an unguarded subscript CRASHES
     the suite instead of failing one item, and every assertion after it
     goes unmeasured — which is how a batch reports green while it is not. */
  ok('2.3 …and its id is the row’s, not one minted on the device',
     !!made && !!(db.events || [])[0] && made.id === db.events[0].id, made ? made.id : '');

  /* a SECOND browser, sharing the one server — two fresh memories could
     never show this, and would have kept the original fault green */
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.route('**/fonts.googleapis.com/**', r => r.abort());
  await mockSupabase(ctx2, { db });
  const p2 = await ctx2.newPage(); wire(p2);
  await open(p2, '#/events');
  const seen = await p2.evaluate(async () => {
    await window.__S.loadLiveEvents();
    const e = window.__S.upcomingEvents().find(x => (x.title.ar || '') === 'مهرجانُ الجالية');
    return e ? { title: e.title.ar, city: e.city, org: e.organizer.ar, type: e.type } : null;
  });
  ok('2.4 …and a SECOND device, with no account, sees it', !!seen, seen ? seen.title : 'not seen');
  ok('2.5 …with the fields it was typed with, not a husk',
     !!seen && seen.city === 'Houston, TX' && seen.org === 'المركزُ الثقافيّ' && seen.type === 'festival',
     seen ? [seen.city, seen.org, seen.type].join(' · ') : '');
  await ctx2.close(); await ctx.close();
}

/* ============================================================
   3 — an organiser proposes, and the panel really sees it
   ============================================================ */
console.log('--- 3: the promise that was broken ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  const uid = await member(p, 'organiser@arabna.test');
  const rec = await p.evaluate(async (ev) => {
    const r = await window.__S.addEvent(ev, 'pending');
    return r ? { id: r.id, status: r.status } : null;
  }, EV({ title: { ar: 'أمسيةٌ ثقافيّة', en: 'Cultural evening' } }));
  ok('3.1 an ordinary account’s proposal is accepted', !!rec, rec ? rec.status : 'null');
  const row = (db.events || [])[0];
  ok('3.2 …and lands on the server as `pending`, not live',
     !!row && row.status === 'pending', row ? row.status : 'no row');
  ok('3.3 …carrying the proposer, which the policy demands',
     !!row && row.proposer_id === uid, row ? String(row.proposer_id) : '');

  /* ⚠️ AND A WRITE THE POLICY REFUSES MUST NOT READ AS A SUCCESS. `0002`
     gives an organiser «propose» — an INSERT — and no update of any kind,
     and PostgREST answers a row the policy hides with 200 AND AN EMPTY
     LIST, never an error. So a caller that reads «no error» as «done»
     tells its owner the change was saved over a row that did not move:
     the silent family this whole batch is about, one level down.
     (The door is not linked to any screen — `#/events/edit` is the
     panel's — and the state file records what a later policy would need.) */
  const refused = await p.evaluate(async (id) => {
    const rec = await window.__S.updateEvent(id, { city: 'Katy, TX' }, false);
    return rec === null;
  }, rec.id);
  ok('3.3b an organiser’s edit of their own proposal is refused, and SAID so',
     refused === true && row.city !== 'Katy, TX', row ? String(row.city) : '');

  /* the second half of the promise: the admin has to SEE it */
  await unlockAdmin(p);
  await prime(p);
  const queue = await p.evaluate(async () => {
    await window.__S.loadLiveEvents();
    return window.__S.pendingEvents().map(e => e.title.ar);
  });
  ok('3.4 …and the panel’s queue really holds it', queue.includes('أمسيةٌ ثقافيّة'), queue.join(' | '));

  const after = await p.evaluate(async (id) => {
    const okk = await window.__S.approveEvent(id);
    return { okk, status: (window.__S.eventById(id) || {}).status };
  }, rec.id);
  ok('3.5 …and approving it moves the SERVER’s row, not a local copy',
     after.okk === true && !!row && row.status === 'live' && after.status === 'live',
     [String(after.okk), row ? row.status : 'no row'].join(' · '));
  await ctx.close();
}

/* ============================================================
   3b — a SEED and its row are one thing
   ============================================================ */
console.log('--- 3b: editing and deleting what lives in data.js ---');
{
  /* ⚠️ THE GAP THAT WOULD HAVE SURVIVED THE BATCH. A seed event has no row
     of its own, so before this an admin deleting one pushed its id onto a
     list ON HIS OWN DEVICE and the event stayed on the screen of the
     world — the very fault the batch was written to close, left standing
     in the one path nobody was looking at. Editing had the same shape. */
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await unlockAdmin(p);
  await prime(p);
  const seedId = await p.evaluate(() =>
    (window.__S.allEvents().find(e => !e.demo) || {}).id || '');
  ok('3b.1 there is a seed event to work on', !!seedId, seedId);

  const edited = await p.evaluate(async (id) => {
    const rec = await window.__S.updateEvent(id, { city: 'Katy, TX' }, true);
    return rec ? rec.city : null;
  }, seedId);
  const coat = (db.events || []).find(r => r.seed_id === seedId);
  ok('3b.2 editing a seed writes a COAT row keyed by `seed_id`',
     !!coat && coat.city === 'Katy, TX', coat ? coat.city : 'no row');
  ok('3b.3 …and the record the app reads carries it', edited === 'Katy, TX', String(edited));

  const gone = await p.evaluate(async (id) => {
    const okk = await window.__S.deleteEvent(id);
    return { okk, still: window.__S.allEvents().some(e => e.id === id) };
  }, seedId);
  ok('3b.4 deleting a seed marks the row `deleted` — it is not a device list',
     gone.okk === true && !!coat && coat.status === 'deleted',
     [String(gone.okk), coat ? coat.status : 'no row'].join(' · '));

  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.route('**/fonts.googleapis.com/**', r => r.abort());
  await mockSupabase(ctx2, { db });
  const p2 = await ctx2.newPage(); wire(p2);
  await open(p2, '#/events');
  const elsewhere = await p2.evaluate(async (id) => {
    await window.__S.loadLiveEvents();
    return window.__S.allEvents().some(e => e.id === id);
  }, seedId);
  ok('3b.5 …so a SECOND device stops seeing it too', elsewhere === false && gone.still === false,
     [String(elsewhere), String(gone.still)].join(' · '));
  await ctx2.close(); await ctx.close();
}

/* ============================================================
   4 — the server refuses what the screen would not send
   ============================================================ */
console.log('--- 4: the policy, not the screen ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await member(p, 'plain@arabna.test');
  /* ⚠️ THE APP'S OWN GUARD IS BYPASSED ON PURPOSE. `addEvent` downgrades a
     non-admin's `live` to `pending` before it sends anything, so measuring
     through it would measure the screen. What has to hold is that the
     DATABASE refuses — a guard on a screen is bypassed by anything that is
     not that screen: the console today, an API call tomorrow. */
  const direct = await p.evaluate(async () => {
    const S = window.__S;
    const { data, error } = await S.sb.from('events').insert({
      title_ar: 'منشورٌ بلا إذن', status: 'live', featured: true,
      starts_at: new Date().toISOString(),
    }).select();
    return { rows: (data || []).length, err: error ? (error.code || error.message || 'err') : '' };
  });
  ok('4.1 an ordinary account cannot publish to everybody',
     direct.rows === 0 && !!direct.err, [String(direct.rows), direct.err].join(' · '));
  ok('4.2 …and nothing of it reached the table', (db.events || []).length === 0,
     String((db.events || []).length));
  ok('4.3 …so the $99 pin cannot be taken by asking for it',
     !(db.events || []).some(r => r.featured));
  await ctx.close();
}

/* ============================================================
   5 — every box a human fills has a column, and the value arrives
   ============================================================ */
console.log('--- 5: the eleven fields ---');
{
  /* ⚠️ COUNTED, NOT READ. `645` §8 found the marketplace collecting a city
     with no column to send it to; the events form was breaking the same
     rule eleven times. The table below is the contract, and each half of
     it is measured: the form really builds the key, the migration really
     has the column, and the value really arrives in the row. */
  const FIELDS = [
    { key: 'type',       col: 'type',         val: r => r.type === 'festival' },
    { key: 'city',       col: 'city',         val: r => r.city === 'Houston, TX' },
    { key: 'organizer',  col: 'organizer_ar', val: r => r.organizer_ar === 'المركزُ الثقافيّ' },
    { key: 'ticketUrl',  col: 'ticket_url',   val: r => r.ticket_url === 'https://example.org/tickets' },
    { key: 'featured',   col: 'featured',     val: r => r.featured === true },
    { key: 'concert',    col: 'concert',      val: r => r.concert && r.concert.artist === 'فرقةُ المدينة' },
    { key: 'repeat',     col: 'repeat',       val: r => r.repeat && r.repeat.kind === 'gregorian' },
    { key: 'venue',      col: 'venue_ar',     val: r => r.venue_ar === 'قاعةُ الجالية' },
    { key: 'title',      col: 'title_ar',     val: r => r.title_ar === 'مهرجانُ الجالية' },
    { key: 'desc',       col: 'body_ar',      val: r => r.body_ar === 'وصفٌ قصير' },
    { key: 'startsAt',   col: 'starts_at',    val: r => !!r.starts_at },
  ];
  const form = code('js/screens/events.js');
  const payload = /const payload = \{([\s\S]*?)\n    \};/.exec(form);
  const body = payload ? payload[1] : '';
  const noKey = FIELDS.filter(f => !new RegExp('(^|\\s)' + f.key + ':').test(body)).map(f => f.key);
  ok('5.1 every field in the table is really built by the form',
     !!body && noKey.length === 0, noKey.join(', '));

  const sql = sqlCode();
  const noCol = FIELDS.filter(f => !new RegExp('\\b' + f.col + '\\b').test(sql)).map(f => f.col);
  ok('5.2 …and every one has a column', noCol.length === 0, noCol.join(', '));

  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await unlockAdmin(p);
  await prime(p);
  await p.evaluate(async (ev) => window.__S.addEvent(ev, 'live'), EV({
    featured: true, type: 'festival',
    concert: { artist: 'فرقةُ المدينة', doorsAt: '18:00', priceFrom: '35', ageLimit: '', familySeating: true },
    repeat: { kind: 'gregorian', spawned: [] },
  }));
  const row = (db.events || [])[0] || {};
  const lost = FIELDS.filter(f => !f.val(row)).map(f => f.key);
  ok('5.3 …and the value really arrives in the row', (db.events || []).length === 1 && lost.length === 0,
     lost.join(', '));

  /* ⚠️ `place` is one column for two languages and `venue_ar`/`venue_en`
     replaced it. It is not written, so it is recorded as having lost its
     reader rather than quietly kept half in step. */
  ok('5.4 `place` is not written beside them', row.place === undefined,
     String(row.place));
  await ctx.close();
}

/* ============================================================
   6 — the day is the day
   ============================================================ */
console.log('--- 6: an all-day date survives the server ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await unlockAdmin(p);
  await prime(p);
  await p.evaluate(async (ev) => window.__S.addEvent(ev, 'live'), EV({
    title: { ar: 'مهرجانُ يومين', en: 'Two-day festival' },
    startsAt: '2027-10-17', endsAt: '2027-10-18',
  }));
  const row = (db.events || [])[0] || {};
  ok('6.1 a date with no hour is stored as an all-day row', row.all_day === true, String(row.all_day));
  /* ⚠️ NOON AND NEVER MIDNIGHT: UTC midnight on the 17th is the EVENING OF
     THE 16th in Houston, so the app would print the day BEFORE the
     festival and hide one that is still running. */
  ok('6.2 …at noon in the directory’s own zone, not midnight',
     /T1[5-9]:00:00/.test(String(row.starts_at)), String(row.starts_at));

  const back = await p.evaluate(async () => {
    const S = window.__S;
    S.state.extraEvents = [];               // read it as a stranger would
    await S.loadLiveEvents();
    const e = S.allEvents().find(x => (x.title.ar || '') === 'مهرجانُ يومين');
    return e ? { s: e.startsAt, e: e.endsAt, allDay: S.eventIsAllDay(e.startsAt) } : null;
  });
  ok('6.3 …and it comes back the bare date it was written as',
     !!back && back.s === '2027-10-17', back ? back.s : 'null');
  ok('6.4 …with the END day intact too', !!back && back.e === '2027-10-18', back ? back.e : '');
  ok('6.5 …so `eventIsAllDay` still answers true and no hour is printed',
     !!back && back.allDay === true);

  /* a timed event has to survive the same trip unchanged: sent with no
     zone, `2027-05-20T16:00` is read by the server as 16:00 UTC — 11:00
     in the morning there */
  await p.evaluate(async (ev) => window.__S.addEvent(ev, 'live'),
                   EV({ title: { ar: 'ساعةٌ معلنة', en: 'A stated hour' } }));
  const timed = await p.evaluate(async () => {
    const S = window.__S;
    S.state.extraEvents = [];
    await S.loadLiveEvents();
    const e = S.allEvents().find(x => (x.title.ar || '') === 'ساعةٌ معلنة');
    return e ? e.startsAt : '';
  });
  ok('6.6 an announced hour comes back the same hour', timed === '2027-05-20T16:00', timed);

  const printed = await p.evaluate(async () => {
    const E = await import('arabna/js/screens/events.js').catch(() => import('./js/screens/events.js'));
    return { day: E.fmtEventDate('2027-10-17'), hour: E.fmtEventDate('2027-05-20T16:00') };
  });
  ok('6.7 …and the screen prints no hour for a day with none',
     !/\d{1,2}:\d{2}/.test(printed.day) && /\d{1,2}:\d{2}/.test(printed.hour),
     printed.day + ' | ' + printed.hour);
  await ctx.close();
}

/* ============================================================
   7 — every table in 0001 has a writer or a named line
   ============================================================ */
console.log('--- 7: the rule the third repetition earned ---');
{
  /* ⚠️ COUNTED FROM THE SCHEMA, never from a list written here — the same
     reason `run.sh` derives its suites. A table added tomorrow with no
     writer and no line turns this red the day it is created. */
  const tables = [...sqlAll().matchAll(/create table public\.([a-z_]+)/g)].map(m => m[1]);
  ok('7.1 the schema’s tables are read, not listed', tables.length >= 17, String(tables.length));

  const js = ['js/store.js', 'js/app.js', 'js/ui.js']
    .concat(readdirSync(ROOT + 'js/screens').map(n => 'js/screens/' + n))
    .map(f => code(f)).join('\n');
  const writes = new Set();
  for (const m of js.matchAll(/from\('([a-z_]+)'\)[\s\S]{0,120}?\.(insert|update|upsert|delete)\(/g)) {
    writes.add(m[1]);
  }

  const doc = read('docs/الحالة.md');
  const sec = /## 1\.د\)[\s\S]*?\n## /.exec(doc);
  const rows = new Map();
  for (const m of (sec ? sec[0] : '').matchAll(/^\|\s*`([a-z_]+)`\s*\|([^\n]*)\|/gm)) {
    rows.set(m[1], m[2]);
  }
  ok('7.2 …and every one of them has a line in the state file',
     tables.every(t => rows.has(t)), tables.filter(t => !rows.has(t)).join(', '));

  const said = t => String(rows.get(t) || '');
  const claimsWritten = t => /مكتوبٌ اليوم/.test(said(t));
  const named = t => /`\d{3}`/.test(said(t)) || /لا دفعةَ مجدولة/.test(said(t));
  const wrong = tables.filter(t => claimsWritten(t) ? !writes.has(t) : !named(t));
  ok('7.3 …saying «written today» only where a writer exists, and naming a batch otherwise',
     wrong.length === 0, wrong.join(', '));
  /* the three that really are written, and the day a fourth is wired its
     line has to move with it */
  ok('7.4 the tables with a writer today are exactly the three that claim one',
     [...writes].sort().join(',') === tables.filter(claimsWritten).sort().join(','),
     [...writes].sort().join(',') + ' | ' + tables.filter(claimsWritten).sort().join(','));
}

/* ============================================================
   8 — the pin, the place in the calendar, and the stable tail
   ============================================================ */
console.log('--- 8: what the order has to deliver ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await unlockAdmin(p);
  await prime(p);
  await p.evaluate(async (evs) => {
    for (const ev of evs) await window.__S.addEvent(ev, 'live');
  }, [
    EV({ title: { ar: 'بعيدةٌ ومثبَّتة', en: 'far and pinned' }, startsAt: '2027-12-01T18:00', endsAt: '', featured: true }),
    EV({ title: { ar: 'قريبةٌ حرّة', en: 'near and free' },     startsAt: '2027-01-05T18:00', endsAt: '' }),
    EV({ title: { ar: 'أُدخلت أخيراً', en: 'entered last' },     startsAt: '2027-03-09T18:00', endsAt: '' }),
    EV({ title: { ar: 'الأولى في يومٍ مشترك', en: 'same day A' }, startsAt: '2027-04-02T18:00', endsAt: '' }),
    EV({ title: { ar: 'الثانية في يومٍ مشترك', en: 'same day B' }, startsAt: '2027-04-02T18:00', endsAt: '' }),
  ]);
  const list = await p.evaluate(async () => {
    const S = window.__S;
    S.state.extraEvents = [];
    await S.loadLiveEvents();
    return S.upcomingEvents().map(e => e.title.ar);
  });
  ok('8.1 the pinned event leads, however far off its date is',
     list[0] === 'بعيدةٌ ومثبَّتة', list.slice(0, 3).join(' | '));
  const iNear = list.indexOf('قريبةٌ حرّة'), iLast = list.indexOf('أُدخلت أخيراً');
  ok('8.2 …and an event entered last falls into its place in the calendar, not the tail',
     iNear > 0 && iLast > iNear, [iNear, iLast].join(' · '));

  const order = (db.reads || []).filter(r => r.table === 'events').map(r => r.order).pop() || '';
  ok('8.3 the server was asked in the screen’s own order',
     /featured\.desc/.test(order) && /starts_at\.asc/.test(order), order);
  /* ⚠️ two rows sharing the leading key with no unique tiebreak swap places
     between one page and the next: one appears twice and the other
     disappears. One line closes a known family of paging faults. */
  ok('8.4 …with `id` last, which is what makes two on one day stable',
     /,\s*id(\.asc)?$/.test(order.trim()), order);

  const twice = await p.evaluate(async () => {
    const S = window.__S;
    const one = S.upcomingEvents().map(e => e.title.ar);
    await S.loadLiveEvents();
    const two = S.upcomingEvents().map(e => e.title.ar);
    return one.join('|') === two.join('|');
  });
  ok('8.5 …and reading it again returns the very same order', twice === true);
  await ctx.close();
}

/* ============================================================
   9 — a network failure keeps the seeds and empties nothing
   ============================================================ */
console.log('--- 9: null is not [] ---');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  /* every call to the host fails, exactly as no signal does */
  await ctx.route('https://*.supabase.co/**', r => r.abort());
  const p = await ctx.newPage(); wire(p);
  await open(p, '#/events');
  const n = await p.evaluate(async () => {
    await window.__S.loadLiveEvents();
    return { all: window.__S.allEvents().length, up: window.__S.upcomingEvents().length };
  });
  ok('9.1 with the server unreachable the seed events are still there',
     n.all > 0 && n.up > 0, JSON.stringify(n));
  const empty = await p.evaluate(() => (document.querySelectorAll('#app .empty') || []).length);
  ok('9.2 …and the section is not an empty state', empty === 0, String(empty));
  await ctx.close();
}

console.log('--- console ---');
ok('10.1 zero console errors across the batch', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
