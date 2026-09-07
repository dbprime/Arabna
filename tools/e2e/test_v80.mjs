/* V.10.5 — 635: five from the live walk.
 *
 * ⚠️ All five were found by hand on the live host, not by the net — three
 * while checking 625, two while checking 630 after its merge — and not one
 * of them hits a reader today; every one hits the first who comes.
 *
 *   1  the owner really DELETES a listing that was never approved and has
 *      no messages — both conditions measured, the server marked first
 *   2  the hide sheet says what hiding does, through a `body` on
 *      `confirmSheet` that moves nothing at the sixteen other call sites
 *   3  the visitor's headline shines — gold, one passing light every three
 *      seconds, still for whoever asked for no motion, and the member
 *      never sees the block at all
 *   4  the live readers run whenever the SESSION changes, not at boot alone
 *      — sign-in re-reads as the account, sign-out forgets then re-reads
 *   5  «بريده مؤكَّد», never «موثّق», beside a confirmed account
 *
 * ⚠️ Block 4 is the shape of the original fault: a page opened as a visitor
 * read the server as a visitor, and the session that came a moment later
 * never asked again — a staff account saw an empty queue until F5.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';
import { unlockAdmin, STAFF_EMAIL, STAFF_PW } from './_admin.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* comments stripped before any «does the code do X» check (test_v53's rule) */
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const css = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '');

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/supabase\.co|fonts\.googleapis/.test((m.location() && m.location().url) || '') &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};
const fresh = async (opts = {}, ctxOpts = {}) => {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, ctxOpts));
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  const db = await mockSupabase(ctx, opts);
  const p = await ctx.newPage(); wire(p);
  return { ctx, p, db };
};
const prime = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  window.__U = await import('arabna/js/ui.js').catch(() => import('./js/ui.js'));
  window.__I = await import('arabna/js/i18n.js').catch(() => import('./js/i18n.js'));
});
const open = async (p, hash = '#/home', wait = 1100) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(wait);
  await prime(p);
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
const buttons = p => p.evaluate(() => ({
  del: !!document.querySelector('#delBtn'), hide: !!document.querySelector('#hideBtn'),
  unhide: !!document.querySelector('#unhideBtn'),
}));

/* ===== 1. the owner deletes what was never published ===== */
console.log('--- 1. a real delete, under two conditions ---');
let shared, pendId;
{
  const a = await fresh({ preConfirm: true });
  shared = a.db;
  await open(a.p);
  await member(a.p, 'seller@arabna.test');
  pendId = await publish(a.p, 'كنبة لم تُنشر بعد', '⁦$300⁩');
  await go(a.p, '#/marketplace/' + pendId);
  let b = await buttons(a.p);
  ok('1.1 pending and unwritten-to: «احذف» is drawn and «أخفِ» is not', b.del && !b.hide && !b.unhide, JSON.stringify(b));
  ok('1.1b …and the store says so through one measured answer',
     await a.p.evaluate(id => window.__S.canOwnerDelete(id) === true, pendId));

  /* one message reaches the pending listing — the second condition falls */
  await a.p.evaluate(id => { const S = window.__S;
    S.state.messages.push({ id: 'm-test', listingId: id, from: 'buyer', text: 'مرحباً', created: Date.now(), when: { ar: 'الآن', en: 'now' } });
    S.save(); }, pendId);
  await go(a.p, '#/home', 300); await go(a.p, '#/marketplace/' + pendId);
  b = await buttons(a.p);
  ok('1.2 one message, still pending: back to «أخفِ» — the condition is TWO conditions', !b.del && b.hide, JSON.stringify(b));
  await a.p.evaluate(() => { const S = window.__S; S.state.messages = S.state.messages.filter(m => m.id !== 'm-test'); S.save(); });

  /* a LIVE listing hides, whatever its messages */
  shared.classifieds.find(r => r.id === pendId).status = 'live';
  await a.p.reload({ waitUntil: 'domcontentloaded' }); await a.p.waitForTimeout(1100); await prime(a.p);
  await go(a.p, '#/marketplace/' + pendId);
  b = await buttons(a.p);
  ok('1.3 a live listing: «أخفِ» always, never «احذف»', !b.del && b.hide, JSON.stringify(b));
  shared.classifieds.find(r => r.id === pendId).status = 'pending';
  await a.p.reload({ waitUntil: 'domcontentloaded' }); await a.p.waitForTimeout(1100); await prime(a.p);
  await go(a.p, '#/marketplace/' + pendId);

  /* the server refuses: nothing local is erased */
  const undo = await failing(a.ctx, 'PATCH', 'classifieds');
  const refused = await a.p.evaluate(async id => {
    const S = window.__S;
    const r = await S.ownerDeleteClassified(id);
    return { r, local: S.state.extraClassifieds.some(c => c.id === id), mine: S.state.myListings.includes(id) };
  }, pendId);
  await undo();
  ok('1.4 a refused server erases NOTHING on the device', refused.r === false && refused.local && refused.mine, JSON.stringify(refused));
  ok('1.4b …and the row on the server is still pending', shared.classifieds.find(r => r.id === pendId).status === 'pending');

  /* the real thing, through the button and its sheet */
  const rowsBefore = shared.classifieds.length;
  await a.p.evaluate(() => document.querySelector('#delBtn').click());
  await a.p.waitForTimeout(400);
  const sheet = await a.p.evaluate(() => {
    const y = document.querySelector('#cfmYes');
    return { danger: !!y && y.classList.contains('btn-danger'), title: (document.querySelector('.sheet-title') || {}).textContent || '' };
  });
  ok('1.5 the sheet is `danger` — there is no way back from a delete', sheet.danger && /احذف الإعلان/.test(sheet.title), JSON.stringify(sheet));
  await a.p.evaluate(() => document.querySelector('#cfmYes').click());
  await a.p.waitForTimeout(1000);
  const w = (shared.writes || []).filter(x => x.table === 'classifieds');
  ok('1.6 the server is marked `deleted` first, by id',
     w.some(x => x.body && x.body.status === 'deleted' && x.filters.some(f => f.k === 'id' && f.v === pendId) && x.n === 1),
     JSON.stringify(w.map(x => [x.body, x.n])));
  ok('1.6b …a MARK, not a wipe — the row is still in the table',
     shared.classifieds.length === rowsBefore && shared.classifieds.find(r => r.id === pendId).status === 'deleted');
  const after = await a.p.evaluate(id => { const S = window.__S; return {
    local: S.state.extraClassifieds.some(c => c.id === id), mine: S.state.myListings.includes(id),
    listed: S.allClassifieds().some(c => c.id === id), hash: location.hash,
    msgs: S.state.messages.filter(m => m.listingId === id).length }; }, pendId);
  ok('1.7 …and the device forgets it: not held, not owned, not listed', !after.local && !after.mine && !after.listed, JSON.stringify(after));
  ok('1.8 …and the reader lands on «إعلاناتي»', after.hash === '#/my-ads', after.hash);
  await a.ctx.close();

  /* the mark travels: a reader on another device does not meet it either */
  const v = await fresh({ preConfirm: true, db: shared });
  await open(v.p, '#/marketplace');
  ok('1.9 a `deleted` row is dropped by allClassifieds() exactly as `rejected` is',
     await v.p.evaluate(id => !window.__S.allClassifieds().some(c => c.id === id), pendId));
  await unlockAdmin(v.p);
  ok('1.9b …and the admin\'s own list has nothing to moderate on it',
     await v.p.evaluate(id => !window.__S.adminListings().some(c => c.id === id), pendId));
  await v.ctx.close();

  /* structural: no delete policy was opened for it */
  const migs = readdirSync(ROOT + 'supabase/migrations').filter(f => /\.sql$/.test(f));
  const allSql = migs.map(f => read('supabase/migrations/' + f).replace(/--.*$/gm, '')).join('\n');
  ok('1.10 no `for delete` policy on classifieds — «deletion is a mark, not a wipe»',
     !/on\s+public\.classifieds\s+for\s+delete/i.test(allSql), migs.length + ' migrations');
  const st = code('js/store.js');
  ok('1.11 the owner\'s door is a new door onto the OLD function, not a second erasure',
     /export async function ownerDeleteClassified[\s\S]*?deleteClassified\(id\)/.test(st)
     && (st.match(/state\.extraClassifieds = state\.extraClassifieds\.filter\(c => c\.id !== id\)/g) || []).length === 1);
  ok('1.12 …and it asks the server before it touches the device',
     /export async function ownerDeleteClassified[\s\S]*?await setListingStatus\(id, 'deleted'\)[\s\S]*?deleteClassified\(id\)/.test(st));
}

/* ===== 2. the hide sheet says what it does ===== */
console.log('--- 2. the sheet speaks ---');
{
  const a = await fresh({ preConfirm: true, db: shared });
  await open(a.p);
  await member(a.p, 'hider@arabna.test');
  const liveId = await publish(a.p, 'إعلان منشور', '⁦$50⁩');
  shared.classifieds.find(r => r.id === liveId).status = 'live';
  await a.p.reload({ waitUntil: 'domcontentloaded' }); await a.p.waitForTimeout(1100); await prime(a.p);
  await go(a.p, '#/marketplace/' + liveId);
  await a.p.evaluate(() => document.querySelector('#hideBtn').click());
  await a.p.waitForTimeout(400);
  const sh = await a.p.evaluate(() => {
    const I = window.__I;
    return { note: (document.querySelector('.sheet-note') || {}).textContent || '',
             want: I.t('hideListingWhat'),
             sub: (document.querySelector('.sheet-sub') || {}).textContent || '',
             title: (document.querySelector('.sheet-title') || {}).textContent || '' };
  });
  ok('2.1 the sheet prints the three facts under the listing\'s title', sh.note && sh.note === sh.want, sh.note);
  ok('2.1b …and the three facts are all there: everyone · while its days last · not counted',
     /الجميع/.test(sh.note) && /أيّامه/.test(sh.note) && /عدد إعلاناتك/.test(sh.note));
  ok('2.2 the title and the sub are what they were — the body is a third slot, not a rewrite',
     /أخفِ الإعلان/.test(sh.title) && /إعلان منشور/.test(sh.sub));
  await a.p.evaluate(() => document.querySelector('[data-close]').click());
  await a.p.waitForTimeout(400);

  /* the sixteen other call sites: a sheet with no body prints exactly the old shape */
  const plain = await a.p.evaluate(() => {
    window.__U.confirmSheet({ title: 'T-plain', sub: 'S-plain', confirmText: 'C-plain' });
    const panel = document.querySelector('.sheet-panel');
    const html = panel ? panel.innerHTML : '';
    return { hasNote: !!document.querySelector('.sheet-note'),
             shape: /<div class="sheet-title">T-plain<\/div>\s*<div class="sheet-sub">S-plain<\/div>\s*<button class="btn btn-gold btn-block" id="cfmYes">C-plain<\/button>/.test(html) };
  });
  ok('2.3 no body: no note is drawn and the markup is the old markup, letter for letter', !plain.hasNote && plain.shape, JSON.stringify(plain));
  await a.ctx.close();
  const js = ['js/ui.js', 'js/app.js', 'js/store.js', ...readdirSync(ROOT + 'js/screens').map(f => 'js/screens/' + f)]
    .map(f => code(f)).join('\n');
  const calls = js.match(/confirmSheet\(\{[\s\S]*?\}\)/g) || [];
  const withBody = calls.filter(c => /\bbody:/.test(c));
  ok('2.4 exactly ONE call site passes a body, and it is the hide sheet',
     withBody.length === 1 && /hideListingWhat/.test(withBody[0]), withBody.length + ' of ' + calls.length);
  ok('2.4b …and the parameter has no default that changes anything',
     /confirmSheet\(\{ title, sub, body, confirmText, danger, onConfirm \}\)/.test(code('js/ui.js'))
     && /\$\{body \? `<p class="sheet-note">\$\{body\}<\/p>` : ''\}/.test(read('js/ui.js')));
}

/* ===== 3. the visitor's headline shines ===== */
console.log('--- 3. gold, and a passing light ---');
{
  const style = css('styles/app.css');
  const visitor = await fresh({ preConfirm: true }, { colorScheme: 'dark' });
  await open(visitor.p);
  const v = await visitor.p.evaluate(() => {
    const h = document.querySelector('.home-headline'); const s = document.querySelector('.home-subline');
    if (!h) return { intro: false };
    const cs = getComputedStyle(h); const ss = getComputedStyle(s);
    return { intro: true, anim: cs.animationName, clip: cs.webkitBackgroundClip || cs.backgroundClip,
             fill: cs.webkitTextFillColor, color: cs.color, dur: cs.animationDuration,
             subAnim: ss.animationName, subClip: ss.webkitBackgroundClip || ss.backgroundClip };
  });
  ok('3.1 the visitor sees the intro block', v.intro === true);
  ok('3.2 …and the headline is clipped to a moving gradient — the shine',
     v.anim === 'headline-shine' && v.clip === 'text' && v.dur === '3s', JSON.stringify(v));
  ok('3.2b …and the fallback colour underneath is gold, not the body ink',
     v.color === 'rgb(198, 161, 91)', v.color);
  ok('3.5 the subline does not shine — it is an index, the headline is the greeting',
     v.subAnim === 'none' && v.subClip !== 'text', JSON.stringify({ a: v.subAnim, c: v.subClip }));
  await visitor.ctx.close();

  const still = await fresh({ preConfirm: true }, { reducedMotion: 'reduce', colorScheme: 'dark' });
  await open(still.p);
  const r = await still.p.evaluate(() => { const h = document.querySelector('.home-headline'); const cs = getComputedStyle(h);
    return { anim: cs.animationName, color: cs.color, bg: cs.backgroundColor }; });
  ok('3.3 whoever asked for no motion gets steady gold and no animation',
     r.anim === 'none' && r.color === 'rgb(198, 161, 91)' && r.bg === 'rgb(198, 161, 91)', JSON.stringify(r));
  await still.ctx.close();

  const m = await fresh({ preConfirm: true });
  await open(m.p);
  await member(m.p, 'reader@arabna.test');
  await go(m.p, '#/directory', 300); await go(m.p, '#/home');
  ok('3.4 a member never sees the block, so never sees the shine (the 24 August decision stands)',
     await m.p.evaluate(() => !document.querySelector('.home-intro')));
  await m.ctx.close();

  /* structural: the three conditions that are not negotiable */
  const headIdx = style.indexOf('.home-headline {');
  const supIdx = style.indexOf('@supports (-webkit-background-clip: text)');
  const headRule = style.slice(headIdx, style.indexOf('}', headIdx));
  ok('3.6 `color: var(--gold)` stands on .home-headline BEFORE any @supports — the fallback comes first',
     headIdx > 0 && supIdx > headIdx && /color: var\(--gold\)/.test(headRule));
  const shines = style.match(/--shine:\s*#[0-9A-Fa-f]{6}/g) || [];
  const values = [...new Set(shines.map(x => x.split(':')[1].trim().toUpperCase()))];
  ok('3.7 `--shine` is declared beside --gold in the dark block AND the light ones, with two values',
     shines.length >= 3 && values.length === 2, JSON.stringify(shines));
  const animIdx = style.indexOf('animation: headline-shine');
  const mediaBefore = style.lastIndexOf('@media', animIdx);
  const mediaLine = style.slice(mediaBefore, style.indexOf('{', mediaBefore));
  const closeBefore = style.lastIndexOf('}\n}', animIdx);
  ok('3.8 the animation lives INSIDE prefers-reduced-motion: no-preference, and nowhere else',
     animIdx > 0 && /prefers-reduced-motion:\s*no-preference/.test(mediaLine) && closeBefore < mediaBefore
     && (style.match(/animation: headline-shine/g) || []).length === 1, mediaLine.trim());
  const subIdx = style.indexOf('.home-subline {');
  const subRule = style.slice(subIdx, style.indexOf('}', subIdx));
  ok('3.9 .home-subline carries no gradient and no animation', !/background-clip|animation|--shine/.test(subRule));
  ok('3.10 the three numbers of the rhythm are written once, in the keyframes',
     (style.match(/@keyframes headline-shine/g) || []).length === 1
     && /@keyframes headline-shine\s*\{\s*0%[^}]*150%[^}]*\}\s*60%[^}]*-60%[^}]*\}\s*100%/.test(style));
}

/* ===== 4. the readers run whenever the session changes ===== */
console.log('--- 4. the page reads as whoever is signed in ---');
{
  /* a member leaves a pending listing on the shared server */
  const a = await fresh({ preConfirm: true, db: shared });
  await open(a.p);
  await member(a.p, 'poster@arabna.test');
  const pid = await publish(a.p, 'إعلانٌ ينتظر المشرف', '⁦$75⁩');
  await a.p.evaluate(() => window.__S.signOut());
  await a.ctx.close();

  /* a staff account exists on the server, then signs out again */
  const s = await fresh({ preConfirm: true, db: shared });
  await open(s.p);
  await unlockAdmin(s.p);
  await s.p.evaluate(() => window.__S.signOut());
  await s.ctx.close();
  ok('4.0 the stage is set: a pending row on the server and NO session', shared.session == null
     && shared.classifieds.some(r => r.id === pid && r.status === 'pending'));

  /* the original fault, step by step, with no reload anywhere */
  const b = await fresh({ preConfirm: true, db: shared });
  await open(b.p);
  const asVisitor = await b.p.evaluate(id => window.__S.pendingListings().some(c => c.id === id), pid);
  ok('4.1a opened as a visitor, the page holds no pending row — RLS answered a visitor', asVisitor === false);
  const t0 = Date.now();
  const signIn = await b.p.evaluate(async ([em, pw]) => {
    const S = window.__S; const started = performance.now();
    const err = await S.signInWithPassword(em, pw);
    return { err, ms: Math.round(performance.now() - started), pendingNow: S.pendingListings().length };
  }, [STAFF_EMAIL, STAFF_PW]);
  await b.p.waitForTimeout(1200);
  const afterIn = await b.p.evaluate(id => ({
    pending: window.__S.pendingListings().some(c => c.id === id), at: window.__S.liveClsLoadedAt() }), pid);
  ok('4.1b sign-in re-reads the server AS THE ACCOUNT — the pending row arrives with no reload',
     signIn.err === null && afterIn.pending === true, JSON.stringify({ signIn, afterIn }));
  await go(b.p, '#/admin', 1200);
  ok('4.1 …and #/admin, opened without F5, lists it in the queue — the fault that was measured live',
     await b.p.evaluate(id => !!document.querySelector(`[data-approve="${id}"]`), pid));

  /* the reverse: sign out, with the network failing right after */
  const undo = await failing(b.ctx, 'GET', '');
  const out = await b.p.evaluate(async id => {
    const S = window.__S;
    await S.signOut();
    return { pending: S.pendingListings().length, listed: S.allClassifieds().some(c => c.id === id),
             at: S.liveClsLoadedAt(), bizAt: S.liveBizLoadedAt() };
  }, pid);
  await undo();
  ok('4.2 sign-out forgets the ended session\'s rows AT ONCE, even when the network then fails',
     out.pending === 0 && !out.listed && out.at === 0 && out.bizAt === 0, JSON.stringify(out));
  await b.ctx.close();

  /* sign-in does not wait on the network for the rows */
  const c = await fresh({ preConfirm: true, db: shared });
  await open(c.p);
  const slow = r => (r.request().method() === 'GET' && /\/rest\/v1\/(classifieds|businesses)/.test(r.request().url()))
    ? setTimeout(() => r.fallback(), 1500) : r.fallback();
  await c.ctx.route('**/rest/v1/**', slow);
  const timed = await c.p.evaluate(async ([em, pw]) => {
    const S = window.__S; const started = performance.now();
    const err = await S.signInWithPassword(em, pw);
    return { err, ms: Math.round(performance.now() - started), user: !!S.state.user, at: S.liveClsLoadedAt() };
  }, [STAFF_EMAIL, STAFF_PW]);
  await c.p.waitForTimeout(2200);
  const later = await c.p.evaluate(() => window.__S.liveClsLoadedAt());
  await c.ctx.unroute('**/rest/v1/**', slow);
  ok('4.4 sign-in returns BEFORE the rows do — no `await` was slipped in',
     timed.err === null && timed.user && timed.ms < 1400 && later > timed.at, JSON.stringify({ timed, later }));
  await c.p.evaluate(() => window.__S.signOut());
  await c.ctx.close();

  /* structural */
  const app = code('js/app.js'); const st = code('js/store.js');
  ok('4.3 boot still calls both readers — the visitor who never signs in reads the live rows as before',
     /loadLiveBusinesses\(\)\.then\(/.test(app) && /loadLiveClassifieds\(\)\.then\(/.test(app));
  const hyd = st.slice(st.indexOf('export async function hydrateUserFromSession'), st.indexOf('export function isAccountAdmin'));
  ok('4.4b …and in the code: hydrateUserFromSession calls the refresh without awaiting it',
     /\n\s*refreshLiveRows\(\);/.test(hyd) && !/await refreshLiveRows/.test(hyd));
  const so = st.slice(st.indexOf('export async function signOut'), st.indexOf('export async function updateProfile'));
  ok('4.5 signOut FORGETS the rows before it re-reads them — the order is the item',
     /forgetLiveRows\(\);\s*refreshLiveRows\(\);/.test(so));
  const vaa = st.slice(st.indexOf('export async function verifyAccountAdmin'), st.indexOf('}', st.indexOf('export async function verifyAccountAdmin') + 800));
  ok('4.6 verifyAccountAdmin reads the flag and NOT the rows — a screen opening is not a session changing',
     !/loadLive|refreshLiveRows/.test(vaa));
}

/* ===== 5. «بريده مؤكَّد», not «موثّق» ===== */
console.log('--- 5. one word, one meaning ---');
{
  const s = await fresh({ preConfirm: true, db: shared });
  await open(s.p);
  await unlockAdmin(s.p);
  await s.p.evaluate(() => { const b = [...document.querySelectorAll('#aTabs .tab')].find(x => x.dataset.t === 'users'); b && b.click(); });
  await s.p.waitForTimeout(400);
  await s.p.fill('#uQ', 'seller');
  await s.p.waitForTimeout(900);
  const u = await s.p.evaluate(() => {
    const out = document.querySelector('#uOut'); const I = window.__I;
    return { text: out ? out.innerText : '', rows: out ? out.querySelectorAll('.list-row').length : 0,
             emailOk: I.t('usersEmailOk'), verified: I.t('verified') };
  });
  ok('5.1 a confirmed account reads «بريده مؤكَّد»', u.rows > 0 && u.text.includes(u.emailOk), JSON.stringify({ rows: u.rows, has: u.text.includes(u.emailOk) }));
  ok('5.1b …and never «موثّق» — that word is the business badge', !u.text.includes(u.verified), u.verified);
  await s.ctx.close();
  const adm = code('js/screens/admin.js');
  const rowFn = adm.slice(adm.indexOf('function userRowHtml'), adm.indexOf('\n}\n', adm.indexOf('function userRowHtml')));
  ok('5.2 the row reads its own key and not the badge\'s', /t\('usersEmailOk'\)/.test(rowFn) && !/t\('verified'\)/.test(rowFn));
  const i18n = read('js/i18n.js');
  ok('5.3 the key is in both packs', (i18n.match(/usersEmailOk:/g) || []).length === 2);
  ok('5.4 …and the badge\'s own key is untouched — «موثّق» still reads «موثّق»',
     /verified: 'موثّق'/.test(i18n) && /verified: 'Verified'/.test(i18n)
     && (i18n.match(/deleteListing:|hideListingWhat:|listingDeleted:/g) || []).length === 6);
  const allJs = ['js/ui.js', 'js/store.js', ...readdirSync(ROOT + 'js/screens').map(f => 'js/screens/' + f)].map(f => code(f)).join('\n');
  ok('5.5 the badge keeps its five readers, and the sixth is gone',
     (allJs.match(/t\('verified'\)/g) || []).length === 5, String((allJs.match(/t\('verified'\)/g) || []).length));
}

/* ===== 6. the carriers agree, and the console is clean ===== */
{
  const v = (read('js/data.js').match(/APP_VERSION = '([^']+)'/) || [])[1];
  const sw = (read('js/sw-manifest.js').match(/'([0-9.]+)'/) || [])[1];
  const cl = (read('CLAUDE.md').match(/Current version: \*\*V\.(\d+)\.(\d+)/) || []);
  const clv = cl.length ? `0.${parseInt(cl[1], 10)}.${parseInt(cl[2], 10)}` : '';
  ok('6.1 data.js, sw-manifest.js and CLAUDE.md carry one version', !!v && v === sw && v === clv, `${v} · ${sw} · ${clv}`);
  ok('7.1 zero console errors across every scene', errors.length === 0, errors.slice(0, 3).join(' | '));
}

await browser.close();
console.log(`\nv80: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
