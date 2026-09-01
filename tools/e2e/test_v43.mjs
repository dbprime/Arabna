/* V.05.4 — the second approval was shredding the first.

   Rai asked about a restaurant with three branches, each with its own
   phone number, and then about one owner trading under three different
   names. Neither is a verification problem — a code sent to the LISTING's
   own number proves control per listing, and the name never enters it.
   The question exposed something one step further on:

     approveClaim →  state.myBusinessId = c.bizId;      REPLACES

   So the admin approved three and the account ended up owning one, while
   the line below it had already marked all three `claimed: true`. And in
   `directory.js`:

     if (b.claimed) return '';                     the claim button goes
     const unclaimed = …filter(b => !b.claimed);   and so does the listing

   …which makes the two dropped branches ORPHANS: locked, ownerless, and
   unclaimable by anybody — their owner included. The approval did damage
   no screen could undo, with no message, no console error and no log line.

   ⚠️ THE MIGRATION IS THE DANGEROUS HALF, not the model change. Every
   device that has ever opened the app carries `myBusinessId` in its own
   localStorage, and changing DEFAULTS does not touch it — so without
   block 1 every existing owner loses their listing the moment this lands. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { withDemoData } from './_demo.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const NOW = Date.now();
const ACCOUNT = {
  name: 'رامي', email: 'a@b.c', emailVerified: true,
  phone: '7134669182', phoneVerified: true, tier: 2, joined: NOW - 9e8,
};

const browser = await chromium.launch();
/* ⚠️ THIS SUITE USES THE INVENTED RECORDS AS ITS FIXTURE, and `510`
   turned them off by default. It turns them on for itself — the
   default is not reverted and no assertion is softened. */
await withDemoData(browser);
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
};
/* the importmap rule: `arabna/…` reaches the app's own instance */
const mount = p => p.evaluate(async () => {
  window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
});
const openWith = async (state) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(s => localStorage.setItem('arabna.v1', JSON.stringify(s)), state);
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + '#/home', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500); await mount(p);
  return { ctx, p };
};
const disk = p => p.evaluate(() => JSON.parse(localStorage.getItem('arabna.v1')));

/* ---- 1. the migration: an existing owner does not lose their page ---- */
{
  const { ctx, p } = await openWith({ lang: 'ar', user: ACCOUNT, myBusinessId: 'b1' });
  const d = await disk(p);
  const s = await p.evaluate(() => ({
    ids: window.__S.state.myBusinessIds,
    singularGone: !('myBusinessId' in window.__S.state),
    owns: window.__S.ownsBusiness('b1'),
    primary: window.__S.primaryBusinessId(),
  }));
  ok('1.1 the single id was folded in, not dropped',
    Array.isArray(s.ids) && s.ids.length === 1 && s.ids[0] === 'b1', JSON.stringify(s.ids));
  ok('1.2 ownership survives the upgrade', s.owns === true);
  ok('1.3 primaryBusinessId is that same one', s.primary === 'b1', String(s.primary));
  ok('1.4 the old key is gone from state', s.singularGone === true);
  /* …and from the DISK too, or it is folded again on every single launch */
  ok('1.5 …and gone from localStorage', !('myBusinessId' in d));
  await ctx.close();
}

/* ---- 2. a key present but null is removed as well -------------------- */
/* `if (state.myBusinessId)` would leave it behind on every device that
   ever ran the app without owning anything — which is most of them. The
   test is `!== undefined`, and this is the check that holds it there. */
{
  const { ctx, p } = await openWith({ lang: 'ar', myBusinessId: null });
  const d = await disk(p);
  const ids = await p.evaluate(() => window.__S.state.myBusinessIds);
  ok('2.1 a null key is cleared, not carried for ever', !('myBusinessId' in d));
  ok('2.2 …and the list is empty, not [null]',
    Array.isArray(ids) && ids.length === 0, JSON.stringify(ids));
  await ctx.close();
}

/* ---- 3. three approvals leave three owned --------------------------- */
{
  const { ctx, p } = await openWith({ lang: 'ar', user: ACCOUNT, myBusinessIds: [] });
  const r = await p.evaluate(() => {
    const S = window.__S;
    const ids = S.allBusinesses().slice(0, 3).map(b => b.id);
    for (const id of ids) {
      const c = S.requestClaim(id, { name: 'رامي', role: 'مالك', phone: '7134669182' });
      S.approveClaim(c.id);
    }
    return { ids, owned: S.state.myBusinessIds.slice(),
             owns: ids.map(id => S.ownsBusiness(id)),
             mine: S.myBusinesses().length,
             deletion: S.deletionSummary().business };
  });
  ok('3.1 all three are owned — the approval ADDS',
    r.owned.length === 3 && r.ids.every(id => r.owned.includes(id)), JSON.stringify(r.owned));
  /* the first is the one the old line silently dropped */
  ok('3.2 the FIRST branch is still owned', r.owns[0] === true);
  ok('3.3 ownsBusiness agrees on all three', r.owns.every(Boolean));
  ok('3.4 myBusinesses() returns three records', r.mine === 3, String(r.mine));
  /* «ماذا يُحذَف» said 1 to somebody who owned three */
  ok('3.5 the deletion sheet counts three', r.deletion === 3, String(r.deletion));

  /* approving the same claim twice must not double the entry */
  const again = await p.evaluate(() => {
    const S = window.__S;
    const id = S.state.myBusinessIds[0];
    const c = S.requestClaim(id, { name: 'رامي', role: 'مالك', phone: '7134669182' });
    S.approveClaim(c.id);
    return S.state.myBusinessIds.filter(x => x === id).length;
  });
  ok('3.6 a repeated approval does not duplicate', again === 1, String(again));

  /* ---- 4. and signing out still ends every one of them ------------- */
  const after = await p.evaluate(() => {
    const S = window.__S;
    const first = S.state.myBusinessIds[0];
    S.signOut();
    return { ids: S.state.myBusinessIds, owns: S.ownsBusiness(first),
             mine: S.myBusinesses().length, theme: S.state.theme, lang: S.state.lang };
  });
  ok('4.1 the list is empty after signing out',
    Array.isArray(after.ids) && after.ids.length === 0, JSON.stringify(after.ids));
  ok('4.2 ownsBusiness says false — 225 still holds', after.owns === false);
  ok('4.3 myBusinesses() is empty for a visitor', after.mine === 0, String(after.mine));
  ok('4.4 the device keeps its own (the 195 rule)',
    after.lang === 'ar' && after.theme !== undefined, `${after.lang} · ${after.theme}`);
  await ctx.close();
}

/* ---- 5. a visitor owns nothing, whatever is on the device ----------- */
/* the stronger half of 225: no signOut has run here — the device simply
   still carries the state, and the accessor is what refuses. */
{
  const { ctx, p } = await openWith({ lang: 'ar', user: null, myBusinessIds: ['b1', 'b2'] });
  const r = await p.evaluate(() => ({
    logged: window.__S.isLoggedIn(),
    owns: window.__S.ownsBusiness('b1'),
    mine: window.__S.myBusinesses().length,
  }));
  ok('5.1 a visitor is not signed in', r.logged === false);
  ok('5.2 …and owns nothing, with the ids still on disk', r.owns === false);
  ok('5.3 …and myBusinesses() is empty', r.mine === 0, String(r.mine));
  await ctx.close();
}

/* ---- 6. the screens still work for a one-business owner ------------- */
{
  const { ctx, p } = await openWith({ lang: 'ar', user: ACCOUNT, myBusinessIds: ['b1'] });
  await p.evaluate(() => { location.hash = '#/my-business'; });
  await p.waitForTimeout(800);
  const sc = await p.evaluate(() => ({
    hash: location.hash,
    txt: (document.querySelector('#app') || document.body).innerText.replace(/\s+/g, ' '),
  }));
  ok('6.1 #/my-business opens for the owner', sc.hash === '#/my-business', sc.hash);
  ok('6.2 …and offers the second listing', /نشاط آخر/.test(sc.txt));
  await ctx.close();
}

ok('7.1 no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
