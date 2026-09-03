/* V.05.2 — signing out did not end ownership on the device.

   Reported by the daily check and reproduced by pressing, not by reading.
   A reader signed out; the app was reopened on the same phone with no
   account, and:

     #/receipts          showed the previous account's ARB-26-5UQQ4 · $29
     #/my-subscription   «فعّال · $29 شهرياً · مطعم الشام»
     #/business/edit/b1  opened the owner's edit form

   …and worse than reading: pressing «إلغاء الاشتراك» and confirming set
   `cancelAtPeriodEnd = true`. A visitor did not merely read a stranger's
   account, they acted on it. The contradiction in one line:

     isLoggedIn() false · tier() 0 · ownsBusiness('b1') TRUE

   The rule is the second half of the one 195 landed: device preferences
   are not the account's, AND what the account owns is not the device's.

   ⚠️ A ROUTE GUARD WAS THE WRONG ANSWER, and v38 · 1.1b says why:
   `#/receipts` and `#/my-subscription` are deliberately NOT gated — a
   page that sells stays open and the gate stands at the payment. So the
   guard went into the DATA readers instead, which is stronger: it closes
   the leak on a device that still carries the old state, with no
   `signOut` ever having run. That case is asserted here too (block 4). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const NOW = Date.now();
const OWNER = {
  user: { name: 'أحمد', email: 'a@b.c', emailVerified: true, phone: '7134669182',
          phoneVerified: true, joined: NOW - 9e8 },
  myBusinessIds: ['b1'],
  subscription: { businessId: 'b1', plan: 'monthly', price: 29, status: 'active',
                  since: NOW - 9e8, trialEndsAt: NOW - 8e8, currentPeriodEnd: NOW + 2.6e9,
                  cancelAtPeriodEnd: false, invoices: [] },
  cardOnFile: { last4: '4242', brand: 'visa' },
  receipts: [{ id: 'ARB-26-5UQQ4', at: NOW - 9e8, amount: 29, kind: 'subscription' }],
  saved: ['b3'], blocked: [{ key: 'x', label: 'فلان', when: NOW }],
  myAds: [{ id: 'a1', product: 'slider' }],
  // the device's own, and the operator's — none of it a reader's to lose
  fontScale: 21, theme: 'light', location: { zip: '', city: 'Katy', state: 'TX' },
  geoGranted: true, geo: { lat: 29.78, lng: -95.82, at: NOW },
  adminAuth: { user: 'arabna.admin', pass: 'x' }, businessEdits: { b5: { phone: '1' } },
  bizPhotos: { b7: [{ url: 'u', status: 'approved' }] }, seasons: { ramadan: true },
};

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
};
/* On the single-file build the modules live behind an importmap, so
   `./js/store.js` fetches the file again and hands back a SECOND instance
   with its own state. `arabna/…` reaches the app's own. */
const mount = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
});
/* ⚠️ THE INVENTED DATA IS ON FOR THIS SUITE, and it goes into the seed
   rather than coming from the shared helper: `reopen` below seeds only
   when the key is ABSENT, and a helper that creates the key first would
   make it skip the whole fixture. And `b1` — a demo record — is this
   suite's fixture: with the data off it does not exist, so
   `#/business/edit/b1` lands on `#/directory` and 4.11 reads as a fault
   that is not one. ⚠️ `demoDefaultOff` is the half that is easy to miss:
   without it the boot migration turns the switch straight back off. */
const DEMO_ON = { showDemo: true, demoDefaultOff: true };
const openWith = async (state) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => localStorage.setItem('arabna.v1', JSON.stringify(s)),
                          Object.assign({}, DEMO_ON, state));
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + '#/home', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500); await mount(p);
  return { ctx, p };
};
/* Reopening must NOT re-seed, or the sign-out is undone by the next
   navigation — that is what `addInitScript` does on every load. So the
   storage is carried across by hand, which is also what closing and
   reopening the app really is. */
const reopen = async (storage) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => { if (!localStorage.getItem('arabna.v1')) localStorage.setItem('arabna.v1', s); }, storage);
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + '#/home', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500); await mount(p);
  return { ctx, p };
};
const disk = p => p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')));
const store = p => p.evaluate(() => { const S = window.__S; return {
  logged: S.isLoggedIn(), tier: S.tier(), owns: S.ownsBusiness('b1'),
  sub: S.subscription(), receipts: S.receipts().length,
  receiptById: S.receiptById('ARB-26-5UQQ4') }; });
const screen = async (p, route) => { await p.evaluate(r => location.hash = r, route);
  await p.waitForTimeout(750);
  return p.evaluate(() => ({ hash: location.hash,
    txt: (document.querySelector('#app') || document.body).innerText.replace(/\s+/g, ' '),
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()) })); };

/* ---- 1. the owner still has everything ---------------------------- */
let { ctx, p } = await openWith(OWNER);
let s = await store(p);
const keysBefore = Object.keys(await disk(p)).sort().join(',');
ok('1.1 signed in, ownership holds', s.logged && s.owns && !!s.sub && s.receipts === 1);
let sc = await screen(p, '#/receipts');
ok('1.2 …and the receipt is on the screen', /ARB-26-5UQQ4/.test(sc.txt));

/* ---- 2. signing out clears what the ACCOUNT owned ------------------ */
/* read before, so 3.1 can assert that signOut left it exactly as it was —
   the boot has already reset the theme by this point, and that is the
   launch's doing and not the sign-out's */
const themeBeforeSignOut = (await disk(p)).theme;
await p.evaluate(() => window.__S.signOut());
await p.waitForTimeout(200);
let d = await disk(p);
/* REVERSED in V.05.4: ownership became a LIST — one account may own several
   listings — so the default is [] and not null. The check is the same check. */
ok('2.1 myBusinessIds back to default', Array.isArray(d.myBusinessIds) && d.myBusinessIds.length === 0,
  JSON.stringify(d.myBusinessIds));
ok('2.2 subscription back to default', d.subscription === null, String(d.subscription));
ok('2.3 cardOnFile back to default', d.cardOnFile === null, String(d.cardOnFile));
ok('2.4 saved · blocked · myAds emptied',
  (d.saved || []).length === 0 && (d.blocked || []).length === 0 && (d.myAds || []).length === 0,
  `${(d.saved||[]).length}/${(d.blocked||[]).length}/${(d.myAds||[]).length}`);
ok('2.5 user is gone', d.user === null);
/* «تُحجَب ولا تُمحى» — an accounting record is not a reader's to delete */
ok('2.6 the receipt is STILL on disk', (d.receipts || []).length === 1,
  (d.receipts || []).length + ' on disk');

/* ---- 3. …and keeps what belongs to the DEVICE and the operator ----- */
/* ⚠️ ADJUSTED in V.06.0, and the rule it guards is UNCHANGED: device
   preferences are not the account's and signing out does not touch them.
   What changed is that the theme is cleared to `auto` at every BOOT — so
   the seeded «light» is already `auto` before signOut ever runs, and
   asserting «light» here would be measuring the boot, not the sign-out.
   So it asserts what 225 actually bought: signOut left the theme exactly
   as it found it. The font size, which the boot does not touch, still
   carries its real value across. */
ok('3.1 theme and font size survive (the 195 rule)',
  d.theme === themeBeforeSignOut && d.fontScale === 21,
  `${d.theme} (was ${themeBeforeSignOut}) · ${d.fontScale}`);
ok('3.2 the location survives — nobody is asked twice',
  d.location && d.location.city === 'Katy' && d.geoGranted === true && !!d.geo);
ok('3.3 the admin password is not a reader\'s to clear', !!d.adminAuth);
ok('3.4 the admin\'s own edits are untouched',
  Object.keys(d.businessEdits || {}).length === 1 &&
  Object.keys(d.bizPhotos || {}).length === 1 && d.seasons.ramadan === true);
/* Signing out RESETS keys, it never removes them: a missing key reads as
   `undefined` at every call site instead of as the default the file
   declares, and that is a second bug wearing the first one's clothes. */
ok('3.5 not one key was dropped, only reset',
  Object.keys(d).sort().join(',') === keysBefore,
  Object.keys(d).length + ' keys, same set');

const carried = await p.evaluate(() => localStorage.getItem('arabna.v1'));
await ctx.close();

/* ---- 4. reopened with no account: the data does not answer --------- */
({ ctx, p } = await reopen(carried));
s = await store(p);
ok('4.1 isLoggedIn and ownsBusiness AGREE', !s.logged && !s.owns,
  `logged ${s.logged} · owns ${s.owns}`);
ok('4.2 subscription() returns null', s.sub === null);
ok('4.3 receipts() returns nothing', s.receipts === 0);
ok('4.4 receiptById() answers nobody', s.receiptById === null);

sc = await screen(p, '#/receipts');
ok('4.5 #/receipts opens — it is not gated (v38 · 1.1b)', sc.hash === '#/receipts');
ok('4.6 …on a designed empty state, with no amount and no number',
  !/ARB-26-5UQQ4/.test(sc.txt) && !/\$29/.test(sc.txt), sc.txt.slice(0, 40));

sc = await screen(p, '#/my-subscription');
ok('4.7 #/my-subscription opens too', sc.hash === '#/my-subscription');
ok('4.8 …with no plan, no price and no business name',
  !/\$29/.test(sc.txt) && !/مطعم الشام/.test(sc.txt), sc.txt.slice(0, 40));
/* the button was not merely reachable — pressing it and confirming set
   cancelAtPeriodEnd true on somebody else's subscription */
ok('4.9 …and no «إلغاء الاشتراك» button is drawn at all',
  !sc.buttons.some(b => /إلغاء الاشتراك/.test(b)),
  JSON.stringify(sc.buttons.filter(b => /اشتراك|بطاقة/.test(b))));
ok('4.10 …and the selling door is still there', /اشترك/.test(sc.txt));

sc = await screen(p, '#/business/edit/b1');
ok('4.11 the owner\'s edit form redirects to the business page',
  sc.hash === '#/directory/b1', sc.hash);
await ctx.close();

/* ---- 5. a device carrying the old state, with NO signOut ----------- */
/* This is what a route guard could not have fixed: nothing ran, the
   state was simply already written on the phone. */
({ ctx, p } = await openWith(Object.assign({}, OWNER, { user: null })));
s = await store(p);
ok('5.1 old state on disk, no account: ownership is false', !s.owns);
ok('5.2 …subscription() and receipts() answer nobody',
  s.sub === null && s.receipts === 0);
sc = await screen(p, '#/receipts');
ok('5.3 …and the screen shows no receipt', !/ARB-26-5UQQ4/.test(sc.txt));
await ctx.close();

/* ---- 6. signing back in gets it all back --------------------------- */
({ ctx, p } = await openWith(OWNER));
s = await store(p);
ok('6.1 the receipt is readable again, and none is missing',
  s.receipts === 1 && !!s.receiptById, s.receipts + ' receipt(s)');
ok('6.2 …and ownership is back', s.owns && !!s.sub);
await ctx.close();

/* ---- 7. somebody who never signed in ------------------------------- */
({ ctx, p } = await openWith({}));
s = await store(p);
ok('7.1 a fresh visitor is unchanged and nothing breaks',
  !s.logged && !s.owns && s.sub === null && s.receipts === 0);
for (const r of ['#/receipts', '#/my-subscription', '#/subscribe', '#/profile']) {
  const v = await screen(p, r);
  ok('7.2 ' + r + ' does not break', v.txt.trim().length > 10, v.hash);
}
await ctx.close();

ok('99 zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
