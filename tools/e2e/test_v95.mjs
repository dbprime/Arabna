/* ============================================================
   test_v95 — 665ب: the log survives its device, the receipt says
                    what it bought, and the boost ENDS
   ------------------------------------------------------------
   ⚠️ THE WORST OF THE THREE, AND NOBODY HAD REPORTED IT.
   `BOOST_PRICES` sells three days for $2, seven for $5, fourteen for $8 —
   and `boostClassified` pushed the id into a list WITH NO DATE AND NO
   DURATION. Measured across the repository: `days` was read nowhere but
   the card that draws it. **So two dollars for three days bought them for
   ever.** It is `680`'s fault inverted: there a paid place was given away
   by a stray touch, here a bounded time was sold and handed over
   unbounded, and both are money.

   ⚠️ AND A LOG THAT VANISHES IS NOT A LOG. `state.adminLog` lived on one
   device and was cut at five hundred rows, and the whole of its use is the
   day somebody asks «who changed this?» — a day that does not come while
   the phone is still in the hand.

   ⚠️ AND A RECEIPT WITH NO `covers` IS A PAPER THAT DOES NOT SAY WHAT ITS
   HOLDER BOUGHT. The table was ten columns and `addReceipt` writes
   fourteen fields.

   ⚠️ EVERY BEHAVIOURAL ITEM IS MEASURED WITH TWO REAL BROWSERS SHARING ONE
   STAND-IN SERVER — the second device is the whole question, and a
   single-context test cannot answer it at all.

   ⚠️ AND THE STRUCTURAL ITEMS STAND BESIDE THE BEHAVIOURAL ONES, NEVER
   INSTEAD OF THEM: `0002` refuses `update` and `delete` on `admin_log` to
   everyone including the admin, and refuses every client write to
   `receipts` — and neither refusal can be seen from a browser at all,
   because the app never attempts either.

   Eight blocks: the log travels · the log cannot be rewritten · the
   receipt's columns · the cash receipt · the boost ends · the boost's
   guards · the subscription · the migration is re-runnable.
   ============================================================ */
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
   this project has now paid for six times. This batch's own comments NAME
   `ADMIN_LOG_MAX` in order to explain why it is gone, so a check reading
   the prose about the code would report the fault it exists to prevent. */
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const code = f => strip(read(f));
const sqlOf = n => readFileSync(MIG + n, 'utf8');
const sqlAll = () => readdirSync(MIG).filter(n => n.endsWith('.sql')).sort()
  .map(sqlOf).join('\n');
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
/* ⚠️ ONE `db` SHARED BY TWO CONTEXTS — that IS the shape of the fault, and
   a suite giving each browser its own database would measure nothing. The
   SESSION is per context (`671`), so the two really are two people. */
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
/* ⚠️ `arabna/js/store.js` FIRST: on the single-file build the modules sit
   behind an importmap, so a relative import hands back a SECOND instance
   with its own state. */
const prime = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
});
const open = async (p, hash = '#/home', wait = 1200) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(wait);
  await prime(p);
};
const member = (p, email, name) => p.evaluate(async ([em, c, nm]) => {
  const S = window.__S;
  const err = await S.signUp({ name: nm, email: em, password: 'Qx7#mVzt2026', phone: '' });
  if (err) throw new Error(err);
  if (!S.state.user.emailVerified) { const e2 = await S.confirmEmail(c); if (e2) throw new Error(e2); }
  return S.state.user.id;
}, [email, MOCK_CODE, name]);

/** publish one real listing from this page and hand back its server id */
const publish = (p, title) => p.evaluate(async (ti) => {
  const S = window.__S;
  const r = await S.addClassified({ cat: 'cars', title: { ar: ti, en: ti },
    desc: { ar: 'x', en: 'x' }, price: 100, city: 'Houston', photos: [] });
  return (r && (r.id || (r.item && r.item.id))) || null;
}, title);

const DAY = 86400000;

/* ============================================================
   1 — a log line written on one device is read on another
   ⚠️ AND BY A SECOND ADMIN ACCOUNT, which is the whole of «who changed
   this?»: a log only its author can read answers nobody.
   ============================================================ */
console.log('--- 1: the log leaves the device it was written on ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p);
  await unlockAdmin(a.p);
  await prime(a.p);
  const wrote = await a.p.evaluate(() => {
    window.__S.logAdminAction('b30', 'planIssue', 'free', 'paid');
    return true;
  });
  await a.p.waitForTimeout(500);
  ok('1.1 the row really reached the server', (a.db.admin_log || []).length === 1,
     JSON.stringify((a.db.admin_log || []).map(r => r.action)));

  /* ⚠️ READ FROM THE ROW, NOT FROM THE FORM: `actor_id` meant nothing in a
     log on one device with one admin, and with two admins it IS the item. */
  const row = (a.db.admin_log || [])[0] || {};
  ok('1.2 …and `actor_id` is not empty in it', !!row.actor_id, String(row.actor_id));
  /* ⚠️ THE ID IS READ FROM THE PAGE, NOT FROM `db.session`: since `671`
     the session is per browser context and the shared memory holds none,
     so a check reading it there would compare against `undefined`. */
  const acted = await a.p.evaluate(() => window.__S.state.user && window.__S.state.user.id);
  ok('1.2b …and it is the account that acted', row.actor_id === acted,
     String(row.actor_id) + ' vs ' + String(acted));

  /* a SECOND admin, on a SECOND device, sharing one server */
  const b = await fresh({ db: a.db, preConfirm: true });
  await open(b.p);
  await unlockAdmin(b.p);
  await prime(b.p);
  await b.p.evaluate(() => window.__S.loadLiveAdminLog());
  await b.p.waitForTimeout(400);
  const seen = await b.p.evaluate(() => {
    const rows = window.__S.adminLog(50);
    return { n: rows.length, first: rows[0] || null };
  });
  ok('1.3 ⚠️ the second admin, on a second device, reads it',
     seen.n >= 1 && seen.first && seen.first.field === 'planIssue',
     JSON.stringify(seen.first));
  ok('1.3b …with the old value and the new', seen.first
     && seen.first.from === 'free' && seen.first.to === 'paid',
     seen.first ? seen.first.from + ' -> ' + seen.first.to : 'none');

  /* ⚠️ FIFTY AND NOT THE WHOLE TABLE — the log has no ceiling now, so the
     bound moved from the STORE to the VIEW. The two look alike and are
     opposites: one destroys the record, the other is a window onto it. */
  const st = code('js/store.js');
  const m = /makeLiveReader\('admin_log',\s*\{[\s\S]{0,240}?\}\)/.exec(st);
  ok('1.4 …and the reader asks for a page, not the history',
     !!m && /limit:\s*50/.test(m[0]), m ? m[0].replace(/\s+/g, ' ').slice(0, 90) : 'no reader');
  ok('1.4b …and the factory really bounds the request',
     /const size = limit \? Math\.min\(limit, LIVE_PAGE\) : LIVE_PAGE;/.test(st)
     && /if \(limit\) break;/.test(st));

  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   2 — the log cannot be rewritten, and the ceiling is gone
   ⚠️ STRUCTURAL, AND IT HAS TO BE: the app never attempts an update or a
   delete on the log, so no browser can see whether the policy would allow
   one. The check reads the migration.
   ============================================================ */
console.log('--- 2: a log its own actor can rewrite is not a log ---');
{
  const sql = sqlCode();
  const pol = sql.split(/\n/).filter(l => /policy[\s\S]*admin_log/i.test(l));
  ok('2.1 `admin_log` carries exactly two policies', pol.length === 2, pol.length + ' -> ' + pol.join(' | ').slice(0, 120));
  ok('2.2 ⚠️ …and neither is an update or a delete, for anyone',
     !/on public\.admin_log for (update|delete|all)/i.test(sql),
     pol.map(l => (/for (\w+)/.exec(l) || [])[1]).join(' · '));

  /* ⚠️ `ADMIN_LOG_MAX` was a necessity of local storage; on a server the
     same line is a LOG ERASED. Read with comments stripped: this batch's
     own comments name it in order to explain why it is gone. */
  const jsFiles = ['js/store.js', 'js/screens/admin.js', 'js/screens/profile.js',
                   'js/screens/directory.js', 'js/ui.js', 'js/app.js', 'js/data.js'];
  const left = jsFiles.filter(f => /ADMIN_LOG_MAX/.test(code(f)));
  ok('2.3 ⚠️ `ADMIN_LOG_MAX` is gone from the code', !left.length, left.join(' · ') || 'none');
  /* the counter-guard: the explanation must SURVIVE, or the next batch
     writes the ceiling back not knowing why it went */
  ok('2.3b …and the reason it went is still written',
     /ADMIN_LOG_MAX/.test(read('js/store.js')), 'the comment stands');
  ok('2.4 …and no `.slice(-` truncates the log any more',
     !/state\.adminLog[\s\S]{0,120}\.slice\(-/.test(code('js/store.js')));
}

/* ============================================================
   3 — the receipt's thirteen new columns
   ============================================================ */
console.log('--- 3: the receipt says what it bought ---');
{
  const sql = sqlCode();
  const want = ['kind', 'description', 'tax', 'biz_id', 'ref_id',
                'covers_from', 'covers_to', 'received_by', 'reference',
                'auto_renew', 'refund_of', 'status', 'payer_email'];
  const missing = want.filter(c =>
    !new RegExp('alter table public\\.receipts add column if not exists ' + c + '\\b', 'i').test(sql));
  ok('3.1 every column is added, column by column', !missing.length, missing.join(' · ') || 'all 13');

  /* ⚠️ `add column if not exists`, NEVER A TABLE RECREATED: the table may
     hold rows on a live server, and a recreated table is an accounting
     record erased. */
  const f = sqlOf('0020_receipts_boost_plan.sql').replace(/--[^\n]*/g, '');
  ok('3.2 …with `if not exists`, and no table recreated',
     !/create table/i.test(f)
     && (f.match(/add column if not exists/g) || []).length >= 16,
     String((f.match(/add column if not exists/g) || []).length) + ' columns');

  /* ⚠️ `text`, and it is `0013`'s class rather than a preference: the app
     passes 'b1' … 'b515', and 485 of those are seeds with no row at all. */
  ok('3.3 ⚠️ `biz_id` is `text`, the ids the app really passes',
     /add column if not exists biz_id text/i.test(f));
  /* ⚠️ two typed columns and not one jsonb — the schema's jsonb exception
     is for a shape that VARIES, and two instants do not */
  ok('3.4 …and `covers` is two timestamps, not a blob',
     /covers_from timestamptz/i.test(f) && /covers_to\s+timestamptz/i.test(f)
     && !/covers\s+jsonb/i.test(f));
  ok('3.5 …and `tax` is a line at zero, not a missing line',
     /tax numeric not null default 0/i.test(f));

  /* the card receipt does NOT rise: no `paid` receipt without the gateway
     saying so, and `chargeCard` is still a simulation */
  const st = code('js/store.js');
  ok('3.6 ⚠️ only the cash receipt is uploaded',
     /issue_cash_receipt/.test(st) && !/sb\.from\('receipts'\)\.insert/.test(st));
  ok('3.6b …and `addReceipt` still writes locally and nowhere else',
     /export function addReceipt/.test(st));
}

/* ============================================================
   4 — the cash receipt: minted by the server, and the door is a function
   ============================================================ */
console.log('--- 4: the cash receipt ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p);
  await unlockAdmin(a.p);
  await prime(a.p);
  const one = await a.p.evaluate(async () => {
    const S = window.__S;
    const r = await S.addCashOrder({ kind: 'subscription', bizId: 'b30', days: 30,
      amount: 29, method: 'cash', receivedBy: 'Sami', reference: 'CHQ-9', note: 'شهر' });
    return r ? { id: r.receipt.id, covers: r.receipt.covers, by: r.receipt.receivedBy } : null;
  });
  ok('4.1 ⚠️ the receipt is a row the FUNCTION wrote', (a.db.receipts || []).length === 1,
     String((a.db.receipts || []).length));
  ok('4.2 …and its number starts `ARB-` and came from the server',
     !!one && /^ARB-\d\d-[A-Z2-9]{5}$/.test(one.id), one ? one.id : 'none');
  ok('4.3 …and it says the period the money bought',
     !!one && one.covers && one.covers.to - one.covers.from > 29 * DAY,
     one && one.covers ? Math.round((one.covers.to - one.covers.from) / DAY) + ' days' : 'no covers');
  ok('4.4 …and who took the money', !!one && one.by === 'Sami', one ? one.by : '');

  /* ⚠️ TWO NUMBERS MINTED IN TWO CALLS DO NOT MATCH, and `ref unique` on
     the table is the guarantee — `newReceiptNumber()` compared what was on
     ONE DEVICE, and two devices cannot see each other. */
  const two = await a.p.evaluate(async () => {
    const S = window.__S;
    const r = await S.addCashOrder({ kind: 'ad', bizId: 'b31', days: 7, amount: 49,
      method: 'check', receivedBy: 'Sami', reference: 'CHQ-10', note: 'أسبوع' });
    return r ? r.receipt.id : null;
  });
  ok('4.5 two numbers in two calls are not the same', !!two && two !== one.id, one.id + ' · ' + two);
  ok('4.5b …and `ref` is unique on the table since `0001`',
     /ref\s+text not null unique/i.test(sqlCode()));

  /* ⚠️ AND A DIRECT CLIENT INSERT IS REFUSED — EVEN FOR AN ADMIN. This is
     what proves the function is THE DOOR rather than one road among
     several, and it is measured through the app's own client. */
  const direct = await a.p.evaluate(async () => {
    const S = window.__S;
    const { error } = await S.sb.from('receipts')
      .insert({ ref: 'ARB-26-HAND1', amount: 5, method: 'cash' });
    return error ? (error.code || error.message || 'refused') : null;
  });
  ok('4.6 ⚠️ a direct insert on `receipts` is refused, admin or not',
     direct !== null, String(direct));
  ok('4.6b …and no such row landed',
     !(a.db.receipts || []).some(r => r.ref === 'ARB-26-HAND1'));

  /* ⚠️ AND A NON-ADMIN CALLING THE FUNCTION GETS AN ERROR, NOT ZERO ROWS —
     which is what proves the authorisation is the first statement and
     raises, rather than a condition inside a `where` that returns nothing
     and looks like «there was nothing to do». */
  const b = await fresh({ db: a.db, preConfirm: true });
  await open(b.p);
  await member(b.p, 'plain665b@x.app', 'Plain');
  const refused = await b.p.evaluate(async () => {
    const S = window.__S;
    const { data, error } = await S.sb.rpc('issue_cash_receipt', {
      p_kind: 'ad', p_description: 'x', p_amount: 1, p_method: 'cash',
      p_biz_id: 'b30', p_covers_from: null, p_covers_to: null,
      p_received_by: 'me', p_reference: '' });
    return { err: error ? (error.message || 'error') : null, data: data || null };
  });
  ok('4.7 ⚠️ a non-admin gets an EXCEPTION, never an empty answer',
     !!refused.err && refused.data === null, JSON.stringify(refused));
  ok('4.7b …and the guard is the FIRST statement in the function',
     /begin\s*\n\s*if not public\.is_admin\(\) then\s*\n\s*raise exception/i
       .test(sqlOf('0020_receipts_boost_plan.sql')));
  ok('4.7c …and it is `security definer` with a pinned search_path',
     /create or replace function public\.issue_cash_receipt[\s\S]{0,900}?security definer[\s\S]{0,120}?set search_path = public, auth/i
       .test(sqlOf('0020_receipts_boost_plan.sql')));

  /* ⚠️ AND THE GRANT IS BESIDE THE REVOKE. Measured on a real PostgreSQL:
     `authenticated` inherits from PUBLIC, so a revoke with no matching
     grant leaves the function callable by NOBODY but the owner. */
  const f = sqlOf('0020_receipts_boost_plan.sql');
  ok('4.8 every function revoked from public is granted to `authenticated`',
     (f.match(/revoke all on function/g) || []).length ===
     (f.match(/grant execute on function/g) || []).length,
     (f.match(/revoke all on function/g) || []).length + ' revoke · ' +
     (f.match(/grant execute on function/g) || []).length + ' grant');

  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   5 — the boost is bought by the day, and it ENDS
   ⚠️ THE HEAVIEST BLOCK IN THE SUITE.
   ============================================================ */
console.log('--- 5: the boost ends ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p);
  await member(a.p, 'seller665b@x.app', 'Seller');
  const id = await publish(a.p, 'سيّارة');
  ok('5.0 a real listing to boost', !!id, String(id));

  const bought = await a.p.evaluate(async (lid) => {
    const S = window.__S;
    const okk = await S.boostClassified(lid, 3);
    return { okk, until: S.boostedUntil(lid), boosted: S.isBoosted(lid) };
  }, id);
  const days = Math.round((bought.until - Date.now()) / DAY);
  ok('5.1 ⚠️ three days bought are three days — not empty, not eternal',
     bought.okk && days === 3 && bought.boosted, JSON.stringify({ days, until: bought.until }));
  ok('5.1b …and the row on the server carries the date',
     !!(a.db.classifieds.find(c => c.id === id) || {}).boosted_until,
     String((a.db.classifieds.find(c => c.id === id) || {}).boosted_until));

  /* ⚠️ A SECOND PURCHASE OVER A LIVE PERIOD ADDS, NEVER REPLACES —
     `greatest` in `0020`. Money paid does not swallow what is left of the
     money paid before it. */
  const again = await a.p.evaluate(async (lid) => {
    const S = window.__S;
    await S.boostClassified(lid, 7);
    return S.boostedUntil(lid);
  }, id);
  ok('5.2 ⚠️ seven bought over three left makes ten, not seven',
     Math.round((again - Date.now()) / DAY) === 10,
     Math.round((again - Date.now()) / DAY) + ' days');
  /* ⚠️ AND `greatest` IS ASSERTED IN THE MIGRATION ITSELF, for the same
     reason as 6.1c: the stand-in server mirrors the arithmetic, so
     deleting `greatest` from the SQL leaves every behavioural item green.
     The check has to read the file that will actually run. */
  ok('5.2b ⚠️ …and it is `greatest` in the migration that does it',
     /set boosted_until = greatest\(now\(\), coalesce\(c\.boosted_until, now\(\)\)\)/i
       .test(sqlOf('0020_receipts_boost_plan.sql')));

  /* ⚠️ AND IT IS PROVEN BY WINDING THE CLOCK, NOT BY WAITING. The app's own
     `now()` carries `state.clockOffset`, which is what every dated thing
     in it reads. */
  const later = await a.p.evaluate(async (lid) => {
    const S = window.__S;
    /* ⚠️ WOUND, NOT WAITED FOR: `now()` carries `state.clockOffset` and
       every dated thing in the app reads it, which is how the panel's own
       test clock works. */
    S.advanceClock(20);
    const out = { boosted: S.isBoosted(lid), inRecord: !!(S.classifiedById(lid) || {}).boosted };
    S.resetClock();
    return out;
  }, id);
  ok('5.3 ⚠️ twenty days on, it is not boosted any more',
     !later.boosted && !later.inRecord, JSON.stringify(later));

  /* the receipt the paid button writes says how long */
  const st = code('js/screens/marketplace.js');
  ok('5.4 …and the paid button writes `covers` on the receipt',
     /addReceipt\(\{[\s\S]{0,300}?covers:\s*\{\s*from:[\s\S]{0,60}?to:/.test(st));

  await a.ctx.close();
}

/* ============================================================
   6 — the boost's guards, and the charge order
   ============================================================ */
console.log('--- 6: who may boost, for how long, and in what order ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p);
  await member(a.p, 'owner665b@x.app', 'Owner');
  const id = await publish(a.p, 'دراجة');

  /* ⚠️ A DURATION THAT IS NOT ON THE LIST IS REFUSED — a caller who can
     name the period can buy a year for two dollars. */
  const wild = await a.p.evaluate(async (lid) => {
    const S = window.__S;
    const okk = await S.boostClassified(lid, 365);
    return { okk, until: S.boostedUntil(lid) };
  }, id);
  ok('6.1 ⚠️ a free-form duration is refused', wild.okk === false && !wild.until,
     JSON.stringify(wild));
  ok('6.1b …and the server refuses it too, not only the client',
     /days is null or days not in \(3, 7, 14\)/i.test(sqlOf('0020_receipts_boost_plan.sql')));
  /* ⚠️ AND THE CLIENT'S OWN GUARD IS ASSERTED APART, because the two
     layers hide each other from a behavioural check: with the client
     guard deleted the mutation ran and 6.1 STAYED GREEN — the server
     refused it anyway. That is the design working, and it is exactly why
     a structural item stands beside a behavioural one rather than
     instead of it (`475`, V.07.9, `660`). */
  ok('6.1c ⚠️ …and the client refuses it before the request leaves',
     /if \(!BOOST_DAYS\.includes\(Number\(days\)\)\) return false;/.test(code('js/store.js')));
  /* ⚠️ AND THE THREE ARE THE SAME THREE ON BOTH SIDES. The client reads
     `BOOST_DAYS`, derived from `BOOST_PRICES`; the function names them.
     A two-way agreement, so the day one moves the other goes red. */
  const declared = (/{ id: 'b3d'[\s\S]*?\];/.exec(read('js/data.js')) || [''])[0]
    .match(/days:\s*(\d+)/g).map(x => Number(x.replace(/\D/g, '')));
  const inSql = (/days not in \(([^)]*)\)/i.exec(sqlOf('0020_receipts_boost_plan.sql')) || [0, ''])[1]
    .split(',').map(x => Number(x.trim())).filter(n => n);
  ok('6.2 ⚠️ the durations agree on both sides',
     JSON.stringify(declared.slice().sort((x, y) => x - y)) ===
     JSON.stringify(inSql.slice().sort((x, y) => x - y)),
     declared.join('/') + ' vs ' + inSql.join('/'));

  /* ⚠️ A MEMBER BOOSTING SOMEBODY ELSE'S LISTING */
  const b = await fresh({ db: a.db, preConfirm: true });
  await open(b.p);
  await member(b.p, 'stranger665b@x.app', 'Stranger');
  const theft = await b.p.evaluate(async (lid) => {
    const S = window.__S;
    /* through the client, bypassing the store's own guard, so the SERVER
       is what is measured and not the screen */
    const { data, error } = await S.sb.rpc('boost_classified',
      { listing_id: lid, days: 3 });
    return { err: error ? (error.message || 'error') : null, data: data || null };
  }, id);
  ok('6.3 ⚠️ a stranger gets an exception, not a quiet nothing',
     !!theft.err && theft.data === null, JSON.stringify(theft));
  ok('6.3b …and nothing was written', !(a.db.classifieds.find(c => c.id === id) || {}).boosted_until);

  /* ⚠️ AND THE COLUMN IS NOT WRITABLE FROM A CLIENT AT ALL. `0002`'s «own:
     update» would otherwise let a listing's OWNER PATCH a year into it
     with the publishable key — measured on a real PostgreSQL, and the
     reason the trigger exists. */
  const patched = await a.p.evaluate(async (lid) => {
    const S = window.__S;
    const far = new Date(Date.now() + 365 * 86400000).toISOString();
    const { error } = await S.sb.from('classifieds')
      .update({ boosted_until: far }).eq('id', lid);
    return error ? (error.message || 'refused') : null;
  }, id);
  ok('6.4 ⚠️ its own owner cannot PATCH the column either', patched !== null, String(patched));
  ok('6.4b …and the trigger that holds it is in the migration',
     /create trigger classifieds_no_boost_write/i.test(sqlOf('0020_receipts_boost_plan.sql')));

  /* ⚠️ THE BOOST FIRST, THEN THE CARD. `boostClassified` used to be local
     arithmetic that failed only on wrong ownership and is now a server
     call that fails on the network, the policy and the timeout — so a
     batch that turns a latent fault into a likely one fixes it. */
  const mk = code('js/screens/marketplace.js');
  const iBoost = mk.indexOf('S.boostClassified(');
  const iCharge = mk.indexOf('S.chargeCard(');
  ok('6.5 ⚠️ the boost is attempted before the card is charged',
     iBoost > 0 && iCharge > 0 && iBoost < iCharge, iBoost + ' < ' + iCharge);
  ok('6.5b …and a failed boost charges nothing and writes no receipt',
     /const boosted = await S\.boostClassified\([\s\S]{0,220}?if \(!boosted\)[\s\S]{0,220}?return;/.test(mk));

  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   7 — the subscription is visible from any device
   ============================================================ */
console.log('--- 7: the subscription, and its cancellation ---');
{
  const sql = sqlCode();
  ok('7.1 the two columns, and `plan` untouched',
     /add column if not exists plan_until timestamptz/i.test(sql)
     && /add column if not exists plan_cancel_at_end boolean not null default false/i.test(sql)
     && !/alter table public\.businesses[\s\S]{0,80}drop column[\s\S]{0,20}plan\b/i.test(sql));

  const a = await fresh({ preConfirm: true });
  await open(a.p);
  await unlockAdmin(a.p);
  await prime(a.p);
  const issued = await a.p.evaluate(async () => {
    const S = window.__S;
    const r = await S.addCashOrder({ kind: 'subscription', bizId: 'b30', days: 30,
      amount: 29, method: 'cash', receivedBy: 'Sami', reference: '', note: '' });
    return !!r;
  });
  await a.p.waitForTimeout(400);
  const row = (a.db.businesses || []).find(r => r.seed_id === 'b30' || r.id === 'b30') || {};
  ok('7.2 ⚠️ issuing writes the plan onto the ROW, not one device',
     issued && row.plan === 'paid' && !!row.plan_until,
     JSON.stringify({ plan: row.plan, until: row.plan_until }));

  /* a SECOND device reads it */
  const b = await fresh({ db: a.db, preConfirm: true });
  await open(b.p);
  const seen = await b.p.evaluate(() => {
    const bz = window.__S.businessById('b30');
    return { plan: bz && bz.plan, paid: window.__S.isPaid(bz) };
  });
  ok('7.3 …and the second device sees it', seen.plan === 'paid' && seen.paid === true,
     JSON.stringify(seen));

  /* the panel ends it, with a written reason, and the receipt stays */
  const ended = await a.p.evaluate(async () => {
    const S = window.__S;
    const okk = await S.adminCancelPlan('b30', 'atEnd', 'طلب صاحب النشاط');
    return { okk, receipts: S.receipts().length };
  });
  /* the log line is fire-and-forget on purpose — the cancellation has
     already happened and a slow network must not undo it — so the read
     waits for the request rather than for the call */
  await a.p.waitForTimeout(500);
  const row2 = (a.db.businesses || []).find(r => r.seed_id === 'b30' || r.id === 'b30') || {};
  ok('7.4 the cancellation reaches the row', ended.okk && row2.plan_cancel_at_end === true,
     JSON.stringify({ cancel: row2.plan_cancel_at_end }));
  ok('7.5 ⚠️ …and the receipt is NOT deleted — the money was really taken',
     (a.db.receipts || []).length === 1 && ended.receipts >= 1,
     (a.db.receipts || []).length + ' on the server');
  /* ⚠️ READ WITH THE COLUMN'S OWN NAMES: the row on the server is
     `from_val`/`to_val`, and the JS shape's `from`/`to` are what
     `adminLog()` maps them to. A check reading the JS names off a raw row
     measures nothing at all. */
  const line = (a.db.admin_log || []).find(r => r.action === 'planEndAtPeriod');
  ok('7.6 …and the log says the old value and the written reason',
     !!line && line.from_val === 'paid' && /طلب/.test(line.to_val || ''),
     JSON.stringify(line && { from: line.from_val, to: line.to_val }));
  /* ⚠️ AND THE FIELD-LEVEL TRAIL IS BESIDE IT AND IS NOT SUPPRESSED. The
     action row names the decision; these name the values, which is the
     half that answers «what was it before?» — and `recordAdminEdit`
     writing them needs no flag from any screen, which is the whole reason
     `adminEditing()` is one definition in the store. */
  const fields = (a.db.admin_log || []).filter(r => r.action === 'plan_until');
  ok('7.6b …and the value trail beside it', fields.length >= 1,
     JSON.stringify(fields.map(r => r.from_val + ' -> ' + (r.to_val || '').slice(0, 10))));

  /* ⚠️ AND THE CONTROL ITSELF IS MEASURED, which it was not when it was
     written. Nothing in the whole net read `data-plancancel`, and the
     first fault found in it was found by `test_v25 · 7.9` — an unrelated
     suite's general rule — rather than by the batch's own. A control
     added with no check is how the next batch breaks it in silence. */
  await a.p.goto(BASE + '#/admin', { waitUntil: 'domcontentloaded' });
  await a.p.waitForTimeout(900);
  await a.p.click('[data-t="dir"]');
  await a.p.waitForTimeout(400);
  await a.p.fill('#dirQ', 'b30');
  await a.p.waitForTimeout(600);
  const paidRow = await a.p.evaluate(() =>
    ({ rows: document.querySelectorAll('#aBody .setting-row [data-bizedit]').length,
       cancel: !!document.querySelector('[data-plancancel="b30"]') }));
  ok('7.7 the cancel control is drawn for a business that is paid',
     paidRow.cancel, JSON.stringify(paidRow));

  await a.p.fill('#dirQ', 'b31');
  await a.p.waitForTimeout(600);
  const freeRow = await a.p.evaluate(() =>
    ({ rows: document.querySelectorAll('#aBody .setting-row [data-bizedit]').length,
       cancel: !!document.querySelector('[data-plancancel="b31"]') }));
  ok('7.8 …and NOT for a free one — a button that cannot act is worse than none',
     freeRow.rows > 0 && !freeRow.cancel, JSON.stringify(freeRow));

  /* ⚠️ AND THE QUESTION GOES TO THE STORE, never to the raw field.
     `isPaid` reads through `businessPlan`, so a subscription recorded on
     this device a moment ago — exactly when this button is wanted — is
     already true, while `b.plan` is still whatever the row last said. */
  const adm = strip(read('js/screens/admin.js'));
  ok('7.9 …and the screen asks the store rather than the plan field',
     /S\.isPaid\(b\)[\s\S]{0,120}data-plancancel/.test(adm)
     && !/plan\s*===\s*['"]paid['"]/.test(adm),
     /plan\s*===\s*['"]paid['"]/.test(adm) ? 'reads the field' : 'asks the store');

  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   8 — the two tables are registered, and the migration re-runs
   ============================================================ */
console.log('--- 8: registration and the migration ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p);
  const tables = await a.p.evaluate(() => window.__S.liveReaderTables());
  ok('8.1 `admin_log` and `receipts` are live-reader tables',
     tables.includes('admin_log') && tables.includes('receipts'), tables.join(' · '));

  /* ⚠️ AND EACH HAS A LINE IN §1.هـ — `650`'s guard reads that table, and a
     field with no column has to be an EXCEPTION WITH A REASON rather than
     a silence. This asserts the document names them at all. */
  const doc = read('docs/الحالة.md');
  ok('8.2 …and each is named in the state file',
     /admin_log/.test(doc) && /receipts/.test(doc));

  /* ⚠️ `add column if not exists` everywhere, and no `create table` —
     measured on a real PostgreSQL 16 twice over, and asserted here so a
     later edit cannot quietly make the file un-re-runnable. */
  const f = sqlOf('0020_receipts_boost_plan.sql').replace(/--[^\n]*/g, '');
  const alters = f.match(/alter table [^\n;]*/g) || [];
  const bad = alters.filter(l => /add column/i.test(l) && !/if not exists/i.test(l));
  ok('8.3 every added column carries `if not exists`', !bad.length, bad.join(' | ') || 'all');
  ok('8.4 …and every function is `create or replace`',
     (f.match(/create function/g) || []).length === 0
     && (f.match(/create or replace function/g) || []).length === 4,
     String((f.match(/create or replace function/g) || []).length) + ' functions');
  ok('8.5 …and the trigger is dropped before it is created',
     /drop trigger if exists classifieds_no_boost_write[\s\S]{0,200}create trigger classifieds_no_boost_write/i.test(f));

  /* ⚠️ AND NO WRITE IS FIRED WHERE THE POLICY REFUSES IT. `v47 · 6.1`
     counts console errors and caught a `POST /rest/v1/businesses` → 403
     that this batch's own `pushPlan` fired for every ordinary owner of a
     SEED business: the app said «subscribed», the row never moved, and the
     only trace anywhere was a red line in a console nobody reads. That is
     the behavioural half; this is the structural one beside it, because a
     console count only sees the paths a suite happens to walk. */
  const st = strip(read('js/store.js'));
  const coat = st.slice(st.indexOf('async function pushBusiness'),
                        st.indexOf('async function pushBusiness') + 2600);
  ok('8.7 the coat insert is the admin\'s, and is not fired otherwise',
     /if \(!isAccountAdmin\(\)\) return false;[\s\S]{0,400}\.insert\(/.test(coat),
     /isAccountAdmin/.test(coat) ? 'guarded' : 'unguarded');
  const plog = st.slice(st.indexOf('function pushLogRow'),
                        st.indexOf('function pushLogRow') + 700);
  ok('8.8 …and so is the log row, said once in the store',
     /if \(!isAccountAdmin\(\)\) return;/.test(plog),
     /isAccountAdmin/.test(plog) ? 'guarded' : 'unguarded');

  ok('8.6 no console errors anywhere in the run', !errors.length, errors.slice(0, 2).join(' | '));
  await a.ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
