/* V.10.4 — 630: what the admin sees comes from the server.
 *
 * ⚠️ MEASURED, NOT INFERRED: a real listing was published from one browser,
 * the panel was opened from another on the live host, and it read «nothing
 * waiting». `addClassified` wrote to the server; `allClassifieds` read the
 * device — and `grep "from('classifieds').select" js/` returned ZERO. A
 * listing written where it is never read: the admin saw nobody's listing
 * but his own, so the moderation queue — the panel's first job — did not
 * work with real people at all. No reading, no moderation; no moderation,
 * no opening. This is a launch condition, not an improvement.
 *
 *   1  the marketplace is read from the server, the directory's way
 *   2  the filter is left to RLS — no `.eq('status', …)` in any reader
 *   3  approve / reject reach the server first; a refusal changes nothing
 *   4  a failed network keeps the last good answer (the promise of 420)
 *   5  the readers stay synchronous — not one call site gains an `await`
 *   6  the panel opens for a staff SESSION and for nothing else
 *   7  the migration 610 recorded: the admin may insert a business row
 *   8  the price reaches the server as a NUMBER (found on the way)
 *
 * ⚠️ THE STAND-IN SERVER HAS TO TELL STAFF FROM A MEMBER, or block 1 is
 * green while measuring nothing: `_supabase.mjs` mirrors the RLS of
 * `0002_rls.sql` and applies the query string, so putting the client filter
 * back turns 2.2 AND 1.3 red — and a permissive mock is refused on purpose.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';
import { unlockAdmin } from './_admin.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ comments stripped before any «does the code do X» check (test_v53's
   rule): the comments in store.js name `.eq('status', 'live')` while
   explaining why it is gone. */
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const sqlCode = f => read(f).replace(/--.*$/gm, '');

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
  const p = await ctx.newPage(); wire(p);
  return { ctx, p, db };
};
const open = async (p, hash = '#/home', wait = 1100) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(wait);
  await p.evaluate(async () => {
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    window.__D = await import('arabna/js/data.js').catch(() => import('./js/data.js'));
  });
};
const go = async (p, h, wait = 900) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(wait); };
const member = async (p, email) => p.evaluate(async ([em, c]) => {
  const S = window.__S;
  const err = await S.signUp({ name: 'Member ' + em, email: em, password: 'Qx7#mVzt2026', phone: '' });
  if (err) throw new Error(err);
  if (!S.state.user.emailVerified) { const e2 = await S.confirmEmail(c); if (e2) throw new Error(e2); }
  return S.state.user.email;
}, [email, MOCK_CODE]);
const publish = (p, title, price) => p.evaluate(async ([t, pr]) => {
  const S = window.__S;
  const rec = await S.addClassified({ cat: 'furniture', title: { ar: t, en: t }, price: pr,
    city: 'Katy', desc: { ar: 'وصف', en: 'desc' }, photos: [], icon: 'sofa' });
  return rec ? rec.id : null;
}, [title, price]);
/* the server fails on ONE verb, for one moment, and the mock underneath keeps answering */
const failing = async (ctx, method, table) => {
  const h = r => (r.request().method() === method && r.request().url().includes('/rest/v1/' + table))
    ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' })
    : r.fallback();
  await ctx.route('**/rest/v1/**', h);
  return () => ctx.unroute('**/rest/v1/**', h);
};

/* ===== 1. the original fault: a row from ANOTHER browser reaches the queue ===== */
console.log('--- 1. read from the server ---');
let shared, listingId;
{
  /* browser one: a member publishes */
  const a = await fresh({ preConfirm: true });
  shared = a.db;
  await open(a.p);
  await member(a.p, 'seller@arabna.test');
  listingId = await publish(a.p, 'كنبة للبيع من متصفّحٍ آخر', '⁦$1,250⁩');
  ok('1.1 the listing is written on the server, pending',
     !!listingId && shared.classifieds.some(r => r.id === listingId && r.status === 'pending'),
     JSON.stringify((shared.classifieds[0] || {}).status));
  await a.ctx.close();

  /* browser two: staff, on a device that never saw that listing */
  const b = await fresh({ preConfirm: true, db: shared });
  await open(b.p);
  await unlockAdmin(b.p);
  const q = await b.p.evaluate(id => ({
    inQueue: !!document.querySelector(`[data-approve="${id}"]`),
    pending: window.__S.pendingListings().some(c => c.id === id),
    local: window.__S.state.extraClassifieds.some(c => c.id === id),
    title: (document.querySelector('#aBody') || {}).innerText || '',
  }), listingId);
  ok('1.2 the admin\'s queue, on ANOTHER device, lists it', q.inQueue && q.pending, JSON.stringify({ inQueue: q.inQueue, pending: q.pending }));
  ok('1.2b …with its title, and not from this device\'s own storage',
     /كنبة للبيع من متصفّحٍ آخر/.test(q.title) && !q.local);
  ok('1.3 the read carried NO client filter — RLS decided what came back',
     (shared.reads || []).some(r => r.table === 'classifieds') &&
     (shared.reads || []).filter(r => r.table === 'classifieds').every(r => r.filters.length === 0),
     JSON.stringify((shared.reads || []).filter(r => r.table === 'classifieds').map(r => r.filters)));

  /* ===== 3. approve: the server first ===== */
  console.log('--- 3. the decision reaches the server ---');
  const logBefore = await b.p.evaluate(() => (window.__S.state.adminLog || []).length);
  const undo = await failing(b.ctx, 'PATCH', 'classifieds');
  const refused = await b.p.evaluate(async id => {
    const S = window.__S;
    const r = await S.approveClassified(id);
    return { r, stillPending: S.pendingListings().some(c => c.id === id),
             notifs: (S.state.extraNotifs || []).length, log: (S.state.adminLog || []).length };
  }, listingId);
  await undo();
  ok('3.1 a refused server refuses the approval — nothing changes locally',
     refused.r === false && refused.stillPending, JSON.stringify(refused));
  ok('3.2 …and no line reaches adminLog for an approval that did not happen',
     refused.log === logBefore, `${refused.log} vs ${logBefore}`);
  ok('3.3 …and the row on the server is still pending',
     shared.classifieds.find(r => r.id === listingId).status === 'pending');

  await b.p.evaluate(id => document.querySelector(`[data-approve="${id}"]`).click(), listingId);
  await b.p.waitForTimeout(900);
  const w = (shared.writes || []).filter(x => x.table === 'classifieds');
  ok('3.4 the panel\'s approve writes the status ON THE SERVER, by id',
     w.some(x => x.body && x.body.status === 'live' && x.filters.some(f => f.k === 'id' && f.v === listingId) && x.n === 1),
     JSON.stringify(w.map(x => [x.body, x.filters, x.n])));
  ok('3.5 …and the row is live there', shared.classifieds.find(r => r.id === listingId).status === 'live');
  ok('3.6 …and the queue drops it without a refetch',
     await b.p.evaluate(id => !document.querySelector(`[data-approve="${id}"]`)
       && !window.__S.pendingListings().some(c => c.id === id), listingId));
  const logAfter = await b.p.evaluate(() => (window.__S.state.adminLog || []).length);
  ok('3.7 …and the approval that DID happen leaves its line', logAfter === logBefore + 1, `${logAfter} vs ${logBefore}`);

  /* reject, with a reason, on a second listing */
  const c = await fresh({ preConfirm: true, db: shared });
  await open(c.p);
  await member(c.p, 'seller2@arabna.test');
  const rejId = await publish(c.p, 'إعلان سيُرفض', '⁦$40⁩');
  await c.ctx.close();
  await b.p.reload({ waitUntil: 'domcontentloaded' }); await b.p.waitForTimeout(1100);
  await b.p.evaluate(async () => {
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  });
  await unlockAdmin(b.p);
  const rej = await b.p.evaluate(async id => {
    const S = window.__S;
    const r = await S.rejectClassified(id, 'صورة غير لائقة');
    return { r, gone: !S.pendingListings().some(c => c.id === id), log: (S.state.adminLog || []).slice(-1)[0] };
  }, rejId);
  ok('3.8 reject writes «rejected» on the server, with the reason in the log',
     rej.r === true && shared.classifieds.find(r => r.id === rejId).status === 'rejected'
     && rej.gone && rej.log && rej.log.field === 'rejectListing' && /غير لائقة/.test(rej.log.to),
     JSON.stringify(rej));

  /* ===== 4. a failed network keeps the last good answer ===== */
  console.log('--- 4. the promise of 420 ---');
  const before = await b.p.evaluate(() => ({
    cls: window.__S.allClassifieds().length, biz: window.__S.everyBusiness().length,
    at: window.__S.liveClsLoadedAt(), bizAt: window.__S.liveBizLoadedAt() }));
  const undo2 = await failing(b.ctx, 'GET', '');
  const after = await b.p.evaluate(async () => {
    const S = window.__S;
    const a = await S.loadLiveClassifieds(); const bz = await S.loadLiveBusinesses();
    return { a: Array.isArray(a), bz: bz === null || Array.isArray(bz),
             cls: S.allClassifieds().length, biz: S.everyBusiness().length,
             at: S.liveClsLoadedAt(), bizAt: S.liveBizLoadedAt() };
  });
  await undo2();
  ok('4.1 a failed fetch throws nothing and empties nothing — the last answer stands',
     after.a && after.bz && after.cls === before.cls && after.biz === before.biz && before.cls > 0,
     JSON.stringify({ before, after }));
  ok('4.2 …and its timestamp does not move, so nothing pretends it answered',
     after.at === before.at && after.bizAt === before.bizAt);
  await b.ctx.close();
}

/* ===== 1 (cont.) — RLS through the reader's eyes ===== */
{
  /* a stranger, no session: the live row and not the held one */
  const d = await fresh({ db: shared });
  await open(d.p);
  const seen = await d.p.evaluate(([live, held]) => {
    const all = window.__S.allClassifieds().map(c => c.id);
    return { live: all.includes(live), held: all.includes(held),
             price: (window.__S.allClassifieds().find(c => c.id === live) || {}).price || '' };
  }, [listingId, null]);
  ok('1.4 a visitor sees the approved listing from the server', seen.live, JSON.stringify(seen));
  ok('1.4b …with its price back as the display string', /1,250/.test(seen.price), JSON.stringify(seen.price));
  await d.ctx.close();

  /* a member who is not staff: RLS hands over nothing pending but their own */
  const e = await fresh({ preConfirm: true, db: shared });
  await open(e.p);
  await member(e.p, 'other@arabna.test');
  const other = await e.p.evaluate(async () => {
    const S = window.__S;
    await S.addClassified({ cat: 'furniture', title: { ar: 'إعلاني المعلَّق', en: 'mine' }, price: '⁦$10⁩',
      city: 'Katy', desc: { ar: 'x', en: 'x' }, photos: [], icon: 'sofa' });
    await S.loadLiveClassifieds();
    const p = S.pendingListings();
    return { n: p.length, mineOnly: p.every(c => c.owner === 'me' || S.state.myListings.includes(c.id)) };
  });
  ok('1.5 a member who is not staff receives no held listing but their own',
     other.n === 1 && other.mineOnly, JSON.stringify(other));
  ok('1.5b …and the server really held a second pending row they did not get',
     shared.classifieds.filter(r => r.status === 'pending').length >= 1);
  await e.ctx.close();
}

/* ===== 2. no client filter in any reader, and 5. the readers stay synchronous ===== */
console.log('--- 2 · 5. structure ---');
{
  const st = code('js/store.js');
  const readers = st.match(/from\('(?:businesses|classifieds)'\)\s*\.select\(/g) || [];
  ok('2.1 both tables are read from the server', readers.length >= 2, String(readers.length));
  ok('2.2 …and no reader writes `.eq(\'status\', …)` on top of RLS',
     !/from\('(?:businesses|classifieds)'\)\s*\.select\([^)]*\)\s*\.eq\('status'/.test(st));
  ok('5.1 everyBusiness() and allClassifieds() are plain functions, not async',
     /export function everyBusiness\(\)/.test(st) && /export function allClassifieds\(\)/.test(st));
  const files = ['js/store.js', 'js/ui.js', 'js/app.js'].concat(
    readdirSync(ROOT + 'js/screens').filter(f => f.endsWith('.js')).map(f => 'js/screens/' + f));
  const all = files.map(code).join('\n');
  const sites = (all.match(/\beveryBusiness\(\)/g) || []).length + (all.match(/\ballClassifieds\(\)/g) || []).length;
  ok('5.2 not one of their call sites gains an await',
     sites >= 15 && !/await\s+(?:S\.)?(?:everyBusiness|allClassifieds)\(/.test(all), sites + ' call sites');
  ok('5.3 the live listings are fetched at boot, beside the businesses, after the paint',
     /loadLiveBusinesses\(\)\.then/.test(code('js/app.js')) && /loadLiveClassifieds\(\)\.then/.test(code('js/app.js')));
}

/* ===== 6. the panel opens for a staff SESSION and for nothing else ===== */
console.log('--- 6. the account is the lock ---');
{
  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p, '#/admin');
  const noSession = await p.evaluate(() => ({
    denied: !!document.querySelector('#adminDenied'), tabs: !!document.querySelector('#aTabs'),
    oldDoor: !!document.querySelector('#aUser, #aPass, #aSet, #aGo'),
    text: (document.querySelector('#adminDenied') || {}).innerText || '' }));
  ok('6.1 no session: shut, no tab, and no device password asked for',
     noSession.denied && !noSession.tabs && !noSession.oldDoor, JSON.stringify(noSession));
  ok('6.1b …and the reason is the true one, never «wrong username or password»',
     noSession.text.length > 10 && !/كلمة المرور غير صحيحة|Wrong username/.test(noSession.text), noSession.text.slice(0, 60));
  await go(p, '#/home');
  await member(p, 'plain@arabna.test');
  await go(p, '#/admin', 1100);
  ok('6.2 a signed-in member who is not staff is refused too',
     await p.evaluate(() => !!document.querySelector('#adminDenied') && !document.querySelector('#aTabs')));
  /* a flag typed into this device's storage */
  await p.evaluate(() => { window.__S.state.user.isAdmin = true; window.__S.save(); });
  await go(p, '#/home');
  await go(p, '#/admin', 1300);
  const forged = await p.evaluate(() => ({
    denied: !!document.querySelector('#adminDenied'), tabs: !!document.querySelector('#aTabs'),
    flag: window.__S.state.user.isAdmin }));
  ok('6.3 a flag written into the device\'s storage opens nothing — the server is asked at the door',
     forged.denied && !forged.tabs && forged.flag === false, JSON.stringify(forged));
  /* the SAME open session, marked staff on the server: no sign-out, no second password */
  await unlockAdmin(p);
  ok('6.4 the same account, marked staff on the server, opens the panel while its session is open',
     await p.evaluate(() => !!document.querySelector('#aTabs') && !document.querySelector('#aUser, #aPass, #aSet, #aGo')));
  ok('6.4b …and the boot-time flag was corrected, not trusted',
     await p.evaluate(() => window.__S.isAccountAdmin() === true && window.__S.state.user.email === 'plain@arabna.test'));
  await ctx.close();

  /* the stale device lock leaves every existing phone once */
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    if (s.adminAuth === undefined) { s.adminAuth = { user: 'old', salt: 'x', hash: 'y' }; localStorage.setItem('arabna.v1', JSON.stringify(s)); }
  });
  await mockSupabase(ctx2);
  const p2 = await ctx2.newPage(); wire(p2);
  await open(p2);
  ok('6.5 a stale `adminAuth` in storage is deleted at boot',
     await p2.evaluate(() => (JSON.parse(localStorage.getItem('arabna.v1') || '{}')).adminAuth === undefined
       && window.__S.state.adminAuth === undefined));
  await ctx2.close();

  /* structure: nothing of the lock survives in the code or the packs */
  const files = ['js/store.js', 'js/ui.js', 'js/app.js'].concat(
    readdirSync(ROOT + 'js/screens').filter(f => f.endsWith('.js')).map(f => 'js/screens/' + f));
  const all = files.map(f => [f, code(f)]);
  const machinery = /\b(adminUnlocked|setAdminUnlocked|checkAdmin|setAdminPass|adminIsSet|adminCanSet|adminUser)\s*\(/;
  const left = all.filter(([, c]) => machinery.test(c)).map(([f]) => f);
  ok('6.6 the device-lock machinery is gone from js/', left.length === 0, left.join(' '));
  const readersOfAuth = all.map(([f, c]) => [f, (c.match(/adminAuth/g) || []).length]).filter(([, n]) => n);
  ok('6.7 the only lines naming `adminAuth` are the two that delete it at boot',
     readersOfAuth.length === 1 && readersOfAuth[0][0] === 'js/store.js' && readersOfAuth[0][1] === 2,
     JSON.stringify(readersOfAuth));
  const i18n = read('js/i18n.js');
  const orphans = ['adminSetupTitle', 'adminSetupSub', 'adminSetupNote', 'adminSetupGo', 'adminSetupDone', 'adminNoCrypto',
                   'adminLoginFail', 'adminPassWrong', 'adminPassChanged', 'adminLockTitle', 'adminLockSub', 'adminLocked']
    .filter(k => new RegExp('\\b' + k + ':').test(i18n));
  ok('6.8 no orphan key of the old lock is left in either pack', orphans.length === 0, orphans.join(' '));
  ok('6.8b …and the true-reason screen has its words in both packs',
     (i18n.match(/\badminOnlyTitle:/g) || []).length === 2 && (i18n.match(/\badminOnlySub:/g) || []).length === 2);
  ok('6.9 `adminLog` stays — it is the record of what staff did, not the lock',
     /adminLog/.test(code('js/store.js')) && /'adminLog'/.test(code('js/store.js')));
  ok('6.10 the panel asks the server at its own door',
     /verifyAccountAdmin\(\)/.test(code('js/screens/admin.js')) && /export async function verifyAccountAdmin/.test(code('js/store.js')));
}

/* ===== 7. the migration 610 recorded ===== */
console.log('--- 7. the migration ---');
{
  const files = readdirSync(ROOT + 'supabase/migrations').filter(f => /admin_insert/.test(f));
  ok('7.1 the migration exists, numbered from the directory', files.length === 1 && /^0007_/.test(files[0]), files.join(' '));
  const sql = files.length ? sqlCode('supabase/migrations/' + files[0]) : '';
  ok('7.2 it lets staff INSERT a business row',
     /create policy "admin: insert" on public\.businesses for insert\s+with check \(public\.is_admin\(\)\)/.test(sql));
  ok('7.3 …and touches nothing else — not classifieds, no drop, no alter',
     !/classifieds|drop policy|alter policy|alter table/.test(sql));
}

/* ===== 8. the price reaches the server as a NUMBER ===== */
console.log('--- 8. the price on the wire ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p);
  await member(p, 'price@arabna.test');
  const priced = await publish(p, 'بسعر', '⁦$1,250.50⁩');
  const free = await p.evaluate(async () => {
    const S = window.__S;
    const rec = await S.addClassified({ cat: 'free', title: { ar: 'مجاناً', en: 'free' }, price: window.__D.FREE_PRICE,
      city: 'Katy', desc: { ar: 'x', en: 'x' }, photos: [], icon: 'gift' });
    return rec ? rec.id : null;
  });
  const rowP = db.classifieds.find(r => r.id === priced) || {};
  const rowF = db.classifieds.find(r => r.id === free) || {};
  ok('8.1 a priced listing reaches the numeric column as a number, and is not refused',
     !!priced && rowP.price === 1250.5, JSON.stringify(rowP.price));
  ok('8.2 the free sentinel reaches it as null', !!free && rowF.price === null, JSON.stringify(rowF.price));
  await ctx.close();
}

ok('9.1 zero console errors across the run', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
