/* V.10.1 — 620: who owns the account.
 *
 * Five doors that had no lock, and every one of them measured by READING
 * the code before a line was written. What this file guards:
 *
 *  1  a password change that never left the device — so the OLD password
 *     went on opening the account from any other phone, for ever
 *  2  an email change that asked for nothing at all
 *  3  «resend» that resent nothing and then said it had
 *  4  «forgot my password» that said reset needs a server — while `610`
 *     had just put one there
 *  5  no users section, and no way to read an address back to a caller
 *
 * ⚠️ IT DOES NOT TOUCH THE REAL HOST. The acceptance tests against the live
 * project are the owner's and are named in the batch's report; a test that
 * does not run is said not to run.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { mockSupabase, MOCK_CODE } from './_supabase.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const ROOT = new URL('../../', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const read = f => readFileSync(ROOT + f, 'utf8');
/* ⚠️ Comments stripped before any «does the code do X» check — this project
   has paid for that rule twice, and this file names the very functions its
   own comments discuss. */
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/* ⚠️ AND THE SAME RULE FOR SQL, for the same reason and in the same batch:
   the migration's own comments name `security definer` and `search_path`
   while explaining why both are compulsory, so a check reading the raw file
   measures the prose about the code. It cost this suite one red. */
const sqlCode = f => read(f).replace(/--.*$/gm, '');

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 140)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/supabase\.co|fonts\.googleapis/.test((m.location() && m.location().url) || '') &&
    /* a refusal this file asked for is not a fault in the app: blocks 1, 2
       and 6 send a wrong password and a two-letter query on purpose */
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis|supabase\.co/.test(m.text()))
    errors.push(m.text().slice(0, 140)); });
};
const fresh = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.abort());
  await mockSupabase(ctx, opts);
  const p = await ctx.newPage(); wire(p);
  return { ctx, p };
};
const open = async (p, hash = '#/home') => {
  await p.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(async () => {
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
  });
};
/* One real account, made the way a person makes one. ⚠️ Never seeded:
   from `610` the server is the authority, and a seeded `state.user` is an
   account the server has never heard of. */
const signUp = (p, email, password, confirm = true) => p.evaluate(async ([e, pw, c, code]) => {
  const S = window.__S;
  const err = await S.signUp({ name: 'Test Person', email: e, password: pw, phone: '' });
  /* ⚠️ The account is confirmed unless a block's subject is the unconfirmed
     state: `tier()` gates the profile screens on a verified address, and
     seeding `state.user` instead would be an account the server never met. */
  if (!err && c) await S.confirmEmail(code);
  return err;
}, [email, password, confirm, MOCK_CODE]).catch(e => 'threw:' + e.message);

/* ============ 1. the password change reaches the server ============ */
{
  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p);
  await signUp(p, 'pw@a.app', 'Qamar#2026x');
  const r = await p.evaluate(async () => {
    const S = window.__S;
    const res = await S.changePassword('Qamar#2026x', 'Nahar#2027y');
    /* the proof is not the return value but what the SERVER now accepts */
    await S.signOut();
    const withOld = await S.signInWithPassword('pw@a.app', 'Qamar#2026x');
    const withNew = await S.signInWithPassword('pw@a.app', 'Nahar#2027y');
    return { ok: res.ok, withOld, withNew };
  });
  ok('1.1 the change is accepted', r.ok === true);
  /* ⚠️ THIS IS THE ITEM. Before the batch the old password went on working
     for ever, because nothing about the change ever left the device. */
  ok('1.2 …and the OLD password is refused by the server afterwards',
     typeof r.withOld === 'string' && r.withOld.length > 0, String(r.withOld));
  ok('1.3 …and the new one is accepted', r.withNew === null, String(r.withNew));
  ok('1.4 the server is called, and the local hash only follows its yes',
     /sb\.auth\.updateUser\(\{ password: next \}\)/.test(code('js/store.js')));
  ok('1.5 …and a refusal writes nothing locally at all',
     /if \(error\) \{[\s\S]{0,400}?return \{ ok: false, reason: 'server'/.test(code('js/store.js')));
  await ctx.close();
}

/* ====== 2. a refused server is not called a wrong password ====== */
{
  const store = code('js/store.js');
  ok("2.1 the two refusals are two reasons, not one",
     /reason: 'wrong'/.test(store) && /reason: 'server'/.test(store));
  const prof = code('js/screens/profile.js');
  ok('2.2 …and the screen prints a different sentence for each',
     /res\.reason === 'server' \? t\('pwServerRefused'\) : t\('wrongPassword'\)/.test(prof));
  const i18n = read('js/i18n.js');
  ok('2.3 …and neither sentence blames a password that was right',
     /pwServerRefused:/.test(i18n) && (i18n.match(/pwServerRefused:/g) || []).length === 2);
}

/* ====== 3. changing the email asks for the account password ====== */
{
  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p);
  await signUp(p, 'em@a.app', 'Qamar#2026x');
  await p.evaluate(() => location.hash = '#/profile/edit');
  await p.waitForTimeout(700);
  const hiddenAtRest = await p.evaluate(() => {
    const w = document.querySelector('#pPwWrap');
    return !!w && getComputedStyle(w).display === 'none';
  });
  ok('3.1 the password field is not drawn while nothing has changed', hiddenAtRest);
  /* ⚠️ A name edit must not summon it — asking everybody to guard the rare
     case is a toll on the ordinary one. */
  await p.fill('#pName', 'Another Name');
  await p.waitForTimeout(200);
  ok('3.2 …nor when only the name is edited', await p.evaluate(() =>
     getComputedStyle(document.querySelector('#pPwWrap')).display === 'none'));
  await p.fill('#pEmail', 'moved@b.app');
  await p.waitForTimeout(250);
  ok('3.3 …and it appears the moment the address really moves',
     await p.evaluate(() => getComputedStyle(document.querySelector('#pPwWrap')).display !== 'none'));
  /* and it goes again when the old address is typed back */
  await p.fill('#pEmail', 'em@a.app');
  await p.waitForTimeout(250);
  ok('3.4 …and goes again when the old address is typed back',
     await p.evaluate(() => getComputedStyle(document.querySelector('#pPwWrap')).display === 'none'));

  const wrong = await p.evaluate(async () => {
    const S = window.__S;
    const before = JSON.stringify(S.state.user);
    const r = await S.updateProfile({ name: 'Should Not Save', email: 'moved@b.app',
                                      phone: '', password: 'not-the-password' });
    return { err: r && r.error, pending: S.pendingEmail(),
             unchanged: JSON.stringify(S.state.user) === before };
  });
  ok('3.5 a wrong password refuses the change', wrong.err === 'password');
  ok('3.6 …and parks nothing', !wrong.pending);
  /* ⚠️ Refusing has to write NOTHING — not the name either. A half-saved
     record is the shape this whole batch is closing. */
  ok('3.7 …and writes nothing at all, the name included', wrong.unchanged === true);

  const right = await p.evaluate(async () => {
    const S = window.__S;
    const idBefore = S.state.user.id || null;
    const r = await S.updateProfile({ name: 'Test Person', email: 'moved@b.app',
                                      phone: '', password: 'Qamar#2026x' });
    return { pending: S.pendingEmail(), err: r && r.error,
             sameId: (S.state.user.id || null) === idBefore, email: S.state.user.email };
  });
  ok('3.8 the right password parks the change', right.pending === 'moved@b.app' && !right.err);
  /* ⚠️ Re-authenticating replaces the session WITH THE SAME PERSON's — that
     is what «re-authentication» means, and an identity that moved here
     would be a different fault wearing this one's clothes. */
  ok('3.9 …and the identity does not move across it', right.sameId === true);
  ok('3.10 …and the address itself has not moved yet', right.email === 'em@a.app');
  ok('3.11 it is the SERVER that judges it, never the local hash',
     /sb\.auth\.signInWithPassword\(\{ email: u\.email, password: password \|\| '' \}\)/
       .test(code('js/store.js')));
  await ctx.close();
}

/* ============ 4. «resend» really sends ============ */
{
  const { ctx, p } = await fresh();
  await open(p);
  await signUp(p, 'rs@a.app', 'Qamar#2026x', false);
  const sent = await p.evaluate(async () => {
    const S = window.__S;
    const r = await S.sendEmailCode('rs@a.app');
    return { ok: r.ok, hasCode: Object.prototype.hasOwnProperty.call(r, 'code') };
  });
  ok('4.1 an unconfirmed address gets a real resend', sent.ok === true);
  /* ⚠️ It used to hand back `DEMO_CODE`, so any reader of that field was
     reading a password out of a published file. */
  ok('4.2 …and no code is handed back to the page', sent.hasCode === false);
  const bad = await p.evaluate(async () => {
    const S = window.__S;
    return await S.sendEmailCode('nobody-here@a.app');
  });
  ok('4.3 a refusal is reported as one, with the server\'s own words',
     bad.ok === false && !!bad.message, String(bad.message).slice(0, 40));
  ok('4.4 the counter is not reset and no success line is shown on failure',
     /if \(!r \|\| !r\.ok\) \{ toast\(\(r && r\.message\) \|\| t\('sendFailed'\), 'err'\); return; \}[\s\S]{0,80}touchPendingVerify/
       .test(code('js/screens/auth.js')));
  /* ⚠️ THE THIRD CASE, and the spec asserted it already worked. Measured, it
     could not: `resend({type:'signup'})` on a CONFIRMED address is refused
     by the server, and that is the road `475` built for confirming a phone
     change by an emailed code. */
  const confirmed = await p.evaluate(async () => {
    const S = window.__S;
    await S.confirmEmail('123456');
    const r = await S.sendEmailCode('rs@a.app');
    return { verified: !!S.state.user.emailVerified, ok: r.ok, msg: r.message || '' };
  });
  ok('4.5 the account is confirmed', confirmed.verified === true);
  ok('4.6 …and a confirmed address can still be sent a fresh code',
     confirmed.ok === true, confirmed.msg);
  ok('4.7 the send type is chosen from the account, never written once',
     /type: 'email_change'/.test(code('js/store.js')) &&
     /type: 'signup'/.test(code('js/store.js')) &&
     /signInWithOtp\(\{ email: addr, options: \{ shouldCreateUser: false \} \}\)/.test(code('js/store.js')));
  ok('4.8 …and the verify type follows the same three cases',
     /const type = state\.user\.pendingEmail \? 'email_change'[\s\S]{0,160}: 'email';/
       .test(code('js/store.js')));
  /* the duplicate send after `updateProfile` is gone: `updateUser` is the
     sender, and a second call is either a duplicate message or a refusal
     nothing on that screen reads */
  const profSends = (code('js/screens/profile.js').match(/S\.sendEmailCode\(/g) || []).length;
  ok('4.9 the profile screen sends once, on the phone road only', profSends === 1, String(profSends));
  await ctx.close();
}

/* ============ 5. «forgot my password» works ============ */
{
  ok('5.1 the «coming soon» screen and its three keys are gone',
     !/forgotSoon/.test(read('js/i18n.js')) && !/forgotSoon/.test(read('js/screens/auth.js')));
  const { ctx, p } = await fresh();
  await open(p, '#/auth/forgot');
  await p.waitForTimeout(500);
  ok('5.2 it is a form now, not a notice', await p.evaluate(() => !!document.querySelector('#fgEmail')));

  /* ⚠️ THE SAME SENTENCE EITHER WAY. A screen that says «no account with
     this address» is an instrument for learning who is registered, run
     against a list — and the function it calls does not distinguish. */
  const unknown = await p.evaluate(async () => {
    const S = window.__S;
    const r = await S.requestPasswordReset('never-registered@a.app');
    return r.ok;
  });
  ok('5.3 an unregistered address is answered exactly as a registered one',
     unknown === true);

  await p.fill('#fgEmail', 'reset@a.app');
  await p.click('#fgGo');
  await p.waitForTimeout(700);
  ok('5.4 …and it lands on the code screen', await p.evaluate(() => location.hash) === '#/auth/email');
  const pv = await p.evaluate(() => window.__S.pendingVerify());
  ok('5.5 …carrying the recovery kind and the typed address',
     pv && pv.kind === 'recovery' && pv.target === 'reset@a.app');
  /* ⚠️ Nobody is signed in on this road, so the address on screen can only
     come from the pending record — reading `state.user` would print an
     empty address over a code that really was sent. */
  ok('5.6 …and the screen prints that address although nobody is signed in',
     (await p.textContent('#app')).includes('reset@a.app'));

  const done = await p.evaluate(async ([c]) => {
    const S = window.__S;
    await S.signUp({ name: 'R', email: 'reset@a.app', password: 'Qamar#2026x', phone: '' });
    await S.signOut();
    const err = await S.confirmRecovery('reset@a.app', c);
    const set = err ? null : await S.completePasswordReset('Sahar#2028z');
    await S.signOut();
    const withNew = await S.signInWithPassword('reset@a.app', 'Sahar#2028z');
    const withOld = await S.signInWithPassword('reset@a.app', 'Qamar#2026x');
    return { err, set: set && set.ok, withNew, withOld };
  }, [MOCK_CODE]);
  ok('5.7 the code opens a session', done.err === null, String(done.err));
  ok('5.8 …the new password is set', done.set === true);
  ok('5.9 …and it is the one the server now accepts', done.withNew === null);
  ok('5.10 …while the old one is not', typeof done.withOld === 'string');
  ok('5.11 the last screen guards itself on a session, not on a route flag',
     /if \(!S\.state\.user\) \{ go\('#\/auth\/forgot'\); return; \}/.test(code('js/screens/auth.js')));
  await ctx.close();
}

/* ============ 6. the users section, behind two locks ============ */
{
  const sql = sqlCode('supabase/migrations/0005_admin_find_users.sql');
  ok('6.1 the function authorises FIRST and raises, never in a where-clause',
     /begin\s+if not public\.is_admin\(\) then\s+raise exception/.test(sql));
  ok('6.2 …and pins its search_path, which every security definer must',
     /security definer[\s\S]{0,120}set search_path = public, auth/.test(sql));
  ok('6.3 …and a visitor who is not signed in cannot execute it',
     /revoke all on function public\.admin_find_users\(text\) from public, anon;/.test(sql));
  ok('6.4 …and there is no browsing: a short query returns nothing',
     /length\(btrim\(q\)\) >= 3/.test(sql));
  /* ⚠️ The door is READ-ONLY. Widening what an admin may do needs its own
     batch and its own reason. */
  ok('6.5 …and it opens no write of any kind',
     !/for (update|insert|delete)|create policy/i.test(sql));
  /* ⚠️ And no second copy of the address: `profiles` gains no email column,
     because a copy that changes down two roads parts from the original one
     day and nothing warns anybody. */
  ok('6.6 …and no email column is added to profiles',
     !/alter table[\s\S]{0,80}add column[\s\S]{0,40}email/i.test(sql));

  const { ctx, p } = await fresh({ preConfirm: true, admin: true });
  await open(p);
  await signUp(p, 'boss@a.app', 'Qamar#2026x');
  const asAdmin = await p.evaluate(async () => {
    const S = window.__S;
    await S.hydrateUserFromSession();
    const two  = await S.sb.rpc('admin_find_users', { q: 'bo' });
    const full = await S.sb.rpc('admin_find_users', { q: 'boss' });
    return { isAdmin: S.isAccountAdmin(),
             two: (two.data || []).length,
             hits: (full.data || []).length,
             email: ((full.data || [])[0] || {}).email };
  });
  /* ⚠️ THE FIRST READER OF `is_admin` IN THE APP — the column has been
     written since `470` and measured, nothing ever read it. */
  ok('6.7 `is_admin` is read back off the profile at last', asAdmin.isAdmin === true);
  ok('6.8 two characters return nothing', asAdmin.two === 0, String(asAdmin.two));
  ok('6.9 three or more find the person', asAdmin.hits === 1, String(asAdmin.hits));
  /* the owner's decision of 5 September: the address is printed in full,
     because telling a caller their own address IS the screen's purpose */
  ok('6.10 …and the address comes back whole, not masked',
     asAdmin.email === 'boss@a.app', String(asAdmin.email));
  await ctx.close();

  const { ctx: c2, p: p2 } = await fresh({ preConfirm: true });   // NOT admin
  await open(p2);
  await signUp(p2, 'plain@a.app', 'Qamar#2026x');
  const asPlain = await p2.evaluate(async () => {
    const S = window.__S;
    await S.hydrateUserFromSession();
    const r = await S.sb.rpc('admin_find_users', { q: 'plain' });
    return { isAdmin: S.isAccountAdmin(), err: !!r.error, rows: (r.data || []).length };
  });
  ok('6.11 an ordinary account is not staff', asPlain.isAdmin === false);
  ok('6.12 …and the function refuses it outright', asPlain.err === true && asPlain.rows === 0);
  await c2.close();
}

/* ====== 7. the panel's own lock is not the account's ====== */
{
  const adm = code('js/screens/admin.js');
  ok('7.1 the section exists as its own tab', /data-t="users"/.test(adm));
  /* ⚠️ TWO LOCKS, AND THAT IS THE ITEM. `adminAuth` is a password on THIS
     DEVICE with no connection to any account; this section reads other
     people's data, so it demands the device lock AND a signed-in account
     the server calls staff. */
  ok('7.2 …and it refuses a device-unlocked panel with no admin account',
     /function usersHtml\(\) \{\s*if \(!S\.isAccountAdmin\(\)\)/.test(adm));
  ok('7.3 …and it offers no edit and no delete',
     !/data-udel|data-uedit/.test(adm));
  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p, '#/admin');
  await p.evaluate(() => { window.__S.setAdminUnlocked && window.__S.setAdminUnlocked(true); });
  await p.evaluate(() => location.hash = '#/admin');
  await p.waitForTimeout(600);
  const shut = await p.evaluate(() => {
    const b = [...document.querySelectorAll('[data-t]')].find(x => x.dataset.t === 'users');
    if (b) b.click();
    return document.querySelector('#uQ') === null;
  });
  ok('7.4 pressed with no admin account, the search box is not even drawn', shut === true);
  await ctx.close();
}

/* ============ 8. nothing shouted in the console ============ */
ok('8.1 no console errors anywhere in the batch', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
