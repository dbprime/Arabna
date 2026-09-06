/* V.09.5 — the eleventh: a receipt link that matches nothing says why.

   `570` closed nine silent redirects, `571` the tenth. This is the
   eleventh, and how it was found is the point of the batch: the sweep
   that produced the tenth was written around the variable names the nine
   happened to use (`!b`, `!c`, `!a`, `!e`), so it could not see a guard
   written any other way. Re-swept with no assumption about the name,
   `ReceiptScreen` appeared at once — it uses `!r`.

   `#/receipt/<id>` with an id that matches no receipt for this account —
   an old link, or one saved from another device — bounced the reader to
   `#/receipts` with nothing said. Someone opening a receipt link they had
   kept lands in a general list and concludes the link is wrong.

   ⚠️ The destination does not change and the key is not new: `gone` was
   created by `570` and is reused word for word. The suite reads it from
   the pack rather than typing it.

   ⚠️ AND THE FAMILY IS NOW CLOSED, which this suite asserts rather than
   claims. Every remaining `if (!x) { go(…) }` in `js/` is a PERMISSION
   guard — it sends a reader to a page that DOES exist — and saying «this
   is no longer available» there would be false. That distinction is the
   thing most likely to be lost by whoever sweeps this class next, so it
   is measured here, not left in a comment. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';

/* ⚠️ never a relative path — run.sh runs from its own working directory,
   and v67 crashed there for exactly that while passing by hand. */
const ROOT = new URL('../../', import.meta.url).pathname;
const BASE = process.env.BASE || 'http://localhost:8099/index.html';
const SINGLE = /index-single-file/.test(BASE);
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const RECEIPT = { id: 'ARB-26-TEST1', at: Date.now(), kind: 'subscription',
                  description: 'test', amount: 29, tax: 0, method: 'card',
                  bizId: null, refId: null, covers: null, receivedBy: '',
                  reference: '', autoRenew: true, refundOf: null,
                  buyer: { name: 'x', email: 'a@b.c' }, status: 'paid' };

async function open(route, { receipts = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(({ rec }) => {
    const K = 'arabna.v1'; let s = {};
    try { s = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { /* */ }
    s.showDemo = true; s.demoDefaultOff = true;
    /* signed in — `receiptById` returns null to a visitor by design
       (V.05.2), and this suite is about a MISSING receipt, not that rule */
    s.user = { email: 'a@b.c', emailVerified: true, tier: 2, name: 'x',
               phone: '7134669182', phoneVerified: true };
    s.receipts = rec;
    localStorage.setItem(K, JSON.stringify(s));
  }, { rec: receipts });
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

/* ---------- 1) a receipt link that matches nothing ---------- */
{
  const { page, ctx } = await open('#/receipt/ARB-26-NOPE9', { receipts: [RECEIPT] });
  const seen = await toastText(page);
  const hash = await page.evaluate(() => location.hash);
  ok('1.1a a dead receipt id says why', seen.includes(GONE), seen || '(no toast)');
  ok('1.1b …and the destination is unchanged', hash === '#/receipts', hash);
  await ctx.close();
}

/* ---------- 2) and the guard does not speak without cause ---------- */
{
  const { page, ctx } = await open('#/receipt/' + RECEIPT.id, { receipts: [RECEIPT] });
  const seen = await toastText(page);
  const hash = await page.evaluate(() => location.hash);
  const body = await page.evaluate(() => document.body.textContent || '');
  ok('1.2a a receipt that exists raises no toast at all', seen === '', seen || 'silent');
  ok('1.2b …and the screen stays on it', hash === '#/receipt/' + RECEIPT.id, hash);
  ok('1.2c …and actually renders the receipt', body.includes(RECEIPT.id), RECEIPT.id);
  await ctx.close();
}

/* ---------- 3) the family is closed, and the exclusions are deliberate ---------- */
/* module build only: these read the sources, which are files on disk */
if (!SINGLE) {
  const dir = ROOT + 'js/screens/';
  const srcs = readdirSync(dir).filter(f => f.endsWith('.js'))
    .map(f => ['js/screens/' + f, readFileSync(dir + f, 'utf8')])
    .concat([['js/ui.js', readFileSync(ROOT + 'js/ui.js', 'utf8')],
             ['js/app.js', readFileSync(ROOT + 'js/app.js', 'utf8')]]);

  /* ⚠️ BY PATTERN, NOT BY NAME. This is the whole lesson of 571→572: a
     sweep shaped around `!b`/`!c`/`!a`/`!e` could not see `!r`. The
     variable is matched as ANY identifier. */
  const guards = [];
  for (const [f, src] of srcs)
    /* ⚠️ the body is matched as «anything up to the go(», not as an
       enumerated list of what may stand there. An earlier version of this
       very line used `toast\([^)]*\)` and could not match
       `toast(t('gone'), 'err')` — the inner `)` ended it — so it reported
       4 guards where there are 15. That is the batch's own fault committed
       inside the check that guards against it. */
    for (const m of src.matchAll(/if \(!([A-Za-z_$][A-Za-z0-9_$.()' +]*)\) \{[^{}]*go\('#\/[^']*'/g))
      guards.push({ f, whole: m[0], hasToast: /toast\(/.test(m[0]) });

  ok('3.1 the sweep finds guards of this shape at all', guards.length >= 10, String(guards.length));

  /* Everything still silent must be accounted for by CLASS, and there are
     exactly three classes that are allowed to be:
       - a PERMISSION guard: it redirects to a page that DOES exist, so
         «this is no longer available» would be false there;
       - an OPERATION that failed: nothing is missing, an action did not
         take. That wants its own sentence, not this one;
       - ⚠️ a PRECONDITION, added by 620 with the recovery flow: the last
         step of a password reset needs the session the code opened, and
         with none it sends the reader to the step that opens one. Nothing
         is missing there either — the road simply has a first half, and
         «this is no longer available» would be as false as it is for a
         permission guard. It is NAMED below, exactly as ownerOnly is, so
         that the class stays a decision and not a hole.
     ⚠️ Anything that is neither is a missing-record guard that lost its
     word, and that is the regression this line exists to catch. */
  const silent = guards.filter(g => !g.hasToast);
  const permission = silent.filter(g => /owns|adminUnlocked|\bok\b/.test(g.whole));
  const opFailed   = silent.filter(g => /boostClassified|primaryBusinessId/.test(g.whole));
  const precond    = silent.filter(g => /!S\.state\.user\) \{ go\('#\/auth\/forgot'/.test(g.whole));
  const unexplained = silent.filter(g =>
    !permission.includes(g) && !opFailed.includes(g) && !precond.includes(g));
  ok('3.2 every silent redirect left is a permission guard, a failed operation or a precondition',
     unexplained.length === 0,
     unexplained.map(g => g.f + ': ' + g.whole.slice(0, 46)).join(' | ')
       || `permission ${permission.length} · operation ${opFailed.length} · precondition ${precond.length}`);

  /* and the eleven that ARE missing-record guards all speak */
  ok('3.3 …and every missing-record guard carries the word',
     guards.filter(g => g.hasToast).length >= 11,
     String(guards.filter(g => g.hasToast).length));

  /* ⚠️ AND THE PRECONDITION IS NAMED TOO, for the same reason as ownerOnly:
     a class that matched by accident would let the next silent guard of a
     different shape in behind it. Exactly one is expected. */
  ok('3.2b …and the precondition class holds exactly the reset guard',
     precond.length === 1, String(precond.length));

  /* ⚠️ ownerOnly is named, so nobody "fixes" it into a lie later */
  const dirSrc = srcs.find(([f]) => f === 'js/screens/directory.js')[1];
  ok('3.4 ownerOnly is deliberately silent — it redirects to a page that exists',
     /if \(!ok\) \{ go\('#\/directory\/' \+ bizId\); return false; \}/.test(dirSrc));
} else {
  for (const n of ['3.1', '3.2', '3.2b', '3.3', '3.4']) ok(n + ' (source check, module build only)', true);
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
