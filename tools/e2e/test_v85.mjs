/* ============================================================
   test_v85 — 650: the business reaches the server
   ------------------------------------------------------------
   ⚠️ THE FAULT THIS MEASURES, IN ONE SENTENCE. Whoever opened ARABNA and
   added their masjid or their restaurant SAW THEIR OWN ADDITION AND NOBODY
   ELSE IN THE WORLD DID, and it never reached the moderation queue either.
   No error message and no review queue — everything appeared to succeed and
   everything was lost. Measured before the batch: `businesses` was read
   once at boot and written NOWHERE, in the whole of `js/`.

   ⚠️ AND THE FAULT WAS TWO-SIDED. Even a row that HAD reached the table was
   invisible: `everyBusiness()` walked what THIS DEVICE knows — the
   `data.js` seeds and its own additions — so a live row added on another
   phone matched nothing in the list and was never read, not once.

   Nine blocks: the wire · a second device · the queue · the approval and
   the refusal · the seed's coat · the deletion mark · the phone on both
   doors · the three-step point · structure and console.
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
   project has paid for four times, and this batch's own code NAMES `videos`
   and `mintId('ub')` in comments explaining why neither is used. */
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

/** one business payload, the shape the add form builds */
const BZ = (over = {}) => Object.assign({
  name: { ar: 'مطعمُ التجربة', en: 'Test Kitchen' },
  cat: 'restaurants',
  phone: '(713) 555-0142',
  address: '1200 Hillcroft Ave, Houston, TX 77036',
  mobileService: false,
  zip: '',
  hours: null,
  tags: ['شاورما', 'shawarma'],
  attributes: ['arabicSpoken'],
  nonCommercial: false,
  entryPrice: '',
  desc: { ar: 'وصفٌ قصير', en: 'A short description' },
}, over);

/* ============================================================
   1 — the wire exists at all
   ============================================================ */
console.log('--- 1: the wire ---');
{
  const st = code('js/store.js');
  const froms = (st.match(/sb\.from\('businesses'\)/g) || []).length;
  ok('1.1 the businesses table is WRITTEN from the app — it was read-only', froms >= 2, String(froms));
  ok('1.2 …and the insert is there', /sb\.from\('businesses'\)\s*\.insert\(/.test(st.replace(/\s+/g, ' ')) ||
     /from\('businesses'\)[\s\S]{0,200}\.insert\(/.test(st), 'insert');
  ok('1.3 …and the update', /from\('businesses'\)[\s\S]{0,200}\.update\(/.test(st), 'update');

  /* ⚠️ the id comes from the ROW, never from `mintId('ub')`: an id invented
     on one device collides with one invented on another, and `648` wrote
     the rule — a record that has a table takes its id from the table. */
  const add = /export async function addBusiness[\s\S]*?\n\}/.exec(st);
  ok('1.4 `addBusiness` is async', !!add, add ? 'found' : 'MISSING');
  ok('1.5 …and it does not mint its own id', add && !/mintId\('ub'\)/.test(add[0]),
     add && /mintId/.test(add[0]) ? 'still mints' : 'server id');
  ok('1.6 …and it reads the id off the row it got back',
     add && /saved\.id/.test(add[0]), 'saved.id');

  /* ⚠️ no `.eq('status', …)` in any reader from the server: `630`'s lesson —
     the policy decides who sees what, and a filter written in the client
     blinds the admin's own queue. */
  /* ⚠️ the factory reads `sb.from(table)` with a VARIABLE, so a pattern that
     only knew a literal table name would have stayed green over the filter
     put back in the one place it can do the most harm. */
  ok('1.7 no reader filters by status in the client',
     !/sb\.from\([^)]*\)[\s\S]{0,200}\.eq\('status'/.test(st), 'none');

  /* ⚠️ `everyBusiness()` stays SYNCHRONOUS — twenty-three call sites in eight
     files read it and not one gains an `await` */
  const every = /export function everyBusiness\(\)[\s\S]*?\n\}/.exec(st);
  ok('1.8 `everyBusiness()` is still synchronous', !!every && !/await/.test(every[0]),
     every ? 'sync' : 'MISSING');
}

/* ============================================================
   2 — a row added on one phone is read on another
   ============================================================ */
console.log('--- 2: the fault itself ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await member(p, 'adder@arabna.test');
  const made = await p.evaluate(async (b) => {
    const rec = await window.__S.addBusiness(b);
    return rec && { id: rec.id, status: rec.status, ownerId: rec.ownerId };
  }, BZ());
  ok('2.1 an addition really reaches the table', (db.businesses || []).length === 1,
     String((db.businesses || []).length));
  const row = (db.businesses || [])[0] || {};
  ok('2.2 …with `seed_id` null: a row of its own, not a coat over a seed',
     row.seed_id === null, String(row.seed_id));
  ok('2.3 …and `source` «owner», the answer Apple 5.1.1(viii) asks for',
     row.source === 'owner', String(row.source));
  ok('2.4 …and the record carries the SERVER id, not a `ub…` one',
     made && made.id === row.id && !/^ub/.test(made.id), made ? made.id : 'null');

  /* the whole point: a SECOND device, which knows nothing locally */
  const { ctx: c2, p: p2 } = await fresh({ db, preConfirm: true });
  await open(p2, '#/directory');
  const seen = await p2.evaluate((id) => {
    const S = window.__S;
    return { every: S.everyBusiness().some(b => b.id === id),
             all: S.allBusinesses().some(b => b.id === id),
             extras: S.state.extraBusinesses.length };
  }, row.id);
  ok('2.5 …and a phone that knows nothing locally READS IT — the original fault',
     seen.every === true, JSON.stringify(seen));
  ok('2.6 …and it is in the published directory', seen.all === true, JSON.stringify(seen));
  ok('2.7 …with nothing of its own in local state', seen.extras === 0, String(seen.extras));

  /* it must not appear twice for the person who added it */
  const twice = await p.evaluate((id) => window.__S.everyBusiness().filter(b => b.id === id).length, row.id);
  ok('2.8 …and exactly once for whoever added it', twice === 1, String(twice));
  await c2.close(); await ctx.close();
}

/* ============================================================
   3 — held for review: whose eyes, and on which device
   ============================================================ */
console.log('--- 3: the queue ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  const uid = await member(p, 'holder@arabna.test');
  const id = await p.evaluate(async (b) => {
    const r = await window.__S.addBusiness(b, { pendingReview: true });
    return r && r.id;
  }, BZ({ name: { ar: 'محلٌّ معلَّق', en: 'Held shop' } }));
  const row = (db.businesses || []).find(r => r.id === id) || {};
  ok('3.1 a held addition is `pendingReview`, never `pending`',
     row.status === 'pendingReview', String(row.status));

  /* ⚠️ THE SAME ACCOUNT ON A SECOND DEVICE. It read
     `state.myPendingBusinesses` — a list on ONE phone — so somebody who
     added their shop from their mobile could not find it on their laptop. */
  const { ctx: c2, p: p2 } = await fresh({ db, preConfirm: true });
  await open(p2, '#/home');
  await p2.evaluate(async (em) => window.__S.signInWithPassword(em, 'Qx7#mVzt2026'),
                   'holder@arabna.test');
  const mine = await p2.evaluate(async (id) => {
    const S = window.__S;
    await S.loadLiveBusinesses();
    return { signedIn: !!(S.state.user && S.state.user.id),
             sees: S.allBusinesses().some(b => b.id === id),
             local: (S.state.myPendingBusinesses || []).length };
  }, id);
  ok('3.2 …and its owner sees it from a SECOND device, with no local list',
     mine.signedIn && mine.sees === true && mine.local === 0, JSON.stringify(mine));

  /* a third person must not */
  const { ctx: c3, p: p3 } = await fresh({ db, preConfirm: true });
  await open(p3, '#/home');
  await member(p3, 'stranger@arabna.test');
  const other = await p3.evaluate(async (id) => {
    const S = window.__S;
    await S.loadLiveBusinesses();
    return { all: S.allBusinesses().some(b => b.id === id),
             every: S.everyBusiness().some(b => b.id === id) };
  }, id);
  ok('3.3 …and a third account sees it nowhere — RLS, not a line in a screen',
     other.all === false && other.every === false, JSON.stringify(other));

  /* the admin does */
  const { ctx: c4, p: p4 } = await fresh({ db, preConfirm: true });
  await open(p4, '#/home');
  await unlockAdmin(p4);
  const adm = await p4.evaluate(async (id) => {
    const S = window.__S;
    await S.loadLiveBusinesses();
    return S.pendingBusinesses().some(b => b.id === id);
  }, id);
  ok('3.4 …and it is in the admin queue, which is what it was raised for',
     adm === true, String(adm));
  await c4.close(); await c3.close(); await c2.close(); await ctx.close();
}

/* ============================================================
   4 — the decision reaches the server, through one door
   ============================================================ */
console.log('--- 4: approve and refuse ---');
{
  const st = code('js/store.js');
  const app = /export async function approvePendingBusiness[\s\S]*?\n\}/.exec(st);
  const rej = /export async function rejectPendingBusiness[\s\S]*?\n\}/.exec(st);
  ok('4.1 both decisions pass through `applyBusinessEdit`, never a second copy',
     app && rej && /applyBusinessEdit/.test(app[0]) && /applyBusinessEdit/.test(rej[0])
     && !/sb\.from/.test(app[0]) && !/sb\.from/.test(rej[0]), 'one door');
  ok('4.2 …and neither logs or notifies over a write that did not take',
     app && /if \(!await applyBusinessEdit/.test(app[0]), 'guarded');

  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await member(p, 'owner2@arabna.test');
  const id = await p.evaluate(async (b) => {
    const r = await window.__S.addBusiness(b, { pendingReview: true });
    return r && r.id;
  }, BZ({ name: { ar: 'قيدَ القرار', en: 'Awaiting a decision' } }));

  const { ctx: ca, p: pa } = await fresh({ db, preConfirm: true });
  await open(pa, '#/home');
  await unlockAdmin(pa);
  const okApprove = await pa.evaluate(async (id) => {
    await window.__S.loadLiveBusinesses();
    return window.__S.approvePendingBusiness(id);
  }, id);
  ok('4.3 the approval answers true', okApprove === true, String(okApprove));
  ok('4.4 …and the SERVER row is live', ((db.businesses || [])[0] || {}).status === 'live',
     String(((db.businesses || [])[0] || {}).status));

  const okReject = await pa.evaluate(async (id) => window.__S.rejectPendingBusiness(id, 'سببٌ مكتوب'), id);
  ok('4.5 the refusal answers true', okReject === true, String(okReject));
  ok('4.6 …and the server row is rejected', ((db.businesses || [])[0] || {}).status === 'rejected',
     String(((db.businesses || [])[0] || {}).status));

  /* ⚠️ A STRANGER IS REFUSED BY THE POLICY, and the store reports it rather
     than repainting a queue over a write that never took.
     ⚠️ AND THE BOUNDARY IS MEASURED WHERE IT REALLY IS, not where it would be
     convenient. `0002`'s «own: update» is `using (owner_id = auth.uid() or
     is_admin())` with NO `with check`, so a row's own OWNER can set its
     status — a business held for review can be published by the person who
     entered it, from a console if not from a screen. That is out of this
     batch's two-line migration and is written into `docs/الحالة.md` as a
     measured gap with its remedy, never asserted away here. */
  const { ctx: cs, p: ps } = await fresh({ db, preConfirm: true });
  await open(ps, '#/home');
  await member(ps, 'nosy@arabna.test');
  const denied = await ps.evaluate(async (id) => {
    await window.__S.loadLiveBusinesses();
    return window.__S.approvePendingBusiness(id);
  }, id);
  ok('4.7 …and an account that owns nothing cannot approve anything',
     denied === false && ((db.businesses || [])[0] || {}).status === 'rejected',
     denied + ' | ' + ((db.businesses || [])[0] || {}).status);
  await cs.close();
  await ca.close(); await ctx.close();
}

/* ============================================================
   5 — a seed edited for the first time gets a COAT, not a copy
   ============================================================ */
console.log('--- 5: the coat ---');
{
  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await unlockAdmin(p);
  const seed = await p.evaluate(() => {
    const S = window.__S;
    const b = S.everyBusiness().find(x => /^b\d+$/.test(x.id) && !x.demo);
    return b && { id: b.id, phone: b.phone, name: b.name, tags: (b.tags || []).length };
  });
  ok('5.1 a real seed is in hand', !!seed, seed ? seed.id : 'none');
  const first = await p.evaluate(async (id) => window.__S.applyBusinessEdit(id, { phone: '(713) 555-0199' }), seed.id);
  ok('5.2 the first edit of a seed reaches the server', first === true, String(first));
  const coat = (db.businesses || [])[0] || {};
  ok('5.3 …as a coat keyed by `seed_id`', coat.seed_id === seed.id, String(coat.seed_id));
  ok('5.4 …carrying the edited field', coat.phone === '(713) 555-0199', String(coat.phone));

  /* ⚠️ THE WHOLE SEED IS NOT COPIED. A second permanent copy parts from the
     first the day a number is corrected in one and not the other — the
     sentence the whole merge is built on. Only the three columns the schema
     demands (`name_ar`, `name_en`, `cat` are `not null`) stand beside it. */
  const extra = Object.keys(coat).filter(k =>
    !['id', 'created_at', 'updated_at', 'seed_id', 'status', 'source',
      'name_ar', 'name_en', 'cat', 'phone'].includes(k));
  ok('5.5 …and NOT the whole seed', extra.length === 0, extra.join(', ') || 'nothing extra');
  ok('5.6 …no description, no tags, no hours copied across',
     coat.desc_ar === undefined && coat.tags === undefined && coat.hours === undefined, 'clean');

  const second = await p.evaluate(async (id) => window.__S.applyBusinessEdit(id, { address: 'x, Katy, TX 77450' }), seed.id);
  ok('5.7 a second edit updates that row', second === true, String(second));
  ok('5.8 …and does not make a second one', (db.businesses || []).length === 1,
     String((db.businesses || []).length));

  /* the local edit is dropped once it has reached the server, and only then */
  const cleaned = await p.evaluate((id) => !((window.__S.state.businessEdits || {})[id]), seed.id);
  ok('5.9 …and the local edit is cleaned only because it succeeded', cleaned === true, String(cleaned));

  /* a second device reads it */
  const { ctx: c2, p: p2 } = await fresh({ db, preConfirm: true });
  await open(p2, '#/directory');
  const read2 = await p2.evaluate((id) => {
    const b = window.__S.everyBusiness().find(x => x.id === id);
    return b && { phone: b.phone, name: b.name && b.name.en };
  }, seed.id);
  ok('5.10 …and another phone reads the corrected number', read2 && read2.phone === '(713) 555-0199',
     JSON.stringify(read2));
  await c2.close(); await ctx.close();
}

/* ============================================================
   6 — deletion is a mark, not a wipe
   ============================================================ */
console.log('--- 6: the mark ---');
{
  ok('6.1 no delete policy is opened on the table',
     !/create policy[^\n]*on public\.businesses for delete/i.test(sqlCode()), 'none');
  const st = code('js/store.js');
  const del = /export async function deleteBusiness[\s\S]*?\n\}/.exec(st);
  ok('6.2 …and the store never deletes a row', del && !/\.delete\(/.test(del[0]), 'mark');

  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await unlockAdmin(p);
  const id = await p.evaluate(async (b) => {
    const r = await window.__S.addBusiness(b);
    return r && r.id;
  }, BZ({ name: { ar: 'سيُحذَف', en: 'To be deleted' } }));
  const gone = await p.evaluate(async (id) => {
    const S = window.__S;
    const okd = await S.deleteBusiness(id);
    return { okd, still: S.everyBusiness().some(b => b.id === id) };
  }, id);
  ok('6.3 the deletion answers true', gone.okd === true, String(gone.okd));
  ok('6.4 …the row stays on the server, marked', ((db.businesses || [])[0] || {}).status === 'deleted',
     String(((db.businesses || [])[0] || {}).status));
  ok('6.5 …and `everyBusiness()` drops it', gone.still === false, String(gone.still));

  /* and on the phone that never knew it locally — the half that was blind */
  const { ctx: c2, p: p2 } = await fresh({ db, preConfirm: true });
  await open(p2, '#/directory');
  const elsewhere = await p2.evaluate((id) => window.__S.everyBusiness().some(b => b.id === id), id);
  ok('6.6 …on every phone, not the admin’s alone', elsewhere === false, String(elsewhere));
  await c2.close(); await ctx.close();
}

/* ============================================================
   7 — the phone, on BOTH doors
   ============================================================ */
console.log('--- 7: one rule, two doors ---');
{
  /* ⚠️ ONE DEFINITION. A screen carrying its own copy is a second source of
     truth, and a second source is what makes the next correction land on
     one door and miss the other — which is exactly how the edit form was
     left behind when `645` fixed the add form. */
  const dir = code('js/screens/directory.js');
  const defs = (dir.match(/(?:^|\n)\s*(?:function|const)\s+phoneOptional\b/g) || []).length;
  ok('7.1 `phoneOptional` is defined exactly once in the file', defs === 1, String(defs));
  const calls = (dir.match(/phoneOptional\(/g) || []).length;
  ok('7.2 …and called from both forms', calls >= 3, String(calls));
  ok('7.3 …and no exception is written for staff',
     !/adminEditing[\s\S]{0,80}phoneOptional|phoneOptional[\s\S]{0,80}adminEditing/.test(dir), 'none');

  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await unlockAdmin(p);
  const id = await p.evaluate(() => {
    const b = window.__S.everyBusiness().find(x => /^b\d+$/.test(x.id) && !x.demo && !x.nonCommercial);
    return b && b.id;
  });
  await open(p, '#/business/edit/' + id);
  const marks = await p.evaluate(() => {
    const m = document.querySelector('#ePhoneMark');
    const h = document.querySelector('#ePhoneHint');
    return { mark: m ? m.innerHTML.replace(/\s+/g, ' ').trim() : null, hintHidden: h ? h.hidden : null };
  });
  ok('7.4 a trading business shows the required mark on the edit form',
     /class="req"/.test(marks.mark || ''), JSON.stringify(marks));
  ok('7.5 …and the standing «optional» hint is hidden', marks.hintHidden === true, String(marks.hintHidden));

  /* the mark moves the instant the box is pressed, before any save */
  const flipped = await p.evaluate(() => {
    const box = document.querySelector('#eNonComm');
    box.checked = true; box.dispatchEvent(new Event('change'));
    const m = document.querySelector('#ePhoneMark');
    const h = document.querySelector('#ePhoneHint');
    return { mark: m.innerHTML, hintHidden: h.hidden };
  });
  ok('7.6 …and both move the moment the box is ticked, before any save',
     !/class="req"/.test(flipped.mark) && flipped.hintHidden === false, JSON.stringify(flipped));

  /* the refusal: a mark and a sentence that STAYS, never a toast */
  const refused = await p.evaluate(async () => {
    const box = document.querySelector('#eNonComm');
    box.checked = false; box.dispatchEvent(new Event('change'));
    document.querySelector('#ePhone').value = '';
    document.querySelector('#eSave').click();
    await new Promise(r => setTimeout(r, 400));
    return { hash: location.hash,
             err: (document.querySelector('#eErr') || {}).textContent || '',
             marked: !!document.querySelector('#ePhone.input-err'),
             toasts: document.querySelectorAll('.toast').length };
  });
  ok('7.7 clearing the number on a trading business is REFUSED',
     /business\/edit/.test(refused.hash), refused.hash);
  ok('7.8 …with the field marked and the sentence standing', refused.err.length > 0 && refused.marked,
     JSON.stringify({ err: refused.err.slice(0, 40), marked: refused.marked }));
  ok('7.9 …and NOT with a toast', refused.toasts === 0, String(refused.toasts));

  /* and ticking the box lets it through — nobody who really has no number
     is locked out */
  const passed = await p.evaluate(async () => {
    const box = document.querySelector('#eNonComm');
    box.checked = true; box.dispatchEvent(new Event('change'));
    document.querySelector('#eSave').click();
    await new Promise(r => setTimeout(r, 700));
    return location.hash;
  });
  ok('7.10 …while a non-commercial listing saves with an empty one',
     !/business\/edit/.test(passed), passed);
  await ctx.close();
}

/* ============================================================
   8 — a point, by the first thing that is known
   ============================================================ */
console.log('--- 8: the three-step ladder ---');
{
  ok('8.1 the two columns exist, and only those two',
     /alter table public\.businesses add column if not exists lat double precision/.test(sqlCode())
     && /alter table public\.businesses add column if not exists lng double precision/.test(sqlCode()),
     'lat · lng');

  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await member(p, 'geo@arabna.test');
  const steps = await p.evaluate(async (BZ) => {
    const S = window.__S;
    const one = await S.addBusiness(Object.assign({}, BZ, {
      name: { ar: 'رمزٌ معروف', en: 'Known ZIP' },
      address: '1 A St, Houston, TX 77036' }));
    const two = await S.addBusiness(Object.assign({}, BZ, {
      name: { ar: 'رمزٌ جديدٌ في مدينةٍ معروفة', en: 'New ZIP, known city' },
      address: '2 B St, Katy, TX 77494' }));
    const three = await S.addBusiness(Object.assign({}, BZ, {
      name: { ar: 'لا رمزَ ولا مدينة', en: 'Neither' },
      address: '3 C St, Nowhere, ZZ 00000' }));
    return [one, two, three].map(r => r && { id: r.id, lat: r.lat, lng: r.lng, needsGeo: r.needsGeo });
  }, BZ());
  ok('8.2 a known ZIP takes its centre', steps[0] && steps[0].lat === 29.699 && steps[0].needsGeo === false,
     JSON.stringify(steps[0]));
  /* ⚠️ THE SECOND STEP IS WHAT MAKES A NEW ZIP HARMLESS: a code the table
     has never heard of, in a city we cover, takes ITS CITY'S point, so it
     stays in the order approximately instead of falling out of it. */
  ok('8.3 an unknown ZIP in a covered city takes the CITY’s point',
     steps[1] && steps[1].lat === 29.7858 && steps[1].needsGeo === false, JSON.stringify(steps[1]));
  ok('8.4 …and neither leaves no point at all, honestly',
     steps[2] && !steps[2].lat && steps[2].needsGeo === true, JSON.stringify(steps[2]));

  const rows = db.businesses || [];
  ok('8.5 …and the point is written to the server, not held on the device',
     rows.length === 3 && rows[0].lat === 29.699 && rows[2].lat == null,
     rows.map(r => String(r.lat)).join(' · '));

  /* ⚠️ what has no point is LAST, never hidden: a listing that disappears
     because its ZIP is unknown TO US is punished for a gap in us */
  const tail = await p.evaluate(async (id) => {
    const S = window.__S;
    S.setUserLocation({ city: 'Houston', state: 'TX', zip: '' }, { lat: 29.76, lng: -95.37 });
    /* `byNearest` is the sorter itself: what has no point goes to the TAIL,
       ordered by city, and is never dropped — the safety net this batch is
       forbidden to touch */
    const list = S.byNearest(S.allBusinesses());
    const i = list.findIndex(b => b.id === id);
    return { i, n: list.length, counted: S.needsGeoList().some(b => b.id === id) };
  }, steps[2].id);
  ok('8.6 the pointless listing is still in the list', tail.i >= 0, JSON.stringify(tail));
  ok('8.7 …and counted in the panel’s «awaiting coordinates» queue',
     tail.counted === true, String(tail.counted));

  /* ⚠️ no network call in the save path: the table is inside the app */
  const outside = [];
  p.on('request', r => { const u = r.url();
    if (!/localhost|127\.0\.0\.1|supabase\.co|fonts\.g/.test(u)) outside.push(u); });
  await p.evaluate(async (BZ) => window.__S.addBusiness(Object.assign({}, BZ,
    { name: { ar: 'بلا شبكة', en: 'No network' } })), BZ());
  ok('8.8 …and not one geocoding call leaves the device', outside.length === 0,
     outside.slice(0, 2).join(' | ') || 'none');
  await ctx.close();
}

/* ============================================================
   9 — the two columns nobody read, and the field nobody writes
   ============================================================ */
console.log('--- 9: the map, both ways ---');
{
  const st = code('js/store.js');
  const rd = /export function mapLiveRowToJs[\s\S]*?\n\}/.exec(st)[0];
  ok('9.1 the read map takes `zip` — a required box that reached no reader',
     /'zip'/.test(rd), 'zip');
  ok('9.2 …and `mobile_service`', /mobile_service/.test(rd), 'mobile_service');
  /* ⚠️ a field nothing writes is a field that LIES: it would make a seed look
     as though it has video and everything added afterwards look as though it
     has none — the seed parting from the row all over again */
  ok('9.3 …and NOT `videos`, which nothing writes', !/videos/.test(rd), 'dropped');
  ok('9.4 …and `claimed` is derived from `owner_id`, never a column',
     /claimed = !!r\.owner_id|claimed: !!r\.owner_id|out\.claimed = !!r\.owner_id/.test(rd), 'derived');

  const wr = /export function mapJsToLiveRow[\s\S]*?\n\}/.exec(st);
  ok('9.5 there is ONE reverse map', !!wr && (st.match(/function mapJsToLiveRow/g) || []).length === 1,
     'one');
  ok('9.6 …and it writes `plan` by name', wr && /\bplan\b/.test(wr[0]), 'plan');

  const { ctx, p, db } = await fresh({ preConfirm: true });
  await open(p, '#/home');
  await member(p, 'zip@arabna.test');
  const id = await p.evaluate(async (b) => {
    const r = await window.__S.addBusiness(Object.assign({}, b, {
      mobileService: true, address: '', zip: '77450' }));
    return r && r.id;
  }, BZ({ name: { ar: 'خدمةٌ متنقّلة', en: 'Mobile trade' } }));
  const row = (db.businesses || [])[0] || {};
  ok('9.7 a mobile trade’s ZIP reaches its column', row.zip === '77450', String(row.zip));
  ok('9.8 …and so does the flag', row.mobile_service === true, String(row.mobile_service));

  /* ⚠️ `videos` is put ON THE ROW on purpose. Nothing writes that column, so
     a check that only read what the app stores would stay green with the
     field put back in the map — the two-layer trap this project has
     recorded twice. Giving the row a value measures the READ itself. */
  (db.businesses || []).forEach(r => { r.videos = 3; });
  const { ctx: c2, p: p2 } = await fresh({ db, preConfirm: true });
  await open(p2, '#/directory');
  const back = await p2.evaluate((id) => {
    const b = window.__S.everyBusiness().find(x => x.id === id);
    return b && { zip: b.zip, mobileService: b.mobileService, videos: b.videos, claimed: b.claimed };
  }, id);
  ok('9.9 …and both are READ on a second phone — two columns nobody read',
     back && back.zip === '77450' && back.mobileService === true, JSON.stringify(back));
  ok('9.10 …and `videos` is not read from a live row', back && back.videos === undefined,
     String(back && back.videos));
  await c2.close(); await ctx.close();
}

/* ============================================================
   10 — every writer that reaches the server is WAITED FOR
   ------------------------------------------------------------
   ⚠️ THE NET FOUND THIS AND THE BATCH'S OWN SUITE DID NOT. `flip` in the
   panel called `setNonCommercial`, said «تمّ» and repainted the list —
   over a write that had not answered. The three decisions above were given
   the awaited shape by this batch and that one was missed, so `test_v11`
   went red on a real fault rather than a stale assertion.

   ⚠️ So the CLASS is asserted, never the instance — `570`'s and `572`'s
   rule. A writer added tomorrow and called without waiting turns this red
   AND NAMES ITS LINE, instead of waiting for the next suite to trip over
   it. The list of writers is read from `store.js` (`export async function`
   whose body reaches `applyBusinessEdit` or `sb.from('businesses')`), so
   it is derived and cannot age.
   ============================================================ */
console.log('--- 10: nothing repaints over a write that has not answered ---');
{
  const st = code('js/store.js');
  const writers = [];
  for (const m of st.matchAll(/export async function ([A-Za-z]+)\s*\([^)]*\)\s*\{/g)) {
    const from = m.index + m[0].length;
    // the function's own body, to its closing brace at column 0
    const end = st.indexOf('\n}', from);
    const body = st.slice(from, end < 0 ? st.length : end);
    if (/applyBusinessEdit|from\('businesses'\)/.test(body)) writers.push(m[1]);
  }
  ok('10.1 the writers are read from the store, not listed here',
     writers.length >= 5, writers.join(' · '));

  const files = ['js/screens/admin.js', 'js/screens/directory.js', 'js/screens/profile.js',
                 'js/ui.js', 'js/app.js'];
  const loose = [];
  for (const f of files) {
    const src = code(f);
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      for (const w of writers) {
        const re = new RegExp('(^|[^.\\w])(await\\s+)?S\\.' + w + '\\s*\\(');
        const hit = re.exec(line);
        if (!hit) continue;
        /* awaited on the spot, chained with `.then`, or handed straight back
           to a caller that will wait — any of the three is waiting */
        const awaited = /await\s+S\./.test(line)
          || /S\.[A-Za-z]+\([\s\S]*/.test(line) && /\)\s*\.then\(/.test(line + (lines[i + 1] || ''))
          || /return\s+S\./.test(line);
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
