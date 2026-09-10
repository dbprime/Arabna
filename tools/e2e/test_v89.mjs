/* 670 — the inventory is derived, and the account door asks the server.

   TWO SUBJECTS, and they do not overlap:

   ب) THE DOOR. `checkUserPassword` read `if (!u.pwHash) return true`, and
      `pwHash` is written by `setUserPassword` alone — which runs at SIGN-UP
      and at a password change, never in `hydrateUserFromSession`. So on
      every device the account reached by SIGNING IN the guard answered
      `true` to any text at all: a minute with an open phone was a new
      password and the owner locked out of their own account.
      ⚠️ THE DECISIVE CASE IS BLOCK 2 — a signed-IN device — and it is the
      one that fails on the tree before this batch. Block 1 (the device that
      created the account) passed before and after, because there the hash
      existed; a suite built only from block 1 would have been green over
      the whole fault.

   أ) THE INVENTORY. A tool whose output does not settle cannot be a guard,
      and a file regenerated whole erases every check a human recorded. Both
      halves are measured, and in both directions.                        */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const SINGLE = /single-file/.test(BASE);
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ Comments stripped before any «does the code do X» check — four times
   paid for in this project, and this file's own subject is named in the
   comments it would otherwise read. */
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    /* ⚠️ A REFUSAL THIS FILE ASKED FOR IS NOT A FAULT IN THE APP. Blocks 1
       and 2 send a wrong password on purpose and block 3 cuts the network
       on purpose, so the auth endpoint answers 400 and the browser logs
       it — v76's own filter, for its own reason, rather than a second
       shape invented here. It excludes by the URL of the request, so an
       error from any other origin still counts. */
    !/supabase\.co|fonts\.googleapis/.test((m.location() && m.location().url) || '') &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|ERR_ABORTED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};
const fresh = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  const db = await mockSupabase(ctx, opts);
  const p = await ctx.newPage(); wire(p);
  return { ctx, p, db };
};
const open = async (p, hash = '#/home') => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(async () => {
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  });
};
const signUp = (p, email, pw) => p.evaluate(async ([e, w, c]) => {
  const S = window.__S;
  const err = await S.signUp({ name: 'Test Person', email: e, password: w, phone: '' });
  if (!err) await S.confirmEmail(c);
  return err;
}, [email, pw, MOCK_CODE]).catch(e => 'threw:' + e.message);
/* ⚠️ SIGNING IN, NOT SIGNING UP — the whole of block 2. This is the path
   that leaves no `pwHash` behind, and it is how every second device gets
   the account. */
const signIn = (p, email, pw) => p.evaluate(async ([e, w]) =>
  await window.__S.signInWithPassword(e, w), [email, pw]).catch(e => 'threw:' + e.message);
const change = (p, cur, next) => p.evaluate(async ([c, n]) =>
  await window.__S.changePassword(c, n), [cur, next]).catch(e => ({ threw: e.message }));

const EMAIL = 'door@arabna.test', PW = 'Qamar#2026x', NEXT = 'Nawras#2026y';

/* ===== 1. the device that CREATED the account ===== */
console.log('--- 1. the device that created the account ---');
let shared;
{
  const a = await fresh({ preConfirm: true });
  shared = a.db;
  await open(a.p);
  const e = await signUp(a.p, EMAIL, PW);
  ok('1.1 an account is created on the server', !e, JSON.stringify(e || null));

  const wrong = await change(a.p, 'NotMine#2026z', NEXT);
  ok('1.2 a wrong current password is refused', wrong && wrong.ok === false && wrong.reason === 'wrong',
     JSON.stringify(wrong));
  ok('1.3 …and the server still holds the original password',
     shared.users.get(EMAIL) && shared.users.get(EMAIL).password === PW,
     JSON.stringify((shared.users.get(EMAIL) || {}).password));

  const right = await change(a.p, PW, NEXT);
  ok('1.4 the right password passes and the change lands', right && right.ok === true, JSON.stringify(right));
  ok('1.5 …and the SERVER carries the new password',
     shared.users.get(EMAIL) && shared.users.get(EMAIL).password === NEXT,
     JSON.stringify((shared.users.get(EMAIL) || {}).password));
  await a.ctx.close();
}

/* ===== 2. THE DECISIVE CASE — a device the account SIGNED IN to ===== */
console.log('--- 2. a device the account signed in to (the fault) ---');
{
  const b = await fresh({ preConfirm: true, db: shared });
  await open(b.p);
  const e = await signIn(b.p, EMAIL, NEXT);
  ok('2.1 the account reaches a second device by signing in', !e, JSON.stringify(e || null));

  const noHash = await b.p.evaluate(() => {
    const u = window.__S.state.user || {};
    return { hasHash: !!u.pwHash, email: u.email || '' };
  });
  ok('2.2 …and this device carries NO local hash — the fault’s whole cause',
     noHash.hasHash === false && noHash.email === EMAIL, JSON.stringify(noHash));

  const wrong = await change(b.p, 'NotMine#2026z', 'Third#2026q');
  ok('2.3 A WRONG PASSWORD IS REFUSED ON A SIGNED-IN DEVICE',
     wrong && wrong.ok === false && wrong.reason === 'wrong', JSON.stringify(wrong));
  ok('2.4 …and the server’s password did not move',
     shared.users.get(EMAIL) && shared.users.get(EMAIL).password === NEXT,
     JSON.stringify((shared.users.get(EMAIL) || {}).password));

  const right = await change(b.p, NEXT, 'Third#2026q');
  ok('2.5 …while the right one still passes on that same device',
     right && right.ok === true, JSON.stringify(right));
  await b.ctx.close();
}

/* ===== 3. a dropped connection is its own sentence ===== */
console.log('--- 3. three refusals, three sentences ---');
{
  const c = await fresh({ preConfirm: true });
  await open(c.p);
  await signUp(c.p, 'off@arabna.test', PW);
  /* ⚠️ The token endpoint is aborted, which is what supabase-js turns into
     `AuthRetryableFetchError` — a failure to REACH rather than a refusal. */
  await c.ctx.route('**/auth/v1/token**', r => r.abort());
  const res = await change(c.p, PW, NEXT);
  ok('3.1 a dropped connection is «offline», never «wrong password»',
     res && res.ok === false && res.reason === 'offline', JSON.stringify(res));
  await c.ctx.unroute('**/auth/v1/token**');
  await c.ctx.close();
}
{
  const src = code('js/screens/profile.js');
  ok('3.2 the screen names all three outcomes apart',
     /pwServerRefused/.test(src) && /pwOffline/.test(src) && /wrongPassword/.test(src));
  const i18 = read('js/i18n.js');
  ok('3.3 and both packs carry the third sentence',
     (i18.match(/\n\s*pwOffline:/g) || []).length === 2,
     String((i18.match(/\n\s*pwOffline:/g) || []).length));
}

/* ===== 4. structural — the guard beside the behaviour, never instead ===== */
console.log('--- 4. structural ---');
{
  const st = code('js/store.js');
  ok('4.1 checkUserPassword asks the server',
     /export async function checkUserPassword[\s\S]{0,900}?signInWithPassword/.test(st));
  ok('4.2 …and never answers «yes» to a missing local value',
     !/checkUserPassword[\s\S]{0,600}?!u\.pwHash\)\s*return true/.test(st));
  /* ⚠️ A layer of its own: the behavioural items above pass on the stand-in
     even with the plaintext branch restored, because no fixture carries the
     old field. `475` and V.07.9's lesson — structure beside behaviour. */
  ok('4.3 the plaintext branch is gone from changePassword',
     !/if\s*\(u\.password\)\s*\{[\s\S]{0,120}?current !== u\.password/.test(st));
  ok('4.4 …and a boot migration deletes it from every existing device',
     /state\.user\.password !== undefined[\s\S]{0,80}?delete state\.user\.password/.test(st));
  ok('4.5 an unrecognised failure is read as «did not reach», never as «wrong»',
     /AuthRetryableFetchError/.test(st) && /err\.status >= 500/.test(st));
}
{
  const c = await fresh({ preConfirm: true });
  await open(c.p);
  await signUp(c.p, 'plain@arabna.test', PW);
  const gone = await c.p.evaluate(async () => {
    const S = window.__S;
    S.state.user.password = 'left-over-from-an-old-build';
    S.save();
    await new Promise(r => setTimeout(r, 30));
    const before = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    return { onDisk: !!(before.user && before.user.password !== undefined) };
  });
  ok('4.6 the field really is on disk before the migration runs', gone.onDisk === true,
     JSON.stringify(gone));
  await c.p.reload({ waitUntil: 'domcontentloaded' });
  await c.p.waitForTimeout(900);
  const after = await c.p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('arabna.v1') || '{}');
    return { onDisk: !!(d.user && d.user.password !== undefined) };
  });
  ok('4.7 …and the next launch removes it', after.onDisk === false, JSON.stringify(after));
  await c.ctx.close();
}

/* ===== 5. the inventory: derived, settled, carried, and struck ===== */
console.log('--- 5. the inventory ---');
const INV = ROOT + 'docs/الجرد.md';
const run = (...a) => spawnSync(process.execPath, [ROOT + 'tools/audit/inventory.mjs', ROOT, ...a], { encoding: 'utf8' });
{
  ok('5.1 the file exists and is generated', existsSync(INV));
  const before = read('docs/الجرد.md');
  run();
  ok('5.2 A SECOND RUN IS BYTE-IDENTICAL — a tool that does not settle cannot guard',
     read('docs/الجرد.md') === before);
  ok('5.3 --check is green on a current file', run('--check').status === 0);
  ok('5.4 the head says the file is generated and forbids hand editing',
     /مولَّد/.test(before) && /لا يُكتَب بيد/.test(before));
  /* `615`'s rule: no document writes its own count. */
  const items = (before.match(/^\| `/gm) || []).length;
  const declared = Number((before.match(/البنود\s+(\d+)/) || [])[1] || -1);
  ok('5.5 the totals are read from the table, never written', items === declared,
     items + ' rows / ' + declared + ' declared');
  const dated = (before.match(/\| \d{4}-\d{2}-\d{2} \|$/gm) || []).length;
  const dDecl = Number((before.match(/مفحوصة\s+(\d+)/) || [])[1] || -1);
  ok('5.6 …and so is the checked count', dated === dDecl, dated + ' / ' + dDecl);
  ok('5.7 the first fill is partial, which is the whole point',
     dated > 0 && dated < items, dated + ' of ' + items);
}
/* ⚠️ MODULE BUILD ONLY, AND THIS IS NOT TIDINESS — `run.sh` RUNS THE TWO
   BUILDS AT THE SAME TIME. This block writes to `js/app.js` and to the
   inventory on disk, so two copies racing each other would have one
   restoring while the other had mutated, and the tree would be left dirty
   — which aborts every later segment of the net through the frozen-tree
   guard. `v68` reached the same answer for the same reason: a tool is a
   file on disk and belongs to neither build. The read-only items above run
   on both. */
if (!SINGLE) {
  /* ⚠️ A COPY, never `git checkout` — a teeth run happens on an uncommitted
     tree by definition, and `648` paid for that rule with a whole batch.
     ⚠️ And the inventory is copied too, because the tool WRITES it: a
     restore that puts back only the file it mutated leaves the artefact
     that file makes still corrupted. */
  const APP = ROOT + 'js/app.js';
  copyFileSync(INV, INV + '.bak'); copyFileSync(APP, APP + '.bak');
  try {
    // a date written by hand survives regeneration
    const txt = read('docs/الجرد.md');
    const line = (txt.match(/^\| `screen\/[^\n]*\| — \|$/m) || [])[0];
    writeFileSync(INV, txt.replace(line, line.replace(/\| — \|$/, '| 2026-01-02 |')));
    run();
    ok('5.8 a check date written by hand is CARRIED across a regeneration',
       /\| 2026-01-02 \|/.test(read('docs/الجرد.md')));
    copyFileSync(INV + '.bak', INV);

    // a new item appears, with an empty date
    const app = readFileSync(APP, 'utf8');
    writeFileSync(APP, app.replace('const ALL_ROUTES = [',
      'const ALL_ROUTES = [\n  { re: /^#\\/zzfake$/, screen: HomeScreen, nav: null },'));
    ok('5.9 --check reddens the moment the tree moves ahead of the file',
       run('--check').status === 1);
    run();
    const withFake = read('docs/الجرد.md');
    ok('5.10 a new item enters the inventory with NO check date',
       /zzfake/.test(withFake) && /`screen\/HomeScreen\/[^`]*zzfake[^`]*`[^\n]*\| — \|/.test(withFake),
       String(/zzfake/.test(withFake)));

    // …and an item that left the tree is struck, never left to age
    writeFileSync(APP, app);
    run();
    ok('5.11 an item that left the tree is STRUCK from the inventory',
       !/zzfake/.test(read('docs/الجرد.md')));
  } finally {
    copyFileSync(INV + '.bak', INV); copyFileSync(APP + '.bak', APP);
    spawnSync('rm', ['-f', INV + '.bak', APP + '.bak']);
    run();
  }
}
{
  const w = code('tools/audit/wiring.mjs');
  ok('5.12 the guard lives in the STATIC pass, not a browser suite',
     /inventory\.mjs/.test(w) && /--check/.test(w));
  ok('5.13 the key is file+name and carries no line number',
     !/^\| `[^`]*:\d+[^`]*`/m.test(read('docs/الجرد.md')));
}

ok('6.1 no console errors anywhere in this suite', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
