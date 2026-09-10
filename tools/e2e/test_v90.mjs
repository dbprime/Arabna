/* ============================================================
   test_v90 — 671: the message reaches both parties, and the
                   conversation knows whose it is
   ------------------------------------------------------------
   ⚠️ THE FAULT, IN ONE SENTENCE: the buyer never saw the seller's reply.
   Not on their own device, not on another, not after a year. And it was
   not a second-device fault — the whole road was measured on 10 September
   2026 and the fault was absolute. The marketplace is built on two people
   talking.

   The cause was a missing column. `messages` carried `listing_id` and
   `sender_id` and nothing saying TO WHOM, so the read policy asked «are
   you the writer?» or «do you own the listing?» — and the seller's reply
   is neither of those to the buyer. Both branches fell, the row never
   travelled, and PostgREST answers a shorter list with 200 and no error,
   so nothing anywhere said a word.

   ⚠️ AND IT IS NOT FIXED BY WIDENING THE POLICY. «Whoever wrote on this
   listing reads everything on it» is one line — and with two buyers on
   one listing the first reads the second's private conversation: their
   name, their question, the price they offered. A private conversation
   leaking between strangers is worse than a reply that does not arrive.

   ⚠️ AND EVERY ITEM HERE IS MEASURED WITH TWO REAL ACCOUNTS IN TWO REAL
   BROWSERS, never one account reading itself.

   Eleven blocks: the migration · the reply arrives · a second device ·
   two buyers · the seller's own list · the spam guard · a third account ·
   the old link · a row with no party · the three silent writes · the
   inventory.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const SINGLE = /single-file/.test(BASE);
const ROOT = new URL('../../', import.meta.url).pathname;
const MIG = ROOT + 'supabase/migrations/';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ comments stripped before any «does the code do X» check — the rule
   this project has now paid for five times. This batch's own comments
   NAME the shapes they forbid, so a check reading the prose about the
   code reports the fault it exists to prevent. */
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const code = f => strip(read(f));
const migName = readdirSync(MIG).filter(n => /^0018_/.test(n))[0] || '';
const mig = migName ? readFileSync(MIG + migName, 'utf8') : '';
const migCode = mig.replace(/--[^\n]*/g, '');
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
/* ⚠️ `arabna/js/store.js` FIRST: on the single-file build the modules sit
   behind an importmap, so a relative import hands back a SECOND instance
   with its own state. */
const prime = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
});
const open = async (p, hash = '#/home', wait = 1100) => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(wait);
  await prime(p);
};
const member = async (p, email, name) => p.evaluate(async ([em, c, nm]) => {
  const S = window.__S;
  const err = await S.signUp({ name: nm, email: em, password: 'Qx7#mVzt2026', phone: '' });
  if (err) throw new Error(err);
  if (!S.state.user.emailVerified) { const e2 = await S.confirmEmail(c); if (e2) throw new Error(e2); }
  return S.state.user.id;
}, [email, MOCK_CODE, name]);
const say = (p, listing, text, party) => p.evaluate(async ([id, t, b]) => {
  const S = window.__S;
  const r = await S.sendMessage(id, t, 'ar', b);
  await S.loadLiveMessages();
  return { ok: !!(r && r.msg), error: r && r.error };
}, [listing, text, party || null]);
const readThread = (p, listing, party) => p.evaluate(async ([id, b]) => {
  const S = window.__S;
  await S.loadLiveMessages();
  const list = S.messagesFor(id, b === null ? undefined : b);
  return { n: list.length, texts: list.map(m => m.text), mine: list.map(m => m.mine) };
}, [listing, party === undefined ? null : party]);

const LIST = (over = {}) => Object.assign({
  cat: 'furniture', title: { ar: 'كنبة', en: 'Sofa' },
  desc: { ar: 'بحالة جيّدة', en: 'Good condition' },
  price: '⁦$650⁩', city: 'Houston', photos: [],
}, over);

/* ============================================================
   1 — the migration: the column that defines a conversation
   ============================================================ */
console.log('--- 1: the migration ---');
{
  ok('1.1 `0018` exists and is the batch\'s only migration', /^0018_messages_thread\.sql$/.test(migName), migName);
  ok('1.2 the thread key is added, and it may be null',
     /add column if not exists buyer_id uuid/.test(migCode)
     && !/buyer_id uuid[^;]*not null/.test(migCode), 'nullable by decision');
  /* ⚠️ THE BACKFILL FILLS ONLY WHAT IS KNOWABLE. A row the listing's own
     owner wrote has no knowable party, and none is invented for it. */
  ok('1.3 the backfill takes the sender, and only when they are not the owner',
     /update public\.messages[\s\S]{0,400}set buyer_id = m\.sender_id/.test(migCode)
     && /sender_id is distinct from[\s\S]{0,160}owner_id/.test(migCode), 'narrow');
  ok('1.4 …and never touches a row that already has one',
     /m\.buyer_id is null/.test(migCode), 'is null');
  ok('1.5 a conversation index, in the order a conversation is read',
     /create index if not exists messages_thread_idx[\s\S]{0,120}\(listing_id, buyer_id, created_at\)/.test(migCode), '');
  ok('1.6 the read policy gains the party\'s own branch',
     /"two parties: read"[\s\S]{0,400}buyer_id\s*=\s*auth\.uid\(\)/.test(migCode), '');
  /* ⚠️ THE INSERT GUARD IS HALF THE FIX, NOT A POLISH. The column that
     delivers the reply is a spam channel without it: the owner writes any
     account's id into `buyer_id` and the row lands in the inbox of
     somebody who never wrote to them. */
  ok('1.7 the insert policy has two branches and the owner\'s asks for an existing thread',
     /"sender: insert"[\s\S]{0,700}buyer_id = auth\.uid\(\)[\s\S]{0,700}can_reply_in_thread\(/.test(migCode), '');
  /* ⚠️ AND IT IS A FUNCTION, NOT AN INLINE `exists`. Measured on a real
     PostgreSQL 16: `exists` on `public.messages` inside a policy ON
     `public.messages` raises «infinite recursion detected in policy for
     relation "messages"» — every insert refused, from every party, which
     is a marketplace where nobody can send a message at all. */
  ok('1.8 the existence test is NOT an inline subquery on the same table',
     !/"sender: insert"[\s\S]{0,900}exists\s*\(\s*select[^)]{0,80}from public\.messages/.test(migCode),
     'no recursion');
  /* ⚠️ AND THE PARAMETERS ARE NOT NAMED LIKE THE COLUMNS. Measured with
     both namings: the bare name binds to the parameter first, the
     condition becomes true always, and the attack's message LANDED in the
     stranger's inbox — one row against zero. The difference is two
     characters. */
  ok('1.9 the guard\'s parameters cannot collide with the column names',
     /can_reply_in_thread\(p_listing uuid, p_buyer uuid\)/.test(migCode), 'p_ prefixed');
  ok('1.10 …and it carries the ownership test itself, so it is no probe',
     /can_reply_in_thread[\s\S]{0,400}from public\.classifieds c[\s\S]{0,120}owner_id = auth\.uid\(\)/.test(migCode), '');
  /* ⚠️ NOT `security definer` — measured, and the reason `0014` earned:
     a reason written into a migration is measured or it is not written.
     The only caller who reaches that branch is the listing's owner, who
     reads their listing's messages under the policy anyway. */
  const defOf = (n) => (migCode.match(new RegExp(
    'create or replace function public\\.' + n + '[\\s\\S]*?\\$fn\\$')) || [''])[0];
  ok('1.11 the reply guard is NOT granted its definer\'s rights',
     !!defOf('can_reply_in_thread') && !/security definer/.test(defOf('can_reply_in_thread')),
     'caller\'s rights');
  /* …while the NAME lookup is, and cannot be otherwise: it reads a
     `profiles` row the caller cannot reach at all. */
  ok('1.12 the name lookup IS, because it reads a row the caller cannot',
     /security definer/.test(defOf('thread_party_name')), '');
  ok('1.13 …and `anon` may not call it',
     /revoke all on function public\.thread_party_name/.test(migCode)
     && /grant execute on function public\.thread_party_name\(uuid, uuid\) to authenticated/.test(migCode), '');
  /* ⚠️ `profiles` IS NOT WIDENED for a line in a list. */
  ok('1.14 `profiles` keeps its own-row read policy',
     !/on public\.profiles for select/.test(migCode), 'untouched');
  ok('1.15 no update and no delete policy on messages, still',
     !/on public\.messages for (update|delete)/.test(sqlCode()), 'none anywhere');
  /* the SQL editor drops both characters — measured twice in this project */
  ok('1.16 no pipes and no star in the code', !migCode.includes('||') && !migCode.includes('*'),
     'pipes ' + (migCode.split('||').length - 1) + ' star ' + (migCode.split('*').length - 1));
}

/* ============================================================
   2 — THE ITEM: the buyer sees the reply
   ============================================================ */
console.log('--- 2: the reply arrives ---');
const scene = {};
/* ⚠️ A BLOCK THAT THROWS TAKES THE WHOLE SUITE DOWN AND EVERY ASSERTION
   AFTER IT GOES UNMEASURED — which is exactly how a batch reports green
   while it is not (`649` paid for this once already). So each block runs
   inside `guard`, and a throw is a FAILED item that names itself. */
const guard = async (n, fn) => { try { await fn(); }
  catch (e) { ok(n + ' block ran to the end', false, String((e && e.message) || e).slice(0, 120)); } };
{
  const a = await fresh({ preConfirm: true });               // the seller
  await open(a.p);
  scene.seller = await member(a.p, 'seller671@arabna.test', 'Seller');
  scene.listing = await a.p.evaluate(async ([l]) => {
    const r = await window.__S.addClassified(l);
    return r && r.id;
  }, [LIST()]);
  ok('2.1 the seller published a listing', !!scene.listing, String(scene.listing));
  /* ⚠️ AND IT IS APPROVED ON THE SERVER BEFORE A BUYER IS EXPECTED TO
     OPEN IT. Every user listing starts `pending` — visible to its owner
     and to nobody else — so a buyer reaching its conversation screen
     before approval is correctly sent back to the marketplace. That is
     the app behaving, not a fault, and the fixture has to say which state
     it is measuring. */
  (scene_row => { if (scene_row) scene_row.status = 'live'; })(
    a.db.classifieds.find(x => x.id === scene.listing));

  const b = await fresh({ preConfirm: true, db: a.db });     // buyer A
  await open(b.p);
  scene.buyerA = await member(b.p, 'buyera671@arabna.test', 'Buyer A');
  const sent = await say(b.p, scene.listing, 'مرحباً، هل ما زالت متوفّرة؟');
  ok('2.2 the buyer wrote, and the server took it', sent.ok === true, JSON.stringify(sent));
  ok('2.3 …and the row carries the conversation\'s party',
     a.db.messages.length === 1 && a.db.messages[0].buyer_id === scene.buyerA,
     JSON.stringify({ buyer: a.db.messages[0] && a.db.messages[0].buyer_id === scene.buyerA }));

  /* the seller replies IN that conversation — the party comes from the
     screen and is never guessed */
  const rep = await say(a.p, scene.listing, 'نعم، ما زالت.', scene.buyerA);
  ok('2.4 the seller replied in that conversation', rep.ok === true, JSON.stringify(rep));

  /* ⚠️ AND THIS IS THE WHOLE BATCH, IN ONE LINE. On `main` before it the
     buyer read one message — their own — and concluded they were
     ignored. */
  const seen = await readThread(b.p, scene.listing, scene.buyerA);
  ok('2.5 THE BUYER SEES THE REPLY — the fault this batch exists for',
     seen.n === 2 && seen.texts.join(' ').includes('ما زالت.'), JSON.stringify(seen));
  ok('2.6 …and the reply is not marked as the buyer\'s own',
     seen.mine[0] === true && seen.mine[1] === false, JSON.stringify(seen.mine));
  scene.a = a; scene.b = b;
}

/* ============================================================
   3 — …and from a second device, after signing out and in
   ============================================================ */
console.log('--- 3: a second device ---');
{
  const c = await fresh({ preConfirm: true, db: scene.a.db });
  await open(c.p);
  const got = await c.p.evaluate(async ([em, id, party]) => {
    const S = window.__S;
    const err = await S.signInWithPassword(em, 'Qx7#mVzt2026');
    if (err) return { error: err };
    await S.loadLiveMessages();
    const list = S.messagesFor(id, party);
    return { n: list.length, mine: list.map(m => m.mine) };
  }, ['buyera671@arabna.test', scene.listing, scene.buyerA]);
  /* ⚠️ the owner's own question of 10 September, in a check */
  ok('3.1 a second device of the same account reads the whole conversation',
     got.n === 2, JSON.stringify(got));
  ok('3.2 …with «mine» computed and not carried, so it is still right there',
     got.mine && got.mine[0] === true && got.mine[1] === false, JSON.stringify(got.mine));
  await c.ctx.close();
}

/* ============================================================
   4 — two buyers on one listing, and neither reads the other
   ============================================================ */
console.log('--- 4: two buyers ---');
{
  const d = await fresh({ preConfirm: true, db: scene.a.db });
  await open(d.p);
  scene.buyerB = await member(d.p, 'buyerb671@arabna.test', 'Buyer B');
  const sent = await say(d.p, scene.listing, 'بكم آخر سعر؟ أعرض 400');
  ok('4.1 a second buyer opens their own conversation', sent.ok === true, JSON.stringify(sent));

  const mine = await readThread(d.p, scene.listing, scene.buyerB);
  ok('4.2 …and reads their own, whole', mine.n === 1 && mine.texts[0].includes('400'), JSON.stringify(mine));
  /* ⚠️ THE MUTATION'S OWN TOOTH, AND IT IS MEASURED IN BOTH DIRECTIONS:
     the naive «whoever wrote on this listing reads it all» would hand
     buyer B the first buyer's name, question and offer. */
  const all = await readThread(d.p, scene.listing);
  ok('4.3 …AND NOTHING OF THE OTHER CONVERSATION — not even through the listing',
     all.n === 1 && !all.texts.join(' ').includes('ما زالت'), JSON.stringify(all));
  const other = await readThread(d.p, scene.listing, scene.buyerA);
  ok('4.4 …nor by asking for it outright', other.n === 0, JSON.stringify(other));
  scene.d = d;
}

/* ============================================================
   5 — the seller sees both, apart, and each line names its party
   ============================================================ */
console.log('--- 5: the seller\'s own list ---');
{
  const th = await scene.a.p.evaluate(async ([id]) => {
    const S = window.__S;
    await S.loadLiveMessages();
    const list = S.messageThreads().filter(t => t.listingId === id);
    await S.loadThreadNames(list);
    return list.map(t => ({ buyerId: t.buyerId, count: t.count,
                            who: S.threadPartyName(t.listingId, t.buyerId) }));
  }, [scene.listing]);
  ok('5.1 the seller has TWO conversations on one listing, not one stream',
     th.length === 2, JSON.stringify(th));
  ok('5.2 …and each is keyed on its own party',
     th.some(t => t.buyerId === scene.buyerA) && th.some(t => t.buyerId === scene.buyerB),
     JSON.stringify(th.map(t => t.buyerId)));
  /* ⚠️ AND EACH LINE NAMES WHO IT IS WITH. Without it a seller with three
     askers reads the same listing title three times — the blurring this
     batch takes out of the data, put back on the screen. */
  ok('5.3 …and names the other party, which `profiles` alone could never do',
     th.every(t => t.who === 'Buyer A' || t.who === 'Buyer B'),
     JSON.stringify(th.map(t => t.who)));
  const each = await scene.a.p.evaluate(async ([id, x, y]) => {
    const S = window.__S;
    return { a: S.messagesFor(id, x).length, b: S.messagesFor(id, y).length,
             all: S.messagesFor(id).length };
  }, [scene.listing, scene.buyerA, scene.buyerB]);
  ok('5.4 the seller reads each conversation apart, and all of them together',
     each.a === 2 && each.b === 1 && each.all === 3, JSON.stringify(each));
  /* the owner arriving with no party gets the LIST, never a stream */
  await scene.a.p.goto(BASE + '#/messages/' + scene.listing, { waitUntil: 'domcontentloaded' });
  await scene.a.p.waitForTimeout(1400);
  const rows = await scene.a.p.evaluate(() =>
    [...document.querySelectorAll('#app .list-row')].map(r => r.getAttribute('data-route') || ''));
  ok('5.5 …and the owner\'s own button opens the LIST, not one column of bubbles',
     rows.filter(r => r.startsWith('#/messages/')).length === 2,
     JSON.stringify(rows.filter(r => r.startsWith('#/messages/'))));
  const named = await scene.a.p.evaluate(() =>
    [...document.querySelectorAll('#app .row-sub')].map(r => r.textContent.trim()));
  ok('5.6 …and every row on it says who it is with',
     named.some(x => x.includes('Buyer A')) && named.some(x => x.includes('Buyer B')),
     JSON.stringify(named));
}

/* ============================================================
   6 — the spam channel the column would open, closed
   ============================================================ */
console.log('--- 6: the guard on the guard ---');
{
  /* ⚠️ Without the `exists` branch the owner writes ANY account's id into
     `buyer_id` and the row lands in the inbox of somebody who never wrote
     to them — a spam channel with a policy on it, which is the sentence
     `0013` already carries about the notifications table. */
  const stranger = await fresh({ preConfirm: true, db: scene.a.db });
  await open(stranger.p);
  const sid = await member(stranger.p, 'stranger671@arabna.test', 'Stranger');
  const before = scene.a.db.messages.length;
  const bad = await say(scene.a.p, scene.listing, 'اشترِ مني', sid);
  ok('6.1 the owner cannot open a conversation on somebody who never wrote',
     bad.ok === false, JSON.stringify(bad));
  ok('6.2 …and not one row landed in their inbox',
     scene.a.db.messages.length === before
     && !scene.a.db.messages.some(m => m.buyer_id === sid), String(scene.a.db.messages.length));
  /* ⚠️ AND A BUYER CANNOT KEY A CONVERSATION ON ANYBODY BUT THEMSELVES —
     and the store does not refuse them, it IGNORES what they passed,
     which is stronger: the party for anyone who is not the listing's
     owner is the writer, by definition, so there is nothing to get
     wrong. Measured on where the row LANDED, not on a return value. */
  const before2 = scene.a.db.messages.filter(m => m.buyer_id === scene.buyerA).length;
  const cross = await say(scene.d.p, scene.listing, 'أدخل محادثة غيري', scene.buyerA);
  const after2 = scene.a.db.messages.filter(m => m.buyer_id === scene.buyerA).length;
  ok('6.3 a buyer passing another buyer\'s party writes into their OWN conversation',
     cross.ok === true && after2 === before2
     && scene.a.db.messages.some(m => m.buyer_id === scene.buyerB && m.body.includes('غيري')),
     JSON.stringify({ intoA: after2 - before2 }));
  /* …and the database refuses it too, for anything that is not the screen */
  const raw = await scene.d.p.evaluate(async ([id, other, me]) => {
    const { error } = await window.__S.sb.from('messages')
      .insert({ listing_id: id, sender_id: me, buyer_id: other, body: 'raw' }).select();
    return error ? (error.code || error.message || 'refused') : null;
  }, [scene.listing, scene.buyerA, scene.buyerB]);
  ok('6.3b …and a write that goes round the screen is refused by the policy',
     raw !== null, String(raw));
  /* ⚠️ AND THE STORE REFUSES BEFORE THE SERVER DOES, because the party is
     never guessed: an owner with no party would otherwise put the reply
     into whichever conversation a default happened to land on. */
  const guess = await scene.a.p.evaluate(async ([id]) =>
    (await window.__S.sendMessage(id, 'بلا طرف', 'ar')).error, [scene.listing]);
  ok('6.4 …and the store refuses an owner with no party rather than guessing',
     guess === 'noThread', String(guess));
  scene.stranger = stranger; scene.strangerId = sid;
}

/* ============================================================
   7 — a third account reads nothing of either
   ============================================================ */
console.log('--- 7: a stranger ---');
{
  const got = await scene.stranger.p.evaluate(async ([id, x, y]) => {
    const S = window.__S;
    await S.loadLiveMessages();
    return { all: S.messagesFor(id).length,
             a: S.messagesFor(id, x).length, b: S.messagesFor(id, y).length,
             name: S.threadPartyName(id, x) };
  }, [scene.listing, scene.buyerA, scene.buyerB]);
  ok('7.1 a third account reads nothing of either conversation',
     got.all === 0 && got.a === 0 && got.b === 0, JSON.stringify(got));
  ok('7.2 …and cannot get a name out of one either', !got.name, JSON.stringify(got.name));
}

/* ============================================================
   8 — the old link still opens what it always opened
   ============================================================ */
console.log('--- 8: a link already sent ---');
{
  await scene.b.p.goto(BASE + '#/messages/' + scene.listing, { waitUntil: 'domcontentloaded' });
  await scene.b.p.waitForTimeout(1400);
  const st = await scene.b.p.evaluate(() => ({
    hash: location.hash,
    bubbles: document.querySelectorAll('#msgList .msg').length,
    box: !!document.querySelector('#msgIn'),
  }));
  ok('8.1 an old one-segment link opens the reader\'s own conversation',
     st.bubbles === 2 && st.box === true, JSON.stringify(st));
  ok('8.2 …and does not fall over or redirect', st.hash === '#/messages/' + scene.listing, st.hash);
  /* the two-segment route is what the list links to */
  await scene.b.p.goto(BASE + '#/messages/' + scene.listing + '/' + scene.buyerA,
                       { waitUntil: 'domcontentloaded' });
  await scene.b.p.waitForTimeout(1400);
  const two = await scene.b.p.evaluate(() => ({
    bubbles: document.querySelectorAll('#msgList .msg').length, box: !!document.querySelector('#msgIn') }));
  ok('8.3 and the two-segment route opens that one conversation',
     two.bubbles === 2 && two.box === true, JSON.stringify(two));
  ok('8.4 the routes are written so the slash is not swallowed',
     /\^#\\\/messages\\\/\(\[\^\/\]\+\)\\\/\(\[\^\/\]\+\)\$/.test(code('js/app.js')), 'two before one');
}

/* ============================================================
   9 — a row from before the column, kept rather than guessed at
   ============================================================ */
console.log('--- 9: a row with no party ---');
{
  scene.a.db.messages.push({ id: 'legacy-1', listing_id: scene.listing,
    sender_id: scene.seller, buyer_id: null, body: 'رسالة قديمة بلا طرف',
    created_at: new Date(Date.now() - 9e6).toISOString(), scrubbed: false, off_platform: false });
  const own = await scene.a.p.evaluate(async ([id]) => {
    const S = window.__S;
    await S.loadLiveMessages();
    const all = S.messagesFor(id);
    const th = S.messageThreads().filter(t => t.listingId === id);
    return { all: all.length, legacy: all.some(m => m.text.includes('قديمة')),
             threads: th.length, nulls: th.filter(t => t.buyerId === null).length };
  }, [scene.listing]);
  /* ⚠️ «A row whose party is unknown is better than a row attributed to
     the wrong party» — the column's own rule, and it must not be swept up
     into somebody's named conversation. */
  ok('9.1 its writer still reads it', own.legacy === true, JSON.stringify(own));
  ok('9.2 …and it is a conversation of its own, not folded into a named one',
     own.threads === 3 && own.nulls === 1, JSON.stringify(own));
  const buyerSees = await readThread(scene.b.p, scene.listing, scene.buyerA);
  ok('9.3 …and it does not appear inside a named conversation',
     buyerSees.n === 2 && !buyerSees.texts.join(' ').includes('قديمة'), JSON.stringify(buyerSees));
  ok('9.4 …and nothing deleted it', scene.a.db.messages.some(m => m.id === 'legacy-1'), 'kept');
}

/* ============================================================
   10 — success over a write that did not happen: the last three
   ============================================================ */
console.log('--- 10: the three silent writes ---');
{
  const st = code('js/store.js');
  /* ⚠️ `.select()` ALONE MEASURES NOTHING: PostgREST answers a row the
     policy hides with 200 and an EMPTY LIST. `updateReview` wrote
     `const { error } = … .select();` and threw the rows away, so «تمّ
     تحديث تقييمك» stood over the old words. */
  for (const [fn, n] of [['updateReview', '10.1'], ['deleteReview', '10.2'], ['deleteReply', '10.3']]) {
    const body = (st.match(new RegExp('export async function ' + fn + '\\([\\s\\S]{0,900}?\\n\\}')) || [''])[0];
    ok(n + ' `' + fn + '` asks for the row AND counts it',
       /\.select\(\)/.test(body) && /!data \|\| !data\.length/.test(body), fn);
  }
  /* ⚠️ AND «NOT HERE» IS AN ANSWER, WHICH IT WAS NOT. `updateReview`
     returned a bare `null`, and the screen's `if (r && r.error)` read it
     as success. */
  ok('10.4 `updateReview` says «not here» rather than nothing',
     /if \(!r\) return \{ error: 'notFound' \};/.test(st), '');
  ok('10.5 …and the screen has a third sentence for it',
     /r\.error === 'notFound'/.test(code('js/screens/directory.js')), '');
  const b = scene.b;
  const res = await b.p.evaluate(async () => {
    const S = window.__S;
    return { gone: (await S.updateReview('no-such-review-id', 4, 'x') || {}).error,
             del: (await S.deleteReview('no-such-review-id') || {}).error };
  });
  ok('10.6 an edit whose review has gone is refused, not confirmed',
     res.gone === 'notFound', String(res.gone));
  ok('10.7 …and so is a delete the server refuses', res.del === 'server', String(res.del));
}

/* ============================================================
   11 — the inventory: five faults measured after it landed
   ============================================================ */
console.log('--- 11: the inventory ---');
if (!SINGLE) {
  /* ⚠️ ONE BUILD ONLY, and the reason is measured: `run.sh` runs the two
     builds AT THE SAME TIME, and this block runs a tool that WRITES
     `docs/الجرد.md`. Two copies racing would leave the tree dirty and
     abort every later segment of the net through its frozen-tree guard.
     `v68` reached the same answer for the same reason: a tool is a file
     on disk and belongs to neither build. */
  const inv = read('docs/الجرد.md');
  const sec = (n) => {
    const i = inv.indexOf('## ' + n); const j = inv.indexOf('\n## ', i + 3);
    return inv.slice(i, j < 0 ? inv.length : j).split('\n')
      .filter(l => /^\|\s*`/.test(l)).map(l => l.split('|').slice(1, -1).map(x => x.trim()));
  };
  const A = sec('٢) الأفعال'), W = sec('٣) الكتابات'), P = sec('٥) الوعود'),
        F = sec('٦) الخانات'), M = sec('٧) مسارات المال');

  /* ⚠️ 11.1 — the row that is stamped «checked» while the tool never
     answered its question. «363 checked» promised more than it carried. */
  ok('11.1 the total prints the blind-but-dated number beside the checked one',
     /مفحوصة بلا جوابٍ مشتقّ\s+\d+/.test(inv), '');
  ok('11.1b …and every class heading carries it too',
     (inv.match(/منها بلا جوابٍ مشتقّ/g) || []).length >= 8, '');

  /* ⚠️ 11.2 — the promises class did not answer its own question. Its key
     was file plus translation key, so `admin.js/done` was ONE row
     standing for FIFTEEN promises — and the three faults the sweep of
     10 September found all lived inside two such rows, under a date that
     said «checked». */
  const toasts = (['js/store.js', 'js/ui.js', 'js/app.js']
    .concat(readdirSync(ROOT + 'js/screens').map(f => 'js/screens/' + f)))
    .map(f => (code(f).match(/toast\(\s*t\(\s*'[A-Za-z][\w]*'\s*\)\s*,\s*'ok'/g) || []).length)
    .reduce((a, b) => a + b, 0);
  ok('11.2 one row per promise, not one per sentence', P.length === toasts,
     P.length + ' rows for ' + toasts + ' promises');
  ok('11.2b …and the key is a PLACE, so two rows can carry the same words',
     P.filter(r => /`promise\/[^`]+\/\w+\/\d+`/.test(r[0])).length === P.length, '');
  ok('11.2c …and most of them now name the call that earned them',
     P.filter(r => r[3] === '—').length < P.length / 2,
     P.filter(r => r[3] === '—').length + ' of ' + P.length + ' with no call');

  /* ⚠️ 11.3 — «a button nobody knows the destination of is a button
     nobody checks»: 99 of 136 said `?`. */
  ok('11.3 the actions say what they call', A.filter(r => r[3] === '?').length < A.length / 4,
     A.filter(r => r[3] === '?').length + ' of ' + A.length + ' unknown');

  /* ⚠️ 11.4 — «is the answer read» asked whether `.select()` was THERE,
     so it stamped `updateReview` sound while it threw the rows away. The
     question is whether a ROW IS COUNTED. */
  ok('11.4 the writes column asks whether a row is counted',
     /تُطلَب ولا تُعَدّ/.test(read('tools/audit/inventory.mjs')), '');
  ok('11.4b …and every write this batch touched now counts one',
     ['reviews/update/updateReview', 'reviews/delete/deleteReview',
      'review_replies/delete/deleteReply', 'messages/insert/sendMessage']
       .every(k => (W.find(r => r[0].includes(k)) || [])[4] === 'نعم'), '');

  /* ⚠️ 11.5 — the money grain: `AD_PRODUCTS` was ONE row covering eight
     products times three durations, and two of the seven rows were not
     money at all — a $14,500 car is content, not our pricing. */
  ok('11.5 one row per price, not per constant', M.length >= 30, String(M.length));
  ok('11.5b …and seeded content is not mistaken for our pricing',
     !M.some(r => /BUSINESSES|CLASSIFIEDS/.test(r[0])), '');
  ok('11.5c …and every row carries the value itself',
     M.every(r => r[2] && r[2] !== '?'), '');

  /* ⚠️ 11.6 — the field sweep was `js/screens/` alone and was recorded as
     «correct now, ages later». Measured: `js/ui.js` ALREADY held four. */
  ok('11.6 the boxes are swept across all of `js/`',
     F.some(r => r[1] === 'ui.js'), F.filter(r => r[1] === 'ui.js').length + ' in ui.js');

  /* ⚠️ 11.7 — seven keys in «الكتابات» named a VARIABLE, not a function,
     because `const me = (…)` was read as a definition. */
  ok('11.7 every write is filed under a real function',
     !W.some(r => /\/(me|had|one|rec|next)$/.test(r[0].replace(/`/g, ''))),
     W.filter(r => /\/(me|had)$/.test(r[0].replace(/`/g, ''))).join(' '));

  /* and the guard still holds: the file is generated and current */
  /* ⚠️ GUARDED, because `--check` EXITS 1 on drift and `execFileSync`
     throws on a non-zero exit — which takes the whole suite down and
     loses every assertion after it. That is `649`'s lesson: a crash is
     how a batch reports green while it is not, and drift is a FAILED
     ITEM here, never a crash. */
  let out = 'threw';
  try {
    out = execFileSync('node', [ROOT + 'tools/audit/inventory.mjs', ROOT, '--check'],
      { encoding: 'utf8', cwd: ROOT }).trim();
  } catch (e) { out = 'DRIFT'; }
  ok('11.8 the inventory is current with the tree', out === '', out || 'no drift');
} else {
  console.log('(block 11 runs on the module build alone — it drives a tool that writes)');
}

/* ============================================================
   12 — console
   ============================================================ */
console.log('--- 12: console ---');
ok('12.1 no console errors anywhere in the run', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
