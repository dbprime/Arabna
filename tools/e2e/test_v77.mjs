/* V.10.2 — 625: a field outside the rule, and a promise we cannot keep.
 *
 * ⚠️ BOTH WERE FOUND ON THE LIVE HOST, NOT BY THE NET — a batch that was
 * green all the way through, with two faults hitting the first person to
 * walk past. That is where this file sits, and it is said rather than
 * softened: what follows is the guard those two never had.
 *
 *  1  the ONE password field the app has outside `passwordField()` — and
 *     the helper it skipped carries the five attributes whose written
 *     reason is that autocorrect and the capitalised first letter break a
 *     password silently. So a correct password was refused, and the reader
 *     was told it was wrong. A fault nobody reports, because they believe
 *     they mistyped.
 *  2  «we sent a code» said on two roads that CANNOT KNOW whether anything
 *     was sent — Supabase refuses to say whether an address is taken, on
 *     purpose, so it answers success and mails nothing.
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
/* comments stripped before any «does the code do X» check — this file's own
   comments name the very strings and attributes it measures */
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SCREENS = ['js/screens/profile.js', 'js/screens/auth.js', 'js/screens/admin.js',
                 'js/screens/directory.js', 'js/screens/marketplace.js', 'js/ui.js', 'js/store.js'];

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
const signUp = (p, email, password) => p.evaluate(async ([e, pw, c]) => {
  const S = window.__S;
  const err = await S.signUp({ name: 'Test Person', email: e, password: pw, phone: '' });
  if (!err) await S.confirmEmail(c);
  return err;
}, [email, password, MOCK_CODE]).catch(e => 'threw:' + e.message);

/* ===== 1. every password field goes through the one helper ===== */
{
  /* ⚠️ THE STRUCTURAL ITEM, and it is the whole point rather than the one
     field: a batch corrected thirteen places against a single rule and
     then wrote the fourteenth outside it. The rule is not applied to what
     already exists — it is applied to what is written in the same moment. */
  const raw = [];
  for (const f of SCREENS)
    for (const m of code(f).matchAll(/<input[^>]*type="password"[^>]*>/g))
      raw.push({ f, s: m[0] });
  /* the helper's own element is the one that may be raw — it IS the helper */
  const outside = raw.filter(r => !/id="\$\{id\}"/.test(r.s));
  ok('1.1 no raw <input type="password"> anywhere in js/',
     outside.length === 0, outside.map(r => r.f + ': ' + r.s.slice(0, 44)).join(' | '));
  ok('1.2 …and the helper is the one that holds it', raw.length === 1, String(raw.length));

  const prof = code('js/screens/profile.js');
  ok('1.3 the field 620 wrote raw now calls the helper',
     /passwordField\('pPw', t\('accountPassword'\), 'current-password'\)/.test(prof));
  /* ⚠️ The eye was the SMALLEST thing it lost. These five are what keep a
     phone from capitalising the first letter and autocorrecting the rest —
     a password broken silently, and the reader told it was wrong. */
  for (const [n, a] of [['1.4', 'lang="en"'], ['1.5', 'autocapitalize="off"'],
                        ['1.6', 'autocorrect="off"'], ['1.7', 'spellcheck="false"'],
                        ['1.8', 'inputmode="text"']])
    ok(n + ' the helper carries ' + a, prof.includes(a));

  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p);
  await signUp(p, 'raw@a.app', 'Qamar#2026x');
  await p.evaluate(() => { location.hash = '#/profile/edit'; });
  await p.waitForTimeout(700);
  await p.fill('#pEmail', 'moved@b.app');
  await p.waitForTimeout(250);
  const attrs = await p.evaluate(() => {
    const el = document.querySelector('#pPw');
    if (!el) return null;
    return {
      cap: el.getAttribute('autocapitalize'), corr: el.getAttribute('autocorrect'),
      spell: el.getAttribute('spellcheck'), lang: el.getAttribute('lang'),
      mode: el.getAttribute('inputmode'), ac: el.getAttribute('autocomplete'),
      eye: !!document.querySelector('[data-eye="pPw"]'),
    };
  });
  ok('1.9 the rendered field carries all five and the right description',
     attrs && attrs.cap === 'off' && attrs.corr === 'off' && attrs.spell === 'false'
     && attrs.lang === 'en' && attrs.mode === 'text' && attrs.ac === 'current-password',
     JSON.stringify(attrs));
  ok('1.10 …and the eye is drawn', !!(attrs && attrs.eye));
  /* ⚠️ A button that does nothing is banned outright, and this screen had
     never wired the toggle — it had no password field until 620. */
  const eyeWorks = await p.evaluate(() => {
    const btn = document.querySelector('[data-eye="pPw"]');
    if (!btn) return 'no button';
    const before = document.querySelector('#pPw').type;
    btn.click();
    return before + '->' + document.querySelector('#pPw').type;
  });
  ok('1.11 …and it actually works', eyeWorks === 'password->text', String(eyeWorks));
  await ctx.close();
}

/* ===== 2. nothing claims a send it cannot prove ===== */
{
  const i18n = read('js/i18n.js');
  /* ⚠️ NAMED KEYS, not a sweep of every «sent» in the pack: sign-up really
     does know — the address is new and the server mailed it — so the claim
     is true there and must stay. These two are the roads where Supabase
     answers success and mails nothing. */
  for (const [n, k] of [['2.1', 'emailChangeSent'], ['2.2', 'recoverySub'], ['2.3', 'changeSub']]) {
    const lines = (i18n.match(new RegExp("\\n\\s*" + k + ": '[^']*'", 'g')) || []);
    ok(n + ' `' + k + '` claims nothing it cannot prove, in both packs',
       lines.length === 2 && lines.every(l => !/أرسلنا|We sent/.test(l)),
       lines.map(l => l.trim()).join(' | ').slice(0, 130));
  }
  ok('2.4 …while sign-up, which DOES know, still says so',
     (i18n.match(/\n\s*verifyEmailSub: '[^']*'/g) || [])
       .every(l => /أرسلنا|We sent/.test(l)));

  /* ⚠️ `supabase-js` returns `{ data, error }` and never throws, so the
     try/catch that stood here caught nothing and every failure — a rate
     limit, a refusal, a dropped connection — passed as success. */
  const store = code('js/store.js');
  ok('2.5 the error from updateUser is read, not thrown away',
     /const \{ error: mailErr \} = await sb\.auth\.updateUser\(\{ email \}\)/.test(store));
  ok('2.6 …and no try/catch is left wrapping it',
     !/try \{ await sb\.auth\.updateUser\(\{ email \}\); \} catch/.test(store));
  /* ⚠️ And «stays parked on a network failure» is NOT reversed — it is
     written with its reason: the old address still works. */
  ok('2.7 …and the change still parks, which was never the fault',
     /u\.pendingEmail = email;[\s\S]{0,400}?updateUser\(\{ email \}\)/.test(store));

  const { ctx, p } = await fresh({ preConfirm: true });
  await open(p);
  await signUp(p, 'say@a.app', 'Qamar#2026x');
  const r = await p.evaluate(async () => {
    const S = window.__S;
    return await S.updateProfile({ name: 'Test Person', email: 'other@b.app',
                                   phone: '', password: 'Qamar#2026x' });
  });
  ok('2.8 a good change reports no send error', !r.emailSendError, String(r.emailSendError));
  ok('2.9 …and is parked', r.emailPending === true);

  /* the three roads on the code screen, each with its own sentence */
  await p.evaluate(() => { window.__S.setPendingVerify('email', 'other@b.app'); location.hash = '#/auth/email'; });
  await p.waitForTimeout(700);
  const changeTxt = await p.textContent('#app');
  ok('2.10 the change road does not claim a send', !/أرسلنا/.test(changeTxt), changeTxt.slice(0, 60));
  /* ⚠️ AND THE WAY OUT IS WHERE THE PERSON IS STANDING. «Browse now and
     finish later» leaves the address parked, and the only undo lived on a
     screen the reader has no reason to know they must go to. */
  ok('2.11 …and it offers the cancel, on this very screen',
     await p.evaluate(() => !!document.querySelector('#vCancelEmail')));
  const undone = await p.evaluate(async () => {
    document.querySelector('#vCancelEmail').click();
    await new Promise(r => setTimeout(r, 500));
    return { pending: window.__S.pendingEmail(), hash: location.hash };
  });
  ok('2.12 …and pressing it really unparks the address',
     !undone.pending && undone.hash === '#/profile', JSON.stringify(undone));

  /* recovery: nobody signed in, and it may not claim either.
     ⚠️ The hash is set from a DIFFERENT route each time: assigning the hash
     it already holds fires no `hashchange`, so the screen would not repaint
     and the check would measure the previous road. */
  await p.evaluate(() => { window.__S.setPendingVerify('recovery', 'who@b.app'); location.hash = '#/profile'; });
  await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/auth/email'; });
  await p.waitForTimeout(600);
  const recTxt = await p.textContent('#app');
  ok('2.13 the recovery road does not claim a send either', !/أرسلنا/.test(recTxt));
  ok('2.14 …and offers no email-change cancel, because none is parked',
     await p.evaluate(() => !document.querySelector('#vCancelEmail')));

  /* sign-up: the one road that DOES know */
  await p.evaluate(async () => {
    const S = window.__S;
    S.cancelEmailChange();
    S.state.user.emailVerified = false;
    S.setPendingVerify('email', S.state.user.email);
    location.hash = '#/profile';
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/auth/email'; });
  await p.waitForTimeout(600);
  ok('2.15 …and sign-up still says «we sent», because it can',
     /أرسلنا/.test(await p.textContent('#app')));
  await ctx.close();
}

/* ===== 3. nothing shouted in the console ===== */
ok('3.1 no console errors anywhere in the batch', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
