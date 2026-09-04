/* V.09.4 — the tenth that the nine missed: a claim link to a business that
   is gone now says so.

   `570` fixed nine places that redirected without a word. This is a tenth
   of exactly the same class, found by the audit that produced `570` and
   deliberately left untouched there — the project's rule is that what is
   discovered outside a running batch is recorded, not fixed inside it.

   `ClaimScreen` opens from `#/claim/<id>`. With an id in the link that no
   longer resolves — a business deleted or hidden after somebody was sent
   its claim link — it bounced the reader to `#/claim`, the pick-a-business
   list, with nothing said. Someone who arrived meaning to claim their own
   shop lands in a general list and concludes the link they hold is wrong,
   or that the app is broken.

   ⚠️ The destination does not change: `#/claim` is the right place. What
   was missing is the sentence, not the road — the same finding as `570`.

   ⚠️ AND THE KEY IS NOT NEW. `gone` was created by `570` for the nine, and
   this tenth reuses it word for word: one sentence serves a business, a
   listing, an article, an event and a claim alike, and four texts would be
   four things to translate and four things to go stale. The suite reads it
   from the pack rather than typing it. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

/* ⚠️ never a relative path — run.sh runs from its own working directory,
   and v67 crashed there for exactly that while passing by hand. */
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
async function open(route, { claims = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(({ cl }) => {
    const K = 'arabna.v1'; let s = {};
    try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    s.showDemo = true; s.demoDefaultOff = true;
    /* tier 2 — the claim form is gated on a verified number, and this
       suite is about the guard above that gate, not the gate itself */
    s.user = { email: 'a@b.c', emailVerified: true, tier: 2, name: 'x',
               phone: '7134669182', phoneVerified: true };
    if (cl) s.claims = cl;
    localStorage.setItem(K, JSON.stringify(s));
  }, { cl: claims });
  const page = await ctx.newPage();
  await page.route('**://fonts.g*/**', r => r.abort());
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return { page, ctx };
}
const toastText = p => p.evaluate(() => {
  const el = document.querySelector('.toast-root');
  return el ? (el.textContent || '').trim() : '';
});

/* the sentence is read from the pack, never written here */
const { page: p0, ctx: c0 } = await open('#/home');
const GONE = await p0.evaluate(async () => {
  let I; try { I = await import('arabna/js/i18n.js'); } catch (e) { I = await import('./js/i18n.js'); }
  return I.STRINGS.ar.gone;
});
await c0.close();
ok('0.1 the key `gone` exists — created by 570, reused here', !!GONE, GONE || '');

/* ---------- 1) a claim link to something that is gone ---------- */
{
  const { page, ctx } = await open('#/claim/zzz-not-a-real-id');
  const seen = await toastText(page);
  const hash = await page.evaluate(() => location.hash);
  ok('1.1a a dead claim id says why', seen.includes(GONE), seen || '(no toast)');
  ok('1.1b …and the destination is unchanged', hash === '#/claim', hash);
  await ctx.close();
}

/* ---------- 2) and the guard does not speak without cause ---------- */
{
  const { page, ctx } = await open('#/claim/b30');
  const seen = await toastText(page);
  const hash = await page.evaluate(() => location.hash);
  ok('1.2a a business that exists raises no toast at all', seen === '', seen || 'silent');
  ok('1.2b …and the screen stays on that business', hash === '#/claim/b30', hash);
  await ctx.close();
}

/* ---------- 3) the pending branch below it is untouched ---------- */
{
  const claims = [{ id: 'cl-test', bizId: 'b30', status: 'pending', when: Date.now(), reason: '' }];
  const { page, ctx } = await open('#/claim/b30', { claims });
  const seen = await toastText(page);
  const body = await page.evaluate(() => document.body.textContent || '');
  const pendingWord = await page.evaluate(async () => {
    let I; try { I = await import('arabna/js/i18n.js'); } catch (e) { I = await import('./js/i18n.js'); }
    return I.STRINGS.ar.claimPending;
  });
  ok('1.3a a pending claim still shows its own screen', body.includes(pendingWord), pendingWord);
  ok('1.3b …and no toast fires on it either', seen === '', seen || 'silent');
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
