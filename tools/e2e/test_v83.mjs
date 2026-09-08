/* V.10.8 — 648: the foundation, before anything is poured onto it.
 *
 * ⚠️ NOTHING IN THIS BATCH IS VISIBLE ON A SCREEN, which is exactly why it
 * is measured by suites alone and needs measuring more, not less: nobody
 * will ever find its faults by using the app. And all four were found by a
 * sweep, not by the net and not by a complaint — and not one of them is
 * seen today while every one of them is seen in a month.
 *
 *   1  `updated_at`: seventeen columns and no writer for one of them
 *   2  a read with no order and no limit is cut short IN SILENCE
 *   3  the listing limit was guarded on the device alone
 *   4  an id that lives on the server comes from the server — a rule, and
 *      a check that keeps it rather than a sentence that is forgotten
 *
 * ⚠️ Its place in the queue IS the batch: `650`, `655` and `665` start
 * filling the tables, and four of these cannot be repaired after the
 * filling except by migrating data — a column with no writer, a read that
 * truncates silently, an id that collides, and a limit nobody guards.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
const MIG = ROOT + 'supabase/migrations/';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ comments stripped before any «does the code do X» check — `test_v53`'s
   rule, which this project has now paid for four times. The migration below
   NAMES `security definer` in a comment explaining why it is absent. */
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
  window.__I = await import('arabna/js/i18n.js').catch(() => import('./js/i18n.js'));
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

/* ============================================================
   1 — `updated_at` moves, and the client never writes it
   ============================================================ */
console.log('--- 1: a column that named itself «last updated» and never moved ---');
{
  const sql = sqlCode();
  /* ⚠️ DERIVED FROM THE SCHEMA, never from a written list of seventeen
     names: a table added tomorrow with the column and without the trigger
     has to turn this red on its own. */
  const tables = [...sql.matchAll(/create table public\.(\w+) \(([\s\S]*?)\n\);/g)]
    .filter(m => /^\s*updated_at\s+timestamptz/m.test(m[2])).map(m => m[1]);
  ok('1.1 every table in the schema carries `updated_at`', tables.length === 17,
     tables.length + ' tables');
  const missing = tables.filter(t =>
    !new RegExp('create trigger set_updated_at before update on public\\.' + t + '\\b').test(sql));
  ok('1.2 …and every one of them has a `before update` trigger',
     missing.length === 0, missing.join(', ') || tables.length + ' triggers');
  ok('1.3 the function exists and is one function, not seventeen',
     (sql.match(/create or replace function public\.set_updated_at/g) || []).length === 1);
  /* ⚠️ a privilege the build does not need is not granted — `0005`'s own
     rule, read backwards */
  const fn = /create or replace function public\.set_updated_at[\s\S]*?\$\$;/.exec(sql);
  ok('1.4 …and carries NO `security definer`', !!fn && !/security definer/i.test(fn[0]));
  /* ⚠️ the device's clock belongs to whoever holds the device, and this app
     shifts it on purpose (`clockOffset`) to test the panel. Only the server
     knows when. */
  const jsAll = readdirSync(ROOT + 'js').filter(n => n.endsWith('.js'))
    .map(n => strip(read('js/' + n))).join('\n');
  ok('1.5 the client never writes `updated_at`', !/updated_at/.test(jsAll));

  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p);
  await member(p, 'ua@a.app');
  const rec = await p.evaluate(async () => {
    const S = window.__S;
    return await S.addClassified({ cat: 'cars', title: { ar: 'ت', en: 't' },
      desc: { ar: 'وصف', en: 'body' }, price: '$100', city: 'Houston' });
  });
  const row = () => (db.classifieds || []).find(r => r.id === (rec && rec.id));
  ok('1.6 a NEW row carries the two stamps equal', !!row() && row().created_at === row().updated_at,
     row() ? row().created_at : 'no row');
  const born = row() && row().created_at;
  await p.waitForTimeout(30);
  await p.evaluate(id => window.__S.updateClassified(id, { city: 'Katy' }), rec.id);
  await p.waitForTimeout(500);
  ok('1.7 an UPDATE moves `updated_at`…', !!row() && row().updated_at > born,
     row() ? row().updated_at : '');
  ok('1.8 …and leaves `created_at` where it was', !!row() && row().created_at === born);
  await ctx.close();
}

/* ============================================================
   2 — one factory: order, paging and a ceiling
   ============================================================ */
console.log('--- 2: a read with no order and no limit is cut short in silence ---');
{
  const st = code('js/store.js');
  ok('2.1 the factory exists', /function makeLiveReader\(/.test(st));
  const tables = [...st.matchAll(/makeLiveReader\('([a-z_]+)'/g)].map(m => m[1]);
  ok('2.2 both live readers go through it', tables.includes('businesses') && tables.includes('classifieds'),
     tables.join(' · '));
  /* ⚠️ SCOPED to a LIVE read, not to every `select`: a single-row read of
     one's own profile (`.eq(...).single()`) is not a reader of a table and
     must not be dragged into the rule. What must not exist is a whole-table
     select outside the factory. */
  const strays = [...st.matchAll(/sb\.from\('([a-z_]+)'\)\.select\('\*'\)([^\n;]*)/g)]
    .filter(m => !/\.eq\(/.test(m[2]));
  ok('2.3 no whole-table select outside the factory', strays.length === 0,
     strays.map(m => m[1]).join(', '));
  /* ⚠️ …and the factory names its table through its own parameter, which is
     WHY the sweep above can be a literal one: a live reader that wrote its
     table name inline would be caught by it. */
  ok('2.3b …and the factory reads by the name it was given',
     /sb\.from\(table\)\.select\('\*'\)/.test(st));
  const fn = /function makeLiveReader\([\s\S]*?\n}/.exec(st);
  ok('2.4 the factory orders every read', !!fn && /\.order\(col, opt\)/.test(fn[0]));
  /* ⚠️ two rows sharing the leading key with no unique tiebreak swap places
     between pages: one appears twice and the other disappears */
  ok('2.5 …and `id` is always the last key', !!fn && /\.order\('id'\)/.test(fn[0]));
  ok('2.6 it pages with `.range`', !!fn && /\.range\(from, from \+ LIVE_PAGE - 1\)/.test(fn[0]));
  /* ⚠️ a loop with no ceiling spins for ever on a broken answer, and
     reaching the ceiling is SAID rather than swallowed */
  ok('2.7 a ceiling exists and is announced, not swallowed',
     /LIVE_MAX_PAGES/.test(st) && !!fn && /pages >= LIVE_MAX_PAGES[\s\S]{0,160}console\.warn/.test(fn[0]));
  ok('2.8 the page size is a named constant, not a number in the call',
     /export const LIVE_PAGE = \d+/.test(st));
  /* `630`'s lesson: the policy decides who sees what, and a filter in the
     client blinds the queue. Ordering is not filtering. */
  ok('2.9 no status filter in any `sb.from` chain',
     !/sb\.from\([^)]*\)[^;]*\.eq\('status'/.test(st));

  /* and the same list the factory registers is the list it exports */
  const { ctx, p, db } = await fresh();
  /* ⚠️ MORE ROWS THAN ONE PAGE: with no paging the answer comes back short
     and in no order, and nothing says so. */
  const N = 1150;
  for (let i = 0; i < N; i++) {
    db.businesses.push({ id: 'srv-' + String(i).padStart(4, '0'), seed_id: null,
      status: 'live', name_en: 'S' + i, name_ar: 'S' + i, cat: 'cafe',
      created_at: new Date(1700000000000 + i * 1000).toISOString() });
  }
  await open(p);
  const seen = await p.evaluate(() => window.__S.liveReaderTables());
  ok('2.10 the exported list is the factory’s own registrations',
     JSON.stringify(seen) === JSON.stringify(tables), seen.join(' · '));
  const got = await p.evaluate(async () => (await window.__S.loadLiveBusinesses() || []).length);
  ok('2.11 a table larger than one page comes back WHOLE', got === N, got + ' of ' + N);
  const reads = (db.reads || []).filter(r => r.table === 'businesses');
  ok('2.12 …in more than one request', reads.length >= Math.ceil(N / 500),
     reads.length + ' requests');
  ok('2.13 …every one of them ordered and bounded',
     reads.length > 0 && reads.every(r => r.order && r.limit),
     reads[0] ? reads[0].order + ' · limit ' + reads[0].limit : '');
  ok('2.14 …and the order ends on `id`',
     reads.length > 0 && /,id\.asc$|^id\.asc$/.test(reads[0].order), reads[0] && reads[0].order);
  const twice = await p.evaluate(async () => {
    const S = window.__S;
    const a = (await S.loadLiveBusinesses() || []).map(r => r.id).join(',');
    const b = (await S.loadLiveBusinesses() || []).map(r => r.id).join(',');
    return a === b && a.length > 0;
  });
  ok('2.15 the order is the same on a second read', twice);
  await ctx.close();
}

/* ============================================================
   3 — the limit is guarded where it can be guarded
   ============================================================ */
console.log('--- 3: one account from two devices published without a limit ---');
{
  const sql = sqlCode();
  ok('3.1 a `before insert` trigger stands on `classifieds`',
     /create trigger classifieds_limit before insert on public\.classifieds/.test(sql));
  /* ⚠️ THE FUNCTION'S OWN DEFAULT IS ALLOWED AND MUST EQUAL THE SEEDED ROW.
     A trigger that refuses because a setting never arrived closes publishing
     for everybody — which is worse than a limit nobody guards. So the rule
     is not «no number in the function» but «one number, and it agrees». */
  const fb = /fallback\s+int\s*:=\s*(\d+)/.exec(sql);
  const seeded = /\('listingLimit\.default',\s*'(\d+)'::jsonb\)/.exec(sql);
  ok('3.2 the seeded row exists in THIS batch’s migration', !!seeded, seeded && seeded[1]);
  ok('3.3 …and the function’s fallback equals it',
     !!fb && !!seeded && fb[1] === seeded[1], fb && seeded ? fb[1] + ' vs ' + seeded[1] : '');
  ok('3.4 handyman keeps its own stricter row',
     /\('listingLimit\.handyman',\s*'1'::jsonb\)/.test(sql));

  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p);
  const uid = await member(p, 'lim@a.app');
  /* ⚠️ STRAIGHT AT THE STORE, never through the screen: the whole item is
     that the SERVER refuses, and a check that went through the form would
     be measuring the form's own guard. */
  const four = await p.evaluate(async () => {
    const S = window.__S; const out = [];
    for (let i = 0; i < 5; i++) {
      const r = await S.addClassified({ cat: 'cars', title: { ar: 'س' + i, en: 'c' + i },
        desc: { ar: 'وصف', en: 'body' }, price: '$100', city: 'Houston' });
      out.push(!!r);
    }
    return { out, why: S.lastPublishError() };
  });
  ok('3.5 the first four are accepted', four.out.slice(0, 4).every(Boolean), four.out.join(','));
  ok('3.6 …and the fifth is refused BY THE SERVER', four.out[4] === false);
  /* ⚠️ a raw database code on the screen is a second fault on top of the
     first — the refusal is said in the sentence the client already says */
  ok('3.7 …and the refusal is named, not a database code', four.why === 'limit', four.why);
  const rows = () => (db.classifieds || []).filter(r => r.owner_id === uid);
  ok('3.8 …so four rows exist on the server and not five', rows().length === 4, String(rows().length));

  /* hiding one frees its slot — the standing rule, now on the server too */
  const afterHide = await p.evaluate(async () => {
    const S = window.__S;
    const mine = S.myActiveListings();
    await S.hideClassified(mine[0].id);
    const r = await S.addClassified({ cat: 'cars', title: { ar: 'بعد', en: 'after' },
      desc: { ar: 'وصف', en: 'body' }, price: '$100', city: 'Houston' });
    return !!r;
  });
  ok('3.9 hiding one opens a place', afterHide === true);

  /* handyman refuses the second and accepts another section */
  const hm = await p.evaluate(async () => {
    const S = window.__S; const out = [];
    for (let i = 0; i < 2; i++) {
      const r = await S.addClassified({ cat: 'handyman', title: { ar: 'ح' + i, en: 'h' + i },
        desc: { ar: 'وصف', en: 'body' }, price: '$20', city: 'Houston' });
      out.push(!!r);
    }
    return out;
  });
  ok('3.10 handyman accepts one…', hm[0] === true);
  ok('3.11 …and refuses the second', hm[1] === false);
  await ctx.close();
}

/* ============================================================
   3b — the client counts the ACCOUNT, not the device
   ============================================================ */
console.log('--- 3b: the form permitted what the server forbade ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p);
  /* ⚠️ THE ID IS CAPTURED AT SIGN-UP, MEASURED BEFORE THE CODE SCREEN.
     `confirmEmail` records it too, and the two layers hide each other: with
     the sign-up line removed every behavioural item here stayed green,
     because the second layer covered it. So the first one is measured on
     its own — the same lesson `475` and V.07.9 wrote down, that a structural
     check has to stand beside a behavioural one and not instead of it. */
  const raw = await p.evaluate(async () => {
    const S = window.__S;
    await S.signUp({ name: 'Fresh', email: 'fresh@a.app', password: 'Qx7#mVzt2026', phone: '' });
    return { id: S.state.user.id, verified: S.state.user.emailVerified };
  });
  ok('3b.0 a brand-new account carries its id before the code screen',
     !!raw.id, JSON.stringify(raw));
  const uid = await member(p, 'dev2@a.app');
  /* a row this account owns that THIS DEVICE never published — which is
     precisely what a second phone sees */
  db.classifieds.push({ id: 'other-device-1', owner_id: uid, cat: 'cars',
    title: 'from the laptop', body: 'x', price: 100, status: 'live', hidden: false,
    city: 'Houston', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  const counted = await p.evaluate(async () => {
    const S = window.__S;
    await S.loadLiveClassifieds();
    return { n: S.activeListingCount(), mine: S.mineListing('other-device-1'),
             owns: S.ownsListing('other-device-1'),
             dev: (S.state.myListings || []).includes('other-device-1') };
  });
  ok('3b.1 the device’s own list does NOT hold it', counted.dev === false);
  ok('3b.2 …and it is still mine', counted.mine === true);
  ok('3b.3 …by the one definition the guards read', counted.owns === true);
  ok('3b.4 …so it is counted against the limit', counted.n === 1, String(counted.n));
  await ctx.close();
}

/* ============================================================
   3c — three live faults that ride here because they are three lines
   ============================================================ */
console.log('--- 3c: pulled for review and published · 14 or 30 · never expires ---');
{
  const st = code('js/store.js');
  const patch = /patchListing\(id, \{[\s\S]*?\}\);/.exec(st);
  ok('3c.1 `status` is in the patch `updateClassified` sends',
     !!patch && /status: c\.status/.test(patch[0]));

  const pack = read('js/i18n.js');
  ok('3c.2 «تم التجديد» carries the number instead of writing it',
     /renewed: 'تم تجديد الإعلان لمدة \{c\}'/.test(pack));
  ok('3c.3 …and so does the English', /renewed: 'Listing renewed for \{c\}'/.test(pack));
  const renewed = [...pack.matchAll(/renewed: '([^']*)'/g)].map(m => m[1]);
  ok('3c.4 …and neither side writes a number at all',
     renewed.length === 2 && renewed.every(v => !/\d/.test(v)), renewed.join(' | '));

  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p);
  const uid = await member(p, 'exp@a.app');
  /* a free listing edited to carry a price is pulled for review — and the
     status has to REACH the server, or the screen says it was pulled while
     every reader still sees it, with its price */
  const flagged = await p.evaluate(async () => {
    const S = window.__S;
    const rec = await S.addClassified({ cat: 'free', title: { ar: 'كنبة', en: 'sofa' },
      desc: { ar: 'مجاني', en: 'free' }, price: S.FREE_PRICE, city: 'Houston' });
    await S.approveClassified(rec.id);
    const r = S.updateClassified(rec.id, { price: '$50' });
    return { id: rec.id, flagged: r.flagged };
  });
  await p.waitForTimeout(500);
  const srv = (db.classifieds || []).find(r => r.id === flagged.id);
  ok('3c.5 the edit really was pulled for review', flagged.flagged === true);
  ok('3c.6 …and the server was told', !!srv && srv.status === 'pending',
     srv ? srv.status : 'no row');

  /* an expired listing leaves the market and stays with its owner */
  db.classifieds.push({ id: 'old-1', owner_id: uid, cat: 'cars', title: 'fifteen days old',
    body: 'x', price: 100, status: 'live', hidden: false, city: 'Houston',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString() });
  const exp = await p.evaluate(async () => {
    const S = window.__S;
    await S.loadLiveClassifieds();
    const rec = S.allClassifieds().find(c => c.id === 'old-1');
    const mineHas = S.myActiveListings().some(c => c.id === 'old-1');
    /* a stranger's view of the same row */
    const before = S.state.user;
    S.state.user = null;
    const strangerSees = S.allClassifieds().some(c => c.id === 'old-1');
    S.state.user = before;
    return { days: rec && rec.daysLeft, mineHas, strangerSees };
  });
  ok('3c.7 the row really is out of days', exp.days === 0, String(exp.days));
  ok('3c.8 …it is gone from the public market', exp.strangerSees === false);
  ok('3c.9 …and its owner still sees it, so «تجديد» can bring it back',
     exp.mineHas === true);
  await ctx.close();
}

/* ============================================================
   4 — an id that lives on the server comes from the server
   ============================================================ */
console.log('--- 4: the rule, and a check that keeps it ---');
{
  /* ⚠️ TODAY'S STATE, written out — and the mechanism is the TWO-WAY
     agreement: a prefix listed here that `store.js` no longer mints is a
     kind that moved to the server and was not struck, and a `mintId` in
     `store.js` with no line here is a new local id nobody decided on.
     Each batch strikes its own line when it moves its kind. */
  const LOCAL = [
    { p: 'ev', what: 'event',            table: 'events',     moves: '649' },
    { p: 'ub', what: 'business',         table: 'businesses', moves: '650' },
    { p: 'u',  what: 'suggested masjid', table: 'businesses', moves: '650' },
    { p: 'r',  what: 'review',           table: 'reviews',    moves: '655' },
    { p: 'm',  what: 'message',          table: 'messages',   moves: '655' },
    { p: 'f',  what: 'flag',             table: 'flags',      moves: '655' },
    { p: 'cl', what: 'claim',            table: 'claims',     moves: '655' },
    { p: 'g',  what: 'greeting',         table: 'greetings',  moves: '665' },
    { p: 'ua', what: 'article',          table: 'articles',   moves: '665' },
    { p: 'of', what: 'offer',            table: 'offers',     moves: '665' },
    { p: 'wf', what: 'worship-time fix', table: '',           moves: '' },
    { p: 'n',  what: 'notification',     table: '',           moves: '' },
    { p: 'ad', what: 'ad order',         table: '',           moves: '' },
    { p: 'wl', what: 'waiting list',     table: '',           moves: '' },
  ];
  const st = code('js/store.js');
  /* the two simulated provider references are not ours to move: they are
     what a gateway will hand back one day, and are stored in our own rows */
  const minted = [...new Set([...st.matchAll(/mintId\('([a-z_]+)'\)/g)].map(m => m[1]))]
    .filter(x => !/_$/.test(x));
  ok('4.1 fourteen kinds are still minted on the device', LOCAL.length === 14,
     String(LOCAL.length));
  const listedNotMinted = LOCAL.map(e => e.p).filter(x => !minted.includes(x));
  ok('4.2 every listed kind is really minted here — one that moved and was not struck turns this red',
     listedNotMinted.length === 0, listedNotMinted.join(', '));
  const mintedNotListed = minted.filter(x => !LOCAL.some(e => e.p === x));
  ok('4.3 …and no local id exists that nobody decided on',
     mintedNotListed.length === 0, mintedNotListed.join(', '));

  /* ⚠️ `classifieds` is the ONE table written from the client today, and
     `630` already takes its id from the server. So there is nothing here to
     repair and something to prevent. */
  ok('4.4 the one row written from the client takes the server’s id',
     /\.insert\(\{[\s\S]*?\}\)\.select\(\)\.single\(\)/.test(st) && !minted.includes('c'));
  const doc = read('CLAUDE.md');
  ok('4.5 the rule is written down where the next batch reads it',
     /A row that lives on the server takes its id FROM the server/.test(doc));
}

console.log('--- console ---');
ok('9.1 zero console errors across the batch', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
