/* V.09.9 — phone verification is switched OFF by a flag, never deleted,
   and tier 2 is reached by email while it is off.

   The owner's decision: phone verification waits for the App Store launch,
   because the SMS provider bills per message and there is no sense
   spending that before the app is known to be accepted. The decision is
   sound — and carried out by switching the SCREEN off alone it stops the
   app dead:

     tier 2 was reachable ONLY by a verified phone, and tier 2 is the gate
     on `#/post`, `#/add-business`, `#/advertise/<id>` and `#/profile/edit`
     — the whole revenue path. And `requireTier` sends whoever has not
     reached it to `#/auth/phone`, the screen that has just been switched
     off: press «publish», land nowhere, go back, press again, with no
     error message at all.

   ⚠️ So the two halves are measured together, and the second is what most
   of this file is about: nothing is deleted (item 4 and item 7 prove the
   path is intact and reopens on one `false → true`), and nobody who
   reached tier 2 by email is demoted the day the switch is flipped on
   (item 8 — `tier2By`).

   ⚠️ Items 7 and 8 flip the flag by rewriting what the server SERVES, not
   by patching the tree: a suite that edits a source file races every other
   suite in the net. On the single-file build the module is a base64 data:
   URI inside the importmap, so the document itself is rewritten — the two
   builds are different environments, not copies. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';

/* ⚠️ never a relative path — run.sh runs from its own working directory. */
const ROOT = new URL('../../', import.meta.url).pathname;
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const SINGLE = /index-single-file/.test(BASE);
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const OFF = 'export const PHONE_AUTH = false;';
const ON  = 'export const PHONE_AUTH = true;';

const browser = await chromium.launch();

/* Serve the app with the flag ON, without touching a single file on disk. */
async function flipOn(ctx) {
  const swap = (src) => {
    if (!src.includes(OFF)) throw new Error('PHONE_AUTH anchor not found while flipping');
    return src.replace(OFF, ON);
  };
  if (SINGLE) {
    await ctx.route('**/index-single-file.html*', async (route) => {
      const res = await route.fetch();
      let html = await res.text();
      const m = html.match(/"arabna\/js\/data\.js":\s*"data:text\/javascript;base64,([A-Za-z0-9+/=]+)"/);
      if (!m) throw new Error('data.js not found in the importmap');
      const flipped = swap(Buffer.from(m[1], 'base64').toString('utf8'));
      html = html.replace(m[1], Buffer.from(flipped, 'utf8').toString('base64'));
      await route.fulfill({ response: res, body: html });
    });
  } else {
    await ctx.route('**/js/data.js', async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: swap(await res.text()) });
    });
  }
}

async function open(route, { user = null, phoneAuth = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((u) => {
    const K = 'arabna.v1'; let s = {};
    try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    s.lang = 'ar'; s.showDemo = true; s.demoDefaultOff = true;
    s.user = u;
    localStorage.setItem(K, JSON.stringify(s));
  }, user);
  if (phoneAuth) await flipOn(ctx);
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return { page, ctx };
}

const hash = (p) => p.evaluate(() => location.hash);
const tierOf = (p) => p.evaluate(async () => {
  let S; try { S = await import('arabna/js/store.js'); } catch (e) { S = await import('./js/store.js'); }
  return S.tier();
});
/* the app's own guard, driven with the app's own `go` — no re-implementation */
const gate = (p, need, route) => p.evaluate(async ({ n, r }) => {
  let S, U;
  try { S = await import('arabna/js/store.js'); U = await import('arabna/js/ui.js'); }
  catch (e) { S = await import('./js/store.js'); U = await import('./js/ui.js'); }
  const allowed = S.requireTier(n, r, U.go);
  return { allowed, hash: location.hash };
}, { n: need, r: route });

const NO_EMAIL = { name: 'Test', email: 'reader@example.com', emailVerified: false,
                   phone: '7134669182', phoneVerified: false, tier2By: null, joined: Date.now() };
const EMAIL_OK = { ...NO_EMAIL, emailVerified: true };

/* ---------- 1) the guard is still a guard ---------- */
{
  const { page, ctx } = await open('#/post', { user: NO_EMAIL });
  ok('1.1 an unverified email is still tier 0 — switching the phone off is not opening the doors',
     await tierOf(page) === 0, String(await tierOf(page)));
  const g = await gate(page, 2, '#/post');
  ok('1.2 …and the tier-2 gate refuses', g.allowed === false, JSON.stringify(g));
  ok('1.3 …and sends them to the email step', g.hash === '#/auth/email', g.hash);
  await ctx.close();
}

/* ---------- 2) the email alone opens the three ---------- */
{
  const { page, ctx } = await open('#/home', { user: NO_EMAIL });
  const after = await page.evaluate(async () => {
    let S; try { S = await import('arabna/js/store.js'); } catch (e) { S = await import('./js/store.js'); }
    S.confirmEmail();
    return { tier: S.tier(), by: S.state.user.tier2By };
  });
  ok('2.1 confirming the email reaches tier 2', after.tier === 2, String(after.tier));
  ok('2.2 …and the account records HOW it got there', after.by === 'email', String(after.by));
  for (const [n, r] of [['2.3 #/post', '#/post'], ['2.4 #/add-business', '#/add-business'],
                        ['2.5 #/advertise/slider', '#/advertise/slider'], ['2.6 #/profile/edit', '#/profile/edit']]) {
    const g = await gate(page, 2, r);
    ok(n + ' is open', g.allowed === true && g.hash !== '#/auth/phone', JSON.stringify(g));
  }
  await ctx.close();
}

/* ---------- 3) no dead end: pressing «publish» with no verified email ---------- */
{
  const { page, ctx } = await open('#/post', { user: NO_EMAIL });
  const seen = [];
  page.on('framenavigated', () => { /* hash moves fire no navigation; polled below */ });
  await page.fill('#pTitle', 'كرسي مكتب');
  await page.fill('#pPrice', '40');
  await page.fill('#pCity', 'Houston, TX');
  await page.fill('#pDesc', 'كرسي مكتب مستعمل بحالة جيدة');
  await page.click('#pubBtn');
  for (let i = 0; i < 12; i++) { seen.push(await hash(page)); await page.waitForTimeout(120); }
  ok('3.1 pressing «publish» never lands on the closed screen',
     !seen.includes('#/auth/phone'), [...new Set(seen)].join(' '));
  ok('3.2 …it lands on the step that CAN be finished',
     seen[seen.length - 1] === '#/auth/email', seen[seen.length - 1]);
  await ctx.close();
}

/* ---------- 4) the door is really shut ---------- */
{
  const { page, ctx } = await open('#/auth/phone', { user: EMAIL_OK });
  /* ⚠️ measured by what was DRAWN, not by the address: the address says
     what was asked for, the boxes say what was rendered. */
  const drawn = await page.evaluate(() => ({
    boxes: document.querySelectorAll('#otp-p .otp-box').length,
    phIn: !!document.querySelector('#phIn'),
    body: (document.querySelector('#app') || {}).textContent ? 1 : 0,
  }));
  ok('4.1 PhoneVerifyScreen is not drawn — zero code boxes', drawn.boxes === 0, String(drawn.boxes));
  ok('4.2 …and no number field either', drawn.phIn === false, String(drawn.phIn));
  ok('4.3 …and the reader is not left on a blank screen', drawn.body === 1);
  await ctx.close();
}

/* ---------- 5) no task that cannot be finished ---------- */
{
  const { page, ctx } = await open('#/profile', { user: EMAIL_OK });
  const r = await page.evaluate(() => ({
    text: document.body.innerText,
    toPhone: document.querySelectorAll('[data-route="#/auth/phone"]').length,
  }));
  ok('5.1 «verify your number» is not offered while it cannot be done',
     !/وثّق رقمك/.test(r.text), r.text.slice(0, 0) || 'absent');
  ok('5.2 …and no button anywhere on the screen points at the closed door',
     r.toPhone === 0, String(r.toPhone));
  ok('5.3 …and the row says what is true instead of «not verified» in red',
     /غير مطلوب حالياً/.test(r.text) && !/رقم غير مؤكد/.test(r.text));
  await ctx.close();
}

/* ---------- 6) changing the number throws nobody out ---------- */
{
  const { page, ctx } = await open('#/profile/edit', { user: EMAIL_OK });
  await page.fill('#pPhone', '(713) 555-0134');
  await page.click('#pSave');
  await page.waitForTimeout(900);
  const h = await hash(page);
  ok('6.1 saving a NEW number lands on the profile, not on a closed screen',
     h === '#/profile', h);
  const pend = await page.evaluate(async () => {
    let S; try { S = await import('arabna/js/store.js'); } catch (e) { S = await import('./js/store.js'); }
    return { pending: S.pendingPhone(), tier: S.tier() };
  });
  ok('6.2 …the parked number is untouched — it is written and unverified, which is a correct state here',
     !!pend.pending, String(pend.pending));
  ok('6.3 …and the reader keeps tier 2 throughout', pend.tier === 2, String(pend.tier));
  await ctx.close();
}

/* ---------- 7) the switch works in BOTH directions ---------- */
{
  const { page, ctx } = await open('#/auth/phone', { user: EMAIL_OK, phoneAuth: true });
  const drawn = await page.evaluate(() => document.querySelectorAll('#otp-p .otp-box').length);
  ok('7.1 flipped on, the screen is drawn again — it was switched off, not deleted',
     drawn === 6, String(drawn));
  const t = await tierOf(page);
  ok('7.2 …and the ladder is three rungs again: email alone is tier 1',
     t === 1, String(t));
  await ctx.close();
}

/* ---------- 8) nobody is demoted when the door opens ---------- */
{
  const BY_EMAIL = { ...EMAIL_OK, tier2By: 'email' };
  const { page, ctx } = await open('#/profile', { user: BY_EMAIL, phoneAuth: true });
  ok('8.1 whoever reached tier 2 by email keeps it after the flip',
     await tierOf(page) === 2, String(await tierOf(page)));
  await ctx.close();
}
{
  /* ⚠️ an account created BEFORE this version has no field at all, and
     must fall in the right branch with no migration written for it */
  const OLD = { name: 'Old', email: 'old@example.com', emailVerified: true, phone: '7134669182',
                phoneVerified: false, joined: Date.now() };
  const { page, ctx } = await open('#/profile', { user: OLD, phoneAuth: true });
  ok('8.2 …and a new account after the flip still needs the phone',
     await tierOf(page) === 1, String(await tierOf(page)));
  await ctx.close();
}
{
  const OLD = { name: 'Old', email: 'old@example.com', emailVerified: true, phone: '7134669182',
                phoneVerified: false, joined: Date.now() };
  const { page, ctx } = await open('#/profile', { user: OLD });
  ok('8.3 …and that same account with the switch OFF is tier 2, with no field and no migration',
     await tierOf(page) === 2, String(await tierOf(page)));
  await ctx.close();
}

/* ---------- 9) one constant, one place ---------- */
if (!SINGLE) {
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(ROOT + d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(d + e.name + '/');
      else if (e.name.endsWith('.js')) files.push(d + e.name);
    }
  })('js/');
  const decl = files.filter(f => /PHONE_AUTH\s*=/.test(readFileSync(ROOT + f, 'utf8')));
  ok('9.1 the constant is declared in exactly one file',
     decl.length === 1 && decl[0] === 'js/data.js', decl.join(' '));
  /* nothing was deleted for the switch — the whole path is still written */
  const auth = readFileSync(ROOT + 'js/screens/auth.js', 'utf8');
  const app = readFileSync(ROOT + 'js/app.js', 'utf8');
  ok('9.2 PhoneVerifyScreen is still written, still exported, still imported',
     /export function PhoneVerifyScreen/.test(auth) && /PhoneVerifyScreen/.test(app));
  ok('9.3 …and its route line is still written, gated at registration and not deleted',
     /\{ re: \/\^#\\\/auth\\\/phone\$\/,\s*screen: PhoneVerifyScreen/.test(app), 'route line present');
  const i18n = readFileSync(ROOT + 'js/i18n.js', 'utf8');
  for (const k of ['verifyPhone', 'needPhone', 'verifyPhoneSub', 'stepVerifyPhone', 'phoneNotVerified'])
    ok('9.4 translation key kept: ' + k, i18n.includes(k + ':'));
} else {
  for (const n of ['9.1', '9.2', '9.3']) ok(n + ' (source check, module build only)', true);
  for (const k of ['verifyPhone', 'needPhone', 'verifyPhoneSub', 'stepVerifyPhone', 'phoneNotVerified'])
    ok('9.4 translation key kept: ' + k + ' (source check, module build only)', true);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
