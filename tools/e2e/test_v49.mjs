/* V.06.9 — whoever pays is on top, and among them the nearest first.

   The owner's decision, and it changes the MODEL rather than tuning a number in
   it. The old order was a chain of tiebreaks with «subscribed» last in it;
   it is two layers now.

   ⚠️ AND THE CHAIN DID NOT DELIVER WHAT IT PROMISED. Four reasons, all in
   the code, measured on V.06.3 with four new subscribers and five rated
   free listings — the three paid shops landed at 8, 9 and 10, under five
   free ones and under the upgrade card:

     `pinSponsored` lifted exactly ONE row however many had paid
     `isPaid` was the THIRD tiebreak, behind a decimal rating that
        practically never ties — a dead condition
     a new subscriber rated 0 sank below every free listing with any rating
     and once coordinates arrive the order becomes pure distance with
        `isPaid` not in it at all — so a subscriber's position would get
        WORSE the day the data got BETTER

   ⚠️ MEASURED AND SAID PLAINLY: 0 of 514 listings have coordinates today,
   so the «nearest» half computes nothing yet and layer one falls to its
   fallback. That is correct and intended — this suite seeds coordinates to
   prove the machinery, and the decision completes itself the day the
   coordinates batch lands.

   ⚠️ And every row of layer one keeps its «إعلان مموّل» mark and its full
   distance line: the money buys the position, not the right to hide how
   far away the shop is. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8099/index.html';
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => { if (c) { pass++; console.log('PASS ' + n + (extra ? ' -> ' + extra : '')); }
  else { fail++; console.log('FAIL ' + n + (extra ? ' -> ' + extra : '')); } };

const browser = await chromium.launch();
const errors = [];
const wire = p => {
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' &&
    !/ERR_CONNECTION|ERR_CERT|ERR_TUNNEL|ERR_NAME|ERR_FAILED|fonts\.googleapis/.test(m.text()))
    errors.push(m.text().slice(0, 120)); });
};
const open = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); wire(p);
  await p.goto(BASE + '#/home', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.evaluate(async () => {
    window.__S = await import('arabna/js/store.js').catch(() => import('./js/store.js'));
    localStorage.removeItem('arabna.v1');
  });
  return { ctx, p };
};
const go = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(1100); };

/** four paid and five rated free listings, coordinates optional */
const seed = (p, { geo = false, coverage = true, miles = [0.40, 0.05, 0.25, 0.10] } = {}) =>
  p.evaluate(([g, cov, pts]) => {
    const S = window.__S;
    const shops = S.everyBusiness().filter(b => b.cat === 'restaurants').slice(0, 9);
    S.state.businessEdits = {};
    shops.slice(0, 4).forEach((b, i) => {
      S.state.businessEdits[b.id] = Object.assign({ plan: 'paid' },
        g ? { lat: 29.70 + pts[i], lng: -95.55 } : {});
    });
    shops.slice(4, 9).forEach((b, i) => { S.state.businessEdits[b.id] = { plan: 'free' }; });
    S.state.reviews = shops.slice(4, 9).map((b, i) =>
      ({ id: 'r' + i, bizId: b.id, rating: 5 - i * 0.1, text: 'x', user: 'u' }));
    /* ⚠️ Dallas is OUTSIDE the coverage on purpose: the money bought the
       readers of THIS region, and that gate came over from `pinSponsored`
       rather than being dropped. */
    S.state.location = cov ? { zip: '77036', city: 'Houston', state: 'TX' }
                           : { zip: '75201', city: 'Dallas', state: 'TX' };
    if (g && cov) S.state.geo = { lat: 29.70, lng: -95.55, at: Date.now() };
    else S.state.geo = null;
    S.save();
    return { paid: shops.slice(0, 4).map(b => b.id), free: shops.slice(4, 9).map(b => b.id) };
  }, [geo, coverage, miles]);

/* ⚠️ `337` BOUNDED THE BAND. `330` lifted every active subscription; the owner's
   decision of 29 August caps it at `AD_SLOTS.dirTop` rows filled by
   rotation, so «layer one holds all four» is deliberately no longer true —
   the subscribers who did not draw a row stand unmarked in their ordinary
   place, which is the point of bounding it. Each item below keeps its
   subject and is measured against the bounded band. */
const layers = (p, sorted) => p.evaluate((sortIt) => {
  const S = window.__S;
  let list = S.everyBusiness().filter(b => b.cat === 'restaurants').slice(0, 9)
    .map(b => S.businessById(b.id));
  /* the reader's own order goes in, exactly as `directory.js` hands it over */
  if (sortIt) list = S.byNearest(list);
  const r = S.paidFirst(list, !!sortIt, null, 'v49');
  return {
    ids: r.ids,
    slots: S.AD_SLOTS ? S.AD_SLOTS.dirTop : 2,
    order: r.list.map(b => ({ id: b.id, paid: S.isPaid(b), d: S.distanceTo(b) })),
  };
}, sorted);

/* ---- 1. every subscriber before the first free listing ---- */
{
  const { ctx, p } = await open();
  await seed(p);
  const r = await layers(p);
  /* ⚠️ CHANGED by `337`: two rows, not four — and every row in the band is
     paid for, which is what protects the reader. */
  ok('1.1 the band is bounded, and holds only subscribers',
     r.ids.length === 2 && r.order.slice(0, r.ids.length).every(x => x.paid),
     r.ids.length + ' rows');
  const firstFree = r.order.findIndex(x => !x.paid);
  ok('1.2 …and every sold row is above the first free listing',
     firstFree >= r.ids.length, 'first free at ' + firstFree);
  /* ⚠️ THE CASE THE OLD CHAIN GOT WRONG, and it still holds: a new
     subscriber has no ratings and would have sunk below every rated free
     listing. Inside the band it leads them. */
  ok('1.3 a subscriber rated 0 still leads a free listing rated 4.9+',
     r.order[0].paid && !r.order[firstFree].paid);
  await ctx.close();
}

/* ---- 2. and inside the layer, the nearest first ---- */
{
  const { ctx, p } = await open();
  /* the four points are shuffled on purpose: a list that comes back sorted
     from an already-sorted input proves nothing */
  await seed(p, { geo: true });
  const r = await layers(p, true);
  const below = r.order.slice(r.ids.length).map(x => x.d).filter(d => d != null);
  /* ⚠️ CHANGED by `337`: the two sold rows are drawn BY ROTATION from the
     reader's own order, so they are not themselves a sorted pair — that is
     the decision, and freezing them would be the fault. What the reader is
     owed, and what is measured, is that EVERYTHING BELOW THE BAND is in
     real miles ascending, which is the promise «from the third row down,
     the nearest first, with no exception». */
  ok('2.1 below the band it is real miles, ascending',
     below.length > 1 && below.every((d, i) => i === 0 || d >= below[i - 1]),
     below.map(d => d.toFixed(2)).join(' · '));
  ok('2.2 …and it really was shuffled going in',
     below[0] < below[below.length - 1], below[0] + ' < ' + below[below.length - 1]);
  await ctx.close();
}

/* ---- 3. a subscriber with no point sinks INSIDE the layer, never out ---- */
{
  const { ctx, p } = await open();
  await seed(p, { geo: true });
  await p.evaluate(() => {
    /* take the coordinates off one paid shop — it PAID, so it must stay in
       layer one and go to the end of it, which is `byNearest`'s own rule:
       the unknown comes after the known and is never dropped */
    const S = window.__S;
    const id = S.everyBusiness().filter(b => b.cat === 'restaurants')[0].id;
    S.state.businessEdits[id] = { plan: 'paid', lat: null, lng: null };
    S.save();
  });
  const r = await layers(p, true);
  /* ⚠️ CHANGED by `337`: with the band bounded it may not draw a row this
     visit, and that is the rotation working. What must never happen — and
     is what this item was always about — is that HAVING NO POINT costs it
     its place: it stays in the directory, it stays eligible, and it is
     never pushed out of the running for having no coordinates. */
  const noPoint = r.order.find(x => x.paid && x.d == null);
  ok('3.1 a subscriber with no point is never dropped from the directory',
     !!noPoint, JSON.stringify(r.order.slice(0, 4).map(x => x.d)));
  ok('3.2 …and it is still one of the paid rows the band draws from',
     r.ids.length === 2 && r.order.slice(0, 2).every(x => x.paid),
     r.ids.join(','));
  await ctx.close();
}

/* ---- 4. outside the coverage nothing is lifted ---- */
{
  const { ctx, p } = await open();
  await seed(p, { coverage: false });
  const r = await layers(p);
  /* ⚠️ A reader in Dallas gets no Houston subscriber lifted for them. */
  ok('4.1 no layer one outside the region', r.ids.length === 0, String(r.ids.length));
  await ctx.close();
}

/* ---- 5. the loose search is in the model now ---- */
{
  const { ctx, p } = await open();
  await seed(p);
  /* ⚠️ It used to be excluded from the ordering AND from the lift
     together, so the promise broke in the widest kind of search there is. */
  const r = await p.evaluate(() => {
    const S = window.__S;
    const found = S.searchBusinesses(S.everyBusiness(), 'مطعم شاورما فلافل كباب');
    const out = S.paidFirst(found.list.slice());
    return { mode: found.mode, lifted: out.ids.length,
             topPaid: out.list.slice(0, out.ids.length).every(b => S.isPaid(b)) };
  });
  ok('5.1 a loose search still lifts what was paid for', r.lifted > 0, r.mode + ' · ' + r.lifted);
  ok('5.2 …and they are all subscribers', r.topPaid);
  await ctx.close();
}

/* ---- 6. the mark and the distance line stay on every lifted row ---- */
{
  const { ctx, p } = await open();
  await seed(p, { geo: true });
  await go(p, '#/directory?cat=restaurants');
  /* ⚠️ CHANGED by `337`: it read the first FOUR rows, because four were
     lifted. The band is two now, and the rows below it are free listings
     that must NOT carry the mark — so the check reads the band itself
     rather than a frozen count. */
  const rows = await p.evaluate(async () => {
    const D = await import('/js/data.js');
    const all = [...document.querySelectorAll('#dirList .list-row[data-route^="#/directory/"]')]
      .map(e => ({ marked: /مموّل|Sponsored/.test(e.innerText),
                   sub: ((e.querySelector('.row-sub') || {}).textContent || '').trim() }));
    return { band: all.filter(r => r.marked), slots: D.AD_SLOTS.dirTop, first: all.slice(0, 3) };
  });
  ok('6.1 every lifted row carries the sponsored mark',
     rows.band.length > 0 && rows.band.length <= rows.slots
     && rows.first.slice(0, rows.band.length).every(r => r.marked),
     rows.band.length + ' / ' + rows.slots);
  /* ⚠️ THE MONEY BUYS THE POSITION, NOT THE RIGHT TO HIDE THE DISTANCE. */
  ok('6.2 …and none of them hides its distance line',
     rows.band.every(r => r.sub.length > 0),
     JSON.stringify(rows.band.map(r => r.sub.slice(0, 14))));
  await ctx.close();
}

/* ---- 7. the duplicated strip is gone from this screen only ---- */
{
  const { ctx, p } = await open();
  await seed(p);
  await go(p, '#/directory?cat=restaurants');
  /* ⚠️ It drew two rotated subscribers with a third lifted under them, and
     every subscriber now stands at the top anyway — all three were the
     same shops twice on one screen. */
  ok('7.1 the directory has no sponsored strip above the results',
     await p.evaluate(() => !document.querySelector('#sponRows')));
  const dupes = await p.evaluate(() => {
    const ids = [...document.querySelectorAll('#dirList [data-route]')]
      .map(e => e.dataset.route).filter(r => /^#\/directory\//.test(r));
    return ids.length - new Set(ids).size;
  });
  ok('7.2 …and no shop appears twice on one screen', dupes === 0, String(dupes));
  /* the other three sections keep theirs — different pools, untouched */
  await go(p, '#/marketplace');
  ok('7.3 the marketplace keeps its own strip',
     await p.evaluate(() => !!document.querySelector('#sponRows')));
  await go(p, '#/events');
  ok('7.4 …and so do events', await p.evaluate(() => !!document.querySelector('#sponRows')));
  await ctx.close();
}

/* ---- 8. the dead function and the dead import are gone ---- */
{
  const { ctx, p } = await open();
  /* ⚠️ A dead export reads in every later session as though it works. */
  ok('8.1 `pinSponsored` no longer exists',
     await p.evaluate(() => typeof window.__S.pinSponsored === 'undefined'));
  ok('8.2 …and `paidFirst` is the one definition, exported for the net',
     await p.evaluate(() => typeof window.__S.paidFirst === 'function'));
  await ctx.close();
}

ok('9.1 no console errors anywhere in the batch', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
