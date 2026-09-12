/* ============================================================
   test_v87 — 655: the messages, the reviews, the reports and the claims
   ------------------------------------------------------------
   ⚠️ FOUR DEAD TABLES, AND ONE PATTERN APPLIED TO THEM FOUR TIMES. Measured
   on `main` before this batch: `messages`, `reviews`, `review_replies`,
   `claims` and `flags` had their columns and their policies standing ready
   since `0001`, and `from('<table>')` appeared in the whole of `js/` ZERO
   times for every one of them.

   ⚠️ AND THE HEAVIEST IS NOT THE BIGGEST. The message stayed on the
   sender's phone; THE REPORT STAYED ON THE REPORTER'S. Whoever pressed
   «report» was satisfied that somebody would read it, and nobody read it —
   and a message is sent again when no answer comes while a report is not.

   Ten blocks: the wires · a message reaches the other party · reviews ·
   reports · claims · the suggested masjid · notification preferences ·
   the notification's addressee · the id class · console.
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
/* ⚠️ comments stripped before any «does the code do X» check — the rule this
   project has paid for four times, and this batch's own code NAMES
   `from: 'me'`, `mintId('u')` and `pending` inside comments explaining
   exactly why none of them is used. A check that reads the prose about the
   code reports the fault it exists to prevent. */
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
/* ⚠️ `arabna/js/store.js` FIRST: on the single-file build the modules sit
   behind an importmap, so a relative import fetches the file again and
   hands back a SECOND instance with its own state. */
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

const LIST = (over = {}) => Object.assign({
  cat: 'furniture', title: { ar: 'كنبة', en: 'Sofa' },
  desc: { ar: 'بحالة جيّدة', en: 'Good condition' },
  price: '⁦$650⁩', city: 'Houston', photos: [],
}, over);

/* ============================================================
   1 — the four wires exist at all
   ============================================================ */
console.log('--- 1: the wires ---');
{
  const st = code('js/store.js');
  for (const [t, n] of [['messages', '1.1'], ['reviews', '1.2'], ['flags', '1.3'], ['claims', '1.4']]) {
    ok(n + ' `' + t + '` is written from the app — it was never touched',
       new RegExp("sb\\.from\\('" + t + "'\\)\\s*\\n?\\s*\\.insert\\(").test(st)
       || new RegExp("from\\('" + t + "'\\)[\\s\\S]{0,160}\\.insert\\(").test(st), 'insert');
  }
  ok('1.5 `review_replies` too', /from\('review_replies'\)[\s\S]{0,160}\.insert\(/.test(st), 'insert');
  /* ⚠️ EVERY LIVE READER COMES FROM THE FACTORY. `648` built it and its
     own rule stands and hardens here: a live reader written by hand
     outside `makeLiveReader` turns this red whatever batch it belongs to. */
  const readers = [...st.matchAll(/makeLiveReader\('([a-z_]+)'/g)].map(m => m[1]);
  /* ⚠️ REVERSED IN `660` AND AGAIN IN `665أ`, AND THE NUMBER MOVES WITH A
     DECISION RATHER THAN BEING DERIVED. `660` gave `biz_photos` a reader
     and `665أ` gives `greetings` and `settings` theirs — each of the three
     a table that had stood since `0001` with nothing reading it — so the
     count is TWELVE. It stays a literal for the reason `v16`'s category
     count does: a count read off the thing it guards compares the file
     with itself and guards nothing, and a reader added with no decision
     behind it has to redden. */
  ok('1.6 twelve live readers, all from the one factory', readers.length === 12, readers.join(' '));
  for (const t of ['messages', 'reviews', 'review_replies', 'flags', 'claims', 'notifications', 'biz_photos']) {
    ok('1.6.' + t + ' …including `' + t + '`', readers.includes(t), '');
  }
  /* ⚠️ `630`'S LESSON: the policy decides who sees what, and a filter in
     the client blinds the queue it is meant to fill. The factory reads
     `sb.from(table)` with a VARIABLE, so this asks every chain there is. */
  const chains = [...st.matchAll(/sb\.from\([^)]*\)[\s\S]{0,220}/g)].map(m => m[0]);
  const filtered = chains.filter(c => /\.eq\('status'/.test(c));
  ok('1.7 no reader filters by status in the client', filtered.length === 0,
     filtered.length ? filtered[0].slice(0, 70) : 'none');
  /* ⚠️ no update and no delete on messages, for anyone — «a message that
     can be edited after it is read is not a record, and a report rests on
     it», the schema's own words, and the policies carry neither. */
  ok('1.8 nothing updates or deletes a message',
     !/from\('messages'\)[\s\S]{0,160}\.(update|delete)\(/.test(st), 'no update, no delete');
  ok('1.9 …and the policies carry neither either',
     !/on public\.messages for (update|delete)/.test(sqlCode()), 'none in 0002/0013');
}

/* ============================================================
   2 — a message reaches the OTHER PARTY, and «mine» is not a stored field
   ============================================================ */
console.log('--- 2: a message really leaves the device ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p);
  const seller = await member(a.p, 'seller@arabna.test');
  const listing = await a.p.evaluate(async ([l]) => {
    const r = await window.__S.addClassified(l);
    return r && r.id;
  }, [LIST()]);
  ok('2.1 the seller published a listing', !!listing, String(listing));

  /* a SECOND browser: one server, two devices — the shape of the fault */
  const b = await fresh({ preConfirm: true, db: a.db });
  await open(b.p);
  const buyer = await member(b.p, 'buyer@arabna.test');
  const sent = await b.p.evaluate(async ([id]) =>
    window.__S.sendMessage(id, 'مرحباً، هل ما زالت متوفّرة؟', 'ar'), [listing]);
  ok('2.2 the buyer sent one, and the server took it', !!(sent && sent.msg && !sent.error),
     sent && sent.error ? sent.error : (sent && sent.msg && sent.msg.id));
  ok('2.3 …and its id is the ROW\'s, not one minted on the device',
     !!(sent && sent.msg && a.db.messages[0] && sent.msg.id === a.db.messages[0].id),
     sent && sent.msg && String(sent.msg.id));
  ok('2.4 the row carries `sender_id` and no `from` at all',
     a.db.messages.length === 1 && a.db.messages[0].sender_id === buyer
     && a.db.messages[0].from === undefined,
     JSON.stringify({ sender: a.db.messages[0] && a.db.messages[0].sender_id === buyer,
                      from: a.db.messages[0] && a.db.messages[0].from }));

  /* THE ORIGINAL FAULT, IN ONE LINE: the seller reads it from their own
     device, which before this batch was impossible */
  await open(a.p, '#/messages/' + listing);
  const seen = await a.p.evaluate(async ([id]) => {
    const S = window.__S;
    await S.loadLiveMessages();
    const list = S.messagesFor(id);
    return { n: list.length, text: list[0] && list[0].text, mine: list[0] && list[0].mine };
  }, [listing]);
  ok('2.5 THE SELLER READS IT — the fault this item exists for', seen.n === 1, JSON.stringify(seen));
  ok('2.6 …and it is not marked as the seller\'s own', seen.mine === false, String(seen.mine));
  const back = await b.p.evaluate(async ([id]) => {
    const S = window.__S;
    await S.loadLiveMessages();
    const list = S.messagesFor(id);
    return list[0] && list[0].mine;
  }, [listing]);
  ok('2.7 …and to its SENDER the same row is «mine» — computed, never stored',
     back === true, String(back));

  /* ⚠️ A THIRD PARTY WITH NOTHING TO DO WITH THE LISTING READS NOTHING —
     the policy's own teeth, and not this app's. */
  const c = await fresh({ preConfirm: true, db: a.db });
  await open(c.p);
  await member(c.p, 'stranger@arabna.test');
  const none = await c.p.evaluate(async () => {
    const S = window.__S;
    await S.loadLiveMessages();
    return S.messageThreads().length;
  });
  ok('2.8 a stranger reads no message of theirs', none === 0, String(none));
  ok('2.9 the buyer\'s own count is right on the owner\'s side too',
     await a.p.evaluate(([id]) => window.__S.buyerMessageCount(id), [listing]) === 1, '1');

  /* ⚠️ THE SECOND FACE OF THE FAULT, and a tooth found that nothing was
     measuring it: the SENDER reading their own message from a SECOND
     device of their own account. There is no local copy there, so a `mine`
     read off a stored field answers `false` and the sender meets their own
     words as somebody else's. Only a value computed from `sender_id` gets
     this right. */
  const d = await fresh({ preConfirm: true, db: a.db });
  await open(d.p);
  const second = await d.p.evaluate(async ([em, id]) => {
    const S = window.__S;
    await S.signInWithPassword(em, 'Qx7#mVzt2026');
    await S.loadLiveMessages();
    const list = S.messagesFor(id);
    return { n: list.length, mine: list[0] && list[0].mine, local: (S.state.messages || []).length };
  }, ['buyer@arabna.test', listing]);
  ok('2.10 the SENDER reads it from a second device of their own account',
     second.n === 1, JSON.stringify(second));
  ok('2.11 …and it is «mine» there too, with no local copy to say so',
     second.mine === true && second.local === 0, JSON.stringify(second));
  await a.ctx.close(); await b.ctx.close(); await c.ctx.close(); await d.ctx.close();
}

/* ============================================================
   3 — a review is read by somebody who is not its author
   ============================================================ */
console.log('--- 3: reviews ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/directory/b30');
  const author = await member(a.p, 'rev1@arabna.test');
  const wrote = await a.p.evaluate(async () => window.__S.addReview('b30', 5, 'مكانٌ ممتاز'));
  ok('3.1 a review on a SEED business is written at all — 514 of 514 carry a text id',
     !!(wrote && !wrote.error), wrote && wrote.error ? wrote.error : 'written');
  ok('3.2 …and the row is on the server', a.db.reviews.length === 1 && a.db.reviews[0].author_id === author,
     String(a.db.reviews.length));

  const b = await fresh({ preConfirm: true, db: a.db });
  await open(b.p, '#/directory/b30');
  await member(b.p, 'rev2@arabna.test');
  const other = await b.p.evaluate(async () => {
    const S = window.__S;
    await S.loadLiveReviews();
    const list = S.reviewsFor('b30');
    const one = list.find(r => (r.text && (r.text.ar === 'مكانٌ ممتاز')));
    return { found: !!one, mine: one && one.mine };
  });
  ok('3.3 SOMEBODY ELSE READS IT — the fault this item exists for', other.found === true, JSON.stringify(other));
  ok('3.4 …and it is not theirs', other.mine === false, String(other.mine));

  /* a second review of the same business is an EDIT, which the unique
     column in the schema now keeps instead of the device */
  const again = await a.p.evaluate(async () => {
    const S = window.__S;
    await S.loadLiveReviews();
    const r = await S.addReview('b30', 3, 'عدّلتُ رأيي');
    return { err: r && r.error, rows: 0 };
  });
  ok('3.5 a second review is an update, never a second row',
     !again.err && a.db.reviews.length === 1, String(a.db.reviews.length));

  /* ⚠️ THE FTC LINE, AND THE SCREEN DOES NOT GUARD IT TWICE. The database
     refuses a business owner reviewing their own business, and this app's
     duty is to say the reason. */
  const own = await b.p.evaluate(async () => {
    const S = window.__S;
    const biz = await S.addBusiness({
      name: { ar: 'محلّي', en: 'My Shop' }, cat: 'restaurants', phone: '(713) 555-0111',
      address: '1 Main St, Houston, TX 77002', desc: { ar: '', en: '' },
      hours: null, tags: [], attributes: [],
    });
    if (!biz) return { no: 'no biz' };
    return await S.addReview(biz.id, 5, 'محلّي رائع');
  });
  ok('3.6 the OWNER cannot review their own business — the server refuses',
     !!(own && own.error), JSON.stringify(own));
  ok('3.7 …and the screen is handed a reason it can print',
     own && own.error === 'ownBusiness', own && own.error);
  ok('3.8 …and the app does not guard it a second time',
     !/owner_id[\s\S]{0,80}addReview|addReview[\s\S]{0,300}myBusinessIds/.test(code('js/store.js')),
     'one guard, in the database');
  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   4 — the report reaches the panel, and is resolved rather than erased
   ============================================================ */
console.log('--- 4: reports ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/directory/b30');
  const reporter = await member(a.p, 'flag1@arabna.test');
  const made = await a.p.evaluate(async () =>
    window.__S.reportItem('b30', 'business', { ar: 'عبد الله', en: "Abdallah's" }));
  ok('4.1 a report on a SEED business is written at all', made === true, String(made));
  ok('4.2 …and its `kind` names the THING, never «report»',
     a.db.flags.length === 1 && a.db.flags[0].kind === 'business',
     a.db.flags[0] && a.db.flags[0].kind);
  ok('4.3 …and it carries its reporter', a.db.flags[0] && a.db.flags[0].reporter_id === reporter, 'reporter_id');

  /* THE FAULT: the admin, on ANOTHER device, sees it */
  const b = await fresh({ preConfirm: true, db: a.db });
  await open(b.p);
  await unlockAdmin(b.p);
  const inQueue = await b.p.evaluate(async () => {
    const S = window.__S;
    await S.loadLiveFlags();
    const f = S.flags();
    return { n: f.length, kind: f[0] && f[0].kind, ref: f[0] && f[0].refId };
  });
  ok('4.4 THE ADMIN SEES IT FROM A SECOND DEVICE — the heaviest item in the batch',
     inQueue.n === 1 && inQueue.ref === 'b30', JSON.stringify(inQueue));

  /* a stranger reads nobody's report — «a list of open reports readable by
     everyone tells whoever was reported who reported them», by `0002` */
  const c = await fresh({ preConfirm: true, db: a.db });
  await open(c.p);
  await member(c.p, 'nosy@arabna.test');
  const nosy = await c.p.evaluate(async () => {
    const S = window.__S; await S.loadLiveFlags(); return S.flags().length;
  });
  ok('4.5 a stranger reads no report', nosy === 0, String(nosy));

  /* ⚠️ the stand-in holds ONE session for the whole shared server, and the
     stranger above signed in last — so staff signs back in before acting.
     Two contexts are two devices, not two servers. */
  const resolved = await b.p.evaluate(async ([id]) => {
    const S = window.__S;
    await S.signInWithPassword('staff@arabna.test', 'Staff#Panel2026x');
    const r = await S.resolveFlag(id);
    await S.loadLiveFlags();
    return { r, open: S.flags().length, all: S.allFlags().length };
  }, [a.db.flags[0].id]);
  ok('4.6 resolving takes it out of the queue',
     resolved.r === true && resolved.open === 0, JSON.stringify(resolved));
  ok('4.7 …AND DOES NOT ERASE THE ROW — `flags` carries no delete policy',
     a.db.flags.length === 1 && a.db.flags[0].status === 'resolved',
     JSON.stringify({ rows: a.db.flags.length, status: a.db.flags[0].status }));
  ok('4.8 …and nothing in the app deletes a report',
     !/from\('flags'\)[\s\S]{0,160}\.delete\(/.test(code('js/store.js')), 'no delete');
  await a.ctx.close(); await b.ctx.close(); await c.ctx.close();
}

/* ============================================================
   5 — a claim reaches the admin, and approving it writes `owner_id` ALONE
   ============================================================ */
console.log('--- 5: claims ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/directory/b30');
  const claimer = await member(a.p, 'claim1@arabna.test');
  const req = await a.p.evaluate(async () =>
    window.__S.requestClaim('b30', { name: 'صاحبُ المحلّ', phone: '(713) 555-0130', role: 'owner', proof: 'رخصةٌ تجاريّة' }));
  ok('5.1 a claim on a SEED business is written at all', !!(req && !req.error),
     req && req.error ? req.error : 'written');
  ok('5.2 …and the row carries its claimant',
     a.db.claims.length === 1 && a.db.claims[0].claimer_id === claimer, 'claimer_id');

  const b = await fresh({ preConfirm: true, db: a.db });
  await open(b.p);
  await unlockAdmin(b.p);
  const queued = await b.p.evaluate(async () => {
    const S = window.__S; await S.loadLiveClaims(); return S.pendingClaims().length;
  });
  ok('5.3 THE ADMIN SEES IT FROM A SECOND DEVICE', queued === 1, String(queued));

  const done = await b.p.evaluate(async ([id]) => {
    const S = window.__S;
    const r = await S.approveClaim(id);
    await S.loadLiveClaims(); await S.loadLiveBusinesses();
    return r;
  }, [a.db.claims[0].id]);
  ok('5.4 the approval took', done === true, String(done));
  ok('5.5 …and the claim is approved on the server', a.db.claims[0].status === 'approved',
     a.db.claims[0].status);
  const coat = a.db.businesses.find(r => r.seed_id === 'b30');
  ok('5.6 …and `owner_id` is written on the business', !!(coat && coat.owner_id === claimer),
     coat ? String(coat.owner_id === claimer) : 'no coat row');
  /* ⚠️ AND NOTHING ELSE. It was written as `claimed: true` until `655`
     measured that there is NO COLUMN OF THAT NAME, so the write went
     nowhere with no error at all — «owned» is DERIVED from `owner_id`. */
  ok('5.7 …and `claimed` is NOT written, because there is no such column',
     !!coat && coat.claimed === undefined, coat ? String(coat.claimed) : '-');
  ok('5.8 …and the schema has no column of that name',
     !/^\s*claimed\s+/m.test(sqlCode()), 'no `claimed` column');
  ok('5.9 …and the app does not try to write one',
     !/applyBusinessEdit\([^)]*\{\s*claimed:/.test(code('js/store.js')), 'ownerId only');
  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   6 — the masjid a stranger suggests reaches the admin, and owns nobody
   ============================================================ */
console.log('--- 6: the suggested masjid ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/prayer');
  const sender = await member(a.p, 'sugg@arabna.test');
  const rec = await a.p.evaluate(async () => window.__S.suggestWorship({
    name: 'مسجدُ النور', address: '900 Bissonnet St, Houston, TX 77005', phone: '', kind: 'mosque' }));
  ok('6.1 the suggestion is written at all — it landed on the sender\'s phone',
     !!(rec && rec.id), rec ? String(rec.id) : 'null');
  const row = a.db.businesses.find(r => r.name_ar === 'مسجدُ النور');
  ok('6.2 …and there is a row', !!row, row ? 'row' : 'none');
  /* ⚠️ `pendingReview`, NEVER `pending` — half the repair and not a naming
     choice: the public list filters `status !== 'pendingReview'` and the
     admin queue filters `status === 'pendingReview'`, so a row marked
     `pending` is PUBLISHED TO EVERYBODY with no review and appears in no
     queue for anyone to stop. */
  ok('6.3 it is HELD at `pendingReview`, not `pending`', row && row.status === 'pendingReview',
     row && row.status);
  ok('6.4 …and `source` says where it came from', row && row.source === 'suggested', row && row.source);
  ok('6.5 …and it makes NOBODY the owner of somebody else\'s masjid',
     row && row.owner_id == null, row ? String(row.owner_id) : '-');
  ok('6.6 …and its kind survives the round trip',
     !!(row && row.worship && row.worship.kind === 'mosque'),
     row && row.worship ? JSON.stringify(row.worship) : '-');
  ok('6.7 …and it carries no service times of any kind',
     !!(row && (!row.worship || (!row.worship.jumuah && !row.worship.prayers))), 'none');

  const pub = await a.p.evaluate(async () => {
    const S = window.__S; await S.loadLiveBusinesses();
    return { mine: (S.state.myBusinessIds || []).length };
  });
  ok('6.9 the sender owns nothing by it', pub.mine === 0, String(pub.mine));

  /* ⚠️ A THIRD ACCOUNT — a plain reader who did not suggest it — must not
     meet it in the directory at all. Asking the SENDER would measure the
     wrong thing: their own pending record is visible to them, exactly as a
     pending marketplace listing is. */
  const c = await fresh({ preConfirm: true, db: a.db });
  await open(c.p, '#/directory');
  await member(c.p, 'reader@arabna.test');
  const pubOther = await c.p.evaluate(async () => {
    const S = window.__S; await S.loadLiveBusinesses();
    return S.allBusinesses().filter(b => b.name && b.name.ar === 'مسجدُ النور').length;
  });
  ok('6.8 A SUGGESTED MASJID IS NOT IN THE PUBLIC DIRECTORY before it is approved',
     pubOther === 0, String(pubOther));

  const b = await fresh({ preConfirm: true, db: a.db });
  await open(b.p);
  await unlockAdmin(b.p);
  const q = await b.p.evaluate(async () => {
    const S = window.__S; await S.loadLiveBusinesses();
    return S.pendingBusinesses().filter(x => x.name && x.name.ar === 'مسجدُ النور').length;
  });
  ok('6.10 THE ADMIN SEES IT FROM A SECOND DEVICE — the fault the appendix exists for',
     q === 1, String(q));
  /* structural: no device-minted id, and the thanks is not said on a failure */
  ok('6.11 `suggestWorship` mints no id of its own',
     !/mintId\('u'\)/.test(code('js/store.js')), 'server id');
  ok('6.12 …and it is async and goes through `addBusiness`',
     /export async function suggestWorship[\s\S]{0,900}return addBusiness\(/.test(code('js/store.js')),
     'through addBusiness');
  const mass = code('js/screens/mass.js');
  ok('6.13 …and a failed write does not say «thank you»',
     /await S\.suggestWorship\([\s\S]{0,200}if \(!rec\)/.test(mass), 'guarded');
  await a.ctx.close(); await b.ctx.close(); await c.ctx.close();
}

/* ============================================================
   7 — the notification preferences belong to the account
   ============================================================ */
console.log('--- 7: notif_prefs ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p, '#/settings');
  const uid = await member(a.p, 'prefs@arabna.test');
  const set = await a.p.evaluate(async () => window.__S.setNotifPref('messages', false));
  ok('7.1 a preference is written to the profile row', set === true, String(set));
  const pr = a.db.profiles.get(uid);
  ok('7.2 …and the column really holds it',
     !!(pr && pr.notif_prefs && pr.notif_prefs.messages === false),
     pr && pr.notif_prefs ? JSON.stringify(pr.notif_prefs) : 'none');

  /* a second device of the SAME account reads it back — the fault: whoever
     turned message alerts off on their phone found them burning on their
     laptop */
  const b = await fresh({ preConfirm: true, db: a.db });
  await open(b.p);
  const readBack = await b.p.evaluate(async ([em]) => {
    const S = window.__S;
    await S.signInWithPassword(em, 'Qx7#mVzt2026');
    return S.state.notifPrefs.messages;
  }, ['prefs@arabna.test']);
  ok('7.3 A SECOND DEVICE READS IT BACK', readBack === false, String(readBack));
  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   8 — the notification has an addressee
   ============================================================ */
console.log('--- 8: the notification reaches the person it names ---');
{
  const a = await fresh({ preConfirm: true });
  await open(a.p);
  const owner = await member(a.p, 'poster@arabna.test');
  const listing = await a.p.evaluate(async ([l]) =>
    (await window.__S.addClassified(l) || {}).id, [LIST()]);

  const b = await fresh({ preConfirm: true, db: a.db });
  await open(b.p);
  await unlockAdmin(b.p);
  const acted = await b.p.evaluate(async ([id]) => {
    const S = window.__S;
    await S.loadLiveClassifieds();
    const r = await S.rejectClassified(id, 'صورةٌ غير واضحة');
    return { r, mine: S.notifications().length };
  }, [listing]);
  ok('8.1 the admin\'s refusal took', acted.r === true, String(acted.r));
  ok('8.2 …and a row was written FOR THE POSTER',
     a.db.notifications.length === 1 && a.db.notifications[0].user_id === owner,
     JSON.stringify({ n: a.db.notifications.length,
                      to: a.db.notifications[0] && a.db.notifications[0].user_id === owner }));

  /* ⚠️ the stand-in holds ONE session for the whole shared server, so the
     poster signs back in before reading — the two contexts are two
     devices, not two servers */
  const got = await a.p.evaluate(async ([em]) => {
    const S = window.__S;
    await S.signInWithPassword(em, 'Qx7#mVzt2026');
    await S.loadLiveNotifs();
    return S.notifications().filter(n => /غير واضحة/.test((n.body && n.body.ar) || '')).length;
  }, ['poster@arabna.test']);
  ok('8.3 THE POSTER READS IT ON THEIR OWN DEVICE — the fault this item exists for',
     got === 1, String(got));

  /* ⚠️ AND ITS HEAVIEST FORM DECEIVED THE ADMIN: the notification used to
     land in HIS list, so he believed a warning had been given and
     escalated against somebody who was told nothing. */
  const adminSees = await b.p.evaluate(async () => {
    const S = window.__S;
    await S.signInWithPassword('staff@arabna.test', 'Staff#Panel2026x');
    await S.loadLiveNotifs();
    return S.notifications().filter(n => /غير واضحة/.test((n.body && n.body.ar) || '')).length;
  });
  ok('8.4 …and it does NOT land in the admin\'s own list', adminSees === 0, String(adminSees));

  /* ⚠️ AND WHERE IT CANNOT BE DELIVERED THE SENTENCE CHANGES: an ad order
     has no table at all, so there is no account to address — and the panel
     says «rejected», never «rejected, and the buyer was told». */
  const packs = read('js/i18n.js');
  ok('8.5 the undeliverable one says only what is true',
     /adRejected: 'تم رفض الطلب'/.test(packs) && /adRejected: 'Order rejected'/.test(packs),
     'adRejected');
  ok('8.6 …and the panel uses it', /toast\(t\('adRejected'\)/.test(code('js/screens/admin.js')), 'used');
  ok('8.7 …and nothing raises a self-addressed notification for an ad any more',
     !/adLiveTitle|adNoTitle/.test(code('js/store.js')), 'gone');
  /* insert is the admin's alone — a table anybody may write into anybody's
     list is a spam channel with a policy on it */
  ok('8.8 INSERT on `notifications` is the admin\'s alone',
     /create policy "admin: insert" on public\.notifications for insert\s*\n?\s*with check \(public\.is_admin\(\)\)/.test(sqlCode()),
     'admin only');
  await a.ctx.close(); await b.ctx.close();
}

/* ============================================================
   9 — an id column holds the ids the app really passes
   ============================================================ */
console.log('--- 9: the id class ---');
{
  const sql = sqlCode();
  /* ⚠️ THE CLASS, SWEPT AND NOT MET ONE INSTANCE AT A TIME. The spec caught
     `flags.ref_id` and there were three of it: `reviews.biz_id` and
     `claims.biz_id` are `uuid` against `b1` … `b515`, which is what all 514
     directory businesses carry, so a review or a claim on any one of them
     could not be written at all — the type is wrong AND the foreign key has
     nothing to point at. */
  for (const [col, n] of [['flags   alter column ref_id', '9.1'],
                          ['reviews alter column biz_id', '9.2'],
                          ['claims  alter column biz_id', '9.3']]) {
    const re = new RegExp('alter table public\\.' + col.replace(/\s+/g, '\\s+') + ' type text');
    ok(n + ' `' + col.split(' ')[0].trim() + '` takes the id the app has', re.test(sql), 'text');
  }
  /* ⚠️ AND THE POLICIES THAT COMPARED THAT COLUMN WERE REWRITTEN, or they
     raise on every evaluation — and the rewrite closes a hole the old shape
     had: a seed is reached by `seed_id`, so `b.id = biz_id` found no row for
     `b30`, and `auth.uid() is distinct from NULL` is TRUE. */
  ok('9.4 the FTC guard reaches a SEED business by its `seed_id` too',
     /is distinct from \(\s*select b\.owner_id[\s\S]{0,160}b\.seed_id = biz_id/.test(sql),
     'seed_id in the check');
  ok('9.5 …and so does the reply policy',
     /join public\.reviews r on \(b\.id::text = r\.biz_id or b\.seed_id = r\.biz_id\)/.test(sql),
     'joined both ways');
  /* ⚠️ AND `messages.listing_id` IS DELIBERATELY LEFT `uuid`. The sweep is
     not «convert every id column», it is «a column that holds an id the app
     really passes for REAL records» — every seed classified is demo data,
     deleted before launch, while 514 of 514 real businesses carry a text
     id. The foreign key is meaningful there and is kept. */
  ok('9.6 `messages.listing_id` keeps its uuid and its key',
     /listing_id\s+uuid not null references public\.classifieds\(id\)/.test(sql)
     && !/alter table public\.messages\s+alter column listing_id/.test(sql), 'kept');
  /* the reason a bilingual value is jsonb everywhere else in this schema */
  ok('9.7 the report\'s reason is jsonb, as every other two-language value is',
     /alter table public\.flags\s+alter column reason type jsonb/.test(sql), 'jsonb');
  /* the new table carries `updated_at` AND the trigger `0009` defined */
  ok('9.8 `notifications` carries the `updated_at` trigger `0009` wrote',
     /create trigger set_updated_at before update on public\.notifications/.test(sql), 'trigger');
  /* the migration is pasteable by hand: no `||`, no `*` */
  const mine = readFileSync(MIG + '0013_655_live_rows.sql', 'utf8').replace(/--[^\n]*/g, '');
  ok('9.9 the migration carries no `||` and no `*`',
     !/\|\||\*/.test(mine), 'clean');

  /* ⚠️ THE ORDER, AND IT IS THE ONE ASSERTION HERE THAT A REAL POSTGRESQL
     EARNED RATHER THAN A READING. PostgreSQL refuses to alter the type of a
     column a policy depends on — «cannot alter type of a column used in a
     policy definition» — and TWO policies reach `reviews.biz_id`: its own
     «own: insert», and `review_replies`'s «biz owner: insert», which reaches
     it through the join and depends on it exactly as if it were its own. So
     they have to come DOWN before the column moves. Measured: with them
     standing the whole file aborts, and `652`'s runner wraps it in one
     transaction, so nothing is half-applied and the batch that declared
     itself finished lands a server half that never ran. */
  const cut = mine.search(/alter table public\.reviews\s+alter column biz_id type text/);
  ok('9.10 the policies come down BEFORE the column moves, or the file aborts',
     cut > 0
     && mine.search(/drop policy if exists "own: insert" on public\.reviews/) < cut
     && mine.search(/drop policy if exists "biz owner: insert" on public\.review_replies/) < cut,
     'dropped first');

  /* ⚠️ THE OWNER'S DECISION OF 9 SEPTEMBER: «القرار قائم — on delete cascade
     يبقى». The text column stands and the BEHAVIOUR the foreign key carried
     comes back — a business deleted for good takes its reviews and its
     claims with it, or it leaves rows pointing at nothing and a claim still
     saying somebody owns a business that does not exist. */
  const casc = readFileSync(MIG + '0014_biz_cascade.sql', 'utf8').replace(/--[^\n]*/g, '');
  ok('9.11 the cascade is restored as a `before delete` trigger on businesses',
     /create trigger cascade_business_delete\s+before delete on public\.businesses/.test(casc),
     'before delete');
  /* ⚠️ AND IT REACHES A SEED THROUGH `seed_id`, WHICH THE OLD KEY NEVER
     COULD: the key compared `businesses.id`, and a coat row for a seed
     carries its own uuid there and `b30` in `seed_id`. */
  for (const [t, n] of [['reviews', '9.12'], ['claims', '9.13']]) {
    const re = new RegExp('delete from public\\.' + t +
      '[\\s\\S]{0,120}old\\.id::text[\\s\\S]{0,120}biz_id = old\\.seed_id');
    ok(n + ' …and it reaches `' + t + '` by the live id AND by the seed id', re.test(casc), 'both');
  }
  /* ⚠️ `security definer` with a pinned `search_path`. Measured on a real
     PostgreSQL 16 on two identical databases, with the delete policy
     `businesses` does not carry today added to both and an admin deleting:
        security definer  claims 3 -> 2      caller's rights  claims 3 -> 3
     `claims` has a read, an insert and an update policy and NO DELETE
     POLICY AT ALL, so under the caller's rights the claim survives with
     nothing raised — the swallowed failure, looking exactly like a cascade
     that works. */
  ok('9.14 …as `security definer`, with `search_path` pinned',
     /create or replace function public\.cascade_business_delete\(\)[\s\S]{0,200}security definer[\s\S]{0,60}set search_path = public/.test(casc),
     'definer + pinned');
  /* ⚠️ `review_replies` NEEDS NOTHING: its own key is `review_id uuid
     references public.reviews(id) on delete cascade`, untouched by `0013`
     because a review's id is a uuid the server minted. Deleting the reviews
     takes the replies by the key that is still there — asserted, never
     assumed. */
  ok('9.15 `review_replies` keeps the key that carries it, and is not touched',
     /review_id\s+uuid not null unique references public\.reviews\(id\) on delete cascade/.test(sql)
     && !/alter table public\.review_replies\s+alter column review_id/.test(sql), 'kept');
  /* ⚠️ AND `flags` IS DELIBERATELY OUT OF IT. It never had a key to lose —
     `ref_id` points at four tables by `kind` — and the decision is that the
     cascade STAYS, not that a new one is invented. */
  ok('9.16 `flags` is not swept into it',
     !/delete from public\.flags/.test(casc), 'left alone');
  ok('9.17 the cascade migration carries no `||` and no `*` either',
     !/\|\||\*/.test(casc), 'clean');
}

/* ============================================================
   10 — every screen that calls a writer waits for its answer
   ============================================================ */
console.log('--- 10: nothing is claimed before the server answers ---');
{
  /* ⚠️ `650` built this sweep and its rule stands: a batch that makes a
     function async owns every caller of it, not the three it was thinking
     about. These are the ones `655` made async. */
  const NEW_ASYNC = ['sendMessage', 'addReview', 'updateReview', 'deleteReview',
                     'replyToReview', 'deleteReply', 'reportItem', 'addFlag',
                     'resolveFlag', 'requestClaim', 'rejectClaim', 'suggestWorship',
                     'adminDeleteListing', 'adminNotify', 'setNotifPref',
                     'updateClassified'];
  const st = code('js/store.js');
  const notAsync = NEW_ASYNC.filter(f => !new RegExp('export async function ' + f + '\\b').test(st));
  ok('10.1 every one of them really is async', notAsync.length === 0, notAsync.join(', ') || String(NEW_ASYNC.length));

  const loose = [];
  for (const f of readdirSync(ROOT + 'js/screens').map(n => 'js/screens/' + n)) {
    code(f).split('\n').forEach((line, i) => {
      for (const w of NEW_ASYNC) {
        if (!new RegExp('S\\.' + w + '\\s*\\(').test(line)) continue;
        const awaited = /await\s+S\./.test(line) || /\)\s*\.then\(/.test(line) || /return\s+S\./.test(line);
        if (!awaited) loose.push(f + ':' + (i + 1) + ' ' + w);
      }
    });
  }
  ok('10.2 …and every screen that calls one waits for its answer',
     loose.length === 0, loose.join(' | ') || 'none loose');
}

console.log('--- console ---');
ok('11.1 zero console errors across the batch', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
