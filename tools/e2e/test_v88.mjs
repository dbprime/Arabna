/* 656 — events enter weekly, with no batch and no version raise.

   ⚠️ THE FAULT THIS CLOSES IS MEASURED. `642` put four events into the app
   and cost 664 added lines, a new suite, a version raise, a full net of
   160 runs, a pull request and the owner's own hand — THE PRICE OF CODE,
   PAID FOR CONTENT. An event is not a feature, it is a row in a table, and
   a festival is postponed and a hall changes and an hour is announced late.
   The only road for entering one from outside the browser was editing
   `js/data.js`, which touches `js/` and so closes its group.

   ⚠️ AND THE COVERAGE IS STATIC BY DECISION, not for want of effort. What
   is guarded here is the SHAPE of a weekly file — and the place to guard a
   written rule is a static read of the text, never a screen. The rows
   themselves were measured against a REAL POSTGRESQL 16 while this batch
   was written (idempotence over three runs, the zone offsets for October
   and November, and the two faults in the spec's own §2 and §3), and those
   figures are in `CLAUDE.md`. What lives here is what must not rot after.

   ⚠️ COMMENTS ARE STRIPPED BEFORE ANY «does the file do X» QUESTION. Every
   migration's head has to name `||` and `count(*)` in order to explain why
   they are forbidden, and this file's own head names `seed_id`. A check
   that read the prose would report the fault it exists to prevent — this
   project has paid for that five times (v53, v55, 649, v84, v86). */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

/* ⚠️ never a relative path — run.sh runs from its own working directory. */
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
const sqlCode = s => s.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');

const MIG = 'supabase/migrations/';
const LOG = 'docs/الفعاليّات-المدرجة.md';
const files = readdirSync(ROOT + MIG).filter(f => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();

/* every `insert into public.events … ;` in the repository, as CODE.
   ⚠️ THE SPLIT IS QUOTE-AWARE, and that is not fussiness — it was measured.
   A first version cut on the first `;` it met, and an event's own English
   description reads «…from the centre calendar; Interfaith Ministries…».
   So the statement was truncated mid-string and the checks that read its
   tail — the conflict target among them — reported a fault in a file that
   had none. A parser that stops inside a string literal measures the
   parser, not the file. */
function statements(code) {
  const out = [];
  let i = 0, start = -1, q = false;
  while (i < code.length) {
    const c = code[i];
    if (q) {
      if (c === "'") { if (code[i + 1] === "'") i++; else q = false; }
    } else if (c === "'") { q = true; }
    else if (c === ';') { if (start >= 0) out.push(code.slice(start, i + 1)); start = -1; }
    else if (start < 0 && !/\s/.test(c)) start = i;
    i++;
  }
  return out;
}
const inserts = [];
for (const f of files) {
  for (const st of statements(sqlCode(read(MIG + f))))
    if (/^insert\s+into\s+public\.events\b/i.test(st.trim())) inserts.push({ file: f, sql: st });
}

/* ============================================================
   1 — the key, and the index that holds it
   ============================================================ */
console.log('--- 1: the fixed key ---');
{
  const KEY = '0015_events_external_key.sql';
  ok('1.1 the key migration is in the repository', files.includes(KEY));
  const code = sqlCode(read(MIG + KEY));
  ok('1.2 it creates a UNIQUE index on external_id, idempotently',
     /create\s+unique\s+index\s+if\s+not\s+exists\s+events_external_id_key\s+on\s+public\.events\s*\(\s*external_id\s*\)/i.test(code));
  /* ⚠️ THE INDEX IS PARTIAL, or every panel row collides on `null` after
     the first: a row entered from the admin panel carries no external id. */
  ok('1.3 …and it is PARTIAL on `external_id is not null`',
     /where[\s\S]*external_id\s+is\s+not\s+null/i.test(code));
  /* ⚠️ AND THE PREDICATE EXCLUDES THE EMPTY STRING. Measured on a real
     PostgreSQL 16: `eventRowFrom` in `js/store.js` writes
     `external_id: ev.externalId || ''` — an EMPTY STRING, never NULL — for
     every event entered from the panel, so `is not null` alone takes them
     all in and the SECOND panel event is refused:
       ERROR: duplicate key value · DETAIL: Key (external_id)=() already exists
     and on a database already holding two of them THIS FILE aborts:
       ERROR: could not create unique index · Key (external_id)=() is duplicated
     That is the panel's own «add event» button broken, which §6 of the
     batch says must not be touched. */
  ok('1.4 …and the empty string is not a key — the panel writes `\'\'`, not null',
     /external_id\s*<>\s*''/i.test(code));
}

/* ============================================================
   2 — what a weekly insert must carry
   ============================================================ */
console.log('--- 2: the shape of a weekly insert ---');
{
  ok('2.1 there is at least one weekly insert to measure', inserts.length > 0,
     inserts.length + ' insert(s) across ' + [...new Set(inserts.map(i => i.file))].join(' '));

  /* ⚠️ THE ONE THAT FAILS IN TOTAL SILENCE. Measured in `mergedEvents` in
     `js/store.js`: a row carrying `seed_id` falls into `coats`, and `coats`
     is read ONLY from inside a loop walking `EVENTS` in `js/data.js`. So a
     row with a `seed_id` no seed matches is written successfully, the
     server answers «done», and NO HUMAN EVER SEES IT ON ANY SCREEN. */
  const withSeed = inserts.filter(i => /\bseed_id\b/.test(i.sql));
  ok('2.2 no weekly insert writes `seed_id` — a row with one is invisible on every screen',
     withSeed.length === 0, withSeed.map(i => i.file).join(' '));

  const noExt = inserts.filter(i => !/\bexternal_id\b/.test(i.sql));
  ok('2.3 every weekly insert carries an `external_id` — with no fixed key there is no ceiling on repeats',
     noExt.length === 0, noExt.map(i => i.file).join(' '));

  const noConflict = inserts.filter(i => !/on\s+conflict\s*\(\s*external_id\s*\)[\s\S]*?do\s+nothing/i.test(i.sql));
  ok('2.4 …and `on conflict (external_id) … do nothing`, so a re-run inserts nothing',
     noConflict.length === 0, noConflict.map(i => i.file).join(' '));

  /* ⚠️ MEASURED, AND A SEPARATE FAULT FROM 1.4: PostgreSQL infers a PARTIAL
     unique index only when the statement REPEATS its predicate. The short
     form the batch file's own §3 template writes fails outright —
       ERROR: there is no unique or exclusion constraint matching the
              ON CONFLICT specification
     — and it fails with the narrow predicate too, so correcting the index
     alone would not have rescued it. */
  const shortTarget = inserts.filter(i =>
    !/on\s+conflict\s*\(\s*external_id\s*\)\s+where[\s\S]*?external_id\s+is\s+not\s+null[\s\S]*?external_id\s*<>\s*''/i.test(i.sql));
  ok('2.5 …and the conflict target REPEATS the index predicate, or the insert is refused',
     shortTarget.length === 0, shortTarget.map(i => i.file).join(' '));

  /* ⚠️ `place` is one column for two languages; `venue_ar`/`venue_en`
     replaced it, `mapLiveEventRowToJs` does not read it and `eventRowFrom`
     does not write it. Writing it here would fill a column nothing reads
     and make the weekly road disagree with the app's own writer. */
  const withPlace = inserts.filter(i => /\bplace\b/.test(i.sql));
  ok('2.6 no weekly insert writes `place` — the column has no reader',
     withPlace.length === 0, withPlace.map(i => i.file).join(' '));

  /* ⚠️ `featured` is the paid $99 weekly pin (`AD_PRODUCTS.event`). An
     editorial row ticking it crowds out whoever paid for it. */
  const withFeatured = inserts.filter(i => /\bfeatured\b/.test(i.sql));
  ok('2.7 no weekly insert claims `featured` — that pin is sold, not editorial',
     withFeatured.length === 0, withFeatured.map(i => i.file).join(' '));
}

/* ============================================================
   3 — the clock, and the day it must not slip
   ============================================================ */
console.log('--- 3: the hour is the city\'s ---');
{
  /* An insert by SQL does not pass through `addEvent`, which is what pins
     an all-day event to noon and reads the `America/Chicago` offset. So
     every weekly file states the zone itself and lets the engine read the
     offset FOR THAT DATE — measured on PostgreSQL 16:
        2026-10-04 12:00 America/Chicago -> 17:00Z  (CDT, UTC-5)
        2026-11-15 12:00 America/Chicago -> 18:00Z  (CST, UTC-6)
     October and November are not on one offset, so no offset is written
     by hand. */
  const stamps = [];
  for (const i of inserts) {
    const re = /timestamptz\s+'(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2}):\d{2}\s+([A-Za-z_\/]+)'/g;
    let m; while ((m = re.exec(i.sql))) stamps.push({ file: i.file, d: m[1], h: m[2], mi: m[3], tz: m[4] });
  }
  ok('3.1 every timestamp in a weekly insert names the directory zone, never a hand-written offset',
     stamps.length > 0 && stamps.every(s => s.tz === 'America/Chicago'),
     stamps.length + ' stamp(s) · zones: ' + [...new Set(stamps.map(s => s.tz))].join(','));

  const naked = inserts.filter(i =>
    /(starts_at|ends_at)?\s*'?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})/.test(i.sql));
  ok('3.2 …and none writes a UTC instant or a numeric offset directly',
     naked.length === 0, naked.map(i => i.file).join(' '));

  /* ⚠️ AN ALL-DAY EVENT IS WRITTEN AT NOON AND NEVER AT MIDNIGHT. Measured
     through the app's own `eventFromInstant`: midnight UTC on 2026-10-17
     reads back as 2026-10-16 — the day BEFORE the festival — while noon in
     the city zone reads back as 2026-10-17. Noon crosses no day boundary
     in any zone; midnight crosses one in every zone east or west. */
  const bad = [];
  for (const i of inserts) {
    if (!/\ball_day\b/.test(i.sql)) continue;
    const allDayTrue = /,\s*true\s*,/.test(i.sql.replace(/timestamptz\s+'[^']*'/g, 'TS'))
      || /all_day\s*=>\s*true/i.test(i.sql);
    if (!allDayTrue) continue;
    const re = /timestamptz\s+'(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2}):\d{2}\s+America\/Chicago'/g;
    let m; while ((m = re.exec(i.sql))) if (m[2] !== '12' || m[3] !== '00') bad.push(i.file + ' ' + m[2] + ':' + m[3]);
  }
  ok('3.3 an all-day row is stamped at 12:00 city time — noon is a condition, not a habit',
     bad.length === 0, bad.join(' '));

  /* `title_ar` is `not null`, and an English-only source has its name in
     both columns as it stands. The name appears as its owner wrote it and
     is not translated — the same rule that keeps a city name English. */
  const noTitleAr = inserts.filter(i => !/\btitle_ar\b/.test(i.sql));
  ok('3.4 every weekly insert carries `title_ar` — the column is `not null`',
     noTitleAr.length === 0, noTitleAr.map(i => i.file).join(' '));
}

/* ============================================================
   4 — the log, in both directions
   ============================================================ */
console.log('--- 4: the log stays alive ---');
{
  ok('4.1 the log is in the repository', existsSync(ROOT + LOG));
  const log = read(LOG);

  /* ⚠️ THE RULE THAT KEEPS IT ALIVE RATHER THAN AGEING. The session that
     checks events weekly does not reach the server and cannot see its
     rows, so without this file it has no way at all to know what really
     entered the app — it either re-reports what was entered or stays
     silent about what was not, and both are a fault. */
  const ids = [...new Set(inserts.flatMap(i =>
    [...i.sql.matchAll(/'(wk-[a-z0-9-]+)'/gi)].map(m => m[1])))];
  ok('4.2 there is at least one weekly id to match', ids.length > 0, ids.join(' '));
  const missing = ids.filter(id => !log.includes(id));
  ok('4.3 every `external_id` in a migration has a line in the log',
     missing.length === 0, missing.join(' '));

  /* …and the other direction, so a line cannot outlive its row either. */
  const logIds = [...new Set([...log.matchAll(/`(wk-[a-z0-9-]+)`/g)].map(m => m[1]))];
  const orphan = logIds.filter(id => !ids.includes(id));
  ok('4.4 …and every `wk-` line in the log has a migration behind it',
     orphan.length === 0, orphan.join(' '));

  /* the four seeds are named, and `e1`–`e3` are not: they are invented,
     inside `markDemo`, and the sample has been off by default since 510. */
  /* ⚠️ THE TABLE, NEVER THE PROSE. The log's own text has to name `e1`–`e3`
     in order to say why they are absent from it, so a check reading the
     whole file reports the fault it exists to prevent — the same rule that
     strips comments before reading code, paid for once more inside this
     very suite. */
  const rows = log.split('\n').filter(l => /^\s*\|/.test(l) && !/^\s*\|\s*-/.test(l));
  const table = rows.join('\n');
  ok('4.5 the four real seeds are in the log', ['e4', 'e5', 'e6', 'e7'].every(e => table.includes('`' + e + '`')),
     rows.length + ' table row(s)');
  ok('4.6 …and the three invented ones are not', !['e1', 'e2', 'e3'].some(e => table.includes('`' + e + '`')));

  /* the id's shape is derived from the EVENT, not from the day it was
     entered — which is what makes «a repeat in the report is cheaper than
     an event that is missed» safe. */
  const shaped = ids.every(id => /^wk-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(id));
  ok('4.7 every weekly id is `wk-<start date>-<short name>`', shaped, ids.join(' '));
}

/* ============================================================
   5 — the two characters the SQL editor drops
   ============================================================ */
console.log('--- 5: no `*` and no `||` in the code of any migration ---');
{
  /* ⚠️ THE GUARD COVERS THE OLD AND THE NEW, and it reads the CODE: every
     migration's head has to NAME the two characters in order to explain
     why they are forbidden, so a check over the raw text would demand
     rewriting the very comment that states the rule. */
  const offenders = [];
  for (const f of files) {
    /* ⚠️ `0005` IS THE ONE RECORDED EXCEPTION, named so a later sweep
       cannot quietly «fix» it into a lie. It carries `||` in its code, it
       was run on the server by hand as a `concat` copy, and that is
       written in the migration log in `docs/الحالة.md`. Rewriting a file
       that has already been applied would make the repository disagree
       with the database. Since `652` the runner applies migrations, so no
       later file is ever pasted — the rule stands for whatever still is. */
    if (f === '0005_admin_find_users.sql') continue;
    const code = sqlCode(read(MIG + f));
    if (code.includes('||')) offenders.push(f + ' (||)');
    if (code.includes('*')) offenders.push(f + ' (*)');
  }
  ok('5.1 every migration but the one recorded exception is clean',
     offenders.length === 0, offenders.join(' '));
  /* and the exception is asserted to still BE the exception: the day it is
     rewritten, this line says so rather than the guard quietly widening. */
  const five = sqlCode(read(MIG + '0005_admin_find_users.sql'));
  ok('5.2 …and `0005` is still the only one, still carrying what the log records',
     five.includes('||'), 'recorded in docs/الحالة.md as run as a concat copy');
}

/* ============================================================
   6 — the road is written down, and the panel is untouched
   ============================================================ */
console.log('--- 6: the road, and what it must not cost ---');
{
  const md = read('CLAUDE.md');
  ok('6.1 the weekly road is written in CLAUDE.md',
     /docs\/الفعاليّات-المدرجة\.md/.test(md) && /0015|external_id/.test(md));
  /* ⚠️ AND THE WHOLE POINT OF THE BATCH: nothing in `js/` or `styles/`.
     A weekly file that edits either closes its group and costs a version
     raise and a full net — which is the cost this exists to stop paying. */
  ok('6.2 …and it says the weekly entry touches no line of the app',
     /لا شيءَ في `js\/`/.test(md));
  /* the panel's own «add event» button stays an option — the owner's
     decision — and 1.4 is what keeps this migration from breaking it. */
  ok('6.3 the panel\'s own add-event form is still there',
     /data-evsave|evsave/.test(read('js/screens/admin.js')) || /addEvent/.test(read('js/screens/events.js')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
